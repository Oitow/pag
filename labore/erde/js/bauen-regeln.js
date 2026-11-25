// Bauen – reine Regeln (ohne THREE): Raster, Einrasten, Kosten, Statik, Abriss-Rückgabe, begehbare Flächen.
// Alles in LOKALEN Koordinaten eines Bauplatzes (Tangentenrahmen auf der Kugel): x rechts, y oben, z vorn, Meter.
// Raster 2 m: Zellmitten bei 2i, Kanten bei 2i ± 1. Ein Teil = { id, art, x, y, z, rot } (rot 0…3 = 90°-Schritte um y).
// Bezugspunkt („Ebene“) je Teil: Fundament/Boden = Oberkante, alle anderen = Unterkante. Wandhöhe 2,4 m → Stockwerke 2,4 m.

export const RASTER = 2, WAND_H = 2.4, DACH_HUB = 1.5, FUND_TIEFE = 2;
const EPS = 0.05;

// box = [x0, x1, y0, y1, z0, z1] im Teil-Rahmen (vor der Drehung). platz: zelle | kante | frei
export const TEILE = {
  fundament: { name: 'Fundament', platz: 'zelle', kosten: { steine: 6 }, box: [-1, 1, -FUND_TIEFE, 0, -1, 1], begehbar: true },
  boden: { name: 'Boden', platz: 'zelle', kosten: { holz: 4 }, box: [-1, 1, -0.2, 0, -1, 1], begehbar: true },
  wand: { name: 'Wand', platz: 'kante', kosten: { holz: 4 }, box: [-1, 1, 0, WAND_H, -0.1, 0.1] },
  tuerwand: { name: 'Wand mit Tür', platz: 'kante', kosten: { holz: 3 }, box: [-1, 1, 0, WAND_H, -0.1, 0.1], tuer: 0.55 },
  eisentuer: { name: 'Verstärkte Tür', platz: 'kante', kosten: { holz: 4, naegel: 6, eisenbarren: 1 }, box: [-1, 1, 0, WAND_H, -0.1, 0.1], tuer: 0.55 },
  dach: { name: 'Dach', platz: 'zelle', kosten: { holz: 2, fasern: 3 }, box: [-1, 1, 0, DACH_HUB, -1, 1], dach: true },
  treppe: { name: 'Treppe', platz: 'zelle', kosten: { holz: 4 }, box: [-1, 1, 0, WAND_H, -1, 1], begehbar: true, rampe: true },
  lagerfeuer: { name: 'Lagerfeuer', platz: 'frei', kosten: { steine: 5, holz: 3 }, box: [-0.65, 0.65, 0, 0.5, -0.65, 0.65], station: true },
  werkbank: { name: 'Werkbank', platz: 'frei', kosten: { holz: 6, steine: 2 }, box: [-0.8, 0.8, 0, 0.95, -0.4, 0.4], station: true },
  // Fortschritt Kupfer/Eisen: Schmelzofen (Erz → Barren, glüht = Feuer wie das Lagerfeuer) und Steinamboss (Metall-Werkzeug)
  schmelzofen: { name: 'Schmelzofen', platz: 'frei', kosten: { steine: 12, lehm: 4 }, box: [-0.6, 0.6, 0, 1.8, -0.6, 0.6], station: true },
  amboss: { name: 'Amboss', platz: 'frei', kosten: { steine: 6, holz: 2 }, box: [-0.45, 0.45, 0, 0.75, -0.3, 0.3], station: true },
};
export const ARTEN = Object.keys(TEILE);
const MAX_MIT_FUNDAMENT = 8, MAX_OHNE = 3;

const COS = [1, 0, -1, 0], SIN = [0, 1, 0, -1];
/** Vektor (x, z) aus dem Teil-Rahmen in den Platz-Rahmen drehen (wie THREE rotation.y = rot·90°). */
export function dreh(x, z, rot) { const r = ((rot % 4) + 4) % 4; return [x * COS[r] + z * SIN[r], -x * SIN[r] + z * COS[r]]; }
/** Umkehrung von dreh. */
export const zurueck = (x, z, rot) => dreh(x, z, 4 - (((rot % 4) + 4) % 4));

/** Blickrichtung (vx, vz) im Platz-Rahmen → rot, so dass +z des Teils möglichst in Blickrichtung zeigt. */
export function ausrichtung(vx, vz) { return ((Math.round(Math.atan2(vx, vz) / (Math.PI / 2)) % 4) + 4) % 4; }

/** Achsparallele Hülle eines Teils im Platz-Rahmen → [x0,x1,y0,y1,z0,z1]. */
export function huelle(t) {
  const b = TEILE[t.art].box;
  const [ax, az] = dreh(b[0], b[4], t.rot), [bx, bz] = dreh(b[1], b[5], t.rot);
  return [t.x + Math.min(ax, bx), t.x + Math.max(ax, bx), t.y + b[2], t.y + b[3], t.z + Math.min(az, bz), t.z + Math.max(az, bz)];
}
const beruehrt = (a, b, e = EPS) => a[0] <= b[1] + e && b[0] <= a[1] + e && a[2] <= b[3] + e && b[2] <= a[3] + e && a[4] <= b[5] + e && b[4] <= a[5] + e;
const waagBeruehrt = (a, b, e = EPS) => a[0] <= b[1] + e && b[0] <= a[1] + e && a[4] <= b[5] + e && b[4] <= a[5] + e;
/** Echte Überschneidung (mehr als 15 cm in jeder Achse) – Berühren und leichtes Einlassen (Wand ins Fundament) sind erlaubt. */
function ueberlappt(a, b) {
  return Math.min(a[1], b[1]) - Math.max(a[0], b[0]) > 0.15 && Math.min(a[3], b[3]) - Math.max(a[2], b[2]) > 0.15 &&
    Math.min(a[5], b[5]) - Math.max(a[4], b[4]) > 0.15;
}

// Ebenen, die ein Teil Nachbarn anbietet (anschließen daneben / daraufsetzen)
function angebote(t) {
  const a = t.art;
  if (a === 'fundament' || a === 'boden') return [t.y];
  if (a === 'wand' || a === 'tuerwand' || a === 'eisentuer' || a === 'treppe') return [t.y, t.y + WAND_H];
  if (a === 'dach') return [t.y, t.y + DACH_HUB];
  return [];
}

function rasterLage(art, ax, az, rot) {
  const p = TEILE[art].platz, q = (v) => Math.round(v / RASTER) * RASTER + 0;   // + 0: kein −0
  if (p === 'zelle') return [q(ax), q(az)];
  if (p === 'kante') return rot % 2 === 0 ? [q(ax), q(az - 1) + 1] : [q(ax - 1) + 1, q(az)];
  return [ax, az];
}

/** Bodenhöhe für ein Teil direkt auf dem Gelände (boden(x, z) → lokale Höhe). */
function gelaendeY(art, x, z, rot, boden) {
  const b = TEILE[art].box, ecken = [[b[0], b[4]], [b[1], b[4]], [b[0], b[5]], [b[1], b[5]]].map(([u, v]) => { const [dx, dz] = dreh(u, v, rot); return boden(x + dx, z + dz); });
  const mitte = boden(x, z), hoch = Math.max(mitte, ...ecken), tief = Math.min(mitte, ...ecken);
  if (art === 'fundament') return hoch + 0.12;
  if (art === 'boden') return hoch + 0.05;
  return art === 'lagerfeuer' ? mitte - 0.04 : tief - 0.03;
}

/**
 * Teil am Zielpunkt (ax, az) einrasten. Ebene: Angebote naher Teile oder Gelände, die nächste zu wunschY
 * (Blick heben = höher bauen); Gelände zählt 0,5 m schlechter, Ebenen mit Überschneidung fallen weg.
 * → { art, x, y, z, rot, aufGelaende }
 */
export function einrasten(art, ax, az, rot, teile, { boden = () => 0, wunschY = -Infinity } = {}) {
  const [x, z] = rasterLage(art, ax, az, rot);
  const probe = { art, x, y: 0, z, rot }, h0 = huelle(probe);
  const kand = [];
  for (const t of teile) {
    if (!waagBeruehrt(h0, huelle(t))) continue;
    for (const y of angebote(t)) if (!kand.some((k) => !k.g && Math.abs(k.y - y) < 0.01)) kand.push({ y, g: false });
  }
  kand.push({ y: gelaendeY(art, x, z, rot, boden), g: true });
  let best = null, bestW = Infinity;
  for (const k of kand) {
    const frei = !teile.some((t) => ueberlappt(huelle({ ...probe, y: k.y }), huelle(t)));
    const w = Math.abs(k.y - (Number.isFinite(wunschY) ? wunschY : k.y)) + (k.g ? 0.5 : 0) + (frei ? 0 : 100) + (Number.isFinite(wunschY) ? 0 : k.y * 1e-3);
    if (w < bestW) { bestW = w; best = k; }
  }
  return { art, x, z, rot, y: best.y, aufGelaende: best.g };
}

/** Statik aller Teile: Map id → { f, g } (Stufen über Fundament / über Gelände; Infinity = ohne Halt). */
export function statik(teile, boden = () => 0) {
  const n = teile.length, H = teile.map(huelle), f = new Array(n).fill(Infinity), g = new Array(n).fill(Infinity);
  const traeger = teile.map(() => []);
  for (let i = 0; i < n; i++) {
    const t = teile[i];
    if (H[i][2] <= boden(t.x, t.z) + 0.3) { g[i] = t.art === 'fundament' ? 0 : 1; if (t.art === 'fundament') f[i] = 0; }
    for (let j = 0; j < n; j++) {
      if (i === j || !beruehrt(H[i], H[j])) continue;
      const seit = Math.abs(H[j][2] - H[i][2]) < 0.01 && (t.art === 'boden' || t.art === 'dach') && teile[j].art === t.art;
      if (H[j][2] < H[i][2] - 0.01 || seit) traeger[i].push(j);
    }
  }
  for (let runde = 0, neu = true; neu && runde < n + 2; runde++) {
    neu = false;
    for (let i = 0; i < n; i++) for (const j of traeger[i]) {
      if (f[j] + 1 < f[i]) { f[i] = f[j] + 1; neu = true; }
      if (g[j] + 1 < g[i]) { g[i] = g[j] + 1; neu = true; }
    }
  }
  const m = new Map();
  teile.forEach((t, i) => m.set(t.id, { f: f[i], g: g[i], ok: f[i] <= MAX_MIT_FUNDAMENT || g[i] <= MAX_OHNE }));
  return m;
}

/** Kann das Teil hier stehen? → { ok, grund } (Überschneidung, Halt, Gelände). Kosten prüft bauen.js. */
export function pruefe(neu, teile, boden = () => 0) {
  const h = huelle(neu);
  if (teile.some((t) => ueberlappt(h, huelle(t)))) return { ok: false, grund: 'Platz belegt' };
  if (neu.art === 'fundament') {
    let tief = Infinity, hoch = -Infinity;
    for (const [u, v] of [[h[0], h[4]], [h[1], h[4]], [h[0], h[5]], [h[1], h[5]], [neu.x, neu.z]]) { const b = boden(u, v); tief = Math.min(tief, b); hoch = Math.max(hoch, b); }
    if (neu.y - tief > FUND_TIEFE - 0.15) return { ok: false, grund: 'zu steil – Fundament schwebt' };
    if (hoch - neu.y > 1.2) return { ok: false, grund: 'zu tief im Hang' };
  }
  const s = statik([...teile, { ...neu, id: '_neu' }], boden).get('_neu');
  if (!s.ok) return { ok: false, grund: Number.isFinite(s.g) ? 'zu hoch ohne Fundament' : 'kein Halt' };
  return { ok: true, grund: '' };
}

/** Abreißen: Teil weg; was danach keinen Halt mehr hat, fällt mit. Rückgabe = halbe Kosten (abgerundet) aller Teile. */
export function abriss(teile, id, boden = () => 0) {
  const rest = teile.filter((t) => t.id !== id);
  const weg = teile.filter((t) => t.id === id).map((t) => t.id);
  if (!weg.length) return { weg: [], zurueck: {}, rest: teile };
  const s = statik(rest, boden);
  for (const t of rest) if (!s.get(t.id).ok) weg.push(t.id);
  const zurueck = {};
  for (const t of teile) if (weg.includes(t.id)) for (const [k, n] of Object.entries(TEILE[t.art].kosten)) zurueck[k] = (zurueck[k] || 0) + Math.floor(n / 2);
  return { weg, zurueck, rest: teile.filter((t) => !weg.includes(t.id)) };
}

/** Höchste begehbare Oberseite unter (x, z) mit Höhe ≤ maxY (Treppe als Rampe) → y oder null. */
export function oberflaeche(teile, x, z, maxY) {
  let best = null;
  for (const t of teile) {
    const T = TEILE[t.art];
    if (!T.begehbar) continue;
    const [u, v] = zurueck(x - t.x, z - t.z, t.rot), b = T.box;
    if (u < b[0] - 0.15 || u > b[1] + 0.15 || v < b[4] - 0.15 || v > b[5] + 0.15) continue;
    const y = T.rampe ? t.y + WAND_H * Math.min(1, Math.max(0, (v - b[4]) / (b[5] - b[4]))) : t.y;
    if (y <= maxY && (best === null || y > best)) best = y;
  }
  return best;
}

/** Dachhöhe über (x, z) (Unterseite der Schräge) oder null. */
export function dachUeber(teile, x, z) {
  let best = null;
  for (const t of teile) {
    if (!TEILE[t.art].dach) continue;
    const [u, v] = zurueck(x - t.x, z - t.z, t.rot);
    if (Math.abs(u) > 1.05 || Math.abs(v) > 1.05) continue;
    const y = t.y + DACH_HUB * (v + 1) / 2;
    if (best === null || y < best) best = y;
  }
  return best;
}

/** Fehlende Rohstoffe: zaehle(id) → Anzahl im Inventar. → [{ id, fehlt }] */
export function fehlt(art, zaehle) {
  return Object.entries(TEILE[art].kosten).map(([id, n]) => ({ id, fehlt: n - zaehle(id) })).filter((e) => e.fehlt > 0);
}
