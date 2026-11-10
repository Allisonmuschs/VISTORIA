import { html, useState } from '../ui.js';
import { db } from '../db.js';
import { useInspection } from '../store.js';
import { Header, Stepper, Loading, go } from '../components.js';
import { buildInspection, todayISO } from '../model.js';

function Field({ label, hint, children }) {
  return html`<label class="field"><span class="field-label">${label}</span>${children}${hint ? html`<small class="hint">${hint}</small>` : null}</label>`;
}

function SetupForm({ initial, creating, onSubmit, title, back }) {
  const [s, setS] = useState(initial.setup);
  const [o, setO] = useState(initial.opts);
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const ready = s.label.trim() && s.date;

  return html`
    <${Header} title=${title} back=${back} backLabel="Cancel" />
    <main>
      <form
        onSubmit=${(e) => {
          e.preventDefault();
          if (ready) onSubmit({ ...s, label: s.label.trim() }, o);
        }}
      >
        <${Field} label="Property label" hint="Any name you will recognise. No address needed.">
          <input type="text" required maxlength="80" value=${s.label} onInput=${set('label')} placeholder="e.g. Apto Ipanema 302" />
        <//>
        <${Field} label="Date of inspection">
          <input type="date" required value=${s.date} onInput=${set('date')} />
        <//>
        <${Field} label="Landlord / agency (optional)">
          <input type="text" maxlength="80" value=${s.landlord} onInput=${set('landlord')} />
        <//>
        <${Field} label="Tenant (optional)">
          <input type="text" maxlength="80" value=${s.tenant} onInput=${set('tenant')} />
        <//>

        ${creating
          ? html`
              <h2>Rooms</h2>
              <div class="row"><span>Bedrooms · <em>quartos</em></span><${Stepper} label="Bedrooms" value=${o.bedrooms} max=${10} onChange=${(v) => setO({ ...o, bedrooms: v })} /></div>
              <div class="row"><span>Bathrooms · <em>banheiros</em></span><${Stepper} label="Bathrooms" value=${o.bathrooms} max=${8} onChange=${(v) => setO({ ...o, bathrooms: v })} /></div>
              <label class="row check"><span>Laundry area · <em>área de serviço</em></span><input type="checkbox" checked=${o.laundry} onChange=${(e) => setO({ ...o, laundry: e.target.checked })} /></label>
              <label class="row check"><span>Balcony · <em>varanda</em></span><input type="checkbox" checked=${o.balcony} onChange=${(e) => setO({ ...o, balcony: e.target.checked })} /></label>
              <label class="row check"><span>Furnished · <em>mobiliado</em></span><input type="checkbox" checked=${s.furnished} onChange=${(e) => setS({ ...s, furnished: e.target.checked })} /></label>
              <p class="hint">Entrance/living room, kitchen, keys and meters are always included. You can add, rename, reorder or remove rooms later.</p>
            `
          : null}

        <button class="btn primary" type="submit" disabled=${!ready}>${creating ? 'Create inspection' : 'Save'}</button>
      </form>
    </main>
  `;
}

export function NewInspection() {
  const initial = {
    setup: { label: '', date: todayISO(), landlord: '', tenant: '', furnished: false },
    opts: { bedrooms: 2, bathrooms: 1, laundry: true, balcony: true },
  };
  async function create(setup, opts) {
    const insp = buildInspection(setup, opts);
    await db.put(insp);
    // Ask the browser not to evict our data under storage pressure (best effort; iOS may ignore).
    try {
      if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
    } catch {
      /* ignore */
    }
    go(`i/${insp.id}`);
  }
  return html`<${SetupForm} initial=${initial} creating=${true} onSubmit=${create} title="New inspection" back="" />`;
}

export function EditSetup({ id }) {
  const [insp, update, missing] = useInspection(id);
  if (!insp) return html`<${Loading} missing=${missing} />`;
  return html`<${SetupForm}
    initial=${{ setup: insp.setup, opts: {} }}
    creating=${false}
    title="Edit details"
    back=${`i/${id}`}
    onSubmit=${(setup) => {
      update((d) => {
        d.setup = { ...d.setup, ...setup };
      });
      go(`i/${id}`);
    }}
  />`;
}
