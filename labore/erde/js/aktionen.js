// Spieler-Aktionen in der Welt (reine Logik, ohne THREE): Graben, Aufschütten, Ernten (Fällen, Pflücken, Abbauen).
// Verbindet die Regeln (boden.js, ernte.js) mit Welt-Zustand (eingriffe.js) und Inventar (engine/gameplay/inventar).
// Ziele kommen als Weltpunkte {x,y,z} (m, Planetenmitte = 0). Alles liefert { ok, text } für die Meldung.
import { schichten, stoffInTiefe, grabung, STOFFE } from './boden.js';
import { NAMEN, HACKE, AXT, FUND_STUFE, hackeName, stufe } from './herstellen-daten.js';
import { ernte } from './ernte.js';
import { biom } from './klima.js';

export const GRAB_RADIUS = 1.1, GRAB_TIEFE = 0.5;
// Was man aufschütten kann (Reihenfolge = was zuerst verbraucht wird)
const BAUSTOFFE = ['humus', 'lehm', 'sand', 'kies', 'roterLehm', 'torf', 'steine', 'sandstein', 'kalkstein', 'schiefer', 'granit', 'basalt', 'schnee'];
const NAME = (id) => STOFFE[id]?.name || NAMEN[id] || ({ holz: 'Holz', rinde: 'Rinde', ruten: 'Ruten', oliven: 'Oliven', zapfen: 'Zapfen', kokosnuss: 'Kokosnuss',
  stoecke: 'Stöcke', beeren: 'Beeren', fasern: 'Fasern', schilf: 'Schilf', moos: 'Moos', laub: 'Laub', blume: 'Blume', pilz: 'Pilz',
  steinpilz: 'Steinpilz', seerose: 'Seerose', kaktusfleisch: 'Kaktusfleisch', fisch: 'Fisch', steine: 'Steine', schieferplatten: 'Schieferplatten', wolle: 'Wollgras-Wolle', flechten: 'Flechten',
  axt: 'Axt', schaufel: 'Schaufel', spitzhacke: 'Spitzhacke', eisenhacke: 'Eisen-Spitzhacke' }[id] || id);
export { NAME as gegenstandName };

/**
 * planet = createPlanetHoehe (mit eingriffe), eingriffe = createEingriffe, natur = createNatur (finde),
 * inventar = createInventar, seed, beiEingriff(e) = Gelände neu bauen + an Worker schicken, beiEntfernen() = Natur neu aufbauen.
 */
export const VOXEL_GRAB_R = 0.85, VOXEL_AUF_R = 0.75;
/** voxel = createVoxelErde (optional): dann gräbt man in Blickrichtung (Gruben, Tunnel) statt das Höhenfeld abzusenken. */
export function createAktionen({ planet, eingriffe, natur, inventar, seed = 1, voxel = null, beiVoxel = () => {}, beiEingriff = () => {}, beiEntfernen = () => {} }) {
  const R = planet.radius;
  // axt = Stufe 0…3 (0 = keine), hacke = Stufe 0…4 (Stein 2, Kupfer 3, Eisen 4) – Tabellen in herstellen-daten.js
  const hat = (id) => inventar.hat(id, 1);
  const werkzeug = () => ({ axt: stufe(AXT, hat), schaufel: hat('schaufel'), hacke: stufe(HACKE, hat) });

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

  // Kleines Grünzeug im Umkreis mit wegräumen (sonst bleibt es über dem Loch hängen / steckt im Aufgeschütteten)
  function raeumeKleines(p, umkreis) {
    const liste = natur.kleineIm ? natur.kleineIm(p, umkreis) : [];
    for (const o of liste) eingriffe.entferne(o.id);
    if (liste.length) beiEntfernen();
  }

  function graben(p, blickR = null) {
    if (voxel && blickR) return grabenVoxel(p, blickR);
    const o = naturImWeg(p);
    if (o && (o.r > 0.5 || o.art === 'granitblock')) return { ok: false, text: `Erst ${o.art} wegräumen` };
    const u = untergrund(p);
    const hacke = werkzeug().hacke;
    const g = grabung(u.stoff, [p.x, p.y, p.z], u.tiefe, hacke, seed);
    if (!g.ok) return { ok: false, text: `${NAME(u.stoff)}: ${STOFFE[u.stoff] ? hackeName(STOFFE[u.stoff].haerte) + ' nötig' : g.grund}` };
    if (o) { eingriffe.entferne(o.id); beiEntfernen(); }
    raeumeKleines(p, GRAB_RADIUS * 0.8);
    const e = eingriffe.setze(u.d, GRAB_RADIUS, -GRAB_TIEFE);
    beiEingriff(e);
    inventar.gib(g.stoff, g.menge);
    let text = `+${g.menge} ${NAME(g.stoff)}`;
    if (g.fund && (FUND_STUFE[g.fund] || 0) > hacke) text += ` · ${NAME(g.fund)} im Fels – ${hackeName(FUND_STUFE[g.fund])} nötig`;
    else if (g.fund) { inventar.gib(g.fund, 1); text += ` · Fund: ${NAME(g.fund)}!`; }
    return { ok: true, text };
  }

  /** Graben in Blickrichtung: Kugel aus dem Voxel-Boden, Stoff = was dort wirklich liegt (Schichten, Gestein). */
  function grabenVoxel(p, richtung) {
    const o = naturImWeg(p);
    if (o && (o.r > 0.5 || o.art === 'granitblock')) return { ok: false, text: `Erst ${o.art} wegräumen` };
    const u = untergrund(p), tiefe = voxel.tiefe(p);
    const stoff = voxel.stoffAm(p, richtung) ?? stoffInTiefe(u.schichten, tiefe + 0.25);
    const hacke = werkzeug().hacke;
    const g = grabung(stoff, [p.x, p.y, p.z], tiefe, hacke, seed);
    if (!g.ok) return { ok: false, text: `${NAME(stoff)}: ${STOFFE[stoff] ? hackeName(STOFFE[stoff].haerte) + ' nötig' : g.grund}` };
    if (o) { eingriffe.entferne(o.id); beiEntfernen(); }
    raeumeKleines(p, VOXEL_GRAB_R + 0.3);   // Gras/Blumen in der Grube schweben sonst in der Luft
    voxel.eingriff('weg', { x: p.x + richtung.x * 0.35, y: p.y + richtung.y * 0.35, z: p.z + richtung.z * 0.35 }, VOXEL_GRAB_R);
    beiVoxel();
    inventar.gib(g.stoff, g.menge);
    let text = `+${g.menge} ${NAME(g.stoff)}` + (tiefe > 1.5 ? ` · ${tiefe.toFixed(1)} m tief` : '');
    if (g.fund && (FUND_STUFE[g.fund] || 0) > hacke) text += ` · ${NAME(g.fund)} im Fels – ${hackeName(FUND_STUFE[g.fund])} nötig`;
    else if (g.fund) { inventar.gib(g.fund, 1); text += ` · Fund: ${NAME(g.fund)}!`; }
    return { ok: true, text };
  }

  function bauen(p, blickR = null) {
    const stoff = BAUSTOFFE.find((s) => inventar.hat(s, 1));
    if (!stoff) return { ok: false, text: 'Nichts zum Aufschütten (erst graben)' };
    if (voxel && blickR) {   // vor die getroffene Fläche setzen (Richtung Spieler)
      inventar.nimm(stoff, 1);
      const o = natur.finde(p, GRAB_RADIUS * 0.5);
      if (o && o.r <= 0.5) { eingriffe.entferne(o.id); beiEntfernen(); }
      raeumeKleines(p, VOXEL_AUF_R + 0.2);   // zugeschüttet
      voxel.eingriff('fest', { x: p.x - blickR.x * 0.45, y: p.y - blickR.y * 0.45, z: p.z - blickR.z * 0.45 }, VOXEL_AUF_R, stoff);
      beiVoxel();
      return { ok: true, text: `−1 ${NAME(stoff)} aufgeschüttet` };
    }
    const d = richtung(p);
    inventar.nimm(stoff, 1);
    const o = natur.finde(p, GRAB_RADIUS * 0.5);
    if (o && o.r <= 0.5) { eingriffe.entferne(o.id); beiEntfernen(); }   // Kleines wird zugeschüttet
    raeumeKleines(p, GRAB_RADIUS * 0.8);
    beiEingriff(eingriffe.setze(d, GRAB_RADIUS, GRAB_TIEFE));
    return { ok: true, text: `−1 ${NAME(stoff)} aufgeschüttet` };
  }

  /** Natur-Stück o (aus natur.finde) ernten. */
  function nehmen(o) {
    const e = ernte(o.art, o.s, werkzeug());
    if (!e.ok) return { ok: false, text: e.grund };
    eingriffe.entferne(o.id); beiEntfernen();
    for (const [id, n] of e.gibt) inventar.gib(id, n);
    return { ok: true, text: (e.baum ? 'Gefällt: ' : '') + e.gibt.map(([id, n]) => `+${n} ${NAME(id)}`).join(' · ') +
      (e.verpasst || []).map((v) => ` · ${NAME(v.id)} – ${hackeName(v.stufe)} nötig`).join('') };
  }

  return { graben, bauen, nehmen, untergrund, werkzeug };
}
