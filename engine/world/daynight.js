/**
 * @modul    daynight
 * @zweck    Tageszeit-Steuerung (0..24 h, Geschwindigkeit, Pause): rechnet Sonnen-/Mondrichtung, Licht-, Umgebungs-, Nebel- und Himmelsfarben (reine Funktion ohne THREE) und überträgt sie auf Licht, Nebel und Himmel
 * @api      tageszeitZustand(stunde,opts) -> zustand ; createDayNight(opts) -> {stunde,geschwindigkeit,laeuft,bewoelkung,zustand,update,setStunde,anwenden,dispose} ; formatUhrzeit(stunde) -> 'hh:mm' ; SCHLUESSEL
 * @beispiel
 *   import { createDayNight } from '../../engine/world/daynight.js';
 *   const tag = createDayNight({ stunde: 9, sonne, umgebung: hemi, szene, himmel });
 *   tag.update(dt, figur.position); // Zeit läuft, Licht folgt der Figur
 * @tags     welt, himmel, licht, tageszeit, sonne, mond, nebel, atmosphaere
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

import { clamp, lerp } from '../core/math.js';

// Farben in sRGB 0..1 (wie Hex-Werte im Editor). Schlüssel nach Sonnenhöhe y = sin(Höhenwinkel), von Nacht bis Mittag.
const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const S = (y, o) => ({ y, ...o, oben: hex(o.oben), horizont: hex(o.horizont), nebel: hex(o.nebel), licht: hex(o.licht), umgebungOben: hex(o.umgebungOben), umgebungUnten: hex(o.umgebungUnten) });
/** Stützstellen der Farbverläufe (nach Sonnenhöhe sortiert). Spiele dürfen eine eigene Liste per opts.schluessel geben. */
export const SCHLUESSEL = [
  S(-1.00, { oben: 0x03060f, horizont: 0x0b1220, nebel: 0x0a101c, licht: 0x7d94c8, lichtStaerke: 0.30, umgebungOben: 0x34446a, umgebungUnten: 0x0e1016, umgebungStaerke: 0.28, sterne: 1 }),
  S(-0.18, { oben: 0x050a1a, horizont: 0x111a2c, nebel: 0x0f1626, licht: 0x7d94c8, lichtStaerke: 0.30, umgebungOben: 0x3a4a70, umgebungUnten: 0x101218, umgebungStaerke: 0.30, sterne: 1 }),
  S(-0.06, { oben: 0x101a3a, horizont: 0x3a3456, nebel: 0x2a2c48, licht: 0x7d94c8, lichtStaerke: 0.04, umgebungOben: 0x5a5c8a, umgebungUnten: 0x16161e, umgebungStaerke: 0.38, sterne: 0.6 }),
  S(0.00, { oben: 0x34477e, horizont: 0xe08a5c, nebel: 0xa47a6e, licht: 0xff7a34, lichtStaerke: 0.35, umgebungOben: 0x8a8cb4, umgebungUnten: 0x2a2420, umgebungStaerke: 0.50, sterne: 0.1 }),
  S(0.12, { oben: 0x4a6aa6, horizont: 0xeeb88a, nebel: 0xcdb8a4, licht: 0xffaa66, lichtStaerke: 1.30, umgebungOben: 0xa8b8d8, umgebungUnten: 0x4a4036, umgebungStaerke: 0.85, sterne: 0 }),
  S(0.35, { oben: 0x4a80bc, horizont: 0xa9cbe6, nebel: 0x9cc4e4, licht: 0xfff1d6, lichtStaerke: 2.20, umgebungOben: 0xcfe6ff, umgebungUnten: 0x5a5040, umgebungStaerke: 1.10, sterne: 0 }),
  S(1.00, { oben: 0x3f78b8, horizont: 0xa4c8e6, nebel: 0x9cc4e4, licht: 0xfff6e6, lichtStaerke: 2.40, umgebungOben: 0xd4eaff, umgebungUnten: 0x5c5242, umgebungStaerke: 1.15, sterne: 0 }),
];
const FARBEN = ['oben', 'horizont', 'nebel', 'licht', 'umgebungOben', 'umgebungUnten'];
const ZAHLEN = ['lichtStaerke', 'umgebungStaerke', 'sterne'];

/** Uhrzeit als Text, z. B. formatUhrzeit(13.5) -> '13:30'. */
export function formatUhrzeit(stunde) {
  const m = Math.round((((stunde % 24) + 24) % 24) * 60) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

/**
 * Reine Rechnung: Zustand des Himmels zu einer Stunde (0..24).
 * opts: neigung (rad, Bahn kippt Richtung Süden = +z; 0 = Sonne geht durch den Zenit), drehung (rad um y),
 *       bewoelkung 0..1 (graut Farben ein, dämpft Sonne/Sterne), schluessel (eigene Stützstellen).
 * Ergebnis: sonnenRichtung/mondRichtung/lichtRichtung [x,y,z] (Einheitsvektoren zur Lichtquelle), sonnenHoehe (y),
 *           tag 0..1, mondLicht (bool), Farben [r,g,b] sRGB: oben, horizont, nebel, licht, umgebungOben, umgebungUnten,
 *           Zahlen: lichtStaerke, umgebungStaerke, sterne 0..1, sonnenScheibe 0..1.
 */
export function tageszeitZustand(stunde, opts = {}) {
  const neigung = opts.neigung ?? 0.6, drehung = opts.drehung ?? 0, wolken = clamp(opts.bewoelkung ?? 0, 0, 1);
  const tab = opts.schluessel || SCHLUESSEL;
  // 6 Uhr Aufgang im Osten (+x), 12 Uhr höchster Stand im Süden, 18 Uhr Untergang im Westen (−x)
  const w = ((stunde - 6) / 12) * Math.PI;
  let x = Math.cos(w), y = Math.sin(w) * Math.cos(neigung), z = Math.sin(w) * Math.sin(neigung);
  const cd = Math.cos(drehung), sd = Math.sin(drehung);
  [x, z] = [x * cd + z * sd, -x * sd + z * cd];
  const sonne = [x, y, z], mond = [-x, -y, -z];

  // Stützstellen um die Sonnenhöhe suchen und linear mischen
  let i = 0;
  while (i < tab.length - 2 && y > tab[i + 1].y) i++;
  const a = tab[i], b = tab[i + 1], t = clamp((y - a.y) / (b.y - a.y), 0, 1);
  const z0 = { sonnenRichtung: sonne, mondRichtung: mond, sonnenHoehe: y, stunde: ((stunde % 24) + 24) % 24 };
  for (const k of FARBEN) z0[k] = [lerp(a[k][0], b[k][0], t), lerp(a[k][1], b[k][1], t), lerp(a[k][2], b[k][2], t)];
  for (const k of ZAHLEN) z0[k] = lerp(a[k], b[k], t);

  // Unterhalb der Dämmerungsschwelle leuchtet der Mond (Lichtstärke ist dort fast 0 → kein sichtbarer Sprung)
  z0.mondLicht = y < -0.06;
  z0.lichtRichtung = z0.mondLicht ? mond : sonne;
  z0.tag = clamp((y + 0.06) / 0.4, 0, 1);
  z0.sonnenScheibe = clamp((y + 0.05) / 0.08, 0, 1) * (1 - wolken);

  if (wolken > 0) {
    // Bewölkung: Richtung Grau (gleiche Helligkeit, etwas dunkler), Sonne und Sterne gedämpft
    for (const k of ['oben', 'horizont', 'nebel', 'licht']) {
      const c = z0[k], l = (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) * 0.85, m = wolken * 0.8;
      z0[k] = [lerp(c[0], l, m), lerp(c[1], l * 1.02, m), lerp(c[2], l * 1.06, m)];
    }
    z0.lichtStaerke *= 1 - 0.7 * wolken;
    z0.umgebungStaerke *= 1 - 0.15 * wolken;
    z0.sterne *= 1 - wolken;
  }
  return z0;
}

/**
 * Tageszeit-Steuerung. opts: stunde (10), geschwindigkeit (Spielstunden je echter Sekunde, Standard 24/600 = 10 min
 * je Tag), laeuft (true), neigung, drehung, schluessel, bewoelkung (0),
 * Ziele (alle optional, Duck-Typing – kein THREE nötig): sonne (DirectionalLight), umgebung (HemisphereLight),
 * szene (Nebel + Hintergrund), himmel (aus sky.js: setzeZustand), lichtAbstand (120 m).
 */
export function createDayNight(opts = {}) {
  const ziele = { sonne: opts.sonne, umgebung: opts.umgebung, szene: opts.szene, himmel: opts.himmel };
  const lichtAbstand = opts.lichtAbstand ?? 120;
  const tn = {
    stunde: ((opts.stunde ?? 10) % 24 + 24) % 24,
    geschwindigkeit: opts.geschwindigkeit ?? 24 / 600,
    laeuft: opts.laeuft ?? true,
    bewoelkung: opts.bewoelkung ?? 0,
    zustand: null,
    /** Zeit weiterdrehen und anwenden. ziel {x,y,z}: Licht (Schattenkamera) folgt diesem Punkt. */
    update(dt, ziel) {
      if (tn.laeuft) tn.stunde = (tn.stunde + dt * tn.geschwindigkeit) % 24;
      tn.anwenden(ziel);
      return tn.zustand;
    },
    setStunde(h) { tn.stunde = ((h % 24) + 24) % 24; tn.anwenden(); return tn.zustand; },
    /** Zustand rechnen und auf die Ziele übertragen. */
    anwenden(ziel) {
      const z = tn.zustand = tageszeitZustand(tn.stunde, { neigung: opts.neigung, drehung: opts.drehung, schluessel: opts.schluessel, bewoelkung: tn.bewoelkung });
      const { sonne, umgebung, szene, himmel } = ziele;
      if (sonne) {
        sonne.color.setRGB(z.licht[0], z.licht[1], z.licht[2], 'srgb');
        sonne.intensity = z.lichtStaerke;
        const p = ziel || sonne.target?.position || { x: 0, y: 0, z: 0 }, r = z.lichtRichtung;
        sonne.position.set(p.x + r[0] * lichtAbstand, p.y + r[1] * lichtAbstand, p.z + r[2] * lichtAbstand);
        if (ziel && sonne.target) { sonne.target.position.set(p.x, p.y, p.z); sonne.target.updateMatrixWorld?.(); }
      }
      if (umgebung) {
        umgebung.color.setRGB(z.umgebungOben[0], z.umgebungOben[1], z.umgebungOben[2], 'srgb');
        umgebung.groundColor?.setRGB(z.umgebungUnten[0], z.umgebungUnten[1], z.umgebungUnten[2], 'srgb');
        umgebung.intensity = z.umgebungStaerke;
      }
      if (szene) {
        szene.fog?.color.setRGB(z.nebel[0], z.nebel[1], z.nebel[2], 'srgb');
        if (szene.background?.isColor) szene.background.setRGB(z.horizont[0], z.horizont[1], z.horizont[2], 'srgb');
      }
      himmel?.setzeZustand(z);
    },
    dispose() { ziele.sonne = ziele.umgebung = ziele.szene = ziele.himmel = null; },
  };
  tn.anwenden();
  return tn;
}
