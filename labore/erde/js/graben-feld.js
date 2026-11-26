// Graben-Feld (reine Logik, ohne THREE, läuft gleich im Hauptthread und im Worker):
// Graben/Aufschütten als FEINES HÖHENFELD (0,2 m Raster) statt Voxel – wie Valheim, aber auf der Kugel.
// - Flecken = Kacheln der Stufe 13 (~19 m) auf der Würfelkugel; je Fleck (M+1)² Punkte mit Höhenänderung (m).
// - Ein Eingriff (Op) „stempelt“ eine Grube mit flachem Boden bzw. einen Hügel mit flacher Kuppe:
//   Ziel-Höhe = Trefferhöhe ∓ Tiefe, Wände als Kegel (≈ 60°). Mehrfach graben → tiefer, Rand wird breiter.
// - Abfrage delta(d) = bilinear aus dem Fleck → O(1), egal wie viele Eingriffe (alte Liste: O(n) je Probe).
// - Gleiche Ops in gleicher Reihenfolge → gleiche Felder (Worker baut die Kacheln, Hauptthread fragt Kollision).
// Gespeichert wird nur die Op-Liste. Gelände-Kacheln über gegrabenen Flecken werden feiner geteilt (planet-baum: fein).
import { wuerfelZuKugel } from './planet-baum.js';
import { kugelZuWuerfel } from './boden-netz.js';

export const FLECK_L = 13;    // Stufe der Flecken (Kantenlänge ≈ 19 m bei R = 100 km)
export const FLECK_M = 96;    // Zellen je Fleck → ~0,2 m
const GROB = 4;               // Basis-Höhe beim Anlegen nur jeden 4. Punkt (~0,8 m) abfragen, dazwischen bilinear:
                              // 625 statt 9409 teure probe()-Aufrufe je Fleck → kein Ruckler beim ersten Schlag an einer neuen Stelle.
                              // Feines Rauschen bleibt trotzdem sichtbar: Höhe = echte Basis + dh, nur der Schnitt rechnet mit der groben.
const EIMER = 64;             // grobe Vorab-Prüfung „gibt es hier überhaupt Flecken?“ (ohne Newton)

function eimerVon(x, y, z) {
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  let f, u, v;
  if (ax >= ay && ax >= az) { f = x > 0 ? 0 : 1; u = z / ax; v = y / ax; }
  else if (ay >= az) { f = y > 0 ? 2 : 3; u = x / ay; v = z / ay; }
  else { f = z > 0 ? 4 : 5; u = x / az; v = y / az; }
  const i = Math.min(EIMER - 1, Math.floor((u + 1) / 2 * EIMER)), j = Math.min(EIMER - 1, Math.floor((v + 1) / 2 * EIMER));
  return f * EIMER * EIMER + j * EIMER + i;
}
const WAND = 1.7;              // Böschung der Grubenwände (Höhe je Meter waagrecht, ≈ 60°)
const fKey = (f, ix, iy) => (f * 8192 + ix) * 8192 + iy;

/**
 * basis(dx,dy,dz) → Bodenhöhe (m über R) OHNE dieses Feld. radius = R.
 * Op = { typ: 'weg'|'fest', d: [x,y,z] Einheitsrichtung, r (m), ziel (m über R) }
 */
export function createGrabFeld({ radius = 100_000, basis, zustand = null } = {}) {
  const R = radius, M = FLECK_M, P = M + 1, n = 1 << FLECK_L, s = 2 / n;
  const flecken = new Map();     // fKey → { f, ix, iy, dh: Float32Array(P²), b: Float32Array(P²) (Basis), d: Float32Array(P²·3) }
  const eimer = new Set();
  let ops = [], version = 0, still = false;   // still: beim Anlegen eines Flecks liefert delta 0 (basis braucht es nicht → kein Newton)
  const w = { f: 0, u: 0, v: 0 }, t3 = [0, 0, 0];

  function fleck(f, ix, iy, anlegen) {
    const k = fKey(f, ix, iy);
    let fl = flecken.get(k);
    if (fl || !anlegen) return fl;
    const dh = new Float32Array(P * P), b = new Float32Array(P * P), d = new Float32Array(P * P * 3);
    const u0 = -1 + ix * s, v0 = -1 + iy * s, G = M / GROB, GP = G + 1, gb = new Float32Array(GP * GP);
    for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) {
      const q = j * P + i;
      wuerfelZuKugel(f, u0 + (s * i) / M, v0 + (s * j) / M, t3);
      d[q * 3] = t3[0]; d[q * 3 + 1] = t3[1]; d[q * 3 + 2] = t3[2];
      if (i % GROB === 0 && j % GROB === 0) { still = true; gb[(j / GROB) * GP + i / GROB] = basis(t3[0], t3[1], t3[2]); still = false; }
    }
    for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) {
      const gi = Math.min(G - 1, Math.floor(i / GROB)), gj = Math.min(G - 1, Math.floor(j / GROB));
      const a = i / GROB - gi, c = j / GROB - gj, q = gj * GP + gi;
      b[j * P + i] = (gb[q] * (1 - a) + gb[q + 1] * a) * (1 - c) + (gb[q + GP] * (1 - a) + gb[q + GP + 1] * a) * c;
    }
    fl = { f, ix, iy, dh, b, d };
    flecken.set(k, fl);
    // Eimer der vier Ecken + Mitte (ein Fleck ist viel kleiner als ein Eimer)
    for (const q of [0, M, P * M, P * P - 1, (P * P) >> 1]) eimer.add(eimerVon(d[q * 3], d[q * 3 + 1], d[q * 3 + 2]));
    return fl;
  }

  /** Höhenänderung (m) in Richtung d (Einheitsvektor). */
  function delta(dx, dy, dz) {
    if (still || !flecken.size || !eimer.has(eimerVon(dx, dy, dz))) return 0;
    kugelZuWuerfel(dx, dy, dz, w);
    const fu = (w.u + 1) / s, fv = (w.v + 1) / s;
    const ix = Math.min(n - 1, Math.floor(fu)), iy = Math.min(n - 1, Math.floor(fv));
    const fl = flecken.get(fKey(w.f, ix, iy));
    if (!fl) return 0;
    const x = (fu - ix) * M, y = (fv - iy) * M;
    const i = Math.min(M - 1, Math.floor(x)), j = Math.min(M - 1, Math.floor(y)), a = x - i, c = y - j, q = j * P + i, h = fl.dh;
    return (h[q] * (1 - a) + h[q + 1] * a) * (1 - c) + (h[q + P] * (1 - a) + h[q + P + 1] * a) * c;
  }

  /** Op anwenden (ohne Speichern). → Liste der betroffenen Flecken { f, ix, iy } */
  function stempel(op) {
    // Form: flacher Boden (Radius 0,6 r), Wände als Kegel mit Böschung WAND (≈ 60°) – unabhängig vom Raster → glatte Ränder.
    // Ein Schlag wirkt so weit, wie die Böschung bis zur alten Oberfläche reicht (tiefe Grube → breiterer Rand).
    const [dx, dy, dz] = op.d, r = op.r, innen = r * 0.6, rand = innen + 9 / WAND + 0.3;   // bis ~9 m tief bleibt die Böschung schräg
    const c = kugelZuWuerfel(dx, dy, dz, { f: 0, u: 0, v: 0 });   // eigenes Objekt: fleck() → basis → delta benutzt w
    const du = (rand / R) * 2.2;   // Würfelkoordinaten ändern sich höchstens ~2× schneller als der Winkel
    const betroffen = [];
    for (let iy = Math.floor((c.v - du + 1) / s); iy <= Math.floor((c.v + du + 1) / s); iy++) {
      for (let ix = Math.floor((c.u - du + 1) / s); ix <= Math.floor((c.u + du + 1) / s); ix++) {
        if (ix < 0 || iy < 0 || ix >= n || iy >= n) continue;   // Würfelkante: Nachbarseite fehlt (selten, ~6 Linien)
        const fl = fleck(c.f, ix, iy, true);
        let hit = false;
        // nur die Punkte im Umkreis (Würfelkoordinaten-Fenster) statt aller 97² je Fleck
        const g = M / s, i0 = Math.max(0, Math.floor((c.u - du + 1 - ix * s) * g)), i1 = Math.min(M, Math.ceil((c.u + du + 1 - ix * s) * g));
        const j0 = Math.max(0, Math.floor((c.v - du + 1 - iy * s) * g)), j1 = Math.min(M, Math.ceil((c.v + du + 1 - iy * s) * g));
        for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) {
          const q = jj * P + ii;
          const ex = fl.d[q * 3] - dx, ey = fl.d[q * 3 + 1] - dy, ez = fl.d[q * 3 + 2] - dz;
          const ab = Math.sqrt(ex * ex + ey * ey + ez * ez) * R;
          if (ab >= rand) continue;
          const kante = Math.max(0, ab - innen) * WAND, cur = fl.b[q] + fl.dh[q];
          if (op.typ === 'weg') { const wand = op.ziel + kante; if (cur > wand) { fl.dh[q] -= cur - wand; hit = true; } }
          else { const wand = op.ziel - kante; if (cur < wand) { fl.dh[q] += wand - cur; hit = true; } }
        }
        if (hit) betroffen.push({ f: c.f, ix, iy });
      }
    }
    version++;
    return betroffen;
  }

  /** Neuer Eingriff (wird gespeichert). → { op, betroffen } */
  function setze(op) {
    const o = { typ: op.typ, d: op.d.map((x) => +x.toFixed(9)), r: +op.r.toFixed(3), ziel: +op.ziel.toFixed(3) };
    ops.push(o);
    return { op: o, betroffen: stempel(o) };
  }
  /** Aktuelle Höhe (m über R, mit Feld) an Richtung d – braucht basis + delta. */
  const hoehe = (dx, dy, dz) => basis(dx, dy, dz) + delta(dx, dy, dz);
  /** Liegt d in einem Fleck mit Eingriffen? (Gelände dort feiner teilen) */
  const hatFleck = (dx, dy, dz) => flecken.size > 0 && eimer.has(eimerVon(dx, dy, dz));
  /** Liegt Gelände-Kachel (f, L, ix, iy) in einem Fleck bzw. enthält sie einen? (dort feiner teilen) */
  const inFleck = (f, L, ix, iy) => {
    if (L >= FLECK_L) return flecken.has(fKey(f, ix >> (L - FLECK_L), iy >> (L - FLECK_L)));
    for (const fl of flecken.values()) if (fl.f === f && (fl.ix >> (FLECK_L - L)) === ix && (fl.iy >> (FLECK_L - L)) === iy) return true;   // gröbere Kachel enthält einen Fleck (anderer Radius)
    return false;
  };
  /** Berührt Kachel k einen der Flecken? (k gröber oder feiner als die Flecken) */
  const kachelTrifft = (k, liste) => liste.some((b) => b.f === k.f && (k.L <= FLECK_L
    ? (b.ix >> (FLECK_L - k.L)) === k.ix && (b.iy >> (FLECK_L - k.L)) === k.iy
    : (k.ix >> (k.L - FLECK_L)) === b.ix && (k.iy >> (k.L - FLECK_L)) === b.iy));
  function lade(z) { flecken.clear(); eimer.clear(); ops = []; for (const o of z?.ops || []) { ops.push(o); stempel(o); } version++; }
  if (zustand) lade(zustand);

  return { delta, setze, stempel, hoehe, hatFleck, inFleck, kachelTrifft, lade, zustand: () => ({ ops }), get anzahl() { return ops.length; }, get version() { return version; }, get flecken() { return flecken; } };
}
