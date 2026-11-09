/**
 * @modul    character-rig
 * @zweck    Prozedurales Skelett einer Menschen-Figur aus Gruppen (keine Skinning-Knochen): feste Gelenknamen, Ruhepose, Sockel für Hut/Waffe/Rucksack
 * @api      KNOCHEN ; SOCKEL ; createRig(masse) -> { root, knochen, sockel, masse, anpassen(masse), ruhepose(), dispose() }
 * @beispiel
 *   import { createRig } from '../../engine/models/character/character-rig.js';
 *   const rig = createRig(koerperMasse(look));
 *   rig.knochen.schulterR.rotation.x = -0.8;   // rechten Arm nach vorn heben
 *   rig.sockel.handR.add(schwert);
 * @tags     figur, charakter, skelett, rig, gelenke, animation, sockel
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';

/**
 * Gelenke (Eltern zuerst). Ursprung jeweils im Gelenk, Gliedmaßen hängen in Ruhe entlang −Y.
 * Links = +X (Figur blickt nach +Z). Drehsinn (rotation.x):
 *   huefte −  = Bein nach vorn      knie +    = beugen (Unterschenkel nach hinten)
 *   schulter − = Arm nach vorn      ellbogen − = beugen (Unterarm nach vorn)
 *   torso/hals/kopf + = nach vorn neigen        fuss + = Zehen hoch
 *   schulterL.rotation.z + / schulterR.rotation.z − = Arm seitlich abspreizen
 */
export const KNOCHEN = [
  'basis', 'becken', 'torso', 'hals', 'kopf',
  'schulterL', 'ellbogenL', 'handL', 'schulterR', 'ellbogenR', 'handR',
  'huefteL', 'knieL', 'fussL', 'huefteR', 'knieR', 'fussR',
];
const ELTERN = {
  basis: null, becken: 'basis', torso: 'becken', hals: 'torso', kopf: 'hals',
  schulterL: 'torso', ellbogenL: 'schulterL', handL: 'ellbogenL',
  schulterR: 'torso', ellbogenR: 'schulterR', handR: 'ellbogenR',
  huefteL: 'becken', knieL: 'huefteL', fussL: 'knieL',
  huefteR: 'becken', knieR: 'huefteR', fussR: 'knieR',
};
/** Befestigungspunkte: handR/handL (Griff, Klinge +Y→ nach Drehung vorn), kopf (Scheitel), ruecken, guertel, umhang (Nacken hinten). */
export const SOCKEL = { handR: 'handR', handL: 'handL', kopf: 'kopf', ruecken: 'torso', guertel: 'becken', umhang: 'torso' };

function positionen(m) {
  return {
    basis: [0, 0, 0],
    becken: [0, m.hueftHoehe, 0],
    torso: [0, m.torsoAbstand, 0],
    hals: [0, m.torsoLaenge, 0],
    kopf: [0, m.halsLaenge, 0],
    schulterL: [m.schulterX, m.schulterY, 0], ellbogenL: [0, -m.oberarm, 0], handL: [0, -m.unterarm, 0],
    schulterR: [-m.schulterX, m.schulterY, 0], ellbogenR: [0, -m.oberarm, 0], handR: [0, -m.unterarm, 0],
    huefteL: [m.beckenBreite, -0.02 * (m.hoehe / 1.75), 0], knieL: [0, -m.oberschenkel, 0], fussL: [0, -m.unterschenkel, 0],
    huefteR: [-m.beckenBreite, -0.02 * (m.hoehe / 1.75), 0], knieR: [0, -m.oberschenkel, 0], fussR: [0, -m.unterschenkel, 0],
  };
}
function sockelPositionen(m) {
  const tiefe = 0.13 * m.breite * (m.hoehe / 1.75);
  return {
    handR: [0, -m.hand * 0.55, 0], handL: [0, -m.hand * 0.55, 0],
    kopf: [0, m.kopfRadius * 2, 0],
    ruecken: [0, m.torsoLaenge * 0.55, -tiefe],
    guertel: [0, 0.06 * (m.hoehe / 1.75), 0],
    umhang: [0, m.torsoLaenge - 0.03, -tiefe * 0.85],
  };
}

/**
 * Baut das Skelett. masse aus koerperMasse(look).
 * → { root, knochen: {name: Group}, sockel: {name: Group}, masse, anpassen(masse), ruhepose(), dispose() }
 * root = äußerste Gruppe (in die Szene hängen, Position/Drehung setzt der Spielcode); basis = Körper-Pivot an den Füßen
 * (Animation darf basis verschieben/neigen, z. B. Wippen, Ducken, Seitlehnen).
 */
export function createRig(masse) {
  const root = new THREE.Group();
  root.name = 'figur';
  const knochen = {};
  for (const n of KNOCHEN) {
    const g = new THREE.Group();
    g.name = n;
    knochen[n] = g;
    (ELTERN[n] ? knochen[ELTERN[n]] : root).add(g);
  }
  const sockel = {};
  for (const [n, k] of Object.entries(SOCKEL)) {
    const g = new THREE.Group();
    g.name = 'sockel_' + n;
    knochen[k].add(g);
    sockel[n] = g;
  }
  const rig = { root, knochen, sockel, masse };

  rig.anpassen = (m) => {
    rig.masse = m;
    const p = positionen(m), s = sockelPositionen(m);
    for (const n of KNOCHEN) knochen[n].position.set(...p[n]);
    for (const n of Object.keys(SOCKEL)) sockel[n].position.set(...s[n]);
    return rig;
  };
  rig.ruhepose = () => {
    for (const n of KNOCHEN) { knochen[n].rotation.set(0, 0, 0); knochen[n].scale.set(1, 1, 1); }
    knochen.basis.position.set(0, 0, 0);
    return rig;
  };
  rig.dispose = () => { root.removeFromParent(); };
  return rig.anpassen(masse);
}
