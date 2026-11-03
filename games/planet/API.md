# Planet – Tierfänger: Architektur & Schnittstellen

Survival-Erkundung à la Valheim auf einem **echten, kugelförmigen, prozedural erzeugten Planeten**.
Man fängt Lebewesen (die 148 Voxel-Tiere aus `games/voxel-tiere/`), nutzt ihre Fähigkeiten als
Begleiter und kommt so in immer gefährlichere Biome weiter.

Tech: Three.js 0.160 (importmap, `three` + `three/addons/`), ES-Module, keine Build-Tools,
muss auf dem Handy laufen (Touch!) und am Desktop (Tastatur/Maus). Alle Texte auf Deutsch.

## Dateien & Besitzer

| Datei | Besitzer | Inhalt |
|---|---|---|
| `index.html`, `style.css`, `js/main.js`, `js/data.js`, `js/noise.js`, `js/tiere-loader.js`, `js/stubs/*` | Integration | Gerüst, gemeinsames Vokabular |
| `js/planet.js` (+ `js/planet-*.js`) | Agent Planet | Terrain, Biome, LOD-Kugel, Wasser, Himmel, Tag/Nacht, Licht |
| `js/flora.js` (+ `js/flora-*.js`) | Agent Flora | Bäume, Felsen, Gras, Erze, Pflanzen, Sammeln/Abbauen |
| `js/kreaturen.js`, `js/kreaturen-daten.js` (+ `js/kreaturen-*.js`) | Agent Kreaturen | Tiere spawnen, KI, Kampf, Fangen, Begleiter, Reittier |
| `js/spieler.js` (+ `js/spieler-*.js`) | Agent Spieler | Steuerung, Physik auf der Kugel, Kamera, Orbit-Karte, Touch-UI |
| `js/spiel.js`, `js/spiel-daten.js`, `js/ui.js` (+ `js/spiel-*.js`) | Agent Spiel | Inventar, Craften, Leben/Ausdauer, Gefahren, Fortschritt, HUD, Menüs, Speichern |

**Fasse keine Dateien anderer Besitzer an.** Fehlt dir etwas bei einem anderen Modul, nutze
optionales Chaining (`ctx.spiel?.toast?.(…)`) und notiere den Wunsch in deinem Abschlussbericht.
`style.css`: eigene Abschnitte am Dateiende anhängen, mit Präfix (`.sp-`, `.ui-`, `.kr-`, `.fl-`, `.pl-`).
Ist das Modul eines anderen gerade kaputt (andere arbeiten parallel!), lädt main.js automatisch
den Platzhalter aus `js/stubs/` – das ist nicht dein Problem.

## Laufzeit-Vertrag

Jedes Modul: `export async function init(ctx) { …; return obj; }` → landet als `ctx.<name>`.
Init-Reihenfolge: planet → flora → kreaturen → spieler → spiel. (In `init` dürfen nur Module
benutzt werden, die vorher kommen; alles andere erst in `update` oder im Event `'bereit'`.)
Update-Reihenfolge pro Frame: spieler → planet → flora → kreaturen → spiel. `obj.update(dt)`.
Optional: `obj.save()` → JSON-fähig, `obj.load(daten)` (spiel ruft das für alle auf).

`ctx` enthält: `THREE, scene, camera, renderer, DATA (data.js), seed (Zahl), seedText, rng(),
R, on(name, fn), emit(name, daten), ziele[], zeit {t, dt}, debug` (URL `?debug`).

### Koordinaten
Planetenmitte = Ursprung. Meeresspiegel = Radius `R` (400 m). „Oben“ an Position p = `p.normalized()`.
Höhe `h` = Abstand zum Meeresspiegel (−60 … +95 m). Spieler ≈ 1,8 m groß.
Tiermodelle aus `tiere-loader.js` sind auf ≈ 1 m normiert und schauen nach +Z – passend skalieren.

### ctx.planet
- `R`, `spawnDir` (Vector3, Einheitsvektor, Startpunkt an Land in den Wiesen)
- `heightAt(dir)` → Höhe in m (dir = Einheitsvektor). Muss exakt zum Mesh passen (Kollision!)
- `surfacePoint(dir, out?)` → Vector3 auf dem Boden (bzw. Meeresgrund)
- `normalAt(dir, out?)` → Boden-Normale (für Hangneigung / Ausrichtung)
- `biomeAt(dir)` → Biom-ID aus `DATA.BIOME` (`ozean` wenn h < 0)
- `ringAt(dir)` → Winkelabstand vom Spawn in Grad (0…180) – Maß für Fortschritt/Schwierigkeit
- `feuchteAt(dir)` → 0…1 (für Flora-Dichte)
- `sunDir` (Vector3, zeigt zur Sonne, wird aktualisiert), `tageszeit` (0…1, 0.25 = Mittag am Spawn… frei), `istNacht(dir?)` → bool (am Ort dir)
- `update(dt)` – LOD anhand `ctx.camera.position`

### ctx.flora
- Registriert Interaktionsziele in `ctx.ziele`, hört auf `'angriff'` (Baum fällen / Stein hauen).
- Gibt Beute per `ctx.emit('item:erhalten', { id, n })`.
- Nutzt `ctx.spiel?.faehigkeit('sammeln' | 'abbau')`.
- `save()/load()` (abgebaute Knoten, Nachwachsen).

### ctx.kreaturen
- Wilde Tiere um den Spieler spawnen (pro Biom), KI: grasen, fliehen, angreifen.
- Hört auf `'angriff'` und `'werfen'` (Fangkugel). Fangchance hängt von Kugelstufe, Tierstufe, Rest-HP ab.
- Gibt `ctx.emit('gefangen', { id, uid })`, `ctx.emit('spieler:schaden', { n, quelle })`,
  `ctx.emit('item:erhalten', …)` (Beute beim Besiegen).
- `faehigkeit(name)` → höchste Stufe unter den aktiven Begleitern (0 = keine)
- `gefangen` – Array aller gefangenen Tiere `{ uid, id, name, stufe, faehigkeiten: {name: stufe}, aktiv }`
- `setAktiv(uid, bool)` – max. `maxAktiv` (3) Begleiter folgen dem Spieler
- `lexikon()` → `[{ id, name, biome[], stufe, faehigkeiten, gesehen, gefangen }]` (für Sammelbuch)
- `reittier()` → aktiver Begleiter mit `reiten` oder null (wird unter dem Spieler gezeigt, wenn `ctx.spieler.reitet`)

### ctx.spieler
- `pos` (Vector3), `up`, `forward` (Blickrichtung in der Tangentialebene), `vel`, `inWasser`, `amBoden`, `reitet`
- Steuerung: Desktop WASD/Pfeile, Maus ziehen = Kamera, Leertaste Sprung, Shift Sprint,
  Linksklick/F = Angriff, E = Interagieren, Q/Rechtsklick = Fangkugel werfen, M = Karte, R = Reiten an/aus.
  Handy: virtueller Joystick links unten, Kamera ziehen rechts, Knöpfe rechts unten (in `#steuerung`).
- Emittiert `'angriff' { pos, dir, reichweite, schaden }`, `'werfen' { pos, dir, kugel }`
  (`kugel` = `ctx.spiel?.aktiveKugel()`; Inventar-Abzug macht kreaturen beim Wurf via `ctx.spiel.inventar.remove`).
- Interaktion: sammelt aus `ctx.ziele` (jede fn(pos) → Liste `{ dist, label, act }`), zeigt das nächste
  Ziel als Hinweis-Knopf, ruft `act()`.
- Fähigkeiten über `ctx.spiel?.faehigkeit(name)`: reiten (Tempo), schwimmen, klettern (Hänge), fliegen (Doppelsprung/Gleiten).
- `teleport(dir)`, Orbit-Karte (ganzer Planet sichtbar, Spieler-Marker).
- Emittiert `'spieler:biom' { biom }` beim Biomwechsel.

### ctx.spiel
- `inventar`: `add(id, n)`, `remove(id, n) → bool`, `has(id, n)`, `count(id)`, `alle()`
- `faehigkeit(name)` → max(kreaturen.faehigkeit, Ausrüstung). **Alle fragen hier.**
- `aktiveKugel()` → Item-ID der gewählten Fangkugel, die man besitzt, oder null
- `toast(text, ms?)`, `leben`, `ausdauer` (0…100), `verbraucheAusdauer(n) → bool`
- Gefahren: Biom-`gefahr` ohne passenden Schutz (`DATA.FAEHIGKEITEN[x].schutz`, Stufe `DATA.GEFAHR_STUFE`) → Schaden über Zeit + Warnung.
- Hört auf `'spieler:schaden'`, `'item:erhalten'`, `'gefangen'`. Tod → Respawn am Lagerfeuer/Spawn.
- HUD (`#hud`), Menüs (`#menues`): Inventar, Craften (Fangkugeln, Ausrüstung, Lagerfeuer), Stall (Begleiter wählen), Sammelbuch, Ziele/Quests, Hauptmenü (neue Welt mit Seed / Weiter).
- Speichern: localStorage `planet-save-v1` = `{ seed, spieler, flora, kreaturen, spiel }`, Autosave.

### Events (Übersicht)
| Event | Daten | Sender → Empfänger |
|---|---|---|
| `bereit` | – | main → alle (alle Module initialisiert) |
| `angriff` | `{pos, dir, reichweite, schaden}` | spieler → kreaturen, flora |
| `werfen` | `{pos, dir, kugel}` | spieler → kreaturen |
| `item:erhalten` | `{id, n}` | flora/kreaturen → spiel |
| `gefangen` | `{id, uid}` | kreaturen → spiel |
| `spieler:schaden` | `{n, quelle}` | kreaturen/spiel → spiel |
| `spieler:tod` | – | spiel → spieler (teleport) |
| `spieler:biom` | `{biom}` | spieler → spiel |
| `resize` | – | main → alle |

## Spieldesign (Kurzfassung)

**Welt.** Fortschritt in Ringen um den Spawn (Valheim-Prinzip, aber auf der Kugel):
Wiesen (0–25°) → Dunkelwald (25–55°) → Sumpf (Tiefland 40–80°) → Ebenen (60–110°) → Glutwüste (100–150°) →
Aschelande (um den Gegenpol, >150°). Berge: hohe Lagen überall ab ~25°. Eiswüste: Polkappen (|Breite| > ~62°).
Ozeane trennen Kontinente (ca. 45–55 % Wasser), Strände an Küsten. Spawn auf dem Äquator.

**Fortschritt.** Jedes Biom hat eine Stufe und oft eine Gefahr. Tiere eines Bioms der Stufe n
werden mit Fangkugeln ≥ Stufe n gefangen; Kugeln werden aus Biom-Rohstoffen gecraftet
(Holz → Stein → Kupfer → Eisen → Silber → Gold → Obsidian). Die Gefahr eines Bioms wird durch
die Fähigkeit eines Tieres aus einem **früheren** Biom gelöst – man muss also die richtigen
Tiere fangen und mitnehmen. Vorschlag: Glühwürmchen/Eule (Licht) für den Dunkelwald,
Kröte/Salamander (Giftschutz) für den Sumpf, Schaf/Yak/Alpaka (Wärme) für Berge/Eis,
Otter/Robbe (Schwimmen), Delfin/Wal (Tiefsee), Kamel/Erdmännchen (Kühlung), Pferd/Pony (Reiten),
Ziege (Klettern), Adler (Gleiten), Maulwurf/Dachs (Abbau), Hund (Spürnase/Kampf), Biber (Sammeln Holz).

**Fangen.** Tier schwächen (Angriff oder Begleiter mit `kampf`), dann Kugel werfen.
Chance ≈ Basis × (1 − HP-Anteil·0,7) + Kugelbonus; Fehlwurf = Kugel weg, Tier wird scheu/wütend.
Seltene Tiere (Spürnase) und „Alpha“-Varianten (größer, gefärbt) pro Biom.
