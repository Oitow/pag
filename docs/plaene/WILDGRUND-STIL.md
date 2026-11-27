# Wildgrund – Asset-Vertrag

Im Stil-Labor stehen Riesenbaum, Fachwerkhütte, Findlinge, Feuer und ein 1,8 m großer Wanderer im selben Waldrand. Fernbäume reichen bis 205 m. Mit ?look=a|b|c startet die jeweilige Variante, mit &ort=feuer die Nahansicht. Goi entscheidet nach dem Handyvergleich.

| Look | Oberflächen |
|---|---|
| A Vertex | Vertexfarben, gerichtete Sonne, kühle Schatten |
| B PS2 | 64²-Atlas mit vier 32²-Kacheln und Dithering |
| C Hybrid | Triplanares Detail, Krümmung für Kanten und Vertiefungen, Moos-Splats |

Meter, +Y oben, Ursprung mittig am Fuß. Statische Requisiten teilen ein Material mit linearen Vertexfarben. Separates Leuchtmaterial für Glut und Lampen. Im Atlas Erde, Holz, Stein und Laub in Leserichtung belegen. Einen Texel Rand reservieren. Der Shader projiziert nach Flächennormale. Instanzen teilen Geometrie und Material.

| Zielbudget | Nah (<20 m) | Mittel (20–60 m) | Fern (>60 m) |
|---|---:|---:|---|
| Findling | 800 △ | 200 △ | 40 △ oder ausblenden |
| Hütte | 4.000 △ | 800 △ | Siedlungs-Impostor |
| Waldbaum | 5.000 △ | 800 △ | 2 △ Impostor |
| Riesenbaum | 25.000 △ | 4.000 △ | Kronen-/Stamm-Impostor |

Diese Budgets gelten als Ziele für die Spielintegration. Das Labor verwendet feste Detailstufen und Instanzen. Das HUD zeigt Dreiecke und Draw-Calls pro Bild sowie gehaltene Geometrien und Texturen als Stückzahlen. Für einen Kaltvergleich jeden Look über seinen Direktlink neu laden.
