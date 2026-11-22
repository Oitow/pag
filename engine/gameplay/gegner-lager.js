/**
 * @modul    gegner-lager
 * @zweck    Ein Gegnerlager ohne THREE: Horde (gameplay/horde) an einem Ort, je Tier eine Entität (core/entitaeten, Team 'feind'), Wache → Jagd auf nahe Spieler → Verlieren → Heimkehr + Heilung, Bisse als Befehle (gameplay/befehle), Tod → Entität weg, Respawn nach Spielzeit, Nacht = mehr und aggressiver
 * @api      createGegnerLager({id,x,z,radius,ents,befehle,welt,seed,besatzung,nachtExtra,aggro,leine,respawn,werte,frei,schadenFaktor}) -> { id, x, z, radius, horde, modus, zielId, lebend, wesen(entId), ids, fest(dt,{aktiv,nacht}), treffer(d), tod(id), weg(id), stoss(id,x,z,kraft), betaeube(id,s), sog(x,z,r,kraft)->n, zustand(), dispose() }
 * @beispiel
 *   import { createGegnerLager } from '../../engine/gameplay/gegner-lager.js';
 *   const lager = createGegnerLager({ id: 'lager-moor', x: -900, z: 100, ents, befehle, welt, seed: 3, besatzung: { ratte: 8, riesenratte: 1 } });
 *   lager.fest(1 / 60, { aktiv: true, nacht: false });   // jedes feste Bild; Treffer kommen über lager.treffer(ent:treffer-Daten)
 * @tags     gegner, lager, horde, respawn, aggro, entitaet, mmo, ratte, gameplay
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * ents: core/entitaeten (oder die API des Moduls 'entitaeten'), befehle: gameplay/befehle. Ziele = lebende Entitäten mit team 'spieler'.
 * stoss(id, x, z, kraft): x,z = RICHTUNG (normiert), kraft in m/s. sog: x,z = Mitte. Inaktive Lager (fern vom Fokus) zählen nur die Uhr.
 */
import { createHorde } from './horde.js';
import { rng, hashSeed } from '../core/rng.js';

const WERTE = { ratte: { ruestung: 0 }, riesenratte: { ruestung: 30 }, rattenkoenig: { ruestung: 60 } };

export function createGegnerLager({
  id = 'lager', x = 0, z = 0, radius = 12, ents, befehle, welt = null, seed = 1, besatzung = { ratte: 8 }, nachtExtra = {},
  aggro = 13, leine = 40, respawn = 30, werte = WERTE, frei = null, schadenFaktor = 0.5,
} = {}) {
  const r = rng(hashSeed('lager', id, seed));
  const horde = createHorde({ seed: hashSeed(id, seed), welt, max: 48, leichenZeit: 5 });
  const ids = new Map();             // entId → wesen
  const warte = [];                  // [{ art, zeit }]
  const st = { modus: 'ruhe', zielId: null, t: 0, tZurueck: 0, erstes: true };
  const heim = { x, y: 0, z, radius: radius * 0.45 };
  const boden = (px, pz) => (welt?.bodenHoehe ? +welt.bodenHoehe(px, pz) || 0 : 0);

  function platz() {
    for (let i = 0; i < 8; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * radius;
      const px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d;
      if (!frei || frei(px, pz, 0.6)) return [px, pz];
    }
    return [x, z];
  }
  function spawne(art) {
    const [px, pz] = platz();
    const w = horde.spawne(art, px, pz);
    if (!w) return null;
    const eid = ents.neu({ art: 'gegner', team: 'feind', pos: { x: w.x, y: w.y, z: w.z }, radius: w.radius, leben: w.lebenMax,
      name: w.def.name, daten: { hoehe: w.hoehe + 0.25, lager: id, wesen: art, werte: werte[art] || {} } });
    w.entId = eid; ids.set(eid, w);
    return eid;
  }
  function soll(nacht) {
    const s = { ...besatzung };
    if (nacht) for (const [a, n] of Object.entries(nachtExtra)) s[a] = (s[a] || 0) + n;
    return s;
  }
  function auffuellen(nacht) {
    const zahl = {};
    for (const w of ids.values()) zahl[w.art] = (zahl[w.art] || 0) + 1;
    for (const q of warte) zahl[q.art] = (zahl[q.art] || 0) + 1;
    for (const [art, n] of Object.entries(soll(nacht))) {
      for (let i = zahl[art] || 0; i < n; i++) warte.push({ art, zeit: st.erstes ? st.t : st.t + respawn * (0.85 + r() * 0.3) });
    }
    st.erstes = false;
    for (let i = warte.length - 1; i >= 0; i--) if (warte[i].zeit <= st.t) { spawne(warte[i].art); warte.splice(i, 1); }
  }
  /** Entität verloren (tot oder von außen entfernt) → Wesen tot, Respawn wird bei auffuellen() eingeplant. */
  function loese(eid, entfernen) {
    const w = ids.get(eid);
    if (!w) return;
    ids.delete(eid);
    if (!w.tot) horde.schade(w, w.leben + 1e6);
    if (entfernen) ents.entferne(eid);
  }

  function suchen(a, l) {
    if (st.zielId) {
      const e = ents.hole(st.zielId);
      if (e && e.lebt && Math.hypot(e.pos.x - x, e.pos.z - z) < l) return e;
      st.zielId = null;
    }
    const nah = ents.imUmkreis(x, z, radius + a, { team: 'spieler' });
    if (nah[0]) { st.zielId = nah[0].id; return nah[0]; }
    return null;
  }

  function fest(dt, { aktiv = true, nacht = false } = {}) {
    st.t += dt;
    for (const [eid] of ids) { const e = ents.hole(eid); if (!e || !e.lebt) loese(eid, !!e); }
    auffuellen(nacht);
    if (!aktiv) return;
    const ziel = suchen(aggro * (nacht ? 1.5 : 1), leine * (nacht ? 1.3 : 1));
    if (ziel) st.modus = 'jagd';
    else if (st.modus === 'jagd') { st.modus = 'zurueck'; st.tZurueck = 0; }
    let hz = null;
    if (st.modus === 'jagd') hz = { x: ziel.pos.x, y: ziel.pos.y, z: ziel.pos.z, radius: ziel.radius };
    else if (st.modus === 'zurueck') {
      heim.y = boden(x, z); hz = heim;
      st.tZurueck += dt;
      let alleDa = true;
      for (const w of ids.values()) if (!w.tot && Math.hypot(w.x - x, w.z - z) > radius) { alleDa = false; break; }
      if (alleDa || st.tZurueck > 12) {                       // daheim: Wunden lecken
        st.modus = 'ruhe';
        for (const [eid, w] of ids) { const e = ents.hole(eid); if (e?.lebt) { w.leben = w.lebenMax; ents.aendere(eid, { leben: e.lebenMax }); } }
      }
    }
    for (const ev of horde.update(dt, hz)) {
      if (ev.typ === 'biss' && st.zielId && ev.wesen.entId) {
        befehle.sende({ von: ev.wesen.entId, art: 'schaden', daten: { ziel: st.zielId, menge: ev.schaden * schadenFaktor * (nacht ? 1.5 : 1), reichweite: 1.5 } });
      }
    }
    for (const [eid, w] of ids) {
      if (w.tot) continue;
      if (st.modus === 'ruhe') {                              // streunen, aber an der Leine
        const dx = x - w.x, dz = z - w.z, d = Math.hypot(dx, dz);
        if (d > radius) { w.x += (dx / d) * 1.6 * dt; w.z += (dz / d) * 1.6 * dt; }
      }
      ents.bewege(eid, w.x, w.y, w.z);
    }
  }

  return {
    id, x, z, radius, horde, ids,
    get modus() { return st.modus; },
    get zielId() { return st.zielId; },
    get lebend() { return horde.anzahl; },
    wesen: (eid) => ids.get(eid) || null,
    fest,
    /** ent:treffer-Daten: Wesen zeigt den Treffer (Aufblitzen, Stoß, Flug) und das Lager wird auf den Angreifer wütend. */
    treffer(d) {
      const w = ids.get(d.id);
      if (!w) return false;
      let stoss = null;
      if (d.stoss) {
        const k = d.stoss.kraft, l = Math.hypot(d.stoss.x || 0, d.stoss.z || 0) || 1;
        stoss = k == null ? d.stoss : { x: (d.stoss.x / l) * k, y: k * 0.35, z: (d.stoss.z / l) * k };
      }
      horde.schade(w, d.menge, { stoss });
      const q = d.quelle != null ? ents.hole(d.quelle) : null;
      if (q?.team === 'spieler' && q.lebt) { st.zielId = q.id; st.modus = 'jagd'; }
      return true;
    },
    tod: (eid) => { const w = ids.get(eid); if (w && !w.tot) horde.schade(w, w.leben + 1e6); },
    weg: (eid) => loese(eid, false),
    stoss(eid, sx, sz, kraft = 8) {
      const w = ids.get(eid); if (!w || w.tot) return false;
      const l = Math.hypot(sx, sz) || 1;
      horde.schade(w, 0, { stoss: { x: (sx / l) * kraft, y: kraft * 0.35, z: (sz / l) * kraft } });
      return true;
    },
    betaeube(eid, s = 2) {
      const w = ids.get(eid); if (!w || w.tot || w.zustand === 'flug') return false;
      w.zustand = 'benommen'; w.t = 0; w.benommen = s; w.hub = 0;
      return true;
    },
    sog(sx, sz, sr, kraft = 6) {
      let n = 0;
      for (const w of ids.values()) {
        if (w.tot || w.zustand === 'flug') continue;
        const dx = sx - w.x, dz = sz - w.z, d = Math.hypot(dx, dz);
        if (d > sr || d < 1e-3) continue;
        const f = kraft * Math.min(1, d / 1.5) / w.def.masse;
        w.zx = (dx / d) * f; w.zz = (dz / d) * f; n++;
      }
      return n;
    },
    zustand: () => ({ t: st.t, modus: st.modus, warte: warte.map((q) => [q.art, q.zeit]) }),
    dispose() { for (const eid of [...ids.keys()]) { ids.delete(eid); ents.entferne(eid); } warte.length = 0; horde.dispose(); },
  };
}
