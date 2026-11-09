/**
 * @modul    character-clips
 * @zweck    Aktions-Clips einer Figur als Keyframe-Daten (winken, schlagen, hacken, werfen, aufheben, tod, rolle, sitzen, tanzen …) und ihr Abtaster
 * @api      CLIPS ; CLIP_NAMEN ; clipPose(name,t,out) -> pose ; clipZeit(clip,t) -> t ; registriereClip(name,def) -> clip
 * @beispiel
 *   import { CLIPS, clipPose, registriereClip } from '../../engine/models/character/character-clips.js';
 *   const p = clipPose('schlagen', CLIPS.schlagen.trefferBei);   // Pose im Treffer-Moment
 *   registriereClip('verbeugen', { dauer: 1.2, maske: 'ganz', fuesseFest: true,
 *     keys: [{ t: 0, pose: {} }, { t: 0.5, pose: { torso: [1.0, 0, 0] } }, { t: 1.2, pose: {} }] });
 * @tags     figur, charakter, animation, clip, keyframe, aktion, angriff, emote
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { clamp } from '../../core/math.js';
import { mischePose, kopierePose, leerePose } from './character-pose.js';

/*
 * Clip = { dauer (s), trefferBei (s), maske: 'ganz'|'oben', schleife, schleifeAb (s), halten, fuesseFest, ease, keys }
 *   keys: [{ t, pose: { <knochen>: [x,y,z] | {x,y,z}, basisPos: [x,y,z] }, ease? }] – fehlende Kanäle = 0 (Ruhe).
 *   ease (Clip-Standard oder je Key für das Stück davor): 'weich' | 'linear' | 'rein' (beschleunigt, für Schläge) | 'raus'.
 *   schleife: nach dauer ab schleifeAb wiederholen (schleifeAb = dauer → letzte Pose halten, bis gestoppt).
 *   halten: nicht schleifen, aber letzte Pose bleiben (tod).  fuesseFest: Animator rechnet die Beine per IK nach (Füße bleiben am Boden).
 *   basisPos in Metern für die Normalfigur (Hüfthöhe 0.89 m) – der Animator skaliert auf die Figur.
 * Drehsinn siehe character-rig: Schulter − = Arm vor, Ellbogen − = beugen, schulterR.z − / schulterL.z + = abspreizen,
 *   torso.y + = Oberkörper nach links drehen, Hand x ≈ 1.57 = Klinge (Sockel +Y) zeigt nach vorn.
 */
const PI = Math.PI;
const K = (t, pose = {}, ease) => ({ t, pose, ease });
const HALTUNG = { schulterR: [-0.5, 0, -0.2], ellbogenR: [-0.6], handR: [1.6] };

function rolleKeys() {
  // Vorwärtsrolle um die Körpermitte (Mitte c über den Füßen), angezogen; Drehung läuft über ±π (Sprung ist unsichtbar).
  const cl = [0.95, 0.15], cw = [0.6, 0.15], keys = [K(0, {})];   // Mitte des angezogenen Körpers: lokal (y,z) → Welt
  const eng = { torso: [1.1], hals: [0.7], kopf: [0.5], huefteL: [-1.9], huefteR: [-1.9], knieL: [2.3], knieR: [2.3], fussL: [0.3], fussR: [0.3],
    schulterL: [-1.2, 0, 0.3], schulterR: [-1.2, 0, -0.3], ellbogenL: [-1.8], ellbogenR: [-1.8] };
  keys.push(K(0.08, { ...eng, huefteL: [-1.0], huefteR: [-1.0], knieL: [1.6], knieR: [1.6], torso: [0.8], basisPos: [0, -0.3, 0] }));
  const winkel = [[0.13, 0.5], [0.19, 1.3], [0.25, 2.2], [0.3, PI], [0.3, -PI], [0.35, -2.2], [0.41, -1.3], [0.47, -0.5]];
  for (const [t, w] of winkel) {
    const y = cw[0] - (cl[0] * Math.cos(w) - cl[1] * Math.sin(w)), z = cw[1] - (cl[0] * Math.sin(w) + cl[1] * Math.cos(w));
    const ab = w < 0 ? -0.3 * clamp((w + 2.2) / 1.7, 0, 1) : 0;    // zum Ende hin auf die Füße absenken
    keys.push(K(t, { ...eng, basis: [w], basisPos: [0, y + ab, z] }, 'linear'));
  }
  keys.push(K(0.54, { ...eng, huefteL: [-1.1], huefteR: [-1.1], knieL: [1.7], knieR: [1.7], torso: [0.7], basisPos: [0, -0.3, 0] }, 'linear'));
  keys.push(K(0.7, {}));
  return keys;
}

function winkenKeys() {
  const keys = [K(0, {}), K(0.3, { schulterR: [-0.2, 0, -2.6], ellbogenR: [-0.3, 0, 0.5], torso: [0, 0.08, 0.06], kopf: [0, -0.15, 0.05] })];
  for (let i = 1; i <= 7; i++) {
    const s = i % 2 ? 1 : -1;
    keys.push(K(0.3 + i * 0.15, { schulterR: [-0.2, 0, -2.6 - 0.08 * s], ellbogenR: [-0.3, 0, 0.5 + 0.45 * s], handR: [0, 0, 0.2 * s],
      torso: [0, 0.08, 0.06], kopf: [0, -0.15, 0.05] }));
  }
  keys.push(K(1.65, {}));
  return keys;
}

function tanzenKeys() {
  const keys = [];
  for (let i = 0; i <= 8; i++) {
    const s = i % 2 ? -1 : 1, unten = i % 2 === 1, hoch = (i >> 1) % 2 ? 1 : -1;
    keys.push(K(i * 0.25, {
      basisPos: [0.05 * s, unten ? -0.07 : 0, 0], becken: [0, 0.15 * s, -0.12 * s], torso: [0.05, -0.2 * s, 0.14 * s],
      hals: [unten ? 0.15 : -0.05, 0, -0.1 * s], kopf: [0, 0.15 * s, 0],
      schulterL: [hoch > 0 ? -2.7 : -0.6, 0, hoch > 0 ? 0.5 : 0.9], ellbogenL: [hoch > 0 ? -0.4 : -1.6],
      schulterR: [hoch < 0 ? -2.7 : -0.6, 0, hoch < 0 ? -0.5 : -0.9], ellbogenR: [hoch < 0 ? -0.4 : -1.6],
      handL: [0, 0, unten ? 0.3 : -0.3], handR: [0, 0, unten ? -0.3 : 0.3],
    }));
  }
  return keys;
}

const ROH = {
  winken: { dauer: 1.65, trefferBei: 0.5, maske: 'oben', keys: winkenKeys() },
  schlagen: { dauer: 0.55, trefferBei: 0.25, maske: 'oben', fuesseFest: true, keys: [
    K(0, HALTUNG),
    K(0.17, { schulterR: [-2.5, 0, -0.75], ellbogenR: [-1.3], handR: [2.0], torso: [-0.1, -0.55, 0], hals: [0, 0.25], kopf: [0, 0.2],
      schulterL: [-0.5, 0, 0.35], ellbogenL: [-0.9], basisPos: [0, -0.02, 0] }),
    K(0.25, { schulterR: [-1.25, 0, 0.45], ellbogenR: [-0.15], handR: [2.6], torso: [0.25, 0.55, 0], hals: [0, -0.25], kopf: [-0.1, -0.2],
      schulterL: [0.35, 0, 0.45], ellbogenL: [-0.6], basisPos: [0, -0.07, 0] }, 'rein'),
    K(0.34, { schulterR: [-0.8, 0, 0.6], ellbogenR: [-0.3], handR: [2.4], torso: [0.3, 0.65, 0], hals: [0, -0.3], kopf: [-0.1, -0.25],
      schulterL: [0.4, 0, 0.45], ellbogenL: [-0.6], basisPos: [0, -0.06, 0] }),
    K(0.55, HALTUNG),
  ] },
  stossen: { dauer: 0.5, trefferBei: 0.2, maske: 'oben', fuesseFest: true, keys: [
    K(0, HALTUNG),
    K(0.12, { schulterR: [0.35, 0, -0.3], ellbogenR: [-1.8], handR: [1.4], torso: [-0.05, -0.5, 0], hals: [0, 0.25], kopf: [0, 0.2],
      schulterL: [-0.9, 0, 0.3], ellbogenL: [-1.1] }),
    K(0.2, { schulterR: [-1.5, 0, 0.1], ellbogenR: [-0.05], handR: [2.9], torso: [0.25, 0.4, 0], hals: [-0.1, -0.2], kopf: [-0.1, -0.15],
      schulterL: [0.3, 0, 0.5], ellbogenL: [-0.4], basisPos: [0, -0.08, 0.04] }, 'rein'),
    K(0.3, { schulterR: [-1.45, 0, 0.1], ellbogenR: [-0.1], handR: [2.8], torso: [0.22, 0.38, 0], hals: [-0.1, -0.2], kopf: [-0.1, -0.15],
      schulterL: [0.3, 0, 0.5], ellbogenL: [-0.4], basisPos: [0, -0.07, 0.03] }),
    K(0.5, HALTUNG),
  ] },
  hacken: { dauer: 0.8, trefferBei: 0.42, maske: 'oben', fuesseFest: true, keys: [
    K(0, { schulterR: [-0.6, 0, -0.1], ellbogenR: [-0.7], handR: [1.7], schulterL: [-0.6, 0, -0.1], ellbogenL: [-0.9], handL: [1.7] }),
    K(0.3, { schulterR: [-2.95, 0, 0.12], ellbogenR: [-1.35], handR: [2.1], schulterL: [-2.85, 0, -0.18], ellbogenL: [-1.35], handL: [2.1],
      torso: [-0.3, -0.12, 0], hals: [-0.1], kopf: [-0.1], basisPos: [0, 0.01, 0] }),
    K(0.42, { schulterR: [-1.6, 0, 0.18], ellbogenR: [-0.1], handR: [2.6], schulterL: [-1.5, 0, -0.22], ellbogenL: [-0.2], handL: [3.0],
      torso: [0.6, 0, 0], hals: [-0.25], kopf: [-0.15], becken: [0.1], basisPos: [0, -0.13, 0] }, 'rein'),
    K(0.55, { schulterR: [-1.45, 0, 0.18], ellbogenR: [-0.15], handR: [2.6], schulterL: [-1.35, 0, -0.22], ellbogenL: [-0.25], handL: [2.95],
      torso: [0.55, 0, 0], hals: [-0.25], kopf: [-0.15], becken: [0.1], basisPos: [0, -0.12, 0] }),
    K(0.8, { schulterR: [-0.5, 0, -0.1], ellbogenR: [-0.6], handR: [1.7], schulterL: [-0.4, 0, 0.1], ellbogenL: [-0.6] }),
  ] },
  werfen: { dauer: 0.7, trefferBei: 0.36, maske: 'oben', fuesseFest: true, keys: [
    K(0, {}),
    K(0.26, { schulterR: [-2.7, 0, -0.95], ellbogenR: [-1.7], handR: [0.4], torso: [-0.15, -0.65, 0.05], hals: [0, 0.3], kopf: [0, 0.3],
      schulterL: [-1.4, 0, 0.25], ellbogenL: [-0.3], basisPos: [0, -0.02, -0.03] }),
    K(0.36, { schulterR: [-2.0, 0, 0.15], ellbogenR: [-0.2], handR: [-0.3], torso: [0.3, 0.5, -0.05], hals: [-0.1, -0.25], kopf: [0, -0.2],
      schulterL: [-0.2, 0, 0.45], ellbogenL: [-0.5], basisPos: [0, -0.06, 0.05] }, 'rein'),
    K(0.48, { schulterR: [-0.9, 0, 0.5], ellbogenR: [-0.3], torso: [0.4, 0.6, 0], hals: [-0.15, -0.3], kopf: [0, -0.25],
      schulterL: [0.1, 0, 0.45], ellbogenL: [-0.5], basisPos: [0, -0.07, 0.04] }),
    K(0.7, {}),
  ] },
  aufheben: { dauer: 1.1, trefferBei: 0.5, maske: 'ganz', fuesseFest: true, keys: [
    K(0, {}),
    K(0.42, { becken: [0.35], torso: [0.85], hals: [0.15], kopf: [0.05], schulterR: [-0.9, 0, -0.05], ellbogenR: [-0.3], handR: [0.2],
      schulterL: [-0.5, 0, 0.15], ellbogenL: [-0.6], basisPos: [0, -0.38, -0.05] }),
    K(0.6, { becken: [0.35], torso: [0.85], hals: [0.15], kopf: [0.05], schulterR: [-1.0, 0, 0.05], ellbogenR: [-0.5], handR: [0.4],
      schulterL: [-0.5, 0, 0.15], ellbogenL: [-0.6], basisPos: [0, -0.38, -0.05] }),
    K(1.1, { schulterR: [-0.5, 0, -0.05], ellbogenR: [-1.2] }),
  ] },
  jubeln: { dauer: 1.4, trefferBei: 0.3, maske: 'ganz', fuesseFest: true, keys: [
    K(0, {}),
    K(0.15, { schulterL: [-1.6, 0, 0.5], schulterR: [-1.6, 0, -0.5], ellbogenL: [-1.4], ellbogenR: [-1.4], torso: [0.2], basisPos: [0, -0.12, 0] }),
    K(0.3, { schulterL: [-2.95, 0, 0.35], schulterR: [-2.95, 0, -0.35], ellbogenL: [-0.1], ellbogenR: [-0.1], torso: [-0.15], hals: [-0.1], kopf: [-0.25],
      basisPos: [0, 0.1, 0] }, 'raus'),
    K(0.45, { schulterL: [-2.8, 0, 0.4], schulterR: [-2.8, 0, -0.4], ellbogenL: [-0.3], ellbogenR: [-0.3], torso: [-0.05], kopf: [-0.2], basisPos: [0, -0.04, 0] }, 'rein'),
    K(0.6, { schulterL: [-2.4, 0, 0.5], schulterR: [-2.4, 0, -0.5], ellbogenL: [-0.9], ellbogenR: [-0.9], torso: [0.1], basisPos: [0, -0.08, 0] }),
    K(0.75, { schulterL: [-3.0, 0, 0.3], schulterR: [-3.0, 0, -0.3], ellbogenL: [-0.1], ellbogenR: [-0.1], torso: [-0.15], kopf: [-0.25], basisPos: [0, 0.06, 0] }, 'raus'),
    K(0.9, { schulterL: [-2.8, 0, 0.4], schulterR: [-2.8, 0, -0.4], ellbogenL: [-0.3], ellbogenR: [-0.3], basisPos: [0, -0.03, 0] }, 'rein'),
    K(1.4, {}),
  ] },
  treffer: { dauer: 0.45, trefferBei: 0, maske: 'oben', fuesseFest: true, keys: [
    K(0, {}),
    K(0.07, { torso: [-0.45, 0.25, 0.05], hals: [-0.3], kopf: [-0.2, 0.15], schulterL: [-1.0, 0, 0.9], ellbogenL: [-1.1],
      schulterR: [-1.0, 0, -0.9], ellbogenR: [-1.1], basisPos: [0, -0.05, -0.04] }, 'raus'),
    K(0.2, { torso: [-0.15, 0.1, 0], hals: [-0.1], schulterL: [-0.5, 0, 0.5], ellbogenL: [-0.7], schulterR: [-0.6, 0, -0.5], ellbogenR: [-0.7],
      basisPos: [0, -0.03, 0] }),
    K(0.45, {}),
  ] },
  tod: { dauer: 1.3, trefferBei: 0.75, maske: 'ganz', halten: true, keys: [
    K(0, {}),
    K(0.12, { torso: [-0.35, 0.2], hals: [-0.3], schulterL: [-1.1, 0, 0.7], schulterR: [-1.1, 0, -0.7], ellbogenL: [-1.0], ellbogenR: [-1.0],
      huefteL: [-0.2], huefteR: [-0.2], knieL: [0.4], knieR: [0.4], basisPos: [0, -0.04, 0] }, 'raus'),
    K(0.35, { basis: [-0.2], torso: [-0.1, 0.1], hals: [0.2], schulterL: [-0.6, 0, 0.6], schulterR: [-0.6, 0, -0.6], ellbogenL: [-0.6], ellbogenR: [-0.6],
      huefteL: [-0.9], huefteR: [-0.7], knieL: [1.6], knieR: [1.4], fussL: [-0.4], fussR: [-0.4], basisPos: [0, -0.3, 0] }),
    K(0.75, { basis: [-1.5], torso: [-0.05], hals: [0.25], schulterL: [-0.3, 0, 1.2], schulterR: [-0.3, 0, -1.2], ellbogenL: [-0.3], ellbogenR: [-0.3],
      huefteL: [-0.2], huefteR: [-0.15], knieL: [0.3], knieR: [0.2], fussL: [0.4], fussR: [0.4], basisPos: [0, 0.13, -0.05] }, 'rein'),
    K(0.88, { basis: [-1.38], torso: [0.05], hals: [0.35], schulterL: [-0.35, 0, 1.3], schulterR: [-0.35, 0, -1.3], ellbogenL: [-0.4], ellbogenR: [-0.4],
      huefteL: [-0.3], huefteR: [-0.2], knieL: [0.4], knieR: [0.3], fussL: [0.4], fussR: [0.4], basisPos: [0, 0.14, -0.05] }, 'raus'),
    K(1.3, { basis: [-1.53], torso: [-0.03], hals: [0.1], kopf: [0, 0.4], schulterL: [-0.25, 0, 1.35], schulterR: [-0.25, 0, -1.25],
      ellbogenL: [-0.3], ellbogenR: [-0.5], huefteL: [-0.1], huefteR: [-0.25], knieL: [0.15], knieR: [0.45], fussL: [0.5], fussR: [0.4],
      basisPos: [0, 0.12, -0.05] }),
  ] },
  ausweichrolle: { dauer: 0.7, trefferBei: 0.08, maske: 'ganz', keys: rolleKeys() },
  trinken: { dauer: 1.4, trefferBei: 0.45, maske: 'oben', keys: [
    K(0, {}),
    K(0.3, { schulterL: [-1.9, 0, -0.35], ellbogenL: [-2.35], handL: [0.3], hals: [-0.05] }),
    K(0.45, { schulterL: [-2.2, 0, -0.4], ellbogenL: [-2.45], handL: [0.6], hals: [-0.3], kopf: [-0.25], torso: [-0.08] }),
    K(1.05, { schulterL: [-2.2, 0, -0.4], ellbogenL: [-2.45], handL: [0.6], hals: [-0.3], kopf: [-0.25], torso: [-0.08] }),
    K(1.4, {}),
  ] },
  sitzen: { dauer: 0.9, trefferBei: 0.9, maske: 'ganz', schleife: true, schleifeAb: 0.9, keys: [
    K(0, {}),
    K(0.4, { huefteL: [-1.0], huefteR: [-1.0], knieL: [1.9], knieR: [1.9], fussL: [-0.4], fussR: [-0.4], torso: [0.5], schulterL: [-0.6, 0, 0.2],
      schulterR: [-0.6, 0, -0.2], ellbogenL: [-0.4], ellbogenR: [-0.4], basisPos: [0, -0.45, -0.1] }),
    K(0.9, { huefteL: [-1.4, 0, 0.1], huefteR: [-1.35, 0, -0.1], knieL: [0.45], knieR: [0.6], fussL: [-0.35], fussR: [-0.3], torso: [-0.12], hals: [0.1],
      schulterL: [0.45, 0, 0.3], schulterR: [0.45, 0, -0.3], ellbogenL: [-0.05], ellbogenR: [-0.05], handL: [-0.6], handR: [-0.6],
      basisPos: [0, -0.73, -0.05] }),
  ] },
  sitzenStuhl: { dauer: 0.7, trefferBei: 0.7, maske: 'ganz', schleife: true, schleifeAb: 0.7, keys: [
    K(0, {}),
    K(0.7, { huefteL: [-1.5, 0, 0.05], huefteR: [-1.5, 0, -0.05], knieL: [1.5], knieR: [1.5], torso: [0.05], schulterL: [-0.55, 0, 0.1],
      schulterR: [-0.55, 0, -0.1], ellbogenL: [-0.9], ellbogenR: [-0.9], basisPos: [0, -0.4, 0] }),
  ] },
  tanzen: { dauer: 2, trefferBei: 0, maske: 'ganz', schleife: true, schleifeAb: 0, fuesseFest: true, keys: tanzenKeys() },
  // Für den Animator (Schwimmen im Körper-Raum, Rumpf wird dort gekippt); Spiele dürfen sie auch abspielen.
  schwimmen: { dauer: 1, trefferBei: 0, maske: 'ganz', schleife: true, schleifeAb: 0, keys: [
    K(0, { schulterL: [-2.95, 0, 0.12], schulterR: [-2.95, 0, -0.12], ellbogenL: [-0.1], ellbogenR: [-0.1], handL: [0, 0, -0.2], handR: [0, 0, 0.2] }),
    K(0.4, { schulterL: [-2.1, 0, 0.95], schulterR: [-2.1, 0, -0.95], ellbogenL: [-0.9], ellbogenR: [-0.9], torso: [-0.06], huefteL: [-0.1], huefteR: [-0.1] }),
    K(0.6, { schulterL: [-1.3, 0, 0.25], schulterR: [-1.3, 0, -0.25], ellbogenL: [-2.0], ellbogenR: [-2.0], torso: [-0.1],
      huefteL: [-0.7, 0, 0.35], huefteR: [-0.7, 0, -0.35], knieL: [1.9], knieR: [1.9], fussL: [0.7], fussR: [0.7] }),
    K(0.78, { schulterL: [-2.5, 0, 0.1], schulterR: [-2.5, 0, -0.1], ellbogenL: [-1.0], ellbogenR: [-1.0], torso: [-0.02],
      huefteL: [-0.3, 0, 0.6], huefteR: [-0.3, 0, -0.6], knieL: [0.5], knieR: [0.5], fussL: [0.6], fussR: [0.6] }),
    K(1, { schulterL: [-2.95, 0, 0.12], schulterR: [-2.95, 0, -0.12], ellbogenL: [-0.1], ellbogenR: [-0.1], handL: [0, 0, -0.2], handR: [0, 0, 0.2] }),
  ] },
  wassertreten: { dauer: 1.6, trefferBei: 0, maske: 'ganz', schleife: true, schleifeAb: 0, keys: [0, 0.4, 0.8, 1.2, 1.6].map((t, i) => {
    const s = i % 2 ? -1 : 1;
    return K(t, { schulterL: [-0.9, 0, 0.9 + 0.35 * s], schulterR: [-0.9, 0, -0.9 - 0.35 * s], ellbogenL: [-0.7], ellbogenR: [-0.7],
      handL: [0, 0, 0.4 * s], handR: [0, 0, -0.4 * s], huefteL: [-0.5 - 0.3 * s], huefteR: [-0.5 + 0.3 * s],
      knieL: [0.9 + 0.4 * s], knieR: [0.9 - 0.4 * s], fussL: [0.6], fussR: [0.6] });
  }) },
};

/** Registrierte Clips (normalisiert: Arrays → {x,y,z}). */
export const CLIPS = {};
/** Namen aller Clips (wird bei registriereClip ergänzt). */
export const CLIP_NAMEN = [];

const EASE = {
  weich: (u) => u * u * (3 - 2 * u), linear: (u) => u, rein: (u) => u * u * u, raus: (u) => 1 - (1 - u) ** 3,
};
function vec(v) {
  if (Array.isArray(v)) return { x: +v[0] || 0, y: +v[1] || 0, z: +v[2] || 0 };
  return { x: +v?.x || 0, y: +v?.y || 0, z: +v?.z || 0 };
}

/** Fügt einen Clip hinzu (oder ersetzt ihn). def siehe oben; keys werden nach t sortiert. */
export function registriereClip(name, def) {
  const keys = (def.keys || []).map((k) => {
    const pose = {};
    for (const [kanal, v] of Object.entries(k.pose || {})) if (v && typeof v === 'object') pose[kanal] = vec(v);
    return { t: Math.max(0, +k.t || 0), pose, ease: EASE[k.ease] ? k.ease : null };
  }).sort((a, b) => a.t - b.t);
  if (!keys.length) keys.push({ t: 0, pose: {}, ease: null });
  const dauer = Math.max(+def.dauer || keys[keys.length - 1].t, 1e-3);
  const clip = {
    name, dauer, trefferBei: clamp(+def.trefferBei || 0, 0, dauer), maske: def.maske === 'oben' ? 'oben' : 'ganz',
    schleife: !!def.schleife, schleifeAb: clamp(+def.schleifeAb || 0, 0, dauer), halten: !!def.halten,
    fuesseFest: !!def.fuesseFest, ease: EASE[def.ease] ? def.ease : 'weich', keys,
  };
  if (!CLIPS[name]) CLIP_NAMEN.push(name);
  CLIPS[name] = clip;
  return clip;
}
for (const [n, d] of Object.entries(ROH)) registriereClip(n, d);

/** Bildet eine Laufzeit t (s) auf die Clip-Zeit ab (Schleife bzw. Halten am Ende). */
export function clipZeit(clip, t) {
  t = Math.max(0, +t || 0);
  if (t <= clip.dauer) return t;
  const lang = clip.dauer - clip.schleifeAb;
  if (!clip.schleife || lang <= 1e-6) return clip.dauer;
  return clip.schleifeAb + ((t - clip.schleifeAb) % lang);
}

/** Pose des Clips name zur Zeit t (Sekunden) → out (neu, falls nicht übergeben). Unbekannt → Ruhepose. */
export function clipPose(name, t, out) {
  const clip = typeof name === 'string' ? CLIPS[name] : name;
  out = out || leerePose();
  if (!clip) return kopierePose(null, out);
  t = clipZeit(clip, t);
  const ks = clip.keys;
  if (ks.length === 1 || t <= ks[0].t) return kopierePose(ks[0].pose, out);
  let i = 0;
  while (i < ks.length - 2 && t >= ks[i + 1].t) i++;
  const a = ks[i], b = ks[i + 1];
  const span = b.t - a.t;
  if (span <= 1e-9 || t >= b.t) return kopierePose(b.pose, out);
  const u = EASE[b.ease || clip.ease](clamp((t - a.t) / span, 0, 1));
  return mischePose(a.pose, b.pose, u, out);
}
