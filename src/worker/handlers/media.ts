import { Env } from '../types';
import { addCorsHeaders } from '../utils/cors';
import { authMiddleware } from '../middleware/auth';

const ENHANCE_PROMPT =
  'professional real estate photograph of a clean paying guest room in India, natural daylight, straight walls, balanced white, no people, no watermark, photorealistic interior';

function json(data: unknown, status = 200) {
  return addCorsHeaders(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

function safeName(raw: string) {
  return raw.replace(/\.\./g, '').replace(/[^a-zA-Z0-9/_.-]/g, '_').slice(0, 180);
}

async function arrayBufferToBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function streamToArrayBuffer(stream: ReadableStream | ArrayBuffer | Uint8Array | { image?: string }) {
  if (stream instanceof ArrayBuffer) return stream;
  if (stream instanceof Uint8Array) return stream.buffer;
  if (typeof stream === 'object' && stream && 'image' in stream && typeof stream.image === 'string') {
    const bin = atob(stream.image);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  if (stream && typeof (stream as ReadableStream).getReader === 'function') {
    return new Response(stream as ReadableStream).arrayBuffer();
  }
  return new ArrayBuffer(0);
}

export async function mediaHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'POST' && (path === '/api/media/upload' || path === '/api/media/enhance')) {
    const auth = await authMiddleware(request, env);
    const signedIn = Boolean(auth.success && auth.user);
    if (path === '/api/media/enhance' && (!signedIn || !['owner', 'admin'].includes(auth.user!.role))) {
      return json({ error: 'Sign in as the property owner to enhance photos' }, 401);
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const category = String(formData.get('category') || 'Bedroom').slice(0, 40);
    if (!file || typeof file === 'string') return json({ error: 'No file provided' }, 400);

    const blob = file as File;
    if (blob.size > 8 * 1024 * 1024) return json({ error: 'Photo must be under 8 MB' }, 400);
    if (!String(blob.type || '').startsWith('image/')) return json({ error: 'Only images are allowed' }, 400);

    let bytes = await blob.arrayBuffer();
    let contentType = blob.type || 'image/jpeg';
    let enhanced = false;

    if (path === '/api/media/enhance' && env.AI) {
      try {
        const image_b64 = await arrayBufferToBase64(bytes);
        const result = await env.AI.run('@cf/runwayml/stable-diffusion-v1-5-img2img', {
          prompt: ENHANCE_PROMPT,
          negative_prompt: 'people, faces, text, watermark, blurry, distorted, extra furniture clutter',
          image_b64,
          strength: 0.28,
          num_steps: 12,
          guidance: 6,
          seed: 42,
        });
        const out = await streamToArrayBuffer(result as never);
        if (out.byteLength > 1000) {
          const copy = new Uint8Array(out.byteLength);
          copy.set(new Uint8Array(out));
          bytes = copy.buffer;
          contentType = 'image/png';
          enhanced = true;
        }
      } catch (error) {
        console.error('photo enhance', error);
      }
    }

    const ownerId = (auth.user?.id || 'listing').replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = safeName(`owners/${ownerId}/${category}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${contentType.includes('png') ? 'png' : 'jpg'}`);

    if (env.MEDIA) {
      await env.MEDIA.put(filename, bytes, { httpMetadata: { contentType } });
      return json({ success: true, filename, url: `/api/media/${filename}`, enhanced });
    }

    if (env.CACHE) {
      await env.CACHE.put(`media:${filename}`, bytes, { metadata: { contentType } });
      return json({ success: true, filename, url: `/api/media/${filename}`, enhanced });
    }

    const dataUrl = `data:${contentType};base64,${await arrayBufferToBase64(bytes)}`;
    return json({ success: true, dataUrl, enhanced });
  }

  if (request.method === 'GET' && path.startsWith('/api/media/')) {
    const filename = safeName(path.replace('/api/media/', ''));
    if (env.MEDIA) {
      const object = await env.MEDIA.get(filename);
      if (object) {
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('Cache-Control', 'public, max-age=31536000');
        return addCorsHeaders(new Response(object.body, { headers }));
      }
    }
    if (env.CACHE) {
      const stored = await env.CACHE.getWithMetadata(`media:${filename}`, 'arrayBuffer');
      if (stored.value) {
        const contentType = (stored.metadata as { contentType?: string } | null)?.contentType || 'image/jpeg';
        return addCorsHeaders(new Response(stored.value, {
          headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000' },
        }));
      }
    }
    return json({ error: 'File not found' }, 404);
  }

  if (request.method === 'DELETE' && path.startsWith('/api/media/')) {
    const auth = await authMiddleware(request, env);
    if (!auth.success || !['owner', 'admin'].includes(auth.user!.role)) {
      return json({ error: 'Forbidden' }, 403);
    }
    if (!env.MEDIA) return json({ error: 'Photo storage is not configured' }, 503);
    const filename = safeName(path.replace('/api/media/', ''));
    if (!filename.startsWith(`owners/${auth.user!.id}`)) return json({ error: 'Forbidden' }, 403);
    await env.MEDIA.delete(filename);
    return json({ success: true });
  }

  return json({ error: 'Invalid media endpoint' }, 400);
}
