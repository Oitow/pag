# 🧍 Figuren-Labor

Testgelände für das Figuren-System der Engine (`docs/FIGUREN-SYSTEM.md`): Aussehen bearbeiten, herumlaufen, NPCs beobachten.

- 👕 Aussehen: 17 Vorlagen, Zufalls-Looks (auch Kinder), alle Stile/Farben/Körperbau, Brille/Schal/Schmuck, Grund-Mimik live; wird im Browser gespeichert
- Gelände zum Ausprobieren: Treppe + Plateau (Stufen hochgehen), steile Rampe (rutschen), Teich (schwimmen), Bäume/Felsen (Hindernisse)
- 8 NPCs: einer folgt dir (und winkt), einer läuft eine Runde, der Rest lebt mit `character-brain` (wandern, arbeiten, plaudern)
- 🗡 Ausrüstung durchschalten (`character-ausruestung`: Schwert, Axt, Schild, Fackel, Laterne …)
- 🎬 Aktionen: alle Animations-Clips, automatisch aus `character-clips` (neue Clips erscheinen von selbst), nach Körperteil gruppiert, ↻ = Schleife; dazu eine Reihe mit allen Gesichtsausdrücken
- 🎥 Kamera-Presets (standard/nah/weit/Schulter), 👁 Ich-Sicht (auch: ganz reinzoomen), 🎞 Kamerafahrt, 🎯 Lock-On auf NPCs (T, nochmal = nächstes Ziel)
- 🏷 Namensschilder + Sprechblasen (`engine/ui/figur-schild`); in der Nähe eines NPCs E / 💬 = ansprechen
- ℹ️ Debug-Anzeige: Tempo, Zustand, Schritte

## Steuerung
WASD/Pfeile laufen · Shift Sprint · Leertaste springen · Q Rolle/Dash · V gleiten · C ducken/tauchen · T Ziel · E ansprechen ·
Ziehen = Kamera · Rad = Zoom · F Schlag · G winken.
Handy: Stick links (erscheint unter dem Finger, Größe passt sich dem Bildschirm an), rechts ziehen = Kamera, zwei Finger = Zoom,
Knöpfe unten rechts (⤒ ⚔ 🌀 🪂 🎯, 💬 nur bei NPCs), leichte Vibration. Gamepad geht auch.
