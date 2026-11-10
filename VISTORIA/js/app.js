import { html, render, useState, useEffect } from './ui.js';
import { Home } from './views/home.js';
import { NewInspection, EditSetup } from './views/setup.js';
import { Inspection } from './views/inspection.js';
import { Room } from './views/room.js';
import { Settings } from './views/settings.js';

// Hash routes (work on any static host, including a GitHub Pages sub-folder):
//   #/                    home
//   #/new                 new inspection
//   #/settings
//   #/i/:id               inspection (room list)
//   #/i/:id/setup         edit details
//   #/i/:id/r/:roomId     room checklist / keys / meters
function App() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => {
      setHash(location.hash);
      scrollTo(0, 0);
    };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);

  const p = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (p[0] === 'new') return html`<${NewInspection} />`;
  if (p[0] === 'settings') return html`<${Settings} />`;
  if (p[0] === 'i' && p[1]) {
    if (p[2] === 'setup') return html`<${EditSetup} id=${p[1]} key=${p[1]} />`;
    if (p[2] === 'r' && p[3]) return html`<${Room} id=${p[1]} rid=${p[3]} key=${p[3]} />`;
    return html`<${Inspection} id=${p[1]} key=${p[1]} />`;
  }
  return html`<${Home} />`;
}

const root = document.getElementById('app');
root.textContent = ''; // drop the static "Loading…" placeholder before Preact takes over
render(html`<${App} />`, root);

if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker failed:', e));
  });
}
