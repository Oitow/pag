// Enklave – was wo steht: Plan-Plätze (art → Bau-Fabrik) plus Wegrand (Laternen alle ~25 m, Wegweiser, Bänke) und etwas Kleinkram.
// Liefert reine Platzierungen { key, fabrik, x, z, winkel, schatten, art } – gezeichnet/kollidiert wird in stadt.js.
import { asset, kasten } from '../../../engine/models/bau/bau-basis.js';
import { createHaus } from '../../../engine/models/bau/haus.js';
import { createTaverne } from '../../../engine/models/bau/taverne.js';
import { createSchmiede } from '../../../engine/models/bau/schmiede.js';
import { createWachturm } from '../../../engine/models/bau/wachturm.js';
import { createTempel } from '../../../engine/models/bau/tempel.js';
import { createMauer, createMauerTurm, createTorhaus } from '../../../engine/models/bau/mauer.js';
import { createMarktstand, createBrunnen, createBank } from '../../../engine/models/bau/markt.js';
import { createFass, createKiste } from '../../../engine/models/bau/vorrat.js';
import { createLaterne, createLagerfeuer } from '../../../engine/models/bau/licht.js';
import { createWegweiser, createSteinkreis } from '../../../engine/models/bau/wegbau.js';
import { createTrainingspuppe, createZielscheibe, createZelt, createAmboss } from '../../../engine/models/bau/uebung.js';
import { erzeugeAsset } from '../../../engine/models/natur/natur-assets.js';

/** Liegender Stamm (Natur-Asset totholz) als Bau-Asset: 2,4× vergrößert (≈ 5,5 m), begehbarer Kollisions-Kasten. */
function createStamm() {
  const a = erzeugeAsset('liegenderStamm', 3, {});
  a.geometrie.scale(2.4, 2.4, 2.4);
  return asset({ name: 'stamm', geometrie: a.geometrie, kollision: [kasten(0, 0, 2.6, 0.5, 0.7, { begehbar: true })], masse: { breite: 5.5, tiefe: 2.8, hoehe: 1.3 } });
}

// Gebäude und Mauer werfen Schatten, Kleinkram nur empfangen (Handy)
const GROSS = new Set(['haus', 'taverne', 'schmiede', 'tempel', 'wachturm', 'mauer', 'mauer-turm', 'torhaus']);
const FABRIK = {
  lagerfeuer: () => createLagerfeuer({ seed: 1 }), zelt: () => createZelt({ seed: 1 }), steinkreis: () => createSteinkreis({ seed: 1 }),
  stamm: () => createStamm(), puppe: () => createTrainingspuppe({ seed: 1 }), zielscheibe: () => createZielscheibe({ seed: 1 }),
  brunnen: () => createBrunnen({ seed: 1 }), taverne: () => createTaverne({ seed: 1 }), schmiede: () => createSchmiede({ seed: 1 }),
  tempel: () => createTempel({ seed: 1 }), wachturm: () => createWachturm({ seed: 1 }), 'mauer-turm': () => createMauerTurm({ seed: 1 }),
  torhaus: () => createTorhaus({ seed: 1 }),
};

const wegAbstand = (pf, i) => { let s = 0; for (let k = 1; k <= i; k++) s += Math.hypot(pf[2 * k] - pf[2 * k - 2], pf[2 * k + 1] - pf[2 * k - 1]); return s; };
const richtung = (pf, i, vor = 6) => { const j = Math.min(pf.length / 2 - 1, i + vor); return Math.atan2(pf[2 * j] - pf[2 * i], pf[2 * j + 1] - pf[2 * i + 1]); };

/** → Liste der Platzierungen. */
export function stadtPlatzierungen(plan) {
  const liste = [];
  const neu = (key, fabrik, x, z, winkel, art) => liste.push({ key, fabrik, x, z, winkel, art, schatten: GROSS.has(art) });
  for (const p of plan.plaetze()) {
    const a = p.art;
    if (a === 'strasse' || a === 'markt-platz') continue;                       // nur Boden (FLAG.WEG)
    if (a === 'haus') neu(`haus${p.variante}`, () => createHaus({ seed: 1, variante: p.variante }), p.x, p.z, p.winkel, a);
    else if (a === 'marktstand') neu(`stand${p.variante}`, () => createMarktstand({ seed: 1, variante: p.variante }), p.x, p.z, p.winkel, a);
    else if (a === 'mauer') neu(`mauer${p.sx.toFixed(3)}`, () => createMauer({ seed: 1, sx: p.sx }), p.x, p.z, p.winkel, a);
    else if (a === 'wegweiser') {       // zeigt den Weg entlang; zweites Brett zurück ins Tal
      const w = plan.pfad('hauptweg'), r = richtung(w.punkte, 0, 8);
      neu('wegweiser-tal', () => createWegweiser({ seed: 1, schilder: [{ winkel: r, text: 'Enklave →' }, { winkel: r + Math.PI, text: 'Lagerfeuer' }] }), p.x + 1.2, p.z, 0, a);
    } else if (FABRIK[a]) neu(a, FABRIK[a], p.x, p.z, p.winkel, a);
  }
  // Wegrand: Laterne alle ~25 m, ab dem Tal-Ausgang, abwechselnd links/rechts
  const w = plan.pfad('hauptweg'), pf = w.punkte, n = pf.length / 2;
  let naechste = 40, seite = 1;
  for (let i = 1; i < n; i++) {
    if (wegAbstand(pf, i) < naechste) continue;
    naechste += 25; seite = -seite;
    const r = richtung(pf, i, 2);
    neu('laterne', () => createLaterne({ seed: 1 }), pf[2 * i] + Math.cos(r) * 2.6 * seite, pf[2 * i + 1] - Math.sin(r) * 2.6 * seite, r, 'laterne');
  }
  // Letztes Wegstück vor dem Tor: dichter gestellte Laternen-Pfähle (alle ~9 m, abwechselnd)
  const gesamt = wegAbstand(pf, n - 1);
  for (let i = 1, s2 = 1, naechst = gesamt - 34; i < n; i++) {
    if (wegAbstand(pf, i) < naechst) continue;
    naechst += 9; s2 = -s2;
    const r = richtung(pf, Math.max(0, i - 1), 2);
    neu('laterne', () => createLaterne({ seed: 1 }), pf[2 * i] + Math.cos(r) * 2.4 * s2, pf[2 * i + 1] - Math.sin(r) * 2.4 * s2, r, 'laterne');
  }
  // Wegweiser an den Kurven des Pfads (Kontrollpunkte aus dem Plan, nächster Wegpunkt); vorwärts = Richtung Enklave
  const steuer = plan.plan.pfade.find((q) => q.id === 'hauptweg').punkte;
  const naechster = (x, z) => { let b = 0, bd = Infinity; for (let i = 0; i < n; i++) { const d = (pf[2 * i] - x) ** 2 + (pf[2 * i + 1] - z) ** 2; if (d < bd) { bd = d; b = i; } } return b; };
  const SCHILDER = [[2, 'Enklave →', 'Lagerfeuer'], [6, 'Aussicht', 'Lagerfeuer'], [11, 'Enklave →', 'Aussicht']];
  SCHILDER.forEach(([k, vor, zurueck], nr) => {
    const i = naechster(steuer[k][0], steuer[k][1]), r = richtung(pf, i, 6), seite = nr % 2 ? -1 : 1;
    neu(`wegweiser-${nr}`, () => createWegweiser({ seed: 1, schilder: [{ winkel: r, text: vor }, { winkel: r + Math.PI, text: zurueck }] }), pf[2 * i] + Math.cos(r) * 2.4 * seite, pf[2 * i + 1] - Math.sin(r) * 2.4 * seite, 0, 'wegweiser');
  });
  // Aussicht: zwei Bänke, Wegweiser mit Blick zur Enklave
  const au = plan.zone('aussicht');
  for (const s of [-1, 1]) neu('bank', () => createBank({ seed: 1 }), au.x + s * 2.6, au.z + 1.2, Math.PI / 2 + s * 0.3, 'bank');
  // Kleinkram: Fässer und Kisten bei Taverne, Schmiede und Markt (lokal zum Gebäude)
  const kl = (id, lx, lz, art, fabrik, key) => { const p = plan.platz(id), q = plan.lokalZuWelt(p, lx, lz); neu(key, fabrik, q.x, q.z, p.winkel, art); };
  kl('taverne', 3.2, 4.9, 'fass', () => createFass({ seed: 1 }), 'fass'); kl('taverne', -3.4, 4.9, 'fass', () => createFass({ seed: 1 }), 'fass');
  kl('schmiede', -2.6, 3.9, 'kiste', () => createKiste({ seed: 1 }), 'kiste'); kl('stand-1', 1.8, 0.4, 'kiste', () => createKiste({ seed: 1 }), 'kiste');
  kl('stand-2', -1.8, 0.4, 'fass', () => createFass({ seed: 1 }), 'fass'); kl('stand-4', -1.8, 0.4, 'kiste', () => createKiste({ seed: 1, variante: 1 }), 'kiste1');
  kl('schmiede', 2.3, 0.6, 'amboss', () => createAmboss({ seed: 1 }), 'amboss');
  kl('brunnen', 3.4, 0, 'bank', () => createBank({ seed: 1 }), 'bank'); kl('brunnen', -3.4, 0, 'bank', () => createBank({ seed: 1 }), 'bank');
  return liste;
}
