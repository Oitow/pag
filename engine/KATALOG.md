# 🧰 Engine-Katalog

> Automatisch erzeugt von `node tools/katalog.mjs` – nicht von Hand bearbeiten.
> Erst diese Liste lesen, dann gezielt den Eintrag (`grep -n -A12 "### <modul>" engine/KATALOG.md`).

## Übersicht

| Modul | Pfad | Zweck | Status |
|---|---|---|---|
| klang | `engine/audio/klang.js` | Synthetische WebAudio-Geräusche (Zauber, Horden-Kampf) ohne Audiodateien; ohne AudioContext still | entwurf |
| follow-camera | `engine/camera/follow-camera.js` | Third-Person-Orbitkamera: weiches Folgen (vertikal träger), Kollision entlang des Sichtstrahls (Boden + Hindernisse, sanftes Zurückfahren), Auto-Ausrichtung, Sprint-FOV, Zoom, Schütteln, weiches Lock-On mit Zielwechsel, Erste-Person beim Reinzoomen, Presets (nah/weit/Schulter), Kamerafahrten | entwurf |
| ziel-wahl | `engine/camera/ziel-wahl.js` | Lock-On-Ziel auswählen: bestes Ziel vor der Figur (Winkel + Abstand) oder nächstes Ziel links/rechts vom aktuellen (Ziel wechseln) | entwurf |
| entitaeten | `engine/core/entitaeten.js` | Mehrspieler-Fundament: Entitäten (Spieler, Gegner, NPCs, Dinge) mit stabilen, deterministischen IDs ('g:12'), Team, Position, Leben und Daten – räumliche Abfrage, Ereignisse, kompakter Zustand und Änderungs-Zähler für spätere Netz-Deltas | entwurf |
| ereignisse | `engine/core/ereignisse.js` | Event-Bus mit Prioritäten, einmaligen Hörern, Platzhalter '*' und Warteschlange für deterministische Reihenfolge | entwurf |
| math | `engine/core/math.js` | Kleine Mathe-Helfer: clamp, lerp, smoothstep, framerate-unabhängiges Dämpfen, Winkel | stabil |
| modul-kern | `engine/core/modul-kern.js` | Modul-System für Spiele: Module (Welt, Figur, Zauber …) mit Abhängigkeiten anmelden, in richtiger Reihenfolge starten, je Bild/festem Schritt takten, Dienste teilen, Zustand speichern und rückwärts aufräumen – an/abschaltbar per Name | entwurf |
| noise | `engine/core/noise.js` | Seedbares Simplex-Rauschen 2D/3D plus fBm, Grat-Rauschen und Domain-Warp für Terrain, Biome und Texturen | stabil |
| raum-gitter | `engine/core/raum-gitter.js` | Räumliches Raster (Spatial Hash in x/z) für bewegliche Dinge: Einträge mit id setzen/verschieben/entfernen und schnell alle im Umkreis finden – Grundlage für Kollision, Interaktion, Sinne und Sichtbereiche (Mehrspieler) | entwurf |
| register | `engine/core/register.js` | Datenkatalog für Gegenstände, Rezepte usw. mit stabilen Nummern und eingefrorenen Einträgen | entwurf |
| rng | `engine/core/rng.js` | Deterministischer Zufall (mulberry32), Seeds aus Text, Gitter-Hash und Würfel-Helfer | stabil |
| schleife | `engine/core/schleife.js` | Spielschleife mit variablem oder festem Zeitschritt, dt-Begrenzung, FPS-Anzeige und Tab-Pause | entwurf |
| schnappschuss-puffer | `engine/core/schnappschuss-puffer.js` | Mehrspieler-Grundlage: speichert verspätete Zustände fremder Figuren mit Zeitstempel und liefert weich interpolierte Zustände (leicht in der Vergangenheit) | entwurf |
| sdf-netz | `engine/core/sdf-netz.js` | Macht aus einem Abstandsfeld (sdf.js) ein Dreiecksnetz (Surface Nets, glatte Normalen) und eine begehbare Höhenkarte | entwurf |
| sdf | `engine/core/sdf.js` | Abstandsfelder (SDF) aus Kapseln, Kugeln, Ellipsoiden und Ketten, weich vereinigt (smooth-min) – formt organische Körper wie Wurzeln und Stämme | entwurf |
| speicher | `engine/core/speicher.js` | Spielstände sicher speichern/laden (localStorage mit Arbeitsspeicher-Fallback), Versionen, Migration, Autospeichern, Export/Import als Text, TypedArrays | entwurf |
| zeit | `engine/core/zeit.js` | Spieluhr: Tageszeit, Tage, Jahreszeiten und Jahre mit Ereignissen, Pause, Tempo und Speicherstand | entwurf |
| aufgaben | `engine/gameplay/aufgaben.js` | Aufgaben-/Tutorial-Logik: Schritte (gehe-zu, sprich-mit, sammle, besiege, benutze, warte), Fortschritt, Signale, Speicherstand; reine Daten, serialisierbar | entwurf |
| ausdauer | `engine/gameplay/ausdauer.js` | Ausdauer für Sprint, Rolle/Dash, Schwimmen, Klettern, Springen: Kosten-Tabelle als Daten, Erholung nach Verzögerung, Erschöpft-Zustand (gesperrte Aktionen bis zur Schwelle) | entwurf |
| bedrohung | `engine/gameplay/bedrohung.js` | Klassische Aggro-Tabelle: Bedrohung je Gegner und Quelle, Zielwechsel erst bei 110 %, Spott, Heilungs-Bedrohung | entwurf |
| befehle | `engine/gameplay/befehle.js` | Befehls-Schicht „Wer will was“: Befehle ({von, art, daten}) in eine Warteschlange, je Art Prüfer (lebt, Reichweite, Abklingzeit) + Ausführer, fester Takt, Protokoll zum Nachspielen – gleiche Befehle → gleiches Ergebnis (Server-tauglich) | entwurf |
| behaelter | `engine/gameplay/behaelter.js` | Behälter in der Welt (Truhe, Fass, Schrank): eigenes Inventar, öffnen/schließen je Figur, Schloss mit Schlüssel, Ablegen/Entnehmen, Speichern | entwurf |
| beute | `engine/gameplay/beute.js` | Beute-Tabellen (ratte … boss, kiste), gewichtet per Seed: Material, Tränke, Gold und Ausrüstung mit Seltenheit, Stufe, Werten und Affixen; Namen wie "Scharfes Wolfszahn-Schwert"; Beschreibung für die Oberfläche | entwurf |
| boss | `engine/gameplay/boss.js` | Boss-Ablauf ohne THREE: Phasen (100–60 % normal, 60–30 % Heulen ruft Verstärkung, <30 % rasend), telegrafierte Angriffe (Sprung-Schlag mit Boden-Ring 1.2 s vorher, Prankenhieb-Kegel), Leine zum Ort, Rücksetzen + Heilen wenn das Ziel flieht; Schaden als Befehle (gameplay/befehle) | entwurf |
| character-brain | `engine/gameplay/character-brain.js` | NPC-Verhaltensplaner (Zustandsautomat) über Steering + Sinne: idle, wandern, patrouille, arbeiten, folgen, fliehen, angreifen, suchen, plaudern; Tagesablauf nach Stunde; liefert Absicht + Aktions-Clip | entwurf |
| character-gruppe | `engine/gameplay/character-gruppe.js` | Schwarm-/Herdenverhalten für NPCs (Boids in x/z): Separation, Kohäsion, Ausrichtung – liefert eine Zusatzkraft für die Absicht | entwurf |
| character-motor-tuning | `engine/gameplay/character-motor-tuning.js` | Standard-Tuning des Figuren-Motors (Tempo, Sprung, Rolle/Dash, Gleiten, Tauchen, Kantenschutz) – reine Daten | entwurf |
| character-motor | `engine/gameplay/character-motor.js` | Kinematischer Figuren-Controller ohne THREE: Beschleunigung, Coyote-Time, Jump-Buffer, variable Sprunghöhe, Doppelsprung, Rolle/Dash, Gleiten, Tauchen, Kantenschutz, Stufen, Hang-Rutschen, Hindernisse, Schwimmen, Stöße | entwurf |
| character-sinne | `engine/gameplay/character-sinne.js` | NPC-Wahrnehmung ohne THREE: Sichtkegel (Winkel, Reichweite, Rundum-Nahbereich), Hören (Radius × Lautstärke), Sichtlinie über welt.bodenHoehe, Gedächtnis mit Verdacht und Vergessen | entwurf |
| character-steering-extra | `engine/gameplay/character-steering-extra.js` | Reine Steering-Rechnungen: Patrouillen-Fortschritt (Schleife/Pingpong/einmal), Umkreisen, Abstand halten, Versteckpunkt hinter Deckung | entwurf |
| character-steering | `engine/gameplay/character-steering.js` | NPC-Bewegungs-Gehirn: liefert dieselbe Absicht wie die Eingabe – Ziel/Ankommen, Wandern, Folgen, Fliehen, Pfad, Patrouille, Umkreisen, Abstand halten, Verstecken, Schwarm, Ausweichen, Steckenbleiben auflösen | entwurf |
| character | `engine/gameplay/character.js` | Fertige Spielfigur in einem Objekt: Modell (Look) + Animator + Bewegungs-Motor, für Spieler und NPCs gleich | entwurf |
| element-reaktionen | `engine/gameplay/element-reaktionen.js` | Element-Reaktionen ohne THREE: Elemente (Feuer, Wasser, Frost, Blitz, Erde, Wind) hinterlassen Zustände auf Zielen UND auf Boden-Flecken (nass, brennend, gefroren, kalt, geladen, schlamm); trifft ein Element auf einen passenden Zustand, gibt es eine Reaktion aus einer Daten-Tabelle (Schock, Einfrieren, Feuersturm, Dampf, Schlamm, Schmelzen …) mit Faktor, neuen Zuständen und Folge-Effekten – deterministisch | entwurf |
| faehigkeiten-daten | `engine/gameplay/faehigkeiten-daten.js` | Beispiel-Fähigkeiten (Krieger, Magier, Heiler) für die MMO-Leiste; reine Daten | entwurf |
| faehigkeiten | `engine/gameplay/faehigkeiten.js` | Klassische MMO-Fähigkeitsleiste ohne THREE: globale Abklingzeit (GCD), Ressourcen (Mana, Wut, Energie), Wirkzeit mit Abbruch bei Bewegung und Pushback, Kanalisieren mit Takten, Ladungen, Reichweite/Ziel-Prüfung, Sperren | entwurf |
| gegenstaende-daten | `engine/gameplay/gegenstaende-daten.js` | Erlenwacht-Gegenstände als Daten: Waffen, Rüstung je Sockel, Tränke, Material, Gold (Symbol, Sockel, Gewicht, Stapel, Grundwerte), Seltenheiten, Affixe | entwurf |
| gegner-lager | `engine/gameplay/gegner-lager.js` | Ein Gegnerlager ohne THREE: Horde (gameplay/horde) an einem Ort, je Tier eine Entität (core/entitaeten, Team 'feind'), Wache → Jagd auf nahe Spieler → Verlieren → Heimkehr + Heilung, Bisse als Befehle (gameplay/befehle), Tod → Entität weg, Respawn nach Spielzeit, Nacht = mehr und aggressiver | entwurf |
| grosszauber-riss | `engine/gameplay/grosszauber-riss.js` | Großzauber Erdriss: ein gezackter Riss rast in Blickrichtung über den Boden, wirft Ziele hoch, speit Lava-Säulen, steht ~8 s als Graben und schließt sich abgekühlt wieder | entwurf |
| grosszauber-sturm | `engine/gameplay/grosszauber-sturm.js` | Großzauber 'sturm' (Zyklon): ein Wirbelsturm formt sich, zieht schlängelnd übers Feld, saugt Ziele an, hebt sie spiralförmig hoch, schleudert sie am Rand weg und schlägt Blitze ein | entwurf |
| grosszauber-wand | `engine/gameplay/grosszauber-wand.js` | Großzauber 'Erdwall': eine Felswand (bei voller Überladung ein Ring „Festung“) bricht in einer Steinwelle aus dem Boden, schleudert Ziele hoch, steht als echtes Hindernis und bröckelt dann weg | entwurf |
| grosszauber-welle | `engine/gameplay/grosszauber-welle.js` | Großzauber 'welle' (Flutwelle): eine haushohe Wasserfront baut sich hinter dem Zaubernden auf, rollt in Blickrichtung übers Gelände, reißt Ziele mit, bricht zusammen und läuft als flache Flut aus (Figuren schwimmen) | entwurf |
| grosszauber | `engine/gameplay/grosszauber.js` | Großzauber, die die Welt verändern (Flutwelle, Erdwall, Zyklon, Erdriss …): Register für Zauber-Arten, laufende Wirkungen, gemeinsames Ereignis-Vokabular und ein Welt-Adapter, über den Wände/Gräben/Wasser für Figuren, Horden und Körper sofort gelten | entwurf |
| hand | `engine/gameplay/hand.js` | „In der Hand“: ein Inventar-Platz ist ausgewählt (Schnellleiste); liefert den gehaltenen Gegenstand samt Register-Eintrag, meldet Wechsel (zum Ausrüsten der Figur) und nutzt Werkzeuge ab, bis sie zerbrechen | entwurf |
| horde | `engine/gameplay/horde.js` | Horden-Gegner ohne THREE (Ratten & Co. zu Dutzenden): verfolgen ein Ziel, drängeln sich ohne Überlappen, umzingeln, springen an und beißen, werden weggeschleudert, betäubt, verlangsamt, in einen Sog gezogen und sterben im Flug – deterministisch per Seed | entwurf |
| interaktion | `engine/gameplay/interaktion.js` | „Ansehen → Aktion“: Dinge der Welt (NPC, Gegenstand, Baum, Tür) melden sich als Ziel an; für eine Figur wird das beste Ziel in Reichweite/Blickrichtung bestimmt (Hinweis „E – Aufheben“) und ausgelöst, auch als Gedrückt-halten mit Fortschritt | entwurf |
| inventar | `engine/gameplay/inventar.js` | Inventar mit festen Plätzen, Stapeln, Gewichtsgrenze, Speichern/Laden und Änderungs-Meldung | entwurf |
| kampf-werte | `engine/gameplay/kampf-werte.js` | Kämpfer (Leben, Schild, Haltung, Werte, Mods) und reine Schadensformel mit Rüstung, Krit, Parade, Block | entwurf |
| kampf | `engine/gameplay/kampf.js` | Kampf-Welt (Befehlsschicht): Kämpfer + Zustände + Bedrohung verbinden, schade/heile/gibZustand, DoT-Takte, DPS, Ereignisse | entwurf |
| klassen-daten | `engine/gameplay/klassen-daten.js` | Die drei Erlenwacht-Klassen (Krieger/Wut, Magier/Mana, Waldläufer/Energie) mit je Fähigkeiten und Freischalt-Stufen – reine Daten | entwurf |
| klettern | `engine/gameplay/klettern.js` | Klettern an sehr steilen Hängen (Gelände steiler als hangGrad) und hohen Hindernissen (Stämme, Felsen, Mauern): erkennt die Wand vor der Figur, steuert den Motor über absicht.klettern (hoch/runter/seitlich, Hochziehen oben, Absprung), kostet Ausdauer – leer = abrutschen | entwurf |
| koerper | `engine/gameplay/koerper.js` | Leichte Physik für lose Dinge (Gegenstände, Beute, Bälle, Kisten-Trümmer) ohne THREE: Kugeln mit Schwerkraft, Abprallen, Reibung, Haften am flachen Hang, Rutschen am steilen, Schwimmen/Sinken, Hindernisse, Einschlafen – fester Zeitschritt, deterministisch | entwurf |
| nahkampf-daten | `engine/gameplay/nahkampf-daten.js` | Waffen-Tabelle für den Action-Nahkampf (Kombo-Ketten, schwerer Schlag, Tempo) – reine Daten | entwurf |
| nahkampf | `engine/gameplay/nahkampf.js` | Deterministischer Action-Nahkampf als reine Logik: Kombo-Kette, schwerer Schlag, Block/Parade, Ausweichen, Taumeln, Kegel-Treffer | entwurf |
| progression | `engine/gameplay/progression.js` | Stufen 1–15 (XP-Kurve), Talentpunkte, Klassen-Attribute pro Stufe und Talentbaum (3 Zweige × 4 Talente je Klasse) als reine Logik; werte() summiert Grund + Stufe + Talente + Ausrüstung | entwurf |
| rezepte | `engine/gameplay/rezepte.js` | Herstellen: Rezepte als Daten (Zutaten → Ergebnis, optional Werkzeug und Station), prüfen was mit einem Inventar möglich ist und sicher herstellen (alles oder nichts) | entwurf |
| rohstoffe | `engine/gameplay/rohstoffe.js` | Abbaubare Quellen (Baum, Fels, Busch) ohne THREE: Beute per Seed, Werkzeug nötig oder nur schneller, Abnutzung, Nachwachsen nach Spielzeit, Speichern/Laden | entwurf |
| stationen | `engine/gameplay/stationen.js` | Stationen als Orte in der Welt (Werkbank, Feuerstelle, Amboss): wer steht an welcher Art Station, nächste Station, benutzen – das Ergebnis von beiWem() passt direkt in rezepte.pruefe(…, {stationen}) | entwurf |
| tueren | `engine/gameplay/tueren.js` | Türen und Tore als reine Logik: auf/zu mit weicher Animation, Kollisions-Körper nur solange zu, Schlüssel/Sperre, Selbstschließen, Interaktions-Ziel | entwurf |
| welt-dinge | `engine/gameplay/welt-dinge.js` | Gegenstände, die in der Welt liegen (ohne THREE): ablegen, werfen, aufheben ins Inventar, gleiche Stapel in der Nähe zusammenlegen, Lebensdauer, Speichern/Laden – verbindet Physik (koerper), Interaktion und Inventar | entwurf |
| zauber-daten | `engine/gameplay/zauber-daten.js` | Die Zauber-Tabelle als reine Daten: 12 wuchtige Zauber (Geschoss, Strahl, Kegel, Ort, Nova, Selbst, Teleport) mit Wirkzeit, Gewicht, Überladen, Durchschlag und Feldern (Brandboden, Sog) – gemacht für Horden | entwurf |
| zauber | `engine/gameplay/zauber.js` | Zauber-System ohne THREE: Zauberbuch mit Mana, Abklingzeiten und wuchtigem Aufladen (Wirkzeit, Halten = Überladen, Schlag), Geschosse (Bogen, Zielsuche, Durchschlag), Strahl, Kegel, Ort, Nova, Felder (Brandboden, Sog) und Treffer-Ereignisse | entwurf |
| zustaende | `engine/gameplay/zustaende.js` | Buffs und Debuffs: Stapel, Dauer, DoT/HoT-Takte, Faktoren (Tempo, Schaden, Rüstung), Sperren (Betäubung, Frost) | entwurf |
| move-input | `engine/input/move-input.js` | Bewegungs-Eingabe für Figuren: Tastatur (WASD/Pfeile), Maus-Ziehen/Mausrad, Touch-Stick + Knöpfe, Gamepad → Stick, Kamera-Delta, Aktionen (Flanke/gehalten) | entwurf |
| touch-stick | `engine/input/touch-stick.js` | Touch-Steuerung fürs Handy: dynamischer virtueller Joystick (linke Hälfte), Kamera-Wischen + Pinch-Zoom (rechte Hälfte), runde Aktionsknöpfe unten rechts | entwurf |
| bau-basis | `engine/models/bau/bau-basis.js` | Gemeinsame Farben und Helfer für Bau-Assets: lokale Kollisions-Körper, Asset-Ergebnis mit dispose | entwurf |
| bau-pruefung | `engine/models/bau/bau-pruefung.mjs` | Testhelfer: gemeinsame Prüfung für Kleinkram-Assets (Attribute, Budget, Maße, Kollision, Determinismus) – nur in Tests | entwurf |
| bau-teile | `engine/models/bau/bau-teile.js` | Bauteile für Gebäude-Assets: Satteldach/Pultdach mit Schindelreihen, Giebel, Fachwerk, Fenster mit Läden, Tür, Zinnen, Laterne, Flagge | entwurf |
| bau-dorf-teile | `engine/models/bau/dorf-teile.js` | Dörfliche Kleinbauten als Low-Poly-Asset: begehbare Bogenbrücke, Holzstapel, Handkarren, Gemüsebeet, Anschlagbrett, Runen-Schrein, Palisade, Heuhaufen, Bootssteg | entwurf |
| gebaeude-pruefen | `engine/models/bau/gebaeude-pruefen.mjs` | Testhelfer: gemeinsame Abnahme für Gebäude-Assets (Budget, Maße, Kollision, Anker, Seed-Determinismus) – nur in Tests | entwurf |
| haus | `engine/models/bau/haus.js` | Wohnhaus als Low-Poly-Asset: v0 Fachwerkhaus (Satteldach rot, Fensterläden), v1 Steinhaus (Schieferdach, Kamin, Vordach) | entwurf |
| bau-licht | `engine/models/bau/licht.js` | Lichtquellen als Low-Poly-Asset mit Leucht-Geometrie (unbeleuchtet zeichnen): Laterne auf Pfahl, Wandfackel, Lagerfeuer mit Steinring | entwurf |
| bau-markt | `engine/models/bau/markt.js` | Marktplatz-Kleinkram als Low-Poly-Asset: Marktstand mit Stoffdach (4 Farben), Brunnen mit Holzdach, Sitzbank | entwurf |
| mauer | `engine/models/bau/mauer.js` | Stadtmauer als Low-Poly-Assets: Segment (in x streckbar), achteckiger Mauerturm, Torhaus mit freiem Durchgang, Torflügel (zentriert, für gameplay/tueren) | entwurf |
| schmiede | `engine/models/bau/schmiede.js` | Schmiede als Low-Poly-Asset: Steinhaus mit Satteldach, offener Pultdach-Anbau mit Esse (leuchtende Glut), Wasserbottich und Amboss-Station | entwurf |
| taverne | `engine/models/bau/taverne.js` | Taverne als Low-Poly-Asset: 2 Geschosse mit Fachwerk, Erker, Vordach mit Bänken, Ausleger-Schild (Krug) | entwurf |
| tempel | `engine/models/bau/tempel.js` | Tempel/Zauberturm als Low-Poly-Asset: Säulenhalle mit Schieferdach + runder Turm mit blauem Kegeldach und schwebendem Kristall (leuchtet) | entwurf |
| bau-uebung | `engine/models/bau/uebung.js` | Übungs- und Lager-Kleinkram als Low-Poly-Asset: Trainingspuppe, Zielscheibe, Zelt, Amboss | entwurf |
| bau-vorrat | `engine/models/bau/vorrat.js` | Vorrats-Kleinkram als Low-Poly-Asset: Fass, Kiste (normal/flach), Banner mit Stange (4 Farben) | entwurf |
| wachturm | `engine/models/bau/wachturm.js` | Wachturm als Low-Poly-Asset: Steinschaft, auskragendes Holz-Obergeschoss mit Zinnen und Flagge | entwurf |
| bau-wegbau | `engine/models/bau/wegbau.js` | Wegrand-Kleinkram als Low-Poly-Asset: Wegweiser mit Pfeilbrettern, Zaunsegment (2 m, reihbar), Steinkreis | entwurf |
| character-anim-blick | `engine/models/character/character-anim-blick.js` | Blick einer Figur (rein): Richtung oder Weltpunkt → verteilt auf Torso/Hals/Kopf mit Grenzen, Augen eilen voraus; Blinzeln per Seed; Werte für einen Mimik-Hook | entwurf |
| character-anim-hang | `engine/models/character/character-anim-hang.js` | Hang-Anpassung (rein): Steigung im Figur-Raum aus Motor-Zustand/Normale/bodenHoehe messen und Fußziele, Hüfthöhe, Fußneigung und Rumpf-Vorlage daran anpassen | entwurf |
| character-anim-idle | `engine/models/character/character-anim-idle.js` | Idle-Variationen (rein): nach längerer Ruhe deterministisch (Seed) eine Idle-Variante (strecken, gähnen, umschauen, kratzen …) als eigene Schicht einblenden, bei Bewegung sofort weich abbrechen | entwurf |
| character-anim-zustand | `engine/models/character/character-anim-zustand.js` | Posen für Sonder-Zustände des Motors (rein): Rolle (rollAnteil), Luft-Dash, Salto beim Doppelsprung, Gleiten, Leiterklettern, Arme rudern an der Kante, Betäubt-Taumeln | entwurf |
| character-animator | `engine/models/character/character-animator.js` | Prozedurale Figuren-Animation aus dem Motor-Zustand: idle/gehen/laufen/sprinten ohne Fußrutschen, Luft, Landung, Schwimmen, Ducken, Rutschen, Kurvenlage, Atmen, Hang, Idle-Varianten, sekundäre Bewegung, Treffer/Umfallen, Aktions-Clips mit Masken, Blick + Mimik-Hook | entwurf |
| character-ausruestung | `engine/models/character/character-ausruestung.js` | Low-Poly-Gegenstände für Figuren-Sockel (Schwert, Dolch, Axt, Hammer, Hacke, Schaufel, Speer, Stab, Zauberstab, Schild, Bogen, Fackel, Laterne, Korb, Becher, Buch): je ein Mesh + optional Leucht-Mesh, passend ausgerichtet für model.befestigen(sockel, obj) | entwurf |
| character-clips-mehr | `engine/models/character/character-clips-mehr.js` | Weitere Aktions-Clips als reine Keyframe-Daten (Emotes, Kampf, Arbeit, Ruhe, Idle-Varianten, Klettern); wird von character-clips registriert | entwurf |
| character-clips-zauber | `engine/models/character/character-clips-zauber.js` | Wuchtige Zauber-Gesten als reine Keyframe-Daten (Wurf, Stoß, Fingerzeig, Himmelsruf, Bodenschlag, Griff, Selbstzauber) mit Spann-Moment zum Aufladen; wird von character-clips registriert | entwurf |
| character-clips | `engine/models/character/character-clips.js` | Aktions-Clips einer Figur als Keyframe-Daten (winken, schlagen, hacken, werfen, aufheben, tod, rolle, sitzen, tanzen … + character-clips-mehr + character-clips-zauber) und ihr Abtaster | entwurf |
| character-gang | `engine/models/character/character-gang.js` | Fortbewegungs-Posen einer Figur (rein): Fußziele aus Gangphase (gehen/laufen/sprinten ohne Fußrutschen), Bein-IK, Rumpf/Arme, Luft- und Schwimm-Pose | entwurf |
| character-lod | `engine/models/character/character-lod.js` | Fern-Darstellung für viele Figuren: alle in EINEM Draw-Call (InstancedMesh, ~250 Dreiecke), Look-Farben als Instanz-Attribute, Lauf-Pendeln im Vertex-Shader | entwurf |
| character-look | `engine/models/character/character-look.js` | Aussehen einer Figur als reine Daten: Körperbau, Haut, Haar, Bart, Kleidung, Kopfbedeckung, Accessoires (Brille, Schal, Schmuck), Grund-Mimik; Vorlagen, Zufalls-Looks per Seed, abgeleitete Körpermaße | entwurf |
| character-model | `engine/models/character/character-model.js` | Look → fertige Figur: Rig (Gelenk-Gruppen) + Low-Poly-Meshes je Knochen; Look live wechseln, Gegenstände an Sockeln befestigen | entwurf |
| character-parts-basis | `engine/models/character/character-parts-basis.js` | Gemeinsame Helfer der Figuren-Bau-Funktionen: Farben mischen/abdunkeln, Kugel- und Zylinder-Ausschnitte in einen mesh-builder | entwurf |
| character-parts-becken | `engine/models/character/character-parts-becken.js` | Bau-Funktion für das Figuren-Becken (Knochen becken): Hüfte, Gürtel, Gürteltasche, Kittelsaum, Rock, Mantelschöße, Schürze, Lederstreifen | entwurf |
| character-parts-gesicht | `engine/models/character/character-parts-gesicht.js` | Bewegliches Figuren-Gesicht im Knochen kopf: Iris/Pupillen (Blick), Lider (Blinzeln, Öffnung), Brauen + Mund je Gesichtsausdruck – nur 3 kleine Meshes | entwurf |
| character-parts-haar | `engine/models/character/character-parts-haar.js` | Bau-Funktionen für Frisuren und Bärte im Knochen kopf (Kopfkugel um y = R, Gesicht nach +Z); beachtet Kopfbedeckungen | entwurf |
| character-parts-hut | `engine/models/character/character-parts-hut.js` | Bau-Funktion für Kopfbedeckungen im Knochen kopf (eigenes Mesh): Kapuze, Hüte, Helme, Kronen, Tücher, Turban | entwurf |
| character-parts-kopf | `engine/models/character/character-parts-kopf.js` | Bau-Funktion für den Figuren-Kopf: Kopfform, Ohren, Nase, festes Gesicht (oder nur Augäpfel, wenn das bewegliche Gesicht aktiv ist), Frisur, Bart, Brille, Ohrringe; bündelt Kopfbedeckungen | entwurf |
| character-parts-ruecken | `engine/models/character/character-parts-ruecken.js` | Bau-Funktionen für Rücken-Teile einer Figur: Umhang (kurz, lang, Kragen-Cape) am Sockel umhang, Rucksack am Sockel ruecken | entwurf |
| character-parts-torso | `engine/models/character/character-parts-torso.js` | Bau-Funktion für den Figuren-Oberkörper (Knochen torso) je Oberteil-Stil: Kittel, Hemd, Robe, Rüstung, Weste, Kleid, Mantel, Schürze, Kettenhemd, Lederrüstung | entwurf |
| character-parts-zubehoer | `engine/models/character/character-parts-zubehoer.js` | Bau-Funktionen für Accessoires: Schal/Halstuch/Pelzkragen und Halsschmuck (Knochen torso), Brille/Augenklappe/Monokel und Ohrringe (Knochen kopf) | entwurf |
| character-parts | `engine/models/character/character-parts.js` | Bau-Funktionen für Figuren-Körperteile je Knochen aus Look + Körpermaßen: Kontext, Hals, Arme, Hände, Beine, Füße; bündelt Torso, Becken, Umhang, Rucksack, Zubehör | entwurf |
| character-pose | `engine/models/character/character-pose.js` | Posen einer Figur als reine Daten: leere Pose, kopieren, mischen, addieren, maskieren (Ober-/Unterkörper, Arme) und aufs Rig anwenden | entwurf |
| character-reaktion | `engine/models/character/character-reaktion.js` | Prozedurale Treffer-Reaktion (rein): Stoß aus Richtung + Stärke als abklingende additive Pose; Umfallen als Ragdoll-Ersatz ohne Physik-Engine (Kippen, Aufprall, schlaffe Glieder) | entwurf |
| character-rig | `engine/models/character/character-rig.js` | Prozedurales Skelett einer Menschen-Figur aus Gruppen (keine Skinning-Knochen): feste Gelenknamen, Ruhepose, Sockel für Hut/Waffe/Rucksack | entwurf |
| character-sekundaer | `engine/models/character/character-sekundaer.js` | Sekundäre Bewegung (rein): Feder-Dämpfer für Kopf-Nachschwingen, Gewichtsverlagerung beim Anhalten/Anfahren, Umhang- und Haar-Winkel – additiv auf eine Pose | entwurf |
| figur-form | `engine/models/character/figur-form.js` | SDF-Baukasten für organische Figuren: weich verschmelzende Körper (Kapsel, Ellipsoid, Rundbox, Ring) mit Farbe und Knochen-Gewichten je Körper – Grundlage für den einteiligen, gehäuteten Figurenkörper | entwurf |
| figur-haar | `engine/models/character/figur-haar.js` | Frisuren und Bärte der organischen Figur als weiche SDF-Körper (Haarkappe, Pony, Strähnen-Bündel, Zöpfe aus Kugelketten, Locken mit Rauschen) – Gesicht frei, Hut-tauglich | entwurf |
| figur-haut | `engine/models/character/figur-haut.js` | Organischer Figurenkörper: Look → SDF-Form (Anatomie + Kleidung + Haar) → ein glattes Netz (Surface Nets) mit gebackener Umgebungsverdeckung → SkinnedMesh, das weich mit dem Rig mitbiegt | entwurf |
| figur-kleidung-basis | `engine/models/character/figur-kleidung-basis.js` | Gemeinsame Helfer für Kleidung und Haar der organischen Figur: Farben, Stoffdicke, Haut vermessen (Strahlen ins Abstandsfeld), Knochen-Gewichte (Rumpf, Rock), Glocke mit Saum | entwurf |
| figur-kleidung-oben | `engine/models/character/figur-kleidung-oben.js` | Oberteil der organischen Figur als SDF-Körper: Rumpf-Hülle, Schulterpartie, Kragen/Ausschnitt, Ärmel, Säume, Knöpfe, Rüstungsplatten – je Oberteil-Stil | entwurf |
| figur-kleidung-unten | `engine/models/character/figur-kleidung-unten.js` | Unterteil der organischen Figur als SDF-Körper: Hose (lang, kurz, Pluder), Röcke/Roben/Mantelschöße mit Saum, Schürze, Gürtel mit Schnalle und Tasche, Schuhe je Stil | entwurf |
| figur-kleidung | `engine/models/character/figur-kleidung.js` | Kleidung der organischen Figur als SDF-Körper über der Anatomie: Oberteil mit Ärmeln, Hose/Rock/Robe, Gürtel + Tasche, Schuhe – je Stil aus character-look | entwurf |
| figur-koerper-kopf | `engine/models/character/figur-koerper-kopf.js` | Hals und Kopf der organischen Figur als SDF-Körper: Schädel, Kiefer/Kinn, Wangenknochen, Brauenbogen, Augenhöhlen (passend zu den starren Augäpfeln), Nase, Ohren (Mund = Mimik-Mesh) | entwurf |
| figur-koerper | `engine/models/character/figur-koerper.js` | Anatomie der organischen Figur als SDF-Körper: Rumpf (Brustkorb, Taille, Bauch, Becken, Gesäß, Trapez, Schultermuskeln), Arme, Hände mit Daumen (Griff am Sockel umschlossen), Beine, Füße mit flacher Sohle; Hals + Kopf in figur-koerper-kopf | entwurf |
| hase | `engine/models/kreaturen/hase.js` | Low-Poly-Feldhase (kleines Wild): runder Rumpf, kräftige Hinterläufe, lange Ohren mit schwarzen Spitzen, weiße Blume; zwei Sprung-Bild-Geometrien (Vertexfarben) für InstancedMesh | entwurf |
| irrlicht | `engine/models/kreaturen/irrlicht.js` | Low-Poly-Irrlicht (Moorgeist): hell leuchtender Kern, Halo und wehende Schleier; zwei Schwebe-Bild-Geometrien (Vertexfarben) | entwurf |
| keiler | `engine/models/kreaturen/keiler.js` | Low-Poly-Keiler (Wildschwein) als Horden-Gegner: massig, Borstenkamm, Hauer; zwei Lauf-Bild-Geometrien (Vertexfarben) | entwurf |
| ratte | `engine/models/kreaturen/ratte.js` | Low-Poly-Riesenratte als Horden-Gegner: liefert zwei Lauf-Bild-Geometrien (Vertexfarben) für InstancedMesh | entwurf |
| reh | `engine/models/kreaturen/reh.js` | Low-Poly-Reh (Wild, scheu): schlanker Rumpf, langer Hals, große Ohren, weißer Spiegel, Bock mit kleinem Gehörn; zwei Lauf-Bild-Geometrien (Vertexfarben) für InstancedMesh | entwurf |
| wolf | `engine/models/kreaturen/wolf.js` | Low-Poly-Wolf als Horden-Gegner (und Boss-Wolf per Skala): zwei Lauf-Bild-Geometrien (Vertexfarben) für InstancedMesh | entwurf |
| astbaum | `engine/models/natur/astbaum.js` | Baum mit sichtbaren Ästen, feinen Zweigen und echten Blättern (Blatt-Büschel statt Kugel-Kronen) als EINE Geometrie mit weichen Normalen, Vertexfarben + Wind | entwurf |
| baum-arten | `engine/models/natur/baum-arten.js` | Reine Parameter-Daten der Baumarten (Wuchs, Verzweigung, Laubform, Farben, Jahreszeiten) für baum-skelett/baum | entwurf |
| baum-skelett | `engine/models/natur/baum-skelett.js` | Ast-Skelett eines Baums aus Art-Parametern + Seed: rekursive Verzweigung mit Tropismus, Krümmung, Verjüngung, Laub-Knoten und Nadel-Etagen (reine Logik) | entwurf |
| baum | `engine/models/natur/baum.js` | Prozedurale Low-Poly-Bäume (14 Arten) als EINE Geometrie mit Vertexfarben + Wind-Attribut; Jahreszeit, Alter, Detailstufe | entwurf |
| fels-basis | `engine/models/natur/fels-basis.js` | Kleine Helfer für Felsen/Totholz: Dreiecke mit Flächenfarben sammeln → nicht-indizierte BufferGeometry (position, normal, color, wind=0), Farb-Mischen | neu |
| fels-form | `engine/models/natur/fels-form.js` | Reine Fels-Grundform (ohne THREE): Ico- oder Säulen-Netz, verformt mit fBm/Grat, planare Bruchkanten, Schichtung, Erosion oben, flacher Boden | neu |
| fels | `engine/models/natur/fels.js` | Prozedurale Low-Poly-Felsen (Vertrag NATUR-ASSETS): fels, felsbrocken, findling, geroell, felsplatte, felsnadel – mit Gesteinsfarben, Schichtung, Moos, Schnee | neu |
| fundmodelle | `engine/models/natur/fundmodelle.js` | Fundstücke als reine Dreieckslisten: Erzbrocken, Ammonit, Quarzdruse (lineare RGB-Vertexfarben, Meter) | entwurf |
| landschaftsgruppen | `engine/models/natur/landschaftsgruppen.js` | Verbundene Kleinformen als ein Mesh: Wollgras, Pilzholz, Flechtenbank (für Instancing) | entwurf |
| laub-klumpen | `engine/models/natur/laub-klumpen.js` | Dichtes Laub als Blatt-Karten-Klumpen (rein, ohne THREE): je Kronen-Büschel viele Karten in einem abgeflachten Ellipsoid, Kern dunkel, Rand hell; ausdünnen (LOD) und in Weltkoordinaten sammeln | entwurf |
| natur-assets | `engine/models/natur/natur-assets.js` | Registry der Natur-Generatoren (Bäume, Felsen, Totholz, Büsche, Bodendecker, Wüste, Urwald-Unterwuchs): Typname → Generator, Asset bauen, Varianten-Cache mit gemeinsamen Geometrien | entwurf |
| natur-basis | `engine/models/natur/natur-basis.js` | Gemeinsame Helfer für Natur-Assets: Dreiecke sammeln → nicht-indizierte Geometrie (position/normal/color/wind), Farben, Fake-AO, Schnee, Ast-Röhre, Laub-Blob, Kegel-Lage, Wedel | entwurf |
| naturfundus | `engine/models/natur/naturfundus.js` | Kleiner Naturfundus: Fichte, Birke, Felsblöcke, Uferpflanzen, Steinpilz, Fische – je ein Mesh mit Vertexfarben, Fußpunkt im Ursprung, Meter | entwurf |
| pflanze-basis | `engine/models/natur/pflanze-basis.js` | Sammler für Pflanzen-Geometrie: Dreiecke (ein-/zweiseitig, nach außen ausgerichtet), Bänder, Rohre, verformte Laubballen → EINE BufferGeometry mit position, normal, color, wind | entwurf |
| pflanze-blume | `engine/models/natur/pflanze-blume.js` | Bauteile für Bodendecker: Blume (Stängel + Blüte je Sorte: Stern, Schale, Glocke, Pompon, Ähre) und Pilze (Fliegenpilz, Steinpilz, Hexenring) in einen Pflanzen-Sammler | entwurf |
| pflanze-boden | `engine/models/natur/pflanze-boden.js` | Prozedurale Low-Poly-Bodendecker: farn (gefiederte Wedel), grasbueschel (Halm-Fächer), blume (Sorten per Seed), pilz (Fliegenpilz/Steinpilz/Hexenring), schilf (Halme + Rohrkolben), seerose (liegt auf y≈0) | entwurf |
| pflanze-busch | `engine/models/natur/pflanze-busch.js` | Prozedurale Low-Poly-Büsche: busch (Laubballen + Zweige), beerenbusch (rote/blaue Beeren), ginster (Ruten mit gelben Blüten), zwergstrauch (flach, heidekrautig) | entwurf |
| pflanze-formen | `engine/models/natur/pflanze-formen.js` | Reine Form-Logik für Pflanzen (ohne THREE): Bögen für Halme/Wedel/Blätter, Rosetten-Layouts, Blüten- und Pilzsorten, Kaktusarme, Farbhelfer mit Jahreszeit | entwurf |
| pflanze-unterwuchs | `engine/models/natur/pflanze-unterwuchs.js` | Prozeduraler Urwald-Unterwuchs: wedelfarn (gekrümmte Wedel-Karten mit gesägter Silhouette), busch_unterholz (Laubklumpen mit Blatt-Rand), moospolster (flache Kuppeln), wurzelschoessling (Wurzelknie mit Jungtrieb), laubstreu (flacher Laubfleck) | entwurf |
| pflanze-wueste | `engine/models/natur/pflanze-wueste.js` | Prozedurale Low-Poly-Wüstenpflanzen: kaktus (Kandelaber mit Armen), saeulenkaktus (gerippte Säule, evtl. Blüte), agave (Rosette spitzer, gekielter Blätter) | entwurf |
| riesenbaum-form | `engine/models/natur/riesenbaum-form.js` | Reine Form eines Urwald-Riesen in echter Größe (ohne THREE): Stamm-Achse, Brettwurzeln, optionaler Wurzelbogen als SDF, dazu Maße und Kronen-Skelett | entwurf |
| riesenbaum-krone | `engine/models/natur/riesenbaum-krone.js` | Krone des Riesenbaums (rein, ohne THREE): wenige sehr dicke Hauptäste als Skelett, Laub als große weiche Gauß-Blobs, hängende Bartflechten | entwurf |
| riesenbaum-netz | `engine/models/natur/riesenbaum-netz.js` | Baut aus der Riesenbaum-Form die rohen Daten (rein, ohne THREE): SDF-Netz für Wurzeln und Stammfuß, verjüngter Stamm, Ast-Röhren, Rindenfarben, Splats, Höhenkarte | entwurf |
| riesenbaum | `engine/models/natur/riesenbaum.js` | Urwald-Riese in echter Größe (~110 m): Wurzeln und Stammfuß weich aus dem SDF, darüber Stamm und dicke Äste als EINE Geometrie; Laub, Moos und Flechten als Gauß-Splat-Daten | entwurf |
| totholz-form | `engine/models/natur/totholz-form.js` | Reine Röhren-Geometrie (ohne THREE) für Totholz/Äste: Ringe entlang eines Pfads, Enden zu/Spitze/Jahresring-Scheibe, Markierung je Dreieck | neu |
| totholz | `engine/models/natur/totholz.js` | Prozedurales Low-Poly-Totholz (Vertrag NATUR-ASSETS): baumstumpf (Jahresringe, Wurzelansätze), liegenderStamm (Aststummel), ast | neu |
| bau-instanzen | `engine/render/bau-instanzen.js` | Bau-Teile (Häuser, Laternen, Brunnen …) als InstancedMesh je typ#variante, ein gemeinsames Leucht-Mesh, Kollisions-Körper und Anker in Weltlage | entwurf |
| figur-material | `engine/render/figur-material.js` | Weiches Figuren-Material: Standard-Material mit Randlicht (Fresnel), aufgehellter Schattenseite und kräftigeren Farben – Figuren heben sich vom Gelände ab | entwurf |
| gauss-saat | `engine/render/gauss-saat.js` | Prozedurale Gauß-Splats erzeugen: wachsender Daten-Sammler, Quaternion aus einer Normalen und flächengleiche Aussaat flacher Scheiben auf einem Dreiecksnetz (Moos, Flechten, Laub) | entwurf |
| gauss-sortierung | `engine/render/gauss-sortierung.js` | Tiefen-Sortierung für Gauß-Splats: 16-Bit-Zähl-Sortierung entlang der Blickrichtung (hinten→vorn), ohne Allokation je Aufruf – 120 k Splats in ~1–3 ms | entwurf |
| gauss-wolke | `engine/render/gauss-wolke.js` | Echte 3D-Gauß-Splats, prozedural befüllt: jeder Splat ist ein Ellipsoid (Mitte, 3 Standardabweichungen, Drehung, Farbe, Deckkraft), gezeichnet als instanziertes Viereck mit 3D→2D-Kovarianz, vormultipliziertem Alpha und Tiefen-Sortierung – Meshes verdecken Splats korrekt | entwurf |
| grosszauber-mesh | `engine/render/grosszauber-mesh.js` | Zeichnet laufende Großzauber (gameplay/grosszauber): je Wirkung eine Ansicht aus einer Ansichts-Fabrik je Art, legt sie an und räumt sie ab, sobald die Wirkung endet | entwurf |
| grosszauber-riss-ansicht | `engine/render/grosszauber-riss.js` | Zeichnet den Erdriss (gameplay/grosszauber-riss): glühendes Lava-Band mit Felsrändern, gekippte Schollen, Lava-Säulen und Glut-Funken; kühlt zu dunkelrot/schwarz ab | entwurf |
| grosszauber-sturm-ansicht | `engine/render/grosszauber-sturm.js` | Ansicht des Zyklons: zwei ineinanderliegende Trichter-Röhren mit scrollender Streifen-Textur, drehende Wolkenscheibe, spiralförmig aufsteigende Staub-/Trümmer-Punkte samt Bodenring, Blitze als Zickzack-Linien | entwurf |
| grosszauber-wand-ansicht | `engine/render/grosszauber-wand.js` | Ansicht des Großzaubers 'Erdwall': kantige Felspfeiler (InstancedMesh, Low-Poly, Risse + Moos), Erdwulst und Trümmer am Fuß, Staubwolke beim Aufsteigen und Zerfallen, Zittern beim Steigen | entwurf |
| grosszauber-welle-ansicht | `engine/render/grosszauber-welle.js` | Ansicht der Flutwelle: gebogenes, verformtes Wellen-Gitter mit überrollendem Kamm, Schaumkrone und Fresnel-Rand, Gischt als Punkte, auslaufende Flutfläche – 3 Draw-Calls, ~3500 Dreiecke, Tiefenfarben + Schaumstreifen prozedural, keine Schatten | entwurf |
| horde-mesh | `engine/render/horde-mesh.js` | Zeichnet eine Horde (gameplay/horde) mit wenigen Draw-Calls: je Modell und Lauf-Bild ein InstancedMesh; Hüpfer, Überschlag im Flug, Treffer-Aufblitzen, Leichen auf der Seite, Versinken | entwurf |
| kronen-lichtkarte | `engine/render/kronen-lichtkarte.js` | Lichtkarte unter einem Kronendach: kleines Render-Target, orthografisch entlang der Licht-(Sonnen-/Mond-)Richtung, nur Verdecker (Laub, Stämme) – selten neu gerendert (Sonne merklich gewandert oder Mitte verlassen). Liefert Sonnentupfer für beliebige beleuchtete Materialien (ein Texture-Lookup je Fragment, dämpft nur das erste Richtungslicht), GLSL für eigene Shader, CPU-Abfrage aus dem Readback (Lücken für Lichtstrahlen) und reine Helfer zur Lücken-Wahl | entwurf |
| laub-karten | `engine/render/laub-karten.js` | Dichtes Laub als EIN instanziertes Mesh aus Blatt-Karten (zur Kamera gedreht): Blatt-Silhouette prozedural im Fragment-Shader (keine Textur), Alpha-Test bzw. alphaToCoverage, Richtungslicht mit Durchscheinen zur Sonne, dunkler Kern, Wind, exp²-Nebel + eigener Höhendunst | entwurf |
| licht-pool | `engine/render/licht-pool.js` | Wenige echte PointLights, die sich die nächsten Lichtquellen zum Fokus greifen (Lagerfeuer bevorzugt), weich ein-/ausblenden, Feuer flackert, Laternen tags aus | entwurf |
| mesh-builder | `engine/render/mesh-builder.js` | Low-Poly-Modelle aus Primitiven (Box, Kugel, Zylinder …) mit Vertexfarben zu EINER Geometrie verschmelzen; Farbvariation pro Dreieck per Seed | entwurf |
| mond | `engine/render/mond.js` | Mond mit Kratertextur, Phase aus dem Sonnenwinkel und Mondlicht mit Schatten (für Szenen mit Floating Origin) | entwurf |
| natur-material | `engine/render/natur-material.js` | Gemeinsames Material für Natur-Assets: MeshStandardMaterial (Vertexfarben, flatShading) mit Wind-Schwingen im Vertex-Shader über das Attribut 'wind' (0 starr … 1 voll); Phase je Instanz aus der Weltposition; passendes Schatten-Material; optional Ausblenden ab Kamera-Entfernung | entwurf |
| niederschlag | `engine/render/niederschlag.js` | Regen/Schnee als ein Points-Objekt um die Kamera; Bewegung komplett im Vertex-Shader (kein CPU-Aufwand je Partikel) | entwurf |
| psx | `engine/render/psx.js` | PS1-Look für eine ganze Szene (aus Viniland übernommen): Eckpunkte rasten auf ein grobes Bildraster (Wackeln), wenige Farbstufen mit Bayer-Dithering, grobe Pixel (kleine interne Auflösung, hart hochskaliert), Stimmung (Kontrast, Sättigung, Tönung, Vignette je Ansicht/Splitscreen) – live an/aus ohne Neu-Kompilieren | entwurf |
| qualitaet | `engine/render/qualitaet.js` | Automatische Qualitätsstufe nach Bildzeit (Handy-Schutz): wird es langsam, sinken Pixelverhältnis, Schattenkarte, Partikel und Schadens-Zahlen; wird es lange schnell, steigen sie wieder – mit Hysterese, reine Logik (das Spiel wendet die Werte an) | entwurf |
| splat-look | `engine/render/splat-look.js` | Gaussian-Splat-Look für eine fertige Szene: das Bild wird klein gerendert und als zehntausende weiche, längliche Gauß-Flecken neu gemalt (entlang der Kanten ausgerichtet, nah größer als fern) – Stil-Experiment, keine echten 3D-Splats | entwurf |
| zauber-effekte | `engine/render/zauber-effekte.js` | Leichte Zauber-Effekte fürs Handy: ein Partikel-Points-Objekt (Funken, Schweife), leuchtende Geschoss-Kugeln, Schockwellen-Ringe, Blitze, Erdstacheln, Schutz-Aura, Meteor-Sturz – alles aus Pools | entwurf |
| modul-bewohner | `engine/spiel/modul-bewohner.js` | Spiel-Modul 'bewohner': 6–10 Siedler an welt.ort('siedlung') mit Tagesablauf (character-brain, Stunde aus himmel.uhr), Namensschildern, Entität je Bewohner (Team freund), Treffer/Tod-Reaktion, LOD (ferne NPCs seltener, ganz ferne eingefroren) | entwurf |
| modul-dorf | `engine/spiel/modul-dorf.js` | Spiel-Modul 'dorf': Startdorf Erlenwacht am Ort 'siedlung' – Plan (world/dorf-plan) + Gebäude/Kleinkram (models/bau) als Instanzen mit Kollision (render/bau-instanzen), Licht in der Nacht (render/licht-pool), Platz + Gassen als Boden, Felder voller Beete, Brücke über den Erlbach, Treffpunkt-Stationen (Brunnen, Schrein, Anschlagbrett, Amboss, Lagerfeuer) für Tutorial und Spieler | entwurf |
| modul-entitaeten | `engine/spiel/modul-entitaeten.js` | Spiel-Modul 'entitaeten': stabile IDs, Leben/Schaden über die Befehls-Schicht (gameplay/befehle), Ereignisse ent:* auf dem Spiel-Bus, schwebende Schadenszahlen + Lebensbalken über getroffenen Zielen (mit 'render') | entwurf |
| modul-fortschritt | `engine/spiel/modul-fortschritt.js` | Spiel-Modul 'fortschritt': Stufen 1–15, XP aus Gegner-Toden, Talente, Inventar (24 Plätze) + Ausrüstung, Beute als leuchtende Beutel (1 InstancedMesh, Auto-Aufheben 2 m, 120 s), Werte auf die Spieler-Entität, Licht-Ring bei Stufenaufstieg | entwurf |
| modul-gegner | `engine/spiel/modul-gegner.js` | Spiel-Modul 'gegner': Lager nach Region an allen welt.orte der Art 'gegnerlager' (Waldrand Ratten · Hochland Wölfe + Keiler · Moor Irrlichter + Ratten, Stufe aus ort.stufe) + ein kleines am Waldrand beim 'tor', Boss „Grauzahn, der Alpha“ (Stufe 10) am Ort 'boss' (sonst 'ruine') mit Warn-Ring, Horden mit je einer Entität pro Tier (Team 'feind'), Jagd/Heimkehr/Respawn, Interest-Management (nur Lager nahe dem Fokus laufen und sind sichtbar), nachts mehr und aggressiver | entwurf |
| modul-himmel | `engine/spiel/modul-himmel.js` | Spiel-Modul 'himmel': Spieluhr, Himmel (Sonne, Mond, Sterne, Wolken, Nebel), Wetter mit Regen/Schnee; Sonnenlicht mit Schatten, der dem Fokus folgt (Größe nach Qualitätsstufe); Walddunst für andere Module (`dunst` 0..1) | entwurf |
| modul-kampf | `engine/spiel/modul-kampf.js` | Spiel-Modul 'kampf': Grundangriff ⚔ (Kombo über gameplay/nahkampf, Bogen = Pfeil), Klassen-Fähigkeiten für Krieger (Wut) und Waldläufer (Energie) mit eigener Leiste, Magier über das Zauber-Modul; Freischaltung nach Stufe | entwurf |
| modul-oberflaeche | `engine/spiel/modul-oberflaeche.js` | Spiel-Modul 'oberflaeche': Spieler-Rahmen (Name, Stufe, Leben, Ressource, EP), Ziel-Rahmen, Minikarte, Chat (hört auf alle Ereignisse), ☰-Menü mit Fenstern Charakter/Inventar/Talente/Karte/Optionen/Spielstand/Entwickler, Stufenaufstiegs-Einblendung – alles tolerant, wenn Nachbarmodule fehlen | entwurf |
| modul-riesenwald | `engine/spiel/modul-riesenwald.js` | Spiel-Modul 'riesenwald': Urwald-Riesen in echter Größe (Stamm 6–12 m dick, 60–90 m hoch) entlang der Wege in Region 'daemmerwald' – Weg frei, Tor-Paar mit Astbogen, dichte Blatt-Karten-Kronen mit Kronen-Schatten, Unterwuchs am Weg; Stämme als Hindernisse; Detailstufen nach Entfernung zum Fokus | entwurf |
| modul-spieler | `engine/spiel/modul-spieler.js` | Spiel-Modul 'spieler': Spielfigur (character) mit Eingabe, tiefer Verfolger-Kamera (Riesen wirken groß), Lock-On auf Entitäten, Ausdauer (Sprint, Rolle, Schwimmen, Klettern, Springen), Klettern an Fels/Stämmen, eigene Entität mit Treffer-Reaktion + Wiederbeleben, Notlicht ohne Himmel | entwurf |
| modul-tutorial | `engine/spiel/modul-tutorial.js` | Spiel-Modul 'tutorial': Aufgabenkette (Alwe am Strand → Brandt in Erlenwacht → Grauzahn), Quest-NPCs mit !/?-Schild, Dialog-Fenster, Aufgaben-Verfolger rechts, Wegpunkt-Säule + Randpfeil | entwurf |
| modul-welt | `engine/spiel/modul-welt.js` | Erlenwacht-Welt (≈4×4 km): Karte/Regionen/Orte/Wege aus world/welt-regionen, Gelände als gestreamte Kacheln mit Detailstufen (world/chunk-strom), Streu-Bäume/Felsen/Büsche je Kachel als Instanzen samt Kollision, Meer und Moortümpel, Flüsse/Bäche (fluss-mesh, Strömung + Schaum), Gras um den Fokus (gras-feld), Fernwald (Impostor, 1 Draw-Call) – rund um den Dienst `fokus` | entwurf |
| modul-zauber | `engine/spiel/modul-zauber.js` | Spiel-Modul 'zauber': Zauberbuch (gameplay/zauber) + Effekte + Großzauber (Flutwelle, Erdwall, Zyklon, Erdriss) in der großen Welt, alle Treffer laufen durch gameplay/element-reaktionen (Schock, Einfrieren, Dampf, Feuersturm …); Ziele = Entitäten Team 'feind'; Zauber-Gesten der Figur; Handy-Leiste mit Halten = Aufladen und Mana-Balken | entwurf |
| module-register | `engine/spiel/module-register.js` | Modul-Register: welche Spiel-Module es gibt, wo jedes steht (labor → testfeld → spiel), wer welche Engine-Bausteine pflegt; wählt die Module für das echte Spiel, das Testfeld oder ein einzelnes Modul samt Abhängigkeiten | entwurf |
| module | `engine/spiel/module.js` | Alle Spiel-Module an einer Stelle: Name → Modul-Objekt; wählt per Register (module-register) die Module fürs echte Spiel, fürs Testfeld oder ein einzelnes Modul samt Abhängigkeiten | entwurf |
| oberflaeche-fenster | `engine/spiel/oberflaeche-fenster.js` | Menü-Seiten fürs Spiel-Modul 'oberflaeche': Charakter (Werte, Ausrüstung), Inventar, Talente (3 Spalten), Karte, Optionen, Spielstände, Entwickler – alles über ui/menue, tolerant gegen fehlende Module | entwurf |
| riesenwald-teile | `engine/spiel/riesenwald-teile.js` | Bauteile des Riesenwald-Moduls: Fern-Silhouette eines Riesen (eine Drehform mit Kronen-Wulst, ~150 Dreiecke), Astbogen zwischen zwei Tor-Riesen (gebogene, verjüngte Röhre mit Moos oben) und eine Loch-Maske für Kronen-Schatten | entwurf |
| spiel | `engine/spiel/spiel.js` | Spiel-Host: die ganze Engine in einem Aufruf – Renderer, Szene, Kamera, Schleife (fester Schritt + Bild), Handy-Qualität, URL-Schalter und Modul-Kern; Module (Welt, Figur, Zauber, Gegner …) werden nur noch angesteckt | entwurf |
| tutorial-daten | `engine/spiel/tutorial-daten.js` | Reine Daten der Erlenwacht-Aufgabenkette (Tutorial + Hauptgeschichte) für gameplay/aufgaben: Schritte, Belohnungen, NPC-Dialoge | entwurf |
| zauber-anzeige | `engine/spiel/zauber-anzeige.js` | Sichtbares zu Element-Reaktionen fürs Zauber-Modul: Boden-Flecken (nass, brennend, gefroren, schlamm, geladen) als weiche Scheiben in einem Draw-Call, Dampfwolken (Sprites), Eis-Glanz (Eis-Hülle), Funken/Feuersturm über zauber-effekte und der Ziel-Kreis beim Aufladen – alles aus Pools, fürs Handy sparsam | entwurf |
| zauber-gross | `engine/spiel/zauber-gross.js` | Großzauber fürs Zauber-Modul in der großen Welt: Logik (gameplay/grosszauber + welle/wand/sturm/riss) und Bild (render/grosszauber-*); Erdwall-Pfeiler werden echte Körper in welt.kollision, die Flutwelle macht den Boden nass, Zyklon/Erdriss legen Wind/Feuer auf den Boden (Element-Reaktionen) | entwurf |
| fake-dom | `engine/test/fake-dom.mjs` | Minimale Browser-Attrappe für Node-Tests: document, window, localStorage, requestAnimationFrame | stabil |
| aufgaben-anzeige | `engine/ui/aufgaben-anzeige.js` | Ziel-Zeile oben links (Titel, Schritt-Text, Fortschritt), Ziel-Marker (Raute + Meter) bzw. Randpfeil, Blitz-Meldung/Banner; DOM, THREE nur für project() | entwurf |
| chat | `engine/ui/chat.js` | Chat-Fenster fürs MMO: Kanäle (system, kampf, beute, sagen, aufgabe, welt) mit Farben und Reiter-Filter, eingeklappt 3 Zeilen halbtransparent, antippen = groß mit Eingabezeile; Befehle (/hilfe, /ort …) als Register; Ring-Puffer 80 Zeilen; Logik ohne DOM testbar | entwurf |
| figur-editor | `engine/ui/figur-editor.js` | Aussehen einer Figur bearbeiten (DOM, Handy): je Teil ◀ ▶ durch die Stile, Farb-Tupfer für Haut/Haar/Kleidung/Hose, Körper-Regler, Zufall-Knopf und Vorlagen – liefert nur den Look (Daten), die Vorschau zeichnet der Aufrufer | entwurf |
| figur-schild | `engine/ui/figur-schild.js` | Namensschild + Sprechblase + Lebensbalken über Figuren (DOM-Overlay): folgt dem Kopf, skaliert und blendet nach Abstand aus, verschwindet hinter der Kamera | entwurf |
| hud | `engine/ui/hud.js` | Spiel-Anzeige als DOM-Overlay: Hinweis-Zeile mit Fortschritt, Kurzmeldungen (zusammenzählbar), Lebens-/Ausdauer-Balken und Bereiche für Leisten | entwurf |
| inventar-ansicht | `engine/ui/inventar-ansicht.js` | Zeigt ein Inventar als Reihe/Raster von Plätzen (Schnellleiste, Rucksack, Truhe): Zeichen, Anzahl, Haltbarkeits-Strich, gewählter Platz, Tippen und Gedrückt-halten | entwurf |
| kampf-leiste | `engine/ui/kampf-leiste.js` | MMO-Aktionsleiste als DOM-Overlay: Plätze mit Symbol/Taste, Abklingzeit, GCD, Ladungen, Ausgrauen, Wirkbalken, Ressourcenbalken | entwurf |
| menue | `engine/ui/menue.js` | Menü/Fenster als DOM-Overlay mit Seiten (Pause, Optionen, Spielstände, Truhe, Werkbank …): Knöpfe, Schalter, Regler, Auswahl, eigene Elemente; Escape/Rand-Tipp, fingerfreundlich, alle Stile inline | entwurf |
| minikarte | `engine/ui/minikarte.js` | Runde Minikarte (Canvas, 92 px) fürs MMO: Gelände-Farbbild der ganzen Welt einmal vorberechnet (in kleinen Zeit-Stückchen), Spieler-Pfeil, Orte als Punkte, Gegner rot (4×/s); dieselbe Zeichnung auch groß mit Ortsnamen für ein Karten-Fenster | entwurf |
| treffer-zahlen | `engine/ui/treffer-zahlen.js` | Schadens-Zahlen als DOM-Overlay: ploppen über Treffern auf, schweben nach oben und blenden aus (fester Pool, handytauglich) | entwurf |
| zauber-leiste | `engine/ui/zauber-leiste.js` | Handy-taugliche Zauber-Leiste als DOM-Overlay: große Knöpfe (≥ 44 px) mit Symbol, Taste, Abklingzeit-Schleier und Lade-Ring; Halten = Aufladen/Überladen, Loslassen = Wirken (Zeiger UND Tasten 1–8); Mana-Balken darüber | entwurf |
| ziel-rahmen | `engine/ui/ziel-rahmen.js` | MMO-Ziel-/Spieler-Rahmen als DOM-Overlay: Name, Lebensbalken mit Schild und Schaden-Rest, Haltung, Ressource, Zustands-Symbole | entwurf |
| boden-anpassung | `engine/world/boden-anpassung.js` | Gelände schmiegt sich an große Objekte (Wurzeln, Felsen, Ruinen): weicher Erdwulst aus lokalen Höhenkarten, Verdeckung (AO) am Fuß | entwurf |
| chunk-strom | `engine/world/chunk-strom.js` | Gelände-Kacheln um einen Fokus streamen (reine Logik): Quadtree-Detailstufen (nah fein, fern grob) bis zur Sichtweite, Bau-Budget je Bild, alte Kacheln bleiben, bis die neuen fertig sind (keine Löcher); dazu ein einfacher Kachel-Ring für Nahbereichs-Daten (Streu, Kollision) | entwurf |
| dorf-plan-kern | `engine/world/dorf-plan-kern.js` | Handgesetzter Kern des Dorfes Erlenwacht (Platz, Taverne, Tempel, Schmiede …) relativ zur Dorfmitte + Standard-Maße (ohne THREE) | entwurf |
| dorf-plan | `engine/world/dorf-plan.js` | Plan des Startdorfes Erlenwacht (reine Logik, ohne THREE): Platz-Kern, Häuser an Wegen, Gärten, Kleinkram, Gassen, Laternen, Brücke, Felder, Palisade | entwurf |
| fern-wald | `engine/world/fern-wald.js` | Fernwald als Impostor-Kacheln: Wald-Biome jenseits der Streu-Reichweite (innen … aussen, ~150–1500 m) als grobe Zwei-Kegel-Baumgruppen in EINEM InstancedMesh (1 Draw-Call, ≤ 60 k △), Farbe nach Biom, Nebel über das Szenen-Material; Kacheln (200 m) werden bei Kachelwechsel des Fokus nachgeladen, nie je Bild | entwurf |
| fluss-mesh | `engine/world/fluss-mesh.js` | Wasserband für Flüsse/Bäche aus Proben {x,z,y,b}: 5 Punkte je Querschnitt (Rand reicht unter die Böschung → keine Lücke), Attribute `ufer` (Schaumsaum für wasser-glanz) und `lauf` (Meter flussab) für fließende Strömungs-Streifen im Shader; ein Mesh für alle Flüsse | entwurf |
| gras-feld | `engine/world/gras-feld.js` | Wogendes Gras um den Fokus: ein InstancedMesh (ein Draw-Call), Halm-Büschel aus gekreuzten, sich verjüngenden Streifen, Wind + Ausblenden (Größe → 0) im Vertex-Shader; Platzierung rein und deterministisch aus der Weltkarte | entwurf |
| himmel-stand | `engine/world/himmel-stand.js` | Himmel als reine Daten: Sonnen- und Mondbahn aus Stunde/Jahreszeit/Breitengrad, Mondphase, Himmels-, Nebel- und Lichtfarben über den Tag (Nacht, Dämmerung, goldene Stunde, Mittag), Sterne, Einfluss von Wolken/Nebel/Regen/Blitz | entwurf |
| himmel | `engine/world/himmel.js` | Zeichnet den Himmel aus einem himmel-stand: Himmelskuppel mit Farbverlauf, Sonnenscheibe mit Schein, Mond mit Phase, ziehende Wolken, Sterne; steuert Sonnen-/Mondlicht mit mitlaufendem Schatten, Umgebungslicht und Nebel der Szene | entwurf |
| kollision | `engine/world/kollision.js` | Kollisions-Welt über einem Welt-Adapter: bewegliche und entfernbare Körper (Zylinder, gedrehte Kästen) mit Höhe – man kann draufsteigen, drüberspringen, sich aneinander vorbeischieben; dazu ein Strahl-Test gegen Gelände und Körper (Zielen, Sichtlinie, Ablegen) | entwurf |
| riesenwald-plan | `engine/world/riesenwald-plan.js` | Plan eines Riesenwalds als reine Daten (ohne THREE): Urwald-Riesen in Reihen entlang von Wegen (Weg bleibt frei), Tor-Paar links/rechts am Waldeingang, Kranz um eine Lichtung, Hinterland bis zu einer Tiefe aufgefüllt – deterministisch per Seed | entwurf |
| scatter-mesh | `engine/world/scatter-mesh.js` | Zeichnet die Objekte einer erzeugten Welt (welt.objekte) als InstancedMesh je (Typ, Variante): mit Asset-Cache prozedurale Natur-Assets in Metern (Bäume, Felsen, Büsche, Bodendecker …) mit Wind, sonst einfache Low-Poly-FORMEN; unbekannte Typen → Ersatz nach Art oder weglassen; Seerosen auf dem Wasser | entwurf |
| terrain-farben | `engine/world/terrain-farben.js` | Geländefarben je Gitterzelle aus einer erzeugten Welt: weiche Biom-Übergänge mit ausgefransten Grenzen, Wiesenflecken und trockene Grastöne, Mikrovariation, Hangfels mit Gesteinsbändern, nasser Sand, Flusskies und Seeschlamm, festgetretene Wege (FLAG.WEG), Meeresgrund nach Tiefe, Schnee mit Rauschgrenze (an Nordhängen tiefer), Mulden dunkler | entwurf |
| terrain-mesh | `engine/world/terrain-mesh.js` | Baut aus einer erzeugten Welt (worldgen) und ihrem Welt-Adapter ein Three-Gelände: Boden mit weich gemischten Biomfarben, Wiesenflecken, Hangfels, Ufern (Sand/Kies/Schlamm) und Schnee (terrain-farben), Seen/Flüsse auf ihrem Wasserspiegel und ein Meer bis zum Horizont | entwurf |
| wasser-glanz | `engine/world/wasser-glanz.js` | Lebendiges Wasser für vorhandene Wasser-Materialien (Seen/Flüsse/Meer aus terrain-mesh): wandernde Helligkeits-Wellen, kleine Glitzerpunkte und ein Schaumsaum am Ufer – reiner Shader-Hook, keine neue Geometrie, kein Draw-Call mehr | entwurf |
| wege-lage | `engine/world/wege-lage.js` | Lage der Brücken einer Welt in Metern (Mitte, Richtung, Länge, Höhe an beiden Enden) und ein Adapter, auf dem Figuren über die Brücken laufen statt durch den Fluss | entwurf |
| wege-mesh | `engine/world/wege-mesh.js` | Holzbrücken für die Wege einer Welt als Three-Meshes: Bohlendeck, Längsbalken, Geländer und Pfeiler bis zum Flussgrund, passend geneigt zwischen beiden Ufern (Lage aus wege-lage) | entwurf |
| welt-aenderung | `engine/world/welt-aenderung.js` | Änderungs-Schicht über einer erzeugten Welt (ohne THREE): Gelände mit Pinseln heben, senken, glätten, einebnen und Objekte entfernen; gemerkt werden nur die Unterschiede zum Seed (kleiner Spielstand), mit Rückgängig/Wiederholen, Sperrzonen (Wasser, Wege) und Meldung des geänderten Bereichs fürs Neuzeichnen | entwurf |
| welt-plan-formen | `engine/world/welt-plan-formen.js` | Form-Rechnungen für den Welt-Plan (ohne THREE): Ring-Mauer aus Segmenten/Türmen/Torhaus, Höhenprofil mit Gefälle-Grenze, geschwungene Pfad-Kurve, Gitter-Zuordnung, Boxen-Tests | entwurf |
| welt-plan | `engine/world/welt-plan.js` | Deterministischer Welt-Plan als worldgen-Stufen: Zonen (Plateau, Mulde, Kuppe), Gewässer-Rinnen, ebene Plätze, Orte, geschwungene Pfade mit begrenztem Gefälle und Brücken, Mauer-Ring; dazu Prüfung (Plateau eben, Gefälle, Objekte im Weg, Tor erreichbar) | entwurf |
| welt-regionen | `engine/world/welt-regionen.js` | Erlenwacht-Weltkarte als reine Logik: Regionen (Küste, Dämmerwald, Talkessel, Moor, Hochland, Gebirge), Orte, Wege und eine punktweise, seedbare Höhe (entlang der Wege geglättet), Wasser, Biome, Bodenfarben und Streu-Regeln; v1.1: weicher Kartenrand (Meer Süd/Ost, Gebirgskette Nord/West), Fluss Gebirge→Hochland→Moor mit Furt, Hügelwellen, Felsnadeln, Moor-Tümpel, Wolfsfels-Terrasse; v1.2: mehrere Flüsse (fluesse), Erlbach Hochland→Ostrand Erlenwacht→Klamm→Dämmerwald→Strand | entwurf |
| welt-streu | `engine/world/welt-streu.js` | Streu-Objekte (Bäume, Felsen, Büsche, Bodendecker) für eine Kachel deterministisch aus Seed + Biom-Regeln setzen – mit Lücken an Wegen, Orten, Wasser, steilen Hängen und gesperrten Flächen (reine Logik) | entwurf |
| wetter | `engine/world/wetter.js` | Wetter-Zustand: Wetterarten wechseln per Seed nach Klima (Feuchte/Temperatur), Werte laufen weich, Wind, Blitz, Nässe | entwurf |
| worldgen-adapter | `engine/world/worldgen/worldgen-adapter.js` | Welt-Adapter für Figuren, Kamera und Spiele: macht aus einer erzeugten Welt (normierte Höhe, Gitter) eine Welt in Metern mit bodenHoehe, wasserHoehe und hindernisse (Baumstämme, Felsen) – passt zum Vertrag in docs/plaene/FIGUREN-SYSTEM.md | entwurf |
| worldgen-biomes | `engine/world/worldgen/worldgen-biomes.js` | Biome nach Whittaker (Temperatur × Feuchte, als schnelle Nachschlagetabelle) plus Prioritätsregeln (Wasser, Schnee, Fels, Strand, Sumpf); Biomliste per Spiel erweiterbar | entwurf |
| worldgen-chunkfluss | `engine/world/worldgen/worldgen-chunkfluss.js` | Chunk-lokale Flussnetze und kleine Seen für den unendlichen Modus: grobes Knotengitter aus Seed + Position, Abfluss zum tiefsten Nachbarn, begrenzter Zufluss, Senken werden Seen – nahtlos ohne globale Stufen | entwurf |
| worldgen-chunks | `engine/world/worldgen/worldgen-chunks.js` | Unendlicher/gestreamter Modus: Höhe, Klima, Biome, chunk-lokale Flussnetze + kleine Seen (oder Rauschflüsse) und Objekte punktweise und pro Chunk – nahtlos über Chunkgrenzen (ohne globale Erosion/Hydrologie) | entwurf |
| worldgen-climate | `engine/world/worldgen/worldgen-climate.js` | Klima für den Weltgenerator: Temperatur nach Höhe/Breitengrad, Feuchte aus Wassernähe, Rauschen und Regenschatten (Windrichtung) | entwurf |
| worldgen-erosion | `engine/world/worldgen/worldgen-erosion.js` | Schnelle hydraulische Tropfen-Erosion (mit Pinsel-Abtrag) und thermische Erosion auf einem Float32-Höhenfeld; Qualitätsstufen schnell/normal/hoch | entwurf |
| worldgen-grid | `engine/world/worldgen/worldgen-grid.js` | Gitter-Helfer für den Weltgenerator: typisierter Min-Heap, Chamfer-Abstand, Regionen-Markierung, bilineares Abtasten, Array-Hash | entwurf |
| worldgen-height | `engine/world/worldgen/worldgen-height.js` | Höhenfeld aus fBm, Grat-Gebirgen, Domain-Warp, Klippen, Terrassen und optionalen Felsstufen im Gebirge (hoehe.gebirge.felsStufen: { stufen, staerke }); punktweise abtastbar (für Chunks) oder als ganzes Gitter | entwurf |
| worldgen-hydrology | `engine/world/worldgen/worldgen-hydrology.js` | Wasserhaushalt: Ozean vom Rand fluten, Senken per Priority-Flood füllen, Seen erkennen, Abflussrichtung (D8) und Abflussmenge berechnen | entwurf |
| worldgen-path | `engine/world/worldgen/worldgen-path.js` | A*-Wegsuche auf dem Weltgitter (8 Richtungen) mit Kosten nach Hang, Wasser und Flüssen; wiederverwendbare typisierte Puffer | entwurf |
| worldgen-presets | `engine/world/worldgen/worldgen-presets.js` | Standardoptionen und benannte Voreinstellungen (insel, archipel, kontinent, gebirge, wueste, tundra, sumpfland, vulkaninsel, canyon, flachland, kueste, hochebene, unendlich, urwald/daemmerwald) plus tiefes Zusammenführen von Optionen | entwurf |
| worldgen-query | `engine/world/worldgen/worldgen-query.js` | Abfragen auf einer erzeugten Welt (Weltkoordinaten): Höhe bilinear, Hang, Normale, Biom, Wasser; hängt Methoden auch an Welt-Daten aus einem Worker an | entwurf |
| worldgen-rivers | `engine/world/worldgen/worldgen-rivers.js` | Flüsse aus der Abflussmenge: Flusszellen mit Breite, Flussbett eingraben, Ufer abflachen, geglättete Flusslinien (Quelle → Meer/See) erzeugen | entwurf |
| worldgen-scatter | `engine/world/worldgen/worldgen-scatter.js` | Blue-Noise-Verteilung von Objekten (Bäume, Büsche, Felsen, Kakteen, Schilf, Blumen …) mit Dichte pro Biom, Lichtungen (je Art oder gemeinsam), Stammfuß-Häufung, Dichtefeld der Quelle und Hangregeln; reihenfolgeunabhängig und dadurch nahtlos über Chunks | entwurf |
| worldgen-shape | `engine/world/worldgen/worldgen-shape.js` | Landform-Masken für den Weltgenerator (Insel, Archipel, Kontinent, Küste, Vulkan, Canyon, Plateau, unendlich) plus formspezifische Nachbearbeitung der Höhe | entwurf |
| worldgen-sites | `engine/world/worldgen/worldgen-sites.js` | Orte finden: Startplatz (flach, nah an Wasser und Wald, eingeebnet), Dorfplätze mit Mindestabstand und Sehenswürdigkeiten (Gipfel, Quellen, Mündungen, Seen) | entwurf |
| worldgen-vegetation | `engine/world/worldgen/worldgen-vegetation.js` | Standard-Objektarten des Weltgenerators als reine Daten: Kronendach, Totholz, Unterholz, Büsche (Waldrand), Felsen/Findlinge, Geröll am Hangfuß, Kakteen, Schilf, Seerosen, Blumen und Bodendecker, dazu Urwald-Arten (Riesen, Wedelfarn, Unterholz, Moospolster, Wurzelschösslinge, Laubstreu) – mit gewichteten Typen je Biom und Typmischung nach Höhe/Feuchte/Temperatur | entwurf |
| worldgen-wege | `engine/world/worldgen/worldgen-wege.js` | Wegenetz zwischen Startplatz, Dörfern und ausgewählten Sehenswürdigkeiten: Spannbaum plus Abkürzungen, A* um Steilhänge herum, Wege teilen sich Strecken, Flüsse werden kurz per Brücke gequert; markiert Zellen als WEG und hält sie frei von Objekten | entwurf |
| worldgen | `engine/world/worldgen/worldgen.js` | Weltgenerator-Einstieg: createWorld(optionen) führt die Stufen-Pipeline (Höhe → Erosion → Hydrologie → Flüsse → Klima → Biome → Orte → Wege → Objekte) per Preset aus; Spiele können Stufen einfügen/ersetzen; Ergebnis in typisierten Arrays | entwurf |

## Tags

| Tag | Module |
|---|---|
| 3dgs | gauss-wolke |
| abbauen | rohstoffe |
| abfluss | worldgen-hydrology, worldgen-rivers |
| abfrage | raum-gitter, worldgen-query |
| abhaengigkeit | modul-kern |
| abklingzeit | faehigkeiten, zauber, kampf-leiste |
| ablegen | welt-dinge |
| abprallen | koerper |
| absicht | befehle |
| abstand | worldgen-grid |
| abstandsfeld | sdf |
| accessoire | character-parts-zubehoer |
| accessoires | character-look |
| adapter | kollision, wege-lage, worldgen-adapter |
| adaptiv | qualitaet |
| aendern | welt-aenderung |
| aeste | astbaum |
| affix | beute |
| agave | pflanze-wueste |
| agent | module-register |
| aggro | bedrohung, gegner-lager, kampf |
| aktion | interaktion, character-animator, character-clips |
| alpha | laub-karten |
| amboss | stationen, bau-uebung |
| amulett | character-parts-zubehoer |
| anatomie | figur-koerper |
| angriff | character-clips |
| animation | character, character-anim-blick, character-anim-hang, character-anim-idle, character-anim-zustand, character-animator, character-clips-mehr, character-clips-zauber, character-clips, character-gang, character-pose, character-reaktion, character-rig, character-sekundaer, wasser-glanz |
| anker | bau-instanzen |
| anschlagbrett | bau-dorf-teile |
| ansprechen | interaktion |
| ao | boden-anpassung |
| arbeit | character-clips-mehr |
| art | baum-arten |
| asset | bau-basis, bau-pruefung, bau-dorf-teile, gebaeude-pruefen, haus, bau-licht, bau-markt, mauer, schmiede, taverne, tempel, bau-uebung, bau-vorrat, wachturm, bau-wegbau, fundmodelle, landschaftsgruppen, naturfundus |
| ast | totholz-form, totholz, riesenwald-teile |
| astar | worldgen-path |
| attrappe | fake-dom |
| attribute | progression |
| audio | klang |
| aufgabe | aufgaben, aufgaben-anzeige |
| aufgaben | modul-tutorial, tutorial-daten |
| aufheben | interaktion, welt-dinge |
| aufladen | zauber, zauber-leiste |
| auflösung | qualitaet |
| augen | character-anim-blick, character-parts-gesicht |
| augenklappe | character-parts-zubehoer |
| ausdauer | ausdauer, klettern, modul-spieler |
| ausdruck | character-parts-gesicht |
| ausruesten | hand |
| ausruestung | modul-fortschritt |
| ausrüstung | character-ausruestung, character-model |
| aussehen | character-look, figur-editor |
| auswahl | ziel-wahl, module |
| ausweichen | nahkampf |
| autosave | speicher |
| avatar | character, character-look, character-model |
| axt | character-ausruestung |
| bach | fluss-mesh |
| baeume | scatter-mesh, welt-streu, worldgen-scatter, worldgen-vegetation |
| balken | hud |
| bank | bau-markt |
| banner | bau-vorrat, aufgaben-anzeige |
| bart | character-parts-haar, character-parts-kopf, figur-haar |
| bau | bau-basis, bau-pruefung, bau-teile, bau-dorf-teile, gebaeude-pruefen, haus, bau-licht, bau-markt, mauer, schmiede, taverne, tempel, bau-uebung, bau-vorrat, wachturm, bau-wegbau, bau-instanzen |
| bauen | welt-aenderung |
| baukasten | modul-kern, spiel |
| baum | klettern, astbaum, baum-arten, baum-skelett, baum, laub-klumpen, natur-assets, natur-basis, naturfundus, riesenbaum-form, riesenbaum-krone, riesenbaum-netz, riesenbaum |
| baumstumpf | totholz |
| beben | grosszauber-riss, grosszauber-wand, grosszauber-welle, grosszauber, grosszauber-mesh |
| bedrohung | bedrohung |
| beeren | pflanze-busch |
| beet | bau-dorf-teile |
| befehl | befehle, modul-entitaeten |
| befehle | chat |
| begehbar | kollision |
| behaelter | behaelter |
| betaeubt | character-anim-zustand |
| beute | beute, rohstoffe, welt-dinge, modul-fortschritt |
| bewegung | character-motor-tuning, character-motor, character-steering, character, klettern |
| bewohner | modul-bewohner |
| bildzeit | qualitaet |
| biome | terrain-farben, terrain-mesh, worldgen-biomes, worldgen-query |
| blaetter | astbaum |
| blatt | laub-klumpen, laub-karten |
| blick | character-anim-blick, character-parts-gesicht |
| blinzeln | character-anim-blick, character-parts-gesicht |
| blitz | grosszauber-sturm, grosszauber-sturm-ansicht, zauber-effekte |
| block | nahkampf |
| blue-noise | worldgen-scatter |
| blume | pflanze-blume, pflanze-boden, pflanze-formen |
| boden | element-reaktionen, grosszauber-wand, zauber-anzeige, boden-anpassung, gras-feld, wege-lage, worldgen-adapter |
| bodendecker | pflanze-blume, pflanze-boden, pflanze-unterwuchs, worldgen-vegetation |
| bogen | character-ausruestung, modul-kampf, riesenwald-teile |
| boids | character-gruppe |
| boss | boss, wolf |
| brennend | element-reaktionen |
| brille | character-parts-kopf, character-parts-zubehoer |
| bruecke | bau-dorf-teile, modul-dorf, wege-lage, wege-mesh, welt-plan, worldgen-wege |
| brunnen | bau-markt |
| buff | kampf, zustaende, ziel-rahmen |
| bus | ereignisse |
| busch | natur-assets, pflanze-busch, pflanze-unterwuchs |
| cache | natur-assets |
| canvas | minikarte |
| cape | character-parts-ruecken |
| charakter | character, character-anim-blick, character-anim-hang, character-anim-idle, character-anim-zustand, character-animator, character-ausruestung, character-clips-mehr, character-clips-zauber, character-clips, character-gang, character-lod, character-look, character-model, character-parts-basis, character-parts-becken, character-parts-gesicht, character-parts-haar, character-parts-hut, character-parts-kopf, character-parts-ruecken, character-parts-torso, character-parts-zubehoer, character-parts, character-pose, character-reaktion, character-rig, character-sekundaer, figur-form, figur-haar, figur-haut, figur-kleidung-basis, figur-kleidung-oben, figur-kleidung-unten, figur-kleidung, figur-koerper-kopf, figur-koerper, figur-material, oberflaeche-fenster, figur-editor |
| chat | modul-oberflaeche, chat |
| chunks | chunk-strom, worldgen-chunkfluss, worldgen-chunks |
| clip | character-animator, character-clips-mehr, character-clips-zauber, character-clips |
| controller | character-motor, character |
| crafting | rezepte, stationen |
| dach | bau-teile |
| daemmerwald | laub-klumpen, riesenbaum-form, riesenbaum-krone, riesenbaum-netz, riesenbaum, modul-riesenwald, riesenwald-plan |
| dampf | element-reaktionen, zauber-anzeige |
| dash | character-motor, character-anim-zustand |
| daten | register, faehigkeiten-daten, gegenstaende-daten, klassen-daten, nahkampf-daten, zauber-daten, baum-arten, tutorial-daten, worldgen-vegetation |
| debuff | kampf, zustaende, ziel-rahmen |
| delta | entitaeten |
| detailstufen | chunk-strom |
| deterministisch | nahkampf, welt-streu |
| dialog | modul-tutorial, tutorial-daten, figur-schild, menue |
| dithering | psx |
| dom | fake-dom, chat, figur-editor, menue, treffer-zahlen |
| dorf | bau-dorf-teile, bau-instanzen, modul-dorf, dorf-plan-kern, dorf-plan, worldgen-sites, worldgen-wege |
| dot | zustaende |
| draw-calls | character-lod |
| dreispitz | character-parts-hut |
| drop | beute |
| dunst | gauss-wolke |
| dämmerung | himmel-stand |
| editor | character-look, character-model, figur-editor, welt-aenderung |
| effekt | grosszauber-mesh, zauber-effekte, zauber-anzeige |
| eingabe | move-input, touch-stick |
| eis | zauber-anzeige |
| element | element-reaktionen, modul-zauber, zauber-anzeige, zauber-gross |
| emote | character-clips-mehr, character-clips |
| emotion | character-parts-gesicht |
| energie | modul-kampf |
| entitaet | entitaeten, gegner-lager, modul-entitaeten |
| episch | grosszauber-riss, grosszauber-sturm, grosszauber-wand, grosszauber-welle, grosszauber, grosszauber-mesh, grosszauber-riss-ansicht, grosszauber-sturm-ansicht, grosszauber-wand-ansicht, grosszauber-welle-ansicht |
| erdbeben | grosszauber-riss, grosszauber-riss-ansicht |
| erdwall | grosszauber-wand-ansicht |
| ereignis | ereignisse |
| erlenwacht | klassen-daten, modul-dorf, modul-kampf, modul-welt, dorf-plan-kern, dorf-plan, fern-wald, welt-regionen, welt-streu |
| erosion | worldgen-erosion |
| erschoepft | ausdauer |
| erstellen | figur-editor |
| erz | fundmodelle |
| esse | schmiede |
| event | ereignisse |
| export | speicher |
| fachwerk | bau-teile, haus, taverne |
| fackel | bau-licht, character-ausruestung |
| faellen | rohstoffe |
| farbe | character-parts-basis |
| farben | bau-basis, figur-editor, himmel-stand, terrain-farben |
| farn | pflanze-boden, pflanze-unterwuchs |
| fass | behaelter, bau-vorrat |
| fbm | worldgen-height |
| feder | character-sekundaer |
| felder | modul-dorf |
| fels | grosszauber-wand, klettern, fels-basis, fels-form, fels, natur-assets, naturfundus, grosszauber-wand-ansicht |
| felsen | scatter-mesh, welt-streu, worldgen-vegetation |
| fenster | bau-teile, oberflaeche-fenster, menue |
| fern | character-lod, fern-wald |
| festung | grosszauber-wand |
| feuchte | worldgen-climate |
| feuer | grosszauber-riss, grosszauber-riss-ansicht |
| feuerstelle | stationen |
| figur | follow-camera, character-motor-tuning, character-motor, character, move-input, character-anim-blick, character-anim-hang, character-anim-idle, character-anim-zustand, character-animator, character-ausruestung, character-clips-mehr, character-clips-zauber, character-clips, character-gang, character-lod, character-look, character-model, character-parts-basis, character-parts-becken, character-parts-gesicht, character-parts-haar, character-parts-hut, character-parts-kopf, character-parts-ruecken, character-parts-torso, character-parts-zubehoer, character-parts, character-pose, character-reaktion, character-rig, character-sekundaer, figur-form, figur-haar, figur-haut, figur-kleidung-basis, figur-kleidung-oben, figur-kleidung-unten, figur-kleidung, figur-koerper-kopf, figur-koerper, figur-material, modul-spieler, figur-editor, figur-schild, wege-lage, worldgen-adapter |
| first-person | follow-camera |
| fisch | naturfundus |
| flackern | licht-pool |
| flechte | riesenbaum-krone |
| fleck | zauber-anzeige |
| fluss | fluss-mesh, wasser-glanz, worldgen-chunkfluss, worldgen-rivers |
| flut | grosszauber-welle, grosszauber-welle-ansicht |
| flächenschaden | grosszauber-riss, grosszauber-sturm, grosszauber-welle, grosszauber, zauber-daten, zauber |
| folgen | follow-camera |
| form | sdf, figur-form, pflanze-formen, riesenbaum-form, worldgen-shape |
| fortschritt | aufgaben, progression, modul-fortschritt |
| fossil | fundmodelle |
| fps | schleife, qualitaet |
| frisur | character-parts-haar, character-parts-kopf, figur-haar |
| fuesse | character-anim-hang, character-gang |
| fund | fundmodelle |
| funken | zauber-effekte |
| fuss | figur-koerper |
| fähigkeit | faehigkeiten-daten, faehigkeiten, klassen-daten, zauber, modul-kampf |
| gamepad | move-input |
| gameplay | entitaeten, ereignisse, aufgaben, ausdauer, befehle, behaelter, boss, character-brain, character-gruppe, character-motor-tuning, character-motor, character-sinne, character-steering-extra, character-steering, gegner-lager, hand, horde, interaktion, inventar, klettern, koerper, rezepte, rohstoffe, stationen, tueren, welt-dinge |
| gang | character-animator, character-gang |
| gauss | riesenbaum-krone, riesenbaum, gauss-saat, gauss-sortierung, gauss-wolke, splat-look |
| gaussian | gauss-saat, gauss-sortierung, gauss-wolke, splat-look |
| gcd | faehigkeiten, kampf-leiste |
| gebaeude | bau-basis, bau-teile, haus, mauer, schmiede, taverne, tempel, wachturm, modul-dorf |
| gebirge | worldgen-height |
| gedaechtnis | character-sinne |
| gefaelle | welt-plan-formen |
| gefroren | element-reaktionen |
| gegenstand | register, beute, gegenstaende-daten, inventar, koerper, welt-dinge |
| gegner | boss, gegner-lager, horde, irrlicht, keiler, ratte, wolf, horde-mesh, modul-gegner, minikarte |
| geist | irrlicht |
| gelaende | character-anim-hang, modul-welt, boden-anpassung, chunk-strom, terrain-farben, terrain-mesh, welt-aenderung |
| gelenke | character-rig |
| generator | worldgen |
| geometrie | fels-basis, fels-form, natur-basis, pflanze-basis, totholz-form, mesh-builder, welt-plan-formen |
| geroell | fels |
| geschoss | zauber |
| gesicht | character-model, character-parts-gesicht, character-parts-kopf, figur-koerper-kopf |
| geste | character-clips-zauber |
| gewicht | character-sekundaer |
| gewitter | wetter |
| ginster | pflanze-busch |
| gischt | grosszauber-welle-ansicht |
| gitter | raum-gitter, worldgen-grid |
| glanz | wasser-glanz |
| gleiten | character-motor, character-anim-zustand |
| glut | grosszauber-riss-ansicht |
| graben | grosszauber-riss, fundmodelle, welt-aenderung |
| grading | psx |
| gras | pflanze-boden, gras-feld |
| groesse | riesenbaum |
| großzauber | grosszauber-riss, grosszauber-sturm, grosszauber-wand, grosszauber-welle, grosszauber, grosszauber-mesh, grosszauber-riss-ansicht, grosszauber-sturm-ansicht, grosszauber-wand-ansicht, grosszauber-welle-ansicht, modul-zauber, zauber-gross |
| gruppe | landschaftsgruppen |
| gürtel | character-parts-becken, figur-kleidung-unten, figur-kleidung |
| haar | character-parts-haar, character-parts-kopf, character-sekundaer, figur-haar |
| halm | pflanze-formen |
| hals | figur-koerper-kopf |
| haltbarkeit | hand |
| halten | zauber-leiste |
| haltung | kampf-werte, ziel-rahmen |
| hand | hand, figur-koerper |
| handy | touch-stick, grosszauber-sturm-ansicht, grosszauber-wand-ansicht, qualitaet, modul-kampf, modul-oberflaeche, modul-zauber, chat, figur-editor, menue, minikarte, zauber-leiste |
| hang | klettern, character-anim-hang |
| hase | hase |
| hash | rng |
| haus | haus |
| haut | figur-haut |
| heap | worldgen-grid |
| heide | pflanze-busch |
| helm | character-parts-hut, character-parts-kopf |
| herde | character-gruppe |
| herstellen | rezepte, stationen |
| hilfen | character-parts-basis |
| himmel | mond, modul-himmel, himmel-stand, himmel |
| hindernis | grosszauber-wand, kollision |
| hinweis | interaktion, hud |
| hoehe | welt-regionen, worldgen-height, worldgen-query |
| hoehenkarte | sdf-netz, riesenbaum-netz, boden-anpassung |
| hoeren | character-sinne |
| holz | wege-mesh |
| horde | gegner-lager, horde, zauber-daten, zauber, irrlicht, keiler, ratte, wolf, horde-mesh, modul-gegner |
| hose | figur-kleidung-unten, figur-kleidung |
| host | spiel |
| hot | zustaende |
| hotbar | inventar-ansicht, kampf-leiste, zauber-leiste |
| hp | figur-schild |
| hud | modul-oberflaeche, figur-schild, hud, inventar-ansicht |
| hut | character-parts-hut, character-parts-kopf |
| hydraulik | worldgen-erosion |
| hydrologie | worldgen-chunkfluss |
| id | entitaeten |
| idle | character-anim-idle, character-clips-mehr |
| ik | character-anim-hang, character-gang |
| impostor | riesenwald-teile, fern-wald |
| insel | worldgen-presets, worldgen-shape, worldgen |
| instanced | character-lod |
| instancedmesh | bau-instanzen, horde-mesh |
| instancing | hase, keiler, ratte, reh, wolf, grosszauber-wand-ansicht, horde-mesh, fern-wald |
| instanzen | laub-klumpen, bau-instanzen, natur-material, gras-feld, scatter-mesh |
| instanziert | gauss-wolke, laub-karten |
| interaktion | interaktion, tueren |
| interest | modul-gegner |
| interpolation | math, schnappschuss-puffer |
| inventar | behaelter, hand, inventar, rezepte, welt-dinge, modul-fortschritt, modul-oberflaeche, oberflaeche-fenster, inventar-ansicht |
| irrlicht | irrlicht |
| jagd | hase, reh |
| jahreszeit | zeit, baum |
| joystick | move-input, touch-stick |
| kachel | welt-streu |
| kacheln | chunk-strom, fern-wald |
| kaktus | pflanze-wueste |
| kalender | zeit |
| kamera | follow-camera, ziel-wahl, math, modul-spieler |
| kamerafahrt | follow-camera |
| kampf | klang, ziel-wahl, bedrohung, befehle, boss, character-steering-extra, character-steering, element-reaktionen, faehigkeiten-daten, faehigkeiten, grosszauber-riss, grosszauber-sturm, grosszauber-wand, grosszauber-welle, grosszauber, horde, kampf-werte, kampf, klassen-daten, nahkampf-daten, nahkampf, zauber-daten, zauber, zustaende, character-clips-mehr, character-reaktion, modul-kampf, modul-zauber, kampf-leiste, ziel-rahmen |
| kanaele | chat |
| kanal | faehigkeiten |
| kante | character-anim-zustand |
| kapuze | character-parts-hut |
| karte | oberflaeche-fenster, minikarte, welt-regionen, worldgen |
| karten | laub-klumpen, laub-karten |
| katalog | register |
| keiler | keiler |
| kern | dorf-plan-kern |
| kette | character-parts-zubehoer |
| keyframe | character-clips-mehr, character-clips-zauber, character-clips |
| ki | bedrohung, character-brain, character-gruppe, character-sinne, character-steering-extra, character-steering, horde |
| kiste | bau-vorrat |
| klang | klang |
| klasse | klassen-daten, progression, modul-kampf |
| kleidung | character-parts-becken, character-parts-torso, character-parts, figur-form, figur-kleidung-basis, figur-kleidung-oben, figur-kleidung-unten, figur-kleidung |
| klein | hase |
| klettern | ausdauer, klettern, modul-spieler |
| klima | wetter, worldgen-biomes, worldgen-climate |
| knoepfe | touch-stick |
| koerper | koerper, kollision |
| kollision | follow-camera, raum-gitter, sdf-netz, grosszauber, tueren, bau-basis, bau-instanzen, modul-riesenwald, zauber-gross, kollision, worldgen-adapter |
| kombo | nahkampf-daten, nahkampf |
| kommando | befehle |
| kopf | character-anim-blick, character-parts-haar, character-parts-hut, character-parts-kopf, figur-koerper-kopf |
| korb | character-ausruestung |
| kreatur | hase, irrlicht, keiler, ratte, reh, wolf |
| krieger | klassen-daten |
| kristall | tempel, fundmodelle |
| krit | kampf-werte |
| krone | character-parts-hut, character-parts-kopf, laub-klumpen, riesenbaum-krone, laub-karten |
| kronen | kronen-lichtkarte |
| körper | character-parts, figur-form, figur-haut, figur-koerper |
| l-system | baum-skelett |
| labor | module-register |
| ladungen | faehigkeiten |
| lager | behaelter, gegner-lager, modul-gegner |
| lagerfeuer | bau-licht, licht-pool |
| laterne | bau-licht, character-ausruestung, licht-pool |
| laub | astbaum, laub-klumpen, pflanze-unterwuchs, riesenbaum-krone, gauss-saat, gauss-wolke, laub-karten, modul-riesenwald |
| laufen | character-animator, character-gang |
| lava | grosszauber-riss, grosszauber-riss-ansicht |
| leben | entitaeten, kampf-werte, kampf, modul-entitaeten, hud |
| lebensbalken | modul-entitaeten, figur-schild, ziel-rahmen |
| lebenszyklus | modul-kern |
| leiste | faehigkeiten, modul-kampf, modul-zauber, hud, kampf-leiste, zauber-leiste |
| leistung | qualitaet |
| leucht | bau-licht, bau-instanzen |
| leuchten | irrlicht |
| licht | bau-licht, kronen-lichtkarte, licht-pool, mond, modul-dorf, himmel-stand, himmel |
| lichtstrahlen | kronen-lichtkarte |
| localStorage | speicher |
| lock-on | follow-camera, ziel-wahl, modul-spieler |
| locken | character-parts-haar, figur-haar |
| lod | character-lod, astbaum, laub-klumpen, modul-bewohner, modul-riesenwald, modul-welt, riesenwald-teile, chunk-strom, fern-wald |
| logik | pflanze-formen |
| look | character-look, figur-material, psx, splat-look, figur-editor |
| loop | schleife |
| loot | beute |
| lowpoly | bau-teile, bau-dorf-teile, haus, bau-licht, bau-markt, mauer, schmiede, taverne, tempel, bau-uebung, bau-vorrat, wachturm, bau-wegbau, character-parts, hase, irrlicht, keiler, ratte, reh, wolf, baum, fels-form, fels, natur-basis, pflanze-basis, pflanze-blume, pflanze-boden, pflanze-busch, pflanze-unterwuchs, pflanze-wueste, totholz-form, totholz, mesh-builder |
| magie | element-reaktionen, grosszauber-riss, grosszauber-sturm, grosszauber-welle, grosszauber, zauber-daten, zauber, character-clips-zauber, zauber-effekte, modul-zauber |
| magier | klassen-daten |
| maler | splat-look |
| mana | zauber, zauber-leiste |
| mantel | character-parts-becken, character-parts-torso, figur-kleidung-oben |
| marker | aufgaben-anzeige |
| markt | bau-markt |
| maske | character-pose, riesenwald-teile, worldgen-shape |
| material | gegenstaende-daten, figur-material, natur-material |
| mathe | math |
| mauer | mauer, welt-plan-formen |
| maus | move-input |
| meer | terrain-mesh, wasser-glanz |
| mehrspieler | entitaeten, raum-gitter, schnappschuss-puffer, befehle |
| meldung | hud |
| menge | character-lod |
| menue | modul-oberflaeche, oberflaeche-fenster, menue |
| merge | natur-basis, mesh-builder |
| mesh | sdf-netz, character-model, character-parts-basis, character-parts, figur-haut, mesh-builder, scatter-mesh, terrain-mesh, wege-mesh |
| migration | speicher |
| mimik | character-anim-blick, character-look, character-model, character-parts-gesicht |
| minikarte | modul-oberflaeche, minikarte |
| mischen | character-pose |
| mitreißen | grosszauber-welle |
| mittelalter | bau-dorf-teile, bau-markt, bau-vorrat, bau-wegbau |
| mmo | entitaeten, bedrohung, befehle, beute, boss, faehigkeiten-daten, faehigkeiten, gegenstaende-daten, gegner-lager, grosszauber-wand, grosszauber-welle, grosszauber, kampf-werte, kampf, klassen-daten, nahkampf-daten, nahkampf, progression, zustaende, character-lod, modul-dorf, modul-entitaeten, modul-fortschritt, modul-gegner, modul-oberflaeche, modul-welt, oberflaeche-fenster, spiel, chat, kampf-leiste, minikarte, ziel-rahmen, welt-regionen |
| mobil | grosszauber-riss-ansicht, grosszauber-welle-ansicht |
| modell | sdf-netz, sdf, character-model, hase, irrlicht, keiler, ratte, reh, wolf, mesh-builder |
| modul | modul-kern, modul-bewohner, modul-dorf, modul-entitaeten, modul-fortschritt, modul-gegner, modul-himmel, modul-kampf, modul-oberflaeche, modul-riesenwald, modul-spieler, modul-tutorial, modul-welt, modul-zauber, module-register, module, spiel |
| mond | mond, modul-himmel, himmel-stand, himmel |
| monokel | character-parts-zubehoer |
| monster | horde, horde-mesh |
| moor | irrlicht, landschaftsgruppen |
| moos | pflanze-unterwuchs, riesenbaum-netz, gauss-saat, gauss-wolke |
| motor | klettern, character-anim-zustand |
| nachbarn | raum-gitter |
| nachbearbeitung | splat-look |
| nachricht | ereignisse |
| nachschwingen | character-sekundaer |
| nacht | kronen-lichtkarte, licht-pool, mond, modul-dorf, modul-himmel, himmel-stand, himmel |
| nachwachsen | rohstoffe |
| nadeln | astbaum |
| nahkampf | nahkampf-daten, nahkampf, modul-kampf |
| namensschild | modul-bewohner, figur-schild |
| nass | element-reaktionen |
| natur | astbaum, baum-arten, baum-skelett, baum, fels-basis, fels-form, fels, landschaftsgruppen, laub-klumpen, natur-assets, natur-basis, naturfundus, pflanze-basis, pflanze-blume, pflanze-boden, pflanze-busch, pflanze-formen, pflanze-unterwuchs, pflanze-wueste, riesenbaum-form, riesenbaum-krone, riesenbaum-netz, riesenbaum, totholz-form, totholz, laub-karten, natur-material, scatter-mesh |
| nebel | modul-himmel, himmel, wetter |
| netz | entitaeten, sdf-netz, riesenbaum-netz, gauss-saat, worldgen-wege |
| netzwerk | schnappschuss-puffer |
| node | fake-dom |
| noise | noise |
| normale | worldgen-query |
| npc | character-brain, character-gruppe, character-sinne, character-steering-extra, character-steering, character, interaktion, character-anim-idle, character-animator, character-lod, character-look, character-model, modul-bewohner, modul-tutorial, figur-schild |
| oberteil | character-parts-torso, figur-kleidung-oben, figur-kleidung |
| objekte | scatter-mesh, welt-aenderung, worldgen-scatter, worldgen-vegetation |
| oeffnen | tueren |
| ohrringe | character-parts-zubehoer |
| optionen | oberflaeche-fenster, menue, worldgen-presets |
| orbit | follow-camera |
| organisch | sdf, figur-form, figur-haar, figur-haut, figur-kleidung-basis, figur-kleidung-oben, figur-kleidung-unten, figur-kleidung, figur-koerper-kopf, figur-koerper |
| ort | stationen |
| orte | minikarte, welt-regionen, worldgen-sites |
| overlay | aufgaben-anzeige, figur-schild, hud, kampf-leiste, menue, treffer-zahlen, zauber-leiste, ziel-rahmen |
| palisade | bau-dorf-teile |
| parade | nahkampf |
| parameter | baum-arten |
| partikel | niederschlag, zauber-effekte |
| patrouille | character-steering-extra, character-steering |
| pause | menue |
| performance | character-lod, qualitaet |
| persistenz | speicher |
| pfad | character-steering, welt-plan, worldgen-path, worldgen-wege |
| pfeil | aufgaben-anzeige |
| pflanze | landschaftsgruppen, naturfundus, pflanze-basis, pflanze-blume, pflanze-boden, pflanze-busch, pflanze-formen, pflanze-unterwuchs, pflanze-wueste |
| phasen | boss |
| physik | character-motor, koerper, kollision |
| pilz | pflanze-blume, pflanze-boden |
| pinch | touch-stick |
| pinsel | welt-aenderung |
| pixel | psx |
| plan | dorf-plan-kern, dorf-plan, riesenwald-plan, welt-plan-formen, welt-plan |
| plateau | welt-plan |
| platzierung | riesenwald-plan |
| plugin | modul-kern |
| poi | worldgen-sites |
| pointlight | licht-pool |
| poisson | worldgen-scatter |
| pool | licht-pool |
| pose | character-pose |
| postprocessing | splat-look |
| preset | follow-camera |
| presets | worldgen-presets |
| primitive | mesh-builder |
| priority-flood | worldgen-hydrology |
| profil | welt-plan-formen |
| protokoll | befehle, chat |
| prozedural | noise, astbaum, baum-skelett, baum, fels-form, fels, natur-assets, natur-basis, riesenbaum-form, totholz, gauss-saat, worldgen |
| pruefung | bau-pruefung, gebaeude-pruefen |
| ps1 | psx |
| psx | psx |
| puppe | bau-uebung |
| quadtree | chunk-strom |
| qualität | qualitaet |
| quaternion | gauss-saat |
| quest | aufgaben, modul-tutorial, tutorial-daten |
| radix | gauss-sortierung |
| raf | schleife |
| ragdoll | character-reaktion |
| randlicht | figur-material |
| raster | raum-gitter, inventar-ansicht |
| ratte | gegner-lager, horde, ratte, horde-mesh, modul-gegner |
| raum | entitaeten, raum-gitter |
| rauschen | noise |
| raycast | kollision |
| reaktion | element-reaktionen, character-reaktion, modul-zauber, zauber-anzeige |
| regen | niederschlag, modul-himmel, wetter, worldgen-climate |
| regionen | modul-welt, welt-regionen |
| register | register, module-register, module |
| registry | natur-assets |
| reh | reh |
| reichweite | faehigkeiten, interaktion |
| render | grosszauber-mesh, grosszauber-riss-ansicht, grosszauber-sturm-ansicht, grosszauber-wand-ansicht, grosszauber-welle-ansicht, kronen-lichtkarte, laub-karten, natur-material, gras-feld |
| render-target | kronen-lichtkarte |
| renderer | spiel |
| rendern | horde-mesh |
| replay | befehle |
| respawn | gegner-lager, modul-gegner |
| ressource | faehigkeiten, kampf-leiste |
| retro | psx |
| rezept | register, rezepte |
| riesenbaum | laub-klumpen, riesenbaum-form, riesenbaum-krone, riesenbaum-netz, riesenbaum, modul-riesenwald, boden-anpassung, riesenwald-plan |
| riesenwald | riesenwald-teile |
| rig | character-pose, character-rig |
| rim | figur-material |
| rinde | riesenbaum-netz |
| ring | grosszauber-wand |
| riss | grosszauber-riss, grosszauber-riss-ansicht, zauber-gross |
| robe | figur-kleidung-oben, figur-kleidung-unten, figur-kleidung |
| rock | character-parts-becken, figur-kleidung-basis, figur-kleidung-unten, figur-kleidung |
| rohstoff | rohstoffe |
| rolle | ausdauer, character-motor, character-anim-zustand |
| rollen | koerper |
| rosette | pflanze-formen |
| rpg | kampf-werte |
| rucksack | character-parts-ruecken, character-parts, inventar-ansicht |
| rueckgaengig | welt-aenderung |
| ruestung | gegenstaende-daten, kampf-werte |
| ruhe | character-anim-idle |
| rückstoß | horde |
| rüstung | character-parts-torso, figur-kleidung-oben |
| saat | gauss-saat |
| salto | character-anim-zustand |
| saum | figur-kleidung-basis |
| schaden | kampf-werte, kampf, modul-entitaeten, treffer-zahlen |
| schal | character-parts-zubehoer |
| schatten | kronen-lichtkarte, mond, qualitaet, modul-himmel, riesenwald-teile, himmel |
| schaum | fluss-mesh, wasser-glanz |
| schild | character-ausruestung, ziel-rahmen |
| schilf | pflanze-boden |
| schleichen | character-sinne |
| schleife | schleife, spiel |
| schluessel | behaelter, tueren |
| schmiede | schmiede |
| schmuck | character-parts-zubehoer |
| schnee | niederschlag, terrain-farben, wetter |
| schnellleiste | hand, inventar-ansicht |
| schock | element-reaktionen |
| schockwelle | zauber-effekte |
| schrank | behaelter |
| schrein | bau-dorf-teile |
| schritt | aufgaben |
| schuetteln | follow-camera |
| schuhe | character-parts, figur-kleidung-unten, figur-kleidung |
| schwarm | character-gruppe, character-steering, horde, horde-mesh |
| schwerkraft | koerper |
| schwert | character-ausruestung |
| schwimmen | ausdauer, character-motor, koerper, character-animator, character-gang |
| schürze | character-parts-becken, character-parts-torso |
| sdf | sdf-netz, sdf, figur-form, figur-haar, figur-haut, figur-kleidung-basis, figur-kleidung-oben, figur-kleidung-unten, figur-kleidung, figur-koerper-kopf, figur-koerper, riesenbaum-form, riesenbaum-netz, riesenbaum |
| see | wasser-glanz, worldgen-chunkfluss |
| seed | rng, beute, wetter |
| seen | worldgen-hydrology |
| seerose | pflanze-boden |
| sekundaer | character-sekundaer |
| seltenheit | beute, gegenstaende-daten |
| server | befehle |
| shader | figur-material, gauss-wolke, grosszauber-riss-ansicht, grosszauber-sturm-ansicht, grosszauber-welle-ansicht, laub-karten, natur-material, niederschlag, psx, splat-look, zauber-effekte, fluss-mesh, himmel, wasser-glanz |
| sicht | character-sinne |
| siedlung | modul-bewohner, modul-dorf, dorf-plan |
| skelett | character-rig, baum-skelett |
| skinning | figur-form, figur-haut, figur-kleidung-basis |
| smooth-min | sdf |
| sockel | character-ausruestung, character-rig |
| sog | grosszauber-sturm |
| sonne | modul-himmel, himmel-stand, himmel |
| sonnentupfer | kronen-lichtkarte |
| sortierung | gauss-sortierung |
| sound | klang |
| speichern | speicher, zeit, behaelter, inventar, character-look, welt-aenderung |
| spell | zauber-daten, zauber |
| spiel | modul-kern, modul-bewohner, modul-dorf, modul-entitaeten, modul-fortschritt, modul-gegner, modul-himmel, modul-kampf, modul-oberflaeche, modul-riesenwald, modul-spieler, modul-tutorial, modul-welt, modul-zauber, module-register, module, riesenwald-teile, spiel, tutorial-daten, zauber-anzeige, zauber-gross |
| spieler | character, character-animator, character-look, character-model, modul-spieler |
| spielstand | speicher, menue |
| splat | gauss-saat, gauss-sortierung, gauss-wolke, splat-look |
| splats | riesenbaum-krone, riesenbaum-netz, riesenbaum |
| spline | welt-plan-formen |
| splitscreen | psx |
| sprechblase | figur-schild |
| springen | character-animator |
| sprint | ausdauer, modul-spieler |
| sprung | character-motor |
| stamina | ausdauer |
| stamm | totholz-form, totholz |
| stapel | inventar |
| start | worldgen-sites |
| station | stationen |
| status | zustaende |
| staub | grosszauber-wand-ansicht |
| steering | character-gruppe, character-steering-extra, character-steering |
| steg | bau-dorf-teile |
| stein | fels-form, fels |
| steinkreis | bau-wegbau |
| sterne | himmel-stand, himmel |
| steuerung | move-input |
| stiefel | figur-kleidung-unten |
| stil | splat-look |
| stimmung | psx |
| strahl | kollision |
| strassen | worldgen-wege |
| strauch | pflanze-busch |
| streaming | modul-welt, chunk-strom, worldgen-chunks |
| streu | welt-streu |
| streuen | gauss-saat |
| stroemung | fluss-mesh |
| stufe | progression, modul-fortschritt, module-register |
| sturm | grosszauber-sturm, grosszauber, grosszauber-mesh, grosszauber-sturm-ansicht, zauber-gross |
| sukkulente | pflanze-wueste |
| surface-nets | sdf-netz |
| synth | klang |
| system | modul-kern |
| tabelle | zauber-daten |
| tag | kronen-lichtkarte, modul-himmel, himmel-stand, himmel |
| tagesablauf | character-brain, modul-bewohner |
| tageszeit | zeit |
| talent | progression, modul-fortschritt |
| talente | modul-oberflaeche, oberflaeche-fenster |
| tank | bedrohung |
| tasche | character-parts-becken, figur-kleidung-unten |
| tastatur | move-input |
| taverne | taverne |
| team | entitaeten |
| teilupdate | terrain-mesh |
| telegraph | boss |
| tempel | tempel |
| temperatur | worldgen-climate |
| terrain | noise, terrain-farben, terrain-mesh, welt-aenderung, welt-regionen, worldgen-chunks, worldgen-erosion, worldgen-height, worldgen-shape, worldgen |
| test | bau-pruefung, gebaeude-pruefen, fake-dom |
| testfeld | module-register, module |
| third-person | follow-camera |
| tiefe | gauss-sortierung |
| tier | hase, reh |
| toast | hud |
| tod | character-reaktion |
| tor | tueren, mauer |
| tornado | grosszauber-sturm, grosszauber-sturm-ansicht |
| totholz | totholz-form, totholz |
| touch | move-input, touch-stick, inventar-ansicht, kampf-leiste, zauber-leiste |
| training | bau-uebung |
| trank | gegenstaende-daten |
| transluzenz | laub-karten |
| transparenz | gauss-sortierung, gauss-wolke |
| treffer | character-reaktion, modul-entitaeten, treffer-zahlen |
| treffpunkt | modul-dorf |
| truhe | behaelter, inventar-ansicht |
| tuer | interaktion, tueren |
| tuning | character-motor-tuning |
| turban | character-parts-hut |
| turm | tempel |
| tutorial | aufgaben, modul-tutorial, tutorial-daten, aufgaben-anzeige, welt-plan |
| ufer | landschaftsgruppen, terrain-farben, wasser-glanz |
| uhr | zeit, modul-himmel |
| ui | modul-oberflaeche, oberflaeche-fenster, aufgaben-anzeige, chat, figur-editor, figur-schild, hud, inventar-ansicht, kampf-leiste, menue, minikarte, treffer-zahlen, zauber-leiste, ziel-rahmen |
| umfallen | character-reaktion |
| umhang | character-parts-ruecken, character-parts, character-sekundaer |
| umkreis | raum-gitter |
| undo | welt-aenderung |
| unendlich | chunk-strom, worldgen-chunkfluss, worldgen-chunks |
| unterholz | pflanze-unterwuchs |
| urwald | pflanze-unterwuchs, riesenbaum-form, riesenbaum, modul-riesenwald, riesenwald-plan |
| varianten | natur-assets |
| variation | character-anim-idle |
| vegetation | baum, natur-assets, natur-material, gras-feld, scatter-mesh, welt-streu, worldgen-vegetation |
| verdeckung | boden-anpassung |
| verfolgen | horde |
| verhalten | character-brain |
| verstecken | character-steering-extra |
| verteilung | worldgen-scatter |
| vertex-snap | psx |
| vertexfarben | fels-basis, fels, natur-basis, pflanze-basis, totholz, mesh-builder, terrain-farben |
| verzweigung | baum-skelett |
| vfx | zauber-effekte, zauber-anzeige |
| wachturm | wachturm |
| waffe | gegenstaende-daten, nahkampf-daten, nahkampf, character-ausruestung |
| wahrnehmung | character-sinne |
| wald | baum, riesenbaum, kronen-lichtkarte, modul-riesenwald, fern-wald, riesenwald-plan |
| waldläufer | klassen-daten |
| wand | grosszauber-wand, grosszauber, klettern, grosszauber-mesh, grosszauber-wand-ansicht, zauber-gross |
| wandern | character-steering |
| wasser | grosszauber-welle, grosszauber-welle-ansicht, modul-welt, fluss-mesh, terrain-mesh, wasser-glanz, worldgen-adapter, worldgen-hydrology, worldgen-rivers |
| webaudio | klang |
| wedel | pflanze-formen |
| weg | riesenwald-plan |
| wege | modul-welt, wege-lage, wege-mesh, welt-regionen, worldgen-wege |
| wegfindung | worldgen-path |
| wegpunkt | modul-tutorial |
| wegweiser | bau-wegbau |
| welle | grosszauber-welle, grosszauber, grosszauber-mesh, grosszauber-welle-ansicht, zauber-gross |
| welt | noise, rng, sdf-netz, sdf, grosszauber, kampf, welt-dinge, modul-welt, zauber-gross, boden-anpassung, chunk-strom, dorf-plan, fern-wald, fluss-mesh, gras-feld, kollision, scatter-mesh, terrain-farben, terrain-mesh, wasser-glanz, wege-lage, wege-mesh, welt-aenderung, welt-plan-formen, welt-plan, welt-regionen, welt-streu, worldgen-adapter, worldgen-biomes, worldgen-chunkfluss, worldgen-chunks, worldgen-climate, worldgen-erosion, worldgen-grid, worldgen-height, worldgen-hydrology, worldgen-path, worldgen-presets, worldgen-query, worldgen-rivers, worldgen-scatter, worldgen-shape, worldgen-sites, worldgen-vegetation, worldgen-wege, worldgen |
| werfen | welt-dinge |
| werkbank | rezepte, stationen |
| werkzeug | hand, rohstoffe, character-ausruestung |
| wetter | niederschlag, modul-himmel, himmel-stand, wetter |
| whittaker | worldgen-biomes |
| wild | hase, reh |
| wildschwein | keiler |
| wind | grosszauber-sturm, astbaum, baum, natur-basis, pflanze-basis, pflanze-boden, pflanze-busch, pflanze-unterwuchs, grosszauber-sturm-ansicht, laub-karten, natur-material, gras-feld, scatter-mesh, wetter |
| wirbel | grosszauber-sturm |
| wirkbalken | kampf-leiste |
| wirkzeit | faehigkeiten |
| wolf | boss, wolf |
| wolke | gauss-wolke |
| wolken | grosszauber-sturm-ansicht, himmel |
| worldgen | boden-anpassung, riesenwald-plan, welt-plan, worldgen-adapter, worldgen-biomes, worldgen-chunkfluss, worldgen-chunks, worldgen-climate, worldgen-erosion, worldgen-grid, worldgen-height, worldgen-hydrology, worldgen-path, worldgen-presets, worldgen-query, worldgen-rivers, worldgen-scatter, worldgen-shape, worldgen-sites, worldgen-vegetation, worldgen-wege, worldgen |
| wueste | pflanze-wueste |
| wurzel | pflanze-unterwuchs, riesenbaum-form, riesenbaum |
| wurzeln | boden-anpassung |
| wut | modul-kampf |
| xp | progression, modul-fortschritt |
| zaehlsortierung | gauss-sortierung |
| zahlen | treffer-zahlen |
| zauber | klang, element-reaktionen, grosszauber-riss, grosszauber-sturm, grosszauber-wand, grosszauber-welle, grosszauber, zauber-daten, zauber, character-clips-zauber, grosszauber-mesh, grosszauber-riss-ansicht, grosszauber-sturm-ansicht, grosszauber-wand-ansicht, grosszauber-welle-ansicht, zauber-effekte, modul-zauber, zauber-anzeige, zauber-gross, zauber-leiste |
| zauberhut | character-parts-hut |
| zaun | bau-wegbau |
| zeit | schnappschuss-puffer, zeit |
| zeitschritt | schleife |
| zelt | bau-uebung |
| ziel | ziel-wahl, aufgaben-anzeige, ziel-rahmen |
| zielen | ziel-wahl |
| zielscheibe | bau-uebung |
| zinnen | bau-teile, mauer, wachturm |
| zonen | welt-plan |
| zoom | follow-camera, touch-stick |
| zopf | character-parts-haar, figur-haar |
| zufall | rng |
| zustaendigkeit | module-register |
| zustand | element-reaktionen, zustaende |
| zustandsautomat | character-brain |
| zutaten | rezepte |
| zweige | astbaum |
| ärmel | figur-kleidung-oben |

## Module

### klang · `engine/audio/klang.js` · v1.2.0 · entwurf
Synthetische WebAudio-Geräusche (Zauber, Horden-Kampf) ohne Audiodateien; ohne AudioContext still

- `createKlang({lautstaerke=0.6, seed=1, kontext=null, maxStimmen=4, abstand=0.035}) -> {spiele(name,{staerke,tonhoehe,verzug})->bool, dauerton('laden',{staerke,tonhoehe}|null), bett('wind'|'wasser'|'feuer'|'stadt', staerke 0..1), setLautstaerke(v), stumm, entsperren(), bereit, namen, dispose()}`
- `KLAENGE`
- `BETTEN`

```js
import { createKlang } from '../../engine/audio/klang.js';
const klang = createKlang({ lautstaerke: 0.6 });
klang.spiele('wumms', { staerke: 1.5, tonhoehe: 0.8 });
klang.dauerton('laden', { staerke: 0.4, tonhoehe: 1.3 }); // jedes Bild; null = aus
```

Genutzt von: enklave, figuren · Tags: audio, klang, sound, zauber, kampf, synth, webaudio · THREE: nein

### follow-camera · `engine/camera/follow-camera.js` · v1.1.0 · entwurf
Third-Person-Orbitkamera: weiches Folgen (vertikal träger), Kollision entlang des Sichtstrahls (Boden + Hindernisse, sanftes Zurückfahren), Auto-Ausrichtung, Sprint-FOV, Zoom, Schütteln, weiches Lock-On mit Zielwechsel, Erste-Person beim Reinzoomen, Presets (nah/weit/Schulter), Kamerafahrten

- `createFollowCamera(opts) -> { kamera, yaw, pitch, distanz, erstePerson, figurAusblenden, preset, lockZiel, inFahrt, update(dt, ziel, info), drehen(dx, dy), zoomen(delta), schuetteln(staerke, dauer), blickYaw(), richtungAusStick(x, y), springeZu(ziel), lockOn(punkt|fn|null), setErstePerson(bool), setPreset(name|obj, {sofort}), fahrt({pos, blick, dauer, halten}) -> Promise, beendeFahrt(), dispose() }`
- `stickRichtung(x, y, yaw) -> {x, z}`
- `KAMERA_PRESETS`

```js
import { createFollowCamera } from '../../engine/camera/follow-camera.js';
const cam = createFollowCamera({ welt, erstePerson: true });   // welt: Adapter mit bodenHoehe (+ hindernisse)
const e = eingabe.lesen(); cam.drehen(e.kameraX, e.kameraY); cam.zoomen(e.zoom);
const r = cam.richtungAusStick(e.x, e.y);       // Kamera-relative Laufrichtung in Weltkoordinaten
cam.update(dt, motor.pos, { tempo: motor.tempo, sprintet: motor.sprintet, yaw: motor.yaw, amBoden: motor.amBoden });
cam.setPreset('schulter'); cam.fahrt({ pos: { x: 5, y: 8, z: 5 }, blick: turm, dauer: 1.5, halten: 2 });
renderer.render(szene, cam.kamera);
```

Genutzt von: daemmerwald, enklave, figuren, handwerk · Tags: kamera, third-person, first-person, orbit, folgen, zoom, figur, lock-on, schuetteln, kollision, kamerafahrt, preset · THREE: ja

### ziel-wahl · `engine/camera/ziel-wahl.js` · v1.0.0 · entwurf
Lock-On-Ziel auswählen: bestes Ziel vor der Figur (Winkel + Abstand) oder nächstes Ziel links/rechts vom aktuellen (Ziel wechseln)

- `waehleZiel(kandidaten, { von, blickYaw, aktuell, richtung, maxDistanz, maxWinkel, gewichtWinkel }) -> kandidat | null`
- `zielPos(k) -> {x, y, z} | null`

```js
import { waehleZiel } from '../../engine/camera/ziel-wahl.js';
let ziel = waehleZiel(npcs, { von: held.zustand.pos, blickYaw: cam.yaw });            // bestes Ziel vorn
ziel = waehleZiel(npcs, { von: held.zustand.pos, blickYaw: cam.yaw, aktuell: ziel, richtung: 1 }); // nächstes rechts
cam.lockOn(ziel ? () => zielPos(ziel) : null);
```

Genutzt von: enklave, figuren, handwerk · Tags: kamera, lock-on, ziel, zielen, auswahl, kampf · THREE: nein

### entitaeten · `engine/core/entitaeten.js` · v1.0.0 · entwurf
Mehrspieler-Fundament: Entitäten (Spieler, Gegner, NPCs, Dinge) mit stabilen, deterministischen IDs ('g:12'), Team, Position, Leben und Daten – räumliche Abfrage, Ereignisse, kompakter Zustand und Änderungs-Zähler für spätere Netz-Deltas

- `createEntitaeten({ereignisse,zelle,praefixe}) -> { neu({id?,art,team,pos,radius,leben,lebenMax,name,daten})->id, hole(id), entferne(id), bewege(id,x,y,z)->bool, aendere(id,felder), markiere(id), leben(id,delta,{quelle,element,krit,stoss})->echt, belebe(id,anteil), imUmkreis(x,z,r,{team,ausser,art,tote},out?)->[ent], naechster(x,z,r,filter), alle(), anzahl, takt, aenderungenSeit(takt)->{takt,geaendert,weg}, kompakt(ent), zustand(), lade(z), dispose() }`

```js
import { createEntitaeten } from '../../engine/core/entitaeten.js';
const ents = createEntitaeten({ ereignisse });               // ereignisse: core/ereignisse (optional)
const id = ents.neu({ art: 'gegner', team: 'feind', pos: { x: 3, y: 0, z: 4 }, leben: 12, name: 'Ratte' });   // 'g:1'
ents.leben(id, -5, { quelle: 's:2', element: 'feuer' });     // → ent:treffer, bei 0 → ent:tod
const nah = ents.imUmkreis(0, 0, 10, { team: 'feind' });
const delta = ents.aenderungenSeit(letzterTakt);            // { takt, geaendert:[kompakt…], weg:[id…] }
```

Genutzt von: – · Tags: entitaet, id, mehrspieler, mmo, netz, delta, leben, team, raum, gameplay · THREE: nein
Entität: { id, art: 'spieler'|'gegner'|'npc'|'ding', team: 'spieler'|'feind'|'freund', pos:{x,y,z}, radius, leben, lebenMax, lebt,
name, daten (reine Daten! werte: kampf-werte, hoehe: m für Anzeigen …), v (Änderungs-Takt) }.
IDs: Kürzel der Art + ':' + laufende Nummer (ein Zähler für alle) → gleiche Reihenfolge von neu() = gleiche IDs.
takt zählt jede Änderung (neu, bewegen, Leben, aendere, weg). Jede Entität merkt sich in v den Takt ihrer letzten Änderung.
Ereignisse: ent:neu {id} · ent:treffer {id,menge,element,quelle,pos,krit,stoss} · ent:heil {id,menge,quelle} · ent:tod {id,quelle} · ent:weg {id}

### ereignisse · `engine/core/ereignisse.js` · v1.0.0 · entwurf
Event-Bus mit Prioritäten, einmaligen Hörern, Platzhalter '*' und Warteschlange für deterministische Reihenfolge

- `createEreignisse({fehler}) -> {an(name,fn,{einmal,prio})->abmelden,einmal(name,fn),aus(name,fn),sende(name,daten)->anzahl,spaeter(name,daten),leeren()->anzahl,hoerer(name)->anzahl,dispose()}`

```js
import { createEreignisse } from '../../engine/core/ereignisse.js';
const e = createEreignisse();
const ab = e.an('treffer', (d) => console.log(d.schaden));
e.sende('treffer', { schaden: 3 });
e.spaeter('tod', { wer: 'ork' }); e.leeren();
ab();
```

Genutzt von: enklave, handwerk · Tags: ereignis, event, bus, nachricht, gameplay · THREE: nein

### math · `engine/core/math.js` · v1.0.0 · stabil
Kleine Mathe-Helfer: clamp, lerp, smoothstep, framerate-unabhängiges Dämpfen, Winkel

- `clamp(v,a,b)`
- `lerp(a,b,t)`
- `invLerp(a,b,v)`
- `remap(v,a,b,c,d)`
- `smoothstep(a,b,x)`
- `damp(a,b,lambda,dt)`
- `angleDiff(a,b)`
- `dampAngle(a,b,lambda,dt)`
- `numOr(v,ersatz)`

```js
import { damp, clamp } from '../../engine/core/math.js';
kamera.x = damp(kamera.x, ziel.x, 6, dt);
zoom = clamp(zoom, 5, 80);
```

Genutzt von: figuren · Tags: mathe, interpolation, kamera · THREE: nein

### modul-kern · `engine/core/modul-kern.js` · v1.0.0 · entwurf
Modul-System für Spiele: Module (Welt, Figur, Zauber …) mit Abhängigkeiten anmelden, in richtiger Reihenfolge starten, je Bild/festem Schritt takten, Dienste teilen, Zustand speichern und rückwärts aufräumen – an/abschaltbar per Name

- `createModulKern({ereignisse,optionen,seed,fehler}) -> {registriere(modul),starte(namen?)->Promise,api(name),hat(name),dienst(name,wert?),update(dt),fest(dt),spaet(dt),zustand(),lade(z),aktiv,reihenfolge,ereignisse,dispose()}`
- `ordneModule(module,{aus}) -> {reihenfolge,uebersprungen}`

```js
import { createModulKern } from '../../engine/core/modul-kern.js';
const kern = createModulKern({ optionen: { gegner: { anzahl: 20 } } });
kern.registriere({ name: 'welt', start: () => ({ bodenHoehe: () => 0 }) });
kern.registriere({ name: 'gegner', braucht: ['welt'], start: (ctx) => { const w = ctx.braucht('welt'); return { anzahl: ctx.optionen.anzahl }; }, update(dt) {} });
await kern.starte();               // welt → gegner
kern.update(1 / 60);
```

Genutzt von: – · Tags: modul, plugin, system, abhaengigkeit, lebenszyklus, spiel, baukasten · THREE: nein

### noise · `engine/core/noise.js` · v1.0.0 · stabil
Seedbares Simplex-Rauschen 2D/3D plus fBm, Grat-Rauschen und Domain-Warp für Terrain, Biome und Texturen

- `createNoise2D(seed) -> (x,y)=>[-1,1]`
- `createNoise3D(seed) -> (x,y,z)=>[-1,1]`
- `fbm2(n2,x,y,okt,lac,gain)`
- `fbm(n3,x,y,z,okt,lac,gain)`
- `ridged2(n2,x,y,okt) -> [0,1]`
- `ridged(n3,x,y,z,okt) -> [0,1]`
- `warp2(n2,x,y,staerke,frequenz) -> [x,y]`

```js
import { createNoise2D, fbm2 } from '../../engine/core/noise.js';
const n = createNoise2D(42);
const hoehe = fbm2(n, x * 0.01, y * 0.01, 5);
```

Genutzt von: daemmerwald, erde, figuren · Tags: rauschen, noise, terrain, welt, prozedural · THREE: nein

### raum-gitter · `engine/core/raum-gitter.js` · v1.0.0 · entwurf
Räumliches Raster (Spatial Hash in x/z) für bewegliche Dinge: Einträge mit id setzen/verschieben/entfernen und schnell alle im Umkreis finden – Grundlage für Kollision, Interaktion, Sinne und Sichtbereiche (Mehrspieler)

- `createRaumGitter({zelle}) -> {setze(id,x,z,radius?,daten?),entferne(id),hat(id),hole(id),imUmkreis(x,z,radius,fn),sammle(x,z,radius,out?),naechster(x,z,radius,filter?),alle(fn),anzahl,leeren(),dispose()}`

```js
import { createRaumGitter } from '../../engine/core/raum-gitter.js';
const gitter = createRaumGitter({ zelle: 4 });
gitter.setze('kiste-1', 10, 5, 0.5, { art: 'kiste' });      // nochmal setze(...) = verschieben
gitter.imUmkreis(9, 5, 2, (e, abstand) => console.log(e.id, abstand));
const nah = gitter.naechster(9, 5, 3, (e) => e.daten.art === 'kiste');
```

Genutzt von: – · Tags: raum, gitter, raster, nachbarn, umkreis, kollision, abfrage, mehrspieler · THREE: nein
Ein Eintrag liegt im Fach seines Mittelpunkts. Abfragen zählen den Eintrags-Radius mit: ein Eintrag gilt als „im Umkreis“,
wenn sein Rand den Suchkreis berührt (Abstand der Mittelpunkte ≤ radius + eintrag.radius). Der gemeldete Abstand ist der
Abstand zum RAND des Eintrags (≥ 0). Die Reihenfolge der Treffer hängt nur von der Reihenfolge der Aufrufe ab (deterministisch).

### register · `engine/core/register.js` · v1.0.0 · entwurf
Datenkatalog für Gegenstände, Rezepte usw. mit stabilen Nummern und eingefrorenen Einträgen

- `createRegister({art,standard}) -> {definiere(id,daten,{ersetzen}),definiereAlle({id:daten}),hole(id),brauche(id),hat(id),nummer(id),idVon(nummer),alle(),filter(fn),mitTag(tag),anzahl,dispose()}`

```js
import { createRegister } from '../../engine/core/register.js';
const items = createRegister({ art: 'gegenstand', standard: { stapel: 99 } });
items.definiere('holz', { name: 'Holz', tags: ['material'] });
items.brauche('holz').name; items.nummer('holz'); items.mitTag('material');
```

Genutzt von: enklave, handwerk · Tags: daten, katalog, gegenstand, rezept, register · THREE: nein

### rng · `engine/core/rng.js` · v1.0.0 · stabil
Deterministischer Zufall (mulberry32), Seeds aus Text, Gitter-Hash und Würfel-Helfer

- `rng(seed) -> ()=>number`
- `hashSeed(...teile) -> int`
- `hash2(x,y,seed) -> [0,1)`
- `hash3(x,y,z,seed) -> [0,1)`
- `range(r,a,b)`
- `int(r,a,b)`
- `pick(r,arr)`
- `chance(r,p)`
- `shuffle(r,arr)`
- `weighted(r,[[wert,gewicht]])`

```js
import { rng, hashSeed, pick } from '../../engine/core/rng.js';
const r = rng(hashSeed('insel', 42));
const baum = pick(r, ['eiche', 'tanne']);
```

Genutzt von: daemmerwald, enklave, erde, figuren, gigantwelt, handwerk, natur, naturstimmungen · Tags: zufall, seed, hash, welt · THREE: nein

### schleife · `engine/core/schleife.js` · v1.0.0 · entwurf
Spielschleife mit variablem oder festem Zeitschritt, dt-Begrenzung, FPS-Anzeige und Tab-Pause

- `createSchleife({update(dt,zeit),render(alpha,dt),fest,maxDt,maxSchritte,pausiereVersteckt,raf,caf,jetzt,fehler}) -> {start(),stop(),tick(jetztMs),laeuft,fps,zeit,dispose()}`

```js
import { createSchleife } from '../../engine/core/schleife.js';
const loop = createSchleife({ update: (dt) => welt.step(dt), render: () => renderer.render(szene, kamera), fest: 1 / 60 });
loop.start();
```

Genutzt von: daemmerwald, enklave, handwerk · Tags: schleife, loop, zeitschritt, raf, fps · THREE: nein

### schnappschuss-puffer · `engine/core/schnappschuss-puffer.js` · v1.0.0 · entwurf
Mehrspieler-Grundlage: speichert verspätete Zustände fremder Figuren mit Zeitstempel und liefert weich interpolierte Zustände (leicht in der Vergangenheit)

- `createSchnappschussPuffer({verzoegerung=0.1, maxExtrapolation=0.25, groesse=32, winkel=['yaw'], sprungDistanz=8}) -> { schiebe(zeit,zustand), lese(zeit,out={}) -> out|null, anzahl, neueste, leeren(), dispose() }`

```js
import { createSchnappschussPuffer } from '../../engine/core/schnappschuss-puffer.js';
const puffer = createSchnappschussPuffer({ verzoegerung: 0.1 });
puffer.schiebe(netzZeit, { x, y, z, yaw, clip: 'winken' });   // je Paket
const z = puffer.lese(jetzt, zielObjekt);                      // je Bild, ohne Allokation
```

Genutzt von: – · Tags: netzwerk, mehrspieler, interpolation, zeit · THREE: nein

### sdf-netz · `engine/core/sdf-netz.js` · v1.0.1 · entwurf
Macht aus einem Abstandsfeld (sdf.js) ein Dreiecksnetz (Surface Nets, glatte Normalen) und eine begehbare Höhenkarte

- `sdfNetz(sdf, { zelle = 0.5, grenzen, maxZellen = 3e6, block = 4 }) -> { position, normal, index, dreiecke, zelle }`
- `sdfHoehenkarte(sdf, { zelle = 0.5, grenzen, maxHoehe = 6, kopf = 2.2 }) -> { x0, z0, zelle, breite, tiefe, hoehe: Float32Array ‹NaN = nichts›, hoeheBei(x, z) }`

```js
import { createSdf } from '../../engine/core/sdf.js';
import { sdfNetz, sdfHoehenkarte } from '../../engine/core/sdf-netz.js';
const sdf = createSdf(); sdf.kugel([0, 1, 0], 2);
const netz = sdfNetz(sdf, { zelle: 0.25 });             // → BufferGeometry: position, normal, index
const karte = sdfHoehenkarte(sdf, { zelle: 0.5 });      // karte.hoeheBei(0, 0) ≈ 3
```

Genutzt von: – · Tags: sdf, netz, mesh, surface-nets, hoehenkarte, kollision, welt, modell · THREE: nein

### sdf · `engine/core/sdf.js` · v1.0.0 · entwurf
Abstandsfelder (SDF) aus Kapseln, Kugeln, Ellipsoiden und Ketten, weich vereinigt (smooth-min) – formt organische Körper wie Wurzeln und Stämme

- `createSdf({ glatt }) -> { kapsel(a,b,ra,rb?,glatt?), kugel(m,r,glatt?), ellipsoid(m,radien,glatt?), kette(punkte,radien,{glatt,streckY}?), abzugKugel(m,r,glatt?), stoerung(fn,maxBetrag?), abstand(x,y,z) -> m, normale(x,y,z,out,eps?) -> out, grenzen() -> {min,max}, eingrenzen(min,max,rand?) -> anzahl, anzahl, spiel }`

```js
import { createSdf } from '../../engine/core/sdf.js';
const sdf = createSdf({ glatt: 0.8 });
sdf.kapsel([0, 0, 0], [0, 10, 0], 2, 1.5);            // Stamm
sdf.kette([[1, 2, 0], [5, 0.5, 1], [9, -0.5, 0]], [1, 0.6, 0.3]);   // Wurzel, in sich hart, zum Rest weich
const d = sdf.abstand(3, 1, 0);                        // < 0 = innen
```

Genutzt von: – · Tags: sdf, abstandsfeld, form, organisch, smooth-min, welt, modell · THREE: nein

### speicher · `engine/core/speicher.js` · v1.0.0 · entwurf
Spielstände sicher speichern/laden (localStorage mit Arbeitsspeicher-Fallback), Versionen, Migration, Autospeichern, Export/Import als Text, TypedArrays

- `createSpeicher({schluessel,version,migriere,storage,jetzt}) -> {speichere(slot,daten), lade(slot), hat(slot), loesche(slot), slots(), exportText(slot), importText(slot,text), auto(slot,holeDaten,sekunden), update(dt), jetztSpeichern(), fluechtig, dispose()}`
- `packe(typedArray) -> {$ta,b64}`
- `entpacke(obj) -> TypedArray`

```js
import { createSpeicher } from '../../engine/core/speicher.js';
const sp = createSpeicher({ schluessel: 'meinspiel', version: 2 });
sp.speichere('slot1', { punkte: 12, karte: new Uint8Array(64) });
const stand = sp.lade('slot1');          // null, wenn nichts da
sp.auto('auto', () => ({ punkte }), 30); // dann pro Frame: sp.update(dt)
```

Genutzt von: enklave, erlenwacht, handwerk · Tags: speichern, spielstand, localStorage, autosave, export, migration, persistenz · THREE: nein

### zeit · `engine/core/zeit.js` · v1.0.0 · entwurf
Spieluhr: Tageszeit, Tage, Jahreszeiten und Jahre mit Ereignissen, Pause, Tempo und Speicherstand

- `createSpielzeit({stunde,tag,sekundenProStunde,tageProJahreszeit,tempo}) -> {stunde,tag,jahr,jahreszeit,jahreszeitName,jahresAnteil,istNacht,tempo,pause,update(dt),vor(h),setze({stunde,tag}),on(name,fn),uhrText(),zustand(),lade(z),dispose()}`
- `JAHRESZEITEN`

```js
import { createSpielzeit } from '../../engine/core/zeit.js';
const uhr = createSpielzeit({ stunde: 8, sekundenProStunde: 30 });
uhr.on('tag', (tag) => console.log('Neuer Tag', tag));
uhr.update(dt); // je Bild, dt in echten Sekunden
```

Genutzt von: daemmerwald, enklave, erde, handwerk · Tags: zeit, tageszeit, jahreszeit, kalender, uhr, speichern · THREE: nein

### aufgaben · `engine/gameplay/aufgaben.js` · v1.1.0 · entwurf
Aufgaben-/Tutorial-Logik: Schritte (gehe-zu, sprich-mit, sammle, besiege, benutze, warte), Fortschritt, Signale, Speicherstand; reine Daten, serialisierbar

- `createAufgaben({daten, ereignisse, zaehle, ortVon, punktVon}) -> { starte(id)->bool, status(id), aktiv(), fertig(id), melde(art, info)->n, update(dt, wer)->ereignisse[], aktuell(id?), springe(id, schritt), brichAb(id), zustand(), laden(z), onAenderung(fn)->abmelden, dispose() }`
- `pruefeDaten(daten) -> [fehlerText]`

```js
import { createAufgaben } from '../../engine/gameplay/aufgaben.js';
const a = createAufgaben({ daten: TUTORIAL, ereignisse, zaehle: (id) => inventar.anzahl(id), ortVon: (n) => plan.platz(n) });
a.starte('tutorial');
a.melde('gesprochen', { mit: 'mentor' });   // 'gesammelt' {id,anzahl} · 'besiegt' {art,anzahl} · 'benutzt' {was,anzahl}
a.update(dt, { x: spieler.x, z: spieler.z }); // gehe-zu, warte, sammle (über zaehle)
anzeige.setze(a.aktuell());
```

Genutzt von: enklave, erde · Tags: aufgabe, tutorial, quest, schritt, fortschritt, gameplay · THREE: nein

### ausdauer · `engine/gameplay/ausdauer.js` · v1.0.0 · entwurf
Ausdauer für Sprint, Rolle/Dash, Schwimmen, Klettern, Springen: Kosten-Tabelle als Daten, Erholung nach Verzögerung, Erschöpft-Zustand (gesperrte Aktionen bis zur Schwelle)

- `createAusdauer({max,erholung,verzoegerung,erschoepftBis,kosten}) -> {wert,max,anteil,voll,leer,erschoepft,kosten,kann(aktion),zahle(aktion,faktor?)->bool,verbrauche(aktion,dt,faktor?)->bool,update(dt),setze(w),reset(),zustand(),lade(z),dispose()}`
- `AUSDAUER_KOSTEN`

```js
import { createAusdauer } from '../../engine/gameplay/ausdauer.js';
const ausdauer = createAusdauer({ max: 100 });
absicht.sprint = absicht.sprint && ausdauer.kann('sprint') && ausdauer.verbrauche('sprint', dt);
if (gedrueckt('rollen') && !ausdauer.zahle('rollen')) absicht.rollen = false;
ausdauer.update(dt);              // Erholung (nach Verzögerung seit dem letzten Verbrauch)
```

Genutzt von: – · Tags: ausdauer, stamina, sprint, klettern, schwimmen, rolle, erschoepft, gameplay · THREE: nein

### bedrohung · `engine/gameplay/bedrohung.js` · v1.0.0 · entwurf
Klassische Aggro-Tabelle: Bedrohung je Gegner und Quelle, Zielwechsel erst bei 110 %, Spott, Heilungs-Bedrohung

- `createBedrohung({verfall,wechsel}) -> {add(gegner,quelle,menge),heilung(quelle,menge,gegnerListe),spott(gegner,quelle,dauer),ziel(gegner)->quelleId|null,liste(gegner)->[{id,wert}],entferne(id),leere(gegner),update(dt),zustand(),laden(z),dispose()}`

```js
import { createBedrohung } from '../../engine/gameplay/bedrohung.js';
const b = createBedrohung();
b.add('ork', 'tank', 100); b.add('ork', 'magier', 105);
b.ziel('ork'); // 'tank' – Magier braucht > 110
b.spott('ork', 'tank', 3);
```

Genutzt von: – · Tags: aggro, bedrohung, tank, kampf, ki, mmo · THREE: nein

### befehle · `engine/gameplay/befehle.js` · v1.0.0 · entwurf
Befehls-Schicht „Wer will was“: Befehle ({von, art, daten}) in eine Warteschlange, je Art Prüfer (lebt, Reichweite, Abklingzeit) + Ausführer, fester Takt, Protokoll zum Nachspielen – gleiche Befehle → gleiches Ergebnis (Server-tauglich)

- `createBefehle({entitaeten,ereignisse,seed,takt,protokollMax,arten}) -> { sende({von,art,daten})->nr, fuehre({von,art,daten})->ergebnis, registriere(art,def), update(dt)->ergebnisse, schritt()->ergebnisse, nachspielen(protokoll)->ergebnisse[], bereit(von,art,schluessel?)->s, protokoll, takt, zeit, wartend, zustand(), lade(z), dispose() }`
- `STANDARD_BEFEHLE`

```js
import { createBefehle } from '../../engine/gameplay/befehle.js';
const befehle = createBefehle({ entitaeten: ents, seed: 7 });            // ents: core/entitaeten
befehle.sende({ von: 's:1', art: 'schaden', daten: { ziel: 'g:2', menge: 10, element: 'feuer', reichweite: 20 } });
for (const e of befehle.update(dt)) if (!e.ok) console.log(e.grund);     // fester Takt (Standard 1/20 s)
const sofort = befehle.fuehre({ von: 's:1', art: 'heilen', daten: { ziel: 's:1', menge: 5 } });   // gleich ausführen (auch protokolliert)
```

Genutzt von: – · Tags: befehl, kommando, absicht, mehrspieler, mmo, server, protokoll, replay, kampf, gameplay · THREE: nein
Art-Definition: { reichweite (m, Rand zu Rand; null = egal), abklingzeit (s je von+art+daten.faehigkeit), vonLebt (true), zielLebt (true),
pruefe(b, ctx) -> true | 'grund' (zusätzlich), fuehreAus(b, ctx) -> ergebnis-Objekt }. ctx = { ents, von, ziel, zufall, zeit, takt, ereignisse }.
daten.reichweite / daten.abklingzeit dürfen die Art-Werte überschreiben (z. B. je Zauber). von darf auch keine Entität sein ('welt').
Ergebnis: { nr, takt, von, art, ok, grund?, …vom Ausführer }. Protokoll: [{ t (Takt), von, art, daten }] in Ausführungs-Reihenfolge.

### behaelter · `engine/gameplay/behaelter.js` · v1.0.0 · entwurf
Behälter in der Welt (Truhe, Fass, Schrank): eigenes Inventar, öffnen/schließen je Figur, Schloss mit Schlüssel, Ablegen/Entnehmen, Speichern

- `createBehaelter({register,interaktion,ereignisse,reichweite,plaetze}) -> {neu(id,{pos,plaetze,name,inhalt,radius,schluessel,daten})->behaelter,entferne(id)->[{id,anzahl,daten}],hole(id),alle(),anzahl,oeffne(id,wer)->{ok,grund},schliesse(wer)->bool,offen(wer)->behaelter|null,pruefe(wer)->behaelter|null,lege(wer,platz,anzahl?)->bewegt,nimm(wer,platz,anzahl?)->bewegt,nimmAlles(wer)->bewegt,zustand(),lade(stand),dispose()}`

```js
import { createBehaelter } from '../../engine/gameplay/behaelter.js';
const kisten = createBehaelter({ register: gegenstaende, interaktion, ereignisse });
kisten.neu('truhe-1', { pos: { x: 4, z: 7 }, inhalt: [{ id: 'gold', anzahl: 5 }], schluessel: 'schluessel' });
// E-Taste löst über die Interaktion oeffne() aus; je Bild: kisten.pruefe(spieler);
kisten.nimmAlles(spieler); kisten.schliesse(spieler);
```

Genutzt von: handwerk · Tags: behaelter, truhe, fass, schrank, lager, schluessel, inventar, gameplay, speichern · THREE: nein
behaelter = { id, name, pos, radius, inventar, schluessel, verschlossen, offenFuer (wer | null), daten }.
wer = dasselbe Objekt wie bei der Interaktion: { x, y?, z, inventar, … }. Eine Figur hat höchstens einen Behälter offen
(ein neues oeffne schließt den alten); ein Behälter ist nur für eine Figur offen (sonst grund 'besetzt').
grund: null | 'unbekannt' | 'verschlossen' | 'besetzt' | 'weit' ('weit' nur geprüft, wenn wer.x/wer.z endlich sind).
Schloss: Hat wer den `schluessel` (Gegenstand-id) im Inventar, wird dauerhaft aufgeschlossen; der Schlüssel bleibt erhalten.
Mit `interaktion`: je Behälter ein Ziel 'behaelter:<id>' (art 'behaelter', text '<name> öffnen').
Ereignisse: 'behaelter:offen' | 'behaelter:zu' | 'behaelter:verschlossen' { behaelter, wer }.
Speicherformat zustand(): { [id]: { inv: inventar.zustand(), zu: bool } } (zu = noch verschlossen). lade() nimmt nur dieses Format,
ignoriert unbekannte ids und lässt offene Behälter offen.

### beute · `engine/gameplay/beute.js` · v1.0.0 · entwurf
Beute-Tabellen (ratte … boss, kiste), gewichtet per Seed: Material, Tränke, Gold und Ausrüstung mit Seltenheit, Stufe, Werten und Affixen; Namen wie "Scharfes Wolfszahn-Schwert"; Beschreibung für die Oberfläche

- `BEUTE_TABELLEN`
- `wuerfle(tabelle, {seed|zufall, stufe}) -> [{id,anzahl,daten?}]`
- `erzeugeAusruestung(id, {zufall, stufe, seltenheit, stamm}) -> daten`
- `beschreibe(id, daten) -> {name, zeilen, farbe}`
- `seltenheitFarbe(s)`
- `ausruestungsName(id, daten)`

```js
import { wuerfle, beschreibe } from '../../engine/gameplay/beute.js';
const drops = wuerfle('wolf', { seed: 42, stufe: 4 });   // [{ id:'wolfszahn', anzahl:1 }, { id:'gold', anzahl:7 }, …]
beschreibe('schwert', drops.find((d) => d.daten)?.daten);
```

Genutzt von: – · Tags: beute, drop, loot, seltenheit, affix, gegenstand, seed, mmo · THREE: nein
Gleicher Seed + Tabelle + Stufe = gleiche Beute. Boss: immer mindestens 1 Teil Episch+ (Legendär 25 %).
daten = { stufe, seltenheit, werte:{…}, affixe:[{id,wert,betrag}], stamm? }. Werte wachsen mit Stufe (+18 %/Stufe) und Seltenheit.

### boss · `engine/gameplay/boss.js` · v1.0.0 · entwurf
Boss-Ablauf ohne THREE: Phasen (100–60 % normal, 60–30 % Heulen ruft Verstärkung, <30 % rasend), telegrafierte Angriffe (Sprung-Schlag mit Boden-Ring 1.2 s vorher, Prankenhieb-Kegel), Leine zum Ort, Rücksetzen + Heilen wenn das Ziel flieht; Schaden als Befehle (gameplay/befehle)

- `createBoss({ wesen, ents, befehle, sende, ruf, boden, x, z, id, name, schaden, leine, tempo }) -> { id, name, phase, modus, aktiv, entId, fest(dt, ziel|null), dispose() }`
- `BOSS`

```js
import { createBoss } from '../../engine/gameplay/boss.js';
const boss = createBoss({ wesen: alphaWesen, ents, befehle, x, z, boden: (x, z) => welt.bodenHoehe(x, z),
sende: (name, d) => bus.sende(name, d), ruf: (art, n, x, z) => lager.ruf(art, n, x, z) });
boss.fest(1 / 60, ents.hole(lager.zielId));        // ziel = Spieler-Entität im Kampf (sonst null)
```

Genutzt von: – · Tags: boss, gegner, phasen, telegraph, kampf, wolf, gameplay, mmo · THREE: nein
wesen = Horde-Wesen (gameplay/horde) mit wesen.entId; der Boss setzt wesen.fremd = true und steuert x/z/y/yaw/hub/phase/ton selbst.
sende('gegner:warnung', {pos,radius,dauer}) vor dem Sprung · sende('gegner:boss', {id,phase,name}): phase 0/1/2 beim Kampfbeginn bzw. Phasenwechsel, −1 bei Rücksetzen.
ruf(art, anzahl, x, z): Verstärkung (Heulen, einmal bei Phase 1). Schaden an Spieler-Entitäten (Team 'spieler') über befehle.sende.

### character-brain · `engine/gameplay/character-brain.js` · v1.0.0 · entwurf
NPC-Verhaltensplaner (Zustandsautomat) über Steering + Sinne: idle, wandern, patrouille, arbeiten, folgen, fliehen, angreifen, suchen, plaudern; Tagesablauf nach Stunde; liefert Absicht + Aktions-Clip

- `createBrain({seed,welt,heimat,steering,sinne,grund,plan,reaktion,verhalten,feinde}) -> {zustand,aktion,aktionNeu,pos,absicht,steering,sinne,setze(name,daten),zurueck(),plaudereMit(anderes,dauer?),update(dt,motorZustand,{ziele,nachbarn,stunde,npcs})->{absicht,aktion,aktionNeu,zustand},dispose()}`
- `BRAIN_VERHALTEN`
- `planEintrag(plan,stunde)`

```js
import { createBrain } from '../../engine/gameplay/character-brain.js';
const hirn = createBrain({ seed: 3, welt, heimat: { x: 0, z: 0 },
plan: [{ von: 8, bis: 17, zustand: 'arbeiten', ort: { x: 4, z: 2 }, clip: 'hacken' }, { von: 17, bis: 8, zustand: 'wandern', radius: 5 }],
reaktion: { feind: 'fliehen' } });
const r = hirn.update(dt, motor.zustand, { ziele: [{ id: 'wolf', x, z, feind: true }], stunde: 9.5 });
motor.update(dt, r.absicht); if (r.aktionNeu && r.aktion) animator.spiele(r.aktion);
```

Genutzt von: – · Tags: npc, ki, verhalten, zustandsautomat, tagesablauf, gameplay · THREE: nein
Zustände + Daten für setze()/plan/grund: idle {} · wandern {radius, heimat} · patrouille {punkte, art, warten} ·
arbeiten {ort:{x,z}, clip, blickYaw} · folgen {ziel: id | ()=>{x,z}, abstand} · fliehen {ziel} · angreifen {ziel} ·
suchen {x, z} · plaudern {partner: ()=>{x,z}, dauer}.
reaktion: { feind: 'fliehen'|'angreifen'|'ignorieren', geraeusch: 'suchen'|'ignorieren' }. Feind = Ziel mit feind:true oder id in feinde.

### character-gruppe · `engine/gameplay/character-gruppe.js` · v1.0.0 · entwurf
Schwarm-/Herdenverhalten für NPCs (Boids in x/z): Separation, Kohäsion, Ausrichtung – liefert eine Zusatzkraft für die Absicht

- `createGruppe({sichtRadius,trennRadius,separation,kohaesion,ausrichtung,maxKraft}) -> {kraft(selbst,nachbarn,out?)->{x,z},setGewichte(teil),gewichte,dispose()}`
- `schwarmKraft(selbst,nachbarn,opts,out?) -> {x,z}`
- `GRUPPE_STANDARD`

```js
import { createGruppe } from '../../engine/gameplay/character-gruppe.js';
const herde = createGruppe({ kohaesion: 1 });
const k = herde.kraft({ x, z, vx, vz }, nachbarn); // nachbarn: [{ x, z, vx?, vz?, radius? }]
absicht.x += k.x; absicht.z += k.z;
```

Genutzt von: – · Tags: npc, ki, schwarm, herde, boids, steering, gameplay · THREE: nein

### character-motor-tuning · `engine/gameplay/character-motor-tuning.js` · v1.1.0 · entwurf
Standard-Tuning des Figuren-Motors (Tempo, Sprung, Rolle/Dash, Gleiten, Tauchen, Kantenschutz) – reine Daten

- `MOTOR_TUNING`

```js
import { MOTOR_TUNING } from '../../engine/gameplay/character-motor-tuning.js';
const motor = createMotor({ welt, tuning: { ...MOTOR_TUNING, doppelSprung: 1 } });
```

Genutzt von: – · Tags: figur, bewegung, tuning, gameplay · THREE: nein

### character-motor · `engine/gameplay/character-motor.js` · v1.3.0 · entwurf
Kinematischer Figuren-Controller ohne THREE: Beschleunigung, Coyote-Time, Jump-Buffer, variable Sprunghöhe, Doppelsprung, Rolle/Dash, Gleiten, Tauchen, Kantenschutz, Stufen, Hang-Rutschen, Hindernisse, Schwimmen, Stöße

- `createMotor({welt,pos,yaw,radius,hoehe,tuning,kantenSchutz,kollisionsId}) -> {zustand,tuning,radius,hoehe,kollisionsId,update(dt,absicht),teleport(pos,yaw?),stoss(x,y,z,{betaeubung}?),setTuning(teil),springeJetzt(),rolleJetzt(richtung?),speichern(),laden(stand),dispose()}`
- `MOTOR_TUNING`

```js
import { createMotor } from '../../engine/gameplay/character-motor.js';
const motor = createMotor({ welt: { bodenHoehe: (x, z) => 0 }, pos: { x: 0, y: 0, z: 0 }, tuning: { doppelSprung: 1 } });
motor.update(dt, { x: 0, z: 1, sprint: false, springen: false, ducken: false, rollen: false, gleiten: false });
figur.position.set(motor.zustand.pos.x, motor.zustand.pos.y, motor.zustand.pos.z);
```

Genutzt von: – · Tags: figur, bewegung, physik, controller, sprung, schwimmen, rolle, dash, gleiten, gameplay · THREE: nein
Absicht (alle Felder optional): { x, z, sprint, springen (gehalten), ducken, blickYaw,
rollen (gehalten; Flanke = Ausweichrolle am Boden / Dash in der Luft), gleiten (gehalten, langsames Fallen),
tauchen (gehalten, im Wasser abtauchen), schleichen (= ducken), kantenSchutz (wie Tuning, nur diesen Frame) }
Zusätzliche Zustandsfelder (1.1.0): rollt, dash, rollAnteil (0…1 Fortschritt), abklingzeit (s bis Rolle/Dash wieder geht),
gleitet, doppelSprung (true im Frame des Luftsprungs), sprungZahl (Sprünge seit Bodenkontakt), taucht, tauchTiefe (m),
schleicht, anKante (Kantenschutz hat gebremst), betaeubt (Rest-s nach Stoß), getroffen (true im ersten Frame nach stoss()).
Seit 1.2.0: welt.bodenHoehe(x, z, fussY) und welt.hindernisse(x, z, radius, { y, hoehe, ausser: kollisionsId }) bekommen Hinweise
(alte Adapter ignorieren sie) → mit engine/world/kollision.js auf Kisten steigen, über Niedriges springen, eigener Körper zählt nicht.
Schnelle Bewegung (Dash, Stoß) wird feiner unterteilt, damit nichts durch dünne Stämme tunnelt. speichern()/laden() = ganzer Zustand.
Seit 1.3.0: absicht.klettern = { x, y, z (m/s), haften (am Gelände kleben), blickYaw } → Kletter-Modus ohne Schwerkraft
(Steuerung: engine/gameplay/klettern.js); Zustand klettert = true. Ohne absicht.klettern läuft alles wie bisher.

### character-sinne · `engine/gameplay/character-sinne.js` · v1.0.0 · entwurf
NPC-Wahrnehmung ohne THREE: Sichtkegel (Winkel, Reichweite, Rundum-Nahbereich), Hören (Radius × Lautstärke), Sichtlinie über welt.bodenHoehe, Gedächtnis mit Verdacht und Vergessen

- `createSinne({welt,sichtWeite,sichtWinkelGrad,nahRadius,hoerRadius,augenHoehe,zielHoehe,vergessenNach,entdeckZeit,sichtlinie}) -> {update(dt,selbst,ziele)->{gesehen,gehoert},siehtPunkt(selbst,p,faktor?),hoertPunkt(pos,quelle,laut?),sichtFrei(von,nach),geraeusch(x,z,laut?,id?),erinnerung(id),bekannte(),naechste(filter?),vergiss(id?),einstellungen,dispose()}`
- `imSichtkegel(pos,yaw,p,weite,winkelRad,nahRadius) -> bool`

```js
import { createSinne } from '../../engine/gameplay/character-sinne.js';
const sinne = createSinne({ welt, sichtWeite: 12, sichtWinkelGrad: 110, entdeckZeit: 0.8 });
sinne.update(dt, motor.zustand, [{ id: 'spieler', x, y, z, laut: spielerRennt ? 1 : 0, versteckt: duckt ? 0.5 : 0 }]);
const e = sinne.erinnerung('spieler'); if (e?.entdeckt) hirn.gehZu(e.x, e.z);
```

Genutzt von: – · Tags: npc, ki, wahrnehmung, sicht, hoeren, gedaechtnis, schleichen, gameplay · THREE: nein
selbst = Motor-Zustand ({ pos: {x,y,z}, yaw }) oder { x, y, z, yaw }.
Ziel = { id, x, y?, z, laut? (0…1, × hoerRadius), versteckt? (0…1, verkürzt die Sichtweite bis zur Hälfte), feind? … (wird durchgereicht) }.
Erinnerung = { id, x, y, z, alter (s seit letzter Wahrnehmung), art ('gesehen'|'gehoert'), sichtbar, verdacht (0…1), entdeckt, ziel }.

### character-steering-extra · `engine/gameplay/character-steering-extra.js` · v1.0.0 · entwurf
Reine Steering-Rechnungen: Patrouillen-Fortschritt (Schleife/Pingpong/einmal), Umkreisen, Abstand halten, Versteckpunkt hinter Deckung

- `patrouilleWeiter(anzahl,index,richtung,art) -> {index,richtung,fertig}`
- `umkreisRichtung(pos,mitte,radius,drehsinn,out?) -> {x,z,dist}`
- `abstandRichtung(pos,ziel,min,max,out?) -> {x,z,dist,stark}`
- `versteckPunkt(pos,bedrohung,verstecke,abstand,out?) -> {x,z}|null`
- `yawZu(von,nach) -> yaw`

```js
import { umkreisRichtung } from '../../engine/gameplay/character-steering-extra.js';
const r = umkreisRichtung(npc.pos, spieler.pos, 3, 1);
absicht.x = r.x * 0.6; absicht.z = r.z * 0.6;
```

Genutzt von: – · Tags: npc, ki, steering, patrouille, kampf, verstecken, gameplay · THREE: nein

### character-steering · `engine/gameplay/character-steering.js` · v1.1.0 · entwurf
NPC-Bewegungs-Gehirn: liefert dieselbe Absicht wie die Eingabe – Ziel/Ankommen, Wandern, Folgen, Fliehen, Pfad, Patrouille, Umkreisen, Abstand halten, Verstecken, Schwarm, Ausweichen, Steckenbleiben auflösen

- `createSteering({seed,ankunftsRadius,bremsRadius,wanderRadius,heimat,tempo,radius,gruppe}) -> {modus,ziel,angekommen,steckt,wartet,punktIndex,setModus(name,daten),gehZu(x,z,{rennen}),folge(getPos,abstand),fliehe(getPos,sicherAbstand),wandere(heimat,radius),folgePfad(punkte,{schleife}),patrouille(punkte,{art,warten,rennen}),umkreise(getPos,radius,{drehsinn,wechsel}),halteAbstand(getPos,min,max),verstecke(getPos,verstecke,{abstand}),schwarm(heimat,radius),setGruppe(gruppe),stehe(),update(dt,zustand,nachbarn?)->absicht,dispose()}`
- `richtungZu(von,nach,out?) -> {x,z,dist}`
- `ankunftsStaerke(dist,bremsRadius) -> 0…1`

```js
import { createSteering } from '../../engine/gameplay/character-steering.js';
const hirn = createSteering({ seed: 7, heimat: { x: 0, z: 0 } });
hirn.patrouille([{ x: 0, z: 0, warten: 2 }, { x: 8, z: 0 }], { art: 'pingpong' });
motor.update(dt, hirn.update(dt, motor.zustand, nachbarn)); // nachbarn: [{x,z,radius?,vx?,vz?}]
```

Genutzt von: figuren · Tags: npc, ki, steering, bewegung, wandern, pfad, patrouille, kampf, schwarm, gameplay · THREE: nein
Absicht: { x, z, sprint, springen (Puls beim Steckenbleiben), ducken, blickYaw (beim Umkreisen/Abstand/Wartepunkt) }.
Steckenbleiben eskaliert: seitlich ausweichen → andere Seite + Hüpfer → Wanderziel/Wegpunkt überspringen bzw. `steckt = true`.

### character · `engine/gameplay/character.js` · v1.6.0 · entwurf
Fertige Spielfigur in einem Objekt: Modell (Look) + Animator + Bewegungs-Motor, für Spieler und NPCs gleich

- `createCharacter(opts) -> { root, model, animator, motor, zustand, look, name, schild, brain, update(dt,absicht?,brainKontext?), setBrain(brain|opts|null), spiele(name,opts), loese(opts), stoppe(name?), aktion(name,opts), sage(text,{dauer,geste,ausdruck}), setName(t), setLeben(anteil|null), ausruesten(sockel,obj), ablegen(sockel|obj), ausruestung, setAusdruck(name|null,opts), treffer(richtung,staerke,opts), umfallen(richtung,opts), aufstehen(dauer), blickZu(punkt|figur|fn|null), setSichtbar(bool), abstandZu(punkt|figur), setLook(teil), teleport(pos,yaw?), stoss(x,y,z,opts?), dispose() }`

```js
import { createCharacter } from '../../engine/gameplay/character.js';
const held = createCharacter({ look: VORLAGEN.wanderer, welt, pos: { x: 0, y: 0, z: 0 } });
szene.add(held.root);
held.update(dt, absicht);   // absicht aus move-input (zuAbsicht) oder character-steering; Zusatz-Flags (rollen …) gehen durch
// Mit Namensschild/Sprechblase (engine/ui/figur-schild.js):
const bauer = createCharacter({ look, welt, name: 'Jupp', schilder });
bauer.sage('Moin!', { geste: 'winken' }); bauer.blickZu(held); bauer.ausruesten('handR', mistgabel);
```

Genutzt von: daemmerwald, enklave, figuren, handwerk · Tags: figur, charakter, spieler, npc, bewegung, animation, controller, avatar · THREE: nein

### element-reaktionen · `engine/gameplay/element-reaktionen.js` · v1.0.0 · entwurf
Element-Reaktionen ohne THREE: Elemente (Feuer, Wasser, Frost, Blitz, Erde, Wind) hinterlassen Zustände auf Zielen UND auf Boden-Flecken (nass, brennend, gefroren, kalt, geladen, schlamm); trifft ein Element auf einen passenden Zustand, gibt es eine Reaktion aus einer Daten-Tabelle (Schock, Einfrieren, Feuersturm, Dampf, Schlamm, Schmelzen …) mit Faktor, neuen Zuständen und Folge-Effekten – deterministisch

- `createElementReaktionen({reaktionen,zustaende,maxFlecken,zelle}) -> { treffer(id,element,{x,z,menge,folge}) -> ergebnis, boden(element,x,z,radius,{dauer}) -> ergebnis, amBoden(id,x,z) -> [neue Zustände], update(dt) -> ticks[], zustaende(id) -> {name:rest}, hat(id,name), setze(id,name,dauer?), loesche(id,name?), bodenBei(x,z) -> [fleck], flecken, tempo(id) (0 … 1), betaeubt(id) -> s, vergiss(id), leeren(), zustand(), lade(z), dispose() }`
- `ELEMENTE`
- `ZUSTAENDE`
- `REAKTIONEN`
- `normElement(name) -> element|null`

```js
import { createElementReaktionen } from '../../engine/gameplay/element-reaktionen.js';
const er = createElementReaktionen();
er.boden('wasser', 10, 4, 3);                                  // Pfütze: Boden-Fleck 'nass'
const r = er.treffer('ratte-3', 'blitz', { x: 10, z: 4, menge: 20 });   // steht im Nassen → r.reaktion.name === 'schock'
schade(id, r.menge); for (const f of r.folgen) zeigeEffekt(f);  // f: { art:'flaeche'|'wolke'|'glanz'|…, element, x, z, radius, faktor, dauer }
```

Genutzt von: – · Tags: zauber, element, reaktion, zustand, nass, brennend, gefroren, schock, dampf, boden, kampf, magie · THREE: nein
Reaktion = { name, text, braucht (Zustand am Ziel oder am Boden), element (eintreffend), faktor (Schaden ×), entfernt [Zustände],
setzt { zustand: dauer }, folge { art, radius, faktor (Anteil des Treffer-Schadens), element, dauer }, betaeubt (s), farbe }.
Erst wird das Ziel geprüft, dann der Boden-Fleck unter ihm (Reihenfolge der Tabelle entscheidet). Ohne Reaktion hinterlässt das
Element seinen eigenen Zustand (HINTERLAESST). Folge-Treffer (opts.folge) lösen keine weiteren Folgen aus (keine Endlos-Ketten).
update(dt) meldet Schadens-Takte brennender Ziele: [{ id, menge, element:'feuer' }].

### faehigkeiten-daten · `engine/gameplay/faehigkeiten-daten.js` · v1.0.0 · entwurf
Beispiel-Fähigkeiten (Krieger, Magier, Heiler) für die MMO-Leiste; reine Daten

- `FAEHIGKEITEN`
- `FAEHIGKEITEN_NAMEN`

```js
import { FAEHIGKEITEN } from '../../engine/gameplay/faehigkeiten-daten.js';
const d = FAEHIGKEITEN.feuerball;   // { name, symbol, ressource, kosten, abkling, wirkzeit, reichweite, zielArt, wirkung }
```

Genutzt von: – · Tags: kampf, fähigkeit, daten, mmo · THREE: nein
Felder: { name, symbol, text, rolle, ressource, kosten, abkling, gcd=true, wirkzeit, kanal, takte, beiBewegung,
        reichweite, zielArt ('feind'|'freund'|'selbst'), ladungen, wirkung }

### faehigkeiten · `engine/gameplay/faehigkeiten.js` · v1.0.0 · entwurf
Klassische MMO-Fähigkeitsleiste ohne THREE: globale Abklingzeit (GCD), Ressourcen (Mana, Wut, Energie), Wirkzeit mit Abbruch bei Bewegung und Pushback, Kanalisieren mit Takten, Ladungen, Reichweite/Ziel-Prüfung, Sperren

- `createLeiste(opts) -> { nutze(name,{ziel,abstand,bewegt,sperren}) -> {ok,grund}, kann(name,kontext) -> {ok,grund,def}, update(dt,{bewegt,getroffen,sperren}) -> ereignisse[], gib(ressource,menge), ressource(name) -> {wert,max}, wirkt -> {name,anteil}|null, gcdAnteil, abkling(name), ladungen(name), unterbrich(), zustand(), laden(z), dispose() }`
- `FAEHIGKEITEN`
- `FAEHIGKEITEN_NAMEN`

```js
import { createLeiste } from '../../engine/gameplay/faehigkeiten.js';
const leiste = createLeiste();
const r = leiste.nutze('feuerball', { ziel: { id: 'g1', feind: true }, abstand: 12 });   // r = { ok, grund }
for (const e of leiste.update(dt, { bewegt, getroffen, sperren: zustaende.faktoren() }))
if (e.typ === 'fertig' || e.typ === 'kanalTakt') wende(e.def.wirkung, e.ziel);         // Spiel ruft kampf.schade/heile/…
```

Genutzt von: figuren · Tags: kampf, fähigkeit, gcd, mmo, abklingzeit, ressource, wirkzeit, kanal, ladungen, reichweite, leiste · THREE: nein
Ereignisse: { typ:'wirkStart'|'fertig'|'kanalTakt'|'unterbrochen', name, def, ziel, grund? } (fertig auch bei Sofort-Fähigkeiten).
Kosten werden beim Start bezahlt und bei Unterbrechung erstattet. Ziel = { id, feind?: bool } (feind:false = Verbündeter).
sperren = { kannHandeln, kannZaubern } (false = gesperrt; wie zustaende.faktoren()). Zauber-Fähigkeiten: wirkung.typ 'zauber' oder ressource 'mana'.
Wirkzeit/Kanal bricht bei Bewegung ab (außer beiBewegung:'erlaubt'). Treffer in der Wirkzeit: +0.2 s, höchstens 2x.

### gegenstaende-daten · `engine/gameplay/gegenstaende-daten.js` · v1.0.0 · entwurf
Erlenwacht-Gegenstände als Daten: Waffen, Rüstung je Sockel, Tränke, Material, Gold (Symbol, Sockel, Gewicht, Stapel, Grundwerte), Seltenheiten, Affixe

- `GEGENSTAENDE {id:daten}`
- `SOCKEL`
- `SELTENHEITEN {id:{name,farbe,mult,affixe}}`
- `AFFIXE [{id,adj,wert,basis}]`
- `WERT_NAMEN {wert:Anzeigename}`
- `registriereGegenstaende(register) -> register`

```js
import { createRegister } from '../core/register.js';
import { registriereGegenstaende } from './gegenstaende-daten.js';
const register = registriereGegenstaende(createRegister({ art: 'gegenstand' }));
register.hole('schwert').symbol;   // '🗡️'
```

Genutzt von: – · Tags: gegenstand, waffe, ruestung, trank, material, seltenheit, daten, mmo · THREE: nein
genus (m|f|n|p) steuert die Adjektiv-Endung im Beute-Namen ("Scharfes Schwert"). stamm: Material-Vorsilbe je Beutequelle steht in beute.js.

### gegner-lager · `engine/gameplay/gegner-lager.js` · v1.1.0 · entwurf
Ein Gegnerlager ohne THREE: Horde (gameplay/horde) an einem Ort, je Tier eine Entität (core/entitaeten, Team 'feind'), Wache → Jagd auf nahe Spieler → Verlieren → Heimkehr + Heilung, Bisse als Befehle (gameplay/befehle), Tod → Entität weg, Respawn nach Spielzeit, Nacht = mehr und aggressiver

- `createGegnerLager({id,x,z,radius,ents,befehle,welt,seed,besatzung,nachtExtra,aggro,leine,respawn,werte,frei,schadenFaktor,stufe}) -> { id, x, z, radius, stufe, horde, modus, zielId, lebend, wesen(entId), ids, fest(dt,{aktiv,nacht}), treffer(d), tod(id), weg(id), stoss(id,x,z,kraft), betaeube(id,s), sog(x,z,r,kraft)->n, ruf(art,anzahl,x,z,radius)->anzahl, zustand(), dispose() }`

```js
import { createGegnerLager } from '../../engine/gameplay/gegner-lager.js';
const lager = createGegnerLager({ id: 'lager-moor', x: -900, z: 100, ents, befehle, welt, seed: 3, besatzung: { ratte: 8, riesenratte: 1 } });
lager.fest(1 / 60, { aktiv: true, nacht: false });   // jedes feste Bild; Treffer kommen über lager.treffer(ent:treffer-Daten)
```

Genutzt von: – · Tags: gegner, lager, horde, respawn, aggro, entitaet, mmo, ratte, gameplay · THREE: nein
stufe (Standard 1): Leben und Schaden × (1 + 0.18 × (stufe − 1)). Entität.daten: { stufe, xp, beute: art, art, wesen: art, hoehe, lager, werte } (xp = 5 × stufe × def.xp).
ents: core/entitaeten (oder die API des Moduls 'entitaeten'), befehle: gameplay/befehle. Ziele = lebende Entitäten mit team 'spieler'.
stoss(id, x, z, kraft): x,z = RICHTUNG (normiert), kraft in m/s. sog: x,z = Mitte. Inaktive Lager (fern vom Fokus) zählen nur die Uhr.

### grosszauber-riss · `engine/gameplay/grosszauber-riss.js` · v1.0.0 · entwurf
Großzauber Erdriss: ein gezackter Riss rast in Blickrichtung über den Boden, wirft Ziele hoch, speit Lava-Säulen, steht ~8 s als Graben und schließt sich abgekühlt wieder

- `createRiss({von,punkt,yaw,kraft,def}, {boden,wasser,zufall}) -> { daten, update(dt,ziele,melde)->bool, boden(x,z)->delta|null, zustand(), dispose() }`

```js
import { createRiss } from '../../engine/gameplay/grosszauber-riss.js';
const gross = createGrosszauber({ arten: { riss: createRiss }, welt: adapter, seed: 3 });
gross.wirke('riss', { von: fuss, punkt, yaw, kraft: 1.4, def: ZAUBER.erdriss });
```

Genutzt von: figuren · Tags: zauber, magie, großzauber, riss, lava, beben, episch, erdbeben, graben, feuer, flächenschaden, kampf · THREE: nein
daten (für render/grosszauber-riss):
phase 'aufreissen' | 'lava' | 'abkuehlen' | 'ende', alter (s), glut (0 … 1), zu (0 offen … 1 geschlossen), tempo, kraft
risse     [{ pkt: [{x,z,t}] (t = Sekunde, in der die Spitze den Punkt erreicht), breite (halbe Breite, m), ast (bool) }]
ausbrueche [{x,z,t,dauer,hoehe,radius}] nur aktive; t = Alter des Ausbruchs in s
Boden-Delta: Graben −1 … −2.5 m, Ränder +0.4 m (öffnet sich hinter der Spitze, schließt sich beim Abkühlen).

### grosszauber-sturm · `engine/gameplay/grosszauber-sturm.js` · v1.0.0 · entwurf
Großzauber 'sturm' (Zyklon): ein Wirbelsturm formt sich, zieht schlängelnd übers Feld, saugt Ziele an, hebt sie spiralförmig hoch, schleudert sie am Rand weg und schlägt Blitze ein

- `createSturm(opts, umgebung) -> { daten, update(dt,ziele,melde)->bool, zustand(), dispose() }`

```js
import { createSturm } from '../../engine/gameplay/grosszauber-sturm.js';
const gross = createGrosszauber({ arten: { sturm: createSturm }, welt });
gross.wirke('sturm', { von, punkt, yaw, kraft: 1.4, def: { schaden: 12, stoss: 8 } });
```

Genutzt von: figuren · Tags: zauber, magie, großzauber, sturm, tornado, wind, blitz, wirbel, sog, episch, flächenschaden, kampf · THREE: nein
Phasen: 'formen' (~1 s, Wolken senken sich, Trichter wächst) → 'ziehen' (~10 s × kraft) → 'aufloesen' (~1.5 s, alles fällt).
daten: { phase, pos {x,y,z}, fuss, oben (Radien), hoehe, drehung (rad), alter, dauer, wachs (0…1 Größe), blitze [{ punkte, alter }] (letzte, ≤ 4) }
Ereignisse: 'treffer' (Sog: zug; Kern: stoss hoch + tangential, umwerfen; Rand: stoss nach außen), 'beben' (dauernd schwach),
'klang' ('heulen' | 'blitz' | 'wumms'), 'funken' (Trümmer, Einschlag), 'ring' (Einschlag), 'meldung',
'blitz'  punkte [{x,y,z}…] von der Wolke zum Ziel (dann Einschlag), treffer (Blitzschaden) – Ansichten zeichnen daraus eine Zickzack-Linie.
Das Labor kennt 'blitz' noch nicht; deshalb kommen am Einschlag zusätzlich 'funken' + 'ring'.

### grosszauber-wand · `engine/gameplay/grosszauber-wand.js` · v1.0.0 · entwurf
Großzauber 'Erdwall': eine Felswand (bei voller Überladung ein Ring „Festung“) bricht in einer Steinwelle aus dem Boden, schleudert Ziele hoch, steht als echtes Hindernis und bröckelt dann weg

- `createWand(opts, umgebung) -> { daten:{phase,alter,ring,segmente[{x,z,breite,dicke,hoeheZiel,hoehe,yaw,seed,zerfall}]}, update(dt,ziele,melde)->bool, hindernis(x,z,r), boden(x,z), dispose() }`

```js
import { createWand } from '../../engine/gameplay/grosszauber-wand.js';
const gross = createGrosszauber({ arten: { wand: createWand }, welt: adapter });
gross.wirke('wand', { von: fuss, punkt, yaw, kraft: 1.3, def: ZAUBER.erdwall });
```

Genutzt von: figuren · Tags: zauber, großzauber, wand, fels, hindernis, episch, boden, ring, festung, beben, kampf, mmo · THREE: nein
Blick = (sin yaw, cos yaw) in (x,z). Segment-yaw = Blickrichtung seiner Flächennormalen; die Breite liegt quer dazu.
Phasen: 'steigt' (Welle von der Mitte nach außen, ~0.7 s) → 'steht' (~12 s × kraft) → 'zerfaellt' (~3.5 s).
Meldet: beben, klang (grollen, bersten, wumms, explosion), funken, stopp, meldung, treffer.

### grosszauber-welle · `engine/gameplay/grosszauber-welle.js` · v1.0.0 · entwurf
Großzauber 'welle' (Flutwelle): eine haushohe Wasserfront baut sich hinter dem Zaubernden auf, rollt in Blickrichtung übers Gelände, reißt Ziele mit, bricht zusammen und läuft als flache Flut aus (Figuren schwimmen)

- `createWelle(opts, umgebung) -> { daten, update(dt,ziele,melde), wasser(x,z), zustand(), dispose() }`

```js
import { createWelle } from '../../engine/gameplay/grosszauber-welle.js';
const gross = createGrosszauber({ arten: { welle: createWelle }, welt: adapter });
gross.wirke('welle', { von: fuss, punkt, yaw, kraft: 1.4, def: ZAUBER.flutwelle.gross });
```

Genutzt von: enklave, figuren · Tags: großzauber, welle, wasser, flut, episch, zauber, magie, kampf, flächenschaden, mitreißen, beben, mmo · THREE: nein
Phasen: 'aufbau' (Front wächst hinter dem Zaubernden) → 'rollen' → 'brechen' (Kamm stürzt, Ziele werden hochgeworfen) → 'flut' (flaches Wasser blendet aus).
def (alle optional): { breite 24, laenge 45, tempo 14, hoehe 4 … 7, aufbau 1, brechen 1.2, flut 4, tiefe 1.4, schaden, stoss, umwerfen }
daten (für render/grosszauber-welle): { phase, alter, mitte {x,y,z}, richtung {x,z}, yaw, breite, hoehe, fortschritt 0…1, kruemmung 0…1, start {x,z}, strecke (m Flutweg), flut 0…1 (Deckkraft Flutfläche), tiefe, mitgerissen }
Ziele in der Front: treffer mit zug (Laufrichtung) jedes Bild, Schaden einmal + kleiner Folgeschaden; am Ende hochgeworfen (stoss, umwerfen).

### grosszauber · `engine/gameplay/grosszauber.js` · v1.0.0 · entwurf
Großzauber, die die Welt verändern (Flutwelle, Erdwall, Zyklon, Erdriss …): Register für Zauber-Arten, laufende Wirkungen, gemeinsames Ereignis-Vokabular und ein Welt-Adapter, über den Wände/Gräben/Wasser für Figuren, Horden und Körper sofort gelten

- `createGrosszauber({arten,seed,welt,max}) -> { registriere(name,fabrik), wirke(art,{von,punkt,yaw,kraft,def,quelle}) -> id|null, update(dt,ziele) -> ereignisse[], adapter(basis) -> {bodenHoehe,wasserHoehe,hindernisse,…basis}, aktive, entferne(id), leeren(), zustand(), dispose() }`

```js
import { createGrosszauber } from '../../engine/gameplay/grosszauber.js';
import { createWelle } from '../../engine/gameplay/grosszauber-welle.js';
const gross = createGrosszauber({ arten: { welle: createWelle }, welt: adapter, seed: 7 });
Object.assign(adapter, gross.adapter({ ...adapter }));          // ab jetzt kollidiert alles mit Wänden, schwimmt in Fluten
gross.wirke('welle', { von: fuss, punkt, yaw, kraft: 1.4, def: ZAUBER.flutwelle.gross });
for (const e of gross.update(dt, ziele)) if (e.typ === 'treffer') for (const t of e.treffer) schade(t);
```

Genutzt von: enklave, figuren · Tags: zauber, magie, großzauber, episch, welle, wand, sturm, beben, kollision, welt, kampf, flächenschaden, mmo · THREE: nein
Eine Zauber-Art ist eine Fabrik  fabrik(opts, umgebung) -> instanz.
opts      { von {x,y,z} (Füße des Zaubernden), punkt {x,y,z} (Zielpunkt am Boden, auf Reichweite begrenzt), yaw (Blick = sin/cos), kraft (1 … ~1.6), def (Daten, z. B. ZAUBER.x.gross), quelle }
umgebung  { boden(x,z) (Gelände ohne Großzauber), wasser(x,z), zufall () -> [0,1) (geseedet) }
instanz   { daten        reines Objekt für die Darstellung (Phase, Lage, Maße …) – render/grosszauber-mesh reicht es an die Ansicht
            update(dt, ziele, melde) -> bool   false = vorbei (Abbau-Phase gehört noch dazu)
            hindernis?(x, z, radius) -> {x,z}|null   Wegdrück-Vektor (Wand)
            boden?(x, z) -> delta|null                 Höhe über (+) / unter (−) dem Gelände (Podest, Graben)
            wasser?(x, z) -> hoehe|null                absolute Wasserhöhe (Flut: Figuren schwimmen)
            zustand?() , dispose?() }
ziele     [{ id, x, y, z, radius, hoehe, … }] wie bei zauber.update
Ereignis-Vokabular (melde({ typ, … }); id + art ergänzt der Kern, treffer ist immer ein Array):
'treffer'  treffer: [{ id, ziel, schaden, stoss {x,y,z}, umwerfen, verlangsamt, zug {x,z}|null }]  (wie zauber.js)
'beben'    pos, staerke (0 … 2), dauer          → Kamera wackelt (nach Abstand abgeschwächt)
'klang'    name, staerke, tonhoehe              → audio/klang
'stopp'    dauer                                → Treffer-Stopp
'funken'   pos, opts (wie zauber-effekte.funken) · 'ring' pos, opts (wie zauber-effekte.ring)
'meldung'  text
Der Kern meldet selbst 'start' (von, punkt, yaw, kraft) und 'ende'.

### hand · `engine/gameplay/hand.js` · v1.0.0 · entwurf
„In der Hand“: ein Inventar-Platz ist ausgewählt (Schnellleiste); liefert den gehaltenen Gegenstand samt Register-Eintrag, meldet Wechsel (zum Ausrüsten der Figur) und nutzt Werkzeuge ab, bis sie zerbrechen

- `createHand({inventar,register,ereignisse,platz,name}) -> {platz,waehle(platz)->bool,weiter(richtung?)->platz,gegenstand(),eintrag(),hatTag(tag),haltbarkeit()->0..1|null,nutzeAb(n?)->{rest,kaputt}|null,onWechsel(fn)->abmelden,zustand(),lade(stand),dispose()}`

```js
import { createHand } from '../../engine/gameplay/hand.js';
const hand = createHand({ inventar, register: gegenstaende });
hand.onWechsel((e) => { figur.ablegen('handR'); if (e?.modell) figur.ausruesten('handR', createAusruestung(e.modell)); });
hand.waehle(2); hand.hatTag('axt'); hand.nutzeAb(1);   // Haltbarkeit sinkt, bei 0 verschwindet das Werkzeug
```

Genutzt von: handwerk · Tags: hand, ausruesten, werkzeug, haltbarkeit, schnellleiste, inventar, gameplay · THREE: nein
platz = -1: leere Hand. Der Platz bleibt gewählt, auch wenn er leer wird (wie eine Schnellleiste).
Haltbarkeit: Register-Eintrag { haltbarkeit: 25 } = volle Haltbarkeit; der Stand liegt in den Daten des Platzes ({ haltbarkeit }).
Solche Gegenstände brauchen `stapel: 1`. onWechsel(eintrag|null, platzInhalt|null) feuert nur, wenn sich die id in der Hand ändert.
Ereignisse: 'hand:gewechselt' { hand, id }, 'werkzeug:kaputt' { hand, id }.

### horde · `engine/gameplay/horde.js` · v1.2.0 · entwurf
Horden-Gegner ohne THREE (Ratten & Co. zu Dutzenden): verfolgen ein Ziel, drängeln sich ohne Überlappen, umzingeln, springen an und beißen, werden weggeschleudert, betäubt, verlangsamt, in einen Sog gezogen und sterben im Flug – deterministisch per Seed

- `createHorde(opts) -> { wesen, ziele, anzahl, getoetet, arten, spawne(art,x,z,{skala}) -> wesen|null, spawneRing(art,anzahl,mitte,{radius,breite,winkel,bogen}) -> anzahl, schade(wesen,schaden,{stoss,umwerfen,verlangsamt,zug}) -> {tot,schaden}, update(dt,ziel) -> ereignisse[], leeren(), dispose() }`
- `HORDEN_ARTEN`

```js
import { createHorde } from '../../engine/gameplay/horde.js';
const horde = createHorde({ seed: 7, welt });                    // welt: Adapter mit bodenHoehe (+ wasserHoehe, hindernisse)
horde.spawneRing('ratte', 30, held.zustand.pos, { radius: 20 });
for (const e of horde.update(dt, { x, y, z, radius: 0.35 }))      // Ziel = Spieler (null = Horde streunt)
if (e.typ === 'biss') spielerSchaden(e.schaden);
for (const t of einschlag.treffer) horde.schade(t.ziel, t.schaden, t);   // horde.ziele passt direkt in zauberbuch.update(dt, ziele)
```

Genutzt von: enklave, figuren · Tags: gegner, horde, schwarm, monster, ratte, ki, kampf, verfolgen, rückstoß, gameplay · THREE: nein
Wesen (lebendes Objekt, vom Renderer gelesen – engine/render/horde-mesh.js): { id, art, def, x, y, z, vx, vy, vz, yaw, skala,
radius, hoehe, leben, lebenMax, tot, zustand ('lauf' | 'sprung' | 'flug' | 'benommen' | 'tot'), t (s im Zustand), phase (Lauf-Takt),
hub (m Hüpfer beim Anspringen), dreh (rad Überschlag im Flug), blitz (1 → 0 Treffer-Aufleuchten), langsam (s Rest), verfall (0 → 1
Leiche verschwindet), ton (Farbfaktor), fremd (true = gameplay/boss steuert, keine Horden-KI) }
Ereignisse von update() (Array wird wiederverwendet): { typ: 'biss', wesen, schaden, wucht (m/s Stoß, 0 = keiner), element|null } · { typ: 'weg', wesen } (Leiche entfernt)

### interaktion · `engine/gameplay/interaktion.js` · v1.0.0 · entwurf
„Ansehen → Aktion“: Dinge der Welt (NPC, Gegenstand, Baum, Tür) melden sich als Ziel an; für eine Figur wird das beste Ziel in Reichweite/Blickrichtung bestimmt (Hinweis „E – Aufheben“) und ausgelöst, auch als Gedrückt-halten mit Fortschritt

- `createInteraktion({reichweite,blickWinkelGrad,nahImmer,hoehenToleranz,zelle,ereignisse}) -> {melde(id,{pos,radius,reichweite,art,text,dauer,prio,aktiv,aktion,daten}),bewege(id,x,z,y?),aktualisiere(),entferne(id),hat(id),hole(id),anzahl,beste(wer,{reichweite,filter}?),inReichweite(wer,out?),ausloesen(wer,ziel?),halte(wer,dt,gedrueckt)->{ziel,anteil,fertig},dispose()}`

```js
import { createInteraktion } from '../../engine/gameplay/interaktion.js';
const ia = createInteraktion({ reichweite: 2.5 });
ia.melde('pilz-1', { pos: { x: 4, z: 7 }, text: 'Aufheben', aktion: (wer, ziel) => ia.entferne(ziel.id) });
// je Bild: ia.aktualisiere(); const z = ia.beste(spieler); hinweis.textContent = z ? 'E – ' + z.text : '';
// bei Tastendruck: ia.halte(spieler, dt, tasteE)   (oder ia.ausloesen(spieler))
```

Genutzt von: enklave, handwerk · Tags: interaktion, ansprechen, aufheben, tuer, npc, hinweis, aktion, reichweite, gameplay · THREE: nein
wer = { x, y?, z, yaw? } (yaw: 0 = +z, wie Math.atan2(dx, dz)). Kandidat: aktiv, Rand-Abstand (Mittelpunkt − radius, min 0) ≤ Reichweite,
Höhe passt (nur wenn beide y endlich), im Blickkegel (nur wenn yaw endlich und Rand-Abstand > nahImmer).
Wertung (kleiner = besser): randAbstand + winkelRad * 0.6 − prio; bei Gleichstand das zuerst gemeldete Ziel.
Ziele liegen in einem Raum-Gitter (engine/core/raum-gitter.js). Funktions-pos wird in aktualisiere() nachgeführt.

### inventar · `engine/gameplay/inventar.js` · v1.2.0 · entwurf
Inventar mit festen Plätzen, Stapeln, Gewichtsgrenze, Speichern/Laden und Änderungs-Meldung

- `createInventar({plaetze,register,stapel,maxGewicht,ereignisse,name}) -> {plaetze,gib(id,anzahl,daten)->rest,passt(id,anzahl),nimm(id,anzahl)->anzahl,nimmVon(platz,anzahl),hat(id,anzahl),zaehle(id),frei(),gewicht,verschiebe(von,nach),teile(platz,anzahl)->index,setzeDaten(platz,daten|null)->bool,leere(),zustand(),lade(zustand),onAenderung(fn)->abmelden,dispose()}`
- `uebertrage(von,platz,nach,anzahl?)->bewegt`

```js
import { createInventar } from '../../engine/gameplay/inventar.js';
const inv = createInventar({ plaetze: 10, stapel: 50 });
const rest = inv.gib('holz', 120);   // 20 passen nicht
inv.nimm('holz', 5); inv.zaehle('holz');
const sicher = JSON.stringify(inv.zustand());
```

Genutzt von: enklave, erde, handwerk · Tags: inventar, gegenstand, stapel, gameplay, speichern · THREE: nein

### kampf-werte · `engine/gameplay/kampf-werte.js` · v1.0.0 · entwurf
Kämpfer (Leben, Schild, Haltung, Werte, Mods) und reine Schadensformel mit Rüstung, Krit, Parade, Block

- `ARTEN`
- `STANDARD_WERTE`
- `berechneSchaden(angreifer,verteidiger,paket,r)->{schaden,krit,roh}`
- `createKaempfer({id,team,leben,werte,haltung,seed})->{leben,lebenMax,tot,schild,haltung,taumelt,werte,abwehr,nimmSchaden(paket,angreiferWerte)->ergebnis,heile(m)->geheilt,gibSchild(m,dauer),belebe(anteil),setzeMod(id,mod),entferneMod(id),update(dt)->ereignisse,zustand(),laden(z),dispose()}`

```js
import { createKaempfer } from '../../engine/gameplay/kampf-werte.js';
const ork = createKaempfer({ id: 'ork', team: 2, leben: 80, werte: { ruestung: 100 } });
const e = ork.nimmSchaden({ menge: 20, wucht: 10, richtung: { x: 0, z: -1 } });
ork.abwehr.block = true; ork.abwehr.yaw = 0; // Blick = (sin yaw, cos yaw)
```

Genutzt von: – · Tags: kampf, schaden, leben, haltung, ruestung, krit, mmo, rpg · THREE: nein

### kampf · `engine/gameplay/kampf.js` · v1.0.0 · entwurf
Kampf-Welt (Befehlsschicht): Kämpfer + Zustände + Bedrohung verbinden, schade/heile/gibZustand, DoT-Takte, DPS, Ereignisse

- `createKampf({seed,ereignisse}) -> {melde(id,opts)->kaempfer,entferne(id),kaempfer(id),zustaende(id),alle(),feindlich(a,b),schade(paket)->ergebnis,heile({quelle,ziel,menge})->geheilt,gibZustand(ziel,name,opts),update(dt)->ereignisse,imKampf(id),dps(id,fenster),bedrohung,zustand(),laden(z),dispose()}`

```js
import { createKampf } from '../../engine/gameplay/kampf.js';
const k = createKampf({ seed: 7 });
k.melde('held', { team: 1, leben: 100 }); k.melde('ork', { team: 2, leben: 50 });
const e = k.schade({ quelle: 'held', ziel: 'ork', menge: 20, zustand: { name: 'brennen' } });
for (const ev of k.update(1)) console.log(ev.typ); // kampf:treffer, kampf:tot, …
```

Genutzt von: figuren · Tags: kampf, schaden, leben, buff, debuff, aggro, mmo, welt · THREE: nein

### klassen-daten · `engine/gameplay/klassen-daten.js` · v1.0.0 · entwurf
Die drei Erlenwacht-Klassen (Krieger/Wut, Magier/Mana, Waldläufer/Energie) mit je Fähigkeiten und Freischalt-Stufen – reine Daten

- `KLASSEN`
- `KLASSEN_NAMEN`
- `KLASSEN_FAEHIGKEITEN`
- `FREI_STUFEN`
- `freigeschaltet(klasse, stufe) -> Namen[]`
- `neuFreigeschaltet(klasse, stufe) -> Namen[]`
- `ressourcenVon(klasse) -> opts.ressourcen für createLeiste`

```js
import { KLASSEN, freigeschaltet } from '../../engine/gameplay/klassen-daten.js';
freigeschaltet('krieger', 3);   // ['wuchtschlag', 'wirbelwind']
```

Genutzt von: – · Tags: kampf, klasse, fähigkeit, daten, mmo, erlenwacht, krieger, magier, waldläufer · THREE: nein
Fähigkeits-Format wie gameplay/faehigkeiten-daten (name, symbol, text, ressource, kosten, abkling, gcd, wirkzeit, kanal, takte, beiBewegung, reichweite, zielArt, wirkung)
plus `freiStufe`. wirkung.typ: 'nahkampf' (Kegel vor dir) · 'wirbel' (360°) · 'ansturm' (Dash aufs Ziel) · 'schild' · 'beben' (Fläche um dich) ·
'schuss' (Projektil) · 'gift' (Nahkampf + Schaden über Zeit) · 'salto' (zurückspringen) · 'hagel' (Pfeile auf Fläche vor dir) · 'fokus' (Buff) · 'zauber' (Magier: Name im Zauber-Modul).
`faktor` = Schadens-Vielfaches der Grundwaffe. Magier-Fähigkeiten stehen im Zauber-Modul (ERLENWACHT_ZAUBER); hier nur Namen + Stufe.
Ressourcen: Krieger Wut 0–100 (+8 je Treffer, verfällt 2/s), Waldläufer Energie 100 (+10/s), Magier Mana (verwaltet das Zauber-Modul).

### klettern · `engine/gameplay/klettern.js` · v1.0.0 · entwurf
Klettern an sehr steilen Hängen (Gelände steiler als hangGrad) und hohen Hindernissen (Stämme, Felsen, Mauern): erkennt die Wand vor der Figur, steuert den Motor über absicht.klettern (hoch/runter/seitlich, Hochziehen oben, Absprung), kostet Ausdauer – leer = abrutschen

- `createKlettern({welt,motor,ausdauer,hangGrad,tempo,seitTempo,anlauf,minHoehe,abSprung}) -> {klettert,wand,hochziehen,update(dt,absicht)->absicht,loslassen(),suche(pos,richtung)->wand|null,dispose()}`

```js
import { createKlettern } from '../../engine/gameplay/klettern.js';
const klettern = createKlettern({ welt: { bodenHoehe, normale, hindernisse: kollision.hindernisse }, motor: figur.motor, ausdauer });
zuAbsicht(eingabe.lesen(), cam.blickYaw(), absicht);
klettern.update(dt, absicht);     // setzt absicht.klettern (Motor ≥ 1.3.0) oder löscht es
figur.update(dt, absicht);
```

Genutzt von: figuren · Tags: klettern, wand, hang, fels, baum, ausdauer, motor, bewegung, gameplay · THREE: nein
Wand: { art: 'gelaende'|'hindernis', nx, nz (waagerechte Normale, zeigt von der Wand weg), n:{x,y,z} (Gelände-Normale) }.
Start: Stick ≥ 60 % in die Wand, anlauf Sekunden lang, Ausdauer nicht erschöpft. Hindernisse zählen nur, wenn sie
auch auf Kopfhöhe + minHoehe noch da sind (keine Figuren/Kisten). Springen = Absprung von der Wand, Ducken = loslassen.

### koerper · `engine/gameplay/koerper.js` · v1.0.0 · entwurf
Leichte Physik für lose Dinge (Gegenstände, Beute, Bälle, Kisten-Trümmer) ohne THREE: Kugeln mit Schwerkraft, Abprallen, Reibung, Haften am flachen Hang, Rutschen am steilen, Schwimmen/Sinken, Hindernisse, Einschlafen – fester Zeitschritt, deterministisch

- `createKoerperWelt({welt,schwerkraft,schritt,maxSchritte,ruheTempo,ruheZeit,onAufprall}) -> {neu(opts)->koerper,entferne(koerper|id),hole(id),impuls(koerper,x,y,z),wecke(koerper),weckeUmkreis(x,z,radius),schiebe(x,z,radius,vx,vz,y?,hoehe?),update(dt)->wach,alle(),anzahl,dispose()}`

```js
import { createKoerperWelt } from '../../engine/gameplay/koerper.js';
const physik = createKoerperWelt({ welt });                       // welt: Adapter oder Kollisions-Welt
const apfel = physik.neu({ pos: { x: 0, y: 2, z: 0 }, vel: { x: 2, y: 3, z: 0 }, radius: 0.12 });
// je Bild: physik.update(dt); mesh.position.copy(apfel.pos);
physik.schiebe(held.x, held.z, 0.3, held.vx, held.vz, held.y, 1.75);   // Figur kickt lose Dinge weg
```

Genutzt von: enklave, handwerk · Tags: physik, koerper, gegenstand, schwerkraft, abprallen, schwimmen, rollen, gameplay · THREE: nein
neu(opts): { pos {x,y,z} (Mittelpunkt), vel, radius = 0.15, sprung = 0.35 (0 = bleibt liegen … 1 = Flummi),
reibung = 8 (1/s Bremsen am Boden; klein = rollt weit), haftung = 0.8 (Boden-Normale.y ab der das Ding am Hang liegen bleibt;
1 = rollt jeden Hang hinab), auftrieb = 1.4 (>1 schwimmt, <1 sinkt), id, daten }
Körper (lebendes Objekt): { id, pos, vel, radius, amBoden, imWasser, ruht, daten } – pos/vel dürfen gelesen und gesetzt werden
(nach dem Setzen wecke(k) rufen). Körper stoßen nicht untereinander zusammen (billig, reicht für Beute und Kleinkram).
onAufprall(koerper, tempo, 'boden' | 'wand' | 'wasser') ab ~1 m/s – für Klang und Staub.

### nahkampf-daten · `engine/gameplay/nahkampf-daten.js` · v1.0.0 · entwurf
Waffen-Tabelle für den Action-Nahkampf (Kombo-Ketten, schwerer Schlag, Tempo) – reine Daten

- `WAFFEN { faust, schwert, axt, hammer, dolch, speer, stab }`
- `WAFFEN_NAMEN -> string[]`

```js
import { WAFFEN } from '../../engine/gameplay/nahkampf-daten.js';
const s = WAFFEN.schwert.leicht[0]; // { clip:'schlagen', vorlauf, aktiv, nachlauf, schaden, reichweite, winkel, wucht, stoss, schritt }
```

Genutzt von: – · Tags: kampf, nahkampf, waffe, kombo, daten, mmo · THREE: nein

### nahkampf · `engine/gameplay/nahkampf.js` · v1.0.0 · entwurf
Deterministischer Action-Nahkampf als reine Logik: Kombo-Kette, schwerer Schlag, Block/Parade, Ausweichen, Taumeln, Kegel-Treffer

- `createNahkampf({ waffe='schwert', waffen=WAFFEN }) -> { angriff('leicht'|'schwer')->{ok,grund}, lasseLos(), block(an), ausweichen({x,z})->{ok}, taumle(dauer), update(dt,{x,y,z,yaw},ziele)->ereignisse[], phase, kombo, abwehr{block,parade,unverwundbar}, tempoFaktor, setWaffe(n), waffe, zustand(), laden(z), dispose() }`
- `WAFFEN`
- `WAFFEN_NAMEN`

```js
import { createNahkampf } from '../../engine/gameplay/nahkampf.js';
const nk = createNahkampf({ waffe: 'axt' });
nk.angriff('leicht');
for (const e of nk.update(dt, { x, y, z, yaw }, [{ id:'wolf', x:1, y:0, z:2, radius:0.5 }])) if (e.typ === 'treffer') kampf.schade(...);
```

Genutzt von: enklave, figuren · Tags: kampf, nahkampf, kombo, waffe, parade, ausweichen, block, mmo, deterministisch · THREE: nein

### progression · `engine/gameplay/progression.js` · v1.0.0 · entwurf
Stufen 1–15 (XP-Kurve), Talentpunkte, Klassen-Attribute pro Stufe und Talentbaum (3 Zweige × 4 Talente je Klasse) als reine Logik; werte() summiert Grund + Stufe + Talente + Ausrüstung

- `createProgression({klasse,name,stufe,xp}) -> {klasse,name,stufe,xp,xpNaechste,punkte,gibXp(n)->{aufstiege:[stufe],stufe},lerne(id)->{ok,grund},talentStufe(id),hat(id),baum,werte(ausruestung?)->{…},zustand(),lade(z)}`
- `xpFuer(stufe)`
- `MAX_STUFE`
- `KLASSEN`
- `TALENTBAUM {klasse:[zweig]}`

```js
import { createProgression } from '../../engine/gameplay/progression.js';
const p = createProgression({ klasse: 'krieger', name: 'Goi' });
p.gibXp(200).aufstiege;                 // [2]
p.lerne('kr_schlag');                   // { ok: true }
p.werte({ schaden: 8 }).leben;          // Grund + Stufe + Talente + Ausrüstung
```

Genutzt von: – · Tags: fortschritt, stufe, xp, talent, attribute, klasse, mmo · THREE: nein
XP: xpFuer(s) = round(80·s^1.6) für den Weg von Stufe s zu s+1; xp zählt innerhalb der Stufe. Talentpunkt: 1 je Stufe ab 2.
Talent: { id, name, max, voraus (Punkte im selben Zweig), wirkung:{wert:betrag je Stufe} }.

### rezepte · `engine/gameplay/rezepte.js` · v1.0.0 · entwurf
Herstellen: Rezepte als Daten (Zutaten → Ergebnis, optional Werkzeug und Station), prüfen was mit einem Inventar möglich ist und sicher herstellen (alles oder nichts)

- `createRezepte({gegenstaende,ereignisse}) -> {definiere(id,{zutaten,ergebnis,werkzeug,station,dauer,name}),definiereAlle({id:daten}),hole(id),alle(),pruefe(id,inventar,{stationen}?)->{ok,grund,fehlt},moeglich(inventar,{stationen}?)->[rezept],stelleHer(id,inventar,{stationen,wer}?)->{id,anzahl}|null,dispose()}`

```js
import { createRezepte } from '../../engine/gameplay/rezepte.js';
const rezepte = createRezepte({ gegenstaende });
rezepte.definiere('axt', { zutaten: { holz: 2, stein: 1 }, ergebnis: 'axt' });
const p = rezepte.pruefe('axt', inventar);          // { ok: false, grund: 'zutaten', fehlt: { stein: 1 } }
if (p.ok) rezepte.stelleHer('axt', inventar);       // nimmt Zutaten, legt die Axt ins Inventar
```

Genutzt von: erde, handwerk · Tags: rezept, herstellen, crafting, werkbank, zutaten, inventar, gameplay · THREE: nein
Rezept: { id, name, zutaten {id: anzahl}, ergebnis {id, anzahl, daten?}, werkzeug [id oder Tag, wird nicht verbraucht],
        station (Text oder null), dauer (Sekunden, nur Angabe fürs Spiel) }.
grund: null | 'unbekannt' | 'station' | 'werkzeug' | 'zutaten' | 'platz' (nur bei stelleHer, dann bleibt das Inventar unverändert).
Hat der Gegenstand im Register eine `haltbarkeit`, bekommt das Ergebnis automatisch daten { haltbarkeit } (siehe gameplay/hand).
Ereignis: 'hergestellt' { rezept, id, anzahl, wer }.

### rohstoffe · `engine/gameplay/rohstoffe.js` · v1.0.0 · entwurf
Abbaubare Quellen (Baum, Fels, Busch) ohne THREE: Beute per Seed, Werkzeug nötig oder nur schneller, Abnutzung, Nachwachsen nach Spielzeit, Speichern/Laden

- `createRohstoffe({arten,seed,ereignisse,onWeg,onDa,warte}) -> {definiere(art,daten),hole(art),pruefe(art,werkzeug?)->{ok,grund,dauer,passt},baueAb(schluessel,art,{werkzeug,jetzt,wer}?)->{beute,abnutzung,reif}|null,istWeg(schluessel),update(jetzt)->anzahl,anzahl,zustand(),lade(stand),dispose()}`

```js
import { createRohstoffe } from '../../engine/gameplay/rohstoffe.js';
const roh = createRohstoffe({ seed, onWeg: (k) => verstecke(k), onDa: (k) => zeige(k),
arten: { baum: { gibt: [{ id: 'holz', min: 2, max: 4 }], dauer: 1.5, werkzeug: 'axt', ohneFaktor: 3, nachwachsen: 2 } } });
const p = roh.pruefe('baum', hand.eintrag());                       // { ok, dauer, passt }
const erg = roh.baueAb(baumIndex, 'baum', { werkzeug: hand.eintrag(), jetzt: uhr.tag + uhr.stunde / 24 });
// erg.beute → in die Welt werfen; erg.abnutzung → hand.nutzeAb(…);   je Bild: roh.update(jetzt)
```

Genutzt von: handwerk · Tags: rohstoff, abbauen, faellen, nachwachsen, werkzeug, beute, gameplay · THREE: nein
Art: { gibt [{id, min, max, chance}], dauer (s), werkzeug (Tag oder id, optional), noetig (ohne passendes Werkzeug geht nichts),
     ohneFaktor (so viel länger ohne Werkzeug, Standard 3), abnutzung (je Abbau, Standard 1), nachwachsen (Zeit-Einheiten, 0 = nie), text }.
werkzeug = Register-Eintrag des Gegenstands in der Hand ({ id, tags, tempo }) oder null. `tempo` teilt die Dauer.
`jetzt` ist eine beliebige, wachsende Spielzeit (z. B. Tage als Kommazahl) – dieselbe Einheit wie `nachwachsen`.
onDa(schluessel, art) darf false liefern („gerade steht jemand dort“) → neuer Versuch nach `warte` Zeit-Einheiten.
Ereignisse: 'abgebaut' { schluessel, art, beute, wer }, 'nachgewachsen' { schluessel, art }.

### stationen · `engine/gameplay/stationen.js` · v1.0.0 · entwurf
Stationen als Orte in der Welt (Werkbank, Feuerstelle, Amboss): wer steht an welcher Art Station, nächste Station, benutzen – das Ergebnis von beiWem() passt direkt in rezepte.pruefe(…, {stationen})

- `createStationen({interaktion,ereignisse,reichweite,onBenutzt}) -> {neu(id,{art,pos,radius,reichweite,name,text,aktiv,daten})->station,entferne(id),hole(id),alle(),anzahl,setAktiv(id,an),beiWem(wer,aus?)->[art],naechste(wer,art?)->station|null,benutze(id,wer)->bool,zustand(),lade(stand),dispose()}`

```js
import { createStationen } from '../../engine/gameplay/stationen.js';
const stationen = createStationen({ interaktion, ereignisse });
stationen.neu('tisch-1', { art: 'werkbank', pos: { x: 4, z: 7 } });
const p = rezepte.pruefe('tisch', inventar, { stationen: stationen.beiWem(spieler) });
```

Genutzt von: enklave, handwerk · Tags: station, werkbank, feuerstelle, amboss, herstellen, crafting, ort, gameplay · THREE: nein
station = { id, art, name, pos {x,y?,z}, radius, reichweite, aktiv, daten }. wer = { x, y?, z }.
In Reichweite: aktiv, Rand-Abstand (Mittelpunkt − radius, min 0) ≤ reichweite, Höhe |dy| ≤ 2.5 (nur wenn beide y endlich).
beiWem() liefert die verschiedenen Arten als Array (darf per `aus` wiederverwendet werden, dann kein Müll pro Bild).
Mit `interaktion` wird jede Station als Ziel 'station:<id>' gemeldet (Hinweistext, Aktion = benutze); inaktiv = Ziel nicht aktiv.
Ereignis: 'station:benutzt' { station, wer }. zustand()/lade() sichern nur den Aktiv-Zustand ({id: 0|1}).

### tueren · `engine/gameplay/tueren.js` · v1.0.1 · entwurf
Türen und Tore als reine Logik: auf/zu mit weicher Animation, Kollisions-Körper nur solange zu, Schlüssel/Sperre, Selbstschließen, Interaktions-Ziel

- `createTueren({welt,interaktion,ereignisse,dauer,autoZu,maxWinkel}) -> {neu(id,{x,z,y,winkel,breite,dicke,hoehe,offen,angel,schluessel,verbraucht,name,autoZu,daten})->tuer,entferne(id),hole(id),alle(),anzahl,schalte(id,wer?)->{ok,grund,offen},oeffne(id,wer?),schliesse(id,wer?),sperre(id,an?),update(dt)->Anzahl bewegter,zustand(),lade(stand),dispose()}`

```js
import { createTueren } from '../../engine/gameplay/tueren.js';
const tueren = createTueren({ welt: kollision, interaktion, autoZu: 5 });
const t = tueren.neu('haus', { x: 4, z: 2, winkel: 0, breite: 1.2, angel: 'links', schluessel: 'schluessel' });
// je Bild: tueren.update(dt);  Mesh: pivot.position.set(t.angelPos.x, t.y, t.angelPos.z); pivot.rotation.y = t.winkel + t.drehung;
```

Genutzt von: enklave, handwerk · Tags: tuer, tor, oeffnen, schluessel, kollision, interaktion, gameplay · THREE: nein
Winkel wie beim Kasten in world/kollision: Blatt liegt lokal entlang x (Breite), Dicke entlang z; rotation.y = winkel.
Blatt-Achse in der Welt = (cos w, -sin w) in (x, z), Normale = (sin w, cos w). angel 'links' = Angel bei Mitte - halbe Breite
entlang der Achse, 'rechts' = bei Mitte + halbe Breite. Mesh: Pivot an angelPos, rotation.y = winkel + drehung, das Blatt
im Pivot um ∓breite/2 in lokal x versetzt (links: +breite/2, rechts: -breite/2).
seite = Vorzeichen von drehung (rotation.y-Änderung); wird beim Öffnen mit `wer` so gewählt, dass das Blatt von der Figur wegschwingt.
grund: null | 'unbekannt' | 'verschlossen' | 'blockiert'. Ein Schlüssel-Inventar ist wer.inventar ({hat(id,n), nimm(id,n)}).
Ereignisse (ereignisse.sende): 'tuer:auf' / 'tuer:zu' / 'tuer:verschlossen' { tuer, wer }.
Interaktions-Ziel 'tuer:<id>' mit Text "<name> öffnen" | "<name> schließen" | "<name> (verschlossen)".

### welt-dinge · `engine/gameplay/welt-dinge.js` · v1.1.0 · entwurf
Gegenstände, die in der Welt liegen (ohne THREE): ablegen, werfen, aufheben ins Inventar, gleiche Stapel in der Nähe zusammenlegen, Lebensdauer, Speichern/Laden – verbindet Physik (koerper), Interaktion und Inventar

- `createWeltDinge({physik,interaktion,register,ereignisse,lebensdauer,sammelRadius,onNeu,onWeg}) -> {lege(id,anzahl,pos,{vel,daten,alter}?)->ding,wirf(id,anzahl,von,yaw,{tempo,hoch,streuung,daten}?)->ding,nimm(ding,inventar)->anzahl,entferne(ding),update(dt),alle(),anzahl,zustand(),lade(stand),dispose()}`

```js
import { createWeltDinge } from '../../engine/gameplay/welt-dinge.js';
const dinge = createWeltDinge({ physik, interaktion, register: gegenstaende, onNeu: (d) => zeige(d), onWeg: (d) => verstecke(d) });
dinge.wirf('holz', 3, held.zustand.pos, held.zustand.yaw);       // fällt, rollt aus, lässt sich mit der Interaktion aufheben
// je Bild: physik.update(dt); dinge.update(dt);   Position zum Zeichnen: ding.koerper.pos
```

Genutzt von: enklave, handwerk · Tags: gegenstand, beute, aufheben, ablegen, werfen, inventar, welt, gameplay · THREE: nein
Ding: { nr, id, anzahl, daten, alter, koerper (aus engine/gameplay/koerper.js) }.
Register-Einträge dürfen die Physik bestimmen: { radius, sprung, reibung, haftung, auftrieb, name, stapel }.
Aufheben läuft über die Interaktion: das Ziel ruft nimm(ding, wer.inventar) – `wer` braucht also ein Feld `inventar`.
Ereignisse (falls Bus gesetzt): 'ding:neu' { ding }, 'ding:aufgehoben' { wer, id, anzahl, rest }, 'ding:weg' { ding }.

### zauber-daten · `engine/gameplay/zauber-daten.js` · v1.2.0 · entwurf
Die Zauber-Tabelle als reine Daten: 12 wuchtige Zauber (Geschoss, Strahl, Kegel, Ort, Nova, Selbst, Teleport) mit Wirkzeit, Gewicht, Überladen, Durchschlag und Feldern (Brandboden, Sog) – gemacht für Horden

- `ZAUBER`
- `ZAUBER_NAMEN`
- `LADEN`

```js
import { ZAUBER, ZAUBER_NAMEN } from '../../engine/gameplay/zauber-daten.js';   // oder aus zauber.js (reicht beides durch)
const def = ZAUBER.feuerball;   // def.wirkzeit = Mindest-Aufladezeit, def.gewicht = wie schwer er sich anfühlt (0 … 1)
```

Genutzt von: – · Tags: zauber, magie, daten, tabelle, kampf, flächenschaden, horde, spell · THREE: nein
Felder je Zauber:
name, symbol, text, farbe, clip (Geste aus character-clips-zauber), mana, abkling (s)
element    'feuer' | 'eis' | 'blitz' | 'arkan' | 'natur' | 'heilig' – Schadensart fürs Kampfsystem (kampf-werte ARTEN), ab 1.1.0
art        'geschoss' | 'strahl' | 'kegel' | 'ort' | 'nova' | 'selbst' | 'teleport'
wirkzeit   Sekunden Aufladen, bevor er die Hand verlassen kann (schwer = lang)
gewicht    0 … 1: Wucht für Kamera, Rückstoß, Bremsen beim Aufladen, Treffer-Stopp (wertet das Spiel aus)
schaden, radius (Fläche, 0 = nur das getroffene Ziel), stoss (m/s Wegschleudern), umwerfen, verlangsamt (s)
Geschoss:  tempo, reichweite, fall (m/s² – fliegt im Bogen und schlägt am Boden ein), anzahl, suchend, durchschlag (Ziele, die es durchbohrt)
Strahl:    reichweite, winkel, kette (Sprünge), kettenRadius
Kegel:     reichweite, winkel (halber Öffnungswinkel)
Ort:       reichweite, verzug (s zwischen Ansage und Einschlag)
feld       { dauer, takt, schaden, sog (m/s zur Mitte), verlangsamt, anteil (Radius-Anteil) } – bleibt nach dem Einschlag liegen
feldEnde   { schaden, radius, stoss, umwerfen } – Schluss-Schlag des Feldes (Implosion)
mehr       { anzahl, kette } – Zuwachs bei voller Überladung
Großzauber (art 'gross', seit 1.2.0): gross { art: 'welle'|'wand'|'sturm'|'riss', … } – Daten für gameplay/grosszauber-<art>

### zauber · `engine/gameplay/zauber.js` · v2.1.0 · entwurf
Zauber-System ohne THREE: Zauberbuch mit Mana, Abklingzeiten und wuchtigem Aufladen (Wirkzeit, Halten = Überladen, Schlag), Geschosse (Bogen, Zielsuche, Durchschlag), Strahl, Kegel, Ort, Nova, Felder (Brandboden, Sog) und Treffer-Ereignisse

- `createZauberbuch(opts) -> { wirke(name,{vorlauf,schlag,ziel,halten}) -> {ok,grund,def}, lasseLos(), brichAb() -> bool, kann(name) -> {ok,grund,def}, update(dt,ziele) -> ereignisse[], ladung -> {name,def,phase,anteil,ueber,kraft}|null, mana, manaMax, wirkt, abklingzeit(name), abklingAnteil(name), geschosse, felder, setFreiesMana(bool), namen, zauber, dispose() }`
- `ZAUBER`
- `ZAUBER_NAMEN`
- `zielImKegel(ziele,von,yaw,reichweite,winkel) -> ziel|null`
- `richtungAusYaw(yaw) -> {x,z}`

```js
import { createZauberbuch, ZAUBER } from '../../engine/gameplay/zauber.js';
const buch = createZauberbuch({ welt });                       // welt.bodenHoehe(x,z) für Einschläge am Boden
buch.wirke('feuerball', { halten: true, schlag: 0.1,           // lädt mindestens def.wirkzeit, solange gehalten: überlädt
ziel: () => ({ von: handPos, fuss: figur.zustand.pos, yaw, ziel: gegner, punkt: bodenPunkt }) });   // wird beim Loslassen gefragt
if (!taste) buch.lasseLos();                                   // → Ereignis 'schlag' (Geste auslösen), nach `schlag` s 'start'
for (const e of buch.update(dt, gegnerListe))                   // gegnerListe: [{ id, x, y, z, radius, hoehe }]
for (const t of e.treffer) schade(t.ziel, t.schaden, t);      // t: { stoss, umwerfen, verlangsamt, zug }
```

Genutzt von: enklave, figuren · Tags: zauber, magie, kampf, mana, abklingzeit, geschoss, flächenschaden, aufladen, horde, fähigkeit, spell · THREE: nein
Ablauf eines Zaubers: wirke() → Phase 'laden' (mindestens vorlauf s; mit halten bis lasseLos(), dabei wächst die Kraft
von 1 auf def.ueberladen bzw. LADEN.kraft) → Ereignis 'schlag' (Abklingzeit beginnt) → nach `schlag` s verlässt er die Hand.
Kraft vergrößert Schaden, Radius und Stoß (und def.mehr: zusätzliche Geschosse/Kettenglieder).
Ereignisse von update() (Array wird wiederverwendet – nicht aufheben): alle haben { typ, zauber (Name), def (mit Kraft verrechnet), kraft, treffer: [] }.
'schlag'       Aufladen fertig, Geste schlägt zu (noch kein Effekt)
'start'        Zauber verlässt die Hand: von, yaw
'ankuendigung' Ort-Zauber angesagt: pos, radius, verzug (s bis zum Einschlag)
'einschlag'    Geschoss/Ort trifft: pos, radius, geschossId?
'durchschlag'  Geschoss durchbohrt ein Ziel und fliegt weiter: pos, geschossId
'strahl'       Blitz: punkte [{x,y,z} …] (Hand → Ziel → Kettenziele)
'kegel'        Druckwelle: von, yaw, reichweite, winkel
'nova'         Ring um die Figur: pos, radius
'feld' / 'feldTakt' / 'feldEnde'   liegendes Feld beginnt (pos, radius, dauer, sog) / trifft / endet (mit Schluss-Schlag, falls def.feldEnde)
'selbst'       Heilung/Schild: def.heilt / def.schild / def.dauer wertet das Spiel aus
'teleport'     von, nach (das Spiel versetzt die Figur)
'gross'        Großzauber (art 'gross', seit 2.1.0): von (Füße), punkt (Ziel am Boden, auf Reichweite begrenzt), yaw → gameplay/grosszauber.wirke(def.gross.art, …)
treffer: [{ id, ziel, schaden, stoss {x,y,z}, umwerfen, verlangsamt (s), zug {x,z} | null (Sog: Geschwindigkeit zur Mitte) }]

### zustaende · `engine/gameplay/zustaende.js` · v1.0.0 · entwurf
Buffs und Debuffs: Stapel, Dauer, DoT/HoT-Takte, Faktoren (Tempo, Schaden, Rüstung), Sperren (Betäubung, Frost)

- `ZUSTAENDE`
- `createZustaende({defs}) -> {gib(name,{quelle,dauer,staerke})->eintrag,nimm(name),hat(name),stapel(name),update(dt)->ereignisse,beiSchaden()->ereignisse,faktoren(),liste(),reinige('schaedlich'|'nuetzlich'),zustand(),laden(z),dispose()}`

```js
import { createZustaende } from '../../engine/gameplay/zustaende.js';
const z = createZustaende();
z.gib('gift', { quelle: 'spinne' }); z.gib('gift', { quelle: 'spinne' }); // 2 Stapel
for (const e of z.update(1)) if (e.typ === 'takt') console.log(e.name, e.menge);
z.faktoren().kannHandeln; // false bei betaeubt/eingefroren
```

Genutzt von: – · Tags: buff, debuff, zustand, dot, hot, kampf, mmo, status · THREE: nein

### move-input · `engine/input/move-input.js` · v1.1.0 · entwurf
Bewegungs-Eingabe für Figuren: Tastatur (WASD/Pfeile), Maus-Ziehen/Mausrad, Touch-Stick + Knöpfe, Gamepad → Stick, Kamera-Delta, Aktionen (Flanke/gehalten)

- `createMoveInput(opts) -> { lesen(dt?) -> { x, y, sprint, springen, ducken, <aktion>: bool …, kameraX, kameraY, zoom, aktiv }, gedrueckt(name), gehalten(name), aktionen, belegung, setBelegung(teil), lerneTaste(name) -> Promise<code|null>, setAktiv(bool), zeigeTouch(bool), zeigeKnopf(name, bool), dispose() }`
- `stickZuWelt(x, y, kameraYaw) -> {x, z}`
- `zuAbsicht(e, kameraYaw, out?) -> Absicht`
- `tastenText(code)`
- `STANDARD_AKTIONEN`
- `ERWEITERTE_AKTIONEN`
- `STANDARD_BELEGUNG`

```js
import { createMoveInput, stickZuWelt } from '../../engine/input/move-input.js';
const ein = createMoveInput({ element: renderer.domElement, aktionen: [{ name: 'angriff', tasten: ['KeyF'], knopf: '⚔', padKnopf: 2 }] });
const e = ein.lesen();                       // einmal pro Frame
kamera.drehen(e.kameraX, e.kameraY); kamera.zoomen(e.zoom);
const r = stickZuWelt(e.x, e.y, kamera.blickYaw());
motor.update(dt, { x: r.x, z: r.z, sprint: e.sprint, springen: e.springen, ducken: e.ducken });
if (ein.gedrueckt('angriff')) figur.schlagen();
// Neue Aktionen per Name (rollen, gleiten, tauchen, aktion1, aktion2, interagieren, ziel) + eigene Tastenbelegung (z. B. aus dem Spielstand):
const ein2 = createMoveInput({ aktionen: ['rollen', 'interagieren'], belegung: { tasten: { vor: ['KeyZ'] } }, vibration: true });
figur.update(dt, zuAbsicht(ein2.lesen(), kamera.blickYaw()));   // alle Aktions-Flags (rollen …) gehen mit zum Motor
```

Genutzt von: daemmerwald, enklave, figuren, handwerk · Tags: eingabe, tastatur, maus, touch, gamepad, joystick, figur, steuerung · THREE: nein

### touch-stick · `engine/input/touch-stick.js` · v1.1.1 · entwurf
Touch-Steuerung fürs Handy: dynamischer virtueller Joystick (linke Hälfte), Kamera-Wischen + Pinch-Zoom (rechte Hälfte), runde Aktionsknöpfe unten rechts

- `createTouchStick(opts) -> { stick {x, y, an}, sprint, nimmKamera() -> {dx, dy, zoom}, benutzt, stickRadius, zeigen(bool), knopfZeigen(name, bool), reset(), dispose() }`
- `istTouchGeraet() -> bool`
- `autoStickRadius(breite, hoehe) -> px`

```js
import { createTouchStick } from '../../engine/input/touch-stick.js';
const t = createTouchStick({ element: canvas, knoepfe: [{ name: 'springen', knopf: '⤒' }],
beiKnopf: (name, unten) => console.log(name, unten), beiErstemTouch: () => t.zeigen(true) });
const { dx, dy, zoom } = t.nimmKamera();   // Pixel bzw. ln(Abstandsverhältnis) seit dem letzten Aufruf
```

Genutzt von: – · Tags: eingabe, touch, joystick, handy, knoepfe, pinch, zoom · THREE: nein

### bau-basis · `engine/models/bau/bau-basis.js` · v1.0.0 · entwurf
Gemeinsame Farben und Helfer für Bau-Assets: lokale Kollisions-Körper, Asset-Ergebnis mit dispose

- `FARBEN`
- `kasten(x,z,bx,bz,hoehe,{winkel,y0,begehbar}) -> koerper`
- `kreis(x,z,radius,hoehe,{y0,begehbar}) -> koerper`
- `asset(teile) -> asset`

```js
import { FARBEN, kasten, asset } from '../../engine/models/bau/bau-basis.js';
const kiste = asset({ name: 'kiste', geometrie, kollision: [kasten(0, 0, 0.4, 0.4, 0.8)], masse: { breite: 0.8, tiefe: 0.8, hoehe: 0.8 } });
```

Genutzt von: enklave · Tags: bau, gebaeude, asset, farben, kollision · THREE: nein

### bau-pruefung · `engine/models/bau/bau-pruefung.mjs` · v1.0.0 · entwurf
Testhelfer: gemeinsame Prüfung für Kleinkram-Assets (Attribute, Budget, Maße, Kollision, Determinismus) – nur in Tests

- `pruefeAsset(asset,{budget,tol,leucht,anker})`
- `pruefeDeterminismus(fabrik,opts)`
- `andereVariante(fabrik,v0,v1)`

```js
import { pruefeAsset } from './bau-pruefung.mjs'; pruefeAsset(createFass({ seed: 1 }), { budget: 120 });
```

Genutzt von: – · Tags: test, bau, asset, pruefung · THREE: ja

### bau-teile · `engine/models/bau/bau-teile.js` · v1.0.0 · entwurf
Bauteile für Gebäude-Assets: Satteldach/Pultdach mit Schindelreihen, Giebel, Fachwerk, Fenster mit Läden, Tür, Zinnen, Laterne, Flagge

- `mitT(b, {x,y,z,ry}) -> b'`
- `satteldach(b,o)`
- `pultdach(b,o)`
- `giebel(b,w,h,d,farbe,t)`
- `strebe(b,x1,y1,x2,y2,tiefe,farbe)`
- `fachwerk(b,w,h,{pfosten,schienen,streben})`
- `fenster(b,l,x,y,o)`
- `tuer(b,breite,hoehe)`
- `zinnenLinie(b,x1,z1,x2,z2,y,o)`
- `laterne(b,l,x,y,z,arm)`
- `flagge(b,x,y,z,farbe)`

```js
import { createMeshBuilder } from '../../render/mesh-builder.js';
import { satteldach, fenster } from './bau-teile.js';
const b = createMeshBuilder({ seed: 1 }), l = createMeshBuilder({ seed: 2 });
satteldach(b, { w: 5, d: 4, y: 3, h: 2, farbe: '#9a4a32' });
fenster(mitT(b, { z: 2 }), mitT(l, { z: 2 }), 0, 1.5);
```

Genutzt von: – · Tags: bau, gebaeude, dach, fachwerk, fenster, zinnen, lowpoly · THREE: ja

### bau-dorf-teile · `engine/models/bau/dorf-teile.js` · v1.0.0 · entwurf
Dörfliche Kleinbauten als Low-Poly-Asset: begehbare Bogenbrücke, Holzstapel, Handkarren, Gemüsebeet, Anschlagbrett, Runen-Schrein, Palisade, Heuhaufen, Bootssteg

- `createBruecke({seed,laenge,breite})`
- `createHolzstapel({seed})`
- `createKarren({seed})`
- `createBeet({seed,variante 0-2})`
- `createAnschlagbrett({seed})`
- `createSchrein({seed})`
- `createPalisade({seed,variante 0-1})`
- `createHeuhaufen({seed})`
- `createSteg({seed,laenge}) -> asset { name, variante, geometrie, leucht, kollision, anker, masse, dreiecke, dispose }`

```js
import { createBruecke } from '../../engine/models/bau/dorf-teile.js';
const br = createBruecke({ seed: 3, laenge: 10 });   // br.kollision enthält begehbare Stufen entlang z; br.anker.enden = Auf-/Abgang
```

Genutzt von: – · Tags: bau, dorf, bruecke, steg, beet, palisade, schrein, anschlagbrett, asset, lowpoly, mittelalter · THREE: ja

### gebaeude-pruefen · `engine/models/bau/gebaeude-pruefen.mjs` · v1.0.0 · entwurf
Testhelfer: gemeinsame Abnahme für Gebäude-Assets (Budget, Maße, Kollision, Anker, Seed-Determinismus) – nur in Tests

- `vereinigung(asset) -> Box`
- `pruefeAsset(name, fabrik, {varianten,budget,opts,anker,tol}) – legt node:test-Tests an`

```js
import { pruefeAsset } from './gebaeude-pruefen.mjs'; pruefeAsset('haus', createHaus, { budget: 1200 });
```

Genutzt von: – · Tags: test, bau, asset, pruefung · THREE: ja

### haus · `engine/models/bau/haus.js` · v1.0.0 · entwurf
Wohnhaus als Low-Poly-Asset: v0 Fachwerkhaus (Satteldach rot, Fensterläden), v1 Steinhaus (Schieferdach, Kamin, Vordach)

- `createHaus({ seed = 1, variante = 0 }) -> asset { geometrie, leucht, kollision, anker { tuer, fackeln, licht, kamin? }, masse, dreiecke, dispose }`

```js
import { createHaus } from '../../engine/models/bau/haus.js';
const haus = createHaus({ seed: 3, variante: 1 });
szene.add(new THREE.Mesh(haus.geometrie, standardMaterial()));
```

Genutzt von: enklave · Tags: bau, gebaeude, haus, fachwerk, asset, lowpoly · THREE: ja

### bau-licht · `engine/models/bau/licht.js` · v1.0.0 · entwurf
Lichtquellen als Low-Poly-Asset mit Leucht-Geometrie (unbeleuchtet zeichnen): Laterne auf Pfahl, Wandfackel, Lagerfeuer mit Steinring

- `createLaterne({seed})`
- `createFackel({seed})`
- `createLagerfeuer({seed}) -> asset { name, geometrie, leucht, kollision, anker (licht/fackeln), masse, dreiecke, dispose }`

```js
import { createLagerfeuer } from '../../engine/models/bau/licht.js';
const feuer = createLagerfeuer({ seed: 5 });   // feuer.leucht = Flammen, feuer.anker.licht = PointLight-Vorlage
```

Genutzt von: daemmerwald, enklave, erde · Tags: bau, licht, laterne, fackel, lagerfeuer, leucht, asset, lowpoly · THREE: ja

### bau-markt · `engine/models/bau/markt.js` · v1.0.0 · entwurf
Marktplatz-Kleinkram als Low-Poly-Asset: Marktstand mit Stoffdach (4 Farben), Brunnen mit Holzdach, Sitzbank

- `createMarktstand({seed,variante 0-3})`
- `createBrunnen({seed})`
- `createBank({seed}) -> asset { name, variante, geometrie, leucht, kollision, anker, masse, dreiecke, dispose }`

```js
import { createMarktstand } from '../../engine/models/bau/markt.js';
const stand = createMarktstand({ seed: 3, variante: 1 });   // stand.geometrie in Mesh/InstancedMesh
```

Genutzt von: enklave · Tags: bau, markt, brunnen, bank, asset, lowpoly, mittelalter · THREE: ja

### mauer · `engine/models/bau/mauer.js` · v1.0.0 · entwurf
Stadtmauer als Low-Poly-Assets: Segment (in x streckbar), achteckiger Mauerturm, Torhaus mit freiem Durchgang, Torflügel (zentriert, für gameplay/tueren)

- `createMauer({ seed, variante, sx = 1 })`
- `createMauerTurm({ seed, variante })`
- `createTorhaus({ seed, variante })`
- `createTorfluegel({ seed, variante }) -> asset { geometrie, leucht, kollision, anker, masse, dreiecke, dispose }`

```js
import { createMauer, createTorhaus } from '../../engine/models/bau/mauer.js';
const stueck = createMauer({ sx: 1.5 });   // 9 m langes Segment, Front (außen) = +z
```

Genutzt von: enklave · Tags: bau, gebaeude, mauer, tor, zinnen, asset, lowpoly · THREE: ja

### schmiede · `engine/models/bau/schmiede.js` · v1.0.0 · entwurf
Schmiede als Low-Poly-Asset: Steinhaus mit Satteldach, offener Pultdach-Anbau mit Esse (leuchtende Glut), Wasserbottich und Amboss-Station

- `createSchmiede({ seed = 1, variante = 0 }) -> asset { geometrie, leucht, kollision, anker { tuer, station { art:'amboss', x, z }, licht, fackeln }, masse, dreiecke, dispose }`

```js
import { createSchmiede } from '../../engine/models/bau/schmiede.js';
const s = createSchmiede();   // s.anker.station = { art: 'amboss', x, z }
```

Genutzt von: enklave · Tags: bau, gebaeude, schmiede, esse, asset, lowpoly · THREE: ja

### taverne · `engine/models/bau/taverne.js` · v1.0.0 · entwurf
Taverne als Low-Poly-Asset: 2 Geschosse mit Fachwerk, Erker, Vordach mit Bänken, Ausleger-Schild (Krug)

- `createTaverne({ seed = 1, variante = 0 }) -> asset { geometrie, leucht, kollision, anker { tuer, sitz, licht, fackeln }, masse, dreiecke, dispose }`

```js
import { createTaverne } from '../../engine/models/bau/taverne.js';
const t = createTaverne({ seed: 2 });   // t.anker.sitz = Sitzplätze unter dem Vordach
```

Genutzt von: enklave · Tags: bau, gebaeude, taverne, fachwerk, asset, lowpoly · THREE: ja

### tempel · `engine/models/bau/tempel.js` · v1.0.0 · entwurf
Tempel/Zauberturm als Low-Poly-Asset: Säulenhalle mit Schieferdach + runder Turm mit blauem Kegeldach und schwebendem Kristall (leuchtet)

- `createTempel({ seed = 1, variante = 0 }) -> asset { geometrie, leucht, kollision, anker { tuer, fackeln, licht }, masse, dreiecke, dispose }`

```js
import { createTempel } from '../../engine/models/bau/tempel.js';
const t = createTempel();   // t.leucht = Kristall, Fenster, Flammen (unbeleuchtet zeichnen)
```

Genutzt von: enklave · Tags: bau, gebaeude, tempel, turm, kristall, asset, lowpoly · THREE: ja

### bau-uebung · `engine/models/bau/uebung.js` · v1.0.0 · entwurf
Übungs- und Lager-Kleinkram als Low-Poly-Asset: Trainingspuppe, Zielscheibe, Zelt, Amboss

- `createTrainingspuppe({seed})`
- `createZielscheibe({seed})`
- `createZelt({seed,variante 0-2})`
- `createAmboss({seed}) -> asset { name, variante, geometrie, leucht, kollision, anker, masse, dreiecke, dispose }`

```js
import { createTrainingspuppe } from '../../engine/models/bau/uebung.js';
const puppe = createTrainingspuppe();   // puppe.anker.ziel = Trefferpunkt, Kollision = Zylinder
```

Genutzt von: enklave · Tags: bau, training, puppe, zielscheibe, zelt, amboss, asset, lowpoly · THREE: ja

### bau-vorrat · `engine/models/bau/vorrat.js` · v1.0.0 · entwurf
Vorrats-Kleinkram als Low-Poly-Asset: Fass, Kiste (normal/flach), Banner mit Stange (4 Farben)

- `createFass({seed})`
- `createKiste({seed,variante 0-1})`
- `createBanner({seed,variante 0-3}) -> asset { name, variante, geometrie, leucht, kollision, anker, masse, dreiecke, dispose }`

```js
import { createFass, createBanner } from '../../engine/models/bau/vorrat.js';
const fass = createFass({ seed: 2 });
```

Genutzt von: enklave · Tags: bau, fass, kiste, banner, asset, lowpoly, mittelalter · THREE: ja

### wachturm · `engine/models/bau/wachturm.js` · v1.0.0 · entwurf
Wachturm als Low-Poly-Asset: Steinschaft, auskragendes Holz-Obergeschoss mit Zinnen und Flagge

- `createWachturm({ seed = 1, variante = 0 }) -> asset { geometrie, leucht, kollision, anker { tuer, fackeln, wachen, licht }, masse, dreiecke, dispose }`

```js
import { createWachturm } from '../../engine/models/bau/wachturm.js';
const t = createWachturm({ seed: 5 });
```

Genutzt von: enklave · Tags: bau, gebaeude, wachturm, zinnen, asset, lowpoly · THREE: ja

### bau-wegbau · `engine/models/bau/wegbau.js` · v1.0.0 · entwurf
Wegrand-Kleinkram als Low-Poly-Asset: Wegweiser mit Pfeilbrettern, Zaunsegment (2 m, reihbar), Steinkreis

- `createWegweiser({seed,schilder:[{winkel,text}]})`
- `createZaun({seed,variante 0-1})`
- `createSteinkreis({seed}) -> asset { name, variante, geometrie, leucht, kollision, anker, masse, dreiecke, dispose }`

```js
import { createWegweiser } from '../../engine/models/bau/wegbau.js';
const w = createWegweiser({ schilder: [{ winkel: 1.2, text: 'Enklave' }] });   // w.anker.schild = [{ winkel, text, x, y, z }]
```

Genutzt von: daemmerwald, enklave · Tags: bau, wegweiser, zaun, steinkreis, asset, lowpoly, mittelalter · THREE: ja

### character-anim-blick · `engine/models/character/character-anim-blick.js` · v1.0.0 · entwurf
Blick einer Figur (rein): Richtung oder Weltpunkt → verteilt auf Torso/Hals/Kopf mit Grenzen, Augen eilen voraus; Blinzeln per Seed; Werte für einen Mimik-Hook

- `createBlick({seed,augenGrenze,kopfGrenze}) -> { zu(dirLokal|null), zuPunkt(welt|null), update(dt,{idleW,umsehYaw,umsehNick,zustand,augenHoehe}) , anwenden(pose,gewicht), yaw, nick, augenYaw, augenNick, lid, blinzeln(), dispose() }`

```js
import { createBlick } from '../../engine/models/character/character-anim-blick.js';
const blick = createBlick({ seed: 3 });
blick.zuPunkt({ x: 4, y: 1.6, z: 2 });                         // Weltpunkt (braucht zustand.pos/yaw im update)
blick.update(dt, { zustand: motor.zustand, augenHoehe: 1.6 }); blick.anwenden(pose);
```

Genutzt von: – · Tags: figur, charakter, animation, blick, kopf, augen, blinzeln, mimik · THREE: nein

### character-anim-hang · `engine/models/character/character-anim-hang.js` · v1.0.0 · entwurf
Hang-Anpassung (rein): Steigung im Figur-Raum aus Motor-Zustand/Normale/bodenHoehe messen und Fußziele, Hüfthöhe, Fußneigung und Rumpf-Vorlage daran anpassen

- `hangMessen(zustand,bodenHoehe?,out?) -> {vor,seit}`
- `hangAnpassen(masse,ziele,vor,seit,gewicht) -> {lehne}`

```js
import { hangMessen, hangAnpassen } from '../../engine/models/character/character-anim-hang.js';
const h = hangMessen(motor.zustand, welt.bodenHoehe);       // Steigung vorwärts/seitwärts (dh/ds)
fussZiele(masse, g, ziele); const { lehne } = hangAnpassen(masse, ziele, h.vor, h.seit, 1);
```

Genutzt von: – · Tags: figur, charakter, animation, hang, gelaende, ik, fuesse · THREE: nein

### character-anim-idle · `engine/models/character/character-anim-idle.js` · v1.0.0 · entwurf
Idle-Variationen (rein): nach längerer Ruhe deterministisch (Seed) eine Idle-Variante (strecken, gähnen, umschauen, kratzen …) als eigene Schicht einblenden, bei Bewegung sofort weich abbrechen

- `idleLeben(st,r,dt) (Gewicht wechseln + Umsehen, st: gewicht/gewichtZiel/gewichtUhr/umsehUhr/umsehYaw/umsehNick/idleW)`
- `createIdleSchicht({seed,nach:[min,max],varianten}) -> { update(dt,ruhig) -> gewicht, pose, clip, name, ruheZeit, starte(name), abbrechen(), dispose() }`

```js
import { createIdleSchicht } from '../../engine/models/character/character-anim-idle.js';
const idle = createIdleSchicht({ seed: 5, nach: [8, 16] });
const w = idle.update(dt, stehtStill);
if (w > 0) mischePose(pose, idle.pose, w, pose, clipMaske(idle.clip));
```

Genutzt von: – · Tags: figur, charakter, animation, idle, ruhe, variation, npc · THREE: nein

### character-anim-zustand · `engine/models/character/character-anim-zustand.js` · v1.1.0 · entwurf
Posen für Sonder-Zustände des Motors (rein): Rolle (rollAnteil), Luft-Dash, Salto beim Doppelsprung, Gleiten, Leiterklettern, Arme rudern an der Kante, Betäubt-Taumeln

- `createZustandsSchicht() -> { update(dt,zustand,skal), anwenden(pose) -> pose, ausdruck, rolleW, saltoW, dispose() }`

```js
import { createZustandsSchicht } from '../../engine/models/character/character-anim-zustand.js';
const zs = createZustandsSchicht();
zs.update(dt, motor.zustand, masse.hueftHoehe / 0.89); zs.anwenden(pose);   // nach allen anderen Schichten
```

Genutzt von: – · Tags: figur, charakter, animation, rolle, dash, salto, gleiten, kante, betaeubt, motor · THREE: nein

### character-animator · `engine/models/character/character-animator.js` · v1.2.0 · entwurf
Prozedurale Figuren-Animation aus dem Motor-Zustand: idle/gehen/laufen/sprinten ohne Fußrutschen, Luft, Landung, Schwimmen, Ducken, Rutschen, Kurvenlage, Atmen, Hang, Idle-Varianten, sekundäre Bewegung, Treffer/Umfallen, Aktions-Clips mit Masken, Blick + Mimik-Hook

- `createAnimator(model,opts) -> { update(dt,zustand) -> pose, spiele(name,{tempo,mischung,schleife,halteBei}) -> {dauer,trefferBei,spannBei}, loese({tempo}) -> s, stoppe(name?), aktion, aktionGewicht, blickZu(dirLokal|null), blickZuPunkt(welt|null), treffer(richtung,staerke,{welt}), umfallen(richtung,{staerke,welt}), aufstehen(dauer), ausdruck, mimik, idleVariante, faellt, liegt, sekundaer, hang, gewicht, griff, pose, phase, dispose() }`
- `createCharacterAnimator = createAnimator`

```js
import { createAnimator } from '../../engine/models/character/character-animator.js';
const anim = createAnimator({ rig, masse }, { seed: 7, onSchritt: (fuss, st) => schrittGeraeusch(st) });
anim.update(dt, motor.zustand);                  // NPC: anim.update(dt, { tempo: 1.4 })
const { trefferBei } = anim.spiele('schlagen');  // Schaden nach trefferBei Sekunden
anim.treffer({ x: 0, z: -1 }, 0.7);              // Stoß von vorn (Figur-Raum), klingt von selbst ab
anim.blickZuPunkt(spieler.zustand.pos);           // Kopf + Augen folgen (braucht zustand.pos/yaw)
```

Genutzt von: erde · Tags: figur, charakter, animation, gang, laufen, schwimmen, springen, aktion, clip, npc, spieler · THREE: nein

### character-ausruestung · `engine/models/character/character-ausruestung.js` · v1.0.0 · entwurf
Low-Poly-Gegenstände für Figuren-Sockel (Schwert, Dolch, Axt, Hammer, Hacke, Schaufel, Speer, Stab, Zauberstab, Schild, Bogen, Fackel, Laterne, Korb, Becher, Buch): je ein Mesh + optional Leucht-Mesh, passend ausgerichtet für model.befestigen(sockel, obj)

- `AUSRUESTUNG`
- `ausruestungsNamen`
- `createAusruestung(name, opts) -> THREE.Group (+ dispose())`
- `baueAusruestung(b, name, farben, glut?) -> b`
- `ausruestungAusrichten(obj, sockel) -> obj`

```js
import { createAusruestung } from '../../engine/models/character/character-ausruestung.js';
const schwert = createAusruestung('schwert', { seed: 3 });
figur.befestigen('handR', schwert);
figur.befestigen('handL', createAusruestung('schild', { sockel: 'handL', farbe: '#2a4a8a' }));
const fackel = createAusruestung('fackel'); licht.position.copy(fackel.userData.lichtPunkt); fackel.add(licht);
```

Genutzt von: figuren, handwerk · Tags: figur, charakter, ausrüstung, waffe, werkzeug, schwert, axt, schild, bogen, fackel, laterne, korb, sockel · THREE: ja
Gegenstand-Raum: Griffpunkt im Ursprung, Längsachse +Y, „vorn“ (Schneide, Schildfläche, Bogenbauch) +Z.
Ausrichtung je Sockel (Hand-Raum: Arm hängt nach −Y, Daumen +Z):
halt 'vorn' (Waffen, Werkzeug): +Y → +Z der Hand (Arm hängt: zeigt nach vorn; Arm vorgestreckt: zeigt nach oben)
halt 'schraeg' (Fackel): schräg nach vorn-oben · 'aufrecht' (Stab, Speer): senkrecht, vor die Faust versetzt
halt 'seite' (Schild): Fläche nach außen (handL → +X, handR → −X) · 'haengend' (Laterne, Korb, Becher): hängt nach −Y
ruecken/umhang: schräg über den Rücken (Griff oben) · guertel: an der linken Hüfte, Spitze nach unten · kopf: unverändert

### character-clips-mehr · `engine/models/character/character-clips-mehr.js` · v1.1.0 · entwurf
Weitere Aktions-Clips als reine Keyframe-Daten (Emotes, Kampf, Arbeit, Ruhe, Idle-Varianten, Klettern); wird von character-clips registriert

- `MEHR_CLIPS`
- `IDLE_VARIANTEN`

```js
import { CLIPS } from '../../engine/models/character/character-clips.js';   // registriert MEHR_CLIPS automatisch
anim.spiele('verbeugen'); anim.spiele('fegen', { schleife: true }); anim.spiele('tragen');  // Dauer-Aktion bis stoppe()
```

Genutzt von: – · Tags: figur, charakter, animation, clip, keyframe, emote, kampf, arbeit, idle · THREE: nein

### character-clips-zauber · `engine/models/character/character-clips-zauber.js` · v2.0.0 · entwurf
Wuchtige Zauber-Gesten als reine Keyframe-Daten (Wurf, Stoß, Fingerzeig, Himmelsruf, Bodenschlag, Griff, Selbstzauber) mit Spann-Moment zum Aufladen; wird von character-clips registriert

- `ZAUBER_CLIPS`

```js
import { CLIPS } from '../../engine/models/character/character-clips.js';   // registriert ZAUBER_CLIPS automatisch
figur.spiele('zauberWurf', { halteBei: true });       // holt aus und bleibt gespannt (clip.spannBei) – Aufladen
const bisTreffer = figur.loese();                     // schlägt zu; nach bisTreffer Sekunden verlässt der Zauber die Hand
```

Genutzt von: – · Tags: figur, charakter, animation, clip, keyframe, zauber, magie, geste · THREE: nein

### character-clips · `engine/models/character/character-clips.js` · v1.3.0 · entwurf
Aktions-Clips einer Figur als Keyframe-Daten (winken, schlagen, hacken, werfen, aufheben, tod, rolle, sitzen, tanzen … + character-clips-mehr + character-clips-zauber) und ihr Abtaster

- `CLIPS`
- `CLIP_NAMEN`
- `IDLE_VARIANTEN`
- `clipPose(name,t,out) -> pose`
- `clipZeit(clip,t,schleife?) -> t`
- `registriereClip(name,def) -> clip`
- `clipMaske(clip) -> kanalliste`

```js
import { CLIPS, clipPose, registriereClip } from '../../engine/models/character/character-clips.js';
const p = clipPose('schlagen', CLIPS.schlagen.trefferBei);   // Pose im Treffer-Moment
registriereClip('verbeugen', { dauer: 1.2, maske: 'ganz', fuesseFest: true,
keys: [{ t: 0, pose: {} }, { t: 0.5, pose: { torso: [1.0, 0, 0] } }, { t: 1.2, pose: {} }] });
```

Genutzt von: enklave, figuren · Tags: figur, charakter, animation, clip, keyframe, aktion, angriff, emote · THREE: nein

### character-gang · `engine/models/character/character-gang.js` · v1.1.0 · entwurf
Fortbewegungs-Posen einer Figur (rein): Fußziele aus Gangphase (gehen/laufen/sprinten ohne Fußrutschen), Bein-IK, Rumpf/Arme, Luft- und Schwimm-Pose

- `schrittWeite(masse,tempo,opts) -> m`
- `stuetzAnteil(laufW,sprintW) -> 0…1`
- `fussZiele(masse,g,ziele) -> ziele`
- `loeseBein(masse,pose,seite,ziel{x,y,z,neig,roll?})`
- `naechsteRuhePhase(phase,laufW,sprintW) -> phase`
- `loeseBeine(masse,pose,ziele) -> pose`
- `gangPose(masse,g,ziele,out) -> pose`
- `luftPose(steigen,out) -> pose`
- `schwimmPose(masse,phase,zug,eintauchen,out) -> pose`

```js
import { fussZiele, gangPose } from '../../engine/models/character/character-gang.js';
const g = { phase, tempo: 1.8, laufW: 0, sprintW: 0, idleW: 0, duckW: 0, rutschW: 0 };
gangPose(masse, g, fussZiele(masse, g, ziele), pose);   // meist über character-animator benutzt
```

Genutzt von: – · Tags: figur, charakter, animation, gang, laufen, ik, fuesse, schwimmen · THREE: nein

### character-lod · `engine/models/character/character-lod.js` · v1.0.0 · entwurf
Fern-Darstellung für viele Figuren: alle in EINEM Draw-Call (InstancedMesh, ~250 Dreiecke), Look-Farben als Instanz-Attribute, Lauf-Pendeln im Vertex-Shader

- `createFigurLod({ max, material }) -> { objekt, anzahl, setze(id,{look,pos,yaw,tempo,sichtbar}), entferne(id), update(dt,zeit), dispose() }`
- `lookZuLod(look) -> { hoehe, breite, farben[7], flags[6] }`
- `baueLodGeometrie() -> { pos, slot, teil }`
- `LOD_DREIECKE`

```js
import { createFigurLod } from '../../engine/models/character/character-lod.js';
const lod = createFigurLod({ max: 64 });
szene.add(lod.objekt);
lod.setze('bauer1', { look, pos: { x, y, z }, yaw: 1.2, tempo: 1.3 });   // pro Bild/Schritt; sichtbar:false blendet aus
lod.update(dt, zeit);                                                     // pro Bild (Zeit für das Pendeln)
```

Genutzt von: enklave · Tags: figur, charakter, lod, fern, instanced, performance, menge, npc, mmo, draw-calls · THREE: ja
Eine gemeinsame Form (Rumpf, Kopf, Beine, Arme + schaltbar: Haar, langes Haar, Kappe, Krempenhut, Robe, Rock). Der Look bestimmt nur Farben,
Schalter und Maße (Höhe/Breite) je Instanz – kein Backen pro Look nötig, ein einziges Shader-Programm. Standard-Material (PS1-Look über psx.wendeAn/update).
Draw-Calls: 1, unabhängig von der Zahl der Figuren.

### character-look · `engine/models/character/character-look.js` · v1.1.0 · entwurf
Aussehen einer Figur als reine Daten: Körperbau, Haut, Haar, Bart, Kleidung, Kopfbedeckung, Accessoires (Brille, Schal, Schmuck), Grund-Mimik; Vorlagen, Zufalls-Looks per Seed, abgeleitete Körpermaße

- `LOOK_STANDARD`
- `STILE`
- `TEIL_NAMEN`
- `AUSDRUECKE`
- `VORLAGEN`
- `createLook(teil) -> look`
- `randomLook(seed,opts) -> look`
- `koerperMasse(look) -> masse`
- `farbeZahl(farbe) -> int`

```js
import { createLook, randomLook, koerperMasse, VORLAGEN } from '../../engine/models/character/character-look.js';
const held = createLook({ ...VORLAGEN.wanderer, haar: { farbe: '#c8a040' }, brille: { stil: 'rund' } });
const npc = randomLook(hashSeed('dorf', 7));   // gleicher Seed → gleicher Look
```

Genutzt von: daemmerwald, enklave, erde, erlenwacht, figuren, handwerk · Tags: figur, charakter, aussehen, look, spieler, npc, avatar, editor, speichern, accessoires, mimik · THREE: nein
1.1: neue Stile (Haar, Bart, Oberteil, Hose, Schuhe, Kopfbedeckung, Umhang), neue Teile brille/schal/schmuck,
   Körper schultern/muskeln, Feld ausdruck (Grund-Mimik), neue Vorlagen. Alte Spielstände bleiben gültig
   (fehlende Felder → Standard; erste Einträge in STILE und Körper-Standards unverändert).

### character-model · `engine/models/character/character-model.js` · v1.3.0 · entwurf
Look → fertige Figur: Rig (Gelenk-Gruppen) + Low-Poly-Meshes je Knochen; Look live wechseln, Gegenstände an Sockeln befestigen

- `createCharacterModel({ look, seed, material, schatten, mimik }) -> { root, rig, look, masse, meshes, gesicht, ausdruck, setLook(teilOderLook), befestigen(sockel,obj), loesen(sockelOderObj), setSichtbar(bool), setAusdruck(name), setLider(zu), blinzeln(dauer), setBlick(x,y), setAugen(yaw,nick,lid), updateGesicht(dt), dispose() }`

```js
import { createCharacterModel } from '../../engine/models/character/character-model.js';
const figur = createCharacterModel({ look: VORLAGEN.ritter, seed: 4 });
szene.add(figur.root);
figur.befestigen('handR', schwert);
figur.setLook({ kopfbedeckung: { stil: 'krone' } });   // Rig-Gruppen & Befestigtes bleiben erhalten
```

Genutzt von: erde, erlenwacht · Tags: figur, charakter, modell, mesh, spieler, npc, avatar, editor, ausrüstung, mimik, gesicht · THREE: ja
1.3 (additiv): opts.koerper = 'organisch' → ein glatter, gehäuteter Körper aus SDF (figur-haut: Anatomie + Kleidung + Haar in einem Netz,
   biegt weich an den Gelenken); Kopfbedeckung, Umhang, Rucksack, Zubehör, Augen, Brille, Ohrringe bleiben starre Teile. opts.zelle = Feinheit (m).
   modell.koerper = 'organisch' | 'bloecke'; modell.setKoerper(art) schaltet live um.
Gesicht/Mimik (1.1, additiv; mit opts.mimik = false festes Gesicht wie 1.0, ohne die Funktionen zu brechen – sie tun dann nichts):
setAusdruck(name)  name aus AUSDRUECKE (character-look), z. B. 'neutral' 'froh' 'freundlich' 'freude' 'wuetend' 'traurig'
                   'ueberrascht' 'erschrocken' 'schlafend' 'muede' 'gaehnen' 'schmerz' 'benommen' 'bewusstlos' 'tot' 'stolz'
                   'entschlossen' 'konzentriert' 'skeptisch' 'nachdenklich'; Unbekanntes → 'neutral'
                   (Start: look.ausdruck; bleibt bei setLook erhalten, außer der Teil-Look setzt ausdruck)
ausdruck           aktueller Ausdruck (nur lesen)
setLider(zu)       0 = Lider wie Ausdruck … 1 = geschlossen (müde, zwinkern; additiv zum Blinzeln)
blinzeln(dauer)    einmal blinzeln (Standard 0,16 s; schaltet das automatische Blinzeln ab – der Aufrufer steuert dann)
setBlick(x, y)     Pupillen −1…1 (x + = zur linken Seite der Figur/+X, y + = hoch)
setAugen(yaw, nick, lid)  für den Animator: Blick in rad (±0,5 Anschlag; yaw + = +X, nick + = nach unten), lid 0…1 = Lidschluss
updateGesicht(dt)  pro Frame aufrufen (nötig, damit Blinzeln abläuft): Blinzel-Animation + automatisches Blinzeln alle 2–6 s (seed-deterministisch)
gesicht            das Objekt aus createGesicht (oder null), z. B. gesicht.autoBlinzeln = false

### character-parts-basis · `engine/models/character/character-parts-basis.js` · v1.0.0 · entwurf
Gemeinsame Helfer der Figuren-Bau-Funktionen: Farben mischen/abdunkeln, Kugel- und Zylinder-Ausschnitte in einen mesh-builder

- `farbeMisch(a,b,t) -> int`
- `dunkler(c,t) -> int`
- `heller(c,t) -> int`
- `GOLD`
- `LEDER`
- `schale(b,r,farbe,t,opts)`
- `mantelFlaeche(b,rO,rU,h,farbe,t,opts)`

```js
import { farbeMisch, schale } from '../../engine/models/character/character-parts-basis.js';
schale(b, 0.2, 0x804020, { y: 0.2 }, { thL: Math.PI / 2 });   // Halbkugel-Kappe
```

Genutzt von: – · Tags: figur, charakter, farbe, mesh, hilfen · THREE: ja

### character-parts-becken · `engine/models/character/character-parts-becken.js` · v1.0.0 · entwurf
Bau-Funktion für das Figuren-Becken (Knochen becken): Hüfte, Gürtel, Gürteltasche, Kittelsaum, Rock, Mantelschöße, Schürze, Lederstreifen

- `baueBecken(b,ctx) -> b`

```js
import { baueBecken } from '../../engine/models/character/character-parts-becken.js';
rig.knochen.becken.add(baueBecken(createMeshBuilder({ seed }), teilKontext(look, masse)).mesh());
```

Genutzt von: – · Tags: figur, charakter, kleidung, rock, gürtel, tasche, mantel, schürze · THREE: ja

### character-parts-gesicht · `engine/models/character/character-parts-gesicht.js` · v1.0.0 · entwurf
Bewegliches Figuren-Gesicht im Knochen kopf: Iris/Pupillen (Blick), Lider (Blinzeln, Öffnung), Brauen + Mund je Gesichtsausdruck – nur 3 kleine Meshes

- `AUSDRUCK_DATEN`
- `createGesicht(ctx, { seed, material, schatten }) -> { gruppe, meshes, ausdruck, autoBlinzeln, setAusdruck(name), setLider(zu), blinzeln(dauer), setBlick(x,y), setAugen(yaw,nick,lid), update(dt), dispose() }`

```js
import { createGesicht } from '../../engine/models/character/character-parts-gesicht.js';
const g = createGesicht(teilKontext(look, masse, { mimik: true }), { seed: 3 });
rig.knochen.kopf.add(g.gruppe);
g.setAusdruck('froh'); g.setBlick(0.5, 0);   // pro Frame: g.update(dt) → automatisches Blinzeln
```

Genutzt von: – · Tags: figur, charakter, gesicht, mimik, augen, blinzeln, ausdruck, emotion, blick · THREE: ja
Normalerweise über character-model benutzt (model.setAusdruck usw.). Der Kopf selbst muss mit ctx.mimik = true gebaut
sein (nur Augäpfel), sonst liegen festes und bewegliches Gesicht übereinander.
Lider: zu = 0 offen … 1 geschlossen. Effektive Öffnung = Ausdruck.offen · (1 − max(setLider, Blinzeln)).

### character-parts-haar · `engine/models/character/character-parts-haar.js` · v1.0.0 · entwurf
Bau-Funktionen für Frisuren und Bärte im Knochen kopf (Kopfkugel um y = R, Gesicht nach +Z); beachtet Kopfbedeckungen

- `baueFrisur(b,ctx) -> b`
- `baueBart(b,ctx) -> b`

```js
import { baueFrisur, baueBart } from '../../engine/models/character/character-parts-haar.js';
baueBart(baueFrisur(b, ctx), ctx);
```

Genutzt von: – · Tags: figur, charakter, kopf, haar, frisur, bart, locken, zopf · THREE: ja

### character-parts-hut · `engine/models/character/character-parts-hut.js` · v1.0.0 · entwurf
Bau-Funktion für Kopfbedeckungen im Knochen kopf (eigenes Mesh): Kapuze, Hüte, Helme, Kronen, Tücher, Turban

- `baueKopfbedeckung(b,ctx) -> b`
- `deckendeKopfbedeckung(stil) -> bool`

```js
import { baueKopfbedeckung } from '../../engine/models/character/character-parts-hut.js';
rig.knochen.kopf.add(baueKopfbedeckung(createMeshBuilder({ seed }), ctx).mesh());
```

Genutzt von: – · Tags: figur, charakter, kopf, hut, helm, krone, kapuze, zauberhut, dreispitz, turban · THREE: ja

### character-parts-kopf · `engine/models/character/character-parts-kopf.js` · v1.1.0 · entwurf
Bau-Funktion für den Figuren-Kopf: Kopfform, Ohren, Nase, festes Gesicht (oder nur Augäpfel, wenn das bewegliche Gesicht aktiv ist), Frisur, Bart, Brille, Ohrringe; bündelt Kopfbedeckungen

- `baueKopf(b,ctx) -> b`
- `baueKopfbedeckung(b,ctx) -> b`
- `deckendeKopfbedeckung(stil) -> bool`
- `AUGE -> { x, y, z, r, sz } (Augen-Lage in Einheiten von R)`

```js
import { baueKopf, baueKopfbedeckung } from '../../engine/models/character/character-parts-kopf.js';
const ctx = teilKontext(look, masse);
rig.knochen.kopf.add(baueKopf(createMeshBuilder({ seed }), ctx).mesh());
```

Genutzt von: – · Tags: figur, charakter, kopf, gesicht, haar, frisur, bart, hut, helm, krone, brille · THREE: ja
1.1: Frisuren/Bärte → character-parts-haar, Kopfbedeckungen → character-parts-hut (hier weiter exportiert);
   Brille + Ohrringe; ctx.mimik = true → nur Augäpfel (Iris, Lider, Brauen, Mund baut character-parts-gesicht).

### character-parts-ruecken · `engine/models/character/character-parts-ruecken.js` · v1.0.0 · entwurf
Bau-Funktionen für Rücken-Teile einer Figur: Umhang (kurz, lang, Kragen-Cape) am Sockel umhang, Rucksack am Sockel ruecken

- `baueUmhang(b,ctx) -> b`
- `baueRucksack(b,ctx) -> b`

```js
import { baueUmhang } from '../../engine/models/character/character-parts-ruecken.js';
rig.sockel.umhang.add(baueUmhang(createMeshBuilder({ seed }), teilKontext(look, masse)).mesh());
```

Genutzt von: – · Tags: figur, charakter, umhang, cape, rucksack · THREE: ja

### character-parts-torso · `engine/models/character/character-parts-torso.js` · v1.0.0 · entwurf
Bau-Funktion für den Figuren-Oberkörper (Knochen torso) je Oberteil-Stil: Kittel, Hemd, Robe, Rüstung, Weste, Kleid, Mantel, Schürze, Kettenhemd, Lederrüstung

- `baueTorso(b,ctx) -> b`

```js
import { baueTorso } from '../../engine/models/character/character-parts-torso.js';
rig.knochen.torso.add(baueTorso(createMeshBuilder({ seed }), teilKontext(look, masse)).mesh());
```

Genutzt von: – · Tags: figur, charakter, kleidung, oberteil, rüstung, mantel, schürze · THREE: ja

### character-parts-zubehoer · `engine/models/character/character-parts-zubehoer.js` · v1.0.0 · entwurf
Bau-Funktionen für Accessoires: Schal/Halstuch/Pelzkragen und Halsschmuck (Knochen torso), Brille/Augenklappe/Monokel und Ohrringe (Knochen kopf)

- `baueZubehoer(b,ctx) -> b`
- `baueBrille(b,ctx) -> b`
- `baueOhrringe(b,ctx) -> b`
- `hatZubehoer(ctx) -> bool`

```js
import { baueZubehoer, hatZubehoer } from '../../engine/models/character/character-parts-zubehoer.js';
if (hatZubehoer(ctx)) rig.knochen.torso.add(baueZubehoer(createMeshBuilder({ seed }), ctx).mesh());
```

Genutzt von: – · Tags: figur, charakter, accessoire, schal, schmuck, kette, amulett, brille, augenklappe, monokel, ohrringe · THREE: ja

### character-parts · `engine/models/character/character-parts.js` · v1.1.0 · entwurf
Bau-Funktionen für Figuren-Körperteile je Knochen aus Look + Körpermaßen: Kontext, Hals, Arme, Hände, Beine, Füße; bündelt Torso, Becken, Umhang, Rucksack, Zubehör

- `teilKontext(look,masse,opts?) -> ctx`
- `baueTorso(b,ctx)`
- `baueHals(b,ctx)`
- `baueBecken(b,ctx)`
- `baueOberarm(b,ctx)`
- `baueUnterarm(b,ctx)`
- `baueHand(b,ctx)`
- `baueOberschenkel(b,ctx)`
- `baueUnterschenkel(b,ctx)`
- `baueFuss(b,ctx)`
- `baueUmhang(b,ctx)`
- `baueRucksack(b,ctx)`
- `baueZubehoer(b,ctx)`
- `farbeMisch(a,b,t) -> int`

```js
import { teilKontext, baueTorso } from '../../engine/models/character/character-parts.js';
const b = createMeshBuilder({ seed: 3 }), ctx = teilKontext(look, koerperMasse(look));
rig.knochen.torso.add(baueTorso(b, ctx).mesh());
```

Genutzt von: – · Tags: figur, charakter, kleidung, mesh, lowpoly, körper, umhang, rucksack, schuhe · THREE: ja
1.1: neue Stile (Mantel, Schürze, Kettenhemd, Lederrüstung, Pluderhose, Sandalen, Schnabelschuhe, Kragen-Umhang),
   Körper schultern/muskeln, Zubehör (Schal, Halsschmuck), ctx.mimik (Kopf ohne festes Gesicht für character-parts-gesicht).
   Torso/Becken/Umhang/Rucksack liegen jetzt in eigenen Dateien und werden hier weiter exportiert.

### character-pose · `engine/models/character/character-pose.js` · v1.1.0 · entwurf
Posen einer Figur als reine Daten: leere Pose, kopieren, mischen, addieren, maskieren (Ober-/Unterkörper, Arme) und aufs Rig anwenden

- `POSE_KNOCHEN`
- `GANZ`
- `OBERKOERPER`
- `UNTERKOERPER`
- `BEINE`
- `ARM_L`
- `ARM_R`
- `ARME`
- `KOPF`
- `RUMPF`
- `MASKEN`
- `maskeVon(name|liste) -> liste`
- `teilMaske(name) -> bool`
- `leerePose() -> pose`
- `kopierePose(a,out) -> out`
- `mischePose(a,b,t,out,maske) -> out`
- `addierePose(a,b,gewicht,out) -> out`
- `maskiere(pose,maske) -> pose`
- `skalierePose(pose,f,out) -> out`
- `wendeAn(rig,pose) -> rig`

```js
import { leerePose, mischePose, wendeAn, OBERKOERPER } from '../../engine/models/character/character-pose.js';
const p = leerePose();
mischePose(gangPose, schlagPose, 0.8, p, OBERKOERPER);   // nur Oberkörper überblenden
wendeAn(rig, p);
```

Genutzt von: – · Tags: figur, charakter, pose, animation, mischen, maske, rig · THREE: nein

### character-reaktion · `engine/models/character/character-reaktion.js` · v1.0.0 · entwurf
Prozedurale Treffer-Reaktion (rein): Stoß aus Richtung + Stärke als abklingende additive Pose; Umfallen als Ragdoll-Ersatz ohne Physik-Engine (Kippen, Aufprall, schlaffe Glieder)

- `createReaktion({seed,staerke}) -> { treffer(richtung,staerke), umfallen(richtung,{staerke}), aufstehen(dauer), update(dt) -> pose(additiv), anwenden(pose,gewicht), fallPose(out,skal) -> pose, pose, faellt, liegt, fallGewicht, aktiv, reset(), dispose() }`
- `richtungLokal(welt,yaw) -> {x,z}`

```js
import { createReaktion } from '../../engine/models/character/character-reaktion.js';
const re = createReaktion({ seed: 4 });
re.treffer({ x: 0, z: -1 }, 0.8);         // Stoß von vorn: Figur wird nach hinten (−Z) gedrückt
addierePose(pose, re.update(dt), 1, pose);
re.umfallen({ x: 0, z: -1 });              // nach hinten umkippen; mischePose(pose, re.fallPose(), re.fallGewicht, pose)
```

Genutzt von: – · Tags: figur, charakter, animation, treffer, reaktion, tod, ragdoll, umfallen, kampf · THREE: nein

### character-rig · `engine/models/character/character-rig.js` · v1.0.0 · entwurf
Prozedurales Skelett einer Menschen-Figur aus Gruppen (keine Skinning-Knochen): feste Gelenknamen, Ruhepose, Sockel für Hut/Waffe/Rucksack

- `KNOCHEN`
- `SOCKEL`
- `createRig(masse) -> { root, knochen, sockel, masse, anpassen(masse), ruhepose(), dispose() }`

```js
import { createRig } from '../../engine/models/character/character-rig.js';
const rig = createRig(koerperMasse(look));
rig.knochen.schulterR.rotation.x = -0.8;   // rechten Arm nach vorn heben
rig.sockel.handR.add(schwert);
```

Genutzt von: – · Tags: figur, charakter, skelett, rig, gelenke, animation, sockel · THREE: ja

### character-sekundaer · `engine/models/character/character-sekundaer.js` · v1.0.0 · entwurf
Sekundäre Bewegung (rein): Feder-Dämpfer für Kopf-Nachschwingen, Gewichtsverlagerung beim Anhalten/Anfahren, Umhang- und Haar-Winkel – additiv auf eine Pose

- `createFeder({steif,daempf,wert}) -> { wert, v, schritt(dt,ziel,kraft), stoss(dv), setze(w) }`
- `createSekundaer(opts) -> { update(dt,info) -> werte, anwenden(pose,gewicht) -> pose, werte, stoss(vor,seit,hoch), reset(), dispose() }`

```js
import { createSekundaer } from '../../engine/models/character/character-sekundaer.js';
const sek = createSekundaer({ staerke: 1 });
sek.update(dt, { tempo, beschl, quer: tempo * drehRate, vy, amBoden });
sek.anwenden(pose);                         // Torso/Hals/Kopf schwingen nach (Beine bleiben unberührt)
umhang.rotation.x = sek.werte.umhangX;      // Umhang/Haar-Teile selbst drehen
```

Genutzt von: – · Tags: figur, charakter, animation, feder, sekundaer, nachschwingen, umhang, haar, gewicht · THREE: nein

### figur-form · `engine/models/character/figur-form.js` · v1.0.0 · entwurf
SDF-Baukasten für organische Figuren: weich verschmelzende Körper (Kapsel, Ellipsoid, Rundbox, Ring) mit Farbe und Knochen-Gewichten je Körper – Grundlage für den einteiligen, gehäuteten Figurenkörper

- `createFigurForm({ glatt }) -> { kapsel(a,b,ra,rb,o), kugel(m,r,o), ellipsoid(m,radien,o), rundbox(m,halb,rund,o), ring(m,R,r,o), abstand(x,y,z), normale(x,y,z,out,eps), grenzen(), eingrenzen(min,max,rand), einfluss(x,y,z,{farbSchaerfe,knochenWeich}) -> {farbe:[r,g,b], knochen:{name:w}, rauh, haut}, anzahl, spiel }`

```js
import { createFigurForm } from '../../engine/models/character/figur-form.js';
import { sdfNetz } from '../../engine/core/sdf-netz.js';
const f = createFigurForm({ glatt: 0.03 });
f.kapsel([0.2, 1.4, 0], [0.45, 1.1, 0], 0.05, 0.04, { knochen: 'schulterL', farbe: 0x4f7a5a });
f.ellipsoid([0, 1.2, 0], [0.16, 0.25, 0.1], { knochen: 'torso', farbe: 0x4f7a5a, dreh: [0.1, 0, 0] });
const netz = sdfNetz(f, { zelle: 0.012 });               // f erfüllt den Vertrag von sdf-netz
const e = f.einfluss(0.3, 1.3, 0);                        // e.farbe, e.knochen → Skinning
```

Genutzt von: – · Tags: sdf, figur, charakter, organisch, skinning, form, körper, kleidung · THREE: nein
Optionen o je Körper (alle optional):
knochen  'torso' | { torso: 0.7, becken: 0.3 } | (x,y,z) => ({ name: w })   – wem die Haut hier folgt (Skinning)
farbe    0xrrggbb (Vertexfarbe, wenn dieser Körper die Oberfläche bildet)
glatt    Breite der Verschmelzung mit allem VORHER Hinzugefügten in m (Standard: opts.glatt). Klein = Naht/Kante, groß = weich
abzug    true = weich abziehen statt vereinigen (Falten, Augenhöhlen, Mundspalt). farbe wird an der Höhlung genutzt
dreh     [rx, ry, rz] Euler XYZ in rad (Ellipsoid, Rundbox, Ring)
tief     Kapsel: Querschnitt in Blickrichtung (+Z) gestaucht (0.7 = flach von vorn nach hinten)
rauh     Amplitude in m für Rauschen auf diesem Körper (Kettenhemd, Fell, Stoff-Knitter), rauhSkala = Frequenz (1/m, Std. 60)
haut     true = Haut (Material/Shader kann das nutzen: Attribut „haut“ 0…1)
Reihenfolge zählt: jeder Körper wird mit dem bisherigen Ergebnis weich vereinigt (bzw. abgezogen).
Einheiten: Meter, Figur in Bindungs-Pose (A-Pose), Füße bei y = 0, Blick nach +Z, links = +X.

### figur-haar · `engine/models/character/figur-haar.js` · v1.0.0 · entwurf
Frisuren und Bärte der organischen Figur als weiche SDF-Körper (Haarkappe, Pony, Strähnen-Bündel, Zöpfe aus Kugelketten, Locken mit Rauschen) – Gesicht frei, Hut-tauglich

- `baueHaarForm(form, ctx) -> form`

```js
import { baueHaarForm } from './figur-haar.js';
baueHaarForm(form, formKontext(look, masse, rig));   // ruft figur-haut nach der Kleidung auf
```

Genutzt von: – · Tags: figur, charakter, organisch, sdf, haar, bart, frisur, zopf, locken · THREE: nein
Knochen kopf: Kopfkugel-Mitte (0, R, 0), Gesicht +Z, links +X. Frei bleiben: Augen R·(±0.34, 1.02, 0.86),
Brauen y ≈ 1.27R, Mund y ≈ 0.52R (z ≈ 0.9R). Hüte (starr) erwarten etwa eine Kugel R um (0, R, 0):
Kappe bleibt darum flach (≤ 1.08R), unter deckenden Hüten nur Haar am Rand (Regel wie character-parts-haar).

### figur-haut · `engine/models/character/figur-haut.js` · v1.0.0 · entwurf
Organischer Figurenkörper: Look → SDF-Form (Anatomie + Kleidung + Haar) → ein glattes Netz (Surface Nets) mit gebackener Umgebungsverdeckung → SkinnedMesh, das weich mit dem Rig mitbiegt

- `createFigurHaut({ look, masse, rig, material, zelle, mimik, schatten }) -> { mesh, kontext, dreiecke, ms, dispose() }`
- `formKontext(look, masse, rig, opts) -> ctx`
- `BINDE_POSE`

```js
import { createFigurHaut } from '../../engine/models/character/figur-haut.js';
const haut = createFigurHaut({ look, masse, rig, zelle: 0.012 });   // hängt sich selbst an rig.root
// character-model macht das mit createCharacterModel({ look, koerper: 'organisch' })
```

Genutzt von: – · Tags: figur, charakter, organisch, sdf, skinning, mesh, körper, haut · THREE: ja
Form-Kontext (für figur-koerper / figur-kleidung / figur-haar, alle ohne THREE):
alles aus teilKontext (character-parts): L, m, g, w, R, f (Farben als Zahlen), aermel, stil, taille, brust, tiefe, armR, beinR, rock, mimik
P(knochen, [x,y,z]) -> [x,y,z]   Punkt im Knochen-Raum (wie die alten Mesh-Teile: Gliedmaßen hängen nach −Y, Kopfkugel bei y = R)
                                 → Bindungs-Pose in Figur-Koordinaten (Füße y = 0, Blick +Z, links +X)
dreh(knochen, [rx,ry,rz]) -> Euler XYZ in Figur-Koordinaten (für o.dreh von Ellipsoid/Rundbox/Ring)
achse(knochen) -> [x,y,z]      Einheitsvektor entlang −Y des Knochens (Richtung der Gliedmaße)
Gebunden wird in einer A-Pose (BINDE_POSE: Arme gespreizt, Beine leicht auseinander), damit Arme und Beine nicht mit dem Rumpf verschmelzen.

### figur-kleidung-basis · `engine/models/character/figur-kleidung-basis.js` · v1.0.0 · entwurf
Gemeinsame Helfer für Kleidung und Haar der organischen Figur: Farben, Stoffdicke, Haut vermessen (Strahlen ins Abstandsfeld), Knochen-Gewichte (Rumpf, Rock), Glocke mit Saum

- `misch(a,b,t)`
- `dunkler(c,t)`
- `heller(c,t)`
- `GOLD`
- `LEDER`
- `stufe(a,b,x)`
- `masse(ctx) -> { e, L, rx(y), rz(y), T(y,x,z) }`
- `strahl(form,p,d) -> m`
- `messeHaut(form, ctx) -> haut`
- `kegel(n0,nm,n1,tm) -> [ra,rb]`
- `rumpfGewichte(ctx)`
- `rockGewichte(ctx, staerke)`
- `glocke(form, ctx, opts)`

```js
import { masse, glocke } from './figur-kleidung-basis.js';
const M = masse(ctx);  glocke(form, ctx, { yOben, yUnten, rOben, rUnten, farbe, saum });
```

Genutzt von: – · Tags: figur, charakter, organisch, sdf, kleidung, rock, saum, skinning · THREE: nein

### figur-kleidung-oben · `engine/models/character/figur-kleidung-oben.js` · v1.0.0 · entwurf
Oberteil der organischen Figur als SDF-Körper: Rumpf-Hülle, Schulterpartie, Kragen/Ausschnitt, Ärmel, Säume, Knöpfe, Rüstungsplatten – je Oberteil-Stil

- `baueOberteil(form, ctx, haut) -> form`
- `baueAermel(form, ctx, haut) -> form`
- `platte(form, a, b, breite, farbe, knochen)   (haut = messeHaut aus figur-kleidung-basis)`

```js
import { baueOberteil, baueAermel } from './figur-kleidung-oben.js';
const haut = messeHaut(form, ctx);  baueAermel(baueOberteil(form, ctx, haut), ctx, haut);
```

Genutzt von: – · Tags: figur, charakter, organisch, sdf, kleidung, oberteil, ärmel, rüstung, robe, mantel · THREE: nein

### figur-kleidung-unten · `engine/models/character/figur-kleidung-unten.js` · v1.0.0 · entwurf
Unterteil der organischen Figur als SDF-Körper: Hose (lang, kurz, Pluder), Röcke/Roben/Mantelschöße mit Saum, Schürze, Gürtel mit Schnalle und Tasche, Schuhe je Stil

- `baueUnterteil(form, ctx, haut) -> form`
- `baueGuertel(form, ctx, haut) -> form`
- `baueSchuhe(form, ctx, haut) -> form   (haut = messeHaut)`

```js
import { baueUnterteil, baueGuertel, baueSchuhe } from './figur-kleidung-unten.js';
const haut = messeHaut(form, ctx);  baueUnterteil(form, ctx, haut); baueGuertel(form, ctx, haut); baueSchuhe(form, ctx, haut);
```

Genutzt von: – · Tags: figur, charakter, organisch, sdf, kleidung, hose, rock, robe, gürtel, tasche, schuhe, stiefel · THREE: nein

### figur-kleidung · `engine/models/character/figur-kleidung.js` · v1.0.0 · entwurf
Kleidung der organischen Figur als SDF-Körper über der Anatomie: Oberteil mit Ärmeln, Hose/Rock/Robe, Gürtel + Tasche, Schuhe – je Stil aus character-look

- `baueKleidungForm(form, ctx) -> form`

```js
import { baueKleidungForm } from './figur-kleidung.js';
baueKleidungForm(form, formKontext(look, masse, rig));   // ruft figur-haut nach baueKoerperForm auf
```

Genutzt von: – · Tags: figur, charakter, organisch, sdf, kleidung, oberteil, hose, rock, robe, gürtel, schuhe · THREE: nein
Aufteilung: figur-kleidung-oben (Rumpf, Kragen, Ärmel, Rüstung), figur-kleidung-unten (Hose, Rock, Schürze, Gürtel, Schuhe),
figur-kleidung-basis (Haut vermessen, Gewichte, Glocke mit Saum). Stoff liegt ≈ 9 mm über der GEMESSENEN Haut
(Strahlen ins Abstandsfeld der fertigen Anatomie) – passt so zu jedem Körperbau.
Reihenfolge: Hose/Rock vor dem Oberteil, damit Kittelsäume und Gürtel darüber liegen; Schuhe zuletzt.
Nicht hier (bleiben starre Teile): Kopfbedeckung, Umhang, Rucksack, Schal/Halsschmuck, Brille, Ohrringe, Augen.

### figur-koerper-kopf · `engine/models/character/figur-koerper-kopf.js` · v1.0.0 · entwurf
Hals und Kopf der organischen Figur als SDF-Körper: Schädel, Kiefer/Kinn, Wangenknochen, Brauenbogen, Augenhöhlen (passend zu den starren Augäpfeln), Nase, Ohren (Mund = Mimik-Mesh)

- `baueKopfForm(form, ctx, hilfe) -> form`

```js
import { baueKopfForm } from '../../engine/models/character/figur-koerper-kopf.js';
baueKopfForm(form, ctx, hilfe);   // wird von baueKoerperForm (figur-koerper) aufgerufen
```

Genutzt von: – · Tags: figur, charakter, organisch, sdf, kopf, gesicht, hals · THREE: nein
Kopf-Raum wie character-parts-kopf: Kopfkugel-Mitte bei (0, R, 0) im Knochen kopf, Gesicht +Z, links +X.
Augäpfel (AUGE: ±0.34R, 1.02R, 0.86R, Radius 0.17R, z × 0.55) bleiben starre Meshes → hier nur Lider-Rahmen/Höhle.
Mimik (Brauen z ≈ 0.88R, Mund y ≈ 0.52R) liegt auf der Gesichtsfläche bei z ≈ 0.86–0.9R.

### figur-koerper · `engine/models/character/figur-koerper.js` · v1.0.0 · entwurf
Anatomie der organischen Figur als SDF-Körper: Rumpf (Brustkorb, Taille, Bauch, Becken, Gesäß, Trapez, Schultermuskeln), Arme, Hände mit Daumen (Griff am Sockel umschlossen), Beine, Füße mit flacher Sohle; Hals + Kopf in figur-koerper-kopf

- `baueKoerperForm(form, ctx) -> form`

```js
// figur-haut ruft das auf: baueKoerperForm(form, formKontext(look, masse, rig)) – danach Kleidung und Haar
```

Genutzt von: – · Tags: figur, charakter, organisch, sdf, anatomie, körper, hand, fuss · THREE: nein
Alle Punkte im Knochen-Raum über ctx.P (Bindungs-Pose = A-Pose): Gliedmaßen hängen nach −Y vom Gelenk, vorn +Z, links +X.
Reihenfolge: Rumpf → Kopf → Beine → Arme. Gliedmaßen verschmelzen nur an Hüfte/Schulter mit dem Rumpf (kleines glatt).
Kinder (L.koerper.groesse < 1) werden rundlicher und weicher, Muskeln (L.koerper.muskeln) formen Brust, Schultern, Arme, Waden.

### hase · `engine/models/kreaturen/hase.js` · v1.0.0 · entwurf
Low-Poly-Feldhase (kleines Wild): runder Rumpf, kräftige Hinterläufe, lange Ohren mit schwarzen Spitzen, weiße Blume; zwei Sprung-Bild-Geometrien (Vertexfarben) für InstancedMesh

- `createHase({ seed, fell, bauch, dunkel, laenge }) -> { frames:[geoBild0, geoBild1], laenge, hoehe, breite, dispose() }`

```js
import { createHase } from '../../engine/models/kreaturen/hase.js';
const hase = createHase({ seed: 2 });
const hm = createHordeMesh({ modelle: { hase: hase.frames }, max: 40 });
// Nase nach +Z, Pfoten auf y = 0; ≈ 0.6 m lang, Ohrspitzen ≈ 0.5 m; Bild 0 = geduckt, Bild 1 = gestreckt im Sprung
```

Genutzt von: erde · Tags: hase, wild, kreatur, jagd, tier, klein, lowpoly, instancing, modell · THREE: ja

### irrlicht · `engine/models/kreaturen/irrlicht.js` · v1.0.0 · entwurf
Low-Poly-Irrlicht (Moorgeist): hell leuchtender Kern, Halo und wehende Schleier; zwei Schwebe-Bild-Geometrien (Vertexfarben)

- `createIrrlicht({ seed, kern, halo, schleier, laenge }) -> { frames:[geoBild0, geoBild1], laenge, hoehe, breite, dispose() }`

```js
import { createIrrlicht } from '../../engine/models/kreaturen/irrlicht.js';
const ir = createIrrlicht({ seed: 3 });
const hm = createHordeMesh({ modelle: { irrlicht: ir.frames }, max: 30 });
// Ursprung = Schleierspitze auf y = 0 (die Horde hebt das Wesen per def.schwebe an); ≈ 1 m hoch, Gesicht nach +Z
```

Genutzt von: – · Tags: irrlicht, moor, geist, kreatur, gegner, horde, lowpoly, leuchten, modell · THREE: ja

### keiler · `engine/models/kreaturen/keiler.js` · v1.0.0 · entwurf
Low-Poly-Keiler (Wildschwein) als Horden-Gegner: massig, Borstenkamm, Hauer; zwei Lauf-Bild-Geometrien (Vertexfarben)

- `createKeiler({ seed, fell, borsten, haut, hauer, augen, laenge }) -> { frames:[geoBild0, geoBild1], laenge, hoehe, breite, dispose() }`

```js
import { createKeiler } from '../../engine/models/kreaturen/keiler.js';
const keiler = createKeiler({ seed: 2 });
const hm = createHordeMesh({ modelle: { keiler: keiler.frames }, max: 40 });
// Rüssel nach +Z, Hufe auf y = 0; ≈ 1.4 m lang, 0.95 m hoch
```

Genutzt von: erde · Tags: keiler, wildschwein, kreatur, gegner, horde, lowpoly, instancing, modell · THREE: ja

### ratte · `engine/models/kreaturen/ratte.js` · v1.0.0 · entwurf
Low-Poly-Riesenratte als Horden-Gegner: liefert zwei Lauf-Bild-Geometrien (Vertexfarben) für InstancedMesh

- `createRatte({ seed, fell, bauch, haut, augen, laenge }) -> { frames:[geoBild0, geoBild1], laenge, hoehe, breite, dispose() }`

```js
import { createRatte } from '../../engine/models/kreaturen/ratte.js';
import { standardMaterial } from '../../engine/render/mesh-builder.js';
const ratte = createRatte({ seed: 1 });
const bilder = ratte.frames.map((g) => new THREE.InstancedMesh(g, standardMaterial(), 120));
// Nase zeigt nach +Z, Füße auf y = 0, Ursprung unter der Rumpfmitte, Schwanz nach −Z
```

Genutzt von: enklave, figuren · Tags: ratte, kreatur, gegner, horde, lowpoly, instancing, modell · THREE: ja

### reh · `engine/models/kreaturen/reh.js` · v1.0.0 · entwurf
Low-Poly-Reh (Wild, scheu): schlanker Rumpf, langer Hals, große Ohren, weißer Spiegel, Bock mit kleinem Gehörn; zwei Lauf-Bild-Geometrien (Vertexfarben) für InstancedMesh

- `createReh({ seed, fell, bauch, dunkel, spiegel, bock, laenge }) -> { frames:[geoBild0, geoBild1], laenge, hoehe, breite, dispose() }`

```js
import { createReh } from '../../engine/models/kreaturen/reh.js';
const reh = createReh({ seed: 4 });
const hm = createHordeMesh({ modelle: { reh: reh.frames }, max: 30 });
// Nase nach +Z, Hufe auf y = 0, Ursprung unter der Rumpfmitte; ≈ 1.15 m lang, 0.75 m Schulterhöhe, Kopf ≈ 1.05 m
```

Genutzt von: erde · Tags: reh, wild, kreatur, jagd, tier, lowpoly, instancing, modell · THREE: ja

### wolf · `engine/models/kreaturen/wolf.js` · v1.0.0 · entwurf
Low-Poly-Wolf als Horden-Gegner (und Boss-Wolf per Skala): zwei Lauf-Bild-Geometrien (Vertexfarben) für InstancedMesh

- `createWolf({ seed, fell, bauch, dunkel, augen, laenge }) -> { frames:[geoBild0, geoBild1], laenge, hoehe, breite, dispose() }`

```js
import { createWolf } from '../../engine/models/kreaturen/wolf.js';
const wolf = createWolf({ seed: 1 });
const hm = createHordeMesh({ modelle: { wolf: wolf.frames }, max: 60 });
// Nase nach +Z, Pfoten auf y = 0, Ursprung unter der Rumpfmitte, Rute nach −Z; ≈ 1.3 m lang, 0.8 m Schulterhöhe
```

Genutzt von: erde · Tags: wolf, kreatur, gegner, horde, boss, lowpoly, instancing, modell · THREE: ja

### astbaum · `engine/models/natur/astbaum.js` · v1.0.0 · entwurf
Baum mit sichtbaren Ästen, feinen Zweigen und echten Blättern (Blatt-Büschel statt Kugel-Kronen) als EINE Geometrie mit weichen Normalen, Vertexfarben + Wind

- `ASTBAUM_ARTEN [typ…]`
- `kannAstbaum(typ) -> bool`
- `baueAstbaum(typ, seed, { detail 0|1|2, jahreszeit, dichte, blattGroesse }) -> { geometrie, hoehe, radius, stammRadius, kroneMitte, kroneRadius }`
- `baueAstbaumFern(typ, seed, { jahreszeit }) -> geometrie (~45 Dreiecke: Stamm + bis zu 5 Laub-Klumpen an den Hauptästen, für große Entfernung)`

```js
import { baueAstbaum } from '../../engine/models/natur/astbaum.js';
const { geometrie } = baueAstbaum('eiche', 7, { detail: 2 });   // nah: Zweige + ~500 Blatt-Büschel
// Material: weich (kein flatShading), side: DoubleSide, Normalen NICHT umdrehen (Krone wird von außen beleuchtet)
```

Genutzt von: erde · Tags: natur, baum, aeste, zweige, blaetter, laub, nadeln, lod, wind, prozedural · THREE: ja

### baum-arten · `engine/models/natur/baum-arten.js` · v1.0.0 · entwurf
Reine Parameter-Daten der Baumarten (Wuchs, Verzweigung, Laubform, Farben, Jahreszeiten) für baum-skelett/baum

- `ARTEN { typ: art }`
- `ART_NAMEN [typ…]`
- `art(typ) -> art (wirft bei unbekanntem Typ)`

```js
import { art } from '../../engine/models/natur/baum-arten.js';
const birke = art('birke');   // { stamm, ordnungen, aeste, winkel, laub, rinde, … }
```

Genutzt von: – · Tags: natur, baum, daten, parameter, art · THREE: nein

### baum-skelett · `engine/models/natur/baum-skelett.js` · v1.0.0 · entwurf
Ast-Skelett eines Baums aus Art-Parametern + Seed: rekursive Verzweigung mit Tropismus, Krümmung, Verjüngung, Laub-Knoten und Nadel-Etagen (reine Logik)

- `baueSkelett(art, seed, opts) -> { aeste[{punkte,radien,wind,ordnung,laenge}], laub[{pos,richtung,groesse,wind,ordnung}], etagen[{pos,radius,hoehe}], spitze, stammRadius, maxOrdnung, groesse }`
- `maxOrdnung(art, detail, opts) -> int`

```js
import { art } from '../../engine/models/natur/baum-arten.js';
import { baueSkelett } from '../../engine/models/natur/baum-skelett.js';
const sk = baueSkelett(art('eiche'), 42, { detail: 1, alter: 1 });
sk.aeste.length; sk.laub.length;
```

Genutzt von: – · Tags: natur, baum, skelett, verzweigung, prozedural, l-system · THREE: nein

### baum · `engine/models/natur/baum.js` · v1.0.0 · entwurf
Prozedurale Low-Poly-Bäume (14 Arten) als EINE Geometrie mit Vertexfarben + Wind-Attribut; Jahreszeit, Alter, Detailstufe

- `TYPEN [typ…]`
- `erzeuge(typ, seed, opts) -> { geometrie, hoehe, radius, stammRadius }  (opts: detail 0|1|2, jahreszeit sommer|herbst|winter, alter 0..1)`

```js
import { erzeuge } from '../../engine/models/natur/baum.js';
import { standardMaterial } from '../../engine/render/mesh-builder.js';
const { geometrie, hoehe } = erzeuge('birke', 7, { detail: 1, jahreszeit: 'herbst' });
szene.add(new THREE.Mesh(geometrie, standardMaterial()));
```

Genutzt von: erde, natur · Tags: natur, baum, wald, vegetation, lowpoly, prozedural, wind, jahreszeit · THREE: ja

### fels-basis · `engine/models/natur/fels-basis.js` · v1.0.0 · neu
Kleine Helfer für Felsen/Totholz: Dreiecke mit Flächenfarben sammeln → nicht-indizierte BufferGeometry (position, normal, color, wind=0), Farb-Mischen

- `createSammler() -> { netz(punkte, dreiecke, farbFn), dreieck(a,b,c,rgb), anzahl(), geometrie(), dispose() }`
- `rgb(hex)`
- `mische(a,b,t)`
- `hell(c,f)`
- `glatt(a,b,x)`

```js
import { createSammler, rgb } from '../../engine/models/natur/fels-basis.js';
const s = createSammler();
s.netz(punkte, dreiecke, (n, m) => rgb(0x888880));   // n = Flächennormale, m = Mittelpunkt
const geo = s.geometrie();
```

Genutzt von: – · Tags: natur, fels, geometrie, vertexfarben · THREE: ja

### fels-form · `engine/models/natur/fels-form.js` · v1.0.0 · neu
Reine Fels-Grundform (ohne THREE): Ico- oder Säulen-Netz, verformt mit fBm/Grat, planare Bruchkanten, Schichtung, Erosion oben, flacher Boden

- `felsForm(opts) -> { punkte: Float32Array(xyz), dreiecke: Uint32Array, hoehe, radius }`
- `icoNetz(frequenz)`
- `saeulenNetz(segmente, ringe, r)`

```js
import { felsForm } from '../../engine/models/natur/fels-form.js';
const f = felsForm({ seed: 7, groesse: [1.2, 0.8, 1], schnitte: 5, schichten: 3 });
// f.punkte (x,y,z je Ecke), f.dreiecke (Indizes, außen gegen den Uhrzeigersinn)
```

Genutzt von: – · Tags: natur, fels, stein, prozedural, geometrie, lowpoly · THREE: nein

### fels · `engine/models/natur/fels.js` · v1.0.0 · neu
Prozedurale Low-Poly-Felsen (Vertrag NATUR-ASSETS): fels, felsbrocken, findling, geroell, felsplatte, felsnadel – mit Gesteinsfarben, Schichtung, Moos, Schnee

- `TYPEN`
- `GESTEINE`
- `erzeuge(typ, seed, opts) -> { geometrie, hoehe, radius, stammRadius }  opts: { detail 0|1|2, gestein, moos 0..1, schnee 0..1, skala }`

```js
import { erzeuge } from '../../engine/models/natur/fels.js';
import { standardMaterial } from '../../engine/render/mesh-builder.js';
const { geometrie } = erzeuge('felsbrocken', 42, { gestein: 'granit', moos: 0.4 });
scene.add(new THREE.Mesh(geometrie, standardMaterial()));
```

Genutzt von: daemmerwald · Tags: natur, fels, stein, geroell, prozedural, lowpoly, vertexfarben · THREE: ja

### fundmodelle · `engine/models/natur/fundmodelle.js` · v1.0.0 · entwurf
Fundstücke als reine Dreieckslisten: Erzbrocken, Ammonit, Quarzdruse (lineare RGB-Vertexfarben, Meter)

- `baueFundmodell(art, seed=1) -> { positions:number[], colors:number[] }`

```js
import { baueFundmodell } from '../../engine/models/natur/fundmodelle.js'; const { positions, colors } = baueFundmodell('ammonit', 3);
```

Genutzt von: erde, gigantwelt · Tags: fund, erz, fossil, kristall, graben, asset · THREE: nein

### landschaftsgruppen · `engine/models/natur/landschaftsgruppen.js` · v1.0.0 · entwurf
Verbundene Kleinformen als ein Mesh: Wollgras, Pilzholz, Flechtenbank (für Instancing)

- `baueGruppe(art, seed) -> THREE.Mesh`

```js
import { baueGruppe } from '../../engine/models/natur/landschaftsgruppen.js'; const m = baueGruppe('wollgras', 7);
```

Genutzt von: erde, naturstimmungen · Tags: natur, pflanze, gruppe, asset, ufer, moor · THREE: ja

### laub-klumpen · `engine/models/natur/laub-klumpen.js` · v1.0.0 · entwurf
Dichtes Laub als Blatt-Karten-Klumpen (rein, ohne THREE): je Kronen-Büschel viele Karten in einem abgeflachten Ellipsoid, Kern dunkel, Rand hell; ausdünnen (LOD) und in Weltkoordinaten sammeln

- `laubKarten(krone, { seed, dichte = 1, groesse = 1, H = 110, kronenAb = 60, farben }) -> karten { anzahl, mitte Float32Array(3n), normale Float32Array(3n), farbe Float32Array(3n), daten Float32Array(3n) [halbeGroesse, tiefe 0..1, phase 0..1] }`
- `duenneKarten(karten, anteil, seed) -> karten`
- `sammleKarten([{ karten, matrix (16 Zahlen, spaltenweise wie THREE.Matrix4.elements), anteil = 1, seed }]) -> karten (Welt)`
- `LAUB_FARBEN`

```js
import { baueForm } from './riesenbaum-form.js';
import { laubKarten, sammleKarten } from './laub-klumpen.js';
const form = baueForm({ seed: 11, hoehe: 112 });
const k = laubKarten(form.krone, { seed: 11, H: 112, kronenAb: form.masse.kronenAb });
const welt = sammleKarten([{ karten: k, matrix: instanz.matrix.elements, anteil: 0.5 }]);   // → engine/render/laub-karten.js
```

Genutzt von: daemmerwald · Tags: natur, baum, riesenbaum, krone, laub, blatt, karten, lod, instanzen, daemmerwald · THREE: nein

### natur-assets · `engine/models/natur/natur-assets.js` · v1.1.0 · entwurf
Registry der Natur-Generatoren (Bäume, Felsen, Totholz, Büsche, Bodendecker, Wüste, Urwald-Unterwuchs): Typname → Generator, Asset bauen, Varianten-Cache mit gemeinsamen Geometrien

- `TYP_ZU_GENERATOR { typ: erzeuge }`
- `FAMILIEN { familie: [typ…] }`
- `familieVon(typ) -> string|null`
- `alleTypen() -> [typ…]`
- `erzeugeAsset(typ, seed, opts) -> { geometrie, hoehe, radius, stammRadius } | null`
- `varianteOpts(typ, variante, opts) -> opts`
- `createAssetCache({ varianten, detail, jahreszeit, seed, opts }) -> { holen(typ, variante), hat(typ), varianten, detail, jahreszeit, anzahl(), dispose() }`

```js
import { createAssetCache } from '../../engine/models/natur/natur-assets.js';
const cache = createAssetCache({ varianten: 4, jahreszeit: 'herbst' });
const { geometrie, hoehe } = cache.holen('eiche', 2);   // gleiche Geometrie bei jedem Aufruf
cache.dispose();
```

Genutzt von: daemmerwald, enklave, erde, figuren, handwerk, natur · Tags: natur, vegetation, baum, fels, busch, registry, cache, varianten, prozedural · THREE: ja

### natur-basis · `engine/models/natur/natur-basis.js` · v1.0.0 · entwurf
Gemeinsame Helfer für Natur-Assets: Dreiecke sammeln → nicht-indizierte Geometrie (position/normal/color/wind), Farben, Fake-AO, Schnee, Ast-Röhre, Laub-Blob, Kegel-Lage, Wedel

- `farbe(wert) -> [r,g,b]`
- `mische(a,b,t)`
- `variiere(f,r,staerke)`
- `abdunkeln(f,k)`
- `createTeile(opts) -> teile (dreieck, quad, anzahl, geometrie, dispose)`
- `roehre(teile,punkte,radien,opts)`
- `blob(teile,mitte,radius,opts)`
- `kegel(teile,basis,radius,hoehe,opts)`
- `wedel(teile,basis,richtung,laenge,opts)`

```js
import { createTeile, roehre, blob, farbe } from '../../engine/models/natur/natur-basis.js';
const t = createTeile({ seed: 5 });
roehre(t, [[0,0,0],[0,2,0]], [0.2, 0.1], { farbe: farbe('#6b4a2f'), wind: [0, 0.2] });
blob(t, [0, 2.6, 0], 1, { farbe: farbe('#4f8a3a'), wind: 0.8 });
const geo = t.geometrie();   // BufferGeometry mit position, normal, color, wind
```

Genutzt von: – · Tags: natur, baum, geometrie, lowpoly, vertexfarben, wind, merge, prozedural · THREE: ja

### naturfundus · `engine/models/natur/naturfundus.js` · v1.0.0 · entwurf
Kleiner Naturfundus: Fichte, Birke, Felsblöcke, Uferpflanzen, Steinpilz, Fische – je ein Mesh mit Vertexfarben, Fußpunkt im Ursprung, Meter

- `arten`
- `baueNaturAsset(art, seed=1) -> THREE.Mesh (Aufrufer gibt Geometrie + Material frei)`

```js
import { baueNaturAsset } from '../../engine/models/natur/naturfundus.js'; const m = baueNaturAsset('fichte', 3);
```

Genutzt von: erde, naturstimmungen · Tags: natur, baum, fels, pflanze, fisch, asset · THREE: ja

### pflanze-basis · `engine/models/natur/pflanze-basis.js` · v1.0.0 · entwurf
Sammler für Pflanzen-Geometrie: Dreiecke (ein-/zweiseitig, nach außen ausgerichtet), Bänder, Rohre, verformte Laubballen → EINE BufferGeometry mit position, normal, color, wind

- `createSammler({seed, jitter}) -> s (dreieck, dreieckAussen, dreieckZwei, band, rohr, ballen, geometrie, masse, ergebnis, dreiecke, r)`
- `bogen3(pkt, winkel, basis) -> [[x,y,z]…]`
- `seiteZu(winkel) -> [x,0,z]`

```js
import { createSammler, bogen3 } from '../../engine/models/natur/pflanze-basis.js';
const s = createSammler({ seed: 3 });
s.ballen([0, 0.5, 0], [0.5, 0.4, 0.5], 7, 4, () => [0.3, 0.6, 0.2], (y) => y);
const { geometrie, hoehe } = s.ergebnis({ stammRadius: 0.2 });
```

Genutzt von: – · Tags: natur, pflanze, geometrie, lowpoly, vertexfarben, wind · THREE: ja

### pflanze-blume · `engine/models/natur/pflanze-blume.js` · v1.0.0 · entwurf
Bauteile für Bodendecker: Blume (Stängel + Blüte je Sorte: Stern, Schale, Glocke, Pompon, Ähre) und Pilze (Fliegenpilz, Steinpilz, Hexenring) in einen Pflanzen-Sammler

- `baueBlume(s, r, { detail, jahreszeit, sorte, farbe })`
- `baueEinenPilz(s, r, pos, sorte, skala, detail)`
- `bauePilz(s, r, { detail, sorte })`

```js
import { createSammler } from '../../engine/models/natur/pflanze-basis.js';
import { baueBlume } from '../../engine/models/natur/pflanze-blume.js';
const s = createSammler({ seed: 4 }); baueBlume(s, rng(4), { detail: 1, sorte: 'mohn' });
```

Genutzt von: – · Tags: natur, pflanze, blume, pilz, bodendecker, lowpoly · THREE: ja

### pflanze-boden · `engine/models/natur/pflanze-boden.js` · v1.0.0 · entwurf
Prozedurale Low-Poly-Bodendecker: farn (gefiederte Wedel), grasbueschel (Halm-Fächer), blume (Sorten per Seed), pilz (Fliegenpilz/Steinpilz/Hexenring), schilf (Halme + Rohrkolben), seerose (liegt auf y≈0)

- `TYPEN`
- `erzeuge(typ, seed, { detail = 1, jahreszeit = 'sommer', sorte (blume/pilz), farbe (Blüte), groesse = 1 }) -> { geometrie, hoehe, radius, stammRadius }`

```js
import { erzeuge } from '../../engine/models/natur/pflanze-boden.js';
const gras = erzeuge('grasbueschel', 9);
const mohn = erzeuge('blume', 3, { sorte: 'mohn' });   // Sorten: BLUMEN_SORTEN in pflanze-formen.js
```

Genutzt von: daemmerwald · Tags: natur, pflanze, gras, farn, blume, pilz, schilf, seerose, bodendecker, lowpoly, wind · THREE: ja

### pflanze-busch · `engine/models/natur/pflanze-busch.js` · v1.0.0 · entwurf
Prozedurale Low-Poly-Büsche: busch (Laubballen + Zweige), beerenbusch (rote/blaue Beeren), ginster (Ruten mit gelben Blüten), zwergstrauch (flach, heidekrautig)

- `TYPEN`
- `erzeuge(typ, seed, { detail = 1, jahreszeit = 'sommer', beere: 'rot'|'blau', groesse = 1 }) -> { geometrie, hoehe, radius, stammRadius }`

```js
import { erzeuge } from '../../engine/models/natur/pflanze-busch.js';
const { geometrie } = erzeuge('beerenbusch', 42, { jahreszeit: 'herbst' });
szene.add(new THREE.Mesh(geometrie, standardMaterial()));
```

Genutzt von: – · Tags: natur, pflanze, busch, strauch, beeren, ginster, heide, lowpoly, wind · THREE: ja

### pflanze-formen · `engine/models/natur/pflanze-formen.js` · v1.0.0 · entwurf
Reine Form-Logik für Pflanzen (ohne THREE): Bögen für Halme/Wedel/Blätter, Rosetten-Layouts, Blüten- und Pilzsorten, Kaktusarme, Farbhelfer mit Jahreszeit

- `bogen(laenge, startWinkel, biegung, n) -> [[h,y],…]`
- `rosette(r, anzahl, opts) -> [{winkel,neigung,laenge}]`
- `blumenSorte(r, name?) -> sorte`
- `BLUMEN_SORTEN`
- `PILZ_SORTEN`
- `kaktusArme(r, hoehe, anzahl) -> [{ansatz,winkel,aus,hoch}]`
- `farbe(hex) -> [r,g,b]`
- `mische(a,b,t)`
- `hell(f,k)`
- `laubFarben(jahreszeit) -> {grund,hell,dunkel}`

```js
import { bogen, rosette, blumenSorte } from '../../engine/models/natur/pflanze-formen.js';
const halm = bogen(0.5, 1.4, 0.8, 4);           // 5 Punkte [horizontal, hoch]
const sorte = blumenSorte(rng(7));               // z. B. { name: 'mohn', form: 'schale', … }
```

Genutzt von: – · Tags: natur, pflanze, form, blume, halm, wedel, rosette, logik · THREE: nein

### pflanze-unterwuchs · `engine/models/natur/pflanze-unterwuchs.js` · v1.0.0 · entwurf
Prozeduraler Urwald-Unterwuchs: wedelfarn (gekrümmte Wedel-Karten mit gesägter Silhouette), busch_unterholz (Laubklumpen mit Blatt-Rand), moospolster (flache Kuppeln), wurzelschoessling (Wurzelknie mit Jungtrieb), laubstreu (flacher Laubfleck)

- `TYPEN`
- `erzeuge(typ, seed, { detail = 1, jahreszeit = 'sommer', groesse = 1 }) -> { geometrie, hoehe, radius, stammRadius }`
- `wedelBreite(t) -> 0..1`

```js
import { erzeuge } from '../../engine/models/natur/pflanze-unterwuchs.js';
const farn = erzeuge('wedelfarn', 3, { detail: 1 });   // ~0,6–1,1 m hoch, Wind in den Wedelspitzen
szene.add(new THREE.InstancedMesh(farn.geometrie, createNaturMaterial({ wind: true }), 500));
```

Genutzt von: – · Tags: natur, pflanze, farn, busch, moos, wurzel, laub, unterholz, urwald, bodendecker, lowpoly, wind · THREE: ja

### pflanze-wueste · `engine/models/natur/pflanze-wueste.js` · v1.0.0 · entwurf
Prozedurale Low-Poly-Wüstenpflanzen: kaktus (Kandelaber mit Armen), saeulenkaktus (gerippte Säule, evtl. Blüte), agave (Rosette spitzer, gekielter Blätter)

- `TYPEN`
- `erzeuge(typ, seed, { detail = 1, jahreszeit = 'sommer', bluete (true/false, sonst Zufall), groesse = 1 }) -> { geometrie, hoehe, radius, stammRadius }`

```js
import { erzeuge } from '../../engine/models/natur/pflanze-wueste.js';
const { geometrie, stammRadius } = erzeuge('kaktus', 12, { detail: 1 });
```

Genutzt von: – · Tags: natur, pflanze, wueste, kaktus, agave, sukkulente, lowpoly · THREE: ja

### riesenbaum-form · `engine/models/natur/riesenbaum-form.js` · v1.0.0 · entwurf
Reine Form eines Urwald-Riesen in echter Größe (ohne THREE): Stamm-Achse, Brettwurzeln, optionaler Wurzelbogen als SDF, dazu Maße und Kronen-Skelett

- `baueForm({ seed, hoehe = 110, stammRadius = 5.5, wurzeln = 7, wurzelWeite = 22, detail = 1, bogen = false }) -> { opts, sdf, naht, achse(y,out), radius(y), stoer(x,y,z), furche(x,y,z) -> 0..1, wurzeln [{ punkte, radien, streck, laenge, winkel }], krone { aeste, buschel, kronenRadius }, masse { hoehe, stammRadius, kronenAb, kronenRadius, grenzen, bogen? } }`

```js
import { baueForm } from '../../engine/models/natur/riesenbaum-form.js';
const form = baueForm({ seed: 7, bogen: true });
form.sdf.abstand(0, 5, 0) < 0;                 // im Stamm
form.masse.bogen.mitte;                         // [x, 0, z] – hier führt der Pfad unter der Wurzel durch
```

Genutzt von: daemmerwald · Tags: natur, baum, riesenbaum, urwald, sdf, wurzel, form, prozedural, daemmerwald · THREE: nein

### riesenbaum-krone · `engine/models/natur/riesenbaum-krone.js` · v1.0.0 · entwurf
Krone des Riesenbaums (rein, ohne THREE): wenige sehr dicke Hauptäste als Skelett, Laub als große weiche Gauß-Blobs, hängende Bartflechten

- `baueKrone({ H, R, kronenAb, achse, radius, detail, r }) -> { aeste [{ punkte [[x,y,z,radius]…], ordnung }], buschel [{ m, r }], kronenRadius }`
- `laubSplats(ziel, krone, { seed, anzahl, H, kronenAb }) -> gesetzt`
- `bartSplats(ziel, krone, { seed, anzahl }) -> gesetzt`
- `glaette(punkte, teile)`
- `farbeLin('#rrggbb') -> [r,g,b] linear`
- `mische(a, b, t)`

```js
import { createSplatDaten } from '../../engine/render/gauss-saat.js';
import { laubSplats } from '../../engine/models/natur/riesenbaum-krone.js';
const ziel = createSplatDaten();
laubSplats(ziel, form.krone, { seed: 7, anzahl: 5000, H: 110, kronenAb: 60 });   // form aus riesenbaum-form.js
```

Genutzt von: – · Tags: natur, baum, riesenbaum, krone, laub, splats, gauss, flechte, daemmerwald · THREE: nein

### riesenbaum-netz · `engine/models/natur/riesenbaum-netz.js` · v1.0.0 · entwurf
Baut aus der Riesenbaum-Form die rohen Daten (rein, ohne THREE): SDF-Netz für Wurzeln und Stammfuß, verjüngter Stamm, Ast-Röhren, Rindenfarben, Splats, Höhenkarte

- `baueRiesenbaumRoh(opts) -> { form, position, normal, farbe, index, dreiecke, splats ‹daten›, hoehenkarte, masse, teile { wurzel, stamm, aeste } }`
- `rindenFarbe(form) -> (x,y,z,nx,ny,nz,out) -> out`
- `WETTER [x,y,z]`

```js
import { baueRiesenbaumRoh } from '../../engine/models/natur/riesenbaum-netz.js';
const roh = baueRiesenbaumRoh({ seed: 7, bogen: true });
roh.dreiecke;                       // ≤ 60 000
roh.hoehenkarte.hoeheBei(9, 2);     // Höhe des Wurzelrückens dort (NaN = blanker Boden)
```

Genutzt von: – · Tags: natur, baum, riesenbaum, sdf, netz, rinde, moos, splats, hoehenkarte, daemmerwald · THREE: nein

### riesenbaum · `engine/models/natur/riesenbaum.js` · v1.0.0 · entwurf
Urwald-Riese in echter Größe (~110 m): Wurzeln und Stammfuß weich aus dem SDF, darüber Stamm und dicke Äste als EINE Geometrie; Laub, Moos und Flechten als Gauß-Splat-Daten

- `createRiesenbaum({ seed, hoehe = 110, stammRadius = 5.5, wurzeln = 7, wurzelWeite = 22, detail = 1, bogen = false }) -> { geometrie, splats, kollision { stammRadius, hoehenkarte { hoeheBei(x,z) } }, masse { hoehe, stammRadius, kronenAb, kronenRadius, grenzen, bogen? { mitte, achse, quer, lichteHoehe, lichteWeite } }, dreiecke, dispose() }`

```js
import { createRiesenbaum } from '../../engine/models/natur/riesenbaum.js';
import { createGaussWolke } from '../../engine/render/gauss-wolke.js';
const baum = createRiesenbaum({ seed: 7, bogen: true });
szene.add(new THREE.Mesh(baum.geometrie, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
const wolke = createGaussWolke(); wolke.fuege(baum.splats); szene.add(wolke.mesh);
baum.kollision.hoehenkarte.hoeheBei(9, 2);      // lokal zum Baumfuß; NaN = blanker Boden
```

Genutzt von: daemmerwald, natur · Tags: natur, baum, riesenbaum, urwald, wald, sdf, splats, gauss, wurzel, groesse, daemmerwald · THREE: ja

### totholz-form · `engine/models/natur/totholz-form.js` · v1.0.0 · neu
Reine Röhren-Geometrie (ohne THREE) für Totholz/Äste: Ringe entlang eines Pfads, Enden zu/Spitze/Jahresring-Scheibe, Markierung je Dreieck

- `createRoehrenNetz() -> { roehre(pfad, radien, segmente, opts), punkte, dreiecke, marken }  (marken je Dreieck: 'rinde' | 'ring0'..'ringN' | 'spitze')`

```js
import { createRoehrenNetz } from '../../engine/models/natur/totholz-form.js';
const n = createRoehrenNetz();
n.roehre([[0,0,0],[0,1,0]], [0.3, 0.25], 8, { ende: 'ringe', ringe: 3 });
// n.punkte (xyz), n.dreiecke (Indizes, außen gegen den Uhrzeigersinn), n.marken[dreieckNr]
```

Genutzt von: – · Tags: natur, totholz, ast, stamm, geometrie, lowpoly · THREE: nein

### totholz · `engine/models/natur/totholz.js` · v1.0.0 · neu
Prozedurales Low-Poly-Totholz (Vertrag NATUR-ASSETS): baumstumpf (Jahresringe, Wurzelansätze), liegenderStamm (Aststummel), ast

- `TYPEN`
- `erzeuge(typ, seed, opts) -> { geometrie, hoehe, radius, stammRadius }  opts: { detail 0|1|2, moos 0..1, schnee 0..1, skala }`

```js
import { erzeuge } from '../../engine/models/natur/totholz.js';
const { geometrie } = erzeuge('liegenderStamm', 5, { moos: 0.5 });
scene.add(new THREE.Mesh(geometrie, standardMaterial()));
```

Genutzt von: – · Tags: natur, totholz, baumstumpf, stamm, ast, prozedural, lowpoly, vertexfarben · THREE: ja

### bau-instanzen · `engine/render/bau-instanzen.js` · v1.0.0 · entwurf
Bau-Teile (Häuser, Laternen, Brunnen …) als InstancedMesh je typ#variante, ein gemeinsames Leucht-Mesh, Kollisions-Körper und Anker in Weltlage

- `createBauInstanzen({teile,fabriken,kollision?,material?,schatten?}) -> {gruppe,lichter,anker,koerperIds,assets,dreiecke,setzeNacht(n),dispose()}`
- `dreheLokal(w,lx,lz)->{x,z}`

```js
import { createBauInstanzen } from '../../engine/render/bau-instanzen.js';
const bau = createBauInstanzen({ teile: [{ id: 'h1', typ: 'haus', variante: 0, x: 10, z: 4, winkel: 0.5, y: 2 }],
fabriken: { haus: ({ seed, variante }) => createHaus({ seed, variante }) }, kollision });
szene.add(bau.gruppe); bau.setzeNacht(1 - himmel.stand().tag);
```

Genutzt von: – · Tags: bau, instanzen, instancedmesh, kollision, anker, leucht, dorf · THREE: ja
Teil: { id, typ, variante = 0, x, z, winkel (Drehung um Y; lokal +z zeigt nach (sin w, cos w)), y = 0 }.
Welt = (x + lx·cos w + lz·sin w, z − lx·sin w + lz·cos w). Kasten-bx/bz der Assets sind HALBE Maße (wie in world/kollision).
Anker-Eintrag: { teilId, typ, art (Anker-Name, bei station deren art), x, y, z, winkel, daten (Original-Anker) }.

### figur-material · `engine/render/figur-material.js` · v1.1.0 · entwurf
Weiches Figuren-Material: Standard-Material mit Randlicht (Fresnel), aufgehellter Schattenseite und kräftigeren Farben – Figuren heben sich vom Gelände ab

- `figurMaterial(opts) -> THREE.MeshStandardMaterial (geteilt je Optionen)`
- `FIGUR_MATERIAL_STANDARD`

```js
import { figurMaterial } from '../../engine/render/figur-material.js';
const mat = figurMaterial();                              // eins für alle Figuren (ein Shader-Programm)
const geist = figurMaterial({ rand: 1, randFarbe: 0x80c0ff, material: { transparent: true, opacity: 0.6 } });
```

Genutzt von: – · Tags: figur, charakter, material, shader, randlicht, rim, look · THREE: ja
1.1 (additiv): glatt = true → weiche Normalen (für den organischen Körper aus figur-haut); hautWaerme = warmes Durchscheinen auf der
   Schattenseite, wo das Vertex-Attribut „haut“ = 1 ist (Ohren, Hände, Gesicht wirken lebendig statt nach Plastik). Ohne Attribut: 0.

### gauss-saat · `engine/render/gauss-saat.js` · v1.0.0 · entwurf
Prozedurale Gauß-Splats erzeugen: wachsender Daten-Sammler, Quaternion aus einer Normalen und flächengleiche Aussaat flacher Scheiben auf einem Dreiecksnetz (Moos, Flechten, Laub)

- `createSplatDaten(start = 1024) -> { anzahl, plus(x,y,z, sx,sy,sz, qx,qy,qz,qw, r,g,b, deck, wind = 0), fertig() -> daten { anzahl, position, skala, drehung, farbe, deck, wind } }`
- `quatAusNormale(nx, ny, nz, dreh, out = [0,0,0,1]) -> out`
- `saatAufNetz(ziel, netz { position, normal, index }, { anzahl, seed, groesse = [0.15, 0.5], flach = 0.25, abheben = 0.03, deck = 0.9, wind = 0, farbe ‹(x,y,z,nx,ny,nz,zufall) -> [r,g,b] | null› }) -> gesetzt`

```js
import { createSplatDaten, saatAufNetz } from '../../engine/render/gauss-saat.js';
const saat = createSplatDaten();
saatAufNetz(saat, { position, normal, index }, { anzahl: 4000, seed: 7, farbe: (x, y, z, nx, ny) => ny > 0.3 ? [0.10, 0.22, 0.05] : null });   // Moos nur oben
saat.plus(0, 30, 0, 4, 3, 4, 0, 0, 0, 1, 0.08, 0.2, 0.06, 0.35, 1);                  // ein großer weicher Laub-Blob, wiegt im Wind
wolke.fuege(saat.fertig());
```

Genutzt von: daemmerwald, natur · Tags: splat, gauss, gaussian, saat, streuen, netz, moos, laub, prozedural, quaternion · THREE: nein

### gauss-sortierung · `engine/render/gauss-sortierung.js` · v1.0.0 · entwurf
Tiefen-Sortierung für Gauß-Splats: 16-Bit-Zähl-Sortierung entlang der Blickrichtung (hinten→vorn), ohne Allokation je Aufruf – 120 k Splats in ~1–3 ms

- `createTiefenSortierer(max) -> { max, sortiere(position ‹Float32Array 3n›, anzahl, blick ‹[x,y,z]›, auge ‹[x,y,z]›) -> Uint32Array Reihenfolge hinten→vorn – gleicher Puffer bei jedem Aufruf }`

```js
import { createTiefenSortierer } from '../../engine/render/gauss-sortierung.js';
const sortierer = createTiefenSortierer(120000);
const reihenfolge = sortierer.sortiere(positionen, anzahl, [0, 0, -1], [0, 2, 10]);   // reihenfolge[0] = fernster Splat
```

Genutzt von: – · Tags: splat, gauss, gaussian, sortierung, tiefe, transparenz, zaehlsortierung, radix · THREE: nein

### gauss-wolke · `engine/render/gauss-wolke.js` · v1.0.0 · entwurf
Echte 3D-Gauß-Splats, prozedural befüllt: jeder Splat ist ein Ellipsoid (Mitte, 3 Standardabweichungen, Drehung, Farbe, Deckkraft), gezeichnet als instanziertes Viereck mit 3D→2D-Kovarianz, vormultipliziertem Alpha und Tiefen-Sortierung – Meshes verdecken Splats korrekt

- `createGaussWolke({ max = 120000, sortiereAlle = 3, maxPixel = 220 }) -> { mesh, anzahl, max, fuege(daten, { matrix = null, anteil = 1 }) -> anzahl neu, leere(), setze({ nebelFarbe, nebelDichte, licht, wind }), update(kamera, zeit, breitePx, hoehePx), dispose() }`

```js
import { createGaussWolke } from '../../engine/render/gauss-wolke.js';
const wolke = createGaussWolke({ max: 90000 });
szene.add(wolke.mesh);
wolke.fuege(baum.splats, { matrix: baumMatrix, anteil: 0.7 });      // daten aus gauss-saat.js (lokal) → Welt
wolke.setze({ nebelFarbe: szene.fog.color, nebelDichte: szene.fog.density, licht: [1.1, 0.95, 0.8], wind: 0.6 });
// je Bild VOR renderer.render: wolke.update(kamera, zeit, canvas.width, canvas.height);
```

Genutzt von: daemmerwald, natur · Tags: splat, gauss, gaussian, 3dgs, wolke, instanziert, shader, transparenz, moos, laub, dunst · THREE: ja

### grosszauber-mesh · `engine/render/grosszauber-mesh.js` · v1.0.0 · entwurf
Zeichnet laufende Großzauber (gameplay/grosszauber): je Wirkung eine Ansicht aus einer Ansichts-Fabrik je Art, legt sie an und räumt sie ab, sobald die Wirkung endet

- `createGrosszauberMesh({arten,welt}) -> { gruppe, registriere(name,fabrik), update(dt,aktive), anzahl, dispose() }`

```js
import { createGrosszauberMesh } from '../../engine/render/grosszauber-mesh.js';
import { createWelleAnsicht } from '../../engine/render/grosszauber-welle.js';
const bilder = createGrosszauberMesh({ arten: { welle: createWelleAnsicht }, welt: adapter });
szene.add(bilder.gruppe);
bilder.update(dt, gross.aktive);     // jedes Bild
```

Genutzt von: enklave, figuren · Tags: zauber, großzauber, episch, effekt, render, welle, wand, sturm, beben · THREE: ja
Ansichts-Fabrik:  fabrik(daten, umgebung) -> { objekt (THREE.Object3D), update(dt, daten, zeit), dispose() }
daten = instanz.daten aus der Logik (wird jedes Bild neu gereicht), umgebung = { welt (bodenHoehe/wasserHoehe des Grund-Geländes) }

### grosszauber-riss-ansicht · `engine/render/grosszauber-riss.js` · v1.0.0 · entwurf
Zeichnet den Erdriss (gameplay/grosszauber-riss): glühendes Lava-Band mit Felsrändern, gekippte Schollen, Lava-Säulen und Glut-Funken; kühlt zu dunkelrot/schwarz ab

- `createRissAnsicht(daten, {welt}) -> { objekt, update(dt,daten,zeit), dispose() }`

```js
import { createRissAnsicht } from '../../engine/render/grosszauber-riss.js';
const bilder = createGrosszauberMesh({ arten: { riss: createRissAnsicht }, welt: adapter });
```

Genutzt von: figuren · Tags: zauber, großzauber, render, riss, lava, glut, erdbeben, episch, shader, feuer, mobil · THREE: ja
5 Draw-Calls (Band, Schollen, Säulen, Säulenkern, Funken), ~900 Dreiecke, alles vorab angelegt (Pools), kein Zufall außer festem Hash.

### grosszauber-sturm-ansicht · `engine/render/grosszauber-sturm.js` · v1.0.0 · entwurf
Ansicht des Zyklons: zwei ineinanderliegende Trichter-Röhren mit scrollender Streifen-Textur, drehende Wolkenscheibe, spiralförmig aufsteigende Staub-/Trümmer-Punkte samt Bodenring, Blitze als Zickzack-Linien

- `createSturmAnsicht(daten, umgebung) -> { objekt, update(dt,daten,zeit), dispose() }`

```js
import { createSturmAnsicht } from '../../engine/render/grosszauber-sturm.js';
const bilder = createGrosszauberMesh({ arten: { sturm: createSturmAnsicht }, welt });
```

Genutzt von: figuren · Tags: zauber, großzauber, sturm, tornado, wind, blitz, wolken, shader, episch, render, handy · THREE: ja
daten (aus gameplay/grosszauber-sturm): { pos, fuss, oben, hoehe, drehung, alter, wachs, blitze [{ punkte, alter }] }
5 Draw-Calls: 2 Röhren, Wolke, Punkte (Staub + Bodenring), Blitz-Linien. Keine Schatten, alles aus festen Pools.

### grosszauber-wand-ansicht · `engine/render/grosszauber-wand.js` · v1.0.0 · entwurf
Ansicht des Großzaubers 'Erdwall': kantige Felspfeiler (InstancedMesh, Low-Poly, Risse + Moos), Erdwulst und Trümmer am Fuß, Staubwolke beim Aufsteigen und Zerfallen, Zittern beim Steigen

- `createWandAnsicht(daten, umgebung) -> { objekt, update(dt, daten, zeit), dispose() }`

```js
import { createGrosszauberMesh } from '../../engine/render/grosszauber-mesh.js';
import { createWandAnsicht } from '../../engine/render/grosszauber-wand.js';
const bilder = createGrosszauberMesh({ arten: { wand: createWandAnsicht }, welt: adapter });
```

Genutzt von: figuren · Tags: zauber, großzauber, wand, fels, render, episch, instancing, staub, erdwall, handy · THREE: ja
Daten aus gameplay/grosszauber-wand (segmente[{x,z,breite,dicke,hoeheZiel,hoehe,yaw,seed,zerfall}], phase).
Handy: 3 Draw-Calls (Pfeiler, Trümmer+Wulst, Staub), ≤ ~5500 Dreiecke bei 32 Segmenten, Staub aus festem Pool.

### grosszauber-welle-ansicht · `engine/render/grosszauber-welle.js` · v1.0.0 · entwurf
Ansicht der Flutwelle: gebogenes, verformtes Wellen-Gitter mit überrollendem Kamm, Schaumkrone und Fresnel-Rand, Gischt als Punkte, auslaufende Flutfläche – 3 Draw-Calls, ~3500 Dreiecke, Tiefenfarben + Schaumstreifen prozedural, keine Schatten

- `createWelleAnsicht(daten, umgebung) -> { objekt, update(dt,daten,zeit), dispose() }`

```js
import { createWelleAnsicht } from '../../engine/render/grosszauber-welle.js';
const bilder = createGrosszauberMesh({ arten: { welle: createWelleAnsicht }, welt: adapter });
```

Genutzt von: enklave, figuren · Tags: zauber, großzauber, welle, wasser, flut, episch, shader, gischt, render, mobil · THREE: ja
daten stammen aus gameplay/grosszauber-welle (phase, mitte, yaw, breite, hoehe, kruemmung, strecke, flut, tiefe).
Wurzel steht am Start der Front (y = 0), lokal +z = Laufrichtung; alle Höhen sind absolut (Gelände aus umgebung.welt.bodenHoehe).

### horde-mesh · `engine/render/horde-mesh.js` · v1.1.0 · entwurf
Zeichnet eine Horde (gameplay/horde) mit wenigen Draw-Calls: je Modell und Lauf-Bild ein InstancedMesh; Hüpfer, Überschlag im Flug, Treffer-Aufblitzen, Leichen auf der Seite, Versinken

- `createHordeMesh({ modelle: { name: [geoBild0, geoBild1 …] }, max, material, schatten }) -> { gruppe, update(wesen), sichtbar, dispose() }`

```js
import { createHordeMesh } from '../../engine/render/horde-mesh.js';
import { createRatte } from '../../engine/models/kreaturen/ratte.js';
const ratte = createRatte({ seed: 3 });
const hm = createHordeMesh({ modelle: { ratte: ratte.frames }, max: 140 }); szene.add(hm.gruppe);
hm.update(horde.wesen);   // jedes Bild nach horde.update()
```

Genutzt von: enklave, figuren · Tags: horde, gegner, instancing, instancedmesh, rendern, schwarm, ratte, monster · THREE: ja
Erwartet je Wesen (wie gameplay/horde): { def: { modell }, x, y, z, yaw, skala, phase, hub, dreh, zustand, blitz, verfall, ton, hoehe }.
Modelle: Nase nach +Z, Füße auf y = 0. Die Geometrien gehören dem Aufrufer (dispose() gibt sie nicht frei).

### kronen-lichtkarte · `engine/render/kronen-lichtkarte.js` · v1.0.0 · entwurf
Lichtkarte unter einem Kronendach: kleines Render-Target, orthografisch entlang der Licht-(Sonnen-/Mond-)Richtung, nur Verdecker (Laub, Stämme) – selten neu gerendert (Sonne merklich gewandert oder Mitte verlassen). Liefert Sonnentupfer für beliebige beleuchtete Materialien (ein Texture-Lookup je Fragment, dämpft nur das erste Richtungslicht), GLSL für eigene Shader, CPU-Abfrage aus dem Readback (Lücken für Lichtstrahlen) und reine Helfer zur Lücken-Wahl

- `createKronenLichtkarte({ renderer, groesse = 256, weite = 140, abstand = 700, hoehe = 80, verschiebung = 1.2, wegAnteil = 0.2, minHoehe = 0.12, aussen = 0.7, luft = 25, stammBis = Infinity, minBilder = 20, lesen = true }) -> { textur, uniforms: { uLkKarte, uLkMatrix, uLkStaerke, uLkAussen }, GLSL, fuege(objekt, { geometrie?, material? }), mitLichtkarte(material, { nurLaub }), update(richtung, mitte, zwingen?) -> bool, lichtBei(x, y, z, radius = 1, kanal = 0) -> 0..1, zahlen: { neu, calls }, dispose() }`
- `brauchtNeu(alt, neu, opts) -> bool`
- `probeKarte(daten, groesse, u, v, radius = 1, kanal = 0, stride = 4) -> 0..1 Mittelwert`
- `waehleLuecken(punkte, { max = 10, abstand = 8, schwelle = 0.5 }) -> punkte`

```js
import { createKronenLichtkarte } from '../../engine/render/kronen-lichtkarte.js';
const lk = createKronenLichtkarte({ renderer, groesse: 256, weite: 140 });
lk.fuege(laub.mesh, { material: laub.deckMaterial }); for (const m of riesen) lk.fuege(m);
lk.mitLichtkarte(boden.material);                     // vor dem ersten Rendern: Sonnentupfer auf dem Boden
if (lk.update(sonnenRichtung, figur.position)) baueStrahlen(lk.lichtBei);   // nur bei Neu-Rendern true
```

Genutzt von: daemmerwald · Tags: licht, schatten, kronen, wald, sonnentupfer, lichtstrahlen, render-target, tag, nacht, render · THREE: ja

### laub-karten · `engine/render/laub-karten.js` · v1.1.0 · entwurf
Dichtes Laub als EIN instanziertes Mesh aus Blatt-Karten (zur Kamera gedreht): Blatt-Silhouette prozedural im Fragment-Shader (keine Textur), Alpha-Test bzw. alphaToCoverage, Richtungslicht mit Durchscheinen zur Sonne, dunkler Kern, Wind, exp²-Nebel + eigener Höhendunst

- `createLaubKarten({ karten, sonne: Vector3, sonnenFarbe: Color, umgebung: Color, boden: Color, blatt = 0.6, hoehenDunst = { ab: 60, bis: 170, max: 0.4 }, wind = 1, alphaToCoverage = false, durchlass = 0.5 }) -> { mesh, material, deckMaterial (weiß × durchlass, für Lichtkarten), anzahl, setzeLicht({ sonne, farbe, umgebung, boden }), update(zeit), dispose() }`

```js
import { createLaubKarten } from '../../engine/render/laub-karten.js';
const laub = createLaubKarten({ karten, sonne: new THREE.Vector3(0.5, 0.4, -0.8).normalize(), sonnenFarbe: new THREE.Color(0.7, 0.6, 0.5), umgebung: new THREE.Color(0.25, 0.32, 0.33) });
szene.add(laub.mesh);                                 // karten aus engine/models/natur/laub-klumpen.js (sammleKarten → Welt)
laub.setzeLicht({ sonne: neueRichtung });             // Tag-Nacht: je Bild setzbar (Richtung ZUR Sonne, Farben linear inkl. Stärke)
laub.update(zeit);                                    // Wind
```

Genutzt von: daemmerwald · Tags: natur, laub, blatt, karten, instanziert, shader, alpha, transluzenz, wind, krone, render · THREE: ja

### licht-pool · `engine/render/licht-pool.js` · v1.0.0 · entwurf
Wenige echte PointLights, die sich die nächsten Lichtquellen zum Fokus greifen (Lagerfeuer bevorzugt), weich ein-/ausblenden, Feuer flackert, Laternen tags aus

- `createLichtPool({szene,lichter,anzahl?,reichweite?,schatten?,seed?}) -> {update(dt,fokus,nacht),anzahl,dispose()}`
- `waehleLichter(lichter,fokus,n,reichweite?) -> lichter[]`

```js
import { createLichtPool } from '../../engine/render/licht-pool.js';
const pool = createLichtPool({ szene, lichter: bau.lichter, anzahl: 4 });
pool.update(dt, { x: spieler.x, z: spieler.z }, 1 - himmel.stand().tag);
```

Genutzt von: – · Tags: licht, pointlight, pool, laterne, lagerfeuer, flackern, nacht · THREE: ja
lichter: [{ x, y, z, farbe, staerke, art }]; art 'lagerfeuer' (immer an, bevorzugt, flackert), 'fackel' (flackert, nachts stärker), sonst Laterne/Fenster (tags aus).
Flackern: Sinus-Summe mit Phase aus Seed + Lichtposition, kein Math.random.

### mesh-builder · `engine/render/mesh-builder.js` · v1.1.0 · entwurf
Low-Poly-Modelle aus Primitiven (Box, Kugel, Zylinder …) mit Vertexfarben zu EINER Geometrie verschmelzen; Farbvariation pro Dreieck per Seed

- `createMeshBuilder(opts) -> builder (box, sphere, cyl, cone, ico, capsule, torus, lathe, add, geometry, mesh)`
- `standardMaterial(opts) -> MeshStandardMaterial`
- `tMatrix(t) -> Matrix4`

```js
import { createMeshBuilder } from '../../engine/render/mesh-builder.js';
const b = createMeshBuilder({ seed: 7 });
b.box(0.6, 0.4, 1.0, '#d9772b', { y: 0.5 }).sphere(0.25, 0xffffff, { y: 0.8, z: 0.5, sy: 0.8 }, 8, 6);
szene.add(b.mesh());   // THREE.Mesh mit standardMaterial()
```

Genutzt von: enklave, erde, figuren · Tags: mesh, geometrie, lowpoly, vertexfarben, modell, primitive, merge · THREE: ja

### mond · `engine/render/mond.js` · v1.1.0 · entwurf
Mond mit Kratertextur, Phase aus dem Sonnenwinkel und Mondlicht mit Schatten (für Szenen mit Floating Origin)

- `createMond(scene, { abstand=900, seed=37, schattenweite=24, nachtseite='dunkel'|'durchsichtig' }) -> { update({ kamera, richtung, sonne, oben?, nacht?, anker?, sichtbar? }), dispose() }`

```js
import { createMond } from '../../engine/render/mond.js';
const mond = createMond(scene, { nachtseite: 'durchsichtig' });
mond.update({ kamera: camera.position, richtung: mondDir, sonne: sonnenDir, nacht: 1 });
```

Genutzt von: erde, naturstimmungen · Tags: himmel, mond, licht, nacht, schatten · THREE: ja

### natur-material · `engine/render/natur-material.js` · v1.0.0 · entwurf
Gemeinsames Material für Natur-Assets: MeshStandardMaterial (Vertexfarben, flatShading) mit Wind-Schwingen im Vertex-Shader über das Attribut 'wind' (0 starr … 1 voll); Phase je Instanz aus der Weltposition; passendes Schatten-Material; optional Ausblenden ab Kamera-Entfernung

- `createNaturMaterial({ wind, weite, staerke, richtung, amplitude, grund, roughness }) -> MeshStandardMaterial & { update(zeit, { staerke, richtung }), tiefenMaterial, uniforms }`
- `patcheShader(shader, uniforms, { wind, weite }) -> shader`

```js
import { createNaturMaterial } from '../../engine/render/natur-material.js';
const mat = createNaturMaterial({ wind: true });
const baum = new THREE.InstancedMesh(geometrie, mat, 100);
baum.customDepthMaterial = mat.tiefenMaterial;   // Schatten schwingt mit
// je Bild: mat.update(zeit, { staerke: 1, richtung: [1, 0.3] });
```

Genutzt von: daemmerwald, figuren, natur · Tags: natur, material, wind, shader, vegetation, instanzen, render · THREE: ja

### niederschlag · `engine/render/niederschlag.js` · v1.0.0 · entwurf
Regen/Schnee als ein Points-Objekt um die Kamera; Bewegung komplett im Vertex-Shader (kein CPU-Aufwand je Partikel)

- `createNiederschlag({anzahl,radius,hoehe,seed}) -> {objekt, update(dt,{kamera|mitte,regen,schnee,wind,windRichtung,hoehePx}), dispose()}`

```js
import { createNiederschlag } from '../../engine/render/niederschlag.js';
const ns = createNiederschlag({ seed: 3 });
scene.add(ns.objekt);
ns.update(dt, { kamera, regen: wetter.regen, schnee: wetter.schnee, wind: wetter.wind, windRichtung: wetter.windRichtung });
```

Genutzt von: erde, handwerk · Tags: wetter, regen, schnee, partikel, shader · THREE: ja

### psx · `engine/render/psx.js` · v1.2.0 · entwurf
PS1-Look für eine ganze Szene (aus Viniland übernommen): Eckpunkte rasten auf ein grobes Bildraster (Wackeln), wenige Farbstufen mit Bayer-Dithering, grobe Pixel (kleine interne Auflösung, hart hochskaliert), Stimmung (Kontrast, Sättigung, Tönung, Vignette je Ansicht/Splitscreen) – live an/aus ohne Neu-Kompilieren

- `createPsx({ an, raster, farbtiefe, dither, zeilen, kontrast, saettigung, belichtung, vignette, toenung, nachfassen }) -> { an, werte, uniforms, setze(teil), wendeAn(wurzel), patche(material), material(opts), aufloesung(renderer, breite, hoehe, { pixelRatio }), update(dt, wurzel?), dispose() }`
- `psxAufloesung(breite, hoehe, zeilen) -> { breite, hoehe, faktor }`
- `patchePsxShader(shader, uniforms) -> shader`
- `PSX_STANDARD`

```js
import { createPsx } from '../../engine/render/psx.js';
const psx = createPsx({ zeilen: 300 });
psx.wendeAn(szene);                                   // alle Materialien der Szene (auch figurMaterial, Natur, Gelände, Himmel)
psx.aufloesung(renderer, innerWidth, innerHeight);    // statt renderer.setSize – auch bei 'resize'
// je Bild: psx.update(dt, szene);                    // fasst später hinzugekommene Dinge nach
psx.setze({ an: false });                             // Vergleich: normaler Look (danach wieder psx.aufloesung(…))
```

Genutzt von: enklave, figuren, handwerk · Tags: psx, ps1, retro, look, shader, dithering, pixel, vertex-snap, splitscreen, stimmung, grading · THREE: ja

### qualitaet · `engine/render/qualitaet.js` · v1.0.0 · entwurf
Automatische Qualitätsstufe nach Bildzeit (Handy-Schutz): wird es langsam, sinken Pixelverhältnis, Schattenkarte, Partikel und Schadens-Zahlen; wird es lange schnell, steigen sie wieder – mit Hysterese, reine Logik (das Spiel wendet die Werte an)

- `createQualitaet({ ziel = 1/50, stufen, schlechtNach = 1.5, besserNach = 4 }) -> { update(dtEcht) -> stufe|null (nur bei Wechsel), stufe, nr, fps, setze(n), fest(bool), stufen, dispose() }`
- `QUALITAETS_STUFEN`

```js
import { createQualitaet } from '../../engine/render/qualitaet.js';
const q = createQualitaet({ ziel: 1 / 50 });
const s = q.update(echtDt);                       // jedes Bild; s = neue Stufe oder null
if (s) { renderer.setPixelRatio(Math.min(devicePixelRatio, s.pixel)); sonne.castShadow = s.schatten > 0; fx.anteil = s.partikel; }
```

Genutzt von: daemmerwald, enklave, figuren · Tags: qualität, leistung, fps, bildzeit, adaptiv, auflösung, schatten, handy, performance · THREE: nein
Stufe 0 = beste. Jede Stufe: { pixel (max. Pixelverhältnis), schatten (Kartengröße, 0 = aus), partikel (Anteil 0…1), zahlen (max. Schadens-Zahlen) }.
Schlechter: geglättete Bildzeit > ziel × 1.15 für `schlechtNach` s. Besser: < ziel × 0.85 für `besserNach` s (verdoppelt sich, wenn eine
Verbesserung binnen 20 s wieder zurückgenommen werden musste – verhindert Hin-und-her). Pausen (Bildzeit > 0.5 s) zählen nicht.

### splat-look · `engine/render/splat-look.js` · v1.0.0 · entwurf
Gaussian-Splat-Look für eine fertige Szene: das Bild wird klein gerendert und als zehntausende weiche, längliche Gauß-Flecken neu gemalt (entlang der Kanten ausgerichtet, nah größer als fern) – Stil-Experiment, keine echten 3D-Splats

- `createSplatLook({ dichte, groesse, laenge, streuung, seed }) -> { an, werte, setze(teil), aufloesung(breite, hoehe), render(renderer, szene, kamera), dispose() }`
- `splatRaster(breite, hoehe, dichte) -> { spalten, zeilen, anzahl }`
- `SPLAT_STANDARD`

```js
import { createSplatLook } from '../../engine/render/splat-look.js';
const splat = createSplatLook({ dichte: 150 });
splat.aufloesung(innerWidth, innerHeight);                       // auch bei 'resize'
// je Bild: if (splat.an) splat.render(renderer, szene, kamera); else renderer.render(szene, kamera);
```

Genutzt von: enklave · Tags: splat, gaussian, gauss, look, stil, nachbearbeitung, postprocessing, maler, shader · THREE: ja

### zauber-effekte · `engine/render/zauber-effekte.js` · v1.1.0 · entwurf
Leichte Zauber-Effekte fürs Handy: ein Partikel-Points-Objekt (Funken, Schweife), leuchtende Geschoss-Kugeln, Schockwellen-Ringe, Blitze, Erdstacheln, Schutz-Aura, Meteor-Sturz – alles aus Pools

- `createZauberEffekte(opts) -> { gruppe, anteil (0…1, Partikel-Anteil, Standard 1), update(dt,{hoehePx}?), funken(pos,opts), kugel(id,pos,opts), entferneKugel(id), ring(pos,opts), blitz(punkte,opts), stacheln(pos,opts), aura(id,posFn,opts), entferneAura(id), sturz(pos,opts), aktiv, dispose() }`

```js
import { createZauberEffekte } from '../../engine/render/zauber-effekte.js';
const fx = createZauberEffekte({ seed: 3 }); szene.add(fx.gruppe);
fx.kugel(g.id, g, { farbe: 0xff7a2a });                       // pro Frame: Geschoss mitführen (zieht einen Schweif)
fx.entferneKugel(g.id); fx.funken(pos, { farbe: 0xff7a2a, anzahl: 40, tempo: 6 }); fx.ring(pos, { radius: 2.6 });
fx.blitz([hand, ziel1, ziel2]); fx.aura('schild', () => figur.zustand.pos, { dauer: 8 });
fx.update(dt, { hoehePx: renderer.domElement.height });
```

Genutzt von: enklave, figuren · Tags: zauber, magie, effekt, partikel, funken, blitz, schockwelle, shader, vfx · THREE: ja

### modul-bewohner · `engine/spiel/modul-bewohner.js` · v1.0.0 · entwurf
Spiel-Modul 'bewohner': 6–10 Siedler an welt.ort('siedlung') mit Tagesablauf (character-brain, Stunde aus himmel.uhr), Namensschildern, Entität je Bewohner (Team freund), Treffer/Tod-Reaktion, LOD (ferne NPCs seltener, ganz ferne eingefroren)

- `BEWOHNER_MODUL`

```js
import { BEWOHNER_MODUL } from '../../engine/spiel/modul-bewohner.js';
const spiel = await createSpiel({ canvas, module: [WELT_MODUL, SPIELER_MODUL, BEWOHNER_MODUL], optionen: { bewohner: { anzahl: 6 } } });
```

Genutzt von: – · Tags: spiel, modul, npc, bewohner, siedlung, tagesablauf, namensschild, lod · THREE: ja
Modul-API: { bewohner [{figur,name,id,heim}], mitte {x,z}, schilder, stunde }.

### modul-dorf · `engine/spiel/modul-dorf.js` · v1.0.0 · entwurf
Spiel-Modul 'dorf': Startdorf Erlenwacht am Ort 'siedlung' – Plan (world/dorf-plan) + Gebäude/Kleinkram (models/bau) als Instanzen mit Kollision (render/bau-instanzen), Licht in der Nacht (render/licht-pool), Platz + Gassen als Boden, Felder voller Beete, Brücke über den Erlbach, Treffpunkt-Stationen (Brunnen, Schrein, Anschlagbrett, Amboss, Lagerfeuer) für Tutorial und Spieler

- `DORF_MODUL -> api { punkt(id), punkte, ziele:[{id,pos,radius,text,art}], benutze(id, wer) -> {ok,text}, onBenutzt(fn), gebunden, plan, statistik }`

```js
import { DORF_MODUL } from '../../engine/spiel/modul-dorf.js';
const dorf = spiel.api('dorf'); dorf.punkt('brunnen');   // {x,z,y,winkel}
// URL: ?weltblick=brunnen springt mit der Debug-Kamera auf den Platz (über welt.orte)
```

Genutzt von: – · Tags: spiel, modul, dorf, siedlung, treffpunkt, gebaeude, licht, nacht, bruecke, felder, erlenwacht, mmo · THREE: ja
Ereignisse: sendet dorf:benutzt {id, art} (brunnen|anschlagbrett|schrein|amboss|feuer), dorf:gebunden {x,z}, chat:sende {kanal:'welt'}.
Schrein: nach spieler:aktion 'wiederbelebt' teleportiert das Dorf die Figur zum gebundenen Schrein (Spieler-Modul bleibt unverändert).

### modul-entitaeten · `engine/spiel/modul-entitaeten.js` · v1.0.0 · entwurf
Spiel-Modul 'entitaeten': stabile IDs, Leben/Schaden über die Befehls-Schicht (gameplay/befehle), Ereignisse ent:* auf dem Spiel-Bus, schwebende Schadenszahlen + Lebensbalken über getroffenen Zielen (mit 'render')

- `ENTITAETEN_MODUL`
- `createEntitaetenModul() -> modul, start(ctx) -> { neu({art,team,pos,radius,leben,name,daten})->id, hole(id), entferne(id), bewege(id,x,y,z), imUmkreis(x,z,r,{team,ausser,art}), schade(id,{menge,element,quelle,stoss:{x,z,kraft}})->echt, heile(id,menge,quelle?)->echt, befehle, alle(), kern, aenderungenSeit(takt), takt }`

```js
import { ENTITAETEN_MODUL } from '../../engine/spiel/modul-entitaeten.js';
const ents = kern.api('entitaeten');
const id = ents.neu({ art: 'gegner', team: 'feind', pos: { x, y, z }, leben: 40, name: 'Wolf', daten: { hoehe: 0.9, werte: { ruestung: 20 } } });
ents.schade(id, { menge: 12, element: 'feuer', quelle: spieler.id, stoss: { x: 0, z: 1, kraft: 6 } });   // → ent:treffer / ent:tod
```

Genutzt von: – · Tags: spiel, modul, entitaet, leben, schaden, befehl, mmo, treffer, lebensbalken · THREE: ja
stoss: x,z = RICHTUNG (wird normiert), kraft = m/s. Er wird nur im Ereignis ent:treffer weitergereicht – wer Körper hat (gegner), wendet ihn an.
Optionen: { zahlen: true, balken: true, balkenZeit: 6 (s nach letztem Treffer), takt: 1/20 (Befehls-Takt) }.

### modul-fortschritt · `engine/spiel/modul-fortschritt.js` · v1.0.0 · entwurf
Spiel-Modul 'fortschritt': Stufen 1–15, XP aus Gegner-Toden, Talente, Inventar (24 Plätze) + Ausrüstung, Beute als leuchtende Beutel (1 InstancedMesh, Auto-Aufheben 2 m, 120 s), Werte auf die Spieler-Entität, Licht-Ring bei Stufenaufstieg

- `FORTSCHRITT_MODUL`
- `createFortschrittModul() -> modul, start(ctx) -> { held:{name,klasse}, stufe, xp, xpNaechste, gibXp(n,grund), gibGegenstand(id,anzahl=1,daten?)->rest, inventar, register, ausruestung:{hole(sockel),lege(platz)->bool,ab(sockel)->bool,alle()}, werte()->{…}, talente:{punkte,baum,stufe(id),hat(id),lerne(id)->{ok,grund}}, seltenheitFarbe(s), beschreibe(id,daten)->{name,zeilen,farbe}, drops, streue(tabelle,pos,stufe?) }`

```js
import { FORTSCHRITT_MODUL } from '../../engine/spiel/modul-fortschritt.js';
const f = kern.api('fortschritt');
f.gibXp(30, 'aufgabe'); f.gibGegenstand('heiltrank', 2); f.talente.lerne('kr_schlag');
f.ausruestung.lege(0);   // Inventar-Platz 0 anlegen
```

Genutzt von: – · Tags: spiel, modul, fortschritt, stufe, xp, talent, beute, inventar, ausruestung, mmo · THREE: ja
Optionen: { name:'Du', klasse:'krieger'|'magier'|'waldlaeufer', plaetze:24, aufheben:2 (m), dauer:120 (s) }. Hört ent:tod (Team feind, quelle = spieler.id).
Ereignisse (senden): fort:xp, fort:stufe, fort:drop, fort:beute, fort:ausgeruestet, fort:talent, chat:sende (kanal beute/system).
Gegner steuern über ent.daten: { xp, stufe, beute:'wolf'|…, boss }. Läuft auch ohne render/spieler (dann zählt jedes ent:tod, kein Beutel-Bild).

### modul-gegner · `engine/spiel/modul-gegner.js` · v1.1.0 · entwurf
Spiel-Modul 'gegner': Lager nach Region an allen welt.orte der Art 'gegnerlager' (Waldrand Ratten · Hochland Wölfe + Keiler · Moor Irrlichter + Ratten, Stufe aus ort.stufe) + ein kleines am Waldrand beim 'tor', Boss „Grauzahn, der Alpha“ (Stufe 10) am Ort 'boss' (sonst 'ruine') mit Warn-Ring, Horden mit je einer Entität pro Tier (Team 'feind'), Jagd/Heimkehr/Respawn, Interest-Management (nur Lager nahe dem Fokus laufen und sind sichtbar), nachts mehr und aggressiver

- `GEGNER_MODUL`
- `createGegnerModul() -> modul, start(ctx) -> { lager, horden, boss (Entität-ID|null), wesen(id), lagerVon(id), stoss(id,x,z,kraft), betaeube(id,s), sog(x,z,r,kraft)->anzahl, aktive() }`

```js
import { GEGNER_MODUL } from '../../engine/spiel/modul-gegner.js';
const gegner = kern.api('gegner');
gegner.sog(x, z, 6, 8);                              // Zauber: alles im Umkreis 6 m zur Mitte ziehen
gegner.stoss('g:14', dirX, dirZ, 9); gegner.betaeube('g:14', 2);
```

Genutzt von: – · Tags: spiel, modul, gegner, lager, horde, ratte, respawn, interest, mmo · THREE: ja
stoss: x,z = RICHTUNG (normiert), kraft m/s. Ziele sind Entitäten mit team 'spieler' (spieler.id). Hat das Modul 'spieler' keine
Entität, legt gegner eine Stellvertreter-Entität an der Spielerposition an (Bisse zählen, Wiederbelebung nach 5 s).
Optionen: { aktivBis: 160 (m vom Fokus), besatzung, nachtExtra (Waldrand/Rückfall), waldrand: true, nester: true, boss: true }.
Ereignisse: sendet gegner:boss {id, phase 0|1|2 | −1 = Kampf vorbei/zurückgesetzt, name}, gegner:warnung (Boden-Ring, ein wiederverwendetes Mesh), chat:sende {kanal:'kampf'}. Entität.daten: { stufe, xp, beute, art }.

### modul-himmel · `engine/spiel/modul-himmel.js` · v1.0.0 · entwurf
Spiel-Modul 'himmel': Spieluhr, Himmel (Sonne, Mond, Sterne, Wolken, Nebel), Wetter mit Regen/Schnee; Sonnenlicht mit Schatten, der dem Fokus folgt (Größe nach Qualitätsstufe); Walddunst für andere Module (`dunst` 0..1)

- `HIMMEL_MODUL -> api { uhr, stand(), wetter, sonne (DirectionalLight), umgebung, sonnenRichtung (Vector3 zur Sonne), lichtRichtung (Vector3 zum Hauptlicht, nachts Mond), himmel, dunst (0..1, setzbar), setzeStunde(h), setzeWetter(art, sofort) }`

```js
import { HIMMEL_MODUL } from '../../engine/spiel/modul-himmel.js';
const spiel = await createSpiel({ canvas, module: [WELT_MODUL, HIMMEL_MODUL] });   // URL: ?zeit=18 ?tempo=20 ?wetter=regen ?test=1 (Uhr steht)
spiel.api('himmel').setzeStunde(6.5);
```

Genutzt von: – · Tags: spiel, modul, himmel, tag, nacht, sonne, mond, wetter, regen, nebel, schatten, uhr · THREE: ja

### modul-kampf · `engine/spiel/modul-kampf.js` · v1.0.0 · entwurf
Spiel-Modul 'kampf': Grundangriff ⚔ (Kombo über gameplay/nahkampf, Bogen = Pfeil), Klassen-Fähigkeiten für Krieger (Wut) und Waldläufer (Energie) mit eigener Leiste, Magier über das Zauber-Modul; Freischaltung nach Stufe

- `KAMPF_MODUL -> api { klasse, angriff() -> bool, nutze(name) -> bool, leiste (gameplay/faehigkeiten), ressource {name,wert,max}, faehigkeiten (freigeschaltete Namen), stufe, waffe, pfeile (Zahl lebender Pfeile) }`

```js
import { KAMPF_MODUL } from '../../engine/spiel/modul-kampf.js';
// in engine/spiel/module.js + module-register.js anmelden (braucht spieler + entitaeten); Taste F / Knopf ⚔ = Grundangriff, 1–5 = Fähigkeiten; ?stufe=12 schaltet im Test alles frei
kern.api('kampf').nutze('wuchtschlag');
```

Genutzt von: – · Tags: spiel, modul, kampf, nahkampf, bogen, klasse, fähigkeit, wut, energie, leiste, handy, erlenwacht · THREE: ja
Optionen: { klasse: 'krieger'|'waldlaeufer'|'magier' (sonst fortschritt.held.klasse), stufe, leisteUnten (px; Handy 228) }.
Schaden: entitaeten.schade(id, { menge, element:'koerper', quelle: spieler.id, stoss, krit }) gegen Team 'feind'; Werte aus fortschritt.werte() (schaden, krit, staerke/geschick/intellekt).
Rückstoß geht im Feld `stoss` mit – das Gegner-Modul wendet ihn bei ent:treffer an (kein zweiter gegner.stoss-Aufruf, sonst doppelt).
Ereignisse: sendet kampf:angriff {waffe, treffer}, kampf:faehigkeit {name, klasse}, chat:sende {kanal:'system'}; hört fort:stufe, fort:ausgeruestet, ent:treffer (Schild).
Läuft auch ohne fortschritt / zauber / gegner. Leistung: 1 InstancedMesh (Pfeile), keine Allokation pro Bild, DOM höchstens 10×/s.

### modul-oberflaeche · `engine/spiel/modul-oberflaeche.js` · v1.0.0 · entwurf
Spiel-Modul 'oberflaeche': Spieler-Rahmen (Name, Stufe, Leben, Ressource, EP), Ziel-Rahmen, Minikarte, Chat (hört auf alle Ereignisse), ☰-Menü mit Fenstern Charakter/Inventar/Talente/Karte/Optionen/Spielstand/Entwickler, Stufenaufstiegs-Einblendung – alles tolerant, wenn Nachbarmodule fehlen

- `OBERFLAECHE_MODUL -> api { chat, menue, hud, minikarte, zeigeFenster(name), banner(text,farbe) }`

```js
createSpiel({ module: [..., OBERFLAECHE_MODUL], optionen: { oberflaeche: { name: 'Goi', speichern: () => …, laden: () => … } } });
spiel.api('oberflaeche').chat.sende('system', 'Willkommen!');   // oder Ereignis chat:sende {kanal,text}
```

Genutzt von: erlenwacht · Tags: spiel, modul, ui, hud, chat, menue, minikarte, talente, inventar, mmo, handy · THREE: nein
Optionen: name (sonst Spieler-Name), pause(bool) (Menü pausiert das Spiel; fehlt = keine Pause), speichern() / laden() / hatStand() / zumTitel(),
entwickler { module: [Namen], info: {Name: Text} }. Takt: eigene Schleife (requestAnimationFrame), DOM höchstens 10×/s und nur bei Änderung.
Ereignisse, die in den Chat laufen: fort:xp|stufe|beute|ausgeruestet|talent, kampf:faehigkeit, aufgabe:neu|schritt|fertig, chat:sende, gegner:boss, ent:tod.

### modul-riesenwald · `engine/spiel/modul-riesenwald.js` · v1.1.0 · entwurf
Spiel-Modul 'riesenwald': Urwald-Riesen in echter Größe (Stamm 6–12 m dick, 60–90 m hoch) entlang der Wege in Region 'daemmerwald' – Weg frei, Tor-Paar mit Astbogen, dichte Blatt-Karten-Kronen mit Kronen-Schatten, Unterwuchs am Weg; Stämme als Hindernisse; Detailstufen nach Entfernung zum Fokus

- `RIESENWALD_MODUL -> api { riesen [{x,y,z,variante,skala,radius,reihe,…}], tor, imGebiet(x,z), zahlen() -> { riesen, stufen [voll,mittel,grob,fern], laubSichtbar, unterwuchs } }`

```js
import { RIESENWALD_MODUL } from '../../engine/spiel/modul-riesenwald.js';
const spiel = await createSpiel({ canvas, module: [WELT_MODUL, HIMMEL_MODUL, RIESENWALD_MODUL] });
spiel.api('riesenwald').zahlen();
```

Genutzt von: – · Tags: spiel, modul, wald, riesenbaum, urwald, laub, lod, kollision, daemmerwald · THREE: ja

### modul-spieler · `engine/spiel/modul-spieler.js` · v1.1.0 · entwurf
Spiel-Modul 'spieler': Spielfigur (character) mit Eingabe, tiefer Verfolger-Kamera (Riesen wirken groß), Lock-On auf Entitäten, Ausdauer (Sprint, Rolle, Schwimmen, Klettern, Springen), Klettern an Fels/Stämmen, eigene Entität mit Treffer-Reaktion + Wiederbeleben, Notlicht ohne Himmel

- `SPIELER_MODUL`

```js
import { SPIELER_MODUL } from '../../engine/spiel/modul-spieler.js';
const spiel = await createSpiel({ canvas, module: [WELT_MODUL, SPIELER_MODUL], optionen: { spieler: { fov: 66 } } });
spiel.api('spieler').teleport(10, 20, Math.PI);
```

Genutzt von: – · Tags: spiel, modul, spieler, figur, kamera, lock-on, ausdauer, klettern, sprint · THREE: ja
Modul-API: { figur, position, kamera, eingabe, id, teleport(x,z,yaw?), blickYaw, ziel, ausdauer, klettern, tot }; setzt Dienst fokus;
sendet spieler:aktion {name: springen|rollen|sprint|klettern|ziel|tod|wiederbelebt}.
Optionen 1.1: name (Figur + Entität), aktionen (zusätzliche move-input-Aktionen, Standard ⚔ aktion1 + 💬 interagieren).
Steuerung: WASD/Stick laufen · Shift/🏃 Sprint (halten) · Leertaste/⤒ springen (an der Wand: abspringen) · Q/🌀 Rolle/Dash ·
C ducken (an der Wand: loslassen) · T/Tab/🎯 Ziel erfassen/wechseln · Maus ziehen/Mausrad bzw. rechte Bildschirmhälfte: Kamera.
Klettern: gegen steilen Fels (> 55°) oder hohe Stämme laufen – kostet Ausdauer, leer = abrutschen.

### modul-tutorial · `engine/spiel/modul-tutorial.js` · v1.1.0 · entwurf
Spiel-Modul 'tutorial': Aufgabenkette (Alwe am Strand → Brandt in Erlenwacht → Grauzahn), Quest-NPCs mit !/?-Schild, Dialog-Fenster, Aufgaben-Verfolger rechts, Wegpunkt-Säule + Randpfeil

- `TUTORIAL_MODUL`

```js
import { TUTORIAL_MODUL } from '../../engine/spiel/modul-tutorial.js';
const spiel = await createSpiel({ canvas, module: [WELT_MODUL, SPIELER_MODUL, TUTORIAL_MODUL] });
spiel.api('tutorial').sprich('alwe');
```

Genutzt von: – · Tags: spiel, modul, tutorial, aufgaben, quest, npc, dialog, wegpunkt · THREE: ja
Dorf (optional, Modul 'dorf'): NPCs mit punkt, gehe-zu mit punkt und Aufgaben-Art 'ereignis' nutzen dorf.punkt/ziele; ohne Dorf gelten ort + versatz, Ereignis-Schritte sind automatisch erfüllt.
Hört zusätzlich: dorf:benutzt {art}, dorf:gebunden.
Modul-API: { aufgaben /* gameplay/aufgaben *\/, npcs {id: {figur,name,id,ent}}, sprich(npcId) }. Hört: ent:tod, fort:beute|ausgeruestet|stufe|talent, spieler:aktion.
Sendet: aufgabe:neu|schritt|fertig, chat:sende {kanal:'aufgabe'|'sagen'}. Belohnung über fortschritt.gibXp/gibGegenstand. ?test=1: kein Auto-Dialog.

### modul-welt · `engine/spiel/modul-welt.js` · v1.2.0 · entwurf
Erlenwacht-Welt (≈4×4 km): Karte/Regionen/Orte/Wege aus world/welt-regionen, Gelände als gestreamte Kacheln mit Detailstufen (world/chunk-strom), Streu-Bäume/Felsen/Büsche je Kachel als Instanzen samt Kollision, Meer und Moortümpel, Flüsse/Bäche (fluss-mesh, Strömung + Schaum), Gras um den Fokus (gras-feld), Fernwald (Impostor, 1 Draw-Call) – rund um den Dienst `fokus`

- `WELT_MODUL -> api wie im Vertrag (docs/plaene/ERLENWACHT-MODULE.md) + karte, statistik`

```js
import { WELT_MODUL } from '../../engine/spiel/modul-welt.js';
const welt = spiel.api('welt'); welt.bodenHoehe(0, 600); welt.region(-1200, 400).id; // 'moor'
// Optionen: kachelSegmente, streuWeite, kleinWeite, teilung, budget, fernWald (false = aus), fernWeite · Debug-Kamera: ?weltblick=gipfel oder ?weltblick=x,z,hoehe,yaw,pitch
```

Genutzt von: – · Tags: spiel, modul, welt, gelaende, streaming, lod, regionen, wege, wasser, erlenwacht, mmo · THREE: ja

### modul-zauber · `engine/spiel/modul-zauber.js` · v1.1.0 · entwurf
Spiel-Modul 'zauber': Zauberbuch (gameplay/zauber) + Effekte + Großzauber (Flutwelle, Erdwall, Zyklon, Erdriss) in der großen Welt, alle Treffer laufen durch gameplay/element-reaktionen (Schock, Einfrieren, Dampf, Feuersturm …); Ziele = Entitäten Team 'feind'; Zauber-Gesten der Figur; Handy-Leiste mit Halten = Aufladen und Mana-Balken

- `ZAUBER_MODUL -> api { buch, elemente, setzeLeiste(namen) (leer = Leiste aus), wirke(name,{halten}) -> bool, loslassen(), abbrechen(), leiste (Namen), tabelle, grosszauber, weltAdapter, tempoFaktor, ladung }`

```js
import { ZAUBER_MODUL } from '../../engine/spiel/modul-zauber.js';
// in engine/spiel/module.js + module-register.js anmelden; ?zauber=wasserguss,blitz wirkt in ?test=1 nacheinander, ?puppen=5 stellt Übungsziele auf
kern.api('zauber').wirke('feuerball');
```

Genutzt von: – · Tags: spiel, modul, zauber, magie, element, reaktion, großzauber, kampf, leiste, handy · THREE: ja
Optionen: { leiste: [8 Namen], mana: 100, manaRegen: 8, partikel: 900, freiesMana: false, leisteUnten (px; Handy 228 = über Stick/Knöpfen) }.
Ereignisse: sendet 'zauber:wirke' {name}, 'zauber:reaktion' {name,id,pos}; hört auf 'ent:tod' (vergisst Zustände).
Mit Modul 'gegner': hat es horde(id) -> {horde, wesen}, bekommen Treffer zusätzlich Sog/Umwerfen/Verlangsamen und Einfrieren = benommen.

### module-register · `engine/spiel/module-register.js` · v1.0.0 · entwurf
Modul-Register: welche Spiel-Module es gibt, wo jedes steht (labor → testfeld → spiel), wer welche Engine-Bausteine pflegt; wählt die Module für das echte Spiel, das Testfeld oder ein einzelnes Modul samt Abhängigkeiten

- `STUFEN`
- `MODUL_REGISTER`
- `registerEintrag(name)`
- `namenFuerStufe(stufe) -> [name]`
- `mitAbhaengigkeiten(namen, brauchtVon) -> [name]`
- `waehle({stufe, nur, brauchtVon}) -> [name]`
- `pruefeRegister(brauchtVon) -> [fehler]`

```js
import { waehle } from '../../engine/spiel/module-register.js';
waehle({ stufe: 'spiel' });                                   // nur fertige Module (das echte Spiel)
waehle({ stufe: 'testfeld' });                                // fertige + Module im Testfeld
waehle({ nur: ['kampf'], brauchtVon: (n) => MODULE[n].braucht }); // ein Modul + alles, was es zwingend braucht
```

Genutzt von: erlenwacht, testfeld · Tags: spiel, modul, register, stufe, testfeld, labor, agent, zustaendigkeit · THREE: nein
Stufen (aufsteigend): 'labor' = nur einzeln testbar (testfeld/?nur=<name>) · 'testfeld' = im gemeinsamen Testfeld ·
'spiel' = im echten Spiel Erlenwacht. Ein Modul steigt nur auf, wenn alle Module, die es `braucht`, mindestens gleich weit sind.
Das Register ist reine Daten: die Modul-Objekte selbst steckt engine/spiel/module.js zusammen.
bausteine = Engine-Ordner/-Dateien, für die die KI an diesem Modul zuständig ist (andere fasst sie nicht an, siehe AGENTS.md).

### module · `engine/spiel/module.js` · v1.0.0 · entwurf
Alle Spiel-Module an einer Stelle: Name → Modul-Objekt; wählt per Register (module-register) die Module fürs echte Spiel, fürs Testfeld oder ein einzelnes Modul samt Abhängigkeiten

- `ALLE_MODULE`
- `MODUL_INFO`
- `moduleFuer({stufe, nur}) -> [modul]`

```js
import { moduleFuer, MODUL_INFO } from '../../engine/spiel/module.js';
const spiel = await createSpiel({ canvas, module: moduleFuer({ stufe: 'spiel' }) });
moduleFuer({ nur: 'kampf' });   // Kampf + Spieler + Entitäten + Welt
```

Genutzt von: erlenwacht, testfeld · Tags: spiel, modul, register, auswahl, testfeld · THREE: ja
Neues Modul: engine/spiel/modul-x.js bauen, hier importieren + in ALLE_MODULE eintragen, in module-register.js mit stufe 'labor' anmelden.

### oberflaeche-fenster · `engine/spiel/oberflaeche-fenster.js` · v1.0.0 · entwurf
Menü-Seiten fürs Spiel-Modul 'oberflaeche': Charakter (Werte, Ausrüstung), Inventar, Talente (3 Spalten), Karte, Optionen, Spielstände, Entwickler – alles über ui/menue, tolerant gegen fehlende Module

- `baueFenster({menue,render,chat,api,opt,ereignisse,karte}) -> { dispose() } — Parameter api = { fort(), welt(), spieler(), ents(), kern } (Funktionen, geben null wenn Modul fehlt)`

```js
const f = baueFenster({ menue, render, chat, api, opt: {}, ereignisse, karte });  // danach menue.zeige('charakter')
```

Genutzt von: – · Tags: ui, menue, fenster, charakter, inventar, talente, karte, optionen, mmo · THREE: nein

### riesenwald-teile · `engine/spiel/riesenwald-teile.js` · v1.0.0 · entwurf
Bauteile des Riesenwald-Moduls: Fern-Silhouette eines Riesen (eine Drehform mit Kronen-Wulst, ~150 Dreiecke), Astbogen zwischen zwei Tor-Riesen (gebogene, verjüngte Röhre mit Moos oben) und eine Loch-Maske für Kronen-Schatten

- `fernRiese({ hoehe, stammRadius, kronenAb, kronenRadius, segmente = 9 }) -> BufferGeometry`
- `astBogen({ a {x,y,z,r}, b {x,y,z,r}, scheitel = 26, dicke = 1.8, seed }) -> { geometrie, punkte [[x,y,z]…] }`
- `lochMaske({ seed, groesse = 64, dicht = 0.42 }) -> DataTexture`

```js
import { fernRiese, astBogen, lochMaske } from '../../engine/spiel/riesenwald-teile.js';
const geo = fernRiese({ hoehe: 80, stammRadius: 5, kronenAb: 44, kronenRadius: 32 });
const bogen = astBogen({ a: { x: -9, y: 0, z: 0, r: 6 }, b: { x: 9, y: 0, z: 0, r: 5 } });
```

Genutzt von: – · Tags: spiel, riesenwald, impostor, lod, ast, bogen, schatten, maske · THREE: ja

### spiel · `engine/spiel/spiel.js` · v1.0.1 · entwurf
Spiel-Host: die ganze Engine in einem Aufruf – Renderer, Szene, Kamera, Schleife (fester Schritt + Bild), Handy-Qualität, URL-Schalter und Modul-Kern; Module (Welt, Figur, Zauber, Gegner …) werden nur noch angesteckt

- `createSpiel({canvas,module,optionen,seed,url,qualitaet,fest,fehler,hintergrund}) -> Promise<{kern,api(name),renderer,szene,kamera,ui,url,test,stufe,schleife,pause(bool),dispose()}>`
- `leseUrl(suche) -> {aus,test,seed,q,ort,debug,werte}`

```js
import { createSpiel } from '../../engine/spiel/spiel.js';
import { WELT_MODUL } from '../../engine/spiel/modul-welt.js';
const spiel = await createSpiel({ canvas: document.getElementById('c'), module: [WELT_MODUL, SPIELER_MODUL] });
spiel.api('spieler').teleport(10, 20);
```

Genutzt von: erlenwacht, testfeld · Tags: spiel, host, modul, renderer, schleife, baukasten, mmo · THREE: ja

### tutorial-daten · `engine/spiel/tutorial-daten.js` · v1.1.0 · entwurf
Reine Daten der Erlenwacht-Aufgabenkette (Tutorial + Hauptgeschichte) für gameplay/aufgaben: Schritte, Belohnungen, NPC-Dialoge

- `AUFGABEN_DATEN`
- `NPC_DATEN`
- `ORTS_OPTIONAL`

```js
import { AUFGABEN_DATEN } from '../../engine/spiel/tutorial-daten.js';
const a = createAufgaben({ daten: AUFGABEN_DATEN, ... }); a.starte('erwachen');
```

Genutzt von: – · Tags: spiel, tutorial, aufgaben, quest, daten, dialog · THREE: nein
Erweiterungen je Aufgabe: geber (NPC-Id), intro (Text-Liste im Chat). Je Schritt: sagt (Dialogzeilen bei sprich-mit), hinweis.
NPC-Feld punkt: Dorf-Punkt-Id (Modul dorf); ohne Dorf gilt ort + versatz. Schritt-Feld punkt (gehe-zu) wie bei gameplay/aufgaben, Fallback ort.
Art 'ereignis' (was = brunnen | gebunden | anschlagbrett | amboss | feuer) braucht das Dorf; ohne Dorf gilt sie als erfüllt.
Benutze-Schritte: was = 'springen' | 'sprint' | 'kamera' | 'beute' | 'ausruesten' | 'stufe-4' | 'talent'. Besiege: ziel = Gegner-Art (ent.daten.art, Boss = 'boss'), '*' = jeder Gegner.

### zauber-anzeige · `engine/spiel/zauber-anzeige.js` · v1.0.0 · entwurf
Sichtbares zu Element-Reaktionen fürs Zauber-Modul: Boden-Flecken (nass, brennend, gefroren, schlamm, geladen) als weiche Scheiben in einem Draw-Call, Dampfwolken (Sprites), Eis-Glanz (Eis-Hülle), Funken/Feuersturm über zauber-effekte und der Ziel-Kreis beim Aufladen – alles aus Pools, fürs Handy sparsam

- `createZauberAnzeige({szene,welt,fx,anteil}) -> { flecken(liste), reaktion(folge|reaktion,pos), wolke(x,z,radius,dauer), glanz(pos,radius,dauer), kreis(pos|null,radius,farbe,anteil), update(dt), dispose() }`

```js
import { createZauberAnzeige } from '../../engine/spiel/zauber-anzeige.js';
const an = createZauberAnzeige({ szene, welt, fx });
an.flecken(reaktionen.flecken); an.wolke(10, 4, 3, 4); an.update(dt);
```

Genutzt von: – · Tags: spiel, zauber, effekt, element, reaktion, dampf, eis, boden, fleck, vfx · THREE: ja

### zauber-gross · `engine/spiel/zauber-gross.js` · v1.0.0 · entwurf
Großzauber fürs Zauber-Modul in der großen Welt: Logik (gameplay/grosszauber + welle/wand/sturm/riss) und Bild (render/grosszauber-*); Erdwall-Pfeiler werden echte Körper in welt.kollision, die Flutwelle macht den Boden nass, Zyklon/Erdriss legen Wind/Feuer auf den Boden (Element-Reaktionen)

- `createZauberGross({szene,welt,fx,amBoden,treffer,spieler,seed}) -> { wirke(e) -> id|null, fest(dt,ziele), update(dt), logik, weltAdapter, dispose() }`

```js
import { createZauberGross } from '../../engine/spiel/zauber-gross.js';
const gross = createZauberGross({ szene, welt, fx, amBoden, treffer, spieler });
gross.wirke(ereignisVomZauberbuch);   // e.typ === 'gross'
```

Genutzt von: – · Tags: spiel, zauber, großzauber, welle, wand, sturm, riss, kollision, welt, element · THREE: ja
weltAdapter: welt + Großzauber (bodenHoehe mit Gräben/Podesten, wasserHoehe mit Flut, hindernisse mit Wänden) für Module, die ihn nutzen wollen.
welt selbst wird nicht verändert (das Gelände-Streaming liest das Grund-Gelände).

### fake-dom · `engine/test/fake-dom.mjs` · v1.1.0 · stabil
Minimale Browser-Attrappe für Node-Tests: document, window, localStorage, requestAnimationFrame

- `installFakeDom(opts) -> { els, rafs, storage, winListener, docListener, tick(dt) }`
- `fakeElement(tag) -> Element-Attrappe { children, parentNode, style, appendChild, append, prepend, insertBefore, removeChild, replaceChildren, remove, contains, addEventListener, removeEventListener, dispatch(typ, ereignis), click() }`

```js
import { installFakeDom } from '../test/fake-dom.mjs';
const dom = installFakeDom({ breite: 400, hoehe: 800 });
dom.tick(16); // führt alle angefragten Animation-Frames aus
```

Genutzt von: – · Tags: test, dom, node, attrappe · THREE: nein

### aufgaben-anzeige · `engine/ui/aufgaben-anzeige.js` · v1.0.0 · entwurf
Ziel-Zeile oben links (Titel, Schritt-Text, Fortschritt), Ziel-Marker (Raute + Meter) bzw. Randpfeil, Blitz-Meldung/Banner; DOM, THREE nur für project()

- `createAufgabenAnzeige({eltern,oben,links,zIndex,rand}) -> { element, setze(info|null), ziel({x,y,z}|null), update(kamera, dt, spielerPos?), blitz(text,{dauer,gross}), zeige(an), sichtbar, dispose() }`
- `randLage({x,y,z}, breite, hoehe, rand) -> { x, y, winkel, imBild }`

```js
import { createAufgabenAnzeige } from '../../engine/ui/aufgaben-anzeige.js';
const anzeige = createAufgabenAnzeige({ oben: 12 });
anzeige.setze(aufgaben.aktuell());               // null blendet aus
anzeige.ziel({ x: 12, y: 1.5, z: -8 });          // Weltpunkt des Ziels
anzeige.update(kamera, dt, { x: spieler.x, z: spieler.z });   // jedes Bild
anzeige.blitz('Willkommen in der Enklave', { gross: true, dauer: 5 });
```

Genutzt von: enklave · Tags: ui, aufgabe, ziel, marker, pfeil, banner, tutorial, overlay · THREE: ja

### chat · `engine/ui/chat.js` · v1.0.0 · entwurf
Chat-Fenster fürs MMO: Kanäle (system, kampf, beute, sagen, aufgabe, welt) mit Farben und Reiter-Filter, eingeklappt 3 Zeilen halbtransparent, antippen = groß mit Eingabezeile; Befehle (/hilfe, /ort …) als Register; Ring-Puffer 80 Zeilen; Logik ohne DOM testbar

- `createChatLogik({max,kanaele,name}) -> {zeile(kanal,text,{von,farbe}), zeilen(filter?,n?), filter, setzeFilter(k), befehl(name,fn,hilfe), befehle(), eingabe(text)->bool, onAenderung(fn)->abmelden, kanaele, anzahl}`
- `createChat({eltern,max,kanaele,name,unten,zIndex}) -> {...logik, element, sende(kanal,text,opts), gross(an), istGross, dispose()}`

```js
import { createChat } from '../../engine/ui/chat.js';
const chat = createChat({ eltern: render.ui, name: 'Alwe' });
chat.befehl('tanz', () => 'Du tanzt.', 'Tanzen');
chat.sende('kampf', 'Du triffst Ratte für 12.');
chat.eingabe('/tanz');   // Befehl;  chat.eingabe('Hallo') → Kanal „sagen“
```

Genutzt von: – · Tags: ui, chat, befehle, kanaele, mmo, dom, handy, protokoll · THREE: nein

### figur-editor · `engine/ui/figur-editor.js` · v1.0.0 · entwurf
Aussehen einer Figur bearbeiten (DOM, Handy): je Teil ◀ ▶ durch die Stile, Farb-Tupfer für Haut/Haar/Kleidung/Hose, Körper-Regler, Zufall-Knopf und Vorlagen – liefert nur den Look (Daten), die Vorschau zeichnet der Aufrufer

- `createFigurEditor({eltern,look,seed,teile,onAenderung(look),vorlagen}) -> {element, look, setzeLook(teil), zufall(), dispose()}`

```js
import { createFigurEditor } from '../../engine/ui/figur-editor.js';
const ed = createFigurEditor({ eltern: box, look: createLook({}), onAenderung: (look) => vorschau.setLook(look) });
```

Genutzt von: erlenwacht · Tags: ui, editor, figur, aussehen, look, charakter, erstellen, farben, handy, dom · THREE: nein

### figur-schild · `engine/ui/figur-schild.js` · v1.1.0 · entwurf
Namensschild + Sprechblase + Lebensbalken über Figuren (DOM-Overlay): folgt dem Kopf, skaliert und blendet nach Abstand aus, verschwindet hinter der Kamera

- `createFigurSchilder(opts) -> { neu(ziel, {name, leben, farbe, versatz, nameAb}) -> schild, update(kamera, dt), anzahl, dispose() } — jedes Schild: { setName(t), sage(text, {dauer}) , schweige(), setLeben(anteil|null), setFarbe(css), zeige(bool), ziel, spricht, sichtbar, entfernen() }`

```js
import { createFigurSchilder } from '../../engine/ui/figur-schild.js';
const schilder = createFigurSchilder();
const s = schilder.neu(npc.model.rig.sockel.kopf, { name: 'Bauer Jupp', leben: 0.8 });   // Object3D, {x,y,z} oder Funktion
s.sage('Schönes Wetter heute!');
schilder.update(kamera, dt);   // jedes Bild nach der Kamera, vor/nach dem Rendern
```

Genutzt von: enklave, figuren, handwerk · Tags: ui, namensschild, sprechblase, dialog, lebensbalken, hp, figur, npc, overlay, hud · THREE: ja

### hud · `engine/ui/hud.js` · v1.0.0 · entwurf
Spiel-Anzeige als DOM-Overlay: Hinweis-Zeile mit Fortschritt, Kurzmeldungen (zusammenzählbar), Lebens-/Ausdauer-Balken und Bereiche für Leisten

- `createHud({eltern,unten,zIndex,maxMeldungen,farben}) -> { element, hinweis(text, anteil?), melde(text, {dauer, art, schluessel, anzahl}) -> meldung, balken(id, {wert, farbe, zeichen, text}|null), bereich(name) -> Element, update(dt), zeige(an), sichtbar, meldungen, dispose() }`

```js
import { createHud } from '../../engine/ui/hud.js';
const hud = createHud({ unten: 124 });
hud.balken('leben', { wert: 0.8, zeichen: '❤', farbe: '#e0683c' });
hud.hinweis('E – Aufheben');                       // jedes Bild aufrufen ist ok, '' blendet aus
hud.melde('+{n} 🪵 Holz', { schluessel: 'holz', anzahl: 3 });
hud.bereich('leiste').append(meineLeiste);         // Bereiche: leiste, ueberLeiste, obenLinks, obenRechts, mitte
hud.update(dt);                                    // jedes Bild (lässt Meldungen altern)
```

Genutzt von: enklave, handwerk · Tags: ui, hud, hinweis, meldung, toast, balken, leben, leiste, overlay · THREE: nein

### inventar-ansicht · `engine/ui/inventar-ansicht.js` · v1.0.1 · entwurf
Zeigt ein Inventar als Reihe/Raster von Plätzen (Schnellleiste, Rucksack, Truhe): Zeichen, Anzahl, Haltbarkeits-Strich, gewählter Platz, Tippen und Gedrückt-halten

- `createInventarAnsicht({inventar,register,eltern,von,bis,spalten,groesse,breite,gewaehlt,titel,onTipp,onLang,langMs,zeichen,farben}) -> {element,felder,zeichne(),update(dt),dispose()}`

```js
import { createInventarAnsicht } from '../../engine/ui/inventar-ansicht.js';
const leiste = createInventarAnsicht({ inventar: inv, register: items, eltern: document.body, bis: 8,
gewaehlt: () => hand.platz, onTipp: (platz) => hand.waehle(platz) });
// jedes Bild: leiste.update(dt);   // dt in Sekunden; nötig für onLang und für den Wechsel des gewählten Platzes
```

Genutzt von: enklave, handwerk · Tags: ui, inventar, schnellleiste, hotbar, rucksack, truhe, raster, hud, touch · THREE: nein

### kampf-leiste · `engine/ui/kampf-leiste.js` · v1.0.0 · entwurf
MMO-Aktionsleiste als DOM-Overlay: Plätze mit Symbol/Taste, Abklingzeit, GCD, Ladungen, Ausgrauen, Wirkbalken, Ressourcenbalken

- `createKampfLeiste({eltern,plaetze,onNutze,unten,zIndex}) -> { element, setPlaetze(liste), update(dt, leiste), blitz(name), dispose() }`

```js
import { createKampfLeiste } from '../../engine/ui/kampf-leiste.js';
const kl = createKampfLeiste({ plaetze: [{ name: 'feuerball', symbol: '🔥', taste: '1' }], onNutze: (n) => leiste.nutze(n, { ziel }) });
kl.update(dt, leiste);   // jedes Bild; leiste wie aus createLeiste (abkling, ladungen, kann, gcdAnteil, wirkt, ressource)
kl.blitz('feuerball');   // kurzes Aufblitzen (z. B. bei Ereignis 'fertig')
```

Genutzt von: figuren · Tags: ui, overlay, kampf, mmo, hotbar, abklingzeit, gcd, wirkbalken, ressource, leiste, touch · THREE: nein

### menue · `engine/ui/menue.js` · v1.0.0 · entwurf
Menü/Fenster als DOM-Overlay mit Seiten (Pause, Optionen, Spielstände, Truhe, Werkbank …): Knöpfe, Schalter, Regler, Auswahl, eigene Elemente; Escape/Rand-Tipp, fingerfreundlich, alle Stile inline

- `createMenue({eltern,zIndex,breite,randSchliesst,taste,onAuf,onZu,farben}) -> {element, offen, aktuell, seite(name,{titel,eintraege|()=>[],zurueck,schliessbar}), zeige(name='start'), schliesse(), schalte(name), zurueck(), aktualisiere(), dispose()}`
- `spielstandEintraege(speicher,{slots,holeDaten,onLade,beschreibe,namen}) -> () => Einträge`

```js
import { createMenue, spielstandEintraege } from '../../engine/ui/menue.js';
const m = createMenue({ onAuf: () => pausiere(true), onZu: () => pausiere(false) });
m.seite('start', { titel: 'Pause', schliessbar: true, eintraege: [
{ text: 'Weiter', schliesst: true },
{ text: 'Optionen', nach: 'optionen' },
{ text: 'Spielstände', nach: 'staende' } ] });
m.seite('optionen', { titel: 'Optionen', zurueck: 'start', eintraege: [
{ art: 'regler', text: 'Lautstärke', wert: () => vol, setze: v => vol = v, format: v => Math.round(v * 100) + ' %' } ] });
m.seite('staende', { titel: 'Spielstände', zurueck: 'start',
eintraege: spielstandEintraege(speicher, { holeDaten: () => stand(), onLade: d => lade(d) }) });
// Escape öffnet/zurück/schließt; m.schalte() per Knopf
```

Genutzt von: enklave, handwerk · Tags: ui, menue, pause, optionen, fenster, overlay, dialog, spielstand, dom, handy · THREE: nein
Einträge einer Seite (art fehlt → knopf): knopf{text,zeichen,hinweis,aktiv,aktion,nach,schliesst} | schalter{text,wert,setze} | regler{text,min,max,schritt,wert,setze,format} | auswahl{text,optionen,wert,setze} | text | trenner | element | reihe{eintraege}

### minikarte · `engine/ui/minikarte.js` · v1.0.0 · entwurf
Runde Minikarte (Canvas, 92 px) fürs MMO: Gelände-Farbbild der ganzen Welt einmal vorberechnet (in kleinen Zeit-Stückchen), Spieler-Pfeil, Orte als Punkte, Gegner rot (4×/s); dieselbe Zeichnung auch groß mit Ortsnamen für ein Karten-Fenster

- `createMinikarte({eltern,welt,entitaeten,spieler,groesse,radius,bild,onTipp,zIndex,oben}) -> {element, fertig, update(dt), zeichneIn(canvas,{radius,namen,rund}), dispose()}`

```js
import { createMinikarte } from '../../engine/ui/minikarte.js';
const karte = createMinikarte({ eltern: render.ui, welt, entitaeten, spieler, onTipp: () => menue.zeige('karte') });
// jedes Bild: karte.update(dt);   // zeichnet höchstens 4×/s
karte.zeichneIn(grossCanvas, { radius: 2000, namen: true });
```

Genutzt von: – · Tags: ui, minikarte, karte, canvas, mmo, orte, gegner, handy · THREE: nein

### treffer-zahlen · `engine/ui/treffer-zahlen.js` · v1.1.0 · entwurf
Schadens-Zahlen als DOM-Overlay: ploppen über Treffern auf, schweben nach oben und blenden aus (fester Pool, handytauglich)

- `createTrefferZahlen({eltern=document.body, max=28, zIndex=6, seed=1}) -> { zeige(pos,text,{farbe,groesse,dauer,steigen,streuung}), update(kamera,dt), anzahl, grenze (Obergrenze setzen), dispose() }`

```js
import { createTrefferZahlen } from '../../engine/ui/treffer-zahlen.js';
const zahlen = createTrefferZahlen({ max: 28 });
zahlen.zeige({ x, y, z }, '−30', { farbe: '#ffd870', groesse: 1.4 });
zahlen.update(kamera, dt); // jedes Bild
```

Genutzt von: enklave, figuren · Tags: ui, treffer, schaden, zahlen, overlay, dom · THREE: ja

### zauber-leiste · `engine/ui/zauber-leiste.js` · v1.0.0 · entwurf
Handy-taugliche Zauber-Leiste als DOM-Overlay: große Knöpfe (≥ 44 px) mit Symbol, Taste, Abklingzeit-Schleier und Lade-Ring; Halten = Aufladen/Überladen, Loslassen = Wirken (Zeiger UND Tasten 1–8); Mana-Balken darüber

- `createZauberLeiste({eltern,plaetze,onDruck,onLos,unten,groesse,tasten}) -> { element, update({mana,manaMax,abkling(name)->0…1,kann(name)->bool,ladung:{name,anteil,ueber}|null}), blitz(name), dispose() }`

```js
import { createZauberLeiste } from '../../engine/ui/zauber-leiste.js';
const leiste = createZauberLeiste({ eltern: render.ui, plaetze: [{ name: 'feuerball', symbol: '🔥', farbe: 0xff7a2a }],
onDruck: (n) => zauber.wirke(n, { halten: true }), onLos: () => buch.lasseLos() });
leiste.update({ mana: buch.mana, manaMax: buch.manaMax, abkling: (n) => buch.abklingAnteil(n), kann: (n) => buch.kann(n).ok, ladung: buch.ladung });
```

Genutzt von: – · Tags: ui, overlay, zauber, leiste, hotbar, touch, handy, mana, aufladen, halten · THREE: nein
plaetze: [{ name, symbol, farbe (Zahl), taste (Standard '1' … '8'), gross (Großzauber: goldener Rand) }].
Die Wurzel hat pointer-events:none, nur die Knöpfe fangen Zeiger. Tasten mit Wiederholung werden ignoriert.

### ziel-rahmen · `engine/ui/ziel-rahmen.js` · v1.0.0 · entwurf
MMO-Ziel-/Spieler-Rahmen als DOM-Overlay: Name, Lebensbalken mit Schild und Schaden-Rest, Haltung, Ressource, Zustands-Symbole

- `createZielRahmen({eltern,ecke,breite,zIndex}) -> { element, zeige(daten|null), update(dt), dispose() }`

```js
import { createZielRahmen } from '../../engine/ui/ziel-rahmen.js';
const ziel = createZielRahmen({ ecke: 'oben-mitte' });
ziel.zeige({ name: 'Wolf', stufe: 3, leben: 40, lebenMax: 60, feindlich: true, zustaende: [{ name: 'Gift', symbol: '☠', rest: 4, dauer: 6, stapel: 2, nuetzlich: false }] });
ziel.update(dt);   // jedes Bild (Schaden-Rest rutscht nach, Haltung blinkt)
ziel.zeige(null);  // verstecken
```

Genutzt von: figuren · Tags: ui, overlay, kampf, mmo, ziel, lebensbalken, buff, debuff, haltung, schild · THREE: nein

### boden-anpassung · `engine/world/boden-anpassung.js` · v1.0.0 · entwurf
Gelände schmiegt sich an große Objekte (Wurzeln, Felsen, Ruinen): weicher Erdwulst aus lokalen Höhenkarten, Verdeckung (AO) am Fuß

- `createBodenAnpassung({grundHoehe(x,z),zelle=0.6,bucket=32}) -> {fuegeFussabdruck({x,z,y?,drehung=0,skala=1,hoeheBei(lx,lz),radius,einbettung=0.35,ueberdeckung=0.12,boeschung=0.55,maxWulst=2.4,einsinken=0.3,aoHang=0.9,aoHoehe=3})->{y,wulstMax}|null, hoehe(x,z), grund(x,z), verdeckung(x,z)->0..1, fussabdruecke, dispose()}`

```js
import { createBodenAnpassung } from '../../engine/world/boden-anpassung.js';
const boden = createBodenAnpassung({ grundHoehe: (x, z) => gelaende(x, z) });
const { y } = boden.fuegeFussabdruck({ x: 10, z: 40, drehung: 0.6, skala: 1.1, hoeheBei: baum.kollision.hoehenkarte.hoeheBei, radius: 30 });
baumMesh.position.set(10, y, 40);                // Fuß auf y, der Boden wölbt sich an die Wurzeln
const h = boden.hoehe(12, 41), ao = boden.verdeckung(12, 41);
```

Genutzt von: daemmerwald · Tags: gelaende, boden, wurzeln, hoehenkarte, ao, verdeckung, welt, worldgen, riesenbaum · THREE: nein

### chunk-strom · `engine/world/chunk-strom.js` · v1.0.0 · entwurf
Gelände-Kacheln um einen Fokus streamen (reine Logik): Quadtree-Detailstufen (nah fein, fern grob) bis zur Sichtweite, Bau-Budget je Bild, alte Kacheln bleiben, bis die neuen fertig sind (keine Löcher); dazu ein einfacher Kachel-Ring für Nahbereichs-Daten (Streu, Kollision)

- `createChunkStrom({wurzel,blatt,teilung,sicht,budget,grenze,baue(k)->obj,entferne(k,obj)}) -> {update(fx,fz)->{gebaut,entfernt,offen},waehle(fx,fz)->[k],geladen:Map,anzahl,fertig,dispose()}`
- `createKachelRing({groesse,radius,budget,lade(k)->obj,entlade(k,obj)}) -> {update(fx,fz)->{geladen,entladen,offen},geladen:Map,neuLaden(fn?),dispose()}`

```js
import { createChunkStrom } from '../../engine/world/chunk-strom.js';
const strom = createChunkStrom({ wurzel: 512, blatt: 64, sicht: 800, baue: (k) => baueMesh(k), entferne: (k, m) => m.dispose() });
strom.update(spieler.x, spieler.z);   // je Bild: baut höchstens `budget` Kacheln, nächste zuerst
// k = { key, x0, z0, groesse, stufe (0 = feinste), cx, cz }
```

Genutzt von: – · Tags: welt, streaming, chunks, kacheln, lod, quadtree, detailstufen, gelaende, unendlich · THREE: nein

### dorf-plan-kern · `engine/world/dorf-plan-kern.js` · v1.0.0 · entwurf
Handgesetzter Kern des Dorfes Erlenwacht (Platz, Taverne, Tempel, Schmiede …) relativ zur Dorfmitte + Standard-Maße (ohne THREE)

- `STANDARD_MASSE`
- `PLATZ_RADIUS`
- `kernSpezifikation() -> [{id, typ, dx, dz, w | blick:[dx,dz]}]`
- `ostGasse() / westGasse() -> [[dx,dz]…]`
- `BRUECKE_DX`

```js
import { kernSpezifikation } from './dorf-plan-kern.js';
```

Genutzt von: – · Tags: dorf, plan, erlenwacht, kern · THREE: nein

### dorf-plan · `engine/world/dorf-plan.js` · v1.0.0 · entwurf
Plan des Startdorfes Erlenwacht (reine Logik, ohne THREE): Platz-Kern, Häuser an Wegen, Gärten, Kleinkram, Gassen, Laternen, Brücke, Felder, Palisade

- `createDorfPlan({seed, mitte, radius=115, hoehe, wasser, wege, masse}) -> {teile:[{id,typ,variante,x,z,winkel,y,kern}], punkte, gassen, felder, sperren, lichter, platzRadius, pruefe()}`
- `STANDARD_MASSE`

```js
import { createDorfPlan } from '../../engine/world/dorf-plan.js';
const plan = createDorfPlan({ seed: 1207, mitte: { x: 0, z: 600 }, hoehe: karte.hoehe, wasser: (x, z) => karte.wasserHoehe(x, z) !== null, wege: karte.wege });
plan.pruefe(); // -> [] wenn alles stimmt
```

Genutzt von: – · Tags: dorf, plan, erlenwacht, siedlung, welt · THREE: nein

### fern-wald · `engine/world/fern-wald.js` · v1.0.0 · entwurf
Fernwald als Impostor-Kacheln: Wald-Biome jenseits der Streu-Reichweite (innen … aussen, ~150–1500 m) als grobe Zwei-Kegel-Baumgruppen in EINEM InstancedMesh (1 Draw-Call, ≤ 60 k △), Farbe nach Biom, Nebel über das Szenen-Material; Kacheln (200 m) werden bei Kachelwechsel des Fokus nachgeladen, nie je Bild

- `createFernWald({karte, seed, niedrig, kachel=200, innen=150, aussen=1500, maxDreiecke=60000}) -> {mesh, update(fx,fz,max=3)->{neu,neuAufgebaut}, anzahl, dreiecke, dispose()}`
- `fernwaldKachel(karte, kachel, {seed,dichte}) -> [{x,y,z,s,r,rot,farbe}]`

```js
import { createFernWald } from '../../engine/world/fern-wald.js';
const fern = createFernWald({ karte, seed: 7, niedrig: true, innen: 110 }); szene.add(fern.mesh);
fern.update(spieler.x, spieler.z);   // je Bild billig: baut nur bei Kachelwechsel neu
```

Genutzt von: – · Tags: welt, wald, fern, impostor, instancing, lod, kacheln, erlenwacht · THREE: ja

### fluss-mesh · `engine/world/fluss-mesh.js` · v1.0.0 · entwurf
Wasserband für Flüsse/Bäche aus Proben {x,z,y,b}: 5 Punkte je Querschnitt (Rand reicht unter die Böschung → keine Lücke), Attribute `ufer` (Schaumsaum für wasser-glanz) und `lauf` (Meter flussab) für fließende Strömungs-Streifen im Shader; ein Mesh für alle Flüsse

- `flussBand(proben, {rand}) -> {pos, ufer, lauf, idx} (reine Daten)`
- `createFlussMesh(fluesse, {farbe, opazitaet, tempo}) -> {mesh, material, update(zeit), dispose()}`

```js
import { createFlussMesh } from '../../engine/world/fluss-mesh.js';
const fl = createFlussMesh(karte.fluesse); szene.add(fl.mesh);   // createWasserGlanz([fl.material]) für Glitzer + Schaum
// je Bild: fl.update(zeit);
```

Genutzt von: – · Tags: wasser, fluss, bach, stroemung, schaum, shader, welt · THREE: ja

### gras-feld · `engine/world/gras-feld.js` · v1.0.0 · entwurf
Wogendes Gras um den Fokus: ein InstancedMesh (ein Draw-Call), Halm-Büschel aus gekreuzten, sich verjüngenden Streifen, Wind + Ausblenden (Größe → 0) im Vertex-Shader; Platzierung rein und deterministisch aus der Weltkarte

- `createGrasFeld({ karte, seed, weite = 45, dichte = 1, max, sperren }) -> { mesh, update(dt, fokus{x,z}, zeit), setzeDichte(d), anzahl, dispose() }`
- `grasPunkte(karte, kachel{x0,z0,groesse}, { seed, dichte, sperren }) -> { n, daten:Float32Array } (Schritt PUNKT_STRIDE: x,y,z,drehung,breite,hoehe,r,g,b(linear),rang[0..1])`
- `PUNKT_STRIDE`
- `GRAS_DICHTE`

```js
const gras = createGrasFeld({ karte: createWeltRegionen({ seed: 1207 }), seed: 1207, weite: 45 });
szene.add(gras.mesh);   // je Bild: gras.update(dt, { x: spieler.x, z: spieler.z }, zeit);
```

Genutzt von: – · Tags: gras, vegetation, instanzen, wind, boden, welt, render · THREE: ja

### himmel-stand · `engine/world/himmel-stand.js` · v1.0.0 · entwurf
Himmel als reine Daten: Sonnen- und Mondbahn aus Stunde/Jahreszeit/Breitengrad, Mondphase, Himmels-, Nebel- und Lichtfarben über den Tag (Nacht, Dämmerung, goldene Stunde, Mittag), Sterne, Einfluss von Wolken/Nebel/Regen/Blitz

- `himmelStand({ stunde, jahresAnteil=0.25, tag=1, breite=48, wetter? }, ziel?) -> { sonneRichtung, mondRichtung, lichtRichtung, sonneHoehe, mondHoehe, mondPhase, mondHell, tag, sterne, lichtStaerke, lichtFarbe, umgebungStaerke, sichtweite, wolken, farben: { zenit, horizont, nebel, sonne, umgebungHimmel, umgebungBoden } }`
- `sonnenRichtung(stunde, jahresAnteil, breite, ziel?) -> [x,y,z]`
- `MOND_UMLAUF`

```js
import { himmelStand } from '../../engine/world/himmel-stand.js';
const stand = himmelStand({ stunde: uhr.stunde, jahresAnteil: uhr.jahresAnteil, tag: uhr.tag, wetter });
himmel.update(stand, { kamera, mitte: figur.position });
```

Genutzt von: daemmerwald, enklave, handwerk · Tags: himmel, tag, nacht, sonne, mond, sterne, licht, farben, dämmerung, wetter · THREE: nein

### himmel · `engine/world/himmel.js` · v1.1.0 · entwurf
Zeichnet den Himmel aus einem himmel-stand: Himmelskuppel mit Farbverlauf, Sonnenscheibe mit Schein, Mond mit Phase, ziehende Wolken, Sterne; steuert Sonnen-/Mondlicht mit mitlaufendem Schatten, Umgebungslicht und Nebel der Szene

- `createHimmel({ szene, schatten=true, schattenWeite=45, schattenAufloesung=2048, schattenAbstand=150, radius=900, sterne=900, seed=1, nebel={nah:120,fern:520}, wolken=true }) -> { gruppe, licht, umgebung, uniforms, update(stand, { kamera, mitte?, zeit?, wind?, windRichtung? }), setNebel(nah, fern), dispose() }`

```js
import { createHimmel } from '../../engine/world/himmel.js';
import { himmelStand } from '../../engine/world/himmel-stand.js';
const himmel = createHimmel({ szene });
// je Bild:
himmel.update(himmelStand({ stunde, wetter }, stand), { kamera, mitte: figur.position, zeit });
```

Genutzt von: enklave, handwerk · Tags: himmel, sonne, mond, sterne, wolken, licht, schatten, nebel, tag, nacht, shader · THREE: ja

### kollision · `engine/world/kollision.js` · v1.0.0 · entwurf
Kollisions-Welt über einem Welt-Adapter: bewegliche und entfernbare Körper (Zylinder, gedrehte Kästen) mit Höhe – man kann draufsteigen, drüberspringen, sich aneinander vorbeischieben; dazu ein Strahl-Test gegen Gelände und Körper (Zielen, Sichtlinie, Ablegen)

- `createKollisionsWelt({welt,zelle,stufe}) -> {bodenHoehe(x,z,y?),wasserHoehe(x,z),hindernisse(x,z,radius,filter?),fuege(koerper)->id,bewege(id,x,z,y0?),entferne(id),hole(id),imUmkreis(x,z,radius,fn),strahl(von,richtung,maxDistanz,opts?),anzahl,basis,dispose()}`

```js
import { createKollisionsWelt } from '../../engine/world/kollision.js';
const welt = createKollisionsWelt({ welt: adapter });           // erfüllt denselben Welt-Vertrag wie der Adapter
const kiste = welt.fuege({ form: 'kasten', x: 4, z: 2, bx: 0.5, bz: 0.5, hoehe: 0.9, begehbar: true });
const motor = createMotor({ welt });                             // läuft gegen Kisten, springt drauf
const t = welt.strahl({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 0, z: 1 }, 30);   // → { distanz, x, y, z, id, art }
```

Genutzt von: daemmerwald, enklave, handwerk · Tags: kollision, physik, welt, hindernis, koerper, strahl, raycast, begehbar, adapter · THREE: nein
Körper: { form: 'kreis' (Standard) | 'kasten', x, z, radius | bx, bz (halbe Breite/Tiefe) + winkel (Drehung um Y),
y0 (Unterkante; Standard = Boden an der Stelle), hoehe (Standard unendlich), begehbar (Oberseite trägt Figuren),
weich (0…1 Anteil des Ausschiebens; 0.5 = Figuren drängeln sich aneinander vorbei), fest (false = kein Ausschieben, nur Strahl),
id (sonst fortlaufende Nummer), daten }
filter für hindernisse (alles optional): { y (Fußhöhe), hoehe (Körpergröße), ausser (eigene id) }.
Mit y werden Körper übersprungen, über oder unter denen man ist; begehbare schon ab „Oberkante ≤ y + stufe“ (hochsteigen).
bodenHoehe(x, z, y): ohne y nur das Gelände des Adapters; mit y zusätzlich begehbare Oberseiten bis y + stufe.

### riesenwald-plan · `engine/world/riesenwald-plan.js` · v1.0.0 · entwurf
Plan eines Riesenwalds als reine Daten (ohne THREE): Urwald-Riesen in Reihen entlang von Wegen (Weg bleibt frei), Tor-Paar links/rechts am Waldeingang, Kranz um eine Lichtung, Hinterland bis zu einer Tiefe aufgefüllt – deterministisch per Seed

- `planeRiesenwald({ wege, imGebiet(x,z), varianten [{radius,weite}], seed, wegBreite=3, tor, lichtung, tiefe=150, abstand=26, max=220, frei(x,z,r)? }) -> { riesen [{x,z,variante,skala,drehung,radius,weite,reihe,held,seite}], tor { x,z,richtung,links,rechts } | null }`
- `wegAbstand(wege,x,z) -> { d, x, z, rx, rz }`
- `wegPunkt(weg, s) -> { x, z, rx, rz } | null`
- `wegLaenge(weg) -> m`

```js
import { planeRiesenwald } from '../../engine/world/riesenwald-plan.js';
const plan = planeRiesenwald({ wege: welt.wege, imGebiet: (x, z) => welt.region(x, z).id === 'daemmerwald',
varianten: [{ radius: 4.2, weite: 16 }, { radius: 5.6, weite: 21 }], seed: 7, tor: welt.ort('tor') });
for (const r of plan.riesen) welt.kollision.fuege({ form: 'kreis', x: r.x, z: r.z, radius: r.radius });
```

Genutzt von: – · Tags: wald, riesenbaum, urwald, platzierung, weg, worldgen, daemmerwald, plan · THREE: nein

### scatter-mesh · `engine/world/scatter-mesh.js` · v2.2.0 · entwurf
Zeichnet die Objekte einer erzeugten Welt (welt.objekte) als InstancedMesh je (Typ, Variante): mit Asset-Cache prozedurale Natur-Assets in Metern (Bäume, Felsen, Büsche, Bodendecker …) mit Wind, sonst einfache Low-Poly-FORMEN; unbekannte Typen → Ersatz nach Art oder weglassen; Seerosen auf dem Wasser

- `createScatterMesh(adapter, opts) -> {gruppe,anzahl,dreiecke,meshes,typen,update(zeit, { staerke, richtung, kamera }),verstecke(objektIndex,versteckt?),lage(objektIndex),setzeAufBoden(bereich)->anzahl,dispose}`
- `FORMEN`
- `ERSATZ`
- `BODENDECKER`
- `baueForm(teile) -> BufferGeometry`

```js
import { createScatterMesh } from '../../engine/world/scatter-mesh.js';
import { createAssetCache } from '../../engine/models/natur/natur-assets.js';
const pflanzen = createScatterMesh(adapter, { assets: createAssetCache, jahreszeit: 'herbst', bodendeckerWeite: 110 });
szene.add(pflanzen.gruppe);
// je Bild: pflanzen.update(zeit);
```

Genutzt von: enklave, handwerk · Tags: welt, objekte, baeume, felsen, instanzen, vegetation, mesh, wind, natur · THREE: ja

### terrain-farben · `engine/world/terrain-farben.js` · v1.1.0 · entwurf
Geländefarben je Gitterzelle aus einer erzeugten Welt: weiche Biom-Übergänge mit ausgefransten Grenzen, Wiesenflecken und trockene Grastöne, Mikrovariation, Hangfels mit Gesteinsbändern, nasser Sand, Flusskies und Seeschlamm, festgetretene Wege (FLAG.WEG), Meeresgrund nach Tiefe, Schnee mit Rauschgrenze (an Nordhängen tiefer), Mulden dunkler

- `GELAENDE_FARBEN`
- `gelaendeFarben(welt, opts) -> Float32Array (B×T×3, linear 0…1)`
- `srgbZuLinear(v) -> number`

```js
import { gelaendeFarben } from '../../engine/world/terrain-farben.js';
const f = gelaendeFarben(welt, { hoehenSkala: 60, meterProZelle: 2 });   // f[(y*B+x)*3] = Rot (linear)
const nurBiome = gelaendeFarben(welt, { hoehenSkala: 60, meterProZelle: 2, details: false });
```

Genutzt von: – · Tags: welt, terrain, gelaende, farben, biome, schnee, ufer, vertexfarben · THREE: nein

### terrain-mesh · `engine/world/terrain-mesh.js` · v1.3.1 · entwurf
Baut aus einer erzeugten Welt (worldgen) und ihrem Welt-Adapter ein Three-Gelände: Boden mit weich gemischten Biomfarben, Wiesenflecken, Hangfels, Ufern (Sand/Kies/Schlamm) und Schnee (terrain-farben), Seen/Flüsse auf ihrem Wasserspiegel und ein Meer bis zum Horizont

- `createTerrainMesh(adapter, opts) -> {gruppe,boden,wasser,meer,aktualisiere(bereich,{erde,erdFarbe}?)->vertices,dispose}`
- `biomFarben(welt) -> Float32Array`

```js
import { createTerrainMesh } from '../../engine/world/terrain-mesh.js';
const gelaende = createTerrainMesh(adapter, { schritt: 1, schatten: true });
szene.add(gelaende.gruppe);
// nach einer Gelände-Änderung (engine/world/welt-aenderung.js) nur das Stück neu aufbauen:
aend.onAenderung(({ bereich }) => bereich && gelaende.aktualisiere(bereich, { erde: (i) => Math.abs(aend.delta(i)) / 0.4 }));
```

Genutzt von: enklave, handwerk · Tags: welt, terrain, gelaende, wasser, meer, mesh, biome, teilupdate · THREE: ja

### wasser-glanz · `engine/world/wasser-glanz.js` · v1.0.0 · entwurf
Lebendiges Wasser für vorhandene Wasser-Materialien (Seen/Flüsse/Meer aus terrain-mesh): wandernde Helligkeits-Wellen, kleine Glitzerpunkte und ein Schaumsaum am Ufer – reiner Shader-Hook, keine neue Geometrie, kein Draw-Call mehr

- `createWasserGlanz(materialien, { staerke, glitzer, schaum, schaumFarbe, groesse, tempo }) -> { uniforms, update(zeit), setze(teil), dispose() }`
- `patcheGlanzShader(shader, uniforms, { ufer }) -> shader`

```js
import { createWasserGlanz } from '../../engine/world/wasser-glanz.js';
const glanz = createWasserGlanz([gelaende.wasser?.material, gelaende.meer.material]);   // VOR psx.wendeAn(szene)
// je Bild: glanz.update(zeitInSekunden);
```

Genutzt von: enklave · Tags: wasser, fluss, see, meer, shader, glanz, schaum, ufer, animation, welt · THREE: ja

### wege-lage · `engine/world/wege-lage.js` · v1.0.0 · entwurf
Lage der Brücken einer Welt in Metern (Mitte, Richtung, Länge, Höhe an beiden Enden) und ein Adapter, auf dem Figuren über die Brücken laufen statt durch den Fluss

- `brueckenLagen(adapter, opts) -> [{x,z,y1,y2,laenge,breite,winkel,rx,rz}]`
- `deckHoehe(lage, x, z) -> number|null`
- `mitBruecken(adapter, lagen) -> adapter`

```js
import { brueckenLagen, mitBruecken } from '../../engine/world/wege-lage.js';
const lagen = brueckenLagen(adapter, { breite: 2.4 });
const begehbar = mitBruecken(adapter, lagen);   // bodenHoehe liefert auf der Brücke die Deckhöhe
```

Genutzt von: enklave, handwerk · Tags: welt, wege, bruecke, adapter, boden, figur · THREE: nein

### wege-mesh · `engine/world/wege-mesh.js` · v1.0.0 · entwurf
Holzbrücken für die Wege einer Welt als Three-Meshes: Bohlendeck, Längsbalken, Geländer und Pfeiler bis zum Flussgrund, passend geneigt zwischen beiden Ufern (Lage aus wege-lage)

- `createWegeMesh(adapter, opts) -> {gruppe,lagen,anzahl,dispose}`

```js
import { createWegeMesh } from '../../engine/world/wege-mesh.js';
import { mitBruecken } from '../../engine/world/wege-lage.js';
const wege = createWegeMesh(adapter, { schatten: true });
szene.add(wege.gruppe);
const begehbar = mitBruecken(adapter, wege.lagen);   // diesen Adapter der Figur geben
```

Genutzt von: enklave, handwerk · Tags: welt, wege, bruecke, holz, mesh · THREE: ja

### welt-aenderung · `engine/world/welt-aenderung.js` · v1.1.0 · entwurf
Änderungs-Schicht über einer erzeugten Welt (ohne THREE): Gelände mit Pinseln heben, senken, glätten, einebnen und Objekte entfernen; gemerkt werden nur die Unterschiede zum Seed (kleiner Spielstand), mit Rückgängig/Wiederholen, Sperrzonen (Wasser, Wege) und Meldung des geänderten Bereichs fürs Neuzeichnen

- `createWeltAenderung(adapter|welt, {maxSchritte,maxAbweichung,minHoehe,maxHoehe,sperrFlags,ereignisse}) -> {pinsel(art,x,z,{radius,staerke,ziel,form})->bereich|null,kannAendern(x,z),sperreUmkreis(x,z,radius,an?)->zellen,delta(zellIndex)->m,entferneObjekt(index),stelleObjektHer(index),istEntfernt(index),entfernte()->[index],objekteImUmkreis(x,z,radius,filter?)->[index],beginne(),beende()->bool,rueckgaengig()->aenderung|null,wiederholen()->aenderung|null,kannRueckgaengig,kannWiederholen,festschreiben(),zuruecksetzen()->bereich|null,zustand(),lade(stand)->bereich|null,zuWelt(bereich)->{x0,z0,x1,z1},onAenderung(fn)->abmelden,anzahl,dispose()}`
- `PINSEL_ARTEN`

```js
import { createWeltAenderung } from '../../engine/world/welt-aenderung.js';
const aend = createWeltAenderung(adapter, { maxAbweichung: 4 });
aend.onAenderung(({ bereich }) => gelaende.aktualisiere(bereich));     // nur das Stück neu zeichnen
aend.pinsel('senken', figur.x, figur.z, { radius: 1.5, staerke: 0.4 }); // Loch graben (Meter)
aend.rueckgaengig();
speicher.speichere('welt', { seed, aenderung: aend.zustand() });        // Spielstand = Seed + Änderungen
```

Genutzt von: handwerk · Tags: welt, gelaende, terrain, aendern, graben, pinsel, editor, bauen, rueckgaengig, undo, speichern, objekte · THREE: nein

### welt-plan-formen · `engine/world/welt-plan-formen.js` · v1.0.0 · entwurf
Form-Rechnungen für den Welt-Plan (ohne THREE): Ring-Mauer aus Segmenten/Türmen/Torhaus, Höhenprofil mit Gefälle-Grenze, geschwungene Pfad-Kurve, Gitter-Zuordnung, Boxen-Tests

- `ringPlaetze(ring, zone) -> [platz]`
- `profil(hoehen, abstaende, maxGefaelle, fest?) -> Float32Array`
- `kurve(punkte, schritt) -> {punkte: Float64Array [x,z,…], laenge}`
- `lokalZuWeltRoh(px, pz, w, lx, lz) -> {x,z}`
- `weltZuLokalRoh(px, pz, w, x, z) -> {x,z}`
- `naechstePunkte(C, radius, b, t) -> {d, s, liste}`
- `inBox(x, z, platz, rand?) -> bool`
- `boxenSchneiden(a, b, eps?) -> bool`
- `abstandStrecke(px, pz, ax, az, bx, bz) -> {d, u}`

```js
import { ringPlaetze, profil } from '../../engine/world/welt-plan-formen.js';
const mauer = ringPlaetze({ id: 'mauer', radius: 36 }, { x: 150, z: -137, drehung: -0.85 });   // Segmente, 8 Türme, Torhaus
const h = profil([0, 9, 0, 9, 0], 10, 0.14);                                                    // Höhen mit |dh/ds| ≤ 0.14
```

Genutzt von: – · Tags: welt, plan, mauer, profil, spline, geometrie, gefaelle · THREE: nein

### welt-plan · `engine/world/welt-plan.js` · v1.0.0 · entwurf
Deterministischer Welt-Plan als worldgen-Stufen: Zonen (Plateau, Mulde, Kuppe), Gewässer-Rinnen, ebene Plätze, Orte, geschwungene Pfade mit begrenztem Gefälle und Brücken, Mauer-Ring; dazu Prüfung (Plateau eben, Gefälle, Objekte im Weg, Tor erreichbar)

- `createWeltPlan(plan, {meterProZelle = 2, hoehenSkala = 60}) -> {plan, stufen, zone(id), zoneBei(x,z), platz(id), plaetze(art?), pfad(id), lokalZuWelt(platz,lx,lz), koerperZuWelt(koerper,platz,y), pruefe(adapter) -> {ok,fehler,werte}, dispose()}`
- `ringPlaetze`
- `profil`

```js
import { createWeltPlan } from '../../engine/world/welt-plan.js';
import { createWorld } from '../../engine/world/worldgen/worldgen.js';
const plan = createWeltPlan({ zonen: [{ id: 'tal', art: 'mulde', x: -175, z: 150, radius: 55 }], spawn: { x: -175, z: 150, yaw: 0 } }, { meterProZelle: 2.5 });
const welt = createWorld({ preset: 'insel', seed: 1, stufen: plan.stufen });   // danach: Adapter, plan.pruefe(adapter), plan.pfad('hauptweg')
```

Genutzt von: enklave · Tags: welt, plan, worldgen, zonen, pfad, bruecke, plateau, tutorial · THREE: nein

### welt-regionen · `engine/world/welt-regionen.js` · v1.2.0 · entwurf
Erlenwacht-Weltkarte als reine Logik: Regionen (Küste, Dämmerwald, Talkessel, Moor, Hochland, Gebirge), Orte, Wege und eine punktweise, seedbare Höhe (entlang der Wege geglättet), Wasser, Biome, Bodenfarben und Streu-Regeln; v1.1: weicher Kartenrand (Meer Süd/Ost, Gebirgskette Nord/West), Fluss Gebirge→Hochland→Moor mit Furt, Hügelwellen, Felsnadeln, Moor-Tümpel, Wolfsfels-Terrasse; v1.2: mehrere Flüsse (fluesse), Erlbach Hochland→Ostrand Erlenwacht→Klamm→Dämmerwald→Strand

- `createWeltRegionen({seed}) -> {hoehe(x,z),wasserHoehe(x,z,h?),region(x,z)->{id,name,biom},biom(x,z,h?),farbe(x,z,h,steil,aus),wegInfo(x,z)->{d,h},abstandZumWeg(x,z),regionen,orte,ort(id),wege,startPunkt,groesse,meerZ(x),moor,fluss:{proben:[{x,z,y,b}],furt:{x,z}},flussInfo(x,z)->{d,y,b,id},fluesse:[{id,name,proben}]}`
- `STREU {biom: {gross:[p,[[typ,w]…]], klein:[p,[[typ,w]…]]}}`
- `MOOR_WASSER`

```js
import { createWeltRegionen } from '../../engine/world/welt-regionen.js';
const k = createWeltRegionen({ seed: 7 });
const y = k.hoehe(0, 600);                    // Talkessel der Siedlung
const r = k.region(-1200, 400).id;            // 'moor'
```

Genutzt von: – · Tags: welt, karte, regionen, orte, wege, hoehe, terrain, erlenwacht, mmo · THREE: nein

### welt-streu · `engine/world/welt-streu.js` · v1.2.0 · entwurf
Streu-Objekte (Bäume, Felsen, Büsche, Bodendecker) für eine Kachel deterministisch aus Seed + Biom-Regeln setzen – mit Lücken an Wegen, Orten, Wasser, steilen Hängen und gesperrten Flächen (reine Logik)

- `streuKachel(karte, kachel, {art,seed,dichte,regeln,frei(x,z,r)->bool,info(typ)->{radius,stammRadius}}) -> [{typ,v,x,y,z,rot,s,r}]`
- `STREU_ARTEN`
- `UFER (v1.2: Ufer-Streu an Flüssen)`

```js
import { streuKachel } from '../../engine/world/welt-streu.js';
const objs = streuKachel(karte, { x0: 0, z0: 0, groesse: 64, cx: 0, cz: 0 }, { art: 'gross', seed: 7 });
```

Genutzt von: – · Tags: welt, streu, vegetation, baeume, felsen, kachel, deterministisch, erlenwacht · THREE: nein

### wetter · `engine/world/wetter.js` · v1.0.0 · entwurf
Wetter-Zustand: Wetterarten wechseln per Seed nach Klima (Feuchte/Temperatur), Werte laufen weich, Wind, Blitz, Nässe

- `createWetter({seed,art,wechselStunden,uebergangStunden}) -> {update(dtStunden,klima), blitzUpdate(dtSekunden), setze(art,sofort), zustand(), lade(z), on('wechsel',fn(art,vorher)), art, wolken, regen, schnee, nebel, wind, windRichtung, blitz, nass, dispose()}`
- `WETTER_ARTEN`

```js
import { createWetter } from '../../engine/world/wetter.js';
const w = createWetter({ seed: 7 });
w.update(dtSpielStunden, { temperatur: 0.6, feuchte: 0.7 }); // Klima z. B. aus dem Biom
w.blitzUpdate(dtEchtSekunden);                               // nur für den Blitz-Flash nötig
if (w.regen > 0.1) { … }
```

Genutzt von: erde, handwerk · Tags: wetter, regen, schnee, nebel, wind, gewitter, klima, seed · THREE: nein

### worldgen-adapter · `engine/world/worldgen/worldgen-adapter.js` · v1.2.0 · entwurf
Welt-Adapter für Figuren, Kamera und Spiele: macht aus einer erzeugten Welt (normierte Höhe, Gitter) eine Welt in Metern mit bodenHoehe, wasserHoehe und hindernisse (Baumstämme, Felsen) – passt zum Vertrag in docs/plaene/FIGUREN-SYSTEM.md

- `createWeltAdapter(welt, opts) -> {bodenHoehe,wasserHoehe,hindernisse,hindernisNah(x,z,reichweite,filter?),setHindernis(objektIndex,aktiv),alleHindernisse(fn),normale,biomBei,zuGitter,zuWelt,startPunkt,groesse,hoehenSkala,meterProZelle,dispose}`
- `HINDERNIS_RADIEN`

```js
import { createWeltAdapter } from '../../engine/world/worldgen/worldgen-adapter.js';
const adapter = createWeltAdapter(createWorld({ preset: 'insel', seed: 42 }), { hoehenSkala: 60, meterProZelle: 2 });
const s = adapter.startPunkt(); const y = adapter.bodenHoehe(s.x, s.z);
```

Genutzt von: enklave, handwerk · Tags: welt, worldgen, adapter, boden, wasser, kollision, figur · THREE: nein

### worldgen-biomes · `engine/world/worldgen/worldgen-biomes.js` · v1.1.0 · entwurf
Biome nach Whittaker (Temperatur × Feuchte, als schnelle Nachschlagetabelle) plus Prioritätsregeln (Wasser, Schnee, Fels, Strand, Sumpf); Biomliste per Spiel erweiterbar

- `STANDARD_BIOME`
- `erstelleBiomTabelle(biomOpts) -> {liste,idVon(key)}`
- `klassifiziere(tab,h,hang,temp,feuchte,wasserDist,meerDist,flags) -> id`
- `berechneHang(H,b,t,aus?) -> Float32Array`
- `stufeBiome(welt, opts) -> void`
- `biomId(welt,key) -> id`
- `URWALD_BIOM`

```js
import { erstelleBiomTabelle } from '../../engine/world/worldgen/worldgen-biomes.js';
const tab = erstelleBiomTabelle({ extra: [{ key: 'pilzhain', name: 'Pilzhain', farbe: 0x8a5cc0, temp: [0.4, 0.6], feuchte: [0.8, 1] }] });
const id = tab.idVon('pilzhain');
```

Genutzt von: – · Tags: welt, worldgen, biome, klima, whittaker · THREE: nein

### worldgen-chunkfluss · `engine/world/worldgen/worldgen-chunkfluss.js` · v1.0.0 · entwurf
Chunk-lokale Flussnetze und kleine Seen für den unendlichen Modus: grobes Knotengitter aus Seed + Position, Abfluss zum tiefsten Nachbarn, begrenzter Zufluss, Senken werden Seen – nahtlos ohne globale Stufen

- `createFlussNetz(opts) -> {praege(x,y,h)->h, fluss, see, knoten(i,j)->knoten, seenIn(x0,y0,x1,y1)->[{x,y,radius,spiegel,zufluss}], weite, dispose()}`

```js
import { createFlussNetz } from '../../engine/world/worldgen/worldgen-chunkfluss.js';
const netz = createFlussNetz({ seed: 5, roh: (x, y) => hs.sample(x, y), massstab: 256 });
const h = netz.praege(x, y, hs.sample(x, y));   // netz.fluss < 1 → im Flussbett, netz.see = Seespiegel oder NaN
```

Genutzt von: – · Tags: welt, worldgen, chunks, unendlich, fluss, see, hydrologie · THREE: nein

### worldgen-chunks · `engine/world/worldgen/worldgen-chunks.js` · v1.2.0 · entwurf
Unendlicher/gestreamter Modus: Höhe, Klima, Biome, chunk-lokale Flussnetze + kleine Seen (oder Rauschflüsse) und Objekte punktweise und pro Chunk – nahtlos über Chunkgrenzen (ohne globale Erosion/Hydrologie)

- `createChunkGenerator(optionen) -> {opts, sampleHeight(x,y)->number, samplePunkt(x,y,aus)->bool, generateChunk(cx,cy,groesse)->chunk (+wasser, seen), seenIn(x0,y0,x1,y1), biome, dispose()}`

```js
import { createChunkGenerator } from '../../engine/world/worldgen/worldgen-chunks.js';
const gen = createChunkGenerator({ preset: 'unendlich', seed: 5 });
const c = gen.generateChunk(3, -2, 64);   // c.hoehe hat (64+1)² Werte, Randzeilen identisch mit den Nachbarn
```

Genutzt von: – · Tags: welt, worldgen, chunks, unendlich, streaming, terrain · THREE: nein

### worldgen-climate · `engine/world/worldgen/worldgen-climate.js` · v1.0.0 · entwurf
Klima für den Weltgenerator: Temperatur nach Höhe/Breitengrad, Feuchte aus Wassernähe, Rauschen und Regenschatten (Windrichtung)

- `regenSchatten(H,ozean,b,t,windGrad,staerke) -> Float32Array`
- `boxBlur(arr,b,t,r,iter) -> arr`
- `stufeKlima(welt, opts) -> void`

```js
import { stufeKlima } from '../../engine/world/worldgen/worldgen-climate.js';
stufeKlima(welt, { seed: 1, klima: { wind: 270, regenschatten: 1 } });
const warm = welt.temperatur[i] > 0.7, nass = welt.feuchte[i] > 0.6;
```

Genutzt von: – · Tags: welt, worldgen, klima, temperatur, feuchte, regen · THREE: nein

### worldgen-erosion · `engine/world/worldgen/worldgen-erosion.js` · v1.0.0 · entwurf
Schnelle hydraulische Tropfen-Erosion (mit Pinsel-Abtrag) und thermische Erosion auf einem Float32-Höhenfeld; Qualitätsstufen schnell/normal/hoch

- `erodiereHydraulisch(H,b,t,p) -> void`
- `erodiereThermisch(H,b,t,iterationen,talus,rate) -> void`
- `stufeErosion(welt, opts) -> void`
- `QUALITAET`

```js
import { erodiereHydraulisch } from '../../engine/world/worldgen/worldgen-erosion.js';
erodiereHydraulisch(hoehe, 256, 256, { tropfen: 40000, seed: 3 });
```

Genutzt von: – · Tags: welt, worldgen, erosion, terrain, hydraulik · THREE: nein

### worldgen-grid · `engine/world/worldgen/worldgen-grid.js` · v1.1.0 · entwurf
Gitter-Helfer für den Weltgenerator: typisierter Min-Heap, Chamfer-Abstand, Regionen-Markierung, bilineares Abtasten, Array-Hash

- `createMinHeap(kapazitaet) -> {push(i,prio),pop()->i,size,clear()}`
- `chamferDistanz(maske,b,t,aus?) -> Float32Array`
- `markiereRegionen(maske,b,t,aus?) -> anzahl`
- `bilinear(arr,b,t,x,y) -> number`
- `hashArrays(...arrays) -> string`
- `DX8`
- `DY8`
- `DL8`
- `FLAG`
- `WASSER`

```js
import { chamferDistanz, hashArrays } from '../../engine/world/worldgen/worldgen-grid.js';
const dist = chamferDistanz(wasserMaske, 256, 256);   // Abstand (Zellen) zum nächsten Wasser
console.log(hashArrays(welt.hoehe, welt.biom));      // Schnappschuss-Hash für Tests
```

Genutzt von: daemmerwald · Tags: welt, worldgen, gitter, heap, abstand · THREE: nein

### worldgen-height · `engine/world/worldgen/worldgen-height.js` · v1.1.0 · entwurf
Höhenfeld aus fBm, Grat-Gebirgen, Domain-Warp, Klippen, Terrassen und optionalen Felsstufen im Gebirge (hoehe.gebirge.felsStufen: { stufen, staerke }); punktweise abtastbar (für Chunks) oder als ganzes Gitter

- `createHeightSampler(opts) -> {sample(x,y)->number}`
- `stufeHoehe(welt, opts) -> void`

```js
import { createHeightSampler } from '../../engine/world/worldgen/worldgen-height.js';
const hs = createHeightSampler({ seed: 7, breite: 256, tiefe: 256, form: { typ: 'insel' }, hoehe: {} });
const h = hs.sample(128, 128);   // normiert, Meeresspiegel = 0
```

Genutzt von: – · Tags: welt, worldgen, hoehe, terrain, fbm, gebirge · THREE: nein

### worldgen-hydrology · `engine/world/worldgen/worldgen-hydrology.js` · v1.0.0 · entwurf
Wasserhaushalt: Ozean vom Rand fluten, Senken per Priority-Flood füllen, Seen erkennen, Abflussrichtung (D8) und Abflussmenge berechnen

- `fuelleSenken(H,b,t,saat,eps?) -> {F,reihenfolge}`
- `abflussRichtung(F,b,t,istSaat) -> Int32Array`
- `abflussMenge(ziel,reihenfolge,regen?) -> Float32Array`
- `stufeHydrologie(welt, opts) -> void`

```js
import { stufeHydrologie } from '../../engine/world/worldgen/worldgen-hydrology.js';
stufeHydrologie(welt, opts);   // setzt welt.flags (OZEAN/SEE/KUESTE), welt.wasserstand, welt.ziel, welt.abfluss, welt.seen
```

Genutzt von: – · Tags: welt, worldgen, wasser, seen, abfluss, priority-flood · THREE: nein

### worldgen-path · `engine/world/worldgen/worldgen-path.js` · v1.1.0 · entwurf
A*-Wegsuche auf dem Weltgitter (8 Richtungen) mit Kosten nach Hang, Wasser und Flüssen; wiederverwendbare typisierte Puffer

- `createPathfinder(welt, opts) -> {finde(ax,ay,bx,by)->Float32Array|null, kosten(i)->number}`

```js
import { createPathfinder } from '../../engine/world/worldgen/worldgen-path.js';
const pf = createPathfinder(welt, { hangKosten: 12, wasser: Infinity });
const weg = pf.finde(10, 10, 200, 180);   // [x0,y0,x1,y1,…] in Weltkoordinaten oder null
```

Genutzt von: – · Tags: welt, worldgen, wegfindung, astar, pfad · THREE: nein

### worldgen-presets · `engine/world/worldgen/worldgen-presets.js` · v1.3.0 · entwurf
Standardoptionen und benannte Voreinstellungen (insel, archipel, kontinent, gebirge, wueste, tundra, sumpfland, vulkaninsel, canyon, flachland, kueste, hochebene, unendlich, urwald/daemmerwald) plus tiefes Zusammenführen von Optionen

- `STANDARD_OPTIONEN`
- `PRESETS`
- `mischeOptionen(...quellen) -> opts`
- `aufloesen(optionen) -> opts`

```js
import { aufloesen } from '../../engine/world/worldgen/worldgen-presets.js';
const opts = aufloesen({ preset: 'vulkaninsel', seed: 9, klima: { feuchte: 0.8 } });
```

Genutzt von: – · Tags: welt, worldgen, presets, optionen, insel · THREE: nein

### worldgen-query · `engine/world/worldgen/worldgen-query.js` · v1.0.0 · entwurf
Abfragen auf einer erzeugten Welt (Weltkoordinaten): Höhe bilinear, Hang, Normale, Biom, Wasser; hängt Methoden auch an Welt-Daten aus einem Worker an

- `heightAt(welt,x,y) -> number`
- `slopeAt(welt,x,y) -> number`
- `normalAt(welt,x,y,aus?) -> [nx,ny,nz]`
- `biomeAt(welt,x,y) -> id`
- `isWater(welt,x,y) -> bool`
- `waterDepthAt(welt,x,y) -> number`
- `mitAbfragen(welt) -> welt`

```js
import { mitAbfragen } from '../../engine/world/worldgen/worldgen-query.js';
const welt = mitAbfragen(datenAusWorker);
const y = welt.heightAt(10.5, 20.25), n = welt.normalAt(10.5, 20.25);
```

Genutzt von: – · Tags: welt, worldgen, abfrage, hoehe, normale, biome · THREE: nein

### worldgen-rivers · `engine/world/worldgen/worldgen-rivers.js` · v1.0.0 · entwurf
Flüsse aus der Abflussmenge: Flusszellen mit Breite, Flussbett eingraben, Ufer abflachen, geglättete Flusslinien (Quelle → Meer/See) erzeugen

- `stufeFluesse(welt, opts) -> void`
- `flussLinien(welt, schwelle, glaetten?) -> [{punkte,breite,muendung}]`
- `chaikin(punkte, breite, iterationen) -> {punkte,breite}`

```js
import { stufeFluesse } from '../../engine/world/worldgen/worldgen-rivers.js';
stufeFluesse(welt, { wasser: { flussMenge: 0.6, flussTiefe: 0.02 } });
for (const f of welt.fluesse) console.log(f.muendung, f.punkte.length / 2);
```

Genutzt von: – · Tags: welt, worldgen, fluss, wasser, abfluss · THREE: nein

### worldgen-scatter · `engine/world/worldgen/worldgen-scatter.js` · v1.2.0 · entwurf
Blue-Noise-Verteilung von Objekten (Bäume, Büsche, Felsen, Kakteen, Schilf, Blumen …) mit Dichte pro Biom, Lichtungen (je Art oder gemeinsam), Stammfuß-Häufung, Dichtefeld der Quelle und Hangregeln; reihenfolgeunabhängig und dadurch nahtlos über Chunks

- `STANDARD_OBJEKTE (Daten aus worldgen-vegetation)`
- `verteile(quelle, arten, opts, bereich) -> objekte`
- `weltQuelle(welt) -> quelle`
- `stufeObjekte(welt, opts) -> void`

```js
import { stufeObjekte } from '../../engine/world/worldgen/worldgen-scatter.js';
stufeObjekte(welt, opts);
const o = welt.objekte;   // { anzahl, x, y, art, typ, skala, drehung, arten:[…], typen:[…] }
for (let i = 0; i < o.anzahl; i++) if (o.arten[o.art[i]] === 'baum') pflanze(o.typen[o.typ[i]], o.x[i], o.y[i]);
```

Genutzt von: daemmerwald · Tags: welt, worldgen, objekte, baeume, verteilung, poisson, blue-noise · THREE: nein

### worldgen-shape · `engine/world/worldgen/worldgen-shape.js` · v1.0.0 · entwurf
Landform-Masken für den Weltgenerator (Insel, Archipel, Kontinent, Küste, Vulkan, Canyon, Plateau, unendlich) plus formspezifische Nachbearbeitung der Höhe

- `createShape(form, seed) -> {typ, endlich, maske(u,v)->number, nach(h,u,v,wx,wy)->number}`
- `FORMEN`

```js
import { createShape } from '../../engine/world/worldgen/worldgen-shape.js';
const f = createShape({ typ: 'insel', kuestenRauschen: 0.5 }, 42);
const landNeigung = f.maske(0, 0);   // u,v in [-1,1]; >0 = Land-Tendenz
```

Genutzt von: – · Tags: welt, worldgen, insel, form, maske, terrain · THREE: nein

### worldgen-sites · `engine/world/worldgen/worldgen-sites.js` · v1.0.0 · entwurf
Orte finden: Startplatz (flach, nah an Wasser und Wald, eingeebnet), Dorfplätze mit Mindestabstand und Sehenswürdigkeiten (Gipfel, Quellen, Mündungen, Seen)

- `bewerteOrt(welt, x, y, gewichte) -> number`
- `ebneEin(welt, x, y, radius) -> void`
- `stufeOrte(welt, opts) -> void`

```js
import { stufeOrte } from '../../engine/world/worldgen/worldgen-sites.js';
stufeOrte(welt, { orte: { start: true, doerfer: 3 } });
const { start, doerfer, poi } = welt.orte;   // Weltkoordinaten
```

Genutzt von: – · Tags: welt, worldgen, orte, start, dorf, poi · THREE: nein

### worldgen-vegetation · `engine/world/worldgen/worldgen-vegetation.js` · v1.1.0 · entwurf
Standard-Objektarten des Weltgenerators als reine Daten: Kronendach, Totholz, Unterholz, Büsche (Waldrand), Felsen/Findlinge, Geröll am Hangfuß, Kakteen, Schilf, Seerosen, Blumen und Bodendecker, dazu Urwald-Arten (Riesen, Wedelfarn, Unterholz, Moospolster, Wurzelschösslinge, Laubstreu) – mit gewichteten Typen je Biom und Typmischung nach Höhe/Feuchte/Temperatur

- `STANDARD_OBJEKTE`
- `VEGETATION_TYPEN`
- `typenVon(art) -> string[]`
- `URWALD_OBJEKTE`
- `URWALD_TYPEN`

```js
import { STANDARD_OBJEKTE, VEGETATION_TYPEN } from '../../engine/world/worldgen/worldgen-vegetation.js';
createWorld({ preset: 'insel', objekte: { arten: STANDARD_OBJEKTE.filter(a => a.key !== 'bodendecker') } });
VEGETATION_TYPEN.includes('fichte');   // true
```

Genutzt von: daemmerwald · Tags: welt, worldgen, objekte, vegetation, baeume, felsen, bodendecker, daten · THREE: nein

### worldgen-wege · `engine/world/worldgen/worldgen-wege.js` · v1.1.0 · entwurf
Wegenetz zwischen Startplatz, Dörfern und ausgewählten Sehenswürdigkeiten: Spannbaum plus Abkürzungen, A* um Steilhänge herum, Wege teilen sich Strecken, Flüsse werden kurz per Brücke gequert; markiert Zellen als WEG und hält sie frei von Objekten

- `planeNetz(knoten, schleifen) -> [[a,b],…]`
- `stufeWege(welt, opts) -> void (füllt welt.wege)`

```js
import { createWorld, FLAG } from '../../engine/world/worldgen/worldgen.js';
const welt = createWorld({ preset: 'insel', seed: 42, wege: { aktiv: true, poi: ['gipfel'] } });
for (const w of welt.wege) zeichneLinie(w.punkte);        // [x0,y0,x1,y1,…] in Weltkoordinaten
const aufWeg = welt.flags[y * welt.breite + x] & FLAG.WEG;
```

Genutzt von: – · Tags: welt, worldgen, wege, strassen, pfad, bruecke, dorf, netz · THREE: nein

### worldgen · `engine/world/worldgen/worldgen.js` · v1.1.0 · entwurf
Weltgenerator-Einstieg: createWorld(optionen) führt die Stufen-Pipeline (Höhe → Erosion → Hydrologie → Flüsse → Klima → Biome → Orte → Wege → Objekte) per Preset aus; Spiele können Stufen einfügen/ersetzen; Ergebnis in typisierten Arrays

- `createWorld(optionen) -> welt`
- `STANDARD_STUFEN`
- `transferierbar(welt) -> {daten, puffer}`
- `createChunkGenerator(optionen) -> {sampleHeight,generateChunk}`
- `PRESETS`
- `aufloesen(optionen)`
- `mitAbfragen(welt)`
- `createPathfinder(welt,opts)`
- `biomId(welt,key)`
- `FLAG`
- `hashArrays(...arrays)`

```js
import { createWorld } from '../../engine/world/worldgen/worldgen.js';
const welt = createWorld({ preset: 'insel', seed: 42, breite: 256, tiefe: 256, qualitaet: 'normal' });
const h = welt.heightAt(100.5, 80.2), wasser = welt.isWater(100, 80), start = welt.orte.start;
```

Genutzt von: enklave, handwerk, welt · Tags: welt, worldgen, insel, terrain, generator, prozedural, karte · THREE: nein
