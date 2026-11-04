# 🛶 Viniland – Testlab (PoC)

Spiel à la Valheim, aber mit mehr Platz und Spielraum. Dieses Testlab prüft Charakter, Bewegung, Engine und Systeme.

**Spielen:** `games/viniland/` (GitHub Pages) · `?p=1` = 1 Spieler · `?seed=42` = andere Insel · `?demo` = Auto-Demo (P1 plündert das Wrack, rüstet aus, kämpft, sammelt Glut; P2 zeigt das Inventar) · `?warp=7` = Test-Zeitraffer · `?dbg` = Positionsanzeige · `?hitbox` = Hitboxen zeigen

**Lokal per Doppelklick:** `viniland.html` öffnen (alles in einer Datei, braucht Internet für Three.js). `index.html` braucht einen Server oder GitHub Pages.
Nach Code-Änderungen neu bündeln: `python3 tests/bundle.py . viniland.html`

## Inhalt
- **Prämisse:** Gestrandet an der Grauen Küste – Spawn am Schiffswrack, Start mit Fäusten. Im Wrack liegen Treibholzknüppel + eine Zauberrolle.
- Biome (Graue Küste → Düsterwald → Leuchtpilzhain, Aschenöde/Frostgipfel als Platzhalter), Atmosphäre (Nebel/Licht/Grading) pro Splitscreen-Ansicht,
  Biom-Name wird beim Betreten groß eingeblendet. Nebeltore zwischen den Biomen öffnen sich mit dem **Siegel** des Siegelträgers.
- Bäume fällen, Stamm-Physik, Tiere mit KI, 2 Spieler Splitscreen (vertikal/horizontal/auto), Tastatur + Maus + Gamepads
- **Kampf (Souls-lite):** leichte/schwere Angriffe, Waffenkunst, Rolle mit i-frames, 2 Zauber-Slots, Glutflakon, Lock-On, Hitstop, Schadenszahlen
- **Bosse** (3 pro Biom, einer davon Siegelträger ⚜) in den Arenen der Welt; besiegte Bosse bleiben tot (Menü: „Bosse zurücksetzen“).
  **Gegner** in Zonen (1–4), werden nur in Spielernähe aktiv, respawnen beim Rasten.
- **RPG:**
  - **Glut** = Währung/EP. Jeder Kill gibt *beiden* Spielern die volle Glut (Koop). Partikel fliegen zum Spieler.
  - **Tod:** Glut fällt als **Glutrest** am Todesort (nur der Besitzer kann ihn aufheben). Stirbt man erneut, ist er verloren.
  - **Leuchtfeuer:** entzünden/rasten = volle Heilung, Flakon voll, Respawn-Punkt, Gegner respawnen. Menü: Stufe aufsteigen, Zauber wechseln, Ausrüstung, Schmieden.
  - **Stufen:** Kosten 60 + 40·L + 6·L² Glut (1→2: 106 · 5→6: 410 · 10→11: 1060 · 20→21: 3260). Attribute Vitalität/Ausdauer/Stärke/Geschick/Verstand/Glaube (Start je 10).
  - **Loot:** Gewöhnlich (grau) / Selten (blau) / Episch (violett) / Legendär (gold) – leuchtender Gegenstand + Lichtsäule in Seltenheitsfarbe.
    Normale Gegner 7 % Item, 6 % Schmiedestein, 0,4 % Flakon-Splitter; Elite 35/25/4 %; Bosse: garantierte Boss-Waffe + Boss-Relikt (+ Rolle), 2 Schmiedesteine,
    Siegelträger zusätzlich das Siegel.
  - **Items:** Waffen (alle Waffen des Kampf-Moduls, +0…+5, Seltenheit = Schadens-Bonus + 0–2 Affixe), Zauber-Schriftrollen (lernen → Zauberbuch),
    16 Relikte (passive Boni, 2 Slots), Glutflakon-Splitter (+1 Ladung), Schmiedestein, Glutkern (+250 Glut), Siegel.
  - **Schmieden** (Leuchtfeuer): +1/+2: 1 Stein, +3/+4: 2, +5: 3 Steine; jeweils 150 + 200·Stufe Glut. +12 % Schaden pro Stufe.
- **UI** (pro Ansicht, komplett per Gamepad/Tastatur): Inventar mit Reitern Ausrüstung · Inventar · Zauberbuch · Optionen, Item-Tooltips (Pergament),
  Leuchtfeuer-Menü, Stufenaufstieg mit Attribut-Vorschau, Schmiede, Loot-Popups, Interaktions-Hinweis. Maus: Klick = wählen, nochmal = bestätigen.
- **Musik:** prozedural pro Biom, Bosskampf/Siegelträger eigene Musik, Stings bei Sieg/Tod/Stufe/Entdeckung.
- **Menü (Esc / Start):** Reiter Spiel (Spieler, Split, Gamepads, Bosse/Gegner rufen), **Optionen**, RPG (Test-Glut, Loot, Kurven), Tuning (alle Regler)
- **Optionen** (gespeichert): Sprint halten/umschalten, Auto-Laufen, Kamera invertieren X/Y, Empfindlichkeit Maus/Pad, Lock-On halten/umschalten,
  Auto-Ausrichtung, Schadenszahlen, Kamera-Shake, Vibration, Auto-Aufheben, HUD-Größe, Musik-/Effekt-Lautstärke, Hitboxen

## Steuerung
| | Spieler 1 | Spieler 2 | Gamepad |
|---|---|---|---|
| Laufen | WASD | Pfeile / IJKL | Linker Stick |
| Springen | Leertaste | Enter / H | A |
| Sprinten | L-Shift | R-Shift / N | L3 (oder B halten) |
| Ausweichrolle | C | M | B |
| Leichter Angriff | F / Linksklick | P / R-Strg | RB |
| Schwerer Angriff (halten = aufladen) | R | Ü | RT |
| Waffenkunst | V | Ä | LT |
| Zauber 1 / 2 | 1 / 2 | 7 / 8 | LB / Y |
| Glutflakon | 3 / X | 9 | X |
| Interagieren (aufheben, Leuchtfeuer, Tor) | G | 0 | D-Pad ↑ |
| Inventar | Tab / B | Rücktaste | View |
| Ziel fixieren / wechseln | T / Mittelklick · Q/E | Ö · U/O | R3 · rechten Stick antippen |
| Kamera | Q/E, rechte Maus ziehen, Doppelklick = Maus fangen | U/O | Rechter Stick |
| Zoom | Mausrad / Z | Komma/Punkt | D-Pad ↓ |
| Auto-Laufen | 4 | + | D-Pad → |
| Winken | ^ / 5 | # | D-Pad ← |
| Menü | Esc | Ende | Start |
| In Menüs | WASD · Leertaste/F ok · C zurück · Q/E Reiter | Pfeile · Enter ok · M zurück · U/O Reiter | Stick/D-Pad · A ok · B zurück · LB/RB Reiter |

Kurzfassung aus `input.js` (KEY_HELP/PAD_HELP):
- P1: WASD laufen · Leertaste springen · L-Shift sprinten · C rollen · F / Linksklick leicht · R schwer (halten = aufladen) · V Waffenkunst · 1 / 2 Zauber · 3 / X Glutflakon · G interagieren · Tab/B Inventar · T / Mittelklick Ziel fixieren (Q/E wechseln) · Q/E bzw. rechte Maus = Kamera · Mausrad / Z = Zoom · 4 Auto-Laufen · Esc Menü
- P2: Pfeile/IJKL laufen · Enter/H springen · R-Shift/N sprinten · M rollen · P / R-Strg leicht · Ü schwer · Ä Waffenkunst · 7 / 8 Zauber · 9 Glutflakon · 0 interagieren · Rücktaste Inventar · Ö Ziel fixieren (U/O wechseln) · U/O Kamera · Komma/Punkt Zoom · + Auto-Laufen · Ende Menü
- Gamepad: Stick L laufen · A springen · B rollen (halten = sprinten) · L3 sprinten · RB leicht · RT schwer (halten = aufladen) · LT Waffenkunst · LB Zauber 1 · Y Zauber 2 · X Glutflakon · R3 Ziel fixieren (Stick R antippen = wechseln) · ↑ interagieren · ↓ Zoom · ← winken · → Auto-Laufen · View Inventar · Start Menü · Menüs: Stick/D-Pad, A ok, B zurück, LB/RB Reiter

Gamepad-Zuordnung (Menü): **Auto** = bei 2 Spielern und nur 1 Gamepad steuert das Gamepad Spieler 2 (Tastatur = Spieler 1),
bei 2 Gamepads je eins pro Spieler. Fest einstellbar, Tastatur pro Spieler abschaltbar.

**Steam Controller:** Steam emuliert im Desktop-Betrieb Tastatur/Maus (Stick = Pfeiltasten, Trigger = Mausklick).
In Steam → Einstellungen → Controller → Desktop-Layout die Emulation deaktivieren bzw. auf eine Gamepad-Vorlage stellen,
sonst steuert der Controller doppelt. Alternativ im Menü „Tastatur P2 aus“.

## Code (ES-Module, kein Build)
| Datei | Inhalt |
|---|---|
| `js/main.js` | Loop, Splitscreen, HUD, Menü, Boss-Slots, Gegner-Zonen, RPG-Integration, Musik-Hooks, Demo |
| `js/options.js` | Spieler-Optionen `OPTIONS` (alle Module lesen, localStorage) |
| `js/items.js` | Seltenheiten, Affixe, Relikte, Verbrauchsgüter, Siegel, Item-Instanzen, Tooltips |
| `js/loot.js` | Drop-Tabellen, Welt-Pickups mit Lichtsäule, Glutreste, Glut-Partikel |
| `js/progression.js` | Glut, Stufen/Attribute, Inventar/Ausrüstung, Zauberbuch, Schmieden → Fighter-API |
| `js/ui.js` | RPG-Oberfläche pro Ansicht (Inventar, Leuchtfeuer, Stufenaufstieg, Schmiede, Popups, Biom-Titel) |
| `js/combat.js` | Kampf-Kern: Actors, Hitboxen, Projektile, Telegraphs, Hitstop, FX, Schadenszahlen |
| `js/fighter.js` | Spieler-Kampf: Combo, Rolle, Zauber, Lock-On, Treffer/Tod |
| `js/bosses.js`, `js/bosses2.js` | Bosse (KI, Animation, Attacken, Varianten) |
| `js/enemies.js` | Registry: `ALL_BOSSES`, `ENEMY_TYPES`, `spawnBoss`, `spawnEnemy` |
| `js/weapons.js`, `js/spells.js` | Waffen (Combos, Waffenkunst, Skalierung) und 10 Zauber |
| `js/biomes.js` | Biom-Daten (Atmosphäre, Paletten, Anker) |
| `js/audio.js` | Prozedurale Musik + Soundeffekte (WebAudio) |
| `js/controller.js` | Charakter-Controller (`TUNING`) |
| `js/camera.js` | Third-Person-Kamera (`CAM_TUNING`) |
| `js/input.js` | Tastatur/Maus/Gamepad |
| `js/world.js` | Insel, Bäume, Stamm-Physik, Deko |
| `js/players.js` | Spielerfiguren + Animation |
| `js/animals.js` | 10 Tiere + Animation |
| `js/fauna.js` | Tier-KI |
| `js/psx.js`, `js/kit.js` | PSX-Shader, Mesh-Baukasten, Noise |

Einzel-Viewer: `tests/animals.html`, `tests/players.html`, `tests/world.html`, `tests/rpg-ui.html?screen=inventory|shrine|levelup|forge|equip|options`. Schnittstellen: `CONTRACT.md`.
