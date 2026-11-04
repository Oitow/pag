// Viniland – Biome (reine Daten). world.js liest alles hieraus; Platzhalter, leicht austauschbar.
// Layout: Biome sind Sektoren um die Inselmitte. Winkel phi = atan2(z, x) in Grad (0..360).
// Start (Wrack) liegt an der Küste bei phi = 90° (also +Z). Fortschritt gegen den Uhrzeigersinn (phi steigend):
// kueste (50–130) → duesterwald (130–215) → pilzhain (215–300) → aschenoede (300–360) | frostgipfel (0–50, + Gipfel in der Mitte).
// Zwischen allen Sektoren stehen Felsgrate (Wände). In den Graten 1→2, 2→3, 3→4 sitzt je ein Nebeltor.

export const LAYOUT = {
  radius: 390,          // nominaler Küstenradius (m)
  ext: 455,             // halbe Terrain-Kantenlänge (m)
  cell: 3.5,            // Terrain-Zellgröße (m)
  gateR: 235,           // Radius, auf dem die Nebeltore in den Graten sitzen
  gateWidth: 12,
  startPhi: 90,
  peak: { h: 62, r: 105 }, // Zentralmassiv
};

// Baumarten (Platzhalter). style: pine | oak | birch | dead | shroom. glow: Krone unbeleuchtet (leuchtet).
export const TREE_TYPES = {
  pine: { style: 'pine', H: 9.2, rB: 0.30, rT: 0.09, stump: 0.42, crownC: 6.0, crownR: 2.2, top: 10.6, lc: 0.50, hp: [4, 5],
    bark: 0x4e3a2a, leaves: [0x2a4234, 0x334a3a, 0x243a2e] },
  oak: { style: 'oak', H: 5.0, rB: 0.42, rT: 0.27, stump: 0.42, crownC: 6.4, crownR: 2.8, top: 9.0, lc: 0.66, hp: [4, 5],
    bark: 0x4a3a2c, leaves: [0x4a5a3a, 0x56653f, 0x3e4e32] },
  birch: { style: 'birch', H: 8.4, rB: 0.20, rT: 0.08, stump: 0.40, crownC: 6.7, crownR: 1.7, top: 9.4, lc: 0.55, hp: [3, 4],
    bark: 0xc8c4b8, leaves: [0x7a8a4a, 0x8a945a, 0x6a7a42] },
  deadtree: { style: 'dead', H: 7.5, rB: 0.34, rT: 0.08, stump: 0.45, crownC: 6.0, crownR: 2.4, top: 8.6, lc: 0.55, hp: [4, 5],
    bark: 0x1f1b19, leaves: [0x2a2622, 0x332c26, 0x1a1816] },
  blackpine: { style: 'pine', H: 11.5, rB: 0.34, rT: 0.10, stump: 0.45, crownC: 7.2, crownR: 2.5, top: 13.2, lc: 0.50, hp: [5, 6],
    bark: 0x2a2220, leaves: [0x141c18, 0x1b251f, 0x10160f] },
  gloomoak: { style: 'oak', H: 5.4, rB: 0.46, rT: 0.28, stump: 0.45, crownC: 6.8, crownR: 3.0, top: 9.6, lc: 0.66, hp: [5, 6],
    bark: 0x2a2420, leaves: [0x2a2a34, 0x34303c, 0x22222a] },
  shroom_tall: { style: 'shroom', cap: 'flat', glow: true, H: 6.6, rB: 0.40, rT: 0.28, stump: 0.40, crownC: 6.9, crownR: 3.4, top: 7.8, lc: 0.75, hp: [3, 4],
    bark: 0xcfc6dc, cut: 0xf2eaff, leaves: [0x18d8c8, 0x40f0e0, 0x10a8b0] },
  shroom_bell: { style: 'shroom', cap: 'bell', glow: true, H: 4.4, rB: 0.32, rT: 0.22, stump: 0.36, crownC: 5.0, crownR: 2.3, top: 6.6, lc: 0.72, hp: [3, 4],
    bark: 0xd8cce0, cut: 0xf2eaff, leaves: [0xf040c0, 0xff66d8, 0xc02090] },
  shroom_puff: { style: 'shroom', cap: 'cluster', glow: true, H: 3.4, rB: 0.46, rT: 0.32, stump: 0.36, crownC: 4.0, crownR: 2.6, top: 5.2, lc: 0.70, hp: [3, 4],
    bark: 0xc8c0d8, cut: 0xf2eaff, leaves: [0x9a50ff, 0xb478ff, 0x7030d0] },
  charred: { style: 'dead', H: 6.0, rB: 0.38, rT: 0.12, stump: 0.45, crownC: 4.8, crownR: 1.9, top: 6.8, lc: 0.55, hp: [3, 4],
    bark: 0x141210, leaves: [0x2a2420, 0xff6a20, 0x1a1614], embers: true },
  snowpine: { style: 'pine', H: 9.6, rB: 0.30, rT: 0.09, stump: 0.42, crownC: 6.2, crownR: 2.3, top: 11.0, lc: 0.50, hp: [4, 5],
    bark: 0x3a2e26, leaves: [0xe4ecf4, 0x2a3e3a, 0xd0dae4] },
};

const C = (fog, fogNear, fogFar, sky, sun, sunI, hemiSky, hemiGround, hemiI, grade, weather) =>
  ({ fog, fogNear, fogFar, sky, sun, sunI, hemiSky, hemiGround, hemiI, grade, weather });

export const BIOMES = [
  {
    id: 'kueste', name: 'Graue Küste', order: 1, sector: [50, 130],
    // fahl-grau, kalter Seenebel, aber etwas Wärme im Licht
    atmo: C(0x8a8e8c, 25, 260, [0x56626e, 0xaaa496], 0xf0dcbc, 1.9, 0xb4bcc4, 0x5a5244, 1.05,
      { contrast: 1.08, saturation: 0.72, tint: 0xf6eee2, vignette: 0.38, exposure: 1.0 }, { rain: 0.18, spores: 0, ash: 0, snow: 0 }),
    palette: { wet: 0x74705f, sand: 0xa49c86, sandG: 0x88886a, g1: 0x6c7650, g2: 0x566244, g3: 0x8a8a62, dirt: 0x625240, rock: 0x6c6c6a,
      deep: 0x58564a, path: 0x6e6048, water: [0x6e8e8c, 0x4a6a72, 0x2e4652], foam: 0xc8ccc4, rockTint: 0xd0d4d0 },
    terrain: { hills: 1.0, rough: 0.35, lift: 0 },
    trees: [['pine', 0.4], ['oak', 0.3], ['birch', 0.3]], treeCount: 220, clusterR: 13,
    deco: { grass: [5200, [0x66704a, 0x76804e]], beachgrass: [900, 0x9a9670], bushes: [200, 0x3e4a34, 0x8a2a2a],
      flowers: [420, [0xc8c0a0, 0x9a8ab0, 0xd0d0c8]], rocks: 46, driftwood: 40 },
    mobs: ['kueste_minion_a', 'kueste_minion_b'],
  },
  {
    id: 'duesterwald', name: 'Düsterwald', order: 2, sector: [130, 215],
    // schwarz, nass, kalt, dichter Nebel, Regen
    atmo: C(0x4a525a, 12, 165, [0x1e242c, 0x565e66], 0xb4c0d0, 1.6, 0x92a2b6, 0x4a4234, 1.9,
      { contrast: 1.04, saturation: 0.6, tint: 0xccd6de, vignette: 0.5, exposure: 1.55 }, { rain: 0.85, spores: 0, ash: 0, snow: 0 }),
    palette: { wet: 0x46423a, sand: 0x565044, sandG: 0x484a3c, g1: 0x3c4a38, g2: 0x323c2e, g3: 0x4a4c3c, dirt: 0x443428, rock: 0x5a5a5e,
      deep: 0x2a2824, path: 0x3e3428, water: [0x3a4448, 0x283236, 0x1a2226], foam: 0x7a8286, rockTint: 0x7a7a84 },
    terrain: { hills: 1.25, rough: 0.5, lift: 2 },
    trees: [['deadtree', 0.4], ['blackpine', 0.4], ['gloomoak', 0.2]], treeCount: 420, clusterR: 18,
    deco: { grass: [3600, [0x2e3a28, 0x3a4030]], bushes: [170, 0x1e281c, 0x4a1a20], graves: 130, lanterns: 30, ruins: 16, rocks: 34 },
    mobs: ['wald_minion_a', 'wald_minion_b'],
  },
  {
    id: 'pilzhain', name: 'Leuchtpilzhain', order: 3, sector: [215, 300],
    // nachtartig, Biolumineszenz: Türkis / Magenta / Violett, gesättigt
    atmo: C(0x2a1a46, 18, 210, [0x0e0824, 0x3c2260], 0x9a88e8, 0.8, 0x7a60d0, 0x1a5a6a, 1.25,
      { contrast: 1.12, saturation: 1.4, tint: 0xf0e6ff, vignette: 0.45, exposure: 1.12 }, { rain: 0, spores: 1, ash: 0, snow: 0 }),
    palette: { wet: 0x3a2a4a, sand: 0x5a4870, sandG: 0x40406a, g1: 0x2c6460, g2: 0x40346c, g3: 0x22766a, dirt: 0x4a2a4a, rock: 0x4a4060,
      deep: 0x2a2040, path: 0x4a3a5e, water: [0x3a5a8a, 0x2a2a6a, 0x1a1440], foam: 0x9af0f0, rockTint: 0x9a88c8 },
    terrain: { hills: 1.1, rough: 0.4, lift: 1 },
    trees: [['shroom_tall', 0.35], ['shroom_bell', 0.35], ['shroom_puff', 0.3]], treeCount: 260, clusterR: 15,
    deco: { glowgrass: [3600, [0x1aa898, 0x8a3ab8, 0x2a6ad0]], smallshrooms: 700, rocks: 22 },
    mobs: ['pilz_minion_a', 'pilz_minion_b'],
  },
  {
    id: 'aschenoede', name: 'Aschenöde', order: 4, sector: [300, 360], placeholder: true,
    atmo: C(0x4e3832, 12, 170, [0x22161a, 0x7a4632], 0xffa070, 1.7, 0x9a6a5a, 0x3c2418, 1.35,
      { contrast: 1.12, saturation: 0.85, tint: 0xffdcc8, vignette: 0.5, exposure: 1.18 }, { rain: 0, spores: 0, ash: 1, snow: 0 }),
    palette: { wet: 0x34302c, sand: 0x48403c, sandG: 0x423c38, g1: 0x4a4440, g2: 0x3a3430, g3: 0x5a4a3e, dirt: 0x6a3a24, rock: 0x2a2830,
      deep: 0x201c1c, path: 0x4a2a1c, water: [0x4a3a34, 0x2a2220, 0x1a1414], foam: 0x8a7a70, rockTint: 0x3e3840 },
    terrain: { hills: 1.4, rough: 0.8, lift: 4 },
    trees: [['charred', 1]], treeCount: 70, clusterR: 14,
    deco: { deadgrass: [700, 0x4a4038], obsidian: 90, lava: 160, rocks: 20 },
    mobs: [],
  },
  {
    id: 'frostgipfel', name: 'Frostgipfel', order: 5, sector: [0, 50], placeholder: true,
    atmo: C(0xb4c0cc, 10, 180, [0x7a8ea6, 0xc8d2dc], 0xdde8ff, 1.9, 0xc8d8f0, 0x6a7080, 1.1,
      { contrast: 1.05, saturation: 0.6, tint: 0xdce8ff, vignette: 0.35, exposure: 0.96 }, { rain: 0, spores: 0, ash: 0, snow: 1 }),
    palette: { wet: 0x7a8490, sand: 0xb8c0c8, sandG: 0xc8d0da, g1: 0xd8e0e8, g2: 0xc0cad6, g3: 0xe8eef4, dirt: 0x8a96a4, rock: 0x6a7480,
      deep: 0x5a6470, path: 0x9aa4b0, water: [0x8aa8c0, 0x5a7a96, 0x3a5470], foam: 0xf0f6ff, rockTint: 0xe0ecff },
    terrain: { hills: 1.6, rough: 0.6, lift: 14 },
    trees: [['snowpine', 1]], treeCount: 90, clusterR: 14,
    deco: { snowgrass: [500, 0xc0ccd8], ice: 70, rocks: 26 },
    mobs: [],
  },
];

export const BIOME_BY_ID = Object.fromEntries(BIOMES.map(b => [b.id, b]));

// Spielinhalts-Anker relativ zum Sektor: f = Anteil im Sektor (0..1), r = Radius in m.
export const ANCHORS = {
  kueste: { bosses: [{ f: 0.25, r: 300 }, { f: 0.62, r: 175 }, { f: 0.86, r: 250, key: true }],
    shrines: [{ f: 0.72, r: 285 }], mobs: [{ f: 0.4, r: 320 }, { f: 0.2, r: 220 }, { f: 0.7, r: 225 }, { f: 0.55, r: 265 }, { f: 0.92, r: 300 }] },
  duesterwald: { bosses: [{ f: 0.3, r: 300 }, { f: 0.5, r: 160 }, { f: 0.84, r: 232, key: true }],
    shrines: [{ f: 0.08, r: 262 }, { f: 0.62, r: 262 }], mobs: [{ f: 0.18, r: 200 }, { f: 0.4, r: 260 }, { f: 0.55, r: 320 }, { f: 0.7, r: 190 }, { f: 0.36, r: 175 }] },
  pilzhain: { bosses: [{ f: 0.3, r: 190 }, { f: 0.58, r: 305 }, { f: 0.85, r: 232, key: true }],
    shrines: [{ f: 0.08, r: 262 }, { f: 0.6, r: 225 }], mobs: [{ f: 0.18, r: 290 }, { f: 0.42, r: 250 }, { f: 0.5, r: 170 }, { f: 0.72, r: 290 }, { f: 0.35, r: 325 }] },
  aschenoede: { bosses: [], shrines: [{ f: 0.1, r: 262 }], mobs: [] },
  frostgipfel: { bosses: [], shrines: [{ f: 0.5, r: 255 }], mobs: [] },
};
// Wegpunkte (Biom, f, r) für den Pfad Start → Tore (färbt den Boden, dient der Testkamera als Route).
export const ROUTE = [
  ['kueste', 0.5, 362], ['kueste', 0.5, 330], ['kueste', 0.62, 290], ['kueste', 0.74, 265], ['kueste', 0.86, 250], ['kueste', 0.97, 236],
  ['duesterwald', 0.04, 236], ['duesterwald', 0.1, 255], ['duesterwald', 0.3, 230], ['duesterwald', 0.5, 232], ['duesterwald', 0.66, 230],
  ['duesterwald', 0.84, 238], ['duesterwald', 0.97, 236],
  ['pilzhain', 0.04, 236], ['pilzhain', 0.1, 258], ['pilzhain', 0.3, 225], ['pilzhain', 0.5, 220], ['pilzhain', 0.7, 240], ['pilzhain', 0.85, 238],
  ['pilzhain', 0.97, 236], ['aschenoede', 0.06, 236], ['aschenoede', 0.25, 250],
];
