/**
 * @modul    totholz-form
 * @zweck    Reine Röhren-Geometrie (ohne THREE) für Totholz/Äste: Ringe entlang eines Pfads, Enden zu/Spitze/Jahresring-Scheibe, Markierung je Dreieck
 * @api      createRoehrenNetz() -> { roehre(pfad, radien, segmente, opts), punkte, dreiecke, marken }  (marken je Dreieck: 'rinde' | 'ring0'..'ringN' | 'spitze')
 * @beispiel
 *   import { createRoehrenNetz } from '../../engine/models/natur/totholz-form.js';
 *   const n = createRoehrenNetz();
 *   n.roehre([[0,0,0],[0,1,0]], [0.3, 0.25], 8, { ende: 'ringe', ringe: 3 });
 *   // n.punkte (xyz), n.dreiecke (Indizes, außen gegen den Uhrzeigersinn), n.marken[dreieckNr]
 * @tags     natur, totholz, ast, stamm, geometrie, lowpoly
 * @version  1.0.0
 * @status   neu
 * @three    nein
 */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const kreuz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Sammelt mehrere Röhren in einem indizierten Netz. */
export function createRoehrenNetz() {
  const punkte = [], dreiecke = [], marken = [];
  const p = v => { punkte.push(v[0], v[1], v[2]); return punkte.length / 3 - 1; };
  const tri = (a, b, c, m) => { dreiecke.push(a, b, c); marken.push(m); };

  /** Kappe (Fächer oder Jahresring-Scheibe) über Randring rand; aussen = Blickrichtung der Fläche. */
  function kappe(rand, mitte, art, ringe, aussen, spitzeLaenge, versatz) {
    const s = rand.length;
    const t = (a, b, c, m) => (aussen ? tri(a, b, c, m) : tri(a, c, b, m));
    if (art === 'spitze') {
      const apex = p([mitte[0] + versatz[0] * spitzeLaenge, mitte[1] + versatz[1] * spitzeLaenge, mitte[2] + versatz[2] * spitzeLaenge]);
      for (let i = 0; i < s; i++) t(apex, rand[i], rand[(i + 1) % s], 'spitze');
      return;
    }
    const n = art === 'ringe' ? Math.max(1, ringe) : 1;
    const R = rand.map(i => [punkte[i * 3], punkte[i * 3 + 1], punkte[i * 3 + 2]]);
    let innen = null;
    const c = p(mitte);
    for (let j = 1; j <= n; j++) {
      const f = j / n;
      const ring = j === n ? rand : R.map(q => p([mitte[0] + (q[0] - mitte[0]) * f, mitte[1] + (q[1] - mitte[1]) * f, mitte[2] + (q[2] - mitte[2]) * f]));
      const m = n === 1 && art !== 'ringe' ? 'rinde' : 'ring' + (j - 1);
      for (let i = 0; i < s; i++) {
        const i2 = (i + 1) % s;
        if (!innen) t(c, ring[i], ring[i2], m);
        else { t(innen[i], ring[i], ring[i2], m); t(innen[i], ring[i2], innen[i2], m); }
      }
      innen = ring;
    }
  }

  /**
   * Röhre entlang pfad [[x,y,z]…] mit radien[] (je Pfadpunkt).
   * opts: anfang/ende 'zu'|'spitze'|'ringe'|'offen', ringe (Anzahl Jahresringe), spitze (Länge),
   *       zacken (Länge der Splitter am Ende), form(k, s, winkel) -> Radiusfaktor, dreh (Startwinkel)
   */
  function roehre(pfad, radien, segmente, opts = {}) {
    const { anfang = 'zu', ende = 'zu', ringe = 3, spitze = 0, zacken = 0, form = () => 1, dreh = 0 } = opts;
    const ringIdx = [];
    let ref = [0, 1, 0];
    for (let k = 0; k < pfad.length; k++) {
      const vor = pfad[Math.min(k + 1, pfad.length - 1)], nach = pfad[Math.max(k - 1, 0)];
      const tg = norm(sub(vor, nach));
      if (Math.abs(tg[1]) > 0.9) ref = [1, 0, 0];
      const u = norm(kreuz(tg, ref)), v = kreuz(tg, u);
      const ring = [];
      for (let s = 0; s < segmente; s++) {
        const a = dreh + s / segmente * Math.PI * 2, r = radien[k] * form(k, s, a);
        const ca = Math.cos(a) * r, sa = Math.sin(a) * r;
        ring.push(p([pfad[k][0] + u[0] * ca + v[0] * sa, pfad[k][1] + u[1] * ca + v[1] * sa, pfad[k][2] + u[2] * ca + v[2] * sa]));
      }
      ringIdx.push(ring);
    }
    for (let k = 0; k < pfad.length - 1; k++) for (let s = 0; s < segmente; s++) {
      const a = ringIdx[k][s], b = ringIdx[k][(s + 1) % segmente], c = ringIdx[k + 1][s], d = ringIdx[k + 1][(s + 1) % segmente];
      tri(a, b, c, 'rinde'); tri(b, d, c, 'rinde');
    }
    const L = pfad.length - 1;
    const tA = norm(sub(pfad[0], pfad[1])), tE = norm(sub(pfad[L], pfad[L - 1]));
    if (zacken > 0) ringIdx[L].forEach((i, s) => {   // gesplittertes Ende: Randpunkte ungleich weit hinaus
      const z = zacken * (s % 2 ? 1 : 0.25) * (0.6 + 0.4 * Math.abs(Math.sin(s * 2.7 + dreh * 5)));
      for (let a = 0; a < 3; a++) punkte[i * 3 + a] += tE[a] * z;
    });
    const mitteRing = idx => idx.reduce((m, i) => [m[0] + punkte[i * 3] / idx.length, m[1] + punkte[i * 3 + 1] / idx.length, m[2] + punkte[i * 3 + 2] / idx.length], [0, 0, 0]);
    if (anfang !== 'offen') kappe(ringIdx[0], mitteRing(ringIdx[0]), anfang, ringe, false, spitze, tA);
    if (ende !== 'offen') kappe(ringIdx[L], mitteRing(ringIdx[L]), ende, ringe, true, spitze, tE);
    return ringIdx;
  }

  return { roehre, punkte, dreiecke, marken };
}
