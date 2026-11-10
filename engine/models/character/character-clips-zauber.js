/**
 * @modul    character-clips-zauber
 * @zweck    Zauber-Gesten als reine Keyframe-Daten (Wurf, Stoß, Fingerzeig, Himmelsruf, Bodenschlag, Selbstzauber); wird von character-clips registriert
 * @api      ZAUBER_CLIPS
 * @beispiel
 *   import { CLIPS } from '../../engine/models/character/character-clips.js';   // registriert ZAUBER_CLIPS automatisch
 *   const { trefferBei } = figur.spiele('zauberWurf');   // Zauber nach trefferBei Sekunden auslösen (siehe gameplay/zauber)
 * @tags     figur, charakter, animation, clip, keyframe, zauber, magie, geste
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

/*
 * Format und Drehsinn wie character-clips: Schulter − = Arm vor (−1.57 waagrecht, −3 hoch), schulterR.z − / schulterL.z + = abspreizen,
 * Ellbogen − = beugen, torso + = vorbeugen, torso.y + = nach links drehen. Jede Geste: Ausholen (Spannung) → schneller Schlag
 * ('rein') → Nachschwingen → Ruhe. trefferBei = Moment, in dem der Zauber die Hand verlässt.
 */
const K = (t, pose = {}, ease) => ({ t, pose, ease });

export const ZAUBER_CLIPS = {
  // Rechte Hand holt hinter der Schulter aus und schleudert nach vorn (Feuerball, Geschosse)
  zauberWurf: { dauer: 0.75, trefferBei: 0.34, maske: 'oben', fuesseFest: true, ausdruck: 'entschlossen', keys: [
    K(0, {}),
    K(0.24, { schulterR: [-1.2, 0, -1.25], ellbogenR: [-1.9], handR: [-0.4], torso: [-0.12, -0.6, 0.04], hals: [0, 0.35], kopf: [-0.05, 0.2],
      schulterL: [-1.5, 0, 0.1], ellbogenL: [-0.25], handL: [-0.5], basisPos: [0, -0.04, -0.04] }),
    K(0.34, { schulterR: [-1.65, 0, 0.2], ellbogenR: [-0.05], handR: [-0.7], torso: [0.28, 0.55, -0.04], hals: [-0.12, -0.3], kopf: [0, -0.2],
      schulterL: [0.35, 0, 0.5], ellbogenL: [-0.7], basisPos: [0, -0.07, 0.06] }, 'rein'),
    K(0.5, { schulterR: [-1.45, 0, 0.3], ellbogenR: [-0.15], handR: [-0.3], torso: [0.32, 0.6, 0], hals: [-0.15, -0.3], kopf: [0, -0.25],
      schulterL: [0.3, 0, 0.45], ellbogenL: [-0.6], basisPos: [0, -0.08, 0.05] }, 'raus'),
    K(0.75, {}),
  ] },
  // Beide Hände sammeln vor der Brust und stoßen nach vorn (Windstoß, Eis)
  zauberStoss: { dauer: 0.8, trefferBei: 0.36, maske: 'oben', fuesseFest: true, ausdruck: 'entschlossen', keys: [
    K(0, {}),
    K(0.26, { schulterL: [-0.5, 0, 0.35], schulterR: [-0.5, 0, -0.35], ellbogenL: [-2.2], ellbogenR: [-2.2], handL: [-0.6], handR: [-0.6],
      torso: [-0.18], hals: [0.1], kopf: [0.05], basisPos: [0, -0.06, -0.05] }),
    K(0.36, { schulterL: [-1.6, 0, -0.18], schulterR: [-1.6, 0, 0.18], ellbogenL: [-0.05], ellbogenR: [-0.05], handL: [-1.2], handR: [-1.2],
      torso: [0.32], hals: [-0.2], kopf: [-0.1], basisPos: [0, -0.1, 0.08] }, 'rein'),
    K(0.55, { schulterL: [-1.5, 0, -0.1], schulterR: [-1.5, 0, 0.1], ellbogenL: [-0.2], ellbogenR: [-0.2], handL: [-1.0], handR: [-1.0],
      torso: [0.26], hals: [-0.15], basisPos: [0, -0.09, 0.06] }, 'raus'),
    K(0.8, {}),
  ] },
  // Schneller Fingerzeig mit der Rechten (Blitz)
  zauberFinger: { dauer: 0.55, trefferBei: 0.2, maske: 'oben', fuesseFest: true, ausdruck: 'konzentriert', keys: [
    K(0, {}),
    K(0.13, { schulterR: [-2.6, 0, -0.5], ellbogenR: [-1.3], torso: [-0.1, -0.25], kopf: [-0.1], schulterL: [0.2, 0, 0.35], ellbogenL: [-0.5] }),
    K(0.2, { schulterR: [-1.55, 0, 0.12], ellbogenR: [-0.02], handR: [0.2], torso: [0.14, 0.3], hals: [-0.05, -0.15], schulterL: [0.4, 0, 0.4],
      ellbogenL: [-0.8], basisPos: [0, -0.04, 0.03] }, 'rein'),
    K(0.36, { schulterR: [-1.62, 0, 0.1], ellbogenR: [-0.1], handR: [0.3], torso: [0.1, 0.28], hals: [-0.05, -0.15], schulterL: [0.4, 0, 0.4],
      ellbogenL: [-0.8], basisPos: [0, -0.03, 0.02] }),
    K(0.55, {}),
  ] },
  // Beide Arme rufen in den Himmel und reißen nach unten (Meteor)
  zauberHimmel: { dauer: 1.05, trefferBei: 0.52, maske: 'oben', fuesseFest: true, ausdruck: 'konzentriert', keys: [
    K(0, {}),
    K(0.16, { schulterL: [-0.6, 0, 0.5], schulterR: [-0.6, 0, -0.5], ellbogenL: [-1.2], ellbogenR: [-1.2], torso: [0.15], basisPos: [0, -0.08, 0] }),
    K(0.4, { schulterL: [-2.95, 0, 0.45], schulterR: [-2.95, 0, -0.45], ellbogenL: [-0.2], ellbogenR: [-0.2], handL: [-0.5], handR: [-0.5],
      torso: [-0.22], hals: [-0.25], kopf: [-0.35], basisPos: [0, 0.03, -0.02] }, 'raus'),
    K(0.52, { schulterL: [-1.3, 0, 0.2], schulterR: [-1.3, 0, -0.2], ellbogenL: [-0.5], ellbogenR: [-0.5], handL: [0.6], handR: [0.6],
      torso: [0.4], hals: [0.1], kopf: [0.1], basisPos: [0, -0.14, 0.05] }, 'rein'),
    K(0.72, { schulterL: [-0.9, 0, 0.25], schulterR: [-0.9, 0, -0.25], ellbogenL: [-0.7], ellbogenR: [-0.7], torso: [0.3], basisPos: [0, -0.1, 0.03] }, 'raus'),
    K(1.05, {}),
  ] },
  // Faust hoch, in die Knie und auf den Boden schlagen (Erdstachel) – ganzer Körper, Figur bleibt stehen
  zauberBoden: { dauer: 1.0, trefferBei: 0.42, maske: 'ganz', fuesseFest: true, ausdruck: 'wuetend', keys: [
    K(0, {}),
    K(0.22, { schulterR: [-2.9, 0, -0.3], ellbogenR: [-0.9], torso: [-0.2, -0.2], hals: [-0.15], kopf: [-0.2], schulterL: [-0.4, 0, 0.5],
      ellbogenL: [-0.8], basisPos: [0, 0.04, -0.03] }, 'raus'),
    K(0.42, { becken: [0.3], torso: [0.75, 0.15], hals: [-0.2], kopf: [-0.3], schulterR: [-0.75, 0, 0.1], ellbogenR: [-0.25], handR: [-0.4],
      schulterL: [0.3, 0, 0.7], ellbogenL: [-0.9], basisPos: [0, -0.42, 0.06] }, 'rein'),
    K(0.62, { becken: [0.28], torso: [0.7, 0.12], hals: [-0.25], kopf: [-0.35], schulterR: [-0.8, 0, 0.1], ellbogenR: [-0.3], handR: [-0.4],
      schulterL: [0.25, 0, 0.65], ellbogenL: [-0.9], basisPos: [0, -0.4, 0.05] }),
    K(1.0, {}),
  ] },
  // Arme vor der Brust kreuzen, dann weit öffnen, Blick nach oben (Heilung, Schild, Teleport)
  zauberSelbst: { dauer: 0.95, trefferBei: 0.4, maske: 'oben', fuesseFest: true, ausdruck: 'konzentriert', keys: [
    K(0, {}),
    K(0.24, { schulterL: [-0.9, 0, -0.55], schulterR: [-0.9, 0, 0.55], ellbogenL: [-2.0], ellbogenR: [-2.0], torso: [0.2], hals: [0.2],
      kopf: [0.15], basisPos: [0, -0.07, 0] }),
    K(0.4, { schulterL: [-1.1, 0, 1.25], schulterR: [-1.1, 0, -1.25], ellbogenL: [-0.25], ellbogenR: [-0.25], handL: [-0.6], handR: [-0.6],
      torso: [-0.2], hals: [-0.2], kopf: [-0.3], basisPos: [0, 0.03, 0] }, 'rein'),
    K(0.65, { schulterL: [-0.9, 0, 1.1], schulterR: [-0.9, 0, -1.1], ellbogenL: [-0.4], ellbogenR: [-0.4], handL: [-0.5], handR: [-0.5],
      torso: [-0.14], hals: [-0.15], kopf: [-0.22] }, 'raus'),
    K(0.95, {}),
  ] },
};
