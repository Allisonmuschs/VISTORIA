// PDF report, drawn directly with jsPDF (real text, A4, runs offline).
// Order: cover -> defects summary -> room-by-room detail -> photo hash register -> signatures.
// Portuguese is primary; the English label sits in small grey text beneath it.
import { db } from './db.js';
import { APP_VERSION } from './version.js';
import { METERS, KEY_FIELDS, ROOM_TYPES, inspectionStats, allDefects, fmtDate, fmtDateTime, roomStats } from './model.js';
import { reduceBlob } from './photos.js';
import { buildManifest } from './manifest.js';

export const FOOTER = 'Documento informativo elaborado pelo locatário';

const PDF_EDGE = 900; // px, long edge of photos embedded in the PDF
const PDF_QUALITY = 0.72;

let jsPdfPromise;
function loadJsPdf() {
  if (!jsPdfPromise) {
    jsPdfPromise = new Promise((resolve, reject) => {
      if (window.jspdf) return resolve(window.jspdf.jsPDF);
      const s = document.createElement('script');
      s.src = 'vendor/jspdf.umd.min.js';
      s.onload = () => (window.jspdf ? resolve(window.jspdf.jsPDF) : reject(new Error('The PDF library did not start.')));
      s.onerror = () => reject(new Error('Could not load the PDF library.'));
      document.head.appendChild(s);
    }).catch((e) => {
      jsPdfPromise = null; // allow a retry
      throw e;
    });
  }
  return jsPdfPromise;
}

const TEAL = [15, 118, 110];
const INK = [27, 36, 33];
const MUTED = [93, 107, 102];
const LINE = [223, 228, 225];
const RED = [180, 35, 24];
const GREEN = [21, 128, 61];
const GREY = [100, 116, 139];
const AMBER = [161, 98, 7];
const WHITE = [255, 255, 255];

const W = 210;
const M = 15;
const CW = 180;
const BOTTOM = 278;

// Core PDF fonts only cover Latin-1: normalise typographic characters, replace anything else (emoji...).
const cl = (s) =>
  String(s == null ? '' : s)
    .replace(/\r/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/[\ud800-\udbff][\udc00-\udfff]/g, '?') // emoji etc. (surrogate pair) -> one "?"
    .replace(/[^\n -ÿ]/g, '?');

const mmOf = (pt) => pt * 0.3528;
const lh = (size) => mmOf(size) * 1.25;
const tick = () => new Promise((r) => setTimeout(r));

function tzLabel(ms) {
  const o = -new Date(ms).getTimezoneOffset();
  const a = Math.abs(o);
  return `UTC${o >= 0 ? '+' : '-'}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

const slug = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'imovel';

const STATUS = {
  ok: ['OK', 'OK', GREEN],
  defect: ['COM DEFEITO', 'Defect', RED],
  na: ['N/A', 'Not applicable', GREY],
  none: ['NÃO VERIFICADO', 'Not checked', AMBER],
};

export async function buildReport(insp, onProgress = () => {}) {
  onProgress('Loading PDF library…');
  const jsPDF = await loadJsPdf();
  onProgress('Reading photos…');
  const recs = await db.photos.byInspection(insp.id);
  const mf = await buildManifest(insp, recs);
  const byId = new Map(mf.photos.map((r) => [r.id, r]));
  const num = mf.num;
  const generatedAt = Date.now();
  const s = insp.setup;
  const stats = inspectionStats(insp);
  const defects = allDefects(insp);
  const checklistRooms = insp.rooms.filter((r) => !ROOM_TYPES[r.type].special);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setLineHeightFactor(1.25);
  doc.setProperties({
    title: cl(`Vistoria de entrada - ${s.label}`),
    subject: 'Move-in condition report',
    author: cl(s.tenant || ''),
    creator: `Vistoria app ${APP_VERSION}`,
  });

  let y = M;
  let photosDrawn = 0;

  // ---- primitives ---------------------------------------------------------
  const font = (style = 'normal', size = 10, color = INK, family = 'helvetica') => {
    doc.setFont(family, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const wrap = (str, width, size, style = 'normal', family = 'helvetica') => {
    font(style, size, INK, family);
    return doc.splitTextToSize(cl(str), width);
  };
  const put = (lines, x, yy, opts = {}) => doc.text(lines, x, yy, { baseline: 'top', ...opts });
  const newPage = () => {
    doc.addPage();
    y = M;
  };
  const ensure = (h) => {
    if (y + h > BOTTOM) newPage();
  };
  const rule = (yy, color = LINE, x1 = M, x2 = M + CW) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.2);
    doc.line(x1, yy, x2, yy);
  };

  // Portuguese line(s) + small English line(s) beneath. Returns the height used.
  function bi(pt, en, x, yy, w, { size = 10, style = 'bold', enSize = 7, color = INK, dry = false } = {}) {
    const a = wrap(pt, w, size, style);
    let h = a.length * lh(size);
    const showEn = en && cl(en) !== cl(pt);
    const b = showEn ? wrap(en, w, enSize) : [];
    h += b.length * lh(enSize);
    if (!dry) {
      font(style, size, color);
      put(a, x, yy);
      if (b.length) {
        font('normal', enSize, MUTED);
        put(b, x, yy + a.length * lh(size));
      }
    }
    return h;
  }

  function sectionTitle(pt, en, right) {
    const h = bi(pt, en, M, y, CW - 40, { size: 16, enSize: 8.5 });
    if (right) {
      font('bold', 22, right.color);
      doc.text(String(right.value), M + CW, y, { baseline: 'top', align: 'right' });
    }
    y += h + 1;
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(0.6);
    doc.line(M, y, M + CW, y);
    y += 5;
  }

  function band(pt, en, rightText) {
    doc.setFillColor(...TEAL);
    doc.rect(M, y, CW, 11, 'F');
    font('bold', 12.5, WHITE);
    put(cl(pt), M + 3, y + 1.4);
    if (en && cl(en) !== cl(pt)) {
      font('normal', 7.5, [205, 232, 229]);
      put(cl(en), M + 3, y + 6.9);
    }
    if (rightText) {
      font('normal', 8, WHITE);
      put(cl(rightText), M + CW - 3, y + 4, { align: 'right' });
    }
    y += 14;
  }

  function badge(key, x, yy) {
    const [pt, en, color] = STATUS[key || 'none'];
    font('bold', 7, WHITE);
    const w = doc.getTextWidth(pt) + 5;
    doc.setFillColor(...color);
    doc.roundedRect(x, yy, w, 5, 1.2, 1.2, 'F');
    put(pt, x + w / 2, yy + 1.35, { align: 'center' });
    font('normal', 6, MUTED);
    put(en, x, yy + 5.6);
  }

  // Fit a record's image into a box, keeping its aspect ratio.
  const fit = (rec, boxW, boxH) => {
    const r = rec.width / rec.height;
    let w = boxW;
    let h = w / r;
    if (h > boxH) {
      h = boxH;
      w = h * r;
    }
    return { w, h };
  };

  async function reducedBytes(rec) {
    const out = await reduceBlob(rec.blob, PDF_EDGE, PDF_QUALITY);
    photosDrawn++;
    onProgress(`Adding photos… ${photosDrawn}/${mf.photos.length}`);
    await tick();
    return out.bytes;
  }

  // Row(s) of photos, up to 3 per row, with caption (number, capture time, short hash).
  const PH_W = 56;
  const PH_H = 62;
  const PH_GAP = 6;
  const photoRowHeight = (row) => Math.max(...row.map((r) => fit(r, PH_W, PH_H).h)) + 8;

  async function photoGrid(ids) {
    const items = ids.map((id) => byId.get(id)).filter(Boolean);
    for (let i = 0; i < items.length; i += 3) {
      const row = items.slice(i, i + 3);
      const rowH = photoRowHeight(row);
      ensure(rowH);
      for (let k = 0; k < row.length; k++) {
        const rec = row[k];
        const x = M + k * (PH_W + PH_GAP);
        const d = fit(rec, PH_W, PH_H);
        doc.setDrawColor(...LINE);
        doc.setLineWidth(0.2);
        doc.rect(x - 0.3, y - 0.3, d.w + 0.6, d.h + 0.6);
        doc.addImage(await reducedBytes(rec), 'JPEG', x, y, d.w, d.h, undefined, 'NONE');
        font('normal', 6.5, MUTED);
        put(`Foto ${num.get(rec.id)}  ·  ${rec.stampText}  ·  ${rec.hash.slice(0, 8)}`, x, y + d.h + 1.3);
      }
      y += rowH;
    }
  }

  // Small square thumbnails for the defects summary.
  const TH = 26;
  async function thumbRows(ids, x0, yy) {
    const items = ids.map((id) => byId.get(id)).filter(Boolean);
    for (let i = 0; i < items.length; i++) {
      const rec = items[i];
      const col = i % 6;
      const row = Math.floor(i / 6);
      const x = x0 + col * (TH + 4.8);
      const ty = yy + row * (TH + 5);
      doc.setFillColor(238, 241, 244);
      doc.rect(x, ty, TH, TH, 'F');
      const d = fit(rec, TH, TH);
      const bytes = new Uint8Array(await rec.thumb.arrayBuffer());
      doc.addImage(bytes, 'JPEG', x + (TH - d.w) / 2, ty + (TH - d.h) / 2, d.w, d.h, undefined, 'NONE');
      font('normal', 6.5, MUTED);
      put(`Foto ${num.get(rec.id)}`, x, ty + TH + 0.8);
    }
  }
  const thumbBlockHeight = (n) => (n ? Math.ceil(n / 6) * (TH + 5) : 0);

  // ---- 1. Cover -----------------------------------------------------------
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, W, 68, 'F');
  font('bold', 28, WHITE);
  put('VISTORIA DE ENTRADA', M, 24);
  font('normal', 13, [205, 232, 229]);
  put('Move-in condition report', M, 37);
  font('normal', 9, [205, 232, 229]);
  put('Registro descritivo e fotográfico do imóvel na data da entrega das chaves', M, 50);
  font('normal', 7.5, [160, 205, 200]);
  put('Descriptive and photographic record of the property on the key handover date', M, 55);

  y = 82;
  font('normal', 7.5, MUTED);
  put('Imóvel / Property', M, y);
  y += 4;
  const labelLines = wrap(s.label, CW, 19, 'bold');
  font('bold', 19, INK);
  put(labelLines, M, y);
  y += labelLines.length * lh(19) + 8;

  const fact = (pt, en, value, opts = {}) => {
    const vLines = wrap(value || '-', 110, opts.mono ? 8.5 : 11, opts.mono ? 'normal' : 'normal', opts.mono ? 'courier' : 'helvetica');
    const h = Math.max(bi(pt, en, M, y, 62, { size: 9, enSize: 7, dry: true }), vLines.length * lh(11));
    bi(pt, en, M, y, 62, { size: 9, enSize: 7 });
    font('normal', opts.mono ? 8.5 : 11, INK, opts.mono ? 'courier' : 'helvetica');
    put(vLines, M + 70, y + (opts.mono ? 0.6 : 0));
    y += h + 3.5;
    rule(y - 1.6);
  };
  const nRooms = checklistRooms.length;
  fact('Data da vistoria', 'Inspection date', fmtDate(s.date));
  fact('Locador / Imobiliária', 'Landlord / agency', s.landlord);
  fact('Locatário', 'Tenant', s.tenant);
  fact('Cômodos vistoriados', 'Rooms inspected', String(nRooms));
  fact('Itens verificados', 'Items checked', `${stats.done} de ${stats.total}`);
  fact('Defeitos registrados', 'Defects recorded', String(stats.defects));
  fact('Fotos', 'Photos', String(mf.photos.length));
  fact('Relatório gerado em', 'Report generated on', `${fmtDateTime(generatedAt)} (${tzLabel(generatedAt)})`);
  fact('Impressão digital do relatório (SHA-256)', 'Report fingerprint (SHA-256)', `${mf.fingerprint.slice(0, 32)}\n${mf.fingerprint.slice(32)}`, { mono: true });

  // ---- 2. Defects summary ---------------------------------------------------
  newPage();
  sectionTitle('Resumo de defeitos', 'Defects summary', { value: defects.length, color: defects.length ? RED : GREEN });
  if (!defects.length) {
    font('normal', 10, INK);
    put('Nenhum defeito registrado.', M, y);
    font('normal', 7, MUTED);
    put('No defects recorded.', M, y + lh(10));
    y += lh(10) + lh(7) + 4;
  }
  for (let i = 0; i < defects.length; i++) {
    const d = defects[i];
    const label = d.kind === 'item' ? { pt: d.item.pt, en: d.item.en } : { pt: 'Defeito registrado', en: 'Recorded defect' };
    const ids = (d.item.photoIds || []).filter((id) => byId.has(id));
    const tx = M + 11;
    const tw = CW - 11;
    const headH = bi(`${d.room.pt}  ·  ${label.pt}`, `${d.room.en}  ·  ${label.en}`, tx, y, tw, { size: 10, enSize: 7, dry: true });
    const noteLines = d.item.note ? wrap(d.item.note, tw, 9, 'italic') : [];
    const noteH = noteLines.length * lh(9);
    const total = headH + noteH + (ids.length ? thumbBlockHeight(ids.length) + 1 : 0) + 5;
    ensure(Math.min(total, 120));
    const top = y;
    doc.setFillColor(...RED);
    doc.circle(M + 4, top + 3.6, 3.6, 'F');
    font('bold', 8, WHITE);
    doc.text(String(i + 1), M + 4, top + 3.7, { align: 'center', baseline: 'middle' });
    y += bi(`${d.room.pt}  ·  ${label.pt}`, `${d.room.en}  ·  ${label.en}`, tx, y, tw, { size: 10, enSize: 7 });
    if (noteLines.length) {
      font('italic', 9, INK);
      put(noteLines, tx, y + 0.5);
      y += noteH + 0.5;
    }
    if (ids.length) {
      y += 1.5;
      await thumbRows(ids, tx, y);
      y += thumbBlockHeight(ids.length);
    }
    y += 2;
    rule(y);
    y += 3;
  }

  // ---- 3. Room by room --------------------------------------------------------
  newPage();
  sectionTitle('Detalhamento por cômodo', 'Room-by-room detail');
  let firstRoom = true;
  for (const room of insp.rooms) {
    if (!firstRoom) newPage();
    firstRoom = false;
    onProgress(`Building PDF… ${room.pt}`);
    const st = roomStats(room);
    const summary =
      room.type === 'keys' ? '' : room.type === 'meters' ? `${st.done}/${st.total} leituras` : `${st.done}/${st.total} verificados${st.defects ? ` · ${st.defects} defeito${st.defects === 1 ? '' : 's'}` : ''}`;
    band(room.pt, room.en, summary);

    if (room.type === 'keys') {
      for (const f of KEY_FIELDS) {
        ensure(12);
        const h = bi(f.pt, f.en, M, y, 120, { size: 10, enSize: 7 });
        font('bold', 14, INK);
        doc.text(room.data[f.key] === '' ? '-' : String(room.data[f.key]), M + CW, y, { baseline: 'top', align: 'right' });
        y += h + 2;
        rule(y);
        y += 3;
      }
      if (room.data.note) {
        const nl = wrap(room.data.note, CW, 9, 'italic');
        ensure(nl.length * lh(9) + 4);
        font('italic', 9, INK);
        put(nl, M, y);
        y += nl.length * lh(9) + 4;
      }
      await photoGrid(room.data.photoIds || []);
      continue;
    }

    if (room.type === 'meters') {
      for (const m of METERS) {
        const v = room.data[m.key];
        const ids = (v.photoIds || []).filter((id) => byId.has(id));
        const first = ids.length ? photoRowHeight(ids.slice(0, 3).map((id) => byId.get(id))) : 0;
        ensure(22 + first);
        const h = bi(m.pt, m.en, M, y, 80, { size: 11, enSize: 7.5 });
        font('bold', 14, INK);
        doc.text(v.reading === '' ? '-' : `${v.reading} ${m.unit}`, M + CW, y, { baseline: 'top', align: 'right' });
        y += h + 1;
        const extra = [v.serial ? `Nº do medidor / Meter no.: ${v.serial}` : '', v.note ? `Obs.: ${v.note}` : ''].filter(Boolean).join('   ·   ');
        if (extra) {
          const el = wrap(extra, CW, 8.5, 'italic');
          font('italic', 8.5, MUTED);
          put(el, M, y);
          y += el.length * lh(8.5) + 1;
        }
        await photoGrid(ids);
        rule(y);
        y += 4;
      }
      continue;
    }

    for (const it of room.items) {
      const labelW = 138;
      const headH = bi(it.pt, it.en, M, y, labelW, { size: 9.5, enSize: 7, dry: true });
      const noteLines = it.note ? wrap(it.note, labelW, 8.5, 'italic') : [];
      const noteH = noteLines.length * lh(8.5);
      const ids = (it.photoIds || []).filter((id) => byId.has(id));
      const first = ids.length ? photoRowHeight(ids.slice(0, 3).map((id) => byId.get(id))) : 0;
      ensure(Math.max(headH + noteH, 10) + 3 + first);
      const top = y;
      bi(it.pt, it.en, M, y, labelW, { size: 9.5, enSize: 7 });
      badge(it.status, M + CW - 35, top);
      y += headH;
      if (noteLines.length) {
        font('italic', 8.5, INK);
        put(noteLines, M, y + 0.3);
        y += noteH + 0.3;
      }
      y = Math.max(y, top + 10.5) + 1.5;
      if (ids.length) await photoGrid(ids);
      rule(y);
      y += 2.5;
    }

    if (room.defects.length) {
      ensure(24);
      y += 2;
      const h = bi('Outros defeitos', 'Other defects', M, y, CW, { size: 10.5, enSize: 7.5, color: RED });
      y += h + 2;
      for (const d of room.defects) {
        const nl = wrap(d.note || '(sem descrição / no description)', CW - 8, 9, 'italic');
        const ids = (d.photoIds || []).filter((id) => byId.has(id));
        const first = ids.length ? photoRowHeight(ids.slice(0, 3).map((id) => byId.get(id))) : 0;
        ensure(nl.length * lh(9) + 3 + first);
        doc.setFillColor(...RED);
        doc.rect(M, y, 1.2, nl.length * lh(9), 'F');
        font('italic', 9, INK);
        put(nl, M + 4, y);
        y += nl.length * lh(9) + 2;
        if (ids.length) await photoGrid(ids);
        y += 1;
      }
    }
  }

  // ---- 4. Photo register --------------------------------------------------------
  newPage();
  sectionTitle('Registro das fotos (SHA-256)', 'Photo register (SHA-256)');
  const intro = [
    'Cada foto foi reduzida a no máximo 1600 px ao ser capturada, recebeu a data e a hora gravadas no canto da imagem e teve o hash SHA-256 calculado no mesmo momento. As imagens deste PDF são cópias reduzidas; os arquivos correspondentes aos hashes abaixo estão no arquivo ZIP exportado pelo aplicativo.',
  ];
  const introEn =
    'Each photo was reduced to at most 1600 px when captured, had its capture date and time burned into the corner, and its SHA-256 hash computed at the same moment. The images in this PDF are reduced copies; the files matching the hashes below are in the ZIP exported by the app.';
  font('normal', 8.5, INK);
  const il = wrap(intro[0], CW, 8.5);
  put(il, M, y);
  y += il.length * lh(8.5) + 0.5;
  const ile = wrap(introEn, CW, 7);
  font('normal', 7, MUTED);
  put(ile, M, y);
  y += ile.length * lh(7) + 4;

  const colX = { n: M, where: M + 9, time: M + 60, hash: M + 93 };
  const tableHead = () => {
    doc.setFillColor(238, 241, 244);
    doc.rect(M, y, CW, 7.5, 'F');
    font('bold', 7.5, INK);
    put('Nº', colX.n + 1, y + 1);
    put('Local / Location', colX.where, y + 1);
    put('Capturada em / Captured', colX.time, y + 1);
    put('SHA-256', colX.hash, y + 1);
    y += 8.5;
  };
  tableHead();
  const manifestPhotos = JSON.parse(mf.json).photos;
  mf.photos.forEach((r, i) => {
    if (y + 5 > BOTTOM) {
      newPage();
      tableHead();
    }
    if (i % 2) {
      doc.setFillColor(248, 249, 248);
      doc.rect(M, y - 0.6, CW, 5, 'F');
    }
    const meta = manifestPhotos[i];
    font('normal', 7, INK);
    put(String(i + 1), colX.n + 1, y);
    const whereLines = wrap(`${meta.room} - ${meta.where}`, 47, 7);
    put(whereLines.length > 1 ? `${whereLines[0].replace(/[\s(]+\S*$/, '')}...` : whereLines[0], colX.where, y);
    put(r.stampText, colX.time, y);
    font('normal', 5.9, INK, 'courier');
    put(r.hash, colX.hash, y + 0.2);
    y += 4.4;
  });
  y += 6;

  ensure(48);
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.4);
  doc.roundedRect(M, y, CW, 40, 2, 2);
  let by = y + 3;
  by += bi('Gerado em', 'Generated on', M + 4, by, 60, { size: 8.5, enSize: 6.5 });
  font('normal', 9, INK);
  put(`${fmtDateTime(generatedAt)} (${tzLabel(generatedAt)})  ·  Vistoria app ${APP_VERSION}`, M + 4, by);
  by += lh(9) + 2;
  by += bi('Impressão digital do relatório (SHA-256 do arquivo manifest do ZIP)', 'Report fingerprint (SHA-256 of the ZIP manifest file)', M + 4, by, CW - 8, { size: 8.5, enSize: 6.5 });
  font('normal', 8.5, INK, 'courier');
  put(`${mf.fingerprint.slice(0, 32)}\n${mf.fingerprint.slice(32)}`, M + 4, by);
  by += lh(8.5) * 2 + 1.5;
  font('normal', 6.5, MUTED);
  put('Conferência: no ZIP, "shasum -a 256 -c hashes.txt" (fotos) e "shasum -a 256 manifest-*.json" (impressão digital).', M + 4, by);
  y += 46;

  // ---- 5. Signatures ---------------------------------------------------------------
  newPage();
  sectionTitle('Assinaturas', 'Signatures');
  const pl = wrap('Conferido pelas partes na data da entrega das chaves.', CW, 10);
  font('normal', 10, INK);
  put(pl, M, y);
  y += lh(10);
  font('normal', 7.5, MUTED);
  put('Reviewed by the parties on the key handover date.', M, y);
  y += lh(7.5) + 22;

  const sigBlock = (x, pt, en, name) => {
    rule(y, INK, x, x + 80);
    let h = bi(pt, en, x, y + 2, 80, { size: 10, enSize: 7.5 });
    if (name) {
      font('normal', 9, INK);
      put(wrap(name, 80, 9), x, y + 2 + h + 1);
    }
    font('normal', 8.5, INK);
    put('Data / Date:  ____ / ____ / ________', x, y + 2 + h + 9);
  };
  sigBlock(M, 'Locador / Imobiliária', 'Landlord / agency', s.landlord);
  sigBlock(M + 100, 'Locatário', 'Tenant', s.tenant);
  y += 42;

  const rh = bi('Observações das partes', "Parties' remarks", M, y, CW, { size: 10, enSize: 7.5 });
  y += rh + 4;
  for (let i = 0; i < 8; i++) {
    rule(y + i * 9);
  }

  // ---- Footer on every page -----------------------------------------------------------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    rule(284, LINE);
    font('normal', 7.5, INK);
    put(FOOTER, M, 285.8);
    font('normal', 7.5, MUTED);
    put(`Página ${p} de ${pages}  /  Page ${p} of ${pages}`, M + CW, 285.8, { align: 'right' });
    font('normal', 6, MUTED);
    put(cl(`${s.label}  ·  ${fmtDate(s.date)}  ·  Impressão digital ${mf.fingerprint.slice(0, 16)}...`), M, 290);
  }

  const d = new Date(generatedAt);
  const p2 = (n) => String(n).padStart(2, '0');
  const name = `vistoria-${slug(s.label)}-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}.pdf`;
  return {
    blob: doc.output('blob'),
    name,
    pages,
    fingerprint: mf.fingerprint,
    note: `${pages} pages · fingerprint ${mf.fingerprint.slice(0, 16)}… (send it to the landlord in the same message as the PDF)`,
  };
}
