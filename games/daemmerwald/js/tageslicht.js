// Dämmerwald – Tageslicht als reine Daten (ohne THREE): Sonnen-/Mondbahn aus engine/world/himmel-stand (Bahnen, Mond, Licht-Stärken),
// Farben aber aus einer eigenen Wald-Palette (der Engine-Himmel ist blau-offen; hier braucht es grünlich-grauen Dunst unter den Kronen).
// Die Palette ist über die Sonnenhöhe h = sin(Höhenwinkel) gestützt; der Stützpunkt bei START_STUNDE ist genau der bisherige „ewige Dämmerung“-Look.
import { himmelStand, sonnenRichtung } from '../../../engine/world/himmel-stand.js';

export const BREITE = 48, JAHR = 0.25, MOND_TAG = 15;   // Sommer, Vollmond um Tag 15
export const START_STUNDE = 17.75;                        // goldene Abendstunde (h ≈ 0.34) – der Standard-Look
const SONNE_START = [0.52, 0.34, -0.78];                  // bisherige feste Sonne (Westen = +x, Süden = −z)

// Drehung um y, damit die Abendsonne zur Welt passt (himmel-stand: +x Ost, −z Nord)
const ref = sonnenRichtung(START_STUNDE, JAHR, BREITE);
const DREH = Math.atan2(SONNE_START[0], SONNE_START[2]) - Math.atan2(ref[0], ref[2]), C = Math.cos(DREH), S = Math.sin(DREH);
export function drehe(v, out = [0, 0, 0]) { const x = v[0], z = v[2]; out[0] = x * C + z * S; out[1] = v[1]; out[2] = -x * S + z * C; return out; }

const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
// Stützpunkte (sRGB): dunst = Nebel/Horizont, warm = Horizont zum Licht, zenit, scheibe = Sonnenschein am Himmel, licht = Richtungslicht,
// himmel/boden = Halbkugel-Licht, gegen = schwaches Gegenlicht; I = Stärken (three-Einheiten wie bisher)
const P = (h, dunst, warm, zenit, scheibe, licht, lichtI, himmel, boden, himmelI, gegen, gegenI) =>
  ({ h, dunst: hex(dunst), warm: hex(warm), zenit: hex(zenit), scheibe: hex(scheibe), licht: hex(licht), himmel: hex(himmel), boden: hex(boden), gegen: hex(gegen), lichtI, himmelI, gegenI });
export const PALETTE = [
  P(-0.25, 0x141e2a, 0x1c2a3c, 0x08101c, 0xc8d8ff, 0x9db4e8, 0, 0x3a5a80, 0x121820, 1.4, 0x4a6a90, 0.35),   // Nacht: kühles Blau, nie schwarz
  P(-0.08, 0x384656, 0x76687a, 0x28384e, 0xff9a70, 0xff9a70, 0, 0x6a809a, 0x20252a, 1.5, 0x5a7890, 0.4),  // blaue Stunde
  P(0.03, 0x6c7276, 0xd8966a, 0x4c6272, 0xffb070, 0xffb47c, 2.0, 0x8a9caa, 0x34383a, 1.7, 0x7090a0, 0.5),  // Sonnenauf-/-untergang
  P(0.34, 0x8a9c98, 0xe2bd94, 0x6f8790, 0xffd9a8, 0xffe0c2, 2.3, 0x9bbcc0, 0x3a4038, 2.0, 0x7fa0a8, 0.6),  // goldene Stunde (bisheriger Look)
  P(0.65, 0x97aba6, 0xc9d2c2, 0x7896a6, 0xfff0d8, 0xfff2e2, 2.7, 0xa8c6ca, 0x3e463c, 2.2, 0x88a8ae, 0.6),  // Vormittag
  P(1.0, 0x9cb0ab, 0xc4d0c4, 0x7a9aac, 0xfff4e4, 0xfff6ea, 2.8, 0xaccacc, 0x40483e, 2.3, 0x8aaab0, 0.6),   // Mittag
];
const NAMEN = ['dunst', 'warm', 'zenit', 'scheibe', 'licht', 'himmel', 'boden', 'gegen'];
const lerp = (a, b, t) => a + (b - a) * t;
const glatt = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function leer() {
  const o = { stunde: 0, h: 0, richtung: [0, 1, 0], scheibe: [0, 1, 0], mond: false, nacht: 0, tag: 1, sterne: 0, strahlen: 0, lichtI: 0, himmelI: 0, gegenI: 0, farben: {} };
  for (const n of NAMEN) o.farben[n] = [0, 0, 0];
  o.farben.scheibeHell = [0, 0, 0];
  return o;
}

/** Licht-Zustand zur Stunde (0–24). tag: Kalendertag (Mondphase). ziel wiederverwenden (kein Müll je Bild). Farben sRGB 0..1. */
export function tageslicht(stunde, tag = MOND_TAG, ziel = leer(), stand = undefined) {
  const st = himmelStand({ stunde, jahresAnteil: JAHR, tag, breite: BREITE }, stand);
  const h = st.sonneHoehe, o = ziel, f = o.farben;
  o.stunde = stunde; o.h = h; o.tag = st.tag; o.nacht = 1 - glatt(-0.12, 0.02, h); o.sterne = st.sterne;
  let k = 0;
  while (k < PALETTE.length - 2 && h > PALETTE[k + 1].h) k++;
  const a = PALETTE[k], b = PALETTE[k + 1], t = glatt(0, 1, (h - a.h) / (b.h - a.h));
  for (const n of NAMEN) for (let i = 0; i < 3; i++) f[n][i] = lerp(a[n][i], b[n][i], t);
  // Morgen: etwas kühler und dunstiger als der Abend (gleiche Sonnenhöhe)
  const morgen = stunde < 12 ? glatt(0.0, 0.08, h) * (1 - glatt(0.4, 0.7, h)) : 0;
  if (morgen > 0) for (const n of ['warm', 'dunst']) { const c = f[n], l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; c[0] = lerp(c[0], l * 0.97, morgen * 0.35); c[1] = lerp(c[1], l * 1.01, morgen * 0.35); c[2] = lerp(c[2], l * 1.06, morgen * 0.35); }
  o.himmelI = lerp(a.himmelI, b.himmelI, t) + 0.25 * st.mondHell * o.nacht * (st.mondHoehe > 0 ? 1 : 0);
  o.gegenI = lerp(a.gegenI, b.gegenI, t);
  drehe(st.lichtRichtung, o.richtung);
  if (h > -0.05) {                                         // Sonne
    o.mond = false;
    o.lichtI = lerp(a.lichtI, b.lichtI, t) * Math.min(1, st.lichtStaerke / 2.3);
    drehe(st.sonneRichtung, o.scheibe);
    for (let i = 0; i < 3; i++) f.scheibeHell[i] = f.scheibe[i] * glatt(-0.06, 0.02, h);
    // Strahlen: morgens/abends lang und golden, mittags schwach
    o.strahlen = glatt(-0.02, 0.1, h) * (0.3 + 0.7 * (1 - glatt(0.35, 0.85, h)));
  } else {                                                 // Mond
    o.mond = true;
    o.lichtI = st.lichtStaerke * 1.5;
    drehe(st.mondRichtung, o.scheibe);
    const m = (0.25 + 0.75 * st.mondHell) * glatt(-0.05, 0.08, st.mondHoehe) * o.nacht;
    for (let i = 0; i < 3; i++) { f.licht[i] = PALETTE[0].licht[i]; f.scheibeHell[i] = PALETTE[0].scheibe[i] * m * 0.55; }
    o.strahlen = 0.35 * Math.min(1, st.lichtStaerke / 0.55);
  }
  return o;
}
