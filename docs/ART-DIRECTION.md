# 🎨 Art-Direction – wie unsere Welten aussehen sollen

> Gilt für alle neuen Welten ab dem Dämmerwald (MMO „Erlenwacht“). Alte Labore (Voxel-Tiere, PS1-Look) bleiben, wie sie sind.
> Kurzform: **düster, groß, weich, echt** – nicht bunt, klein, kantig, Spielzeug.

## 1 · Größe (wichtigste Regel)
- Der Mensch ist **1.8 m**. Jede Größe wird in Metern festgelegt und daran gemessen. Nichts „nach Gefühl“ skalieren.
- Groß wirkt nur, was einen **Vergleich** hat: neben jedem Riesen steht etwas Bekanntes (Mensch, Laterne, normaler Baum, Boot).
- **Luftperspektive**: mit der Entfernung wird alles blasser, kühler, kontrastärmer. Fernes ist Silhouette. Ohne Dunst keine Größe.
- **Drei Größenordnungen** am selben Ding: grob (Form, 10 m+), mittel (Wurzel, Ast, 1 m), fein (Rinde, Moos, 0.1–0.3 m).
- Große Dinge **nie ganz zeigen**: Kronen verschwinden im Dunst, Stämme laufen aus dem Bild.
- Kamera tief und nah am Menschen, Sichtfeld ~50°, Fernebene ≥ 1500 m. Weitwinkel macht klein.
- Bewegung: Großes bewegt sich langsam. Fernes bewegt sich winzig (Vögel als Punkte).

## 2 · Licht & Farbe
- Tageszeit ist eine Entscheidung, kein Zufall: der Dämmerwald steht in **ewiger Dämmerung** (tiefe warme Sonne, kühle Schatten).
- Palette gedämpft: Grundtöne entsättigt (Rinde graubraun, Laub dunkel-olive/blaugrün, Boden torfig). **Sattes nur als Akzent**: Lichtbahn, Laterne, leuchtender Pilz (Türkis), Glühwürmchen.
- Starker Hell-Dunkel-Kontrast im Nahbereich, wenig Kontrast in der Ferne. Schatten sind farbig (blaugrün), nie reines Schwarz.
- Biolumineszenz sparsam – drei leuchtende Pilze wirken, dreißig sind Kirmes.

## 3 · Form
- Natur ist **weich und verwachsen**: Übergänge (Wurzel→Stamm→Boden) fließen. Dafür SDF mit weicher Vereinigung (`engine/core/sdf.js`).
- Keine sichtbaren Bauklötze, keine Würfel-Bäume, keine einheitlichen Kugel-Kronen in neuen Welten.
- Laub, Moos, Dunst, Staub = **Gauß-Splats** (`engine/render/gauss-wolke.js`): weich, viele, klein. Harte Dinge (Fels, Stamm, Gebäude) = Mesh.
- Wiederholung verstecken: 4–5 Varianten, gedreht/skaliert, Helden-Objekte von Hand gesetzt.

## 4 · Prüf-Fragen fürs Bild (für `gucker` und für dich)
1. Finde ich den Menschen im Bild – und wirkt er klein?
2. Gibt es Vorder-, Mittel- und Hintergrund, die sich durch Dunst trennen?
3. Könnte das ein Foto bei schlechtem Licht sein – oder sieht man sofort „Lowpoly-Spiel“?
4. Wo schaut das Auge hin? (Es muss genau **einen** hellsten Punkt geben.)
5. Was sieht nach Spielzeug aus? (zu satt, zu sauber, zu gleichmäßig, zu klein) → das als Nächstes ändern.
