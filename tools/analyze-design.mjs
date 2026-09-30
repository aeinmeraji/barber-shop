/**
 * Design helper: measures bright/dark segments along chosen rows and columns of the
 * reference mockups so that crops and spacing match the design exactly.
 *
 * Usage: node tools/analyze-design.mjs
 */
import sharp from 'sharp';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TARAHI = path.join(ROOT, 'tarahi');

const JOBS = [
  { file: 'first page p1.png', rows: [70, 300, 445, 600, 660], cols: [60, 200, 480, 700, 950], threshold: 55 },
  { file: 'first page p2.png', rows: [60, 200, 400, 520, 660], cols: [60, 200, 460, 560, 900], threshold: 55 },
  { file: 'barbers.png', rows: [120, 300, 460, 620, 760, 1000, 1200, 1400], cols: [60, 300, 560, 700, 900], threshold: 55 },
  { file: 'bar.png', rows: [10, 54, 100], cols: [10, 200, 700], threshold: 90 },
  { file: 'navigation.png', rows: [47], cols: [60, 400, 500], threshold: 55 },
];

const segments = (line, threshold) => {
  const out = [];
  let start = null;
  for (let i = 0; i < line.length; i += 1) {
    const bright = line[i] >= threshold;
    if (bright && start === null) start = i;
    if ((!bright || i === line.length - 1) && start !== null) {
      const end = bright ? i : i - 1;
      if (end - start >= 2) out.push(`${start}-${end}(${end - start + 1})`);
      start = null;
    }
  }
  return out.join(' ');
};

for (const job of JOBS) {
  const file = path.join(TARAHI, job.file);
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  console.log(`\n=== ${job.file} (${width}x${height}) threshold=${job.threshold} ===`);
  for (const y of job.rows.filter((v) => v < height)) {
    const line = Array.from({ length: width }, (_, x) => data[y * width + x]);
    console.log(`row y=${y}: ${segments(line, job.threshold)}`);
  }
  for (const x of job.cols.filter((v) => v < width)) {
    const line = Array.from({ length: height }, (_, y) => data[y * width + x]);
    console.log(`col x=${x}: ${segments(line, job.threshold)}`);
  }
}
