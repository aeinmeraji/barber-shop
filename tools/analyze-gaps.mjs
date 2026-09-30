/**
 * Detects the dark page-background gaps between the cards of the mockups.
 * Prints runs of "background" pixels (luminance < limit) so card edges can be read off.
 *
 * Usage: node tools/analyze-gaps.mjs
 */
import sharp from 'sharp';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TARAHI = path.join(ROOT, 'tarahi');

const JOBS = [
  {
    file: 'first page p1.png',
    rows: [130, 300, 465, 520, 620, 705],
    cols: [100, 300, 470, 545, 990],
    limit: 42,
  },
  {
    file: 'first page p2.png',
    rows: [30, 150, 300, 500, 600, 645, 675],
    cols: [340, 400, 420, 1000],
    limit: 42,
  },
  {
    file: 'barbers.png',
    rows: [130, 200, 400, 520, 530, 545, 600, 700, 830, 845, 860, 880, 900, 1100, 1300, 1420, 1450, 1480, 1500],
    cols: [100, 400, 495, 510, 520, 1000],
    limit: 42,
  },
  { file: 'navigation.png', rows: [5, 47, 88], cols: [5, 300, 945], limit: 42 },
];

const runs = (line, limit) => {
  const out = [];
  let start = null;
  for (let i = 0; i < line.length; i += 1) {
    const dark = line[i] < limit;
    if (dark && start === null) start = i;
    if ((!dark || i === line.length - 1) && start !== null) {
      const end = dark ? i : i - 1;
      if (end - start + 1 >= 5) out.push(`${start}-${end}(${end - start + 1})`);
      start = null;
    }
  }
  return out.join(' ');
};

for (const job of JOBS) {
  const { data, info } = await sharp(path.join(TARAHI, job.file))
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  console.log(`\n=== ${job.file} (${width}x${height}) dark<${job.limit} ===`);
  for (const y of job.rows.filter((v) => v < height)) {
    const line = Array.from({ length: width }, (_, x) => data[y * width + x]);
    console.log(`row y=${y} DARK: ${runs(line, job.limit)}`);
  }
  for (const x of job.cols.filter((v) => v < width)) {
    const line = Array.from({ length: height }, (_, y) => data[y * width + x]);
    console.log(`col x=${x} DARK: ${runs(line, job.limit)}`);
  }
}
