// Viniland – Waffen (datengetrieben): Klasse/Tempo, leichte Combo, schwerer Angriff (halten = aufladen), Waffenkunst,
// Skalierung (Buchstaben), Baumfällen, Platzhalter-Modelle (mid-poly, Vertex-Farben).
//
// Schlag-Definition (combo[i] / heavy / art.hits[i]):
//   anim    Animationsname im Spielermodell (players.js: jab, cross, hook, uppercut, haymaker, slashR, slashL, overhead, rising,
//           sweep, thrust, spin, slam, double, doubleX, art_*)
//   dmg     MULTIPLIKATOR auf base.dmg      kb  Rückstoß (m/s)      stagger 0..1 (Haltungsschaden)
//   lunge   Ausfallschritt (m/s kurz vor dem Treffer)      reach  Reichweite (m ab Körpermitte)      arc  Bogen (rad)
//   shape   'arc' | 'thrust' | 'spin' | 'slam' | 'ring' | 'wave' | 'proj' | 'dash'  (sonst aus anim abgeleitet)
//   dir     'R' (rechts→links) | 'L' (links→rechts) – Schwungrichtung für 'arc'
//   sta     Ausdauer-Faktor (× Klassen-Basis)     speed  Tempo-Faktor     multi  Anzahl Treffer (Doppelhieb)
//   tree    Baum-Schaden-Faktor (× base.tree)
// Waffenkunst: { id, name, desc, sta, mana, anim, speed, armor (kein Taumeln), iframes:[a,b] (Anteil 0..1),
//                dash:{ from, to, speed } (Anteil), leap:{ from, to, speed }, hits:[{ at (Anteil 0..1), ...Schlag, fx, lifesteal }] }
import * as THREE from 'three';
import { MeshBuilder } from './kit.js';

/** Klassen: Tempo (Animations-Faktor), Ausdauer, Hitstop/Shake (Gewicht) */
export const WEAPON_CLASSES = {
  light:  { name: 'Leicht', speed: 1.18, staMul: 0.75, hitstop: 0.04, shake: 0.14, kb: 0.8 },
  medium: { name: 'Mittel', speed: 1.0,  staMul: 1.0,  hitstop: 0.06, shake: 0.24, kb: 1 },
  heavy:  { name: 'Schwer', speed: 0.8,  staMul: 1.4,  hitstop: 0.095, shake: 0.46, kb: 1.35 },
};

/** Skalierungs-Koeffizient bei Attribut 40 (linear ab 10, weich über 40). Gleich wie items.js SCALE_COEF. */
export const SCALE_COEF = { S: 0.9, A: 0.7, B: 0.5, C: 0.35, D: 0.2, E: 0.1, '-': 0 };
export function scalingMul(scaling = {}, stats = {}) {
  let m = 1;
  for (const k in scaling) {
    const v = stats[k] ?? 10, x = Math.max(0, v - 10) / 30;
    m += (SCALE_COEF[scaling[k]] || 0) * (x <= 1 ? x : 1 + (x - 1) * 0.35);
  }
  return m;
}
export const RARITY_COLORS = { common: 0xc9c1ae, rare: 0x4f8dff, epic: 0xb35cff, legendary: 0xffa424 };

const S = (o) => o; // Lesbarkeit
export const WEAPONS = {
  fists: {
    name: 'Fäuste', class: 'light', grip: 'fists', desc: 'Nichts in den Händen außer Wut.', icon: '👊',
    scaling: { str: 'E', dex: 'D' }, base: { dmg: 6, tree: 0.35 }, mesh: 'fists',
    combo: [
      S({ anim: 'jab', dmg: 1.0, kb: 1.5, stagger: 0.08, lunge: 2.4, reach: 1.25, sta: 0.6 }),
      S({ anim: 'cross', dmg: 1.1, kb: 1.8, stagger: 0.12, lunge: 2.6, reach: 1.3, sta: 0.6 }),
      S({ anim: 'hook', dmg: 1.25, kb: 2.5, stagger: 0.2, lunge: 2.6, reach: 1.3, arc: 1.4, dir: 'L', shape: 'arc', sta: 0.8 }),
      S({ anim: 'uppercut', dmg: 1.8, kb: 5, stagger: 0.55, lunge: 3.2, reach: 1.3, sta: 1.1 }),
    ],
    heavy: S({ anim: 'haymaker', dmg: 2.6, kb: 7, stagger: 0.6, lunge: 4.5, reach: 1.45, arc: 1.2, dir: 'R', shape: 'arc', charge: true, sta: 1.6 }),
    art: { id: 'trommelfeuer', name: 'Trommelfeuer', desc: 'Sechs rasende Schläge, der letzte schleudert zurück.', sta: 26, anim: 'art_flurry', armor: true,
      dash: { from: 0.05, to: 0.75, speed: 1.6 },
      hits: [0.12, 0.22, 0.32, 0.42, 0.52, 0.62].map((at, i) => ({ at, shape: 'thrust', dmg: i < 5 ? 0.7 : 1.9, kb: i < 5 ? 0.6 : 8, stagger: i < 5 ? 0.06 : 0.7, reach: 1.35 })) },
  },
  driftwood: {
    name: 'Treibholzknüppel', class: 'medium', grip: 'one', desc: 'Salzgebleichtes Holz aus dem Wrack. Besser als nichts.', icon: '🪵',
    scaling: { str: 'D', dex: 'E' }, base: { dmg: 9, tree: 0.7 }, mesh: 'driftwood',
    combo: [
      S({ anim: 'slashR', dmg: 1.0, kb: 2.5, stagger: 0.18, lunge: 3.0, reach: 1.9, arc: 2.0 }),
      S({ anim: 'slashL', dmg: 1.05, kb: 2.5, stagger: 0.2, lunge: 3.0, reach: 1.9, arc: 2.0 }),
      S({ anim: 'overhead', dmg: 1.7, kb: 5.5, stagger: 0.6, lunge: 4.0, reach: 2.0, arc: 0.7, sta: 1.4, tree: 1.6 }),
    ],
    heavy: S({ anim: 'overhead', dmg: 2.3, kb: 6, stagger: 0.7, lunge: 4, reach: 2.0, arc: 0.8, charge: true, sta: 1.8, speed: 0.8, tree: 2 }),
    art: { id: 'splitterschlag', name: 'Splitterschlag', desc: 'Schmettert den Knüppel in den Boden – Holzsplitter fliegen ringsum.', sta: 28, anim: 'art_slam',
      hits: [{ at: 0.42, shape: 'slam', dmg: 1.6, radius: 2.6, kb: 7, stagger: 0.7, fx: 'wood' }] },
  },
  axe: {
    name: 'Beil', class: 'medium', grip: 'one', desc: 'Ein Zimmermannsbeil. Spaltet Holz und Knochen.', icon: '🪓',
    scaling: { str: 'C', dex: 'D' }, base: { dmg: 11, tree: 2 }, mesh: 'axe',
    combo: [
      S({ anim: 'slashR', dmg: 1.0, kb: 2.5, stagger: 0.2, lunge: 3.2, reach: 1.9, arc: 1.9 }),
      S({ anim: 'slashL', dmg: 1.05, kb: 2.5, stagger: 0.2, lunge: 3.2, reach: 1.9, arc: 1.9 }),
      S({ anim: 'overhead', dmg: 1.9, kb: 6, stagger: 0.65, lunge: 4.5, reach: 2.0, arc: 0.7, sta: 1.5, tree: 1.5 }),
    ],
    heavy: S({ anim: 'chop', dmg: 2.2, kb: 5, stagger: 0.65, lunge: 3.5, reach: 2.0, arc: 0.7, charge: true, sta: 1.7, tree: 2 }),
    art: { id: 'sprungspalter', name: 'Sprungspalter', desc: 'Satz nach vorn, spaltet beim Aufprall den Boden.', sta: 32, anim: 'art_leap', armor: true,
      leap: { from: 0.12, to: 0.55, speed: 8.5 },
      hits: [{ at: 0.56, shape: 'slam', dmg: 2.4, radius: 2.3, kb: 8, stagger: 0.85, fx: 'spark', tree: 3 }] },
  },
  sword: {
    name: 'Kurzschwert', class: 'medium', grip: 'one', desc: 'Rostige Klinge eines Ertrunkenen. Ausgewogen.', icon: '🗡️',
    scaling: { str: 'D', dex: 'C' }, base: { dmg: 12, tree: 0.6 }, mesh: 'sword',
    combo: [
      S({ anim: 'slashR', dmg: 1.0, kb: 2.2, stagger: 0.16, lunge: 3.2, reach: 2.1, arc: 2.1, speed: 1.08 }),
      S({ anim: 'slashL', dmg: 1.0, kb: 2.2, stagger: 0.16, lunge: 3.2, reach: 2.1, arc: 2.1, speed: 1.08 }),
      S({ anim: 'thrust', dmg: 1.2, kb: 3, stagger: 0.25, lunge: 5.0, reach: 2.5, speed: 1.05 }),
      S({ anim: 'overhead', dmg: 1.7, kb: 5.5, stagger: 0.55, lunge: 4, reach: 2.2, arc: 0.7, sta: 1.4 }),
    ],
    heavy: S({ anim: 'rising', dmg: 2.1, kb: 6, stagger: 0.65, lunge: 4, reach: 2.2, arc: 1.4, dir: 'R', charge: true, sta: 1.7 }),
    art: { id: 'mondsichel', name: 'Mondsichel', desc: 'Ein aufsteigender Hieb entsendet eine Klingenwelle.', sta: 22, mana: 10, anim: 'art_crescent',
      hits: [{ at: 0.38, shape: 'arc', dmg: 1.4, reach: 2.2, arc: 1.6, dir: 'R', kb: 4, stagger: 0.4 },
             { at: 0.4, shape: 'proj', dmg: 1.6, speed: 17, radius: 0.55, life: 0.9, fx: 'frost', kb: 5, stagger: 0.5, pierce: true, scale: 'dex' }] },
  },
  greatsword: {
    name: 'Großschwert', class: 'heavy', grip: 'two', desc: 'Eine Klinge, so lang wie ein Mann. Fällt Bäume und Riesen.', icon: '⚔️',
    scaling: { str: 'B', dex: 'D' }, base: { dmg: 19, tree: 2.4 }, mesh: 'greatsword',
    combo: [
      S({ anim: 'slashR', dmg: 1.0, kb: 4, stagger: 0.4, lunge: 3.5, reach: 2.7, arc: 2.4, sta: 1.0 }),
      S({ anim: 'slashL', dmg: 1.05, kb: 4, stagger: 0.42, lunge: 3.5, reach: 2.7, arc: 2.4, sta: 1.0 }),
      S({ anim: 'overhead', dmg: 1.6, kb: 7.5, stagger: 0.85, lunge: 4.5, reach: 2.9, arc: 0.8, sta: 1.4, tree: 1.4 }),
    ],
    heavy: S({ anim: 'overhead', dmg: 2.2, kb: 9, stagger: 1, lunge: 4.5, reach: 2.9, arc: 0.8, charge: true, sta: 1.6, speed: 0.85, tree: 2 }),
    art: { id: 'wirbelschlag', name: 'Wirbelschlag', desc: 'Zwei vernichtende Drehungen – nichts bleibt stehen.', sta: 38, anim: 'art_spin', armor: true,
      dash: { from: 0.1, to: 0.8, speed: 2.2 },
      hits: [{ at: 0.34, shape: 'spin', dmg: 1.3, reach: 3.1, kb: 6, stagger: 0.6 }, { at: 0.72, shape: 'spin', dmg: 1.6, reach: 3.1, kb: 10, stagger: 0.9, tree: 2 }] },
  },
  spear: {
    name: 'Speer', class: 'medium', grip: 'two', desc: 'Lange Reichweite, schnelle Stöße. Hält Bestien auf Abstand.', icon: '🔱',
    scaling: { str: 'D', dex: 'B' }, base: { dmg: 11, tree: 0.5 }, mesh: 'spear',
    combo: [
      S({ anim: 'thrust', dmg: 1.0, kb: 2.2, stagger: 0.15, lunge: 3.5, reach: 3.1, speed: 1.15, sta: 0.85 }),
      S({ anim: 'thrust', dmg: 1.0, kb: 2.2, stagger: 0.15, lunge: 3.5, reach: 3.1, speed: 1.2, sta: 0.85 }),
      S({ anim: 'sweep', dmg: 1.15, kb: 4, stagger: 0.3, lunge: 2.5, reach: 2.9, arc: 2.6, dir: 'R' }),
      S({ anim: 'thrust', dmg: 1.6, kb: 6, stagger: 0.55, lunge: 6, reach: 3.3, speed: 0.9, sta: 1.3 }),
    ],
    heavy: S({ anim: 'thrust', dmg: 2.1, kb: 7, stagger: 0.7, lunge: 7, reach: 3.4, charge: true, sta: 1.6, speed: 0.75 }),
    art: { id: 'sturmstoss', name: 'Sturmstoß', desc: 'Stürmt mit gesenktem Speer nach vorn und durchbohrt alles im Weg.', sta: 30, anim: 'art_dash', armor: true,
      iframes: [0.1, 0.35], dash: { from: 0.18, to: 0.62, speed: 15 },
      hits: [{ at: 0.18, shape: 'dash', dmg: 2.0, reach: 1.6, radius: 0.95, kb: 9, stagger: 0.85, dur: 0.42 }] },
  },
  daggers: {
    name: 'Doppeldolche', class: 'light', grip: 'dual', desc: 'Zwei Fischmesser. Schnell, gemein, schlecht für Bäume.', icon: '🔪',
    scaling: { dex: 'B', str: 'E' }, base: { dmg: 6.5, tree: 0.25 }, mesh: 'dagger',
    combo: [
      S({ anim: 'slashR', dmg: 1.0, kb: 1.2, stagger: 0.08, lunge: 3.2, reach: 1.6, arc: 1.8, speed: 1.35, sta: 0.6 }),
      S({ anim: 'slashL', dmg: 1.0, kb: 1.2, stagger: 0.08, lunge: 3.2, reach: 1.6, arc: 1.8, speed: 1.35, sta: 0.6 }),
      S({ anim: 'double', dmg: 0.8, kb: 1.5, stagger: 0.1, lunge: 3.2, reach: 1.6, arc: 1.6, multi: 2, speed: 1.2, sta: 0.8 }),
      S({ anim: 'thrust', dmg: 1.1, kb: 1.5, stagger: 0.12, lunge: 4.2, reach: 1.8, speed: 1.4, sta: 0.6 }),
      S({ anim: 'doubleX', dmg: 1.0, kb: 4.5, stagger: 0.4, lunge: 3.5, reach: 1.7, arc: 1.8, multi: 2, sta: 1.0 }),
    ],
    heavy: S({ anim: 'doubleX', dmg: 1.4, kb: 4, stagger: 0.45, lunge: 5, reach: 1.8, arc: 1.6, multi: 2, charge: true, sta: 1.4 }),
    art: { id: 'klingenwirbel', name: 'Klingenwirbel', desc: 'Eine Pirouette aus Stahl – viele kleine Schnitte.', sta: 22, anim: 'art_spin', speed: 1.35,
      iframes: [0.05, 0.3], dash: { from: 0.05, to: 0.7, speed: 3.5 },
      hits: [0.2, 0.36, 0.52, 0.68].map(at => ({ at, shape: 'spin', dmg: 0.85, reach: 2.2, kb: 1.5, stagger: 0.15 })) },
  },
  hammer: {
    name: 'Kriegshammer', class: 'heavy', grip: 'two', desc: 'Ein Ankerstein an einem Mast. Zerschmettert Haltung.', icon: '🔨',
    scaling: { str: 'A' }, base: { dmg: 22, tree: 1.2 }, mesh: 'hammer',
    combo: [
      S({ anim: 'overhead', dmg: 1.0, kb: 6, stagger: 0.7, lunge: 3.2, reach: 2.3, arc: 0.9, sta: 1.1 }),
      S({ anim: 'slashR', dmg: 1.1, kb: 7, stagger: 0.75, lunge: 3.2, reach: 2.4, arc: 2.2, sta: 1.1, speed: 0.95 }),
    ],
    heavy: S({ anim: 'slam', dmg: 2.0, kb: 10, stagger: 1, lunge: 3, reach: 2.2, radius: 2.4, shape: 'slam', charge: true, sta: 1.6 }),
    art: { id: 'bodenbeben', name: 'Bodenbeben', desc: 'Ein Hieb in die Erde, eine Schockwelle rollt nach vorn.', sta: 38, anim: 'art_slam', armor: true,
      hits: [{ at: 0.42, shape: 'slam', dmg: 1.6, radius: 2.6, kb: 9, stagger: 0.9 },
             { at: 0.46, shape: 'wave', dmg: 1.5, radius: 1.6, length: 9, dur: 0.55, kb: 8, stagger: 0.8, fx: 'dust' }] },
  },
  scythe: {
    name: 'Sense', class: 'medium', grip: 'two', desc: 'Erntet Korn – und Seelen. Weiter Bogen.', icon: '🌙',
    scaling: { dex: 'C', fai: 'C' }, base: { dmg: 12, tree: 0.8 }, mesh: 'scythe',
    combo: [
      S({ anim: 'sweep', dmg: 1.0, kb: 2.5, stagger: 0.2, lunge: 2.5, reach: 2.6, arc: 3.0, dir: 'R' }),
      S({ anim: 'slashL', dmg: 1.05, kb: 2.5, stagger: 0.2, lunge: 2.5, reach: 2.6, arc: 2.6 }),
      S({ anim: 'spin', dmg: 1.5, kb: 5, stagger: 0.5, lunge: 2.5, reach: 2.7, sta: 1.4, speed: 0.95 }),
    ],
    heavy: S({ anim: 'sweep', dmg: 2.0, kb: 5, stagger: 0.6, lunge: 3, reach: 2.8, arc: 3.2, dir: 'R', charge: true, sta: 1.6, speed: 0.8 }),
    art: { id: 'seelenernte', name: 'Seelenernte', desc: 'Ein weiter Schnitt aus Schatten, der Leben zurückholt.', sta: 20, mana: 14, anim: 'art_reap',
      hits: [{ at: 0.45, shape: 'arc', dmg: 2.2, reach: 3.4, arc: 3.6, dir: 'R', kb: 5, stagger: 0.55, fx: 'dark', lifesteal: 0.35, scale: 'fai' }] },
  },
  staff: {
    name: 'Kampfstab', class: 'light', grip: 'two', desc: 'Treibholz mit Glutkristall. Verstärkt Zauber (+12 %).', icon: '🪄',
    scaling: { str: 'E', dex: 'D', int: 'C' }, base: { dmg: 8, tree: 0.5 }, mesh: 'staff', spellMul: 1.12,
    combo: [
      S({ anim: 'thrust', dmg: 0.9, kb: 2.5, stagger: 0.15, lunge: 3, reach: 2.4, speed: 1.1 }),
      S({ anim: 'slashR', dmg: 1.0, kb: 2.5, stagger: 0.18, lunge: 3, reach: 2.3, arc: 2.2 }),
      S({ anim: 'slashL', dmg: 1.0, kb: 2.5, stagger: 0.18, lunge: 3, reach: 2.3, arc: 2.2 }),
      S({ anim: 'overhead', dmg: 1.5, kb: 5, stagger: 0.5, lunge: 3.5, reach: 2.4, arc: 0.8, sta: 1.3 }),
    ],
    heavy: S({ anim: 'spin', dmg: 1.7, kb: 6, stagger: 0.55, lunge: 2, reach: 2.4, charge: true, sta: 1.5 }),
    art: { id: 'arkanstoss', name: 'Arkanstoß', desc: 'Stößt den Stab vor und entlädt eine Arkan-Explosion.', sta: 12, mana: 22, anim: 'art_burst',
      hits: [{ at: 0.4, shape: 'thrust', dmg: 1.0, reach: 2.4, kb: 3, stagger: 0.3 },
             { at: 0.42, shape: 'proj', dmg: 2.6, speed: 20, radius: 0.4, life: 1.3, fx: 'dark', explode: 2.4, kb: 7, stagger: 0.7, scale: 'int', homing: true }] },
  },
};
for (const id in WEAPONS) WEAPONS[id].id = id;

/** Schlag-Form aus dem Animationsnamen */
export function shapeOf(s) {
  if (s.shape) return s.shape;
  const a = s.anim || '';
  if (/thrust|jab|cross|uppercut|burst/.test(a)) return 'thrust';
  if (/spin/.test(a)) return 'spin';
  if (/slam/.test(a)) return 'slam';
  return 'arc';
}
/** Schwungrichtung */
export function dirOf(s) { return s.dir || (/slashL|hook/.test(s.anim || '') ? 'L' : 'R'); }

// ---------------- Modelle ----------------
// Griff am Ursprung, Klinge entlang +Y, Schneide/Front zeigt +Z. userData.tip = Spitze (lokal), userData.offhand = zweite Waffe (Dolche).
const WOOD = 0x6a4a2e, WOOD_D = 0x4a3220, DRIFT = 0xa89a86, IRON = 0x6c6f78, STEEL = 0xa4aab4, EDGE = 0xd8dde4, RUST = 0x8a5a3a, LEATHER = 0x3a2618;

function finish(b, tipY, rarityColor) {
  if (rarityColor != null) b.sphere(0.022, rarityColor, { y: -0.02, z: 0.03 }, 5, 3);   // Seltenheits-Steinchen
  const m = b.mesh(); m.castShadow = true;
  const g = new THREE.Group(); g.add(m); g.userData.tip = new THREE.Vector3(0, tipY, 0);
  return g;
}
const BUILD = {
  fists(b) {   // Faustwickel (sitzen in der Hand)
    b.cyl(0.058, 0.058, 0.06, 0x8a7a62, { y: -0.03 }, 7);
    return 0.05;
  },
  driftwood(b) {
    b.cyl(0.025, 0.03, 0.22, LEATHER, { y: 0.0 }, 6);
    b.cyl(0.05, 0.03, 0.62, DRIFT, { y: 0.38, rz: 0.04 }, 7);
    b.sphere(0.06, DRIFT, { y: 0.68, sy: 1.2 }, 6, 4);
    b.box(0.03, 0.1, 0.03, 0x7a6e5e, { y: 0.5, x: 0.045, rz: -0.6 });                 // Aststummel
    b.box(0.025, 0.08, 0.025, 0x7a6e5e, { y: 0.32, x: -0.04, z: 0.02, rz: 0.7 });
    b.ico(0.02, 0x3a4a3a, { y: 0.6, z: 0.05 });                                          // Muschel/Seepocke
    return 0.72;
  },
  axe(b) {
    b.cyl(0.017, 0.021, 0.66, WOOD, { y: 0.22 }, 6);
    b.cyl(0.024, 0.024, 0.1, LEATHER, { y: -0.02 }, 6);
    b.sphere(0.026, WOOD_D, { y: -0.11 }, 5, 3);
    b.box(0.04, 0.09, 0.08, IRON, { y: 0.5, z: 0.02 });
    b.box(0.026, 0.1, 0.1, 0x8d929c, { y: 0.49, z: 0.1 });
    b.box(0.018, 0.15, 0.035, EDGE, { y: 0.48, z: 0.16, jitter: 0.02 });
    b.box(0.036, 0.05, 0.04, 0x55585f, { y: 0.5, z: -0.045 });
    return 0.56;
  },
  sword(b) {
    b.cyl(0.02, 0.022, 0.14, LEATHER, { y: 0.0 }, 6);
    b.sphere(0.03, IRON, { y: -0.08 }, 5, 4);
    b.box(0.2, 0.03, 0.04, IRON, { y: 0.08 });                                           // Parierstange
    b.box(0.05, 0.62, 0.012, STEEL, { y: 0.41 });
    b.box(0.012, 0.6, 0.016, EDGE, { y: 0.41, z: 0.0, x: 0.0, jitter: 0.02 });
    b.box(0.03, 0.12, 0.013, RUST, { y: 0.3, x: 0.012 });                                // Rostfleck
    b.cone(0.026, 0.08, STEEL, { y: 0.76, sz: 0.25 }, 4);
    return 0.78;
  },
  greatsword(b) {
    b.cyl(0.024, 0.026, 0.32, LEATHER, { y: 0.06 }, 6);
    b.sphere(0.04, IRON, { y: -0.12 }, 6, 4);
    b.box(0.34, 0.05, 0.06, IRON, { y: 0.24 });
    for (const s of [-1, 1]) b.cone(0.03, 0.06, IRON, { x: s * 0.19, y: 0.24, rz: -s * Math.PI / 2 }, 4);
    b.box(0.1, 1.15, 0.02, 0x8a909a, { y: 0.84 });
    b.box(0.02, 1.1, 0.026, EDGE, { y: 0.84, jitter: 0.02 });
    b.box(0.06, 0.2, 0.022, RUST, { y: 0.62, x: 0.02 });
    b.cone(0.05, 0.14, 0x8a909a, { y: 1.48, sz: 0.2 }, 4);
    return 1.5;
  },
  spear(b) {
    b.cyl(0.018, 0.02, 1.7, WOOD, { y: 0.35 }, 6);
    b.cyl(0.024, 0.024, 0.12, LEATHER, { y: 0.0 }, 6);
    b.cyl(0.028, 0.022, 0.08, IRON, { y: 1.22 }, 6);
    b.cone(0.05, 0.3, STEEL, { y: 1.4, sz: 0.3 }, 4);
    b.box(0.004, 0.24, 0.05, EDGE, { y: 1.38 });
    b.box(0.08, 0.04, 0.006, 0x8a2a20, { y: 1.18, x: 0.04, rz: 0.4 });                   // Stofffetzen
    b.cyl(0.025, 0.02, 0.05, IRON, { y: -0.5 }, 6);
    return 1.55;
  },
  dagger(b) {
    b.cyl(0.018, 0.02, 0.1, LEATHER, { y: 0.0 }, 6);
    b.box(0.09, 0.022, 0.03, IRON, { y: 0.06 });
    b.box(0.035, 0.24, 0.01, STEEL, { y: 0.19 });
    b.cone(0.018, 0.06, EDGE, { y: 0.34, sz: 0.3 }, 4);
    return 0.36;
  },
  hammer(b) {
    b.cyl(0.024, 0.028, 1.05, WOOD_D, { y: 0.35 }, 6);
    b.cyl(0.03, 0.03, 0.18, LEATHER, { y: 0.0 }, 6);
    b.box(0.2, 0.2, 0.34, 0x5a5c62, { y: 0.92 });                                         // Kopf
    b.box(0.22, 0.05, 0.36, IRON, { y: 0.84 });
    b.box(0.22, 0.05, 0.36, IRON, { y: 1.0 });
    b.box(0.16, 0.16, 0.06, 0x7a7d85, { y: 0.92, z: 0.19 });
    b.cone(0.07, 0.12, IRON, { y: 0.92, z: -0.22, rx: -Math.PI / 2 }, 5);                 // Dorn hinten
    b.ico(0.03, 0x2a4a3a, { y: 0.98, x: 0.1, z: 0.1 });                                   // Algen/Seepocke
    return 1.02;
  },
  scythe(b) {
    b.cyl(0.018, 0.022, 1.6, 0x4a3a2c, { y: 0.4, rz: 0.05 }, 6);
    b.cyl(0.026, 0.026, 0.1, LEATHER, { y: 0.0 }, 6);
    b.box(0.04, 0.12, 0.04, WOOD_D, { y: 0.55, z: 0.05, rx: 1.3 });                       // Griffholz
    b.box(0.03, 0.06, 0.06, IRON, { y: 1.18 });
    // Gebogene Klinge aus 4 Segmenten (nach +Z, hängt nach unten)
    for (let i = 0; i < 4; i++) {
      const a = 0.25 + i * 0.32;
      b.box(0.012, 0.09 - i * 0.012, 0.2, i === 3 ? EDGE : 0x8a8f9a, { y: 1.2 - Math.sin(a) * 0.06 * i, z: 0.08 + i * 0.17, rx: -0.15 - i * 0.25 });
    }
    b.ico(0.03, 0x6af0d0, { y: 1.2, z: -0.03 });                                          // Seelenlicht
    return 1.25;
  },
  staff(b) {
    b.cyl(0.02, 0.026, 1.5, DRIFT, { y: 0.4, rz: 0.03 }, 6);
    b.cyl(0.03, 0.03, 0.08, LEATHER, { y: 0.1 }, 6);
    for (let i = 0; i < 3; i++) b.box(0.016, 0.16, 0.016, 0x7a6e5e, { y: 1.2, x: Math.cos(i * 2.1) * 0.05, z: Math.sin(i * 2.1) * 0.05, rz: Math.cos(i * 2.1) * 0.5, rx: Math.sin(i * 2.1) * 0.5 });
    b.ico(0.055, 0xff8a30, { y: 1.24 });                                                  // Glutkristall
    b.ico(0.03, 0xfff0a0, { y: 1.24 });
    return 1.3;
  },
};

/** Waffen-Modell für die Hand. rarityColor: Zahl oder 'common'|'rare'|'epic'|'legendary' */
export function buildWeaponMesh(id, rarityColor = null) {
  const W = WEAPONS[id] || WEAPONS.fists;
  const col = typeof rarityColor === 'string' ? RARITY_COLORS[rarityColor] ?? null : rarityColor;
  const meshId = W.mesh || id;
  const make = () => { const b = new MeshBuilder(); const tip = (BUILD[meshId] || BUILD.fists)(b); return finish(b, tip, meshId === 'fists' ? null : col); };
  const g = make();
  g.userData.weaponId = W.id;
  if (W.grip === 'dual' || W.grip === 'fists') g.userData.offhand = make();
  return g;
}
