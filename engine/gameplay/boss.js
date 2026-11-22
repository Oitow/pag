/**
 * @modul    boss
 * @zweck    Boss-Ablauf ohne THREE: Phasen (100–60 % normal, 60–30 % Heulen ruft Verstärkung, <30 % rasend), telegrafierte Angriffe (Sprung-Schlag mit Boden-Ring 1.2 s vorher, Prankenhieb-Kegel), Leine zum Ort, Rücksetzen + Heilen wenn das Ziel flieht; Schaden als Befehle (gameplay/befehle)
 * @api      createBoss({ wesen, ents, befehle, sende, ruf, boden, x, z, id, name, schaden, leine, tempo }) -> { id, name, phase, modus, aktiv, entId, fest(dt, ziel|null), dispose() } ; BOSS
 * @beispiel
 *   import { createBoss } from '../../engine/gameplay/boss.js';
 *   const boss = createBoss({ wesen: alphaWesen, ents, befehle, x, z, boden: (x, z) => welt.bodenHoehe(x, z),
 *     sende: (name, d) => bus.sende(name, d), ruf: (art, n, x, z) => lager.ruf(art, n, x, z) });
 *   boss.fest(1 / 60, ents.hole(lager.zielId));        // ziel = Spieler-Entität im Kampf (sonst null)
 * @tags     boss, gegner, phasen, telegraph, kampf, wolf, gameplay, mmo
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * wesen = Horde-Wesen (gameplay/horde) mit wesen.entId; der Boss setzt wesen.fremd = true und steuert x/z/y/yaw/hub/phase/ton selbst.
 * sende('gegner:warnung', {pos,radius,dauer}) vor dem Sprung · sende('gegner:boss', {id,phase,name}): phase 0/1/2 beim Kampfbeginn bzw. Phasenwechsel, −1 bei Rücksetzen.
 * ruf(art, anzahl, x, z): Verstärkung (Heulen, einmal bei Phase 1). Schaden an Spieler-Entitäten (Team 'spieler') über befehle.sende.
 */
export const BOSS = Object.freeze({
  sprung: { warn: 1.2, flug: 0.45, radius: 3.4, min: 4.5, max: 14, faktor: 1.7, pause: 2.8 },
  hieb: { warn: 0.7, nach: 0.45, reichweite: 4.4, winkel: 0.9, faktor: 1.0, pause: 1.5, nah: 3.8 },
  heulen: { dauer: 1.8, wolfe: 4, ring: 3.5 },
  phasen: [1, 0.6, 0.3],            // Lebensanteil, ab dem Phase 0 / 1 / 2 gilt (Phase 2 = unter 30 %)
  rasend: { tempo: 1.35, pause: 0.6, schaden: 1.3 },
});

export function createBoss({
  wesen, ents, befehle, sende = () => {}, ruf = () => {}, boden = () => 0, x = wesen?.x ?? 0, z = wesen?.z ?? 0,
  id = 'boss', name = 'Grauzahn, der Alpha', schaden = 24, leine = 55, tempo = 5.2, reichweite = 3,
} = {}) {
  const st = { phase: 0, modus: 'ruhe', t: 0, cd: 0.8, ziel: { x: 0, y: 0, z: 0 }, von: { x: 0, z: 0 }, yaw: 0, geheult: false, tot: false };
  const w = wesen;
  w.fremd = true;
  const frac = () => { const e = ents.hole(w.entId); return e ? e.leben / (e.lebenMax || 1) : 0; };
  const rasend = () => st.phase >= 2;
  const mult = () => (rasend() ? BOSS.rasend.schaden : 1);

  function wechsle(modus) { st.modus = modus; st.t = 0; }
  function laufeZu(px, pz, v, dt) {
    const dx = px - w.x, dz = pz - w.z, d = Math.hypot(dx, dz);
    if (d < 1e-3) return 0;
    const s = Math.min(d, v * dt);
    w.x += dx / d * s; w.z += dz / d * s;
    w.yaw = Math.atan2(dx, dz);
    w.phase += s * 1.7 / w.skala;
    w.y = boden(w.x, w.z);
    return d - s;
  }
  function treffe(e, faktor, kraft) {
    const dx = e.pos.x - w.x, dz = e.pos.z - w.z, l = Math.hypot(dx, dz) || 1;
    befehle.sende({ von: w.entId, art: 'schaden', daten: { ziel: e.id, menge: schaden * faktor * mult(), stoss: { x: dx / l, z: dz / l, kraft } } });
  }
  function rasenPruefen() {
    const f = frac(), p = f < BOSS.phasen[2] ? 2 : f < BOSS.phasen[1] ? 1 : 0;
    if (p <= st.phase) return;
    st.phase = p;
    sende('gegner:boss', { id: w.entId, phase: p, name });
    if (p === 1 && !st.geheult) { st.geheult = true; wechsle('heulen'); }
    if (p === 2) w.ton = 1.35;
  }

  function fest(dt, ziel = null) {
    if (st.tot || w.tot) { st.tot = true; return; }
    w.fremd = true;
    const e = ents.hole(w.entId);
    if (!e || !e.lebt) { st.tot = true; return; }
    const zl = ziel && ziel.lebt !== false ? ziel : null;
    st.t += dt; st.cd -= dt;
    const dHeim = Math.hypot(w.x - x, w.z - z);
    const zuWeit = zl && Math.hypot(zl.pos.x - x, zl.pos.z - z) > leine;

    if (st.modus === 'zurueck') {                                  // heim, heilen, wieder ruhen
      if (laufeZu(x, z, tempo * 1.6, dt) < 1.2) {
        ents.aendere(w.entId, { leben: e.lebenMax }); w.leben = w.lebenMax;
        st.phase = 0; st.geheult = false; w.ton = 1; st.cd = 0.8; wechsle('ruhe');
      }
      return;
    }
    if (st.modus !== 'ruhe' && (!zl || zuWeit || dHeim > leine)) {  // Ziel geflohen/tot oder zu weit von der Leine
      sende('gegner:boss', { id: w.entId, phase: -1, name });
      w.hub = 0; w.zustand = 'lauf'; wechsle('zurueck');
      return;
    }
    if (st.modus === 'ruhe') {
      if (!zl || zuWeit) { if (dHeim > 1.5) laufeZu(x, z, tempo, dt); return; }
      st.phase = 0; rasenPruefen();
      sende('gegner:boss', { id: w.entId, phase: st.phase, name });
      wechsle('jagd');
    }
    rasenPruefen();
    const dx = zl.pos.x - w.x, dz = zl.pos.z - w.z, d = Math.hypot(dx, dz);

    switch (st.modus) {
      case 'jagd': {
        w.hub = 0; w.zustand = 'lauf';
        const v = tempo * (rasend() ? BOSS.rasend.tempo : 1);
        if (d > reichweite + zl.radius) laufeZu(zl.pos.x, zl.pos.z, v, dt); else w.yaw = Math.atan2(dx, dz);
        if (st.cd > 0) break;
        if (d >= BOSS.sprung.min && d <= BOSS.sprung.max) {          // Sprung-Schlag: Ziel merken, Ring zeigen, dann springen
          st.ziel.x = zl.pos.x; st.ziel.z = zl.pos.z; st.ziel.y = boden(st.ziel.x, st.ziel.z);
          sende('gegner:warnung', { pos: { x: st.ziel.x, y: st.ziel.y, z: st.ziel.z }, radius: BOSS.sprung.radius, dauer: BOSS.sprung.warn });
          wechsle('sprungWarn');
        } else if (d <= BOSS.hieb.nah + zl.radius) { st.yaw = Math.atan2(dx, dz); w.yaw = st.yaw; wechsle('hiebWarn'); }
        break;
      }
      case 'sprungWarn':                                             // ducken und zielen
        w.yaw = Math.atan2(st.ziel.x - w.x, st.ziel.z - w.z);
        if (st.t >= BOSS.sprung.warn) { st.von.x = w.x; st.von.z = w.z; w.t = 0; wechsle('sprung'); }
        break;
      case 'sprung': {
        const u = Math.min(1, st.t / BOSS.sprung.flug);
        w.x = st.von.x + (st.ziel.x - st.von.x) * u; w.z = st.von.z + (st.ziel.z - st.von.z) * u;
        w.hub = Math.sin(Math.PI * u) * 2.2; w.zustand = 'sprung'; w.y = boden(w.x, w.z);
        if (u >= 1) {
          w.hub = 0; w.zustand = 'lauf';
          for (const o of ents.imUmkreis(st.ziel.x, st.ziel.z, BOSS.sprung.radius, { team: 'spieler' })) treffe(o, BOSS.sprung.faktor, 11);
          st.cd = BOSS.sprung.pause * (rasend() ? BOSS.rasend.pause : 1); wechsle('jagd');
        }
        break;
      }
      case 'hiebWarn':                                               // Ausholen, Blickrichtung bleibt
        w.yaw = st.yaw;
        if (st.t >= BOSS.hieb.warn) {
          const sx = Math.sin(st.yaw), sz = Math.cos(st.yaw);
          for (const o of ents.imUmkreis(w.x, w.z, BOSS.hieb.reichweite, { team: 'spieler' })) {
            const ox = o.pos.x - w.x, oz = o.pos.z - w.z, l = Math.hypot(ox, oz) || 1;
            if ((ox * sx + oz * sz) / l >= Math.cos(BOSS.hieb.winkel)) treffe(o, BOSS.hieb.faktor, 8);
          }
          wechsle('hieb');
        }
        break;
      case 'hieb':
        if (st.t >= BOSS.hieb.nach) { st.cd = BOSS.hieb.pause * (rasend() ? BOSS.rasend.pause : 1); wechsle('jagd'); }
        break;
      case 'heulen':                                                 // Kopf in den Nacken, Rudel rufen
        w.zustand = 'sprung'; w.t = 0.1;
        if (st.t >= BOSS.heulen.dauer) { ruf('wolf', BOSS.heulen.wolfe, w.x, w.z, BOSS.heulen.ring); w.zustand = 'lauf'; st.cd = 1; wechsle('jagd'); }
        break;
      default: break;
    }
  }

  return {
    id, name,
    get phase() { return st.phase; },
    get modus() { return st.modus; },
    get aktiv() { return !st.tot && st.modus !== 'ruhe'; },
    get tot() { return st.tot; },
    get entId() { return w.entId; },
    fest,
    dispose() { w.fremd = false; },
  };
}
