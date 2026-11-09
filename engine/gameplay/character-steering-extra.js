/**
 * @modul    character-steering-extra
 * @zweck    Reine Steering-Rechnungen: Patrouillen-Fortschritt (Schleife/Pingpong/einmal), Umkreisen, Abstand halten, Versteckpunkt hinter Deckung
 * @api      patrouilleWeiter(anzahl,index,richtung,art) -> {index,richtung,fertig} ; umkreisRichtung(pos,mitte,radius,drehsinn,out?) -> {x,z,dist} ; abstandRichtung(pos,ziel,min,max,out?) -> {x,z,dist,stark} ; versteckPunkt(pos,bedrohung,verstecke,abstand,out?) -> {x,z}|null ; yawZu(von,nach) -> yaw
 * @beispiel
 *   import { umkreisRichtung } from '../../engine/gameplay/character-steering-extra.js';
 *   const r = umkreisRichtung(npc.pos, spieler.pos, 3, 1);
 *   absicht.x = r.x * 0.6; absicht.z = r.z * 0.6;
 * @tags     npc, ki, steering, patrouille, kampf, verstecken, gameplay
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { clamp, numOr } from '../core/math.js';

/** Blickrichtung (yaw) von → nach (x/z). */
export const yawZu = (von, nach) => Math.atan2(nach.x - von.x, nach.z - von.z);

/** Nächster Wegpunkt. art: 'schleife' | 'pingpong' | 'einmal'. richtung ±1 (für Pingpong). */
export function patrouilleWeiter(anzahl, index, richtung = 1, art = 'schleife') {
  if (anzahl <= 1) return { index: 0, richtung, fertig: art === 'einmal' };
  if (art === 'pingpong') {
    let r = richtung >= 0 ? 1 : -1, i = index + r;
    if (i >= anzahl || i < 0) { r = -r; i = index + r; }
    return { index: i, richtung: r, fertig: false };
  }
  if (art === 'einmal') return index + 1 >= anzahl ? { index, richtung, fertig: true } : { index: index + 1, richtung, fertig: false };
  return { index: (index + 1) % anzahl, richtung, fertig: false };
}

/** Laufrichtung zum Umkreisen von `mitte` im Abstand `radius` (drehsinn +1 = gegen den Uhrzeigersinn von oben). */
export function umkreisRichtung(pos, mitte, radius, drehsinn = 1, out = { x: 0, z: 0, dist: 0 }) {
  const dx = pos.x - mitte.x, dz = pos.z - mitte.z, d = Math.hypot(dx, dz);
  out.dist = d;
  if (d < 1e-6) { out.x = drehsinn >= 0 ? 1 : -1; out.z = 0; return out; }
  const ux = dx / d, uz = dz / d;                       // radial nach außen
  const tx = -uz * drehsinn, tz = ux * drehsinn;        // tangential
  const fehler = clamp((radius - d) / Math.max(0.5, radius * 0.5), -1, 1); // + = zu nah → nach außen
  let x = tx + ux * fehler * 1.2, z = tz + uz * fehler * 1.2;
  const l = Math.hypot(x, z) || 1; out.x = x / l; out.z = z / l;
  return out;
}

/** Richtung, um zwischen min und max Abstand zu bleiben. stark 0…1 (0 = im Band, stehen bleiben). */
export function abstandRichtung(pos, ziel, min, max, out = { x: 0, z: 0, dist: 0, stark: 0 }) {
  const dx = ziel.x - pos.x, dz = ziel.z - pos.z, d = Math.hypot(dx, dz);
  out.dist = d; out.x = 0; out.z = 0; out.stark = 0;
  if (d < 1e-6) { out.x = 1; out.stark = 1; return out; }
  const ux = dx / d, uz = dz / d;
  if (d < min) { out.x = -ux; out.z = -uz; out.stark = clamp((min - d) / Math.max(0.5, min * 0.5), 0.3, 1); }
  else if (d > max) { out.x = ux; out.z = uz; out.stark = clamp((d - max) / 2, 0.3, 1); }
  return out;
}

/**
 * Versteckpunkt: hinter der Deckung (verstecke: [{x,z,radius?}]) von der Bedrohung aus gesehen.
 * Bevorzugt nahe Deckungen, die nicht näher an der Bedrohung liegen als man selbst.
 */
export function versteckPunkt(pos, bedrohung, verstecke, abstand = 1, out = { x: 0, z: 0 }) {
  if (!verstecke || !verstecke.length || !bedrohung) return null;
  let best = Infinity, bx = 0, bz = 0;
  const dichSelbst = Math.hypot(pos.x - bedrohung.x, pos.z - bedrohung.z);
  for (const v of verstecke) {
    const vx = numOr(v?.x, NaN), vz = numOr(v?.z, NaN);
    if (!Number.isFinite(vx + vz)) continue;
    const dx = vx - bedrohung.x, dz = vz - bedrohung.z, d = Math.hypot(dx, dz) || 1e-6;
    const hinter = numOr(v.radius, 0.5) + abstand;
    const px = vx + dx / d * hinter, pz = vz + dz / d * hinter;
    let kosten = Math.hypot(px - pos.x, pz - pos.z);
    if (d < dichSelbst * 0.5) kosten += 20;                // Deckung liegt Richtung Bedrohung → schlecht
    if (kosten < best) { best = kosten; bx = px; bz = pz; }
  }
  if (best === Infinity) return null;
  out.x = bx; out.z = bz;
  return out;
}
