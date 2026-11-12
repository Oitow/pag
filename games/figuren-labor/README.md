# 🧍 Figuren-Labor

Testgelände für das Figuren-System der Engine (`docs/FIGUREN-SYSTEM.md`): Aussehen bearbeiten, herumlaufen, NPCs beobachten.

- ☰ Menü (Handy: Blatt von unten, großer Bildschirm: links) mit Reitern – die Figur rückt in den freien Bildteil
  - 👕 Aussehen: 17 Vorlagen, Zufalls-Looks (auch Kinder), alle Stile/Farben/Körperbau, Brille/Schal/Schmuck, Grund-Mimik live; wird im Browser gespeichert
  - ✨ Zauber: die 10 Zauber mit Beschreibung, Mana, Abklingzeit
  - 🗡 Ausrüstung (`character-ausruestung`): je Hand ein Gegenstand (Schild/Buch links)
  - 🎬 Aktionen: alle Clips aus `character-clips` (inkl. Zauber-Gesten) + Gesichtsausdrücke
  - ⚙️ Mehr: 🕹 PS1-Look an/aus, Kamera-Presets, Ich-Sicht, Kamerafahrt, NPCs, Namensschilder, Debug-Anzeige, unendlich Mana, „mich treffen“, alle heilen
- ✨ 12 schwere Zauber (`engine/gameplay/zauber` + `zauber-daten` + `engine/render/zauber-effekte`): Feuerball (Bogen, Brandboden), Eislanze (durchbohrt Reihen),
  Arkane Geschosse, Kettenblitz, Druckwelle, Erdstachel, Frostnova, Sog (zieht zusammen, dann Knall), Meteor (Krater), Heilung, Schutzschild, Blinzeln
  - **Halten = Aufladen**: die Figur holt aus und bleibt gespannt, wird langsam, Funken werden in die Hand gesaugt, Brummen steigt, Ziel-Kreis am Boden
  - **Weiter halten = Überladen** (goldener Balken): bis 1,6× Schaden, größerer Radius, mehr Geschosse/Kettenglieder
  - **Loslassen = Schlag**: Rückstoß, Staub, Kamera-Wackeln, kurzer Treffer-Stopp, Schadens-Zahlen, „☠ ×N“ bei Mehrfach-Kills; Rolle bricht ab (Mana zurück)
  - Auto-Zielen: Lock-On, sonst der dichteste Haufen (Flächenzauber) bzw. das beste Ziel im Blick, notfalls ringsum
- 🐀 Rattenplage (`engine/gameplay/horde`, `engine/render/horde-mesh`, `engine/models/kreaturen/ratte`): Wellen aus Ratten, Riesenratten und alle 5 Wellen ein Rattenkönig –
  sie umzingeln dich, springen an und beißen; Treffer schleudern sie durch die Luft. Fällt man, beginnt die Plage neu. `?plage=1` startet sofort
- 🔊 Synthetische Klänge (`engine/audio/klang`), im Menü abschaltbar
- Standard-Figur: Magier mit Zauberstab
- Figuren mit Randlicht und weicherer Schattenseite (`engine/render/figur-material`)
- 🕹 PS1-Look aus Viniland (`engine/render/psx`): grobe Pixel (300 Zeilen), wackelnde Eckpunkte, 5 Bit Farbe mit Dithering –
  liegt über der ganzen Szene, wird im Browser gemerkt; Kantenglättung wechselt erst nach Neuladen
- Gelände zum Ausprobieren: Treppe + Plateau (Stufen hochgehen), steile Rampe (rutschen), Teich (schwimmen), Bäume/Felsen (Hindernisse)
- 8 NPCs: einer folgt dir (und winkt), einer läuft eine Runde, der Rest lebt mit `character-brain` (wandern, arbeiten, plaudern)
- 🎯 Lock-On auf NPCs (T, nochmal = nächstes Ziel) – Zauber zielen darauf, sonst auf das Ziel in Blickrichtung
- 🏷 Namensschilder + Sprechblasen (`engine/ui/figur-schild`); in der Nähe eines NPCs E / 💬 = ansprechen

## Steuerung
WASD/Pfeile laufen · Shift Sprint · Leertaste springen · Q Rolle/Dash (bricht Aufladen ab) · V gleiten · C ducken/tauchen · T Ziel · E ansprechen ·
Ziehen = Kamera · Rad = Zoom · F Schlag · G winken · R halten = aufladen, loslassen = zaubern · 1–0, ß, ´ = Zauber wählen und aufladen.
Zauberleiste oben: tippen = wählen, nochmal tippen = wirken (ohne Überladen). 🐀 oben rechts = Rattenplage an/aus.
Handy: Stick links (erscheint unter dem Finger, Größe passt sich dem Bildschirm an), rechts ziehen = Kamera, zwei Finger = Zoom,
Knöpfe unten rechts (⤒ ✨ ⚔ 🌀 🪂 🎯, 💬 nur bei NPCs), leichte Vibration. Gamepad geht auch.
