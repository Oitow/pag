/**
 * @modul    character-parts-kopf
 * @zweck    Bau-Funktion für den Figuren-Kopf: Kopfform, Ohren, Nase, festes Gesicht (oder nur Augäpfel, wenn das bewegliche Gesicht aktiv ist), Frisur, Bart, Brille, Ohrringe; bündelt Kopfbedeckungen
 * @api      baueKopf(b,ctx) -> b ; baueKopfbedeckung(b,ctx) -> b ; deckendeKopfbedeckung(stil) -> bool ; AUGE -> { x, y, z, r, sz } (Augen-Lage in Einheiten von R)
 * @beispiel
 *   import { baueKopf, baueKopfbedeckung } from '../../engine/models/character/character-parts-kopf.js';
 *   const ctx = teilKontext(look, masse);
 *   rig.knochen.kopf.add(baueKopf(createMeshBuilder({ seed }), ctx).mesh());
 * @tags     figur, charakter, kopf, gesicht, haar, frisur, bart, hut, helm, krone, brille
 * @version  1.1.0
 * @status   entwurf
 * @three    ja
 *
 * 1.1: Frisuren/Bärte → character-parts-haar, Kopfbedeckungen → character-parts-hut (hier weiter exportiert);
 *      Brille + Ohrringe; ctx.mimik = true → nur Augäpfel (Iris, Lider, Brauen, Mund baut character-parts-gesicht).
 */
import { farbeMisch, dunkler } from './character-parts-basis.js';
import { baueFrisur, baueBart } from './character-parts-haar.js';
import { baueBrille, baueOhrringe } from './character-parts-zubehoer.js';

export { baueKopfbedeckung, deckendeKopfbedeckung } from './character-parts-hut.js';

/** Lage der Augen relativ zur Kopfkugel (× R): Mitte (±x, y, z), Augapfel-Radius r, Tiefen-Stauchung sz. */
export const AUGE = Object.freeze({ x: 0.34, y: 1.02, z: 0.86, r: 0.17, sz: 0.55 });

/** Kopf im Knochen kopf: Kugel zentriert bei y = R, Gesicht nach +Z. */
export function baueKopf(b, K) {
  const { R, f } = K, haut = f.haut;
  b.sphere(R, haut, { y: R, sy: 1.04, jitter: 0.04 }, 11, 8);
  b.sphere(R * 0.72, haut, { y: R * 0.62, z: R * 0.2, sx: 1.05, sz: 1.0, jitter: 0.04 }, 8, 5);        // Kiefer/Wangen
  for (const s of [-1, 1]) {
    const x = s * R * AUGE.x;
    if (K.mimik) b.sphere(R * AUGE.r, 0xf4efe6, { x, y: R * AUGE.y, z: R * AUGE.z, sz: AUGE.sz, jitter: 0 }, 7, 5);   // nur Augapfel
    else {
      b.sphere(R * 0.17, 0xf4efe6, { x, y: R * 1.02, z: R * 0.86, sz: 0.5, jitter: 0 }, 6, 4);         // Augapfel
      b.sphere(R * 0.115, f.augen, { x, y: R * 1.0, z: R * 0.92, sz: 0.45, jitter: 0 }, 6, 4);          // Iris
      b.sphere(R * 0.035, 0xffffff, { x: x - R * 0.04, y: R * 1.05, z: R * 0.97, jitter: 0 }, 4, 2);   // Glanzpunkt
      b.box(R * 0.3, R * 0.07, R * 0.08, dunkler(f.haar, 0.1), { x: s * R * 0.36, y: R * 1.27, z: R * 0.88, rz: s * 0.15 }); // Braue
    }
    b.sphere(R * 0.2, haut, { x: s * R * 0.97, y: R * 0.95, z: -R * 0.05, sx: 0.45, sy: 1.1 }, 5, 4);  // Ohr
    b.sphere(R * 0.13, farbeMisch(haut, 0xd05050, 0.35), { x: s * R * 0.54, y: R * 0.7, z: R * 0.74, sz: 0.3, jitter: 0 }, 5, 3); // Wange
  }
  b.sphere(R * 0.14, dunkler(haut, 0.06), { y: R * 0.82, z: R * 0.98, sy: 1.15, sz: 1.1 }, 5, 4);     // Nase
  if (!K.mimik) b.box(R * 0.24, R * 0.045, R * 0.05, farbeMisch(haut, 0x5a1a1a, 0.6), { y: R * 0.52, z: R * 0.9 });   // Mund
  baueFrisur(b, K);
  baueBart(b, K);
  baueBrille(b, K);
  baueOhrringe(b, K);
  return b;
}
