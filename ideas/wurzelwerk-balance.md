# Wurzelwerk – Balance Runde 1 (Startwerte)

Bezug: `wurzelwerk-spec.md` §6. Alle Werte sind **Startwerte** für den Prototyp, nicht final.
Einheiten: Zeit in s, Raten pro s, Kosten als `W/M` (Wasser/Mineral). Grid-Koordinaten: (x,y), Stamm bei x=4.

## 1. Grid
| Parameter | Wert | Notiz |
|---|---|---|
| Boden-Grid | 9 × 7 Tiles | Stamm oben Mitte (4,0) |
| Luft-Grid | 9 × 6 Tiles | Stamm-Spitze unten Mitte |
| Wasser-Quellen | 5 | 1 direkt neben Startwurzel (Onboarding), Rest 2–6 Tiles entfernt |
| Mineral-Quellen | 4 | nächste ≥3 Tiles weg, 1 tief unten hinter Steinen |
| Steine | 8–10 | Seed-verteilt, nie den einzigen Weg zu einer Quelle blockieren |

## 2. Ökonomie
| Parameter | Wert |
|---|---|
| Start-Nährstoffe | 40 W / 30 M |
| Quellen-Ertrag | 1.5 /s je Quelle |
| Wurzel-Tile | 6 W / 2 M, +8 % je bereits gebautem Wurzel-Tile |
| Verdicken | Stufe 2: 15 W/10 M · Stufe 3: 35 W/25 M (Max-Stufe 3) |
| Durchsatz je Stufe | 2 / 4 / 7 pro s |
| Ast-Tile | 4 W / 6 M × (1 + 0.35 × Höhe) (Höhe 0–5) |
| Frucht-Kosten Basis | Dornenbeere 10 W/20 M · Sporenkapsel 20 W/10 M · Honigblüte 15 W/15 M |
| Frucht-Kostenanstieg | × 1.3 je bereits gesetzter Frucht (alle Typen) |
| Wellen-Belohnung | 20 + 8 × Welle (je W und M) |

## 3. Limits
| max. Äste | max. Früchte | max. gleichz. Gegner |
|---|---|---|
| 14 Ast-Tiles | 8 | 24 (Rest wartet im Spawn) |

## 4. Früchte
| Frucht | Schaden | Feuerrate | Reichweite | Verbrauch/Schuss | Sonstiges |
|---|---|---|---|---|---|
| Dornenbeere | 11 | 0.5 /s | 2.5 Tiles + 0.4/Höhe | 0.6 M + 0.2 W | Projektil 8 Tiles/s |
| Sporenkapsel | 4 /s DoT | 0.25 /s | 2.0 + 0.4/Höhe | 1.2 W + 0.3 M | Wolke Radius 1.0, Dauer 4 s, ignoriert Panzer |
| Honigblüte | – | – | – | – | +0.6 W und +0.6 M /s |
- Mangel-Malus: fehlt Mix → Feuerrate × 0.4 (nie 0).
- Effektiv-DPS: Beere 5.5 (Einzelziel), Kapsel ~4 × Ziele im Radius (Schwärme!).

## 5. Schädlinge
| Name | HP | Tempo (Tiles/s) | Schaden/s am Stamm | Panzer | Schwarm |
|---|---|---|---|---|---|
| Blattlaus | 14 | 1.4 | 1 | 0 | Gruppen à 4–6 |
| Käfer | 110 | 0.5 | 4 | 3 | einzeln |
| Krähe | 22 | 2.2 (Luft) | 2 | 0 | 1–2 |
| Holzwurm (Boss) | 1800 | 0.25 | 12 | 2 | frisst 1 Wurzel-Tile / 3 s |
- HP-Skalierung: × (1 + 0.15 × (Welle−1)) für alle Normalgegner.

## 6. Wellen
| Welle | Blattläuse | Käfer | Krähen | Spawn-Intervall | eff. HP (skaliert) |
|---|---|---|---|---|---|
| 1 | 10 | 0 | 0 | 1.2 s | 140 |
| 2 | 16 | 0 | 0 | 1.0 s | 260 |
| 3 | 14 | 2 | 0 | 1.4 s | 630 |
| 4 | 16 | 3 | 3 | 1.3 s | 1080 |
| 5 | 18 | 4 | 4 | 1.2 s | 1520 |
| 6 | 20 | 5 | 6 | 1.1 s | 2060 |
| 7 | 22 | 6 | 6 | 1.0 s | 2570 |
| 8 | 24 | 6 | 8 + Boss | 1.0 s | 4750 |

## 7. Stamm
| Max-HP | Regeneration Aufbau-Phase |
|---|---|
| 100 | +25 % der fehlenden HP beim Wechsel in die Aufbau-Phase |

## 8. Mutationen
| Mutation | Wert |
|---|---|
| Wanderwurzel | 2 Tiles nach jeder Welle (kostenlos) |
| Kettenfrucht | 2 Sprünge, je 70 % Schaden, Sprungweite 1.5 Tiles |
| Symbiose-Pilz | +0.5 W und +0.5 M /s je Kreuzung (max. 4 zählen) |
| Fallobst | 15 Schaden, Radius 1.0 Tile |
| Echowurzel | Feuerrate × (1 + 0.04 × Gesamt-Durchsatz/s), Deckel × 1.8 |
| Dornenrinde | 6 Schaden/s an jeden Gegner am Stamm |

## 9. Nachrechnung (Node-Modell, 2 Läufe)
Modell: Spieler ohne Mutationen, ~20 s Aufbau-Denkzeit, kauft abwechselnd Quelle-anschließen (inkl. Wurzelweg) und Frucht.
| Welle | DPS Spieler | Früchte | Einkommen W+M/s | Time-to-Kill | Spawn-Dauer | Uhr |
|---|---|---|---|---|---|---|
| 1 | 11 | 2 | 3.9 | 12 s | 12 s | 0.7 m |
| 2 | 22 | 4 | 5.4 | 11 s | 16 s | 1.5 m |
| 3 | 28 | 5 | 8.4 | 22 s | 22 s | 2.4 m |
| 4 | 39 | 7 | 9.9 | 28 s | 28 s | 3.4 m |
| 5 | 44 | 8 | 12.9 | 34 s | 31 s | 4.5 m |
| 6 | 44 | 8 | 14.4 | 46 s | 34 s | 5.8 m |
| 7 | 44 | 8 | 14.4 | 58 s | 34 s | 7.3 m |
| 8 | 44 | 8 | 14.4 | 108 s | 38 s | 9.6 m |
- Lesart: TTK ≤ Spawn-Dauer → Gegner sterben vor dem Stamm (W1–2 leicht, W3–4 knapp = fordernd).
  Ab W6 TTK > Spawn → Gegner erreichen den Stamm; ohne Mutationen fehlen ~30–60 % DPS → nur mit Build.
- Run-Dauer Modell: ~9.5 Min (Ziel 8–12 erfüllt). Lauf 1 (ohne Kosten-Anstieg) explodierte exponentiell
  (W8-DPS 2500) → deshalb Kosten-Multiplikatoren ×1.3 Frucht / +8 % Wurzel und harter Frucht-Deckel.
- Mutationen im Modell: Kettenfrucht ≈ +60 % Beeren-DPS gegen Schwärme, Echowurzel bei 20 Durchsatz ≈ +80 %,
  Dornenrinde ≈ Käfer/Boss-Konter → je 1–2 gute Wahl schließen die W6–8-Lücke.

## 10. Knackpunkte
1. **Frucht-Deckel (8) = DPS-Decke 44.** Ab W5 wächst nur noch Einkommen, nicht DPS → Überschuss ohne Senke.
   Senke = Verdicken (Feuerrate via Mangel-Malus/Echo) + Honigblüte; ggf. später Frucht-Upgrade.
2. **Käfer-Panzer 3 vs. Beere 11** = 27 % Verlust; mit nur Beeren wird W5–7 hart → Kapsel muss sich lohnen (Strategie 2).
3. **W8-Boss:** 1800 HP bei 44 DPS = 41 s reine Boss-Zeit, frisst Wurzeln → Einkommen bricht ein. Häufigste Niederlage.
4. Krähe fliegt oben: Früchte unten am Ast treffen sie kaum → hohe Äste nötig (Höhen-Bonus ist der Hebel).

## 11. Die 3 Regler zuerst
1. `enemyHpScale` (0.15) – verschiebt die ganze Schwierigkeitskurve ab W3.
2. `maxFruits` (8) / `fruitCostMult` (1.3) – bestimmt die DPS-Decke im Endgame.
3. `boss.hp` (1800) – entscheidet Sieg-Quote (Ziel: Erst-Sieg nach 3–5 Runs).

## 12. JS-Objekt
```js
const BALANCE = {
  grid: { soilW: 9, soilH: 7, airW: 9, airH: 6, waterSources: 5, mineralSources: 4, stones: [8, 10] },
  eco: {
    start: { w: 40, m: 30 }, sourceYield: 1.5,
    root: { w: 6, m: 2, growth: 0.08 },
    thicken: [null, { w: 15, m: 10 }, { w: 35, m: 25 }], maxTier: 3, throughput: [2, 4, 7],
    branch: { w: 4, m: 6, heightFactor: 0.35 },
    fruitCostMult: 1.3, waveReward: (wave) => 20 + 8 * wave,
  },
  limits: { maxBranches: 14, maxFruits: 8, maxEnemies: 24 },
  fruits: {
    thorn: { cost: { w: 10, m: 20 }, dmg: 11, rate: 0.5, range: 2.5, rangePerH: 0.4, use: { w: 0.2, m: 0.6 }, projSpeed: 8 },
    spore: { cost: { w: 20, m: 10 }, dps: 4, rate: 0.25, range: 2.0, rangePerH: 0.4, use: { w: 1.2, m: 0.3 }, radius: 1.0, duration: 4 },
    honey: { cost: { w: 15, m: 15 }, yield: { w: 0.6, m: 0.6 } },
    starvedRateMult: 0.4,
  },
  enemies: {
    aphid:  { hp: 14,  speed: 1.4,  dps: 1,  armor: 0, swarm: [4, 6] },
    beetle: { hp: 110, speed: 0.5,  dps: 4,  armor: 3 },
    crow:   { hp: 22,  speed: 2.2,  dps: 2,  armor: 0 },
    boss:   { hp: 1800, speed: 0.25, dps: 12, armor: 2, eatRootEvery: 3 },
    hpScale: 0.15, // HP × (1 + hpScale × (wave-1))
  },
  waves: [ // a=Blattlaus b=Käfer c=Krähe, spawn = Intervall s
    { a: 10, b: 0, c: 0, spawn: 1.2 }, { a: 16, b: 0, c: 0, spawn: 1.0 },
    { a: 14, b: 2, c: 0, spawn: 1.4 }, { a: 16, b: 3, c: 3, spawn: 1.3 },
    { a: 18, b: 4, c: 4, spawn: 1.2 }, { a: 20, b: 5, c: 6, spawn: 1.1 },
    { a: 22, b: 6, c: 6, spawn: 1.0 }, { a: 24, b: 6, c: 8, spawn: 1.0, boss: true },
  ],
  trunk: { maxHp: 100, buildRegen: 0.25 }, // Anteil fehlender HP
  mutations: {
    wanderRoot: { tiles: 2 },
    chainFruit: { jumps: 2, dmgMult: 0.7, jumpRange: 1.5 },
    symbiosis: { yield: { w: 0.5, m: 0.5 }, maxNodes: 4 },
    windfall: { dmg: 15, radius: 1.0 },
    echoRoot: { perThroughput: 0.04, cap: 1.8 },
    thornBark: { dps: 6 },
  },
};
```
