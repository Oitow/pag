// Riesenjagd – Effekte: Partikel (Staub, Funken, Gas, Riesenblut, Glut), Druckwellen-Ringe am Boden, Lichtblitze und der Großzauber „Sternenfall“.
import * as THREE from 'three';

const VERT = `
attribute vec3 farbe; attribute float groesse; attribute float alpha;
uniform float uSkala; varying vec3 vFarbe; varying float vAlpha; varying float vTiefe;
void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vTiefe = -mv.z; vFarbe = farbe; vAlpha = alpha;
  gl_PointSize = clamp(groesse * uSkala / max(0.5, -mv.z), 1.0, 160.0); gl_Position = projectionMatrix * mv; }`;
const FRAG = `
uniform vec3 uNebel; uniform float uDichte; varying vec3 vFarbe; varying float vAlpha; varying float vTiefe;
void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d); if (r > 0.25) discard;
  float a = vAlpha * smoothstep(0.25, 0.08, r); float f = 1.0 - exp(-uDichte*uDichte*vTiefe*vTiefe);
  gl_FragColor = vec4(mix(vFarbe, uNebel, f), a * (1.0 - f*0.7)); }`;

/** Partikel-Pool. opts: { max, additiv, nebel, dichte } */
export function createPartikel({ szene, max = 2500, additiv = false, nebel = 0x46524e, dichte = 0.0068 }) {
  const pos = new Float32Array(max * 3), farbe = new Float32Array(max * 3), groesse = new Float32Array(max), alpha = new Float32Array(max);
  const vel = new Float32Array(max * 3), leben = new Float32Array(max), dauer = new Float32Array(max), start = new Float32Array(max), wachs = new Float32Array(max), schwere = new Float32Array(max), aStart = new Float32Array(max);
  const g = new THREE.BufferGeometry();
  const attr = (n, a, k) => { const b = new THREE.BufferAttribute(a, k); b.setUsage(THREE.DynamicDrawUsage); g.setAttribute(n, b); return b; };
  const aPos = attr('position', pos, 3), aFarbe = attr('farbe', farbe, 3), aGr = attr('groesse', groesse, 1), aAl = attr('alpha', alpha, 1);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: additiv ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uSkala: { value: 500 }, uNebel: { value: new THREE.Color(nebel) }, uDichte: { value: dichte } },
  });
  mat.userData.psx = false;
  const punkte = new THREE.Points(g, mat); punkte.frustumCulled = false; punkte.userData.psx = false; punkte.renderOrder = additiv ? 3 : 2;
  szene.add(punkte);
  let naechster = 0;
  const c = new THREE.Color();
  /** o: { pos, streu, vel {x,y,z}, velStreu, leben, groesse, farbe, schwere, wachsen, alpha } */
  function emit(n, o) {
    c.set(o.farbe ?? 0xffffff);
    for (let k = 0; k < n; k++) {
      const i = naechster; naechster = (naechster + 1) % max;
      const s = o.streu ?? 0, vs = o.velStreu ?? 0;
      pos[i * 3] = o.pos.x + (Math.random() - 0.5) * 2 * s; pos[i * 3 + 1] = o.pos.y + (Math.random() - 0.5) * 2 * s * (o.streuY ?? 1); pos[i * 3 + 2] = o.pos.z + (Math.random() - 0.5) * 2 * s;
      vel[i * 3] = (o.vel?.x ?? 0) + (Math.random() - 0.5) * 2 * vs; vel[i * 3 + 1] = (o.vel?.y ?? 0) + (Math.random() - 0.5) * 2 * vs * (o.velStreuY ?? 1); vel[i * 3 + 2] = (o.vel?.z ?? 0) + (Math.random() - 0.5) * 2 * vs;
      const j = 0.85 + Math.random() * 0.3;
      farbe[i * 3] = c.r * j; farbe[i * 3 + 1] = c.g * j; farbe[i * 3 + 2] = c.b * j;
      dauer[i] = leben[i] = (o.leben ?? 1) * (0.7 + Math.random() * 0.6);
      start[i] = (o.groesse ?? 1) * (0.7 + Math.random() * 0.6); wachs[i] = o.wachsen ?? 0; schwere[i] = o.schwere ?? 0; aStart[i] = o.alpha ?? 0.8;
    }
  }
  function update(dt, kamera, hoehePx) {
    mat.uniforms.uSkala.value = hoehePx / (2 * Math.tan(THREE.MathUtils.degToRad(kamera.fov) / 2));
    for (let i = 0; i < max; i++) {
      if (leben[i] <= 0) { alpha[i] = 0; continue; }
      leben[i] -= dt;
      const t = 1 - leben[i] / dauer[i];
      vel[i * 3 + 1] -= schwere[i] * dt;
      const d = Math.exp(-1.2 * dt);
      vel[i * 3] *= d; vel[i * 3 + 1] *= schwere[i] ? 1 : d; vel[i * 3 + 2] *= d;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      groesse[i] = start[i] * (1 + wachs[i] * t);
      alpha[i] = aStart[i] * Math.min(1, t * 8) * (1 - t);
    }
    aPos.needsUpdate = aFarbe.needsUpdate = aGr.needsUpdate = aAl.needsUpdate = true;
  }
  return { emit, update, punkte, dispose() { g.dispose(); mat.dispose(); } };
}

/** Alle Effekte zusammen. → { staub, funken, gas, ring(pos, radius, farbe), blitz(pos, staerke), einschlag(pos, staerke), blut(pos, normale, farbe), update(dt, kamera, hoehePx) } */
export function createEffekte({ szene, nebel, dichte }) {
  const staub = createPartikel({ szene, max: 2600, nebel, dichte });
  const glut = createPartikel({ szene, max: 1800, additiv: true, nebel, dichte });
  const ringe = [];
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xc8b89a, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
  ringMat.userData.psx = false;
  const licht = new THREE.PointLight(0xffb070, 0, 120, 1.6); szene.add(licht);
  let lichtUhr = 0, lichtMax = 0;
  // Schwebende Lichtkörnchen um den Helden (Stimmung)
  let kornUhr = 0;

  function ring(pos, radius, farbe = 0xc8b89a, dauer = 0.9) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), ringMat.clone()); m.material.color.set(farbe); m.material.userData.psx = false;
    m.rotation.x = -Math.PI / 2; m.position.set(pos.x, pos.y + 0.3, pos.z); m.userData.psx = false; szene.add(m);
    ringe.push({ m, t: 0, dauer, radius });
  }
  function blitz(pos, staerke = 1, farbe = 0xffb070) { licht.position.set(pos.x, pos.y + 3, pos.z); licht.color.set(farbe); lichtMax = 60 * staerke; lichtUhr = 0.5; }
  function staubwolke(pos, staerke = 1) {
    staub.emit(Math.round(50 * staerke), { pos, streu: 4 * staerke, streuY: 0.2, vel: { x: 0, y: 2.5, z: 0 }, velStreu: 7 * staerke, velStreuY: 0.3, leben: 2.6, groesse: 3.2 * staerke, wachsen: 2.5, farbe: 0x5c5444, alpha: 0.55 });
  }
  function einschlag(pos, staerke = 1) {
    staubwolke(pos, staerke * 1.6);
    glut.emit(Math.round(90 * staerke), { pos, streu: 1.5, vel: { x: 0, y: 10, z: 0 }, velStreu: 16 * staerke, leben: 1.4, groesse: 0.5, schwere: 18, farbe: 0xff8a30, alpha: 1 });
    glut.emit(30, { pos: { x: pos.x, y: pos.y + 2, z: pos.z }, streu: 3, velStreu: 4, leben: 0.6, groesse: 9 * staerke, wachsen: 1.5, farbe: 0xffc070, alpha: 0.7 });
    ring(pos, 16 * staerke, 0xffb070, 1.1); blitz(pos, staerke * 1.5);
  }
  function blut(pos, normale, farbe = 0xffa24a) {
    glut.emit(40, { pos, streu: 0.4, vel: { x: normale.x * 8, y: normale.y * 8 + 3, z: normale.z * 8 }, velStreu: 5, leben: 1.1, groesse: 0.45, schwere: 12, farbe, alpha: 1 });
    staub.emit(14, { pos, streu: 0.6, vel: { x: normale.x * 3, y: 1, z: normale.z * 3 }, velStreu: 2, leben: 1.6, groesse: 1.6, wachsen: 1.8, farbe: 0x2a2a24, alpha: 0.6 });
  }
  function gas(pos, richtung) {
    staub.emit(3, { pos, streu: 0.2, vel: { x: -richtung.x * 3, y: -richtung.y * 3, z: -richtung.z * 3 }, velStreu: 1, leben: 0.8, groesse: 0.7, wachsen: 3, farbe: 0xd8dcd8, alpha: 0.45 });
  }
  function update(dt, kamera, hoehePx, held) {
    staub.update(dt, kamera, hoehePx); glut.update(dt, kamera, hoehePx);
    for (let i = ringe.length - 1; i >= 0; i--) {
      const r = ringe[i]; r.t += dt; const t = r.t / r.dauer;
      r.m.scale.setScalar(1 + r.radius * Math.sqrt(t)); r.m.material.opacity = 0.55 * (1 - t);
      if (t >= 1) { szene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); ringe.splice(i, 1); }
    }
    if (lichtUhr > 0) { lichtUhr -= dt; licht.intensity = lichtMax * Math.max(0, lichtUhr / 0.5); } else licht.intensity = 0;
    kornUhr += dt;
    if (held && kornUhr > 0.12) { kornUhr = 0; glut.emit(1, { pos: { x: held.x, y: held.y + 3, z: held.z }, streu: 14, streuY: 0.6, vel: { x: 0.2, y: 0.1, z: 0 }, velStreu: 0.25, leben: 6, groesse: 0.12, farbe: 0xe8d090, alpha: 0.8 }); }
  }
  return { staub, glut, ring, blitz, staubwolke, einschlag, blut, gas, update };
}

/**
 * Großzauber „Sternenfall“: halten = laden (Zielkreis wächst), loslassen = ein Stern stürzt aus den Wolken auf das Ziel.
 * → { laden(ziel, dt), abbrechen(), loslassen() -> bool, update(dt) -> einschlaege[], anteil, aktiv, bereit, abkling }
 */
export function createSternenfall({ szene, effekte }) {
  const kreis = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  kreis.rotation.x = -Math.PI / 2; kreis.visible = false; kreis.material.userData.psx = false; kreis.userData.psx = false; szene.add(kreis);
  const sternMat = new THREE.MeshBasicMaterial({ color: 0xffd6a0 }); sternMat.userData.psx = false;
  const sterne = [];
  let ladung = 0, ziel = null, abkling = 0;
  const ABKLING = 9, VOLL = 1.6;
  return {
    get anteil() { return Math.min(1, ladung / VOLL); },
    get aktiv() { return ladung > 0; },
    get bereit() { return abkling <= 0; },
    get abklingAnteil() { return Math.max(0, abkling / ABKLING); },
    laden(z, dt) {
      if (abkling > 0) return false;
      ladung += dt; ziel = z;
      const r = 3 + 11 * Math.min(1, ladung / VOLL);
      kreis.visible = true; kreis.position.set(z.x, z.boden + 0.4, z.z); kreis.scale.setScalar(r);
      kreis.material.opacity = 0.35 + 0.35 * Math.sin(ladung * 9) ** 2;
      if (Math.random() < 0.6) effekte.glut.emit(1, { pos: { x: z.x, y: z.boden + 0.5, z: z.z }, streu: r * 0.8, streuY: 0.05, vel: { x: 0, y: 4, z: 0 }, velStreu: 0.5, leben: 1, groesse: 0.35, farbe: 0xffb070, alpha: 1 });
      return true;
    },
    abbrechen() { ladung = 0; kreis.visible = false; },
    loslassen(von) {
      kreis.visible = false;
      if (ladung < 0.45 || !ziel) { ladung = 0; return false; }
      const kraft = 0.7 + 0.6 * Math.min(1, ladung / VOLL);
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2 * kraft, 1), sternMat); m.userData.psx = false;
      const start = { x: ziel.x + (von.x - ziel.x) * 0.3 - 40, y: ziel.boden + 170, z: ziel.z + (von.z - ziel.z) * 0.3 - 30 };
      m.position.set(start.x, start.y, start.z); szene.add(m);
      sterne.push({ m, start, ziel: { ...ziel, y: ziel.y ?? ziel.boden }, t: 0, dauer: 1.25, kraft, riese: ziel.riese ?? null });
      ladung = 0; abkling = ABKLING;
      return true;
    },
    update(dt) {
      abkling = Math.max(0, abkling - dt);
      const raus = [];
      for (let i = sterne.length - 1; i >= 0; i--) {
        const s = sterne[i]; s.t += dt; const t = Math.min(1, s.t / s.dauer), e = t * t;
        const zp = s.riese?.lebt ? s.riese.torso : null;   // folgt dem Riesen
        const zx = zp ? zp.x : s.ziel.x, zy = zp ? zp.y : s.ziel.y, zz = zp ? zp.z : s.ziel.z;
        s.m.position.set(s.start.x + (zx - s.start.x) * e, s.start.y + (zy - s.start.y) * e, s.start.z + (zz - s.start.z) * e);
        s.m.rotation.x += dt * 4;
        effekte.glut.emit(6, { pos: s.m.position, streu: 1.2 * s.kraft, velStreu: 2, leben: 0.9, groesse: 3.5 * s.kraft, wachsen: -0.6, farbe: 0xff9a40, alpha: 0.9 });
        effekte.staub.emit(2, { pos: s.m.position, streu: 1.5, velStreu: 1, leben: 2.2, groesse: 4, wachsen: 2, farbe: 0x3a3430, alpha: 0.5 });
        if (t >= 1) { szene.remove(s.m); s.m.geometry.dispose(); sterne.splice(i, 1); raus.push({ pos: { x: zx, y: zy, z: zz }, kraft: s.kraft, riese: s.riese }); }
      }
      return raus;
    },
  };
}
