/**
 * @modul    ziel-wahl
 * @zweck    Lock-On-Ziel auswählen: bestes Ziel vor der Figur (Winkel + Abstand) oder nächstes Ziel links/rechts vom aktuellen (Ziel wechseln)
 * @api      waehleZiel(kandidaten, { von, blickYaw, aktuell, richtung, maxDistanz, maxWinkel, gewichtWinkel }) -> kandidat | null ; zielPos(k) -> {x, y, z} | null
 * @beispiel
 *   import { waehleZiel } from '../../engine/camera/ziel-wahl.js';
 *   let ziel = waehleZiel(npcs, { von: held.zustand.pos, blickYaw: cam.yaw });            // bestes Ziel vorn
 *   ziel = waehleZiel(npcs, { von: held.zustand.pos, blickYaw: cam.yaw, aktuell: ziel, richtung: 1 }); // nächstes rechts
 *   cam.lockOn(ziel ? () => zielPos(ziel) : null);
 * @tags     kamera, lock-on, ziel, zielen, auswahl, kampf
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { angleDiff, numOr } from '../core/math.js';

/** Position eines Kandidaten: {x,y,z} direkt, .pos, .zustand.pos (Figur), .position (Object3D) oder Funktion. */
export function zielPos(k) {
  if (!k) return null;
  const p = typeof k === 'function' ? k() : k.zustand?.pos || k.pos || (k.isObject3D ? k.position : k);
  if (!p || !Number.isFinite(+p.x) || !Number.isFinite(+p.z)) return null;
  return { x: +p.x, y: numOr(p.y, 0), z: +p.z };
}

/**
 * richtung 0: Ziel mit kleinster Wertung (Winkel zur Blickrichtung · gewichtWinkel + Abstand) innerhalb maxWinkel.
 * richtung +1 / −1: vom aktuellen Ziel aus das winkelmäßig nächste rechts / links (läuft im Kreis herum).
 * Kandidaten außerhalb maxDistanz (oder ohne gültige Position) werden ignoriert.
 */
export function waehleZiel(kandidaten, {
  von, blickYaw = 0, aktuell = null, richtung = 0, maxDistanz = 20, maxWinkel = 1.3, gewichtWinkel = 6,
} = {}) {
  const v = zielPos(von) || { x: 0, z: 0 };
  const liste = [];
  for (const k of kandidaten || []) {
    if (k === von) continue;
    const p = zielPos(k);
    if (!p) continue;
    const dx = p.x - v.x, dz = p.z - v.z, d = Math.hypot(dx, dz);
    if (d > maxDistanz || d < 1e-6) continue;
    // Winkel relativ zum Blick; + = rechts (yaw wächst nach links, siehe stickRichtung)
    liste.push({ k, d, w: -angleDiff(numOr(blickYaw, 0), Math.atan2(dx, dz)) });
  }
  if (!liste.length) return null;
  if (!richtung || !aktuell || !liste.some(e => e.k === aktuell)) {
    let best = null, bw = Infinity;
    for (const e of liste) {
      if (Math.abs(e.w) > maxWinkel) continue;
      const wert = Math.abs(e.w) * gewichtWinkel + e.d;
      if (wert < bw) { bw = wert; best = e; }
    }
    if (best || richtung === 0) return best ? best.k : null;
    // Wechselwunsch ohne gültiges aktuelles Ziel: nächstes in Wunschrichtung
    liste.sort((a, b) => Math.sign(richtung) * (a.w - b.w));
    return liste[0].k;
  }
  const a = liste.find(e => e.k === aktuell);
  const s = Math.sign(richtung);
  let best = null, bw = Infinity;
  for (const e of liste) {
    if (e === a) continue;
    let dw = (e.w - a.w) * s;                    // > 0 = in Wunschrichtung
    if (dw <= 1e-6) dw += Math.PI * 2;           // im Kreis herum
    if (dw < bw) { bw = dw; best = e; }
  }
  return best ? best.k : aktuell;
}
