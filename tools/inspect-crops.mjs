/**
 * Writes inspection crops of the mockups into .preview/crops/ (not shipped with the site).
 * Usage: node tools/inspect-crops.mjs
 */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TARAHI = path.join(ROOT, 'tarahi');
const OUT = path.join(ROOT, '.preview', 'crops');

const CROPS = [
  { file: 'first page p1.png', name: 'p1-location.jpg', left: 0, top: 480, width: 1024, height: 242 },
  { file: 'first page p1.png', name: 'p1-hero.jpg', left: 0, top: 100, width: 1024, height: 390 },
  { file: 'first page p2.png', name: 'p2-top.jpg', left: 0, top: 0, width: 1024, height: 250 },
  { file: 'first page p2.png', name: 'p2-cards.jpg', left: 390, top: 180, width: 634, height: 400 },
  { file: 'first page p2.png', name: 'p2-footer.jpg', left: 0, top: 580, width: 1024, height: 119 },
  { file: 'barbers.png', name: 'b-photos.jpg', left: 0, top: 495, width: 1024, height: 360 },
  { file: 'barbers.png', name: 'b-form-top.jpg', left: 0, top: 840, width: 1024, height: 260 },
  { file: 'barbers.png', name: 'b-form-bottom.jpg', left: 0, top: 1290, width: 1024, height: 246 },
  { file: 'first page p1.png', name: 'p1-email.jpg', left: 620, top: 640, width: 300, height: 50, scale: 3 },
  { file: 'barbers.png', name: 'b-note.jpg', left: 420, top: 1415, width: 560, height: 30, scale: 3 },
  { file: 'barbers.png', name: 'b-hero-text.jpg', left: 20, top: 120, width: 520, height: 400, scale: 1 },
  { file: 'barbers.png', name: 'b-form-side.jpg', left: 20, top: 900, width: 400, height: 560, scale: 1 },
];

await fs.mkdir(OUT, { recursive: true });

for (const crop of CROPS) {
  const meta = await sharp(path.join(TARAHI, crop.file)).metadata();
  const width = Math.min(crop.width, meta.width - crop.left);
  const height = Math.min(crop.height, meta.height - crop.top);
  let pipeline = sharp(path.join(TARAHI, crop.file)).extract({ left: crop.left, top: crop.top, width, height });
  if (crop.scale && crop.scale !== 1) {
    pipeline = pipeline.resize({ width: width * crop.scale, kernel: 'lanczos3' });
  }
  await pipeline.jpeg({ quality: 92 }).toFile(path.join(OUT, crop.name));
  console.log(`${crop.name} ${width}x${height}`);
}
