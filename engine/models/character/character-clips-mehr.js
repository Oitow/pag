/**
 * @modul    character-clips-mehr
 * @zweck    Weitere Aktions-Clips als reine Keyframe-Daten (Emotes, Kampf, Arbeit, Ruhe, Idle-Varianten); wird von character-clips registriert
 * @api      MEHR_CLIPS ; IDLE_VARIANTEN
 * @beispiel
 *   import { CLIPS } from '../../engine/models/character/character-clips.js';   // registriert MEHR_CLIPS automatisch
 *   anim.spiele('verbeugen'); anim.spiele('fegen', { schleife: true }); anim.spiele('tragen');  // Dauer-Aktion bis stoppe()
 * @tags     figur, charakter, animation, clip, keyframe, emote, kampf, arbeit, idle
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

/*
 * Format wie character-clips (ROH): { dauer, trefferBei, maske, schleife, schleifeAb, halten, fuesseFest, ease, keys,
 *   einblenden (s), ausblenden (s), ausdruck (Mimik-Name für den Aussehen-Teil), idle (true = Idle-Variante) }.
 * maske: 'ganz' | 'oben' | 'arme' | 'armL' | 'armR' | 'kopf' | 'rumpf' (siehe character-pose MASKEN).
 * Drehsinn: Schulter − = Arm vor, schulterR.z − / schulterL.z + = abspreizen, Ellbogen − = beugen, torso + = vorbeugen,
 *   torso.y + = nach links drehen, basis.x + = ganzer Körper kippt nach vorn (Drehpunkt an den Füßen).
 */
const K = (t, pose = {}, ease) => ({ t, pose, ease });
const spiegel = (p) => {          // Pose links↔rechts spiegeln (für Seiten-Varianten)
  const o = {};
  for (const [k, v] of Object.entries(p)) {
    const n = k.endsWith('L') ? k.slice(0, -1) + 'R' : k.endsWith('R') ? k.slice(0, -1) + 'L' : k;
    o[n] = [v[0] || 0, -(v[1] || 0), -(v[2] || 0)];
    if (k === 'basisPos') o[n] = [-(v[0] || 0), v[1] || 0, v[2] || 0];
  }
  return o;
};

const BLOCK = { schulterL: [-1.3, 0, -0.2], ellbogenL: [-1.45], schulterR: [-0.6, 0, -0.2], ellbogenR: [-0.8], handR: [1.6],
  torso: [0.15, -0.1], kopf: [-0.05], basisPos: [0, -0.08, 0] };
const TRAGEN = { schulterL: [-0.95, 0, 0.12], schulterR: [-0.95, 0, -0.12], ellbogenL: [-0.95], ellbogenR: [-0.95],
  handL: [0, 0, -0.3], handR: [0, 0, 0.3], torso: [-0.08], hals: [0.05] };
const GARDE = { schulterR: [-0.7, 0, -0.25], ellbogenR: [-1.5], handR: [1.5], schulterL: [-0.8, 0, 0.25], ellbogenL: [-1.7],
  torso: [0.15, -0.2], hals: [0, 0.1], kopf: [-0.1, 0.1], basisPos: [0, -0.08, 0] };
const GARDE2 = { ...GARDE, torso: [0.19, -0.22], basisPos: [0, -0.1, 0], schulterR: [-0.75, 0, -0.27], schulterL: [-0.85, 0, 0.27] };
const HAMMER = { schulterR: [-0.9, 0, -0.1], ellbogenR: [-1.2], handR: [1.6], torso: [0.2], schulterL: [-0.7, 0, 0.15], ellbogenL: [-0.9] };
const SPATEN = { schulterR: [-0.7, 0, -0.1], ellbogenR: [-0.8], handR: [1.5], schulterL: [-0.9, 0, 0.1], ellbogenL: [-0.3], handL: [1.5] };
const HOCKE = { huefteL: [-1.0], huefteR: [-1.0], knieL: [1.9], knieR: [1.9], fussL: [-0.4], fussR: [-0.4], torso: [0.5],
  schulterL: [-0.6, 0, 0.2], schulterR: [-0.6, 0, -0.2], ellbogenL: [-0.4], ellbogenR: [-0.4], basisPos: [0, -0.45, -0.1] };
const SITZ = { huefteL: [-1.4, 0, 0.1], huefteR: [-1.35, 0, -0.1], knieL: [0.45], knieR: [0.6], fussL: [-0.35], fussR: [-0.3], torso: [-0.12],
  schulterL: [0.45, 0, 0.3], schulterR: [0.45, 0, -0.3], ellbogenL: [-0.05], ellbogenR: [-0.05], handL: [-0.6], handR: [-0.6], basisPos: [0, -0.73, -0.05] };
const LIEGEN = { basis: [-1.53], torso: [-0.03], hals: [0.15], kopf: [0, 0.25], schulterL: [-0.35, 0, 0.25], schulterR: [-0.35, 0, -0.25],
  ellbogenL: [-1.3], ellbogenR: [-1.3], handL: [0, 0, -0.3], handR: [0, 0, 0.3], huefteL: [-0.1, 0, 0.05], huefteR: [-0.25, 0, -0.05],
  knieL: [0.15], knieR: [0.4], fussL: [0.5], fussR: [0.45], basisPos: [0, 0.12, -0.05] };
const atmen = (p, d) => ({ ...p, torso: [p.torso[0] + d], hals: [p.hals[0] - d * 0.5] });
const SCHNEIDER = { huefteL: [-1.5, 0, 0.9], huefteR: [-1.5, 0, -0.9], knieL: [2.4], knieR: [2.4], fussL: [0, 0, -0.5], fussR: [0, 0, 0.5],
  torso: [0.12], hals: [0.05], schulterL: [-0.5, 0, 0.25], schulterR: [-0.5, 0, -0.25], ellbogenL: [-0.7], ellbogenR: [-0.7], basisPos: [0, -0.78, -0.05] };

function wechsel(n, schritt, a, b, start = 0) { // Keys, die zwischen a und b pendeln
  const keys = [];
  for (let i = 0; i < n; i++) keys.push(K(start + i * schritt, i % 2 ? b : a));
  return keys;
}
function winkenBeideKeys() {
  const oben = (s) => ({ schulterL: [-0.2, 0, 2.6 + 0.08 * s], schulterR: [-0.2, 0, -2.6 - 0.08 * s], ellbogenL: [-0.3, 0, -0.5 + 0.45 * s],
    ellbogenR: [-0.3, 0, 0.5 + 0.45 * s], torso: [-0.05], kopf: [-0.15] });
  const keys = [K(0, {}), K(0.3, oben(0))];
  for (let i = 1; i <= 8; i++) keys.push(K(0.3 + i * 0.15, oben(i % 2 ? 1 : -1)));
  keys.push(K(1.8, {}));
  return keys;
}
const AUSWEICHEN_L = { basisPos: [0.14, -0.12, 0], torso: [0.1, 0, -0.35], hals: [0, 0, 0.2], schulterL: [-0.3, 0, 0.55],
  schulterR: [-0.5, 0, -0.3], ellbogenL: [-0.4], ellbogenR: [-0.9], becken: [0, 0, -0.1] };

export const MEHR_CLIPS = {
  // --- Emotes ---
  verbeugen: { dauer: 1.6, trefferBei: 0.6, maske: 'ganz', fuesseFest: true, einblenden: 0.2, ausdruck: 'freundlich', keys: [
    K(0, {}),
    K(0.6, { becken: [0.2], torso: [0.85], hals: [0.15], kopf: [0.15], schulterR: [-0.6, 0, 0.25], ellbogenR: [-1.9],
      schulterL: [0.35, 0, 0.1], ellbogenL: [-1.2], basisPos: [0, -0.03, -0.06] }),
    K(1.0, { becken: [0.2], torso: [0.9], hals: [0.15], kopf: [0.15], schulterR: [-0.6, 0, 0.25], ellbogenR: [-1.9],
      schulterL: [0.35, 0, 0.1], ellbogenL: [-1.2], basisPos: [0, -0.03, -0.06] }),
    K(1.6, {}),
  ] },
  klatschen: { dauer: 1.3, trefferBei: 0.25, maske: 'oben', ausdruck: 'freude', keys: [
    K(0, {}),
    ...wechsel(8, 0.12, { schulterL: [-1.0, 0, 0.35], schulterR: [-1.0, 0, -0.35], ellbogenL: [-1.5], ellbogenR: [-1.5], handL: [0, 0, -0.6], handR: [0, 0, 0.6] },
      { schulterL: [-1.05, 0, -0.12], schulterR: [-1.05, 0, 0.12], ellbogenL: [-1.25], ellbogenR: [-1.25], handL: [0, 0, -0.9], handR: [0, 0, 0.9] }, 0.2),
    K(1.3, {}),
  ] },
  zeigen: { dauer: 1.5, trefferBei: 0.35, maske: 'oben', keys: [
    K(0, {}),
    K(0.35, { schulterR: [-1.55, 0, 0.05], ellbogenR: [-0.05], handR: [0, 0, 0.2], torso: [0.05, 0.1], hals: [0.05], kopf: [0, -0.1] }, 'raus'),
    K(1.15, { schulterR: [-1.5, 0, 0.05], ellbogenR: [-0.08], handR: [0, 0, 0.2], torso: [0.05, 0.1], hals: [0.05], kopf: [0, -0.1] }),
    K(1.5, {}),
  ] },
  nicken: { dauer: 1.0, trefferBei: 0.25, maske: 'kopf', keys: [
    K(0, {}), K(0.25, { hals: [0.15], kopf: [0.3] }), K(0.45, { hals: [0.02], kopf: [-0.05] }), K(0.65, { hals: [0.12], kopf: [0.25] }), K(1.0, {}),
  ] },
  kopfschuetteln: { dauer: 1.2, trefferBei: 0.2, maske: 'kopf', ausdruck: 'skeptisch', keys: [
    K(0, {}), ...wechsel(5, 0.2, { hals: [0, 0.15], kopf: [0, 0.35] }, { hals: [0, -0.15], kopf: [0, -0.35] }, 0.2), K(1.2, {}),
  ] },
  winkenBeide: { dauer: 1.8, trefferBei: 0.5, maske: 'oben', ausdruck: 'freude', keys: winkenBeideKeys() },
  siegespose: { dauer: 0.8, trefferBei: 0.35, maske: 'ganz', fuesseFest: true, schleife: true, schleifeAb: 0.8, ausdruck: 'stolz', keys: [
    K(0, {}),
    K(0.35, { schulterR: [-3.0, 0, -0.35], ellbogenR: [-0.3], schulterL: [0.15, 0, 0.65], ellbogenL: [-1.7], torso: [-0.15, 0.1], kopf: [-0.2],
      basisPos: [0, 0.03, 0] }, 'raus'),
    K(0.8, { schulterR: [-2.85, 0, -0.3], ellbogenR: [-0.4], schulterL: [0.1, 0, 0.6], ellbogenL: [-1.6], torso: [-0.1, 0.1], kopf: [-0.15] }),
  ] },
  // --- Kampf ---
  kampfbereit: { dauer: 1.6, trefferBei: 0.3, maske: 'oben', schleife: true, schleifeAb: 0.3, ausdruck: 'entschlossen',
    keys: [K(0, {}), K(0.3, GARDE), K(0.95, GARDE2), K(1.6, GARDE)] },
  schildBlocken: { dauer: 0.25, trefferBei: 0.2, maske: 'oben', schleife: true, schleifeAb: 0.25, einblenden: 0.06,
    keys: [K(0, {}), K(0.2, BLOCK, 'raus'), K(0.25, BLOCK)] },
  zaubern: { dauer: 1.3, trefferBei: 0.8, maske: 'oben', ausdruck: 'konzentriert', keys: [
    K(0, {}),
    K(0.35, { schulterR: [-2.6, 0, -0.6], schulterL: [-2.6, 0, 0.6], ellbogenR: [-0.6], ellbogenL: [-0.6], torso: [-0.15], kopf: [-0.15] }),
    K(0.6, { schulterR: [-2.0, 0, -0.9], schulterL: [-2.0, 0, 0.9], ellbogenR: [-1.3], ellbogenL: [-1.3], handR: [0, 0, 0.4], handL: [0, 0, -0.4],
      torso: [-0.1, 0, 0], kopf: [-0.1] }),
    K(0.8, { schulterR: [-1.55, 0, 0.15], schulterL: [-1.55, 0, -0.15], ellbogenR: [-0.05], ellbogenL: [-0.05], handR: [-0.5], handL: [-0.5],
      torso: [0.2], hals: [-0.1], basisPos: [0, -0.04, 0.03] }, 'rein'),
    K(1.0, { schulterR: [-1.5, 0, 0.15], schulterL: [-1.5, 0, -0.15], ellbogenR: [-0.1], ellbogenL: [-0.1], handR: [-0.5], handL: [-0.5],
      torso: [0.18], hals: [-0.1], basisPos: [0, -0.04, 0.03] }),
    K(1.3, {}),
  ] },
  bogenSchiessen: { dauer: 1.6, trefferBei: 1.1, maske: 'oben', fuesseFest: true, keys: [
    K(0, {}),
    K(0.3, { schulterL: [-1.2, 0, 0.1], ellbogenL: [-0.3], schulterR: [-1.3, 0, 0], ellbogenR: [-1.6], torso: [0, -0.25] }),
    K(0.5, { schulterL: [-1.55, 0, 0], ellbogenL: [-0.05], schulterR: [-1.55, 0, 0.1], ellbogenR: [-1.0], torso: [0, -0.4], kopf: [0, 0.35] }),
    K(1.05, { schulterL: [-1.55, 0, 0], ellbogenL: [-0.05], schulterR: [-1.6, 0, -0.35], ellbogenR: [-2.6], torso: [-0.03, -0.45], hals: [0, 0.2], kopf: [0, 0.3] }),
    K(1.1, { schulterL: [-1.5, 0, 0], ellbogenL: [-0.05], schulterR: [-1.5, 0, -0.7], ellbogenR: [-1.8], torso: [-0.03, -0.45], hals: [0, 0.2], kopf: [0, 0.3] }, 'rein'),
    K(1.3, { schulterL: [-1.45, 0, 0], ellbogenL: [-0.1], schulterR: [-1.3, 0, -0.75], ellbogenR: [-1.6], torso: [-0.03, -0.42], hals: [0, 0.2], kopf: [0, 0.3] }),
    K(1.6, {}),
  ] },
  trefferVorn: { dauer: 0.5, trefferBei: 0, maske: 'oben', fuesseFest: true, einblenden: 0.03, ausdruck: 'schmerz', keys: [
    K(0, {}),
    K(0.07, { torso: [-0.5, 0.15], hals: [-0.35], kopf: [-0.25], schulterL: [-1.0, 0, 0.9], ellbogenL: [-1.1], schulterR: [-1.0, 0, -0.9],
      ellbogenR: [-1.1], basisPos: [0, -0.06, -0.07] }, 'raus'),
    K(0.22, { torso: [-0.15, 0.05], hals: [-0.1], schulterL: [-0.5, 0, 0.5], ellbogenL: [-0.7], schulterR: [-0.6, 0, -0.5], ellbogenR: [-0.7],
      basisPos: [0, -0.03, -0.03] }),
    K(0.5, {}),
  ] },
  trefferHinten: { dauer: 0.5, trefferBei: 0, maske: 'oben', fuesseFest: true, einblenden: 0.03, ausdruck: 'schmerz', keys: [
    K(0, {}),
    K(0.07, { torso: [0.55, -0.1], hals: [-0.25], kopf: [-0.2], schulterL: [0.5, 0, 0.6], ellbogenL: [-0.5], schulterR: [0.5, 0, -0.6],
      ellbogenR: [-0.5], basisPos: [0, -0.06, 0.06] }, 'raus'),
    K(0.22, { torso: [0.2], hals: [-0.05], schulterL: [0.1, 0, 0.3], schulterR: [0.1, 0, -0.3], ellbogenL: [-0.4], ellbogenR: [-0.4], basisPos: [0, -0.03, 0.02] }),
    K(0.5, {}),
  ] },
  ausweichenL: { dauer: 0.55, trefferBei: 0.12, maske: 'ganz', fuesseFest: true, einblenden: 0.04,
    keys: [K(0, {}), K(0.12, AUSWEICHEN_L, 'raus'), K(0.3, AUSWEICHEN_L), K(0.55, {})] },
  ausweichenR: { dauer: 0.55, trefferBei: 0.12, maske: 'ganz', fuesseFest: true, einblenden: 0.04,
    keys: [K(0, {}), K(0.12, spiegel(AUSWEICHEN_L), 'raus'), K(0.3, spiegel(AUSWEICHEN_L)), K(0.55, {})] },
  ausweichenZurueck: { dauer: 0.55, trefferBei: 0.12, maske: 'ganz', fuesseFest: true, einblenden: 0.04, keys: [
    K(0, {}),
    K(0.12, { basisPos: [0, -0.1, -0.12], torso: [-0.45], hals: [0.2], kopf: [0.1], schulterL: [-0.8, 0, 0.4], schulterR: [-0.8, 0, -0.4],
      ellbogenL: [-0.8], ellbogenR: [-0.8] }, 'raus'),
    K(0.3, { basisPos: [0, -0.1, -0.1], torso: [-0.35], hals: [0.15], schulterL: [-0.7, 0, 0.4], schulterR: [-0.7, 0, -0.4], ellbogenL: [-0.8], ellbogenR: [-0.8] }),
    K(0.55, {}),
  ] },
  // --- Arbeit ---
  fegen: { dauer: 1.2, trefferBei: 0.3, maske: 'oben', schleife: true, schleifeAb: 0.2, keys: [
    K(0, {}),
    K(0.2, { torso: [0.3, 0.35], schulterR: [-0.6, 0, -0.3], ellbogenR: [-0.6], handR: [1.2], schulterL: [-0.9, 0, 0.1], ellbogenL: [-0.9], hals: [0, -0.2] }),
    K(0.7, { torso: [0.35, -0.35], schulterR: [-0.8, 0, 0.1], ellbogenR: [-0.5], handR: [1.2], schulterL: [-1.0, 0, 0.4], ellbogenL: [-0.8], hals: [0, 0.2] }),
    K(1.2, { torso: [0.3, 0.35], schulterR: [-0.6, 0, -0.3], ellbogenR: [-0.6], handR: [1.2], schulterL: [-0.9, 0, 0.1], ellbogenL: [-0.9], hals: [0, -0.2] }),
  ] },
  graben: { dauer: 1.4, trefferBei: 0.55, maske: 'oben', fuesseFest: true, keys: [
    K(0, SPATEN),
    K(0.55, { torso: [0.7], hals: [-0.2], schulterR: [-1.0, 0, -0.1], ellbogenR: [-0.3], handR: [1.5], schulterL: [-1.2, 0, 0.1], ellbogenL: [-0.1],
      handL: [1.5], basisPos: [0, -0.15, 0] }, 'rein'),
    K(0.9, { torso: [0.35, 0.4], schulterR: [-1.3, 0, -0.3], ellbogenR: [-1.2], handR: [1.5], schulterL: [-1.1, 0, 0.3], ellbogenL: [-0.8],
      handL: [1.5], basisPos: [0, -0.08, 0] }),
    K(1.1, { torso: [0.25, 0.65], schulterR: [-1.5, 0, -0.1], ellbogenR: [-0.6], handR: [1.6], schulterL: [-1.3, 0, 0.4], ellbogenL: [-0.5],
      handL: [1.6], basisPos: [0, -0.05, 0] }, 'rein'),
    K(1.4, SPATEN),
  ] },
  haemmern: { dauer: 0.6, trefferBei: 0.38, maske: 'oben', fuesseFest: true, keys: [
    K(0, HAMMER),
    K(0.28, { ...HAMMER, schulterR: [-1.9, 0, -0.2], ellbogenR: [-1.9], handR: [1.9], torso: [0.12] }),
    K(0.38, { ...HAMMER, schulterR: [-0.9, 0, -0.1], ellbogenR: [-0.65], handR: [1.3], torso: [0.3], basisPos: [0, -0.03, 0] }, 'rein'),
    K(0.6, HAMMER),
  ] },
  tragen: { dauer: 0.4, trefferBei: 0.4, maske: 'oben', schleife: true, schleifeAb: 0.4, keys: [K(0, {}), K(0.4, TRAGEN)] },
  essen: { dauer: 2.4, trefferBei: 0.35, maske: 'oben', keys: [
    K(0, {}),
    ...wechsel(6, 0.3, { schulterR: [-1.05, 0, 0.35], ellbogenR: [-2.35], handR: [0.4], schulterL: [-0.6, 0, 0.1], ellbogenL: [-1.4], hals: [0.05], kopf: [-0.05] },
      { schulterR: [-0.7, 0, 0.2], ellbogenR: [-1.6], handR: [0.2], schulterL: [-0.6, 0, 0.1], ellbogenL: [-1.4], hals: [0.12], kopf: [0.05] }, 0.35),
    K(2.4, {}),
  ] },
  // --- Ruhe ---
  sitzenBoden: { dauer: 1.0, trefferBei: 1.0, maske: 'ganz', schleife: true, schleifeAb: 1.0, einblenden: 0.2,
    keys: [K(0, {}), K(0.45, HOCKE), K(1.0, SCHNEIDER)] },
  hinlegen: { dauer: 1.5, trefferBei: 1.5, maske: 'ganz', schleife: true, schleifeAb: 1.5, einblenden: 0.2,
    keys: [K(0, {}), K(0.45, HOCKE), K(0.9, SITZ), K(1.5, LIEGEN)] },
  schlafen: { dauer: 4.5, trefferBei: 1.5, maske: 'ganz', schleife: true, schleifeAb: 1.5, einblenden: 0.2, ausdruck: 'schlafend', keys: [
    K(0, {}), K(0.45, HOCKE), K(0.9, SITZ), K(1.5, LIEGEN),
    K(2.25, atmen(LIEGEN, 0.05)), K(3.0, LIEGEN), K(3.75, atmen(LIEGEN, 0.05)), K(4.5, LIEGEN),
  ] },
  // --- Idle-Varianten (der Animator spielt sie nach längerer Ruhe selbst; auch direkt abspielbar) ---
  strecken: { dauer: 3.0, trefferBei: 1.2, maske: 'ganz', fuesseFest: true, idle: true, einblenden: 0.4, ausblenden: 0.5, ausdruck: 'muede', keys: [
    K(0, {}),
    K(1.0, { schulterL: [-2.95, 0, 0.25], schulterR: [-2.95, 0, -0.25], ellbogenL: [-0.3], ellbogenR: [-0.3], handL: [0, 0, -0.6], handR: [0, 0, 0.6],
      torso: [-0.25], hals: [-0.15], kopf: [-0.2], basisPos: [0, 0.03, 0] }),
    K(1.8, { schulterL: [-2.9, 0, 0.5], schulterR: [-2.9, 0, -0.5], ellbogenL: [-0.2], ellbogenR: [-0.2], torso: [-0.2, 0, 0.12], hals: [-0.1],
      kopf: [-0.15], basisPos: [0, 0.03, 0] }),
    K(3.0, {}),
  ] },
  gaehnen: { dauer: 2.6, trefferBei: 0.8, maske: 'oben', idle: true, einblenden: 0.3, ausblenden: 0.4, ausdruck: 'gaehnen', keys: [
    K(0, {}),
    K(0.8, { schulterR: [-1.0, 0, 0.3], ellbogenR: [-2.4], handR: [0.4], torso: [-0.12], hals: [-0.25], kopf: [-0.2] }),
    K(1.8, { schulterR: [-1.0, 0, 0.3], ellbogenR: [-2.4], handR: [0.4], torso: [-0.1], hals: [-0.2], kopf: [-0.15] }),
    K(2.6, {}),
  ] },
  umschauen: { dauer: 3.2, trefferBei: 1.0, maske: 'rumpf', idle: true, einblenden: 0.3, ausblenden: 0.4, keys: [
    K(0, {}), K(0.8, { torso: [0, 0.3], hals: [0, 0.3], kopf: [-0.05, 0.4] }), K(1.4, { torso: [0, 0.3], hals: [0, 0.3], kopf: [-0.05, 0.4] }),
    K(2.2, { torso: [0, -0.3], hals: [0, -0.3], kopf: [0.05, -0.4] }), K(2.6, { torso: [0, -0.3], hals: [0, -0.3], kopf: [0.05, -0.4] }), K(3.2, {}),
  ] },
  kratzen: { dauer: 2.0, trefferBei: 0.6, maske: 'oben', idle: true, einblenden: 0.3, ausblenden: 0.3, ausdruck: 'nachdenklich', keys: [
    K(0, {}),
    ...wechsel(5, 0.22, { schulterR: [-2.3, 0, -0.9], ellbogenR: [-2.2], handR: [0.3], kopf: [0.1, 0, -0.1] },
      { schulterR: [-2.4, 0, -0.85], ellbogenR: [-2.35], handR: [0.5], kopf: [0.1, 0, -0.1] }, 0.6),
    K(2.0, {}),
  ] },
};

/** Clips, die der Animator nach längerer Ruhe zufällig (per Seed) einstreut. */
export const IDLE_VARIANTEN = Object.freeze(Object.keys(MEHR_CLIPS).filter((n) => MEHR_CLIPS[n].idle));
