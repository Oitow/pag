/**
 * @modul    character
 * @zweck    Fertige Spielfigur in einem Objekt: Modell (Look) + Animator + Bewegungs-Motor, für Spieler und NPCs gleich
 * @api      createCharacter(opts) -> { root, model, animator, motor, zustand, look, update(dt,absicht), spiele(name,opts), stoppe(name?), setLook(teil), teleport(pos,yaw?), stoss(x,y,z), dispose() }
 * @beispiel
 *   import { createCharacter } from '../../engine/gameplay/character.js';
 *   const held = createCharacter({ look: VORLAGEN.wanderer, welt, pos: { x: 0, y: 0, z: 0 } });
 *   szene.add(held.root);
 *   held.update(dt, absicht);   // absicht aus move-input (stickZuWelt) oder character-steering
 * @tags     figur, charakter, spieler, npc, bewegung, animation, controller, avatar
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { createCharacterModel } from '../models/character/character-model.js';
import { createAnimator } from '../models/character/character-animator.js';
import { CLIPS } from '../models/character/character-clips.js';
import { createMotor } from './character-motor.js';

/**
 * opts: { look, seed = 1, welt (Adapter: bodenHoehe …), pos {x,y,z}, yaw = 0, tuning (Motor), animation (Animator-Optionen),
 *         schatten = true, onSchritt(fuss, staerke, figur) }
 * Aktionen mit Maske 'ganz' (z. B. tod, ausweichrolle, sitzen) sperren die Lauf-Absicht, solange sie laufen.
 */
export function createCharacter(opts = {}) {
  const model = createCharacterModel({ look: opts.look, seed: opts.seed ?? 1, schatten: opts.schatten ?? true });
  const m = model.masse;
  const motor = createMotor({
    welt: opts.welt, pos: opts.pos || { x: 0, y: 0, z: 0 }, yaw: opts.yaw || 0,
    radius: m.radius, hoehe: m.hoehe, tuning: opts.tuning,
  });
  const figur = {};
  const animator = createAnimator(model, {
    seed: opts.seed ?? 1,
    gehTempo: motor.tuning.gehTempo, laufTempo: motor.tuning.laufTempo, sprintTempo: motor.tuning.sprintTempo,
    ...opts.animation,
    onSchritt: (fuss, staerke) => opts.onSchritt?.(fuss, staerke, figur),
  });
  const root = model.root;
  const STOP = { x: 0, z: 0, sprint: false, springen: false, ducken: false };

  function sync() {
    const z = motor.zustand;
    root.position.set(z.pos.x, z.pos.y, z.pos.z);
    root.rotation.y = z.yaw;
  }

  Object.assign(figur, {
    root, model, animator, motor,
    get zustand() { return motor.zustand; },
    get look() { return model.look; },
    update(dt, absicht) {
      const a = animator.aktion;
      const gesperrt = a && CLIPS[a]?.maske === 'ganz';
      motor.update(dt, gesperrt ? STOP : absicht);
      sync();
      animator.update(dt, motor.zustand);
    },
    spiele: (name, o) => animator.spiele(name, o),
    stoppe: (name) => animator.stoppe(name),
    setLook(teil) {
      model.setLook(teil);
      if ('radius' in motor) motor.radius = model.masse.radius;
      if ('hoehe' in motor) motor.hoehe = model.masse.hoehe;
      return model.look;
    },
    teleport(pos, yaw) { motor.teleport(pos, yaw); sync(); },
    stoss: (x, y, z) => motor.stoss(x, y, z),
    dispose() { animator.dispose(); motor.dispose(); model.dispose(); },
  });
  sync();
  return figur;
}
