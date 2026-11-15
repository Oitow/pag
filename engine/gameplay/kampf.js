/**
 * @modul    kampf
 * @zweck    Kampf-Welt (Befehlsschicht): Kämpfer + Zustände + Bedrohung verbinden, schade/heile/gibZustand, DoT-Takte, DPS, Ereignisse
 * @api      createKampf({seed,ereignisse}) -> {melde(id,opts)->kaempfer,entferne(id),kaempfer(id),zustaende(id),alle(),feindlich(a,b),schade(paket)->ergebnis,heile({quelle,ziel,menge})->geheilt,gibZustand(ziel,name,opts),update(dt)->ereignisse,imKampf(id),dps(id,fenster),bedrohung,zustand(),laden(z),dispose()}
 * @beispiel
 *   import { createKampf } from '../../engine/gameplay/kampf.js';
 *   const k = createKampf({ seed: 7 });
 *   k.melde('held', { team: 1, leben: 100 }); k.melde('ork', { team: 2, leben: 50 });
 *   const e = k.schade({ quelle: 'held', ziel: 'ork', menge: 20, zustand: { name: 'brennen' } });
 *   for (const ev of k.update(1)) console.log(ev.typ); // kampf:treffer, kampf:tot, …
 * @tags     kampf, schaden, leben, buff, debuff, aggro, mmo, welt
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { hashSeed } from '../core/rng.js';
import { createKaempfer } from './kampf-werte.js';
import { createZustaende } from './zustaende.js';
import { createBedrohung } from './bedrohung.js';

const KAMPF_NACHLAUF = 5; // s „im Kampf“ nach letztem Treffer
const LOG_MAX = 60; // s Schadensprotokoll

export function createKampf({ seed = 1, ereignisse = null } = {}) {
  const eintraege = new Map(); // id -> { k, z, team, letzter }
  const bedrohung = createBedrohung();
  let zeit = 0, puffer = [], protokoll = []; // protokoll: { t, quelle, menge }

  function melde_(typ, daten) {
    puffer.push({ typ, ...daten });
    if (puffer.length > 1000) puffer.shift();
    ereignisse?.sende(typ, daten);
  }

  function abgleich(id) {
    const e = eintraege.get(id);
    if (!e) return;
    const f = e.z.faktoren();
    e.k.setzeMod('zustaende', { tempo: f.tempo, schadenFaktor: f.schadenFaktor, ruestung: f.ruestung, unverwundbar: f.unverwundbar });
  }

  const feindlich = (a, b) => {
    const x = eintraege.get(a), y = eintraege.get(b);
    return !!x && !!y && x.team !== y.team;
  };

  function melde(id, opts = {}) {
    entferne(id);
    const k = createKaempfer({ ...opts, id, team: opts.team ?? 0, seed: opts.seed ?? hashSeed(seed, id) });
    eintraege.set(id, { k, z: createZustaende(), team: k.team, letzter: -Infinity });
    return k;
  }

  function entferne(id) {
    const e = eintraege.get(id);
    if (!e) return;
    e.k.dispose(); e.z.dispose(); eintraege.delete(id);
    bedrohung.entferne(id);
  }

  function gibZustand(ziel, name, opts = {}) {
    const e = eintraege.get(ziel);
    if (!e || e.k.tot) return null;
    const eintrag = e.z.gib(name, opts);
    if (!eintrag) return null;
    abgleich(ziel);
    melde_('kampf:zustand', { ziel, name, quelle: eintrag.quelle, stapel: eintrag.stapel });
    return eintrag;
  }

  function schade(p) {
    const ziel = eintraege.get(p.ziel);
    const erg = { schaden: 0, abgefangen: 0, krit: false, ausgewichen: false, pariert: false, geblockt: false, taumelt: false, tot: false, leben: 0 };
    if (!ziel) return erg;
    abgleich(p.ziel);
    const q = p.quelle != null ? eintraege.get(p.quelle) : null;
    if (q) abgleich(p.quelle);
    const paket = { art: 'koerper', wucht: 10, bedrohung: 1, ...p };
    const r = ziel.k.nimmSchaden(paket, q ? q.k.werte : undefined);
    Object.assign(erg, r);
    const traf = r.schaden > 0 || r.abgefangen > 0;
    if (traf) {
      for (const ev of ziel.z.beiSchaden()) melde_('kampf:zustandEnde', { ziel: p.ziel, name: ev.name, grund: ev.grund });
      abgleich(p.ziel);
      const menge = r.schaden + r.abgefangen;
      if (p.quelle != null) {
        bedrohung.add(p.ziel, p.quelle, menge * paket.bedrohung);
        protokoll.push({ t: zeit, quelle: p.quelle, menge });
        if (q) q.letzter = zeit;
      }
      ziel.letzter = zeit;
    }
    melde_('kampf:treffer', { quelle: p.quelle ?? null, ziel: p.ziel, art: paket.art, ergebnis: erg });
    if (r.pariert) melde_('kampf:pariert', { quelle: p.quelle ?? null, ziel: p.ziel });
    if (r.taumelt) melde_('kampf:taumelt', { ziel: p.ziel });
    if (r.tot) {
      ziel.z.laden([]);
      bedrohung.leere(p.ziel);
      melde_('kampf:tot', { ziel: p.ziel, quelle: p.quelle ?? null });
    } else if (traf && p.zustand && !r.ausgewichen && !r.pariert) {
      gibZustand(p.ziel, p.zustand.name, { quelle: p.quelle, dauer: p.zustand.dauer, staerke: p.zustand.staerke });
    }
    return erg;
  }

  function heile({ quelle = null, ziel, menge }) {
    const e = eintraege.get(ziel);
    if (!e) return 0;
    const q = quelle != null ? eintraege.get(quelle) : null;
    const g = e.k.heile(menge * (q ? q.k.werte.heilFaktor : 1));
    if (g > 0) {
      melde_('kampf:heilung', { quelle, ziel, menge: g });
      if (quelle != null) {
        const gegner = [...eintraege].filter(([id, x]) => x.team !== e.team && !x.k.tot).map(([id]) => id);
        bedrohung.heilung(quelle, g, gegner);
      }
    }
    return g;
  }

  function update(dt) {
    zeit += dt;
    for (const [id, e] of [...eintraege]) {
      if (!eintraege.has(id)) continue;
      for (const ev of e.k.update(dt)) melde_(ev.typ === 'schildEnde' ? 'kampf:schildEnde' : 'kampf:taumelEnde', { ziel: id });
      if (e.k.tot) continue;
      for (const ev of e.z.update(dt)) {
        if (ev.typ === 'ende') melde_('kampf:zustandEnde', { ziel: id, name: ev.name });
        else if (ev.heilt) heile({ quelle: ev.quelle, ziel: id, menge: ev.menge });
        else schade({ quelle: ev.quelle, ziel: id, menge: ev.menge, art: ev.art, wucht: 0, krit: false, direkt: true });
      }
      abgleich(id);
    }
    bedrohung.update(dt);
    protokoll = protokoll.filter((x) => zeit - x.t <= LOG_MAX);
    const aus = puffer; puffer = [];
    return aus;
  }

  return {
    melde, entferne, feindlich, schade, heile, gibZustand, update, bedrohung,
    kaempfer: (id) => eintraege.get(id)?.k || null,
    zustaende: (id) => eintraege.get(id)?.z || null,
    alle: () => [...eintraege.values()].map((e) => e.k),
    imKampf: (id) => { const e = eintraege.get(id); return !!e && zeit - e.letzter <= KAMPF_NACHLAUF; },
    dps(id, fenster = 5) {
      let s = 0;
      for (const x of protokoll) if (x.quelle === id && zeit - x.t <= fenster) s += x.menge;
      return s / fenster;
    },
    zustand() {
      return {
        zeit, protokoll: protokoll.map((x) => ({ ...x })), bedrohung: bedrohung.zustand(),
        eintraege: [...eintraege].map(([id, e]) => ({ id, team: e.team, letzter: e.letzter === -Infinity ? null : e.letzter, k: e.k.zustand(), z: e.z.zustand() })),
      };
    },
    laden(z) {
      for (const id of [...eintraege.keys()]) entferne(id);
      zeit = z.zeit; protokoll = z.protokoll.map((x) => ({ ...x })); puffer = [];
      for (const x of z.eintraege) {
        const k = melde(x.id, { team: x.team, seed: x.k.seed });
        k.laden(x.k);
        const e = eintraege.get(x.id);
        e.z.laden(x.z); e.letzter = x.letzter ?? -Infinity;
        abgleich(x.id);
      }
      bedrohung.laden(z.bedrohung);
    },
    dispose() { for (const id of [...eintraege.keys()]) entferne(id); bedrohung.dispose(); puffer = []; protokoll = []; },
  };
}
