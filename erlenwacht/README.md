# 🏰 Erlenwacht – das echte Spiel

Das MMO in einer großen Welt: Küste (Start) → Dämmerwald mit echten Riesenbäumen → Siedlung Erlenwacht → Hochland, Moor, Gebirge.
Die Engine steckt komplett in `engine/spiel/spiel.js`; jedes Feature ist ein **Modul** (`engine/spiel/modul-*.js`), im Spiel ist nur, was in `engine/spiel/module-register.js` auf Stufe **spiel** steht.
Unfertiges wird im [Testfeld](../testfeld/) ausprobiert, nicht hier.
Verträge: `docs/plaene/ERLENWACHT-MODULE.md`.

## Spielen
Titel → Held erstellen (Name, Klasse, Aussehen) → Tutorial mit Mentorin Alwe am Strand → Waldtor → Dämmerwald → Hauptmann Brandt in Erlenwacht → Hochland → Moor → Boss Grauzahn am Wolfsfels.
Stufen 1–15, Talente, Beute mit Seltenheiten, 3 Klassen, Chat (/hilfe), Minikarte, Autospeichern. Steuerung: ⚔ / F Angriff · 1–5 Fähigkeiten · 💬 / E sprechen · 🎯 Ziel · ☰ Menü.

## Module
Welt (gestreamtes Gelände, Regionen, Wege) · Himmel (Tag/Nacht, Wetter) · Riesenwald · Entitäten (IDs, Leben, Befehle) · Spielfigur (Ausdauer, Klettern) · Bewohner · Gegner-Lager · Zauber (Element-Reaktionen) · Fortschritt (Stufen, Beute, Talente) · Kampf (Nahkampf, Klassen) · Tutorial · Oberfläche (Menü, Chat, HUD).
Im Menü ☰ an/abschalten oder per URL `?aus=zauber,gegner`.

## URL
`?ort=start|tor|lichtung|siedlung|lager-moor|lager-hochland|ruine|gipfel|wolfsfels|furt|aussicht-moor` · `?stufe=8` (Fähigkeiten freischalten) · `?test=1` (Uhr steht) · `?q=niedrig|mittel|hoch` · `?zeit=18` · `?seed=7` · `?debug` (Calls, Dreiecke, Position)

## Neues Modul
Nicht hier anfangen: Ablauf Labor → Testfeld → Spiel steht in [`docs/MODULE.md`](../docs/MODULE.md).
