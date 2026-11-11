/**
 * @modul    horde
 * @zweck    Horden-Gegner ohne THREE (Ratten & Co. zu Dutzenden): verfolgen ein Ziel, drängeln sich ohne Überlappen, umzingeln, springen an und beißen, werden weggeschleudert, betäubt, verlangsamt, in einen Sog gezogen und sterben im Flug – deterministisch per Seed
 * @api      createHorde(opts) -> { wesen, ziele, anzahl, getoetet, arten, spawne(art,x,z,{skala}) -> wesen|null, spawneRing(art,anzahl,mitte,{radius,breite,winkel,bogen}) -> anzahl, schade(wesen,schaden,{stoss,umwerfen,verlangsamt,zug}) -> {tot,schaden}, update(dt,ziel) -> ereignisse[], leeren(), dispose() } ; HORDEN_ARTEN
 * @beispiel
 *   import { createHorde } from '../../engine/gameplay/horde.js';
 *   const horde = createHorde({ seed: 7, welt });                    // welt: Adapter mit bodenHoehe (+ wasserHoehe, hindernisse)
 *   horde.spawneRing('ratte', 30, held.zustand.pos, { radius: 20 });
 *   for (const e of horde.update(dt, { x, y, z, radius: 0.35 }))      // Ziel = Spieler (null = Horde streunt)
 *     if (e.typ === 'biss') spielerSchaden(e.schaden);
 *   for (const t of einschlag.treffer) horde.schade(t.ziel, t.schaden, t);   // horde.ziele passt direkt in zauberbuch.update(dt, ziele)
 * @tags     gegner, horde, schwarm, monster, ratte, ki, kampf, verfolgen, rückstoß, gameplay
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Wesen (lebendes Objekt, vom Renderer gelesen – engine/render/horde-mesh.js): { id, art, def, x, y, z, vx, vy, vz, yaw, skala,
 *   radius, hoehe, leben, lebenMax, tot, zustand ('lauf' | 'sprung' | 'flug' | 'benommen' | 'tot'), t (s im Zustand), phase (Lauf-Takt),
 *   hub (m Hüpfer beim Anspringen), dreh (rad Überschlag im Flug), blitz (1 → 0 Treffer-Aufleuchten), langsam (s Rest), verfall (0 → 1
 *   Leiche verschwindet), ton (Farbfaktor) }
 * Ereignisse von update() (Array wird wiederverwendet): { typ: 'biss', wesen, schaden } · { typ: 'weg', wesen } (Leiche entfernt)
 */
import { clamp, damp, dampAngle } from '../core/math.js';
import { rng, hashSeed } from '../core/rng.js';
import { createRaumGitter } from '../core/raum-gitter.js';

/** Gegner-Arten: radius/hoehe/reichweite gelten für skala 1. masse teilt jeden Stoß (schwere fliegen kaum). biss = s zwischen Bissen. */
export const HORDEN_ARTEN = Object.freeze({
  ratte: { name: 'Ratte', modell: 'ratte', leben: 12, tempo: 4.4, radius: 0.24, hoehe: 0.34, skala: [0.85, 1.2], schaden: 2, biss: 1.2, reichweite: 0.3, masse: 1 },
  riesenratte: { name: 'Riesenratte', modell: 'ratte', leben: 60, tempo: 3.7, radius: 0.24, hoehe: 0.34, skala: [2, 2.4], schaden: 8, biss: 1.3, reichweite: 0.22, masse: 4 },
  rattenkoenig: { name: 'Rattenkönig', modell: 'ratte', leben: 450, tempo: 3.1, radius: 0.24, hoehe: 0.34, skala: [4, 4.3], schaden: 18, biss: 1.6, reichweite: 0.18, masse: 16 },
});

const FALL = 20, SPRUNG = 0.3;

/** opts: { seed = 1, welt ({ bodenHoehe, wasserHoehe?, hindernisse? }), arten = HORDEN_ARTEN, max = 140 (Wesen inkl. Leichen), leichenZeit = 5 (s) } */
export function createHorde({ seed = 1, welt = null, arten = HORDEN_ARTEN, max = 140, leichenZeit = 5 } = {}) {
  const r = rng(hashSeed('horde', seed)), zuf = (a, b) => a + (b - a) * r();
  const gitter = createRaumGitter({ zelle: 2 });
  const wesen = [], ziele = [], ereignisse = [];
  let naechsteId = 1, lebend = 0, getoetet = 0, sx = 0, sz = 0, selbst = null;
  const boden = (x, z) => (typeof welt?.bodenHoehe === 'function' ? +welt.bodenHoehe(x, z) || 0 : 0);
  const wasser = (x, z) => { const h = welt?.wasserHoehe?.(x, z); return Number.isFinite(h) ? h : -Infinity; };
  const trennen = (e, abstand) => {                 // Nachbar schiebt weg (je näher, desto stärker)
    const o = e.daten;
    if (o === selbst) return;
    let dx = selbst.x - o.x, dz = selbst.z - o.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-4) { dx = Math.cos(selbst.keim); dz = Math.sin(selbst.keim); } else { dx /= d; dz /= d; }
    const tief = selbst.radius - abstand;
    if (tief > 0) { sx += dx * tief; sz += dz * tief; }
  };

  function entferne(i) {
    const w = wesen[i];
    gitter.entferne(w.id);
    if (!w.tot) lebend--;
    wesen.splice(i, 1);
  }
  function spawne(art, x, z, { skala } = {}) {
    const def = arten[art];
    if (!def || !Number.isFinite(x) || !Number.isFinite(z)) return null;
    if (wesen.length >= max) { const i = wesen.findIndex((w) => w.zustand === 'tot'); if (i >= 0) entferne(i); }
    if (wesen.length >= max) return null;
    const s = skala ?? zuf(def.skala[0], def.skala[1]);
    const w = { id: 'h' + naechsteId++, art, def, x, y: boden(x, z), z, vx: 0, vy: 0, vz: 0, yaw: zuf(-Math.PI, Math.PI), skala: s,
      radius: def.radius * s, hoehe: def.hoehe * s, leben: def.leben, lebenMax: def.leben, tot: false, zustand: 'lauf', t: 0, phase: zuf(0, 1),
      hub: 0, dreh: 0, drehTempo: 0, blitz: 0, langsam: 0, verfall: 0, ton: zuf(0.75, 1.15), keim: zuf(0, 6.283), seite: zuf(-1, 1),
      tempoF: zuf(0.85, 1.15), bissRest: zuf(0, def.biss), uhr: zuf(0, 10), zx: 0, zz: 0, gebissen: false, geprallt: false, benommen: 0 };
    wesen.push(w); lebend++;
    return w;
  }
  /** Im Ring/Bogen um mitte verteilen. winkel = Mitte des Bogens (rad, Standard zufällig), bogen = Breite (Standard voller Kreis). */
  function spawneRing(art, anzahl, mitte, { radius = 20, breite = 5, winkel = zuf(0, 6.283), bogen = Math.PI * 2 } = {}) {
    let n = 0;
    for (let i = 0; i < anzahl; i++) {
      const a = winkel + zuf(-0.5, 0.5) * bogen, d = radius + zuf(0, breite);
      if (spawne(art, (mitte?.x || 0) + Math.sin(a) * d, (mitte?.z || 0) + Math.cos(a) * d)) n++;
    }
    return n;
  }

  function fliege(w, s, mindest) {
    const m = w.def.masse;
    w.zustand = 'flug'; w.t = 0; w.geprallt = false; w.hub = 0;
    w.vx = (s?.x || 0) / m * zuf(0.8, 1.25) + (s ? 0 : zuf(-1.5, 1.5)); w.vz = (s?.z || 0) / m * zuf(0.8, 1.25) + (s ? 0 : zuf(-1.5, 1.5));
    w.vy = Math.max(mindest, (s?.y || 0) / m) + zuf(0, 2);
    w.drehTempo = zuf(7, 16) * (r() < 0.5 ? -1 : 1) / Math.sqrt(w.skala);
    gitter.entferne(w.id);
  }
  /** Schaden + Wirkung (passt zu den Treffern aus gameplay/zauber). Tote fliegen in Stoßrichtung davon. */
  function schade(w, schaden = 0, { stoss = null, umwerfen = false, verlangsamt = 0, zug = null } = {}) {
    if (!w || w.tot || !wesen.includes(w)) return { tot: false, schaden: 0 };
    schaden = Math.max(0, Math.round(+schaden || 0));
    w.leben -= schaden;
    if (schaden > 0) w.blitz = 1;
    if (verlangsamt > 0) w.langsam = Math.max(w.langsam, verlangsamt);
    if (zug) { w.zx = +zug.x || 0; w.zz = +zug.z || 0; }
    const m = w.def.masse, kraft = stoss ? Math.hypot(stoss.x, stoss.z) / m : 0;
    if (w.leben <= 0) {
      w.leben = 0; w.tot = true; lebend--; getoetet++;
      fliege(w, kraft > 0.2 ? stoss : null, 3.5);
      return { tot: true, schaden };
    }
    if (w.zustand !== 'flug') {
      if (kraft > 3 || (umwerfen && m < 8)) fliege(w, stoss, 2.5);
      else if (kraft > 0.2) { w.vx += stoss.x / m; w.vz += stoss.z / m; w.zustand = 'benommen'; w.t = 0; w.benommen = 0.22; w.hub = 0; }
    }
    return { tot: false, schaden };
  }

  function flug(w, dt) {
    w.vy -= FALL * dt;
    w.x += w.vx * dt; w.y += w.vy * dt; w.z += w.vz * dt;
    w.dreh += w.drehTempo * dt;
    const h = welt?.hindernisse?.(w.x, w.z, w.radius);
    if (h) { w.x += h.x; w.z += h.z; w.vx *= 0.5; w.vz *= 0.5; }
    const b = Math.max(boden(w.x, w.z), wasser(w.x, w.z) - w.hoehe * 0.5);
    if (w.y > b || w.vy > 0) return;
    w.y = b;
    if (!w.geprallt && w.vy < -5) { w.geprallt = true; w.vy *= -0.35; w.vx *= 0.55; w.vz *= 0.55; w.drehTempo *= 0.6; return; }
    w.vx = w.vy = w.vz = 0; w.t = 0;
    if (w.tot) w.zustand = 'tot'; else { w.zustand = 'benommen'; w.benommen = 0.55; w.dreh = 0; }
  }

  function laufen(w, dt, ziel) {
    const def = w.def;
    let wx = 0, wz = 0, d = Infinity, nx = 0, nz = 0, kontakt = 0;
    if (ziel) {
      nx = ziel.x - w.x; nz = ziel.z - w.z; d = Math.hypot(nx, nz) || 1e-4; nx /= d; nz /= d;
      kontakt = (ziel.radius ?? 0.35) + w.radius;
      const nah = clamp(1 - (d - kontakt) / 3, 0, 1), quer = w.seite * (0.2 + 0.7 * nah) + Math.sin(w.uhr * 2.3 + w.keim) * 0.3;
      wx = nx - nz * quer; wz = nz + nx * quer;                                  // drauf zu, nah am Ziel seitlich umkreisen
    } else { wx = Math.cos(w.keim + w.uhr * 0.35) * 0.3; wz = Math.sin(w.keim * 1.7 + w.uhr * 0.27) * 0.3; }   // streunen
    sx = sz = 0; selbst = w;
    gitter.imUmkreis(w.x, w.z, w.radius, trennen);
    wx += sx * 4; wz += sz * 4;
    const l = Math.hypot(wx, wz);
    if (l > 1) { wx /= l; wz /= l; }
    const b0 = boden(w.x, w.z), nass = wasser(w.x, w.z) > b0 + w.hoehe * 0.5;
    let tempo = def.tempo * w.tempoF * (w.langsam > 0 ? 0.4 : 1) * (nass ? 0.6 : 1);
    if (w.zustand === 'benommen') tempo = 0;
    else if (w.zustand === 'sprung') { tempo *= 1.4; wx = nx; wz = nz; }
    w.vx = damp(w.vx, wx * tempo, w.zustand === 'benommen' ? 5 : 9, dt); w.vz = damp(w.vz, wz * tempo, w.zustand === 'benommen' ? 5 : 9, dt);
    w.x += (w.vx + w.zx) * dt + sx * 0.8; w.z += (w.vz + w.zz) * dt + sz * 0.8;
    const ab = Math.exp(-5 * dt); w.zx *= ab; w.zz *= ab;
    if (ziel) {                                                                  // nicht in das Ziel hinein (nach dem Schritt neu messen)
      let ex = w.x - ziel.x, ez = w.z - ziel.z;
      const e = Math.hypot(ex, ez);
      if (e < kontakt) { if (e < 1e-4) { ex = Math.cos(w.keim); ez = Math.sin(w.keim); } else { ex /= e; ez /= e; } w.x = ziel.x + ex * kontakt; w.z = ziel.z + ez * kontakt; }
    }
    const h = welt?.hindernisse?.(w.x, w.z, w.radius);
    if (h) { w.x += h.x; w.z += h.z; }
    w.y = Math.max(boden(w.x, w.z), wasser(w.x, w.z) - w.hoehe * 0.5);
    const v = Math.hypot(w.vx, w.vz);
    if (ziel && (w.zustand === 'sprung' || d < kontakt + 1)) w.yaw = dampAngle(w.yaw, Math.atan2(nx, nz), 14, dt);
    else if (v > 0.3) w.yaw = dampAngle(w.yaw, Math.atan2(w.vx, w.vz), 10, dt);
    w.phase += v * dt * 1.7 / w.skala;
    gitter.setze(w.id, w.x, w.z, w.radius, w);

    if (w.zustand === 'benommen') { if (w.t >= w.benommen) { w.zustand = 'lauf'; w.t = 0; } return; }
    const reich = kontakt + def.reichweite * w.skala;
    if (w.zustand === 'sprung') {
      w.hub = Math.sin(Math.PI * clamp(w.t / SPRUNG, 0, 1)) * 0.32 * w.skala;
      if (!w.gebissen && w.t >= SPRUNG * 0.5) {
        w.gebissen = true;
        if (ziel && d < reich + 0.35 && Math.abs((ziel.y || 0) - w.y) < 1.2 + w.hoehe) ereignisse.push({ typ: 'biss', wesen: w, schaden: def.schaden });
      }
      if (w.t >= SPRUNG) { w.zustand = 'lauf'; w.t = 0; w.hub = 0; w.bissRest = def.biss * zuf(0.8, 1.3); }
    } else if (ziel && d < reich && w.bissRest <= 0 && Math.abs((ziel.y || 0) - w.y) < 1.2 + w.hoehe) {
      w.zustand = 'sprung'; w.t = 0; w.gebissen = false;
    }
  }

  return {
    wesen, ziele, arten,
    /** Lebende Wesen. */
    get anzahl() { return lebend; },
    /** Getötete seit Beginn (bzw. seit leeren()). */
    get getoetet() { return getoetet; },
    spawne, spawneRing, schade,
    update(dt, ziel = null) {
      ereignisse.length = 0; ziele.length = 0;
      dt = clamp(+dt || 0, 0, 0.1);
      for (let i = wesen.length - 1; i >= 0; i--) {
        const w = wesen[i];
        w.t += dt; w.uhr += dt;
        if (w.blitz > 0) w.blitz = Math.max(0, w.blitz - dt * 5);
        if (w.langsam > 0) w.langsam -= dt;
        if (w.bissRest > 0) w.bissRest -= dt;
        if (w.zustand === 'tot') {
          w.verfall = clamp((w.t - (leichenZeit - 0.8)) / 0.8, 0, 1);
          if (w.t >= leichenZeit) { ereignisse.push({ typ: 'weg', wesen: w }); entferne(i); }
          continue;
        }
        if (w.zustand === 'flug') flug(w, dt); else laufen(w, dt, ziel);
      }
      for (const w of wesen) if (!w.tot) ziele.push(w);
      return ereignisse;
    },
    leeren() { wesen.length = 0; ziele.length = 0; ereignisse.length = 0; gitter.leeren(); lebend = 0; getoetet = 0; },
    dispose() { wesen.length = 0; ziele.length = 0; ereignisse.length = 0; gitter.dispose(); lebend = 0; },
  };
}
