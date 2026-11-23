// Asset-Galerie der Enklave: alle Bau-Assets im Raster auf einer Wiese. Orbit-Kamera (Ziehen, Zoom/Pinch), Kollision, Anker, Variante/Seed.
// Abfrage: ?sel=<Name-Teil> wählt vor, ?kol ?anker schalten die Ansichten ein.
import * as THREE from 'three';
import { standardMaterial } from '../../../engine/render/mesh-builder.js';
import { GEBAEUDE } from './galerie-gebaeude.js';

let KLEIN = [];
try { KLEIN = (await import('./galerie-kleinkram.js')).KLEINKRAM ?? []; } catch (e) { KLEIN = []; }

const $ = (id) => document.getElementById(id), q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const szene = new THREE.Scene();
szene.background = new THREE.Color('#bcd8ee');
szene.fog = new THREE.Fog('#bcd8ee', 90, 260);
const kamera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
szene.add(new THREE.HemisphereLight('#eef4ff', '#6b7a4a', 1.1));
const sonne = new THREE.DirectionalLight('#fff0d0', 2.2);
sonne.position.set(-30, 60, 40); sonne.castShadow = true; sonne.shadow.mapSize.set(2048, 2048);
Object.assign(sonne.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 200 }); sonne.shadow.bias = -0.0005;
szene.add(sonne);
const wiese = new THREE.Mesh(new THREE.CircleGeometry(300, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#6f9a4a', roughness: 1, flatShading: true }));
wiese.receiveShadow = true; szene.add(wiese);

const MAT = standardMaterial(), MAT_LEUCHT = new THREE.MeshBasicMaterial({ vertexColors: true });
const KOL_MAT = new THREE.LineBasicMaterial({ color: '#ff3040', depthTest: false, transparent: true });
const ANK_FARBE = { tuer: 0x40ff60, fackeln: 0xff9020, licht: 0xffee40, station: 0x40a0ff, wachen: 0xff4040, sitz: 0xc060ff, fluegel: 0xffffff, kamin: 0x909090, banner: 0xff60c0, schild: 0x20e0e0, griff: 0xffffff };
const ANK_GEO = new THREE.SphereGeometry(0.14, 8, 6);

// ---- Raster: Gebäude groß, Kleinkram klein ----
const eintraege = [];
function raster(liste, zelle, spalten, z0) {
  liste.forEach((def, i) => {
    const sp = i % spalten, reihe = Math.floor(i / spalten), n = Math.min(spalten, liste.length - reihe * spalten);
    eintraege.push({ def: { ...def, opts: { ...def.opts } }, gruppe: new THREE.Group(), x: (sp - (n - 1) / 2) * zelle, z: z0 + reihe * zelle, zelle });
  });
  return z0 + Math.ceil(liste.length / spalten) * zelle;
}
const zEnde = raster(GEBAEUDE, 17, 4, 0);
raster(KLEIN, 6, 9, zEnde + 3);
const zMitte = (eintraege.length ? eintraege[eintraege.length - 1].z : 0) / 2;

function beschrifte(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 48;
  const g = c.getContext('2d'); g.font = 'bold 26px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(16,20,30,.7)'; g.fillRect(0, 4, 256, 40); g.fillStyle = '#fff'; g.fillText(text, 128, 25);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(3.2, 0.6, 1); s.renderOrder = 10; return s;
}

let zeigeKol = q.has('kol'), zeigeAnker = q.has('anker'), gewaehlt = -1;
function entsorge(e) { for (const k of [...e.gruppe.children]) { e.gruppe.remove(k); k.geometry?.dispose?.(); } e.asset?.dispose(); e.asset = null; }

function baue(e) {
  entsorge(e);
  const a = e.asset = e.def.fabrik(e.def.opts), m = a.masse;
  e.gruppe.position.set(e.x, 0, e.z); szene.add(e.gruppe);
  const mesh = new THREE.Mesh(a.geometrie.clone(), MAT); mesh.castShadow = mesh.receiveShadow = true; mesh.userData.eintrag = e; e.gruppe.add(mesh);
  if (a.leucht) e.gruppe.add(new THREE.Mesh(a.leucht.clone(), MAT_LEUCHT));
  const kol = new THREE.Group(); kol.userData.art = 'kol';
  for (const k of a.kollision) {
    const g = k.form === 'kreis' ? new THREE.CylinderGeometry(k.radius, k.radius, k.hoehe, 16) : new THREE.BoxGeometry(2 * k.bx, k.hoehe, 2 * k.bz);
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(g), KOL_MAT); g.dispose();
    l.position.set(k.x, k.y0 + k.hoehe / 2, k.z); l.rotation.y = k.winkel || 0; l.renderOrder = 9; kol.add(l);
  }
  const ank = new THREE.Group(); ank.userData.art = 'anker';
  for (const [name, wert] of Object.entries(a.anker || {})) for (const p of Array.isArray(wert) ? wert : [wert]) {
    if (!p || typeof p !== 'object' || typeof p.x !== 'number') continue;
    const s = new THREE.Mesh(ANK_GEO, new THREE.MeshBasicMaterial({ color: ANK_FARBE[name] ?? 0xffffff, depthTest: false }));
    s.position.set(p.x, p.y ?? 1, p.z ?? 0); s.renderOrder = 11; ank.add(s);
  }
  const text = beschrifte(e.def.name); text.position.set(0, 0.3, Math.max(m.tiefe, 1) / 2 + 0.9); e.gruppe.add(text);
  e.gruppe.add(kol, ank); e.kol = kol; e.ank = ank; sichtbar(e);
}
function sichtbar(e) { e.kol.visible = zeigeKol; e.ank.visible = zeigeAnker; }
eintraege.forEach(baue);

// ---- Auswahl + Info ----
function info() {
  const e = eintraege[gewaehlt];
  if (!e) { $('info').textContent = `${eintraege.length} Assets · ${eintraege.reduce((s, x) => s + x.asset.dreiecke, 0)} Dreiecke gesamt · Tippen wählt`; return; }
  const a = e.asset, m = a.masse;
  $('info').textContent = `${e.def.name} · Variante ${e.def.opts.variante ?? 0} · Seed ${e.def.opts.seed ?? 1} · ${a.dreiecke} Dreiecke · ${m.breite.toFixed(1)}×${m.tiefe.toFixed(1)}×${m.hoehe.toFixed(1)} m`;
}
const ANSICHT = { x: 0, y: 0, z: zMitte + 4, dist: 85 }, ziel = { ...ANSICHT }, cam = { ...ziel, theta: 0.2, phi: 0.8 };
function waehle(i) {
  gewaehlt = i; info();
  if (i < 0) { Object.assign(ziel, ANSICHT); return; }
  const e = eintraege[i], m = e.asset.masse;
  Object.assign(ziel, { x: e.x, y: m.hoehe / 2, z: e.z, dist: Math.max(m.breite, m.tiefe, m.hoehe) * 1.9 + 3 });
}
const umschalten = (id, an) => $(id).classList.toggle('an', an);
$('b-kol').onclick = () => { zeigeKol = !zeigeKol; umschalten('b-kol', zeigeKol); eintraege.forEach(sichtbar); };
$('b-ank').onclick = () => { zeigeAnker = !zeigeAnker; umschalten('b-ank', zeigeAnker); eintraege.forEach(sichtbar); };
$('b-vor').onclick = () => waehle((gewaehlt + 1) % eintraege.length);
$('b-zur').onclick = () => waehle(gewaehlt <= 0 ? eintraege.length - 1 : gewaehlt - 1);
$('b-alle').onclick = () => waehle(-1);
const aendere = (fn) => { (gewaehlt < 0 ? eintraege : [eintraege[gewaehlt]]).forEach((e) => { fn(e.def); baue(e); }); info(); };
$('b-var').onclick = () => aendere((d) => { d.opts.variante = ((d.opts.variante ?? 0) + 1) % (d.varianten ?? 4); });
$('b-seed').onclick = () => aendere((d) => { d.opts.seed = (d.opts.seed ?? 1) % 99 + 1; });
umschalten('b-kol', zeigeKol); umschalten('b-ank', zeigeAnker);
if (q.get('sel')) waehle(Math.max(-1, eintraege.findIndex((e) => e.def.name.toLowerCase().includes(q.get('sel').toLowerCase())))); else info();

// ---- Orbit-Kamera: 1 Finger drehen, 2 Finger zoomen + verschieben, Rad zoomt, Tippen wählt ----
const zeiger = new Map(), ray = new THREE.Raycaster(), el = renderer.domElement;
let tippStart = null, letzterAbstand = 0;
const mitte = () => { const p = [...zeiger.values()]; return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2, d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) }; };
el.addEventListener('pointerdown', (ev) => {
  el.setPointerCapture(ev.pointerId); zeiger.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  tippStart = zeiger.size === 1 ? { x: ev.clientX, y: ev.clientY, t: performance.now() } : null;
  if (zeiger.size === 2) letzterAbstand = mitte().d;
});
el.addEventListener('pointermove', (ev) => {
  const p = zeiger.get(ev.pointerId); if (!p) return;
  const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
  if (zeiger.size === 1) { ziel.theta = cam.theta = cam.theta - dx * 0.006; ziel.phi = cam.phi = Math.min(1.5, Math.max(0.1, cam.phi - dy * 0.005)); p.x = ev.clientX; p.y = ev.clientY; return; }
  const alt = mitte(); p.x = ev.clientX; p.y = ev.clientY; const neu = mitte();
  ziel.dist = Math.min(220, Math.max(2, ziel.dist * (alt.d / Math.max(neu.d, 1))));
  const s = ziel.dist * 0.0016, r = [Math.cos(cam.theta), -Math.sin(cam.theta)], f = [Math.sin(cam.theta), Math.cos(cam.theta)];
  ziel.x -= ((neu.x - alt.x) * r[0] + (neu.y - alt.y) * f[0]) * s; ziel.z -= ((neu.x - alt.x) * r[1] + (neu.y - alt.y) * f[1]) * s;
});
const ende = (ev) => {
  zeiger.delete(ev.pointerId);
  if (tippStart && ev.type === 'pointerup' && Math.hypot(ev.clientX - tippStart.x, ev.clientY - tippStart.y) < 6 && performance.now() - tippStart.t < 400) {
    ray.setFromCamera(new THREE.Vector2(ev.clientX / innerWidth * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1), kamera);
    const t = ray.intersectObjects(eintraege.map((e) => e.gruppe.children[0]), false)[0];
    waehle(t ? eintraege.indexOf(t.object.userData.eintrag) : -1);
  }
  tippStart = null;
};
el.addEventListener('pointerup', ende); el.addEventListener('pointercancel', ende);
el.addEventListener('wheel', (ev) => { ev.preventDefault(); ziel.dist = Math.min(220, Math.max(2, ziel.dist * Math.exp(ev.deltaY * 0.001))); }, { passive: false });

function groesse() { renderer.setSize(innerWidth, innerHeight); kamera.aspect = innerWidth / innerHeight; kamera.updateProjectionMatrix(); }
addEventListener('resize', groesse); groesse();
let zuletzt = performance.now();
renderer.setAnimationLoop((jetzt) => {
  const dt = Math.min(0.1, (jetzt - zuletzt) / 1000), k = 1 - Math.exp(-8 * dt); zuletzt = jetzt;
  for (const key of ['x', 'y', 'z', 'dist']) cam[key] += (ziel[key] - cam[key]) * k;
  kamera.position.set(cam.x + Math.sin(cam.theta) * Math.sin(cam.phi) * cam.dist, cam.y + Math.cos(cam.phi) * cam.dist, cam.z + Math.cos(cam.theta) * Math.sin(cam.phi) * cam.dist);
  kamera.lookAt(cam.x, cam.y, cam.z);
  renderer.render(szene, kamera);
});
window.__galerie = { eintraege, waehle };
