/**
 * @modul    figur-koerper-kopf
 * @zweck    Hals und Kopf der organischen Figur als SDF-Körper: Schädel, Kiefer/Kinn, Wangenknochen, Brauenbogen, Augenhöhlen (passend zu den starren Augäpfeln), Nase, Ohren (Mund = Mimik-Mesh)
 * @api      baueKopfForm(form, ctx, hilfe) -> form
 * @beispiel
 *   import { baueKopfForm } from '../../engine/models/character/figur-koerper-kopf.js';
 *   baueKopfForm(form, ctx, hilfe);   // wird von baueKoerperForm (figur-koerper) aufgerufen
 * @tags     figur, charakter, organisch, sdf, kopf, gesicht, hals
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Kopf-Raum wie character-parts-kopf: Kopfkugel-Mitte bei (0, R, 0) im Knochen kopf, Gesicht +Z, links +X.
 * Augäpfel (AUGE: ±0.34R, 1.02R, 0.86R, Radius 0.17R, z × 0.55) bleiben starre Meshes → hier nur Lider-Rahmen/Höhle.
 * Mimik (Brauen z ≈ 0.88R, Mund y ≈ 0.52R) liegt auf der Gesichtsfläche bei z ≈ 0.86–0.9R.
 */
import { AUGE } from './character-parts-kopf.js';

/**
 * hilfe = { E(kn, p, radien, o), C(knA, a, knB, b, ra, rb, o), mix(a, b, t), haut, kind (0…1) } aus figur-koerper.
 */
export function baueKopfForm(form, K, H) {
  const { R, g, m, L } = K, { E, C, mix } = H, mu = L.koerper.muskeln, kind = H.kind;
  const haut = H.haut, rot = mix(K.f.haut, 0xc04848, 0.15);
  const kn = 'kopf', o = (x = {}) => ({ knochen: kn, farbe: haut, haut: true, ...x });

  // Hals: unten am Rumpf (torso → hals), oben am Kopf (kopf). Gewicht je nach Höhe in der Bindungs-Pose.
  const yHals = K.P('hals')[1], yKopf = K.P('kopf', [0, R * 0.5, 0])[1];
  const halsGewicht = (x, y) => {
    const t = Math.min(1, Math.max(0, (y - yHals) / (yKopf - yHals)));
    return y < yHals ? { hals: 0.6, torso: 0.4 } : { hals: 1 - t * 0.75, kopf: t * 0.75 };
  };
  const halsR = 0.058 * g * (1 + 0.2 * mu) * (1 + 0.1 * kind);
  C('torso', [0, m.torsoLaenge - 0.06 * g, -0.012 * g], kn, [0, R * 0.45, -R * 0.22], halsR * 1.12, halsR * 0.95,
    { knochen: halsGewicht, farbe: haut, haut: true, glatt: 0.03 * g });

  // Schädel: etwas länger nach hinten, Hut-Kugel (R um (0,R,0)) bleibt passend
  E(kn, [0, R * 1.1, -R * 0.07], [R * 0.9, R * 0.96, R * 0.98], o({ glatt: 0.02 * g }));
  // Gesichtsschale (Stirn → Oberkiefer): Vorderfläche bei z ≈ 0.86R auf Augenhöhe
  E(kn, [0, R * 0.94, R * 0.3], [R * 0.84, R * 0.66, R * 0.6], o({ glatt: R * 0.2 }));
  // Kiefer + Kinn (Kinder: weicher, runder)
  E(kn, [0, R * 0.5, R * 0.3], [R * (0.62 + 0.08 * kind), R * 0.42, R * 0.58], o({ glatt: R * 0.3, dreh: [-0.35, 0, 0] }));

  // Wangenknochen (leicht gerötet)
  for (const s of [-1, 1]) E(kn, [s * R * 0.42, R * 0.78, R * 0.62], [R * 0.25, R * 0.16, R * 0.27], o({ farbe: rot, glatt: R * 0.2 }));

  // Brauenbogen: ein Wulst über beide Augen (Erwachsene deutlicher)
  C(kn, [-R * 0.48, R * 1.22, R * 0.76], kn, [R * 0.48, R * 1.22, R * 0.76], R * (0.12 - 0.03 * kind), R * (0.12 - 0.03 * kind), o({ glatt: R * 0.2 }));

  // Augenhöhlen: weich abziehen, so dass die Augäpfel bündig im Lidrahmen sitzen
  for (const s of [-1, 1]) {
    E(kn, [s * R * AUGE.x, R * (AUGE.y + 0.01), R * (AUGE.z + 0.07)], [R * 0.19, R * 0.155, R * 0.1],
      o({ abzug: true, farbe: mix(K.f.haut, 0x402020, 0.25), glatt: R * 0.1 }));
  }

  // Nase: Rücken + Spitze, Nasenflügel
  C(kn, [0, R * 1.02, R * 0.86], kn, [0, R * 0.78, R * 1.0], R * 0.06, R * 0.11, o({ farbe: mix(haut, rot, 0.4), glatt: R * 0.14 }));


  // Ohren
  for (const s of [-1, 1]) {
    E(kn, [s * R * 0.9, R * 0.95, -R * 0.05], [R * 0.1, R * 0.23, R * 0.15], o({ farbe: rot, glatt: R * 0.08, dreh: [0, s * 0.35, s * -0.1] }));
  }
  return form;
}
