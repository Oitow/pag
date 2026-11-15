# ⚔ Kampf- und Zaubersystem (MMO-tauglich)

> Ziel: ein Kampfsystem, das **alte MMO-Elemente** (Ziel aufschalten, globale Abklingzeit, Wirkzeit, Aggro, Buffs/Debuffs,
> Rollen Tank/Heiler/Schaden) mit **neuen Action-Elementen** (Kombos, Ausweichen mit Unverwundbarkeit, Parade, Haltung/Taumeln,
> Aufladen/Überladen, Bewegung beim Zaubern, Ladungen) verbindet.
> Getestet wird alles im [Figuren-Labor](../games/figuren-labor/) (Reiter ⚔ Kampf, Trainingspuppe, Duell-Gegner).

## Regeln (wegen späterem Mehrspieler)
- Alles reine Logik ohne THREE/DOM → läuft auch auf einem Server in Node.
- Zufall (Krit, Ausweichen) nur über Seed (`core/rng`), fester Zeitschritt von außen.
- Eingabe = Absicht/Befehl: `kampf.schade(paket)`, `leiste.nutze(name, ziel)` – ein Server kann dieselben Befehle prüfen.
- Zustand als reine Daten: jedes Modul hat `zustand()` / `laden(z)`.
- Ergebnisse als Ereignisse (Arrays bzw. `core/ereignisse`), die Anzeige hört nur zu.

## Schichten
```
zauber (vorhanden) ─┐
nahkampf ───────────┼─ treffer → kampf.schade(paket) → kaempfer (Werte, Leben, Haltung) + zustaende (Buffs) + bedrohung (Aggro)
faehigkeiten ───────┘   (Leiste: GCD, Ressource, Wirkzeit, Ladungen, Reichweite – ruft Nahkampf/Zauber/Effekte auf)
```

## Module (alle `engine/gameplay/`)

### kampf-werte – Kämpfer und Schadensformel
- `ARTEN = ['koerper','feuer','eis','blitz','arkan','natur','heilig','schatten']`
- `berechneSchaden(angreifer, verteidiger, paket, r)` → `{ schaden, krit, roh }` (rein; angreifer/verteidiger = Werte-Objekte)
  - roh = `paket.menge × (1 + (koerper ? angreifer.angriff : angreifer.magie)/100) × angreifer.schadenFaktor`
  - Krit: `r() < angreifer.krit` (oder `paket.krit === true`) → × `angreifer.kritFaktor`
  - Minderung: körperlich `ruestung/(ruestung+100)`, sonst `resist[art]` (0…0.9); `paket.durchdringung` (0…1) zieht davon ab
- `createKaempfer({ id, team, leben=100, werte={}, haltung=100, seed=1 })` →
  `{ id, team, leben, lebenMax, tot, schild, haltung, haltungMax, taumelt, werte (effektiv), abwehr {block,parade,unverwundbar,yaw},
     nimmSchaden(paket, angreiferWerte?) → ergebnis, heile(menge) → geheilt, gibSchild(menge, dauer), belebe(anteil=1),
     setzeMod(id, { angriff:+, ruestung:+, schadenFaktor:×, tempo:×, … }), entferneMod(id), update(dt) → ereignisse[],
     zustand(), laden(z), dispose() }`
  - Werte-Standard: `angriff 0, magie 0, ruestung 0, resist {}, krit 0.05, kritFaktor 1.5, ausweichen 0, blockAnteil 0.7, schadenFaktor 1, heilFaktor 1, tempo 1`
  - Reihenfolge in `nimmSchaden`: tot → 0 · `abwehr.unverwundbar` → `ausgewichen` · `r() < ausweichen` → `ausgewichen` ·
    `abwehr.parade` und Angriff von vorn (|Winkel| < 75°, aus `paket.richtung {x,z}` = Flugrichtung des Treffers) → `pariert` (0 Schaden) ·
    `abwehr.block` von vorn → Schaden × (1 − blockAnteil), `geblockt` · Schild frisst zuerst (`abgefangen`) · Leben ab.
    Haltung: − `paket.wucht` (geblockt: × 0.5); fällt sie auf 0 → `taumelt` = 1.5 s, danach Haltung voll. Regeneriert 25/s nach 2 s ohne Treffer.
  - `ergebnis = { schaden, abgefangen, krit, ausgewichen, pariert, geblockt, taumelt (neu ausgelöst), tot (neu gestorben), leben }`
  - `update(dt)` meldet `{ typ:'schildEnde' }`, `{ typ:'taumelEnde' }`.

### zustaende – Buffs und Debuffs
- `ZUSTAENDE` (Daten): `brennen` (DoT feuer, 1 s Takt), `gift` (DoT natur, stapelbar bis 5), `blutung` (DoT koerper, stapelbar 3),
  `regeneration` (HoT), `verlangsamt` (tempo×0.6), `betaeubt` (kannHandeln false), `eingefroren` (kannHandeln/kannLaufen false, bricht bei Schaden),
  `schweigen` (kannZaubern false), `wut` (schaden×1.25), `schutz` (ruestung+50), `eile` (tempo×1.3), `unverwundbar`.
  Felder: `{ name, symbol, nuetzlich, dauer, takt?, art?, menge?, maxStapel=1, mods? {tempo,schadenFaktor,ruestung}, sperrt? {handeln,laufen,zaubern}, brichtBeiSchaden? }`
- `createZustaende({ defs = ZUSTAENDE })` → `{ gib(name, { quelle, dauer, staerke=1 }) → eintrag, nimm(name), hat(name), stapel(name),
   update(dt) → ereignisse [{ typ:'takt', name, art, menge, quelle, heilt }, { typ:'ende', name }], beiSchaden() (bricht eingefroren),
   faktoren() → { tempo, schadenFaktor, ruestung, kannHandeln, kannLaufen, kannZaubern, unverwundbar }, liste() → [{ name, symbol, rest, dauer, stapel, nuetzlich }],
   reinige('schaedlich'|'nuetzlich'), zustand(), laden(z), dispose() }`
  - Neu geben = Dauer auffrischen, Stapel +1 (bis maxStapel); Takt-Menge = `menge × staerke × stapel`.

### bedrohung – Aggro-Tabelle (klassisch)
- `createBedrohung({ verfall = 0, wechsel = 1.1 })` → `{ add(gegner, quelle, menge), heilung(quelle, menge, gegnerListe) (½ auf alle),
   spott(gegner, quelle, dauer=3) (sofort oben + festgenagelt), ziel(gegner) → quelleId|null (wechselt erst bei > wechsel × aktuelles),
   liste(gegner) → [{ id, wert }] absteigend, entferne(id) (als Gegner und Quelle), leere(gegner), update(dt), zustand(), laden(), dispose() }`

### kampf – Kampf-Welt (Befehls-Schicht)
- `createKampf({ seed = 1, ereignisse = null })` (ereignisse = `core/ereignisse`-Instanz, optional)
  `{ melde(id, opts) → kaempfer (opts wie createKaempfer + team), entferne(id), kaempfer(id), zustaende(id), alle(),
     feindlich(a, b), schade({ quelle, ziel, menge, art='koerper', wucht=10, richtung, krit, durchdringung, zustand:{name,dauer,staerke}, bedrohung=1 }) → ergebnis,
     heile({ quelle, ziel, menge }) → geheilt, gibZustand(ziel, name, opts), update(dt) → ereignisse[],
     imKampf(id) (bis 5 s nach letztem Treffer), dps(id, fenster=5), bedrohung, zustand(), laden(z), dispose() }`
  - verrechnet Zustands-Faktoren in die Kämpfer-Mods, wendet DoT/HoT-Takte an, vergibt Bedrohung (Schaden × bedrohung, Heilung ½),
    meldet `kampf:treffer`, `kampf:heilung`, `kampf:tot`, `kampf:pariert`, `kampf:taumelt`, `kampf:zustand`, `kampf:zustandEnde`.

### nahkampf – Kombos, Block, Parade, Ausweichen
- `WAFFEN` (Daten): `faust, schwert, axt, hammer, dolch, speer, stab`. Je Waffe: `{ leicht: [Schlag…] (Kombo-Kette 3–4), schwer: Schlag (aufladbar), tempo }`.
  Schlag: `{ clip, vorlauf, aktiv, nachlauf, schaden, reichweite, winkel (halb, rad), wucht, stoss, schritt (m Vorwärts), art='koerper' }`.
- `createNahkampf({ waffe = 'schwert', waffen = WAFFEN })` →
  `{ angriff('leicht'|'schwer') → {ok,grund}, lasseLos() (schwer: lädt bis 1 s, Kraft 1…1.8), block(an), ausweichen(richtung {x,z}) → {ok},
     taumle(dauer), update(dt, { x, y, z, yaw }, ziele) → ereignisse[], phase, kombo (Index), abwehr → { block, parade, unverwundbar },
     tempoFaktor, setWaffe(name), waffe, zustand(), laden(), dispose() }`
  - Phasen: `bereit → vorlauf → aktiv → nachlauf → bereit`; `laden` (schwer), `ausweichen` (0.4 s, die ersten 0.25 s unverwundbar), `taumeln`, `block`.
  - Eingabe-Puffer 0.3 s: leichter Angriff im Nachlauf → nächstes Kombo-Glied; nach dem letzten oder 0.6 s Pause → Kombo 0.
  - Ausweichen bricht Vorlauf/Nachlauf ab (Animation-Cancel), nicht `aktiv`. Parade = erste 0.2 s nach `block(true)`.
  - Treffer nur in `aktiv`, Kegel vor der Figur, jedes Ziel einmal je Schlag.
  - Ereignisse: `{ typ:'schwung', schlag, clip, kombo, kraft }`, `{ typ:'treffer', schlag, treffer:[{ ziel, menge, wucht, stoss {x,y,z}, art, richtung {x,z} }] }`,
    `{ typ:'ausweichen', richtung }`, `{ typ:'komboEnde' }`, `{ typ:'laden', anteil }`.

### faehigkeiten – MMO-Leiste
- `FAEHIGKEITEN` (Daten, Beispiele für Krieger/Magier/Heiler): je `{ name, symbol, text, ressource ('mana'|'wut'|'energie'), kosten, abkling, gcd=true,
   wirkzeit (0 = sofort), kanal (s, 0 = nein), beiBewegung ('abbrechen'|'erlaubt'), reichweite, zielNoetig, zielArt ('feind'|'freund'|'selbst'),
   ladungen (1), wirkung { typ:'schaden'|'heilung'|'zustand'|'nahkampf'|'zauber'|'spott', … } }`
- `createLeiste({ faehigkeiten = FAEHIGKEITEN, ressourcen = { mana:{max:100, regen:5}, wut:{max:100, regen:-2}, energie:{max:100, regen:10} }, gcd = 1.2 })` →
  `{ nutze(name, { ziel, abstand, bewegt }) → {ok, grund}, kann(name, kontext) → {ok, grund} (grund: 'gcd','abklingzeit','ressource','reichweite','ziel','wirkt','gesperrt'),
     update(dt, { bewegt, getroffen, sperren }) → ereignisse [{ typ:'wirkStart'|'wirkt'|'kanalTakt'|'unterbrochen'|'fertig', name, def, ziel }],
     gib(ressource, menge), ressource(name) → {wert,max}, wirkt → {name, anteil}|null, gcdAnteil, abkling(name), ladungen(name), unterbrich(), zustand(), laden(), dispose() }`
  - `fertig` (bzw. `kanalTakt`) liefert die `wirkung` an das Spiel; das Spiel ruft `kampf.schade/heile/gibZustand` bzw. Nahkampf/Zauber.
