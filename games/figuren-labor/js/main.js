// Figuren-Labor: Testgelände für das Figuren-System der Engine (Aussehen, Animation, Bewegung, Kamera, Eingabe, NPC-Steuerung).
import * as THREE from 'three';
import { createWelt } from './welt.js';
import { createEditor } from './editor.js';
import { createOberflaeche } from './oberflaeche.js';
import { createZauberSpiel } from './zauber-spiel.js';
import { ZAUBER, ZAUBER_NAMEN } from '../../../engine/gameplay/zauber.js';
import { createCharacter } from '../../../engine/gameplay/character.js';
import { createSteering } from '../../../engine/gameplay/character-steering.js';
import { createMoveInput, zuAbsicht } from '../../../engine/input/move-input.js';
import { createFollowCamera, KAMERA_PRESETS } from '../../../engine/camera/follow-camera.js';
import { waehleZiel, zielPos } from '../../../engine/camera/ziel-wahl.js';
import { createFigurSchilder } from '../../../engine/ui/figur-schild.js';
import { VORLAGEN, randomLook, createLook } from '../../../engine/models/character/character-look.js';
import { CLIP_NAMEN, CLIPS } from '../../../engine/models/character/character-clips.js';
import { hashSeed, rng, range, pick } from '../../../engine/core/rng.js';
import { createAusruestung, ausruestungsNamen } from '../../../engine/models/character/character-ausruestung.js';
import { createPsx } from '../../../engine/render/psx.js';
import { AUSDRUECKE } from '../../../engine/models/character/character-look.js';

const url = new URLSearchParams(location.search);
const SEED = +url.get('seed') || 1;
const SPEICHER = 'figuren-labor:look';

// ---- Renderer & Szene ----
// PS1-Look (engine/render/psx): grobe Pixel, wackelnde Eckpunkte, wenige Farben – im Menü unter „Mehr“ abschaltbar
const PSX_SPEICHER = 'pag-figuren-labor-psx';
let psxAn = true;
try { psxAn = localStorage.getItem(PSX_SPEICHER) !== '0'; } catch { /* privat */ }
const psx = createPsx({ an: psxAn });
const renderer = new THREE.WebGLRenderer({ antialias: !psxAn });   // Kantenglättung passt nicht zu groben Pixeln (gilt ab Neuladen)
const groesseSetzen = () => psx.aufloesung(renderer, innerWidth, innerHeight, { pixelRatio: Math.min(devicePixelRatio, 1.5) });
groesseSetzen();
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
// Ausrüstung (character-ausruestung): je Hand ein Gegenstand (Schild/Buch links, der Rest rechts); nochmal wählen = ablegen
const haende = { handR: null, handL: null };
function setAusruestung(name) {
  const leeren = (s) => { const h = haende[s]; if (h) { spieler.ablegen(h.obj); h.obj.dispose?.(); haende[s] = null; } };
  if (!name) { leeren('handR'); leeren('handL'); return []; }
  const sockel = name === 'schild' || name === 'buch' ? 'handL' : 'handR', gleich = haende[sockel]?.name === name;
  leeren(sockel);
  if (!gleich) {
    const obj = createAusruestung(name, { sockel, seed: SEED, masse: spieler.model.masse });
    spieler.ausruesten(sockel, obj);
    haende[sockel] = { name, obj };
  }
  return Object.values(haende).filter(Boolean).map(h => h.name);
}
szene.add(spieler.root);

const eingabe = createMoveInput({
  element: renderer.domElement,
  aktionen: [
    { name: 'zaubern', tasten: ['KeyR'], knopf: '✨', padKnopf: 7, titel: 'Zaubern' },
    { name: 'schlagen', tasten: ['KeyF'], knopf: '⚔', padKnopf: 2 },
    { name: 'winken', tasten: ['KeyG'], padKnopf: 6 },
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
    // NPC 0 folgt, NPC 1 läuft einen Pfad (character-steering); alle anderen leben mit character-brain
    // (wandern, arbeiten, plaudern, idle-Clips)
    let hirn = null;
    if (i < 2) {
      hirn = createSteering({ seed: hashSeed('hirn', SEED, i), heimat: { x: pos.x, z: pos.z } });
      if (i === 0) hirn.folge(() => spieler.zustand.pos, 2.5);
      else hirn.folgePfad([{ x: -3, z: 2 }, { x: 0, z: -9 }, { x: 0, z: -17 }, { x: 3, z: 2 }], { schleife: true });
    } else {
      fig.setBrain({
        seed: hashSeed('brain', SEED, i), heimat: { x: pos.x, z: pos.z },
        grund: i % 3 === 0
          ? { zustand: 'arbeiten', ort: { x: pos.x, z: pos.z }, clip: pick(r, ['hacken', 'fegen', 'graben', 'haemmern']) }
          : { zustand: 'wandern', radius: 8 },
        verhalten: { plauderChance: 0.05, idleClips: ['umschauen', 'kratzen', 'strecken'] },
      });
    }
    szene.add(fig.root);
    npcs.push({ fig, hirn, pause: range(r, 2, 8) });
  }
}
npcsErzeugen();
const nachbarn = [], brains = [];
const STEHEN = { x: 0, z: 0 };   // Absicht für umgeworfene NPCs: liegen bleiben
const brainKontext = { nachbarn, npcs: brains, stunde: 10, ziele: [] };

// ---- Oberfläche (Handy zuerst): ein ☰-Menü mit Reitern, Zauberleiste, Balken ----
const $ = (id) => document.getElementById(id);
let schilderAn = true, infoAn = false;
const PRESETS = Object.keys(KAMERA_PRESETS);
const ui = createOberflaeche({
  zauber: ZAUBER, ausruestung: ausruestungsNamen, kameras: PRESETS,
  onZauber: (name) => zauber.wirke(name),
  onAusruestung: setAusruestung,
  onKamera: (name) => kamera.setPreset(name),
  onSchalter: (id, an) => {
    if (id === 'npcs') { npcAn = an; for (const n of npcs) n.fig.setSichtbar(an); }
    else if (id === 'schilder') { schilderAn = an; for (const f of [spieler, ...npcs.map(n => n.fig)]) f.schild?.zeige(an); }
    else if (id === 'info') { infoAn = an; $('info').style.display = an ? '' : 'none'; }
    else if (id === 'ichsicht') kamera.setErstePerson(an);
    else if (id === 'freimana') zauber.buch.setFreiesMana(an);
    else if (id === 'psx') {
      psx.setze({ an }); groesseSetzen();
      try { localStorage.setItem(PSX_SPEICHER, an ? '1' : '0'); } catch { /* voll/privat */ }
    }
  },
  onKnopf: (id) => {
    if (id === 'fahrt') { ui.schliesse(); kamera.fahrt({ pos: { x: 8, y: 9, z: -22 }, blick: () => spieler.zustand.pos, dauer: 1.5, halten: 2 }); }
    else if (id === 'treffen') zauber.spielerTreffen(25);
    else if (id === 'heilen') zauber.alleHeilen();
  },
  onOffen: () => setTimeout(bildAusschnitt, 260),
});
const zauber = createZauberSpiel({
  spieler, npcs, npcsAn: () => npcAn, szene, welt: welt.adapter, kamera, lockZiel: () => ziel, seed: SEED, onMeldung: (t) => ui.melde(t),
});
const editor = createEditor({
  wurzel: ui.seite('aussehen'), look: spieler.look,
  onAenderung: (l) => { spieler.setLook(l); spieler.setName(l.name); try { localStorage.setItem(SPEICHER, JSON.stringify(l)); } catch { /* voll/privat */ } },
});
// Beim Tippen (Name) keine Spiel-Eingabe; Zifferntasten 1–0 wählen und wirken sofort
addEventListener('focusin', (e) => { if (e.target.matches?.('input[type=text], .ed-name')) eingabe.setAktiv(false); });
addEventListener('focusout', () => eingabe.setAktiv(true));
addEventListener('keydown', (e) => {
  if (e.target.matches?.('input, select, textarea') || e.repeat) return;
  const m = /^Digit(\d)$/.exec(e.code);
  if (m) { const n = ZAUBER_NAMEN[(+m[1] + 9) % 10]; ui.waehle(n); zauber.wirke(n); }
});
// Offenes Blatt verdeckt die Figur → Bildausschnitt verschieben, damit sie im freien Teil steht
function bildAusschnitt() {
  const v = ui.verdeckt(), k = kamera.kamera;
  if (v.unten || v.links) k.setViewOffset(innerWidth, innerHeight, -v.links / 2, v.unten / 2, innerWidth, innerHeight);
  else k.clearViewOffset();
}
$('info').style.display = 'none';
// Clip-Liste dynamisch aus character-clips (neue Clips tauchen automatisch auf), gruppiert nach Maske, ↻ = Schleife
function clipListe() {
  const gruppen = {};
  for (const n of CLIP_NAMEN) {
    if (['schwimmen', 'wassertreten'].includes(n) || CLIPS[n]?.idle) continue;   // Idle-Varianten spielt der Animator selbst
    const m = CLIPS[n]?.maske; const g = n.startsWith('zauber') ? 'zauber' : typeof m === 'string' ? m : 'eigen';
    (gruppen[g] ??= []).push(n);
  }
  const titel = { oben: 'Oberkörper', ganz: 'Ganzer Körper', eigen: 'Sonstige', zauber: 'Zauber-Gesten' };
  $('aktionen').innerHTML = '<button data-clip="" class="stopp">⏹ stopp</button>' + Object.entries(gruppen).map(([g, l]) =>
    `<div class="gruppe"><b>${titel[g] || g}</b>${l.map(n => `<button data-clip="${n}">${n}${CLIPS[n]?.schleife ? ' ↻' : ''}</button>`).join('')}</div>`).join('');
}
clipListe();
$('aktionen').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.ausdruck) spieler.setAusdruck(b.dataset.ausdruck, { dauer: 4 });
  else if (b.dataset.clip) spieler.spiele(b.dataset.clip); else spieler.stoppe();
  b.blur();
};
// Ausdrücke: Knopfreihe aus AUSDRUECKE (character-look) im Aktionen-Reiter → spieler.setAusdruck(name) für 4 s
function ausdruckReihe() {
  const d = document.createElement('div');
  d.className = 'gruppe';
  d.innerHTML = '<b>Ausdruck</b>' + AUSDRUECKE.map(a => `<button data-ausdruck="${a}">${a}</button>`).join('');
  $('aktionen').appendChild(d);
}
ausdruckReihe();
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
setTimeout(() => { $('hilfe').style.opacity = 0; }, 9000);

addEventListener('resize', () => {
  groesseSetzen();
  kamera.kamera.aspect = innerWidth / innerHeight;
  bildAusschnitt();
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
  if (eingabe.gedrueckt('zaubern')) zauber.wirke(ui.gewaehlt);
  absicht.blickYaw = zauber.drehYaw ?? (kamera.erstePerson ? kamera.yaw : zp ? Math.atan2(zp.x - spieler.zustand.pos.x, zp.z - spieler.zustand.pos.z) : undefined);
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
    brains.length = 0;
    for (const n of npcs) if (n.fig.brain) brains.push(n.fig.brain);
    for (const n of npcs) {
      if (n.hirn) {
        const absicht = n.hirn.update(dt, n.fig.zustand, nachbarn.filter(q => q.x !== n.fig.zustand.pos.x || q.z !== n.fig.zustand.pos.z));
        n.fig.update(n.langsam > 0 ? dt * 0.4 : dt, n.liegt > 0 ? STEHEN : absicht);
        if (n.hirn.modus === 'folgen' && n.hirn.angekommen && (n.pause -= dt) < 0) { n.fig.spiele('winken'); n.pause = 12; }
      } else n.fig.update(n.langsam > 0 ? dt * 0.4 : dt, n.liegt > 0 ? STEHEN : null, brainKontext);
      if (n.blickZeit > 0 && (n.blickZeit -= dt) <= 0) n.fig.blickZu(null);
    }
  }

  zauber.update(dt, renderer.domElement.height);
  ui.update(dt, zauber.buch, zauber.zustand);
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

  psx.update(dt, szene);
  renderer.render(szene, kamera.kamera);
  requestAnimationFrame(bild);
}
psx.wendeAn(szene);
document.querySelector('[data-schalter="psx"]')?.classList.toggle('an', psxAn);
requestAnimationFrame(bild);

// Für Tests/Debug
window.labor = { psx, renderer, spieler, npcs, kamera, eingabe, welt, schilder, createLook, clipListe, zauber, ui };
