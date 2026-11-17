/**
 * @modul    gauss-saat
 * @zweck    Prozedurale Gauß-Splats erzeugen: wachsender Daten-Sammler, Quaternion aus einer Normalen und flächengleiche Aussaat flacher Scheiben auf einem Dreiecksnetz (Moos, Flechten, Laub)
 * @api      createSplatDaten(start = 1024) -> { anzahl, plus(x,y,z, sx,sy,sz, qx,qy,qz,qw, r,g,b, deck, wind = 0), fertig() -> daten { anzahl, position, skala, drehung, farbe, deck, wind } } ; quatAusNormale(nx, ny, nz, dreh, out = [0,0,0,1]) -> out ; saatAufNetz(ziel, netz { position, normal, index }, { anzahl, seed, groesse = [0.15, 0.5], flach = 0.25, abheben = 0.03, deck = 0.9, wind = 0, farbe ‹(x,y,z,nx,ny,nz,zufall) -> [r,g,b] | null› }) -> gesetzt
 * @beispiel
 *   import { createSplatDaten, saatAufNetz } from '../../engine/render/gauss-saat.js';
 *   const saat = createSplatDaten();
 *   saatAufNetz(saat, { position, normal, index }, { anzahl: 4000, seed: 7, farbe: (x, y, z, nx, ny) => ny > 0.3 ? [0.10, 0.22, 0.05] : null });   // Moos nur oben
 *   saat.plus(0, 30, 0, 4, 3, 4, 0, 0, 0, 1, 0.08, 0.2, 0.06, 0.35, 1);                  // ein großer weicher Laub-Blob, wiegt im Wind
 *   wolke.fuege(saat.fertig());
 * @tags     splat, gauss, gaussian, saat, streuen, netz, moos, laub, prozedural, quaternion
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { rng } from '../core/rng.js';

/** Sammler für Splats. Maße in Metern: sx/sy/sz = Standardabweichungen (sichtbar ist etwa das 2- bis 3-Fache), Farbe linear 0..1. */
export function createSplatDaten(start = 1024) {
  let platz = Math.max(16, start | 0), n = 0;
  let position = new Float32Array(platz * 3), skala = new Float32Array(platz * 3), drehung = new Float32Array(platz * 4);
  let farbe = new Float32Array(platz * 3), deck = new Float32Array(platz), wind = new Float32Array(platz);
  const groesser = (alt, je) => { const neu = new Float32Array(platz * je); neu.set(alt); return neu; };
  function wachse() {
    platz *= 2;
    position = groesser(position, 3); skala = groesser(skala, 3); drehung = groesser(drehung, 4);
    farbe = groesser(farbe, 3); deck = groesser(deck, 1); wind = groesser(wind, 1);
  }
  return {
    get anzahl() { return n; },
    plus(x, y, z, sx, sy, sz, qx, qy, qz, qw, r, g, b, d, w = 0) {
      if (n >= platz) wachse();
      const i3 = n * 3, i4 = n * 4;
      position[i3] = x; position[i3 + 1] = y; position[i3 + 2] = z;
      skala[i3] = sx; skala[i3 + 1] = sy; skala[i3 + 2] = sz;
      drehung[i4] = qx; drehung[i4 + 1] = qy; drehung[i4 + 2] = qz; drehung[i4 + 3] = qw;
      farbe[i3] = r; farbe[i3 + 1] = g; farbe[i3 + 2] = b;
      deck[n] = d; wind[n] = w;
      return n++;
    },
    /** Flache Daten für `gaussWolke.fuege` – Ansichten auf die Puffer (nach weiterem `plus` neu holen). */
    fertig() {
      return { anzahl: n, position: position.subarray(0, n * 3), skala: skala.subarray(0, n * 3), drehung: drehung.subarray(0, n * 4),
        farbe: farbe.subarray(0, n * 3), deck: deck.subarray(0, n), wind: wind.subarray(0, n) };
    },
  };
}

/** Quaternion (xyzw), das die lokale z-Achse auf die Normale legt und vorher um `dreh` (rad) um sie dreht. Flache Scheibe: sz klein. */
export function quatAusNormale(nx, ny, nz, dreh = 0, out = [0, 0, 0, 1]) {
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l; ny /= l; nz /= l;
  let ax, ay, aw;                                   // kürzeste Drehung z → n: Achse z×n = (−ny, nx, 0)
  if (nz < -0.999999) { ax = 1; ay = 0; aw = 0; }   // genau entgegengesetzt: halbe Drehung um x
  else { ax = -ny; ay = nx; aw = 1 + nz; const m = Math.hypot(ax, ay, aw); ax /= m; ay /= m; aw /= m; }
  const sz = Math.sin(dreh * 0.5), cz = Math.cos(dreh * 0.5);
  out[0] = ax * cz + ay * sz;
  out[1] = ay * cz - ax * sz;
  out[2] = aw * sz;
  out[3] = aw * cz;
  return out;
}

/**
 * Streut `anzahl` flache Splat-Scheiben flächengleich über ein Dreiecksnetz. `groesse` = [min, max] Standardabweichung in der Fläche (m),
 * `flach` = Dicke als Anteil davon, `abheben` = Versatz entlang der Normalen (m). `farbe` darf `null` liefern → dort kein Splat
 * (der Zufall läuft trotzdem gleich weiter: gleiche Saat = gleiche Stellen). Rückgabe: tatsächlich gesetzte Splats.
 */
export function saatAufNetz(ziel, netz, { anzahl = 1000, seed = 1, groesse = [0.15, 0.5], flach = 0.25, abheben = 0.03, deck = 0.9, wind = 0, farbe = null } = {}) {
  const p = netz.position, nrm = netz.normal || null, idx = netz.index || null;
  const dreiecke = Math.floor((idx ? idx.length : p.length / 3) / 3);
  if (dreiecke < 1 || anzahl < 1) return 0;
  const ecke = k => (idx ? idx[k] : k) * 3;
  const summe = new Float64Array(dreiecke);          // aufsummierte Flächen → Dreieck nach Fläche ziehen
  let flaeche = 0;
  for (let t = 0; t < dreiecke; t++) {
    const a = ecke(t * 3), b = ecke(t * 3 + 1), c = ecke(t * 3 + 2);
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    flaeche += 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    summe[t] = flaeche;
  }
  if (!(flaeche > 0)) return 0;
  const r = rng(seed), q = [0, 0, 0, 1];
  const gMin = groesse[0], gSpanne = groesse[1] - groesse[0];
  let gesetzt = 0;
  for (let s = 0; s < anzahl; s++) {
    const wahl = r() * flaeche;
    let u = r(), v = r();
    const g = gMin + gSpanne * r(), dreh = r() * Math.PI * 2, schmal = 0.7 + 0.3 * r(), zufall = r();
    let lo = 0, hi = dreiecke - 1;
    while (lo < hi) { const mitte = (lo + hi) >> 1; if (summe[mitte] < wahl) lo = mitte + 1; else hi = mitte; }
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v, a = ecke(lo * 3), b = ecke(lo * 3 + 1), c = ecke(lo * 3 + 2);
    let nx, ny, nz;
    if (nrm) {
      nx = nrm[a] * w + nrm[b] * u + nrm[c] * v; ny = nrm[a + 1] * w + nrm[b + 1] * u + nrm[c + 1] * v; nz = nrm[a + 2] * w + nrm[b + 2] * u + nrm[c + 2] * v;
    } else {
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx;
    }
    const nl = Math.hypot(nx, ny, nz);
    if (nl > 1e-12) { nx /= nl; ny /= nl; nz /= nl; } else { nx = 0; ny = 1; nz = 0; }
    const x = p[a] * w + p[b] * u + p[c] * v + nx * abheben;
    const y = p[a + 1] * w + p[b + 1] * u + p[c + 1] * v + ny * abheben;
    const z = p[a + 2] * w + p[b + 2] * u + p[c + 2] * v + nz * abheben;
    const f = farbe ? farbe(x, y, z, nx, ny, nz, zufall) : GRAU;
    if (!f) continue;
    quatAusNormale(nx, ny, nz, dreh, q);
    ziel.plus(x, y, z, g, g * schmal, g * flach, q[0], q[1], q[2], q[3], f[0], f[1], f[2], deck, wind);
    gesetzt++;
  }
  return gesetzt;
}
const GRAU = Object.freeze([0.5, 0.5, 0.5]);
