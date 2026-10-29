# Wurzelwerk – Art & Feel Direction

**Ziel:** Grafik von „Prototyp-Kreise“ zu „lebendiges Bilderbuch“ heben – nur Canvas 2D, keine Libs, 60 FPS auf Android, Portrait.
**Ist-Zustand (Prototyp):** Nachthimmel + brauner Boden-Verlauf, Stamm als Trapez, Äste/Wurzeln als gleich dicke Linien, Früchte als Glow-Kreise, Schädlinge als Ellipsen. Funktioniert, wirkt aber flach, leblos und zu „neon“.

## 1. Stil-Leitbild
Wurzelwerk sieht aus wie ein **handgeschnittener Scherenschnitt in einem Querschnitt-Terrarium**: flache, klar umrissene Vektor-Silhouetten mit 2–3 Tonstufen, keine Texturen, kein Pixel-Art. Oben ein weicher, sich mit der Welle verändernder Himmel, unten ein warmer, geschichteter Erdquerschnitt. Der Baum ist der Held: organisch, leicht schwankend, immer am hellsten Kontrast. Leuchten ist **Information** (Energiefluss, Engpass, Früchte) – nicht Deko. Schädlinge sind dunkle, lesbare Silhouetten mit einem einzigen Akzent (Augen/Panzerglanz). Gefühl: gemütlich in der Aufbauphase, knackig im Kampf.

## 2. Farbpalette (Hex)
| Bereich | Farben |
|---|---|
| Himmel Tag (oben→unten) | `#7ec8e3` → `#cdeccf` |
| Himmel Dämmerung | `#3b3a6b` → `#e88a6a` |
| Himmel Nacht (Kampf) | `#0b1026` → `#23365a`, Sterne `#cfe8ff` |
| Grasnarbe | `#4f8a3a`, Kante `#7fbf4d` |
| Boden-Schicht 1 (Humus) | `#4a3021` |
| Boden-Schicht 2 (Lehm) | `#3a2519` |
| Boden-Schicht 3 (Tief) | `#22150e`, Steine `#5a5450` / `#3e3a37` |
| Rohstoff Wasser | `#4fc3f7` (Kern `#d6f4ff`) |
| Rohstoff Mineral | `#c9a0ff` (Kern `#f1e4ff`) |
| Stamm/Rinde | Basis `#6b4a2e`, Schatten `#3d2817`, Licht `#9c7048` |
| Blätter | `#3f8f4a`, `#5fb85a`, Licht `#a6e37a`, Schatten `#24572f` |
| Wurzeln | `#8a6440` (dünn heller `#a8825a`) |
| Energiefluss | `#7dffb8` → Überlast `#ff5d4a` |
| Dornenbeere | `#e2405a`, Glanz `#ffb3c0` |
| Sporenkapsel | `#9b6bff`, Gift-Wolke `#b98cff55` |
| Honigblüte | `#ffc93c`, Blüte `#fff2b8` |
| Blattlaus | `#9ccf5a` Körper, `#2b3a1a` Kontur |
| Käfer | `#2a2f3a` Panzer, Glanz `#6f87b5`, Augen `#ffde59` |
| Krähe | `#16141c`, Auge `#ff7b3a` |
| UI Panel | `#14201acc`, Rand `#a6e37a55`, Text `#f3f7e8`, Akzent `#ffc93c`, Gefahr `#ff5d7a` |

Regel: max. **eine** gesättigte Farbe pro Objekt; Hintergrund immer entsättigter als Vordergrund.

## 3. Baum-Darstellung
- **Rinde:** Stamm als Polygon mit `quadraticCurveTo`, darauf 2. Pass mit Licht-Kante (rechts 30 % Breite in `#9c7048`), 4–6 kurze vertikale Rillen in `#3d2817` (einmalig zufällig, im Offscreen-Canvas gecacht).
- **Verästelung:** Äste als **verjüngte Polygone** statt Linien: Breite = `base * (1 - tiefe*0.25)`. Pro Ast 2 Punkte links/rechts der Normale → gefülltes Viereck + runde Kappe. Nahtlos, weil Kind-Startbreite = Eltern-Endbreite.
- **Blätterkrone:** An jedem Astende 5–8 überlappende Kreise (Cluster), 3 Tonstufen: zuerst Schatten-Kreise (+3 px y-Versatz), dann Basis, dann 2 Licht-Kreise oben links. Positionen beim Wachsen einmal würfeln und speichern.
- **Wind:** Jeder Knoten `x += sin(t*1.3 + y*0.02) * tiefe * 1.2` – nur Darstellung, nicht Logik.
- **Wachstums-Animation:** Neuer Trieb `g` 0→1 über 0.4 s mit `easeOutBack`; Blattcluster skalieren 0→1 mit 0.1 s Versatz je Kreis; kleiner Blätter-Burst (6 Partikel `#a6e37a`) am Ende.
```js
const easeOutBack=t=>1+2.7*(t-1)**3+1.7*(t-1)**2;
```

## 4. Wurzeln & Nährstoffe
- Wurzeln wie Äste (verjüngt), Farbe heller als Boden, dunkle Kontur 1 px (`#22150e`) für Lesbarkeit.
- **Energiefluss:** gestrichelte Linie über der Wurzel, Dash wandert Richtung Stamm: `cx.setLineDash([3,9]); cx.lineDashOffset=-t*40*flow;` Farbe `#7dffb8`, `globalCompositeOperation='lighter'`.
- **Engpass:** Farbe per Lerp zu `#ff5d4a` bei Auslastung >90 %, plus Puls `lineWidth = w + sin(t*10)*1.5`.
- **Rohstoff-Felder:** kein Radialgradient pro Frame – ein vorgerendertes Glow-Sprite (64×64) je Typ, mit `drawImage` skaliert; 3–4 kleine „Bläschen“ steigen darin auf. Leeren = Sprite schrumpft + entsättigt.

## 5. Schädlinge
Alle als Silhouette aus 2–4 Primitiven, dunkle Kontur, 1 Akzentfarbe. Immer zum Stamm gedreht (`scale(dir,1)`).
- **Blattlaus:** kleine Tropfenform, 6 px, hüpft (`y -= abs(sin(t*12))*2`). Schwarm leicht versetzt animiert (Phase = id).
- **Käfer:** Halbkreis-Panzer mit Mittelnaht + Glanz-Bogen, 6 Beinstriche im Wechselschritt, `squash` 1±0.05 beim Laufen.
- **Krähe:** Dreieck-Körper, Flügel als 2 Bézier-Dreiecke, Flügelschlag `sin(t*14)`; Schatten-Ellipse am Boden (alpha 0.2) zeigt Flughöhe.
- **Treffer-Flash:** 80 ms komplett weiß zeichnen (`fillStyle='#fff'` statt Farbe) – billig und extrem lesbar.
- HP-Balken nur wenn verletzt, 2 px hoch, über dem Kopf.

## 6. Partikel & Effekte
Ein **Pool** (fixes Array, 300 Einträge, `alive`-Flag), keine `push/splice` im Kampf.
| Event | Effekt |
|---|---|
| Treffer | 4–6 Funken in Fruchtfarbe, Lebensdauer 0.25 s, Kegel entgegen Schussrichtung |
| Tod | 10–14 Splitter in Schädlingsfarbe + 1 Ring (`arc`-Stroke, Radius 0→20, alpha 1→0, 0.3 s) |
| Wachstum | 6 Blättchen (`#a6e37a`, rotierende 3×2-Rechtecke), fallen langsam mit `vy+=30*dt` |
| Mutation | Vollbild-Ring vom Stamm aus + 30 Glitzer in Tag-Farbe, Baum 0.5 s mit `lighter` aufhellen |
| Gift | weiche Wolke = Glow-Sprite `#b98cff`, alpha 0.4, langsam wachsend |
Partikel als `fillRect` (keine `arc`), Glow nur über vorgerenderte Sprites.

## 7. Juice – mit Dosierung
- **Screenshake:** nur bei Stamm-Schaden (4 px, 0.15 s) und Boss/Mutation (6 px). Abklingend: `off = amp*shake² * rand`. Nie bei eigenen Treffern. Option im Menü „Wackeln aus“.
- **Hit-Stop:** 40 ms Freeze (`dt=0`) nur bei Kill von Käfer/Krähe und Stamm-Treffer; nie bei Blattläusen (Schwarm = Dauer-Stop).
- **Zahlen-Popups:** Schaden klein (11 px, weiß, 0.5 s, steigt 20 px), Crits/Kettenfrucht größer (15 px, `#ffc93c`) mit Scale-Pop 1.4→1. Energie-Gewinn `+2` in `#7dffb8` fliegt zum HUD-Balken. Max. 20 gleichzeitig – älteste ersetzen.
- **Squash & Stretch:** Frucht beim Schuss 1.3×0.8 für 60 ms; Stamm bei Treffer kurz 0.95 breit.
- **Faustregel:** je häufiger ein Event, desto kleiner sein Juice.

## 8. UI-Stil
- **HUD:** oben eine dünne Leiste, abgerundete Pills (`border-radius:20px`, Panel `#14201acc`). Links Stamm-HP als Blatt-Icon + Balken, Mitte „Welle 3 · 🌙“, rechts Energie mit Tropfen-Icon. Balken mit 150-ms-„Nachlauf“-Balken (weiß) für sichtbaren Verlust.
- Schrift: `system-ui`, Zahlen `font-variant-numeric:tabular-nums`, bold.
- **Mutations-Karten:** hochkant (Spielkarten-Gefühl), cremefarbener Grund `#f3ecd6`, dunkler Text `#2a1d12`, oben ein Canvas-gezeichnetes Icon, unten Synergie-Tags als farbige Chips (Boden `#8a6440`, Frucht `#e2405a`, Stamm `#5fb85a`, Zeit `#4fc3f7`). Rein: von unten mit 60 ms Versatz, `transform:translateY(40px) rotate(-3deg)` → 0. Antippen: Scale 1.05, die anderen fallen weg.
- Kein Neon-Glow im UI; Glow ist für Spielwelt-Information reserviert.

## 9. Sound per WebAudio
Ein `AudioContext` nach erstem Tipp; Master-Gain 0.4; jeder Sound = Oszillator + Gain-Hüllkurve.
```js
function tone(f,dur,type='sine',vol=.3,slide=0){const o=A.createOscillator(),g=A.createGain();
 o.type=type;o.frequency.setValueAtTime(f,A.currentTime);if(slide)o.frequency.exponentialRampToValueAtTime(f*slide,A.currentTime+dur);
 g.gain.setValueAtTime(vol,A.currentTime);g.gain.exponentialRampToValueAtTime(.001,A.currentTime+dur);
 o.connect(g).connect(M);o.start();o.stop(A.currentTime+dur);}
```
| Sound | Rezept |
|---|---|
| Wachsen (Ast/Wurzel) | sine 300→600 Hz, 0.15 s, + zweiter Ton Quinte drüber |
| Schuss Dornenbeere | triangle 900→500 Hz, 0.06 s, vol 0.12, Tonhöhe ±5 % zufällig |
| Treffer | Noise-Buffer 0.04 s durch Bandpass 2 kHz |
| Kill | square 400→120 Hz, 0.12 s, vol 0.15 |
| Stamm getroffen | sine 90→50 Hz, 0.25 s, vol 0.5 (dumpfer Wumms) |
| Zu wenig Energie | square 180 Hz, 2× 0.05 s |
| Mutation gewählt | Arpeggio C-E-G-C (523/659/784/1047 Hz), sine, je 0.08 s |
| Welle startet | sawtooth 110 Hz, 0.6 s, Lowpass 400 Hz, langsames Attack |
| Engpass | leises Tick 1200 Hz, 0.02 s, max. 1×/s |
Limit: max. 8 Sounds gleichzeitig, gleiche Sounds im Abstand <30 ms verwerfen.

## 10. Performance-Regeln (Android)
1. DPR auf max. 2 begrenzen (schon drin); bei FPS <50 automatisch auf 1.5.
2. **Statisches vorrendern:** Himmel, Bodenschichten, Steine in Offscreen-Canvas; nur bei Wellen-/Tageszeitwechsel neu.
3. **Kein `shadowBlur`** im Frame-Loop – durch vorgerenderte Glow-Sprites + `drawImage` ersetzen.
4. Keine `createRadialGradient/LinearGradient` pro Frame; Gradients einmal erzeugen und cachen.
5. Gleichfarbiges bündeln: ein `beginPath()` für alle Wurzeln einer Farbe, dann ein `stroke()`.
6. Objekt-Pools für Partikel, Schüsse, Texte; kein Garbage im Loop (keine Template-Strings für Farben pro Frame).
7. `globalCompositeOperation='lighter'` nur für Energie/Glow-Pass, danach zurücksetzen.
8. Text-Popups: Font einmal setzen, alle Texte in einem Block zeichnen.
9. Obergrenzen: 300 Partikel, 60 Schädlinge, 20 Popups – darüber zusammenfassen statt mehr zeichnen.
10. `dt` auf 0.05 s kappen, Tab-Wechsel pausiert (`visibilitychange`).

## Umsetzungs-Reihenfolge (größter Effekt zuerst)
1. Palette + Tag/Nacht-Himmel + Bodenschichten (vorgerendert)
2. Verjüngte Äste/Wurzeln + Blattcluster + Wind
3. Treffer-Flash, Partikel-Pool, Popups, Hit-Stop
4. Neue Schädlings-Silhouetten
5. Mutations-Karten-Restyle + HUD
6. WebAudio-Sounds
