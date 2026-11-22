# 🎮 PAG – Baukasten, Testfeld und das MMO Erlenwacht

Alles läuft im Browser, auch am Handy. Startseite: [index.html](index.html) · Pages: <https://oitow.github.io/pag/>

## So ist das Repo aufgebaut

```
engine/        🧰 Baukasten: Bausteine + Spiel-Module (engine/spiel/modul-*.js)
labore/        🔬 Labore: Bausteine einzeln ansehen und feintunen
testfeld/      🧪 Gemeinsames Testfeld: alle Module zusammen (oder ?nur=<modul> einzeln)
erlenwacht/    🏰 Das echte Spiel: nur fertige Module
spiele/        🎮 Eigenständige Spiele und alte Prototypen
docs/          📚 Stand, Regeln, Baupläne (docs/plaene/), Bilder
tests/ tools/  ✅ Tests, Smoke-Test, Build, Bildschirmfotos
```

Ein Modul wandert **Labor → Testfeld → Spiel**. Die Stufe steht an einer Stelle: [`engine/spiel/module-register.js`](engine/spiel/module-register.js).
Wie das genau geht: [docs/MODULE.md](docs/MODULE.md). Regeln für jede KI: [AGENTS.md](AGENTS.md). Wer arbeitet woran: [docs/ARBEIT.md](docs/ARBEIT.md).

## 🏰 Das Spiel
| | |
|---|---|
| [Erlenwacht](erlenwacht/) | Das MMO: Held erstellen, 3 Klassen, Stufen + Talente, Beute, Tutorial-Quests, Boss, Chat, Minikarte – große gestreamte Welt (≈4×4 km): Küste → Dämmerwald → Siedlung → Hochland/Moor/Gebirge |

## 🧪 Testfeld
| | |
|---|---|
| [Testfeld](testfeld/) | Alle Module zusammen, ohne Titel. `?nur=kampf` = ein Modul einzeln, `?labor=1` = auch unfertige Module |

## 🔬 Labore
| Labor | Zeigt |
|---|---|
| [Figuren](labore/figuren/) | Figuren-Editor, 40+ Animationen, Ausrüstung, Kampf (Kombos, Parade), Zauber + Großzauber, Rattenplage/Horden, NPCs |
| [Natur](labore/natur/) | Prozedurale Bäume, Felsen, Büsche, Pflanzen, Riesenbaum, Splats |
| [Welt](labore/welt/) | Weltgenerator: 13 Presets, Seed, Regler, Ebenen, Chunk-Modus mit Flüssen und Seen |
| [Handwerk](labore/handwerk/) | (früher „Testwelt“) Dorf mit Tagesablauf, Wetter, Dinge aufheben, Herstellen, Bäume fällen, Graben, Schuppen mit Tür/Truhe |
| [Dämmerwald](labore/daemmerwald/) | Startgebiet in echter Größe: 110 m Riesenbäume (SDF + Gauß-Splats), Lichtstrahlen, Tag/Nacht |
| [Enklave](labore/enklave/) | Startgebiet: Tutorial-Tal, Pfad, ummauerte Stadt mit Bürgern; [Bau-Galerie](labore/enklave/galerie.html) |

## 🎮 Weitere Spiele
| Spiel | Beschreibung |
|---|---|
| [🪐 Planet – Tierfänger](spiele/planet/) | Survival auf einem Kugel-Planeten: Tiere fangen, Fähigkeiten nutzen, Biome freischalten |
| [🛶 Viniland](spiele/viniland/) | Insel, fällbare Bäume, 10 Tiere, 2-Spieler-Splitscreen |
| [🐾 Voxel-Tiere](spiele/voxel-tiere/) · [Tier-Welt](spiele/voxel-tiere/welt.html) | 148 Voxel-Tiere einzeln und in einer Welt |
| [📖 Tier-Sammelspiel](spiele/sammelspiel/) | Ressourcen sammeln, Lebensräume bauen, Tiere anlocken |
| [⚔️ Tier-Autobattler](spiele/autobattler/) | 6er-Teams aus Voxel-Tieren (beiseitegelegt) |
| [🏘️ Siedlung](spiele/siedlung/) | Aufbauspiel mit prozeduraler Welt und Trampelpfaden |
| [🌳 Wurzelwerk](spiele/wurzelwerk/) | Baum-Roguelite |
| [🎛 Mix Lab](spiele/mix-lab/) | Beat-Producer mit synthetischen Klängen |

## Befehle
```
npm install            # einmalig
npm run test:schnell   # Engine-Tests + Katalog-Prüfung
npm test               # alles inkl. Smoke-Test im Browser (jeder Ort mit spiel.json)
npm run build          # Einzeldateien nach dist/<name>.html (Doppelklick-Start)
npm run katalog        # Katalog engine/KATALOG.md neu erzeugen
```
