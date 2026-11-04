// Boss-Labor: zeigt einen Boss nach dem anderen mit Idle / Laufen / Angriff.
// URL: ?boss=<id|nr>&anim=idle|walk|attack&p=<0..1 Angriff einfrieren>&rot=0
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { partikelPx, Partikel, lerp } from './helfer.js';
import { BOSSE } from './bosse/index.js';

const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);

const szene = new THREE.Scene();
szene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const kamera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 300);
const steuerung = new OrbitControls(kamera, renderer.domElement);
steuerung.enableDamping = true; steuerung.maxPolarAngle = Math.PI * 0.49; steuerung.enablePan = false;
steuerung.autoRotate = q.get('rot') !== '0'; steuerung.autoRotateSpeed = 0.6;

// Himmel als Farbverlauf-Kugel
const himmelMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { oben: { value: new THREE.Color() }, unten: { value: new THREE.Color() } },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'uniform vec3 oben, unten; varying vec3 vP; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(unten, oben, smoothstep(-0.05, 0.6, h)), 1.); }',
});
const himmel = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), himmelMat);
szene.add(himmel);
szene.fog = new THREE.Fog(0x000000, 25, 70);

// Boden mit Kachel-Textur, die beim Laufen „unter dem Boss durchrollt“
const bc = document.createElement('canvas'); bc.width = bc.height = 256;
{
  const g = bc.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3); }
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 3;
  for (let i = 0; i <= 256; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 8, 0, 7); g.fill(); }
}
const bodenTex = new THREE.CanvasTexture(bc);
bodenTex.wrapS = bodenTex.wrapT = THREE.RepeatWrapping; bodenTex.repeat.set(30, 30);
bodenTex.colorSpace = THREE.SRGBColorSpace; bodenTex.anisotropy = 4;
const BODEN = 120;
const boden = new THREE.Mesh(new THREE.CircleGeometry(BODEN / 2, 64), new THREE.MeshStandardMaterial({ map: bodenTex, roughness: 0.95 }));
boden.rotation.x = -Math.PI / 2; boden.receiveShadow = true;
szene.add(boden);

szene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.9));
const sonne = new THREE.DirectionalLight(0xffffff, 2.2);
sonne.position.set(6, 12, 8); sonne.castShadow = true;
sonne.shadow.mapSize.set(2048, 2048);
Object.assign(sonne.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
sonne.shadow.bias = -0.0005; sonne.shadow.normalBias = 0.03;
szene.add(sonne);

// Gemeinsame Effekte: Schockwellen-Ring + Staub beim Treffer, Kamera-Wackeln
const ringe = [];
const staub = new Partikel(200, { additiv: false });
szene.add(staub.obj);
function treffer(pos, farbe = 0xffffff, staerke = 1) {
  const r = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: farbe, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  r.rotation.x = -Math.PI / 2; r.position.set(pos.x, 0.05, pos.z); r.userData.t = 0; r.userData.s = staerke;
  szene.add(r); ringe.push(r);
  for (let i = 0; i < 30 * staerke; i++) {
    const a = Math.random() * 6.28, v = 1.5 + Math.random() * 3;
    staub.emit({ x: pos.x, y: 0.2, z: pos.z }, { x: Math.cos(a) * v, y: 1 + Math.random() * 2, z: Math.sin(a) * v }, 0.8 + Math.random() * 0.6, 0.35 + Math.random() * 0.4, aktiv.def.staub ?? 0x9a8f80);
  }
  wackeln = 0.35 * staerke;
}
let wackeln = 0;

// ---------- Boss-Verwaltung ----------
let aktiv = null;
const st = { dt: 0, zeit: 0, w: { idle: 1, walk: 0 }, phase: 0, p: -1, treffer: false, kamera, szene, renderer };
let basis = q.get('anim') === 'walk' ? 'walk' : 'idle';
const pFix = q.has('p') ? +q.get('p') : null;

function entsorgen(o) {
  o.traverse(c => { c.geometry?.dispose?.(); [].concat(c.material || []).forEach(m => { m.map?.dispose(); m.dispose(); }); });
}
function waehle(i) {
  i = (i + BOSSE.length) % BOSSE.length;
  if (aktiv) { szene.remove(aktiv.gruppe); entsorgen(aktiv.gruppe); }
  const def = BOSSE[i];
  const inst = def.erzeuge({ kamera, szene, renderer });
  aktiv = { i, def, ...inst };
  szene.add(aktiv.gruppe);
  himmelMat.uniforms.oben.value.set(def.himmel[0]);
  himmelMat.uniforms.unten.value.set(def.himmel[1]);
  szene.fog.color.set(def.himmel[1]);
  boden.material.color.set(def.boden);
  const h = def.groesse;
  const winkel = 0.55;
  kamera.position.set(Math.sin(winkel) * h * 2.3, h * 0.85, Math.cos(winkel) * h * 2.3);
  steuerung.target.set(0, h * 0.45, 0);
  steuerung.minDistance = h * 1.0; steuerung.maxDistance = h * 5;
  st.p = -1; st.phase = 0;
  document.getElementById('titel').textContent = `${def.emoji} ${def.name}`;
  document.getElementById('info').innerHTML = `<b>${def.stil}</b><b>${def.technik}</b>`;
  [...liste.children].forEach((b, j) => b.classList.toggle('an', j === i));
  liste.children[i].scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
  const u = new URL(location); u.searchParams.set('boss', def.id); history.replaceState(null, '', u);
}

const liste = document.getElementById('liste');
BOSSE.forEach((b, i) => {
  const k = document.createElement('button');
  k.textContent = `${b.emoji} ${b.name}`;
  k.onclick = () => waehle(i);
  liste.appendChild(k);
});
function setzeAnim(a) {
  if (a === 'attack') { if (st.p < 0) st.p = 0; }
  else basis = a;
  zeigeKnoepfe();
}
function zeigeKnoepfe() {
  document.querySelectorAll('#anim button').forEach(b => b.classList.toggle('an', b.dataset.a === (st.p >= 0 ? 'attack' : basis) || (b.dataset.a === basis && st.p < 0)));
}
document.querySelectorAll('#anim button').forEach(b => b.onclick = () => setzeAnim(b.dataset.a));
document.getElementById('drehen').onclick = () => { steuerung.autoRotate = !steuerung.autoRotate; };
addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') waehle(aktiv.i + 1);
  if (e.key === 'ArrowLeft') waehle(aktiv.i - 1);
  if (e.key === '1') setzeAnim('idle');
  if (e.key === '2') setzeAnim('walk');
  if (e.key === '3' || e.key === ' ') setzeAnim('attack');
});

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  kamera.aspect = innerWidth / innerHeight; kamera.updateProjectionMatrix(); px();
});
function px() { partikelPx.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(kamera.fov) / 2)); }
px();

const start = q.get('boss');
const si = BOSSE.findIndex(b => b.id === start);
waehle(si >= 0 ? si : (start && !isNaN(+start) ? +start : 0));
if (q.get('anim') === 'attack') setzeAnim('attack');
zeigeKnoepfe();

// ---------- Schleife ----------
const uhr = new THREE.Clock();
const _tp = new THREE.Vector3();
function schleife() {
  const dt = Math.min(uhr.getDelta(), 1 / 20);
  const def = aktiv.def;
  st.dt = dt; st.zeit += dt;
  // Während des Angriffs bleibt der Boss stehen
  const zielWalk = (basis === 'walk' && st.p < 0) ? 1 : 0;
  st.w.walk = lerp(st.w.walk, zielWalk, 1 - Math.exp(-dt * 6));
  st.w.idle = 1 - st.w.walk;
  st.phase += dt * def.schritt * st.w.walk;
  bodenTex.offset.y -= dt * def.tempo * st.w.walk * bodenTex.repeat.y / BODEN;
  st.treffer = false;
  if (st.p >= 0) {
    const alt = st.p;
    st.p = pFix ?? st.p + dt / def.angriffDauer;
    const tz = def.trefferZeit ?? 0.5;
    if (alt < tz && st.p >= tz) st.treffer = true;
    if (st.p >= 1) { st.p = -1; zeigeKnoepfe(); if (q.get('anim') === 'attack' && pFix == null) setTimeout(() => setzeAnim('attack'), 500); }
  }
  aktiv.update(st);
  if (st.treffer && aktiv.trefferPunkt) {
    aktiv.gruppe.localToWorld(_tp.copy(aktiv.trefferPunkt));
    treffer(_tp, def.ring ?? 0xffffff, def.wucht ?? 1);
  }
  for (let i = ringe.length - 1; i >= 0; i--) {
    const r = ringe[i]; r.userData.t += dt;
    const t = r.userData.t / 0.6;
    r.scale.setScalar(0.3 + t * 4 * r.userData.s); r.material.opacity = 1 - t;
    if (t >= 1) { szene.remove(r); r.geometry.dispose(); r.material.dispose(); ringe.splice(i, 1); }
  }
  staub.update(dt, { grav: 4, drag: 2.5, wachsen: 1.5, fade: 1 });
  steuerung.update();
  if (wackeln > 0) {
    wackeln = Math.max(0, wackeln - dt);
    kamera.position.x += (Math.random() - 0.5) * wackeln * 0.6;
    kamera.position.y += (Math.random() - 0.5) * wackeln * 0.6;
  }
  renderer.render(szene, kamera);
  requestAnimationFrame(schleife);
}
schleife();

window.labor = { waehle, setzeAnim, st, get aktiv() { return aktiv; }, renderer, BOSSE };
