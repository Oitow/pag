// Großzauber im Figuren-Labor: verbindet das Zauberbuch (Ereignis 'gross') mit engine/gameplay/grosszauber (Logik)
// und engine/render/grosszauber-mesh (Bild). Der Welt-Adapter wird an Ort und Stelle erweitert, damit Spieler, NPCs,
// Ratten und lose Körper sofort mit Wänden kollidieren, auf Podeste steigen und in Fluten schwimmen.
import { createGrosszauber } from '../../../engine/gameplay/grosszauber.js';
import { createGrosszauberMesh } from '../../../engine/render/grosszauber-mesh.js';
import { createWelle } from '../../../engine/gameplay/grosszauber-welle.js';
import { createWand } from '../../../engine/gameplay/grosszauber-wand.js';
import { createSturm } from '../../../engine/gameplay/grosszauber-sturm.js';
import { createRiss } from '../../../engine/gameplay/grosszauber-riss.js';
import { createWelleAnsicht } from '../../../engine/render/grosszauber-welle.js';
import { createWandAnsicht } from '../../../engine/render/grosszauber-wand.js';
import { createSturmAnsicht } from '../../../engine/render/grosszauber-sturm.js';
import { createRissAnsicht } from '../../../engine/render/grosszauber-riss.js';

export function createGrosszauberSpiel({ szene, adapter, kamera, klang = null, zauber, spieler, seed = 1, onMeldung = () => {} }) {
  const basis = { ...adapter };   // Grund-Gelände ohne Großzauber
  const logik = createGrosszauber({ arten: { welle: createWelle, wand: createWand, sturm: createSturm, riss: createRiss }, welt: basis, seed });
  Object.assign(adapter, logik.adapter(basis));
  const bilder = createGrosszauberMesh({ arten: { welle: createWelleAnsicht, wand: createWandAnsicht, sturm: createSturmAnsicht, riss: createRissAnsicht }, welt: basis });
  szene.add(bilder.gruppe);

  /** Vom Zauberbuch: e = { typ:'gross', def, kraft, von, punkt, yaw }. */
  const defs = new Map();   // id → Zauber-Daten (Farbe für Zahlen/Funken)
  function wirke(e) {
    const id = logik.wirke(e.def.gross?.art, { von: e.von, punkt: e.punkt, yaw: e.yaw, kraft: e.kraft, def: { ...e.def, ...e.def.gross }, quelle: 'spieler' });
    if (id != null) defs.set(id, e.def);
    return id;
  }

  function ereignis(e, z) {
    const fx = z.fx, p = spieler.zustand.pos;
    const def = defs.get(e.id) || { farbe: 0xffffff };
    for (const t of e.treffer) z.schade(t, def);   // jedes Ereignis kann Treffer tragen ('treffer', 'blitz' …)
    if (e.typ === 'blitz' && e.punkte?.length > 1) fx.blitz(e.punkte, { farbe: 0xdff0ff, dicke: 0.25, dauer: 0.25 });
    else if (e.typ === 'beben') {
      const d = e.pos ? Math.hypot(e.pos.x - p.x, e.pos.z - p.z) : 0;
      kamera.schuetteln((e.staerke ?? 1) / (1 + d / 18), e.dauer ?? 0.4);
    } else if (e.typ === 'klang') klang?.spiele(e.name, { staerke: e.staerke, tonhoehe: e.tonhoehe, verzug: e.verzug });
    else if (e.typ === 'stopp') z.stopp(e.dauer ?? 0.05);
    else if (e.typ === 'funken') fx.funken(e.pos, e.opts || {});
    else if (e.typ === 'ring') fx.ring(e.pos, e.opts || {});
    else if (e.typ === 'meldung') onMeldung(e.text);
    else if (e.typ === 'ende') defs.delete(e.id);
  }

  return {
    logik, bilder, wirke,
    update(dt) {
      const z = zauber();
      for (const e of logik.update(dt, z.ziele)) ereignis(e, z);
      bilder.update(dt, logik.aktive);
    },
    dispose() { logik.dispose(); bilder.dispose(); szene.remove(bilder.gruppe); Object.assign(adapter, basis); },
  };
}
