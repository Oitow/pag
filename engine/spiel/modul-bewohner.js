/**
 * @modul    modul-bewohner
 * @zweck    Spiel-Modul 'bewohner': 6–10 Siedler an welt.ort('siedlung') mit Tagesablauf (character-brain, Stunde aus himmel.uhr), Namensschildern, Entität je Bewohner (Team freund), Treffer/Tod-Reaktion, LOD (ferne NPCs seltener, ganz ferne eingefroren)
 * @api      BEWOHNER_MODUL
 * @beispiel
 *   import { BEWOHNER_MODUL } from '../../engine/spiel/modul-bewohner.js';
 *   const spiel = await createSpiel({ canvas, module: [WELT_MODUL, SPIELER_MODUL, BEWOHNER_MODUL], optionen: { bewohner: { anzahl: 6 } } });
 * @tags     spiel, modul, npc, bewohner, siedlung, tagesablauf, namensschild, lod
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 *
 * Modul-API: { bewohner [{figur,name,id,heim}], mitte {x,z}, schilder, stunde }.
 */
import { createCharacter } from '../gameplay/character.js';
import { randomLook } from '../models/character/character-look.js';
import { createFigurSchilder } from '../ui/figur-schild.js';
import { hashSeed, pick, range, int } from '../core/rng.js';

const NAMEN = ['Alrik', 'Hedda', 'Bruni', 'Ortwin', 'Gesa', 'Lorenz', 'Ilka', 'Wendel', 'Marthe', 'Ansgar', 'Runa', 'Tilmann', 'Ebba', 'Folkert'];
const ARBEIT = ['hacken', 'fegen', 'graben', 'haemmern'];
const GRUSS = ['Moin!', 'Na, Wanderer?', 'Grüß dich!', 'Willkommen in Erlenwacht.', 'Pass auf im Dämmerwald.'];
const STANDARD = { anzahl: null, radius: 22, nah: 45, mittel: 120, fern: 220, leben: 60, wiederkehr: 30 };

let laufend = null;

export const BEWOHNER_MODUL = {
  name: 'bewohner', braucht: ['render', 'welt'], optional: ['entitaeten', 'himmel'], standard: STANDARD,
  start(ctx) {
    const o = { ...STANDARD, ...ctx.optionen };
    const render = ctx.braucht('render'), welt = ctx.braucht('welt');
    const ent = ctx.optional('entitaeten'), himmel = ctx.optional('himmel');
    const entDa = typeof ent?.neu === 'function';
    const r = ctx.zufall, bus = ctx.ereignisse;
    const boden = welt.kollision || welt;
    const ort = welt.ort?.('siedlung');
    const mitte = ort ? { x: ort.x, z: ort.z } : { x: (welt.startPunkt?.x ?? 0) + 30, z: welt.startPunkt?.z ?? 0 };
    const radius = Math.min(o.radius, (ort?.radius ?? o.radius) * 0.6);
    const schilder = createFigurSchilder({ wurzel: render.ui || globalThis.document?.body });
    const trocken = (x, z) => { const w = welt.wasserHoehe?.(x, z); return w == null || w < welt.bodenHoehe(x, z); };
    const blockiert = (x, z) => { const h = boden.hindernisse?.(x, z, 0.5); return !!h && Math.abs(h.x) + Math.abs(h.z) > 1e-4; };
    const frei = (x, z, streng) => (streng && welt.flaecheFrei ? welt.flaecheFrei(x, z, 0.6) : trocken(x, z)) && !blockiert(x, z);
    function platz(cx, cz, rad) {
      let x = cx, z = cz;
      for (let v = 0; v < 24; v++) {           // erst streng (flaecheFrei), dann nur trocken + kein Hindernis
        const a = r() * Math.PI * 2, d = (0.25 + 0.75 * Math.sqrt(r())) * rad;
        x = cx + Math.sin(a) * d; z = cz + Math.cos(a) * d;
        if (frei(x, z, v < 12)) return { x, z };
      }
      return { x, z };
    }

    const anzahl = o.anzahl ?? int(r, 6, 10);
    const namen = [...NAMEN];
    const bewohner = [];
    const neueEntitaet = (b) => {
      if (!entDa) return null;
      const p = b.figur.zustand.pos;
      return ent.neu({ art: 'npc', team: 'freund', pos: { x: p.x, y: p.y, z: p.z }, radius: b.figur.motor.radius, leben: o.leben, name: b.name, daten: { figur: b.figur } });
    };
    for (let i = 0; i < anzahl; i++) {
      const s = hashSeed('bewohner', ctx.seed, i);
      const name = namen.length ? namen.splice(int(r, 0, namen.length - 1), 1)[0] : `Siedler ${i + 1}`;
      const heim = platz(mitte.x, mitte.z, radius);
      const werk = platz(mitte.x, mitte.z, radius * 0.8);
      // Tagesablauf: früh ums Haus, vormittags + nachmittags arbeiten, mittags/abends auf dem Platz, nachts zu Hause ruhen
      const plan = [
        { von: 6, bis: 8, zustand: 'wandern', radius: 5, heimat: heim },
        { von: 8, bis: 12, zustand: 'arbeiten', ort: werk, clip: pick(r, ARBEIT) },
        { von: 12, bis: 13.5, zustand: 'wandern', radius: radius * 0.5, heimat: mitte },
        { von: 13.5, bis: 18, zustand: 'arbeiten', ort: werk, clip: pick(r, ARBEIT) },
        { von: 18, bis: 22, zustand: 'wandern', radius: 8, heimat: mitte },
        { von: 22, bis: 6, zustand: 'arbeiten', ort: heim, clip: r() < 0.5 ? 'schlafen' : 'sitzenBoden' },
      ];
      const figur = createCharacter({
        look: randomLook(s, { kind: r() < 0.15 }), seed: s, welt: boden, name, schilder, mimik: false,
        pos: { x: heim.x, y: welt.bodenHoehe(heim.x, heim.z), z: heim.z }, yaw: range(r, -Math.PI, Math.PI),
        brain: { heimat: heim, grund: { zustand: 'wandern', radius: 8 }, plan, reaktion: { feind: 'fliehen' },
          verhalten: { plauderChance: 0.03, idleClips: ['umschauen', 'kratzen', 'strecken'] } },
      });
      render.szene.add(figur.root);
      const b = { figur, name, heim, id: null, tot: false, totUhr: 0, schaut: false, summe: 0, phase: i % 8 };
      b.id = neueEntitaet(b);
      bewohner.push(b);
    }
    const nachId = (id) => bewohner.find((b) => b.id === id && id != null);

    const ab = [];
    if (entDa) {
      ab.push(bus.an('ent:treffer', (d) => {
        const b = nachId(d?.id); if (!b || b.tot) return;
        const q = d.quelle != null ? ent.hole?.(d.quelle)?.pos : d.pos, p = b.figur.zustand.pos;
        const rx = q ? p.x - q.x : 0, rz = q ? p.z - q.z : 1, l = Math.hypot(rx, rz) || 1;
        b.figur.treffer({ x: rx / l, z: rz / l }, Math.min(1.2, Math.max(0.3, (+d.menge || 10) / 20)), { welt: true });
        b.figur.sage(pick(r, ['Au!', 'Hilfe!', 'Lass das!']), { dauer: 1.5 });
        b.figur.brain?.setze?.('fliehen', { ziel: q ? () => q : undefined });
      }));
      ab.push(bus.an('ent:tod', (d) => {
        const b = nachId(d?.id); if (!b || b.tot) return;
        b.tot = true; b.totUhr = o.wiederkehr;
        b.figur.umfallen({ x: 0, z: 1 }, { welt: true }); b.figur.setLeben(null);
      }));
    }

    const kontext = { nachbarn: [], npcs: [], stunde: 12, ziele: [] };
    let bild = 0;
    const fokusPos = () => { const f = ctx.dienst('fokus'); return (typeof f === 'function' ? f() : f) || render.kamera.position; };
    const spieler = () => ctx.kern.api('spieler')?.figur || null;

    function npcUpdate(b, dt, sp, d) {
      const p = b.figur.zustand.pos;
      if (b.tot) {
        b.figur.update(dt, { x: 0, z: 0 });
        if ((b.totUhr -= dt) <= 0) {                    // kehrt nach Hause zurück
          b.tot = false; if (entDa && b.id != null) ent.entferne?.(b.id);
          b.figur.teleport({ x: b.heim.x, y: welt.bodenHoehe(b.heim.x, b.heim.z), z: b.heim.z }); b.figur.aufstehen(0.6);
          b.id = neueEntitaet(b);
        }
        return;
      }
      // Spieler nah → hinschauen und grüßen
      const nah = d < 6;
      if (nah !== b.schaut) {
        b.schaut = nah;
        b.figur.blickZu(nah ? spieler() : null);
        if (nah && r() < 0.6) b.figur.sage(pick(r, GRUSS), { dauer: 2 });
      }
      kontext.nachbarn.length = 0;
      if (sp) kontext.nachbarn.push({ x: sp.x, z: sp.z, radius: 0.35 });
      for (const q of bewohner) {
        const w = q.figur.zustand.pos;
        if (q !== b && Math.abs(w.x - p.x) < 4 && Math.abs(w.z - p.z) < 4) kontext.nachbarn.push({ x: w.x, z: w.z, radius: 0.3 });
      }
      kontext.ziele.length = 0;
      if (entDa && typeof ent.imUmkreis === 'function') {
        for (const e of ent.imUmkreis(p.x, p.z, 14, { team: 'feind' })) if (e?.lebt !== false) kontext.ziele.push({ id: e.id, x: e.pos.x, z: e.pos.z, feind: true });
      }
      b.figur.update(dt, null, kontext);
      if (entDa && b.id != null) {
        ent.bewege?.(b.id, p.x, p.y, p.z);
        const e = ent.hole?.(b.id);
        if (e && e.lebenMax) b.figur.setLeben(e.leben < e.lebenMax ? e.leben / e.lebenMax : null);
      }
    }

    laufend = {
      update(dt) {
        bild++;
        const f = fokusPos(), sp = spieler()?.zustand?.pos;
        kontext.stunde = Number.isFinite(+himmel?.uhr?.stunde) ? +himmel.uhr.stunde : 12;
        kontext.npcs.length = 0;
        for (const b of bewohner) if (b.figur.brain) kontext.npcs.push(b.figur.brain);
        for (const b of bewohner) {
          const p = b.figur.zustand.pos, d = Math.hypot(p.x - f.x, p.z - f.z);
          b.figur.root.visible = d < o.fern;
          b.summe += dt;
          // LOD: nah jedes Bild, mittel jedes 4., fern jedes 8., ganz fern eingefroren
          const takt = d < o.nah ? 1 : d < o.mittel ? 4 : d < o.fern ? 8 : 0;
          if (!takt || (takt > 1 && (bild + b.phase) % takt)) { if (!takt) b.summe = 0; continue; }
          npcUpdate(b, Math.min(b.summe, 0.25), sp, sp ? Math.hypot(p.x - sp.x, p.z - sp.z) : 1e9);
          b.summe = 0;
        }
      },
      spaet(dt) { schilder.update(render.kamera, dt); },
      dispose() {
        for (const f of ab) f?.();
        for (const b of bewohner) { if (entDa && b.id != null) ent.entferne?.(b.id); b.figur.dispose(); }
        bewohner.length = 0;
        schilder.dispose();
      },
    };
    return {
      bewohner, mitte, schilder,
      get stunde() { return kontext.stunde; },
    };
  },
  update(dt) { laufend?.update(dt); },
  spaet(dt) { laufend?.spaet(dt); },
  dispose() { laufend?.dispose(); laufend = null; },
};
