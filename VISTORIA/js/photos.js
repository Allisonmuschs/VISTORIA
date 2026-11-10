// Photo pipeline and thumbnail cache.
//
// processPhoto(): decode (EXIF-rotated) -> downscale to MAX_EDGE -> burn capture timestamp into the
// bottom-right corner -> encode JPEG -> SHA-256 of the exact stored bytes -> thumbnail.
// The stored blob is the stamped image; no unstamped copy is kept.
import { db } from './db.js';
import { sha256Hex } from './hash.js';
import { uid, fmtDateTime } from './model.js';
import { APP_VERSION } from './version.js';

export const MAX_EDGE = 1600;
export const JPEG_QUALITY = 0.8;
const THUMB_EDGE = 360;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The browser could not read this image.'));
    img.src = url;
  });
}

function toBlob(canvas, quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image.'))), 'image/jpeg', quality)
  );
}

function scaled(srcW, srcH, maxEdge) {
  const s = Math.min(1, maxEdge / Math.max(srcW, srcH));
  return [Math.max(1, Math.round(srcW * s)), Math.max(1, Math.round(srcH * s))];
}

function drawStamp(ctx, w, h, text) {
  const size = Math.max(18, Math.round(Math.max(w, h) * 0.03));
  const pad = Math.round(size * 0.45);
  ctx.font = `600 ${size}px -apple-system, Helvetica, Arial, sans-serif`;
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(w - tw - pad * 2, h - size - pad * 2, tw + pad * 2, size + pad * 2);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w - pad, h - pad - size / 2);
}

async function thumbFromCanvas(canvas) {
  const [tw, th] = scaled(canvas.width, canvas.height, THUMB_EDGE);
  const t = document.createElement('canvas');
  t.width = tw;
  t.height = th;
  t.getContext('2d').drawImage(canvas, 0, 0, tw, th);
  const blob = await toBlob(t, 0.7);
  t.width = t.height = 0;
  return blob;
}

export async function thumbFromBlob(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const [w, h] = scaled(img.naturalWidth, img.naturalHeight, THUMB_EDGE);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    const t = await toBlob(c, 0.7);
    c.width = c.height = 0;
    return t;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Smaller JPEG copy of a stored photo (used for the PDF). Returns { bytes: Uint8Array, w, h }.
export async function reduceBlob(blob, maxEdge, quality) {
  const url = URL.createObjectURL(blob);
  let canvas;
  try {
    const img = await loadImage(url);
    const [w, h] = scaled(img.naturalWidth, img.naturalHeight, maxEdge);
    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    const out = await toBlob(canvas, quality);
    return { bytes: new Uint8Array(await out.arrayBuffer()), w, h };
  } finally {
    URL.revokeObjectURL(url);
    if (canvas) canvas.width = canvas.height = 0;
  }
}

// where: { inspectionId, roomId, kind: 'item'|'defect'|'meter'|'keys', ownerId }
// opts.capturedAt: only the demo seed overrides this.
export async function processPhoto(file, where, opts = {}) {
  const capturedAt = opts.capturedAt || Date.now(); // moment the picture reached the app
  const url = URL.createObjectURL(file);
  let canvas;
  try {
    const img = await loadImage(url);
    const [w, h] = scaled(img.naturalWidth, img.naturalHeight, MAX_EDGE);
    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const stampText = fmtDateTime(capturedAt);
    drawStamp(ctx, w, h, stampText);

    const blob = await toBlob(canvas, JPEG_QUALITY);
    const thumb = await thumbFromCanvas(canvas);
    const hash = await sha256Hex(blob);
    return {
      id: uid(),
      ...where,
      blob,
      thumb,
      width: w,
      height: h,
      bytes: blob.size,
      capturedAt,
      capturedAtISO: new Date(capturedAt).toISOString(),
      tzOffsetMin: new Date(capturedAt).getTimezoneOffset(),
      stampText,
      fileLastModified: file.lastModified || null,
      originalName: file.name || null,
      originalType: file.type || null,
      originalBytes: file.size,
      hash,
      hashAlgo: 'SHA-256',
      app: APP_VERSION,
    };
  } finally {
    URL.revokeObjectURL(url);
    if (canvas) canvas.width = canvas.height = 0; // free memory promptly on iOS
  }
}

// ---- thumbnail cache (object URLs live for the whole session; thumbnails are tiny) ----------

const cache = new Map(); // id -> { url, meta } | { url: null, missing: true }

const stripBlobs = ({ blob, thumb, ...meta }) => meta;

export const cachedPhoto = (id) => cache.get(id);

export function prime(rec) {
  cache.set(rec.id, { url: URL.createObjectURL(rec.thumb || rec.blob), meta: stripBlobs(rec) });
}

export async function loadThumbs(ids) {
  await Promise.all(
    ids
      .filter((id) => !cache.has(id))
      .map(async (id) => {
        const rec = await db.photos.get(id);
        if (rec) prime(rec);
        else cache.set(id, { url: null, missing: true });
      })
  );
}

export async function deletePhotos(ids) {
  if (!ids.length) return;
  await db.photos.deleteMany(ids);
  for (const id of ids) {
    const c = cache.get(id);
    if (c && c.url) URL.revokeObjectURL(c.url);
    cache.delete(id);
  }
}
