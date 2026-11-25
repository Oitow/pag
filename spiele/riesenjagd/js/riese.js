// Riesenjagd – die Riesen (Moostroll 18 m, Zyklop 24 m): Fels-Haut aus verbeulten Kapseln an einem Knochen-Gerüst, prozeduraler Gang,
// Angriffe (Hieb, Stampfer, Abschütteln, Brüllen), Taumeln, Knien, Tod. Jeder Körperteil ist eine Kapsel: daran kann man klettern,
// sie wird vom Haken getroffen und schiebt den Helden weg. Leuchtende Runen = Schwachpunkte (Nacken, Kniekehlen, beim Zyklop das Auge).
import * as THREE from 'three';
import { rng, hashSeed } from '../../../engine/core/rng.js';
import { createNoise3D } from '../../../engine/core/noise.js';

export const ARTEN = Object.freeze({
  troll: { name: 'Moostroll', hp: 480, skala: 1.3, buckel: 0.5, haut: [0.34, 0.35, 0.29], moos: [0.17, 0.23, 0.1], augen: 2, hauer: true, tempo: 2.2, jagdTempo: 3.6, rune: 0xffa24a, sicht: 80 },
  zyklop: { name: 'Zyklop', hp: 720, skala: 1.7, buckel: 0.16, haut: [0.48, 0.4, 0.34], moos: [0.24, 0.22, 0.14], augen: 1, hauer: false, tempo: 1.9, jagdTempo: 3.1, rune: 0x8ad6ff, sicht: 95 },
});

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const huegel = (t) => Math.sin(Math.PI * clamp(t, 0, 1));
const glatt = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Verbeulte Fels-Kapsel von a nach b (Knochen-Raum), flach schattiert, Moos oben. */
function steinKapsel(a, b, r, art, seed, rau = 0.16) {
  const len = Math.max(0.01, a.distanceTo(b));
  let g = new THREE.CapsuleGeometry(r, len, 3, 9).toNonIndexed();
  const n3 = createNoise3D(seed), p = g.attributes.position, nrm = new THREE.Vector3(), q = new THREE.Vector3();
  g.computeVertexNormals();
  const N = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    q.set(p.getX(i), p.getY(i), p.getZ(i));
    const d = n3(q.x * 0.55 + seed, q.y * 0.55, q.z * 0.55) * 0.7 + n3(q.x * 1.6, q.y * 1.6 + seed, q.z * 1.6) * 0.3;
    nrm.set(N.getX(i), N.getY(i), N.getZ(i));
    q.addScaledVector(nrm, d * r * rau);
    p.setXYZ(i, q.x, q.y, q.z);
  }
  const dir = b.clone().sub(a).normalize(), quat = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir);
  g.applyQuaternion(quat); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  g = g.toNonIndexed(); g.computeVertexNormals();
  const P = g.attributes.position, NN = g.attributes.normal, farbe = new Float32Array(P.count * 3), zr = rng(seed);
  for (let i = 0; i < P.count; i += 3) {
    const ny = (NN.getY(i) + NN.getY(i + 1) + NN.getY(i + 2)) / 3, moos = clamp((ny - 0.25) * 2.2, 0, 1) * (0.6 + zr() * 0.4), j = 0.8 + zr() * 0.4;
    for (let k = 0; k < 3; k++) {
      farbe[(i + k) * 3] = lerp(art.haut[0], art.moos[0], moos) * j;
      farbe[(i + k) * 3 + 1] = lerp(art.haut[1], art.moos[1], moos) * j;
      farbe[(i + k) * 3 + 2] = lerp(art.haut[2], art.moos[2], moos) * j;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(farbe, 3));
  return g;
}

/** opts: { szene, art: 'troll'|'zyklop', pos {x,z}, seed, welt } → Riese */
export function createRiese({ szene, art: artName = 'troll', pos, seed = 1, welt, schatten = true }) {
  const art = ARTEN[artName], S = art.skala, zr = rng(hashSeed('riese', seed));
  const haut = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  const root = new THREE.Group(); root.name = art.name; root.scale.setScalar(S);
  const knochen = {};
  const kn = (name, eltern, x, y, z) => { const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); (eltern ? knochen[eltern] : root).add(g); knochen[name] = g; return g; };
  const teile = [];
  let sn = seed * 17;
  const teil = (name, k, a, b, r, opts = {}) => {
    const m = new THREE.Mesh(steinKapsel(a, b, r, art, sn++, opts.rau ?? 0.16), haut); m.castShadow = schatten; m.receiveShadow = true;
    knochen[k].add(m);
    if (opts.klettern !== false) teile.push({ name, knochen: knochen[k], a, b, r, aw: new THREE.Vector3(), bw: new THREE.Vector3(), rw: r * S });
    return m;
  };

  // --- Gerüst (Ruhe: steht, Blick +z) ---
  kn('huefte', null, 0, 7.6, 0);
  kn('rumpf', 'huefte', 0, 0.5, 0);
  kn('nacken', 'rumpf', 0, 7.4, 0.5);
  kn('kopf', 'nacken', 0, 1.5, 0.7);
  kn('kiefer', 'kopf', 0, 0.1, 0.9);
  for (const [s, x] of [['L', 1], ['R', -1]]) {
    kn('schulter' + s, 'rumpf', 3.1 * x, 6.6, -0.2);
    kn('ellbogen' + s, 'schulter' + s, 0, -5.8, 0);
    kn('hand' + s, 'ellbogen' + s, 0, -5.3, 0);
    kn('bein' + s, 'huefte', 1.9 * x, -0.5, 0);
    kn('knie' + s, 'bein' + s, 0, -3.6, 0);
    kn('fuss' + s, 'knie' + s, 0, -3.4, 0);
  }
  teil('becken', 'huefte', V(-1.7, 0, 0), V(1.7, 0, 0), 2.5);
  teil('bauch', 'rumpf', V(0, 0, 0.2), V(0, 3.8, 0.5), 3.0);
  teil('brust', 'rumpf', V(0, 3.6, 0), V(0, 7.0, -0.5), 3.5);
  teil('schultern', 'rumpf', V(-2.9, 6.5, -0.3), V(2.9, 6.5, -0.3), 1.9);
  teil('hals', 'nacken', V(0, -0.2, 0), V(0, 1.4, 0.6), 1.55);
  teil('kopf', 'kopf', V(0, 0.3, 0.2), V(0, 0.9, 1.0), 1.65, { rau: 0.2 });
  teil('kiefer', 'kiefer', V(-0.6, -0.4, 0.2), V(0.6, -0.4, 0.2), 0.9, { klettern: false });
  for (const s of ['L', 'R']) {
    teil('oberarm' + s, 'schulter' + s, V(0, 0, 0), V(0, -5.8, 0), 1.35);
    teil('unterarm' + s, 'ellbogen' + s, V(0, 0, 0), V(0, -5.3, 0), 1.2);
    teil('faust' + s, 'hand' + s, V(0, -0.4, 0), V(0, -1.3, 0.3), 1.45, { rau: 0.22 });
    teil('oberschenkel' + s, 'bein' + s, V(0, 0, 0), V(0, -3.6, 0), 1.75);
    teil('unterschenkel' + s, 'knie' + s, V(0, 0, 0), V(0, -3.4, 0), 1.4);
    teil('fuss' + s, 'fuss' + s, V(0, -0.15, -0.4), V(0, -0.2, 1.5), 0.85);
  }
  // Gesicht: Augen leuchten, Nase, Hauer, Moos-Büschel auf dem Buckel
  const augeMat = new THREE.MeshBasicMaterial({ color: art.augen === 1 ? 0xffe8a0 : 0xffc040 });
  const augen = [];
  const augPos = art.augen === 1 ? [[0, 0.95, 2.45, 0.62]] : [[0.62, 0.95, 2.3, 0.24], [-0.62, 0.95, 2.3, 0.24]];
  for (const [x, y, z, r] of augPos) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), augeMat); m.position.set(x, y, z); knochen.kopf.add(m); augen.push(m); }
  if (art.augen === 2) { const nase = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.5, 5), haut); nase.position.set(0, 0.6, 2.6); nase.rotation.x = 1.8; knochen.kopf.add(nase); }
  if (art.hauer) for (const x of [0.55, -0.55]) {
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.3, 5), new THREE.MeshStandardMaterial({ color: 0xb8ab88, flatShading: true, roughness: 0.7 }));
    h.position.set(x, -0.1, 0.9); h.rotation.set(-0.3, 0, -x * 0.3); knochen.kiefer.add(h);
  }
  const moosMat = new THREE.MeshStandardMaterial({ color: 0x24301a, flatShading: true, roughness: 1 });
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.4 + zr() * 0.5, 1.2 + zr() * 1.8, 4), moosMat);
    const w = (zr() - 0.5) * 2.2, h = 3.5 + zr() * 3.6;
    c.position.set(Math.sin(w) * 3.3, h, -Math.cos(w) * 3.3); c.rotation.set(-0.9 + zr() * 0.4, 0, w * 0.5);
    knochen.rumpf.add(c);
  }

  // --- Schwachpunkte (Runen) ---
  const runeMat = new THREE.MeshBasicMaterial({ color: art.rune, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  runeMat.userData.psx = false;
  const schwach = [];
  const rune = (name, k, lokal, radius, mult, normal) => {
    const g = new THREE.Group(); g.position.copy(lokal); knochen[k].add(g);
    const kern = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), runeMat); g.add(kern);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.12, 4, 12), runeMat); ring.lookAt(normal); g.add(ring);
    g.userData.psx = false;
    schwach.push({ name, knochen: knochen[k], lokal, radius: radius * S, mult, g, kern, ring, welt: new THREE.Vector3(), schaden: 0, gebrochen: 0 });
  };
  rune('Nacken', 'rumpf', V(0, 6.6, -3.65), 3.0, 2.5, V(0, 0.4, -1));
  rune('Kniekehle', 'knieL', V(0, -0.4, -1.4), 2.3, 1.6, V(0, 0, -1));
  rune('Kniekehle', 'knieR', V(0, -0.4, -1.4), 2.3, 1.6, V(0, 0, -1));
  if (art.augen === 1) rune('Auge', 'kopf', V(0, 0.95, 2.75), 1.9, 4, V(0, 0, 1));
  szene.add(root);

  // --- Zustand ---
  const z = {
    x: pos.x, z: pos.z, yaw: zr() * 6.28, tempo: 0, phase: 0, hp: art.hp, max: art.hp,
    modus: 'wandern', ziel: null, aktion: null, at: 0, abkling: 0, bemerkt: false, kletterZeit: 0, tot: false, tod: 0, totUhr: 0, wut: 0,
  };
  const pose = {};
  const ereignisse = [];
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

  function setzePose(dt) {
    const w = clamp(z.tempo / art.jagdTempo, 0, 1.2), f = z.phase, b = art.buckel;
    const P = {
      hy: 7.6 - 0.28 * w * Math.abs(Math.cos(f)), rx: b + 0.05 * w, rz: Math.sin(f) * 0.04 * w, ry: Math.sin(f) * 0.08 * w, nx: -b * 0.7, ny: 0, kiefer: 0.05,
      oaL: -b + Math.sin(f) * 0.38 * w, oaR: -b - Math.sin(f) * 0.38 * w, ozL: 0.14, ozR: -0.14, ebL: -0.3, ebR: -0.3,
      bL: -Math.sin(f) * 0.45 * w, bR: Math.sin(f) * 0.45 * w, kL: 0.12 + Math.max(0, Math.cos(f)) * 0.6 * w, kR: 0.12 + Math.max(0, -Math.cos(f)) * 0.6 * w, fall: 0,
    };
    // Blick zum Helden
    if (z.blick) { const d = Math.atan2(z.blick.x - z.x, z.blick.z - z.z) - z.yaw; P.ny = clamp(Math.atan2(Math.sin(d), Math.cos(d)), -0.9, 0.9); }
    const A = z.aktion, t = z.at;
    if (A) {
      const ein = glatt(t / 0.25) * glatt((A.dauer - t) / 0.35);
      const Z = {};
      if (A.art === 'hieb') {
        const s = A.seite, auf = glatt(t / 0.85), schlag = glatt((t - 0.85) / 0.3);
        Z.ry = 0.18 * s * auf * (1 - schlag); Z.rx = b + lerp(-0.25 * auf, 0.55, schlag);
        const oa = lerp(lerp(-b, -3.0, auf), -1.2, schlag), oz = 0.22 * s;
        if (s > 0) { Z.oaL = oa; Z.ozL = oz; Z.ebL = lerp(-0.7, -0.1, schlag); } else { Z.oaR = oa; Z.ozR = -oz; Z.ebR = lerp(-0.7, -0.1, schlag); }
        Z.kiefer = 0.4 * schlag;
      } else if (A.art === 'stampf') {
        const s = A.seite, auf = glatt(t / 0.9), schlag = glatt((t - 0.9) / 0.15);
        const bb = lerp(lerp(0, -1.15, auf), -0.25, schlag), kk = lerp(lerp(0.12, 1.4, auf), 0.15, schlag);
        if (s > 0) { Z.bL = bb; Z.kL = kk; } else { Z.bR = bb; Z.kR = kk; }
        Z.rx = b - 0.18 * auf * (1 - schlag) + 0.15 * schlag; Z.hy = 7.6 - 0.4 * schlag;
        Z.ozL = 0.5 * auf; Z.ozR = -0.5 * auf;
      } else if (A.art === 'schuetteln') {
        const e = huegel(t / A.dauer);
        Z.rz = Math.sin(t * 13) * 0.34 * e; Z.ry = Math.sin(t * 9.5) * 0.3 * e; Z.rx = b + Math.sin(t * 11) * 0.18 * e; Z.hy = 7.6 + Math.sin(t * 22) * 0.25 * e;
        Z.ozL = 0.5 + Math.sin(t * 12) * 0.5 * e; Z.ozR = -0.5 - Math.sin(t * 12 + 1) * 0.5 * e; Z.oaL = -b - 0.8 * e; Z.oaR = -b - 0.8 * e; Z.kiefer = 0.5 * e;
      } else if (A.art === 'bruellen') {
        const e = huegel(t / A.dauer);
        Z.nx = -b * 0.7 - 0.75 * e; Z.kiefer = 0.75 * e; Z.ozL = 0.14 + 0.9 * e; Z.ozR = -0.14 - 0.9 * e; Z.rx = b - 0.25 * e; Z.oaL = Z.oaR = -b - 0.5 * e;
      } else if (A.art === 'taumeln') {
        const e = huegel(t / A.dauer);
        Z.rx = b - 0.45 * e; Z.nx = -b * 0.7 - 0.5 * e; Z.oaL = Z.oaR = -b - 1.4 * e; Z.ozL = 0.7 * e; Z.ozR = -0.7 * e; Z.kiefer = 0.6 * e;
      } else if (A.art === 'knien') {
        const e = glatt(t / 0.6) * glatt((A.dauer - t) / 0.8);
        Z.hy = lerp(7.6, 4.3, e); Z.rx = b + 0.42 * e; Z.bL = -1.25 * e; Z.kL = 1.5 * e; Z.bR = 0.35 * e; Z.kR = 1.9 * e; Z.oaL = Z.oaR = -b - 0.85 * e; Z.ebL = Z.ebR = -0.1;
        Z.nx = -b * 0.7 + 0.2 * e;
      }
      for (const k in Z) P[k] = lerp(P[k], Z[k], A.art === 'knien' ? 1 : ein);
    }
    if (z.tot) { const e = glatt(z.tod / 3.2); P.fall = e * 1.42; P.rx = lerp(P.rx, 0.2, e); P.kiefer = 0.6; }
    // anwenden
    knochen.huefte.position.y = P.hy;
    knochen.rumpf.rotation.set(P.rx, P.ry, P.rz);
    knochen.nacken.rotation.set(P.nx, P.ny, 0);
    knochen.kiefer.rotation.x = P.kiefer;
    knochen.schulterL.rotation.set(P.oaL, 0, P.ozL); knochen.schulterR.rotation.set(P.oaR, 0, P.ozR);
    knochen.ellbogenL.rotation.x = P.ebL; knochen.ellbogenR.rotation.x = P.ebR;
    knochen.beinL.rotation.x = P.bL; knochen.beinR.rotation.x = P.bR;
    knochen.knieL.rotation.x = P.kL; knochen.knieR.rotation.x = P.kR;
    knochen.fussL.rotation.x = -(P.bL + P.kL) * 0.8; knochen.fussR.rotation.x = -(P.bR + P.kR) * 0.8;
    root.position.set(z.x, (welt ? welt.gelaende(z.x, z.z) : 0) - 0.1 - P.fall * 0.9, z.z);
    root.rotation.set(P.fall, z.yaw, 0, 'YXZ');
    root.updateMatrixWorld(true);
    for (const t of teile) { t.aw.copy(t.a).applyMatrix4(t.knochen.matrixWorld); t.bw.copy(t.b).applyMatrix4(t.knochen.matrixWorld); }
    for (const s of schwach) {
      s.welt.copy(s.lokal).applyMatrix4(s.knochen.matrixWorld);
      const puls = 1 + Math.sin(performance.now() * 0.006 + s.lokal.x) * 0.18;
      s.g.scale.setScalar(s.gebrochen > 0 ? 0.4 : puls); s.g.visible = !z.tot;
      s.kern.rotation.y += dt * 2;
    }
  }

  function starte(artName2, dauer, extra = {}) { z.aktion = { art: artName2, dauer, ...extra, getroffen: false }; z.at = 0; }

  /** Nächster Punkt auf einem Teil: → { teil, punkt (Oberfläche + abstand), normale, d (Abstand zur Oberfläche) } */
  const qa = new THREE.Vector3(), qn = new THREE.Vector3(), sp = new THREE.Vector3();
  function flaeche(p, abstand = 0, nur = null) {
    let best = null;
    for (const t of nur ? [nur] : teile) {
      tmp.subVectors(t.bw, t.aw); const L2 = tmp.lengthSq();
      const u = L2 > 0 ? clamp(tmp2.subVectors(p, t.aw).dot(tmp) / L2, 0, 1) : 0;
      qa.copy(t.aw).addScaledVector(tmp, u);
      qn.subVectors(p, qa); const d = qn.length();
      const dO = d - t.rw;
      if (!best || dO < best.d) {
        if (d < 1e-4) qn.set(0, 1, 0); else qn.divideScalar(d);
        best = { teil: t, u, d: dO, normale: qn.clone(), punkt: qa.clone().addScaledVector(qn, t.rw + abstand) };
      }
    }
    return best;
  }

  /** Strahl gegen die Kapseln → { t, x, y, z, teil } | null */
  function strahl(von, r, maxT = 95) {
    if (z.tot && z.tod > 3) return null;
    const dx = z.x - von.x, dz = z.z - von.z;
    if (Math.hypot(dx, dz) > maxT + 25 * S) return null;
    for (let t = 0; t <= maxT; t += 0.9) {
      sp.set(von.x + r.x * t, von.y + r.y * t, von.z + r.z * t);
      const f = flaeche(sp);
      if (f && f.d <= 0) return { t, x: sp.x, y: sp.y, z: sp.z, teil: f.teil, riese: api };
    }
    return null;
  }

  function schade(menge, { schwachpunkt = null, stagger = false, quelle = 'klinge' } = {}) {
    if (z.tot) return 0;
    const m = schwachpunkt ? schwachpunkt.mult : 1, wert = Math.round(menge * m);
    z.hp = Math.max(0, z.hp - wert); z.wut += wert; z.bemerkt = true;
    if (schwachpunkt) {
      schwachpunkt.schaden += wert;
      if (schwachpunkt.name === 'Kniekehle' && schwachpunkt.schaden >= 50 && schwachpunkt.gebrochen <= 0) { schwachpunkt.gebrochen = 18; schwachpunkt.schaden = 0; starte('knien', 7); ereignisse.push({ typ: 'knien', riese: api }); }
      else if (!z.aktion || z.aktion.art === 'wandern') starte('schuetteln', 2.4);
    }
    if (stagger && z.aktion?.art !== 'knien') starte('taumeln', 2.2);
    if (z.hp <= 0) { z.tot = true; z.aktion = null; z.tod = 0; ereignisse.push({ typ: 'tod', riese: api, pos: { x: z.x, y: root.position.y, z: z.z } }); }
    return wert;
  }

  let schrittVorher = 0;
  function update(dt, held) {
    ereignisse.length = 0;
    if (z.tot) { z.tod += dt; z.totUhr += dt; if (z.tod > 3.1 && z.tod - dt <= 3.1) ereignisse.push({ typ: 'aufprall', pos: { x: z.x + Math.sin(z.yaw) * 12 * S, y: root.position.y, z: z.z + Math.cos(z.yaw) * 12 * S }, staerke: 2.2 * S }); setzePose(dt); return ereignisse; }
    for (const s of schwach) if (s.gebrochen > 0) s.gebrochen -= dt;
    const hp = held.pos, dx = hp.x - z.x, dz = hp.z - z.z, dist = Math.hypot(dx, dz), aufMir = held.kletterRiese === api;
    if (!z.bemerkt && (dist < art.sicht || aufMir)) { z.bemerkt = true; starte('bruellen', 1.8); ereignisse.push({ typ: 'bruellen', pos: { x: z.x, y: root.position.y + 16 * S, z: z.z } }); }
    if (z.bemerkt && dist > art.sicht * 2.2 && !aufMir) z.bemerkt = false;
    z.blick = z.bemerkt && !held.tot ? hp : null;
    z.kletterZeit = aufMir ? z.kletterZeit + dt : Math.max(0, z.kletterZeit - dt * 2);
    z.abkling -= dt;

    // Aktion läuft
    if (z.aktion) {
      const A = z.aktion; z.at += dt;
      const ziel = A.art === 'taumeln' ? -1.4 : A.art === 'knien' ? 0 : 0.2;
      z.tempo = lerp(z.tempo, ziel, 1 - Math.exp(-4 * dt));
      if (A.art === 'hieb' && z.at > 0.95) {
        const hand = teile.find((t) => t.name === (A.seite > 0 ? 'faustL' : 'faustR'));
        const arm = teile.find((t) => t.name === (A.seite > 0 ? 'unterarmL' : 'unterarmR'));
        if (!A.getroffen && z.at < 1.3 && !aufMir) for (const t of [hand, arm]) {
          const f = flaeche(hp, 0, t);
          if (f && f.d < 2.6) { A.getroffen = true; ereignisse.push({ typ: 'treffer', schaden: 34, stoss: { x: f.normale.x * 18 + Math.sin(z.yaw) * 6, y: 9, z: f.normale.z * 18 + Math.cos(z.yaw) * 6 } }); break; }
        }
        if (z.at > 1.05 && !A.wumms) { A.wumms = true; ereignisse.push({ typ: 'zisch', pos: hand.aw.clone() }); }
        if (z.at > 1.15 && !A.boden) {   // Faust schlägt nahe am Boden ein → Druckwelle
          A.boden = true; const b = welt ? welt.gelaende(hand.bw.x, hand.bw.z) : 0;
          if (hand.bw.y - b < 5 * S) ereignisse.push({ typ: 'stoss', pos: { x: hand.bw.x, y: b, z: hand.bw.z }, radius: 7 * S, schaden: A.getroffen ? 0 : 20, staerke: 0.9 * S });
        }
      }
      if (A.art === 'stampf' && !A.getroffen && z.at >= 1.05) {
        A.getroffen = true;
        const f = (A.seite > 0 ? teile.find((t) => t.name === 'fussL') : teile.find((t) => t.name === 'fussR')).aw;
        ereignisse.push({ typ: 'stoss', pos: { x: f.x, y: (welt ? welt.gelaende(f.x, f.z) : 0), z: f.z }, radius: 12 * S, schaden: 24, staerke: 1.4 * S });
      }
      if (A.art === 'schuetteln' && aufMir) ereignisse.push({ typ: 'schuetteln', staerke: huegel(z.at / A.dauer) });
      if (z.at >= A.dauer) { z.aktion = null; z.abkling = A.art === 'bruellen' ? 0.3 : A.art === 'schuetteln' ? 4.5 + zr() * 2 : 1.2 + zr() * 1.2; }
    } else {
      // Entscheiden
      let wunsch = null, tempoZiel = art.tempo;
      if (z.bemerkt && !held.tot) {
        wunsch = { x: hp.x, z: hp.z }; tempoZiel = dist < 7.5 * S ? 0.2 : art.jagdTempo;
        if (z.abkling <= 0) {
          const vorne = Math.cos(Math.atan2(dx, dz) - z.yaw), hoeheRel = hp.y - root.position.y;
          if (aufMir && z.kletterZeit > 3) { starte('schuetteln', 2.6); }
          else if (!aufMir && dist < 8.5 * S && held.amBoden) {
            const seite = (dx * Math.cos(z.yaw) - dz * Math.sin(z.yaw)) > 0 ? 1 : -1; starte('stampf', 1.9, { seite });
          } else if (!aufMir && dist < 11.5 * S && vorne > 0.5 && hoeheRel < 14 * S) {
            const seite = (dx * Math.cos(z.yaw) - dz * Math.sin(z.yaw)) > 0 ? 1 : -1; starte('hieb', 2.1, { seite });
          }
        }
      } else {
        if (!z.ziel || Math.hypot(z.ziel.x - z.x, z.ziel.z - z.z) < 8) z.ziel = welt ? welt.zufallsPunkt(zr, { x: z.x, z: z.z }, 110) : { x: (zr() - 0.5) * 100, z: (zr() - 0.5) * 100 };
        wunsch = z.ziel;
      }
      if (aufMir && !z.aktion) tempoZiel = Math.min(tempoZiel, 1.2);
      if (wunsch) {
        let rx = wunsch.x - z.x, rz = wunsch.z - z.z; const d = Math.hypot(rx, rz) || 1; rx /= d; rz /= d;
        if (welt) for (const s of welt.stamme) {   // Stämmen ausweichen
          const ax = z.x - s.x, az = z.z - s.z, ad = Math.hypot(ax, az), frei = s.R * 1.3 + 4 * S;
          if (ad < frei + 8) { const k = (frei + 8 - ad) / 8; rx += ax / ad * k; rz += az / ad * k; }
        }
        const zielYaw = Math.atan2(rx, rz); let dy = zielYaw - z.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        z.yaw += clamp(dy, -0.9 * dt, 0.9 * dt);
        tempoZiel *= clamp(1 - Math.abs(dy) / 2, 0.25, 1);
      }
      z.tempo = lerp(z.tempo, tempoZiel, 1 - Math.exp(-1.6 * dt));
    }
    // Bewegen
    z.x += Math.sin(z.yaw) * z.tempo * dt; z.z += Math.cos(z.yaw) * z.tempo * dt;
    if (welt) { const p = welt.stammStoss(z.x, welt.gelaende(z.x, z.z) + 4, z.z, 3.2 * S); if (p) { z.x = p.x; z.z = p.z; } }
    z.phase += Math.abs(z.tempo) * dt / (2.9 * S) * Math.PI;
    const schritt = Math.floor(z.phase / Math.PI);
    if (schritt !== schrittVorher && Math.abs(z.tempo) > 0.4) {
      schrittVorher = schritt;
      const f = teile.find((t) => t.name === (schritt % 2 ? 'fussL' : 'fussR')).aw;
      ereignisse.push({ typ: 'schritt', pos: { x: f.x, y: welt ? welt.gelaende(f.x, f.z) : 0, z: f.z }, staerke: 0.5 * S });
    }
    setzePose(dt);
    // Held vom Körper schieben (Beine, Füße) – nur wenn er nicht klettert
    if (!aufMir && !held.tot) {
      const f = flaeche(hp, 0);
      if (f && f.d < 0.45) ereignisse.push({ typ: 'schieben', punkt: f.punkt.clone().addScaledVector(f.normale, 0.45), normale: f.normale.clone() });
    }
    return ereignisse;
  }

  const api = {
    art, root, teile, schwach, zustand: z, knochen,
    get pos() { return root.position; },
    get lebt() { return !z.tot; },
    get name() { return art.name; },
    get torso() { return teile[2].aw.clone().lerp(teile[2].bw, 0.5); },
    update, flaeche, strahl, schade,
    naechsterSchwachpunkt(p) { let best = null; for (const s of schwach) { if (s.gebrochen > 0 || z.tot) continue; const d = s.welt.distanceTo(p); if (!best || d < best.d) best = { s, d }; } return best; },
    wegnehmen() { szene.remove(root); root.traverse((o) => { o.geometry?.dispose(); }); haut.dispose(); },
  };
  setzePose(0);
  return api;
}
