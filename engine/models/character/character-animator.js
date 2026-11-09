/**
 * @modul    character-animator
 * @zweck    Prozedurale Figuren-Animation aus dem Motor-Zustand: idle/gehen/laufen/sprinten ohne Fußrutschen, Luft, Landung, Schwimmen, Ducken, Rutschen, Kurvenlage, Atmen, Aktions-Clips mit Masken, Blick
 * @api      createAnimator(model,opts) -> { update(dt,zustand) -> pose, spiele(name,{tempo,mischung}) -> {dauer,trefferBei}, stoppe(name?), aktion, aktionGewicht, blickZu(dirLokal|null), gewicht, griff, pose, phase, dispose() }
 * @beispiel
 *   import { createAnimator } from '../../engine/models/character/character-animator.js';
 *   const anim = createAnimator({ rig, masse }, { seed: 7, onSchritt: (fuss, st) => schrittGeraeusch(st) });
 *   anim.update(dt, motor.zustand);                  // NPC: anim.update(dt, { tempo: 1.4 })
 *   const { trefferBei } = anim.spiele('schlagen');  // Schaden nach trefferBei Sekunden
 * @tags     figur, charakter, animation, gang, laufen, schwimmen, springen, aktion, clip, npc, spieler
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { clamp, damp, smoothstep, numOr } from '../../core/math.js';
import { rng, range, hashSeed } from '../../core/rng.js';
import { leerePose, kopierePose, mischePose, wendeAn, GANZ, OBERKOERPER, BEINE, ARM_L, ARM_R } from './character-pose.js';
import { CLIPS, clipPose } from './character-clips.js';
import { fussZiele, gangPose, luftPose, schwimmPose, schrittWeite, loeseBeine } from './character-gang.js';

const LUFT_MASKE = [...BEINE, ...ARM_L, ...ARM_R, 'torso', 'hals'];
const frac = (x) => x - Math.floor(x);

/**
 * model = { rig, masse } (masse wird jedes Update frisch gelesen). opts = { gehTempo=1.8, laufTempo=5.5, sprintTempo=8, seed, onSchritt(fuss,staerke) }.
 * zustand = Motor-Zustand (character-motor); fehlende Felder: amBoden=true, sonst 0/false.
 */
export function createAnimator(model, opts = {}) {
  const o = { gehTempo: 1.8, laufTempo: 5.5, sprintTempo: 8, ...opts };
  const r = rng(o.seed ?? hashSeed('figur'));
  const st = {
    zeit: r() * 20, phase: 0, spd: 0, laufW: 0, sprintW: 0, idleW: 1, duckW: 0, rutschW: 0, luftW: 0, steigen: 0,
    land: 0, landV: 0, schwimmW: 0, schwimmPhase: 0, zug: 0, eintauchen: 0, vorlage: 0, letztesTempo: 0, kurve: 0,
    gewicht: 0, gewichtZiel: 0, gewichtUhr: range(r, 2, 5), umsehUhr: range(r, 2, 5), umsehYaw: 0, umsehNick: 0,
    blickYaw: 0, blickNick: 0,
  };
  const P = { gang: leerePose(), luft: leerePose(), schwimm: leerePose(), clip: leerePose(), fix: leerePose(),
    final: leerePose(), letzte: leerePose(), von: leerePose(), tmp: leerePose() };
  const ziele = {};
  let akt = null;                                   // { name, clip, t, zeit, tempo, mischung, w }
  const fade = { t: 1, dauer: 0 };
  let blickZiel = null;

  const api = { gewicht: 1, griff: false };

  function schnappschuss(dauer) {
    kopierePose(P.letzte, P.von);
    fade.t = 0; fade.dauer = Math.max(dauer, 1e-3);
  }

  function idleLeben(dt) {
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
  }

  function update(dt, z = {}) {
    dt = clamp(numOr(dt, 0), 0, 0.1);
    const m = model.masse || model.rig.masse;
    const rig = model.rig;
    const Ls = m.oberschenkel + m.unterschenkel;
    st.zeit += dt;

    // --- Eingänge glätten ---
    const tempo = Math.max(0, numOr(z.tempo, 0));
    const amBoden = z.amBoden !== false;
    const vy = numOr(z.vel?.y, 0);
    const imWasser = !!z.imWasser;
    const eint = clamp(numOr(z.eintauchen, imWasser ? 0.7 : 0), 0, 1);
    const schwimmt = imWasser && eint > 0.45;
    st.spd = damp(st.spd, tempo, 12, dt);
    st.laufW = damp(st.laufW, smoothstep(o.gehTempo * 1.05, o.laufTempo * 0.8, st.spd), 6, dt);
    st.sprintW = damp(st.sprintW, smoothstep(o.laufTempo * 1.02, o.sprintTempo, st.spd) * (z.sprintet === false ? 0.5 : 1), 5, dt);
    st.idleW = damp(st.idleW, 1 - smoothstep(0.05, 0.35, st.spd), 8, dt);
    st.duckW = damp(st.duckW, z.duckt ? 1 : 0, 9, dt);
    st.rutschW = damp(st.rutschW, z.rutscht ? 1 : 0, 7, dt);
    const luftZiel = !amBoden && !schwimmt ? 1 : 0;
    st.luftW = damp(st.luftW, luftZiel, luftZiel ? 10 : 22, dt);
    st.steigen = damp(st.steigen, clamp(vy / 4, -1, 1), 7, dt);
    st.schwimmW = damp(st.schwimmW, schwimmt ? 1 : 0, 4, dt);
    st.eintauchen = damp(st.eintauchen, eint, 6, dt);
    st.zug = damp(st.zug, clamp(tempo / 2.5, 0, 1), 3, dt);
    const accel = dt > 0 ? (st.spd - st.letztesTempo) / dt : 0;
    st.letztesTempo = st.spd;
    st.vorlage = damp(st.vorlage, clamp(accel * 0.035, -0.25, 0.3) * (1 - st.luftW), 5, dt);
    st.kurve = damp(st.kurve, clamp(-numOr(z.drehRate, 0) * st.spd * 0.03, -0.3, 0.3) * (1 - st.schwimmW), 6, dt);
    // Landung: unterkritisch gedämpfte Feder (kurzes Nachfedern)
    const landung = numOr(z.landung, 0);
    if (landung > 0) { st.land = Math.max(st.land, clamp(landung / 10, 0.15, 1)); st.landV = Math.min(st.landV, 0); }
    st.landV += (-160 * st.land - 16 * st.landV) * dt;
    st.land += st.landV * dt;
    if (Math.abs(st.land) < 1e-4 && Math.abs(st.landV) < 1e-3) st.land = st.landV = 0;
    idleLeben(dt);

    // --- Gangphase: Vorschub = Strecke / Zykluslänge → Füße rutschen nicht ---
    const vorher = st.phase;
    if (amBoden && !schwimmt) st.phase += (st.spd * dt) / (2 * schrittWeite(m, st.spd, o)) * (1 - st.rutschW);
    if (o.onSchritt && amBoden && !schwimmt && tempo > 0.3 && st.rutschW < 0.5) {
      if (frac(st.phase) < frac(vorher)) o.onSchritt('L', clamp(tempo / o.laufTempo, 0.1, 1.5));
      if (frac(st.phase + 0.5) < frac(vorher + 0.5)) o.onSchritt('R', clamp(tempo / o.laufTempo, 0.1, 1.5));
    }
    st.schwimmPhase += dt * (0.55 + 0.5 * st.zug) * st.schwimmW;

    // --- Aktion abtasten (vor dem Gang: 'oben'-Clips dürfen die Hüfte senken) ---
    let w = 0, senke = Math.max(0, st.land) * 0.3 * Ls;
    const skal = m.hueftHoehe / 0.89;
    if (akt) {
      akt.t += dt * akt.tempo; akt.zeit += dt;
      const c = akt.clip;
      clipPose(c, akt.t, P.clip);
      P.clip.basisPos.x *= skal; P.clip.basisPos.y *= skal; P.clip.basisPos.z *= skal;
      const ein = akt.mischung > 0 ? smoothstep(0, akt.mischung, akt.zeit) : 1;
      const aus = c.schleife || c.halten ? 1 : 1 - smoothstep(c.dauer - akt.mischung * akt.tempo, c.dauer, akt.t);
      w = ein * aus;
      akt.w = w;
      if (c.maske === 'oben') senke += Math.max(0, -P.clip.basisPos.y) * w * (1 - st.luftW);
    }

    // --- Fortbewegung ---
    const g = { phase: st.phase, tempo: st.spd, laufW: st.laufW, sprintW: st.sprintW, idleW: st.idleW, duckW: st.duckW,
      rutschW: st.rutschW, gewicht: st.gewicht, senke, zeit: st.zeit, kurve: st.kurve, vorlage: st.vorlage + st.land * 0.4,
      griff: api.griff, opts: o };
    fussZiele(m, g, ziele);
    gangPose(m, g, ziele, P.gang);
    const lw = smoothstep(0, 1, st.luftW);
    if (lw > 0.001) {
      luftPose(st.steigen, P.luft);
      mischePose(P.gang, P.luft, lw, P.gang, LUFT_MASKE);
      P.gang.basisPos.y *= 1 - lw; P.gang.becken.x *= 1 - lw; P.gang.becken.z *= 1 - lw;
    }
    // Landung: Arme fangen ab
    if (st.land > 0) {
      P.gang.schulterL.x -= 0.3 * st.land; P.gang.schulterR.x -= 0.3 * st.land;
      P.gang.schulterL.z += 0.4 * st.land; P.gang.schulterR.z -= 0.4 * st.land;
    }
    if (imWasser && !schwimmt) {                     // waten: Arme leicht anheben
      const a = clamp(eint * 2.2, 0, 1) * 0.45;
      P.gang.schulterL.z += a; P.gang.schulterR.z -= a;
    }
    if (st.schwimmW > 0.001) {
      schwimmPose(m, st.schwimmPhase, st.zug, st.eintauchen, P.schwimm, P.tmp);
      mischePose(P.gang, P.schwimm, smoothstep(0, 1, st.schwimmW), P.gang);
    }

    // --- Aktions-Schicht ---
    if (akt && w > 0) {
      const c = akt.clip;
      mischePose(P.gang, P.clip, w, P.final, c.maske === 'oben' ? OBERKOERPER : GANZ);
      if (c.maske === 'ganz' && c.fuesseFest) {
        kopierePose(P.final, P.fix);
        loeseBeine(m, P.fix, ziele);
        mischePose(P.final, P.fix, w * (1 - lw) * (1 - st.schwimmW), P.final, BEINE);
      }
    } else kopierePose(P.gang, P.final);
    if (akt && akt.t >= akt.clip.dauer && !akt.clip.schleife && !akt.clip.halten) akt = null;

    // --- Überblendung von der vorigen Pose (Aktionswechsel / Abbruch) ---
    if (fade.t < fade.dauer) {
      fade.t += dt;
      mischePose(P.von, P.final, smoothstep(0, 1, fade.t / fade.dauer), P.final);
    }

    // --- Blick (Kopf/Hals), bei Ganzkörper-Aktionen gedämpft ---
    let zielYaw = st.umsehYaw * st.idleW, zielNick = st.umsehNick * st.idleW;
    if (blickZiel) {
      const h = Math.hypot(blickZiel.x, blickZiel.z);
      zielYaw = clamp(Math.atan2(blickZiel.x, blickZiel.z), -1.3, 1.3);
      zielNick = clamp(-Math.atan2(blickZiel.y || 0, h), -0.6, 0.6);
    }
    st.blickYaw = damp(st.blickYaw, zielYaw, blickZiel ? 7 : 3, dt);
    st.blickNick = damp(st.blickNick, zielNick, blickZiel ? 7 : 3, dt);
    const bw = 1 - (akt && akt.clip.maske === 'ganz' ? w : 0);
    P.final.hals.y += st.blickYaw * 0.4 * bw; P.final.kopf.y += st.blickYaw * 0.5 * bw;
    P.final.torso.y += st.blickYaw * 0.1 * bw;
    P.final.hals.x += st.blickNick * 0.4 * bw; P.final.kopf.x += st.blickNick * 0.6 * bw;

    if (api.gewicht < 1) mischePose(null, P.final, clamp(api.gewicht, 0, 1), P.final);
    kopierePose(P.final, P.letzte);
    if (rig) wendeAn(rig, P.final);
    return P.final;
  }

  function spiele(name, { tempo = 1, mischung = 0.12 } = {}) {
    const clip = CLIPS[name];
    if (!clip) return { dauer: 0, trefferBei: 0 };
    tempo = Math.max(0.05, numOr(tempo, 1));
    const laeuft = !!akt || fade.t < fade.dauer;
    if (laeuft) schnappschuss(mischung);
    akt = { name, clip, t: 0, zeit: 0, tempo, mischung: laeuft ? 0 : Math.max(0, mischung), w: 0 };
    return { dauer: clip.dauer / tempo, trefferBei: clip.trefferBei / tempo };
  }

  function stoppe(name) {
    if (!akt || (name && akt.name !== name)) return;
    schnappschuss(Math.max(akt.mischung, 0.15));
    akt = null;
  }

  Object.defineProperties(api, {
    aktion: { get: () => (akt ? akt.name : null), enumerable: true },
    aktionGewicht: { get: () => (akt ? akt.w : 0), enumerable: true },
    pose: { get: () => P.final, enumerable: true },
    phase: { get: () => st.phase, enumerable: true },
  });
  Object.assign(api, {
    update, spiele, stoppe,
    blickZu(dir) { blickZiel = dir ? { x: numOr(dir.x, 0), y: numOr(dir.y, 0), z: numOr(dir.z, 1) } : null; },
    dispose() { akt = null; blickZiel = null; o.onSchritt = null; },
  });
  return api;
}
