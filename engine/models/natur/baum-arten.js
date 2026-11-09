/**
 * @modul    baum-arten
 * @zweck    Reine Parameter-Daten der Baumarten (Wuchs, Verzweigung, Laubform, Farben, Jahreszeiten) für baum-skelett/baum
 * @api      ARTEN { typ: art } ; ART_NAMEN [typ…] ; art(typ) -> art (wirft bei unbekanntem Typ)
 * @beispiel
 *   import { art } from '../../engine/models/natur/baum-arten.js';
 *   const birke = art('birke');   // { stamm, ordnungen, aeste, winkel, laub, rinde, … }
 * @tags     natur, baum, daten, parameter, art
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

/*
 * Felder (Längen in Metern, Winkel in Grad; Listen je Ordnung: [Äste am Stamm, an Ordnung 1, an Ordnung 2]):
 *  stamm:   { laenge, radius, spitze (Radius-Faktor am Ende), neigung, krumm, bogen (konstante Biegung, Palme), segmente, knorrig, stamme (Mehrfachstamm) }
 *  form:    'laub' (Äste + Laub) | 'kegel' (Etagen) | 'palme' (Wedel) | 'kahl'
 *  ordnungen: max. Astordnungen bei detail 2 (detail 1: −1, detail 0: −2, mind. 1)
 *  aeste, astStart (0..1 entlang des Elternasts), winkel, laenge (× Elternlänge), tropismus (+ hoch / − hängen), krumm
 *  profil:  Astlänge über die Stammhöhe: 'kugel' | 'kegel' | 'schirm' | 'gleich'
 *  laub:    { form: 'ballen'|'flach'|'haengend'|'wedel'|'kegel'|'keins', groesse, streckung [sx,sy,sz], farben [], herbst [], entlang, stufe }
 *  rinde:   { farbe, oben (Farbe zur Spitze), flecken { farbe, anteil }, ringe (Palme) }
 *  etagen:  { anzahl [d0,d1,d2], ansatz (0..1 der Höhe), radius (× Höhe), haengen, seiten }
 *  laubwerfend: kahl im Winter
 */
export const ARTEN = {
  eiche: {
    form: 'laub', laubwerfend: true, groesseVar: 0.15,
    stamm: { laenge: 7.5, radius: 0.42, spitze: 0.3, neigung: 0.06, krumm: 0.16, segmente: 5, knorrig: 0.08 },
    ordnungen: 3, aeste: [6, 3, 2], astStart: [0.32, 0.35, 0.4], winkel: [62, 42, 38], laenge: [0.62, 0.5, 0.5],
    tropismus: [0.04, 0.06, 0.08], krumm: [0.3, 0.35, 0.35], profil: 'kugel', radiusFaktor: 0.62,
    laub: { form: 'ballen', groesse: 1.35, streckung: [1.15, 0.8, 1.15], farben: ['#3f6e2a', '#4a7a2e', '#35602a'], herbst: ['#9a6a24', '#b07a2a', '#7d5a22'] },
    rinde: { farbe: '#5a4433' },
  },
  buche: {
    form: 'laub', laubwerfend: true, groesseVar: 0.12,
    stamm: { laenge: 10, radius: 0.32, spitze: 0.25, neigung: 0.03, krumm: 0.06, segmente: 5 },
    ordnungen: 3, aeste: [7, 3, 2], astStart: [0.42, 0.35, 0.4], winkel: [48, 40, 35], laenge: [0.45, 0.5, 0.5],
    tropismus: [0.12, 0.08, 0.06], krumm: [0.15, 0.2, 0.25], profil: 'kugel', radiusFaktor: 0.55,
    laub: { form: 'ballen', groesse: 1.3, streckung: [0.95, 1.15, 0.95], farben: ['#5e9a34', '#6aa63a', '#558f30'], herbst: ['#c0782a', '#a85a22', '#d08e34'] },
    rinde: { farbe: '#8c8a82' },
  },
  birke: {
    form: 'laub', laubwerfend: true, groesseVar: 0.12,
    stamm: { laenge: 10, radius: 0.17, spitze: 0.2, neigung: 0.07, krumm: 0.1, segmente: 10 },
    ordnungen: 3, aeste: [8, 2, 2], astStart: [0.4, 0.3, 0.4], winkel: [36, 38, 40], laenge: [0.34, 0.6, 0.55],
    tropismus: [0.1, -0.08, -0.16], krumm: [0.18, 0.2, 0.25], profil: 'kegel', radiusFaktor: 0.5,
    laub: { form: 'ballen', groesse: 0.85, streckung: [0.8, 1.35, 0.8], farben: ['#86b545', '#94c050', '#7aa83e'], herbst: ['#e0b830', '#d4a428', '#e8c848'], senken: 0.35 },
    rinde: { farbe: '#e8e6df', flecken: { farbe: '#2b2a28', anteil: 0.3 } },
  },
  ahorn: {
    form: 'laub', laubwerfend: true, groesseVar: 0.12,
    stamm: { laenge: 6.5, radius: 0.32, spitze: 0.3, neigung: 0.04, krumm: 0.1, segmente: 5 },
    ordnungen: 3, aeste: [6, 3, 2], astStart: [0.35, 0.3, 0.4], winkel: [52, 42, 38], laenge: [0.62, 0.55, 0.5],
    tropismus: [0.1, 0.08, 0.05], krumm: [0.2, 0.25, 0.3], profil: 'kugel', radiusFaktor: 0.6,
    laub: { form: 'ballen', groesse: 1.45, streckung: [1.1, 0.9, 1.1], farben: ['#6aa236', '#78aa3a', '#5c9430'], herbst: ['#d0451e', '#e06a1c', '#c03020', '#e89a22'] },
    rinde: { farbe: '#6a5a4a' },
  },
  weide: {
    form: 'laub', laubwerfend: true, groesseVar: 0.12,
    stamm: { laenge: 4.2, radius: 0.42, spitze: 0.4, neigung: 0.1, krumm: 0.18, segmente: 4, knorrig: 0.08 },
    ordnungen: 2, aeste: [6, 3, 2], astStart: [0.55, 0.3, 0.4], winkel: [48, 55, 50], laenge: [1.0, 0.55, 0.5],
    tropismus: [0.1, -0.12, -0.25], krumm: [0.15, 0.2, 0.2], profil: 'gleich', radiusFaktor: 0.55,
    laub: { form: 'haengend', groesse: 0.8, streckung: [1.2, 0.75, 1.2], farben: ['#8aac4a', '#9ab858', '#7c9e42'], herbst: ['#c8b040', '#b8a038'], faeden: 6, fadenLaenge: 4.2 },
    rinde: { farbe: '#5e5040' },
  },
  tanne: {
    form: 'kegel', laubwerfend: false, groesseVar: 0.15,
    stamm: { laenge: 13, radius: 0.3, spitze: 0.1, neigung: 0.015, krumm: 0.02, segmente: 3 },
    ordnungen: 0, aeste: [0], astStart: [0], winkel: [0], laenge: [0], tropismus: [0], krumm: [0], profil: 'kegel', radiusFaktor: 0.5,
    etagen: { anzahl: [3, 6, 8], ansatz: 0.12, radius: 0.27, haengen: 0.25, seiten: 8, form: 1.0 },
    laub: { form: 'kegel', farben: ['#2b5a3a', '#2f6040', '#26523a'], herbst: ['#2b5a3a'] },
    rinde: { farbe: '#4a3a2e' },
  },
  fichte: {
    form: 'kegel', laubwerfend: false, groesseVar: 0.15,
    stamm: { laenge: 15, radius: 0.28, spitze: 0.1, neigung: 0.015, krumm: 0.03, segmente: 3 },
    ordnungen: 0, aeste: [0], astStart: [0], winkel: [0], laenge: [0], tropismus: [0], krumm: [0], profil: 'kegel', radiusFaktor: 0.5,
    etagen: { anzahl: [3, 7, 10], ansatz: 0.08, radius: 0.2, haengen: 0.5, seiten: 7, form: 0.85 },
    laub: { form: 'kegel', farben: ['#1f4a2a', '#24502e', '#1c4426'], herbst: ['#1f4a2a'] },
    rinde: { farbe: '#5a4232' },
  },
  kiefer: {
    form: 'laub', laubwerfend: false, groesseVar: 0.15,
    stamm: { laenge: 13, radius: 0.27, spitze: 0.35, neigung: 0.06, krumm: 0.1, segmente: 6 },
    ordnungen: 2, aeste: [8, 3, 2], astStart: [0.64, 0.45, 0.5], winkel: [68, 40, 35], laenge: [0.3, 0.5, 0.5],
    tropismus: [0.1, 0.12, 0.1], krumm: [0.3, 0.3, 0.3], profil: 'kegel', radiusFaktor: 0.45,
    laub: { form: 'flach', groesse: 1.5, streckung: [1.25, 0.5, 1.25], farben: ['#36583a', '#3a6040', '#2f5034'], herbst: ['#36583a'] },
    rinde: { farbe: '#6a4a36', oben: '#b8683a' },
  },
  pinie: {
    form: 'laub', laubwerfend: false, groesseVar: 0.12,
    stamm: { laenge: 8, radius: 0.3, spitze: 0.4, neigung: 0.12, krumm: 0.12, segmente: 5 },
    ordnungen: 3, aeste: [5, 3, 2], astStart: [0.8, 0.45, 0.5], winkel: [50, 38, 30], laenge: [0.55, 0.55, 0.5],
    tropismus: [0.0, -0.01, -0.03], krumm: [0.12, 0.15, 0.15], profil: 'gleich', radiusFaktor: 0.6,
    laub: { form: 'flach', groesse: 1.9, streckung: [1.4, 0.36, 1.4], farben: ['#4a6a34', '#527238', '#42602e'], herbst: ['#4a6a34'] },
    rinde: { farbe: '#7a5a42', oben: '#9a6a44' },
  },
  tropenbaum: {
    form: 'laub', laubwerfend: false, groesseVar: 0.15,
    stamm: { laenge: 11, radius: 0.4, spitze: 0.35, neigung: 0.04, krumm: 0.08, segmente: 5, brett: 4 },
    ordnungen: 3, aeste: [5, 3, 2], astStart: [0.7, 0.4, 0.45], winkel: [62, 40, 35], laenge: [0.38, 0.5, 0.45],
    tropismus: [0.08, 0.1, 0.06], krumm: [0.2, 0.25, 0.3], profil: 'schirm', radiusFaktor: 0.55,
    laub: { form: 'flach', groesse: 1.9, streckung: [1.15, 0.6, 1.15], farben: ['#2a7a2e', '#2e8432', '#24702a'], herbst: ['#2a7a2e'] },
    rinde: { farbe: '#9a9284' },
  },
  palme: {
    form: 'palme', laubwerfend: false, groesseVar: 0.15,
    stamm: { laenge: 9, radius: 0.22, spitze: 0.65, neigung: 0.12, krumm: 0.03, bogen: 0.025, segmente: 8 },
    ordnungen: 0, aeste: [0], astStart: [0], winkel: [0], laenge: [0], tropismus: [0], krumm: [0], profil: 'gleich', radiusFaktor: 0.5,
    laub: { form: 'wedel', groesse: 3.6, wedel: [6, 9, 12], farben: ['#4f8a2a', '#5a9630', '#467e26'], herbst: ['#4f8a2a'], spitze: '#8aa848' },
    rinde: { farbe: '#8a7254', ringe: '#6a5640' },
  },
  akazie: {
    form: 'laub', laubwerfend: false, groesseVar: 0.15,
    stamm: { laenge: 4.5, radius: 0.24, spitze: 0.55, neigung: 0.1, krumm: 0.15, segmente: 4 },
    ordnungen: 3, aeste: [3, 3, 2], astStart: [0.75, 0.55, 0.55], winkel: [38, 48, 50], laenge: [0.95, 0.65, 0.55],
    tropismus: [0.02, -0.04, -0.02], krumm: [0.15, 0.2, 0.2], profil: 'gleich', radiusFaktor: 0.62,
    laub: { form: 'flach', groesse: 1.7, streckung: [1.5, 0.28, 1.5], farben: ['#6a8a36', '#76923c', '#5e7e30'], herbst: ['#6a8a36'] },
    rinde: { farbe: '#4e4036' },
  },
  olive: {
    form: 'laub', laubwerfend: false, groesseVar: 0.15,
    stamm: { laenge: 2.6, radius: 0.34, spitze: 0.6, neigung: 0.15, krumm: 0.35, segmente: 4, knorrig: 0.22, stamme: 2 },
    ordnungen: 3, aeste: [3, 3, 2], astStart: [0.55, 0.35, 0.4], winkel: [30, 40, 40], laenge: [0.95, 0.55, 0.5],
    tropismus: [0.1, 0.08, 0.04], krumm: [0.35, 0.35, 0.35], profil: 'gleich', radiusFaktor: 0.6,
    laub: { form: 'ballen', groesse: 1.2, streckung: [1.1, 0.8, 1.1], farben: ['#8fa284', '#9cb090', '#83977a'], herbst: ['#8fa284', '#9cb090'] },
    rinde: { farbe: '#6e6658' },
  },
  toterBaum: {
    form: 'kahl', laubwerfend: true, groesseVar: 0.2,
    stamm: { laenge: 6.5, radius: 0.3, spitze: 0.35, neigung: 0.1, krumm: 0.22, segmente: 5, knorrig: 0.1 },
    ordnungen: 3, aeste: [5, 3, 2], astStart: [0.3, 0.3, 0.3], winkel: [55, 45, 40], laenge: [0.55, 0.5, 0.5],
    tropismus: [0.05, 0.02, 0], krumm: [0.45, 0.5, 0.55], profil: 'kugel', radiusFaktor: 0.55, abbruch: 0.3,
    laub: { form: 'keins', farben: [], herbst: [] },
    rinde: { farbe: '#6e6458' },
  },
};

export const ART_NAMEN = Object.keys(ARTEN);

export function art(typ) {
  const a = ARTEN[typ];
  if (!a) throw new Error(`baum-arten: unbekannter Typ "${typ}"`);
  return a;
}
