// Erde-Labor, Stufe 1: erfundener Planet mit Detailstufen, nahtlos vom Orbit bis zum Boden.
// Würfel-Kugel + Quadtree-Kacheln (planet-baum), Höhe/Farbe aus dem Seed (planet-hoehe),
// Kachelbau im Worker (kachel-worker, Rückfall: Hauptthread), Kamera bleibt im Ursprung (Floating Origin).
import * as THREE from 'three';
import { createPlanetHoehe } from './planet-hoehe.js';
import { waehleKacheln, maxStufeFuer } from './planet-baum.js';
import { baueKachel, ZELLEN } from './kachel-bau.js';
import { createKachelStrom } from './kachel-strom.js';
import { laenge } from './mass.js';

const P = new URLSearchParams(location.search);
const SEED = +(P.get('seed') || 7);
const R = (+(P.get('r') || 100)) * 1000;          // Radius in m (Standard 100 km)
const ATMO = R * 0.08;                             // Dicke der Lufthülle
const SONNE = new THREE.Vector3(0.75, 0.45, 0.48).normalize();
const MAX_STUFE = maxStufeFuer(R, ZELLEN, 1.0);    // feinste Kacheln: ~1 m Punktabstand
const planet = createPlanetHoehe({ seed: SEED, radius: R });

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.2, 5e8);
const sonne = new THREE.DirectionalLight(0xfff1dc, 2.4);
sonne.position.copy(SONNE);
const himmelLicht = new THREE.HemisphereLight(0xa8ccff, 0x3b3424, 0.7);
scene.add(sonne, himmelLicht, new THREE.AmbientLight(0x404858, 0.25));
scene.fog = new THREE.FogExp2(0x9cc4ec, 0);

const bodenMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
const stufenMat = []; // Debug: jede Stufe eigene Farbe
for (let i = 0; i <= MAX_STUFE; i++) stufenMat.push(new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL((i * 0.13) % 1, 0.6, 0.55), roughness: 1 }));
let stufenFarben = false;

// ---------- Kacheln ----------
const welt = new THREE.Group();
scene.add(welt);
function erzeuge(d) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(d.nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(d.col, 3, true));
  geo.setIndex(new THREE.BufferAttribute(d.idx, 1));
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, stufenFarben ? stufenMat[d.L] : bodenMat);
  m.userData = { mitte: d.mitte, L: d.L };
  m.visible = false;
  welt.add(m);
  return m;
}
const zeige = (m, an) => { if (m) m.visible = an; };
const entsorge = (m) => { welt.remove(m); m.geometry.dispose(); };

// Worker-Pool; bei file:// oder Fehler: Bau im Hauptthread mit Zeitbudget
const hauptQueue = [];
let worker = [];
let bauMs = 0, bauN = 0;
function starteWorker() {
  const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
  try {
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./kachel-worker.js', import.meta.url), { type: 'module' });
      w.offen = new Map();
      w.onmessage = (e) => { w.offen.delete(e.data.key); bauMs += e.data.ms; bauN++; strom.fertigGebaut(e.data.key, e.data); };
      w.onerror = () => { // Worker kaputt → seine Aufträge in den Hauptthread
        worker = worker.filter((x) => x !== w);
        for (const k of w.offen.values()) hauptQueue.push(k);
        w.terminate();
      };
      w.postMessage({ art: 'planet', opts: { seed: SEED, radius: R } });
      worker.push(w);
    }
  } catch { worker = []; }
}
let wi = 0;
function bauen(k) {
  if (!worker.length) { hauptQueue.push(k); return; }
  const w = worker[wi++ % worker.length];
  w.offen.set(k.key, k);
  w.postMessage({ art: 'bau', k });
}
function hauptBau(budgetMs) {
  const t0 = performance.now();
  while (hauptQueue.length && performance.now() - t0 < budgetMs) {
    const k = hauptQueue.shift();
    const t = performance.now();
    const d = baueKachel(k, planet);
    bauMs += performance.now() - t; bauN++;
    strom.fertigGebaut(k.key, d);
  }
}
starteWorker();
const strom = createKachelStrom({ bauen, erzeuge, zeige, entsorge, parallel: Math.max(2, worker.length * 2) });

// ---------- Lufthülle von außen, Sterne ----------
const atmo = new THREE.Mesh(new THREE.SphereGeometry(R + ATMO, 160, 80), new THREE.ShaderMaterial({
  uniforms: { sonne: { value: SONNE }, innen: { value: R / (R + ATMO) } },
  vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz);
vW = normalize(normal); gl_Position = projectionMatrix*mv;
#include <logdepthbuf_vertex>
}`,
  fragmentShader: `#include <logdepthbuf_pars_fragment>
uniform vec3 sonne; uniform float innen; varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){
#include <logdepthbuf_fragment>
  float d = -dot(vN, vV);
  float rand = sqrt(max(0.0, 1.0 - innen*innen));      // dort beginnt der Planet
  float k = smoothstep(0.0, rand, d);
  float tag = clamp(dot(vW, sonne) + 0.3, 0.05, 1.0);
  gl_FragColor = vec4(vec3(0.32, 0.6, 1.0) * k * tag * 1.3, 1.0);
}`,
  side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
}));
scene.add(atmo);
const sterne = (() => {
  const a = [];
  for (let i = 0; i < 4000; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(3e8); a.push(v.x, v.y, v.z); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }));
  p.frustumCulled = false; return p;
})();
scene.add(sterne);

// ---------- Besondere Orte finden (Berg, Küste) ----------
const orte = (() => {
  let berg = null, bergH = -1e9;
  const kand = [];
  const N = 6000, gold = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y), t = gold * i;
    const d = [Math.cos(t) * r, y, Math.sin(t) * r];
    const h = planet.hoehe(d[0], d[1], d[2], 300);
    if (h > bergH) { bergH = h; berg = d; }
    if (h > 3 && h < 15) kand.push(d);
  }
  let kueste = kand[0] || berg, best = -2;
  for (const d of kand) { const c = d[0] * berg[0] + d[1] * berg[1] + d[2] * berg[2]; if (c > best && c < Math.cos(4000 / R)) { best = c; kueste = d; } }
  return { berg: new THREE.Vector3(...berg), kueste: new THREE.Vector3(...kueste) };
})();
// Sonne so stellen, dass am Startort Vormittag ist
SONNE.copy(orte.kueste).multiplyScalar(0.8).add(new THREE.Vector3(0.35, 0.45, 0.2)).normalize();
sonne.position.copy(SONNE);

// ---------- Kamera: Lage (m, Planetenmitte = 0), Blick nach vorn (tangential) + Neigung ----------
const cam = new THREE.Vector3();
const vorn = new THREE.Vector3();
let neigung = 0;
const oben = new THREE.Vector3(), blick = new THREE.Vector3(), rechts = new THREE.Vector3(), tmp = new THREE.Vector3();
const boden = (v) => { tmp.copy(v).normalize(); return Math.max(0, planet.hoehe(tmp.x, tmp.y, tmp.z, 0.5)); };

function setzeOrt(name) {
  const ziel = name === 'berg' ? orte.berg : orte.kueste;
  const hoehen = { orbit: 900_000, berg: 7000, kueste: 400, boden: 1.8 };
  const nei = { orbit: -89, berg: -18, kueste: -12, boden: -3 };
  const h = hoehen[name] ?? hoehen.orbit;
  const d = ziel.clone().normalize();
  if (name === 'berg') d.applyAxisAngle(new THREE.Vector3(0, 1, 0), 12000 / R); // etwas abseits, Gipfel im Blick
  cam.copy(d).multiplyScalar(R + boden(d) + h);
  // nach vorn: Richtung Berg (bzw. Norden)
  oben.copy(d);
  vorn.copy(orte.berg).sub(cam).projectOnPlane(oben);
  if (vorn.lengthSq() < 1e-6) vorn.set(0, 1, 0).projectOnPlane(oben);
  vorn.normalize();
  neigung = THREE.MathUtils.degToRad(nei[name] ?? -89);
  auto = null;
}

// ---------- Steuerung ----------
const tasten = new Set();
addEventListener('keydown', (e) => tasten.add(e.code));
addEventListener('keyup', (e) => tasten.delete(e.code));
const stick = { id: null, x0: 0, y0: 0, x: 0, y: 0 };
const blickZ = { id: null, x: 0, y: 0 };
const joyEl = document.getElementById('joy'), knopfEl = document.getElementById('knob');
const cv = renderer.domElement;
cv.addEventListener('pointerdown', (e) => {
  cv.setPointerCapture(e.pointerId);
  if (e.pointerType !== 'mouse' && e.clientX < innerWidth * 0.45 && stick.id === null) {
    Object.assign(stick, { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, y: 0 });
    joyEl.style.display = 'block'; joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px';
  } else if (blickZ.id === null) Object.assign(blickZ, { id: e.pointerId, x: e.clientX, y: e.clientY });
});
cv.addEventListener('pointermove', (e) => {
  if (e.pointerId === stick.id) {
    let dx = e.clientX - stick.x0, dy = e.clientY - stick.y0;
    const l = Math.hypot(dx, dy), m = 55;
    if (l > m) { dx *= m / l; dy *= m / l; }
    stick.x = dx / m; stick.y = dy / m;
    knopfEl.style.transform = `translate(${dx}px,${dy}px)`;
  } else if (e.pointerId === blickZ.id) {
    const dx = e.clientX - blickZ.x, dy = e.clientY - blickZ.y;
    blickZ.x = e.clientX; blickZ.y = e.clientY;
    drehe(-dx * 0.004, -dy * 0.004);
    auto = null;
  }
});
const los = (e) => {
  if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; joyEl.style.display = 'none'; knopfEl.style.transform = ''; }
  if (e.pointerId === blickZ.id) blickZ.id = null;
};
cv.addEventListener('pointerup', los);
cv.addEventListener('pointercancel', los);
function drehe(gier, nick) {
  oben.copy(cam).normalize();
  vorn.applyAxisAngle(oben, gier);
  neigung = THREE.MathUtils.clamp(neigung + nick, -1.55, 1.55);
}
let hochRunter = 0;
for (const [id, w] of [['hoch', 1], ['runter', -1]]) {
  const el = document.getElementById(id);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); hochRunter = w; auto = null; });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, () => { hochRunter = 0; });
}
const tempoEl = document.getElementById('tempo');

// ---------- Orbit-Test: automatisch vom All zum Boden und zurück ----------
let auto = null;
const AUTO_STUFEN = [1_500_000, 200_000, 20_000, 2_000, 200, 20, 2];
document.getElementById('bOrbit').onclick = () => {
  setzeOrt('kueste');
  const d = cam.clone().normalize();
  cam.copy(d).multiplyScalar(R + boden(d) + AUTO_STUFEN[0]);
  auto = { stufen: [...AUTO_STUFEN, ...AUTO_STUFEN.slice(0, -1).reverse()], pause: 0, punkt: d };
};
for (const [id, ort] of [['bAll', 'orbit'], ['bBerg', 'berg'], ['bKueste', 'kueste'], ['bBoden', 'boden']])
  document.getElementById(id).onclick = () => setzeOrt(ort);
document.getElementById('bLod').onclick = (e) => {
  stufenFarben = !stufenFarben;
  e.currentTarget.classList.toggle('on', stufenFarben);
  welt.children.forEach((m) => { m.material = stufenFarben ? stufenMat[m.userData.L] : bodenMat; });
};
document.getElementById('bSeed').onclick = () => {
  const p = new URLSearchParams(location.search); p.set('seed', String(1 + Math.floor(Math.random() * 99999)));
  location.search = p.toString();
};

// ---------- Schleife ----------
const hud = document.getElementById('hud');
const blau = new THREE.Color(0x8fbfea), nacht = new THREE.Color(0x0a1020), schwarz = new THREE.Color(0x01030a), himmel = new THREE.Color();
let alt = performance.now(), fpsT = 0, fpsN = 0, fps = 0, wahlT = 1, info = { angezeigt: 0, gebaut: 0, laufend: 0, offen: 0 };
let geladen = false, tempoAnzeige = 0;
const ladeEl = document.getElementById('load');

function bild() {
  const jetzt = performance.now(), dt = Math.min(0.1, (jetzt - alt) / 1000);
  alt = jetzt;
  fpsT += dt; fpsN++; if (fpsT > 0.5) { fps = fpsN / fpsT; fpsT = 0; fpsN = 0; }

  oben.copy(cam).normalize();
  const grund = boden(cam);
  let hoeheBoden = cam.length() - R - grund;

  // Bewegung
  vorn.projectOnPlane(oben).normalize();
  blick.copy(vorn).multiplyScalar(Math.cos(neigung)).addScaledVector(oben, Math.sin(neigung));
  rechts.crossVectors(vorn, oben).normalize();
  const tempo = Math.max(3, hoeheBoden * 1.2) * 2 ** (+tempoEl.value);
  let vor = -stick.y, seit = stick.x, hoch = hochRunter;
  if (tasten.has('KeyW') || tasten.has('ArrowUp')) vor += 1;
  if (tasten.has('KeyS') || tasten.has('ArrowDown')) vor -= 1;
  if (tasten.has('KeyD')) seit += 1;
  if (tasten.has('KeyA')) seit -= 1;
  if (tasten.has('ArrowLeft')) drehe(1.5 * dt, 0);
  if (tasten.has('ArrowRight')) drehe(-1.5 * dt, 0);
  if (tasten.has('Space') || tasten.has('KeyE')) hoch += 1;
  if (tasten.has('ShiftLeft') || tasten.has('KeyQ')) hoch -= 1;
  if (vor || seit || hoch) auto = null;
  const schritt = tmp.set(0, 0, 0).addScaledVector(blick, vor).addScaledVector(rechts, seit).addScaledVector(oben, hoch);
  const altPos = cam.clone();
  cam.addScaledVector(schritt, tempo * dt);

  if (auto) { // Orbit-Test
    const ziel = auto.stufen[0];
    const neu = Math.exp(THREE.MathUtils.lerp(Math.log(Math.max(hoeheBoden, 0.5)), Math.log(ziel), 1 - Math.exp(-dt * 0.9)));
    cam.copy(auto.punkt).multiplyScalar(R + grund + neu);
    neigung = -THREE.MathUtils.degToRad(THREE.MathUtils.lerp(6, 89, THREE.MathUtils.smoothstep(Math.log10(neu), 0.5, 4.8)));
    if (Math.abs(Math.log(neu / ziel)) < 0.04) { auto.pause += dt; if (auto.pause > 0.6) { auto.stufen.shift(); auto.pause = 0; if (!auto.stufen.length) auto = null; } }
  }
  // Nie unter den Boden (Augenhöhe 1,7 m), nie zu weit weg
  oben.copy(cam).normalize();
  const g2 = boden(cam);
  const minR = R + g2 + 1.7, maxR = R + 3e7;
  const lc = cam.length();
  if (lc < minR) cam.setLength(minR); else if (lc > maxR) cam.setLength(maxR);
  hoeheBoden = cam.length() - R - g2;
  tempoAnzeige = THREE.MathUtils.lerp(tempoAnzeige, cam.distanceTo(altPos) / Math.max(dt, 1e-3), 0.1);

  // Kacheln wählen (10× pro Sekunde reicht)
  wahlT += dt;
  if (wahlT > 0.1) {
    wahlT = 0;
    const wunsch = waehleKacheln([cam.x, cam.y, cam.z], { R, maxStufe: MAX_STUFE }).filter((k) => !k.verdeckt);
    info = strom.update(wunsch);
  }
  if (!worker.length) hauptBau(geladen ? 8 : 30);

  // Floating Origin: Kamera im Ursprung, Welt verschoben
  for (const m of strom.sichtbar()) {
    const c = m.userData.mitte;
    m.position.set(c[0] - cam.x, c[1] - cam.y, c[2] - cam.z);
  }
  atmo.position.set(-cam.x, -cam.y, -cam.z);
  camera.position.set(0, 0, 0);
  camera.up.copy(oben);
  camera.lookAt(blick);

  // Himmel, Nebel, Licht nach Höhe und Tageszeit
  const ueberMeer = cam.length() - R;
  const raum = THREE.MathUtils.smoothstep(ueberMeer, ATMO * 0.25, ATMO * 1.3);
  const tag = THREE.MathUtils.smoothstep(oben.dot(SONNE), -0.2, 0.25);
  himmel.copy(nacht).lerp(blau, tag).lerp(schwarz, raum);
  scene.background = himmel;
  scene.fog.color.copy(himmel);
  scene.fog.density = (1 - raum) * (2.6 / (R * 0.35));
  atmo.visible = ueberMeer > ATMO * 0.6;
  sterne.visible = raum > 0.5 || tag < 0.3;
  himmelLicht.position.copy(oben);
  himmelLicht.intensity = 0.25 + 0.55 * tag * (1 - raum);

  renderer.render(scene, camera);

  if (!geladen && (info.angezeigt > 0 && info.offen < 8 || jetzt > 8000)) { geladen = true; ladeEl.remove(); }
  else if (!geladen) ladeEl.querySelector('i').textContent = `${info.angezeigt} Kacheln`;

  const r = renderer.info.render;
  hud.textContent =
    `Höhe        ${laenge(Math.max(0, hoeheBoden))} über Boden\n` +
    `Meereshöhe  ${laenge(Math.max(0, g2))} Boden · ${laenge(Math.max(0, ueberMeer))} Kamera\n` +
    `Tempo       ${Math.round(tempoAnzeige * 3.6).toLocaleString('de-DE')} km/h\n` +
    `Kacheln     ${info.angezeigt} sichtbar · ${info.gebaut} gebaut · ${info.offen} offen\n` +
    `Bau         ${worker.length ? worker.length + ' Worker' : 'Hauptthread'} · ${(bauMs / Math.max(1, bauN)).toFixed(1)} ms/Kachel\n` +
    `Planet      R ${laenge(R)} · Seed ${SEED} · Stufen 0–${MAX_STUFE}\n` +
    `Dreiecke    ${r.triangles.toLocaleString('de-DE')} · ${r.calls} Draw-Calls · ${fps.toFixed(0)} fps`;
  requestAnimationFrame(bild);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
setzeOrt(P.get('ort') || 'orbit');
requestAnimationFrame(bild);
