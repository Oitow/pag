// Erde-Labor, Schritt 1: eine Kugel in echter Größe.
// - Grobe Kugel (512×256) für den Blick aus dem All
// - Feines Bodenstück (LOD-Vorstufe) um den Heimatpunkt, exakt auf der echten Kugel, mit Schürze gegen Risse
// - Maßstab: Mensch 1,8 m, Baum 25 m, Turm 330 m, Everest 8,8 km, ISS-Bahn 408 km, Mond in echter Entfernung
import * as THREE from 'three';
import {
  R_ERDE as R, R_MOND, MOND_ABSTAND, ISS_HOEHE, H_MIN, H_MAX,
  horizont, absinken, oberflaeche, reglerZuHoehe, hoeheZuRegler, laenge, ORTE,
} from './mass.js';

const P = new URLSearchParams(location.search);
const MITTE = new THREE.Vector3(0, -R, 0);
const SONNE = new THREE.Vector3(1, 0.55, 0.35).normalize();

// ---------- Renderer / Szene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 3e9);

const sonne = new THREE.DirectionalLight(0xfff4e0, 2.6);
sonne.position.copy(SONNE);
scene.add(sonne, new THREE.AmbientLight(0x6080a0, 0.25));
const himmelLicht = new THREE.HemisphereLight(0x9cc8ff, 0x445533, 0.8);
scene.add(himmelLicht);

// ---------- Textur: nur Gitter (Breiten-/Längengrade), Terrain kommt später ----------
function gitterTextur() {
  const w = 4096, h = 2048, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const verlauf = g.createLinearGradient(0, 0, 0, h);
  verlauf.addColorStop(0, '#e8eef2'); verlauf.addColorStop(0.07, '#7f9fb0');
  verlauf.addColorStop(0.2, '#2d5a78'); verlauf.addColorStop(0.5, '#1f4d6e');
  verlauf.addColorStop(0.8, '#2d5a78'); verlauf.addColorStop(0.93, '#7f9fb0'); verlauf.addColorStop(1, '#e8eef2');
  g.fillStyle = verlauf; g.fillRect(0, 0, w, h);
  // Linien alle 15°, um eine halbe Zelle versetzt: der Heimatpunkt liegt mitten in einer Zelle
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
  for (let i = 0; i < 24; i++) { const x = ((i + 0.5) / 24) * w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let i = 0; i < 12; i++) { const y = ((i + 0.5) / 12) * h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
const erdMat = new THREE.MeshStandardMaterial({ map: gitterTextur(), roughness: 0.9, metalness: 0 });

// Kugel-Raum (wie THREE.SphereGeometry) → Welt: Heimatpunkt (u=0.5, v=0.5) liegt im Ursprung.
// Welt = (ys, xs - R, -zs) ist eine echte Drehung + Verschiebung. Gerechnet in double, erst dann Float32.
function kugelUV(nx, ny, nz) { // Welt-Richtung (von der Erdmitte) → Textur-uv
  const v = Math.acos(Math.max(-1, Math.min(1, nx))) / Math.PI;
  let u = Math.atan2(-nz, -ny) / (2 * Math.PI);
  if (u < 0) u += 1;
  return [u, 1 - v];
}

// ---------- Grobe Kugel ----------
function grobeKugel(rad, breit, hoch) {
  const pos = [], nor = [], uv = [], idx = [];
  for (let iy = 0; iy <= hoch; iy++) {
    const v = iy / hoch, sv = Math.sin(v * Math.PI), cv = Math.cos(v * Math.PI);
    for (let ix = 0; ix <= breit; ix++) {
      const u = ix / breit, cu = Math.cos(u * 2 * Math.PI), su = Math.sin(u * 2 * Math.PI);
      const xs = -cu * sv, ys = cv, zs = su * sv;             // Einheitskugel wie SphereGeometry
      pos.push(rad * ys, -rad * (cu * sv + 1) - (R - rad), -rad * zs); // xs*rad - R, stabil umgeformt
      nor.push(ys, xs, -zs);
      uv.push(u, 1 - v);
    }
  }
  for (let iy = 0; iy < hoch; iy++) for (let ix = 0; ix < breit; ix++) {
    const a = iy * (breit + 1) + ix + 1, b = iy * (breit + 1) + ix, c = (iy + 1) * (breit + 1) + ix, d = c + 1;
    if (iy !== 0) idx.push(a, b, d);
    if (iy !== hoch - 1) idx.push(b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.boundingSphere = new THREE.Sphere(MITTE.clone(), rad);
  return geo;
}
// 3 m tiefer als die echte Kugel, damit das feine Bodenstück immer obenauf liegt.
const grob = new THREE.Mesh(grobeKugel(R - 3, 512, 256), erdMat);
scene.add(grob);

// ---------- Feines Bodenstück: Ringe von 0,3 m bis 120 km, exakt auf der Kugel ----------
const STUECK_R = 120_000, RINGE = 72, SEKT = 160, SCHUERZE = 4000;
function bodenStueck() {
  const pos = [0, 0, 0], nor = [0, 1, 0], uv = [...kugelUV(0, 1, 0)], idx = [];
  const radien = [];
  for (let i = 0; i < RINGE; i++) radien.push(0.3 * (STUECK_R / 0.3) ** (i / (RINGE - 1)));
  radien.push(STUECK_R); // Schürzen-Ring (gleicher Radius, nach unten versetzt)
  radien.forEach((s, ri) => {
    const schuerze = ri === radien.length - 1;
    for (let k = 0; k < SEKT; k++) {
      const w = (k / SEKT) * Math.PI * 2;
      const o = oberflaeche(Math.cos(w) * s, Math.sin(w) * s);
      const t = schuerze ? SCHUERZE : 0;
      pos.push(o.x - o.nx * t, o.y - o.ny * t, o.z - o.nz * t);
      nor.push(o.nx, o.ny, o.nz);
      uv.push(...kugelUV(o.nx, o.ny, o.nz));
    }
  });
  for (let k = 0; k < SEKT; k++) idx.push(0, 1 + k, 1 + ((k + 1) % SEKT));
  for (let r = 0; r < radien.length - 1; r++) for (let k = 0; k < SEKT; k++) {
    const a = 1 + r * SEKT + k, b = 1 + r * SEKT + ((k + 1) % SEKT), c = a + SEKT, d = b + SEKT;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}
const boden = new THREE.Mesh(bodenStueck(), erdMat);
scene.add(boden);

// Meter-Gitter am Boden (20-m-Raster auf 2 km, 1-m-Raster auf 40 m)
const gitter20 = new THREE.GridHelper(2000, 100, 0xffffff, 0xffffff);
gitter20.material.transparent = true; gitter20.material.opacity = 0.18; gitter20.position.y = 0.02;
const gitter1 = new THREE.GridHelper(40, 40, 0xffffff, 0xffffff);
gitter1.material.transparent = true; gitter1.material.opacity = 0.25; gitter1.position.y = 0.03;
scene.add(gitter20, gitter1);

// ---------- Maßstab-Objekte, korrekt auf der gekrümmten Oberfläche ----------
function aufBoden(obj, ost, nord) {
  const o = oberflaeche(ost, nord);
  obj.position.set(o.x, o.y, o.z);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(o.nx, o.ny, o.nz));
  scene.add(obj);
  return obj;
}
const std = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });

const mensch = new THREE.Group();
const koerper = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.0, 6, 12), std(0xd9772b));
koerper.position.y = 0.72;
const kopf = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), std(0xf0c8a0));
kopf.position.y = 1.67;
mensch.add(koerper, kopf);
aufBoden(mensch, 0, 0);

const baum = new THREE.Group();
const stamm = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 12, 10), std(0x5a3d26));
stamm.position.y = 6;
const krone = new THREE.Mesh(new THREE.ConeGeometry(5, 17, 12), std(0x2f5a2a));
krone.position.y = 16.5;
baum.add(stamm, krone);
aufBoden(baum, 14, 9);

const turm = new THREE.Mesh(new THREE.CylinderGeometry(6, 40, 330, 4), std(0x8a8f96));
turm.geometry.translate(0, 165, 0);
aufBoden(turm, 350, 500);

const berg = new THREE.Mesh(new THREE.ConeGeometry(22_000, 8849 + 400, 48, 1), std(0x8b8478));
berg.geometry.translate(0, (8849 + 400) / 2 - 400, 0); // 400 m in den Boden, Kugel ist dort gekrümmt
aufBoden(berg, 25_000, 60_000);

// ISS-Bahn (Ring um die Erdmitte, durch den Zenit des Heimatpunkts)
const bahnPunkte = [];
for (let i = 0; i <= 512; i++) {
  const w = (i / 512) * Math.PI * 2, r = R + ISS_HOEHE;
  bahnPunkte.push(new THREE.Vector3(Math.sin(w) * r * 0.6, Math.cos(w) * r - R, Math.sin(w) * r * 0.8));
}
const issBahn = new THREE.Line(new THREE.BufferGeometry().setFromPoints(bahnPunkte),
  new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.6 }));
scene.add(issBahn);
const issPos = new THREE.Vector3(0, ISS_HOEHE, 0);

// Mond in echter Entfernung und Größe
const MOND_RICHTUNG = new THREE.Vector3(-0.35, 0.55, -0.76).normalize();
const mond = new THREE.Mesh(new THREE.SphereGeometry(R_MOND, 96, 48), std(0x9a9a9a));
mond.position.copy(MITTE).addScaledVector(MOND_RICHTUNG, MOND_ABSTAND);
scene.add(mond);

// ---------- Atmosphären-Leuchten (nur von außen) ----------
const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.025, 128, 64), new THREE.ShaderMaterial({
  uniforms: { sonne: { value: SONNE } },
  vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz);
vW = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*mv;
#include <logdepthbuf_vertex>
}`,
  fragmentShader: `#include <logdepthbuf_pars_fragment>
uniform vec3 sonne; varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){
#include <logdepthbuf_fragment>
  float d = -dot(vN, vV);                       // Rückseite: 0 am Außenrand, groß zur Mitte
  float k = smoothstep(0.0, 0.22, d);
  float tag = clamp(dot(vW, sonne) + 0.35, 0.08, 1.0);
  gl_FragColor = vec4(vec3(0.35, 0.62, 1.0) * k * tag * 1.4, 1.0);
}`,
  side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
}));
atmo.position.copy(MITTE);
scene.add(atmo);

// ---------- Sterne (wandern mit der Kamera) ----------
const sternGeo = new THREE.BufferGeometry();
{
  const a = [];
  for (let i = 0; i < 4000; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(2e9);
    a.push(v.x, v.y, v.z);
  }
  sternGeo.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
}
const sterne = new THREE.Points(sternGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false }));
sterne.frustumCulled = false;
scene.add(sterne);

// ---------- Beschriftungen ----------
const LABELS = [
  { text: 'Mensch 1,8 m', pos: new THREE.Vector3(0, 2.1, 0), bis: 400 },
  { text: 'Baum 25 m', pos: aufBodenPunkt(14, 9, 25), bis: 3000 },
  { text: 'Turm 330 m', pos: aufBodenPunkt(350, 500, 340), bis: 40_000 },
  { text: 'Everest-Höhe 8,8 km', pos: aufBodenPunkt(25_000, 60_000, 9300), von: 3000, bis: 900_000 },
  { text: 'ISS 408 km', pos: issPos, von: 50_000, bis: 30_000_000 },
  { text: 'Mond (384.400 km)', pos: mond.position, von: 5_000_000 },
  { text: 'Erde', pos: MITTE, von: 40_000_000 },
];
function aufBodenPunkt(ost, nord, hoehe) {
  const o = oberflaeche(ost, nord);
  return new THREE.Vector3(o.x + o.nx * hoehe, o.y + o.ny * hoehe, o.z + o.nz * hoehe);
}
const labelBox = document.getElementById('labels');
for (const l of LABELS) { l.el = document.createElement('div'); l.el.className = 'lab'; l.el.textContent = l.text; labelBox.appendChild(l.el); }

// ---------- Kamera-Steuerung: Höhe h, Richtung az, Neigung el ----------
const start = ORTE[P.get('ort')] || ORTE.orbit;
let basis = start.um ? aufBodenPunkt(...start.um) : new THREE.Vector3();
let h = start.h, hZiel = start.h, az = THREE.MathUtils.degToRad(start.az), el = THREE.MathUtils.degToRad(start.el);
let flug = null; // automatischer Flug: Liste von Zielhöhen

const regler = document.getElementById('hoehe');
regler.addEventListener('input', () => { hZiel = reglerZuHoehe(+regler.value / 1000); h = hZiel; flug = null; });

const zeiger = new Map();
let pinchAbstand = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY }); renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener('pointermove', (e) => {
  const p = zeiger.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (zeiger.size === 1) {
    az -= dx * 0.005;
    el = THREE.MathUtils.clamp(el + dy * 0.004, THREE.MathUtils.degToRad(2), THREE.MathUtils.degToRad(89));
  } else if (zeiger.size === 2) {
    const [a, b] = [...zeiger.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchAbstand) { hZiel = THREE.MathUtils.clamp(hZiel * (pinchAbstand / d) ** 2.5, H_MIN, H_MAX); flug = null; }
    pinchAbstand = d;
  }
});
const los = (e) => { zeiger.delete(e.pointerId); pinchAbstand = 0; };
renderer.domElement.addEventListener('pointerup', los);
renderer.domElement.addEventListener('pointercancel', los);
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault(); flug = null;
  hZiel = THREE.MathUtils.clamp(hZiel * Math.exp(e.deltaY * 0.002), H_MIN, H_MAX);
}, { passive: false });

const knoepfe = document.getElementById('orte');
for (const [key, o] of Object.entries(ORTE)) {
  const b = document.createElement('div');
  b.className = 'b'; b.textContent = o.name;
  b.onclick = () => { flug = null; basis = o.um ? aufBodenPunkt(...o.um) : new THREE.Vector3(); hZiel = o.h; el = THREE.MathUtils.degToRad(o.el); az = THREE.MathUtils.degToRad(o.az); };
  knoepfe.appendChild(b);
}
document.getElementById('flug').onclick = () => {
  flug = [25_000_000, 400_000, 10_000, 330, 5];
  basis = new THREE.Vector3(0, 1.2, 0);
  el = THREE.MathUtils.degToRad(80);
};

// ---------- Schleife ----------
const hud = document.getElementById('hud');
const ziel = new THREE.Vector3(), richt = new THREE.Vector3(), tmp = new THREE.Vector3();
const blau = new THREE.Color(0x8fbde8), schwarz = new THREE.Color(0x02040a), himmel = new THREE.Color();
let alt = performance.now(), fpsZeit = 0, fpsN = 0, fps = 0;

function bild() {
  const jetzt = performance.now(), dt = Math.min(0.1, (jetzt - alt) / 1000);
  alt = jetzt;
  fpsZeit += dt; fpsN++;
  if (fpsZeit > 0.5) { fps = fpsN / fpsZeit; fpsZeit = 0; fpsN = 0; }

  if (flug) {
    hZiel = flug[0];
    if (Math.abs(Math.log(h / hZiel)) < 0.05) { flug.shift(); if (!flug.length) flug = null; }
    if (flug && flug[0] < 2000) el = THREE.MathUtils.lerp(el, THREE.MathUtils.degToRad(15), 1 - Math.exp(-dt));
  }
  h = Math.exp(THREE.MathUtils.lerp(Math.log(h), Math.log(hZiel), 1 - Math.exp(-dt * (flug ? 1.2 : 3))));
  regler.value = String(Math.round(hoeheZuRegler(h) * 1000));

  // Blickziel: nah = Heimatpunkt, fern = Erdmitte (dann sieht man die ganze Kugel)
  // ganz weit draußen: Mitte zwischen Erde und Mond, damit beide ins Bild passen
  const k = THREE.MathUtils.smoothstep(Math.log10(h), 5, 7);
  const km = THREE.MathUtils.smoothstep(Math.log10(h), 7.8, 8.6);
  ziel.copy(basis).lerp(MITTE, k).lerp(tmp.copy(MITTE).lerp(mond.position, 0.5), km);
  richt.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  camera.position.copy(basis).multiplyScalar(1 - k).addScaledVector(richt, h);
  // Kamera nie unter die Kugel (bei flachem Blick weit draußen)
  const abstandMitte = tmp.copy(camera.position).sub(MITTE).length();
  if (abstandMitte < R + H_MIN) camera.position.sub(MITTE).setLength(R + H_MIN).add(MITTE);
  if (richt.y > 0.999) camera.up.set(0, 0, -1); else camera.up.set(0, 1, 0);
  camera.lookAt(ziel);

  const hoeheEcht = tmp.copy(camera.position).sub(MITTE).length() - R;
  // Himmel: blau am Boden, schwarz ab ~80 km
  const s = THREE.MathUtils.smoothstep(Math.log10(Math.max(1, hoeheEcht)), 3.6, 4.9);
  himmel.copy(blau).lerp(schwarz, s);
  scene.background = himmel;
  sterne.visible = s > 0.6;
  sterne.position.copy(camera.position);
  atmo.visible = hoeheEcht > 60_000;
  himmelLicht.intensity = 0.8 * (1 - s) + 0.15;
  gitter20.visible = hoeheEcht < 6000;
  gitter1.visible = hoeheEcht < 120;

  renderer.render(scene, camera);

  // Beschriftungen
  for (const l of LABELS) {
    const sicht = (l.von === undefined || hoeheEcht >= l.von) && (l.bis === undefined || hoeheEcht <= l.bis);
    tmp.copy(l.pos).project(camera);
    const vorn = tmp.z < 1 && tmp.z > -1;
    if (!sicht || !vorn) { l.el.style.display = 'none'; continue; }
    l.el.style.display = 'block';
    l.el.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * innerWidth}px, ${(-tmp.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -130%)`;
  }

  const info = renderer.info.render;
  hud.textContent =
    `Höhe        ${laenge(hoeheEcht)}\n` +
    `Horizont    ${laenge(horizont(hoeheEcht))}\n` +
    `Krümmung    auf 5 km sinkt der Boden ${laenge(absinken(5000))}\n` +
    `Erdradius   ${laenge(R)}  (echt)\n` +
    `Dreiecke    ${info.triangles.toLocaleString('de-DE')}  ·  ${fps.toFixed(0)} fps`;
  requestAnimationFrame(bild);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
document.getElementById('load').remove();
requestAnimationFrame(bild);
