# 🧍 Figuren-Labor

Testgelände für das Figuren-System der Engine (`docs/FIGUREN-SYSTEM.md`): Aussehen bearbeiten, herumlaufen, NPCs beobachten.

- ☰ Menü (Handy: Blatt von unten, großer Bildschirm: links) mit Reitern – die Figur rückt in den freien Bildteil
  - 👕 Aussehen: 17 Vorlagen, Zufalls-Looks (auch Kinder), alle Stile/Farben/Körperbau, Brille/Schal/Schmuck, Grund-Mimik live; wird im Browser gespeichert
  - ✨ Zauber: die 10 Zauber mit Beschreibung, Mana, Abklingzeit
  - 🗡 Ausrüstung (`character-ausruestung`): je Hand ein Gegenstand (Schild/Buch links)
  - 🎬 Aktionen: alle Clips aus `character-clips` (inkl. Zauber-Gesten) + Gesichtsausdrücke
  - ⚙️ Mehr: 🕹 PS1-Look an/aus, Kamera-Presets, Ich-Sicht, Kamerafahrt, NPCs, Namensschilder, Debug-Anzeige, unendlich Mana, „mich treffen“, alle heilen
- ✨ 10 Zauber (`engine/gameplay/zauber` + `engine/render/zauber-effekte`): Feuerball, Eislanze, Arkane Geschosse, Kettenblitz, Windstoß,
  Erdstachel, Meteor, Heilung, Schutzschild, Blinzeln – mit Geste, Aufladen an der Hand, Mana und Abklingzeit; NPCs haben Leben, taumeln, fallen um
- Figuren mit Randlicht und weicherer Schattenseite (`engine/render/figur-material`)
- 🕹 PS1-Look aus Viniland (`engine/render/psx`): grobe Pixel (300 Zeilen), wackelnde Eckpunkte, 5 Bit Farbe mit Dithering –
  liegt über der ganzen Szene, wird im Browser gemerkt; Kantenglättung wechselt erst nach Neuladen
- Gelände zum Ausprobieren: Treppe + Plateau (Stufen hochgehen), steile Rampe (rutschen), Teich (schwimmen), Bäume/Felsen (Hindernisse)
- 8 NPCs: einer folgt dir (und winkt), einer läuft eine Runde, der Rest lebt mit `character-brain` (wandern, arbeiten, plaudern)
- 🎯 Lock-On auf NPCs (T, nochmal = nächstes Ziel) – Zauber zielen darauf, sonst auf das Ziel in Blickrichtung
- 🏷 Namensschilder + Sprechblasen (`engine/ui/figur-schild`); in der Nähe eines NPCs E / 💬 = ansprechen

## Steuerung
WASD/Pfeile laufen · Shift Sprint · Leertaste springen · Q Rolle/Dash · V gleiten · C ducken/tauchen · T Ziel · E ansprechen ·
Ziehen = Kamera · Rad = Zoom · F Schlag · G winken · R zaubern · 1–0 Zauber sofort.
Zauberleiste oben: tippen = wählen, nochmal tippen = wirken.
Handy: Stick links (erscheint unter dem Finger, Größe passt sich dem Bildschirm an), rechts ziehen = Kamera, zwei Finger = Zoom,
Knöpfe unten rechts (⤒ ✨ ⚔ 🌀 🪂 🎯, 💬 nur bei NPCs), leichte Vibration. Gamepad geht auch.
