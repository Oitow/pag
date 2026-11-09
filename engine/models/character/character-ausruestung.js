/**
 * @modul    character-ausruestung
 * @zweck    Low-Poly-Gegenstände für Figuren-Sockel (Schwert, Dolch, Axt, Hammer, Hacke, Schaufel, Speer, Stab, Zauberstab, Schild, Bogen, Fackel, Laterne, Korb, Becher, Buch): je ein Mesh + optional Leucht-Mesh, passend ausgerichtet für model.befestigen(sockel, obj)
 * @api      AUSRUESTUNG ; ausruestungsNamen ; createAusruestung(name, opts) -> THREE.Group (+ dispose()) ; baueAusruestung(b, name, farben, glut?) -> b ; ausruestungAusrichten(obj, sockel) -> obj
 * @beispiel
 *   import { createAusruestung } from '../../engine/models/character/character-ausruestung.js';
 *   const schwert = createAusruestung('schwert', { seed: 3 });
 *   figur.befestigen('handR', schwert);
 *   figur.befestigen('handL', createAusruestung('schild', { sockel: 'handL', farbe: '#2a4a8a' }));
 *   const fackel = createAusruestung('fackel'); licht.position.copy(fackel.userData.lichtPunkt); fackel.add(licht);
 * @tags     figur, charakter, ausrüstung, waffe, werkzeug, schwert, axt, schild, bogen, fackel, laterne, korb, sockel
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 *
 * Gegenstand-Raum: Griffpunkt im Ursprung, Längsachse +Y, „vorn“ (Schneide, Schildfläche, Bogenbauch) +Z.
 * Ausrichtung je Sockel (Hand-Raum: Arm hängt nach −Y, Daumen +Z):
 *   halt 'vorn' (Waffen, Werkzeug): +Y → +Z der Hand (Arm hängt: zeigt nach vorn; Arm vorgestreckt: zeigt nach oben)
 *   halt 'schraeg' (Fackel): schräg nach vorn-oben · 'aufrecht' (Stab, Speer): senkrecht, vor die Faust versetzt
 *   halt 'seite' (Schild): Fläche nach außen (handL → +X, handR → −X) · 'haengend' (Laterne, Korb, Becher): hängt nach −Y
 *   ruecken/umhang: schräg über den Rücken (Griff oben) · guertel: an der linken Hüfte, Spitze nach unten · kopf: unverändert
 */
import * as THREE from 'three';
import { createMeshBuilder, standardMaterial } from '../../render/mesh-builder.js';
import { farbeZahl } from './character-look.js';
import { dunkler, heller, GOLD } from './character-parts-basis.js';

const PI = Math.PI;

/** Bau-Funktionen im Gegenstand-Raum (Meter, Erwachsenen-Maßstab). F = Farben, gl = Builder für Leuchtendes. */
const BAU = {
  schwert(b, F) {
    b.box(0.05, 0.66, 0.012, F.metall, { y: 0.41 }).cone(0.025, 0.1, F.metall, { y: 0.79, sz: 0.25 }, 4);
    b.box(0.012, 0.6, 0.016, dunkler(F.metall, 0.2), { y: 0.4 });                                   // Hohlkehle
    b.box(0.2, 0.025, 0.04, F.akzent, { y: 0.075 }).cyl(0.017, 0.015, 0.15, F.leder, { y: -0.01 }, 6);
    b.sphere(0.028, F.akzent, { y: -0.095 }, 6, 4);
  },
  dolch(b, F) {
    b.box(0.035, 0.2, 0.01, F.metall, { y: 0.15 }).cone(0.018, 0.06, F.metall, { y: 0.28, sz: 0.3 }, 4);
    b.box(0.09, 0.02, 0.03, F.akzent, { y: 0.045 }).cyl(0.014, 0.013, 0.09, F.leder, { y: -0.005 }, 6);
    b.sphere(0.018, F.akzent, { y: -0.055 }, 5, 3);
  },
  axt(b, F) {
    b.cyl(0.02, 0.023, 0.75, F.holz, { y: 0.2 }, 6);
    b.box(0.03, 0.14, 0.12, F.metall, { y: 0.48, z: 0.06 }).box(0.022, 0.2, 0.05, heller(F.metall, 0.2), { y: 0.48, z: 0.14 });
    b.box(0.035, 0.06, 0.06, dunkler(F.metall, 0.2), { y: 0.48, z: -0.03 });
  },
  hammer(b, F) {
    b.cyl(0.02, 0.023, 0.6, F.holz, { y: 0.15 }, 6);
    b.box(0.07, 0.08, 0.2, F.metall, { y: 0.47 }).box(0.075, 0.085, 0.03, dunkler(F.metall, 0.2), { y: 0.47, z: 0.09 });
  },
  hacke(b, F) {
    b.cyl(0.02, 0.023, 0.95, F.holz, { y: 0.3 }, 6);
    b.box(0.07, 0.04, 0.05, F.metall, { y: 0.74 }).box(0.08, 0.025, 0.2, F.metall, { y: 0.71, z: 0.11, rx: 0.35 });
  },
  schaufel(b, F) {
    b.cyl(0.02, 0.022, 0.95, F.holz, { y: 0.3 }, 6).torus(0.04, 0.012, F.holz, { y: -0.2 }, 3, 8);
    b.box(0.2, 0.26, 0.02, F.metall, { y: 0.9 }).cone(0.1, 0.06, F.metall, { y: 1.06, rz: PI, sz: 0.1, ry: PI / 4 }, 4);
  },
  speer(b, F) {
    b.cyl(0.018, 0.02, 1.8, F.holz, { y: 0.3 }, 6);
    b.cone(0.035, 0.22, F.metall, { y: 1.31, sz: 0.3 }, 4).cyl(0.022, 0.022, 0.05, F.leder, { y: 1.18 }, 6);
  },
  stab(b, F) {
    b.cyl(0.022, 0.026, 1.6, F.holz, { y: 0.2, jitter: 0.12 }, 6);
    b.ico(0.05, dunkler(F.holz, 0.15), { y: 1.02, sy: 1.2 }, 0).cyl(0.026, 0.026, 0.12, F.leder, { y: 0 }, 6);
  },
  zauberstab(b, F, gl) {
    b.cyl(0.01, 0.014, 0.36, F.holz, { y: 0.1 }, 5).torus(0.022, 0.006, F.akzent, { y: 0.29, rx: PI / 2 }, 3, 8);
    gl.ico(0.028, F.stein, { y: 0.31 }, 0);
  },
  schild(b, F) {
    b.cyl(0.3, 0.3, 0.035, F.farbe, { z: 0.03, rx: PI / 2 }, 14).torus(0.3, 0.018, F.metall, { z: 0.03 }, 3, 14);
    b.sphere(0.06, F.metall, { z: 0.05, sz: 0.6 }, 7, 4);
    for (const r of [0, PI / 2]) b.box(0.04, 0.56, 0.012, F.akzent, { z: 0.05, rz: r });
    b.box(0.025, 0.13, 0.03, F.leder, { z: 0.0 });                                                // Griff
  },
  bogen(b, F) {
    const r = 0.6, bog = 1.9;
    b.torus(r, 0.016, F.holz, { z: -r, rz: -bog / 2, ry: -PI / 2 }, 4, 12, bog);
    b.cyl(0.004, 0.004, 2 * r * Math.sin(bog / 2), 0xe8e0c8, { z: -r + r * Math.cos(bog / 2) }, 3);   // Sehne
    b.cyl(0.022, 0.022, 0.12, F.leder, {}, 6);
  },
  fackel(b, F, gl) {
    b.cyl(0.025, 0.018, 0.5, F.holz, { y: 0.1 }, 6).cyl(0.04, 0.032, 0.08, dunkler(F.leder, 0.3), { y: 0.36, jitter: 0.15 }, 7);
    gl.cone(0.05, 0.16, 0xffb030, { y: 0.47 }, 6).cone(0.028, 0.1, 0xfff0a0, { y: 0.46 }, 5);
  },
  laterne(b, F, gl) {
    b.torus(0.03, 0.006, F.metall, { y: -0.03 }, 3, 8, PI).cone(0.075, 0.06, F.metall, { y: -0.07 }, 4);
    for (let i = 0; i < 4; i++) b.box(0.008, 0.12, 0.008, F.metall, { x: Math.sin(i * PI / 2 + PI / 4) * 0.05, y: -0.16, z: Math.cos(i * PI / 2 + PI / 4) * 0.05 });
    b.box(0.1, 0.02, 0.1, F.metall, { y: -0.23 });
    gl.box(0.07, 0.11, 0.07, 0xffd070, { y: -0.16 });
  },
  korb(b, F) {
    b.torus(0.13, 0.012, F.holz, { y: -0.05 }, 3, 10, PI).cyl(0.17, 0.13, 0.16, F.holz, { y: -0.27, jitter: 0.2 }, 10);
    b.cyl(0.175, 0.175, 0.025, dunkler(F.holz, 0.2), { y: -0.19 }, 10).cyl(0.16, 0.16, 0.02, dunkler(F.holz, 0.35), { y: -0.2 }, 10);
  },
  becher(b, F) {
    b.lathe([[0, -0.045], [0.032, -0.045], [0.036, 0.05], [0.032, 0.05], [0.028, -0.035], [0, -0.035]], F.farbe, { z: 0.05 }, 9);
    b.torus(0.025, 0.007, F.farbe, { z: 0.015, y: 0.005, ry: PI / 2, rz: PI / 2 }, 3, 6, PI);
  },
  buch(b, F) {
    b.box(0.16, 0.22, 0.045, F.farbe, { z: 0.04 }).box(0.15, 0.21, 0.04, 0xf0e8d0, { z: 0.04, x: 0.006 });
    b.box(0.03, 0.04, 0.05, F.akzent, { x: 0.06, z: 0.04 });
  },
};

/** Gegenstands-Liste: halt (Ausrichtung in der Hand), flach (auf dem Rücken quer legen), farbe/akzent-Vorgaben. */
export const AUSRUESTUNG = Object.freeze({
  schwert: { halt: 'vorn' }, dolch: { halt: 'vorn' }, axt: { halt: 'vorn' }, hammer: { halt: 'vorn' },
  hacke: { halt: 'vorn' }, schaufel: { halt: 'vorn' }, speer: { halt: 'aufrecht' }, stab: { halt: 'aufrecht' },
  zauberstab: { halt: 'vorn', licht: [0, 0.31, 0] }, schild: { halt: 'seite', farbe: 0x8a2a24 }, bogen: { halt: 'vorn', flach: true },
  fackel: { halt: 'schraeg', licht: [0, 0.5, 0] }, laterne: { halt: 'haengend', licht: [0, -0.16, 0] }, korb: { halt: 'haengend' },
  becher: { halt: 'haengend', farbe: 0x9a8a70 }, buch: { halt: 'haengend', farbe: 0x6a2a24 },
});
export const ausruestungsNamen = Object.freeze(Object.keys(AUSRUESTUNG));

const z = (f, e) => farbeZahl(f) ?? e;

/** Gegenstand in einen mesh-builder bauen (Gegenstand-Raum). farben: { farbe, akzent, metall, holz, leder, stein }; glut = Builder für Leuchtendes (Standard: b). */
export function baueAusruestung(b, name, farben = {}, glut = b) {
  const d = AUSRUESTUNG[name];
  if (!d) throw new Error(`Unbekannte Ausrüstung: ${name}`);
  const F = {
    farbe: z(farben.farbe, d.farbe ?? 0x8a6238), akzent: z(farben.akzent, GOLD), metall: z(farben.metall, 0xb8bcc4),
    holz: z(farben.holz, 0x8a6238), leder: z(farben.leder, 0x5a3a24), stein: z(farben.stein, 0x60d0ff),
  };
  BAU[name](b, F, glut);
  return b;
}

/** Drehung/Versatz der inneren Gruppe je Sockel (siehe Modulkopf). */
function lage(d, sockel) {
  if (sockel === 'handR' || sockel === 'handL') {
    const s = sockel === 'handL' ? 1 : -1;
    return {
      vorn: { rx: PI / 2 }, schraeg: { rx: 0.9 }, aufrecht: { z: 0.045 }, haengend: {},
      seite: { ry: s * PI / 2, x: s * 0.04 },
    }[d.halt];
  }
  if (sockel === 'ruecken' || sockel === 'umhang') {
    if (d.halt === 'seite') return { ry: PI, z: -0.04 };
    if (d.halt === 'haengend') return { z: -0.06, y: 0.1 };
    return { rz: PI - 0.6, ry: d.flach ? PI / 2 : 0, y: 0.2, x: -0.12, z: -0.04 };
  }
  if (sockel === 'guertel') return d.halt === 'haengend' || d.halt === 'seite' ? { x: 0.17, y: -0.02, ry: PI / 2 } : { rx: PI + 0.25, x: 0.17, y: 0.04, z: 0.02 };
  return {};
}

/** Gegenstand (Gruppe aus createAusruestung) für einen anderen Sockel neu ausrichten. */
export function ausruestungAusrichten(obj, sockel) {
  const halter = obj.getObjectByName('halter'), d = AUSRUESTUNG[obj.userData.ausruestung];
  const t = lage(d, sockel), g = obj.userData.groesse;
  halter.position.set((t.x || 0) * g, (t.y || 0) * g, (t.z || 0) * g);
  halter.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0);
  halter.updateMatrix();
  obj.userData.sockel = sockel;
  if (obj.userData.lichtLokal) obj.userData.lichtPunkt = obj.userData.lichtLokal.clone().applyMatrix4(halter.matrix);
  return obj;
}

/**
 * name aus ausruestungsNamen. opts: { sockel = 'handR', seed = 1, farbe, akzent, metall, holz, leder, stein, groesse = 1
 *   (oder masse: koerperMasse → groesse = hoehe/1,75), material?, schatten = true }
 * → THREE.Group 'ausruestung_<name>' mit userData { ausruestung, sockel, groesse, lichtPunkt? (Vector3, Gruppen-Raum) } und dispose().
 */
export function createAusruestung(name, opts = {}) {
  const d = AUSRUESTUNG[name];
  if (!d) throw new Error(`Unbekannte Ausrüstung: ${name}`);
  const groesse = opts.masse ? opts.masse.hoehe / 1.75 : opts.groesse ?? 1;
  const b = createMeshBuilder({ seed: opts.seed ?? 1 }), gl = createMeshBuilder({ seed: 7, jitter: 0.1 });
  baueAusruestung(b, name, opts, gl);
  const obj = new THREE.Group(), halter = new THREE.Group();
  obj.name = 'ausruestung_' + name;
  halter.name = 'halter';
  halter.scale.setScalar(groesse);
  obj.add(halter);
  const teile = [];
  const neu = (bb, mat, n) => {
    const m = bb.mesh(mat);
    m.name = n; m.castShadow = opts.schatten ?? true; m.receiveShadow = opts.schatten ?? true;
    halter.add(m); teile.push(m);
  };
  neu(b, opts.material || standardMaterial(), name);
  if (!gl.leer) neu(gl, standardMaterial({ emissive: 0xffa040, emissiveIntensity: 0.8 }), 'leuchten');
  if (teile[1]) teile[1].castShadow = false;
  obj.userData = { ausruestung: name, sockel: null, groesse, lichtLokal: d.licht ? new THREE.Vector3(...d.licht) : null };
  obj.dispose = () => { obj.removeFromParent(); for (const m of teile) m.geometry.dispose(); };
  return ausruestungAusrichten(obj, opts.sockel || 'handR');
}
