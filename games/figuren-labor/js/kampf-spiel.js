// Figuren-Labor – Kampf im Spiel: eine Kampf-Welt (engine/gameplay/kampf) für Spieler, NPCs, Puppe und Rivale + Action-Nahkampf des Spielers
// (engine/gameplay/nahkampf): F antippen = Kombo, F halten = schwerer Schlag, Block (B / rechte Maus / 🛡) mit Parade, Q = Ausweichen.
// Ratten bleiben in der Horde (horde.schade); jeder Schaden am Spieler läuft über kampf.schade (Block/Parade/Ausweichen wirken überall).
// Blick = (sin yaw, cos yaw) in (x, z).
import { createKampf } from '../../../engine/gameplay/kampf.js';
import { createNahkampf, WAFFEN } from '../../../engine/gameplay/nahkampf.js';
import { createGegner } from './gegner.js';

const WAFFE_VON = { schwert: 'schwert', axt: 'axt', hammer: 'hammer', dolch: 'dolch', speer: 'speer', stab: 'stab' };
const HALTEN = 0.3;                                   // s: länger gedrückt = schwerer Schlag
const kopf = (p, h = 2) => ({ x: p.x, y: p.y + h, z: p.z });

/**
 * opts: { spieler, npcs, npcsAn(), horde, szene, welt (Adapter), kamera, eingabe (createMoveInput: schlagen, blocken, rollen), lockZiel() -> Figur|null,
 *   seed, klang, schilder, zauber() -> createZauberSpiel-Instanz (wird erst im Betrieb gelesen), onMeldung, onSchmerz, onTod(quelle), onTreffer(ergebnis) }
 */
export function createKampfSpiel({ spieler, npcs, npcsAn = () => true, horde = null, szene, welt, kamera, eingabe, lockZiel = () => null, seed = 1, klang = null, schilder = null,
  zauber, onMeldung = () => {}, onSchmerz = () => {}, onTod = () => {}, onTreffer = () => {} }) {
  const kampf = createKampf({ seed });
  const nk = createNahkampf({ waffe: 'faust' });
  kampf.melde('spieler', { team: 'spieler', leben: 100 });
  npcs.forEach((n, i) => { n.kid = 'npc' + i; kampf.melde(n.kid, { team: 'dorf', leben: 100 }); });
  const st = { fHalt: 0, fAn: false, schwerAn: false, loesen: 0, rechts: false, drehYaw: 0, drehRest: 0, schwung: null, letzter: null, getroffen: false, lade: 0 };
  const ziele = [], byId = new Map();
  const ton = (n, o) => klang?.spiele(n, o);
  const zahl = (pos, text, o) => zauber().zahlen.zeige(pos, text, o);

  const gegner = createGegner({
    kampf, szene, welt, schilder, seed, spieler, klang, onMeldung,
    spielerSchaden: (p) => schadeSpieler(p), spielerPhase: () => nk.phase,
  });

  // Rechte Maustaste = Block (halten)
  const runter = (e) => { if (e.button === 2 && e.pointerType === 'mouse' && !e.target.closest?.('#blatt')) st.rechts = true; };
  const hoch = (e) => { if (e.button === 2 || e.type === 'blur') st.rechts = false; };
  addEventListener('pointerdown', runter); addEventListener('pointerup', hoch); addEventListener('blur', hoch);

  function sammeln() {
    ziele.length = 0; byId.clear();
    const neu = (z) => { ziele.push(z); byId.set(z.id, z); };
    if (horde) for (const w of horde.ziele) neu(w);
    if (npcsAn()) for (const n of npcs) {
      if (n.liegt > 0) continue;
      const p = n.fig.zustand.pos, m = n.fig.model.masse;
      const z = n.kz ??= { id: n.kid, kid: n.kid, fig: n.fig, npc: n, radius: m.radius, hoehe: m.augenHoehe + 0.15, x: 0, y: 0, z: 0 };
      z.x = p.x; z.y = p.y; z.z = p.z;
      neu(z);
    }
    for (const g of gegner.ziele()) neu(g);
  }
  const figVon = (id) => npcs.find((n) => n.kid === id)?.fig || gegner.ziele().find((z) => z.kid === id)?.fig || null;

  /** Schaden des Spielers an einem Gegner (Nahkampf und MMO-Leiste): Zahlen, Rückstoß-Animation, Wut. → ergebnis | null */
  function schadeGegner(id, p) {
    const z = byId.get(id);
    if (!z) return null;
    const pos = kopf(z, z.kid ? 2 : z.hoehe + 0.3);
    let r;
    if (z.kid) {
      const k = kampf.kaempfer(z.kid), moment = k.taumelt;
      r = kampf.schade({ quelle: 'spieler', ziel: z.kid, menge: p.menge * (moment ? 1.5 : 1), art: p.art || 'koerper', wucht: p.wucht ?? 10, richtung: p.richtung, zustand: p.zustand });
      const s = Math.round(r.schaden);
      if (r.ausgewichen) zahl(pos, 'Ausgewichen', { farbe: '#9fe8ff', groesse: 0.9 });
      else if (r.pariert) zahl(pos, 'Pariert!', { farbe: '#ffe070', groesse: 1.1 });
      else if (s > 0) zahl(pos, (r.geblockt ? 'Geblockt ' : '') + s, { farbe: r.krit ? '#ffe070' : r.geblockt ? '#b8c4d0' : '#ffffff', groesse: r.krit ? 1.7 : Math.min(1.8, 0.9 + s / 40), dauer: r.krit ? 0.95 : 0.7 });
      const d = p.richtung ? { x: p.richtung.x, y: 0, z: p.richtung.z } : { x: 0, y: 0, z: 1 };
      if (r.tot && z.npc) { z.fig.umfallen({ x: d.x, y: 0, z: d.z }, { staerke: 1.4, welt: true }); z.npc.liegt = 6; }
      else if (s > 0 && !r.geblockt) z.fig.treffer(d, Math.min(2.2, 0.5 + s / 20), { welt: true });
      if (s > 0 && p.stoss && z.npc) z.fig.stoss?.(p.stoss.x, p.stoss.y, p.stoss.z);
    } else if (horde) {
      const h = horde.schade(z, p.menge, { stoss: p.stoss });
      r = { schaden: h.schaden, tot: h.tot, krit: false };
      if (h.schaden) zahl(pos, String(h.schaden), { farbe: '#ffffff', groesse: Math.min(2, 0.85 + h.schaden / 40), dauer: h.tot ? 0.9 : 0.7 });
      ton(h.tot ? 'tod' : 'quiek', { staerke: 0.5, tonhoehe: 1 });
    }
    if (r && !r.ausgewichen && !r.pariert) {
      zauber().fx.funken({ x: z.x, y: z.y + (z.kid ? 1.1 : z.hoehe * 0.6), z: z.z }, { farbe: r.krit ? 0xffe070 : 0xffffff, anzahl: r.krit ? 12 : 6, tempo: 3, dauer: 0.3, groesse: 0.35 });
      st.letzter = { id, z, t: performance.now() };
      if (r.schaden > 0) onTreffer(r);
    }
    return r;
  }

  /** Schaden am Spieler über die Kampf-Welt (Rivale, Ratten, Mich-treffen) mit Block/Parade/Ausweichen und Rückmeldung. */
  function schadeSpieler({ quelle = null, menge, art = 'koerper', wucht = 10, richtung, krit, leise = false }) {
    const k = kampf.kaempfer('spieler'), z = zauber(), pos = kopf(spieler.zustand.pos);
    if (k.tot) return { schaden: 0, tot: false };
    const d = richtung || { x: 0, z: -1 };
    const r = kampf.schade({ quelle, ziel: 'spieler', menge, art, wucht, richtung: d, krit });
    const s = Math.round(r.schaden), p = spieler.zustand.pos;
    if (r.ausgewichen) zahl(pos, 'Ausgewichen', { farbe: '#9fe8ff', groesse: 1 });
    else if (r.pariert) {
      zahl(pos, 'Pariert!', { farbe: '#ffe070', groesse: 1.3 });
      z.stopp(0.09); kamera.schuetteln(0.25, 0.2); ton('wumms', { staerke: 0.9, tonhoehe: 1.9 });
      z.fx.funken({ x: p.x, y: p.y + 1.2, z: p.z }, { farbe: 0xffe070, anzahl: 14, tempo: 4, dauer: 0.3, groesse: 0.4 });
    } else {
      if (r.geblockt) { zahl(pos, 'Geblockt', { farbe: '#b8c4d0', groesse: 0.95 }); ton('wumms', { staerke: 0.5, tonhoehe: 1.5 }); kamera.schuetteln(0.12, 0.15); }
      if (s > 0) {
        if (!leise || s >= 8) spieler.treffer({ x: d.x, y: 0, z: d.z }, Math.min(1.5, 0.4 + s / 15), { welt: !!quelle });
        onSchmerz(Math.min(1, 0.25 + s / 25));
        zahl(pos, '−' + s, { farbe: '#ff5040', groesse: 0.9, dauer: 0.6 });
        st.getroffen = true;
      } else if (r.abgefangen > 0) z.fx.funken({ x: p.x, y: p.y + 1, z: p.z }, { farbe: 0x7ab8ff, anzahl: 6, tempo: 2, dauer: 0.3, groesse: 0.4 });
      if (!leise && s + r.abgefangen > 0) onMeldung(r.abgefangen > 0 ? `Schild fängt ${Math.round(r.abgefangen)} ab` : `−${s} Leben`);
    }
    if (r.tot) { z.spielerFiel(); onTod(quelle); }
    return r;
  }

  /** Dreht beim Schlag zum Lock-On-Ziel bzw. zum nächsten Gegner vor dir (bis 4,5 m). → yaw | null */
  function zielHilfe() {
    const p = spieler.zustand.pos, yaw = spieler.zustand.yaw, fest = lockZiel();
    let best = null, bd = 4.5;
    for (const q of ziele) {
      const dx = q.x - p.x, dz = q.z - p.z, a = Math.atan2(dx, dz), d = Math.hypot(dx, dz) - (q.fig && q.fig === fest ? 100 : 0);
      if (d < bd && (q.fig === fest || Math.abs(Math.atan2(Math.sin(a - yaw), Math.cos(a - yaw))) < 1.2)) { best = a; bd = d; }
    }
    return best;
  }

  function nahkampfEreignis(e) {
    const z = spieler.zustand;
    if (e.typ === 'schwung') {
      st.schwung = e; st.lade = 0;
      spieler.spiele(e.clip);
      const a = zielHilfe(), y = a ?? z.yaw;
      if (a !== null) { st.drehYaw = a; st.drehRest = 0.3; }
      spieler.stoss(Math.sin(y) * e.schritt * 4, 0, Math.cos(y) * e.schritt * 4);
      ton('zisch', { staerke: 0.3 + 0.15 * (e.kraft - 1), tonhoehe: 1.5 - 0.3 * e.kraft });
    } else if (e.typ === 'laden') st.lade = e.anteil;
    else if (e.typ === 'treffer') {
      const schwer = e.schlag === 'schwer', letzte = st.schwung ? st.schwung.kombo >= WAFFEN[nk.waffe].leicht.length - 1 : false, finisher = schwer || letzte;
      let n = 0;
      for (const t of e.treffer) if (schadeGegner(t.ziel, { menge: t.menge, art: t.art, wucht: t.wucht, richtung: t.richtung, stoss: t.stoss })) n++;
      if (!n) return;
      ton('wumms', { staerke: finisher ? 0.9 : 0.4, tonhoehe: finisher ? 0.9 : 1.4 });
      zauber().stopp(schwer ? 0.09 : letzte ? 0.07 : 0.025);
      kamera.schuetteln(schwer ? 0.45 : letzte ? 0.3 : 0.08, finisher ? 0.25 : 0.12);
    } else if (e.typ === 'ausweichen') ton('zisch', { staerke: 0.4, tonhoehe: 1.8 });
  }

  /** F, Block und Ausweichen auswerten. kann = der Spieler darf gerade handeln. */
  function eingaben(dt, kann, absicht) {
    const z = spieler.zustand;
    if (!kann) { st.fAn = st.schwerAn = false; if (nk.phase === 'block') nk.block(false); return; }
    if (eingabe.gedrueckt('schlagen')) { st.fAn = true; st.fHalt = 0; }
    if (st.fAn) {
      if (eingabe.gehalten('schlagen')) {
        if (!st.schwerAn && (st.fHalt += dt) > HALTEN) { nk.angriff('schwer'); st.schwerAn = true; }
      } else {
        if (st.schwerAn) { nk.lasseLos(); st.loesen = 0.6; } else nk.angriff('leicht');
        st.fAn = st.schwerAn = false;
      }
    }
    if (st.loesen > 0) { st.loesen -= dt; if (nk.phase === 'laden') { nk.lasseLos(); st.loesen = 0; } }
    const block = eingabe.gehalten('blocken') || st.rechts;
    if (block && nk.phase !== 'block') nk.block(true); else if (!block && nk.phase === 'block') nk.block(false);
    if (eingabe.gedrueckt('rollen')) nk.ausweichen(Math.hypot(absicht.x, absicht.z) > 0.1 ? { x: absicht.x, z: absicht.z } : { x: -Math.sin(z.yaw), z: -Math.cos(z.yaw) });
  }

  function ereignisse(dt) {
    for (const e of kampf.update(dt)) {
      gegner.ereignis(e);
      if (e.typ === 'kampf:heilung' && e.ziel === 'spieler' && e.menge >= 1) zahl(kopf(spieler.zustand.pos), '+' + Math.round(e.menge), { farbe: '#6dff8a', groesse: 0.9 });
      else if (e.typ === 'kampf:tot' && e.ziel === 'spieler' && !zauber().tot) { zauber().spielerFiel(); onTod(e.quelle); }   // z. B. Brennen
    }
    for (const n of npcs) {   // NPC-Leben und Tod (auch durch Brennen) spiegeln
      const k = kampf.kaempfer(n.kid);
      if (k.leben !== n.leben) { n.leben = k.leben; n.fig.setLeben(k.leben >= k.lebenMax ? null : Math.max(0, k.leben) / k.lebenMax); }
      if (k.tot && !(n.liegt > 0)) { n.fig.umfallen({ x: 0, y: 0, z: -1 }, { staerke: 1, welt: true }); n.liegt = 6; }
    }
  }

  return {
    kampf, nahkampf: nk, gegner, schadeGegner, schadeSpieler,
    get waffe() { return nk.waffe; },
    setWaffe: (name) => nk.setWaffe(name),
    /** Waffe passend zur Ausrüstung (Namen aus setAusruestung): schwert/axt/hammer/dolch/speer/stab, sonst Faust. */
    waffeAus(namen) { const w = namen.find((n) => WAFFE_VON[n]); nk.setWaffe(w ? WAFFE_VON[w] : 'faust'); },
    /** Nahkampf-Angriff aus der MMO-Leiste. */
    angriff: (art = 'leicht') => nk.angriff(art),
    get drehYaw() { return st.drehRest > 0 ? st.drehYaw : undefined; },
    /** Aufladen des schweren Schlags für die Ladeleiste (wie zauber.buch.ladung) oder null. */
    get ladung() { return nk.phase === 'laden' ? { phase: 'laden', anteil: st.lade, ueber: 0 } : null; },
    /** true, wenn der Spieler seit dem letzten Aufruf Schaden bekam (Zauber-Rückstoß in der MMO-Leiste). */
    nimmGetroffen() { const g = st.getroffen; st.getroffen = false; return g; },
    gegnerListe: () => ziele,
    zielDaten: (id) => byId.get(id) || null,
    figuren: () => gegner.ziele().map((z) => z.fig),
    kidVon: (fig) => npcs.find((n) => n.fig === fig)?.kid || gegner.ziele().find((z) => z.fig === fig)?.kid || null,
    /** Zuletzt getroffenes Ziel (8 s lang, solange es lebt) oder null. */
    letzterId: () => (st.letzter && performance.now() - st.letzter.t < 8000 && byId.get(st.letzter.id) ? st.letzter.id : null),
    /** Daten für den Ziel-Rahmen (Kämpfer oder Ratte) oder null. */
    info(id) {
      const k = kampf.kaempfer(id);
      if (k) {
        const fig = figVon(id);
        const stufe = id === 'puppe' ? `DPS ${Math.round(kampf.dps('spieler'))}` : undefined;
        return { name: fig?.name || id, stufe, leben: k.leben, lebenMax: k.lebenMax, schild: k.schild, haltung: k.haltung, haltungMax: k.haltungMax, taumelt: k.taumelt,
          feindlich: kampf.feindlich('spieler', id), imKampf: kampf.imKampf(id), zustaende: kampf.zustaende(id).liste() };
      }
      const w = byId.get(id);
      return w && !w.tot && w.def ? { name: w.def.name, leben: w.leben, lebenMax: w.lebenMax, feindlich: true, zustaende: [] } : null;
    },
    alleHeilen() { kampf.kaempfer('spieler').belebe(1); gegner.alleHeilen(); },
    /** Pro Frame (nach zuAbsicht): Eingabe, Nahkampf, Kämpfer-Abwehr, Tempo. Ändert absicht (Tempo, Sperren). */
    update(dt, absicht) {
      sammeln();
      const f = kampf.zustaende('spieler').faktoren(), k = kampf.kaempfer('spieler'), z = spieler.zustand, zp = zauber();
      const kann = !zp.tot && f.kannHandeln !== false && !zp.buch.wirkt && !z.imWasser && !k.tot;
      eingaben(dt, kann, absicht);
      if (st.drehRest > 0) st.drehRest -= dt;
      for (const e of nk.update(dt, { x: z.pos.x, y: z.pos.y, z: z.pos.z, yaw: z.yaw }, ziele)) nahkampfEreignis(e);
      const a = nk.abwehr;
      Object.assign(k.abwehr, { block: a.block, parade: a.parade, unverwundbar: a.unverwundbar, yaw: z.yaw });
      const s = nk.tempoFaktor * f.tempo;
      if (f.kannHandeln === false || f.kannLaufen === false) { absicht.x = absicht.z = 0; absicht.springen = false; absicht.sprint = false; }
      else if (s !== 1) { absicht.x *= s; absicht.z *= s; if (s < 1) { absicht.sprint = false; absicht.springen = false; } }
      gegner.update(dt);
      ereignisse(dt);
    },
    dispose() {
      removeEventListener('pointerdown', runter); removeEventListener('pointerup', hoch); removeEventListener('blur', hoch);
      gegner.dispose(); nk.dispose(); kampf.dispose();
    },
  };
}
