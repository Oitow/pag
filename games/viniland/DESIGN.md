# Viniland – Design (Stand: Erweiterung 3)

**Ton:** schwer, brutal, gothic – aber High Fantasy. Grundstimmung dunkel, entsättigt, Nebel, Kälte, Ruinen, Kirchturmspitzen,
Galgenbäume. Kontraste durch Glut, Magie und Biolumineszenz: Im Leuchtpilzhain wird es knallbunt (Türkis, Magenta, Violett, Gift-Grün).
PS1/PS2-Look bleibt (Mid-Poly, Vertex-Farben, Dithering). **Alles ist Platzhalter**, wird später detaillierter → modular, datengetrieben,
einfach austauschbar.

## Prämisse
Die Spieler sind **Gestrandete**: angespült an der Grauen Küste, ein Schiffswrack am Strand, nichts in den Händen (Fäuste).
Erste Waffe liegt im Wrack (Treibholzknüppel). Der Weg ins Innere ist durch **Nebeltore** versperrt.
Jedes Biom hat **3 Bosse**, einer davon ist der **Siegelträger** (Hauptboss). Sein **Siegel** öffnet das Nebeltor zum nächsten Biom.

## Biome (Reihenfolge = Fortschritt)
| # | id | Name | Stimmung | Bosse |
|---|---|---|---|---|
| 1 | `kueste` | Graue Küste | Strand, Wrack, fahle Wiesen, Wäldchen, Nebel | Blanco, Morra, **Kohlherz** (Siegelträger) |
| 2 | `duesterwald` | Düsterwald | schwarze Bäume, Ruinen, Kathedralen-Turm, Laternen, Raben, Regenstimmung | 3 neue (1 Siegelträger) |
| 3 | `pilzhain` | Leuchtpilzhain | Riesenpilze, Biolumineszenz, Sporen, farbenfroh, nachtartig | 3 neue (1 Siegelträger) |
| 4 | `aschenoede` | Aschenöde | Lava-Risse, Asche-Regen, Obsidian (Platzhalter) | später |
| 5 | `frostgipfel` | Frostgipfel | Schnee, Eis, Sturm (Platzhalter) | später |

## Gegner
Zwischen den Bossen: einfache Einheiten. Platzhalter = **kleinere, umgefärbte Kopien der Bosse** (Variant: scale, tint, hp/dmg-Multiplikator,
reduziertes Moveset). Gruppen von 1–4 in Biom-Zonen, respawnen beim Rasten am Leuchtfeuer.

## Progression (Elden-Ring-Mischung, actionlastiger)
- **Glut** = Währung/EP. Von Gegnern. Beim Tod fällt die Glut als **Glutrest** am Todesort – einsammeln oder beim nächsten Tod verloren.
- **Leuchtfeuer** (Shrines) pro Biom: Rasten = volle Heilung, Respawn-Punkt, Gegner respawnen, Stufe aufsteigen, Ausrüstung wechseln.
- **Attribute:** Vitalität (HP), Ausdauer (Sta), Stärke, Geschick, Verstand (Zauber-Schaden, Mana), Glaube (Heilung/Licht).
- **Waffen** haben eigene Combo + **Waffenkunst** (Spezialangriff), Skalierung (z. B. Stärke B, Geschick D), Gewichtsklasse
  (leicht/mittel/schwer bestimmt Tempo, Rollen-Kosten egal). Waffen können über **Schmiedesteine** +1…+5 verstärkt werden.
- **Zauber:** 10 verschiedene, 2 Slots aktiv (wechseln am Leuchtfeuer bzw. im Inventar außerhalb vom Kampf).
- **Relikte** (2 Slots): passive Boni (z. B. +10 % Schaden bei voller HP, Heilung bei Kill).
- **Heilflasche** („Glutflakon“): 3 Ladungen, am Leuchtfeuer aufgefüllt, mehr Ladungen durch Funde.
- **Loot:** Seltenheit Gewöhnlich / Selten / Episch / Legendär (Farbe + Lichtsäule). Bosse droppen garantiert ihre Boss-Waffe/-Zauber/-Relikt.

## Musik
Prozedural (WebAudio): pro Biom eigene Ambient-Schicht (Drones, Chor, Glocken), Bosskampf = Trommeln + Streicher-Ostinato + Chor, Siegelträger
episch-orchestral. Sieg-Sting, Tod-Sting. Optionen: Musik/Effekt-Lautstärke.
