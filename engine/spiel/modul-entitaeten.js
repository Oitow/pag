/**
 * @modul    modul-entitaeten
 * @zweck    Spiel-Modul 'entitaeten': stabile IDs, Leben/Schaden über die Befehls-Schicht (gameplay/befehle), Ereignisse ent:* auf dem Spiel-Bus, schwebende Schadenszahlen + Lebensbalken über getroffenen Zielen (mit 'render')
 * @api      ENTITAETEN_MODUL ; createEntitaetenModul() -> modul, start(ctx) -> { neu({art,team,pos,radius,leben,name,daten})->id, hole(id), entferne(id), bewege(id,x,y,z), imUmkreis(x,z,r,{team,ausser,art}), schade(id,{menge,element,quelle,stoss:{x,z,kraft}})->echt, heile(id,menge,quelle?)->echt, befehle, alle(), kern, aenderungenSeit(takt), takt }
 * @beispiel
 *   import { ENTITAETEN_MODUL } from '../../engine/spiel/modul-entitaeten.js';
 *   const ents = kern.api('entitaeten');
 *   const id = ents.neu({ art: 'gegner', team: 'feind', pos: { x, y, z }, leben: 40, name: 'Wolf', daten: { hoehe: 0.9, werte: { ruestung: 20 } } });
 *   ents.schade(id, { menge: 12, element: 'feuer', quelle: spieler.id, stoss: { x: 0, z: 1, kraft: 6 } });   // → ent:treffer / ent:tod
 * @tags     spiel, modul, entitaet, leben, schaden, befehl, mmo, treffer, lebensbalken
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 *
 * stoss: x,z = RICHTUNG (wird normiert), kraft = m/s. Er wird nur im Ereignis ent:treffer weitergereicht – wer Körper hat (gegner), wendet ihn an.
 * Optionen: { zahlen: true, balken: true, balkenZeit: 6 (s nach letztem Treffer), takt: 1/20 (Befehls-Takt) }.
 */
import { createEntitaeten } from '../core/entitaeten.js';
import { createBefehle } from '../gameplay/befehle.js';
import { createTrefferZahlen } from '../ui/treffer-zahlen.js';
import { createFigurSchilder } from '../ui/figur-schild.js';
import { createZielRahmen } from '../ui/ziel-rahmen.js';

const FARBE = { feuer: '#ff9a4a', eis: '#9fe3ff', blitz: '#fff27a', natur: '#a6e07a', arkan: '#d79bff', schatten: '#b58cff', heilig: '#ffe9a8' };
const MAX_BALKEN = 24;

/** Fabrik: jedes Spiel bekommt einen eigenen Modul-Zustand (zustand/dispose laufen im Kern ohne ctx). */
export function createEntitaetenModul() {
  let intern = null;
  return {
  name: 'entitaeten', braucht: [], optional: ['render'],
  standard: { zahlen: true, balken: true, balkenZeit: 6, takt: 1 / 20, zielRahmen: true },   // 1.1: zielRahmen:false (Erlenwacht: Oberfläche zeigt ihn)
  start(ctx) {
    const o = ctx.optionen, bus = ctx.ereignisse;
    const ents = createEntitaeten({ ereignisse: bus });
    const befehle = createBefehle({ entitaeten: ents, ereignisse: bus, seed: ctx.seed, takt: o.takt });
    const render = ctx.optional('render');
    const ui = render?.ui && globalThis.document ? render.ui : null;
    const zahlen = ui && o.zahlen ? createTrefferZahlen({ eltern: ui, max: 28, seed: ctx.seed }) : null;
    const schilder = ui && o.balken ? createFigurSchilder({ wurzel: ui, maxAbstand: 40, ausblendAb: 28 }) : null;
    const balken = new Map();      // id → { schild, rest }
    let rahmen = null, rahmenId = null;
    const ab = [];

    const kopf = (e) => e.pos.y + (e.daten?.hoehe ?? Math.max(0.5, e.radius * 2.2));
    ab.push(bus.an('ent:treffer', (d) => {
      const e = ents.hole(d.id);
      if (!e) return;
      if (zahlen) {
        const farbe = e.team === 'spieler' ? '#ff5a4a' : d.krit ? '#ffd870' : FARBE[d.element] || '#ffffff';
        zahlen.zeige({ x: e.pos.x, y: kopf(e) + 0.2, z: e.pos.z }, `${d.krit ? '✦' : ''}${Math.round(d.menge)}`, { farbe, groesse: d.krit ? 1.5 : 1 });
      }
      if (!schilder || e.team === 'spieler') return;
      let b = balken.get(d.id);
      if (!b && balken.size < MAX_BALKEN) {
        const ziel = { x: 0, y: 0, z: 0 };
        const pos = () => { const x = ents.hole(d.id); if (x) { ziel.x = x.pos.x; ziel.y = kopf(x); ziel.z = x.pos.z; } return ziel; };
        b = { schild: schilder.neu(pos, { leben: 1, farbe: e.team === 'feind' ? '#d94a3a' : '#5fbf5a', versatz: 0.15 }), rest: 0 };
        balken.set(d.id, b);
      }
      if (b) { b.rest = o.balkenZeit; b.schild.setLeben(e.leben / e.lebenMax); }
    }));
    ab.push(bus.an('ent:heil', (d) => {
      const e = ents.hole(d.id);
      if (e && zahlen) zahlen.zeige({ x: e.pos.x, y: kopf(e) + 0.2, z: e.pos.z }, `+${Math.round(d.menge)}`, { farbe: '#7dff8a' });
      const b = balken.get(d.id); if (b && e) b.schild.setLeben(e.leben / e.lebenMax);
    }));
    const wegBalken = (id) => { const b = balken.get(id); if (b) { b.schild.entfernen(); balken.delete(id); } };
    ab.push(bus.an('ent:weg', (d) => wegBalken(d.id)));

    function schade(id, { menge = 0, element = null, quelle = null, stoss = null, krit, reichweite } = {}) {
      const erg = befehle.fuehre({ von: quelle, art: 'schaden', daten: { ziel: id, menge, element, stoss, krit, reichweite } });
      return erg.ok ? erg.menge : 0;
    }
    function heile(id, menge, quelle = null) {
      const erg = befehle.fuehre({ von: quelle, art: 'heilen', daten: { ziel: id, menge } });
      return erg.ok ? erg.menge : 0;
    }

    intern = {
      fest: (dt) => befehle.update(dt),
      spaet(dt) {
        const kamera = render?.kamera;
        for (const [id, b] of balken) if ((b.rest -= dt) <= 0) wegBalken(id);
        if (kamera) { zahlen?.update(kamera, dt); schilder?.update(kamera, dt); }
        // Ziel-Rahmen für das Lock-On-Ziel des Spielers (falls Modul spieler da ist)
        const z = ctx.optional('spieler')?.ziel;
        const e = z ? ents.hole(typeof z === 'string' ? z : z.id) : null;
        if (e && ui && !rahmen && ctx.optionen.zielRahmen !== false) rahmen = createZielRahmen({ eltern: ui, ecke: 'oben-mitte', breite: 200 });
        if (rahmen) {
          if (e) rahmen.zeige({ name: e.name || e.art, leben: e.leben, lebenMax: e.lebenMax, feindlich: e.team === 'feind' });
          else if (rahmenId) rahmen.zeige(null);
          rahmenId = e?.id || null;
          rahmen.update(dt);
        }
      },
      dispose() { for (const f of ab) f(); for (const id of [...balken.keys()]) wegBalken(id); zahlen?.dispose(); schilder?.dispose(); rahmen?.dispose(); befehle.dispose(); ents.dispose(); },
      zustand: () => ({ e: ents.zustand(), b: befehle.zustand() }),
      lade(z) { if (z?.e) ents.lade(z.e); if (z?.b) befehle.lade(z.b); },
    };
    return {
      neu: ents.neu, hole: ents.hole, entferne: ents.entferne, bewege: ents.bewege, imUmkreis: (x, z, r, f = {}) => ents.imUmkreis(x, z, r, f, []),
      naechster: ents.naechster, aendere: ents.aendere, belebe: ents.belebe, schade, heile, befehle, alle: ents.alle,
      kern: ents, aenderungenSeit: ents.aenderungenSeit, get takt() { return ents.takt; }, get anzahl() { return ents.anzahl; },
    };
  },
  fest(dt) { intern?.fest(dt); },
  spaet(dt) { intern?.spaet(dt); },
  zustand() { return intern?.zustand() ?? null; },
  lade(z) { intern?.lade(z); },
  dispose() { intern?.dispose(); intern = null; },
  };
}
export const ENTITAETEN_MODUL = createEntitaetenModul();
