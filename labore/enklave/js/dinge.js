// Enklave – Dinge & Handeln (schlank, Vorbild labore/handwerk/js/sachen.js): Gegenstände aufheben (E / 💬), Rucksack (I / 🎒), Hinweis-Zeile und Kurzmeldungen.
// Engine: gameplay/{koerper, welt-dinge, interaktion, inventar} + core/{register, ereignisse} + ui/{hud, inventar-ansicht, menue}.
import * as THREE from 'three';
import { createKoerperWelt } from '../../../engine/gameplay/koerper.js';
import { createWeltDinge } from '../../../engine/gameplay/welt-dinge.js';
import { createInteraktion } from '../../../engine/gameplay/interaktion.js';
import { createInventar } from '../../../engine/gameplay/inventar.js';
import { createRegister } from '../../../engine/core/register.js';
import { createEreignisse } from '../../../engine/core/ereignisse.js';
import { createHud } from '../../../engine/ui/hud.js';
import { createInventarAnsicht } from '../../../engine/ui/inventar-ansicht.js';
import { createMenue } from '../../../engine/ui/menue.js';
import { rng, hashSeed, range } from '../../../engine/core/rng.js';

export const GEGENSTAENDE = {
  heilkraut: { name: 'Heilkraut', zeichen: '🌿', farbe: 0x4caf50, form: 'kegel', radius: 0.14, auftrieb: 1.2 },
  muenze: { name: 'Münze', zeichen: '🪙', farbe: 0xd8b030, form: 'zyl', radius: 0.1, stapel: 999 },
  umhang: { name: 'Umhang', zeichen: '🧥', farbe: 0x8a2a24, form: 'ico', radius: 0.15, stapel: 1 },
};

/** opts: { szene, welt (Kollisions-Welt), start {x,z} (Kräuter-Mitte), seed, stand (aus zustand()) } → { inventar, register, interaktion, ereignisse, hud, rucksack, update(dt, figur, gehalten) -> Ziel|null, zustand(), dispose() } */
export function createDinge({ szene, welt, kraeuter, seed = 1, stand = null }) {
  const ereignisse = createEreignisse();
  const register = createRegister({ art: 'gegenstand', standard: { stapel: 20 } });
  register.definiereAlle(GEGENSTAENDE);
  const inventar = createInventar({ plaetze: 12, register, ereignisse });
  const physik = createKoerperWelt({ welt });
  const interaktion = createInteraktion({ ereignisse });
  const gruppe = new THREE.Group(); gruppe.name = 'dinge'; szene.add(gruppe);
  const geos = { zyl: new THREE.CylinderGeometry(1, 1, 0.25, 10), ico: new THREE.IcosahedronGeometry(1, 0), kegel: new THREE.ConeGeometry(1, 1.8, 6) };
  const mats = {}, meshes = new Map();
  const dinge = createWeltDinge({
    physik, interaktion, register, ereignisse,
    onNeu(d) {
      const g = register.hole(d.id);
      const mesh = new THREE.Mesh(geos[g.form], mats[d.id] ??= new THREE.MeshStandardMaterial({ color: g.farbe, flatShading: true, roughness: 0.9 }));
      mesh.scale.setScalar(g.radius); mesh.rotation.y = d.nr * 2.4; gruppe.add(mesh); meshes.set(d, mesh);
    },
    onWeg(d) { meshes.get(d)?.removeFromParent(); meshes.delete(d); },
  });
  if (stand) { inventar.lade(stand.inv); dinge.lade(stand.dinge); }
  else {   // Heilkräuter liegen verstreut um die Kräuter-Wiese
    const r = rng(hashSeed('kraeuter', seed));
    for (let k = 0; k < 7; k++) {
      const x = kraeuter.x + range(r, -7, 7), z = kraeuter.z + range(r, -7, 7);
      dinge.lege('heilkraut', 1, { x, y: welt.bodenHoehe(x, z) + 0.4, z });
    }
  }

  // ---- Anzeige: Hinweis „E – …“, Meldungen, Rucksack als Fenster ----
  const hud = createHud({ unten: globalThis.matchMedia?.('(pointer: coarse)').matches ? 186 : 100 });
  const name = (id) => { const g = register.hole(id); return `${g?.zeichen ?? ''} ${g?.name ?? id}`.trim(); };
  const ansicht = createInventarAnsicht({ inventar, register, spalten: 4, breite: 'min(80vw, 330px)', titel: 'Rucksack' });
  const fenster = createMenue({ taste: null, onAuf: () => ereignisse.sende('rucksack:auf', {}) });
  fenster.seite('rucksack', { titel: 'Rucksack', eintraege: () => [{ art: 'element', element: ansicht.element }, { text: 'Schließen', schliesst: true }] });
  const ab = [ereignisse.an('ding:aufgehoben', (e) => { if (e.anzahl > 0) hud.melde(`+{n} ${name(e.id)}`, { schluessel: 'auf:' + e.id, anzahl: e.anzahl }); })];

  const wer = { x: 0, y: 0, z: 0, yaw: 0, inventar, figur: null };
  return {
    inventar, register, interaktion, ereignisse, hud, fenster, wer, dinge,
    gib(id, anzahl) { inventar.gib(id, anzahl); hud.melde(`+${anzahl} ${name(id)}`, { art: 'gut' }); },
    schalteRucksack() { if (fenster.offen) fenster.schliesse(); else fenster.zeige('rucksack'); },
    /** Je Bild: Physik, Aufheben/Ansprechen. gehalten = Interaktions-Taste. Liefert das aktuelle Ziel (für den Touch-Knopf). */
    update(dt, figur, gehalten) {
      const z = figur.zustand, p = z.pos;
      wer.x = p.x; wer.y = p.y; wer.z = p.z; wer.yaw = z.yaw; wer.figur = figur;
      physik.schiebe(p.x, p.z, figur.motor.radius, z.vel.x, z.vel.z, p.y, figur.motor.hoehe);
      physik.update(dt); dinge.update(dt);
      interaktion.aktualisiere();
      const res = interaktion.halte(wer, dt, gehalten && !fenster.offen);
      for (const [d, mesh] of meshes) { const k = d.koerper; if (!k.ruht || mesh.position.y !== k.pos.y) mesh.position.set(k.pos.x, k.pos.y, k.pos.z); }
      hud.hinweis(res.ziel && !fenster.offen ? (res.ziel.dauer > 0 ? `E halten – ${res.ziel.text}` : `E – ${res.ziel.text}`) : '', res.ziel?.dauer > 0 && res.anteil > 0 ? res.anteil : null);
      hud.update(dt); ansicht.update(dt);
      return res.ziel;
    },
    zustand: () => ({ inv: inventar.zustand(), dinge: dinge.zustand() }),
    dispose() {
      for (const a of ab) a();
      ansicht.dispose(); fenster.dispose(); hud.dispose(); dinge.dispose(); physik.dispose(); interaktion.dispose(); inventar.dispose(); ereignisse.dispose();
      for (const g of Object.values(geos)) g.dispose();
      for (const m of Object.values(mats)) m.dispose();
      gruppe.removeFromParent();
    },
  };
}
