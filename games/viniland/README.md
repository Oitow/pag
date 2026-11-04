# 🛶 Viniland – Testlab (PoC)

Spiel à la Valheim, aber mit mehr Platz und Spielraum. Dieses Testlab prüft Charakter, Bewegung, Engine und Systeme.

**Spielen:** `games/viniland/` (GitHub Pages) · `?p=1` = 1 Spieler · `?seed=42` = andere Insel · `?demo` = Auto-Demo · `?dbg` = Positionsanzeige

**Lokal per Doppelklick:** `viniland.html` öffnen (alles in einer Datei, braucht Internet für Three.js). `index.html` braucht einen Server oder GitHub Pages.
Nach Code-Änderungen neu bündeln: `python3 tests/bundle.py . viniland.html`

## Inhalt
- Große Insel (~220 m Radius), Wiesen, Wäldchen, Hügel mit Felsen, Strand, Wasser mit Wellen
- ~170 fällbare Bäume (Kiefer, Laubbaum, Birke): kippen mit Scharnier-Physik, zerfallen in Stamm-Segmente,
  die rollen, rutschen, schwimmen und sich schieben lassen. Segmente hacken → teilen → Holz 🪵
- 2 Spieler Splitscreen (vertikal/horizontal/auto), Tastatur + Maus + Gamepads
- 5 Spieler-Looks (Bjørn, Sigrun, Ulf, Freya, Toke), prozedurale Animation (Gehen, Sprint, Sprung, Landen, Axtschlag, Winken)
- 10 Tiere mit KI (Fuchs, Hase, Reh, Wildschwein, Schaf, Ente, Igel, Bär, Frosch, Eichhörnchen): wandern, fressen, sitzen, fliehen, neugierig
- PS1/PS2-Look: Pixel-Skala, Vertex-Snapping, Dithering (alles im Menü regelbar)
- **Tuning-Menü (Tab / Esc / Start):** alle Bewegungs- und Kamerawerte live per Schieberegler (Speed, Beschleunigung,
  Sprunghöhe, Coyote-Zeit, Jump-Buffer, Stufenhöhe, Kamera-Folgen …), wird im Browser gespeichert

## Steuerung
| | Spieler 1 | Spieler 2 | Gamepad |
|---|---|---|---|
| Laufen | WASD | Pfeile / IJKL | Linker Stick |
| Springen | Leertaste | Enter / H | A |
| Sprinten | L-Shift | R-Shift / N | LB / L3 / LT |
| Hacken | F / Linksklick | R-Strg / P | X / RT / RB |
| Winken | G | Ü | Y |
| Kamera | Q/E, R/V, rechte Maustaste ziehen, Doppelklick = Maus fangen | U/O | Rechter Stick |
| Zoom | Z/X, Mausrad | Komma/Punkt | D-Pad ↑↓ |

Gamepad-Zuordnung (Menü): **Auto** = bei 2 Spielern und nur 1 Gamepad steuert das Gamepad Spieler 2 (Tastatur = Spieler 1),
bei 2 Gamepads je eins pro Spieler. Fest einstellbar, Tastatur pro Spieler abschaltbar.

**Steam Controller:** Steam emuliert im Desktop-Betrieb Tastatur/Maus (Stick = Pfeiltasten, Trigger = Mausklick).
In Steam → Einstellungen → Controller → Desktop-Layout die Emulation deaktivieren bzw. auf eine Gamepad-Vorlage stellen,
sonst steuert der Controller doppelt. Alternativ im Menü „Tastatur P2 aus“.

## Code (ES-Module, kein Build)
| Datei | Inhalt |
|---|---|
| `js/main.js` | Loop, Splitscreen, HUD, Menü, Hacken |
| `js/controller.js` | Charakter-Controller (`TUNING`) |
| `js/camera.js` | Third-Person-Kamera (`CAM_TUNING`) |
| `js/input.js` | Tastatur/Maus/Gamepad |
| `js/world.js` | Insel, Bäume, Stamm-Physik, Deko |
| `js/players.js` | Spielerfiguren + Animation |
| `js/animals.js` | 10 Tiere + Animation |
| `js/fauna.js` | Tier-KI |
| `js/psx.js`, `js/kit.js` | PSX-Shader, Mesh-Baukasten, Noise |

Einzel-Viewer: `tests/animals.html`, `tests/players.html`, `tests/world.html`. Schnittstellen: `CONTRACT.md`.
