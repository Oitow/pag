// Dämmerwald – Spielfigur + Kamera (schlank): input/move-input → gameplay/character → camera/follow-camera.
// Kamera tief und nah am Menschen, Sichtfeld 50° (Weitwinkel macht klein), man kann weit nach oben schauen.
import { createCharacter } from '../../../engine/gameplay/character.js';
import { createMoveInput, zuAbsicht } from '../../../engine/input/move-input.js';
import { createFollowCamera } from '../../../engine/camera/follow-camera.js';
import { createLook, VORLAGEN } from '../../../engine/models/character/character-look.js';

export const SICHTFELD = 50;

/** opts: { szene, kamera, welt (Kollisions-Welt), element, start: {x,z,yaw} } → { figur, kamera, position, update(dt), stelle(ort), dispose() } */
export function createSpielerFigur({ szene, kamera, welt, element, start }) {
  const OHNE_MICH = { ausser: 'spieler' };
  const adapter = {
    bodenHoehe: (x, z, y) => welt.bodenHoehe(x, z, y),
    wasserHoehe: (x, z) => welt.wasserHoehe(x, z),
    hindernisse: (x, z, r, filter) => welt.hindernisse(x, z, r, filter),
    fuege: (k) => { welt.fuege({ ...k, id: 'spieler' }); return 'spieler'; },
    bewege: (id, x, z, y) => welt.bewege(id, x, z, y),
    entferne: (id) => welt.entferne(id),
  };
  const look = createLook({ ...VORLAGEN.wanderer, name: 'Du', oberteil: { stil: 'kittel', farbe: '#56626a', akzent: '#7a6a4c' }, umhang: { stil: 'kurz', farbe: '#4c4638' }, kopfbedeckung: { stil: 'kapuze', farbe: '#4c4638' } });
  const figur = createCharacter({ look, seed: 1, yaw: start.yaw ?? 0, welt: adapter, pos: { x: start.x, y: welt.bodenHoehe(start.x, start.z) + 0.2, z: start.z }, name: 'Du' });
  szene.add(figur.root);
  const eingabe = createMoveInput({ element, aktionen: [] });
  const cam = createFollowCamera({
    kamera, fov: SICHTFELD, sprintFov: 55, distanz: 12, minDistanz: 2.5, maxDistanz: 22, pitch: -0.1, minPitch: -0.95, maxPitch: 1.1, hoehe: 2.7, erstePerson: true, autoAusrichten: 0.6,
    bodenHoehe: (x, z) => Math.max(welt.bodenHoehe(x, z), welt.wasserHoehe(x, z) ?? -1e9),
    hindernisse: (x, z, r) => welt.hindernisse(x, z, r, OHNE_MICH),
  });
  const absicht = {};
  return {
    figur, kamera: cam, eingabe,
    get position() { return figur.zustand.pos; },
    update(dt) {
      const e = eingabe.lesen(dt);
      cam.drehen(e.kameraX, e.kameraY);
      if (e.zoom) cam.zoomen(e.zoom);
      zuAbsicht(e, cam.blickYaw(), absicht);
      absicht.blickYaw = cam.erstePerson ? cam.yaw : undefined;
      figur.update(dt, absicht);
      const z = figur.zustand;
      cam.update(dt, z.pos, { tempo: z.tempo, sprintet: z.sprintet, yaw: z.yaw, amBoden: z.amBoden, augenHoehe: figur.model.masse.augenHoehe });
      figur.setSichtbar(!cam.figurAusblenden);
    },
    /** Figur + Kamera an einen Ort stellen (plan-daten ORTE): { x, z, yaw, pitch, distanz }. */
    stelle(o) {
      figur.teleport({ x: o.x, y: welt.bodenHoehe(o.x, o.z) + 0.3, z: o.z }, o.yaw);
      cam.yaw = o.yaw; if (o.pitch !== undefined) cam.pitch = o.pitch; if (o.distanz) cam.distanz = o.distanz;
      cam.springeZu?.(figur.zustand.pos);
    },
    dispose() { eingabe.dispose(); cam.dispose(); figur.dispose(); },
  };
}
