import { html, useState } from '../ui.js';
import { db } from '../db.js';
import { useInspection } from '../store.js';
import { Header, Bi, Loading, go, Disclaimer, ExportButton } from '../components.js';
import {
  roomStats, inspectionStats, fmtDate, makeRoom, nextRoomName, ROOM_TYPES, ADDABLE_TYPES,
  roomPhotoIds, inspectionPhotoIds,
} from '../model.js';
import { exportJSON, buildZip, markBackup } from '../backup.js';
import { deletePhotos } from '../photos.js';
import { buildReport } from '../report.js';

function AddRoom({ insp, update }) {
  const [type, setType] = useState('quarto');
  const [pt, setPt] = useState('');
  const [en, setEn] = useState('');
  const auto = nextRoomName(insp, type);

  function add() {
    const name = pt.trim() || auto.pt;
    const nameEn = en.trim() || (pt.trim() ? pt.trim() : auto.en);
    update((d) => {
      const room = makeRoom(type, name, nameEn, !!d.setup.furnished);
      // keep "Chaves e controles" and "Medidores" at the end
      const at = d.rooms.findIndex((r) => ROOM_TYPES[r.type].special);
      d.rooms.splice(at === -1 ? d.rooms.length : at, 0, room);
    });
    setPt('');
    setEn('');
  }

  return html`
    <div class="panel">
      <h3>Add a room</h3>
      <label class="field"><span class="field-label">Type</span>
        <select value=${type} onChange=${(e) => setType(e.target.value)}>
          ${ADDABLE_TYPES.map((t) => html`<option value=${t}>${ROOM_TYPES[t].pt} · ${ROOM_TYPES[t].en}</option>`)}
        </select>
      </label>
      <label class="field"><span class="field-label">Name (Português)</span>
        <input type="text" value=${pt} placeholder=${auto.pt} onInput=${(e) => setPt(e.target.value)} />
      </label>
      <label class="field"><span class="field-label">Name (English, optional)</span>
        <input type="text" value=${en} placeholder=${auto.en} onInput=${(e) => setEn(e.target.value)} />
      </label>
      <button class="btn" onClick=${add}>+ Add room</button>
    </div>
  `;
}

export function Inspection({ id }) {
  const [insp, update, missing] = useInspection(id);
  const [editing, setEditing] = useState(false);
  if (!insp) return html`<${Loading} missing=${missing} />`;

  const s = inspectionStats(insp);
  const photoCount = inspectionPhotoIds(insp).length;
  const { label, date, landlord, tenant } = insp.setup;
  const parties = [landlord && `Landlord/agency: ${landlord}`, tenant && `Tenant: ${tenant}`].filter(Boolean).join(' · ');

  const move = (i, dir) =>
    update((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.rooms.length) return;
      [d.rooms[i], d.rooms[j]] = [d.rooms[j], d.rooms[i]];
    });
  const rename = (i, k) => (e) =>
    update((d) => {
      d.rooms[i][k] = e.target.value;
    });
  const remove = async (i) => {
    const r = insp.rooms[i];
    const n = roomPhotoIds(r).length;
    if (confirm(`Delete "${r.pt}" and everything recorded in it${n ? `, including ${n} photo${n === 1 ? '' : 's'}` : ''}?`)) {
      await deletePhotos(roomPhotoIds(r));
      update((d) => {
        d.rooms.splice(i, 1);
      });
    }
  };
  async function deleteInspection() {
    if (confirm(`Delete the whole inspection "${label}"? This cannot be undone.`)) {
      await db.delete(id);
      go('');
    }
  }

  return html`
    <${Header} title=${label} sub=${`${fmtDate(date)}${parties ? ' · ' + parties : ''}`} back="" backLabel="All inspections" />
    <main>
      ${insp.isDemo ? html`<div class="banner">Demo data — fictional apartment. Safe to edit or delete.</div>` : null}
      <div class="summary">
        <div><strong>${s.done}/${s.total}</strong><small>items checked</small></div>
        <div class=${s.defects ? 'bad' : 'good'}><strong>${s.defects}</strong><small>defect${s.defects === 1 ? '' : 's'}</small></div>
        <div><strong>${photoCount}</strong><small>photo${photoCount === 1 ? '' : 's'}</small></div>
      </div>

      <div class="section-head">
        <h2>Rooms</h2>
        <button class="link" onClick=${() => setEditing(!editing)}>${editing ? 'Done' : 'Edit rooms'}</button>
      </div>

      <ul class="cards">
        ${insp.rooms.map((r, i) => {
          if (editing) {
            return html`<li class="card edit-room" key=${r.id}>
              <input type="text" value=${r.pt} onInput=${rename(i, 'pt')} aria-label="Name in Portuguese" />
              <input type="text" value=${r.en} onInput=${rename(i, 'en')} aria-label="Name in English" />
              <div class="row-actions">
                <button class="icon" disabled=${i === 0} onClick=${() => move(i, -1)} aria-label="Move up">▲</button>
                <button class="icon" disabled=${i === insp.rooms.length - 1} onClick=${() => move(i, 1)} aria-label="Move down">▼</button>
                <button class="icon danger" onClick=${() => remove(i)} aria-label="Delete room">✕</button>
              </div>
            </li>`;
          }
          const st = roomStats(r);
          const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
          return html`<li key=${r.id}>
            <a class="card" href=${`#/i/${id}/r/${r.id}`}>
              <div class="card-title"><${Bi} pt=${r.pt} en=${r.en} /></div>
              <div class="card-sub">${st.done}/${st.total} ${r.type === 'meters' ? 'readings' : r.type === 'keys' ? 'counts' : 'checked'}${roomPhotoIds(r).length ? ` · 📷 ${roomPhotoIds(r).length}` : ''}</div>
              <div class="bar"><div style=${`width:${pct}%`}></div></div>
              ${st.defects ? html`<span class="badge bad corner">${st.defects}</span>` : null}
            </a>
          </li>`;
        })}
      </ul>

      ${editing ? html`<${AddRoom} insp=${insp} update=${update} />` : null}

      <div class="stack">
        <a class="btn" href=${`#/i/${id}/setup`}>Edit details</a>
        <${ExportButton}
          label="Generate PDF report"
          cls="btn primary"
          build=${(progress) => buildReport(insp, progress)}
        />
        <${ExportButton}
          label="Export photos + data (ZIP)"
          build=${(progress) => buildZip([insp], label, progress)}
          onSaved=${markBackup}
        />
        <button class="btn" onClick=${() => exportJSON([insp], label)}>Data only (JSON, no photos)</button>
        <button class="btn danger" onClick=${deleteInspection}>Delete inspection</button>
      </div>
      <${Disclaimer} />
    </main>
  `;
}
