// Weltlabor – Oberfläche: Optionen einsammeln, Welt erzeugen lassen (Worker oder Hauptthread), Karte zeichnen.
import { PRESETS, aufloesen, mitAbfragen, FLAG } from '../../engine/world/worldgen/worldgen.js';

const $ = (id) => document.getElementById(id);
const leinwand = $('karte'), ctx = leinwand.getContext('2d');
const basis = document.createElement('canvas'), bctx = basis.getContext('2d');

// Regler: id → [Pfad in den Optionen, min, max, schritt]
const REGLER = {
  gebirge: [['hoehe', 'gebirge', 'menge'], 0, 1, 0.05, '⛰️ Gebirge'],
  kueste: [['form', 'kuestenRauschen'], 0, 1, 0.05, '🏝️ Küstenform'],
  erosion: [['erosion', 'staerke'], 0, 2, 0.1, '💧 Erosion'],
  fluesse: [['wasser', 'flussMenge'], 0.05, 2, 0.05, '🌊 Flüsse'],
  temperatur: [['klima', 'temperatur'], 0, 1, 0.02, '🌡️ Temperatur'],
  feuchte: [['klima', 'feuchte'], 0, 1, 0.02, '🌧️ Feuchte'],
  wind: [['klima', 'wind'], 0, 359, 1, '🧭 Wind (°)'],
  dichte: [['objekte', 'dichte'], 0, 2, 0.1, '🌲 Objektdichte'],
};
const EBENEN = ['biome', 'hoehe', 'feuchte', 'temperatur', 'schatten', 'fluesse', 'objekte', 'orte'];
const OBJ_FARBE = { baum: '#1d4a22', busch: '#4d7a32', fels: '#6e6e6e', kaktus: '#2f8a5a', schilf: '#a8a46a', blume: '#e6a8d8', totholz: '#6b4a2f', unterholz: '#3f6a2c', geroell: '#8a857a', seerose: '#7fbf6a', bodendecker: '#7a9a4a' };

let welt = null, worker = null, auftragNr = 0, wartend = null;

const holen = (o, pfad) => pfad.reduce((a, k) => (a == null ? a : a[k]), o);
function setzen(o, pfad, v) { let a = o; for (const k of pfad.slice(0, -1)) a = a[k] ??= {}; a[pfad[pfad.length - 1]] = v; }

function baueOberflaeche() {
  const sel = $('preset');
  for (const [key, p] of Object.entries(PRESETS)) sel.add(new Option(p.name || key, key));
  const box = $('regler');
  for (const [id, [, min, max, st, text]] of Object.entries(REGLER)) {
    const l = document.createElement('label');
    l.innerHTML = `<span>${text}</span><input type="range" id="r-${id}" min="${min}" max="${max}" step="${st}"><output id="o-${id}"></output>`;
    box.appendChild(l);
    const r = l.querySelector('input');
    r.addEventListener('input', () => { $('o-' + id).textContent = r.value; });
    r.addEventListener('change', erzeugen);
  }
  sel.addEventListener('change', () => { reglerAusPreset(); erzeugen(); });
  for (const id of ['groesse', 'qualitaet', 'modus']) $(id).addEventListener('change', erzeugen);
  $('seed').addEventListener('change', erzeugen);
  $('wuerfeln').addEventListener('click', () => { $('seed').value = Math.floor(Math.random() * 1e6); erzeugen(); });
  $('neu').addEventListener('click', erzeugen);
  for (const e of EBENEN) $('e-' + e).addEventListener('change', zeichnen);
  leinwand.addEventListener('pointermove', zeigeInfo);
  leinwand.addEventListener('pointerdown', zeigeInfo);
  window.addEventListener('resize', zeichnen);
  reglerAusPreset();
}

function reglerAusPreset() {
  const o = aufloesen({ preset: $('preset').value });
  for (const [id, [pfad]] of Object.entries(REGLER)) {
    const v = holen(o, pfad) ?? 0;
    $('r-' + id).value = v; $('o-' + id).textContent = v;
  }
}

function sammleOptionen() {
  const g = +$('groesse').value;
  const o = { preset: $('preset').value, seed: +$('seed').value || 1, breite: g, tiefe: g, qualitaet: $('qualitaet').value };
  for (const [id, [pfad]] of Object.entries(REGLER)) setzen(o, pfad, +$('r-' + id).value);
  return o;
}

function starteWorker() {
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      if (e.data.bereit) return;
      if (e.data.id !== auftragNr) return; // veraltet
      if (e.data.fehler) { zeigeFehler(e.data.fehler); return; }
      fertig(e.data.daten, 'Worker');
    };
    worker.onerror = (e) => { console.warn('Worker nicht nutzbar, nutze Hauptthread', e.message); e.preventDefault(); worker = null; if (wartend) erzeugen(); };
  } catch (err) { worker = null; }
}

async function erzeugen() {
  const auftrag = { modus: $('modus').value, optionen: sammleOptionen(), chunkGroesse: 64 };
  wartend = auftrag;
  const nr = ++auftragNr;
  $('status').textContent = '⏳ erzeuge …';
  if (worker) { worker.postMessage({ id: nr, auftrag }); return; }
  const { erzeuge } = await import('./erzeuge.js');
  await new Promise(r => setTimeout(r, 16));
  try { fertig(erzeuge(auftrag).daten, 'Hauptthread'); } catch (err) { zeigeFehler(err.stack || err); }
}

function zeigeFehler(text) { $('status').textContent = '❌ Fehler'; $('zeiten').textContent = text; console.error(text); }

function fertig(daten, wo) {
  wartend = null;
  welt = mitAbfragen(daten);
  const z = welt.zeiten;
  $('status').textContent = `✅ ${welt.breite}×${welt.tiefe} in ${z.gesamt} ms (${wo})`;
  $('zeiten').textContent = Object.entries(z).filter(([k]) => k !== 'gesamt').map(([k, v]) => `${k}: ${v} ms`).join(' · ');
  $('zahlen').textContent = `Flüsse: ${welt.fluesse.length} · Seen: ${welt.seen.length} · Objekte: ${welt.objekte ? welt.objekte.anzahl : 0}` +
    (welt.orte.doerfer.length ? ` · Dörfer: ${welt.orte.doerfer.length}` : '') + (welt.orte.poi.length ? ` · Orte: ${welt.orte.poi.length}` : '');
  legende();
  zeichnen();
}

// ---------- Zeichnen ----------
const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
function verlauf(stops, t) {
  t = Math.max(0, Math.min(1, t));
  for (let k = 1; k < stops.length; k++) if (t <= stops[k][0]) {
    const [t0, a] = stops[k - 1], [t1, b] = stops[k], f = (t - t0) / (t1 - t0 || 1);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }
  return stops[stops.length - 1][1];
}
const V_HOEHE = [[0, [70, 130, 70]], [0.25, [150, 170, 90]], [0.5, [190, 160, 100]], [0.75, [140, 110, 90]], [1, [245, 245, 245]]];
const V_FEUCHTE = [[0, [170, 110, 50]], [0.4, [220, 210, 120]], [0.7, [80, 170, 90]], [1, [40, 90, 200]]];
const V_TEMP = [[0, [60, 80, 220]], [0.4, [120, 200, 220]], [0.6, [240, 220, 100]], [1, [220, 60, 40]]];

function baueBasis() {
  const { breite: b, tiefe: t, hoehe: H, flags: FL, biom: BI, biome, feuchte: M, temperatur: T } = welt;
  const an = Object.fromEntries(EBENEN.map(e => [e, $('e-' + e).checked]));
  basis.width = b; basis.height = t;
  const img = bctx.createImageData(b, t), d = img.data;
  const farben = biome.map(bm => rgb(bm.farbe));
  let maxH = 0.01;
  for (let i = 0; i < H.length; i++) if (H[i] > maxH) maxH = H[i];
  const k = (Math.max(b, t) / 256) * 3 / maxH;
  for (let y = 0; y < t; y++) for (let x = 0; x < b; x++) {
    const i = y * b + x, h = H[i], wasser = FL[i] & 7;
    let r = 0, g = 0, bl = 0, n = 0;
    const add = (c) => { r += c[0]; g += c[1]; bl += c[2]; n++; };
    if (an.biome) add(farben[BI[i]]);
    if (an.hoehe) add(wasser ? verlauf([[0, [20, 40, 90]], [1, [90, 150, 210]]], 1 + h / (maxH * 0.6)) : verlauf(V_HOEHE, h / maxH));
    if (an.feuchte) add(verlauf(V_FEUCHTE, M[i]));
    if (an.temperatur) add(verlauf(V_TEMP, T[i]));
    if (!n) add(wasser ? [60, 110, 170] : [200, 200, 190]);
    r /= n; g /= n; bl /= n;
    if (an.schatten && !(FL[i] & (FLAG.OZEAN | FLAG.SEE))) {
      const hx = H[i + (x < b - 1 ? 1 : 0)] - H[i - (x > 0 ? 1 : 0)], hy = H[i + (y < t - 1 ? b : 0)] - H[i - (y > 0 ? b : 0)];
      const s = Math.max(0.45, Math.min(1.5, 1 - (hx + hy) * k));
      r *= s; g *= s; bl *= s;
    } else if (an.biome && FL[i] & FLAG.OZEAN) { const s = Math.max(0.65, 1 + h * 0.6); r *= s; g *= s; bl *= s; }
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = bl; d[i * 4 + 3] = 255;
  }
  bctx.putImageData(img, 0, 0);
  return an;
}

function zeichnen() {
  if (!welt) return;
  const an = baueBasis();
  const px = Math.min(leinwand.parentElement.clientWidth, 900) * (window.devicePixelRatio || 1);
  leinwand.width = leinwand.height = Math.round(px);
  const s = leinwand.width / welt.breite;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(basis, 0, 0, leinwand.width, leinwand.height);
  ctx.save(); ctx.scale(s, s);
  if (an.fluesse) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(70,140,215,0.95)';
    for (const f of welt.fluesse) {
      const P = f.punkte, B = f.breite;
      for (let k = 2; k < P.length; k += 2) {
        ctx.lineWidth = Math.max(0.6, B[k / 2] * 0.9);
        ctx.beginPath(); ctx.moveTo(P[k - 2], P[k - 1]); ctx.lineTo(P[k], P[k + 1]); ctx.stroke();
      }
    }
  }
  if (an.objekte && welt.objekte) {
    const o = welt.objekte, r = Math.max(0.35, 1.2 / s);
    for (let i = 0; i < o.anzahl; i++) {
      ctx.fillStyle = OBJ_FARBE[o.arten[o.art[i]]] || '#222';
      ctx.fillRect(o.x[i] - r * o.skala[i], o.y[i] - r * o.skala[i], 2 * r * o.skala[i], 2 * r * o.skala[i]);
    }
  }
  ctx.restore();
  if (an.orte) zeichneOrte(s);
}

function zeichneOrte(s) {
  const { start, doerfer, poi } = welt.orte;
  ctx.font = `${Math.round(14 * (window.devicePixelRatio || 1))}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const zeichen = (x, y, txt) => { ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3; ctx.strokeText(txt, x * s, y * s); ctx.fillText(txt, x * s, y * s); };
  ctx.fillStyle = '#fff';
  for (const p of poi) if (p.art === 'gipfel') zeichen(p.x, p.y, '▲');
  for (const d of doerfer) zeichen(d.x, d.y, '🏘');
  if (start) {
    ctx.strokeStyle = '#ff3030'; ctx.lineWidth = 2 * (window.devicePixelRatio || 1);
    ctx.beginPath(); ctx.arc(start.x * s, start.y * s, Math.max(6, start.radius * s), 0, Math.PI * 2); ctx.stroke();
    zeichen(start.x, start.y, '🚩');
  }
}

function legende() {
  const zaehl = new Uint32Array(welt.biome.length);
  for (let i = 0; i < welt.biom.length; i++) zaehl[welt.biom[i]]++;
  const n = welt.biom.length;
  $('legende').innerHTML = welt.biome.map((bm, id) => ({ bm, a: zaehl[id] / n })).filter(e => e.a > 0.001).sort((p, q) => q.a - p.a)
    .map(({ bm, a }) => `<span><i style="background:#${bm.farbe.toString(16).padStart(6, '0')}"></i>${bm.name} ${(a * 100).toFixed(0)}%</span>`).join('');
}

function zeigeInfo(e) {
  if (!welt) return;
  const r = leinwand.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * welt.breite, y = ((e.clientY - r.top) / r.height) * welt.tiefe;
  if (x < 0 || y < 0 || x >= welt.breite || y >= welt.tiefe) return;
  const i = Math.floor(y) * welt.breite + Math.floor(x), f = welt.flags[i];
  const wasser = f & FLAG.OZEAN ? 'Meer' : f & FLAG.SEE ? 'See' : f & FLAG.FLUSS ? 'Fluss' : '';
  $('info').textContent = `(${x | 0}, ${y | 0}) ${welt.biome[welt.biom[i]].name} · Höhe ${welt.heightAt(x, y).toFixed(3)} · Temp ${welt.temperatur[i].toFixed(2)} · Feuchte ${welt.feuchte[i].toFixed(2)}${wasser ? ' · ' + wasser : ''}`;
}

baueOberflaeche();
starteWorker();
erzeugen();
