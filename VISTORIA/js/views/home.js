import { html, useState, useEffect } from '../ui.js';
import { db } from '../db.js';
import { Header, go, Disclaimer } from '../components.js';
import { inspectionStats, fmtDate } from '../model.js';
import { buildDemo, addDemoPhotos } from '../seed.js';
import { lastBackup } from '../backup.js';

export function Home() {
  const [list, setList] = useState(null);
  useEffect(() => {
    db.list().then((l) => setList(l.sort((a, b) => b.createdAt - a.createdAt)));
  }, []);

  const [demoMsg, setDemoMsg] = useState('');
  async function loadDemo() {
    try {
      const d = buildDemo();
      await addDemoPhotos(d, setDemoMsg); // photos are stored before the inspection that points at them
      await db.put(d);
      go(`i/${d.id}`);
    } catch (e) {
      setDemoMsg('Could not create the demo: ' + (e.message || e));
    }
  }

  if (!list) return html`<${Header} title="Vistoria" />`;

  const hasDemo = list.some((x) => x.isDemo);
  const real = list.filter((x) => !x.isDemo);
  const unsaved = real.some((x) => x.updatedAt > lastBackup());

  return html`
    <${Header} title="Vistoria" sub="Move-in condition report · vistoria de entrada" />
    <main>
      ${unsaved
        ? html`<div class="banner warn">
            Your latest changes are not backed up. Open <a href="#/settings">Settings</a> and export a ZIP backup.
          </div>`
        : null}

      ${list.length === 0
        ? html`<p class="empty">No inspections yet. Start a new one, or load the demo apartment to try everything out first.</p>`
        : html`<ul class="cards">
            ${list.map((x) => {
              const s = inspectionStats(x);
              return html`<li>
                <a class="card" href=${`#/i/${x.id}`}>
                  <div class="card-title">
                    ${x.setup.label || 'Untitled'} ${x.isDemo ? html`<span class="tag">DEMO</span>` : null}
                  </div>
                  <div class="card-sub">${fmtDate(x.setup.date)} · ${s.done}/${s.total} checked</div>
                  <div class="badges">
                    ${s.defects ? html`<span class="badge bad">${s.defects} defect${s.defects === 1 ? '' : 's'}</span>` : html`<span class="badge good">No defects</span>`}
                  </div>
                </a>
              </li>`;
            })}
          </ul>`}

      <div class="stack">
        <a class="btn primary" href="#/new">+ New inspection</a>
        ${hasDemo ? null : html`<button class="btn" onClick=${loadDemo} disabled=${!!demoMsg}>${demoMsg || 'Load demo apartment'}</button>`}
        <a class="btn ghost" href="#/settings">Settings · backup · restore</a>
      </div>
      <${Disclaimer} />
    </main>
  `;
}
