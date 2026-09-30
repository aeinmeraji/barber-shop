/**
 * Finds the gold card borders of the mockups (long runs of gold-ish pixels) and
 * prints the resulting card rectangles so crops match the design pixel for pixel.
 *
 * Usage: node tools/analyze-borders.mjs
 */
import sharp from 'sharp';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TARAHI = path.join(ROOT, 'tarahi');

const FILES = ['first page p1.png', 'first page p2.png', 'barbers.png', 'main page.png'];

const isGold = (r, g, b) => r > 92 && r - b > 26 && g - b > 12 && Math.abs(r - g) < 70;

const mergeRuns = (hits, min) => {
  const out = [];
  let start = null;
  for (let i = 0; i < hits.length; i += 1) {
    if (hits[i] && start === null) start = i;
    if ((!hits[i] || i === hits.length - 1) && start !== null) {
      const end = hits[i] ? i : i - 1;
      if (end - start + 1 >= min) out.push([start, end]);
      start = null;
    }
  }
  return out;
};

for (const file of FILES) {
  const { data, info } = await sharp(path.join(TARAHI, file)).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const px = (x, y) => {
    const i = (y * width + x) * channels;
    return [data[i], data[i + 1], data[i + 2]];
  };

  console.log(`\n=== ${file} (${width}x${height}) ===`);

  // horizontal border lines (long gold runs along x)
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const hits = Array.from({ length: width }, (_, x) => isGold(...px(x, y)));
    for (const [a, b] of mergeRuns(hits, 150)) rows.push({ y, a, b });
  }
  console.log('horizontal gold runs (y: x1-x2):');
  console.log(rows.map((r) => `y=${r.y}:${r.a}-${r.b}`).join('  '));

  // vertical border lines (long gold runs along y)
  const cols = [];
  for (let x = 0; x < width; x += 1) {
    const hits = Array.from({ length: height }, (_, y) => isGold(...px(x, y)));
    for (const [a, b] of mergeRuns(hits, 120)) cols.push({ x, a, b });
  }
  console.log('vertical gold runs (x: y1-y2):');
  console.log(cols.map((c) => `x=${c.x}:${c.a}-${c.b}`).join('  '));
}
