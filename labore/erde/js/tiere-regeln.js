// Tiere – reine Regeln (ohne THREE): Arten, Wild je Biom, deterministische Gebiets-Zellen, Verhalten, Jagd, Beute.
// Darstellung und Bewegung auf der Kugel: tiere.js. Test: tests/erde-tiere.test.mjs
import { rng, hashSeed, weighted, int } from '../../../engine/core/rng.js';

/** Arten. Tempo in m/s, Abstände in m, Schaden in Lebenspunkten des Spielers, takt = s zwischen zwei Bissen. */
export const ARTEN = Object.freeze({
  reh: { name: 'Reh', mehrzahl: 'Rehe', leben: 3, gehen: 1.1, rennen: 9, flucht: 25, radius: 0.4, hoehe: 0.95, schritt: 0.55,
    beute: [['fleisch', 3], ['fell', 2], ['knochen', 2]], rudel: [1, 3] },
  hase: { name: 'Hase', mehrzahl: 'Hasen', leben: 1, gehen: 0.7, rennen: 11, flucht: 12, radius: 0.25, hoehe: 0.28, schritt: 0.45,
    beute: [['fleisch', 1], ['fell', 1]], rudel: [1, 2] },
  keiler: { name: 'Keiler', mehrzahl: 'Keiler', leben: 6, gehen: 0.9, rennen: 6.5, angriff: 8, radius: 0.5, hoehe: 0.6, schritt: 0.45,
    schaden: 8, takt: 1.6, beute: [['fleisch', 5], ['fell', 2], ['knochen', 3]], rudel: [1, 2] },
  wolf: { name: 'Wolf', mehrzahl: 'Wölfe', leben: 4, gehen: 1.3, rennen: 7.5, flucht: 30, jagd: 90, radius: 0.4, hoehe: 0.55, schritt: 0.6,
    schaden: 4, takt: 1.5, beute: [['fleisch', 2], ['fell', 2], ['knochen', 1]], rudel: [2, 4] },
});

// Wild je Biom (Index wie klima.js BIOM): dichte = Chance auf ein Rudel je Zelle, arten = [[art, gewicht]]
const WALD = { dichte: 0.38, arten: [['reh', 3], ['hase', 2], ['keiler', 1.6], ['wolf', 1]] };
export const WILD = Object.freeze([
  { dichte: 0.04, arten: [['wolf', 1]] },                                   // Eis
  { dichte: 0.22, arten: [['hase', 3], ['wolf', 1.2]] },                    // Tundra
  { dichte: 0.32, arten: [['hase', 2], ['wolf', 1.4], ['reh', 0.6]] },      // Nadelwald (Taiga)
  WALD,                                                                     // Mischwald
  WALD,                                                                     // Laubwald
  { dichte: 0.38, arten: [['hase', 3], ['reh', 2]] },                       // Grasland
  { dichte: 0.26, arten: [['hase', 3], ['reh', 1]] },                       // Steppe
  { dichte: 0.05, arten: [['hase', 1]] },                                   // Wüste
  { dichte: 0.26, arten: [['hase', 2], ['reh', 1]] },                       // Savanne
  { dichte: 0.35, arten: [['keiler', 2], ['reh', 1], ['hase', 1]] },        // Regenwald
]);

export const ZELLE = 64;          // m – Kantenlänge der Gebiets-Zellen (Würfel um die Meeresspiegel-Kugel)
export const AKTIV = 150;         // m – nur in diesem Umkreis um den Spieler gibt es Tiere
export const WIEDERKEHR = 12;     // Spielstunden, bis ein erlegtes Tier wieder da ist

/** Rudel für eine Zelle wählen (r = rng der Zelle) → { art, anzahl } | null. wasser = Ort liegt im Wasser. */
export function wildWahl(biomNr, r, wasser = false) {
  const w = WILD[biomNr];
  if (wasser || !w || r() >= w.dichte) return null;
  const art = weighted(r, w.arten);
  const [a, b] = ARTEN[art].rudel;
  return { art, anzahl: int(r, a, b) };
}

/** Alle Zellen [ix,iy,iz], deren Würfel die Kugel um p (Punkt auf der R-Kugel, m) mit Radius radius berührt. */
export function zellenUm(p, radius, Z = ZELLE) {
  const aus = [], r2 = radius * radius;
  const lo = (v) => Math.floor((v - radius) / Z), hi = (v) => Math.floor((v + radius) / Z);
  const ab = (v, i) => { const a = i * Z, b = a + Z; return v < a ? a - v : v > b ? v - b : 0; };
  for (let ix = lo(p.x); ix <= hi(p.x); ix++) {
    const dx = ab(p.x, ix);
    for (let iy = lo(p.y); iy <= hi(p.y); iy++) {
      const dy = ab(p.y, iy);
      if (dx * dx + dy * dy > r2) continue;
      for (let iz = lo(p.z); iz <= hi(p.z); iz++) {
        const dz = ab(p.z, iz);
        if (dx * dx + dy * dy + dz * dz <= r2) aus.push([ix, iy, iz]);
      }
    }
  }
  return aus;
}

/**
 * Deterministischer Platz eines Rudels in Zelle (ix,iy,iz): zufälliger Punkt im Würfel, auf die R-Kugel gelegt.
 * Nur wenn er dabei in derselben Zelle landet (so gehört jeder Ort der Oberfläche zu genau einer Zelle).
 * → { schluessel, dir:[x,y,z] (Einheitsrichtung), r (rng der Zelle für Art/Anzahl/Glieder) } | null
 */
export function zellPunkt(ix, iy, iz, R, seed, Z = ZELLE) {
  const r = rng(hashSeed(seed, 'tiere', ix, iy, iz));
  const x = (ix + r()) * Z, y = (iy + r()) * Z, z = (iz + r()) * Z;
  const l = Math.hypot(x, y, z);
  if (l < 1e-6) return null;
  const px = x / l * R, py = y / l * R, pz = z / l * R;
  if (Math.floor(px / Z) !== ix || Math.floor(py / Z) !== iy || Math.floor(pz / Z) !== iz) return null;
  return { schluessel: `${ix},${iy},${iz}`, dir: [x / l, y / l, z / l], r };
}

/**
 * Verhalten: was tut ein Tier gerade? → 'ruhe' (grasen/wandern) | 'fliehen' | 'angriff'
 * lage = { abstand (m zum Spieler), nacht, gereizt (wurde getroffen), leben (Anteil 0…1), modus (bisher) }
 */
export function entscheide(art, { abstand, nacht = false, gereizt = false, leben = 1, modus = 'ruhe' }) {
  const a = ARTEN[art];
  if (art === 'keiler') {
    if (leben < 0.34) return abstand < 40 ? 'fliehen' : 'ruhe';
    if (abstand < a.angriff || (gereizt && abstand < 30) || (modus === 'angriff' && abstand < 20)) return 'angriff';
    return 'ruhe';
  }
  if (art === 'wolf') {
    if (leben < 0.3) return abstand < 50 ? 'fliehen' : 'ruhe';
    if (nacht || gereizt) return abstand < a.jagd || (modus === 'angriff' && abstand < a.jagd * 1.5) ? 'angriff' : 'ruhe';
    return abstand < (modus === 'fliehen' ? a.flucht * 1.8 : a.flucht) ? 'fliehen' : 'ruhe';
  }
  // Fluchttiere: einmal aufgescheucht laufen sie weiter, bis sie doppelt so weit weg sind
  const grenze = gereizt ? a.flucht * 3 : modus === 'fliehen' ? a.flucht * 2 : a.flucht;
  return abstand < grenze ? 'fliehen' : 'ruhe';
}

/** Waffe aus dem Inventar (hat(id) → bool): Speer > Axt > Faust. */
export function waffe(hat) {
  if (hat('speer')) return { id: 'speer', name: 'Speer', schaden: 3, reichweite: 4 };
  if (hat('axt')) return { id: 'axt', name: 'Axt', schaden: 2, reichweite: 3 };
  return { id: 'faust', name: 'Faust', schaden: 1, reichweite: 3 };
}

/**
 * Blickstrahl o + t·d (d Einheitsvektor) gegen Tiere ziele = [{x,y,z,r}] (Körpermitte, Radius).
 * Treffer, wenn der Strahl den Körper streift und t ≤ reichweite + r. → { i, t } (nächster) | null
 */
export function strahlTreffer(o, d, ziele, reichweite) {
  let best = null;
  for (let i = 0; i < ziele.length; i++) {
    const z = ziele[i];
    const vx = z.x - o.x, vy = z.y - o.y, vz = z.z - o.z;
    const t = vx * d.x + vy * d.y + vz * d.z;
    if (t < 0 || t > reichweite + z.r) continue;
    const q = vx * vx + vy * vy + vz * vz - t * t;
    if (q > z.r * z.r) continue;
    if (!best || t < best.t) best = { i, t };
  }
  return best;
}

/** Schlag auf ein Tier → { leben, tot, beute: [[id, n]] (nur wenn tot) } */
export function schlag(art, leben, schaden) {
  const rest = Math.max(0, leben - schaden);
  return { leben: rest, tot: rest <= 0, beute: rest <= 0 ? ARTEN[art].beute.map(([id, n]) => [id, n]) : [] };
}

/** Ist ein erlegtes Tier wieder da? (Spielstunden) */
export const wiederDa = (totSeit, jetzt) => totSeit == null || jetzt - totSeit >= WIEDERKEHR;

/** HUD-Zeile aus { art: anzahl } → „Tiere: 3 Rehe, 1 Keiler in der Nähe“ (oder '') */
export function hudZeile(zaehl) {
  const teile = Object.keys(ARTEN).filter((a) => zaehl[a] > 0).map((a) => `${zaehl[a]} ${zaehl[a] === 1 ? ARTEN[a].name : ARTEN[a].mehrzahl}`);
  return teile.length ? `Tiere: ${teile.join(', ')} in der Nähe` : '';
}
