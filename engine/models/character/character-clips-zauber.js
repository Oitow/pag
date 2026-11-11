/**
 * @modul    character-clips-zauber
 * @zweck    Wuchtige Zauber-Gesten als reine Keyframe-Daten (Wurf, Stoß, Fingerzeig, Himmelsruf, Bodenschlag, Griff, Selbstzauber) mit Spann-Moment zum Aufladen; wird von character-clips registriert
 * @api      ZAUBER_CLIPS
 * @beispiel
 *   import { CLIPS } from '../../engine/models/character/character-clips.js';   // registriert ZAUBER_CLIPS automatisch
 *   figur.spiele('zauberWurf', { halteBei: true });       // holt aus und bleibt gespannt (clip.spannBei) – Aufladen
 *   const bisTreffer = figur.loese();                     // schlägt zu; nach bisTreffer Sekunden verlässt der Zauber die Hand
 * @tags     figur, charakter, animation, clip, keyframe, zauber, magie, geste
 * @version  2.0.0
 * @status   entwurf
 * @three    nein
 */

/*
 * Format und Drehsinn wie character-clips: Schulter − = Arm vor (−1.57 waagrecht, −3 hoch), schulterR.z − / schulterL.z + = abspreizen,
 * Ellbogen − = beugen, torso + = vorbeugen, torso.y + = nach links drehen. Jede Geste ist schwer: tief Ausholen bis spannBei
 * (dort hält der Animator beim Aufladen) → harter Schlag ('rein') bis trefferBei (Zauber verlässt die Hand) → Durchschwingen →
 * Rückstoß (Körper federt zurück) → Ruhe. Die Knie gehen mit (basisPos.y), damit das Gewicht sichtbar wird.
 */
const K = (t, pose = {}, ease) => ({ t, pose, ease });

export const ZAUBER_CLIPS = {
  // Rechte Hand holt weit hinter der Schulter aus, der ganze Rumpf dreht mit und schleudert nach vorn (Feuerball, Geschosse)
  zauberWurf: { dauer: 1.1, spannBei: 0.3, trefferBei: 0.42, maske: 'oben', fuesseFest: true, ausdruck: 'entschlossen', keys: [
    K(0, {}),
    K(0.3, { schulterR: [-1.0, 0, -1.45], ellbogenR: [-2.0], handR: [-0.5], torso: [-0.2, -0.8, 0.06], hals: [0.05, 0.5], kopf: [-0.05, 0.25],
      schulterL: [-1.55, 0, 0.05], ellbogenL: [-0.15], handL: [-0.6], basisPos: [0, -0.1, -0.07] }, 'raus'),
    K(0.42, { schulterR: [-1.7, 0, 0.25], ellbogenR: [-0.03], handR: [-0.8], torso: [0.42, 0.7, -0.05], hals: [-0.18, -0.4], kopf: [0, -0.25],
      schulterL: [0.45, 0, 0.55], ellbogenL: [-0.8], basisPos: [0, -0.15, 0.11] }, 'rein'),
    K(0.56, { schulterR: [-1.15, 0, 0.5], ellbogenR: [-0.2], handR: [-0.3], torso: [0.5, 0.82, 0], hals: [-0.2, -0.4], kopf: [0.05, -0.3],
      schulterL: [0.5, 0, 0.5], ellbogenL: [-0.7], basisPos: [0, -0.17, 0.1] }, 'raus'),
    K(0.82, { schulterR: [-0.5, 0, 0.2], ellbogenR: [-0.5], torso: [0.12, 0.25, 0], hals: [-0.05, -0.1], schulterL: [0.15, 0, 0.25],
      ellbogenL: [-0.4], basisPos: [0, -0.06, -0.02] }),
    K(1.1, {}),
  ] },
  // Beide Hände sammeln an der Hüfte, der Körper duckt sich zurück und stößt dann mit vollem Gewicht nach vorn (Druckwelle, Eis)
  zauberStoss: { dauer: 1.05, spannBei: 0.3, trefferBei: 0.4, maske: 'oben', fuesseFest: true, ausdruck: 'entschlossen', keys: [
    K(0, {}),
    K(0.3, { schulterL: [-0.35, 0, 0.4], schulterR: [-0.35, 0, -0.4], ellbogenL: [-2.3], ellbogenR: [-2.3], handL: [-0.7], handR: [-0.7],
      torso: [-0.28], hals: [0.15], kopf: [0.08], basisPos: [0, -0.12, -0.09] }, 'raus'),
    K(0.4, { schulterL: [-1.62, 0, -0.2], schulterR: [-1.62, 0, 0.2], ellbogenL: [-0.03], ellbogenR: [-0.03], handL: [-1.25], handR: [-1.25],
      torso: [0.42], hals: [-0.25], kopf: [-0.12], basisPos: [0, -0.16, 0.13] }, 'rein'),
    K(0.54, { schulterL: [-1.85, 0, -0.05], schulterR: [-1.85, 0, 0.05], ellbogenL: [-0.35], ellbogenR: [-0.35], handL: [-0.9], handR: [-0.9],
      torso: [0.1], hals: [-0.1], basisPos: [0, -0.12, -0.03] }, 'raus'),
    K(0.78, { schulterL: [-1.0, 0, 0.1], schulterR: [-1.0, 0, -0.1], ellbogenL: [-0.6], ellbogenR: [-0.6], torso: [0.12], basisPos: [0, -0.06, 0] }),
    K(1.05, {}),
  ] },
  // Rechte Hand reckt sich knisternd in den Himmel und peitscht auf das Ziel herab (Blitz)
  zauberFinger: { dauer: 0.9, spannBei: 0.2, trefferBei: 0.28, maske: 'oben', fuesseFest: true, ausdruck: 'konzentriert', keys: [
    K(0, {}),
    K(0.2, { schulterR: [-2.9, 0, -0.45], ellbogenR: [-0.6], torso: [-0.18, -0.35], hals: [-0.1, 0.2], kopf: [-0.18], schulterL: [0.25, 0, 0.4],
      ellbogenL: [-0.6], basisPos: [0, 0.02, -0.03] }, 'raus'),
    K(0.28, { schulterR: [-1.5, 0, 0.14], ellbogenR: [-0.02], handR: [0.25], torso: [0.22, 0.4], hals: [-0.08, -0.2], schulterL: [0.45, 0, 0.45],
      ellbogenL: [-0.9], basisPos: [0, -0.08, 0.05] }, 'rein'),
    K(0.4, { schulterR: [-1.95, 0, 0.1], ellbogenR: [-0.3], handR: [0.4], torso: [0.02, 0.3], hals: [-0.05, -0.15], schulterL: [0.4, 0, 0.4],
      ellbogenL: [-0.8], basisPos: [0, -0.05, -0.02] }, 'raus'),
    K(0.62, { schulterR: [-1.2, 0, 0.1], ellbogenR: [-0.3], torso: [0.08, 0.2], schulterL: [0.2, 0, 0.25], ellbogenL: [-0.5], basisPos: [0, -0.03, 0] }),
    K(0.9, {}),
  ] },
  // Beide Arme rufen in den Himmel, der Körper streckt sich – dann reißt er alles mit ganzem Gewicht herunter (Meteor)
  zauberHimmel: { dauer: 1.5, spannBei: 0.5, trefferBei: 0.66, maske: 'oben', fuesseFest: true, ausdruck: 'konzentriert', keys: [
    K(0, {}),
    K(0.18, { schulterL: [-0.5, 0, 0.55], schulterR: [-0.5, 0, -0.55], ellbogenL: [-1.3], ellbogenR: [-1.3], torso: [0.2], basisPos: [0, -0.12, 0] }),
    K(0.5, { schulterL: [-3.0, 0, 0.5], schulterR: [-3.0, 0, -0.5], ellbogenL: [-0.15], ellbogenR: [-0.15], handL: [-0.6], handR: [-0.6],
      torso: [-0.3], hals: [-0.3], kopf: [-0.4], basisPos: [0, 0.05, -0.03] }, 'raus'),
    K(0.66, { schulterL: [-1.1, 0, 0.2], schulterR: [-1.1, 0, -0.2], ellbogenL: [-0.4], ellbogenR: [-0.4], handL: [0.7], handR: [0.7],
      torso: [0.6], hals: [0.1], kopf: [0.15], basisPos: [0, -0.26, 0.07] }, 'rein'),
    K(0.95, { schulterL: [-0.8, 0, 0.3], schulterR: [-0.8, 0, -0.3], ellbogenL: [-0.7], ellbogenR: [-0.7], handL: [0.4], handR: [0.4],
      torso: [0.5], hals: [0.05], basisPos: [0, -0.22, 0.05] }),
    K(1.5, {}),
  ] },
  // Faust (oder Stab) hoch, auf die Zehen – dann in die Knie und in den Boden rammen (Erdstachel, Frostnova) – ganzer Körper
  zauberBoden: { dauer: 1.3, spannBei: 0.3, trefferBei: 0.46, maske: 'ganz', fuesseFest: true, ausdruck: 'wuetend', keys: [
    K(0, {}),
    K(0.3, { schulterR: [-3.0, 0, -0.3], ellbogenR: [-0.7], torso: [-0.28, -0.25], hals: [-0.15], kopf: [-0.25], schulterL: [-0.5, 0, 0.6],
      ellbogenL: [-0.9], basisPos: [0, 0.06, -0.04] }, 'raus'),
    K(0.46, { becken: [0.35], torso: [0.85, 0.18], hals: [-0.2], kopf: [-0.3], schulterR: [-0.7, 0, 0.1], ellbogenR: [-0.2], handR: [-0.4],
      schulterL: [0.35, 0, 0.75], ellbogenL: [-0.9], basisPos: [0, -0.48, 0.07] }, 'rein'),
    K(0.8, { becken: [0.32], torso: [0.78, 0.14], hals: [-0.25], kopf: [-0.35], schulterR: [-0.78, 0, 0.1], ellbogenR: [-0.3], handR: [-0.4],
      schulterL: [0.3, 0, 0.7], ellbogenL: [-0.9], basisPos: [0, -0.45, 0.06] }),
    K(1.3, {}),
  ] },
  // Linke Hand greift weit nach vorn, packt zu und reißt mit einer Rumpfdrehung zurück an die Brust (Sog)
  zauberGriff: { dauer: 1.25, spannBei: 0.32, trefferBei: 0.48, maske: 'oben', fuesseFest: true, ausdruck: 'konzentriert', keys: [
    K(0, {}),
    K(0.32, { schulterL: [-1.65, 0, -0.1], ellbogenL: [-0.02], handL: [-0.9], torso: [0.3, -0.35], hals: [-0.1, 0.2], schulterR: [0.4, 0, -0.5],
      ellbogenR: [-0.6], basisPos: [0, -0.1, 0.09] }, 'raus'),
    K(0.48, { schulterL: [-0.7, 0, 0.35], ellbogenL: [-2.3], handL: [0.6], torso: [-0.26, 0.45], hals: [0.1, -0.25], kopf: [0.05], schulterR: [-0.3, 0, -0.6],
      ellbogenR: [-1.2], basisPos: [0, -0.15, -0.09] }, 'rein'),
    K(0.85, { schulterL: [-0.75, 0, 0.3], ellbogenL: [-2.2], handL: [0.6], torso: [-0.2, 0.4], hals: [0.08, -0.2], schulterR: [-0.3, 0, -0.5],
      ellbogenR: [-1.1], basisPos: [0, -0.13, -0.07] }),
    K(1.25, {}),
  ] },
  // Arme vor der Brust kreuzen, dann weit öffnen, Blick nach oben (Heilung, Schild, Teleport)
  zauberSelbst: { dauer: 1.0, spannBei: 0.28, trefferBei: 0.42, maske: 'oben', fuesseFest: true, ausdruck: 'konzentriert', keys: [
    K(0, {}),
    K(0.28, { schulterL: [-0.9, 0, -0.6], schulterR: [-0.9, 0, 0.6], ellbogenL: [-2.1], ellbogenR: [-2.1], torso: [0.25], hals: [0.2],
      kopf: [0.15], basisPos: [0, -0.1, 0] }, 'raus'),
    K(0.42, { schulterL: [-1.1, 0, 1.3], schulterR: [-1.1, 0, -1.3], ellbogenL: [-0.2], ellbogenR: [-0.2], handL: [-0.6], handR: [-0.6],
      torso: [-0.24], hals: [-0.2], kopf: [-0.32], basisPos: [0, 0.04, 0] }, 'rein'),
    K(0.7, { schulterL: [-0.9, 0, 1.1], schulterR: [-0.9, 0, -1.1], ellbogenL: [-0.4], ellbogenR: [-0.4], handL: [-0.5], handR: [-0.5],
      torso: [-0.14], hals: [-0.15], kopf: [-0.22] }, 'raus'),
    K(1.0, {}),
  ] },
};
