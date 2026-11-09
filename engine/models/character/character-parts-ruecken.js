/**
 * @modul    character-parts-ruecken
 * @zweck    Bau-Funktionen für Rücken-Teile einer Figur: Umhang (kurz, lang, Kragen-Cape) am Sockel umhang, Rucksack am Sockel ruecken
 * @api      baueUmhang(b,ctx) -> b ; baueRucksack(b,ctx) -> b
 * @beispiel
 *   import { baueUmhang } from '../../engine/models/character/character-parts-ruecken.js';
 *   rig.sockel.umhang.add(baueUmhang(createMeshBuilder({ seed }), teilKontext(look, masse)).mesh());
 * @tags     figur, charakter, umhang, cape, rucksack
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { dunkler, mantelFlaeche } from './character-parts-basis.js';

/** Umhang (Sockel umhang, Nacken hinten): doppelseitige Schale, kurz bis Hüfte, lang bis Wade oder Kragen-Cape über die Schultern. */
export function baueUmhang(b, K) {
  const { g, w, m, f } = K, st = K.stil.umhang, lang = st === 'lang', kragen = st === 'kragen';
  const sockY = m.hueftHoehe + m.torsoAbstand + m.torsoLaenge - 0.03;
  const len = lang ? sockY - 0.3 * m.hueftHoehe : kragen ? 0.24 * g : 0.5 * g;
  const rO = 0.17 * g * w, rU = (lang ? 0.36 : kragen ? 0.3 : 0.24) * g * w;
  const bogen = Math.PI * (kragen ? 1.45 : 0.85), sz = kragen ? 0.78 : 0.7;
  mantelFlaeche(b, rO, rU, len, f.umhang, { y: -len / 2, z: rO * sz, sz, jitter: 0.1 }, { th0: Math.PI - bogen / 2, thL: bogen, doppelt: true });
  b.capsule(0.03 * g, rO * 1.3, dunkler(f.umhang, 0.1), { y: 0.005, z: 0.02 * g, rz: Math.PI / 2 }, 2, 6);    // Kragenrolle
  if (kragen) mantelFlaeche(b, rU * 1.01, rU * 1.01, 0.025 * g, dunkler(f.umhang, 0.25), { y: -len + 0.012 * g, z: rO * sz, sz }, { th0: Math.PI - bogen / 2, thL: bogen });
  return b;
}

/** Rucksack (Sockel ruecken): Sack mit Klappe, Deckenrolle oben, Riemen. */
export function baueRucksack(b, K) {
  const { g, w } = K, sack = 0x7a6448, gurt = 0x4a3424;
  b.box(0.24 * g * w, 0.28 * g, 0.13 * g, sack, { z: -0.065 * g, jitter: 0.12 });
  b.cyl(0.12 * g * w, 0.12 * g * w, 0.13 * g, sack, { y: 0.14 * g, z: -0.065 * g, rx: Math.PI / 2 }, 10);
  b.box(0.2 * g * w, 0.14 * g, 0.02 * g, dunkler(sack, 0.25), { y: 0.1 * g, z: -0.135 * g, rx: 0.1 });
  b.box(0.12 * g * w, 0.07 * g, 0.04 * g, dunkler(sack, 0.1), { y: -0.06 * g, z: -0.14 * g });
  b.cyl(0.045 * g, 0.045 * g, 0.3 * g * w, 0xa8946a, { y: 0.22 * g, z: -0.07 * g, rz: Math.PI / 2 }, 8);
  for (const s of [-1, 1]) {
    b.box(0.03 * g, 0.03 * g, 0.03 * g, gurt, { x: s * 0.09 * g * w, y: 0.22 * g, z: -0.07 * g });
    b.box(0.03 * g, 0.24 * g, 0.012 * g, gurt, { x: s * 0.08 * g * w, y: 0.08 * g, z: 0.005, rx: 0.15 });
  }
  return b;
}
