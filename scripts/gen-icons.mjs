import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';

const svg = readFileSync('public/icon.svg');

// Square raster icons from the SVG
const sizes = [
  ['public/pwa-192x192.png', 192],
  ['public/pwa-512x512.png', 512],
  ['public/apple-touch-icon.png', 180],
  ['public/logo.png', 512],
  ['public/pgwalo-logo.png', 512],
];
for (const [out, size] of sizes) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(out);
  console.log('wrote', out, size);
}

// Maskable: mark centered at 80% safe zone on the blue brand color
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#FFFFFF"/>
  <g transform="translate(51.2,51.2) scale(0.8)" fill="#1769FF">
    <path d="M104 300 C92 300 82 294 76 284 C68 271 71 255 82 244 L218 108 C239 87 273 87 294 108 L430 244 C441 255 444 271 436 284 C430 294 420 300 408 300 C399 300 391 297 384 290 L256 162 L128 290 C121 297 113 300 104 300 Z"/>
    <rect x="222" y="238" width="30" height="30" rx="7"/>
    <rect x="260" y="238" width="30" height="30" rx="7"/>
    <rect x="222" y="276" width="30" height="30" rx="7"/>
    <rect x="260" y="276" width="30" height="30" rx="7"/>
  </g>
</svg>`;
await sharp(Buffer.from(maskable), { density: 384 }).resize(512, 512).png().toFile('public/pwa-maskable-512x512.png');
console.log('wrote maskable');
