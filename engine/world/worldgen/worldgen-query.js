/**
 * @modul    worldgen-query
 * @zweck    Abfragen auf einer erzeugten Welt (Weltkoordinaten): Höhe bilinear, Hang, Normale, Biom, Wasser; hängt Methoden auch an Welt-Daten aus einem Worker an
 * @api      heightAt(welt,x,y) -> number ; slopeAt(welt,x,y) -> number ; normalAt(welt,x,y,aus?) -> [nx,ny,nz] ; biomeAt(welt,x,y) -> id ; isWater(welt,x,y) -> bool ; waterDepthAt(welt,x,y) -> number ; mitAbfragen(welt) -> welt
 * @beispiel
 *   import { mitAbfragen } from '../../engine/world/worldgen/worldgen-query.js';
 *   const welt = mitAbfragen(datenAusWorker);
 *   const y = welt.heightAt(10.5, 20.25), n = welt.normalAt(10.5, 20.25);
 * @tags     welt, worldgen, abfrage, hoehe, normale, biome
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { bilinear, WASSER } from './worldgen-grid.js';

function zellIndex(welt, x, y) {
  const { breite: b, tiefe: t, zelle: z } = welt;
  let ix = Math.round(x / z), iy = Math.round(y / z);
  if (ix < 0) ix = 0; else if (ix >= b) ix = b - 1;
  if (iy < 0) iy = 0; else if (iy >= t) iy = t - 1;
  return iy * b + ix;
}

/** Geländehöhe an (x,y) in Weltkoordinaten (bilinear, am Rand geklemmt). */
export function heightAt(welt, x, y) {
  return bilinear(welt.hoehe, welt.breite, welt.tiefe, x / welt.zelle, y / welt.zelle);
}

/** Steigung (Höhenänderung pro Welteinheit) an (x,y). */
export function slopeAt(welt, x, y) {
  const e = welt.zelle;
  const gx = (heightAt(welt, x + e, y) - heightAt(welt, x - e, y)) / (2 * e);
  const gy = (heightAt(welt, x, y + e) - heightAt(welt, x, y - e)) / (2 * e);
  return Math.sqrt(gx * gx + gy * gy);
}

/** Flächennormale (Y nach oben, Kartenkoordinate y → Welt-z), normiert. aus: optionales Array zum Wiederverwenden. */
export function normalAt(welt, x, y, aus = [0, 1, 0]) {
  const e = welt.zelle;
  const gx = (heightAt(welt, x + e, y) - heightAt(welt, x - e, y)) / (2 * e);
  const gz = (heightAt(welt, x, y + e) - heightAt(welt, x, y - e)) / (2 * e);
  const l = Math.sqrt(gx * gx + 1 + gz * gz);
  aus[0] = -gx / l; aus[1] = 1 / l; aus[2] = -gz / l;
  return aus;
}

/** Biom-Id der nächsten Zelle. */
export function biomeAt(welt, x, y) { return welt.biom[zellIndex(welt, x, y)]; }

/** Liegt (x,y) in Meer, See oder Fluss? */
export function isWater(welt, x, y) { return (welt.flags[zellIndex(welt, x, y)] & WASSER) !== 0; }

/** Wassertiefe an (x,y) (0 an Land). */
export function waterDepthAt(welt, x, y) {
  const i = zellIndex(welt, x, y);
  if (!(welt.flags[i] & WASSER)) return 0;
  const d = welt.wasserstand[i] - heightAt(welt, x, y);
  return d > 0 ? d : 0;
}

/** Hängt die Abfragen als Methoden an (z. B. nach dem Empfang aus einem Web Worker). */
export function mitAbfragen(welt) {
  welt.heightAt = (x, y) => heightAt(welt, x, y);
  welt.slopeAt = (x, y) => slopeAt(welt, x, y);
  welt.normalAt = (x, y, aus) => normalAt(welt, x, y, aus);
  welt.biomeAt = (x, y) => biomeAt(welt, x, y);
  welt.isWater = (x, y) => isWater(welt, x, y);
  welt.waterDepthAt = (x, y) => waterDepthAt(welt, x, y);
  return welt;
}
