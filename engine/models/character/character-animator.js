/**
 * @modul    character-animator
 * @zweck    Prozedurale Figuren-Animation aus dem Motor-Zustand: idle/gehen/laufen/sprinten ohne Fußrutschen, Luft, Landung, Schwimmen, Ducken, Rutschen, Kurvenlage, Atmen, Hang, Idle-Varianten, sekundäre Bewegung, Treffer/Umfallen, Aktions-Clips mit Masken, Blick + Mimik-Hook
 * @api      createAnimator(model,opts) -> { update(dt,zustand) -> pose, spiele(name,{tempo,mischung,schleife}) -> {dauer,trefferBei}, stoppe(name?), aktion, aktionGewicht, blickZu(dirLokal|null), blickZuPunkt(welt|null), treffer(richtung,staerke,{welt}), umfallen(richtung,{staerke,welt}), aufstehen(dauer), ausdruck, mimik, idleVariante, faellt, liegt, sekundaer, hang, gewicht, griff, pose, phase, dispose() } ; createCharacterAnimator = createAnimator
 * @beispiel
 *   import { createAnimator } from '../../engine/models/character/character-animator.js';
 *   const anim = createAnimator({ rig, masse }, { seed: 7, onSchritt: (fuss, st) => schrittGeraeusch(st) });
 *   anim.update(dt, motor.zustand);                  // NPC: anim.update(dt, { tempo: 1.4 })
 *   const { trefferBei } = anim.spiele('schlagen');  // Schaden nach trefferBei Sekunden
 *   anim.treffer({ x: 0, z: -1 }, 0.7);              // Stoß von vorn (Figur-Raum), klingt von selbst ab
 *   anim.blickZuPunkt(spieler.zustand.pos);           // Kopf + Augen folgen (braucht zustand.pos/yaw)
 * @tags     figur, charakter, animation, gang, laufen, schwimmen, springen, aktion, clip, npc, spieler
 * @version  1.1.0
 * @status   entwurf
 * @three    nein
 */
import { clamp, damp, smoothstep, numOr } from '../../core/math.js';
import { rng, range, hashSeed } from '../../core/rng.js';
import { leerePose, kopierePose, mischePose, wendeAn, maskeVon, teilMaske, BEINE, ARM_L, ARM_R } from './character-pose.js';
import { CLIPS, clipPose } from './character-clips.js';
import { fussZiele, gangPose, luftPose, schwimmPose, schrittWeite, loeseBeine, naechsteRuhePhase } from './character-gang.js';
import { hangMessen, hangAnpassen } from './character-anim-hang.js';
import { createBlick } from './character-anim-blick.js';
import { createIdleSchicht, idleLeben } from './character-anim-idle.js';
import { createSekundaer } from './character-sekundaer.js';
import { createReaktion, richtungLokal } from './character-reaktion.js';
import { createZustandsSchicht } from './character-anim-zustand.js';

const LUFT_MASKE = [...BEINE, ...ARM_L, ...ARM_R, 'torso', 'hals'];
const frac = (x) => x - Math.floor(x);

/**
 * model = { rig, masse } (masse wird jedes Update frisch gelesen). opts = { gehTempo=1.8, laufTempo=5.5, sprintTempo=8, seed, onSchritt(fuss,staerke),
 *   bodenHoehe(x,z)? (Hang aus dem Gelände, sonst zustand.bodenNormal / hangVor+hangSeite), hang=true, idleVarianten=true, idleNach=[8,16],
 *   sekundaer=true|{staerke,kopf,gewicht,umhang,haar}, umhangSockel=true (dreht rig.sockel.umhang mit), mimik(info)? }.
 * Motor 1.1-Felder (optional): rollt/rollAnteil, dash, doppelSprung (Salto), gleitet, taucht/tauchTiefe, schleicht, anKante, betaeubt, getroffen.
 * Mimik-Hook: info = { ausdruck, augenYaw, augenNick, lid, geblinzelt } jedes Update an opts.mimik; hat das Modell
 *   setAusdruck(name) / setAugen(yaw,nick,lid) / blinzeln(), werden sie (Duck-Typing) ebenfalls aufgerufen.
 * zustand = Motor-Zustand (character-motor); fehlende Felder: amBoden=true, sonst 0/false.
 */
export function createAnimator(model, opts = {}) {
  const o = { gehTempo: 1.8, laufTempo: 5.5, sprintTempo: 8, hang: true, idleVarianten: true, idleNach: [8, 16], sekundaer: true,
    umhangSockel: true, ...opts };
  const r = rng(o.seed ?? hashSeed('figur'));
  const sub = (n) => hashSeed('figur', n, o.seed ?? 0);
  const blick = createBlick({ seed: sub('blick') });
  const idle = o.idleVarianten ? createIdleSchicht({ seed: sub('idle'), nach: o.idleNach }) : null;
  const sek = o.sekundaer ? createSekundaer(typeof o.sekundaer === 'object' ? o.sekundaer : {}) : null;
  const reak = createReaktion({ seed: sub('reaktion') });
  const zs = createZustandsSchicht();
  const hang = { vor: 0, seit: 0 }, hangRoh = { vor: 0, seit: 0 };
  const mimik = { ausdruck: null, augenYaw: 0, augenNick: 0, lid: 0, geblinzelt: false };
  const st = {
    zeit: r() * 20, phase: 0, spd: 0, laufW: 0, sprintW: 0, idleW: 1, duckW: 0, rutschW: 0, luftW: 0, steigen: 0,
    land: 0, landV: 0, schwimmW: 0, schwimmPhase: 0, zug: 0, eintauchen: 0, vorlage: 0, letztesTempo: 0, kurve: 0,
    gewicht: 0, gewichtZiel: 0, gewichtUhr: range(r, 2, 5), umsehUhr: range(r, 2, 5), umsehYaw: 0, umsehNick: 0,
    ausZiel: null, yaw: 0, trefferUhr: 0,
  };
  const P = { gang: leerePose(), luft: leerePose(), schwimm: leerePose(), clip: leerePose(), fix: leerePose(),
    final: leerePose(), letzte: leerePose(), von: leerePose(), tmp: leerePose() };
  const ziele = {};
  let akt = null;                                   // { name, clip, t, zeit, tempo, mischung, aus, schleife, w }
  const fade = { t: 1, dauer: 0 };

  const api = { gewicht: 1, griff: false, ausdruck: null };

  function schnappschuss(dauer) {
    kopierePose(P.letzte, P.von);
    fade.t = 0; fade.dauer = Math.max(dauer, 1e-3);
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
    st.idleW = damp(st.idleW, 1 - smoothstep(0.05, 0.35, st.spd), st.ausZiel !== null ? 5 : 8, dt);
    st.duckW = damp(st.duckW, z.duckt ? 1 : z.schleicht ? 0.55 : 0, 9, dt);
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
    idleLeben(st, r, dt);

    st.yaw = numOr(z.yaw, st.yaw);
    st.trefferUhr = Math.max(0, st.trefferUhr - dt);
    if (z.getroffen) {                              // Motor-Stoß (stoss()) → Zurückzucken in Stoßrichtung
      const vx = numOr(z.vel?.x, 0), vz = numOr(z.vel?.z, 0);
      api.treffer({ x: vx, z: vz }, clamp(Math.hypot(vx, vz) / 6, 0.3, 1.5), { welt: true });
    }
    if (o.hang && amBoden && !schwimmt) hangMessen(z, o.bodenHoehe, hangRoh); else hangRoh.vor = hangRoh.seit = 0;
    hang.vor = damp(hang.vor, hangRoh.vor, 8, dt); hang.seit = damp(hang.seit, hangRoh.seit, 8, dt);
    if (sek) sek.update(dt, { tempo: st.spd, beschl: accel * (1 - st.schwimmW), quer: -st.spd * numOr(z.drehRate, 0) * (1 - st.schwimmW), vy, amBoden });

    // --- Gangphase: Vorschub = Strecke / Zykluslänge → Füße rutschen nicht ---
    const vorher = st.phase;
    if (amBoden && !schwimmt) st.phase += (st.spd * dt) / (2 * schrittWeite(m, st.spd, o)) * (1 - st.rutschW);
    // Anhalten: angefangenen Schritt zu Ende laufen, bis beide Füße unter dem Körper sind
    if (tempo < 0.3 && amBoden && !schwimmt && st.idleW < 0.97) {
      if (st.ausZiel === null) st.ausZiel = naechsteRuhePhase(st.phase, st.laufW, st.sprintW);
      if (st.phase < st.ausZiel) st.phase = Math.min(st.ausZiel, st.phase + dt * 1.6 * (1 - st.idleW));
    } else if (tempo >= 0.3 || st.idleW >= 0.97) st.ausZiel = null;
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
      clipPose(c, akt.t, P.clip, akt.schleife);
      P.clip.basisPos.x *= skal; P.clip.basisPos.y *= skal; P.clip.basisPos.z *= skal;
      const ein = akt.mischung > 0 ? smoothstep(0, akt.mischung, akt.zeit) : 1;
      const aus = akt.schleife || c.halten ? 1 : 1 - smoothstep(c.dauer - akt.aus * akt.tempo, c.dauer, akt.t);
      w = ein * aus;
      akt.w = w;
      if (teilMaske(c.maske)) senke += Math.max(0, -P.clip.basisPos.y) * w * (1 - st.luftW);
    }
    // Idle-Varianten (eigene Schicht, nur bei echter Ruhe)
    const ruhig = !akt && !reak.faellt && !z.rollt && !(z.betaeubt > 0) && amBoden && !schwimmt && st.idleW > 0.95 && st.duckW < 0.1 && st.rutschW < 0.1 && !blick.hatZiel;
    const iw = idle ? idle.update(dt, ruhig) : 0;
    if (iw > 0) {
      const ib = idle.pose.basisPos;
      ib.x *= skal; ib.y *= skal; ib.z *= skal;
      if (teilMaske(idle.clip.maske)) senke += Math.max(0, -ib.y) * iw;
    }

    // --- Fortbewegung ---
    const g = { phase: st.phase, tempo: st.spd, laufW: st.laufW, sprintW: st.sprintW, idleW: st.idleW, duckW: st.duckW,
      rutschW: st.rutschW, gewicht: st.gewicht, senke, zeit: st.zeit, kurve: st.kurve, vorlage: st.vorlage + st.land * 0.4,
      griff: api.griff, opts: o };
    fussZiele(m, g, ziele);
    const { lehne } = hangAnpassen(m, ziele, hang.vor, hang.seit, (1 - st.luftW) * (1 - st.schwimmW));
    gangPose(m, g, ziele, P.gang);
    P.gang.torso.x += lehne; P.gang.hals.x -= lehne * 0.5;
    if (iw > 0) schicht(m, P.gang, idle.pose, idle.clip, iw, P.gang, 0);
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
    if (akt && w > 0) schicht(m, P.gang, P.clip, akt.clip, w, P.final, lw);
    else kopierePose(P.gang, P.final);
    if (akt && akt.t >= akt.clip.dauer && !akt.schleife && !akt.clip.halten) akt = null;

    // --- Überblendung von der vorigen Pose (Aktionswechsel / Abbruch) ---
    if (fade.t < fade.dauer) {
      fade.t += dt;
      mischePose(P.von, P.final, smoothstep(0, 1, fade.t / fade.dauer), P.final);
    }

    // --- Motor-Sonderzustände (Rolle, Dash, Salto, Gleiten, Kante, betäubt) ---
    zs.update(dt, z, skal);
    zs.anwenden(P.final);
    if (z.taucht) P.final.basis.x += 0.35 * clamp(numOr(z.tauchTiefe, 0), 0, 1) * st.schwimmW;
    const ueb = zs.uebersteuert;

    // --- Sekundäre Bewegung, Treffer, Umfallen ---
    reak.update(dt);
    const fw = reak.fallGewicht;
    if (sek) sek.anwenden(P.final, (1 - fw) * (1 - ueb) * (1 - (akt && !teilMaske(akt.clip.maske) ? w * 0.7 : 0)));
    reak.anwenden(P.final, 1 - fw);
    if (fw > 0) mischePose(P.final, reak.fallPose(undefined, skal), fw, P.final);

    // --- Blick (Kopf/Hals + Augen), bei Ganzkörper-Aktionen gedämpft ---
    blick.update(dt, { idleW: st.idleW * (1 - iw), umsehYaw: st.umsehYaw, umsehNick: st.umsehNick, zustand: z, augenHoehe: m.augenHoehe ?? m.hoehe * 0.93 });
    blick.anwenden(P.final, (1 - (akt && !teilMaske(akt.clip.maske) ? w : 0)) * (1 - fw) * (1 - ueb));

    if (api.gewicht < 1) mischePose(null, P.final, clamp(api.gewicht, 0, 1), P.final);
    kopierePose(P.final, P.letzte);
    if (rig) {
      wendeAn(rig, P.final);
      const um = o.umhangSockel && sek && rig.sockel?.umhang;
      if (um) um.rotation.set(sek.werte.umhangX * (1 - fw), 0, sek.werte.umhangZ * (1 - fw));
    }
    mimikMelden(w, iw);
    return P.final;
  }

  /** Mischt eine Clip-Pose src mit Maske in out; Ganzkörper-Clips mit fuesseFest lösen die Beine auf die Fußziele. */
  function schicht(m, basis, src, clip, w, out, lw) {
    mischePose(basis, src, w, out, maskeVon(clip.maske));
    if (clip.maske === 'ganz' && clip.fuesseFest) {
      kopierePose(out, P.fix);
      loeseBeine(m, P.fix, ziele);
      mischePose(out, P.fix, w * (1 - lw) * (1 - st.schwimmW), out, BEINE);
    }
  }

  function mimikMelden(w, iw) {
    let a = api.ausdruck;
    if (!a && reak.faellt) a = reak.liegt ? 'bewusstlos' : 'schmerz';
    if (!a && st.trefferUhr > 0) a = 'schmerz';
    if (!a) a = zs.ausdruck;
    if (!a && akt && w > 0.3) a = akt.clip.ausdruck;
    if (!a && idle && iw > 0.3) a = idle.clip.ausdruck;
    a = a || null;
    if (a !== mimik.ausdruck && typeof model.setAusdruck === 'function') model.setAusdruck(a);
    mimik.ausdruck = a;
    mimik.augenYaw = blick.augenYaw; mimik.augenNick = blick.augenNick; mimik.lid = blick.lid; mimik.geblinzelt = blick.geblinzelt;
    if (typeof model.setAugen === 'function') model.setAugen(mimik.augenYaw, mimik.augenNick, mimik.lid);
    if (mimik.geblinzelt && typeof model.blinzeln === 'function') model.blinzeln();
    if (o.mimik) o.mimik(mimik);
  }

  /** Spielt einen Clip. mischung (s) = Einblenden (Standard clip.einblenden); schleife überstimmt clip.schleife (Daueraktion bis stoppe()). */
  function spiele(name, { tempo = 1, mischung, schleife } = {}) {
    const clip = CLIPS[name];
    if (!clip) return { dauer: 0, trefferBei: 0 };
    tempo = Math.max(0.05, numOr(tempo, 1));
    const ein = Math.max(0, numOr(mischung, clip.einblenden));
    const laeuft = !!akt || fade.t < fade.dauer || (idle && idle.gewicht > 0);
    if (laeuft) schnappschuss(ein);
    idle?.abbrechen();
    akt = { name, clip, t: 0, zeit: 0, tempo, mischung: laeuft ? 0 : ein, aus: mischung != null ? ein : clip.ausblenden,
      schleife: schleife == null ? clip.schleife : !!schleife, w: 0 };
    return { dauer: clip.dauer / tempo, trefferBei: clip.trefferBei / tempo };
  }

  const lokal = (rich, welt) => (welt ? richtungLokal(rich, st.yaw) : rich);

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
    idleVariante: { get: () => (idle ? idle.name : null), enumerable: true },
    faellt: { get: () => reak.faellt, enumerable: true },
    liegt: { get: () => reak.liegt, enumerable: true },
    sekundaer: { get: () => (sek ? sek.werte : null), enumerable: true },
    hang: { get: () => hang, enumerable: true },
    mimik: { get: () => mimik, enumerable: true },
    blick: { get: () => blick, enumerable: true },
  });
  Object.assign(api, {
    update, spiele, stoppe,
    blickZu(dir) { blick.zu(dir); },
    /** Weltpunkt {x,y,z} ansehen (nutzt zustand.pos/yaw aus update; ohne pos = wie Richtung ab Ursprung). */
    blickZuPunkt(p) { blick.zuPunkt(p); },
    /** Treffer-Reaktion: richtung = Stoßrichtung (Figur-Raum; {welt:true} = Weltkoordinaten), staerke 0…3. */
    treffer(richtung, staerke = 1, { welt = false } = {}) {
      const d = lokal(richtung, welt);
      reak.treffer(d, staerke); st.trefferUhr = 0.6;
      sek?.stoss(numOr(d?.z, 0) * 2 * staerke, numOr(d?.x, 0) * 2 * staerke, 0);
    },
    /** Umfallen (Ragdoll-Ersatz) in Stoßrichtung; bleibt liegen bis aufstehen(). Stoppt die laufende Aktion. */
    umfallen(richtung, { staerke = 1, welt = false } = {}) {
      if (akt) stoppe();
      idle?.abbrechen();
      reak.umfallen(lokal(richtung, welt), { staerke });
    },
    aufstehen(dauer = 0.8) { reak.aufstehen(dauer); },
    dispose() { akt = null; zs.dispose(); blick.dispose(); idle?.dispose(); sek?.dispose(); reak.dispose(); o.onSchritt = null; o.mimik = null; },
  });
  return api;
}

/** Alias (gleiche Fabrik). */
export const createCharacterAnimator = createAnimator;
