// The manifest is a canonical description of an inspection: what was recorded, and the SHA-256 of
// every photo. The "report fingerprint" printed in the PDF is the SHA-256 of this exact text, which
// is also written to the ZIP export as manifest-<id>.json. Anyone holding the ZIP can recompute it
// with `shasum -a 256 manifest-*.json`.
//
// It deliberately contains no generation time and no random ids, so regenerating the PDF without
// changing any data gives the same fingerprint.
import { METERS, KEY_FIELDS, inspectionPhotoIds } from './model.js';
import { sha256Hex } from './hash.js';

// Photos referenced by the inspection, oldest first. Numbers (1..N) are used throughout the PDF.
export function orderedPhotos(insp, recs) {
  const byId = new Map(recs.map((r) => [r.id, r]));
  const seen = new Set();
  const list = [];
  for (const id of inspectionPhotoIds(insp)) {
    const r = byId.get(id);
    if (r && !seen.has(id)) {
      seen.add(id);
      list.push(r);
    }
  }
  list.sort((a, b) => a.capturedAt - b.capturedAt || (a.hash < b.hash ? -1 : 1));
  return list;
}

function describe(insp, rec) {
  const room = insp.rooms.find((r) => r.id === rec.roomId);
  let where = '';
  if (room) {
    if (rec.kind === 'item') where = (room.items.find((i) => i.id === rec.ownerId) || {}).pt || 'Item';
    else if (rec.kind === 'defect') where = 'Defeito';
    else if (rec.kind === 'meter') where = (METERS.find((m) => m.key === rec.ownerId) || {}).pt || 'Medidor';
    else if (rec.kind === 'keys') where = 'Chaves';
  }
  return { room: room ? room.pt : '?', where };
}

export async function buildManifest(insp, recs) {
  const photos = orderedPhotos(insp, recs);
  const num = new Map(photos.map((r, i) => [r.id, i + 1]));
  const nums = (ids) => (ids || []).map((id) => num.get(id)).filter(Boolean);
  const s = insp.setup;

  const rooms = insp.rooms.map((r) => {
    const out = { name: r.pt, nameEn: r.en };
    if (r.type === 'keys') {
      out.keys = Object.fromEntries(KEY_FIELDS.map((f) => [f.key, r.data[f.key]]));
      out.note = r.data.note || '';
      out.photos = nums(r.data.photoIds);
    } else if (r.type === 'meters') {
      out.meters = METERS.map((m) => ({
        meter: m.key,
        reading: r.data[m.key].reading,
        serial: r.data[m.key].serial || '',
        note: r.data[m.key].note || '',
        photos: nums(r.data[m.key].photoIds),
      }));
    } else {
      out.items = r.items.map((i) => ({ item: i.pt, status: i.status || null, note: i.note || '', photos: nums(i.photoIds) }));
      out.otherDefects = r.defects.map((d) => ({ note: d.note || '', photos: nums(d.photoIds) }));
    }
    return out;
  });

  const manifest = {
    format: 'vistoria-manifest',
    version: 1,
    property: { label: s.label, date: s.date, landlord: s.landlord || '', tenant: s.tenant || '', furnished: !!s.furnished },
    rooms,
    photos: photos.map((r, i) => {
      const d = describe(insp, r);
      return { n: i + 1, sha256: r.hash, capturedAt: r.capturedAtISO, room: d.room, where: d.where, width: r.width, height: r.height, bytes: r.bytes };
    }),
  };
  const json = JSON.stringify(manifest, null, 1);
  const fingerprint = await sha256Hex(new TextEncoder().encode(json));
  return { json, fingerprint, photos, num };
}
