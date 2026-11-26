// Riesenjagd – der Held: laufen, springen, Seil-Haken (schießen, einholen, schwingen), an Riesen klettern (Ausdauer!),
// Klingen-Angriffe (Boden, Nackenschnitt im Flug, aufgeladener Stich an der Rune). Figur aus dem Baukasten (character-model + animator).
import * as THREE from 'three';
import { createCharacterModel } from '../../../engine/models/character/character-model.js';
import { createAnimator } from '../../../engine/models/character/character-animator.js';
import { VORLAGEN } from '../../../engine/models/character/character-look.js';
import { createAusruestung } from '../../../engine/models/character/character-ausruestung.js';
import { createSeil, hakeEin, loese, bewegeAnker, schritt, HAKEN } from './haken.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const OBEN = new THREE.Vector3(0, 1, 0);

export const HELD = Object.freeze({ lauf: 6.5, sprint: 10.5, sprung: 8.5, schwere: 22, kletter: 2.6, hakenTempo: 240, gasMax: 100, ausdauerMax: 100, hpMax: 100 });

/** opts: { szene, welt, start {x,z,yaw}, schatten } */
export function createHeld({ szene, welt, start, schatten = true }) {
  const look = { ...VORLAGEN.jaegerin, name: 'Jägerin', kopfbedeckung: { stil: 'kapuze', farbe: '#2e3330' }, umhang: { stil: 'kurz', farbe: '#3a3a30' }, oberteil: { stil: 'lederruestung', farbe: '#4a3a2a', akzent: '#7a6a3a' } };
  const modell = createCharacterModel({ look, seed: 3, schatten, mimik: true });
  const anim = createAnimator(modell, { seed: 3, hang: false });
  const klingeR = createAusruestung('schwert', { seed: 4 }), klingeL = createAusruestung('dolch', { seed: 5 });
  modell.befestigen('handR', klingeR); modell.befestigen('handL', klingeL);
  szene.add(modell.root);

  // Seil + Hakenspitze
  const seilGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
  const seilLinie = new THREE.Line(seilGeo, new THREE.LineBasicMaterial({ color: 0x1a1a16 })); seilLinie.frustumCulled = false; seilLinie.visible = false; szene.add(seilLinie);
  const spitze = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 4), new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.6, roughness: 0.4 })); spitze.visible = false; szene.add(spitze);

  const y0 = welt.bodenHoehe(start.x, start.z);
  const seil = createSeil({ x: start.x, y: y0, z: start.z });
  const z = {
    modus: 'boden', yaw: start.yaw ?? 0, hp: HELD.hpMax, gas: HELD.gasMax, ausdauer: HELD.ausdauerMax, unverwundbar: 0, losgelassen: 0, angriffUhr: 0, landung: 0,
    haken: null, klettern: null, ladung: 0, tot: false, totUhr: 0, hinweis: '', schwankt: 0,
  };
  const ereignisse = [];
  const v3 = new THREE.Vector3(), v4 = new THREE.Vector3(), mat4 = new THREE.Matrix4(), inv = new THREE.Matrix4(), quat = new THREE.Quaternion();
  const animZustand = { tempo: 0, amBoden: true, vel: { x: 0, y: 0, z: 0 }, yaw: 0, sprintet: false, landung: 0 };
  let kletterClip = false;

  const pos = seil.pos, vel = seil.vel;

  function lokalZu(teil, p) { inv.copy(teil.knochen.matrixWorld).invert(); return p.clone().applyMatrix4(inv); }
  function weltVon(teil, lokal) { return lokal.clone().applyMatrix4(teil.knochen.matrixWorld); }

  function loeseHaken() { z.haken = null; loese(seil); }
  function beginneKlettern(riese, f) {
    loeseHaken();
    z.modus = 'klettern'; z.klettern = { riese, teil: f.teil, lokal: lokalZu(f.teil, f.punkt), normale: f.normale.clone() };
    vel.x = vel.y = vel.z = 0;
    anim.spiele('klettern', { schleife: true }); kletterClip = true;
    ereignisse.push({ typ: 'greifen', riese });
  }
  function endeKlettern(stoss) {
    if (!z.klettern) return;
    const n = z.klettern.normale;
    z.klettern = null; z.modus = 'luft'; z.losgelassen = 0.6;
    vel.x = n.x * (stoss ?? 4); vel.y = n.y * (stoss ?? 4) + 2; vel.z = n.z * (stoss ?? 4);
    if (kletterClip) { anim.stoppe('klettern'); kletterClip = false; }
  }

  /** Haken abfeuern auf ziel { x,y,z, riese?, teil? }. */
  function feuern(ziel) {
    if (z.tot || !ziel) return false;
    const lokal = ziel.teil ? lokalZu(ziel.teil, new THREE.Vector3(ziel.x, ziel.y, ziel.z)) : null;
    z.haken = { phase: 'fliegt', ziel, lokal, spitze: new THREE.Vector3(pos.x, pos.y + 1.1, pos.z), weg: 0 };
    ereignisse.push({ typ: 'schuss' });
    return true;
  }
  function ankerPunkt() {
    const h = z.haken; if (!h) return null;
    if (h.ziel.teil) { if (!h.ziel.riese.lebt && h.ziel.riese.zustand.tod > 2.5) { loeseHaken(); return null; } return weltVon(h.ziel.teil, h.lokal); }
    return new THREE.Vector3(h.ziel.x, h.ziel.y, h.ziel.z);
  }

  /** Treffer durch Riesen. stoss {x,y,z} */
  function schade(menge, stoss) {
    if (z.tot || z.unverwundbar > 0) return false;
    z.hp = Math.max(0, z.hp - menge); z.unverwundbar = 0.9;
    if (z.klettern) endeKlettern(2);
    if (stoss) { loeseHaken(); z.modus = 'luft'; vel.x = stoss.x; vel.y = stoss.y; vel.z = stoss.z; }
    anim.treffer({ x: 0, z: -1 }, 1);
    ereignisse.push({ typ: 'getroffen', menge });
    if (z.hp <= 0) { z.tot = true; z.totUhr = 0; loeseHaken(); if (z.klettern) endeKlettern(); anim.spiele('tod'); ereignisse.push({ typ: 'tot' }); }
    return true;
  }

  function wiederbeleben(p) {
    z.tot = false; z.hp = HELD.hpMax; z.gas = HELD.gasMax; z.ausdauer = HELD.ausdauerMax; z.modus = 'luft'; z.klettern = null; loeseHaken();
    pos.x = p.x; pos.z = p.z; pos.y = welt.bodenHoehe(p.x, p.z) + 0.5; vel.x = vel.y = vel.z = 0; z.yaw = p.yaw ?? z.yaw;
    anim.stoppe(); anim.aufstehen?.(0.8);
  }

  /** Riesen-Fläche in der Nähe (für Greifen / Treffen). */
  function naheFlaeche(riesen, p, max) {
    let best = null;
    for (const r of riesen) {
      if (!r.lebt) continue;
      if (Math.hypot(r.pos.x - p.x, r.pos.z - p.z) > 30 * r.art.skala) continue;
      const f = r.flaeche(p, 0.35);
      if (f && f.d < max && (!best || f.d < best.f.d)) best = { r, f };
    }
    return best;
  }

  /**
   * e: { stick {x,y} roh, richtung {x,z} Welt, sprint, springen (Flanke), hakenLos (Flanke losgelassen), hakenGehalten, angriffGehalten, angriffLos (Flanke) }
   */
  function update(dt, e, riesen) {
    ereignisse.length = 0;
    z.unverwundbar = Math.max(0, z.unverwundbar - dt); z.losgelassen = Math.max(0, z.losgelassen - dt); z.angriffUhr = Math.max(0, z.angriffUhr - dt);
    z.hinweis = '';
    if (z.tot) { z.totUhr += dt; vel.x *= 0.9; vel.z *= 0.9; }

    // --- Haken fliegt / hält ---
    if (z.haken?.phase === 'fliegt') {
      const a = ankerPunkt();
      if (a) {
        const h = z.haken; v3.subVectors(a, h.spitze); const d = v3.length(), s = HELD.hakenTempo * dt;
        if (d <= s) {
          h.spitze.copy(a); h.phase = 'haelt';
          hakeEin(seil, a);
          if (z.klettern) endeKlettern(1);
          if (z.modus === 'boden') { z.modus = 'luft'; vel.y = Math.max(vel.y, 5); }
          ereignisse.push({ typ: 'einhaken', pos: a.clone(), riese: h.ziel.riese ?? null });
        } else h.spitze.addScaledVector(v3, s / d);
      }
    }
    if (z.haken?.phase === 'haelt') { const a = ankerPunkt(); if (a) { bewegeAnker(seil, a); z.haken.spitze.copy(a); } }

    // --- Bewegung je Modus ---
    const einholen = !!(z.haken?.phase === 'haelt' && e.hakenGehalten && z.gas > 0 && !z.tot);
    if (z.modus === 'klettern') updateKlettern(dt, e);
    else if (z.modus === 'boden') {
      const ziel = z.tot ? 0 : (e.sprint ? HELD.sprint : HELD.lauf), r = e.richtung;
      const k = 1 - Math.exp(-12 * dt);
      vel.x += (r.x * ziel - vel.x) * k; vel.z += (r.z * ziel - vel.z) * k;
      pos.x += vel.x * dt; pos.z += vel.z * dt;
      const b = welt.bodenHoehe(pos.x, pos.z);
      if (pos.y - b > 0.8) z.modus = 'luft';
      else pos.y = b;
      vel.y = 0;
      if (e.springen && !z.tot) { vel.y = HELD.sprung; z.modus = 'luft'; }
      if (einholen) z.modus = 'luft';
      if (Math.hypot(r.x, r.z) > 0.1) z.yaw = Math.atan2(r.x, r.z);
      z.gas = Math.min(HELD.gasMax, z.gas + 30 * dt); z.ausdauer = Math.min(HELD.ausdauerMax, z.ausdauer + 22 * dt);
    } else {   // Luft (mit oder ohne Seil)
      const r = e.richtung;
      const { amZiel } = schritt(seil, dt, { einholen, steuer: z.tot ? null : r }, HAKEN);
      if (einholen) { z.gas = Math.max(0, z.gas - 13 * dt); ereignisse.push({ typ: 'gas', pos: { x: pos.x, y: pos.y + 1, z: pos.z }, richtung: v4.set(seil.anker.x - pos.x, seil.anker.y - pos.y, seil.anker.z - pos.z).normalize().clone() }); }
      else z.gas = Math.min(HELD.gasMax, z.gas + 6 * dt);
      z.ausdauer = Math.min(HELD.ausdauerMax, z.ausdauer + 10 * dt);
      // Stämme: abgleiten
      const st = welt.stammStoss(pos.x, pos.y + 0.9, pos.z, 0.5);
      if (st) { const ein = vel.x * st.nx + vel.z * st.nz; if (ein < 0) { vel.x -= ein * st.nx; vel.z -= ein * st.nz; } pos.x = st.x; pos.z = st.z; }
      // Boden
      const b = welt.bodenHoehe(pos.x, pos.z);
      if (pos.y <= b) { z.landung = -vel.y; pos.y = b; vel.y = 0; z.modus = 'boden'; if (z.haken?.phase === 'haelt' && !e.hakenGehalten) loeseHaken(); }
      if (e.springen && seil.anker) loeseHaken();
      const hv = Math.hypot(vel.x, vel.z); if (hv > 1) z.yaw = Math.atan2(vel.x, vel.z);
      // An Riesen festhalten (Seil am Riesen + angekommen, oder einfach hineingeflogen)
      if (!z.tot && z.losgelassen <= 0) {
        v3.set(pos.x, pos.y + 0.9, pos.z);
        const n = naheFlaeche(riesen, v3, (amZiel && z.haken?.ziel.riese) ? 1.6 : 0.5);
        if (n && z.ausdauer > 8) beginneKlettern(n.r, n.f);
      }
    }

    // --- Angriff ---
    if (!z.tot) angriff(dt, e, riesen);

    // --- Figur ---
    const hv = Math.hypot(vel.x, vel.z);
    animZustand.tempo = z.modus === 'klettern' ? 0 : hv; animZustand.amBoden = z.modus !== 'luft'; animZustand.vel.x = vel.x; animZustand.vel.y = vel.y; animZustand.vel.z = vel.z;
    animZustand.yaw = z.yaw; animZustand.sprintet = !!e.sprint; animZustand.landung = z.landung; z.landung = 0;
    anim.update(dt, animZustand);
    if (z.modus === 'klettern' && z.klettern) {
      const n = z.klettern.normale, oben = z.klettern.oben ?? OBEN;
      const vorn = v3.copy(n).negate(), rechts = v4.crossVectors(oben, vorn).normalize(), hoch = new THREE.Vector3().crossVectors(vorn, rechts).normalize();
      mat4.makeBasis(rechts, hoch, vorn); quat.setFromRotationMatrix(mat4);
      modell.root.quaternion.slerp(quat, 1 - Math.exp(-14 * dt));
      modell.root.position.set(pos.x, pos.y, pos.z).addScaledVector(hoch, -0.95).addScaledVector(n, -0.1);
    } else {
      quat.setFromAxisAngle(OBEN, z.yaw);
      modell.root.quaternion.slerp(quat, 1 - Math.exp(-12 * dt));
      modell.root.position.set(pos.x, pos.y, pos.z);
    }
    modell.updateGesicht?.(dt);

    // --- Seil zeichnen ---
    const h = z.haken;
    seilLinie.visible = spitze.visible = !!h;
    if (h) {
      const a = seilGeo.attributes.position;
      a.setXYZ(0, pos.x, pos.y + (z.modus === 'klettern' ? 0 : 1.0), pos.z); a.setXYZ(1, h.spitze.x, h.spitze.y, h.spitze.z); a.needsUpdate = true;
      spitze.position.copy(h.spitze); v3.set(h.spitze.x - pos.x, h.spitze.y - pos.y - 1, h.spitze.z - pos.z).normalize(); spitze.quaternion.setFromUnitVectors(OBEN, v3);
    }
    return ereignisse;
  }

  function updateKlettern(dt, e) {
    const k = z.klettern, riese = k.riese;
    if (!riese.lebt) { endeKlettern(5); return; }
    let p = weltVon(k.teil, k.lokal);
    const n = k.normale;
    // „Oben“ an der Fläche: Weltoben + etwas Richtung Kopf des Riesen, in die Tangentialebene projiziert
    const kopf = riese.knochen.kopf.getWorldPosition(new THREE.Vector3());
    const zumKopf = kopf.sub(p).normalize();
    const oben = new THREE.Vector3().copy(OBEN).addScaledVector(zumKopf, 0.8);
    oben.addScaledVector(n, -oben.dot(n)); if (oben.lengthSq() < 1e-4) oben.copy(zumKopf).addScaledVector(n, -zumKopf.dot(n));
    oben.normalize();
    const rechts = new THREE.Vector3().crossVectors(oben, n).normalize();   // Blick auf die Fläche: rechts = (−n) × oben = oben × n
    const sx = e.stick.x, sy = e.stick.y, bewegt = Math.hypot(sx, sy) > 0.15;
    const tempo = HELD.kletter * (e.sprint ? 1.5 : 1);
    if (bewegt) p.addScaledVector(oben, sy * tempo * dt).addScaledVector(rechts, sx * tempo * dt);
    let f = riese.flaeche(p, 0.35);
    const bleib = riese.flaeche(p, 0.35, k.teil);   // am aktuellen Teil bleiben, außer man ist an dessen Ende
    if (f && bleib && f.teil !== k.teil && bleib.d < f.d + 0.9 && bleib.u > 0.03 && bleib.u < 0.97) f = bleib;
    if (f) { p = f.punkt; k.teil = f.teil; k.normale.copy(f.normale); k.lokal = lokalZu(f.teil, p); }
    k.oben = oben;
    pos.x = p.x; pos.y = p.y; pos.z = p.z; vel.x = vel.y = vel.z = 0;
    // Ausdauer: Festhalten kostet, Schütteln kostet viel
    let kosten = bewegt ? (e.sprint ? 11 : 6) : 1.5;
    if (z.schwankt > 0) { kosten += 20 * z.schwankt * (bewegt ? 1.6 : 1); z.hinweis = bewegt ? 'Festhalten! Nicht bewegen' : 'Festhalten!'; }
    z.schwankt = 0;
    z.ausdauer = Math.max(0, z.ausdauer - kosten * dt);
    z.gas = Math.min(HELD.gasMax, z.gas + 6 * dt);
    if (!anim.aktion) anim.spiele('klettern', { schleife: true });
    if (z.ausdauer <= 0) { endeKlettern(3); ereignisse.push({ typ: 'abgerutscht' }); return; }
    if (e.springen) { endeKlettern(9); vel.y += 4; }
  }

  function angriff(dt, e, riesen) {
    const brust = new THREE.Vector3(pos.x, pos.y + 1.0, pos.z);
    if (z.modus === 'klettern') {
      const wp = z.klettern.riese.naechsterSchwachpunkt(brust);
      const nah = wp && wp.d < wp.s.radius + 1.3;
      if (nah) z.hinweis ||= e.angriffGehalten ? 'Stich lädt …' : 'Rune! Angriff halten';
      if (e.angriffGehalten) z.ladung = Math.min(1.3, z.ladung + dt);
      if (e.angriffLos) {
        const kraft = clamp(z.ladung / 1.3, 0, 1); z.ladung = 0;
        anim.spiele('stossen');
        const riese = z.klettern.riese;
        const menge = nah ? 12 + 44 * kraft : 4 + 4 * kraft;
        const wert = riese.schade(menge, { schwachpunkt: nah ? wp.s : null });
        ereignisse.push({ typ: 'stich', riese, wert, schwach: nah ? wp.s : null, pos: nah ? wp.s.welt.clone() : brust.clone().addScaledVector(z.klettern.normale, -0.4), normale: z.klettern.normale.clone(), kraft });
      }
      return;
    }
    z.ladung = 0;
    if (!e.angriffLos || z.angriffUhr > 0) return;
    z.angriffUhr = 0.45;
    anim.spiele('schlagen');
    const tempo = Math.hypot(vel.x, vel.y, vel.z);
    // Nackenschnitt im Vorbeiflug / Schlag gegen die Beine
    let best = null;
    for (const r of riesen) {
      if (!r.lebt) continue;
      const wp = r.naechsterSchwachpunkt(brust);
      if (wp && wp.d < wp.s.radius + (z.modus === 'luft' ? 3.2 : 1.6)) { best = { r, wp: wp.s, d: wp.d }; break; }
      const f = r.flaeche(brust, 0);
      if (f && f.d < 2.4 && (!best || f.d < best.d)) best = { r, f, d: f.d };
    }
    if (!best) { ereignisse.push({ typ: 'luftschlag' }); return; }
    if (best.wp) {
      const menge = z.modus === 'luft' ? 10 + tempo * 2.2 : 12;
      const wert = best.r.schade(menge, { schwachpunkt: best.wp });
      ereignisse.push({ typ: 'schnitt', riese: best.r, wert, schwach: best.wp, pos: best.wp.welt.clone(), normale: v3.subVectors(brust, best.wp.welt).normalize().clone(), kraft: clamp(tempo / 30, 0.3, 1) });
    } else {
      const wert = best.r.schade(6 + tempo * 0.3);
      ereignisse.push({ typ: 'schnitt', riese: best.r, wert, schwach: null, pos: best.f.punkt.clone(), normale: best.f.normale.clone(), kraft: 0.3 });
    }
  }

  return {
    zustand: z, seil, modell, anim,
    get pos() { return pos; },
    get vel() { return vel; },
    get amBoden() { return z.modus === 'boden'; },
    get kletterRiese() { return z.klettern?.riese ?? null; },
    get kletterNormale() { return z.klettern?.normale ?? null; },
    get tot() { return z.tot; },
    get tempo() { return Math.hypot(vel.x, vel.y, vel.z); },
    update, feuern, schade, wiederbeleben, loeseHaken,
    greife(riese, punkt) { const f = riese.flaeche(punkt, 0.35); if (f) { z.modus = 'luft'; beginneKlettern(riese, f); } },
    schuetteln(st) { z.schwankt = Math.max(z.schwankt, st); },
    schieben(punkt) { if (z.modus === 'klettern') return; pos.x = punkt.x; pos.z = punkt.z; if (punkt.y > pos.y + 0.2 && z.modus === 'luft') pos.y = punkt.y; },
    stoss(v) { if (z.klettern) return; loeseHaken(); z.modus = 'luft'; vel.x += v.x; vel.y = Math.max(vel.y, v.y); vel.z += v.z; },
    dispose() { modell.dispose(); seilGeo.dispose(); },
  };
}
