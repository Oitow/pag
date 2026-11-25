// Klang: Geräuschkulisse für Wildgrund, komplett synthetisiert (WebAudio, keine Dateien).
// Wind/Meer = Dauerbetten aus engine/audio/klang.js; Regen, Vögel, Grillen, Schritte hier (wenige Knoten, ein Rauschpuffer).
// Startet erst nach der ersten Geste (Autoplay-Regeln). Knopf 🔊/🔇 (merkt sich localStorage), Testschalter ?ton=aus.
import { createKlang } from '../../../engine/audio/klang.js';
import { ortszeit } from './klima.js';
import { klangPegel } from './klang-regeln.js';

const SPEICHER = 'wildgrund-ton';
const GESTEN = ['pointerdown', 'keydown', 'touchend'];

export function createKlangKulisse(welt) {
  const url = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC || url?.get('ton') === 'aus') return { name: 'klang', update() {}, dispose() {} };

  let ctx = null, kl = null, master = null, rausch = null, regenG = null, regenF = null;
  let stumm = false;
  try { stumm = localStorage.getItem(SPEICHER) === 'aus'; } catch { /* privat */ }
  const p = welt.cam.clone(), probeT = { t: 0 }, st = { meer: 0, wald: 0, warm: false, hoehe: 0, tempo: 0 };
  const dir = new welt.THREE.Vector3(), ost = new welt.THREE.Vector3(), nord = new welt.THREE.Vector3();
  let tSchritt = 0, tVogel = 1, tGrille = 0, grilleN = 0, letzt = null;

  function start() {
    if (ctx) return;
    try {
      ctx = new AC();
      kl = createKlang({ kontext: ctx, lautstaerke: 0.5, seed: 7 });
      master = ctx.createGain(); master.gain.value = stumm ? 0 : 0.5; master.connect(ctx.destination);
      // ein Rauschpuffer (2 s) für Regen und Schritte
      const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
      let s = 12345; for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = s / 2147483648 - 1; }
      rausch = b;
      const q = ctx.createBufferSource(); q.buffer = b; q.loop = true;
      regenF = ctx.createBiquadFilter(); regenF.type = 'highpass'; regenF.frequency.value = 2500;
      regenG = ctx.createGain(); regenG.gain.value = 0;
      q.connect(regenF); regenF.connect(regenG); regenG.connect(master); q.start();
      ctx.resume?.();
    } catch (e) { ctx = null; console.warn('Ton nicht verfügbar', e); }
  }
  const beiGeste = () => { start(); ctx?.resume?.(); };
  for (const g of GESTEN) window.addEventListener(g, beiGeste, true);

  function huelle(g, t, spitze, dauer) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(spitze, t + Math.min(0.02, dauer / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
  }
  function rauschStoss(f, q, spitze, dauer, typ = 'bandpass') {
    const t = ctx.currentTime, src = ctx.createBufferSource(), fi = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = rausch; fi.type = typ; fi.frequency.value = f; fi.Q.value = q;
    src.connect(fi); fi.connect(g); g.connect(master); huelle(g, t, spitze, dauer);
    src.start(t, Math.random() * 1.5, dauer + 0.05);
  }
  function ton(f0, f1, dauer, spitze, typ = 'sine') {
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = typ; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dauer * 0.8);
    o.connect(g); g.connect(master); huelle(g, t, spitze, dauer);
    o.start(t); o.stop(t + dauer + 0.05);
  }
  function vogel() {
    const f = 2200 + Math.random() * 1800, n = 2 + (Math.random() * 3 | 0), basis = ctx.currentTime;
    for (let i = 0; i < n; i++) setTimeout(() => ctx && ton(f * (1 + 0.2 * Math.random()), f * (i % 2 ? 0.6 : 1.5), 0.09, 0.05), i * 130);
    void basis;
  }

  // Umgebung grob abtasten (höchstens alle 0,5 s): Wasser ringsum, Bewuchs, Wärme
  function taste() {
    dir.copy(welt.cam).normalize();
    ost.set(-dir.z, 0, dir.x); if (ost.lengthSq() < 1e-6) ost.set(1, 0, 0); ost.normalize();
    nord.crossVectors(dir, ost).normalize();
    let wasser = 0, feucht = 0, h0 = 0;
    const R = welt.R;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3, w = i === 0 ? 0 : 60 / R * (i % 2 ? 1 : 2.2);
      const x = dir.x + (ost.x * Math.cos(a) + nord.x * Math.sin(a)) * w, y = dir.y + (ost.y * Math.cos(a) + nord.y * Math.sin(a)) * w, z = dir.z + (ost.z * Math.cos(a) + nord.z * Math.sin(a)) * w;
      const l = Math.hypot(x, y, z), pr = welt.planet.probe(x / l, y / l, z / l, 2);
      if (pr.meer && pr.h < pr.wasser + 0.5) wasser++;
      feucht += pr.feuchte || 0; if (i === 0) h0 = Math.max(pr.h, pr.wasser);
    }
    st.meer = wasser / 6; st.wald = Math.min(1, feucht / 6 * 1.4) * (h0 > 0.5 ? 1 : 0);
    st.hoehe = welt.cam.length() - R - h0;
  }

  const knopf = welt.knopf?.('aTon', stumm ? '🔇' : '🔊', () => {
    stumm = !stumm;
    knopf.textContent = stumm ? '🔇' : '🔊';
    try { localStorage.setItem(SPEICHER, stumm ? 'aus' : 'an'); } catch { /* privat */ }
    start();
    if (master) master.gain.setTargetAtTime(stumm ? 0 : 0.5, ctx.currentTime, 0.05);
  });

  return {
    name: 'klang',
    update(dt) {
      if (!ctx || ctx.state !== 'running' || stumm || dt <= 0) { letzt = null; return; }
      probeT.t -= dt;
      if (probeT.t <= 0) { probeT.t = 0.5; taste(); st.warm = welt.zw.tJetzt > 14; }
      if (letzt) st.tempo = welt.cam.distanceTo(letzt) / dt; letzt = letzt || p; letzt.copy(welt.cam);
      const sp = welt.spieler(), w = welt.zw.wetter;
      const stunde = ortszeit(welt.zw.uhr.stunde, [dir.x, dir.y, dir.z]);
      const e = klangPegel({ wind: w.wind, regen: w.regen, hoehe: st.hoehe, tempo: st.tempo, meer: st.meer, stunde, warm: st.warm, wald: st.wald, amBoden: sp.amBoden, schwimmt: sp.schwimmt, gehen: sp.gehen });
      kl.bett('wind', e.wind); kl.bett('wasser', e.meer);
      regenG.gain.setTargetAtTime(e.regen * 0.25, ctx.currentTime, 0.5);
      tSchritt -= dt; tVogel -= dt; tGrille -= dt;
      if (e.schritt && tSchritt <= 0) { tSchritt = e.schrittAbstand; rauschStoss(260 + Math.random() * 160, 1.2, 0.35, 0.07); }
      if (e.platsch && tSchritt <= 0) { tSchritt = 0.55; rauschStoss(900 + Math.random() * 500, 0.8, 0.3, 0.22); }
      if (tVogel <= 0) { tVogel = 2 + Math.random() * 6; if (Math.random() < e.voegel * 2) vogel(); }
      if (e.grillen > 0 && tGrille <= 0) {
        tGrille = 0.09; grilleN = (grilleN + 1) % 12;
        if (grilleN < 8) ton(4300, 4300, 0.05, 0.02 * e.grillen * 2, 'square');
      }
    },
    dispose() {
      for (const g of GESTEN) window.removeEventListener(g, beiGeste, true);
      knopf?.remove(); kl?.dispose(); if (ctx && ctx.state !== 'closed') ctx.close?.().catch?.(() => {});
      ctx = null;
    },
  };
}
