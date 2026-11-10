# 🎮 PAG – Spiele

Alle Spiele: Single-File HTML, mobil-tauglich. Startseite: [index.html](index.html)

| Spiel | Beschreibung |
|---|---|
| [🪐 Planet – Tierfänger](games/planet/) | Survival à la Valheim auf einem prozeduralen Kugel-Planeten: Tiere fangen, ihre Fähigkeiten nutzen, Biome freischalten |
| [🛶 Viniland Testlab](games/viniland/) | Valheim-artiges Testlab: Insel, fällbare Bäume mit Physik, 10 Tiere, 2-Spieler-Splitscreen |
| [🌍 Tier-Testwelt](games/voxel-tiere/welt.html) | Alle Tiere in einer begehbaren Welt |
| [🐾 Voxel-Tiere](games/voxel-tiere/) | 148 süße Voxel-Tiere zum Anschauen |
| [📖 Tier-Sammelspiel](games/sammelspiel/) | Ressourcen sammeln, Lebensräume bauen, Tiere anlocken, Regionen freischalten |
| [🏘️ Siedlung](games/siedlung/) | Aufbauspiel mit prozeduraler Welt und Trampelpfaden |
| [🧍 Figuren-Labor](games/figuren-labor/) | Testgelände fürs Figuren-System der Engine: Aussehen-Editor mit Mimik, Ausrüstung, 40+ Animationen, 10 Zauber, Handy-Menü, Rolle/Gleiten, NPCs mit KI |
| [🌳 Wurzelwerk](games/wurzelwerk/) | Baum-Roguelite: Wurzeln, Äste, Schädlingswellen |
| [🧪 Weltlabor](games/weltlabor/) | Weltgenerator der Engine: 13 Presets, Seed, Regler, Ebenen (Höhe, Biome, Flüsse …), Chunk-Modus mit Flussnetz und Seen |
| [🌳 Natur-Labor](games/natur-labor/) | Prozedurale Bäume, Felsen, Büsche und Pflanzen der Engine ansehen: Typ, Seed, Detail, Jahreszeit, Wind |
| [🌍 Testwelt](games/testwelt/) | Begehbare 3D-Welt aus Weltgenerator + echter Figur, Dorfbewohner mit Tagesablauf, Tag/Nacht, Wetter und Spielstand |

## 🧰 Baukasten (Engine)

Gemeinsame Bausteine für alle Spiele liegen in [`engine/`](engine/) – Übersicht im [Katalog](engine/KATALOG.md), Plan in [docs/BAUKASTEN-PLAN.md](docs/BAUKASTEN-PLAN.md), Regeln für die KI in [CLAUDE.md](CLAUDE.md).

```
npm install            # einmalig
npm run test:schnell   # Engine-Tests + Katalog-Prüfung
npm test               # alles inkl. Smoke-Test im Browser
npm run build          # Einzeldateien nach dist/<spiel>.html (Doppelklick-Start)
npm run katalog        # Katalog neu erzeugen
```

Tests liegen in `tests/` und neben den Engine-Modulen (`*.test.mjs`).
