# Wurzelwerk

**Status:** Konzept v1 · **Favorit**

## Pitch (ein Satz)
Pflanze einen magischen Baum, lenke mit einem Finger sein Wachstum – Wurzeln holen Nährstoffe, Äste tragen Früchte, die automatisch gegen Schädlingswellen kämpfen – und finde in jedem Run eine neue, absurde Mutations-Kombo.

## Zielgefühl (MDA, rückwärts)
- **Aesthetics:** Wachsen sehen · Optimieren („mein Netz ist schön effizient“) · Entdecken von Kombos · „noch eine Runde“
- **Dynamics:** Baum wird sichtbar größer; Engpässe entstehen und werden gelöst; Wellen testen den Bauplan; Mutationen kippen die Strategie
- **Mechanics:** Tippen = Wachstum setzen; Nährstoff-Fluss durch Wurzeln; Auto-Kampf der Früchte; Mutationswahl 1-aus-3 nach jeder Welle

## Zielgruppe (Quantic Foundry)
- **Primär:** Strategie (Planen, Optimieren), Vollständigkeit/Fortschritt (Wachstum, Freischalten)
- **Sekundär:** Entdeckung (Kombos), Design (der Baum als Eigenausdruck)
- **Nicht bedient:** Social, Wettbewerb, Story, schnelle Action-Reflexe
- Typ: Vampire-Survivors-/Balatro-Spieler, mobil, 10–20-Minuten-Sessions

## Pillars
1. **Ein Finger reicht** – jede Aktion ist ein Tipp oder Ziehen; kein Mikromanagement im Kampf
2. **Jede Entscheidung ist sichtbar** – Fluss, Reichweite, Engpass sieht man am Baum selbst
3. **Kein Run gleicht dem anderen** – Saat + Mutationen ändern Regeln, nicht nur Zahlen
4. **Wachstum fühlt sich gut an** – jede Sekunde wächst etwas, Juice bei jedem neuen Trieb

## Core Loop
Ein Satz: *Wachsen lassen → Nährstoffe fließen → Früchte wehren Schädlinge ab → Mutation wählen → größer wachsen.*

| Ebene | Dauer | Was passiert |
|---|---|---|
| Sekunden | 1–10 s | Tippen, wo Wurzel/Ast wächst; Früchte feuern automatisch; Nährstoffe sammeln sich |
| Minuten | 1–2 min | Eine Welle (Tag/Nacht): Aufbau-Phase → Schädlinge greifen an → Belohnung + Mutation 1-aus-3 |
| Run | 12–20 min | ~10 Wellen über 4 Jahreszeiten, Endboss im Winter; Ende bei Stamm-HP 0 oder Sieg |
| Meta | Tage | Samen (Währung) → neue Saaten, Startboni, Mutations-Pool erweitern |

## Mechaniken

### Wurzeln = Logistik
- Tipp in den Boden → Wurzel wächst Richtung Tipp (kostet Nährstoffe)
- Bodenfelder: **Wasser**, **Mineral**, **Kompost** (verbraucht sich), **Stein** (blockiert)
- Wurzeln transportieren wie Förderbänder; **Durchsatz** pro Segment begrenzt → dicke Hauptwurzeln vs. viele dünne
- Engpass sichtbar: Wurzel glüht rot bei Überlast
- Untergrund-Schädlinge (Engerlinge) nagen Wurzeln an → Netz-Redundanz lohnt sich

### Äste/Früchte = Waffen & Produktion
- Tipp in die Luft → Ast wächst; an Ast-Enden Knospe setzen, Fruchttyp wählen (1 von 3 Karten)
- Früchte brauchen bestimmten Nährstoff-Mix, sonst langsamer
- **Waffen:** Dornenbeere (Projektil), Sporenkapsel (Flächen-Gift), Harzapfel (verlangsamt), Brennfrucht (Feuer-DoT)
- **Produktion:** Honigblüte (Nährstoff-Bonus), Samenschote (Meta-Währung), Blattkrone (Schild für Stamm)
- Höhere Äste = mehr Reichweite, aber teurer Transport (Distanz zur Wurzel zählt)

### Schädlingswellen
- Kommen von links/rechts (Boden) und oben (Flug); Ziel: Stamm
- Typen: Blattlaus (Schwarm, schwach) · Käfer (Panzer) · Raupe (frisst Äste) · Engerling (unterirdisch) · Krähe (fliegt, schnell) · Holzwurm-Boss
- Jahreszeiten: Frühling (Wachstum +) · Sommer (Wasser knapp) · Herbst (Früchte +, Raupen) · Winter (kaum Nährstoffe, Boss)

### Mutationen (Wahl 1-aus-3 nach jeder Welle, kombinierbar)
1. **Wanderwurzel** – Wurzeln wachsen von selbst zum nächsten Rohstoff
2. **Dornenrinde** – Stamm schadet Angreifern bei Kontakt
3. **Kettenfrucht** – Projektile springen auf 2 weitere Ziele
4. **Symbiose-Pilz** – jede Wurzel-Kreuzung erzeugt +1 Nährstoff/s
5. **Fallobst** – reife Früchte fallen und explodieren am Boden
6. **Fleischfresser** – getötete Schädlinge werden zu Kompost
7. **Doppelkrone** – zweiter Stamm, aber halbe HP pro Stamm
8. **Winterschlaf** – Winter-Malus entfällt, Frühling dafür kürzer
9. **Glasäste** – Äste +100 % Reichweite, brechen bei einem Treffer
10. **Echowurzel** – Nährstoff-Fluss lädt nahe Früchte auf (Fluss = Feuerrate)
- Synergie-Tags (Boden, Frucht, Stamm, Zeit) → Balatro-artige Kombos sichtbar markiert

## Meta-Progression
- **Samen** (aus Samenschoten + Run-Ende) als einzige Währung
- Freischalten: neue **Saaten** (Eiche = robust, Weide = Wasser-Fokus, Kaktus = Dornen, Pilzbaum = Netz-Fokus) mit eigenen Startregeln
- Mutations-Pool wächst durch Entdecken (Herbarium/Sammelbuch → Vollständigkeit)
- Kleine permanente Startboni (max. ~+20 %), damit Skill wichtiger bleibt als Grind
- Schwierigkeits-Stufen („Dürrejahre“) nach erstem Sieg, wie Balatro-Stakes

## SDT-Check
- **Kompetenz:** Engpässe lesen, Netz optimieren, Kombos erkennen; Run-Statistik am Ende (Durchsatz, Schaden pro Frucht) ✔
- **Autonomie:** Wohin wachsen, welche Frucht, welche Mutation, welche Saat – mehrere Wege zum Sieg ✔
- **Verbundenheit:** schwach – Ausgleich über Welt-Bezug (Baum wird „meiner“, Herbarium); später evtl. Daily Seed + Baum-Screenshot teilen ⚠

## Schwierigkeitskurve (Flow)
- Welle 1–2: fast nicht verlierbar, Tutorial durch Tun (ein Rohstoff, ein Gegnertyp)
- Welle 3–5: Engpässe entstehen, zweiter Rohstoff + Flieger → erste echte Entscheidungen
- Welle 6–8: Mutations-Kombo muss stehen; Sommer/Herbst drehen die Regeln
- Welle 9–10: Winter + Boss = Prüfung des Bauplans
- Sägezahn: nach jeder Welle kurze Ruhephase (Aufbau) → Spannung/Entspannung
- Meta-Stakes heben die Kurve für Könner; Saaten mit einfachen Regeln für Neulinge
- Messen im Playtest: Abbruch-Welle, Run-Dauer, Siegquote (Ziel erster Sieg nach ~3–5 Runs)

## MVP-Prototyp (Single-File HTML, mobil, Portrait, Touch)
- **Technik:** Canvas 2D, ein `index.html`, kein Build, 60 FPS auf Android
- **Layout:** oben Himmel/Äste, Mitte Stamm, unten Boden-Raster (Querschnitt)
- **Drin:**
  - Tippen = Wurzel/Ast wachsen lassen, Knospe → 3 Fruchtkarten
  - 2 Rohstoffe (Wasser, Mineral), Durchsatz + Rot-Glühen bei Engpass
  - 3 Früchte (Dornenbeere, Sporenkapsel, Honigblüte)
  - 3 Schädlinge (Blattlaus, Käfer, Krähe), 6 Wellen, kein Boss
  - 5 Mutationen (1, 3, 4, 5, 10), Wahl 1-aus-3
  - Run-Ende-Screen mit Statistik, Neustart
- **Nicht drin:** Meta-Progression, Jahreszeiten, Saaten, Sound (höchstens Beep), Speichern
- **Erfolgskriterium:** „Noch eine Runde“-Reflex nach 2–3 Runs; Engpässe werden ohne Erklärung verstanden

## Offene Fragen
- Echtzeit oder Aufbau-Phase pausiert? (Tendenz: Aufbau pausiert → ruhiger, mobilfreundlicher)
- Wie fein ist das Raster – freie Wurzelpfade oder Tile-Grid?
- Kostet Wachstum Zeit, Nährstoffe oder beides?
- Wie viele Äste/Früchte max., bevor der Screen unlesbar wird?
- Kampf-Lesbarkeit im Portrait bei vielen Schädlingen?
- Optik: Pixel, Low-Poly-2D oder Vektor-Silhouetten?
- Daily Seed / Teilen als Verbundenheits-Ersatz sinnvoll?
