/**
 * @modul    wege-lage
 * @zweck    Lage der Brücken einer Welt in Metern (Mitte, Richtung, Länge, Höhe an beiden Enden) und ein Adapter, auf dem Figuren über die Brücken laufen statt durch den Fluss
 * @api      brueckenLagen(adapter, opts) -> [{x,z,y1,y2,laenge,breite,winkel,rx,rz}] ; deckHoehe(lage, x, z) -> number|null ; mitBruecken(adapter, lagen) -> adapter
 * @beispiel
 *   import { brueckenLagen, mitBruecken } from '../../engine/world/wege-lage.js';
 *   const lagen = brueckenLagen(adapter, { breite: 2.4 });
 *   const begehbar = mitBruecken(adapter, lagen);   // bodenHoehe liefert auf der Brücke die Deckhöhe
 * @tags     welt, wege, bruecke, adapter, boden, figur
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

/**
 * opts: { breite (2.4 m), ueberstand (1.2 m je Seite aufs Ufer), freiraum (0.5 m über dem Wasser) }
 * Lage: Mitte x/z, Richtung rx/rz (Länge 1) von Ende 1 nach Ende 2, winkel = Drehung um Y, y1/y2 = Deckhöhe an den Enden.
 */
export function brueckenLagen(adapter, opts = {}) {
  const breite = opts.breite ?? 2.4, ueber = opts.ueberstand ?? 1.2, frei = opts.freiraum ?? 0.5;
  const m = adapter.meterProZelle, lagen = [];
  for (const w of adapter.welt.wege || []) for (const br of w.bruecken) {
    const p = adapter.zuWelt(br.x, br.y), rx = br.dx, rz = br.dy;
    const laenge = br.laenge * m + 2 * ueber, h = laenge / 2;
    // höchster Wasserspiegel unter der Brücke
    let wasser = -Infinity;
    for (let s = -h; s <= h; s += m / 2) { const wh = adapter.wasserHoehe(p.x + rx * s, p.z + rz * s); if (wh != null && wh > wasser) wasser = wh; }
    const unten = wasser + frei;
    const y1 = Math.max(adapter.bodenHoehe(p.x - rx * h, p.z - rz * h), unten) + 0.05;
    const y2 = Math.max(adapter.bodenHoehe(p.x + rx * h, p.z + rz * h), unten) + 0.05;
    lagen.push({ x: p.x, z: p.z, y1, y2, laenge, breite, winkel: Math.atan2(rx, rz), rx, rz });
  }
  return lagen;
}

/** Deckhöhe der Brücke an (x, z) oder null, wenn der Punkt nicht auf ihr liegt. */
export function deckHoehe(l, x, z) {
  const dx = x - l.x, dz = z - l.z;
  const laengs = dx * l.rx + dz * l.rz;
  if (laengs < -l.laenge / 2 || laengs > l.laenge / 2) return null;
  if (Math.abs(dx * l.rz - dz * l.rx) > l.breite / 2) return null;
  return l.y1 + (laengs / l.laenge + 0.5) * (l.y2 - l.y1);
}

/**
 * Adapter mit begehbaren Brücken: bodenHoehe = Deck (wenn höher als der Boden), wasserHoehe dort null.
 * Alle anderen Felder bleiben wie beim Original. Ohne Brücken kommt der Adapter unverändert zurück.
 */
export function mitBruecken(adapter, lagen) {
  if (!lagen.length) return adapter;
  const deck = (x, z) => {
    for (const l of lagen) { const y = deckHoehe(l, x, z); if (y !== null) return y; }
    return null;
  };
  return {
    ...adapter,
    bodenHoehe(x, z) { const b = adapter.bodenHoehe(x, z), d = deck(x, z); return d !== null && d > b ? d : b; },
    wasserHoehe(x, z) { return deck(x, z) !== null ? null : adapter.wasserHoehe(x, z); },
    startPunkt: () => adapter.startPunkt(),
  };
}
