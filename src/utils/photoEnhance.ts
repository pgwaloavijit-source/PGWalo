const TARGET_W = 960;
const TARGET_H = 720;

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const srcRatio = img.width / img.height;
  const dstRatio = TARGET_W / TARGET_H;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (srcRatio > dstRatio) {
    sw = img.height * dstRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / dstRatio;
    sy = (img.height - sh) / 2;
  }
  ctx.filter = 'saturate(1.06) contrast(1.05) brightness(1.03)';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, TARGET_W, TARGET_H);
  ctx.filter = 'none';
}

export async function normalizeListingPhoto(file: File): Promise<{ blob: Blob; dataUrl: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read photo'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Invalid image'));
    el.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = TARGET_W;
  canvas.height = TARGET_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { blob: file, dataUrl };

  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, TARGET_W, TARGET_H);
  drawCover(ctx, img);

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b || file), 'image/jpeg', 0.62);
  });
  return { blob, dataUrl: canvas.toDataURL('image/jpeg', 0.62) };
}
