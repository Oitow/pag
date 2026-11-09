/**
 * @modul    character-brain
 * @zweck    NPC-Verhaltensplaner (Zustandsautomat) über Steering + Sinne: idle, wandern, patrouille, arbeiten, folgen, fliehen, angreifen, suchen, plaudern; Tagesablauf nach Stunde; liefert Absicht + Aktions-Clip
 * @api      createBrain({seed,welt,heimat,steering,sinne,grund,plan,reaktion,verhalten,feinde}) -> {zustand,aktion,aktionNeu,pos,absicht,steering,sinne,setze(name,daten),zurueck(),plaudereMit(anderes,dauer?),update(dt,motorZustand,{ziele,nachbarn,stunde,npcs})->{absicht,aktion,aktionNeu,zustand},dispose()} ; BRAIN_VERHALTEN ; planEintrag(plan,stunde)
 * @beispiel
 *   import { createBrain } from '../../engine/gameplay/character-brain.js';
 *   const hirn = createBrain({ seed: 3, welt, heimat: { x: 0, z: 0 },
 *     plan: [{ von: 8, bis: 17, zustand: 'arbeiten', ort: { x: 4, z: 2 }, clip: 'hacken' }, { von: 17, bis: 8, zustand: 'wandern', radius: 5 }],
 *     reaktion: { feind: 'fliehen' } });
 *   const r = hirn.update(dt, motor.zustand, { ziele: [{ id: 'wolf', x, z, feind: true }], stunde: 9.5 });
 *   motor.update(dt, r.absicht); if (r.aktionNeu && r.aktion) animator.spiele(r.aktion);
 * @tags     npc, ki, verhalten, zustandsautomat, tagesablauf, gameplay
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Zustände + Daten für setze()/plan/grund: idle {} · wandern {radius, heimat} · patrouille {punkte, art, warten} ·
 * arbeiten {ort:{x,z}, clip, blickYaw} · folgen {ziel: id | ()=>{x,z}, abstand} · fliehen {ziel} · angreifen {ziel} ·
 * suchen {x, z} · plaudern {partner: ()=>{x,z}, dauer}.
 * reaktion: { feind: 'fliehen'|'angreifen'|'ignorieren', geraeusch: 'suchen'|'ignorieren' }. Feind = Ziel mit feind:true oder id in feinde.
 */
import { clamp, numOr } from '../core/math.js';
import { rng, range, pick, chance } from '../core/rng.js';
import { createSteering } from './character-steering.js';
import { createSinne } from './character-sinne.js';
import { yawZu } from './character-steering-extra.js';

export const BRAIN_VERHALTEN = {
  idleZeit: [2, 5], idleClips: [], wanderRadius: 6,
  angriffsReichweite: 1.4, angriffsClip: 'schlagen', angriffsPause: 1.2, umkreisen: true, umkreisRadius: 2.6,
  fluchtAbstand: 12, suchZeit: 4, plauderZeit: [4, 8], plauderClip: 'winken', plauderAbstand: 1.4,
  plauderChance: 0, plauderRadius: 6, // Chance je Sekunde, spontan mit einem NPC aus ctx.npcs zu plaudern
};
const REAKTIONEN = new Set(['fliehen', 'angreifen', 'suchen', 'plaudern']);

/** Plan-Eintrag für die Stunde (von ≤ h < bis; über Mitternacht, wenn von > bis). */
export function planEintrag(plan, stunde) {
  if (!plan || !Number.isFinite(+stunde)) return null;
  const h = ((+stunde % 24) + 24) % 24;
  for (const e of plan) {
    const von = numOr(e?.von, 0), bis = numOr(e?.bis, 24);
    if (von <= bis ? h >= von && h < bis : h >= von || h < bis) return e;
  }
  return null;
}

export function createBrain(opts = {}) {
  const zufall = rng((numOr(opts.seed, 1) >>> 0) ^ 0x9e3779b9);
  const V = Object.assign({}, BRAIN_VERHALTEN, opts.verhalten);
  const heimat = { x: numOr(opts.heimat?.x, NaN), z: numOr(opts.heimat?.z, NaN) };
  const eigeneSteering = !opts.steering, eigeneSinne = !opts.sinne;
  const steering = opts.steering || createSteering({ seed: numOr(opts.seed, 1), heimat: opts.heimat, wanderRadius: V.wanderRadius });
  const sinne = opts.sinne || createSinne({ welt: opts.welt, ...(opts.sinneOpts || {}) });
  const reaktion = Object.assign({ feind: 'ignorieren', geraeusch: 'ignorieren' }, opts.reaktion);
  const feinde = new Set(opts.feinde || []);
  const grund = typeof opts.grund === 'string' ? { zustand: opts.grund } : (opts.grund || { zustand: 'idle' });
  const plan = Array.isArray(opts.plan) ? opts.plan : null;
  const pos = { x: 0, y: 0, z: 0, yaw: 0 };
  const st = { name: '', daten: {}, timer: 0, aktion: null, aktionNeu: false, basisKey: null, manuell: null, phase: 0, pause: 0, blick: undefined, ziel: null };
  const ergebnis = { absicht: null, aktion: null, aktionNeu: false, zustand: '' };

  const setAktion = (a, neu = true) => { if (a !== st.aktion || (neu && a)) st.aktionNeu = !!a; st.aktion = a || null; };
  const zielGetter = (z) => typeof z === 'function' ? z : () => { const e = sinne.erinnerung(z); return e ? e : null; };

  /** Zustand betreten (ohne Manuell-Logik). */
  function betrete(name, d = {}) {
    st.name = name; st.daten = d; st.timer = 0; st.phase = 0; st.pause = 0; st.blick = undefined; st.ziel = d.ziel ?? null;
    setAktion(null, false);
    switch (name) {
      case 'wandern': steering.wandere(d.heimat || (Number.isFinite(heimat.x) ? heimat : null), numOr(d.radius, V.wanderRadius)); break;
      case 'patrouille': steering.patrouille(d.punkte, d); break;
      case 'arbeiten': if (d.ort) steering.gehZu(d.ort.x, d.ort.z); else steering.stehe(); break;
      case 'folgen': steering.folge(zielGetter(d.ziel), numOr(d.abstand, 2)); break;
      case 'fliehen': steering.fliehe(zielGetter(d.ziel), numOr(d.abstand, V.fluchtAbstand)); break;
      case 'angreifen': steering.folge(zielGetter(d.ziel), V.angriffsReichweite * 0.7); break;
      case 'suchen': steering.gehZu(d.x, d.z); st.timer = V.suchZeit; break;
      case 'plaudern': steering.folge(d.partner, V.plauderAbstand); st.timer = numOr(d.dauer, range(zufall, V.plauderZeit[0], V.plauderZeit[1])); break;
      default: st.name = 'idle'; steering.stehe(); st.timer = range(zufall, V.idleZeit[0], V.idleZeit[1]);
    }
  }

  function basis(stunde) {
    const e = planEintrag(plan, stunde);
    return e ? { key: plan.indexOf(e), z: e } : { key: 'grund', z: grund };
  }
  function zurBasis(stunde) {
    if (st.manuell) { betrete(st.manuell.name, st.manuell.daten); return; }
    const b = basis(stunde); st.basisKey = b.key; betrete(b.z.zustand || 'idle', b.z);
  }

  const istFeind = (e) => !!(e.ziel?.feind || feinde.has(e.id));

  function reagieren(stunde) {
    if (reaktion.feind !== 'ignorieren') {
      const f = sinne.naechste((e) => e.entdeckt && istFeind(e) && e.alter === 0); // nur aktuell wahrgenommen
      if (f) {
        const soll = reaktion.feind === 'fliehen' ? 'fliehen' : 'angreifen';
        if (st.name !== soll || st.ziel !== f.id) betrete(soll, { ziel: f.id });
        return;
      }
    }
    if (reaktion.geraeusch === 'suchen' && !REAKTIONEN.has(st.name)) {
      const g = sinne.naechste((e) => e.art === 'gehoert' && e.alter === 0);
      if (g) { betrete('suchen', { x: g.x, z: g.z }); return; }
    }
    if (!REAKTIONEN.has(st.name) && !st.manuell) {
      const b = basis(stunde);
      if (b.key !== st.basisKey) { st.basisKey = b.key; betrete(b.z.zustand || 'idle', b.z); }
    }
  }

  function ticken(dt, stunde, ctx) {
    switch (st.name) {
      case 'idle':
        st.timer -= dt;
        if (st.timer <= 0) {
          st.timer = range(zufall, V.idleZeit[0], V.idleZeit[1]);
          setAktion(V.idleClips.length && chance(zufall, 0.5) ? pick(zufall, V.idleClips) : null);
        }
        break;
      case 'arbeiten':
        if (steering.angekommen && st.phase === 0) { st.phase = 1; steering.stehe(); setAktion(st.daten.clip || null); }
        if (st.phase === 1 && st.daten.blickYaw !== undefined) st.blick = +st.daten.blickYaw;
        break;
      case 'fliehen': {
        const e = sinne.erinnerung(st.ziel);
        if (!e || (steering.angekommen && !e.sichtbar)) zurBasis(stunde);
        break;
      }
      case 'angreifen': {
        const e = sinne.erinnerung(st.ziel);
        if (!e) { zurBasis(stunde); break; }
        if (!e.sichtbar) { betrete('suchen', { x: e.x, z: e.z }); break; }
        st.pause -= dt;
        const d = Math.hypot(e.x - pos.x, e.z - pos.z);
        st.blick = yawZu(pos, e);
        if (d <= V.angriffsReichweite + 0.2 && st.pause <= 0) {
          setAktion(V.angriffsClip); st.pause = V.angriffsPause;
          if (V.umkreisen) steering.umkreise(zielGetter(st.ziel), V.umkreisRadius, { drehsinn: chance(zufall, 0.5) ? 1 : -1 });
        } else if (st.pause <= 0 && steering.modus !== 'folgen') steering.folge(zielGetter(st.ziel), V.angriffsReichweite * 0.7);
        else if (st.aktion && st.pause < V.angriffsPause - 0.4) setAktion(null, false);
        break;
      }
      case 'suchen':
        if (steering.angekommen) {
          steering.stehe(); st.timer -= dt;
          st.blick = numOr(st.blick, pos.yaw) + dt * 1.5 * (st.phase ? -1 : 1); // umschauen
          if (st.timer <= 0) zurBasis(stunde);
        }
        break;
      case 'plaudern': {
        const p = st.daten.partner?.();
        if (!p) { zurBasis(stunde); break; }
        if (steering.angekommen || Math.hypot(p.x - pos.x, p.z - pos.z) <= V.plauderAbstand + 0.3) {
          if (st.phase === 0) { st.phase = 1; setAktion(V.plauderClip); }
          st.blick = yawZu(pos, p); st.timer -= dt;
          if (st.timer <= 0) { setAktion(null, false); zurBasis(stunde); }
        }
        break;
      }
      default: break;
    }
    // spontan plaudern
    if (V.plauderChance > 0 && ctx.npcs && (st.name === 'idle' || st.name === 'wandern') && chance(zufall, V.plauderChance * dt)) {
      const andere = ctx.npcs.filter((n) => n !== api && (n.zustand === 'idle' || n.zustand === 'wandern') && Math.hypot(n.pos.x - pos.x, n.pos.z - pos.z) <= V.plauderRadius);
      if (andere.length) plaudereMit(pick(zufall, andere));
    }
  }

  function update(dt, mz, ctx = {}) {
    dt = clamp(numOr(dt, 0), 0, 0.25);
    const p = mz?.pos || {};
    pos.x = numOr(p.x, 0); pos.y = numOr(p.y, 0); pos.z = numOr(p.z, 0); pos.yaw = numOr(mz?.yaw, 0);
    if (!Number.isFinite(heimat.x)) { heimat.x = pos.x; heimat.z = pos.z; }
    st.aktionNeu = false;
    sinne.update(dt, mz, ctx.ziele || []);
    if (!st.name) zurBasis(ctx.stunde);
    reagieren(ctx.stunde);
    ticken(dt, ctx.stunde, ctx);
    const ab = steering.update(dt, mz, ctx.nachbarn);
    if (st.blick !== undefined && Math.hypot(ab.x, ab.z) < 0.3) ab.blickYaw = st.blick;
    ergebnis.absicht = ab; ergebnis.aktion = st.aktion; ergebnis.aktionNeu = st.aktionNeu; ergebnis.zustand = st.name;
    return ergebnis;
  }

  /** Beide NPCs gehen aufeinander zu, schauen sich an und spielen den Plauder-Clip. */
  function plaudereMit(anderes, dauer) {
    if (!anderes || anderes === api) return;
    const t = numOr(dauer, range(zufall, V.plauderZeit[0], V.plauderZeit[1]));
    betrete('plaudern', { partner: () => anderes.pos, dauer: t });
    anderes._plaudern?.(() => pos, t);
  }

  const api = {
    get zustand() { return st.name; },
    get aktion() { return st.aktion; },
    get aktionNeu() { return st.aktionNeu; },
    get pos() { return pos; },
    get absicht() { return ergebnis.absicht; },
    steering, sinne, update, plaudereMit, planEintrag: (h) => planEintrag(plan, h),
    /** Zustand erzwingen (überschreibt den Tagesablauf bis zurueck()). Reaktionen auf Feinde gehen weiter vor. */
    setze(name, daten = {}) { st.manuell = { name, daten }; betrete(name, daten); },
    zurueck() { st.manuell = null; st.basisKey = null; st.name = ''; },
    _plaudern(partner, dauer) { betrete('plaudern', { partner, dauer }); },
    dispose() { if (eigeneSteering) steering.dispose(); if (eigeneSinne) sinne.dispose(); st.daten = {}; st.manuell = null; },
  };
  return api;
}
