// Spieler: Physik auf der Kugel, Third-Person-Kamera, Orbit-Karte, Aktionen, Touch-UI.
// API siehe API.md (ctx.spieler). Modell: spieler-modell.js, Eingabe/DOM: spieler-eingabe.js.
import { erstelleModell } from './spieler-modell.js';
import { erstelleEingabe } from './spieler-eingabe.js';

export async function init(ctx) {
  const { THREE, scene, camera, planet } = ctx;
  const R = planet.R || ctx.R;
  const V3 = () => new THREE.Vector3();

  // ---------- Konstanten ----------
  const G = 22;                    // Gravitation m/s²
  const LAUF = 4.6, SPRINT = 1.7;  // m/s, Faktor
  const SCHWIMM = 2.4;
  const SPRUNG = 7.6;
  const MAX_HANG = Math.cos(THREE.MathUtils.degToRad(40));
  const SCHWIMM_TIEFE = 1.25;      // ab dieser Wassertiefe wird geschwommen
  const SCHWIMM_HOEHE = R - 1.05;  // Radius des Körpers beim Schwimmen (Kopf über Wasser)
  const KAM_MIN = 2.5, KAM_MAX = 28;
  const KARTE_MIN = 1.6 * R, KARTE_MAX = 6 * R;
  // Abstand, bei dem der ganze Planet (inkl. Berge) ins Bild passt – auch im Hochformat
  function kartenDist() {
    const vf = THREE.MathUtils.degToRad(camera.fov);
    const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    return THREE.MathUtils.clamp((R + 100) * 1.08 / Math.sin(Math.min(vf, hf) / 2), 2.5 * R, KARTE_MAX);
  }

  // ---------- Zustand ----------
  const pos = V3(), up = V3(), forward = V3(), vel = V3();
  const blick = V3();              // Kamera-Vorwärts in der Tangentialebene (paralleltransportiert)
  const s = {
    inWasser: false, schwimmt: false, amBoden: false, reitet: false, tot: false,
    coyote: 0, doppel: false, gleitet: false, sprungPuffer: 0,
    cdAngriff: 0, cdWurf: 0, wurfAusstehend: -1,
    pitch: 0.32, dist: innerHeight > innerWidth ? 8.5 : 7, biom: null, biomT: 0, zielT: 0, ziel: null, faehT: 0,
    totT: 0,
  };
  const faeh = { reiten: 0, schwimmen: 0, klettern: 0, fliegen: 0 };

  // ---------- Hilfen ----------
  const tA = V3(), tB = V3(), tC = V3(), tD = V3();
  function hoehe(dir) {
    const p = ctx.planet;
    if (typeof p.groundAt === 'function') {
      const g = p.groundAt(dir);
      if (typeof g === 'number' && isFinite(g)) return Math.abs(g) > R * 0.5 ? g - R : g;
      if (g?.isVector3) return g.length() - R;
      if (g && typeof g.h === 'number') return g.h;
      if (g && typeof g.height === 'number') return g.height;
    }
    const h = p.heightAt(dir);
    return isFinite(h) ? h : 0;
  }
  const bodenR = dir => R + hoehe(dir);
  // v in Tangentialebene zu n projizieren und normieren; Fallback, falls degeneriert
  function tangential(v, n, fallback) {
    v.addScaledVector(n, -v.dot(n));
    if (v.lengthSq() < 1e-8) {
      if (fallback) { v.copy(fallback).addScaledVector(n, -fallback.dot(n)); }
      if (v.lengthSq() < 1e-8) { v.set(0, 1, 0).addScaledVector(n, -n.y); if (v.lengthSq() < 1e-6) v.set(1, 0, 0).addScaledVector(n, -n.x); }
    }
    return v.normalize();
  }
  const fae = name => { try { return +(ctx.spiel?.faehigkeit?.(name) ?? ctx.kreaturen?.faehigkeit?.(name) ?? 0) || 0; } catch (e) { return 0; } };

  // ---------- Modell ----------
  const modell = erstelleModell();
  modell.gruppe.scale.setScalar(0.92);
  scene.add(modell.gruppe);

  // ---------- Karten-Marker ----------
  const marker = new THREE.Group();
  const leucht = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1, depthWrite: false, depthTest: false, toneMapped: false, fog: false });
  const mKugel = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), leucht(0xffe066));
  const mStrahl = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1, 8, 1, true), leucht(0xffe066));
  const mPfeil = new THREE.Mesh(new THREE.ConeGeometry(1, 2, 4), leucht(0xff8a3d));
  const mRing = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.9, 32), leucht(0xffffff));
  mRing.material.side = THREE.DoubleSide;
  mStrahl.geometry.translate(0, 0.5, 0); mPfeil.geometry.rotateX(Math.PI); mRing.geometry.rotateX(-Math.PI / 2);
  // Blickrichtungs-Pfeil (flach auf dem Boden)
  const mRicht = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 3), leucht(0xff8a3d));
  mRicht.geometry.rotateX(Math.PI / 2); mRicht.geometry.translate(0, 0, 2.6);
  marker.add(mKugel, mStrahl, mPfeil, mRing, mRicht);
  marker.renderOrder = 10; marker.traverse(o => { o.renderOrder = 10; o.frustumCulled = false; });
  marker.visible = false;
  scene.add(marker);

  // ---------- Karte ----------
  const karte = { offen: false, e: 0, q: new THREE.Quaternion(), dist: 3 * R };
  const kamTP = { pos: V3(), quat: new THREE.Quaternion() };   // Third-Person-Pose
  const kamZiel = V3();
  let kamZielInit = false;

  function karteUmschalten() {
    if (s.tot) return;
    karte.offen = !karte.offen;
    if (karte.offen) {
      // Start-Orientierung: Spieler in der Mitte, Kamera-Vorwärts zeigt nach oben im Bild
      if (karte.e < 0.01) {
        const z = up.clone(), y = blick.clone(), x = V3().crossVectors(y, z);
        karte.q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
        karte.q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.45)); // leicht schräg: Strahl sichtbar
        karte.dist = kartenDist();
      }
    }
    ui.setKarte(karte.offen);
    ctx.emit('spieler:karte', { offen: karte.offen });
  }

  // ---------- Aktionen ----------
  function zurKamera() { forward.copy(blick); }
  function angriff() {
    if (karte.offen || s.tot || s.cdAngriff > 0) return;
    s.cdAngriff = 0.5;
    zurKamera();
    modell.angriff();
    const p = pos.clone().addScaledVector(up, 1.0).addScaledVector(forward, 0.4);
    ctx.emit('angriff', { pos: p, dir: forward.clone(), reichweite: 2.5, schaden: 10 });
  }
  function werfen() {
    if (karte.offen || s.tot || s.cdWurf > 0) return;
    let kugel;
    try { kugel = ctx.spiel?.aktiveKugel?.(); } catch (e) {}
    if (kugel === undefined) kugel = 'kugel_holz';
    if (!kugel) { ctx.spiel?.toast?.('Keine Fangkugel! Crafte welche aus Holz und Faser.'); return; }
    s.cdWurf = 1;
    zurKamera();
    const farbe = ctx.DATA.KUGELN?.find(k => k.id === kugel)?.farbe;
    modell.wurf(farbe);
    s.wurfAusstehend = 0.2; s.wurfKugel = kugel;
    ui.fadenkreuzPuls();
  }
  function wurfAusloesen() {
    const hand = modell.hand.getWorldPosition(V3());
    // Zielpunkt: Kamerastrahl durchs Fadenkreuz bis zum Gelände (max. 40 m)
    const rd = camera.getWorldDirection(V3()), p = camera.position.clone(), q = V3();
    let aim = null;
    for (let t = 1; t <= 40; t += 0.5) {
      p.copy(camera.position).addScaledVector(rd, t);
      if (p.distanceTo(pos) < 1.5) continue;
      if (p.length() < bodenR(q.copy(p).normalize())) { aim = p; break; }
    }
    if (!aim) aim = camera.position.clone().addScaledVector(rd, 40);
    const dist = aim.distanceTo(hand);
    // leicht nach oben: Fallhöhe ausgleichen (Annahme Kugel ≈ 18 m/s, g ≈ 9.81, wie kreaturen.js)
    const t = dist / 18, hebung = THREE.MathUtils.clamp((9.81 * t / 2 - 1.2) / 18, 0.04, 0.35);
    const dir = aim.sub(hand).normalize().addScaledVector(up, hebung).normalize();
    ctx.emit('werfen', { pos: hand, dir, kugel: s.wurfKugel });
  }
  function sprung() {
    if (karte.offen || s.tot) return;
    s.sprungPuffer = 0.15;
  }
  function interagieren() {
    if (karte.offen || s.tot) return;
    const z = sucheZiel();
    if (z) { try { z.act?.(); } catch (e) { console.error('Interaktion', e); } s.zielT = 0; }
  }
  function reiten() {
    if (karte.offen || s.tot) return;
    faeh.reiten = fae('reiten');
    if (faeh.reiten > 0) { s.reitet = !s.reitet; }
    else { s.reitet = false; ctx.spiel?.toast?.('Du brauchst einen Begleiter, der reiten kann 🐎'); }
    ui.setReiten(faeh.reiten > 0, s.reitet);
  }
  function drehen(dx, dy, art) {
    if (karte.offen) {
      const k = 0.005 * Math.min(1, karte.dist / (3 * R));
      const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -dx * k);
      const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -dy * k);
      karte.q.multiply(qy).multiply(qx).normalize();
      return;
    }
    const k = art === 'touch' ? 0.0065 : 0.005;
    blick.applyAxisAngle(up, -dx * k);
    s.pitch = THREE.MathUtils.clamp(s.pitch + dy * k * 0.85, -0.55, 1.3);
  }
  function zoom(f) {
    if (karte.offen) karte.dist = THREE.MathUtils.clamp(karte.dist * f, KARTE_MIN, KARTE_MAX);
    else s.dist = THREE.MathUtils.clamp(s.dist * f, KAM_MIN, KAM_MAX);
  }

  function sucheZiel() {
    let best = null;
    for (const z of ctx.ziele) {
      let liste;
      try { liste = typeof z === 'function' ? z(pos) : z?.finde?.(pos); } catch (e) { continue; }
      if (!liste) continue;
      if (!Array.isArray(liste)) liste = [liste];
      for (const t of liste) if (t && t.dist < 3 && (!best || t.dist < best.dist)) best = t;
    }
    return best;
  }

  const ui = erstelleEingabe(ctx, { angriff, werfen, sprung, interagieren, reiten, karte: karteUmschalten, drehen, zoom });

  // ---------- Teleport / Speichern ----------
  function teleport(dir) {
    const d = (dir?.isVector3 ? dir.clone() : new THREE.Vector3().fromArray(dir || [0, 0, 1])).normalize();
    if (!isFinite(d.x) || d.lengthSq() < 0.5) d.copy(planet.spawnDir);
    const r = bodenR(d);
    pos.copy(d).multiplyScalar(Math.max(r, r < R - SCHWIMM_TIEFE ? SCHWIMM_HOEHE : r) + 0.05);
    up.copy(d);
    vel.set(0, 0, 0);
    tangential(blick, up, forward); tangential(forward, up, blick);
    s.amBoden = false; s.coyote = 0; kamZielInit = false; s.distIst = undefined;
  }
  teleport(planet.spawnDir);

  ctx.on('spieler:tod', e => {
    if (s.tot) return;
    s.respawn = e?.dir?.isVector3 ? e.dir.clone() : (Array.isArray(e?.dir) ? new THREE.Vector3().fromArray(e.dir) : null);
    s.tot = true; s.totT = 2.2; s.reitet = false;
    if (karte.offen) karteUmschalten();
  });

  // ---------- Update ----------
  const ziel = V3(), bewegung = V3(), rechts = V3(), vt = V3(), normal = V3(), hang = V3();
  const kamPos = V3(), blickRicht = V3();

  function update(dt) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.2);
    // Fähigkeiten (gecacht)
    if ((s.faehT -= dt) <= 0) {
      s.faehT = 0.5;
      for (const k in faeh) faeh[k] = fae(k);
      if (s.reitet && faeh.reiten <= 0) s.reitet = false;
      ui.setReiten(faeh.reiten > 0, s.reitet);
    }
    s.cdAngriff = Math.max(0, s.cdAngriff - dt); s.cdWurf = Math.max(0, s.cdWurf - dt);
    ui.setCooldown('angriff', s.cdAngriff / 0.5); ui.setCooldown('wurf', s.cdWurf);
    if (s.wurfAusstehend >= 0 && (s.wurfAusstehend -= dt) < 0) wurfAusloesen();
    if (s.tot && (s.totT -= dt) <= 0) {
      s.tot = false;
      let d = s.respawn; try { d = d || ctx.spiel?.respawnDir?.(); } catch (e) {}
      teleport(d || planet.spawnDir);
    }

    const n = Math.ceil(dt / 0.034);
    for (let i = 0; i < n; i++) physik(dt / n);

    // Biom
    if ((s.biomT -= dt) <= 0) {
      s.biomT = 0.5;
      let b = null; try { b = planet.biomeAt?.(up); } catch (e) {}
      if (b && b !== s.biom) { s.biom = b; ctx.emit('spieler:biom', { biom: b }); }
    }
    // Interaktionsziel
    if ((s.zielT -= dt) <= 0) {
      s.zielT = 0.15;
      s.ziel = (karte.offen || s.tot) ? null : sucheZiel();
      ui.setInteraktion(s.ziel ? (s.ziel.label || 'Benutzen') : null);
    }

    kamera(dt);
  }

  function physik(dt) {
    // Lokaler Rahmen (Paralleltransport, keine Pol-Singularität)
    up.copy(pos).normalize();
    tangential(blick, up, forward);
    tangential(forward, up, blick);
    rechts.crossVectors(blick, up);

    // Eingabe
    const ein = (karte.offen || s.tot) ? { x: 0, y: 0, sprint: false, sprungGehalten: false } : ui.lies();
    bewegung.copy(blick).multiplyScalar(ein.y).addScaledVector(rechts, ein.x);
    const eingabeStark = bewegung.length();

    // Boden / Wasser
    const gR = bodenR(up);
    const r = pos.length();
    const tiefe = R - gR;
    const schwimmGrenze = s.schwimmt ? SCHWIMM_TIEFE - 0.25 : SCHWIMM_TIEFE;
    s.schwimmt = tiefe > schwimmGrenze && r < R + (s.schwimmt ? 0.6 : 0.2);
    if (s.schwimmt && s.reitet) s.reitet = false;

    // Tempo
    let tempo = LAUF;
    if (s.reitet) tempo *= 1.5 + 0.25 * faeh.reiten;
    if (s.schwimmt) tempo = SCHWIMM * (1 + 0.6 * faeh.schwimmen);
    else if (tiefe > 0.35 && r < R) tempo *= 0.7; // waten
    let sprintet = false;
    if (ein.sprint && eingabeStark > 0.1 && (s.amBoden || s.schwimmt || s.reitet)) {
      const f = ctx.spiel?.verbraucheAusdauer;
      sprintet = typeof f === 'function' ? f.call(ctx.spiel, dt * (s.reitet ? 6 : 12)) !== false : true;
    }
    if (sprintet) tempo *= SPRINT;

    // Hang
    planet.normalAt(up, normal);
    if (!(normal.lengthSq() > 0.5)) normal.copy(up);
    const cosHang = normal.dot(up);
    const steil = s.amBoden && !s.schwimmt && cosHang < MAX_HANG && faeh.klettern <= 0;
    if (steil) {
      hang.copy(normal).addScaledVector(up, -cosHang).normalize(); // zeigt hangabwärts
      const d = bewegung.dot(hang);
      if (d < 0) bewegung.addScaledVector(hang, -d);                 // nicht hangauf laufen
    }
    ziel.copy(bewegung).multiplyScalar(tempo);

    // Geschwindigkeit zerlegen
    let vr = vel.dot(up);
    vt.copy(vel).addScaledVector(up, -vr);
    const steuer = (s.amBoden || s.schwimmt) ? 12 : (s.gleitet ? 2.5 : 2);
    vt.lerp(ziel, 1 - Math.exp(-steuer * dt));
    if (steil) vt.addScaledVector(hang, 14 * (1 - cosHang) * dt * 2.2);

    // Sprung
    s.sprungPuffer -= dt;
    s.coyote -= dt;
    if (s.sprungPuffer > 0) {
      if (s.amBoden || s.coyote > 0) { vr = s.reitet ? SPRUNG * 1.12 : SPRUNG; s.amBoden = false; s.coyote = 0; s.sprungPuffer = 0; }
      else if (s.schwimmt) { if (r > SCHWIMM_HOEHE - 0.3) { vr = 5.5; s.sprungPuffer = 0; s.schwimmt = false; } }
      else if (faeh.fliegen > 0 && !s.doppel) { vr = SPRUNG * 0.9; s.doppel = true; s.sprungPuffer = 0; }
    }

    // Vertikal
    s.gleitet = false;
    if (s.schwimmt) {
      // Auftrieb: Feder zur Schwimmhöhe
      vr += ((SCHWIMM_HOEHE - r) * 9 - vr * 4) * dt;
    } else {
      vr -= G * dt;
      if (faeh.fliegen > 0 && ein.sprungGehalten && !s.amBoden && vr < 0) {
        s.gleitet = true;
        vr = Math.max(vr, -(2.6 - 0.5 * Math.min(faeh.fliegen, 3)));
        if (eingabeStark > 0.1) vt.addScaledVector(bewegung, 3 * dt);
      }
    }
    vel.copy(vt).addScaledVector(up, vr);
    pos.addScaledVector(vel, dt);

    // Bodenkontakt
    const war = s.amBoden;
    tA.copy(pos).normalize();
    const gR2 = bodenR(tA), r2 = pos.length();
    if (r2 <= gR2) {
      pos.copy(tA).multiplyScalar(gR2);
      s.amBoden = true;
    } else if (war && vr <= 0.5 && !s.schwimmt && r2 - gR2 < 0.25 + vt.length() * dt * 1.5) {
      pos.copy(tA).multiplyScalar(gR2);  // bergab am Boden kleben
      s.amBoden = true;
    } else s.amBoden = false;
    if (s.amBoden) {
      const nUp = tA; const rad = vel.dot(nUp);
      if (rad < 0) vel.addScaledVector(nUp, -rad);
      s.doppel = false; s.coyote = 0.12;
    }
    if (s.schwimmt) s.amBoden = false;

    // Kollision mit Flora
    const kol = ctx.flora?.kollision;
    if (typeof kol === 'function') {
      let res = null;
      try { res = kol.call(ctx.flora, pos, s.reitet ? 0.7 : 0.4); } catch (e) {}
      if (res) {
        const v = res.isVector3 ? res : (res.push || res.korrektur || (typeof res.x === 'number' ? res : null));
        if (v && isFinite(v.x + v.y + v.z)) {
          tB.set(v.x, v.y, v.z);
          if (tB.length() > R * 0.5) tB.sub(pos);           // neue Position statt Push
          tB.addScaledVector(up, -tB.dot(up));             // nur seitlich schieben
          if (tB.lengthSq() < 4) {
            pos.add(tB);
            const n = tB.normalize(), d = vel.dot(n);
            if (d < 0) vel.addScaledVector(n, -d);         // am Hindernis entlanggleiten
          }
        }
      }
    }
    if (!isFinite(pos.x + pos.y + pos.z)) teleport(planet.spawnDir);

    up.copy(pos).normalize();
    s.inWasser = s.schwimmt || pos.length() < R - 0.2;

    // Blickrichtung der Figur
    vt.copy(vel).addScaledVector(up, -vel.dot(up));
    const tempoIst = vt.length();
    if (eingabeStark > 0.05 && s.cdAngriff < 0.3 && s.wurfAusstehend < 0) {
      tB.copy(bewegung).normalize();
      const winkel = Math.atan2(tC.crossVectors(forward, tB).dot(up), forward.dot(tB));
      forward.applyAxisAngle(up, winkel * (1 - Math.exp(-12 * dt)));
    }
    tangential(forward, up, blick);
    tangential(blick, up, forward);

    // Modell platzieren
    tC.crossVectors(up, forward);
    modell.gruppe.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tC, up, forward));
    modell.gruppe.position.copy(pos);
    modell.animiere(dt, { tempo: s.amBoden || s.schwimmt ? tempoIst : 0, amBoden: s.amBoden || (war && s.coyote > 0.05), schwimmt: s.schwimmt, reitet: s.reitet, gleitet: s.gleitet, tot: s.tot });

  }

  // ---------- Kamera ----------
  function kamera(dt) {
    // Third-Person
    const hoch = 2.25 + (s.reitet ? 0.7 : 0) - (s.schwimmt ? 0.6 : 0);
    tA.copy(pos).addScaledVector(up, hoch);
    if (!kamZielInit) { kamZiel.copy(tA); kamZielInit = true; }
    kamZiel.lerp(tA, 1 - Math.exp(-18 * dt));
    if (kamZiel.distanceToSquared(tA) > 25) kamZiel.copy(tA);
    blickRicht.copy(blick).multiplyScalar(Math.cos(s.pitch)).addScaledVector(up, -Math.sin(s.pitch));
    let d = s.dist;
    // Abstand verkürzen, wenn Gelände zwischen Spieler und Kamera
    for (let i = 0; i < 3; i++) {
      kamPos.copy(kamZiel).addScaledVector(blickRicht, -d * 0.5);
      tB.copy(kamPos).normalize();
      if (kamPos.length() < Math.max(bodenR(tB), R - 5) + 0.3) d *= 0.6; else break;
    }
    // verkürzen sofort, wieder ausfahren sanft
    s.distIst = Math.min(d, (s.distIst ?? d) + (d - (s.distIst ?? d)) * (1 - Math.exp(-4 * dt)));
    kamPos.copy(kamZiel).addScaledVector(blickRicht, -s.distIst);
    tB.copy(kamPos).normalize();
    const minR = Math.max(bodenR(tB), R) + 0.45;
    if (kamPos.length() < minR) kamPos.copy(tB).multiplyScalar(minR);
    kamTP.pos.copy(kamPos);
    // Orientierung per lookAt mit lokalem Oben
    camera.position.copy(kamPos); camera.up.copy(up); camera.lookAt(kamZiel);
    kamTP.quat.copy(camera.quaternion);

    // Karte überblenden
    karte.e = THREE.MathUtils.clamp(karte.e + (karte.offen ? dt : -dt) / 1.6, 0, 1);
    const e = karte.e * karte.e * (3 - 2 * karte.e);
    if (e > 0) {
      const kp = tC.set(0, 0, karte.dist).applyQuaternion(karte.q);
      const a = tA.copy(kamTP.pos).normalize(), b = tD.copy(kp).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(a, b);
      const qs = new THREE.Quaternion().slerp(q, e);
      const ra = kamTP.pos.length(), rb = karte.dist;
      const rr = ra * Math.pow(rb / ra, e);
      camera.position.copy(a).applyQuaternion(qs).multiplyScalar(rr);
      camera.quaternion.copy(kamTP.quat).slerp(karte.q, Math.min(1, e * 1.25));
      camera.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    }
    const near = e > 0.02 ? 0.1 + e * 6 : 0.1;
    if (Math.abs(camera.near - near) > 1e-3) { camera.near = near; camera.updateProjectionMatrix(); }

    // Marker
    marker.visible = e > 0.02;
    if (marker.visible) {
      const cd = camera.position.distanceTo(pos), sk = Math.max(0.1, cd / 600);
      const L = Math.min(0.22 * R, cd * 0.1);
      // Auf der Rückseite des Planeten: blasser
      const sicht = tB.subVectors(camera.position, pos).normalize().dot(up) > -0.05 ? 1 : 0.3;
      marker.position.copy(pos);
      tC.crossVectors(up, forward);
      marker.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tC, up, forward));
      const puls = 1 + 0.25 * Math.sin(ctx.zeit.t * 5), welle = (ctx.zeit.t * 0.8) % 1;
      mKugel.scale.setScalar(7 * sk * puls);
      mStrahl.scale.set(1.6 * sk, L, 1.6 * sk);
      mPfeil.position.y = L + 4 * sk; mPfeil.scale.setScalar(6 * sk);
      mRing.scale.setScalar(6 * sk * (1 + welle * 2));
      mRing.material.opacity = e * sicht * (1 - welle);
      mRicht.scale.setScalar(4 * sk);
      for (const m of [mKugel, mStrahl, mPfeil, mRicht]) m.material.opacity = e * sicht;
    }
    modell.gruppe.visible = e < 0.9;
  }

  // ---------- Öffentliche API ----------
  const api = {
    pos, up, forward, vel, blick,
    get inWasser() { return s.inWasser; },
    get schwimmt() { return s.schwimmt; },
    get amBoden() { return s.amBoden; },
    get reitet() { return s.reitet; },
    set reitet(v) { s.reitet = !!v && faeh.reiten > 0; },
    get gleitet() { return s.gleitet; },
    get karteOffen() { return karte.offen; },
    get biom() { return s.biom; },
    get tot() { return s.tot; },
    modell: modell.gruppe,
    teleport,
    karte: karteUmschalten,
    zielRichtung() { return camera.getWorldDirection(V3()); },
    update,
    save() {
      const d = pos.clone().normalize();
      return { dir: d.toArray().map(v => +v.toFixed(5)), fwd: blick.toArray().map(v => +v.toFixed(4)), pitch: +s.pitch.toFixed(3), dist: +s.dist.toFixed(2) };
    },
    load(d) {
      if (!d || !Array.isArray(d.dir)) return;
      if (Array.isArray(d.fwd)) { blick.fromArray(d.fwd); forward.fromArray(d.fwd); }
      teleport(d.dir);
      if (isFinite(d.pitch)) s.pitch = d.pitch;
      if (isFinite(d.dist)) s.dist = THREE.MathUtils.clamp(d.dist, KAM_MIN, KAM_MAX);
    },
  };
  // Startblick: irgendeine Tangente am Spawn
  tangential(blick.set(1, 0, 0), up); forward.copy(blick);
  return api;
}
