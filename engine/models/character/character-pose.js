/**
 * @modul    character-pose
 * @zweck    Posen einer Figur als reine Daten: leere Pose, kopieren, mischen, addieren, maskieren (Ober-/Unterkörper, Arme) und aufs Rig anwenden
 * @api      POSE_KNOCHEN ; GANZ ; OBERKOERPER ; UNTERKOERPER ; BEINE ; ARM_L ; ARM_R ; KOPF ; leerePose() -> pose ; kopierePose(a,out) -> out ; mischePose(a,b,t,out,maske) -> out ; addierePose(a,b,gewicht,out) -> out ; maskiere(pose,maske) -> pose ; wendeAn(rig,pose) -> rig
 * @beispiel
 *   import { leerePose, mischePose, wendeAn, OBERKOERPER } from '../../engine/models/character/character-pose.js';
 *   const p = leerePose();
 *   mischePose(gangPose, schlagPose, 0.8, p, OBERKOERPER);   // nur Oberkörper überblenden
 *   wendeAn(rig, p);
 * @tags     figur, charakter, pose, animation, mischen, maske, rig
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

/** Alle Knochen einer Pose (gleiche Namen wie character-rig KNOCHEN). basisPos ist ein Extra-Kanal (Versatz der basis). */
export const POSE_KNOCHEN = [
  'basis', 'becken', 'torso', 'hals', 'kopf',
  'schulterL', 'ellbogenL', 'handL', 'schulterR', 'ellbogenR', 'handR',
  'huefteL', 'knieL', 'fussL', 'huefteR', 'knieR', 'fussR',
];
const KANAELE = [...POSE_KNOCHEN, 'basisPos'];

/** Masken = Listen von Kanälen (Knochen + evtl. 'basisPos'). */
export const GANZ = Object.freeze([...KANAELE]);
export const ARM_L = Object.freeze(['schulterL', 'ellbogenL', 'handL']);
export const ARM_R = Object.freeze(['schulterR', 'ellbogenR', 'handR']);
export const KOPF = Object.freeze(['hals', 'kopf']);
export const OBERKOERPER = Object.freeze(['torso', ...KOPF, ...ARM_L, ...ARM_R]);
export const BEINE = Object.freeze(['huefteL', 'knieL', 'fussL', 'huefteR', 'knieR', 'fussR']);
export const UNTERKOERPER = Object.freeze(['basis', 'becken', ...BEINE, 'basisPos']);

const NULL = Object.freeze({ x: 0, y: 0, z: 0 });
const wert = (v) => (Number.isFinite(v) ? v : 0);

/** Neue Pose, alles 0. */
export function leerePose() {
  const p = {};
  for (const k of KANAELE) p[k] = { x: 0, y: 0, z: 0 };
  return p;
}

function sicher(out) {
  if (!out) return leerePose();
  for (const k of KANAELE) if (!out[k]) out[k] = { x: 0, y: 0, z: 0 };
  return out;
}

/** Kopiert a nach out (fehlende Kanäle in a = 0). */
export function kopierePose(a, out) {
  out = sicher(out);
  for (const k of KANAELE) {
    const s = (a && a[k]) || NULL, o = out[k];
    o.x = wert(s.x); o.y = wert(s.y); o.z = wert(s.z);
  }
  return out;
}

/**
 * out = a + (b − a)·t. Mit maske nur diese Kanäle mischen, die übrigen = a.
 * out darf a oder b sein.
 */
export function mischePose(a, b, t, out, maske = null) {
  out = sicher(out);
  const liste = maske || KANAELE;
  if (maske && out !== a) kopierePose(a, out);
  for (const k of liste) {
    const pa = (a && a[k]) || NULL, pb = (b && b[k]) || NULL, o = out[k];
    if (!o) continue;
    const ax = wert(pa.x), ay = wert(pa.y), az = wert(pa.z);
    o.x = ax + (wert(pb.x) - ax) * t;
    o.y = ay + (wert(pb.y) - ay) * t;
    o.z = az + (wert(pb.z) - az) * t;
  }
  return out;
}

/** out = a + b·gewicht (additive Schicht, z. B. Atmen, Zucken). */
export function addierePose(a, b, gewicht = 1, out) {
  out = sicher(out);
  for (const k of KANAELE) {
    const pa = (a && a[k]) || NULL, pb = (b && b[k]) || NULL, o = out[k];
    o.x = wert(pa.x) + wert(pb.x) * gewicht;
    o.y = wert(pa.y) + wert(pb.y) * gewicht;
    o.z = wert(pa.z) + wert(pb.z) * gewicht;
  }
  return out;
}

/** Setzt alle Kanäle außerhalb der Maske auf 0 (an Ort und Stelle). */
export function maskiere(pose, maske) {
  const drin = new Set(maske);
  for (const k of KANAELE) {
    if (drin.has(k) || !pose[k]) continue;
    pose[k].x = 0; pose[k].y = 0; pose[k].z = 0;
  }
  return pose;
}

/** Schreibt die Pose ins Rig (Duck-Typing: rig.knochen[k].rotation.set, basis.position.set). */
export function wendeAn(rig, pose) {
  const kn = rig.knochen;
  for (const k of POSE_KNOCHEN) {
    const b = kn[k];
    if (!b) continue;
    const r = (pose && pose[k]) || NULL;
    b.rotation.set(wert(r.x), wert(r.y), wert(r.z));
  }
  const bp = (pose && pose.basisPos) || NULL;
  if (kn.basis) kn.basis.position.set(wert(bp.x), wert(bp.y), wert(bp.z));
  return rig;
}
