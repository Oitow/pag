/**
 * @modul    modul-tutorial
 * @zweck    Spiel-Modul 'tutorial': Aufgabenkette (Alwe am Strand → Brandt in Erlenwacht → Grauzahn), Quest-NPCs mit !/?-Schild, Dialog-Fenster, Aufgaben-Verfolger rechts, Wegpunkt-Säule + Randpfeil
 * @api      TUTORIAL_MODUL
 * @beispiel
 *   import { TUTORIAL_MODUL } from '../../engine/spiel/modul-tutorial.js';
 *   const spiel = await createSpiel({ canvas, module: [WELT_MODUL, SPIELER_MODUL, TUTORIAL_MODUL] });
 *   spiel.api('tutorial').sprich('alwe');
 * @tags     spiel, modul, tutorial, aufgaben, quest, npc, dialog, wegpunkt
 * @version  1.1.0
 * @status   entwurf
 * @three    ja
 *
 * Dorf (optional, Modul 'dorf'): NPCs mit punkt, gehe-zu mit punkt und Aufgaben-Art 'ereignis' nutzen dorf.punkt/ziele; ohne Dorf gelten ort + versatz, Ereignis-Schritte sind automatisch erfüllt.
 * Hört zusätzlich: dorf:benutzt {art}, dorf:gebunden.
 * Modul-API: { aufgaben /* gameplay/aufgaben *\/, npcs {id: {figur,name,id,ent}}, sprich(npcId) }. Hört: ent:tod, fort:beute|ausgeruestet|stufe|talent, spieler:aktion.
 * Sendet: aufgabe:neu|schritt|fertig, chat:sende {kanal:'aufgabe'|'sagen'}. Belohnung über fortschritt.gibXp/gibGegenstand. ?test=1: kein Auto-Dialog.
 */
import * as THREE from 'three';
import { createCharacter } from '../gameplay/character.js';
import { createLook, VORLAGEN } from '../models/character/character-look.js';
import { createFigurSchilder } from '../ui/figur-schild.js';
import { createAufgaben } from '../gameplay/aufgaben.js';
import { createInteraktion } from '../gameplay/interaktion.js';
import { createAufgabenAnzeige } from '../ui/aufgaben-anzeige.js';
import { AUFGABEN_DATEN, NPC_DATEN } from './tutorial-daten.js';

const STANDARD = { auto: true, reichweite: 2.5, dialogAbstand: 9, fern: 150, verfolgerOben: 170 };
const GOLD = '#ffd45a';
const AUTO_SCHRITTE = ['beute', 'ausruesten', 'stufe-4', 'talent'];   // brauchen Modul fortschritt, sonst automatisch erfüllt
const LOOKS = {
  alwe: { ...VORLAGEN.jaegerin, haar: { stil: 'pferdeschwanz', farbe: '#a8481e' } },
  brandt: { ...VORLAGEN.wache, ausdruck: 'neutral' },
};
const DIALOG_CSS = `
.tut-dialog{position:fixed;left:50%;bottom:270px;transform:translateX(-50%);width:min(88vw,400px);box-sizing:border-box;padding:10px 14px 12px;border-radius:14px;
  background:rgba(22,18,12,.9);border:2px solid ${GOLD};color:#f4ecd8;font:15px/1.4 system-ui,sans-serif;pointer-events:auto;z-index:30;display:none}
.tut-dialog b{display:block;color:${GOLD};font-size:14px;margin-bottom:3px}
.tut-dialog button{display:block;width:100%;margin-top:9px;padding:13px 0;font:700 17px system-ui,sans-serif;color:#2a2010;background:${GOLD};border:0;border-radius:10px;touch-action:manipulation}
.tut-hinweis{position:fixed;left:50%;bottom:300px;transform:translateX(-50%);padding:6px 14px;border-radius:16px;background:rgba(22,18,12,.75);color:${GOLD};font:600 14px system-ui,sans-serif;pointer-events:none;z-index:29;display:none}
`;

let laufend = null;

export const TUTORIAL_MODUL = {
  name: 'tutorial', braucht: ['welt', 'spieler'], optional: ['entitaeten', 'fortschritt', 'kampf', 'render', 'himmel', 'dorf'], standard: STANDARD,
  start(ctx) {
    const o = { ...STANDARD, ...ctx.optionen };
    const welt = ctx.braucht('welt'), sp = ctx.braucht('spieler');
    const render = ctx.optional('render') || ctx.kern?.api?.('render');
    const ent = ctx.optional('entitaeten'), bus = ctx.ereignisse;
    const entDa = typeof ent?.neu === 'function';
    const boden = welt.kollision || welt;
    const doc = globalThis.document;
    const ui = render?.ui || doc?.body;
    const fort = () => { const f = ctx.optional('fortschritt'); return f && typeof f.gibXp === 'function' ? f : null; };
    const chat = (kanal, text, von) => bus.sende('chat:sende', { kanal, text, ...(von ? { von } : {}) });
    const ortVon = (n) => { const q = welt.ort?.(n) || welt.orte?.find((x) => x.art === n); return q ? { x: q.x, z: q.z } : null; };
    const dorf = (() => { const d = ctx.optional('dorf'); return d && typeof d.punkt === 'function' ? d : null; })();
    const punktVon = (id) => { const q = dorf?.punkt(id); return q && Number.isFinite(q.x) && Number.isFinite(q.z) ? { x: q.x, z: q.z } : null; };
    const ab = [];

    // --- Aufgaben: übersetzt die Kern-Ereignisse in die Namen des Plans ---
    const titel = (id) => AUFGABEN_DATEN.find((a) => a.id === id)?.name ?? id;
    let blitzFn = null;
    const proxy = { sende(name, d) {
      if (name === 'aufgabe:start') {
        bus.sende('aufgabe:neu', { id: d.aufgabe, titel: titel(d.aufgabe) });
        chat('aufgabe', `Neue Aufgabe: ${titel(d.aufgabe)}`);
        for (const t of AUFGABEN_DATEN.find((a) => a.id === d.aufgabe)?.intro ?? []) chat('sagen', t);
      } else if (name === 'aufgabe:schritt' || name === 'aufgabe:fortschritt') {
        const k = aufgaben?.aktuell(d.aufgabe);
        bus.sende('aufgabe:schritt', { id: d.aufgabe, text: k?.text ?? '', anteil: k?.anteil ?? 0 });
      } else if (name === 'aufgabe:fertig') {
        bus.sende('aufgabe:fertig', { id: d.aufgabe, titel: titel(d.aufgabe) });
        chat('aufgabe', `Aufgabe erledigt: ${titel(d.aufgabe)}`);
        blitzFn?.(`✔ ${titel(d.aufgabe)}`);
        belohne(d.belohnung);
      }
    } };
    function belohne(b) {
      if (!b) return;
      const f = fort();
      if (b.xp) { if (f) f.gibXp(b.xp, 'aufgabe'); else chat('aufgabe', `+${b.xp} Erfahrung`); }
      for (const g of b.gegenstaende ?? []) { if (f) f.gibGegenstand(g, 1); else chat('beute', `Erhalten: ${g}`); }
    }
    const aufgaben = createAufgaben({ daten: AUFGABEN_DATEN, ereignisse: proxy, ortVon, punktVon });

    // --- NPCs ---
    const schilder = createFigurSchilder({ wurzel: ui });
    const spFigur = () => sp.figur;
    const spPos = () => spFigur()?.zustand?.pos || sp.position || welt.startPunkt;
    const npcs = {};
    for (const d of Object.values(NPC_DATEN)) {
      const dp = d.punkt ? dorf?.punkt(d.punkt) : null;
      const ort = welt.ort?.(d.ort) || { x: welt.startPunkt?.x ?? 0, z: welt.startPunkt?.z ?? 0 };
      const x = dp ? dp.x : ort.x + d.versatz.x, z = dp ? dp.z : ort.z + d.versatz.z, y = Number.isFinite(dp?.y) ? dp.y : welt.bodenHoehe(x, z);
      const p0 = spPos();
      const yaw = p0 ? Math.atan2(p0.x - x, p0.z - z) : (dp?.winkel ?? 0);
      const figur = createCharacter({ look: createLook(LOOKS[d.id] || VORLAGEN[d.vorlage] || VORLAGEN.wanderer), seed: 7 + d.id.length, welt: boden, name: d.name, schilder, mimik: false,
        pos: { x, y, z }, yaw, schild: { farbe: GOLD } });
      figur.root.visible = true;
      render?.szene?.add(figur.root);
      figur.blickZu(spFigur());
      const n = { id: d.id, name: d.name, figur, ent: null, marke: '', daten: d, yaw };
      if (entDa) n.ent = ent.neu({ art: 'npc', team: 'freund', pos: { x, y, z }, radius: figur.motor.radius, leben: 500, name: d.name, daten: { figur, npc: d.id, quest: true } });
      npcs[d.id] = n;
    }

    // --- Dialog (DOM) ---
    const stil = doc.createElement('style'); stil.textContent = DIALOG_CSS; doc.head.appendChild(stil);
    const dlg = doc.createElement('div'); dlg.className = 'tut-dialog';
    const dName = doc.createElement('b'), dText = doc.createElement('div'), dKnopf = doc.createElement('button');
    dlg.append(dName, dText, dKnopf); ui.appendChild(dlg);
    const hinweis = doc.createElement('div'); hinweis.className = 'tut-hinweis'; ui.appendChild(hinweis);
    let gespraech = null, floskel = 0;
    const setzeText = (el, t) => { if (el.textContent !== t) el.textContent = t; };

    function zeigeZeile() {
      const g = gespraech; if (!g) return;
      const t = g.zeilen[g.i];
      setzeText(dName, g.npc.name); setzeText(dText, t);
      setzeText(dKnopf, g.i + 1 < g.zeilen.length ? 'Weiter ▶' : 'Fertig ✔');
      chat('sagen', t, g.npc.name);
      g.npc.figur.sage(t, { dauer: 3, geste: g.i === 0 ? 'winken' : undefined });
    }
    function schliesse(fertig) {
      const g = gespraech; if (!g) return;
      gespraech = null; dlg.style.display = 'none';
      g.npc.figur.blickZu(spFigur());
      if (fertig && g.melde) aufgaben.melde('gesprochen', { mit: g.npc.id });
    }
    function weiter() { const g = gespraech; if (!g) return; if (++g.i < g.zeilen.length) zeigeZeile(); else schliesse(true); }
    dKnopf.addEventListener('click', weiter);

    function sprich(id, zeilen) {
      const n = npcs[id]; if (!n) return false;
      if (gespraech) schliesse(false);
      let melde = false;
      if (!zeilen) {
        const aktiv = aufgaben.aktiv().map((a) => aufgaben.aktuell(a)).find((a) => a?.schritt.art === 'sprich-mit' && a.schritt.ziel === id);
        if (aktiv?.schritt.sagt) { zeilen = aktiv.schritt.sagt; melde = true; }
        else zeilen = [n.daten.floskeln[floskel++ % n.daten.floskeln.length]];
      }
      gespraech = { npc: n, zeilen, i: 0, melde };
      dlg.style.display = 'block'; hinweis.style.display = 'none';
      n.figur.blickZu(spFigur());
      zeigeZeile();
      return true;
    }

    // --- Interaktion (Knopf 💬 / E) ---
    const ia = createInteraktion({ reichweite: o.reichweite });
    for (const n of Object.values(npcs)) ia.melde('npc-' + n.id, { pos: () => n.figur.zustand.pos, radius: 0.5, reichweite: o.reichweite, art: 'npc', text: n.name + ' ansprechen', prio: 1, daten: n.id,
      aktion: () => sprich(n.id) });
    // Dorf-Stationen (Brunnen, Schrein, Anschlagbrett, Amboss, Feuer): Auslösen ruft dorf.benutze, das Ereignis kommt über den Bus zurück
    for (const zl of dorf?.ziele ?? []) {
      if (!zl?.id || !zl.pos) continue;
      ia.melde('dorf-' + zl.id, { pos: () => zl.pos, radius: zl.radius ?? 1, reichweite: Math.max(o.reichweite, zl.radius ?? 0), art: zl.art ?? 'dorf', text: zl.text ?? zl.id, prio: 0, daten: null,
        aktion: () => { const e = dorf.benutze(zl.id, spFigur()); if (e?.text) chat('sagen', e.text); } });
    }
    const wer = { x: 0, y: 0, z: 0, yaw: NaN };   // Blickrichtung egal: 2.5 m Reichweite rundum

    // --- Verfolger + Wegpunkt ---
    const anzeige = createAufgabenAnzeige({ eltern: ui, zIndex: 20 });
    const karte = anzeige.element.firstChild;
    Object.assign(karte.style, { left: 'auto', right: '8px', top: `max(${o.verfolgerOben}px,calc(env(safe-area-inset-top) + 130px))`, maxWidth: 'min(210px,46vw)', padding: '6px 9px' });
    blitzFn = (t) => anzeige.blitz(t, { dauer: 3 });
    let schmutzig = true, domUhr = 0;
    ab.push(aufgaben.onAenderung(() => { schmutzig = true; }));
    let saeule = null;
    if (render?.szene) {
      const geo = new THREE.CylinderGeometry(0.6, 0.9, 40, 12, 1, true);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
      saeule = new THREE.Mesh(geo, mat); saeule.visible = false; saeule.frustumCulled = false; saeule.renderOrder = 5;
      render.szene.add(saeule);
    }
    const zielPkt = { x: 0, y: 0, z: 0 };
    let zielDa = false;
    function ladeZiel() {
      const k = aufgaben.aktuell();
      let p = k?.ort ?? null;
      if (!p && k?.schritt.art === 'sprich-mit') p = npcs[k.schritt.ziel]?.figur.zustand.pos ?? null;
      zielDa = !!p;
      if (p) { zielPkt.x = p.x; zielPkt.z = p.z; zielPkt.y = welt.bodenHoehe(p.x, p.z) + 2.2; anzeige.ziel(zielPkt); }
      else anzeige.ziel(null);
      if (saeule) { saeule.visible = zielDa; if (p) saeule.position.set(p.x, zielPkt.y - 2.2 + 20, p.z); }
    }

    function marken() {
      const akt = aufgaben.aktiv().map((a) => aufgaben.aktuell(a)).filter(Boolean);
      for (const n of Object.values(npcs)) {
        const k = akt.find((a) => a.schritt.art === 'sprich-mit' && a.schritt.ziel === n.id);
        const m = !k ? '' : AUFGABEN_DATEN.find((a) => a.id === k.aufgabe.id)?.geber === n.id ? '❗' : '❓';
        if (m !== n.marke) { n.marke = m; n.figur.setName(m ? `${m} ${n.name}` : n.name); }
      }
    }

    // --- Signale ---
    const art = (e) => (e?.daten?.boss ? 'boss' : e?.daten?.art ?? e?.art ?? '');
    ab.push(bus.an('ent:tod', (d) => {
      const e = ent?.hole?.(d?.id);
      if (!e || e.team !== 'feind') return;
      aufgaben.melde('besiegt', { art: art(e) });
      aufgaben.melde('besiegt', { art: '*' });
    }));
    ab.push(bus.an('dorf:benutzt', (d) => { if (d?.art) aufgaben.melde('ereignis', { was: d.art }); }));
    ab.push(bus.an('dorf:gebunden', () => aufgaben.melde('ereignis', { was: 'gebunden' })));
    ab.push(bus.an('fort:beute', () => aufgaben.melde('benutzt', { was: 'beute' })));
    ab.push(bus.an('fort:ausgeruestet', (d) => { if (d?.gegenstand != null) aufgaben.melde('benutzt', { was: 'ausruesten' }); }));
    ab.push(bus.an('fort:stufe', (d) => { if ((d?.stufe ?? 0) >= 4) aufgaben.melde('benutzt', { was: 'stufe-4' }); }));
    ab.push(bus.an('fort:talent', () => aufgaben.melde('benutzt', { was: 'talent' })));
    ab.push(bus.an('spieler:aktion', (d) => { if (d?.name === 'springen' || d?.name === 'sprint') aufgaben.melde('benutzt', { was: d.name }); }));

    let gestartet = false, camYaw = null, camSumme = 0, aufTimer = 0;
    ladeZiel(); marken();

    laufend = {
      update(dt) {
        const p = spPos(); if (!p) return;
        if (!gestartet) {
          gestartet = true;
          if (aufgaben.status('erwachen') === 'neu' && !aufgaben.aktiv().length) aufgaben.starte('erwachen');
          if (o.auto && !render?.test && aufgaben.aktuell()?.aufgabe.id === 'erwachen' && aufgaben.aktuell().index === 0) {
            const t = setTimeout(() => { if (!gespraech) sprich('alwe', NPC_DATEN.alwe.begruessung); }, 1500);
            ab.push(() => clearTimeout(t));
          }
        }
        // Kamera-Drehung für den Schritt 'kamera'
        const k = aufgaben.aktuell(), w = k?.schritt.was;
        const cy = sp.kamera?.yaw;
        if (w === 'kamera' && Number.isFinite(cy)) {
          if (camYaw != null) camSumme += Math.abs(Math.atan2(Math.sin(cy - camYaw), Math.cos(cy - camYaw)));
          camYaw = cy;
          if (camSumme > 0.9) { camSumme = 0; aufgaben.melde('benutzt', { was: 'kamera' }); }
        } else { camYaw = null; camSumme = 0; }
        // ohne Fortschritt-Modul: Beute-/Ausrüstungs-/Stufen-Schritte entfallen; Stufe bereits erreicht
        if (AUTO_SCHRITTE.includes(w)) {
          const f = fort();
          if (!f || (w === 'stufe-4' && f.stufe >= 4)) aufgaben.melde('benutzt', { was: w });
        }
        if (!dorf && k?.schritt.art === 'ereignis') aufgaben.melde('ereignis', { was: k.schritt.was });   // ohne Dorf: Schritt entfällt
        aufgaben.update(dt, p);
        for (const n of Object.values(npcs)) {
          const q = n.figur.zustand.pos, d = Math.hypot(q.x - p.x, q.z - p.z);
          n.figur.root.visible = d < o.fern;
          if (d < o.fern) n.figur.update(dt, null);
        }
        // Interaktion
        wer.x = p.x; wer.y = p.y; wer.z = p.z;
        ia.aktualisiere();
        const z = ia.beste(wer);
        const taste = sp.eingabe?.gedrueckt?.('interagieren');
        if (taste && !gespraech) ia.ausloesen(wer, z || undefined);
        else if (taste && gespraech) weiter();
        if (gespraech) {
          const q = gespraech.npc.figur.zustand.pos;
          if (Math.hypot(q.x - p.x, q.z - p.z) > o.dialogAbstand) schliesse(false);
        }
        const h = !gespraech && z ? `💬 ${z.daten ? npcs[z.daten]?.name : z.text}` : '';
        if (h !== hinweis.textContent) { hinweis.textContent = h; hinweis.style.display = h ? 'block' : 'none'; }
        // Verfolger höchstens 10×/s
        domUhr += dt;
        if (schmutzig && domUhr >= 0.1) {
          domUhr = 0; schmutzig = false;
          anzeige.setze(aufgaben.aktuell()); ladeZiel(); marken();
        }
        aufTimer += dt;
        if (saeule?.visible) { const s = 1 + 0.12 * Math.sin(aufTimer * 3); saeule.scale.set(s, 1, s); saeule.material.opacity = 0.26 + 0.1 * Math.sin(aufTimer * 3); }
      },
      spaet(dt) {
        schilder.update(render?.kamera, dt);
        anzeige.update(render?.kamera, dt, spPos());
      },
    };

    laufend.zustand = () => ({ v: 1, aufgaben: aufgaben.zustand() });
    laufend.lade = (z) => { if (z?.aufgaben) { aufgaben.laden(z.aufgaben); gestartet = true; schmutzig = true; } };
    laufend.dispose = () => {
      {
        for (const f of ab) f?.();
        ia.dispose(); anzeige.dispose(); aufgaben.dispose();
        for (const n of Object.values(npcs)) { if (entDa && n.ent != null) ent.entferne?.(n.ent); n.figur.dispose(); }
        if (saeule) { saeule.removeFromParent(); saeule.geometry.dispose(); saeule.material.dispose(); }
        schilder.dispose(); dlg.remove(); hinweis.remove(); stil.remove();
      }
    };
    return { aufgaben, npcs, sprich: (id) => sprich(id) };
  },
  update(dt) { laufend?.update(dt); },
  spaet(dt) { laufend?.spaet(dt); },
  zustand() { return laufend?.zustand?.() ?? null; },
  lade(z) { laufend?.lade?.(z); },
  dispose() { laufend?.dispose?.(); laufend = null; },
};
