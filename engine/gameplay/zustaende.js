/**
 * @modul    zustaende
 * @zweck    Buffs und Debuffs: Stapel, Dauer, DoT/HoT-Takte, Faktoren (Tempo, Schaden, Rüstung), Sperren (Betäubung, Frost)
 * @api      ZUSTAENDE ; createZustaende({defs}) -> {gib(name,{quelle,dauer,staerke})->eintrag,nimm(name),hat(name),stapel(name),update(dt)->ereignisse,beiSchaden()->ereignisse,faktoren(),liste(),reinige('schaedlich'|'nuetzlich'),zustand(),laden(z),dispose()}
 * @beispiel
 *   import { createZustaende } from '../../engine/gameplay/zustaende.js';
 *   const z = createZustaende();
 *   z.gib('gift', { quelle: 'spinne' }); z.gib('gift', { quelle: 'spinne' }); // 2 Stapel
 *   for (const e of z.update(1)) if (e.typ === 'takt') console.log(e.name, e.menge);
 *   z.faktoren().kannHandeln; // false bei betaeubt/eingefroren
 * @tags     buff, debuff, zustand, dot, hot, kampf, mmo, status
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

export const ZUSTAENDE = {
  brennen: { name: 'Brennen', symbol: '🔥', nuetzlich: false, dauer: 5, takt: 1, art: 'feuer', menge: 4, maxStapel: 1 },
  gift: { name: 'Gift', symbol: '☠', nuetzlich: false, dauer: 8, takt: 1, art: 'natur', menge: 2, maxStapel: 5 },
  blutung: { name: 'Blutung', symbol: '🩸', nuetzlich: false, dauer: 6, takt: 1, art: 'koerper', menge: 3, maxStapel: 3 },
  regeneration: { name: 'Regeneration', symbol: '💚', nuetzlich: true, dauer: 8, takt: 1, art: 'heilig', menge: 5, heilt: true, maxStapel: 1 },
  verlangsamt: { name: 'Verlangsamt', symbol: '🐌', nuetzlich: false, dauer: 4, mods: { tempo: 0.6 } },
  betaeubt: { name: 'Betäubt', symbol: '💫', nuetzlich: false, dauer: 2, sperrt: { handeln: true } },
  eingefroren: { name: 'Eingefroren', symbol: '🧊', nuetzlich: false, dauer: 3, sperrt: { handeln: true, laufen: true }, brichtBeiSchaden: true },
  schweigen: { name: 'Schweigen', symbol: '🤐', nuetzlich: false, dauer: 4, sperrt: { zaubern: true } },
  wut: { name: 'Wut', symbol: '😡', nuetzlich: true, dauer: 10, mods: { schadenFaktor: 1.25 } },
  schutz: { name: 'Schutz', symbol: '🛡', nuetzlich: true, dauer: 10, mods: { ruestung: 50 } },
  eile: { name: 'Eile', symbol: '💨', nuetzlich: true, dauer: 6, mods: { tempo: 1.3 } },
  unverwundbar: { name: 'Unverwundbar', symbol: '✨', nuetzlich: true, dauer: 3, unverwundbar: true },
};

export function createZustaende({ defs = ZUSTAENDE } = {}) {
  const aktiv = new Map(); // name -> { name, quelle, rest, dauer, stapel, staerke, taktRest }

  function gib(name, { quelle = null, dauer, staerke = 1 } = {}) {
    const d = defs[name];
    if (!d) return null;
    const dau = dauer ?? d.dauer ?? 1;
    let e = aktiv.get(name);
    if (e) {
      e.rest = dau; e.dauer = dau; e.quelle = quelle ?? e.quelle;
      e.stapel = Math.min(d.maxStapel || 1, e.stapel + 1);
      e.staerke = Math.max(e.staerke, staerke);
    } else {
      e = { name, quelle, rest: dau, dauer: dau, stapel: 1, staerke, taktRest: d.takt || 0 };
      aktiv.set(name, e);
    }
    return e;
  }

  function update(dt) {
    const ev = [];
    for (const e of [...aktiv.values()]) {
      const d = defs[e.name];
      if (d.takt) {
        e.taktRest -= Math.min(dt, e.rest);
        while (e.taktRest <= 1e-9) {
          e.taktRest += d.takt;
          ev.push({ typ: 'takt', name: e.name, art: d.art || 'koerper', menge: (d.menge || 0) * e.staerke * e.stapel, quelle: e.quelle, heilt: !!d.heilt });
        }
      }
      e.rest -= dt;
      if (e.rest <= 1e-9) { aktiv.delete(e.name); ev.push({ typ: 'ende', name: e.name }); }
    }
    return ev;
  }

  function beiSchaden() {
    const ev = [];
    for (const e of [...aktiv.values()]) {
      if (defs[e.name].brichtBeiSchaden) { aktiv.delete(e.name); ev.push({ typ: 'ende', name: e.name, grund: 'schaden' }); }
    }
    return ev;
  }

  function faktoren() {
    const f = { tempo: 1, schadenFaktor: 1, ruestung: 0, kannHandeln: true, kannLaufen: true, kannZaubern: true, unverwundbar: false };
    for (const e of aktiv.values()) {
      const d = defs[e.name];
      if (d.mods) {
        if (d.mods.tempo) f.tempo *= d.mods.tempo;
        if (d.mods.schadenFaktor) f.schadenFaktor *= d.mods.schadenFaktor;
        if (d.mods.ruestung) f.ruestung += d.mods.ruestung;
      }
      if (d.sperrt?.handeln) f.kannHandeln = false;
      if (d.sperrt?.laufen) f.kannLaufen = false;
      if (d.sperrt?.zaubern) f.kannZaubern = false;
      if (d.unverwundbar) f.unverwundbar = true;
    }
    if (!f.kannHandeln) f.kannZaubern = false;
    return f;
  }

  return {
    gib, update, beiSchaden, faktoren,
    nimm(name) { return aktiv.delete(name); },
    hat(name) { return aktiv.has(name); },
    stapel(name) { return aktiv.get(name)?.stapel || 0; },
    liste() {
      return [...aktiv.values()].map((e) => ({ name: e.name, symbol: defs[e.name].symbol, rest: e.rest, dauer: e.dauer, stapel: e.stapel, nuetzlich: !!defs[e.name].nuetzlich }));
    },
    reinige(art) {
      const weg = [];
      for (const e of [...aktiv.values()]) {
        const nutz = !!defs[e.name].nuetzlich;
        if ((art === 'nuetzlich') === nutz) { aktiv.delete(e.name); weg.push(e.name); }
      }
      return weg;
    },
    zustand() { return [...aktiv.values()].map((e) => ({ ...e })); },
    laden(z) { aktiv.clear(); for (const e of z || []) if (defs[e.name]) aktiv.set(e.name, { ...e }); },
    dispose() { aktiv.clear(); },
  };
}
