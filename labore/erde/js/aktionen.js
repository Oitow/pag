// Spieler-Aktionen in der Welt (reine Logik, ohne THREE): Graben, Aufschütten, Ernten (Fällen, Pflücken, Abbauen).
// Verbindet die Regeln (boden.js, ernte.js) mit Welt-Zustand (eingriffe.js) und Inventar (engine/gameplay/inventar).
// Ziele kommen als Weltpunkte {x,y,z} (m, Planetenmitte = 0). Alles liefert { ok, text } für die Meldung.
import { schichten, stoffInTiefe, grabung, STOFFE } from './boden.js';
import { ernte } from './ernte.js';
import { biom } from './klima.js';

export const GRAB_RADIUS = 1.1, GRAB_TIEFE = 0.5;
// Was man aufschütten kann (Reihenfolge = was zuerst verbraucht wird)
const BAUSTOFFE = ['humus', 'lehm', 'sand', 'kies', 'roterLehm', 'torf', 'steine', 'sandstein', 'kalkstein', 'schiefer', 'granit', 'basalt', 'schnee'];
const NAME = (id) => STOFFE[id]?.name || ({ holz: 'Holz', rinde: 'Rinde', ruten: 'Ruten', oliven: 'Oliven', zapfen: 'Zapfen', kokosnuss: 'Kokosnuss',
  stoecke: 'Stöcke', beeren: 'Beeren', fasern: 'Fasern', schilf: 'Schilf', moos: 'Moos', laub: 'Laub', blume: 'Blume', pilz: 'Pilz',
  steinpilz: 'Steinpilz', seerose: 'Seerose', kaktusfleisch: 'Kaktusfleisch', fisch: 'Fisch', steine: 'Steine', schieferplatten: 'Schieferplatten',
  axt: 'Axt', schaufel: 'Schaufel', spitzhacke: 'Spitzhacke', eisenhacke: 'Eisen-Spitzhacke' }[id] || id);
export { NAME as gegenstandName };

/**
 * planet = createPlanetHoehe (mit eingriffe), eingriffe = createEingriffe, natur = createNatur (finde),
 * inventar = createInventar, seed, beiEingriff(e) = Gelände neu bauen + an Worker schicken, beiEntfernen() = Natur neu aufbauen.
 */
export function createAktionen({ planet, eingriffe, natur, inventar, seed = 1, beiEingriff = () => {}, beiEntfernen = () => {} }) {
  const R = planet.radius;
  const werkzeug = () => ({ axt: inventar.hat('axt', 1), schaufel: inventar.hat('schaufel', 1),
    hacke: inventar.hat('eisenhacke', 1) ? 3 : inventar.hat('spitzhacke', 1) ? 2 : inventar.hat('schaufel', 1) ? 1 : 0 });

  function richtung(p) { const l = Math.hypot(p.x, p.y, p.z); return [p.x / l, p.y / l, p.z / l]; }

  /** Hangneigung (tan) am Ort aus zwei Nachbarproben. */
  function steilAm(d) {
    const e = 2 / R, h0 = planet.probe(d[0], d[1], d[2], 1).h;
    const a = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const t1 = [d[1] * a[2] - d[2] * a[1], d[2] * a[0] - d[0] * a[2], d[0] * a[1] - d[1] * a[0]];
    const l = Math.hypot(...t1);
    const q = [d[0] + t1[0] / l * e, d[1] + t1[1] / l * e, d[2] + t1[2] / l * e], ql = Math.hypot(...q);
    return Math.abs(planet.probe(q[0] / ql, q[1] / ql, q[2] / ql, 1).h - h0) / 2;
  }

  /** Was liegt hier? → { schichten, tiefe (m unter Ursprung), stoff } */
  function untergrund(p) {
    const d = richtung(p);
    const pr = { ...planet.probe(d[0], d[1], d[2], 1) };
    const sch = schichten({ ...pr, h: pr.h - pr.eingriff }, biom(pr.temp, pr.feuchte), steilAm(d));
    const tiefe = Math.max(0, -pr.eingriff);
    return { d, pr, schichten: sch, tiefe, stoff: stoffInTiefe(sch, tiefe + GRAB_TIEFE * 0.5) };
  }

  /** Kleine Natur am Grabort verschwindet mit; Bäume/Felsen müssen erst weg. */
  function naturImWeg(p) {
    const o = natur.finde(p, GRAB_RADIUS * 0.6);
    return o;
  }

  function graben(p) {
    const o = naturImWeg(p);
    if (o && (o.r > 0.5 || o.art === 'granitblock')) return { ok: false, text: `Erst ${o.art} wegräumen` };
    const u = untergrund(p);
    const g = grabung(u.stoff, [p.x, p.y, p.z], u.tiefe, werkzeug().hacke, seed);
    if (!g.ok) return { ok: false, text: `${NAME(u.stoff)}: ${g.grund}` };
    if (o) { eingriffe.entferne(o.id); beiEntfernen(); }
    const e = eingriffe.setze(u.d, GRAB_RADIUS, -GRAB_TIEFE);
    beiEingriff(e);
    inventar.gib(g.stoff, g.menge);
    let text = `+${g.menge} ${NAME(g.stoff)}`;
    if (g.fund) { inventar.gib(g.fund, 1); text += ` · Fund: ${NAME(g.fund)}!`; }
    return { ok: true, text };
  }

  function bauen(p) {
    const stoff = BAUSTOFFE.find((s) => inventar.hat(s, 1));
    if (!stoff) return { ok: false, text: 'Nichts zum Aufschütten (erst graben)' };
    const d = richtung(p);
    inventar.nimm(stoff, 1);
    const o = natur.finde(p, GRAB_RADIUS * 0.5);
    if (o && o.r <= 0.5) { eingriffe.entferne(o.id); beiEntfernen(); }   // Kleines wird zugeschüttet
    beiEingriff(eingriffe.setze(d, GRAB_RADIUS, GRAB_TIEFE));
    return { ok: true, text: `−1 ${NAME(stoff)} aufgeschüttet` };
  }

  /** Natur-Stück o (aus natur.finde) ernten. */
  function nehmen(o) {
    const e = ernte(o.art, o.s, werkzeug());
    if (!e.ok) return { ok: false, text: e.grund };
    eingriffe.entferne(o.id); beiEntfernen();
    for (const [id, n] of e.gibt) inventar.gib(id, n);
    return { ok: true, text: (e.baum ? 'Gefällt: ' : '') + e.gibt.map(([id, n]) => `+${n} ${NAME(id)}`).join(' · ') };
  }

  return { graben, bauen, nehmen, untergrund, werkzeug };
}
