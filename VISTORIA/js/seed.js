// Demo data: a fake apartment with realistic findings and generated photos.
import { buildInspection, todayISO, uid } from './model.js';
import { db } from './db.js';
import { processPhoto, prime } from './photos.js';
import { drawDemoScene } from './demophotos.js';

// `${roomType}.${itemKey}` -> [status, note]
const FINDINGS = {
  'sala.damp': ['defect', 'Mancha de umidade no canto superior esquerdo, perto da janela (~30 cm).'],
  'sala.window': ['defect', 'Tela mosquiteira rasgada na janela da sala.'],
  'sala.furniture': ['ok', 'Sofá com leve desgaste no braço direito (já existente).'],
  'sala.ac': ['ok', 'Gela bem; dreno seco; controle remoto com pilhas.'],
  'cozinha.outlets': ['defect', 'Tomada ao lado da geladeira sem energia.'],
  'cozinha.taps': ['defect', 'Pequeno vazamento sob a pia (sifão).'],
  'cozinha.stove': ['defect', 'Boca traseira esquerda não acende.'],
  'cozinha.microwave': ['na', 'Imóvel não inclui micro-ondas.'],
  'area.drain': ['defect', 'Ralo com escoamento muito lento.'],
  'area.washer': ['ok', 'Ciclo rápido testado; sem vazamento.'],
  'quarto.ac': ['defect', 'Não gela; dreno pingando dentro do quarto.'],
  'quarto.termites': ['defect', 'Serragem fina e pequenos furos no batente da porta (possível cupim).'],
  'banheiro.shower': ['defect', 'Chuveiro sem água quente (resistência queimada?).'],
  'banheiro.damp': ['defect', 'Mofo no teto acima do box.'],
  'banheiro.toilet': ['ok', 'Descarga funcionando.'],
};

const EXTRA_DEFECTS = {
  sala: ['Risco profundo no piso, perto da porta de entrada (~20 cm).'],
  varanda: ['Ferrugem no guarda-corpo, ponto de solda da extremidade esquerda.'],
};

// [room type, target, scene, scene options]. Target: item:<key> | defect:<index> | meter:<key> | keys
const PHOTO_PLAN = [
  ['sala', 'item:damp', 'damp', { portrait: true }],
  ['sala', 'item:damp', 'damp', { seed: 2 }],
  ['sala', 'item:window', 'screen'],
  ['sala', 'defect:0', 'scratch'],
  ['sala', 'item:ac', 'ac'],
  ['cozinha', 'item:outlets', 'outlet'],
  ['cozinha', 'item:taps', 'leak'],
  ['cozinha', 'item:stove', 'stove'],
  ['cozinha', 'item:stove', 'stove', { seed: 2 }],
  ['area', 'item:drain', 'drain'],
  ['quarto', 'item:ac', 'ac', { drip: true }],
  ['quarto', 'item:termites', 'termite', { portrait: true }],
  ['quarto', 'item:termites', 'termite', { seed: 2 }],
  ['banheiro', 'item:shower', 'shower', { portrait: true }],
  ['banheiro', 'item:damp', 'mold'],
  ['varanda', 'defect:0', 'rust'],
  ['meters', 'meter:luz', 'meter', { text: '12345.6', unit: 'kWh' }],
  ['meters', 'meter:agua', 'meter', { text: '00456.789', unit: 'm³' }],
  ['meters', 'meter:gas', 'meter', { text: '0123.45', unit: 'm³' }],
  ['keys', 'keys', 'keys'],
];

// Adds ~20 generated photos (stored in IndexedDB) and links them into the demo inspection.
export async function addDemoPhotos(insp, onProgress = () => {}) {
  const start = Date.now() - (PHOTO_PLAN.length + 1) * 75 * 1000; // a walkthrough that began ~25 min ago
  for (let i = 0; i < PHOTO_PLAN.length; i++) {
    const [roomType, target, scene, opts] = PHOTO_PLAN[i];
    onProgress(`Creating demo photos… ${i + 1}/${PHOTO_PLAN.length}`);
    const room = insp.rooms.find((r) => r.type === roomType);
    const [kind, arg] = target.split(':');
    let owner;
    let where;
    if (kind === 'item') {
      owner = room.items.find((x) => x.key === arg);
      where = { kind: 'item', ownerId: owner.id };
    } else if (kind === 'defect') {
      owner = room.defects[Number(arg)];
      where = { kind: 'defect', ownerId: owner.id };
    } else if (kind === 'meter') {
      owner = room.data[arg];
      where = { kind: 'meter', ownerId: arg };
    } else {
      owner = room.data;
      where = { kind: 'keys', ownerId: 'keys' };
    }
    const blob = await drawDemoScene(scene, opts);
    const rec = await processPhoto(blob, { inspectionId: insp.id, roomId: room.id, ...where }, {
      capturedAt: start + i * 75 * 1000 + Math.round(Math.random() * 20000),
    });
    await db.photos.put(rec);
    prime(rec);
    owner.photoIds = [...(owner.photoIds || []), rec.id];
    await new Promise((res) => setTimeout(res));
  }
}

export function buildDemo() {
  const insp = buildInspection(
    {
      label: 'DEMO – Apartamento 2Q fictício (Ipanema)',
      date: todayISO(),
      landlord: 'Imobiliária Exemplo Ltda. (fictícia)',
      tenant: 'Inquilino Exemplo',
      furnished: true,
    },
    { bedrooms: 1, bathrooms: 1, laundry: true, balcony: true }
  );
  insp.isDemo = true;

  for (const room of insp.rooms) {
    if (room.items.length) {
      for (const it of room.items) {
        const f = FINDINGS[`${room.type}.${it.key}`];
        if (f) [it.status, it.note] = f;
        // The balcony is deliberately left mostly unchecked, to show partial progress.
        else if (room.type !== 'varanda') it.status = 'ok';
      }
      const railing = room.items.find((i) => i.key === 'railing');
      if (railing) railing.status = 'ok';
    }
    for (const note of EXTRA_DEFECTS[room.type] || []) {
      room.defects.push({ id: uid(), note, photoIds: [], createdAt: Date.now() });
    }
  }

  const keys = insp.rooms.find((r) => r.type === 'keys');
  Object.assign(keys.data, { keys: '3', remotes: '2', cards: '1', note: 'Chave da porta principal, chave do portão e chave da área de serviço.' });

  const meters = insp.rooms.find((r) => r.type === 'meters').data;
  Object.assign(meters.luz, { reading: '12345.6', serial: 'LZ-0001234' });
  Object.assign(meters.agua, { reading: '456.789', serial: 'HD-778812' });
  Object.assign(meters.gas, { reading: '123.45', serial: '' });

  return insp;
}
