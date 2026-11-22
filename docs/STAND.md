# Stand

> Wird von `/ende` überschrieben und von `/start` gelesen. Höchstens 35 Zeilen. Dauerhafte Festlegungen: `docs/ENTSCHEIDUNGEN.md`.

## Zuletzt gemacht
- **Erlenwacht – die vereinte Welt** (Branch erlenwacht-modul-welt, `games/erlenwacht`): Engine als Module – `core/modul-kern` + Host `engine/spiel/spiel.js`,
  8 Module (welt, himmel, riesenwald, entitaeten, spieler, bewohner, gegner, zauber). Vertrag: `docs/ERLENWACHT-MODULE.md`. 5 Agents parallel.
- Welt 4×4 km gestreamt (`world/welt-regionen`, `chunk-strom`, `welt-streu`): Küste → Dämmerwald → Siedlung → Hochland/Nebelmoor/Grauzinnen (Gipfel 352 m)
- Dämmerwald-Riesen in der großen Welt (138–161 Riesen, Tor-Bogen, Kronen-Loch-Schatten statt Lichtkarte), Himmel-Modul (Tag/Nacht, Wetter)
- Neu: Ausdauer + Sprint + Klettern, Bewohner mit Tagesablauf, Entitäten-IDs + Befehls-Schicht (MMO), Rattenlager, Zauber mit 10 Element-Reaktionen

## Läuft / kaputt
- `npm test` grün (798 Tests, Smoke 8 Spiele); Bilder tor (10 Uhr), Hochlandlager (Kampf, Zauber), Start hochkant angesehen – keine Konsolen-Fehler
- Zahlen ?q=niedrig: Welt allein 17–33 Calls / ≤ 104 k △; Riesenwald +18 Calls / +250 k △; Siedlung mittel 129 Calls (Bewohner)
- NICHT geprüft: echtes Handy (Bildrate, Touch-Knöpfe), `npm run build`
- Offen: Fern-Bäume fehlen (Streu nur ≤ 150 m), kein Worker, Kartenrand hart; Wurzeln der Riesen nicht begehbar; 18 Uhr im Wald ohne warmes Gold/Lichtbahnen;
  Großzauber verformen `welt.bodenHoehe` nicht (nur Zauber-Adapter); Gegner-Laden nicht gebaut; kein Klang im Zauber-Modul; Streu-Bäume bei niedrig spielzeughaft

## Nächster Schritt
- Erlenwacht am Handy spielen, Bildrate + Touch melden
- Fern-Wald (Impostor-Kacheln), Lichtbahnen/Goldton am Abend, Wurzeln in `welt.bodenHoehe`
- Quest-Faden: Mentorin am Strand → durch den Wald → Siedlung → erstes Rattenlager (`gameplay/aufgaben`)
- Netzwerk-Prototyp auf `entitaeten.aenderungenSeit` + `befehle`

## Ideen-Parkplatz
- SDF-Kreaturen und -Zauber, Splat-LOD nach Entfernung, Koloss-Silhouette fern zwischen den Stämmen
- Sammelspiel mit den Voxel-Tieren; Sichtlinien-Prüfung in `gameplay/interaktion`
