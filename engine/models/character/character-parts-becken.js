/**
 * @modul    character-parts-becken
 * @zweck    Bau-Funktion für das Figuren-Becken (Knochen becken): Hüfte, Gürtel, Gürteltasche, Kittelsaum, Rock, Mantelschöße, Schürze, Lederstreifen
 * @api      baueBecken(b,ctx) -> b
 * @beispiel
 *   import { baueBecken } from '../../engine/models/character/character-parts-becken.js';
 *   rig.knochen.becken.add(baueBecken(createMeshBuilder({ seed }), teilKontext(look, masse)).mesh());
 * @tags     figur, charakter, kleidung, rock, gürtel, tasche, mantel, schürze
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { dunkler, GOLD, LEDER, mantelFlaeche } from './character-parts-basis.js';

/** Vorderbahn (Schürze, Wappenrock) schräg vor einem Kegel von Radius rO (oben) bis rU (unten) über Höhe h ab y0 nach unten. */
function vorderbahn(b, breite, h, rO, rU, farbe, y0, sz, g) {
  b.box(breite, h, 0.01 * g, farbe, { y: y0 - h / 2, z: (rO + rU) / 2 * sz + 0.006 * g, rx: -Math.atan((rU - rO) * sz / h) });
}

/** Becken: Hüfte, Gürtel, Tasche, Kittelsaum oder Rock (leicht konisch, bleibt oberhalb der Waden). */
export function baueBecken(b, K) {
  const { g, w, f, taille: rw, tiefe: sz, m } = K, st = K.stil.ober;
  const unten = K.rock ? (st === 'kleid' || st === 'robe' ? f.ober : f.hose) : f.hose;
  b.cyl(rw * 1.02, rw * 1.08, 0.16 * g, unten, { y: -0.015 * g, sz: sz * 1.05 }, 10);
  b.sphere(rw * 1.05, unten, { y: -0.09 * g, sy: 0.45, sz: sz * 1.05 }, 10, 5);
  const saum = 0.06 * g;
  let rockR = null;                                                  // [rOben, rUnten, h] des äußersten Rocks (für Schürze)
  if (K.rock) {
    const lang = K.rock === 'lang', hRock = (lang ? 0.62 : 0.4) * m.oberschenkel * 2;
    const rUnten = (lang ? 0.27 : 0.22) * g * Math.sqrt(w), farbe = st === 'robe' || (st === 'kleid' && !lang) || K.stil.hose !== 'rock' ? f.ober : f.hose;
    b.cyl(rw * 1.08, rUnten, hRock, farbe, { y: 0.06 * g - hRock / 2, sz: 0.85 }, 12);
    b.cyl(rUnten * 1.02, rUnten * 1.02, 0.03 * g, st === 'robe' || st === 'kleid' ? f.akzent : dunkler(farbe, 0.2), { y: 0.06 * g - hRock + 0.015 * g, sz: 0.85 }, 12);
    rockR = [rw * 1.08, rUnten, hRock, 0.85];
    if (st === 'kleid' && lang) {                                    // Überrock + Schürze (mit Umhang: edle Vorderbahn) über langem Rock
      const h2 = hRock * 0.62, r2 = rw * 1.1 + (rUnten - rw * 1.08) * 0.62 + 0.012 * g;
      b.cyl(rw * 1.12, r2, h2, f.ober, { y: 0.06 * g - h2 / 2, sz: 0.85 }, 12);
      vorderbahn(b, (K.stil.umhang === 'kein' ? 0.17 : 0.06) * g * w, h2 * 0.9, rw * 1.1, r2, f.akzent, 0.04 * g, 0.85, g);
    }
  }
  if (!K.rock && (st === 'kittel' || st === 'ruestung' || st === 'kettenhemd')) {
    const farbe = st === 'ruestung' ? dunkler(f.ober, 0.1) : f.ober, h = (st === 'kettenhemd' ? 0.28 : 0.22) * g;
    b.cyl(rw * 1.06, rw * 1.38, h, farbe, { y: 0.06 * g - h / 2, sz, jitter: st === 'kettenhemd' ? 0.3 : undefined }, 12);
    b.cyl(rw * 1.4, rw * 1.4, 0.025 * g, st === 'kettenhemd' ? dunkler(f.ober, 0.2) : f.akzent, { y: 0.06 * g - h, sz }, 12);
    if (st === 'ruestung') b.box(0.13 * g * w, 0.3 * g, 0.012 * g, f.akzent, { y: -0.08 * g, z: rw * 1.25 * sz + 0.03 * g, rx: -0.12 });
    rockR = [rw * 1.06, rw * 1.38, h, sz];
  }
  if (st === 'kettenhemd') for (const s of [-1, 1]) {                // Wappenrock vorn/hinten bis über die Knie
    const h = 0.4 * g, r0 = rw * 1.1, r1 = rw * 1.5;
    b.box(0.16 * g * w, h, 0.01 * g, f.akzent, { y: 0.05 * g - h / 2, z: s * ((r0 + r1) / 2 * sz + 0.01 * g), rx: -s * Math.atan((r1 - r0) * sz / h) });
  }
  if (st === 'mantel') {                                             // Mantelschöße bis zum Knie, vorn offen
    const h = 0.5 * m.oberschenkel * 2, rU = 0.24 * g * Math.sqrt(w), o = 0.42;
    mantelFlaeche(b, rw * 1.12, rU, h, f.ober, { y: 0.07 * g - h / 2, sz: 0.85, jitter: 0.08 }, { th0: o, thL: 2 * Math.PI - 2 * o, doppelt: true });
    mantelFlaeche(b, rU * 1.01, rU * 1.01, 0.03 * g, f.akzent, { y: 0.07 * g - h + 0.015 * g, sz: 0.85 }, { th0: o, thL: 2 * Math.PI - 2 * o });
  }
  if (st === 'lederruestung' && !K.rock) for (let i = 0; i < 8; i++) {     // Lederstreifen (Pteryges)
    const a = (i + 0.5) / 8 * 2 * Math.PI, h = 0.2 * g;
    b.box(0.07 * g * w, h, 0.012 * g, i % 2 ? f.ober : dunkler(f.ober, 0.2), { x: Math.sin(a) * rw * 1.2, y: 0.05 * g - h / 2, z: Math.cos(a) * rw * 1.2 * sz, ry: a, rx: -0.18 });
  }
  if (st === 'schuerze') {
    const [rO, rU, h, s2] = rockR || [rw * 1.1, rw * 1.35, 0.42 * m.oberschenkel * 2, sz];
    vorderbahn(b, 0.2 * g * w, h * 0.92, rO, rU, f.akzent, saum - 0.01 * g, s2, g);
  }
  if (f.guertel != null) {
    b.cyl(rw * 1.09, rw * 1.09, 0.04 * g, f.guertel, { y: saum - 0.005 * g, sz: sz * 1.05 }, 10);
    b.box(0.045 * g, 0.04 * g, 0.012 * g, GOLD, { y: saum - 0.005 * g, z: rw * 1.09 * sz * 1.05 });
  }
  if (K.L.tasche) {
    const x = rw * 1.05;
    b.box(0.09 * g, 0.1 * g, 0.045 * g, LEDER, { x, y: saum - 0.07 * g, z: 0.02 * g, ry: 0.25, jitter: 0.12 });
    b.box(0.095 * g, 0.04 * g, 0.05 * g, dunkler(LEDER, 0.25), { x, y: saum - 0.035 * g, z: 0.02 * g, ry: 0.25 });
    b.sphere(0.01 * g, GOLD, { x: x + 0.006, y: saum - 0.04 * g, z: 0.045 * g }, 4, 3);
  }
  return b;
}
