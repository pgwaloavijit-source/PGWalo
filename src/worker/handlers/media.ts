import { Env } from '../types';
import { addCorsHeaders } from '../utils/cors';

export async function mediaHandler(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Upload media
  if (request.method === 'POST' && path === '/api/media/upload') {
    if (!env.MEDIA) {
      const response = new Response(JSON.stringify({ error: 'R2 storage not configured' }), { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const category = (formData.get('category') as string) || 'general';

    if (!file || typeof file === 'string') {
      const response = new Response(JSON.stringify({ error: 'No file provided' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }

    try {
      // Generate unique filename
      const timestamp = Date.now();
      const extension = (file as File).name.split('.').pop();
      const filename = `${category}/${timestamp}-${Math.random().toString(36).slice(2, 7)}.${extension}`;

      // Upload to R2
      await env.MEDIA.put(filename, (file as File).stream(), {
        httpMetadata: {
          contentType: (file as File).type,
        },
      });

      // Generate public URL (you may want to use a CDN or signed URLs)
      const publicUrl = `/api/media/${filename}`;

      const response = new Response(JSON.stringify({ 
        success: true,
        filename,
        url: publicUrl,
        size: (file as File).size,
        type: (file as File).type
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('Upload error:', error);
      const response = new Response(JSON.stringify({ error: 'Upload failed' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }
  }

  // Download media
  if (request.method === 'GET' && path.startsWith('/api/media/')) {
    if (!env.MEDIA) {
      const response = new Response(JSON.stringify({ error: 'R2 storage not configured' }), { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }

    const filename = path.replace('/api/media/', '');

    try {
      const object = await env.MEDIA.get(filename);

      if (!object) {
        const response = new Response(JSON.stringify({ error: 'File not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
        return addCorsHeaders(response);
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('Cache-Control', 'public, max-age=31536000'); // 1 year cache

      return new Response(object.body, { headers });
    } catch (error) {
      console.error('Download error:', error);
      const response = new Response(JSON.stringify({ error: 'Download failed' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }
  }

  // Delete media
  if (request.method === 'DELETE' && path.startsWith('/api/media/')) {
    if (!env.MEDIA) {
      const response = new Response(JSON.stringify({ error: 'R2 storage not configured' }), { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }

    const filename = path.replace('/api/media/', '');

    try {
      await env.MEDIA.delete(filename);

      const response = new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    } catch (error) {
      console.error('Delete error:', error);
      const response = new Response(JSON.stringify({ error: 'Delete failed' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }
  }

  const response = new Response(JSON.stringify({ error: 'Invalid media endpoint' }), { 
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  });
  return addCorsHeaders(response);
}