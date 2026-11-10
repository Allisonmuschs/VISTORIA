import { html, useState, useRef } from '../ui.js';
import { useInspection } from '../store.js';
import { Header, Bi, Loading } from '../components.js';
import { STATUSES, roomStats, uid } from '../model.js';
import { PhotoField, PhotoInput, storePhoto } from '../photoui.js';
import { deletePhotos } from '../photos.js';
import { KeysView, MetersView } from './special.js';

function Item({ item, editing, update, insp, room }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const edit = (fn) =>
    update((d) => {
      fn(d.rooms.find((r) => r.id === room.id).items.find((i) => i.id === item.id));
    });
  const showNote = noteOpen || !!item.note;

  return html`
    <li class=${`item st-${item.status || 'none'}`}>
      <div class="item-head">
        <${Bi} pt=${item.pt} en=${item.en} />
        ${editing
          ? html`<button class="icon danger" aria-label="Remove item" onClick=${async () => {
              if (confirm(`Remove "${item.pt}" from this room${item.photoIds.length ? ' (its photos will be deleted too)' : ''}?`)) {
                await deletePhotos(item.photoIds);
                update((d) => {
                  const r = d.rooms.find((x) => x.id === room.id);
                  r.items = r.items.filter((i) => i.id !== item.id);
                });
              }
            }}>✕</button>`
          : null}
      </div>
      <div class="seg" role="group" aria-label="Status">
        ${STATUSES.map(
          (s) => html`<button
            type="button"
            class=${`seg-${s.key} ${item.status === s.key ? 'on' : ''}`}
            aria-pressed=${item.status === s.key}
            onClick=${() => edit((i) => { i.status = i.status === s.key ? null : s.key; })}
          >
            <${Bi} pt=${s.pt} en=${s.en === s.pt ? '' : s.en} />
          </button>`
        )}
      </div>
      <div class="item-tools">
        <${PhotoField}
          inspectionId=${insp.id} roomId=${room.id} kind="item" ownerId=${item.id}
          caption=${`${room.pt} › ${item.pt}`}
          photoIds=${item.photoIds}
          onAdd=${(pid) => edit((i) => { i.photoIds.push(pid); })}
          onRemove=${(pid) => edit((i) => { i.photoIds = i.photoIds.filter((x) => x !== pid); })}
        />
        ${showNote ? null : html`<button class="link small" onClick=${() => setNoteOpen(true)}>+ Add note</button>`}
      </div>
      ${showNote
        ? html`<textarea
            rows="2" placeholder="Note (optional)" value=${item.note}
            ref=${(el) => el && noteOpen && el.focus()}
            onInput=${(e) => edit((i) => { i.note = e.target.value; })}
          ></textarea>`
        : null}
    </li>
  `;
}

function AddItem({ roomId, update }) {
  const [pt, setPt] = useState('');
  const [en, setEn] = useState('');
  const add = () => {
    if (!pt.trim()) return;
    update((d) => {
      d.rooms.find((r) => r.id === roomId).items.push({
        id: uid(), key: 'custom', pt: pt.trim(), en: en.trim() || pt.trim(),
        status: null, note: '', photoIds: [], custom: true,
      });
    });
    setPt('');
    setEn('');
  };
  return html`
    <div class="panel">
      <h3>Add a checklist item</h3>
      <input type="text" placeholder="Item (Português)" value=${pt} onInput=${(e) => setPt(e.target.value)} />
      <input type="text" placeholder="Item (English, optional)" value=${en} onInput=${(e) => setEn(e.target.value)} />
      <button class="btn" onClick=${add} disabled=${!pt.trim()}>+ Add item</button>
    </div>
  `;
}

function Defects({ insp, room, update, focusRef }) {
  const [text, setText] = useState('');
  const editDefect = (id, fn) =>
    update((d) => {
      fn(d.rooms.find((r) => r.id === room.id).defects.find((x) => x.id === id));
    });
  const add = () => {
    if (!text.trim()) return;
    update((d) => {
      d.rooms.find((r) => r.id === room.id).defects.push({ id: uid(), note: text.trim(), photoIds: [], createdAt: Date.now() });
    });
    setText('');
  };
  return html`
    <section>
      <h2>Other defects <small>· outros defeitos</small></h2>
      ${room.defects.length === 0 ? html`<p class="hint">Use the ⚡ button for a photo + note in one tap, or add a note below.</p>` : null}
      <ul class="defects">
        ${room.defects.map(
          (d) => html`<li key=${d.id} class=${focusRef.current === d.id ? 'fresh' : ''}>
            <textarea
              rows="2" placeholder="Describe the defect…" value=${d.note}
              ref=${(el) => {
                if (el && focusRef.current === d.id) {
                  focusRef.current = null;
                  el.focus({ preventScroll: true });
                  el.scrollIntoView({ block: 'center' });
                }
              }}
              onInput=${(e) => editDefect(d.id, (x) => { x.note = e.target.value; })}
            ></textarea>
            <div class="item-tools">
              <${PhotoField}
                inspectionId=${insp.id} roomId=${room.id} kind="defect" ownerId=${d.id}
                caption=${`${room.pt} › Defeito`}
                photoIds=${d.photoIds}
                onAdd=${(pid) => editDefect(d.id, (x) => { x.photoIds.push(pid); })}
                onRemove=${(pid) => editDefect(d.id, (x) => { x.photoIds = x.photoIds.filter((p) => p !== pid); })}
              />
              <button class="icon danger" aria-label="Delete defect" onClick=${async () => {
                if (confirm('Delete this defect and its photos?')) {
                  await deletePhotos(d.photoIds);
                  update((x) => {
                    const r = x.rooms.find((y) => y.id === room.id);
                    r.defects = r.defects.filter((y) => y.id !== d.id);
                  });
                }
              }}>✕</button>
            </div>
          </li>`
        )}
      </ul>
      <textarea rows="2" placeholder="Add a defect with a note only…" value=${text} onInput=${(e) => setText(e.target.value)}></textarea>
      <button class="btn" onClick=${add} disabled=${!text.trim()}>+ Add defect</button>
    </section>
  `;
}

// One tap: camera opens -> photo is stored -> a new defect (photo + empty note) appears with its note box.
function QuickDefect({ insp, room, update, focusRef }) {
  const [busy, setBusy] = useState(false);
  async function onFile(file) {
    setBusy(true);
    try {
      const defectId = uid();
      const photoId = await storePhoto(file, { inspectionId: insp.id, roomId: room.id, kind: 'defect', ownerId: defectId });
      focusRef.current = defectId;
      update((d) => {
        d.rooms.find((r) => r.id === room.id).defects.push({ id: defectId, note: '', photoIds: [photoId], createdAt: Date.now() });
      });
    } catch (e) {
      alert('Could not save the photo: ' + (e.message || e));
    }
    setBusy(false);
  }
  return html`<${PhotoInput} onFile=${onFile} busy=${busy} label="Defect" icon="⚡" cls="fab" />`;
}

export function Room({ id, rid }) {
  const [insp, update, missing] = useInspection(id);
  const [editing, setEditing] = useState(false);
  const focusRef = useRef(null);
  if (!insp) return html`<${Loading} missing=${missing} />`;
  const idx = insp.rooms.findIndex((r) => r.id === rid);
  if (idx === -1) return html`<${Loading} missing=${true} />`;
  const room = insp.rooms[idx];
  const prev = insp.rooms[idx - 1];
  const next = insp.rooms[idx + 1];
  const st = roomStats(room);
  const nav = html`
    <nav class="pager">
      ${prev ? html`<a class="btn" href=${`#/i/${id}/r/${prev.id}`}>‹ ${prev.pt}</a>` : html`<span></span>`}
      ${next ? html`<a class="btn" href=${`#/i/${id}/r/${next.id}`}>${next.pt} ›</a>` : html`<a class="btn primary" href=${`#/i/${id}`}>Done</a>`}
    </nav>
  `;

  const header = html`<${Header}
    title=${room.pt}
    sub=${room.en !== room.pt ? room.en : ''}
    back=${`i/${id}`}
    backLabel=${insp.setup.label}
  />`;

  if (room.type === 'keys') return html`${header}<main><${KeysView} insp=${insp} room=${room} update=${update} /> ${nav}</main>`;
  if (room.type === 'meters') return html`${header}<main><${MetersView} insp=${insp} room=${room} update=${update} /> ${nav}</main>`;

  return html`
    ${header}
    <main class="with-fab">
      <div class="section-head">
        <span class="hint">${st.done}/${st.total} checked${st.defects ? ` · ${st.defects} defect${st.defects === 1 ? '' : 's'}` : ''}</span>
        <button class="link" onClick=${() => setEditing(!editing)}>${editing ? 'Done editing' : 'Edit checklist'}</button>
      </div>
      <ul class="items">
        ${room.items.map((it) => html`<${Item} key=${it.id} item=${it} editing=${editing} update=${update} insp=${insp} room=${room} />`)}
      </ul>
      ${editing ? html`<${AddItem} roomId=${room.id} update=${update} />` : null}
      <${Defects} insp=${insp} room=${room} update=${update} focusRef=${focusRef} />
      ${nav}
    </main>
    <${QuickDefect} insp=${insp} room=${room} update=${update} focusRef=${focusRef} />
  `;
}
