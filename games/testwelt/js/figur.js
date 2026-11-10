// Testwelt – Spielfigur aus dem Engine-Figurensystem (Vertrag: docs/FIGUREN-SYSTEM.md):
//   input/move-input → gameplay/character (Motor + Modell + Animator, Welt-Adapter) → camera/follow-camera
// Extras: Erste-Person beim Reinzoomen, Kamera-Presets, Lock-On auf Dorfbewohner (🎯/T). Interaktion (💬/E) wertet sachen.js aus.
import { createCharacter } from '../../../engine/gameplay/character.js';
import { createMoveInput, zuAbsicht } from '../../../engine/input/move-input.js';
import { createFollowCamera, KAMERA_PRESETS } from '../../../engine/camera/follow-camera.js';
import { waehleZiel, zielPos } from '../../../engine/camera/ziel-wahl.js';
import { randomLook } from '../../../engine/models/character/character-look.js';

const PRESETS = Object.keys(KAMERA_PRESETS);

/**
 * opts: { szene, kamera, adapter, element, start, seed, schilder, npcs: () => [{ figur, ansprechen() }] }
 * Liefert { art, position, tempo, figur, kamera (follow-camera), update(dt), teleport(x,z), setAdapter(a), naechstesPreset(), dispose() }.
 */
export function createSpielerFigur({ szene, kamera, adapter, element, start, seed, schilder = null, npcs = () => [] }) {
  // Adapter über eine Hülle reichen: bei neuer Welt nur die Hülle umhängen, Motor/Kamera bleiben
  // (Kollisions-Welt: der eigene Körper wird als 'spieler' angemeldet und zieht beim Weltwechsel mit um)
  let koerper = null;
  const welt = {
    bodenHoehe: (x, z, y) => adapter.bodenHoehe(x, z, y),
    wasserHoehe: (x, z) => adapter.wasserHoehe(x, z),
    hindernisse: (x, z, r, filter) => adapter.hindernisse(x, z, r, filter),
    fuege: (k) => { koerper = { ...k, id: 'spieler' }; adapter.fuege?.(koerper); return 'spieler'; },
    bewege: (id, x, z, y) => adapter.bewege?.(id, x, z, y),
    entferne: (id) => adapter.entferne?.(id),
  };
  const OHNE_MICH = { ausser: 'spieler' };
  const figur = createCharacter({ look: randomLook(seed), seed, welt, pos: { ...start }, schilder, name: 'Du' });
  szene.add(figur.root);
  figur.schild?.zeige(false);                    // eigenes Schild nur für Sprechblasen
  const eingabe = createMoveInput({ element, aktionen: ['rollen', 'gleiten', 'interagieren', 'ziel'], vibration: true });
  eingabe.zeigeKnopf('interagieren', false);
  const cam = createFollowCamera({
    kamera, erstePerson: true,
    bodenHoehe: (x, z) => Math.max(adapter.bodenHoehe(x, z), adapter.wasserHoehe(x, z) ?? -1e9),
    hindernisse: (x, z, r) => adapter.hindernisse(x, z, r, OHNE_MICH),
  });
  const absicht = {};
  let ziel = null, presetNr = 0, knopfAn = false, interagiert = false;

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
      interagiert = !!e.interagieren;
    },
    /** Interaktions-Taste (E / 💬) gerade gehalten? Auswertung: sachen.js über engine/gameplay/interaktion. */
    get interagiert() { return interagiert; },
    /** 💬-Knopf auf dem Handy nur zeigen, wenn es etwas zu tun gibt. */
    zeigeInteraktion(an) { if (!!an !== knopfAn) { knopfAn = !!an; eingabe.zeigeKnopf('interagieren', knopfAn); } },
    naechstesPreset() {
      presetNr = (presetNr + 1) % PRESETS.length;
      cam.setPreset(PRESETS[presetNr]);
      return PRESETS[presetNr];
    },
    teleport(x, z) { figur.teleport({ x, y: adapter.bodenHoehe(x, z) + 0.5, z }); ziel = null; cam.lockOn(null); },
    setAdapter(a) { adapter = a; if (koerper) { const q = figur.zustand.pos; a.fuege?.({ ...koerper, x: q.x, z: q.z, y0: q.y }); } ziel = null; cam.lockOn(null); },
    dispose() { eingabe.dispose(); cam.dispose(); figur.dispose(); },
  };
}
