// Viniland – Gegner-Registry (Erweiterung 3). Alles Datengetriebene über Bosse und normale Gegner an einer Stelle.
// Normale Gegner sind (vorerst) Platzhalter: kleinere, umgefärbte Boss-Kopien (variant.minion = true, 1–2 Attacken, wenig HP).
// Geometrien werden pro Basis-Typ + Tönung gecacht (bosses.js), d. h. viele gleiche Minions kosten kaum Speicher.
import { BOSS_TYPES, BOSS_INFO, createBoss } from './bosses.js';
import { BOSS_TYPES2, BOSS_INFO2, createBoss2 } from './bosses2.js';

export const ALL_BOSS_TYPES = [...BOSS_TYPES, ...BOSS_TYPES2];
export const ALL_BOSSES = { ...BOSS_INFO, ...BOSS_INFO2 };   // type -> { name, title, hp, color, biome, key, loot }

/** Bosse eines Bioms (Reihenfolge: Nebenbosse, dann Siegelträger zuletzt). */
export function bossesOfBiome(biome) {
  return ALL_BOSS_TYPES.filter(t => ALL_BOSSES[t].biome === biome).sort((a, b) => (ALL_BOSSES[a].key ? 1 : 0) - (ALL_BOSSES[b].key ? 1 : 0));
}

/** spawnBoss(type, { scene, world, combat, home, yaw, variant }) → Boss-Instanz (siehe createBoss). */
export function spawnBoss(type, opts = {}) {
  if (BOSS_INFO[type]) return createBoss(type, opts);
  if (BOSS_INFO2[type]) return createBoss2(type, opts);
  throw new Error('Unbekannter Boss: ' + type);
}

// variant: scale (0.35–0.6), tint (Vertex-Umfärbung), glow (Emissiv-Farbe), hpMul, dmgMul, speedMul, attacks (Boss-Attacken-IDs)
const M = (o) => ({ minion: true, ...o });
export const ENEMY_TYPES = {
  // ---- Graue Küste
  strandhund:    { name: 'Strandhund', biome: 'kueste', base: 'dogo', glut: 18, loot: 'mob_common',
                   variant: M({ scale: 0.45, tint: 0xb8a888, hpMul: 0.085, dmgMul: 0.5, speedMul: 1.1, attacks: ['bite', 'ram'] }) },
  aschenhexe:    { name: 'Aschenhexe', biome: 'kueste', base: 'morra', glut: 25, loot: 'mob_common',
                   variant: M({ scale: 0.5, tint: 0x6a7068, glow: 0xffb040, hpMul: 0.1, dmgMul: 0.55, attacks: ['fan', 'blink'] }) },
  kohlbrocken:   { name: 'Kohlbrocken', biome: 'kueste', base: 'kohlherz', glut: 30, loot: 'mob_common',
                   variant: M({ scale: 0.36, tint: 0x5a5048, hpMul: 0.07, dmgMul: 0.5, speedMul: 1.3, attacks: ['smash', 'stomp'] }) },
  wrackhund:     { name: 'Wrackhund', biome: 'kueste', base: 'dogo', glut: 70, loot: 'mob_elite', elite: true,
                   variant: M({ scale: 0.6, tint: 0x4a4038, glow: 0xff4010, hpMul: 0.2, dmgMul: 0.7, speedMul: 1.1, attacks: ['bite', 'pounce'] }) },
  // ---- Düsterwald
  rabenknappe:   { name: 'Rabenknappe', biome: 'duesterwald', base: 'rabenritter', glut: 35, loot: 'mob_common',
                   variant: M({ scale: 0.55, tint: 0x4a4450, hpMul: 0.09, dmgMul: 0.55, attacks: ['cleave', 'thrust'] }) },
  galgenknecht:  { name: 'Galgenknecht', biome: 'duesterwald', base: 'henker', glut: 40, loot: 'mob_common',
                   variant: M({ scale: 0.5, tint: 0x6a5a50, hpMul: 0.08, dmgMul: 0.55, attacks: ['chop', 'hook'] }) },
  wasserspeier:  { name: 'Wasserspeier', biome: 'duesterwald', base: 'glockenwaechter', glut: 45, loot: 'mob_common',
                   variant: M({ scale: 0.35, tint: 0x6a7070, glow: 0x9fd0ff, hpMul: 0.045, dmgMul: 0.5, speedMul: 1.4, attacks: ['claw', 'leap'] }) },
  nachtwolf:     { name: 'Nachtwolf', biome: 'duesterwald', base: 'dogo', glut: 90, loot: 'mob_elite', elite: true,
                   variant: M({ scale: 0.58, tint: 0x2a2a34, glow: 0x9fb8ff, hpMul: 0.2, dmgMul: 0.75, speedMul: 1.2, attacks: ['bite', 'pounce'] }) },
  // ---- Leuchtpilzhain
  myzelkitz:     { name: 'Myzelkitz', biome: 'pilzhain', base: 'myzelhirsch', glut: 45, loot: 'mob_common',
                   variant: M({ scale: 0.5, tint: 0x5a3a6a, hpMul: 0.09, dmgMul: 0.55, speedMul: 1.05, attacks: ['gore', 'charge'] }) },
  pilzwicht:     { name: 'Pilzwicht', biome: 'pilzhain', base: 'pilzgolem', glut: 50, loot: 'mob_common',
                   variant: M({ scale: 0.42, tint: 0x8a5a3a, tintAmt: 0.5, hpMul: 0.08, dmgMul: 0.5, speedMul: 1.3, attacks: ['punch', 'spit'] }) },
  sporling:      { name: 'Sporling', biome: 'pilzhain', base: 'sporenkoenigin', glut: 55, loot: 'mob_common',
                   variant: M({ scale: 0.3, tint: 0x3a8a9a, tintAmt: 0.6, glow: 0x3affe0, hpMul: 0.04, dmgMul: 0.5, attacks: ['lash', 'spores'] }) },
  glimmhexe:     { name: 'Glimmhexe', biome: 'pilzhain', base: 'morra', glut: 110, loot: 'mob_elite', elite: true,
                   variant: M({ scale: 0.55, tint: 0x5a2a7a, glow: 0x3affe0, emberColor: 0x3affe0, hpMul: 0.22, dmgMul: 0.7, attacks: ['fan', 'ash'] }) },
  // ---- Aschenöde (Platzhalter)
  obsidiankoloss:{ name: 'Obsidiankoloss', biome: 'aschenoede', base: 'kohlherz', glut: 80, loot: 'mob_common',
                   variant: M({ scale: 0.45, tint: 0x1e1a20, glow: 0xff3a08, hpMul: 0.1, dmgMul: 0.7, speedMul: 1.2, attacks: ['smash', 'boulder'] }) },
  glutritter:    { name: 'Glutritter', biome: 'aschenoede', base: 'rabenritter', glut: 90, loot: 'mob_elite', elite: true,
                   variant: M({ scale: 0.6, tint: 0x5a2a1a, glow: 0xff6a20, emberColor: 0xff6a20, hpMul: 0.22, dmgMul: 0.8, attacks: ['cleave', 'thrust'] }) },
  // ---- Frostgipfel (Platzhalter)
  frostwolf:     { name: 'Frostwolf', biome: 'frostgipfel', base: 'dogo', glut: 85, loot: 'mob_common',
                   variant: M({ scale: 0.55, tint: 0xd8e8ff, glow: 0x60c0ff, emberColor: 0xc0e8ff, hpMul: 0.14, dmgMul: 0.75, speedMul: 1.2, attacks: ['bite', 'pounce'] }) },
  eisgolem:      { name: 'Eisgolem', biome: 'frostgipfel', base: 'pilzgolem', glut: 100, loot: 'mob_elite', elite: true,
                   variant: M({ scale: 0.55, tint: 0x9ac8e8, tintAmt: 0.85, glow: 0x60c0ff, emberColor: 0xc0e8ff, hpMul: 0.16, dmgMul: 0.8, attacks: ['punch', 'slam'] }) },
};

/** Gegnertypen eines Bioms. */
export function enemiesOfBiome(biome) { return Object.keys(ENEMY_TYPES).filter(id => ENEMY_TYPES[id].biome === biome); }

/**
 * spawnEnemy(id, { scene, world, combat, home, yaw, variant? }) → Boss-Instanz (minion) + .enemyId, .enemy (Def), .glut, .loot.
 * opts.variant überschreibt einzelne Felder der Typ-Variante.
 */
export function spawnEnemy(id, opts = {}) {
  const E = ENEMY_TYPES[id];
  if (!E) throw new Error('Unbekannter Gegner: ' + id);
  const variant = { ...E.variant, name: E.name, ...(opts.variant || {}) };
  const e = spawnBoss(E.base, { ...opts, variant });
  e.enemyId = id; e.enemy = E; e.glut = E.glut; e.loot = E.loot;
  e.actor.enemyId = id;
  return e;
}
