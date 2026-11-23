# 🧪 Testfeld – alle Module zusammen

Hier werden die Module **zusammengeführt**, bevor sie ins echte Spiel ([Erlenwacht](../erlenwacht/)) dürfen.
Läuft sofort ohne Titel und ohne Spielstand. Welche Module dabei sind, steht in `engine/spiel/module-register.js`:
Stufe `testfeld` und `spiel` laufen hier, Stufe `labor` nur mit `?labor=1` oder `?nur=<modul>`.

Oben in der Mitte die 🧪-Leiste antippen: zeigt alle Module (✅ läuft), wählt ein einzelnes Modul, springt zu Orten.

## URL
- `?nur=kampf` – **ein Modul einzeln** testen (plus nur das, was es zwingend braucht: hier Spieler, Entitäten, Welt)
- `?labor=1` – auch Module, die noch im Labor sind
- `?klasse=krieger|waldlaeufer|magier` · `?ort=<id>` · `?aus=zauber,gegner` · `?test=1` (Uhr steht) · `?q=niedrig|mittel|hoch` · `?debug`

Ablauf Labor → Testfeld → Spiel: [`docs/MODULE.md`](../docs/MODULE.md).
