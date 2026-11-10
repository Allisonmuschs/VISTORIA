// Data model, default rooms and checklist templates.
//
// Inspection {
//   id, createdAt, updatedAt, isDemo,
//   setup: { label, date 'YYYY-MM-DD', landlord, tenant, furnished },
//   rooms: [Room]
// }
// Room {
//   id, type, pt, en,
//   items:   [{ id, key, pt, en, status: null|'ok'|'defect'|'na', note, photoIds[], custom? }],
//   defects: [{ id, note, photoIds[], createdAt }],     // free-form defects not tied to a checklist item
//   data:    keys/meters rooms only
// }
// Photos live in their own IndexedDB store and are referenced by id (step b).

export const uid = () =>
  globalThis.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fmtDateTime(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || '';
}

// ---- Checklist items (Portuguese primary, English secondary) -------------

const I = (key, pt, en) => ({ key, pt, en });

const ITEMS = {
  paint: I('paint', 'Pintura e manchas (paredes/teto)', 'Paint and wall/ceiling stains'),
  damp: I('damp', 'Umidade / mofo', 'Damp / mould'),
  termites: I('termites', 'Sinais de cupim (batentes, madeiras, móveis)', 'Signs of termites (door frames, wood, furniture)'),
  floor: I('floor', 'Piso', 'Floors'),
  door: I('door', 'Portas e fechaduras', 'Doors and locks'),
  window: I('window', 'Janelas e telas mosquiteiras', 'Windows and mosquito screens'),
  outlets: I('outlets', 'Tomadas e interruptores (testados)', 'Outlets and switches (tested)'),
  lights: I('lights', 'Iluminação / lâmpadas', 'Lights'),
  ac: I('ac', 'Ar-condicionado (refrigeração, dreno, controle remoto)', 'Air conditioning (cooling, drain, remote)'),
  intercom: I('intercom', 'Interfone', 'Intercom'),
  furniture: I('furniture', 'Móveis (imóvel mobiliado)', 'Furniture (furnished unit)'),
  cabinets: I('cabinets', 'Armários e bancada', 'Cabinets and countertop'),
  taps: I('taps', 'Torneiras e vazamentos sob a pia', 'Taps and leaks under the sink'),
  drain: I('drain', 'Ralos', 'Drains'),
  fridge: I('fridge', 'Geladeira', 'Fridge'),
  stove: I('stove', 'Fogão', 'Stove'),
  oven: I('oven', 'Forno', 'Oven'),
  microwave: I('microwave', 'Micro-ondas', 'Microwave'),
  washer: I('washer', 'Máquina de lavar', 'Washing machine'),
  tank: I('tank', 'Tanque e torneira', 'Laundry sink and tap'),
  gas: I('gas', 'Gás (instalação e registro)', 'Gas (installation and shut-off valve)'),
  shower: I('shower', 'Chuveiro / aquecedor (pressão, água quente)', 'Shower / water heater (pressure, hot water)'),
  toilet: I('toilet', 'Vaso sanitário e descarga', 'Toilet and flush'),
  fixtures: I('fixtures', 'Box, louças e metais', 'Shower enclosure, sanitary ware and fittings'),
  vent: I('vent', 'Ventilação / exaustor', 'Ventilation / extractor fan'),
  railing: I('railing', 'Guarda-corpo', 'Balcony railing'),
};

const COMMON = ['paint', 'damp', 'termites', 'floor', 'door', 'window', 'outlets', 'lights'];

// `furnishedOnly` items are added only when the unit is furnished.
export const ROOM_TYPES = {
  sala: {
    pt: 'Entrada / Sala', en: 'Entrance / Living room',
    items: [...COMMON, 'ac', 'intercom'], furnishedOnly: ['furniture'],
  },
  cozinha: {
    pt: 'Cozinha', en: 'Kitchen',
    items: [...COMMON, 'cabinets', 'taps', 'drain', 'fridge', 'stove', 'oven', 'microwave', 'gas'],
    furnishedOnly: ['furniture'],
  },
  area: {
    pt: 'Área de serviço', en: 'Laundry area',
    items: [...COMMON, 'tank', 'washer', 'drain', 'gas'], furnishedOnly: [],
  },
  quarto: {
    pt: 'Quarto', en: 'Bedroom',
    items: [...COMMON, 'ac'], furnishedOnly: ['furniture'],
  },
  banheiro: {
    pt: 'Banheiro', en: 'Bathroom',
    items: ['paint', 'damp', 'termites', 'floor', 'door', 'window', 'outlets', 'lights', 'shower', 'toilet', 'taps', 'fixtures', 'drain', 'vent'],
    furnishedOnly: [],
  },
  varanda: {
    pt: 'Varanda', en: 'Balcony',
    items: ['paint', 'damp', 'floor', 'door', 'lights', 'outlets', 'railing', 'drain'], furnishedOnly: ['furniture'],
  },
  outro: {
    pt: 'Outro cômodo', en: 'Other room',
    items: COMMON, furnishedOnly: ['furniture'],
  },
  keys: { pt: 'Chaves e controles', en: 'Keys and remotes', special: true },
  meters: { pt: 'Medidores', en: 'Meters', special: true },
};

// Room types the user can add from the "Add room" form.
export const ADDABLE_TYPES = ['quarto', 'banheiro', 'sala', 'cozinha', 'area', 'varanda', 'outro'];

export const METERS = [
  { key: 'luz', pt: 'Luz', en: 'Electricity', unit: 'kWh' },
  { key: 'agua', pt: 'Água', en: 'Water', unit: 'm³' },
  { key: 'gas', pt: 'Gás', en: 'Gas', unit: 'm³' },
];

export const KEY_FIELDS = [
  { key: 'keys', pt: 'Chaves', en: 'Keys' },
  { key: 'remotes', pt: 'Controles remotos (portão/garagem)', en: 'Remotes (gate/garage)' },
  { key: 'cards', pt: 'Cartões de acesso', en: 'Access cards' },
];

export const STATUSES = [
  { key: 'ok', pt: 'OK', en: 'OK' },
  { key: 'defect', pt: 'Com defeito', en: 'Defect' },
  { key: 'na', pt: 'N/A', en: 'Not applicable' },
];

// ---- Factories -----------------------------------------------------------

export function makeItem(tplKey) {
  const t = ITEMS[tplKey];
  return { id: uid(), key: t.key, pt: t.pt, en: t.en, status: null, note: '', photoIds: [] };
}

export function makeRoom(type, pt, en, furnished) {
  const t = ROOM_TYPES[type];
  const room = { id: uid(), type, pt: pt || t.pt, en: en || t.en, items: [], defects: [] };
  if (t.special) {
    room.data =
      type === 'keys'
        ? { keys: '', remotes: '', cards: '', note: '', photoIds: [] }
        : Object.fromEntries(METERS.map((m) => [m.key, { reading: '', serial: '', note: '', photoIds: [] }]));
  } else {
    const keys = [...t.items, ...(furnished ? t.furnishedOnly : [])];
    room.items = keys.map(makeItem);
  }
  return room;
}

// opts: { bedrooms, bathrooms, laundry, balcony }
export function buildInspection(setup, opts) {
  const f = !!setup.furnished;
  const rooms = [makeRoom('sala', null, null, f), makeRoom('cozinha', null, null, f)];
  if (opts.laundry) rooms.push(makeRoom('area', null, null, f));
  for (let i = 1; i <= opts.bedrooms; i++) rooms.push(makeRoom('quarto', `Quarto ${i}`, `Bedroom ${i}`, f));
  for (let i = 1; i <= opts.bathrooms; i++) rooms.push(makeRoom('banheiro', `Banheiro ${i}`, `Bathroom ${i}`, f));
  if (opts.balcony) rooms.push(makeRoom('varanda', null, null, f));
  rooms.push(makeRoom('keys'), makeRoom('meters'));
  const now = Date.now();
  return { id: uid(), createdAt: now, updatedAt: now, isDemo: false, setup: { ...setup }, rooms };
}

// ---- Derived numbers -----------------------------------------------------

export function roomStats(room) {
  if (room.type === 'keys') {
    const vals = KEY_FIELDS.map((k) => room.data[k.key]);
    return { done: vals.filter((v) => v !== '').length, total: vals.length, defects: 0 };
  }
  if (room.type === 'meters') {
    const vals = METERS.map((m) => room.data[m.key].reading);
    return { done: vals.filter((v) => v !== '').length, total: vals.length, defects: 0 };
  }
  return {
    done: room.items.filter((i) => i.status).length,
    total: room.items.length,
    defects: room.items.filter((i) => i.status === 'defect').length + room.defects.length,
  };
}

export function inspectionStats(insp) {
  const s = { done: 0, total: 0, defects: 0 };
  for (const r of insp.rooms) {
    const x = roomStats(r);
    s.done += x.done;
    s.total += x.total;
    s.defects += x.defects;
  }
  return s;
}

// Flat list used by the defects summary (and later the PDF).
export function allDefects(insp) {
  const out = [];
  for (const room of insp.rooms) {
    for (const it of room.items) if (it.status === 'defect') out.push({ room, kind: 'item', item: it });
    for (const d of room.defects) out.push({ room, kind: 'entry', item: d });
  }
  return out;
}

// ---- Photos belonging to rooms / inspections ------------------------------

export function roomPhotoIds(room) {
  const ids = [];
  for (const it of room.items) ids.push(...(it.photoIds || []));
  for (const d of room.defects) ids.push(...(d.photoIds || []));
  if (room.type === 'meters') for (const m of METERS) ids.push(...(room.data[m.key].photoIds || []));
  if (room.type === 'keys') ids.push(...(room.data.photoIds || []));
  return ids;
}

export const inspectionPhotoIds = (insp) => insp.rooms.flatMap(roomPhotoIds);

// Human-readable location of a photo record: { room, label }.
export function describePhoto(insp, meta) {
  const room = insp.rooms.find((r) => r.id === meta.roomId);
  let label = '';
  if (room) {
    if (meta.kind === 'item') label = (room.items.find((i) => i.id === meta.ownerId) || {}).pt || 'Item';
    else if (meta.kind === 'defect') label = 'Defeito';
    else if (meta.kind === 'meter') label = (METERS.find((m) => m.key === meta.ownerId) || {}).pt || 'Medidor';
    else if (meta.kind === 'keys') label = 'Chaves';
  }
  return { room: room ? room.pt : '?', label };
}

export function nextRoomName(insp, type) {
  const n = insp.rooms.filter((r) => r.type === type).length;
  const t = ROOM_TYPES[type];
  return n === 0 ? { pt: t.pt, en: t.en } : { pt: `${t.pt} ${n + 1}`, en: `${t.en} ${n + 1}` };
}
