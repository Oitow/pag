// Figuren-Galerie: alle Vorlagen nebeneinander, um das Aussehen zu vergleichen (organisch ↔ Blöcke).
// URL: ?koerper=bloecke · ?nur=magier,ritter · ?clip=winken · ?dreh=0.6 (rad) · ?nah=1 (eine Figur groß) · ?seite=1 (von der Seite)
import * as THREE from 'three';
import { createCharacter } from '../../../engine/gameplay/character.js';
import { VORLAGEN, randomLook } from '../../../engine/models/character/character-look.js';
import { hashSeed } from '../../../engine/core/rng.js';

const url = new URLSearchParams(location.search);
let art = url.get('koerper') === 'bloecke' ? 'bloecke' : 'organisch';
const namen = url.get('nur') ? url.get('nur').split(',') : Object.keys(VORLAGEN);
const looks = namen.map((n) => (VORLAGEN[n] ? { ...VORLAGEN[n] } : randomLook(hashSeed('galerie', n))));

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const szene = new THREE.Scene();
szene.background = new THREE.Color(0x8fb8d8);
szene.add(new THREE.HemisphereLight(0xd8e8ff, 0x6a5a40, 1.1));
const sonne = new THREE.DirectionalLight(0xfff0d8, 2.2);
sonne.position.set(4, 8, 6); sonne.castShadow = true;
sonne.shadow.mapSize.set(2048, 2048);
Object.assign(sonne.shadow.camera, { left: -12, right: 12, top: 6, bottom: -2, near: 0.5, far: 30 });
szene.add(sonne);
const boden = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshStandardMaterial({ color: 0x9a8a64, roughness: 1 }));
boden.rotation.x = -Math.PI / 2; boden.receiveShadow = true; szene.add(boden);
const welt = { bodenHoehe: () => 0 };

const proReihe = url.get('nah') ? 1 : Math.min(looks.length, Math.ceil(Math.sqrt(looks.length * 1.6)));
const ab = 1.1, figuren = [];
let dreh = +(url.get('dreh') ?? 0) + (url.get('seite') ? Math.PI / 2 : 0);
function aufbauen() {
  for (const f of figuren) f.dispose();
  figuren.length = 0;
  const t0 = performance.now();
  looks.forEach((look, i) => {
    const r = Math.floor(i / proReihe), s = i % proReihe;
    const pos = { x: (s - (proReihe - 1) / 2) * ab, y: 0, z: -r * ab * 1.6 };
    const fig = createCharacter({ look, seed: 3 + i, welt, pos, yaw: dreh, aussehen: art, zelle: url.get('nah') ? 0.009 : 0.012 });
    szene.add(fig.root);
    if (url.get('clip')) fig.spiele(url.get('clip'), { schleife: true });
    figuren.push(fig);
  });
  document.getElementById('info').textContent = `${art} · ${figuren.length} Figuren · ${Math.round(performance.now() - t0)} ms`;
  document.getElementById('art').textContent = art === 'organisch' ? '🫧 organisch' : '🧱 Blöcke';
}
aufbauen();

const reihen = Math.ceil(looks.length / proReihe);
const kamera = new THREE.PerspectiveCamera(url.get('nah') ? 30 : 40, innerWidth / innerHeight, 0.1, 100);
function kameraSetzen() {
  kamera.aspect = innerWidth / innerHeight;
  if (url.get('nah')) { kamera.position.set(0, 1.3, 3.4); kamera.lookAt(0, 1.0, 0); }
  else {
    const breite = proReihe * ab, d = Math.max(breite / kamera.aspect, reihen * 1.6) * 1.15 + 2;
    kamera.position.set(0, 1.6 + reihen * 0.8, d); kamera.lookAt(0, 0.9, -(reihen - 1) * ab * 0.8);
  }
  kamera.updateProjectionMatrix();
}
kameraSetzen();
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); kameraSetzen(); });
document.getElementById('art').onclick = () => { art = art === 'organisch' ? 'bloecke' : 'organisch'; aufbauen(); };
let drehen = false;
document.getElementById('dreh').onclick = () => { drehen = !drehen; };
const clips = ['winken', 'jubeln', 'schlagen', 'hacken', 'werfen'];
let ci = 0;
document.getElementById('clip').onclick = () => { for (const f of figuren) f.spiele(clips[ci % clips.length]); ci++; };

let zeit = performance.now();
function bild(t) {
  const dt = Math.min(0.05, (t - zeit) / 1000); zeit = t;
  if (drehen) dreh += dt * 0.8;
  for (const f of figuren) { f.update(dt, { x: 0, z: 0, blickYaw: dreh }); f.root.rotation.y = dreh; }
  renderer.render(szene, kamera);
  requestAnimationFrame(bild);
}
requestAnimationFrame(bild);
