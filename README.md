# 🎮 PAG – Baukasten, Testfeld und das MMO Erlenwacht

**[Projektübersicht öffnen](https://oitow.github.io/pag/)** · [Erlenwacht starten](https://oitow.github.io/pag/erlenwacht/) · [Testfeld starten](https://oitow.github.io/pag/testfeld/)

### Stand & Änderungen

[Projektstand](https://github.com/Oitow/pag/blob/main/docs/STAND.md) · [Wer arbeitet woran?](https://github.com/Oitow/pag/blob/main/docs/ARBEIT.md) · [Letzte Änderungen](https://github.com/Oitow/pag/commits/main/) · [Offene Pull Requests](https://github.com/Oitow/pag/pulls) · [Engine-Katalog](https://github.com/Oitow/pag/blob/main/engine/KATALOG.md)

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
| [Erlenwacht](https://oitow.github.io/pag/erlenwacht/) | Das MMO: Held erstellen, 3 Klassen, Stufen + Talente, Beute, Tutorial-Quests, Boss, Chat, Minikarte – große gestreamte Welt (≈4×4 km): Küste → Dämmerwald → Siedlung → Hochland/Moor/Gebirge |

## 🧪 Testfeld
| | |
|---|---|
| [Testfeld](https://oitow.github.io/pag/testfeld/) | Alle Module zusammen, ohne Titel. `?nur=kampf` = ein Modul einzeln, `?labor=1` = auch unfertige Module |

## 🔬 Labore
| Labor | Zeigt |
|---|---|
| [Figuren](https://oitow.github.io/pag/labore/figuren/) | Figuren-Editor, 40+ Animationen, Ausrüstung, Kampf (Kombos, Parade), Zauber + Großzauber, Rattenplage/Horden, NPCs |
| [Natur](https://oitow.github.io/pag/labore/natur/) | Prozedurale Bäume, Felsen, Büsche, Pflanzen, Riesenbaum, Splats |
| [Welt](https://oitow.github.io/pag/labore/welt/) | Weltgenerator: 13 Presets, Seed, Regler, Ebenen, Chunk-Modus mit Flüssen und Seen |
| [Handwerk](https://oitow.github.io/pag/labore/handwerk/) | (früher „Testwelt“) Dorf mit Tagesablauf, Wetter, Dinge aufheben, Herstellen, Bäume fällen, Graben, Schuppen mit Tür/Truhe |
| [Dämmerwald](https://oitow.github.io/pag/labore/daemmerwald/) | Startgebiet in echter Größe: 110 m Riesenbäume (SDF + Gauß-Splats), Lichtstrahlen, Tag/Nacht |
| [Enklave](https://oitow.github.io/pag/labore/enklave/) | Startgebiet: Tutorial-Tal, Pfad, ummauerte Stadt mit Bürgern; [Bau-Galerie](https://oitow.github.io/pag/labore/enklave/galerie.html) |
| [Erde](https://oitow.github.io/pag/labore/erde/) | Planet, Geologie und Überleben |
| [Gigantwelt](https://oitow.github.io/pag/labore/gigantwelt/) | Voxel-Graben, Bäume und Fundstellen |
| [Naturstimmungen](https://oitow.github.io/pag/labore/naturstimmungen/) | Schilfufer, Waldgrund, Schieferhang und Mondlicht |

## 🎮 Weitere Spiele
| Spiel | Beschreibung |
|---|---|
| [🪐 Planet – Tierfänger](https://oitow.github.io/pag/spiele/planet/) | Survival auf einem Kugel-Planeten: Tiere fangen, Fähigkeiten nutzen, Biome freischalten |
| [🛶 Viniland](https://oitow.github.io/pag/spiele/viniland/) | Insel, fällbare Bäume, 10 Tiere, 2-Spieler-Splitscreen |
| [🐾 Voxel-Tiere](https://oitow.github.io/pag/spiele/voxel-tiere/) · [Tier-Welt](https://oitow.github.io/pag/spiele/voxel-tiere/welt.html) | 148 Voxel-Tiere einzeln und in einer Welt |
| [📖 Tier-Sammelspiel](https://oitow.github.io/pag/spiele/sammelspiel/) | Ressourcen sammeln, Lebensräume bauen, Tiere anlocken |
| [⚔️ Tier-Autobattler](https://oitow.github.io/pag/spiele/autobattler/) | 6er-Teams aus Voxel-Tieren (beiseitegelegt) |
| [🏘️ Siedlung](https://oitow.github.io/pag/spiele/siedlung/) | Aufbauspiel mit prozeduraler Welt und Trampelpfaden |
| [🌳 Wurzelwerk](https://oitow.github.io/pag/spiele/wurzelwerk/) | Baum-Roguelite |
| [🎛 Mix Lab](https://oitow.github.io/pag/spiele/mix-lab/) | Beat-Producer mit synthetischen Klängen |

## Befehle
```
npm install            # einmalig
npm run test:schnell   # Engine-Tests + Katalog-Prüfung
npm test               # alles inkl. Smoke-Test im Browser (jeder Ort mit spiel.json)
npm run build          # Einzeldateien nach dist/<name>.html (Doppelklick-Start)
npm run katalog        # Katalog engine/KATALOG.md neu erzeugen
```
