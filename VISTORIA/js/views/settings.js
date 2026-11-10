import { html, useState, useEffect, useRef } from '../ui.js';
import { db } from '../db.js';
import { Header, Disclaimer, ExportButton } from '../components.js';
import { exportJSON, buildZip, readBackup, restoreBackup, lastBackup, markBackup } from '../backup.js';
import { APP_VERSION } from '../version.js';

const mb = (n) => (n / 1048576).toFixed(1) + ' MB';

export function Settings() {
  const [info, setInfo] = useState({});
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);

  async function refresh() {
    const out = {};
    try {
      if (navigator.storage) {
        if (navigator.storage.persisted) out.persisted = await navigator.storage.persisted();
        if (navigator.storage.estimate) out.estimate = await navigator.storage.estimate();
      }
      if (window.caches) {
        const keys = (await caches.keys()).filter((k) => k.startsWith('vistoria-'));
        out.cache = keys.join(', ') || 'none yet';
      }
    } catch {
      /* diagnostics only */
    }
    out.standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
    setInfo(out);
  }
  useEffect(() => {
    refresh();
  }, []);

  async function persist() {
    try {
      const ok = navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false;
      setMsg(ok ? 'Persistent storage granted.' : 'The browser did not grant persistent storage. Keep backups, and add the app to your Home Screen.');
    } catch {
      setMsg('Persistent storage is not available here.');
    }
    refresh();
  }

  async function onRestore(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      setMsg('Reading file…');
      const parsed = await readBackup(file);
      const existing = new Set((await db.list()).map((x) => x.id));
      const replaced = parsed.inspections.filter((x) => existing.has(x.id)).length;
      const withFiles = parsed.files ? parsed.photoMetas.filter((m) => parsed.files[m.file]).length : 0;
      const ok = confirm(
        `Restore ${parsed.inspections.length} inspection${parsed.inspections.length === 1 ? '' : 's'} and ${withFiles} photo${withFiles === 1 ? '' : 's'}?` +
          (replaced ? `\n${replaced} already exist${replaced === 1 ? 's' : ''} on this device and will be overwritten.` : '') +
          (!parsed.files && parsed.photoMetas.length ? `\n\nThis JSON file does not contain the ${parsed.photoMetas.length} photo files. Use a ZIP backup to get photos back.` : '')
      );
      if (!ok) return setMsg('');
      const r = await restoreBackup(parsed, setMsg);
      setMsg(
        `Restored ${r.inspections} inspection${r.inspections === 1 ? '' : 's'} and ${r.photos} photo${r.photos === 1 ? '' : 's'}.` +
          (r.hashMismatches ? ` WARNING: ${r.hashMismatches} photo${r.hashMismatches === 1 ? ' does' : 's do'} not match the recorded hash.` : r.photos ? ' All photo hashes match.' : '')
      );
    } catch (err) {
      setMsg('Could not restore: ' + err.message);
    }
  }

  async function wipe() {
    if (confirm('Delete ALL inspections and photos from this device? This cannot be undone.') && confirm('Really delete everything?')) {
      await db.clearAll();
      setMsg('All data deleted.');
    }
  }

  const lb = lastBackup();
  const est = info.estimate;

  return html`
    <${Header} title="Settings" back="" backLabel="Home" />
    <main>
      <h2>Backup</h2>
      <p class="hint">Last backup: ${lb ? new Date(lb).toLocaleString() : 'never'}</p>
      <div class="stack">
        <${ExportButton}
          label="Back up everything (ZIP, with photos)"
          cls="btn primary"
          build=${async (progress) => buildZip(await db.list(), 'all', progress)}
          onSaved=${() => { markBackup(); refresh(); }}
        />
        <button class="btn" onClick=${async () => { setMsg(''); await exportJSON(await db.list(), 'all'); refresh(); }}>Data only (JSON, no photos)</button>
        <button class="btn" onClick=${() => fileRef.current.click()}>Restore from ZIP or JSON…</button>
        <input ref=${fileRef} type="file" accept=".zip,.json,application/zip,application/json" hidden onChange=${onRestore} />
      </div>
      ${msg ? html`<div class="banner" role="status">${msg}</div>` : null}

      <h2>This device</h2>
      <dl class="kv">
        <dt>Installed to Home Screen</dt><dd>${info.standalone ? 'Yes' : 'No — in iPhone Chrome use Share → Add to Home Screen'}</dd>
        <dt>Persistent storage</dt><dd>${info.persisted === undefined ? 'Unknown' : info.persisted ? 'Granted' : 'Not granted'}</dd>
        <dt>Storage used</dt><dd>${est ? `${mb(est.usage)} of ~${mb(est.quota)}` : 'Unknown'}</dd>
        <dt>Offline cache</dt><dd>${info.cache || 'Unavailable'}</dd>
        <dt>App version</dt><dd>${APP_VERSION}</dd>
      </dl>
      <div class="stack">
        <button class="btn" onClick=${persist}>Request persistent storage</button>
        <button class="btn danger" onClick=${wipe}>Delete all data on this device</button>
      </div>
      <${Disclaimer} />
    </main>
  `;
}
