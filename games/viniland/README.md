# 🛶 Viniland – Testlab (PoC)

Spiel à la Valheim, aber mit mehr Platz und Spielraum. Dieses Testlab prüft Charakter, Bewegung, Engine und Systeme.

**Spielen:** `games/viniland/` (GitHub Pages) · `?p=1` = 1 Spieler · `?seed=42` = andere Insel · `?demo` = Auto-Demo (P1 ruft einen Boss und kämpft) · `?dbg` = Positionsanzeige · `?hitbox` = Hitboxen zeigen

**Lokal per Doppelklick:** `viniland.html` öffnen (alles in einer Datei, braucht Internet für Three.js). `index.html` braucht einen Server oder GitHub Pages.
Nach Code-Änderungen neu bündeln: `python3 tests/bundle.py . viniland.html`

## Inhalt
- Große Insel (~220 m Radius), Wiesen, Wäldchen, Hügel mit Felsen, Strand, Wasser mit Wellen
- ~170 fällbare Bäume (Kiefer, Laubbaum, Birke): kippen mit Scharnier-Physik, zerfallen in Stamm-Segmente,
  die rollen, rutschen, schwimmen und sich schieben lassen. Segmente hacken → teilen → Holz 🪵
- 2 Spieler Splitscreen (vertikal/horizontal/auto), Tastatur + Maus + Gamepads
- 5 Spieler-Looks (Bjørn, Sigrun, Ulf, Freya, Toke), prozedurale Animation (Gehen, Sprint, Sprung, Landen, Axtschlag, Winken)
- 10 Tiere mit KI (Fuchs, Hase, Reh, Wildschwein, Schaf, Ente, Igel, Bär, Frosch, Eichhörnchen): wandern, fressen, sitzen, fliehen, neugierig
- **Kampf (Souls-lite, verzeihend):** HP/Ausdauer/Mana, 3er-Axt-Combo mit Input-Buffer und Soft-Lock, Ausweichrolle mit i-frames
  (Roll-Cancel aus der Angriffs-Erholung), Glutkugel (Fernzauber, zielsuchend, Explosion), Frostring (AoE mit Rückstoß/Stagger),
  Lock-On mit Zielwechsel, Hitstop, Partikel, Schadenszahlen, Tod → Respawn nach 4 s
- **3 Bosse** in Steinkreis-Arenen (60–150 m vom Start), kehren 30 s nach dem Tod zurück; im Menü rufbar („Boss rufen“), zurücksetzbar,
  Hitbox-Debugansicht
- PS1/PS2-Look: Pixel-Skala, Vertex-Snapping, Dithering (alles im Menü regelbar)
- **Tuning-Menü (Tab / Esc / Start):** alle Bewegungs- und Kamerawerte live per Schieberegler (Speed, Beschleunigung,
  Sprunghöhe, Coyote-Zeit, Jump-Buffer, Stufenhöhe, Kamera-Folgen …), wird im Browser gespeichert

## Steuerung
| | Spieler 1 | Spieler 2 | Gamepad |
|---|---|---|---|
| Laufen | WASD | Pfeile / IJKL | Linker Stick |
| Springen | Leertaste | Enter / H | A |
| Sprinten | L-Shift | R-Shift / N | LB / L3 |
| Angriff / Hacken (3er-Combo) | F / Linksklick | R-Strg / P | X / RT |
| Ausweichrolle | C | M / Num1 | B |
| Zauber 1: Glutkugel | 1 (oder 3) | 7 / Num7 | RB |
| Zauber 2: Frostring | 2 (oder 4) | 8 / Num9 | Y |
| Ziel fixieren (Lock-On) | T / Mausrad-Klick | Ö / Num3 | LT / R3 |
| Ziel wechseln (im Lock-On) | Q / E, Maus wischen | U / O | Rechten Stick antippen |
| Winken | G | Ü | D-Pad ← |
| Kamera | Q/E, R/V, rechte Maustaste ziehen, Doppelklick = Maus fangen | U/O | Rechter Stick |
| Zoom | Z/X, Mausrad | Komma/Punkt | D-Pad ↑↓ |
| Menü | Tab / Esc | – | Start |

Kampf-Tipps: Angriffe während des Schlags erneut drücken (Buffer 0,3 s) = Combo; aus der Erholung heraus kann gerollt werden.
Rolle in Stick-Richtung, sonst nach vorne; i-frames ca. 0,02–0,37 s. Nach einem Treffer kurz unverwundbar. Werte im Menü unter „Kampfwerte“.

Gamepad-Zuordnung (Menü): **Auto** = bei 2 Spielern und nur 1 Gamepad steuert das Gamepad Spieler 2 (Tastatur = Spieler 1),
bei 2 Gamepads je eins pro Spieler. Fest einstellbar, Tastatur pro Spieler abschaltbar.

**Steam Controller:** Steam emuliert im Desktop-Betrieb Tastatur/Maus (Stick = Pfeiltasten, Trigger = Mausklick).
In Steam → Einstellungen → Controller → Desktop-Layout die Emulation deaktivieren bzw. auf eine Gamepad-Vorlage stellen,
sonst steuert der Controller doppelt. Alternativ im Menü „Tastatur P2 aus“.

## Code (ES-Module, kein Build)
| Datei | Inhalt |
|---|---|
| `js/main.js` | Loop, Splitscreen, HUD, Menü, Boss-Arenen |
| `js/combat.js` | Kampf-Kern: Actors, Hitboxen, Projektile, Telegraphs, Hitstop, FX, Schadenszahlen |
| `js/fighter.js` | Spieler-Kampf: Combo, Rolle, Zauber, Lock-On, Treffer/Tod |
| `js/bosses.js` | 3 Bosse (KI, Animation, Attacken) |
| `js/controller.js` | Charakter-Controller (`TUNING`) |
| `js/camera.js` | Third-Person-Kamera (`CAM_TUNING`) |
| `js/input.js` | Tastatur/Maus/Gamepad |
| `js/world.js` | Insel, Bäume, Stamm-Physik, Deko |
| `js/players.js` | Spielerfiguren + Animation |
| `js/animals.js` | 10 Tiere + Animation |
| `js/fauna.js` | Tier-KI |
| `js/psx.js`, `js/kit.js` | PSX-Shader, Mesh-Baukasten, Noise |

Einzel-Viewer: `tests/animals.html`, `tests/players.html`, `tests/world.html`. Schnittstellen: `CONTRACT.md`.
