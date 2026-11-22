/**
 * @modul    riesenwald-plan
 * @zweck    Plan eines Riesenwalds als reine Daten (ohne THREE): Urwald-Riesen in Reihen entlang von Wegen (Weg bleibt frei), Tor-Paar links/rechts am Waldeingang, Kranz um eine Lichtung, Hinterland bis zu einer Tiefe aufgefüllt – deterministisch per Seed
 * @api      planeRiesenwald({ wege, imGebiet(x,z), varianten [{radius,weite}], seed, wegBreite=3, tor, lichtung, tiefe=150, abstand=26, max=220, frei(x,z,r)? }) -> { riesen [{x,z,variante,skala,drehung,radius,weite,reihe,held,seite}], tor { x,z,richtung,links,rechts } | null } ; wegAbstand(wege,x,z) -> { d, x, z, rx, rz } ; wegPunkt(weg, s) -> { x, z, rx, rz } | null ; wegLaenge(weg) -> m
 * @beispiel
 *   import { planeRiesenwald } from '../../engine/world/riesenwald-plan.js';
 *   const plan = planeRiesenwald({ wege: welt.wege, imGebiet: (x, z) => welt.region(x, z).id === 'daemmerwald',
 *     varianten: [{ radius: 4.2, weite: 16 }, { radius: 5.6, weite: 21 }], seed: 7, tor: welt.ort('tor') });
 *   for (const r of plan.riesen) welt.kollision.fuege({ form: 'kreis', x: r.x, z: r.z, radius: r.radius });
 * @tags     wald, riesenbaum, urwald, platzierung, weg, worldgen, daemmerwald, plan
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { rng, hashSeed } from '../core/rng.js';

/** Länge einer Polylinie [{x,z},…] in m. */
export function wegLaenge(weg) {
  let l = 0;
  for (let i = 1; i < weg.length; i++) l += Math.hypot(weg[i].x - weg[i - 1].x, weg[i].z - weg[i - 1].z);
  return l;
}

/** Punkt bei Bogenlänge s (m) auf der Polylinie, mit Laufrichtung (rx, rz normiert). */
export function wegPunkt(weg, s) {
  for (let i = 1; i < weg.length; i++) {
    const a = weg[i - 1], b = weg[i], l = Math.hypot(b.x - a.x, b.z - a.z);
    if (l < 1e-6) continue;
    if (s <= l || i === weg.length - 1) {
      const t = Math.min(1, Math.max(0, s / l));
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, rx: (b.x - a.x) / l, rz: (b.z - a.z) / l };
    }
    s -= l;
  }
  return null;
}

/** Kleinster Abstand zu allen Wegen + nächster Punkt und Laufrichtung dort. */
export function wegAbstand(wege, x, z) {
  const o = { d: Infinity, x: 0, z: 0, rx: 0, rz: 1 };
  for (const weg of wege) for (let i = 1; i < weg.length; i++) {
    const a = weg[i - 1], b = weg[i], ex = b.x - a.x, ez = b.z - a.z, l2 = ex * ex + ez * ez;
    if (l2 < 1e-9) continue;
    const t = Math.min(1, Math.max(0, ((x - a.x) * ex + (z - a.z) * ez) / l2)), px = a.x + ex * t, pz = a.z + ez * t, d = Math.hypot(x - px, z - pz);
    if (d < o.d) { const l = Math.sqrt(l2); o.d = d; o.x = px; o.z = pz; o.rx = ex / l; o.rz = ez / l; }
  }
  return o;
}

/**
 * Riesen planen. varianten: je Variante Stamm-`radius` und Wurzel-`weite` in m (bei Skala 1). Reihe 0 = Tor/Helden, 1 = erste Reihe am Weg, 2 = Hinterland.
 * tor: {x,z} (nächster Wegpunkt bekommt links/rechts je einen großen Riesen, Stamm knapp neben dem Weg). lichtung: {x,z,radius} bleibt frei, Kranz drumherum.
 */
export function planeRiesenwald({ wege = [], imGebiet = () => true, varianten, seed = 1, wegBreite = 3, tor = null, lichtung = null,
  tiefe = 150, abstand = 26, max = 220, frei = null } = {}) {
  const r = rng(hashSeed('riesenwald', seed)), rr = (a, b) => a + (b - a) * r();
  const riesen = [], halb = wegBreite / 2;
  const groesste = varianten.reduce((g, v, i) => (v.radius > varianten[g].radius ? i : g), 0);

  function passt(x, z, R, { wegRand = 2, held = false } = {}) {
    if (!imGebiet(x, z)) return false;
    if (wegAbstand(wege, x, z).d < halb + R + wegRand) return false;
    if (lichtung && Math.hypot(x - lichtung.x, z - lichtung.z) < (lichtung.radius ?? 20) + R + 6) return false;
    for (const b of riesen) if (Math.hypot(b.x - x, b.z - z) < (held ? b.radius + R + 4 : Math.max(abstand, b.radius + R + 12))) return false;
    return !frei || frei(x, z, R);
  }
  function setze(x, z, v, skala, reihe, seite, extra = {}) {
    const V = varianten[v], b = { x, z, variante: v, skala, drehung: rr(0, Math.PI * 2), radius: V.radius * skala, weite: V.weite * skala, reihe, held: reihe === 0, seite, ...extra };
    riesen.push(b);
    return b;
  }

  // 1 · Tor: zwei Riesen links/rechts des Wegs am Waldeingang (Stamm-Rand ~3 m vom Wegrand)
  let torInfo = null;
  if (tor && wege.length) {
    const p = wegAbstand(wege, tor.x, tor.z);
    if (p.d < 60) {
      const nx = -p.rz, nz = p.rx, paar = [];
      for (const [seite, v] of [[1, groesste], [-1, (groesste + 1) % varianten.length]]) {
        const skala = 1.05, R = varianten[v].radius * skala, o = halb + R + 3;
        const x = p.x + nx * o * seite, z = p.z + nz * o * seite;
        if (passt(x, z, R, { wegRand: 1.5, held: true })) paar.push(setze(x, z, v, skala, 0, seite, { tor: true }));
      }
      torInfo = { x: p.x, z: p.z, richtung: Math.atan2(p.rx, p.rz), links: paar.find((b) => b.seite > 0) || null, rechts: paar.find((b) => b.seite < 0) || null };
    }
  }

  // 2 · Kranz um die Lichtung
  if (lichtung) {
    const lr = lichtung.radius ?? 20;
    for (let k = 0; k < 9; k++) {
      const w = (k / 9) * Math.PI * 2 + rr(-0.15, 0.15), v = Math.floor(r() * varianten.length), skala = rr(0.95, 1.15), R = varianten[v].radius * skala;
      const d = lr + R + rr(8, 16), x = lichtung.x + Math.sin(w) * d, z = lichtung.z + Math.cos(w) * d;
      if (passt(x, z, R, { held: true })) setze(x, z, v, skala, 0, 0, { lichtung: true });
    }
  }

  // 3 · Erste Reihe: beide Seiten, alle 22–34 m, Stamm so weit weg, dass die Wurzeln nur bis an den Wegrand reichen
  for (const weg of wege) {
    const L = wegLaenge(weg);
    for (const seite of [1, -1]) {
      for (let s = rr(0, 12); s < L && riesen.length < max; s += rr(22, 34)) {
        const p = wegPunkt(weg, s);
        if (!p) break;
        const v = Math.floor(r() * varianten.length), skala = rr(0.85, 1.15), R = varianten[v].radius * skala;
        const o = halb + R + varianten[v].weite * skala * rr(0.3, 0.55) + rr(0, 6);
        const x = p.x - p.rz * o * seite, z = p.z + p.rx * o * seite;
        if (passt(x, z, R)) setze(x, z, v, skala, 1, seite);
      }
    }
  }

  // 4 · Hinterland: zufällig im Band bis `tiefe` m neben den Wegen (dünner nach außen)
  const laengen = wege.map(wegLaenge), gesamt = laengen.reduce((a, b) => a + b, 0);
  for (let versuch = 0; versuch < 5000 && riesen.length < max && gesamt > 0; versuch++) {
    let s = r() * gesamt, w = 0;
    while (w < wege.length - 1 && s > laengen[w]) s -= laengen[w++];
    const p = wegPunkt(wege[w], s);
    if (!p) continue;
    const seite = r() < 0.5 ? 1 : -1, o = 30 + tiefe * Math.pow(r(), 0.8);
    const v = Math.floor(r() * varianten.length), skala = rr(0.85, 1.2), R = varianten[v].radius * skala;
    const x = p.x - p.rz * o * seite, z = p.z + p.rx * o * seite;
    if (passt(x, z, R)) setze(x, z, v, skala, o < 50 ? 1 : 2, seite);
  }
  return { riesen, tor: torInfo };
}
