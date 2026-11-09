/**
 * @modul    character-anim-idle
 * @zweck    Idle-Variationen (rein): nach längerer Ruhe deterministisch (Seed) eine Idle-Variante (strecken, gähnen, umschauen, kratzen …) als eigene Schicht einblenden, bei Bewegung sofort weich abbrechen
 * @api      idleLeben(st,r,dt) (Gewicht wechseln + Umsehen, st: gewicht/gewichtZiel/gewichtUhr/umsehUhr/umsehYaw/umsehNick/idleW) ; createIdleSchicht({seed,nach:[min,max],varianten}) -> { update(dt,ruhig) -> gewicht, pose, clip, name, ruheZeit, starte(name), abbrechen(), dispose() }
 * @beispiel
 *   import { createIdleSchicht } from '../../engine/models/character/character-anim-idle.js';
 *   const idle = createIdleSchicht({ seed: 5, nach: [8, 16] });
 *   const w = idle.update(dt, stehtStill);
 *   if (w > 0) mischePose(pose, idle.pose, w, pose, clipMaske(idle.clip));
 * @tags     figur, charakter, animation, idle, ruhe, variation, npc
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { clamp, damp, smoothstep, numOr } from '../../core/math.js';
import { rng, range, pick, hashSeed } from '../../core/rng.js';
import { leerePose } from './character-pose.js';
import { CLIPS, IDLE_VARIANTEN, clipPose } from './character-clips.js';

/** Kleines Ruhe-Leben (rein, r = rng): Standbein wechseln (st.gewicht −1…1) und gelegentlich umsehen (st.umsehYaw/Nick). */
export function idleLeben(st, r, dt) {
  st.gewichtUhr -= dt;
  if (st.gewichtUhr <= 0) {
    st.gewichtUhr = range(r, 4, 9);
    const w = r();
    st.gewichtZiel = w < 0.3 ? 0 : (w < 0.65 ? -1 : 1) * range(r, 0.5, 1);
  }
  st.gewicht = damp(st.gewicht, st.gewichtZiel * st.idleW, 1.5, dt);
  st.umsehUhr -= dt;
  if (st.umsehUhr <= 0) {
    const schaut = st.umsehYaw === 0 && st.umsehNick === 0 && r() < 0.5 && st.idleW > 0.8;
    st.umsehYaw = schaut ? range(r, -0.8, 0.8) : 0;
    st.umsehNick = schaut ? range(r, -0.15, 0.2) : 0;
    st.umsehUhr = schaut ? range(r, 1, 2.5) : range(r, 2.5, 7);
  }
  return st;
}

/** opts = { seed, nach = [8, 16] (s Ruhe bis zur ersten/nächsten Variante), varianten = IDLE_VARIANTEN, abbruch = 0.2 (s) }. */
export function createIdleSchicht(opts = {}) {
  const o = { nach: [8, 16], varianten: IDLE_VARIANTEN, abbruch: 0.2, ...opts };
  const r = rng(o.seed ?? hashSeed('idle'));
  const pose = leerePose();
  const neueWartezeit = () => range(r, numOr(o.nach[0], 8), numOr(o.nach[1], 16));
  const st = { ruhe: 0, warte: neueWartezeit(), clip: null, t: 0, w: 0, raus: 0, wRaus: 0, letzte: null };

  function starte(name) {
    const c = CLIPS[name];
    if (!c) return false;
    st.clip = c; st.t = 0; st.raus = 0; st.letzte = name;
    return true;
  }

  function update(dt, ruhig) {
    dt = clamp(numOr(dt, 0), 0, 0.1);
    st.ruhe = ruhig ? st.ruhe + dt : 0;
    if (!st.clip && ruhig && st.ruhe >= st.warte && o.varianten.length) {
      const wahl = o.varianten.length > 1 ? o.varianten.filter((n) => n !== st.letzte) : o.varianten;
      starte(pick(r, wahl));
    }
    if (!st.clip) { st.w = 0; return 0; }
    const c = st.clip;
    st.t += dt;
    if (!ruhig && !st.raus) { st.raus = Math.max(1e-3, o.abbruch); st.wRaus = st.w; }   // Bewegung → schnell ausblenden
    clipPose(c, Math.min(st.t, c.dauer), pose);
    const ein = c.einblenden > 0 ? smoothstep(0, c.einblenden, st.t) : 1;
    const aus = 1 - smoothstep(c.dauer - c.ausblenden, c.dauer, st.t);
    let w = ein * aus;
    if (st.raus) { st.raus -= dt; w = Math.min(w, st.wRaus * clamp(st.raus / o.abbruch, 0, 1)); }
    st.w = clamp(w, 0, 1);
    if (st.t >= c.dauer || (st.raus && st.raus <= 0) || (st.raus && st.w <= 1e-3)) {
      st.clip = null; st.w = 0; st.raus = 0; st.warte = st.ruhe + neueWartezeit();
    }
    return st.w;
  }

  const api = {
    update, starte, pose,
    abbrechen() { if (st.clip && !st.raus) { st.raus = o.abbruch; st.wRaus = st.w; } },
    dispose() { st.clip = null; st.w = 0; },
  };
  Object.defineProperties(api, {
    clip: { get: () => st.clip, enumerable: true },
    name: { get: () => (st.clip ? st.clip.name : null), enumerable: true },
    gewicht: { get: () => st.w, enumerable: true },
    ruheZeit: { get: () => st.ruhe, enumerable: true },
  });
  return api;
}
