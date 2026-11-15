/**
 * @modul    bau-basis
 * @zweck    Gemeinsame Farben und Helfer für Bau-Assets: lokale Kollisions-Körper, Asset-Ergebnis mit dispose
 * @api      FARBEN ; kasten(x,z,bx,bz,hoehe,{winkel,y0,begehbar}) -> koerper ; kreis(x,z,radius,hoehe,{y0,begehbar}) -> koerper ; asset(teile) -> asset
 * @beispiel
 *   import { FARBEN, kasten, asset } from '../../engine/models/bau/bau-basis.js';
 *   const kiste = asset({ name: 'kiste', geometrie, kollision: [kasten(0, 0, 0.4, 0.4, 0.8)], masse: { breite: 0.8, tiefe: 0.8, hoehe: 0.8 } });
 * @tags     bau, gebaeude, asset, farben, kollision
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
export const FARBEN = Object.freeze({ putz: '#d8cdb4', putzDunkel: '#b9ab8f', fachwerk: '#5a3d29', holz: '#8a6240', holzDunkel: '#5b3f27',
  holzHell: '#b08a5a', stein: '#9b968c', steinDunkel: '#726d65', steinHell: '#bdb7aa', dachRot: '#9a4a32', dachSchiefer: '#4e5766',
  stroh: '#c8a85a', metall: '#5d6168', eisen: '#3c3f44', gold: '#c9a23a', fenster: '#2b313a', stoffRot: '#a5332c', stoffBlau: '#2f5c8a',
  stoffGruen: '#4d7a3a', stoffGelb: '#c99a2e', glut: '#ff8a2a', flamme: '#ffc65a', licht: '#ffe3a0', wasser: '#3f7fa8', kristall: '#7fd8ff' });
export const kasten = (x, z, bx, bz, hoehe, { winkel = 0, y0 = 0, begehbar = false } = {}) =>
  ({ form: 'kasten', x, z, bx, bz, winkel, y0: y0 - 0.3, hoehe: hoehe + 0.3, begehbar });
export const kreis = (x, z, radius, hoehe, { y0 = 0, begehbar = false } = {}) =>
  ({ form: 'kreis', x, z, radius, y0: y0 - 0.3, hoehe: hoehe + 0.3, begehbar });
export function asset({ name, variante = 0, geometrie, leucht = null, kollision = [], anker = {}, masse }) {
  return { name, variante, geometrie, leucht, kollision, anker, masse,
    dreiecke: (geometrie.attributes.position.count + (leucht ? leucht.attributes.position.count : 0)) / 3,
    dispose() { geometrie.dispose(); leucht?.dispose(); } };
}
