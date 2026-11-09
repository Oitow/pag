// Testwelt – Spielfigur aus dem Engine-Figurensystem (Vertrag: docs/FIGUREN-SYSTEM.md):
//   input/move-input → gameplay/character (Motor + Modell + Animator, Welt-Adapter) → camera/follow-camera
// Extras: Erste-Person beim Reinzoomen, Kamera-Presets, Lock-On auf Dorfbewohner (🎯/T), Ansprechen (💬/E).
import { createCharacter } from '../../../engine/gameplay/character.js';
import { createMoveInput, zuAbsicht } from '../../../engine/input/move-input.js';
import { createFollowCamera, KAMERA_PRESETS } from '../../../engine/camera/follow-camera.js';
import { waehleZiel, zielPos } from '../../../engine/camera/ziel-wahl.js';
import { randomLook } from '../../../engine/models/character/character-look.js';

const PRESETS = Object.keys(KAMERA_PRESETS);
const SPRECH_ABSTAND = 3.5;

/**
 * opts: { szene, kamera, adapter, element, start, seed, schilder, npcs: () => [{ figur, ansprechen() }] }
 * Liefert { art, position, tempo, figur, kamera (follow-camera), update(dt), teleport(x,z), setAdapter(a), naechstesPreset(), dispose() }.
 */
export function createSpielerFigur({ szene, kamera, adapter, element, start, seed, schilder = null, npcs = () => [] }) {
  // Adapter über eine Hülle reichen: bei neuer Welt nur die Hülle umhängen, Motor/Kamera bleiben
  const welt = {
    bodenHoehe: (x, z) => adapter.bodenHoehe(x, z),
    wasserHoehe: (x, z) => adapter.wasserHoehe(x, z),
    hindernisse: (x, z, r) => adapter.hindernisse(x, z, r),
  };
  const figur = createCharacter({ look: randomLook(seed), seed, welt, pos: { ...start }, schilder, name: 'Du' });
  szene.add(figur.root);
  figur.schild?.zeige(false);                    // eigenes Schild nur für Sprechblasen
  const eingabe = createMoveInput({ element, aktionen: ['rollen', 'gleiten', 'interagieren', 'ziel'], vibration: true });
  eingabe.zeigeKnopf('interagieren', false);
  const cam = createFollowCamera({
    kamera, erstePerson: true,
    bodenHoehe: (x, z) => Math.max(adapter.bodenHoehe(x, z), adapter.wasserHoehe(x, z) ?? -1e9),
    hindernisse: welt.hindernisse,
  });
  const absicht = {};
  let ziel = null, nahNpc = null, presetNr = 0, knopfAn = false;

  function zielWaehlen() {
    const kandidaten = npcs().map(n => n.figur);
    const von = figur.zustand.pos;
    if (!ziel) ziel = waehleZiel(kandidaten, { von, blickYaw: cam.yaw, maxDistanz: 25 });
    else {
      const neu = waehleZiel(kandidaten, { von, blickYaw: cam.yaw, aktuell: ziel, richtung: 1, maxDistanz: 25 });
      ziel = neu === ziel ? null : neu;          // nur eins in Reichweite → loslassen
    }
    cam.lockOn(ziel ? () => { const p = zielPos(ziel); return p && { x: p.x, y: p.y + 1.2, z: p.z }; } : null);
  }

  return {
    art: 'Engine-Figurensystem',
    figur, kamera: cam,
    get position() { return figur.zustand.pos; },
    get tempo() { return figur.zustand.tempo; },
    get preset() { return cam.erstePerson ? 'erste Person' : cam.preset; },
    update(dt) {
      const e = eingabe.lesen(dt);
      cam.drehen(e.kameraX, e.kameraY);
      if (e.zoom) cam.zoomen(e.zoom);
      if (eingabe.gedrueckt('ziel')) zielWaehlen();
      if (ziel && figur.abstandZu(ziel) > 30) zielWaehlen();
      zuAbsicht(e, cam.blickYaw(), absicht);
      // Ego-Sicht: Figur schaut, wohin die Kamera schaut; Lock-On: Figur schaut zum Ziel
      const zp = ziel && zielPos(ziel);
      absicht.blickYaw = cam.erstePerson ? cam.yaw : zp ? Math.atan2(zp.x - figur.zustand.pos.x, zp.z - figur.zustand.pos.z) : undefined;
      figur.update(dt, absicht);
      const z = figur.zustand;
      if (z.landung > 9) cam.schuetteln(Math.min(1, z.landung / 20), 0.3);
      cam.update(dt, z.pos, { tempo: z.tempo, sprintet: z.sprintet, yaw: z.yaw, amBoden: z.amBoden, augenHoehe: figur.model.masse.augenHoehe });
      figur.setSichtbar(!cam.figurAusblenden);
      // Dorfbewohner in Reichweite: 💬 zeigen, E/Knopf spricht an
      nahNpc = null;
      let best = SPRECH_ABSTAND;
      for (const n of npcs()) { const d = figur.abstandZu(n.figur); if (d < best) { best = d; nahNpc = n; } }
      if (!!nahNpc !== knopfAn) { knopfAn = !!nahNpc; eingabe.zeigeKnopf('interagieren', knopfAn); }
      if (nahNpc && eingabe.gedrueckt('interagieren')) { nahNpc.ansprechen(figur); figur.blickZu(nahNpc.figur); }
      if (!nahNpc) figur.blickZu(null);
    },
    naechstesPreset() {
      presetNr = (presetNr + 1) % PRESETS.length;
      cam.setPreset(PRESETS[presetNr]);
      return PRESETS[presetNr];
    },
    teleport(x, z) { figur.teleport({ x, y: adapter.bodenHoehe(x, z) + 0.5, z }); ziel = null; cam.lockOn(null); },
    setAdapter(a) { adapter = a; ziel = null; cam.lockOn(null); },
    dispose() { eingabe.dispose(); cam.dispose(); figur.dispose(); },
  };
}
