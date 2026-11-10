// Photo UI: capture button, thumbnail strip, full-size viewer with hash verification.
import { html, useState, useEffect } from './ui.js';
import { db } from './db.js';
import { processPhoto, prime, loadThumbs, cachedPhoto, deletePhotos } from './photos.js';
import { sha256Hex } from './hash.js';
import { fmtDateTime } from './model.js';

// A <label> wrapping a hidden file input: the tap that opens the camera is a real user gesture,
// which iOS requires. `capture` asks for the rear camera directly.
export function PhotoInput({ onFile, busy, label = 'Photo', icon = '📷', cls = 'photo-btn' }) {
  return html`
    <label class=${`${cls} ${busy ? 'busy' : ''}`}>
      ${busy ? 'Saving…' : html`<span aria-hidden="true">${icon}</span> ${label}`}
      <input
        type="file" accept="image/*" capture="environment" hidden disabled=${busy}
        onChange=${(e) => {
          const f = e.target.files[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
    </label>
  `;
}

// Resize/stamp/hash/store one picked file and return the new photo id.
export async function storePhoto(file, where) {
  const rec = await processPhoto(file, where);
  await db.photos.put(rec);
  prime(rec);
  return rec.id;
}

function Thumbs({ ids, onOpen }) {
  const [, tick] = useState(0);
  const key = ids.join(',');
  useEffect(() => {
    let alive = true;
    loadThumbs(ids).then(() => alive && tick((n) => n + 1));
    return () => {
      alive = false;
    };
  }, [key]);
  if (!ids.length) return null;
  return html`<div class="thumbs">
    ${ids.map((id) => {
      const c = cachedPhoto(id);
      return html`<button type="button" class=${`thumb ${c && c.missing ? 'missing' : ''}`} key=${id} aria-label="Open photo" onClick=${() => onOpen(id)}>
        ${c && c.url ? html`<img src=${c.url} alt="" />` : html`<span>${c && c.missing ? '✕' : '…'}</span>`}
      </button>`;
    })}
  </div>`;
}

function Viewer({ id, caption, onClose, onDelete }) {
  const [rec, setRec] = useState(null);
  const [url, setUrl] = useState(null);
  const [full, setFull] = useState(false);
  const [check, setCheck] = useState(null);

  useEffect(() => {
    let u;
    let alive = true;
    db.photos.get(id).then((r) => {
      if (!alive) return;
      if (!r) return setRec(false);
      u = URL.createObjectURL(r.blob);
      setRec(r);
      setUrl(u);
    });
    const onKey = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => {
      alive = false;
      removeEventListener('keydown', onKey);
      if (u) URL.revokeObjectURL(u);
    };
  }, [id]);

  async function verify() {
    setCheck('…');
    // Re-read from storage so we check what is really stored, not the copy loaded when the viewer opened.
    const stored = await db.photos.get(id);
    setCheck(stored && (await sha256Hex(stored.blob)) === stored.hash ? 'ok' : 'bad');
  }

  return html`
    <div class="viewer" role="dialog" aria-modal="true">
      <div class="viewer-bar">
        <strong>${caption || 'Photo'}</strong>
        <button class="btn" onClick=${onClose}>Close</button>
      </div>
      ${rec === false
        ? html`<p class="viewer-msg">This photo is not on this device (it was not included in the backup that was restored).</p>`
        : url
          ? html`<img class="viewer-img" src=${url} alt=${caption || 'Photo'} />`
          : html`<p class="viewer-msg">Loading…</p>`}
      ${rec
        ? html`<div class="viewer-info">
            <dl class="kv">
              <dt>Captured</dt><dd>${fmtDateTime(rec.capturedAt)}</dd>
              <dt>Size</dt><dd>${rec.width}×${rec.height} · ${(rec.bytes / 1024).toFixed(0)} KB</dd>
              <dt>SHA-256</dt>
              <dd><code class="hash" onClick=${() => setFull(!full)}>${full ? rec.hash : rec.hash.slice(0, 16) + '…'}</code>
                <small class="hint">${full ? 'tap to shorten' : 'tap for full hash'}</small></dd>
            </dl>
            ${check === 'ok' ? html`<div class="banner">✓ The stored photo still matches its hash.</div>` : null}
            ${check === 'bad' ? html`<div class="banner warn">✗ The stored photo does NOT match its hash.</div>` : null}
            <div class="stack">
              <button class="btn" onClick=${verify}>Verify integrity</button>
              <button class="btn danger" onClick=${onDelete}>Delete this photo</button>
            </div>
          </div>`
        : rec === false
          ? html`<div class="viewer-info"><button class="btn danger" onClick=${onDelete}>Remove this reference</button></div>`
          : null}
    </div>
  `;
}

// Camera button + thumbnails + viewer for one owner (checklist item, defect, meter, keys).
// onAdd(id) / onRemove(id) let the parent store the id in the right place of the inspection.
export function PhotoField({ inspectionId, roomId, kind, ownerId, caption, photoIds, onAdd, onRemove, label }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);

  async function onFile(file) {
    setBusy(true);
    try {
      onAdd(await storePhoto(file, { inspectionId, roomId, kind, ownerId }));
    } catch (e) {
      alert('Could not save the photo: ' + (e.message || e));
    }
    setBusy(false);
  }

  return html`
    <div class="photofield">
      <${PhotoInput} onFile=${onFile} busy=${busy} label=${label} />
      <${Thumbs} ids=${photoIds} onOpen=${setOpen} />
      ${open
        ? html`<${Viewer}
            id=${open}
            caption=${caption}
            onClose=${() => setOpen(null)}
            onDelete=${async () => {
              if (!confirm('Delete this photo? This cannot be undone.')) return;
              await deletePhotos([open]);
              onRemove(open);
              setOpen(null);
            }}
          />`
        : null}
    </div>
  `;
}
