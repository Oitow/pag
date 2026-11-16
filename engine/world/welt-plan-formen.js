/**
 * @modul    welt-plan-formen
 * @zweck    Form-Rechnungen für den Welt-Plan (ohne THREE): Ring-Mauer aus Segmenten/Türmen/Torhaus, Höhenprofil mit Gefälle-Grenze, geschwungene Pfad-Kurve, Gitter-Zuordnung, Boxen-Tests
 * @api      ringPlaetze(ring, zone) -> [platz] ; profil(hoehen, abstaende, maxGefaelle, fest?) -> Float32Array ; kurve(punkte, schritt) -> {punkte: Float64Array [x,z,…], laenge} ; lokalZuWeltRoh(px, pz, w, lx, lz) -> {x,z} ; weltZuLokalRoh(px, pz, w, x, z) -> {x,z} ; naechstePunkte(C, radius, b, t) -> {d, s, liste} ; inBox(x, z, platz, rand?) -> bool ; boxenSchneiden(a, b, eps?) -> bool ; abstandStrecke(px, pz, ax, az, bx, bz) -> {d, u}
 * @beispiel
 *   import { ringPlaetze, profil } from '../../engine/world/welt-plan-formen.js';
 *   const mauer = ringPlaetze({ id: 'mauer', radius: 36 }, { x: 150, z: -137, drehung: -0.85 });   // Segmente, 8 Türme, Torhaus
 *   const h = profil([0, 9, 0, 9, 0], 10, 0.14);                                                    // Höhen mit |dh/ds| ≤ 0.14
 * @tags     welt, plan, mauer, profil, spline, geometrie, gefaelle
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { clamp } from '../core/math.js';

/** Lokal (lx, lz) → Welt: Drehung wie THREE rotation.y = w, Front/Blick = (sin w, cos w). */
export function lokalZuWeltRoh(px, pz, w, lx, lz) {
  const c = Math.cos(w), s = Math.sin(w);
  return { x: px + lx * c + lz * s, z: pz - lx * s + lz * c };
}
/** Umkehrung von lokalZuWeltRoh. */
export function weltZuLokalRoh(px, pz, w, x, z) {
  const c = Math.cos(w), s = Math.sin(w), dx = x - px, dz = z - pz;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

/**
 * Mauer-Ring um eine Zone (Koordinaten in Welt-Metern): Türme an den Ecken (art 'mauer-turm'), je Seite gestreckte Segmente
 * (art 'mauer', sx = Streckung), Torhaus (art 'torhaus') an der Seite `tor`, deren Mitte nach lokal +z der Zone zeigt. Fronten zeigen nach außen.
 * ring: { id, radius, ecken = 8, tor = 0, segment = 6, turm = 4.5, torBreite = 9 }, zone: { x, z, drehung = 0 }.
 */
export function ringPlaetze(ring, zone) {
  const n = Math.max(3, ring.ecken ?? 8), r = ring.radius, tor = ring.tor ?? 0;
  const seg = ring.segment ?? 6, turm = ring.turm ?? 4.5, tb = ring.torBreite ?? 9, w0 = zone.drehung ?? 0, id = ring.id;
  const w = (lx, lz) => lokalZuWeltRoh(zone.x, zone.z, w0, lx, lz);
  const ecke = k => { const f = (k - tor - 0.5) * 2 * Math.PI / n; return { f, x: r * Math.sin(f), z: r * Math.cos(f) }; };
  const aus = [];
  const mk = (pid, art, p, winkel, bx, bz, extra) => aus.push({ id: pid, art, variante: 0, x: p.x, z: p.z, winkel, bx, bz, ebnen: false, boden: null, daten: null, ring: id, ...extra });
  for (let k = 0; k < n; k++) { const e = ecke(k); mk(`${id}-turm-${k}`, 'mauer-turm', w(e.x, e.z), e.f + w0, turm / 2, turm / 2, { rund: true }); }
  const laenge = 2 * r * Math.sin(Math.PI / n);
  for (let s = 0; s < n; s++) {
    const a = ecke(s), b = ecke(s + 1), fm = (s - tor) * 2 * Math.PI / n;
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, tx = (b.x - a.x) / laenge, tz = (b.z - a.z) / laenge;
    const frei = laenge - turm;                          // Strecke zwischen den Turm-Rändern
    const teile = s === tor ? [[-frei / 2, (frei - tb) / 2], [tb / 2, (frei - tb) / 2]] : [[-frei / 2, frei]];
    let j = 0;
    for (const [t0, len] of teile) {
      if (len < 0.05) continue;
      const cnt = Math.max(1, Math.ceil(len / seg - 1e-9)), sx = len / (cnt * seg), breite = seg * sx;
      for (let q = 0; q < cnt; q++) {
        const t = t0 + (q + 0.5) * breite;
        mk(`${id}-mauer-${s}-${j++}`, 'mauer', w(mx + tx * t, mz + tz * t), fm + w0, breite / 2, 0.7, { sx });
      }
    }
    if (s === tor) mk(`${id}-torhaus`, 'torhaus', w(mx, mz), fm + w0, tb / 2, 3);
  }
  return aus;
}

/**
 * Höhenprofil mit Gefälle-Grenze: ändert `hoehen` so wenig wie möglich (Vor-/Rückwärts-Begrenzung), sodass |dh/ds| ≤ maxGefaelle.
 * abstaende: Zahl (konstant) oder Array (Länge n−1, Abstand von i zu i+1). fest: Indizes, die unverändert bleiben (Standard: erster/letzter);
 * widersprechen sich feste Punkte, gewinnen sie (Gefälle dort überschritten).
 */
export function profil(hoehen, abstaende, maxGefaelle, fest) {
  const n = hoehen.length, g = maxGefaelle, h = new Float64Array(n);
  const ds = i => (typeof abstaende === 'number' ? abstaende : abstaende[i]);
  const pin = new Uint8Array(n);
  for (const k of fest ?? [0, n - 1]) if (k >= 0 && k < n) pin[k] = 1;
  for (let i = 0; i < n; i++) h[i] = hoehen[i];
  const lo = new Float64Array(n).fill(-Infinity), hi = new Float64Array(n).fill(Infinity);
  for (let i = 0; i < n; i++) if (pin[i]) lo[i] = hi[i] = h[i];
  for (let i = 1; i < n; i++) { lo[i] = Math.max(lo[i], lo[i - 1] - g * ds(i - 1)); hi[i] = Math.min(hi[i], hi[i - 1] + g * ds(i - 1)); }
  for (let i = n - 2; i >= 0; i--) { lo[i] = Math.max(lo[i], lo[i + 1] - g * ds(i)); hi[i] = Math.min(hi[i], hi[i + 1] + g * ds(i)); }
  for (let i = 0; i < n; i++) if (!pin[i]) h[i] = Math.min(Math.max(h[i], lo[i]), hi[i]);
  for (let i = 1; i < n; i++) if (!pin[i]) h[i] = clamp(h[i], h[i - 1] - g * ds(i - 1), h[i - 1] + g * ds(i - 1));
  for (let i = n - 2; i >= 0; i--) if (!pin[i]) h[i] = clamp(h[i], h[i + 1] - g * ds(i), h[i + 1] + g * ds(i));
  return Float32Array.from(h);
}

/** Zentripetaler Catmull-Rom-Punkt zwischen p1 und p2 (t ∈ [0,1]). */
function crPunkt(p0, p1, p2, p3, t) {
  const d = (a, b) => Math.max(1e-6, Math.hypot(a[0] - b[0], a[1] - b[1]) ** 0.5);
  const t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3), u = t1 + (t2 - t1) * t;
  const mix = (a, b, ta, tb) => [(a[0] * (tb - u) + b[0] * (u - ta)) / (tb - ta), (a[1] * (tb - u) + b[1] * (u - ta)) / (tb - ta)];
  const a1 = mix(p0, p1, 0, t1), a2 = mix(p1, p2, t1, t2), a3 = mix(p2, p3, t2, t3);
  const b1 = mix(a1, a2, 0, t2), b2 = mix(a2, a3, t1, t3);
  return mix(b1, b2, t1, t2);
}

/**
 * Glatte Kurve durch die Stützpunkte [[x,z],…], gleichmäßig nach Bogenlänge abgetastet (Abstand ≈ schritt, Ende exakt).
 * Ergebnis: { punkte: Float64Array [x,z,…], laenge }.
 */
export function kurve(punkte, schritt) {
  const P = punkte.map(p => [p[0], p[1]]), m = P.length;
  if (m < 2) return { punkte: Float64Array.from(P.flat()), laenge: 0 };
  const dicht = [P[0]];
  for (let i = 0; i < m - 1; i++) {
    const p0 = i > 0 ? P[i - 1] : [2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]];
    const p3 = i < m - 2 ? P[i + 2] : [2 * P[m - 1][0] - P[m - 2][0], 2 * P[m - 1][1] - P[m - 2][1]];
    const teile = Math.max(8, Math.ceil(Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]) / (schritt / 4)));
    for (let k = 1; k <= teile; k++) dicht.push(crPunkt(p0, P[i], P[i + 1], p3, k / teile));
  }
  const kum = [0];
  for (let i = 1; i < dicht.length; i++) kum.push(kum[i - 1] + Math.hypot(dicht[i][0] - dicht[i - 1][0], dicht[i][1] - dicht[i - 1][1]));
  const L = kum[kum.length - 1], cnt = Math.max(1, Math.ceil(L / schritt)), aus = new Float64Array((cnt + 1) * 2);
  let j = 0;
  for (let k = 0; k <= cnt; k++) {
    const s = (L * k) / cnt;
    while (j < kum.length - 2 && kum[j + 1] < s) j++;
    const f = kum[j + 1] > kum[j] ? clamp((s - kum[j]) / (kum[j + 1] - kum[j]), 0, 1) : 0;
    aus[2 * k] = dicht[j][0] + (dicht[j + 1][0] - dicht[j][0]) * f;
    aus[2 * k + 1] = dicht[j][1] + (dicht[j + 1][1] - dicht[j][1]) * f;
  }
  return { punkte: aus, laenge: L };
}

/** Abstand eines Punktes zur Strecke a–b und Lauf-Parameter u ∈ [0,1]. */
export function abstandStrecke(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const u = l2 > 0 ? clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1) : 0;
  return { d: Math.hypot(px - ax - dx * u, pz - az - dz * u), u };
}

/**
 * Ordnet jeder Gitterzelle nahe einer Linie C (Zellkoordinaten [x,y,…]) den nächsten Punkt zu.
 * Ergebnis: d[i] = Abstand (Zellen, Infinity = nicht erfasst), s[i] = gebrochener Index auf der Linie, liste = berührte Zellen.
 */
export function naechstePunkte(C, radius, b, t) {
  const d = new Float32Array(b * t).fill(Infinity), s = new Float32Array(b * t), liste = [], m = C.length / 2;
  for (let k = 0; k < m - 1; k++) {
    const ax = C[2 * k], ay = C[2 * k + 1], bx = C[2 * k + 2], by = C[2 * k + 3];
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - radius)), x1 = Math.min(b - 1, Math.ceil(Math.max(ax, bx) + radius));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - radius)), y1 = Math.min(t - 1, Math.ceil(Math.max(ay, by) + radius));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const q = abstandStrecke(x, y, ax, ay, bx, by);
      if (q.d > radius) continue;
      const i = y * b + x;
      if (d[i] === Infinity) liste.push(i);
      if (q.d < d[i]) { d[i] = q.d; s[i] = k + q.u; }
    }
  }
  return { d, s, liste };
}

/** Liegt (x,z) in der (gedrehten) Grundfläche des Platzes (Kasten bx × bz oder Kreis bei platz.rund), um `rand` Meter vergrößert? */
export function inBox(x, z, platz, rand = 0) {
  const l = weltZuLokalRoh(platz.x, platz.z, platz.winkel || 0, x, z);
  if (platz.rund) return Math.hypot(l.x, l.z) <= platz.bx + rand;
  return Math.abs(l.x) <= platz.bx + rand && Math.abs(l.z) <= platz.bz + rand;
}

/** Überschneiden sich zwei gedrehte Grundflächen (Separating-Axis, eps = Toleranz in m)? */
export function boxenSchneiden(a, b, eps = 0.05) {
  const ax = [[Math.cos(a.winkel || 0), -Math.sin(a.winkel || 0)], [Math.sin(a.winkel || 0), Math.cos(a.winkel || 0)]];
  const bx = [[Math.cos(b.winkel || 0), -Math.sin(b.winkel || 0)], [Math.sin(b.winkel || 0), Math.cos(b.winkel || 0)]];
  const ausdehnung = (p, achsen, u) => Math.abs(p.bx * (achsen[0][0] * u[0] + achsen[0][1] * u[1])) + Math.abs(p.bz * (achsen[1][0] * u[0] + achsen[1][1] * u[1]));
  const dx = b.x - a.x, dz = b.z - a.z;
  for (const u of [...ax, ...bx]) {
    const abst = Math.abs(dx * u[0] + dz * u[1]);
    if (abst > ausdehnung(a, ax, u) + ausdehnung(b, bx, u) - eps) return false;
  }
  return true;
}
