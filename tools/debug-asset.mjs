/**
 * Debug helper: dumps the intermediate layers of one asset pipeline into .preview/debug/.
 * Usage: node tools/debug-asset.mjs
 */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TARAHI = path.join(ROOT, 'tarahi');
const OUT = path.join(ROOT, '.preview', 'debug');

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t) => t * t * (3 - 2 * t);

function axisCoverage(v, lo, hi, feather) {
  if (v >= lo && v <= hi) return 1;
  const distance = v < lo ? lo - v : v - hi;
  return smoothstep(clamp01(1 - distance / feather));
}

async function softMask(width, height, rects, feather) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let coverage = 0;
      for (const r of rects) {
        const c =
          axisCoverage(x, r.left, r.left + r.width, feather) *
          axisCoverage(y, r.top, r.top + r.height, feather);
        if (c > coverage) coverage = c;
      }
      const i = (y * width + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(255 * coverage);
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

const rects = [{ left: 18, top: 40, width: 346, height: 204 }];
const feather = 32;
const width = 376;
const height = 580;

await fs.mkdir(OUT, { recursive: true });

const base = await sharp(path.join(TARAHI, 'barbers.png'))
  .extract({ left: 23, top: 849, width, height })
  .toBuffer();
await sharp(base).jpeg({ quality: 90 }).toFile(path.join(OUT, 'dbg-base.jpg'));

const mask = await softMask(width, height, rects, feather);
const maskStats = await sharp(mask).stats();
console.log('mask alpha mean:', maskStats.channels[3]?.mean, 'isOpaque:', maskStats.isOpaque);
await sharp(mask).flatten({ background: '#202020' }).png().toFile(path.join(OUT, 'dbg-mask.png'));

const smeared = await sharp(base)
  .extract(rects[0])
  .resize({ width: 10, kernel: 'lanczos3', fit: 'fill' })
  .blur(2)
  .resize({ width: rects[0].width, height: rects[0].height, kernel: 'lanczos3', fit: 'fill' })
  .toBuffer();
await sharp(smeared).jpeg({ quality: 90 }).toFile(path.join(OUT, 'dbg-smear-region.jpg'));

const layer = await sharp({ create: { width, height, channels: 3, background: '#000' } })
  .composite([{ input: smeared, left: rects[0].left, top: rects[0].top }])
  .png()
  .toBuffer();
await sharp(layer).jpeg({ quality: 90 }).toFile(path.join(OUT, 'dbg-smear-layer.jpg'));

const masked = await sharp(layer).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
const layerStats = await sharp(masked).stats();
console.log('masked layer alpha mean:', layerStats.channels[3]?.mean);
await sharp(masked).flatten({ background: '#202020' }).png().toFile(path.join(OUT, 'dbg-layer-masked.png'));

const final = await sharp(base)
  .composite([{ input: masked, blend: 'over' }])
  .jpeg({ quality: 90 })
  .toFile(path.join(OUT, 'dbg-final.jpg'));
console.log('written', final.width, final.height);
