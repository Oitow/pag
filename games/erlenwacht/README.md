# 🏰 Erlenwacht – die vereinte Welt

Eine große Testwelt fürs MMO, in der alles zusammenkommt: Küste (Start) → Dämmerwald mit echten Riesenbäumen → Siedlung Erlenwacht → Hochland, Moor, Gebirge.
Die Engine steckt komplett in `engine/spiel/spiel.js`; jedes Feature ist ein **Modul** (`engine/spiel/modul-*.js`), angesteckt in `js/module-liste.js`.
Verträge: `docs/ERLENWACHT-MODULE.md`.

## Module
Welt (gestreamtes Gelände, Regionen, Wege) · Himmel (Tag/Nacht, Wetter) · Riesenwald · Entitäten (IDs, Leben, Befehle) · Spielfigur (Ausdauer, Klettern) · Bewohner · Gegner-Lager · Zauber (Element-Reaktionen).
Im Menü ☰ an/abschalten oder per URL `?aus=zauber,gegner`.

## URL
`?ort=start|tor|lichtung|siedlung|lager-moor|lager-hochland|ruine|gipfel` · `?test=1` (Uhr steht) · `?q=niedrig|mittel|hoch` · `?zeit=18` · `?seed=7` · `?debug` (Calls, Dreiecke, Position)

## Neues Modul
`engine/spiel/modul-x.js` mit `{ name, braucht, start(ctx), fest, update, spaet, dispose }` bauen, in `js/module-liste.js` eintragen – fertig.
