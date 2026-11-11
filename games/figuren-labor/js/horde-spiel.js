// Figuren-Labor – Rattenplage: Wellen aus Ratten, Riesenratten und einem Rattenkönig zum Ausprobieren der Flächenzauber.
// Logik: engine/gameplay/horde · Bild: engine/render/horde-mesh + engine/models/kreaturen/ratte.
import { createHorde } from '../../../engine/gameplay/horde.js';
import { createHordeMesh } from '../../../engine/render/horde-mesh.js';
import { createRatte } from '../../../engine/models/kreaturen/ratte.js';

/** Welle n (ab 1): wie viele von welcher Art. */
function welle(n) {
  return { ratte: 18 + n * 10, riesenratte: n >= 2 ? n - 1 : 0, rattenkoenig: n % 5 === 0 ? 1 : 0 };
}

/** opts: { szene, welt (Adapter), spieler, seed, klang, onBiss(schaden, wesen) -> true wenn Spieler gefallen, onMeldung(text) } */
export function createHordeSpiel({ szene, welt, spieler, seed = 1, klang = null, onBiss = () => false, onMeldung = () => {} }) {
  const horde = createHorde({ seed, welt, max: 160 });
  const ratte = createRatte({ seed });
  const bild = createHordeMesh({ modelle: { ratte: ratte.frames }, max: 160 });
  szene.add(bild.gruppe);
  const st = { an: false, welle: 0, pause: 0, bestes: 0 };
  const zielObj = { x: 0, y: 0, z: 0, radius: 0.35 };
  let quiekUhr = 0, bissSchutz = 0;

  function naechsteWelle() {
    st.welle++;
    const w = welle(st.welle), p = spieler.zustand.pos;
    // aus zwei Richtungen, ab Welle 3 von überall
    const rund = st.welle >= 3, winkel = (st.welle * 2.1) % 6.283;
    for (const [art, n] of Object.entries(w)) {
      if (!n) continue;
      if (rund) horde.spawneRing(art, n, p, { radius: 20, breite: 8 });
      else {
        horde.spawneRing(art, Math.ceil(n / 2), p, { radius: 18, breite: 6, winkel, bogen: 1 });
        horde.spawneRing(art, Math.floor(n / 2), p, { radius: 18, breite: 6, winkel: winkel + 2.6, bogen: 1 });
      }
    }
    onMeldung(`🐀 Welle ${st.welle}: ${horde.anzahl} Ratten${w.rattenkoenig ? ' + Rattenkönig!' : ''}`);
    klang?.spiele('quiek', { staerke: 1.4, tonhoehe: 0.7 });
  }

  return {
    horde, zustand: st,
    get an() { return st.an; },
    start() { horde.leeren(); st.an = true; st.welle = 0; st.pause = 1.2; onMeldung('🐀 Rattenplage! Halte den Zauber für mehr Wucht.'); },
    stopp() { st.an = false; horde.leeren(); bild.update(horde.wesen); },
    /** Spieler ist gefallen: Horde zieht sich zurück, Plage beginnt neu. */
    niederlage() {
      st.bestes = Math.max(st.bestes, st.welle);
      onMeldung(`Überrannt in Welle ${st.welle} – ${horde.getoetet} Ratten erledigt`);
      horde.leeren(); st.welle = 0; st.pause = 4;
    },
    update(dt, zielAn = true) {
      if (!st.an && !horde.wesen.length) return;
      if (bissSchutz > 0) bissSchutz -= dt;
      const p = spieler.zustand.pos;
      zielObj.x = p.x; zielObj.y = p.y; zielObj.z = p.z;
      for (const e of horde.update(dt, st.an && zielAn ? zielObj : null)) {
        if (e.typ !== 'biss') continue;
        if (bissSchutz > 0) continue;                       // höchstens ein Biss alle 0,15 s zählt – sonst ist man in 2 s tot
        bissSchutz = 0.15;
        klang?.spiele('biss', { staerke: 0.6, tonhoehe: 1.3 / Math.sqrt(e.wesen.skala) });
        if (onBiss(e.schaden, e.wesen)) { this.niederlage(); break; }
      }
      if (st.an && horde.anzahl > 0 && (quiekUhr -= dt) <= 0) {
        quiekUhr = 0.6 + 2.5 / Math.max(1, horde.anzahl / 6);
        klang?.spiele('quiek', { staerke: 0.25, tonhoehe: 0.8 + (quiekUhr % 0.4) });
      }
      if (st.an && horde.anzahl <= 2 && (st.pause -= dt) <= 0) { naechsteWelle(); st.pause = 2.5; }
      bild.update(horde.wesen);
    },
    dispose() { bild.dispose(); ratte.dispose(); horde.dispose(); },
  };
}
