# Erlenwacht – Modul-Verträge

> Die vereinte Testwelt `games/erlenwacht`. Die Engine steckt in `engine/spiel/spiel.js` (Host), jedes Feature ist ein Modul
> `engine/spiel/modul-<name>.js`, angesteckt in `games/erlenwacht/js/module-liste.js`. Kern: `engine/core/modul-kern.js`.
> Neue Schicht **spiel** (Rang 6, über ui): darf alles darunter importieren.

## Modul-Form
```js
export const X_MODUL = {
  name: 'x', braucht: ['render', 'welt'], optional: ['himmel'], standard: { … },   // Optionen-Defaults
  async start(ctx) { … return api; },   // ctx: { braucht(n), optional(n), optionen, seed, zufall(), ereignisse, dienst(n, wert?), kern }
  fest(dt, ctx) {},    // fester Schritt 1/60 s – Simulation (Motor, Horden, Zauber-Logik)
  update(dt, ctx) {},  // jedes Bild – Darstellung, Animation
  spaet(dt, ctx) {},   // nach update – Kamera, Schilder, HUD
  zustand() {}, lade(z) {}, dispose() {},
};
```
Regeln: kein `Math.random()` (nur `ctx.zufall()` / `core/rng`), alles in `dispose()` wieder aus der Szene, UI nur unter `render.ui`
(Wurzel hat `pointer-events:none` → eigene Knöpfe `pointer-events:auto`). Ein Modul läuft auch, wenn optionale Nachbarn fehlen (`?aus=`).

## Weltkarte (Meter, Mensch = 1.8 m, x = Osten, z = Süden, y = oben)
Welt ≈ **4 × 4 km**, Mitte (0,0). Von Süd nach Nord:
| Region `id` | Lage | Inhalt |
|---|---|---|
| `kueste` | z ≈ +1500 … +2000 | Startstrand, Meer im Süden (`wasserHoehe` = 0) |
| `daemmerwald` | z ≈ +900 … +1500, |x| < 500 | Urwald, Weg zwischen Riesenbäumen (Riesen: Modul `riesenwald`) |
| `erlenwacht` | um (0, +600), r ≈ 250 | Talkessel mit Siedlung (Bewohner) |
| `moor` | West, x < −800 | flach, Tümpel, Gegnerlager |
| `hochland` | z ≈ −200 … +400 | Wiesen, Felsen, Gegnerlager |
| `gebirge` | z < −400 | Berge bis ~350 m, Aussicht |

`orte` (mindestens): `start` (Strand), `tor` (Waldeingang), `lichtung` (im Dämmerwald), `siedlung`, `lager-moor`, `lager-hochland`, `ruine`, `gipfel`.
Ein Ort: `{ id, name, art: 'start'|'tor'|'lichtung'|'siedlung'|'gegnerlager'|'ruine'|'aussicht', x, z, radius?, blick? (Yaw) }`.
`wege`: Hauptweg Start → Tor → Lichtung → Siedlung → Hochland, als Polylinien `[{x,z}, …]`.

## APIs
**render** (eingebaut im Host): `{ renderer, szene, kamera, canvas, ui, stufe:{name,pixel,schatten,sicht,dichte}, handy, test, debug, url, THREE, vorBild:Set, nachBild:Set, zeichner }`; Ereignis `qualitaet` bei Stufenwechsel, `pause`.

**welt** (Agent Welt): `{ bodenHoehe(x,z,y?), wasserHoehe(x,z)->number|null, hindernisse(x,z,r,filter?), kollision /* core/world kollision: fuege/bewege/entferne/strahl – Figuren laufen gegen DIESES Objekt */,
  startPunkt:{x,z}, groesse:{x,z}, regionen:[{id,name,mitte:{x,z},radius}], region(x,z)->{id,name,biom}, orte, ort(id), wege, abstandZumWeg(x,z)->m,
  flaecheFrei(x,z,r)->bool /* trocken, nicht zu steil, kein Hindernis */, normale(x,z), onChunk(fn({cx,cz,geladen}))->abmelden, sperreObjekte(x,z,r) /* keine Streu-Bäume dort (Riesen, Siedlung) */ }`.
Fokus fürs Streaming: Dienst `fokus` (Funktion → `{x,z}`), setzt das Modul `spieler`.

**himmel** (Agent Riesenwald+Himmel): `{ uhr /* core/zeit */, stand() /* world/himmel-stand */, wetter, sonne /* DirectionalLight, folgt dem Fokus */, sonnenRichtung:Vector3, setzeStunde(h) }`. URL `?zeit=18`, `?tempo=`, `?test=1` hält die Uhr an.

**entitaeten** (Agent Leben): `{ neu({art,team,pos,radius,leben,name,daten})->id, hole(id), entferne(id), bewege(id,x,y,z), imUmkreis(x,z,r,{team,ausser,art})->[ent],
  schade(id,{menge,element,quelle,stoss:{x,z,kraft}})->echt, heile(id,menge), befehle /* gameplay/befehle */, alle() }`.
Entität: `{ id, art:'spieler'|'gegner'|'npc'|'ding', team:'spieler'|'feind'|'freund', pos:{x,y,z}, radius, leben, lebenMax, lebt, name, daten }`.
Ereignisse: `ent:neu {id}`, `ent:treffer {id,menge,element,quelle,pos}`, `ent:tod {id,quelle}`, `ent:weg {id}`.

**spieler** (Agent Figur): `{ figur /* gameplay/character */, position, kamera /* camera/follow-camera */, eingabe, id /* Entität, falls entitaeten da */, teleport(x,z,yaw?), blickYaw, ziel /* Lock-On-Entität oder null */, ausdauer }`.
Meldet Dienst `fokus`. Ereignisse: `spieler:aktion {name}`.

**zauber** (Agent Zauber): `{ buch, wirke(name), elemente /* gameplay/element-reaktionen */ }`. Trifft Entitäten über `entitaeten.schade` (Team `feind`).

**gegner** (Agent Leben): Lager an `orte` der Art `gegnerlager` (+ ein kleines am Waldrand), Horden aus `gameplay/horde` + `render/horde-mesh`, je Tier eine Entität (Team `feind`), Respawn.

**bewohner** (Agent Figur): NPCs an `ort('siedlung')` mit Tagesablauf (`gameplay/character-brain`), Team `freund`.

**riesenwald** (Agent Riesenwald+Himmel): Riesenbäume (`models/natur/riesenbaum`) + dichte Kronen (`render/laub-karten`) entlang des Weges in Region `daemmerwald`, Stämme als Hindernisse in `welt.kollision`.

## Tests & Sicht
Höchstens **2 neue Testdateien je Agent** (zusammen ~10), nur reine Logik. Eigene Tests gezielt laufen lassen (`node --test engine/x/y.test.mjs`), `npm run test:schnell` erst am Ende einmal.
Sehen: `node tools/bild.mjs erlenwacht --query "?test=1&ort=tor&debug"` (+ `--hoch` fürs Handy) → Bild ansehen.
