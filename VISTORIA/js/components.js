// Small shared UI pieces.
import { html, useState } from './ui.js';
import { saveFile } from './files.js';

export const go = (path) => {
  location.hash = '#/' + path;
};

// Portuguese label with the English one in small text beneath.
export const Bi = ({ pt, en, cls }) => html`
  <span class="bi ${cls || ''}">
    <span class="pt">${pt}</span>
    ${en && en !== pt ? html`<small class="en">${en}</small>` : null}
  </span>
`;

export const Header = ({ title, sub, back, backLabel }) => html`
  <header class="top">
    ${back != null ? html`<a class="back" href=${'#/' + back}>‹ ${backLabel || 'Back'}</a>` : null}
    <h1>${title}</h1>
    ${sub ? html`<p class="sub">${sub}</p>` : null}
  </header>
`;

export const Stepper = ({ value, onChange, min = 0, max = 99, label }) => html`
  <div class="stepper" role="group" aria-label=${label}>
    <button type="button" class="step" disabled=${value <= min} onClick=${() => onChange(value - 1)} aria-label="Decrease">−</button>
    <output>${value}</output>
    <button type="button" class="step" disabled=${value >= max} onClick=${() => onChange(value + 1)} aria-label="Increase">+</button>
  </div>
`;

// Two-tap export: "Prepare" does the slow work, then a fresh tap on "Save / share" opens the share
// sheet. iOS only allows the share sheet right after a tap, so one long-running tap would fail.
export function ExportButton({ label, build, onSaved, cls = 'btn' }) {
  const [st, setSt] = useState({ phase: 'idle' });
  async function prepare() {
    setSt({ phase: 'working', msg: 'Preparing…' });
    try {
      setSt({ phase: 'ready', out: await build((msg) => setSt({ phase: 'working', msg })) });
    } catch (e) {
      setSt({ phase: 'error', msg: e.message || String(e) });
    }
  }
  async function save() {
    const r = await saveFile(st.out.blob, st.out.name);
    if (r !== 'cancelled' && onSaved) onSaved();
  }
  if (st.phase === 'working') return html`<button class=${cls} disabled>${st.msg}</button>`;
  if (st.phase === 'ready') {
    const isPdf = st.out.blob.type === 'application/pdf';
    return html`<div class="ready">
      <button class="btn primary" onClick=${save}>Save / share ${st.out.name} (${(st.out.blob.size / 1048576).toFixed(1)} MB)</button>
      ${st.out.note ? html`<p class="hint">${st.out.note}</p>` : null}
      <div class="ready-row">
        ${isPdf ? html`<button class="link small" onClick=${() => window.open(URL.createObjectURL(st.out.blob), '_blank')}>Open to preview</button>` : null}
        <button class="link small" onClick=${() => setSt({ phase: 'idle' })}>Discard</button>
      </div>
    </div>`;
  }
  return html`${st.phase === 'error' ? html`<div class="banner warn">Could not prepare the file: ${st.msg}</div>` : null}
    <button class=${cls} onClick=${prepare}>${label}</button>`;
}

export const Loading =({ missing }) =>
  html`<main><p class="empty">${missing ? 'Inspection not found.' : 'Loading…'}</p>${missing ? html`<a class="btn" href="#/">Back to home</a>` : null}</main>`;

export const Disclaimer = () => html`
  <p class="disclaimer">
    Informational record prepared by the tenant. This app makes no claim of legal validity.
  </p>
`;
