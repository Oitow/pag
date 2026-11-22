// Viniland – prozedurale Musik + Soundeffekte (reines WebAudio, keine Dateien, keine Libs).
//
// API (siehe CONTRACT.md):
//   Audio.init()                                   nach User-Geste aufrufen; mehrfach aufrufbar (resumed nur)
//   Audio.setMusic({ biome, combat:null|'boss'|'key', intensity:0..1 })   weiche Übergänge (2–4 s, auf Takt/Schlag)
//   Audio.sting('victory'|'death'|'discovery'|'levelup')
//   Audio.sfx(name, { vol=1, pan=0, pitch=1 })
//   Audio.setVolume({ music, sfx })                0..1
// Vor init() ist alles ein No-Op (gewünschter Musik-/Lautstärke-Zustand wird nur gemerkt und bei init übernommen).
// Extra: Audio.ready, Audio.ctx, Audio.stopMusic(), Audio.SFX_NAMES, Audio.BIOME_IDS,
//        renderOffline({ biome, combat, intensity, seconds, sfx:[...] }) -> Promise<{ rms, peak, buffer }> (Selbsttest).

const MODES = {
  aeolian: [0, 2, 3, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11], lydian: [0, 2, 4, 6, 7, 9, 11],
};
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const mod = (a, n) => ((a % n) + n) % n;

// ---------------------------------------------------------------------------------------------
// Stücke als Daten. pc = Grundton (Tonklasse 0..11), mode, tempo, prog = Stufen (0 = Tonika).
// parts: role + inst + Parameter. min/max = Intensitäts-Fenster (weich eingeblendet).
// ---------------------------------------------------------------------------------------------
const EXPLORE = {
  kueste: { // melancholisch, Wind, entfernte Glocke
    pc: 2, mode: 'aeolian', tempo: 58, prog: [0, 5, 2, 6, 0, 5, 3, 4],
    wind: { lo: 250, hi: 900, q: 0.7, lvl: 0.22 },
    parts: [
      { role: 'drone', inst: 'drone', oct: 2, every: 4, vel: 0.30, fifth: true },
      { role: 'pad', inst: 'strings', oct: 3, every: 1, vel: 0.22, att: 1.2, pan: -0.2 },
      { role: 'pad', inst: 'choir', oct: 4, every: 2, vel: 0.20, vowel: 'o', pan: 0.25, min: 0.0 },
      { role: 'melody', inst: 'harp', oct: 5, style: 'slow', rest: 2, vel: 0.30, pan: 0.15 },
      { role: 'bell', inst: 'bell', oct: 5, prob: 0.35, vel: 0.12, far: true, pan: 0.5 },
    ],
  },
  duesterwald: { // Orgel-/Chor-Drone, Totenglocke, gothic
    pc: 0, mode: 'phrygian', tempo: 52, prog: [0, 1, 0, 6, 0, 5, 1, 0],
    wind: { lo: 1800, hi: 3200, q: 0.4, lvl: 0.06 }, // Nieselregen-Rauschen
    parts: [
      { role: 'drone', inst: 'organ', oct: 2, every: 4, vel: 0.30, fifth: true },
      { role: 'pad', inst: 'choir', oct: 4, every: 1, vel: 0.26, vowel: 'a', pan: -0.15 },
      { role: 'bass', inst: 'strings', oct: 2, beats: [0], len: 4, vel: 0.25 },
      { role: 'bell', inst: 'bell', oct: 3, toll: true, every: 2, vel: 0.30, pan: 0.2 },
      { role: 'melody', inst: 'choir', oct: 5, style: 'slow', rest: 3, vel: 0.20, vowel: 'o', pan: 0.2 },
    ],
  },
  pilzhain: { // schimmernde Arpeggios, mystisch, bunt
    pc: 4, mode: 'dorian', tempo: 84, prog: [0, 3, 5, 4, 0, 3, 6, 4], seventh: true,
    parts: [
      { role: 'drone', inst: 'drone', oct: 2, every: 4, vel: 0.22 },
      { role: 'pad', inst: 'coldpad', oct: 4, every: 1, vel: 0.20, pan: -0.25 },
      { role: 'arp', inst: 'glass', oct: 5, sub: 4, mode: 'updown', density: 0.75, vel: 0.16, pan: 0.35 },
      { role: 'arp', inst: 'harp', oct: 4, sub: 2, mode: 'random', density: 0.35, vel: 0.18, pan: -0.4 },
      { role: 'melody', inst: 'glass', oct: 6, style: 'fast', rest: 2, vel: 0.12, pan: 0.1 },
      { role: 'bell', inst: 'glass', oct: 6, prob: 0.5, vel: 0.10, pan: -0.5 },
    ],
  },
  aschenoede: { // dumpfe Trommeln, Drone, Hörner-Schwellungen
    pc: 9, mode: 'phrygian', tempo: 64, prog: [0, 1, 0, 1, 0, 6, 5, 1],
    wind: { lo: 120, hi: 400, q: 0.9, lvl: 0.2 },
    parts: [
      { role: 'drone', inst: 'drone', oct: 1, every: 2, vel: 0.36, fifth: true },
      { role: 'drums', voice: 'low', pat: 'X.......x.......', vel: 0.55, muff: true },
      { role: 'drums', voice: 'mid', pat: '........X.....x.', vel: 0.32, muff: true },
      { role: 'pad', inst: 'brass', oct: 3, every: 2, vel: 0.18, att: 1.6, pan: 0.2 },
      { role: 'pad', inst: 'choir', oct: 3, every: 2, vel: 0.18, vowel: 'u', pan: -0.2 },
      { role: 'melody', inst: 'strings', oct: 4, style: 'slow', rest: 3, vel: 0.18 },
    ],
  },
  frostgipfel: { // kalte Pads, Eisglocken, Sturm
    pc: 6, mode: 'aeolian', tempo: 46, prog: [0, 3, 5, 4, 0, 6, 5, 4],
    wind: { lo: 700, hi: 2200, q: 1.1, lvl: 0.26 },
    parts: [
      { role: 'drone', inst: 'drone', oct: 2, every: 4, vel: 0.2 },
      { role: 'pad', inst: 'coldpad', oct: 4, every: 2, vel: 0.26, pan: 0.2 },
      { role: 'pad', inst: 'choir', oct: 5, every: 2, vel: 0.12, vowel: 'u', pan: -0.3 },
      { role: 'bell', inst: 'glass', oct: 6, prob: 0.55, vel: 0.13, pan: 0.45 },
      { role: 'melody', inst: 'harp', oct: 5, style: 'slow', rest: 2, vel: 0.24, pan: -0.1 },
    ],
  },
};
const BOSS_TEMPO = { kueste: 128, duesterwald: 120, pilzhain: 132, aschenoede: 116, frostgipfel: 124 };

function bossDef(biome, key) {
  const base = EXPLORE[biome] || EXPLORE.kueste;
  const P = [
    { role: 'ostinato', inst: 'strings', oct: 3, sub: 2, pat: [0, 0, 2, 0, 1, 0, 2, 3], vel: 0.32, pan: -0.25 },
    { role: 'bass', inst: 'strings', oct: 2, beats: [0, 2], len: 2, vel: 0.36 },
    { role: 'drums', voice: 'low', pat: 'X.....x.X.......', vel: 0.85 },
    { role: 'drums', voice: 'mid', pat: '....X.......X..x', vel: 0.55, min: 0.2 },
    { role: 'drums', voice: 'high', pat: 'x.x.x.x.x.x.x.x.', vel: 0.22, min: 0.5 },
    { role: 'drums', voice: 'low', pat: '..........X..X..', vel: 0.6, min: 0.72 },
    { role: 'fill', min: 0.45, vel: 0.35 },
    { role: 'pad', inst: 'choir', oct: 4, every: 1, vel: 0.30, vowel: 'a', min: 0.28, pan: 0.2 },
    { role: 'melody', inst: 'brass', oct: 4, style: 'martial', rest: 1, vel: 0.34, min: 0.5, pan: 0.1 },
    { role: 'pad', inst: 'brass', oct: 3, every: 1, vel: 0.20, att: 0.08, min: 0.75, short: true, pan: -0.1 },
    { role: 'ostinato', inst: 'strings', oct: 5, sub: 4, pat: [2, 1, 0, 1, 2, 3, 2, 1], vel: 0.12, min: 0.85, pan: 0.4 },
  ];
  if (key) {
    P.push(
      { role: 'pad', inst: 'choir', oct: 5, every: 1, vel: 0.30, vowel: 'a', pan: -0.25 },
      { role: 'bell', inst: 'bell', oct: 4, toll: true, every: 1, vel: 0.24, pan: 0.3 },
      { role: 'bell', inst: 'bell', oct: 5, prob: 0.5, vel: 0.12, pan: -0.4, min: 0.4 },
      { role: 'boom', every: 4, vel: 0.8 },
    );
    P[7].min = 0; P[7].vel = 0.36; P[8].min = 0.2; P[9].min = 0.55;
  }
  return {
    pc: base.pc, mode: key ? 'harmonic' : (base.mode === 'phrygian' ? 'phrygian' : 'harmonic'),
    tempo: (BOSS_TEMPO[biome] || 126) + (key ? 8 : 0),
    prog: key ? [0, 5, 1, 4, 0, 5, 3, 4] : [0, 5, 3, 4, 0, 0, 5, 4],
    dyn: true, parts: P,
  };
}

// ---------------------------------------------------------------------------------------------
// Engine (an einen beliebigen BaseAudioContext gebunden – auch OfflineAudioContext)
// ---------------------------------------------------------------------------------------------
function createEngine(ctx, offline = false) {
  const E = { ctx, offline, pieces: [], garbage: [], sfxActive: new Map(), lastSfx: new Map(), vol: { music: 0.6, sfx: 0.8 } };
  const now = () => ctx.currentTime;

  // --- Graph ---
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -4; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.12;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = 0.015; comp.release.value = 0.3;
  const master = ctx.createGain(); master.gain.value = 0.8;
  comp.connect(limiter); limiter.connect(master); master.connect(ctx.destination);
  const reverb = ctx.createConvolver(); reverb.buffer = makeIR(ctx, 3.4); reverb.connect(comp);
  const musicGain = ctx.createGain(); musicGain.connect(comp);
  const musicRev = ctx.createGain(); musicRev.gain.value = 0.55; musicGain.connect(musicRev); musicRev.connect(reverb);
  const duck = ctx.createGain(); duck.connect(musicGain);
  const sfxGain = ctx.createGain(); sfxGain.connect(comp);
  const sfxRev = ctx.createGain(); sfxRev.gain.value = 0.16; sfxGain.connect(sfxRev); sfxRev.connect(reverb);
  E.musicIn = duck; E.stingIn = musicGain; E.sfxIn = sfxGain;
  // geteilte Puffer
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  { const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  E.noiseBuf = nb;
  const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 3) / Math.tanh(3); }
  E.distCurve = curve;

  E.setVolume = (v) => {
    if (v.music != null) E.vol.music = clamp(+v.music, 0, 1);
    if (v.sfx != null) E.vol.sfx = clamp(+v.sfx, 0, 1);
    const t = now();
    musicGain.gain.setTargetAtTime(E.vol.music * 0.9, t, 0.05);
    sfxGain.gain.setTargetAtTime(E.vol.sfx, t, 0.05);
  };
  musicGain.gain.value = E.vol.music * 0.9; sfxGain.gain.value = E.vol.sfx;

  // --- Knoten-Helfer: jeder Knoten landet in einer Stimme v, die nach Ende getrennt wird ---
  E.voice = () => ({ n: [], end: 0 });
  E.osc = (v, type, f, t, end) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(end); v.n.push(o); v.end = Math.max(v.end, end); return o; };
  E.noise = (v, t, end) => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.start(t, Math.random() * 1.9); s.stop(end); v.n.push(s); v.end = Math.max(v.end, end); return s; };
  E.gain = (v, g = 0) => { const n = ctx.createGain(); n.gain.value = g; v.n.push(n); return n; };
  E.filt = (v, type, f, q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; v.n.push(n); return n; };
  E.pan = (v, p) => { if (!ctx.createStereoPanner) return E.gain(v, 1); const n = ctx.createStereoPanner(); n.pan.value = clamp(p, -1, 1); v.n.push(n); return n; };
  E.shaper = (v) => { const n = ctx.createWaveShaper(); n.curve = curve; v.n.push(n); return n; };
  E.done = (v, tag) => { if (tag) E.sfxActive.set(tag, (E.sfxActive.get(tag) || 0) + 1); E.garbage.push({ v, tag }); };
  E.cleanup = () => {
    const t = now();
    for (let i = E.garbage.length - 1; i >= 0; i--) {
      const g = E.garbage[i];
      if (g.v.end + 0.15 < t) {
        for (const n of g.v.n) { try { n.disconnect(); } catch (e) { /* schon getrennt */ } }
        if (g.tag) E.sfxActive.set(g.tag, E.sfxActive.get(g.tag) - 1);
        E.garbage[i] = E.garbage[E.garbage.length - 1]; E.garbage.pop();
      }
    }
  };
  E.envelope = (param, t, a, peak, dec, sus, relT, rel) => {
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t + a);
    if (sus !== 1) param.setTargetAtTime(peak * sus, t + a, dec / 3);
    param.setTargetAtTime(0, Math.max(relT, t + a + 0.001), rel / 4);
    return Math.max(relT, t + a) + rel;
  };

  // --- Musik ---
  E.duck = (amt, dur) => {
    const t = now(); duck.gain.cancelScheduledValues(t); duck.gain.setValueAtTime(duck.gain.value, t);
    duck.gain.linearRampToValueAtTime(amt, t + 0.25); duck.gain.setValueAtTime(amt, t + dur); duck.gain.linearRampToValueAtTime(1, t + dur + 2.5);
  };
  E.setMusic = (req) => {
    const biome = EXPLORE[req.biome] ? req.biome : 'kueste';
    const combat = req.combat === 'boss' || req.combat === 'key' ? req.combat : null;
    const intensity = clamp(req.intensity == null ? (combat ? 0.6 : 0.3) : +req.intensity, 0, 1);
    const key = (combat ? combat + ':' : '') + biome;
    const cur = E.pieces.find(p => p.stopAt == null);
    if (cur && cur.key === key) { cur.intTarget = intensity; return; }
    const def = combat ? bossDef(biome, combat === 'key') : EXPLORE[biome];
    const t = now();
    let start = t + 0.05;
    if (cur && !offline) {
      // Wechsel auf Taktgrenze (in den Kampf: nächster Schlag, damit es sofort greift)
      const nb2 = combat ? cur.nextBeatT : cur.nextBeatT + mod(cur.beats - (cur.beat % cur.beats), cur.beats) * cur.beatDur;
      start = Math.max(t + 0.05, nb2 > t + 4.5 ? cur.nextBeatT : nb2);
    }
    const fade = offline ? 0.01 : combat ? 2 : (cur && cur.combat ? 4 : 3);
    for (const p of E.pieces) if (p.stopAt == null) {
      p.out.gain.setValueAtTime(p.out.gain.value, start); p.out.gain.linearRampToValueAtTime(0, start + fade); p.stopAt = start + fade;
    }
    const P = createPiece(E, def, key, start, intensity, !!combat);
    P.out.gain.setValueAtTime(0, t); P.out.gain.setValueAtTime(0.0001, start); P.out.gain.linearRampToValueAtTime(1, start + fade);
    E.pieces.push(P);
  };
  E.stopMusic = () => { const t = now(); for (const p of E.pieces) if (p.stopAt == null) { p.out.gain.setTargetAtTime(0, t, 0.8); p.stopAt = t + 3.5; } };
  E.schedule = (until) => {
    for (let i = E.pieces.length - 1; i >= 0; i--) {
      const P = E.pieces[i];
      while (P.nextBeatT < until && (P.stopAt == null || P.nextBeatT < P.stopAt)) {
        renderBeat(E, P, P.nextBeatT); P.beat++; P.nextBeatT += P.beatDur;
      }
      if (P.stopAt != null && P.stopAt + 0.3 < now()) { destroyPiece(P); E.pieces.splice(i, 1); }
    }
    E.cleanup();
  };
  return E;
}

function makeIR(ctx, secs) {
  const sr = ctx.sampleRate, len = Math.floor(sr * secs), buf = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c); let y = 0;
    for (let i = 0; i < len; i++) {
      const x = i / len, a = 0.85 - 0.75 * x; // wird zum Ende dumpfer
      y += a * ((Math.random() * 2 - 1) - y);
      const early = i < sr * 0.08 && Math.random() < 0.004 ? (Math.random() * 2 - 1) * 1.5 : 0;
      d[i] = (y + early) * Math.pow(1 - x, 2.6) * (i < 200 ? i / 200 : 1);
    }
  }
  return buf;
}

// ---------------------------------------------------------------------------------------------
// Instrumente: inst(E, dest, t, midi, dur, vel, o) – planen Knoten, trennen sie nach Ende.
// ---------------------------------------------------------------------------------------------
const VOWELS = {
  a: [[800, 1, 9], [1150, 0.5, 10], [2900, 0.12, 14]],
  o: [[450, 1, 8], [800, 0.4, 10], [2830, 0.06, 14]],
  u: [[325, 1, 7], [700, 0.25, 10], [2530, 0.04, 14]],
};
const INST = {
  choir(E, dest, t, m, dur, vel, o = {}) {
    const v = E.voice(), f = mtof(m), att = o.att || 0.9, rel = o.rel || 1.6;
    const g = E.gain(v), sum = E.gain(v, 1);
    const end = E.envelope(g.gain, t, att, vel, 1, 1, t + dur, rel);
    const lfo = E.osc(v, 'sine', rand(4.6, 5.6), t, end), lg = E.gain(v, rand(9, 16)); lfo.connect(lg);
    for (const dt of [-8, 7]) { const s = E.osc(v, 'sawtooth', f, t, end); s.detune.value = dt + rand(-3, 3); lg.connect(s.detune); s.connect(sum); }
    const vw = VOWELS[o.vowel || 'a'];
    for (const [ff, fg, q] of vw) { const bp = E.filt(v, 'bandpass', ff * (1 + (m - 60) * 0.004), q), bg = E.gain(v, fg * 1.6); sum.connect(bp); bp.connect(bg); bg.connect(g); }
    g.connect(dest); E.done(v);
  },
  strings(E, dest, t, m, dur, vel, o = {}) {
    const v = E.voice(), f = mtof(m), att = o.att != null ? o.att : 0.35, rel = o.rel || (dur < 0.5 ? 0.12 : 0.9);
    const g = E.gain(v), lp = E.filt(v, 'lowpass', Math.min(f * (o.bright || 5), 7000), 0.8);
    const end = E.envelope(g.gain, t, att, vel * 0.5, 0.3, 0.85, t + dur, rel);
    if (dur < 0.5) { lp.frequency.setValueAtTime(Math.min(f * 9, 9000), t); lp.frequency.setTargetAtTime(f * 3, t, 0.08); }
    for (const dt of [-11, 0, 12]) { const s = E.osc(v, 'sawtooth', f, t, end); s.detune.value = dt + rand(-4, 4); s.connect(lp); }
    lp.connect(g); g.connect(dest); E.done(v);
  },
  brass(E, dest, t, m, dur, vel, o = {}) {
    const v = E.voice(), f = mtof(m), att = o.att != null ? o.att : 0.07, rel = o.short ? 0.15 : 0.35;
    const d2 = o.short ? Math.min(dur, 0.35) : dur;
    const g = E.gain(v), lp = E.filt(v, 'lowpass', f * 1.5, 1.6);
    const end = E.envelope(g.gain, t, att, vel * 0.55, 0.4, 0.8, t + d2, rel);
    lp.frequency.setValueAtTime(f * 1.2, t);
    lp.frequency.linearRampToValueAtTime(Math.min(f * (2.5 + 6 * vel), 8000), t + att + 0.05);
    lp.frequency.setTargetAtTime(f * (2 + 2 * vel), t + att + 0.05, 0.3);
    for (const dt of [-6, 6]) { const s = E.osc(v, 'sawtooth', f, t, end); s.detune.value = dt; s.detune.setValueAtTime(dt - 30, t); s.detune.linearRampToValueAtTime(dt, t + 0.06); s.connect(lp); }
    lp.connect(g); g.connect(dest); E.done(v);
  },
  harp(E, dest, t, m, dur, vel) {
    const v = E.voice(), f = mtof(m), end = t + 2.2;
    const g = E.gain(v), lp = E.filt(v, 'lowpass', Math.min(f * 10, 9000), 1);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.6, t + 0.004); g.gain.setTargetAtTime(0, t + 0.01, 0.45);
    lp.frequency.setTargetAtTime(f * 1.6, t, 0.12);
    const a = E.osc(v, 'triangle', f, t, end), b = E.osc(v, 'sawtooth', f * 1.002, t, end), bg = E.gain(v, 0.25);
    a.connect(lp); b.connect(bg); bg.connect(lp); lp.connect(g); g.connect(dest); E.done(v);
  },
  bell(E, dest, t, m, dur, vel, o = {}) {
    const v = E.voice(), f = mtof(m), T = o.far ? 3.5 : 5, end = t + T;
    const g = E.gain(v, vel * 0.5);
    let out = g;
    if (o.far) { const lp = E.filt(v, 'lowpass', 1800, 0.5); g.connect(lp); out = lp; }
    const P = [[0.5, 0.5, 1], [1, 1, 0.8], [1.19, 0.45, 0.5], [1.56, 0.35, 0.4], [2, 0.4, 0.35], [2.74, 0.25, 0.22], [3.76, 0.15, 0.15]];
    for (const [r, a, d] of P) {
      const s = E.osc(v, 'sine', f * r * rand(0.998, 1.002), t, end), sg = E.gain(v);
      sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(a, t + 0.003); sg.gain.setTargetAtTime(0, t + 0.004, T * d * 0.3);
      s.connect(sg); sg.connect(g);
    }
    out.connect(dest); E.done(v);
  },
  glass(E, dest, t, m, dur, vel) { // FM-Glocke, schimmernd
    const v = E.voice(), f = mtof(m), end = t + 2.6;
    const c = E.osc(v, 'sine', f, t, end), mo = E.osc(v, 'sine', f * 3.5, t, end), mg = E.gain(v), g = E.gain(v);
    mg.gain.setValueAtTime(f * 2.2, t); mg.gain.setTargetAtTime(f * 0.1, t, 0.25);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.6, t + 0.005); g.gain.setTargetAtTime(0, t + 0.01, 0.55);
    mo.connect(mg); mg.connect(c.frequency); c.connect(g); g.connect(dest); E.done(v);
  },
  organ(E, dest, t, m, dur, vel) {
    const v = E.voice(), f = mtof(m), g = E.gain(v);
    const end = E.envelope(g.gain, t, 1.5, vel * 0.35, 1, 1, t + dur, 2);
    for (const [r, a] of [[0.5, 0.6], [1, 1], [2, 0.5], [3, 0.3], [4, 0.2], [6, 0.08]]) {
      const s = E.osc(v, 'sine', f * r, t, end), sg = E.gain(v, a); s.connect(sg); sg.connect(g);
    }
    const tr = E.osc(v, 'sine', 5.5, t, end), tg = E.gain(v, vel * 0.04); tr.connect(tg); tg.connect(g.gain);
    g.connect(dest); E.done(v);
  },
  drone(E, dest, t, m, dur, vel) {
    const v = E.voice(), f = mtof(m), g = E.gain(v), lp = E.filt(v, 'lowpass', Math.max(180, f * 3), 2);
    const end = E.envelope(g.gain, t, 2.5, vel * 0.5, 1, 1, t + dur, 3);
    const lfo = E.osc(v, 'sine', rand(0.05, 0.12), t, end), lg = E.gain(v, f * 1.5); lfo.connect(lg); lg.connect(lp.frequency);
    E.osc(v, 'sawtooth', f, t, end).connect(lp);
    const b = E.osc(v, 'sawtooth', f, t, end); b.detune.value = 7; b.connect(lp);
    const s = E.osc(v, 'sine', f / 2, t, end), sg = E.gain(v, 0.8); s.connect(sg); sg.connect(g);
    lp.connect(g); g.connect(dest); E.done(v);
  },
  coldpad(E, dest, t, m, dur, vel) {
    const v = E.voice(), f = mtof(m), g = E.gain(v), lp = E.filt(v, 'lowpass', f * 4, 1.5);
    const end = E.envelope(g.gain, t, 1.8, vel * 0.5, 1, 1, t + dur, 2.2);
    lp.frequency.setValueAtTime(f * 2, t); lp.frequency.linearRampToValueAtTime(f * 6, t + dur * 0.6); lp.frequency.linearRampToValueAtTime(f * 3, end);
    for (const dt of [-14, 0, 13]) { const s = E.osc(v, 'triangle', f, t, end); s.detune.value = dt; s.connect(lp); }
    const hi = E.osc(v, 'sine', f * 2, t, end), hg = E.gain(v, 0.25); hi.connect(hg); hg.connect(g);
    lp.connect(g); g.connect(dest); E.done(v);
  },
};

// Trommeln (Taiko-artig): Sinus mit Pitch-Drop + Fell-Rauschen
function drum(E, dest, t, kind, vel, muff) {
  const v = E.voice();
  const K = { low: [78, 0.55, 700], mid: [130, 0.3, 1400], high: [260, 0.12, 3500], boom: [52, 1.6, 300] }[kind] || [100, 0.4, 1000];
  const [f0, dec, nf] = K, end = t + dec * 2.5 + 0.1;
  const g = E.gain(v);
  const s = E.osc(v, 'sine', f0 * rand(0.97, 1.03), t, end);
  s.frequency.exponentialRampToValueAtTime(f0 * 0.42, t + dec * 0.6);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.002); g.gain.setTargetAtTime(0, t + 0.005, dec * 0.4);
  s.connect(g);
  const n = E.noise(v, t, t + 0.25), nl = E.filt(v, 'lowpass', muff ? nf * 0.4 : nf, 0.8), ng = E.gain(v);
  ng.gain.setValueAtTime(vel * (kind === 'high' ? 0.7 : 0.45), t); ng.gain.setTargetAtTime(0, t, kind === 'high' ? 0.02 : 0.04);
  n.connect(nl); nl.connect(ng); ng.connect(dest);
  if (muff) { const lp = E.filt(v, 'lowpass', 500, 0.5); g.connect(lp); lp.connect(dest); } else g.connect(dest);
  E.done(v);
}
function crash(E, dest, t, vel, swell) {
  const v = E.voice(), end = t + 2.6;
  const n = E.noise(v, swell ? t - 1.2 : t, end), hp = E.filt(v, 'highpass', 4500, 0.5), g = E.gain(v);
  if (swell) { g.gain.setValueAtTime(0, t - 1.2); g.gain.linearRampToValueAtTime(vel * 0.25, t); }
  else g.gain.setValueAtTime(vel * 0.3, t);
  g.gain.setTargetAtTime(0, t, 0.6);
  n.connect(hp); hp.connect(g); g.connect(dest); E.done(v);
}

// ---------------------------------------------------------------------------------------------
// Stück-Laufzeit
// ---------------------------------------------------------------------------------------------
function createPiece(E, def, key, start, intensity, combat) {
  const ctx = E.ctx;
  const out = ctx.createGain(); out.gain.value = 0; out.connect(E.musicIn);
  const P = {
    def, key, combat, out, mode: MODES[def.mode], pc: def.pc, beats: 4, beatDur: 60 / def.tempo,
    beat: 0, nextBeatT: start, start, stopAt: null, int: intensity, intTarget: intensity, chordDeg: 0, nodes: [out],
  };
  P.parts = def.parts.map(p => {
    const node = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (node.pan) node.pan.value = p.pan || 0;
    node.connect(out); P.nodes.push(node);
    return { p, node, st: {} };
  });
  if (def.wind) {
    const w = def.wind, src = ctx.createBufferSource(); src.buffer = E.noiseBuf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = (w.lo + w.hi) / 2; bp.Q.value = w.q;
    const g = ctx.createGain(); g.gain.value = w.lvl * 0.5;
    const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    src.connect(bp); bp.connect(g); g.connect(pn); pn.connect(out); src.start(start);
    P.wind = { src, bp, g, pn, w }; P.nodes.push(src, bp, g, pn);
  }
  return P;
}
function destroyPiece(P) {
  if (P.wind) { try { P.wind.src.stop(); } catch (e) { /* */ } }
  for (const n of P.nodes) { try { n.disconnect(); } catch (e) { /* */ } }
}
const degMidi = (P, d, oct) => 12 * (oct + 1) + P.pc + P.mode[mod(d, 7)] + 12 * Math.floor(d / 7);
const chordDegs = (P, seventh) => { const d = P.chordDeg; return seventh ? [d, d + 2, d + 4, d + 6] : [d, d + 2, d + 4]; };

function voicing(P, st, oct, seventh) {
  const base = chordDegs(P, seventh).map(d => degMidi(P, d, oct));
  const center = 12 * (oct + 1) + P.pc + 5;
  let best = base, bc = 1e9;
  for (let inv = 0; inv < base.length; inv++) for (const sh of [-12, 0]) {
    const c = base.map((m, i) => m + (i < inv ? 12 : 0) + sh).sort((a, b) => a - b);
    const mean = c.reduce((a, b) => a + b, 0) / c.length;
    let cost = Math.abs(mean - center) * 0.6 + rand(0, 2.5); // Zufall = wechselnde Umkehrungen
    if (st.prev) for (let i = 0; i < c.length; i++) cost += Math.abs(c[i] - (st.prev[i] ?? st.prev[0]));
    if (cost < bc) { bc = cost; best = c; }
  }
  st.prev = best; return best;
}

const RHYTHMS = {
  slow: [[[0, 2], [2, 1], [3, 1], [4, 3]], [[0, 1.5], [1.5, 0.5], [2, 2], [4, 1], [5, 1], [6, 2]], [[0, 3], [3, 1], [4, 4]], [[1, 1], [2, 1], [3, 1], [4, 2], [6, 2]]],
  martial: [[[0, 0.5], [0.5, 0.5], [1, 1], [2, 2], [4, 0.75], [4.75, 0.25], [5, 1], [6, 2]], [[0, 1.5], [1.5, 0.5], [2, 1.5], [3.5, 0.5], [4, 4]], [[0, 1], [1, 1], [2, 1], [3, 1], [4, 3]], [[0, 0.75], [0.75, 0.25], [1, 2], [3, 1], [4, 0.75], [4.75, 0.25], [5, 0.75], [5.75, 0.25], [6, 2]]],
  fast: [[[0, 0.5], [0.5, 0.5], [1, 1], [2, 0.5], [2.5, 0.5], [3, 1], [4, 2], [6, 1], [7, 1]], [[0, 1], [1, 0.5], [1.5, 0.5], [2, 2], [4.5, 0.5], [5, 0.5], [5.5, 0.5], [6, 2]]],
};
function newMotif(style) {
  const r = pick(RHYTHMS[style] || RHYTHMS.slow);
  let d = pick([0, 2, 4, 4, 7]);
  const notes = r.map(([pos, len], i) => {
    if (i > 0) d = clamp(d + pick([-2, -1, -1, 1, 1, 2, -3, 3, 0]), -3, 10);
    return { pos, len, d };
  });
  const last = notes[notes.length - 1]; last.d = [0, 2, 4, 7].reduce((a, b) => Math.abs(b - last.d) < Math.abs(a - last.d) ? b : a);
  return notes;
}
function varyMotif(m, style) {
  const r = Math.random();
  if (r < 0.35) return m;                                                       // nur transponiert (neue Stufe)
  if (r < 0.55) { const f = m[0].d; return m.map(n => ({ ...n, d: clamp(f - (n.d - f), -4, 10) })); } // Umkehrung
  if (r < 0.7) { const ds = m.map(n => n.d).reverse(); return m.map((n, i) => ({ ...n, d: ds[i] })); } // Krebs
  if (r < 0.9) { const fresh = newMotif(style), h = m.filter(n => n.pos < 4); return h.concat(fresh.filter(n => n.pos >= 4)); } // neues Ende
  return newMotif(style);
}

const ROLES = {
  pad(E, P, X, t, bar, bi, vel) {
    const p = X.p; if (bi !== 0 || bar % (p.every || 1)) return;
    const dur = P.beatDur * P.beats * (p.every || 1) + (p.short ? 0 : 0.3);
    const notes = voicing(P, X.st, p.oct, P.def.seventh);
    for (const m of notes) INST[p.inst](E, X.node, t + rand(0, 0.02), m, p.short ? P.beatDur * 0.5 : dur, vel / Math.sqrt(notes.length) * 1.4, p);
    if (p.short && P.int > 0.8) for (const m of notes) INST[p.inst](E, X.node, t + P.beatDur * 2.5, m, P.beatDur * 0.5, vel * 0.6, p);
  },
  drone(E, P, X, t, bar, bi, vel) {
    const p = X.p; if (bi !== 0 || bar % (p.every || 4)) return;
    const dur = P.beatDur * P.beats * (p.every || 4) + 1, r = degMidi(P, 0, p.oct);
    INST[p.inst](E, X.node, t, r, dur, vel, p);
    if (p.fifth) INST[p.inst](E, X.node, t, r + 7, dur, vel * 0.6, p);
  },
  bass(E, P, X, t, bar, bi, vel) {
    const p = X.p; if (!p.beats.includes(bi)) return;
    INST[p.inst](E, X.node, t, degMidi(P, P.chordDeg, p.oct), P.beatDur * (p.len || 1) * 0.95, vel, { att: 0.04 });
  },
  ostinato(E, P, X, t, bar, bi, vel) {
    const p = X.p, sub = p.sub || 2, ch = chordDegs(P, false).concat([P.chordDeg + 7]);
    for (let s = 0; s < sub; s++) {
      const idx = p.pat[(bi * sub + s) % p.pat.length];
      INST[p.inst](E, X.node, t + s * P.beatDur / sub, degMidi(P, ch[idx], p.oct), P.beatDur / sub * 0.7, vel * (s === 0 ? 1 : 0.7), { att: 0.008 });
    }
  },
  arp(E, P, X, t, bar, bi, vel) {
    const p = X.p, sub = p.sub || 4, ch = chordDegs(P, P.def.seventh), notes = ch.concat(ch.map(d => d + 7));
    for (let s = 0; s < sub; s++) {
      if (Math.random() > p.density) continue;
      const k = bi * sub + s, n = notes.length;
      const i = p.mode === 'random' ? (Math.random() * n) | 0 : p.mode === 'updown' ? (k % (2 * n - 2) < n ? k % (2 * n - 2) : 2 * n - 2 - (k % (2 * n - 2))) : k % n;
      INST[p.inst](E, X.node, t + s * P.beatDur / sub, degMidi(P, notes[i], p.oct), 0.3, vel * rand(0.7, 1.1), p);
    }
  },
  bell(E, P, X, t, bar, bi, vel) {
    const p = X.p;
    if (p.toll) { if (bi === 0 && bar % (p.every || 1) === 0) INST[p.inst](E, X.node, t, degMidi(P, P.chordDeg, p.oct), 4, vel, p); return; }
    if (bi !== 0 || Math.random() > p.prob) return;
    const b = (Math.random() * P.beats) | 0, d = pick(chordDegs(P, P.def.seventh));
    INST[p.inst](E, X.node, t + b * P.beatDur, degMidi(P, d, p.oct), 3, vel, p);
  },
  melody(E, P, X, t, bar, bi, vel) {
    const p = X.p, st = X.st; if (bi !== 0) return;
    if (st.rest > 0) { st.rest--; return; }
    if (st.ph == null) {
      st.count = (st.count || 0) + 1;
      st.motif = !st.motif || st.count % 4 === 0 ? newMotif(p.style) : varyMotif(st.motif, p.style);
      st.base = P.chordDeg; st.ph = 0;
    }
    const lo = st.ph * P.beats, hi = lo + P.beats;
    for (const n of st.motif) {
      if (n.pos < lo || n.pos >= hi) continue;
      let d = st.base + n.d;
      if (st.ph === 1 && n.pos % 2 === 0) { // starke Zählzeiten im 2. Takt an neuen Akkord anpassen
        const ct = chordDegs(P, false).map(x => mod(x, 7));
        if (!ct.includes(mod(d, 7))) d += ct.includes(mod(d + 1, 7)) ? 1 : -1;
      }
      INST[p.inst](E, X.node, t + (n.pos - lo) * P.beatDur + rand(0, 0.015), degMidi(P, d, p.oct), n.len * P.beatDur * 0.92, vel * (n.pos % 1 ? 0.8 : 1), { ...p, att: p.inst === 'choir' ? 0.4 : undefined });
    }
    st.ph++;
    if (st.ph >= 2) { st.ph = null; st.rest = Math.floor(Math.random() * ((p.rest || 1) + 1)); }
  },
  drums(E, P, X, t, bar, bi, vel) {
    const p = X.p, pat = p.pat;
    for (let s = 0; s < 4; s++) {
      const c = pat[(bi * 4 + s) % pat.length]; if (c === '.') continue;
      drum(E, X.node, t + s * P.beatDur / 4 + rand(-0.004, 0.006), p.voice, vel * (c === 'X' ? 1 : 0.55) * rand(0.85, 1.1), p.muff);
    }
  },
  fill(E, P, X, t, bar, bi, vel) { // Wirbel am Ende jeder 4-Takt-Phrase
    if (bar % 4 !== 3 || bi !== P.beats - 1 || Math.random() < 0.3) return;
    const n = P.int > 0.75 ? 6 : 4;
    for (let i = 0; i < n; i++) drum(E, X.node, t + i * P.beatDur / n, i % 2 ? 'mid' : 'high', vel * (0.6 + i / n), false);
  },
  boom(E, P, X, t, bar, bi, vel) {
    if (bi !== 0 || bar % (X.p.every || 4)) return;
    drum(E, X.node, t, 'boom', vel, false); drum(E, X.node, t, 'low', vel * 0.7, false);
    if (bar > 0) crash(E, X.node, t, vel, true);
  },
};

function renderBeat(E, P, t) {
  const bar = Math.floor(P.beat / P.beats), bi = P.beat % P.beats;
  P.int += (P.intTarget - P.int) * 0.35;
  if (bi === 0) {
    let d = P.def.prog[bar % P.def.prog.length];
    if (bar % 8 > 0 && Math.random() < 0.12) d = mod(d + pick([2, 5]), 7); // Akkord-Substitution (Terzverwandt)
    P.chordDeg = d;
    if (P.wind) { // Windböen
      const w = P.wind, bd = P.beatDur * P.beats;
      w.bp.frequency.linearRampToValueAtTime(rand(w.w.lo, w.w.hi), t + bd);
      w.g.gain.linearRampToValueAtTime(w.w.lvl * rand(0.25, 1.1), t + bd * rand(0.4, 1));
      if (w.pn.pan) w.pn.pan.linearRampToValueAtTime(rand(-0.6, 0.6), t + bd);
    }
  }
  const dyn = P.def.dyn ? 0.65 + 0.45 * P.int : 1;
  for (const X of P.parts) {
    const p = X.p, min = p.min || 0, max = p.max == null ? 9 : p.max;
    const gate = clamp((P.int - min) / 0.12 + 0.35, 0, 1) * clamp((max - P.int) / 0.12, 0, 1);
    if (gate <= 0.02 && p.role !== 'melody') continue;
    if (gate <= 0.02) { if (bi === 0) X.st.rest = 0, X.st.ph = null; continue; }
    ROLES[p.role](E, P, X, t, bar, bi, (p.vel || 0.3) * gate * dyn);
  }
}

// ---------------------------------------------------------------------------------------------
// Stings
// ---------------------------------------------------------------------------------------------
function playSting(E, name) {
  const t = E.ctx.currentTime + 0.06, d = E.stingIn, root = 50; // D
  const ch = (m, notes, at, dur, vel, inst = 'choir', o) => notes.forEach(n => INST[inst](E, d, at, m + n, dur, vel, o));
  if (name === 'victory') {
    E.duck(0.15, 4.5);
    drum(E, d, t, 'boom', 0.8); crash(E, d, t, 0.8, false);
    ch(root, [0, 7, 12, 16, 19], t, 3.2, 0.16, 'choir', { vowel: 'a', att: 0.3, rel: 2.5 });
    ch(root - 12, [0, 7, 12, 16], t, 3.5, 0.16, 'strings', { att: 0.2 });
    [0, 4, 7, 12].forEach((n, i) => INST.brass(E, d, t + 0.25 * i, root + n, 0.5 + (i === 3 ? 2 : 0), 0.32));
    INST.bell(E, d, t + 1.0, root + 24, 3, 0.25); INST.bell(E, d, t + 1.5, root + 19, 3, 0.18);
  } else if (name === 'death') {
    E.duck(0.05, 5);
    drum(E, d, t, 'boom', 0.9);
    INST.bell(E, d, t + 0.1, root - 12, 5, 0.35);
    ch(root, [0, 3, 6], t + 0.2, 3.5, 0.18, 'choir', { vowel: 'u', att: 0.8, rel: 3 });
    [12, 10, 8, 7, 3, 1, 0].forEach((n, i) => INST.strings(E, d, t + 0.3 + i * 0.42, root + n, 0.6, 0.25, { att: 0.08 }));
    INST.strings(E, d, t + 3.2, root - 12, 2.5, 0.3, { att: 0.3 });
  } else if (name === 'discovery') {
    E.duck(0.4, 2.5);
    [0, 7, 12, 14, 19, 24].forEach((n, i) => INST.harp(E, d, t + i * 0.09, root + 12 + n, 1, 0.3));
    INST.glass(E, d, t + 0.6, root + 31, 1, 0.2);
    ch(root + 12, [0, 7, 14], t + 0.1, 2, 0.12, 'choir', { vowel: 'o', att: 0.5 });
  } else if (name === 'levelup') {
    E.duck(0.45, 2);
    [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => INST.glass(E, d, t + i * 0.06, root + 12 + n, 1, 0.2));
    ch(root + 12, [0, 4, 7, 12], t + 0.35, 1.6, 0.12, 'choir', { vowel: 'a', att: 0.2 });
    INST.bell(E, d, t + 0.35, root + 24, 3, 0.2);
  }
}

// ---------------------------------------------------------------------------------------------
// SFX – jedes: (E, out, t, p, vel) -> Dauer. out = Stimmen-Gain (Lautstärke/Pan bereits drin).
// ---------------------------------------------------------------------------------------------
function noiseHit(E, v, out, t, type, f, q, vel, dec, sweepTo) {
  const n = E.noise(v, t, t + dec * 5 + 0.05), fl = E.filt(v, type, f, q), g = E.gain(v);
  if (sweepTo) fl.frequency.exponentialRampToValueAtTime(sweepTo, t + dec * 3);
  g.gain.setValueAtTime(vel, t); g.gain.setTargetAtTime(0, t + 0.001, dec);
  n.connect(fl); fl.connect(g); g.connect(out); return g;
}
function thump(E, v, out, t, f0, f1, vel, dec) {
  const s = E.osc(v, 'sine', f0, t, t + dec * 5 + 0.05), g = E.gain(v);
  s.frequency.exponentialRampToValueAtTime(f1, t + dec * 2);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.002); g.gain.setTargetAtTime(0, t + 0.004, dec);
  s.connect(g); g.connect(out);
}
function tone(E, v, out, t, type, f, vel, att, dec, f2) {
  const s = E.osc(v, type, f, t, t + att + dec * 5), g = E.gain(v);
  if (f2) s.frequency.exponentialRampToValueAtTime(f2, t + att + dec);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + att); g.gain.setTargetAtTime(0, t + att, dec);
  s.connect(g); g.connect(out); return s;
}
function metal(E, v, out, t, f, vel, dec, ratios = [1, 2.32, 3.91, 5.43, 6.8]) {
  ratios.forEach((r, i) => tone(E, v, out, t, i ? 'sine' : 'triangle', f * r * rand(0.99, 1.01), vel / (1 + i * 0.6), 0.001, dec / (1 + i * 0.4)));
}
const SFX = {
  swing(E, v, o, t, p) {
    const n = E.noise(v, t, t + 0.4), bp = E.filt(v, 'bandpass', 500 * p, 2.2), g = E.gain(v), d = rand(0.16, 0.24);
    bp.frequency.exponentialRampToValueAtTime(2600 * p * rand(0.85, 1.15), t + d * 0.45); bp.frequency.exponentialRampToValueAtTime(500 * p, t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.7, t + d * 0.45); g.gain.linearRampToValueAtTime(0, t + d);
    n.connect(bp); bp.connect(g); g.connect(o); return 0.4;
  },
  hit(E, v, o, t, p) {
    thump(E, v, o, t, 170 * p, 55, 0.8, 0.05);
    noiseHit(E, v, o, t, 'lowpass', 2600 * p, 0.7, 0.6, 0.025);
    noiseHit(E, v, o, t + 0.005, 'bandpass', 1100 * p * rand(0.8, 1.2), 4, 0.5, 0.04);
    return 0.3;
  },
  hitHeavy(E, v, o, t, p) {
    const sh = E.shaper(v), sg = E.gain(v, 0.6); sh.connect(sg); sg.connect(o);
    thump(E, v, sh, t, 120 * p, 38, 1, 0.1);
    noiseHit(E, v, sh, t, 'lowpass', 1900 * p, 0.8, 0.9, 0.06, 300);
    noiseHit(E, v, o, t + 0.01, 'bandpass', 700 * p * rand(0.8, 1.2), 3, 0.5, 0.09);
    return 0.6;
  },
  roll(E, v, o, t, p) {
    const n = E.noise(v, t, t + 0.6), lp = E.filt(v, 'bandpass', 900 * p, 0.9), g = E.gain(v);
    lp.frequency.exponentialRampToValueAtTime(250, t + 0.4);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.6, t + 0.06); g.gain.setTargetAtTime(0, t + 0.15, 0.1);
    n.connect(lp); lp.connect(g); g.connect(o);
    thump(E, v, o, t + 0.28, 90 * p, 45, 0.45, 0.06);
    return 0.65;
  },
  block(E, v, o, t, p) {
    metal(E, v, o, t, 420 * p * rand(0.95, 1.05), 0.35, 0.18);
    noiseHit(E, v, o, t, 'highpass', 3000, 0.7, 0.6, 0.015);
    thump(E, v, o, t, 140, 70, 0.4, 0.04);
    return 0.9;
  },
  cast(E, v, o, t, p) {
    const c = tone(E, v, o, t, 'sine', 300 * p, 0.25, 0.25, 0.2, 900 * p), m = E.osc(v, 'sine', 450 * p, t, t + 1.3), mg = E.gain(v, 300);
    m.connect(mg); mg.connect(c.frequency);
    const n = E.noise(v, t, t + 1), hp = E.filt(v, 'highpass', 3000, 0.7), g = E.gain(v);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.2, t + 0.3); g.gain.setTargetAtTime(0, t + 0.3, 0.12);
    n.connect(hp); hp.connect(g); g.connect(o); return 1.3;
  },
  fire(E, v, o, t, p) {
    thump(E, v, o, t, 110 * p, 50, 0.6, 0.12);
    const n = E.noise(v, t, t + 1), lp = E.filt(v, 'lowpass', 1200 * p, 0.8), g = E.gain(v);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.6, t + 0.05); g.gain.setTargetAtTime(0, t + 0.15, 0.2);
    lp.frequency.exponentialRampToValueAtTime(400, t + 0.8);
    n.connect(lp); lp.connect(g); g.connect(o);
    for (let i = 0; i < 7; i++) noiseHit(E, v, o, t + rand(0.02, 0.6), 'bandpass', rand(1500, 4000), 3, rand(0.2, 0.45), 0.006);
    return 1;
  },
  frost(E, v, o, t, p) {
    noiseHit(E, v, o, t, 'highpass', 6000, 0.6, 0.35, 0.15);
    for (let i = 0; i < 5; i++) {
      const tt = t + i * rand(0.03, 0.07), f = rand(2000, 4200) * p;
      const c = tone(E, v, o, tt, 'sine', f, 0.12, 0.002, 0.12), m = E.osc(v, 'sine', f * 2.7, tt, tt + 0.6), mg = E.gain(v, f * 0.8);
      m.connect(mg); mg.connect(c.frequency);
    }
    thump(E, v, o, t, 220, 110, 0.3, 0.05);
    return 0.9;
  },
  heal(E, v, o, t, p) {
    [0, 4, 7, 12].forEach((n, i) => tone(E, v, o, t + i * 0.08, 'triangle', mtof(69 + n) * p, 0.16, 0.05, 0.35));
    [0, 7].forEach(n => tone(E, v, o, t, 'sine', mtof(57 + n) * p, 0.14, 0.3, 0.4));
    noiseHit(E, v, o, t + 0.1, 'highpass', 7000, 0.5, 0.08, 0.3);
    return 2;
  },
  pickup(E, v, o, t, p) {
    tone(E, v, o, t, 'triangle', 660 * p, 0.25, 0.003, 0.05);
    tone(E, v, o, t + 0.07, 'triangle', 990 * p, 0.25, 0.003, 0.08);
    return 0.5;
  },
  coin(E, v, o, t, p) {
    metal(E, v, o, t, 1900 * p * rand(0.97, 1.03), 0.18, 0.07, [1, 1.5, 2.7]);
    metal(E, v, o, t + 0.06, 2500 * p, 0.15, 0.12, [1, 1.5, 2.7]);
    return 0.7;
  },
  roar(E, v, o, t, p) {
    const d = rand(1.1, 1.5), sh = E.shaper(v), g = E.gain(v), lp = E.filt(v, 'lowpass', 900, 1);
    const am = E.osc(v, 'sine', rand(22, 34), t, t + d + 0.5), ag = E.gain(v, 0.35); am.connect(ag); ag.connect(g.gain);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.55, t + 0.15); g.gain.setValueAtTime(0.55, t + d * 0.6); g.gain.linearRampToValueAtTime(0, t + d);
    for (const r of [1, 1.51, 0.5]) { const s = E.osc(v, 'sawtooth', 95 * p * r, t, t + d + 0.1); s.frequency.linearRampToValueAtTime(70 * p * r, t + d); s.detune.value = rand(-20, 20); s.connect(sh); }
    const n = E.noise(v, t, t + d), nb = E.filt(v, 'bandpass', 600, 1.5); n.connect(nb); nb.connect(sh);
    sh.connect(lp); lp.connect(g); g.connect(o); return d + 0.3;
  },
  step(E, v, o, t, p) {
    noiseHit(E, v, o, t, 'lowpass', rand(350, 650) * p, 1, 0.45, 0.025);
    thump(E, v, o, t, 95 * p, 55, 0.3, 0.025);
    return 0.2;
  },
  gate(E, v, o, t, p) {
    const n = E.noise(v, t, t + 3), lp = E.filt(v, 'lowpass', 200, 1), g = E.gain(v);
    lp.frequency.linearRampToValueAtTime(1200, t + 1.8);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 1.5); g.gain.linearRampToValueAtTime(0, t + 2.6);
    n.connect(lp); lp.connect(g); g.connect(o);
    [0, 7, 12].forEach(k => { const s = tone(E, v, o, t, 'sawtooth', mtof(38 + k) * p, 0.07, 1.6, 0.5); s.frequency.linearRampToValueAtTime(mtof(50 + k) * p, t + 1.8); });
    thump(E, v, o, t + 1.8, 70, 30, 0.8, 0.3);
    noiseHit(E, v, o, t + 1.8, 'highpass', 2500, 0.5, 0.3, 0.4);
    return 3;
  },
  ui(E, v, o, t, p) { tone(E, v, o, t, 'sine', 1300 * p, 0.15, 0.001, 0.015); return 0.1; },
  uiConfirm(E, v, o, t, p) { tone(E, v, o, t, 'triangle', 700 * p, 0.2, 0.002, 0.04); tone(E, v, o, t + 0.06, 'triangle', 1050 * p, 0.2, 0.002, 0.07); return 0.4; },
  lightning(E, v, o, t, p) {
    noiseHit(E, v, o, t, 'highpass', 2500 * p, 0.5, 1, 0.04);
    noiseHit(E, v, o, t + 0.05, 'bandpass', 1500, 1, 0.6, 0.02);
    const n = E.noise(v, t + 0.08, t + 2.4), lp = E.filt(v, 'lowpass', 300, 0.7), g = E.gain(v);
    g.gain.setValueAtTime(0, t + 0.08); g.gain.linearRampToValueAtTime(0.9, t + 0.2); g.gain.setTargetAtTime(0, t + 0.3, 0.45);
    n.connect(lp); lp.connect(g); g.connect(o); return 2.4;
  },
  explode(E, v, o, t, p) {
    const sh = E.shaper(v), sg = E.gain(v, 0.7); sh.connect(sg); sg.connect(o);
    thump(E, v, sh, t, 90 * p, 28, 1, 0.25);
    noiseHit(E, v, sh, t, 'lowpass', 2500 * p, 0.7, 1, 0.3, 150);
    for (let i = 0; i < 5; i++) noiseHit(E, v, o, t + rand(0.05, 0.5), 'bandpass', rand(800, 3000), 2, 0.2, 0.01);
    return 1.8;
  },
  drink(E, v, o, t, p) {
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.22;
      tone(E, v, o, tt, 'sine', 320 * p * rand(0.9, 1.1), 0.25, 0.01, 0.04, 180 * p);
      noiseHit(E, v, o, tt, 'bandpass', 600, 5, 0.25, 0.03);
    }
    return 0.9;
  },
  levelup(E, v, o, t, p) {
    [0, 4, 7, 12, 16].forEach((n, i) => tone(E, v, o, t + i * 0.06, 'triangle', mtof(72 + n) * p, 0.14, 0.003, 0.2));
    metal(E, v, o, t + 0.3, mtof(96) * p, 0.12, 0.4, [1, 2.76, 5.4]);
    return 1.6;
  },
};
const SFX_LIMIT = { step: 3, hit: 4, hitHeavy: 3, swing: 4, coin: 3, roar: 2, gate: 1, explode: 2, lightning: 2 };
const SFX_GAIN = { step: 0.5, ui: 0.6, swing: 0.7, roll: 0.8, roar: 0.9 };
const MAX_SFX = 24;

function playSfx(E, name, o = {}) {
  const fn = SFX[name]; if (!fn) return;
  const t = E.ctx.currentTime;
  if ((E.sfxActive.get(name) || 0) >= (SFX_LIMIT[name] || 4)) return;          // Voice-Limit pro Name
  let total = 0; for (const c of E.sfxActive.values()) total += c; if (total >= MAX_SFX) return; // global
  if (t - (E.lastSfx.get(name) || -1) < 0.015) return;                          // identisch im selben Frame
  E.lastSfx.set(name, t);
  const v = E.voice(), out = E.gain(v, clamp(o.vol == null ? 1 : o.vol, 0, 2) * (SFX_GAIN[name] || 1) * rand(0.88, 1.05)), pn = E.pan(v, o.pan || 0);
  out.connect(pn); pn.connect(E.sfxIn);
  const p = (o.pitch || 1) * rand(0.95, 1.05);
  const dur = fn(E, v, out, t + 0.005, p);
  v.end = Math.max(v.end, t + dur); E.done(v, name);
}

// ---------------------------------------------------------------------------------------------
// Öffentliche Fassade
// ---------------------------------------------------------------------------------------------
let E = null, timer = 0;
const pending = { music: null, vol: { music: 0.6, sfx: 0.8 } };
const LOOK = () => (typeof document !== 'undefined' && document.hidden ? 1.6 : 0.3);

export const Audio = {
  get ready() { return !!E; },
  get ctx() { return E ? E.ctx : null; },
  SFX_NAMES: Object.keys(SFX),
  BIOME_IDS: Object.keys(EXPLORE),
  init() {
    try {
      if (E) { if (E.ctx.state !== 'running') E.ctx.resume(); return E.ctx.resume ? E.ctx.resume() : Promise.resolve(); }
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return Promise.resolve();
      const ctx = new AC({ latencyHint: 'interactive' });
      E = createEngine(ctx);
      E.setVolume(pending.vol);
      if (pending.music) E.setMusic(pending.music);
      const tick = () => { try { E.schedule(E.ctx.currentTime + LOOK()); } catch (e) { console.error(e); } };
      timer = setInterval(tick, 40); tick();
      return ctx.resume();
    } catch (e) { console.error('Audio.init', e); return Promise.resolve(); }
  },
  setMusic(req = {}) { pending.music = { ...pending.music, ...req }; if (E) E.setMusic(pending.music); },
  stopMusic() { pending.music = null; if (E) E.stopMusic(); },
  sting(name) { if (E && E.ctx.state === 'running') playSting(E, name); },
  sfx(name, opts) { if (E && E.ctx.state === 'running') playSfx(E, name, opts); },
  setVolume(v = {}) { Object.assign(pending.vol, Object.fromEntries(Object.entries(v).filter(([, x]) => x != null))); if (E) E.setVolume(v); },
  dispose() { if (!E) return; clearInterval(timer); E.ctx.close(); E = null; },
};
export default Audio;

/** Offline-Render (Selbsttest): rendert Musik (+ optional SFX/Stings) und misst RMS/Peak. */
export async function renderOffline({ biome = 'kueste', combat = null, intensity = 0.7, seconds = 4, sfx = [], stings = [], sampleRate = 44100 } = {}) {
  const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  const ctx = new OAC(2, Math.ceil(sampleRate * seconds), sampleRate);
  const X = createEngine(ctx, true);
  X.setVolume({ music: 0.6, sfx: 0.8 });
  X.setMusic({ biome, combat, intensity });
  X.schedule(seconds);
  // SFX/Stings zeitversetzt über suspend/resume einplanen
  const events = [...sfx.map((n, i) => ({ at: 0.3 + i * (seconds - 0.6) / Math.max(1, sfx.length), f: () => playSfx(X, n) })),
    ...stings.map((n, i) => ({ at: 0.5 + i * 1.5, f: () => playSting(X, n) }))];
  for (const ev of events) {
    const at = Math.round(ev.at * sampleRate / 128) * 128 / sampleRate;
    ctx.suspend(at).then(() => { ev.f(); ctx.resume(); });
  }
  const buffer = await ctx.startRendering();
  let sum = 0, peak = 0, n = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); sum += a * a; if (a > peak) peak = a; n++; }
  }
  return { rms: Math.sqrt(sum / n), peak, buffer };
}
