// Synthetic "photos" for the demo apartment, drawn with canvas. Obviously fake (labelled), but they
// go through the same resize / timestamp / hash pipeline as real camera photos.

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wall(c, w, h, col) {
  c.fillStyle = col;
  c.fillRect(0, 0, w, h);
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,.18)');
  g.addColorStop(1, 'rgba(0,0,0,.14)');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}

function speckle(c, w, h, r, n, col) {
  c.fillStyle = col;
  for (let i = 0; i < n; i++) c.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3);
}

function blob(c, x, y, rad, rgb, alpha) {
  const g = c.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, `rgba(${rgb},${alpha})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, rad, 0, Math.PI * 2);
  c.fill();
}

const rrect = (c, x, y, w, h, rad) => {
  c.beginPath();
  c.moveTo(x + rad, y);
  c.arcTo(x + w, y, x + w, y + h, rad);
  c.arcTo(x + w, y + h, x, y + h, rad);
  c.arcTo(x, y + h, x, y, rad);
  c.arcTo(x, y, x + w, y, rad);
  c.closePath();
};

const SCENES = {
  damp(c, w, h, r) {
    wall(c, w, h, '#ebe6d9');
    c.fillStyle = '#f7f4ec';
    c.fillRect(0, 0, w, h * 0.1);
    for (let i = 0; i < 16; i++) blob(c, w * (0.15 + r() * 0.4), h * (0.12 + r() * 0.35), 70 + r() * 150, '150,108,50', 0.1 + r() * 0.12);
    blob(c, w * 0.3, h * 0.28, w * 0.28, '110,78,36', 0.28);
    speckle(c, w, h, r, 500, 'rgba(0,0,0,.05)');
  },
  screen(c, w, h, r) {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#a5d3f2');
    g.addColorStop(1, '#6aa56a');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(55,55,55,.5)';
    c.lineWidth = 1;
    for (let x = 0; x < w; x += 9) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let y = 0; y < h; y += 9) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    const pts = [];
    for (let i = 0; i < 9; i++) pts.push([w * (0.35 + 0.3 * Math.sin(i * 0.7) * 0.5 + r() * 0.06), h * (0.2 + i * 0.08)]);
    c.save();
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    for (let i = pts.length - 1; i >= 0; i--) c.lineTo(pts[i][0] + 90 + r() * 80, pts[i][1] + 20);
    c.closePath();
    c.clip();
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.restore();
    c.strokeStyle = '#dcdcd6';
    c.lineWidth = 70;
    c.strokeRect(35, 35, w - 70, h - 70);
  },
  scratch(c, w, h, r) {
    c.fillStyle = '#9a6a3d';
    c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 140) {
      c.fillStyle = `hsl(28,${35 + r() * 10}%,${36 + r() * 10}%)`;
      c.fillRect(0, y, w, 136);
      for (let x = r() * 300; x < w; x += 300 + r() * 300) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x, y, 3, 136); }
    }
    c.strokeStyle = 'rgba(245,225,190,.9)';
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(w * 0.12, h * 0.7);
    for (let i = 1; i <= 12; i++) c.lineTo(w * (0.12 + i * 0.07), h * (0.7 - i * 0.035) + (r() - 0.5) * 12);
    c.stroke();
  },
  ac(c, w, h, r, o) {
    wall(c, w, h, '#e7e3d8');
    c.fillStyle = '#fafafa';
    rrect(c, w * 0.1, h * 0.12, w * 0.8, h * 0.28, 30);
    c.fill();
    c.strokeStyle = '#c9c9c9';
    c.lineWidth = 3;
    c.stroke();
    c.fillStyle = '#d8d8d8';
    for (let i = 0; i < 4; i++) c.fillRect(w * 0.14, h * (0.3 + i * 0.016), w * 0.72, 6);
    c.fillStyle = '#4a7';
    c.beginPath();
    c.arc(w * 0.82, h * 0.18, 8, 0, 7);
    c.fill();
    if (o.drip) {
      blob(c, w * 0.5, h * 0.62, w * 0.22, '70,110,150', 0.35);
      c.fillStyle = 'rgba(90,150,210,.8)';
      for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(w * (0.4 + i * 0.07), h * (0.45 + i * 0.07), 9, 15, 0, 0, 7); c.fill(); }
    }
  },
  outlet(c, w, h, r) {
    wall(c, w, h, '#e9e4d6');
    c.fillStyle = '#f8f8f6';
    rrect(c, w * 0.32, h * 0.3, w * 0.36, w * 0.36, 28);
    c.fill();
    c.strokeStyle = '#cfcfcc';
    c.lineWidth = 4;
    c.stroke();
    c.fillStyle = '#2a2a2a';
    [[0.44, 0.44], [0.56, 0.44], [0.5, 0.55]].forEach(([x, y]) => { c.beginPath(); c.arc(w * x, h * y + 40, 15, 0, 7); c.fill(); });
    blob(c, w * 0.5, h * 0.44, 90, '30,20,10', 0.55);
    c.fillStyle = '#999';
    c.beginPath(); c.arc(w * 0.5, h * 0.34, 9, 0, 7); c.fill();
  },
  leak(c, w, h, r) {
    wall(c, w, h, '#cdb591');
    c.fillStyle = '#7d8084';
    c.fillRect(w * 0.45, 0, 46, h * 0.5);
    c.lineWidth = 46;
    c.strokeStyle = '#7d8084';
    c.beginPath(); c.moveTo(w * 0.45 + 23, h * 0.5); c.bezierCurveTo(w * 0.45, h * 0.85, w * 0.8, h * 0.85, w * 0.72, h * 0.55); c.stroke();
    blob(c, w * 0.52, h * 0.82, w * 0.25, '40,60,80', 0.4);
    c.fillStyle = 'rgba(100,170,230,.85)';
    for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(w * (0.5 + r() * 0.1), h * (0.62 + i * 0.06), 10, 17, 0, 0, 7); c.fill(); }
  },
  stove(c, w, h, r) {
    c.fillStyle = '#1d1f21';
    c.fillRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(255,255,255,.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]].forEach(([x, y], i) => {
      for (let k = 0; k < 3; k++) {
        c.strokeStyle = `rgba(190,190,190,${0.8 - k * 0.2})`;
        c.lineWidth = 8;
        c.beginPath(); c.arc(w * x, h * y, 110 - k * 32, 0, 7); c.stroke();
      }
      if (i !== 0) { c.fillStyle = '#5cf'; c.beginPath(); c.arc(w * x, h * y, 14, 0, 7); c.fill(); }
    });
  },
  drain(c, w, h, r) {
    c.fillStyle = '#d9d6cc';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#a6a39a';
    c.lineWidth = 4;
    for (let x = 0; x < w; x += 200) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let y = 0; y < h; y += 200) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    blob(c, w / 2, h / 2, w * 0.3, '80,120,160', 0.5);
    c.fillStyle = '#8d9094';
    c.beginPath(); c.arc(w / 2, h / 2, 130, 0, 7); c.fill();
    c.fillStyle = '#3a3c3f';
    for (let a = 0; a < 6; a++) for (let rr = 40; rr < 120; rr += 40) { c.beginPath(); c.arc(w / 2 + Math.cos(a * 1.05) * rr, h / 2 + Math.sin(a * 1.05) * rr, 9, 0, 7); c.fill(); }
  },
  termite(c, w, h, r) {
    wall(c, w, h, '#e6e1d3');
    const g = c.createLinearGradient(w * 0.35, 0, w * 0.65, 0);
    g.addColorStop(0, '#7a5230'); g.addColorStop(0.5, '#9a6c42'); g.addColorStop(1, '#6e4a2b');
    c.fillStyle = g;
    c.fillRect(w * 0.35, 0, w * 0.3, h);
    c.fillStyle = 'rgba(30,15,5,.85)';
    for (let i = 0; i < 26; i++) { c.beginPath(); c.arc(w * (0.4 + r() * 0.2), h * (0.45 + r() * 0.4), 3 + r() * 5, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(232,210,170,.95)';
    for (let i = 0; i < 400; i++) c.fillRect(w * (0.36 + r() * 0.28), h * (0.9 + r() * 0.08), 3, 3);
  },
  shower(c, w, h, r) {
    c.fillStyle = '#d6e3e4';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#a9bcbe';
    c.lineWidth = 3;
    for (let x = 0; x < w; x += 110) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let y = 0; y < h; y += 110) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.fillStyle = '#b9bcc0';
    rrect(c, w * 0.3, h * 0.12, w * 0.4, 70, 30); c.fill();
    c.fillStyle = '#9a9da1';
    c.fillRect(w * 0.47, 0, 30, h * 0.14);
    c.fillStyle = '#eee';
    rrect(c, w * 0.34, h * 0.28, w * 0.32, h * 0.1, 20); c.fill();
    c.fillStyle = '#666';
    c.fillRect(w * 0.4, h * 0.32, w * 0.2, 14);
  },
  mold(c, w, h, r) {
    wall(c, w, h, '#f1efe8');
    for (let k = 0; k < 9; k++) {
      const cx = w * (0.15 + r() * 0.7);
      const cy = h * (0.15 + r() * 0.6);
      for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(${20 + r() * 40},${30 + r() * 30},${20 + r() * 20},${0.3 + r() * 0.5})`; c.beginPath(); c.arc(cx + (r() - 0.5) * 220, cy + (r() - 0.5) * 160, 2 + r() * 6, 0, 7); c.fill(); }
    }
  },
  rust(c, w, h, r) {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#a5d3f2'); g.addColorStop(1, '#d8c9a5');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 3; i++) { c.fillStyle = '#6d7075'; c.fillRect(0, h * (0.25 + i * 0.22), w, 52); }
    c.fillStyle = '#6d7075';
    for (let x = 80; x < w; x += 360) c.fillRect(x, 0, 46, h);
    for (let i = 0; i < 700; i++) { c.fillStyle = `rgba(${150 + r() * 60},${70 + r() * 30},20,${0.4 + r() * 0.5})`; c.fillRect(80 + r() * 90, r() * h, 3 + r() * 8, 3 + r() * 8); }
  },
  meter(c, w, h, r, o) {
    wall(c, w, h, '#555a5e');
    c.fillStyle = '#2a2d30';
    rrect(c, w * 0.1, h * 0.2, w * 0.8, h * 0.6, 40); c.fill();
    c.fillStyle = '#d4e8c8';
    rrect(c, w * 0.18, h * 0.35, w * 0.64, h * 0.22, 14); c.fill();
    c.fillStyle = '#1c2a18';
    c.font = `700 ${Math.round(h * 0.17)}px "Courier New", monospace`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(o.text, w / 2, h * 0.46);
    c.fillStyle = '#ddd';
    c.font = `600 ${Math.round(h * 0.05)}px sans-serif`;
    c.fillText(o.unit, w * 0.5, h * 0.68);
  },
  keys(c, w, h, r) {
    wall(c, w, h, '#4a3a2c');
    speckle(c, w, h, r, 300, 'rgba(255,255,255,.05)');
    [[0.25, 0.4], [0.5, 0.55], [0.72, 0.38]].forEach(([x, y]) => {
      c.fillStyle = '#c9b037';
      c.beginPath(); c.arc(w * x, h * y, 62, 0, 7); c.fill();
      c.fillStyle = '#4a3a2c';
      c.beginPath(); c.arc(w * x, h * y, 20, 0, 7); c.fill();
      c.fillStyle = '#c9b037';
      c.fillRect(w * x + 50, h * y - 14, 230, 28);
      for (let i = 0; i < 4; i++) c.fillRect(w * x + 150 + i * 30, h * y + 14, 14, 24);
    });
    c.fillStyle = '#222';
    rrect(c, w * 0.12, h * 0.68, 200, 100, 24); c.fill();
    c.fillStyle = '#e6e6e6';
    rrect(c, w * 0.55, h * 0.72, 260, 160, 16); c.fill();
  },
};

// opts: { portrait, seed, drip, text, unit }
export function drawDemoScene(kind, opts = {}) {
  const [w, h] = opts.portrait ? [1200, 1600] : [1600, 1200];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  (SCENES[kind] || SCENES.damp)(c, w, h, seeded((opts.seed || 1) * 7919 + kind.length), opts);
  c.font = '600 28px -apple-system, Helvetica, Arial, sans-serif';
  c.textAlign = 'left';
  c.textBaseline = 'top';
  c.fillStyle = 'rgba(0,0,0,.55)';
  c.fillRect(16, 16, 330, 44);
  c.fillStyle = '#fff';
  c.fillText('DEMO · foto fictícia', 28, 24);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => {
      canvas.width = canvas.height = 0;
      b ? resolve(b) : reject(new Error('Could not draw demo photo'));
    }, 'image/jpeg', 0.9)
  );
}
