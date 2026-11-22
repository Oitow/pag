/**
 * @modul    modul-fortschritt
 * @zweck    Spiel-Modul 'fortschritt': Stufen 1–15, XP aus Gegner-Toden, Talente, Inventar (24 Plätze) + Ausrüstung, Beute als leuchtende Beutel (1 InstancedMesh, Auto-Aufheben 2 m, 120 s), Werte auf die Spieler-Entität, Licht-Ring bei Stufenaufstieg
 * @api      FORTSCHRITT_MODUL ; createFortschrittModul() -> modul, start(ctx) -> { held:{name,klasse}, stufe, xp, xpNaechste, gibXp(n,grund), gibGegenstand(id,anzahl=1,daten?)->rest, inventar, register, ausruestung:{hole(sockel),lege(platz)->bool,ab(sockel)->bool,alle()}, werte()->{…}, talente:{punkte,baum,stufe(id),hat(id),lerne(id)->{ok,grund}}, seltenheitFarbe(s), beschreibe(id,daten)->{name,zeilen,farbe}, drops, streue(tabelle,pos,stufe?) }
 * @beispiel
 *   import { FORTSCHRITT_MODUL } from '../../engine/spiel/modul-fortschritt.js';
 *   const f = kern.api('fortschritt');
 *   f.gibXp(30, 'aufgabe'); f.gibGegenstand('heiltrank', 2); f.talente.lerne('kr_schlag');
 *   f.ausruestung.lege(0);   // Inventar-Platz 0 anlegen
 * @tags     spiel, modul, fortschritt, stufe, xp, talent, beute, inventar, ausruestung, mmo
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 *
 * Optionen: { name:'Du', klasse:'krieger'|'magier'|'waldlaeufer', plaetze:24, aufheben:2 (m), dauer:120 (s) }. Hört ent:tod (Team feind, quelle = spieler.id).
 * Ereignisse (senden): fort:xp, fort:stufe, fort:drop, fort:beute, fort:ausgeruestet, fort:talent, chat:sende (kanal beute/system).
 * Gegner steuern über ent.daten: { xp, stufe, beute:'wolf'|…, boss }. Läuft auch ohne render/spieler (dann zählt jedes ent:tod, kein Beutel-Bild).
 */
import * as THREE from 'three';
import { createRegister } from '../core/register.js';
import { rng, hashSeed } from '../core/rng.js';
import { createInventar } from '../gameplay/inventar.js';
import { createProgression } from '../gameplay/progression.js';
import { GEGENSTAENDE, SELTENHEITEN, registriereGegenstaende } from '../gameplay/gegenstaende-daten.js';
import { BEUTE_TABELLEN, wuerfle, erzeugeAusruestung, beschreibe, seltenheitFarbe } from '../gameplay/beute.js';

const MAX_BEUTEL = 64, RANG = ['gewoehnlich', 'selten', 'episch', 'legendaer'];
const START = { krieger: ['schwert'], magier: ['stab'], waldlaeufer: ['dolch', 'bogen'] };
const NEUTRAL = '#e6d9a8';

export function createFortschrittModul() {
  let intern = null;
  return {
    name: 'fortschritt', braucht: ['entitaeten'], optional: ['render', 'spieler', 'welt'],
    standard: { name: 'Du', klasse: 'krieger', plaetze: 24, aufheben: 2, dauer: 120 },
    start(ctx) {
      const o = ctx.optionen, bus = ctx.ereignisse, ents = ctx.braucht('entitaeten');
      const render = ctx.optional('render'), spieler = ctx.optional('spieler'), welt = ctx.optional('welt');
      const register = registriereGegenstaende(createRegister({ art: 'gegenstand' }));
      const inv = createInventar({ plaetze: o.plaetze, register, name: 'tasche' });
      const held = { name: o.name || 'Du', klasse: o.klasse };
      let prog = createProgression({ klasse: o.klasse, name: held.name });
      held.klasse = prog.klasse;
      const slots = {};                    // sockel -> { id, daten }
      const summe = {};                    // Ausrüstungswerte (wiederverwendet)
      let gesamtXp = 0, zaehler = 0, angewendet = false, taschenUhr = 0, pruefUhr = 0, ringT = -1;
      const ab = [];
      const farbeVon = (s) => SELTENHEITEN[s]?.farbe ?? NEUTRAL;
      const chat = (kanal, text, farbe) => bus.sende('chat:sende', { kanal, text, farbe });
      const spielerId = () => spieler?.id ?? null;
      const spielerEnt = () => { const id = spielerId(); return id ? ents.hole(id) : null; };

      // --- Werte ---
      function summiere() {
        for (const k in summe) delete summe[k];
        for (const s in slots) for (const k in slots[s].daten.werte) summe[k] = (summe[k] || 0) + slots[s].daten.werte[k];
      }
      const werte = () => prog.werte(summe);
      function wendeAn(volleHeilung) {
        const e = spielerEnt(); if (!e) return false;
        const w = werte(), max = Math.max(1, Math.round(w.leben));
        const anteil = e.lebenMax > 0 ? e.leben / e.lebenMax : 1;
        ents.aendere(e.id, { lebenMax: max, leben: e.lebt ? (volleHeilung ? max : Math.max(1, Math.round(max * anteil))) : e.leben, daten: { werte: { ruestung: w.ruestung, krit: w.krit / 100 } } });
        return true;
      }

      // --- Namen ---
      const anzeige = (id, daten) => beschreibe(id, daten);
      function melde(id, anzahl, daten) {
        const b = anzeige(id, daten), sel = daten?.seltenheit || 'gewoehnlich';
        bus.sende('fort:beute', { gegenstand: id, anzahl, name: b.name, seltenheit: sel });
        chat('beute', `Du erhältst ${anzahl > 1 ? anzahl + '× ' : ''}${b.name}`, daten ? b.farbe : undefined);
      }
      function gibGegenstand(id, anzahl = 1, daten, still = false) {
        if (!register.hat(id)) return anzahl;
        // Ausrüstung ohne Daten (z. B. Aufgaben-Belohnung 'ring') → passend zur Stufe, mindestens selten
        if (!daten && GEGENSTAENDE[id]?.sockel) daten = erzeugeAusruestung(id, { zufall: ctx.zufall, stufe: prog.stufe, seltenheit: 'selten' });
        const rest = inv.gib(id, anzahl, daten);
        if (!still && anzahl - rest > 0) melde(id, anzahl - rest, daten);
        return rest;
      }

      // --- XP ---
      function gibXp(n, grund = 'xp') {
        if (!(n > 0)) return;
        const r = prog.gibXp(n); gesamtXp += n;
        bus.sende('fort:xp', { menge: n, gesamt: gesamtXp, stufe: prog.stufe, grund });
        for (const s of r.aufstiege) {
          bus.sende('fort:stufe', { stufe: s, punkte: prog.punkte });
          chat('system', `Stufe ${s} erreicht!`, '#ffe08a');
        }
        if (r.aufstiege.length) { wendeAn(true); ringT = 0; }
      }

      // --- Ausrüstung ---
      const ausruestung = {
        hole: (sockel) => slots[sockel] || null,
        alle: () => ({ ...slots }),
        lege(platz) {
          const s = inv.plaetze[platz]; if (!s?.daten) return false;
          const g = GEGENSTAENDE[s.id]; if (!g?.sockel) return false;
          const neu = inv.nimmVon(platz, 1); if (!neu) return false;
          const alt = slots[g.sockel];
          slots[g.sockel] = { id: neu.id, daten: neu.daten };
          if (alt) inv.gib(alt.id, 1, alt.daten);
          summiere(); wendeAn(false);
          bus.sende('fort:ausgeruestet', { sockel: g.sockel, gegenstand: neu.id });
          return true;
        },
        ab(sockel) {
          const a = slots[sockel]; if (!a) return false;
          if (inv.gib(a.id, 1, a.daten) > 0) return false;
          delete slots[sockel]; summiere(); wendeAn(false);
          bus.sende('fort:ausgeruestet', { sockel, gegenstand: null });
          return true;
        },
      };

      // --- Talente ---
      const talente = {
        get punkte() { return prog.punkte; }, get baum() { return prog.baum; },
        stufe: (id) => prog.talentStufe(id), hat: (id) => prog.hat(id),
        lerne(id) {
          const r = prog.lerne(id);
          if (r.ok) { wendeAn(false); bus.sende('fort:talent', { id, stufe: prog.talentStufe(id) }); }
          return r;
        },
      };

      function startAusruestung() {
        for (const id of START[prog.klasse] || []) {
          const d = erzeugeAusruestung(id, { zufall: rng(hashSeed('start', id)), stufe: 1 });
          if (inv.gib(id, 1, d) === 0 && !slots[GEGENSTAENDE[id].sockel]) ausruestung.lege(inv.plaetze.findIndex((p) => p && p.id === id));
        }
        inv.gib('heiltrank', 3);
      }

      // --- Beutel (ein InstancedMesh) ---
      const drops = [];                    // aktive Beutel
      const pool = [];
      for (let i = 0; i < MAX_BEUTEL; i++) pool.push({ id: '', x: 0, y: 0, z: 0, items: null, sel: 'gewoehnlich', alter: 0, phase: 0, farbe: NEUTRAL });
      let mesh = null, ring = null, farbeDirty = true;
      const szene = render?.szene;
      let dummy = null, col = null;
      if (szene) {
        dummy = new THREE.Object3D(); col = new THREE.Color();
        const geo = new THREE.OctahedronGeometry(0.2, 0); geo.scale(1, 1.5, 1); geo.translate(0, 0.3, 0);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
        mesh = new THREE.InstancedMesh(geo, mat, MAX_BEUTEL);
        mesh.name = 'beutel'; mesh.count = 0; mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.setColorAt(0, col.set(NEUTRAL)); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        szene.add(mesh);
        const rg = new THREE.RingGeometry(0.7, 0.85, 32); rg.rotateX(-Math.PI / 2);
        ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
        ring.visible = false; ring.name = 'stufen-ring'; szene.add(ring);
      }

      function streue(tabelle, pos, stufe = 1) {
        const liste = wuerfle(tabelle, { seed: hashSeed(ctx.seed, tabelle, ++zaehler), stufe });
        if (!liste.length) return null;
        let b = pool.pop();
        if (!b) { b = drops.shift(); }          // voll: ältesten Beutel ersetzen
        let top = 'gewoehnlich', best = liste[0].id, punkte = -1;
        for (const it of liste) {
          const sel = it.daten?.seltenheit || 'gewoehnlich', pt = RANG.indexOf(sel) * 10 + (it.daten ? 5 : 0) + (it.id !== 'gold' ? 1 : 0);
          if (RANG.indexOf(sel) > RANG.indexOf(top)) top = sel;
          if (pt > punkte) { punkte = pt; best = it.id; }
        }
        b.id = `b:${zaehler}`; b.x = pos.x; b.y = pos.y ?? (welt?.bodenHoehe?.(pos.x, pos.z) ?? 0); b.z = pos.z;
        b.items = liste; b.sel = top; b.alter = 0; b.phase = (zaehler * 1.7) % 6.28; b.farbe = top === 'gewoehnlich' ? NEUTRAL : farbeVon(top);
        drops.push(b); farbeDirty = true;
        bus.sende('fort:drop', { id: b.id, pos: { x: b.x, y: b.y, z: b.z }, gegenstand: best, seltenheit: top });
        return b.id;
      }
      function entferne(i) { const b = drops[i]; b.items = null; drops.splice(i, 1); pool.push(b); farbeDirty = true; }

      function aufheben(b) {
        let uebrig = 0;
        for (const it of b.items) {
          if (!it.anzahl) continue;
          const rest = gibGegenstand(it.id, it.anzahl, it.daten);
          if (rest < it.anzahl) it.anzahl = rest;
          uebrig += rest;
        }
        if (uebrig && taschenUhr <= 0) { chat('system', 'Taschen voll', '#ff9a8a'); taschenUhr = 4; }
        return uebrig === 0;
      }

      ab.push(bus.an('ent:tod', (d) => {
        const e = ents.hole(d?.id); if (!e || e.team !== 'feind') return;
        const sid = spielerId();
        if (sid && d.quelle !== sid) return;
        const stufe = e.daten?.stufe ?? 1;
        gibXp(e.daten?.xp ?? 5 * stufe, 'gegner');
        const tab = e.daten?.beute || (e.daten?.boss ? 'boss' : e.daten?.art);
        streue(BEUTE_TABELLEN[tab] ? tab : 'ratte', e.pos, stufe);
      }));

      // --- Start ---
      startAusruestung();
      summiere();
      if (!(angewendet = wendeAn(false))) angewendet = false;

      intern = {
        fest(dt) {
          taschenUhr -= dt; pruefUhr -= dt;
          if (!angewendet && (angewendet = wendeAn(true))) { /* Spieler-Entität kam später */ }
          for (let i = drops.length - 1; i >= 0; i--) if ((drops[i].alter += dt) > o.dauer) entferne(i);
          if (pruefUhr > 0 || !drops.length) return;
          pruefUhr = 0.1;
          const e = spielerEnt(), p = e ? e.pos : spieler?.position;
          if (!p || (e && !e.lebt)) return;
          const r2 = o.aufheben * o.aufheben;
          for (let i = drops.length - 1; i >= 0; i--) {
            const b = drops[i], dx = b.x - p.x, dz = b.z - p.z;
            if (dx * dx + dz * dz <= r2 && Math.abs(b.y - p.y) < 3 && aufheben(b)) entferne(i);
          }
        },
        update(dt, c) {
          const t = (c?.zeit ?? performance.now() / 1000);
          if (mesh) {
            const n = drops.length; mesh.count = n;
            for (let i = 0; i < n; i++) {
              const b = drops[i], rest = o.dauer - b.alter, s = rest < 3 ? Math.max(0.05, rest / 3) : Math.min(1, b.alter * 4);
              dummy.position.set(b.x, b.y + 0.35 + Math.sin(t * 2 + b.phase) * 0.12, b.z);
              dummy.rotation.set(0, t * 1.4 + b.phase, 0); dummy.scale.setScalar(s);
              dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
              if (farbeDirty) mesh.setColorAt(i, col.set(b.farbe));
            }
            if (n) { mesh.instanceMatrix.needsUpdate = true; if (farbeDirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
            farbeDirty = false;
          }
          if (ring && ringT >= 0) {
            const e = spielerEnt(), p = e ? e.pos : spieler?.position;
            ringT += dt;
            if (!p || ringT > 1.3) { ringT = -1; ring.visible = false; }
            else { ring.visible = true; ring.position.set(p.x, p.y + 0.08, p.z); ring.scale.setScalar(1 + ringT * 2.4); ring.material.opacity = 0.9 * (1 - ringT / 1.3); }
          }
        },
        dispose() {
          for (const f of ab) f();
          if (mesh) { szene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose?.(); }
          if (ring) { szene.remove(ring); ring.geometry.dispose(); ring.material.dispose(); }
          inv.dispose(); register.dispose();
        },
        zustand() {
          const a = {}; for (const s in slots) a[s] = { id: slots[s].id, daten: slots[s].daten };
          return { held: { ...held }, prog: prog.zustand(), inv: inv.zustand(), ausr: a, gesamtXp, zaehler };
        },
        lade(z) {
          if (!z) return;
          if (z.prog) { prog = createProgression({ klasse: z.prog.klasse || z.held?.klasse, name: z.held?.name || held.name }); prog.lade(z.prog); }
          if (z.held) { held.name = z.held.name ?? held.name; held.klasse = prog.klasse; }
          if (z.inv) inv.lade(z.inv);
          for (const s in slots) delete slots[s];
          for (const s in z.ausr || {}) if (register.hat(z.ausr[s]?.id)) slots[s] = { id: z.ausr[s].id, daten: z.ausr[s].daten };
          gesamtXp = z.gesamtXp || 0; zaehler = z.zaehler || 0;
          summiere(); angewendet = wendeAn(false);
        },
      };

      return {
        held, get stufe() { return prog.stufe; }, get xp() { return prog.xp; }, get xpNaechste() { return prog.xpNaechste; },
        gibXp, gibGegenstand: (id, anzahl = 1, daten) => gibGegenstand(id, anzahl, daten), inventar: inv, register, ausruestung, werte, talente,
        seltenheitFarbe, beschreibe, drops, streue,
      };
    },
    fest(dt, c) { intern?.fest(dt, c); },
    update(dt, c) { intern?.update(dt, c); },
    zustand() { return intern?.zustand() ?? null; },
    lade(z) { intern?.lade(z); },
    dispose() { intern?.dispose(); intern = null; },
  };
}
export const FORTSCHRITT_MODUL = createFortschrittModul();
