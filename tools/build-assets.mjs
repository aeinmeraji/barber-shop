/**
 * Builds the site's image assets out of the reference mockups in /tarahi.
 * Areas where the mockup has its own typeset text are softly blurred (feathered mask)
 * so the real, selectable HTML text can sit on top of the photo.
 *
 * Usage: node tools/build-assets.mjs
 */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TARAHI = path.join(ROOT, 'tarahi');
const OUT = path.join(ROOT, 'public', 'images');

/** Feathered white rectangles on a transparent canvas → RGBA alpha mask for `dest-in`. */
async function softMaskSvg(width, height, rects, feather) {
  const shapes = rects
    .map((r) => `<rect x="${r.left}" y="${r.top}" width="${r.width}" height="${r.height}" fill="#fff"/>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${shapes}</svg>`;
  return sharp(Buffer.from(svg)).blur(feather).png().toBuffer();
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t) => t * t * (3 - 2 * t);

/**
 * Removes the mockup's own typeset text from a photo. The text is located by local
 * contrast (bright thin strokes on top of a soft, out-of-focus photo area), then
 * replaced with a mild blur of the very same area, dilated so the glyph edges go too.
 * Only text-shaped pixels are touched, so no patch seams appear.
 */
/** Separable box blur (radius r) over an interleaved raw buffer. */
function boxBlur(src, w, h, ch, r) {
  const tmp = Buffer.alloc(src.length);
  const out = Buffer.alloc(src.length);
  const window = 2 * r + 1;
  for (let y = 0; y < h; y += 1) {
    for (let c = 0; c < ch; c += 1) {
      let sum = 0;
      for (let k = -r; k <= r; k += 1) sum += src[(y * w + Math.min(w - 1, Math.max(0, k))) * ch + c];
      for (let x = 0; x < w; x += 1) {
        tmp[(y * w + x) * ch + c] = sum / window;
        const entering = src[(y * w + Math.min(w - 1, x + r + 1)) * ch + c];
        const leaving = src[(y * w + Math.max(0, x - r)) * ch + c];
        sum += entering - leaving;
      }
    }
  }
  for (let x = 0; x < w; x += 1) {
    for (let c = 0; c < ch; c += 1) {
      let sum = 0;
      for (let k = -r; k <= r; k += 1) sum += tmp[(Math.min(h - 1, Math.max(0, k)) * w + x) * ch + c];
      for (let y = 0; y < h; y += 1) {
        out[(y * w + x) * ch + c] = sum / window;
        const entering = tmp[(Math.min(h - 1, y + r + 1) * w + x) * ch + c];
        const leaving = tmp[(Math.max(0, y - r) * w + x) * ch + c];
        sum += entering - leaving;
      }
    }
  }
  return out;
}

/**
 * Diffusion inpaint of the masked area: solved on a 1/8-scale copy (where the text
 * holes are small), so the fill is a smooth continuation of the surrounding photo
 * with no trace of the glyphs. Returns a full-resolution fill buffer.
 */
async function diffusionFill(regionBuf, maskData, width, height, channels, seed = 8) {
  const lw = Math.max(4, Math.round(width / seed));
  const lh = Math.max(4, Math.round(height / seed));
  const low = await sharp(regionBuf).resize({ width: lw, height: lh, fit: 'fill' }).raw().toBuffer();
  const lowMaskRaw = await sharp(maskData, { raw: { width, height, channels: 4 } })
    .resize({ width: lw, height: lh, fit: 'fill' })
    .raw()
    .toBuffer();

  const filled = Buffer.from(low);
  const holes = new Uint8Array(lw * lh);
  for (let i = 0; i < lw * lh; i += 1) holes[i] = lowMaskRaw[i * 4 + 3] > 70 ? 1 : 0;

  for (let iteration = 0; iteration < 90; iteration += 1) {
    const blurred = boxBlur(filled, lw, lh, channels, 2);
    for (let i = 0; i < lw * lh; i += 1) {
      if (!holes[i]) continue;
      for (let c = 0; c < channels; c += 1) filled[i * channels + c] = blurred[i * channels + c];
    }
  }

  return sharp(filled, { raw: { width: lw, height: lh, channels } })
    .resize({ width, height, fit: 'fill', kernel: 'lanczos3' })
    .raw()
    .toBuffer();
}

async function inpaintBox(base, box) {
  const { contrast = 16, sigma = 8, dilate = 6, fill = 2 } = box;
  const regionBuf = await sharp(base).extract(box.rect).toBuffer();
  const { data, info } = await sharp(regionBuf).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const smoothed = await sharp(regionBuf).blur(sigma).raw().toBuffer();

  const lum = (buf, i) =>
    0.2126 * buf[i * channels] + 0.7152 * buf[i * channels + 1] + 0.0722 * buf[i * channels + 2];

  // 1. text candidates = pixels much brighter than their out-of-focus surroundings
  const bin = new Uint8Array(width * height);
  let hits = 0;
  for (let i = 0; i < width * height; i += 1) {
    if (lum(data, i) - lum(smoothed, i) > contrast) {
      bin[i] = 1;
      hits += 1;
    }
  }

  // 2. square dilation so the anti-aliased glyph edges are swallowed too
  const horizontal = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      let found = 0;
      for (let k = -dilate; k <= dilate && !found; k += 1) {
        const xx = x + k;
        if (xx >= 0 && xx < width && bin[row + xx]) found = 1;
      }
      horizontal[row + x] = found;
    }
  }
  const grown = new Uint8Array(width * height);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      let found = 0;
      for (let k = -dilate; k <= dilate && !found; k += 1) {
        const yy = y + k;
        if (yy >= 0 && yy < height && horizontal[yy * width + x]) found = 1;
      }
      grown[y * width + x] = found;
    }
  }

  const maskData = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    maskData[i * 4] = 255;
    maskData[i * 4 + 1] = 255;
    maskData[i * 4 + 2] = 255;
    maskData[i * 4 + 3] = grown[i] ? 255 : 0;
  }
  console.log(`    inpaint ${width}x${height}: ${hits} px text, dilation ${dilate}`);

  const maskAlpha = await sharp(maskData, { raw: { width, height, channels: 4 } })
    .blur(1.6)
    .raw()
    .toBuffer();
  const full = await diffusionFill(regionBuf, maskData, width, height, channels, fill === 2 ? 8 : fill);
  const filled = await sharp(full, { raw: { width, height, channels } }).blur(1.2).raw().toBuffer();

  // 3. blend: original where the mask is transparent, inpainted fill where it is opaque
  const patched = Buffer.alloc(data.length);
  for (let i = 0; i < width * height; i += 1) {
    const alpha = maskAlpha[i * 4 + 3] / 255;
    for (let c = 0; c < channels; c += 1) {
      const idx = i * channels + c;
      patched[idx] = Math.round(data[idx] * (1 - alpha) + filled[idx] * alpha);
    }
  }

  const patchedBuf = await sharp(patched, { raw: { width, height, channels } }).png().toBuffer();
  return { input: patchedBuf, left: box.rect.left, top: box.rect.top, blend: 'over' };
}

/** 2D darkening gradient: alpha fades horizontally and is feathered vertically. */
async function darkGradient(width, height, cfg) {
  const { x0, x1, y0, y1, alpha, feather, color = [9, 7, 5] } = cfg;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    let fy = 1;
    if (y < y0) fy = smoothstep(clamp01((y - (y0 - feather)) / feather));
    else if (y > y1) fy = smoothstep(clamp01((y1 + feather - y) / feather));
    for (let x = 0; x < width; x += 1) {
      const fx = smoothstep(clamp01((x1 - x) / (x1 - x0)));
      const i = (y * width + x) * 4;
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = Math.round(255 * alpha * fx * fy);
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

/** Soft 1D coverage of the interval [lo, hi] with a feather of `feather` px. */
function axisCoverage(v, lo, hi, feather) {
  if (v >= lo && v <= hi) return 1;
  const distance = v < lo ? lo - v : v - hi;
  return smoothstep(clamp01(1 - distance / feather));
}

async function build({ file, name, left, top, width, height, quality = 84, inpaint, gradient, resize, brightness, darken }) {
  const base = await sharp(path.join(TARAHI, file)).extract({ left, top, width, height }).toBuffer();
  const layers = [];

  if (inpaint) {
    for (const box of inpaint) {
      layers.push(await inpaintBox(base, box));
    }
  }

  if (gradient) {
    layers.push({ input: await darkGradient(width, height, gradient), blend: 'over' });
  }

  if (darken) {
    layers.push({
      input: await sharp({ create: { width, height, channels: 4, background: darken } }).png().toBuffer(),
      blend: 'over',
    });
  }

  let pipeline = sharp(base).composite(layers);
  if (brightness) pipeline = pipeline.modulate({ brightness });
  if (resize) pipeline = pipeline.resize({ width: resize, kernel: 'lanczos3', withoutEnlargement: false });
  await pipeline.jpeg({ quality, progressive: true }).toFile(path.join(OUT, name));

  const meta = await sharp(path.join(OUT, name)).metadata();
  console.log(`${name} ${meta.width}x${meta.height}`);
}

await fs.mkdir(OUT, { recursive: true });

const ASSETS = [
  // ---------- Home ----------
  { file: 'first page p1.png', name: 'home-hero-left.jpg', left: 23, top: 122, width: 348, height: 320, quality: 88 },
  {
    file: 'first page p1.png',
    name: 'home-hero-right.jpg',
    left: 395,
    top: 122,
    width: 606,
    height: 320,
    quality: 88,
    inpaint: [{ rect: { left: 10, top: 126, width: 322, height: 194 }, contrast: 15, sigma: 8, dilate: 5, fill: 6 }],
    gradient: { x0: 0, x1: 380, y0: 112, y1: 320, alpha: 0.62, feather: 26 },
  },
  { file: 'first page p1.png', name: 'home-map.jpg', left: 23, top: 501, width: 496, height: 188, quality: 86 },

  // ---------- Services ----------
  {
    file: 'barbers.png',
    name: 'services-bg.jpg',
    left: 23,
    top: 1150,
    width: 376,
    height: 279,
    resize: 900,
    quality: 72,
    darken: { r: 6, g: 5, b: 4, alpha: 0.42 },
  },
  {
    file: 'first page p2.png',
    name: 'services-detail.jpg',
    left: 22,
    top: 390,
    width: 378,
    height: 225,
    quality: 84,
    brightness: 1.16,
  },

  // ---------- Barbers ----------
  {
    file: 'barbers.png',
    name: 'barbers-hero.jpg',
    left: 22,
    top: 122,
    width: 979,
    height: 385,
    quality: 86,
    inpaint: [{ rect: { left: 28, top: 92, width: 386, height: 282 }, contrast: 15, sigma: 8, dilate: 5, fill: 6 }],
    gradient: { x0: 0, x1: 560, y0: 66, y1: 378, alpha: 0.6, feather: 30 },
  },
  { file: 'barbers.png', name: 'barber-portrait-1.jpg', left: 23, top: 536, width: 476, height: 288, quality: 88 },
  { file: 'barbers.png', name: 'barber-portrait-2.jpg', left: 522, top: 536, width: 479, height: 288, quality: 88 },
  {
    file: 'barbers.png',
    name: 'barbers-form.jpg',
    left: 23,
    top: 849,
    width: 376,
    height: 580,
    quality: 86,
    inpaint: [{ rect: { left: 26, top: 40, width: 336, height: 208 }, contrast: 15, sigma: 8, dilate: 5, fill: 6 }],
    gradient: { x0: 0, x1: 240, y0: 16, y1: 262, alpha: 0.62, feather: 34 },
  },
];

for (const asset of ASSETS) await build(asset);
