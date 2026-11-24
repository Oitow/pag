// Was wächst wo? (reine Logik, ohne THREE) – Klimaansprüche je Pflanze als Regel statt fester Biom-Listen.
// Eignung 0…1 aus Temperatur (Jahresmittel am Ort) und Feuchte: Trapez – unter min/über max nichts, zwischen opt-Grenzen voll.
// Genutzt von natur-streu (wilde Natur) und später vom Ackerbau (Felder: gleiche Regeln + Boden).

/** Ansprüche: t = [min, optVon, optBis, max] °C Jahresmittel, f = [min, optVon, optBis, max] Feuchte 0…1, gewicht = Häufigkeit. */
export const PFLANZEN = {
  // Bäume
  fichte:     { t: [-4, 0, 8, 13], f: [0.35, 0.5, 1, 1.1], gewicht: 6, baum: true },
  tanne:      { t: [-2, 2, 9, 14], f: [0.45, 0.6, 1, 1.1], gewicht: 2, baum: true },
  kiefer:     { t: [-5, -1, 14, 20], f: [0.15, 0.3, 0.7, 0.9], gewicht: 3, baum: true },
  birke:      { t: [-7, -2, 10, 15], f: [0.3, 0.45, 0.9, 1.1], gewicht: 3, baum: true },
  buche:      { t: [4, 8, 13, 17], f: [0.5, 0.6, 0.95, 1.1], gewicht: 4, baum: true },
  eiche:      { t: [3, 7, 15, 19], f: [0.35, 0.5, 0.85, 1], gewicht: 3, baum: true },
  ahorn:      { t: [3, 6, 13, 17], f: [0.45, 0.55, 0.95, 1.1], gewicht: 2, baum: true },
  weide:      { t: [0, 5, 18, 24], f: [0.6, 0.8, 1, 1.1], gewicht: 1, baum: true },
  olive:      { t: [12, 15, 20, 24], f: [0.15, 0.25, 0.5, 0.65], gewicht: 2, baum: true },
  pinie:      { t: [11, 14, 19, 23], f: [0.15, 0.25, 0.55, 0.7], gewicht: 1, baum: true },
  akazie:     { t: [17, 20, 30, 34], f: [0.15, 0.25, 0.55, 0.7], gewicht: 2, baum: true },
  palme:      { t: [18, 22, 30, 34], f: [0.3, 0.5, 1, 1.1], gewicht: 2, baum: true },
  tropenbaum: { t: [19, 22, 30, 34], f: [0.6, 0.7, 1, 1.1], gewicht: 5, baum: true },
  // Feldfrüchte (für später: Ackerbau) – Jahresmittel als grobe Näherung der Wachstumszeit
  weizen:     { t: [3, 7, 15, 20], f: [0.25, 0.35, 0.7, 0.85], gewicht: 1, feld: true },
  roggen:     { t: [0, 4, 11, 16], f: [0.25, 0.35, 0.8, 0.95], gewicht: 1, feld: true },
  kartoffel:  { t: [2, 6, 15, 20], f: [0.35, 0.45, 0.85, 1], gewicht: 1, feld: true },
  mais:       { t: [10, 15, 24, 29], f: [0.35, 0.45, 0.85, 1], gewicht: 1, feld: true },
  reis:       { t: [17, 21, 29, 33], f: [0.65, 0.8, 1, 1.1], gewicht: 1, feld: true },
  hirse:      { t: [16, 20, 30, 35], f: [0.12, 0.2, 0.5, 0.7], gewicht: 1, feld: true },
};

const trapez = (x, [a, b, c, d]) => (x <= a || x >= d ? 0 : x < b ? (x - a) / (b - a) : x > c ? (d - x) / (d - c) : 1);

/** Eignung 0…1 der Pflanze für Temperatur T (°C Jahresmittel) und Feuchte F. */
export function eignung(art, T, F) {
  const p = PFLANZEN[art];
  return p ? trapez(T, p.t) * trapez(F, p.f) : 0;
}

/** Gewichtete Wahl unter den Bäumen, die hier wachsen können (w ∈ [0,1)). null = nichts passt. */
export function waehleBaum(T, F, w) {
  let summe = 0;
  for (const [art, p] of Object.entries(PFLANZEN)) if (p.baum) summe += p.gewicht * eignung(art, T, F) ** 2;
  if (summe <= 0.01) return null;
  let x = w * summe;
  for (const [art, p] of Object.entries(PFLANZEN)) {
    if (!p.baum) continue;
    x -= p.gewicht * eignung(art, T, F) ** 2;
    if (x < 0) return art;
  }
  return null;
}

/** Liste „was wächst hier gut“ (Eignung ≥ 0.5), sortiert – für HUD/Spielhilfe. */
export function waechstHier(T, F, { feld = null } = {}) {
  return Object.entries(PFLANZEN)
    .filter(([, p]) => feld === null || !!p.feld === feld)
    .map(([art]) => [art, eignung(art, T, F)])
    .filter(([, e]) => e >= 0.5).sort((a, b) => b[1] - a[1]).map(([art]) => art);
}
