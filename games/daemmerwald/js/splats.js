// Dämmerwald – alle Gauß-Splats in EINER Wolke (engine/render/gauss-wolke.js): Laub/Moos/Flechten der Riesen (je Instanz, nach Pfad-Nähe ausgedünnt),
// Bodendunst-Schwaden, Moos-/Farnteppich neben dem Pfad, Staub in den Lichtbahnen, Schein der Leuchtpilze. Nur Aussehen – abschaltbar mit ?splats=0.
import * as THREE from 'three';
import { createGaussWolke } from '../../../engine/render/gauss-wolke.js';
import { createSplatDaten, saatAufNetz } from '../../../engine/render/gauss-saat.js';
import { rng, hashSeed, hash2 } from '../../../engine/core/rng.js';
import { pfadAbstand, pfadX, PFAD_ENDE, PFAD_BREITE, stammRadiusVon } from './plan-daten.js';
import { SONNE, DUNST_DICHTE } from './licht.js';

// ACES wie in three (Tonemapping der Wolke läuft NACH dem Nebel-Mischen, bei Meshes davor) → Nebelfarbe so vor-entzerren, dass beide gleich aussehen
function aces(c, belichtung) {
  const e = belichtung / 0.6, r = c[0] * e, g = c[1] * e, b = c[2] * e;
  const a = [0.59719 * r + 0.35458 * g + 0.04823 * b, 0.076 * r + 0.90834 * g + 0.01566 * b, 0.0284 * r + 0.13383 * g + 0.83777 * b]
    .map((v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081));
  return [1.60475 * a[0] - 0.53108 * a[1] - 0.07367 * a[2], -0.10208 * a[0] + 1.10813 * a[1] - 0.00605 * a[2], -0.00327 * a[0] - 0.07276 * a[1] + 1.07602 * a[2]].map((v) => Math.min(1, Math.max(0, v)));
}
/** Lineare Farbe, die nach ACES + sRGB wie `ziel` (THREE.Color, als sRGB angezeigt) aussieht. */
export function vorTonemapping(ziel, belichtung = 1) {
  const soll = [ziel.r, ziel.g, ziel.b], x = soll.slice();          // ziel.r/g/b sind linear = das, was nach dem Tonemapping herauskommen soll
  for (let i = 0; i < 24; i++) { const ist = aces(x, belichtung); for (let k = 0; k < 3; k++) x[k] *= Math.pow((soll[k] + 1e-4) / (ist[k] + 1e-4), 0.8); }
  return new THREE.Color(x[0], x[1], x[2]);
}

/** Dünnt Splat-Daten aus und gleicht die Fläche über größere Splats aus; mischt hohe Splats leicht in den Dunst.
 *  Kronen-Laub (y > kronenAb) ist nur noch weicher Rand um die Blatt-Karten (kronen.js): ausgedünnt und durchsichtiger, kein Blob-Nebel. */
const KRONE = { ab: 44, rest: 0.3, deck: 0.45 };
function stufe(daten, anteil, seed, dunst, { ab = 60, bis = 150, max = 0.4 } = {}) {
  const s = createSplatDaten(Math.ceil(daten.anzahl * anteil) + 16), gross = Math.min(2.4, Math.pow(anteil, -0.42));
  const { position: p, skala: k, drehung: q, farbe: f, deck: d, wind: w } = daten;
  for (let i = 0; i < daten.anzahl; i++) {
    if (anteil < 1 && hash2(i, 17, seed) >= anteil) continue;
    const y = p[i * 3 + 1], krone = y > KRONE.ab && Math.max(k[i * 3], k[i * 3 + 1], k[i * 3 + 2]) >= 1.2;
    if (krone && hash2(i, 41, seed) >= KRONE.rest) continue;
    const t = Math.min(1, Math.max(0, (y - ab) / (bis - ab))), h = t * t * (3 - 2 * t) * max, g = y > 20 ? gross : Math.min(gross, 1.5);
    let fr = f[i * 3], fg = f[i * 3 + 1], fb = f[i * 3 + 2];
    const hellig = 0.3 * fr + 0.6 * fg + 0.1 * fb;                      // sehr helle Tupfer (Flechten) wirken im Dämmerlicht wie Schnee → dämpfen
    if (hellig > 0.11) { const m = 0.11 / hellig; fr *= m; fg *= m; fb *= m; }
    const klein = Math.max(k[i * 3], k[i * 3 + 1], k[i * 3 + 2]) < 1.2;       // kleine Tupfer nicht aufhellen (sähe aus wie Schnee), sondern ausblenden
    s.plus(p[i * 3], y, p[i * 3 + 2], k[i * 3] * g, k[i * 3 + 1] * g, k[i * 3 + 2] * g, q[i * 4], q[i * 4 + 1], q[i * 4 + 2], q[i * 4 + 3],
      klein ? fr : fr + (dunst.r / LICHT - fr) * h, klein ? fg : fg + (dunst.g / LICHT - fg) * h, klein ? fb : fb + (dunst.b / LICHT - fb) * h, d[i] * (klein ? 1 - h : 1 - 0.35 * h) * (krone ? KRONE.deck : 1), w[i]);
  }
  return s.fertig();
}
const LICHT = 0.62;
const STUFEN = [1, 0.62, 0.38, 0.22, 0.12, 0.06];

/** opts: { szene, budget, maxPixel, belichtung, dunstFarbe (THREE.Color) } → { wolke, anzahl, teile, fuegeBaeume(wald), fuegeSzene(…), setzeLicht(dunst, faktor), update(kamera, zeit, b, h), dispose() } */
export function createSplats({ szene, budget = 90000, maxPixel = 220, belichtung = 1, dunstFarbe, seed = 1 }) {
  const wolke = createGaussWolke({ max: budget, sortiereAlle: 3, maxPixel });
  const dunst = vorTonemapping(dunstFarbe, belichtung);
  wolke.setze({ nebelFarbe: dunst, nebelDichte: DUNST_DICHTE, licht: [LICHT, LICHT, LICHT], wind: 0.5 });   // Splats bekommen keinen Schatten → insgesamt gedämpft
  szene.add(wolke.mesh);
  const teile = { baeume: 0, moos: 0, dunst: 0, staub: 0 };

  /** Splats der Riesen: nah am Pfad voll, fern ausgedünnt; zusammen höchstens `anteilBudget` des Budgets. */
  function fuegeBaeume(wald, anteilBudget = 0.8) {
    const mit = wald.instanzen.filter((i) => i.v.splats?.anzahl);
    if (!mit.length) return 0;
    const gewicht = (i) => { const d = pfadAbstand(i.x, i.z); return i.held || d < 36 ? 1 : Math.min(1, Math.max(0.1, 1.15 - d / 105)); };
    const summe = mit.reduce((s, i) => s + i.v.splats.anzahl * gewicht(i), 0), faktor = Math.min(1, (budget * anteilBudget) / summe);
    const lager = new Map();
    for (const i of mit.sort((a, b) => pfadAbstand(a.x, a.z) - pfadAbstand(b.x, b.z))) {
      const soll = gewicht(i) * faktor, st = STUFEN.find((s) => s <= soll * 1.15) ?? STUFEN.at(-1), schluessel = i.variante + ':' + st;
      if (!lager.has(schluessel)) lager.set(schluessel, stufe(i.v.splats, st, 100 + i.variante, dunst));
      teile.baeume += wolke.fuege(lager.get(schluessel), { matrix: i.matrix, anteil: Math.min(1, soll / st) });
    }
    return teile.baeume;
  }

  /** Splats aus der Szene selbst. gelaende: createGelaende, riesen: Liste, bahnen: Lichtbahnen, pilze: [{x,y,z,s}] */
  function fuegeSzene({ gelaende, riesen, bahnen = [], pilze = [] }) {
    const r = rng(hashSeed('splats', seed)), frei = Math.max(0, budget - wolke.anzahl);
    // 1) Moos- und Farnteppich neben dem Pfad
    const saat = createSplatDaten(4096), nMoos = Math.min(Math.floor(frei * 0.75), Math.round(budget * 0.14));
    saatAufNetz(saat, gelaende.netzStreifen({ breite: 12, schritt: 2 }), { anzahl: nMoos, seed: 5, groesse: [0.07, 0.2], flach: 0.4, abheben: 0.05, deck: 0.9, wind: 0.25,
      farbe: (x, y, z, nx, ny, nz, zf) => {
        const d = pfadAbstand(x, z);
        if (d < PFAD_BREITE * 0.62 || y < 0.6 || zf > 1.25 - d / 16) return null;
        for (const b of riesen) if (Math.hypot(b.x - x, b.z - z) < stammRadiusVon(b) * 1.2) return null;
        const k = 0.55 + 0.9 * zf, farn = zf > 0.7;
        return farn ? [0.07 * k, 0.11 * k, 0.06 * k] : [0.09 * k, 0.105 * k, 0.055 * k];
      } });
    teile.moos = wolke.fuege(saat.fertig());
    // 2) Bodendunst: sehr große, sehr schwach deckende Schwaden in Bodennähe (wenige – Überzeichnung ist teuer)
    const luft = createSplatDaten(256), hell = [dunst.r * 1.1 / LICHT, dunst.g * 1.1 / LICHT, dunst.b * 1.08 / LICHT];
    for (let i = 0; i < 70; i++) {
      const z = 24 + r() * (PFAD_ENDE - 10), x = pfadX(z) + (r() - 0.5) * 110, y = gelaende.bodenHoehe(x, z);
      luft.plus(x, y + 1.0 + r() * 2.2, z, 9 + r() * 9, 0.8 + r() * 0.9, 7 + r() * 8, 0, Math.sin(r() * 3), 0, Math.cos(r() * 3), hell[0], hell[1], hell[2], 0.07 + r() * 0.06, 0.6);
    }
    for (let i = 0; i < 10; i++) luft.plus((r() - 0.5) * 300, 0.9 + r(), -20 - r() * 150, 22 + r() * 16, 0.7, 12 + r() * 8, 0, 0, 0, 1, hell[0], hell[1], hell[2], 0.07, 0.3);
    teile.dunst = wolke.fuege(luft.fertig());
    // 3) Staub in den Lichtbahnen + Schein der Leuchtpilze
    const staub = createSplatDaten(1024), warm = vorTonemapping(new THREE.Color(0xffe2b0), belichtung);
    for (const b of bahnen) for (let i = 0; i < 10; i++) {
      const t = r() * Math.min(26, b.laenge), ri = b.richtung || SONNE, g = 0.02 + r() * 0.03;
      staub.plus(b.x + ri.x * t + (r() - 0.5) * b.breite * 0.7, b.y + ri.y * t + (r() - 0.5) * 2, b.z + ri.z * t + (r() - 0.5) * b.breite * 0.7, g, g, g, 0, 0, 0, 1, warm.r / LICHT, warm.g / LICHT, warm.b / LICHT, 0.3, 1);
    }
    const tuerkis = vorTonemapping(new THREE.Color(0x48d8c8), belichtung);
    for (const p of pilze) staub.plus(p.x, p.y + 0.05, p.z, 0.3, 0.2, 0.3, 0, 0, 0, 1, tuerkis.r / LICHT, tuerkis.g / LICHT, tuerkis.b / LICHT, 0.16, 0);
    teile.staub = wolke.fuege(staub.fertig());
  }

  return {
    wolke, teile, fuegeBaeume, fuegeSzene,
    get anzahl() { return wolke.anzahl; },
    /** Tageszeit: dunst = THREE.Color (wie szene.fog), faktor = [r, g, b] relativ zum Standard-Look (Splats sind unbeleuchtet). */
    setzeLicht(dunstNeu, faktor) {
      wolke.setze({ nebelFarbe: vorTonemapping(dunstNeu, belichtung), licht: [LICHT * faktor[0], LICHT * faktor[1], LICHT * faktor[2]] });
    },
    update(kamera, zeit, breite, hoehe) { wolke.update(kamera, zeit, breite, hoehe); },
    dispose() { szene.remove(wolke.mesh); wolke.dispose(); },
  };
}
