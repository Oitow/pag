// Figuren-Labor: Testgelände für das Figuren-System der Engine (Aussehen, Animation, Bewegung, Kamera, Eingabe, NPC-Steuerung).
import * as THREE from 'three';
import { createWelt } from './welt.js';
import { createEditor } from './editor.js';
import { createCharacter } from '../../../engine/gameplay/character.js';
import { createSteering } from '../../../engine/gameplay/character-steering.js';
import { createMoveInput } from '../../../engine/input/move-input.js';
import { createFollowCamera } from '../../../engine/camera/follow-camera.js';
import { VORLAGEN, randomLook, createLook } from '../../../engine/models/character/character-look.js';
import { CLIP_NAMEN } from '../../../engine/models/character/character-clips.js';
import { hashSeed, rng, range } from '../../../engine/core/rng.js';

const url = new URLSearchParams(location.search);
const SEED = +url.get('seed') || 1;
const TEST = url.has('test');
const SPEICHER = 'figuren-labor:look';

// ---- Renderer & Szene ----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

const szene = new THREE.Scene();
szene.background = new THREE.Color('#9ec8e8');
szene.fog = new THREE.Fog('#9ec8e8', 35, 90);
szene.add(new THREE.HemisphereLight('#dceeff', '#6a5a40', 1.1));
const sonne = new THREE.DirectionalLight('#fff0d8', 2.2);
sonne.castShadow = true;
sonne.shadow.mapSize.set(1024, 1024);
Object.assign(sonne.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
szene.add(sonne, sonne.target);

const welt = createWelt(SEED);
szene.add(welt.gruppe);

// ---- Spieler ----
let gespeichert = null;
try { gespeichert = JSON.parse(localStorage.getItem(SPEICHER) || 'null'); } catch { /* egal */ }
const schritte = { n: 0 };
const spieler = createCharacter({
  look: gespeichert || VORLAGEN.wanderer, seed: SEED, welt: welt.adapter, pos: { x: 0, y: 0, z: 4 }, yaw: Math.PI,
  onSchritt: () => { schritte.n++; },
});
szene.add(spieler.root);

const eingabe = createMoveInput({
  element: renderer.domElement,
  aktionen: [
    { name: 'schlagen', tasten: ['KeyF'], knopf: '⚔', padKnopf: 2 },
    { name: 'winken', tasten: ['KeyG'], knopf: '👋', padKnopf: 3 },
  ],
});
const kamera = createFollowCamera({ bodenHoehe: welt.adapter.bodenHoehe, distanz: 6 });
kamera.kamera.aspect = innerWidth / innerHeight;
kamera.kamera.updateProjectionMatrix();

// ---- NPCs ----
const npcs = [];
let npcAn = true;
function npcsErzeugen() {
  const r = rng(hashSeed('npcs', SEED));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, d = range(r, 7, 16);
    const pos = { x: Math.cos(a) * d, y: 0, z: Math.sin(a) * d };
    const fig = createCharacter({ look: randomLook(hashSeed('npc', SEED, i), { kind: i % 4 === 3 }), seed: hashSeed('npcseed', i), welt: welt.adapter, pos, yaw: a });
    const hirn = createSteering({ seed: hashSeed('hirn', SEED, i), heimat: { x: pos.x, z: pos.z } });
    if (i === 0) hirn.folge(() => spieler.zustand.pos, 2.5);
    else if (i === 1) hirn.folgePfad([{ x: -3, z: 2 }, { x: 0, z: -9 }, { x: 0, z: -17 }, { x: 3, z: 2 }], { schleife: true });
    else hirn.wandere({ x: pos.x, z: pos.z }, 8);
    szene.add(fig.root);
    npcs.push({ fig, hirn, pause: range(r, 2, 8) });
  }
}
npcsErzeugen();
const nachbarn = [];

// ---- Oberfläche ----
const editor = createEditor({
  wurzel: document.body, look: spieler.look,
  onAenderung: (l) => { spieler.setLook(l); try { localStorage.setItem(SPEICHER, JSON.stringify(l)); } catch { /* voll/privat */ } },
});
const $ = (id) => document.getElementById(id);
$('bEditor').onclick = () => { editor.zeige(!editor.offen); $('bEditor').classList.toggle('an', editor.offen); eingabe.setAktiv(!editor.offen); };
$('bAktionen').onclick = () => { $('aktionen').classList.toggle('offen'); $('bAktionen').classList.toggle('an'); };
$('bNpc').onclick = () => { npcAn = !npcAn; for (const n of npcs) n.fig.root.visible = npcAn; $('bNpc').classList.toggle('an', !npcAn); };
let infoAn = !TEST && !matchMedia('(pointer: coarse)').matches;
$('bInfo').onclick = () => { infoAn = !infoAn; $('info').style.display = infoAn ? '' : 'none'; };
$('info').style.display = infoAn ? '' : 'none';
$('aktionen').innerHTML = CLIP_NAMEN.filter(n => !['schwimmen', 'wassertreten'].includes(n)).map(n => `<button data-clip="${n}">${n}</button>`).join('') + '<button data-clip="">⏹ stopp</button>';
$('aktionen').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.clip) spieler.spiele(b.dataset.clip); else spieler.stoppe();
};
setTimeout(() => { $('hilfe').style.opacity = 0; }, 7000);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  kamera.kamera.aspect = innerWidth / innerHeight;
  kamera.kamera.updateProjectionMatrix();
});

// ---- Schleife ----
let letzte = performance.now(), fpsZeit = 0, fpsN = 0, fps = 0;
function bild(jetzt) {
  const dt = Math.min((jetzt - letzte) / 1000, 0.1);
  letzte = jetzt;
  fpsZeit += dt; fpsN++;
  if (fpsZeit > 0.5) { fps = Math.round(fpsN / fpsZeit); fpsZeit = 0; fpsN = 0; }

  const e = eingabe.lesen();
  kamera.drehen(e.kameraX, e.kameraY);
  if (e.zoom) kamera.zoomen(e.zoom);
  const richtung = kamera.richtungAusStick(e.x, e.y);
  if (eingabe.gedrueckt('schlagen')) spieler.spiele('schlagen');
  if (eingabe.gedrueckt('winken')) spieler.spiele('winken');
  spieler.update(dt, { x: richtung.x, z: richtung.z, sprint: e.sprint, springen: e.springen, ducken: e.ducken });
  const z = spieler.zustand;
  if (z.landung > 9) kamera.schuetteln(Math.min(1, z.landung / 20), 0.3);

  if (npcAn) {
    nachbarn.length = 0;
    nachbarn.push({ x: z.pos.x, z: z.pos.z, radius: spieler.model.masse.radius });
    for (const n of npcs) nachbarn.push({ x: n.fig.zustand.pos.x, z: n.fig.zustand.pos.z, radius: n.fig.model.masse.radius });
    for (const n of npcs) {
      const absicht = n.hirn.update(dt, n.fig.zustand, nachbarn.filter(q => q.x !== n.fig.zustand.pos.x || q.z !== n.fig.zustand.pos.z));
      n.fig.update(dt, absicht);
      if (n.hirn.modus === 'folgen' && n.hirn.angekommen && (n.pause -= dt) < 0) { n.fig.spiele('winken'); n.pause = 12; }
    }
  }

  kamera.update(dt, z.pos, { tempo: z.tempo, sprintet: z.sprintet, yaw: z.yaw, amBoden: z.amBoden });
  sonne.position.set(z.pos.x + 12, z.pos.y + 25, z.pos.z + 8);
  sonne.target.position.set(z.pos.x, z.pos.y, z.pos.z);

  if (infoAn) $('info').textContent =
    `${fps} fps · ${spieler.look.name}\n` +
    `Tempo ${z.tempo.toFixed(1)} m/s ${z.sprintet ? 'Sprint' : ''}${z.duckt ? ' Ducken' : ''}\n` +
    `${z.imWasser ? 'Schwimmen' : z.amBoden ? (z.rutscht ? 'Rutschen' : 'Boden') : 'Luft'} · y ${z.pos.y.toFixed(2)} · Schritte ${schritte.n}\n` +
    `Aktion ${spieler.animator.aktion || '–'} · Eingabe ${e.aktiv}`;

  renderer.render(szene, kamera.kamera);
  requestAnimationFrame(bild);
}
requestAnimationFrame(bild);

// Für Tests/Debug
window.labor = { spieler, npcs, kamera, eingabe, welt, createLook };
