// Backup / restore.
//   JSON: inspections + photo metadata (hashes, timestamps). Small, but contains NO photo files.
//   ZIP : data.json + photos/*.jpg + hashes.txt + LEIA-ME.txt. A complete backup, and also what you
//         can hand to someone who wants to verify the photos independently.
// Restore accepts either file.
import { db } from './db.js';
import { saveFile } from './files.js';
import { APP_VERSION } from './version.js';
import { Zip, ZipPassThrough, unzipSync, strToU8, strFromU8 } from '../vendor/fflate.js';
import { describePhoto } from './model.js';
import { buildManifest } from './manifest.js';
import { thumbFromBlob } from './photos.js';
import { sha256Hex } from './hash.js';

const FORMAT = 'vistoria-backup';
const KEY = 'vistoria.lastBackup';

export function lastBackup() {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}

export function markBackup() {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* storage unavailable: the reminder banner just keeps showing */
  }
}

const pad = (n, w = 2) => String(n).padStart(w, '0');

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

const compactTs = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

const slug = (s, max = 40) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max) || 'x';

const metaOf = ({ blob, thumb, ...meta }) => meta;

function payload(inspections, photos) {
  return { format: FORMAT, version: 2, exportedAt: new Date().toISOString(), app: APP_VERSION, inspections, photos };
}

// ---- JSON (data only) ------------------------------------------------------

export async function exportJSON(inspections, nameHint) {
  const photos = [];
  for (const i of inspections) for (const r of await db.photos.byInspection(i.id)) photos.push(metaOf(r));
  const blob = new Blob([JSON.stringify(payload(inspections, photos), null, 1)], { type: 'application/json' });
  const result = await saveFile(blob, `vistoria-${slug(nameHint || 'backup')}-${stamp()}.json`);
  // A data-only file is only a complete backup when there are no photos to lose.
  if (result !== 'cancelled' && photos.length === 0) markBackup();
  return result;
}

// ---- ZIP (data + photos) ---------------------------------------------------

const README = (n) => `VISTORIA - arquivo de exportação / export archive
=====================================================
Documento informativo elaborado pelo locatário. / Informational document prepared by the tenant.

Conteúdo / Contents
  data.json    dados da vistoria e metadados das fotos / inspection data and photo metadata
  photos/      ${n} foto(s) JPEG, com data e hora gravadas no canto / photo(s) with the capture time burned in
  hashes.txt   SHA-256 de cada foto / SHA-256 of every photo
  manifest-*.json  descrição canônica da vistoria; seu SHA-256 é a "impressão digital do relatório" do PDF /
                   canonical description of the inspection; its SHA-256 is the PDF's "report fingerprint"

Como verificar as fotos / How to verify the photos
  macOS / Linux : abra o terminal na pasta extraída e execute / open a terminal in the extracted folder:
                  shasum -a 256 -c hashes.txt
  Windows       : certutil -hashfile photos\\<arquivo>.jpg SHA256   (compare com hashes.txt)
Impressão digital / fingerprint: shasum -a 256 manifest-*.json
Se alguma foto tiver sido alterada depois da captura, o hash não confere.
If a photo was changed after capture, its hash will not match.
`;

export async function buildZip(inspections, nameHint, onProgress = () => {}) {
  const chunks = [];
  let zipError = null;
  const zip = new Zip((err, chunk) => {
    if (err) zipError = err;
    else chunks.push(chunk);
  });
  const add = (path, bytes) => {
    const f = new ZipPassThrough(path);
    zip.add(f);
    f.push(bytes, true);
  };

  const all = [];
  for (const insp of inspections) {
    const recs = (await db.photos.byInspection(insp.id)).sort((a, b) => a.capturedAt - b.capturedAt);
    all.push({ insp, recs });
  }
  const total = all.reduce((n, x) => n + x.recs.length, 0);

  const metas = [];
  const hashLines = [];
  let done = 0;
  for (const { insp, recs } of all) {
    const dir = `photos/${slug(insp.setup.label, 30)}-${insp.id.slice(0, 6)}`;
    for (let k = 0; k < recs.length; k++) {
      const r = recs[k];
      const where = describePhoto(insp, r);
      const path = `${dir}/${pad(k + 1, 3)}_${slug(where.room, 20)}_${slug(where.label, 24)}_${compactTs(r.capturedAt)}.jpg`;
      add(path, new Uint8Array(await r.blob.arrayBuffer()));
      metas.push({ ...metaOf(r), file: path });
      hashLines.push(`${r.hash}  ${path}`);
      done++;
      onProgress(`Adding photos… ${done}/${total}`);
      if (done % 5 === 0) await new Promise((res) => setTimeout(res)); // let the UI breathe
    }
  }

  // manifest-*.json is what the PDF's "report fingerprint" is the SHA-256 of.
  for (const { insp, recs } of all) {
    add(`manifest-${insp.id.slice(0, 6)}.json`, strToU8((await buildManifest(insp, recs)).json));
  }
  add('data.json', strToU8(JSON.stringify(payload(inspections, metas), null, 1)));
  add('hashes.txt', strToU8(hashLines.join('\n') + (hashLines.length ? '\n' : '')));
  add('LEIA-ME.txt', strToU8(README(total)));
  zip.end();
  if (zipError) throw zipError;

  const blob = new Blob(chunks, { type: 'application/zip' });
  return { blob, name: `vistoria-${slug(nameHint || 'backup')}-${stamp()}.zip` };
}

// ---- Restore ---------------------------------------------------------------

// Returns { inspections, photoMetas, files } or throws an Error with a readable message.
export async function readBackup(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
  let text;
  let files = null;
  if (isZip) {
    try {
      files = unzipSync(buf);
    } catch {
      throw new Error('This ZIP file could not be read.');
    }
    if (!files['data.json']) throw new Error('This ZIP has no data.json: it is not a Vistoria export.');
    text = strFromU8(files['data.json']);
  } else {
    text = strFromU8(buf);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not a valid backup (could not parse it).');
  }
  if (!data || data.format !== FORMAT || !Array.isArray(data.inspections)) {
    throw new Error('This is not a Vistoria backup file.');
  }
  for (const x of data.inspections) {
    const ok =
      x && typeof x.id === 'string' && x.setup && Array.isArray(x.rooms) &&
      x.rooms.every((r) => r && typeof r.id === 'string' && Array.isArray(r.items) && Array.isArray(r.defects));
    if (!ok) throw new Error('The backup file is damaged (unexpected structure).');
  }
  return { inspections: data.inspections, photoMetas: Array.isArray(data.photos) ? data.photos : [], files };
}

// Writes photos first, then inspections, so nothing ever points at a photo that is not there yet.
export async function restoreBackup({ inspections, photoMetas, files }, onProgress = () => {}) {
  let restored = 0;
  let hashMismatches = 0;
  for (const meta of photoMetas) {
    const bytes = files && meta.file && files[meta.file];
    if (!bytes) continue;
    onProgress(`Restoring photos… ${restored + 1}/${photoMetas.length}`);
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    if ((await sha256Hex(bytes)) !== meta.hash) hashMismatches++;
    const { file, ...m } = meta;
    await db.photos.put({ ...m, blob, thumb: await thumbFromBlob(blob) });
    restored++;
  }
  await db.putMany(inspections);
  return { inspections: inspections.length, photos: restored, photosInFile: photoMetas.length, hashMismatches };
}
