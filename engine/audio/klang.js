/**
 * @modul    klang
 * @zweck    Synthetische WebAudio-Geräusche (Zauber, Horden-Kampf) ohne Audiodateien; ohne AudioContext still
 * @api      createKlang({lautstaerke=0.6, seed=1, kontext=null, maxStimmen=4, abstand=0.035}) -> {spiele(name,{staerke,tonhoehe,verzug})->bool, dauerton('laden',{staerke,tonhoehe}|null), setLautstaerke(v), stumm, entsperren(), bereit, namen, dispose()} ; KLAENGE
 * @beispiel
 *   import { createKlang } from '../../engine/audio/klang.js';
 *   const klang = createKlang({ lautstaerke: 0.6 });
 *   klang.spiele('wumms', { staerke: 1.5, tonhoehe: 0.8 });
 *   klang.dauerton('laden', { staerke: 0.4, tonhoehe: 1.3 }); // jedes Bild; null = aus
 * @tags     audio, klang, sound, zauber, kampf, synth, webaudio
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { rng } from '../core/rng.js';

// Rezepte (Daten). osz: {w:Wellenform, von, bis (Hz), d:Dauer, p:Pegel, s:Start}
// rau: {f:Filtertyp, von, bis (Hz), q, d, p, s}. d = Dauer in s.
const O = (w, von, bis, d, p = 1, s = 0) => Object.freeze({ w, von, bis, d, p, s });
const R = (f, von, bis, d, p = 1, q = 1, s = 0) => Object.freeze({ f, von, bis, d, p, q, s });
const K = (osz, rau) => Object.freeze({ osz: Object.freeze(osz), rau: Object.freeze(rau) });

export const KLAENGE = Object.freeze({
  wumms: K([O('sine', 130, 38, 0.35, 1.2)], [R('lowpass', 900, 150, 0.12, 0.6)]),
  explosion: K([O('sine', 90, 30, 0.9, 1)], [R('lowpass', 2500, 180, 0.9, 1.1)]),
  zisch: K([], [R('bandpass', 400, 2200, 0.35, 0.8, 3)]),
  blitz: K([O('square', 900, 200, 0.12, 0.35)],
    [R('highpass', 3000, 3000, 0.03, 0.7, 0.7, 0), R('highpass', 3000, 3000, 0.025, 0.6, 0.7, 0.05),
      R('highpass', 3000, 3000, 0.03, 0.7, 0.7, 0.09), R('highpass', 3000, 3000, 0.02, 0.5, 0.7, 0.14)]),
  eis: K([O('sine', 1800, 1800, 0.35, 0.3), O('sine', 2700, 2700, 0.25, 0.25), O('sine', 3900, 3900, 0.18, 0.2)],
    [R('highpass', 5000, 5000, 0.08, 0.25, 0.7)]),
  entladen: K([O('sine', 180, 60, 0.18, 0.9)], [R('bandpass', 800, 1800, 0.14, 0.4, 2)]),
  quiek: K([O('triangle', 2600, 1500, 0.09, 0.25)], []),
  biss: K([O('triangle', 300, 120, 0.08, 0.4)], [R('bandpass', 1800, 1800, 0.02, 0.6, 2)]),
  tod: K([O('sine', 220, 70, 0.18, 0.7)], [R('lowpass', 900, 200, 0.18, 0.7)]),
  heilen: K([O('sine', 660, 660, 0.3, 0.3, 0), O('sine', 880, 880, 0.3, 0.3, 0.09), O('sine', 1320, 1320, 0.4, 0.3, 0.18)], []),
  fehl: K([O('square', 140, 140, 0.09, 0.2)], []),
  schritt: K([], [R('lowpass', 500, 300, 0.03, 0.15)]),
});

const HOERER = ['pointerdown', 'keydown', 'touchend'];

/** Fabrik: Klang-Spieler. Ohne AudioContext sind alle Methoden stille No-ops. */
export function createKlang(opts = {}) {
  const { seed = 1, kontext = null, maxStimmen = 4, abstand = 0.035 } = opts;
  let lautst = opts.lautstaerke ?? 0.6;
  let stumm = false;
  const eigen = !kontext;
  let ctx = kontext;
  if (!ctx) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (AC) { try { ctx = new AC(); } catch { ctx = null; } }
  }
  let master = null, rauschen = null;
  const stimmen = new Map(); // name -> { enden:[], zuletzt }
  let dauer = null;
  const klaenge = Object.keys(KLAENGE);

  if (ctx) {
    master = ctx.createGain();
    master.gain.value = lautst;
    const komp = ctx.createDynamicsCompressor();
    master.connect(komp);
    komp.connect(ctx.destination);
  }

  // Rausch-Puffer einmalig, deterministisch
  function puffer() {
    if (rauschen) return rauschen;
    const n = Math.floor(ctx.sampleRate * 1.2);
    rauschen = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = rauschen.getChannelData(0), r = rng(seed);
    for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    return rauschen;
  }

  const rampe = (param, von, bis, t0, d, expo = true) => {
    param.setValueAtTime(von, t0);
    if (von !== bis) param[expo ? 'exponentialRampToValueAtTime' : 'linearRampToValueAtTime'](Math.max(bis, 0.0001), t0 + d);
  };

  // Hüllkurve: schneller Anschlag, exponentielles Ausklingen
  function huelle(t0, d, pegel) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(pegel, t0 + Math.min(0.004, d / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    g.connect(master);
    return g;
  }

  function schicht(rz, t0, st, th) {
    for (const o of rz.osz) {
      const s = t0 + o.s, node = ctx.createOscillator();
      node.type = o.w;
      rampe(node.frequency, o.von * th, o.bis * th, s, o.d);
      node.connect(huelle(s, o.d, o.p * st));
      node.start(s); node.stop(s + o.d + 0.02);
    }
    for (const r of rz.rau) {
      const s = t0 + r.s, quelle = ctx.createBufferSource(), f = ctx.createBiquadFilter();
      quelle.buffer = puffer();
      f.type = r.f; f.Q.value = r.q;
      rampe(f.frequency, r.von * th, r.bis * th, s, r.d);
      quelle.connect(f);
      f.connect(huelle(s, r.d, r.p * st));
      quelle.start(s, 0); quelle.stop(s + r.d + 0.02);
    }
  }

  function spiele(name, o = {}) {
    const rz = KLAENGE[name];
    if (!ctx || !rz || stumm || ctx.state === 'closed') return false;
    const { staerke = 1, tonhoehe = 1, verzug = 0 } = o;
    const jetzt = ctx.currentTime;
    let v = stimmen.get(name);
    if (!v) stimmen.set(name, v = { enden: [], zuletzt: -Infinity });
    v.enden = v.enden.filter((e) => e > jetzt);
    if (v.enden.length >= maxStimmen || jetzt - v.zuletzt < abstand) return false;
    const t0 = jetzt + Math.max(0, verzug);
    let ende = 0;
    for (const x of rz.osz) ende = Math.max(ende, x.s + x.d);
    for (const x of rz.rau) ende = Math.max(ende, x.s + x.d);
    try { schicht(rz, t0, Math.min(2, Math.max(0, staerke)), tonhoehe); } catch { return false; }
    v.zuletzt = jetzt;
    v.enden.push(t0 + ende);
    return true;
  }

  function dauerStop() {
    if (!dauer) return;
    const d = dauer, t = ctx.currentTime;
    dauer = null;
    try {
      d.aus.gain.cancelScheduledValues(t);
      d.aus.gain.setValueAtTime(d.aus.gain.value, t);
      d.aus.gain.linearRampToValueAtTime(0, t + 0.08);
      for (const n of d.oszs) n.stop(t + 0.1);
    } catch { /* schon gestoppt */ }
  }

  function dauerton(name, o) {
    if (!ctx || name !== 'laden' || ctx.state === 'closed') return;
    if (!o || stumm) { dauerStop(); return; }
    const { staerke = 1, tonhoehe = 1 } = o, t = ctx.currentTime;
    if (!dauer) {
      const saege = ctx.createOscillator(), sinus = ctx.createOscillator(), lfo = ctx.createOscillator();
      const tief = ctx.createBiquadFilter(), trem = ctx.createGain(), lfoG = ctx.createGain(), aus = ctx.createGain();
      saege.type = 'sawtooth'; sinus.type = 'sine'; lfo.type = 'sine';
      lfo.frequency.value = 9; lfoG.gain.value = 0.25; trem.gain.value = 0.75;
      tief.type = 'lowpass'; tief.frequency.value = 500;
      aus.gain.setValueAtTime(0, t);
      saege.connect(tief); sinus.connect(tief); tief.connect(trem); trem.connect(aus); aus.connect(master);
      lfo.connect(lfoG); lfoG.connect(trem.gain);
      for (const n of [saege, sinus, lfo]) n.start(t);
      dauer = { saege, sinus, tief, aus, oszs: [saege, sinus, lfo] };
    }
    const T = 0.05;
    dauer.saege.frequency.setTargetAtTime(70 * tonhoehe, t, T);
    dauer.sinus.frequency.setTargetAtTime(140 * tonhoehe, t, T);
    dauer.tief.frequency.setTargetAtTime(500 * tonhoehe, t, T);
    dauer.aus.gain.setTargetAtTime(0.5 * Math.min(2, Math.max(0, staerke)), t, T);
  }

  function entsperren() {
    if (ctx && ctx.state === 'suspended' && ctx.resume) { try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch { /* egal */ } }
  }

  const win = typeof window !== 'undefined' ? window : null;
  function hoererWeg() { if (win) for (const e of HOERER) win.removeEventListener(e, beiGeste, true); }
  function beiGeste() { entsperren(); hoererWeg(); }
  if (win && ctx && win.addEventListener) for (const e of HOERER) win.addEventListener(e, beiGeste, true);

  return {
    spiele, dauerton, entsperren,
    setLautstaerke(v) { lautst = Math.min(1, Math.max(0, v)); if (master) master.gain.setTargetAtTime(lautst, ctx.currentTime, 0.02); },
    get stumm() { return stumm; },
    set stumm(v) { stumm = !!v; if (stumm) dauerStop(); },
    get bereit() { return !!ctx && ctx.state === 'running'; },
    get namen() { return klaenge.slice(); },
    dispose() {
      hoererWeg();
      if (ctx) {
        dauerStop();
        if (eigen && ctx.state !== 'closed' && ctx.close) { try { const p = ctx.close(); if (p && p.catch) p.catch(() => {}); } catch { /* egal */ } }
      }
      stimmen.clear();
    },
  };
}
