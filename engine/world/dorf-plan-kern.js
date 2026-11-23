/**
 * @modul    dorf-plan-kern
 * @zweck    Handgesetzter Kern des Dorfes Erlenwacht (Platz, Taverne, Tempel, Schmiede …) relativ zur Dorfmitte + Standard-Maße (ohne THREE)
 * @api      STANDARD_MASSE ; PLATZ_RADIUS ; kernSpezifikation() -> [{id, typ, dx, dz, w | blick:[dx,dz]}] ; ostGasse() / westGasse() -> [[dx,dz]…] ; BRUECKE_DX
 * @beispiel
 *   import { kernSpezifikation } from './dorf-plan-kern.js';
 * @tags     dorf, plan, erlenwacht, kern
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
export const PLATZ_RADIUS = 16;
export const BRUECKE_DX = 110;

/** Maße (Breite = lokal x, Tiefe = lokal z) in m; haus hat zwei Varianten. */
export const STANDARD_MASSE = {
  haus: [{ breite: 6, tiefe: 5 }, { breite: 7, tiefe: 6 }], taverne: { breite: 10, tiefe: 8 }, schmiede: { breite: 8, tiefe: 7 },
  tempel: { breite: 9, tiefe: 12 }, wachturm: { breite: 4, tiefe: 4 }, marktstand: { breite: 3, tiefe: 2 }, brunnen: { breite: 2, tiefe: 2 },
  bank: { breite: 1.8, tiefe: 0.5 }, laterne: { breite: 0.4, tiefe: 0.4 }, zaun: { breite: 2, tiefe: 0.1 }, lagerfeuer: { breite: 1.3, tiefe: 1.3 },
  anschlagbrett: { breite: 1.6, tiefe: 0.6 }, schrein: { breite: 1, tiefe: 1 }, beet: { breite: 3, tiefe: 1.5 }, trainingspuppe: { breite: 0.6, tiefe: 0.6 },
  fass: { breite: 0.9, tiefe: 0.9 }, kiste: { breite: 1, tiefe: 0.8 }, holzstapel: { breite: 1.6, tiefe: 0.8 }, karren: { breite: 1.4, tiefe: 2.2 },
  heuhaufen: { breite: 2, tiefe: 2 }, banner: { breite: 0.5, tiefe: 0.5 }, wegweiser: { breite: 0.5, tiefe: 0.4 }, palisade: { breite: 3, tiefe: 0.4 },
  bruecke: { breite: 3, tiefe: 10 }, zielscheibe: { breite: 1.2, tiefe: 0.3 },
};

const gradW = (g) => (g * Math.PI) / 180;
const polar = (r, g) => [r * Math.cos(gradW(g)), r * Math.sin(gradW(g))];
const MITTE = [0, 0];

/** Kern relativ zur Mitte (+x Osten, +z Süden). `blick` = Ziel, zu dem die Vorderseite zeigt; `w` = fester Winkel. */
export function kernSpezifikation() {
  const k = [];
  const add = (typ, dx, dz, o = {}) => k.push({ id: o.id, typ, dx, dz, ...o });
  add('brunnen', 0, 0, { w: 0 });
  add('lagerfeuer', 6, 0, { w: 0 });
  for (const g of [-100, 0, 100]) { const [x, z] = polar(2.9, g); add('bank', 6 + x, z, { blick: [6, 0] }); }
  add('anschlagbrett', -0.5, -14, { blick: MITTE });
  add('schrein', -4.5, -13, { blick: MITTE });
  for (const g of [185, 205, 225]) { const [x, z] = polar(13.4, g); add('marktstand', x, z, { blick: MITTE }); }
  add('banner', 2.5, -15.5, { blick: MITTE }); add('banner', 3, 15.5, { blick: MITTE });
  for (const g of [45, 135, 225, 315]) { const [x, z] = polar(15, g); add('laterne', x, z, { w: 0 }); }
  add('taverne', 21.5, -6, { w: -Math.PI / 2 });
  add('schmiede', 8.5, 27, { w: -Math.PI / 2 });
  add('tempel', -26, -19, { blick: MITTE });
  add('wegweiser', 16.5, 3.6, { w: -Math.PI / 2 });
  add('trainingspuppe', -14, 76, { w: Math.PI / 2 }); add('trainingspuppe', -17.5, 76, { w: Math.PI / 2 });
  return k;
}

/** Gassen relativ zur Mitte (Rohpunkte; der Plan wackelt sie per Seed leicht). */
export const ostGasse = () => [[14, 8], [34, 11], [58, 8], [82, 4], [105, 4]];
export const westGasse = () => [[-9, 13], [-27, 31], [-47, 49], [-68, 70]];
