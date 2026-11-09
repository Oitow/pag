// Testwelt – Steckplatz für die Spielfigur.
// Nutzt das Engine-Figurensystem (Vertrag: docs/FIGUREN-SYSTEM.md), sobald es im Repo liegt:
//   input/move-input → gameplay/character-motor (Welt-Adapter) → models/character (Modell + Animator) → camera/follow-camera
// Fehlt es noch (oder wirft es beim Aufbau), läuft der Platzhalter aus platzhalter.js.
// TODO, sobald das Figurensystem gemergt ist: dynamische Importe durch statische ersetzen, Platzhalter + steuerung.js löschen.
import { createPlatzhalter } from './platzhalter.js';

// Absichtlich als Variablen: esbuild bündelt sie nicht, und ein fehlendes Modul bricht den Build nicht.
const E = new URL('../../../engine/', import.meta.url).href;
const MODULE = {
  eingabe: E + 'input/move-input.js',
  kamera: E + 'camera/follow-camera.js',
  motor: E + 'gameplay/character-motor.js',
  modell: E + 'models/character/character-model.js',
  animator: E + 'models/character/character-animator.js',
  look: E + 'models/character/character-look.js',
};

async function ladeFigurensystem() {
  const namen = Object.keys(MODULE);
  const mods = await Promise.all(namen.map(n => import(/* @vite-ignore */ MODULE[n])));
  return Object.fromEntries(namen.map((n, i) => [n, mods[i]]));
}

function baueEngineFigur(m, { szene, kamera, adapter, element, start, seed }) {
  const eingabe = m.eingabe.createMoveInput({ element });
  const cam = m.kamera.createFollowCamera({
    kamera,
    bodenHoehe: (x, z) => Math.max(adapter.bodenHoehe(x, z), adapter.wasserHoehe(x, z) ?? -1e9),
  });
  const look = m.look.randomLook ? m.look.randomLook(seed) : m.look.createLook?.({});
  const modell = m.modell.createCharacterModel({ look, seed });
  szene.add(modell.root);
  const animator = m.animator.createAnimator(modell, { seed });
  // Adapter über eine Hülle reichen: bei neuer Welt nur die Hülle umhängen, Motor bleibt
  const welt = {
    bodenHoehe: (x, z) => adapter.bodenHoehe(x, z),
    wasserHoehe: (x, z) => adapter.wasserHoehe(x, z),
    hindernisse: (x, z, r) => adapter.hindernisse(x, z, r),
  };
  const motor = m.motor.createMotor({ welt, pos: { ...start }, yaw: 0 });
  const absicht = { x: 0, z: 0, sprint: false, springen: false, ducken: false };

  return {
    art: 'Engine-Figurensystem',
    get position() { return motor.zustand.pos; },
    get tempo() { return motor.zustand.tempo; },
    update(dt) {
      const e = eingabe.lesen();
      // Stick ist kamera-relativ (y = vorwärts) → Weltrichtung; Figur-yaw 0 = +Z, links = +X
      const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
      absicht.x = e.y * s - e.x * c; absicht.z = e.y * c + e.x * s;
      absicht.sprint = !!e.sprint; absicht.springen = !!e.springen; absicht.ducken = !!e.ducken;
      motor.update(dt, absicht);
      const z = motor.zustand;
      modell.root.position.set(z.pos.x, z.pos.y, z.pos.z);
      modell.root.rotation.y = z.yaw;
      animator.update(dt, z);
      cam.update(dt, z.pos, { tempo: z.tempo, sprintet: z.sprintet, yaw: z.yaw, amBoden: z.amBoden, eingabe: e });
    },
    teleport(x, z) { motor.teleport({ x, y: adapter.bodenHoehe(x, z) + 0.5, z }); },
    setAdapter(a) { adapter = a; },
    dispose() {
      eingabe.dispose?.(); cam.dispose?.(); animator.dispose?.(); motor.dispose?.();
      modell.root.removeFromParent(); modell.dispose?.();
    },
  };
}

/** Liefert { art, position, tempo, update(dt), teleport(x,z), setAdapter(a), dispose() }. */
export async function createSpielerFigur(opts) {
  try {
    // Einzeldatei per Doppelklick (file://) kann keine Module nachladen → gleich Platzhalter
    if (location.protocol === 'file:') throw new Error('file:// – keine nachgeladenen Module');
    const m = await ladeFigurensystem();
    return baueEngineFigur(m, opts);
  } catch (e) {
    console.warn('Testwelt: Figurensystem nicht verfügbar → Platzhalter.', e?.message || e);
    return createPlatzhalter(opts);
  }
}
