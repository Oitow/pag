/**
 * @modul    modul-gegner
 * @zweck    Spiel-Modul 'gegner': Lager nach Region an allen welt.orte der Art 'gegnerlager' (Waldrand Ratten · Hochland Wölfe + Keiler · Moor Irrlichter + Ratten, Stufe aus ort.stufe) + ein kleines am Waldrand beim 'tor', Boss „Grauzahn, der Alpha“ (Stufe 10) am Ort 'boss' (sonst 'ruine') mit Warn-Ring, Horden mit je einer Entität pro Tier (Team 'feind'), Jagd/Heimkehr/Respawn, Interest-Management (nur Lager nahe dem Fokus laufen und sind sichtbar), nachts mehr und aggressiver
 * @api      GEGNER_MODUL ; createGegnerModul() -> modul, start(ctx) -> { lager, horden, boss (Entität-ID|null), wesen(id), lagerVon(id), stoss(id,x,z,kraft), betaeube(id,s), sog(x,z,r,kraft)->anzahl, aktive() }
 * @beispiel
 *   import { GEGNER_MODUL } from '../../engine/spiel/modul-gegner.js';
 *   const gegner = kern.api('gegner');
 *   gegner.sog(x, z, 6, 8);                              // Zauber: alles im Umkreis 6 m zur Mitte ziehen
 *   gegner.stoss('g:14', dirX, dirZ, 9); gegner.betaeube('g:14', 2);
 * @tags     spiel, modul, gegner, lager, horde, ratte, respawn, interest, mmo
 * @version  1.1.0
 * @status   entwurf
 * @three    ja
 *
 * stoss: x,z = RICHTUNG (normiert), kraft m/s. Ziele sind Entitäten mit team 'spieler' (spieler.id). Hat das Modul 'spieler' keine
 * Entität, legt gegner eine Stellvertreter-Entität an der Spielerposition an (Bisse zählen, Wiederbelebung nach 5 s).
 * Optionen: { aktivBis: 160 (m vom Fokus), besatzung, nachtExtra (Waldrand/Rückfall), waldrand: true, nester: true, boss: true }.
 * Ereignisse: sendet gegner:boss {id, phase 0|1|2 | −1 = Kampf vorbei/zurückgesetzt, name}, gegner:warnung (Boden-Ring, ein wiederverwendetes Mesh), chat:sende {kanal:'kampf'}. Entität.daten: { stufe, xp, beute, art }.
 */
import * as THREE from 'three';
import { createGegnerLager } from '../gameplay/gegner-lager.js';
import { createHordeMesh } from '../render/horde-mesh.js';
import { createBoss } from '../gameplay/boss.js';
import { createRatte } from '../models/kreaturen/ratte.js';
import { createWolf } from '../models/kreaturen/wolf.js';
import { createKeiler } from '../models/kreaturen/keiler.js';
import { createIrrlicht } from '../models/kreaturen/irrlicht.js';
import { hashSeed } from '../core/rng.js';

/** Besatzung + Standardstufe je Region (Rückfall: Optionen). */
const REGIONEN = {
  hochland: { stufe: 4, besatzung: { wolf: 5, keiler: 2 }, nachtExtra: { wolf: 3 } },
  moor: { stufe: 6, besatzung: { irrlicht: 4, ratte: 5, riesenratte: 1 }, nachtExtra: { irrlicht: 2, ratte: 3 } },
  waldrand: { stufe: 1 },
};
const BOSS_NAME = 'Grauzahn, der Alpha';

export function createGegnerModul() {
  let intern = null;
  return {
    name: 'gegner', braucht: ['render', 'welt', 'entitaeten'], optional: ['spieler', 'himmel'],
    standard: { aktivBis: 160, besatzung: { ratte: 9, riesenratte: 1 }, nachtExtra: { ratte: 5, riesenratte: 1 }, waldrand: true, nester: true, boss: true },
    start(ctx) {
      const o = ctx.optionen, render = ctx.braucht('render'), welt = ctx.braucht('welt'), ents = ctx.braucht('entitaeten');
      const { szene, kamera } = render, bus = ctx.ereignisse;
      const frei = welt.flaecheFrei ? (x, z, r) => welt.flaecheFrei(x, z, r) : null;
      const lager = [], mitNest = new Set();   // Rattennester nur dort, wo Ratten hausen
      const neuesLager = (id, x, z, radius, besatzung, nachtExtra, extra = {}) => { const l = createGegnerLager({
        id, x, z, radius, ents, befehle: ents.befehle, welt, seed: hashSeed(id, ctx.seed), besatzung, nachtExtra, frei, ...extra }); lager.push(l); if (besatzung.ratte) mitNest.add(id); return l; };
      const regionVon = (ort) => {
        const rid = welt.region?.(ort.x, ort.z)?.id || '';
        for (const k of Object.keys(REGIONEN)) if (rid === k || ort.id.includes(k)) return k;
        return 'waldrand';
      };
      for (const ort of welt.orte || []) if (ort.art === 'gegnerlager') {
        const reg = REGIONEN[regionVon(ort)];
        neuesLager(ort.id, ort.x, ort.z, Math.min(ort.radius ?? 14, 18), reg.besatzung || o.besatzung, reg.nachtExtra || o.nachtExtra, { stufe: ort.stufe ?? reg.stufe });
      }
      // Kleines Lager am Waldrand: neben dem Tor, abseits vom Weg
      const tor = welt.ort?.('tor');
      if (tor && o.waldrand) {
        let best = null;
        for (let i = 0; i < 48 && !best; i++) {          // erst frei + abseits vom Weg, dann nur abseits vom Weg
          const a = ctx.zufall() * Math.PI * 2, d = 28 + ctx.zufall() * 14, x = tor.x + Math.sin(a) * d, z = tor.z + Math.cos(a) * d;
          if ((i >= 24 || !frei || frei(x, z, 1.5)) && (!welt.abstandZumWeg || welt.abstandZumWeg(x, z) > 10)) best = { x, z };
        }
        best ||= { x: tor.x + 32, z: tor.z };
        neuesLager('lager-waldrand', best.x, best.z, 8, { ratte: 4 }, { ratte: 3 }, { stufe: 1 });
      }
      // Boss: Grauzahn am Ort der Art 'boss' (sonst 'ruine'), eigenes Lager mit nur einem Alpha; boss.js steuert ihn
      const bossOrt = o.boss ? (welt.orte || []).find((q) => q.art === 'boss') || welt.ort?.('ruine') : null;
      const bossLager = bossOrt ? neuesLager('boss-grauzahn', bossOrt.x, bossOrt.z, 9, { alpha: 1 }, {}, { stufe: 10, aggro: 20, leine: 60, respawn: 300 }) : null;

      // Darstellung: ein InstancedMesh-Satz für alle aktiven Lager
      const ratte = createRatte({ seed: ctx.seed }), wolf = createWolf({ seed: ctx.seed }), keiler = createKeiler({ seed: ctx.seed }), irrlicht = createIrrlicht({ seed: ctx.seed });
      const bild = createHordeMesh({ modelle: { ratte: ratte.frames, wolf: wolf.frames, keiler: keiler.frames, irrlicht: irrlicht.frames }, max: 120 });
      szene.add(bild.gruppe);
      // Warn-Ring (ein Mesh für alle Boss-Angriffe): additiv, pulsiert, wächst auf den Radius
      const ringGeo = new THREE.RingGeometry(0.78, 1, 40); ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xff3a1a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat); ring.visible = false; ring.frustumCulled = false; ring.renderOrder = 5;
      szene.add(ring);
      const warn = { rest: 0, dauer: 1, radius: 1 };
      const sicht = [];
      // Rattennest je Lager: Erdhügel + Knochen/Stöcke (Low-Poly, Vertexfarben-frei)
      const nester = new THREE.Group(); nester.name = 'rattennester';
      const geoH = new THREE.DodecahedronGeometry(1, 0), geoS = new THREE.CylinderGeometry(0.04, 0.05, 1, 5);
      const matH = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1, flatShading: true });
      const matS = new THREE.MeshStandardMaterial({ color: 0xcfc2a2, roughness: 0.9, flatShading: true });
      if (o.nester) for (const l of lager) {
        if (!mitNest.has(l.id)) continue;
        const g = new THREE.Group(), y = welt.bodenHoehe(l.x, l.z);
        g.position.set(l.x, y, l.z);
        const n = Math.max(2, Math.round(l.radius / 4));
        for (let i = 0; i < n; i++) {
          const h = new THREE.Mesh(geoH, matH), a = i / n * 6.283 + ctx.zufall(), d = i ? l.radius * 0.3 * (0.6 + ctx.zufall() * 0.6) : 0;
          const s = (i ? 0.8 : 1.4) * (0.8 + ctx.zufall() * 0.4);
          h.position.set(Math.sin(a) * d, welt.bodenHoehe(l.x + Math.sin(a) * d, l.z + Math.cos(a) * d) - y - s * 0.25, Math.cos(a) * d);
          h.scale.set(s * 1.4, s * 0.55, s * 1.2); h.rotation.y = ctx.zufall() * 6; h.castShadow = h.receiveShadow = true; g.add(h);
        }
        for (let i = 0; i < 7; i++) {
          const st = new THREE.Mesh(geoS, matS), a = ctx.zufall() * 6.283, d = 1 + ctx.zufall() * l.radius * 0.4;
          st.position.set(Math.sin(a) * d, welt.bodenHoehe(l.x + Math.sin(a) * d, l.z + Math.cos(a) * d) - y + 0.05, Math.cos(a) * d);
          st.scale.y = 0.4 + ctx.zufall() * 0.6; st.rotation.set(Math.PI / 2, ctx.zufall() * 6, 0); g.add(st);
        }
        g.userData.lager = l.id; nester.add(g);
      }
      szene.add(nester);

      // Treffer/Tod/Weg der Entitäten an die Horden weiterreichen
      const lagerVon = (id) => { for (const l of lager) if (l.ids.has(id)) return l; return null; };
      const ab = [
        bus.an('ent:treffer', (d) => lagerVon(d.id)?.treffer(d)),
        bus.an('ent:tod', (d) => lagerVon(d.id)?.tod(d.id)),
        bus.an('ent:weg', (d) => lagerVon(d.id)?.weg(d.id)),
        bus.an('gegner:warnung', (d) => {
          if (!d?.pos) return;
          ring.position.set(d.pos.x, (d.pos.y ?? welt.bodenHoehe(d.pos.x, d.pos.z)) + 0.12, d.pos.z);
          warn.rest = warn.dauer = Math.max(0.1, d.dauer || 1); warn.radius = d.radius || 3; ring.visible = true;
        }),
      ];

      // Boss-Steuerung: sobald das Lager sein Alpha-Wesen hat, übernimmt boss.js
      let ctl = null, bossId = null;
      const bossFest = (dt, an) => {
        if (!bossLager) return;
        let w = null;
        if (an) for (const q of bossLager.horde.wesen) if (q.art === 'alpha' && !q.tot && q.entId) { w = q; break; }
        if (ctl && ctl.wesenRef !== w) { if (bossId) bus.sende('gegner:boss', { id: bossId, phase: -1, name: BOSS_NAME }); ctl.dispose(); ctl = null; bossId = null; }
        if (!ctl && w) {
          ctl = createBoss({ wesen: w, ents, befehle: ents.befehle, x: bossLager.x, z: bossLager.z, name: BOSS_NAME, leine: 55, schaden: 22,
            boden: (x, z) => welt.bodenHoehe(x, z),
            sende: (n, d) => bus.sende(n, d),
            ruf: (art, n, x, z, r) => { bossLager.ruf(art, n, x, z, r); bus.sende('chat:sende', { kanal: 'kampf', text: 'Grauzahn heult – das Rudel kommt!' }); } });
          ctl.wesenRef = w;
        }
        if (ctl) { ctl.fest(dt, bossLager.zielId ? ents.hole(bossLager.zielId) : null); bossId = ctl.aktiv ? ctl.entId : null; }
      };

      const aktiv = new Set();
      let vertreter = null, vertreterUhr = 0;
      const fokus = () => {
        const f = ctx.dienst('fokus');
        const p = (typeof f === 'function' ? f() : f) || ctx.optional('spieler')?.position || kamera.position;
        return p;
      };
      function stellvertreter(dt) {
        const sp = ctx.optional('spieler');
        if (!sp?.position || sp.id) { if (vertreter) { ents.entferne(vertreter); vertreter = null; } return; }
        if (!vertreter) vertreter = ents.neu({ art: 'spieler', team: 'spieler', pos: sp.position, radius: 0.35, leben: 100, name: 'Spieler', daten: { hoehe: 1.8 } });
        const e = ents.hole(vertreter);
        ents.bewege(vertreter, sp.position.x, sp.position.y, sp.position.z);
        if (e && !e.lebt && (vertreterUhr += dt) > 5) { ents.belebe(vertreter, 1); vertreterUhr = 0; }
      }

      intern = {
        fest(dt) {
          stellvertreter(dt);
          const f = fokus(), h = ctx.optional('himmel')?.uhr?.stunde;
          const nacht = Number.isFinite(h) && (h < 6 || h >= 20);
          for (const l of lager) {
            const d = Math.hypot(l.x - f.x, l.z - f.z), an = aktiv.has(l.id);
            if (!an && d < o.aktivBis) aktiv.add(l.id); else if (an && d > o.aktivBis + 30) aktiv.delete(l.id);
            l.fest(dt, { aktiv: aktiv.has(l.id), nacht });
          }
          bossFest(dt, bossLager && aktiv.has(bossLager.id));
        },
        update(dt) {
          if (warn.rest > 0) {                                  // Warn-Ring: wächst + pulsiert, bis die Zeit um ist
            warn.rest -= dt;
            const u = 1 - Math.max(0, warn.rest) / warn.dauer;
            ring.scale.setScalar(warn.radius * (0.55 + 0.45 * Math.min(1, u * 1.6)));
            ringMat.opacity = (0.45 + 0.4 * Math.sin(u * 28)) * (0.5 + 0.5 * u);
            if (warn.rest <= 0) { ring.visible = false; ringMat.opacity = 0; }
          }
          sicht.length = 0;
          for (const l of lager) if (aktiv.has(l.id)) for (const w of l.horde.wesen) sicht.push(w);
          bild.update(sicht);
          for (const g of nester.children) g.visible = aktiv.has(g.userData.lager);
        },
        dispose() {
          for (const f of ab) f();
          for (const l of lager) l.dispose();
          if (vertreter) ents.entferne(vertreter);
          if (ctl) ctl.dispose();
          bild.dispose(); ratte.dispose(); wolf.dispose(); keiler.dispose(); irrlicht.dispose(); szene.remove(bild.gruppe, nester, ring);
          ringGeo.dispose(); ringMat.dispose();
          geoH.dispose(); geoS.dispose(); matH.dispose(); matS.dispose();
        },
        zustand: () => ({ lager: lager.map((l) => [l.id, l.zustand()]) }),
      };

      const imUmkreis = (x, z, r, fn) => { for (const l of lager) if (aktiv.has(l.id)) for (const [id] of l.ids) { const e = ents.hole(id); if (e && Math.hypot(e.pos.x - x, e.pos.z - z) <= r + e.radius) fn(l, id); } };
      return {
        lager, get boss() { return bossId; }, get horden() { return lager.map((l) => l.horde); },
        wesen: (id) => lagerVon(id)?.wesen(id) || null, lagerVon,
        stoss: (id, x, z, kraft) => !!lagerVon(id)?.stoss(id, x, z, kraft),
        betaeube: (id, s) => !!lagerVon(id)?.betaeube(id, s),
        sog(x, z, r, kraft) { let n = 0; for (const l of lager) if (aktiv.has(l.id)) n += l.sog(x, z, r, kraft); return n; },
        imUmkreis,
        aktive: () => lager.filter((l) => aktiv.has(l.id)),
      };
    },
    fest(dt) { intern?.fest(dt); },
    update(dt) { intern?.update(dt); },
    zustand() { return intern?.zustand() ?? null; },
    dispose() { intern?.dispose(); intern = null; },
  };
}
export const GEGNER_MODUL = createGegnerModul();
