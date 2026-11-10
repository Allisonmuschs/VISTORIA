// Screens for the two non-checklist rooms: keys inventory and meters.
import { html } from '../ui.js';
import { Bi } from '../components.js';
import { PhotoField } from '../photoui.js';
import { KEY_FIELDS, METERS } from '../model.js';

const clean = (v) => v.replace(/[^0-9.,]/g, '');

export function KeysView({ insp, room, update }) {
  const set = (fn) =>
    update((d) => {
      fn(d.rooms.find((r) => r.id === room.id).data);
    });
  const photoIds = room.data.photoIds || [];
  return html`
    <section>
      ${KEY_FIELDS.map((f) => {
        const n = room.data[f.key];
        const num = n === '' ? 0 : parseInt(n, 10) || 0;
        return html`<div class="panel row">
          <${Bi} pt=${f.pt} en=${f.en} />
          <div class="stepper">
            <button type="button" class="step" disabled=${num <= 0} onClick=${() => set((x) => { x[f.key] = String(Math.max(0, num - 1)); })}>−</button>
            <input
              type="text" inputmode="numeric" pattern="[0-9]*" aria-label=${f.en}
              value=${n} placeholder="–"
              onInput=${(e) => set((x) => { x[f.key] = e.target.value.replace(/\D/g, ''); })}
            />
            <button type="button" class="step" onClick=${() => set((x) => { x[f.key] = String(num + 1); })}>+</button>
          </div>
        </div>`;
      })}
      <div class="panel">
        <h3>Photo of all keys and remotes</h3>
        <${PhotoField}
          inspectionId=${insp.id} roomId=${room.id} kind="keys" ownerId="keys"
          caption=${`${room.pt}`}
          photoIds=${photoIds}
          onAdd=${(pid) => set((x) => { x.photoIds = [...(x.photoIds || []), pid]; })}
          onRemove=${(pid) => set((x) => { x.photoIds = (x.photoIds || []).filter((p) => p !== pid); })}
        />
      </div>
      <label class="field"><span class="field-label">Notes · <em>observações</em></span>
        <textarea rows="3" placeholder="e.g. which key opens what, spare copies" value=${room.data.note} onInput=${(e) => set((x) => { x.note = e.target.value; })}></textarea>
      </label>
    </section>
  `;
}

export function MetersView({ insp, room, update }) {
  const set = (key, fn) =>
    update((d) => {
      fn(d.rooms.find((r) => r.id === room.id).data[key]);
    });
  return html`
    <section>
      ${METERS.map((m) => {
        const v = room.data[m.key];
        return html`<div class="panel">
          <h3><${Bi} pt=${m.pt} en=${m.en} /></h3>
          <label class="field"><span class="field-label">Reading · <em>leitura</em> (${m.unit})</span>
            <input type="text" inputmode="decimal" placeholder="0000.0" value=${v.reading}
              onInput=${(e) => set(m.key, (x) => { x.reading = clean(e.target.value); })} />
          </label>
          <${PhotoField}
            inspectionId=${insp.id} roomId=${room.id} kind="meter" ownerId=${m.key}
            caption=${`Medidor › ${m.pt}`}
            label="Photo of meter"
            photoIds=${v.photoIds || []}
            onAdd=${(pid) => set(m.key, (x) => { x.photoIds = [...(x.photoIds || []), pid]; })}
            onRemove=${(pid) => set(m.key, (x) => { x.photoIds = (x.photoIds || []).filter((p) => p !== pid); })}
          />
          <label class="field"><span class="field-label">Meter number · <em>nº do medidor</em> (optional)</span>
            <input type="text" value=${v.serial} onInput=${(e) => set(m.key, (x) => { x.serial = e.target.value; })} />
          </label>
          <label class="field"><span class="field-label">Note (optional)</span>
            <input type="text" value=${v.note} onInput=${(e) => set(m.key, (x) => { x.note = e.target.value; })} />
          </label>
        </div>`;
      })}
    </section>
  `;
}
