/**
 * @modul    worldgen-wege
 * @zweck    Wegenetz zwischen Startplatz, Dörfern und ausgewählten Sehenswürdigkeiten: Spannbaum plus Abkürzungen, A* um Steilhänge herum, Wege teilen sich Strecken, Flüsse werden kurz per Brücke gequert; markiert Zellen als WEG und hält sie frei von Objekten
 * @api      planeNetz(knoten, schleifen) -> [[a,b],…] ; stufeWege(welt, opts) -> void (füllt welt.wege)
 * @beispiel
 *   import { createWorld, FLAG } from '../../engine/world/worldgen/worldgen.js';
 *   const welt = createWorld({ preset: 'insel', seed: 42, wege: { aktiv: true, poi: ['gipfel'] } });
 *   for (const w of welt.wege) zeichneLinie(w.punkte);        // [x0,y0,x1,y1,…] in Weltkoordinaten
 *   const aufWeg = welt.flags[y * welt.breite + x] & FLAG.WEG;
 * @tags     welt, worldgen, wege, strassen, pfad, bruecke, dorf, netz
 * @version  1.1.0
 * @status   entwurf
 * @three    nein
 */
import { FLAG } from './worldgen-grid.js';
import { createPathfinder } from './worldgen-path.js';

/**
 * Wählt die Verbindungen: minimaler Spannbaum (Prim, Luftlinie) plus bis zu `schleifen` Abkürzungen.
 * Eine Abkürzung lohnt sich, wenn der Umweg über den Baum mehr als doppelt so lang ist wie die Luftlinie.
 * knoten: [{x, y}], Ergebnis: Indexpaare [a, b] mit a < b, Baumkanten zuerst.
 */
export function planeNetz(knoten, schleifen = 0) {
  const n = knoten.length;
  if (n < 2) return [];
  const d = (a, b) => Math.hypot(knoten[a].x - knoten[b].x, knoten[a].y - knoten[b].y);
  const drin = new Uint8Array(n), best = new Float64Array(n).fill(Infinity), von = new Int32Array(n).fill(-1);
  const kanten = [], nachbarn = Array.from({ length: n }, () => []);
  best[0] = 0;
  for (let k = 0; k < n; k++) {
    let a = -1;
    for (let i = 0; i < n; i++) if (!drin[i] && (a < 0 || best[i] < best[a])) a = i;
    drin[a] = 1;
    if (von[a] >= 0) { kanten.push([Math.min(a, von[a]), Math.max(a, von[a])]); nachbarn[a].push(von[a]); nachbarn[von[a]].push(a); }
    for (let i = 0; i < n; i++) if (!drin[i]) { const l = d(a, i); if (l < best[i]) { best[i] = l; von[i] = a; } }
  }
  if (schleifen > 0) {
    // Weglänge im Baum zwischen zwei Knoten (Tiefensuche, n ist klein)
    const baumweg = (a, b) => {
      const stapel = [[a, -1, 0]];
      while (stapel.length) {
        const [c, eltern, l] = stapel.pop();
        if (c === b) return l;
        for (const m of nachbarn[c]) if (m !== eltern) stapel.push([m, c, l + d(c, m)]);
      }
      return Infinity;
    };
    const kand = [];
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      if (nachbarn[a].includes(b)) continue;
      const l = d(a, b), umweg = baumweg(a, b) / l;
      if (umweg > 2) kand.push([l, a, b]);
    }
    kand.sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2]);
    for (let i = 0; i < kand.length && i < schleifen; i++) kanten.push([kand[i][1], kand[i][2]]);
  }
  return kanten;
}

/** Glättet eine Punktliste [x0,y0,…] (gleitendes Mittel, Enden bleiben fest). */
function glaette(p, runden) {
  const n = p.length / 2;
  for (let r = 0; r < runden && n > 2; r++) {
    let vx = p[0], vy = p[1];
    for (let i = 1; i < n - 1; i++) {
      const x = p[2 * i], y = p[2 * i + 1];
      p[2 * i] = (vx + 2 * x + p[2 * i + 2]) / 4; p[2 * i + 1] = (vy + 2 * y + p[2 * i + 3]) / 4;
      vx = x; vy = y;
    }
  }
  return p;
}

/**
 * Pipeline-Stufe Wege (nach „orte“, vor „objekte“). opts.wege:
 * { aktiv (false), poi: ['gipfel', …] (Arten aus welt.orte.poi, die angebunden werden), schleifen (1),
 *   hangKosten (22), bruecke (14, Zusatzkosten je Flusszelle; Infinity = keine Brücken), rabatt (0.35, Kostenfaktor auf vorhandenen Wegen), glaetten (2) }
 * Ergebnis: welt.wege = [{ von, nach, punkte: Float32Array, laenge, bruecken: [{x, y, laenge, dx, dy}] }] (dx/dy = Richtung der Brücke, Länge 1); von/nach sind Indizes in welt.wegKnoten
 * ({ x, y, art: 'start' | 'dorf' | <poi-Art> }). Wegzellen bekommen FLAG.WEG, an Land zusätzlich FLAG.FREI (keine Objekte).
 */
export function stufeWege(welt, opts) {
  const W = opts.wege || {};
  welt.wege = []; welt.wegKnoten = [];
  if (!W.aktiv) return;
  const { breite: b, flags: FL, zelle: z, orte } = welt;
  const knoten = welt.wegKnoten;
  if (orte.start) knoten.push({ x: orte.start.x, y: orte.start.y, art: 'start' });
  for (const d of orte.doerfer) knoten.push({ x: d.x, y: d.y, art: 'dorf' });
  const arten = new Set(W.poi || []);
  for (const p of orte.poi) if (arten.has(p.art)) knoten.push({ x: p.x, y: p.y, art: p.art });
  if (knoten.length < 2) return;

  const rabatt = Math.min(1, Math.max(0.05, W.rabatt ?? 0.35));
  const pf = createPathfinder(welt, {
    hangKosten: W.hangKosten ?? 22, wasser: Infinity, fluss: W.bruecke ?? 14,
    faktor: i => (FL[i] & FLAG.WEG ? rabatt : 1), minKosten: rabatt,
  });
  const runden = W.glaetten ?? 2;
  for (const [a, e] of planeNetz(knoten, W.schleifen ?? 1)) {
    const roh = pf.finde(knoten[a].x, knoten[a].y, knoten[e].x, knoten[e].y);
    if (!roh) continue;                                  // z. B. andere Insel
    const m = roh.length / 2, bruecken = [];
    let laenge = 0, lauf = 0;
    for (let k = 0; k < m; k++) {
      const i = Math.round(roh[2 * k + 1] / z) * b + Math.round(roh[2 * k] / z);
      if (k > 0) laenge += Math.hypot(roh[2 * k] - roh[2 * k - 2], roh[2 * k + 1] - roh[2 * k - 1]);
      const nass = FL[i] & FLAG.FLUSS;
      FL[i] |= nass ? FLAG.WEG : FLAG.WEG | FLAG.FREI;
      if (nass) lauf++;
      if (lauf && (!nass || k === m - 1)) {
        // Brücke von der letzten trockenen Zelle davor bis zur ersten danach
        const ende = nass ? k : k - 1, a = Math.max(0, ende - lauf), e = Math.min(m - 1, ende + 1);
        const dx = roh[2 * e] - roh[2 * a], dy = roh[2 * e + 1] - roh[2 * a + 1], l = Math.hypot(dx, dy) || 1;
        bruecken.push({ x: (roh[2 * a] + roh[2 * e]) / 2, y: (roh[2 * a + 1] + roh[2 * e + 1]) / 2, laenge: l, dx: dx / l, dy: dy / l });
        lauf = 0;
      }
    }
    welt.wege.push({ von: a, nach: e, punkte: glaette(roh, runden), laenge, bruecken });
  }
}
