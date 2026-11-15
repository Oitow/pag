/**
 * @modul    nahkampf
 * @zweck    Deterministischer Action-Nahkampf als reine Logik: Kombo-Kette, schwerer Schlag, Block/Parade, Ausweichen, Taumeln, Kegel-Treffer
 * @api      createNahkampf({ waffe='schwert', waffen=WAFFEN }) -> { angriff('leicht'|'schwer')->{ok,grund}, lasseLos(), block(an), ausweichen({x,z})->{ok}, taumle(dauer), update(dt,{x,y,z,yaw},ziele)->ereignisse[], phase, kombo, abwehr{block,parade,unverwundbar}, tempoFaktor, setWaffe(n), waffe, zustand(), laden(z), dispose() } ; WAFFEN ; WAFFEN_NAMEN
 * @beispiel
 *   import { createNahkampf } from '../../engine/gameplay/nahkampf.js';
 *   const nk = createNahkampf({ waffe: 'axt' });
 *   nk.angriff('leicht');
 *   for (const e of nk.update(dt, { x, y, z, yaw }, [{ id:'wolf', x:1, y:0, z:2, radius:0.5 }])) if (e.typ === 'treffer') kampf.schade(...);
 * @tags     kampf, nahkampf, kombo, waffe, parade, ausweichen, block, mmo, deterministisch
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { clamp } from '../core/math.js';
import { WAFFEN, WAFFEN_NAMEN } from './nahkampf-daten.js';
export { WAFFEN, WAFFEN_NAMEN };

const PUFFER = 0.3, KOMBO_PAUSE = 0.6, LADE_MAX = 1, KRAFT_MAX = 1.8;
const AUSWEICH_DAUER = 0.4, UNVERWUNDBAR = 0.25, PARADE = 0.2, HOEHE = 2.5;
const TEMPO = { laden: 0.4, vorlauf: 0.7, aktiv: 0.7, nachlauf: 0.7, block: 0.5 };

/** Yaw-Konvention: Blickrichtung = (sin yaw, cos yaw) in (x, z). */
export function createNahkampf(opts = {}) {
  const waffen = opts.waffen || WAFFEN;
  let waffe = opts.waffe && waffen[opts.waffe] ? opts.waffe : 'schwert';
  let ev = [];
  const s = { phase: 'bereit', t: 0, n: 0, schlag: null, schwer: false, kraft: 1, lade: 0, puffer: 0, pufferArt: null,
    pause: 0, dauer: 0, richtung: { x: 0, z: 0 }, treffer: [] };

  const W = () => waffen[waffe];
  const setPhase = (p, dauer = 0) => { s.phase = p; s.t = 0; s.dauer = dauer; };
  const ende = () => { if (s.n > 0) ev.push({ typ: 'komboEnde' }); s.n = 0; s.pause = 0; };
  const beginne = (schlag, schwer, kraft) => {
    s.schlag = schlag; s.schwer = schwer; s.kraft = kraft; s.treffer = []; s.pause = 0;
    const kombo = schwer ? 0 : s.n;
    if (!schwer) s.n++;
    setPhase('vorlauf', schlag.vorlauf);
    ev.push({ typ: 'schwung', schlag: schwer ? 'schwer' : 'leicht', clip: schlag.clip, kombo, kraft, schritt: schlag.schritt });
  };
  const naechsterLeicht = () => {
    const kette = W().leicht;
    if (s.n >= kette.length) ende();
    beginne(kette[s.n], false, 1);
  };
  const frei = () => s.phase === 'bereit';

  function trefferPruefen(pos, ziele) {
    const sc = s.schlag, fx = Math.sin(pos.yaw || 0), fz = Math.cos(pos.yaw || 0), liste = [];
    for (const z of ziele || []) {
      if (s.treffer.includes(z.id)) continue;
      const dx = z.x - pos.x, dz = z.z - pos.z, d = Math.hypot(dx, dz), r = z.radius || 0;
      if (d > sc.reichweite + r || Math.abs((z.y || 0) - (pos.y || 0)) > HOEHE) continue;
      if (d > r) { // Mittelpunkt außerhalb des Radius: Winkel zum Rand prüfen
        const winkel = Math.acos(clamp((dx * fx + dz * fz) / d, -1, 1)) - Math.asin(clamp(r / d, 0, 1));
        if (winkel > sc.winkel) continue;
      }
      liste.push({ z, d, dx, dz });
    }
    liste.sort((a, b) => a.d - b.d || String(a.z.id).localeCompare(String(b.z.id)));
    const out = liste.map(({ z, d, dx, dz }) => {
      s.treffer.push(z.id);
      const rx = d > 1e-6 ? dx / d : fx, rz = d > 1e-6 ? dz / d : fz, st = sc.stoss * s.kraft;
      return { ziel: z.id, menge: sc.schaden * s.kraft, wucht: sc.wucht * s.kraft,
        stoss: { x: rx * st, y: st * 0.15, z: rz * st }, art: sc.art || 'koerper', richtung: { x: rx, z: rz } };
    });
    if (out.length) ev.push({ typ: 'treffer', schlag: s.schwer ? 'schwer' : 'leicht', treffer: out });
  }

  /** Eine Phase ist zu Ende. */
  function weiter() {
    if (s.phase === 'vorlauf') setPhase('aktiv', s.schlag.aktiv);
    else if (s.phase === 'aktiv') setPhase('nachlauf', s.schlag.nachlauf);
    else if (s.phase === 'nachlauf') {
      const art = s.puffer > 0 ? s.pufferArt : null;
      setPhase('bereit'); s.pause = 0;
      if (s.schwer) { s.n = 0; if (art === 'leicht') naechsterLeicht(); }
      else if (art === 'leicht') naechsterLeicht();
      else if (art === 'schwer') { ende(); schwerStart(); }
      else if (s.n >= W().leicht.length) ende();
      s.puffer = 0;
    } else { setPhase('bereit'); s.pause = 0; } // ausweichen / taumeln vorbei
  }
  function schwerStart() { s.lade = 0; setPhase('laden'); }

  const api = {
    angriff(art = 'leicht') {
      if (art !== 'leicht' && art !== 'schwer') return { ok: false, grund: 'unbekannt' };
      if (['ausweichen', 'taumeln', 'block'].includes(s.phase)) return { ok: false, grund: s.phase };
      if (s.phase === 'laden') return { ok: false, grund: 'laden' };
      if (!frei()) { s.puffer = PUFFER; s.pufferArt = art; return { ok: true, grund: 'puffer' }; }
      if (art === 'leicht') naechsterLeicht(); else { ende(); schwerStart(); }
      return { ok: true, grund: '' };
    },
    lasseLos() {
      if (s.phase !== 'laden') return;
      const kraft = 1 + (KRAFT_MAX - 1) * clamp(s.lade / LADE_MAX, 0, 1);
      beginne(W().schwer, true, kraft);
    },
    block(an) {
      if (an && (frei() || s.phase === 'laden')) { setPhase('block'); s.puffer = 0; return { ok: true }; }
      if (!an && s.phase === 'block') { setPhase('bereit'); return { ok: true }; }
      return { ok: !an };
    },
    ausweichen(richtung) {
      if (['aktiv', 'ausweichen', 'taumeln'].includes(s.phase)) return { ok: false };
      const x = richtung?.x || 0, z = richtung?.z || 0, l = Math.hypot(x, z);
      s.richtung = l > 1e-6 ? { x: x / l, z: z / l } : { x: 0, z: 0 };
      ende(); s.puffer = 0; setPhase('ausweichen', AUSWEICH_DAUER);
      ev.push({ typ: 'ausweichen', richtung: { ...s.richtung } });
      return { ok: true };
    },
    taumle(dauer = 0.8) { ende(); s.puffer = 0; setPhase('taumeln', Math.max(0, dauer)); },
    update(dt, pos, ziele) {
      let rest = Math.max(0, dt) * (W().tempo || 1), guard = 16;
      if (s.puffer > 0) s.puffer = Math.max(0, s.puffer - dt);
      while (guard-- > 0) {
        const offen = s.dauer === 0 && !['vorlauf', 'aktiv', 'nachlauf', 'ausweichen', 'taumeln'].includes(s.phase);
        const step = offen ? rest : Math.min(rest, s.dauer - s.t);
        s.t += step; rest -= step;
        if (s.phase === 'laden') { s.lade = Math.min(LADE_MAX, s.lade + step); ev.push({ typ: 'laden', anteil: s.lade / LADE_MAX }); }
        if (s.phase === 'aktiv' && pos) trefferPruefen(pos, ziele);
        if (s.phase === 'bereit') { s.pause += step; if (s.n > 0 && s.pause > KOMBO_PAUSE) ende(); }
        if (offen || s.t < s.dauer) break;
        weiter();
        if (rest <= 0 && s.dauer > 0) break;
      }
      const out = ev; ev = []; return out;
    },
    get phase() { return s.phase; },
    get kombo() { return Math.max(0, s.n - 1); },
    get abwehr() {
      return { block: s.phase === 'block', parade: s.phase === 'block' && s.t < PARADE,
        unverwundbar: s.phase === 'ausweichen' && s.t < UNVERWUNDBAR };
    },
    get tempoFaktor() { return TEMPO[s.phase] || 1; },
    get waffe() { return waffe; },
    setWaffe(name) { if (!waffen[name]) return false; waffe = name; ende(); setPhase('bereit'); s.puffer = 0; return true; },
    zustand() { return JSON.parse(JSON.stringify({ waffe, ...s })); },
    laden(z) {
      if (!z || !waffen[z.waffe]) return;
      const { waffe: w, ...rest } = JSON.parse(JSON.stringify(z));
      waffe = w; Object.assign(s, rest);
    },
    dispose() { ev = []; s.schlag = null; s.treffer = []; setPhase('bereit'); },
  };
  return api;
}
