/**
 * @modul    zauber-gross
 * @zweck    Großzauber fürs Zauber-Modul in der großen Welt: Logik (gameplay/grosszauber + welle/wand/sturm/riss) und Bild (render/grosszauber-*); Erdwall-Pfeiler werden echte Körper in welt.kollision, die Flutwelle macht den Boden nass, Zyklon/Erdriss legen Wind/Feuer auf den Boden (Element-Reaktionen)
 * @api      createZauberGross({szene,welt,fx,amBoden,treffer,spieler,seed}) -> { wirke(e) -> id|null, fest(dt,ziele), update(dt), logik, weltAdapter, dispose() }
 * @beispiel
 *   import { createZauberGross } from '../../engine/spiel/zauber-gross.js';
 *   const gross = createZauberGross({ szene, welt, fx, amBoden, treffer, spieler });
 *   gross.wirke(ereignisVomZauberbuch);   // e.typ === 'gross'
 * @tags     spiel, zauber, großzauber, welle, wand, sturm, riss, kollision, welt, element
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 *
 * weltAdapter: welt + Großzauber (bodenHoehe mit Gräben/Podesten, wasserHoehe mit Flut, hindernisse mit Wänden) für Module, die ihn nutzen wollen.
 * welt selbst wird nicht verändert (das Gelände-Streaming liest das Grund-Gelände).
 */
import { createGrosszauber } from '../gameplay/grosszauber.js';
import { createWelle } from '../gameplay/grosszauber-welle.js';
import { createWand } from '../gameplay/grosszauber-wand.js';
import { createSturm } from '../gameplay/grosszauber-sturm.js';
import { createRiss } from '../gameplay/grosszauber-riss.js';
import { createGrosszauberMesh } from '../render/grosszauber-mesh.js';
import { createWelleAnsicht } from '../render/grosszauber-welle.js';
import { createWandAnsicht } from '../render/grosszauber-wand.js';
import { createSturmAnsicht } from '../render/grosszauber-sturm.js';
import { createRissAnsicht } from '../render/grosszauber-riss.js';

const WAND_MIN = 1.2;   // ab dieser Höhe ist ein Pfeiler ein Körper in welt.kollision

export function createZauberGross({ szene, welt, fx, amBoden = () => {}, treffer = () => {}, spieler = null, seed = 1 } = {}) {
  const basis = { bodenHoehe: (x, z) => welt.bodenHoehe(x, z), wasserHoehe: (x, z) => welt.wasserHoehe?.(x, z) ?? -Infinity, hindernisse: (...a) => welt.hindernisse?.(...a) ?? null };
  const logik = createGrosszauber({ arten: { welle: createWelle, wand: createWand, sturm: createSturm, riss: createRiss }, welt: basis, seed });
  const weltAdapter = logik.adapter(basis);
  const bilder = createGrosszauberMesh({ arten: { welle: createWelleAnsicht, wand: createWandAnsicht, sturm: createSturmAnsicht, riss: createRissAnsicht }, welt: basis });
  szene.add(bilder.gruppe);
  const defs = new Map();       // id → Zauber-Daten
  const koerper = new Map();    // id → Map(segment → kollisions-id)
  const uhr = new Map();        // id → s bis zum nächsten Boden-Takt
  const kol = welt.kollision?.fuege ? welt.kollision : null;

  function wirke(e) {
    const id = logik.wirke(e.def.gross?.art, { von: e.von, punkt: e.punkt, yaw: e.yaw, kraft: e.kraft, def: { ...e.def, ...e.def.gross }, quelle: 'spieler' });
    if (id != null) { defs.set(id, e.def); uhr.set(id, 0); }
    return id;
  }

  /** Erdwall: Pfeiler als Kästen in die Kollisions-Welt, beim Zerfallen wieder heraus. */
  function wandKoerper(a) {
    if (!kol) return;
    let m = koerper.get(a.id);
    if (!m) koerper.set(a.id, (m = new Map()));
    const zerfaellt = a.inst.daten.phase === 'zerfaellt';
    for (const s of a.inst.daten.segmente) {
      const steht = !zerfaellt && s.hoehe >= WAND_MIN;
      if (steht && !m.has(s)) m.set(s, kol.fuege({ form: 'kasten', x: s.x, z: s.z, bx: s.breite / 2, bz: s.dicke / 2, winkel: s.yaw, hoehe: s.hoeheZiel, daten: { art: 'erdwall' } }));
      else if (!steht && m.has(s)) { kol.entferne(m.get(s)); m.delete(s); }
    }
  }
  function raeume(id) {
    const m = koerper.get(id);
    if (m && kol) for (const k of m.values()) kol.entferne(k);
    koerper.delete(id); defs.delete(id); uhr.delete(id);
  }

  /** Großzauber legen ihr Element auf den Boden (Flut = nass, Zyklon = Wind, Erdriss = Feuer). */
  function bodenTakt(a, dt) {
    const t = (uhr.get(a.id) ?? 0) - dt;
    if (t > 0) { uhr.set(a.id, t); return; }
    uhr.set(a.id, 0.3);
    const d = a.inst.daten, def = defs.get(a.id) || {};
    if (a.art === 'welle' && d.mitte && (d.hoehe > 0.3 || d.flut > 0.2)) {
      const qx = -d.richtung.z, qz = d.richtung.x, b = d.breite || 20;
      for (const s of [-0.33, 0, 0.33]) amBoden({ ...def, element: 'wasser' }, { x: d.mitte.x + qx * b * s, z: d.mitte.z + qz * b * s }, b * 0.22);
    } else if (a.art === 'sturm' && d.pos) amBoden({ ...def, element: 'wind' }, d.pos, d.fuss || 4);
    else if (a.art === 'riss' && d.glut > 0.5 && d.risse?.[0]?.pkt?.length) {
      const pk = d.risse[0].pkt;   // Brandfleck an der Riss-Spitze
      let p = pk[0];
      for (const q of pk) if (q.t <= d.alter) p = q;
      amBoden({ ...def, element: 'feuer' }, p, 2.5);
    }
  }

  function ereignis(e) {
    const def = defs.get(e.id) || { farbe: 0xffffff, element: 'erde' };
    for (const t of e.treffer) treffer(t, def);
    if (e.typ === 'blitz' && e.punkte?.length > 1) fx.blitz(e.punkte, { farbe: 0xdff0ff, dauer: 0.25 });
    else if (e.typ === 'beben') {
      const p = spieler?.figur?.zustand?.pos || spieler?.position;
      const d = e.pos && p ? Math.hypot(e.pos.x - p.x, e.pos.z - p.z) : 0;
      spieler?.kamera?.schuetteln?.((e.staerke ?? 1) / (1 + d / 18), e.dauer ?? 0.4);
    } else if (e.typ === 'funken') fx.funken(e.pos, e.opts || {});
    else if (e.typ === 'ring') fx.ring(e.pos, e.opts || {});
    else if (e.typ === 'ende') raeume(e.id);
  }

  return {
    logik, weltAdapter, wirke,
    fest(dt, ziele) {
      for (const e of logik.update(dt, ziele)) ereignis(e);
      for (const a of logik.aktive) { if (a.art === 'wand') wandKoerper(a); bodenTakt(a, dt); }
    },
    update(dt) { bilder.update(dt, logik.aktive); },
    dispose() {
      for (const id of [...koerper.keys()]) raeume(id);
      logik.dispose(); bilder.dispose(); szene.remove(bilder.gruppe);
    },
  };
}
