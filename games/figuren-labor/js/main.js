// Figuren-Labor: Testgelände für das Figuren-System der Engine (Aussehen, Animation, Bewegung, Kamera, Eingabe, NPC-Steuerung).
import * as THREE from 'three';
import { createWelt } from './welt.js';
import { createEditor } from './editor.js';
import { createCharacter } from '../../../engine/gameplay/character.js';
import { createSteering } from '../../../engine/gameplay/character-steering.js';
import { createMoveInput, zuAbsicht } from '../../../engine/input/move-input.js';
import { createFollowCamera, KAMERA_PRESETS } from '../../../engine/camera/follow-camera.js';
import { waehleZiel, zielPos } from '../../../engine/camera/ziel-wahl.js';
import { createFigurSchilder } from '../../../engine/ui/figur-schild.js';
import { VORLAGEN, randomLook, createLook } from '../../../engine/models/character/character-look.js';
import { CLIP_NAMEN, CLIPS } from '../../../engine/models/character/character-clips.js';
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

const schilder = createFigurSchilder();

// ---- Spieler ----
let gespeichert = null;
try { gespeichert = JSON.parse(localStorage.getItem(SPEICHER) || 'null'); } catch { /* egal */ }
const schritte = { n: 0 };
const spieler = createCharacter({
  look: gespeichert || VORLAGEN.wanderer, seed: SEED, welt: welt.adapter, pos: { x: 0, y: 0, z: 4 }, yaw: Math.PI,
  onSchritt: () => { schritte.n++; }, schilder, name: (gespeichert || VORLAGEN.wanderer).name,
});
// INTEGRATION Ausrüstung (character-ausruestung): hier Start-Ausrüstung anlegen, z. B. spieler.ausruesten('handR', …)
szene.add(spieler.root);

const eingabe = createMoveInput({
  element: renderer.domElement,
  aktionen: [
    { name: 'schlagen', tasten: ['KeyF'], knopf: '⚔', padKnopf: 2 },
    { name: 'winken', tasten: ['KeyG'], padKnopf: 7 },
    'rollen', 'gleiten', 'interagieren', 'ziel',
  ],
  vibration: true,
});
eingabe.zeigeKnopf('interagieren', false);
const kamera = createFollowCamera({ welt: welt.adapter, distanz: 6, erstePerson: true });
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
    const look = randomLook(hashSeed('npc', SEED, i), { kind: i % 4 === 3 });
    const fig = createCharacter({ look, seed: hashSeed('npcseed', i), welt: welt.adapter, pos, yaw: a, schilder, name: look.name });
    // INTEGRATION Brain: statt createSteering → createCharacter({ …, brain: { plan, reaktion, verhalten } }) und
    //   unten n.fig.update(dt, null, { nachbarn, npcs, stunde }) – character.js kann das schon.
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
  onAenderung: (l) => { spieler.setLook(l); spieler.setName(l.name); try { localStorage.setItem(SPEICHER, JSON.stringify(l)); } catch { /* voll/privat */ } },
});
const $ = (id) => document.getElementById(id);
$('bEditor').onclick = () => { editor.zeige(!editor.offen); $('bEditor').classList.toggle('an', editor.offen); eingabe.setAktiv(!editor.offen); };
$('bAktionen').onclick = () => { $('aktionen').classList.toggle('offen'); $('bAktionen').classList.toggle('an'); };
$('bNpc').onclick = () => { npcAn = !npcAn; for (const n of npcs) n.fig.setSichtbar(npcAn); $('bNpc').classList.toggle('an', !npcAn); };
// Kamera-Presets (+ Ich-Sicht durch Reinzoomen am Minimum)
const PRESETS = Object.keys(KAMERA_PRESETS);
let presetNr = 0;
$('bKamera').onclick = () => { presetNr = (presetNr + 1) % PRESETS.length; kamera.setPreset(PRESETS[presetNr]); $('bKamera').textContent = '🎥 ' + PRESETS[presetNr]; };
$('bErste').onclick = () => kamera.setErstePerson(!kamera.erstePerson);
$('bFahrt').onclick = () => kamera.fahrt({ pos: { x: 8, y: 9, z: -22 }, blick: () => spieler.zustand.pos, dauer: 1.5, halten: 2 });
let schilderAn = true;
$('bSchilder').onclick = () => {
  schilderAn = !schilderAn; $('bSchilder').classList.toggle('an', !schilderAn);
  for (const f of [spieler, ...npcs.map(n => n.fig)]) f.schild?.zeige(schilderAn);
};
let infoAn = !TEST && !matchMedia('(pointer: coarse)').matches;
$('bInfo').onclick = () => { infoAn = !infoAn; $('info').style.display = infoAn ? '' : 'none'; };
$('info').style.display = infoAn ? '' : 'none';
// Clip-Liste dynamisch aus character-clips (neue Clips tauchen automatisch auf), gruppiert nach Maske, ↻ = Schleife
function clipListe() {
  const gruppen = {};
  for (const n of CLIP_NAMEN) {
    if (['schwimmen', 'wassertreten'].includes(n) || CLIPS[n]?.idle) continue;   // Idle-Varianten spielt der Animator selbst
    const m = CLIPS[n]?.maske; const g = typeof m === 'string' ? m : 'eigen';
    (gruppen[g] ??= []).push(n);
  }
  const titel = { oben: 'Oberkörper', ganz: 'Ganzer Körper', eigen: 'Sonstige' };
  $('aktionen').innerHTML = '<button data-clip="" class="stopp">⏹ stopp</button>' + Object.entries(gruppen).map(([g, l]) =>
    `<div class="gruppe"><b>${titel[g] || g}</b>${l.map(n => `<button data-clip="${n}">${n}${CLIPS[n]?.schleife ? ' ↻' : ''}</button>`).join('')}</div>`).join('');
}
clipListe();
$('aktionen').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.clip) spieler.spiele(b.dataset.clip); else spieler.stoppe();
  b.blur();
};
// INTEGRATION Ausdrücke: Knopfreihe aus AUSDRUECKE (character-look) → spieler.setAusdruck(name) (Feature-Check ist in character.js)
// Lock-On (T / 🎯): bestes Ziel vorn, erneut drücken = nächstes rechts, nur eins = loslassen
let ziel = null;
function zielWaehlen() {
  const kandidaten = npcAn ? npcs.map(n => n.fig) : [];
  const von = spieler.zustand.pos;
  const neu = ziel ? waehleZiel(kandidaten, { von, blickYaw: kamera.yaw, aktuell: ziel, richtung: 1 }) : waehleZiel(kandidaten, { von, blickYaw: kamera.yaw });
  ziel = neu === ziel ? null : neu;
  kamera.lockOn(ziel ? () => { const p = zielPos(ziel); return { x: p.x, y: p.y + 1.2, z: p.z }; } : null);
}
const GRUESSE = ['Hallo!', 'Na, wie geht\'s?', 'Schönes Labor hier.', 'Ich teste nur …', 'Pass auf die Rampe auf!'];
let grussNr = 0, nahKnopf = false;
const absicht = {};
let stoppAn = false;
$('bStopp').onclick = () => spieler.stoppe();
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
  if (eingabe.gedrueckt('schlagen')) spieler.aktion('schlagen');
  if (eingabe.gedrueckt('winken')) spieler.aktion('winken');
  if (eingabe.gedrueckt('ziel')) zielWaehlen();
  zuAbsicht(e, kamera.blickYaw(), absicht);       // inkl. rollen/gleiten/tauchen-Flags für den Motor
  const zp = ziel && zielPos(ziel);
  absicht.blickYaw = kamera.erstePerson ? kamera.yaw : zp ? Math.atan2(zp.x - spieler.zustand.pos.x, zp.z - spieler.zustand.pos.z) : undefined;
  spieler.update(dt, absicht);
  // Dauer-Clips (tragen, sitzenBoden, schlafen …) laufen bis stoppe() → ⏹ in der Leiste, solange eine Aktion läuft
  const laeuft = !!spieler.animator.aktion;
  if (laeuft !== stoppAn) { stoppAn = laeuft; $('bStopp').style.display = laeuft ? '' : 'none'; }
  const z = spieler.zustand;
  // NPC in Reichweite → 💬 / E: NPC dreht den Kopf her und antwortet
  let nah = null, best = 3;
  if (npcAn) for (const n of npcs) { const d = spieler.abstandZu(n.fig); if (d < best) { best = d; nah = n; } }
  if (!!nah !== nahKnopf) { nahKnopf = !!nah; eingabe.zeigeKnopf('interagieren', nahKnopf); }
  if (nah && eingabe.gedrueckt('interagieren')) {
    spieler.sage('Hallo!', { geste: 'winken' });
    nah.fig.blickZu(spieler); nah.fig.sage(GRUESSE[grussNr++ % GRUESSE.length], { geste: 'nicken' }); nah.blickZeit = 4;
  }
  if (z.landung > 9) kamera.schuetteln(Math.min(1, z.landung / 20), 0.3);

  if (npcAn) {
    nachbarn.length = 0;
    nachbarn.push({ x: z.pos.x, z: z.pos.z, radius: spieler.model.masse.radius });
    for (const n of npcs) nachbarn.push({ x: n.fig.zustand.pos.x, z: n.fig.zustand.pos.z, radius: n.fig.model.masse.radius });
    for (const n of npcs) {
      const absicht = n.hirn.update(dt, n.fig.zustand, nachbarn.filter(q => q.x !== n.fig.zustand.pos.x || q.z !== n.fig.zustand.pos.z));
      n.fig.update(dt, absicht);
      if (n.blickZeit > 0 && (n.blickZeit -= dt) <= 0) n.fig.blickZu(null);
      if (n.hirn.modus === 'folgen' && n.hirn.angekommen && (n.pause -= dt) < 0) { n.fig.spiele('winken'); n.pause = 12; }
    }
  }

  kamera.update(dt, z.pos, { tempo: z.tempo, sprintet: z.sprintet, yaw: z.yaw, amBoden: z.amBoden, augenHoehe: spieler.model.masse.augenHoehe });
  spieler.setSichtbar(!kamera.figurAusblenden);
  if (schilderAn) spieler.schild?.zeige(!kamera.erstePerson);
  schilder.update(kamera.kamera, dt);
  sonne.position.set(z.pos.x + 12, z.pos.y + 25, z.pos.z + 8);
  sonne.target.position.set(z.pos.x, z.pos.y, z.pos.z);

  if (infoAn) $('info').textContent =
    `${fps} fps · ${spieler.look.name}\n` +
    `Tempo ${z.tempo.toFixed(1)} m/s ${z.sprintet ? 'Sprint' : ''}${z.duckt ? ' Ducken' : ''}\n` +
    `${z.imWasser ? 'Schwimmen' : z.amBoden ? (z.rutscht ? 'Rutschen' : 'Boden') : 'Luft'} · y ${z.pos.y.toFixed(2)} · Schritte ${schritte.n}\n` +
    `Aktion ${spieler.animator.aktion || '–'} · Eingabe ${e.aktiv}\n` +
    `Kamera ${kamera.erstePerson ? 'Ich-Sicht' : kamera.preset}${ziel ? ' · Ziel ' + ziel.name : ''}${z.rollt ? ' · Rolle' : ''}${z.gleitet ? ' · Gleiten' : ''}`;

  renderer.render(szene, kamera.kamera);
  requestAnimationFrame(bild);
}
requestAnimationFrame(bild);

// Für Tests/Debug
window.labor = { spieler, npcs, kamera, eingabe, welt, schilder, createLook, clipListe };
