import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCharacterModel } from './character-model.js';
import { VORLAGEN, randomLook, STILE, AUSDRUECKE } from './character-look.js';

const dreiecke = (m) => m.meshes.reduce((n, x) => n + x.geometry.attributes.position.count / 3, 0);
function hashGeo(m) {
  let h = 2166136261 >>> 0;
  for (const x of m.meshes) for (const v of x.geometry.attributes.position.array) { h ^= Math.round(v * 1e5); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function pruefen(look, name, opts = {}) {
  const m = createCharacterModel({ look, ...opts });
  m.root.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(m.root), h = m.masse.hoehe;
  const t = dreiecke(m);
  assert.ok(t <= 4500, `${name}: ${t} Dreiecke`);   // inkl. beweglichem Gesicht (~330)
  assert.ok(Math.abs(bb.min.y) < 0.02 * h + 0.01, `${name}: Füße auf dem Boden (${bb.min.y})`);
  const hut = m.look.kopfbedeckung.stil !== 'keine';
  assert.ok(bb.max.y > h * 0.85 && bb.max.y < h * (hut ? 1.5 : 1.15), `${name}: Höhe ${bb.max.y} ≠ ${h}`);
  for (const x of m.meshes) assert.ok(x.geometry.attributes.position.count > 0 && Number.isFinite(x.geometry.boundingSphere.radius), name + x.name);
  m.dispose();
  return t;
}

test('alle Vorlagen und 50 Zufalls-Looks bauen (Dreiecke, Höhe)', () => {
  for (const [n, v] of Object.entries(VORLAGEN)) pruefen(v, n);
  for (let i = 0; i < 50; i++) pruefen(randomLook(1000 + i, { kind: i % 7 === 0 }), 'zufall' + i);
  for (const v of Object.values(VORLAGEN)) assert.ok(pruefen(v, 'statisch', { mimik: false }) <= 4200);
});

test('jeder Stil baut (alle Werte aus STILE)', () => {
  for (const [teil, liste] of Object.entries(STILE)) for (const stil of liste) pruefen({ [teil]: { stil }, guertel: null, tasche: true, rucksack: true }, `${teil}:${stil}`);
});

test('gleiche Seeds → gleiche Geometrie, anderer Seed → andere Farben', () => {
  const a = createCharacterModel({ look: VORLAGEN.ritter, seed: 5 }), b = createCharacterModel({ look: VORLAGEN.ritter, seed: 5 });
  assert.equal(hashGeo(a), hashGeo(b));
  const farbe = (m) => Array.from(m.meshes[1].geometry.attributes.color.array.slice(0, 30)).join();
  assert.equal(farbe(a), farbe(b));
  assert.notEqual(farbe(a), farbe(createCharacterModel({ look: VORLAGEN.ritter, seed: 6 })));
});

test('setLook behält Rig-Gruppen und Befestigtes, passt Maße an', () => {
  const m = createCharacterModel({ look: VORLAGEN.wanderer });
  const kopf = m.rig.knochen.kopf, hand = m.rig.knochen.handR, root = m.root;
  const schwert = new THREE.Group(), hut = new THREE.Group();
  m.befestigen('handR', schwert);
  m.befestigen('kopf', hut);
  const alt = m.meshes.map((x) => x.geometry);
  m.setLook({ ...VORLAGEN.kind });
  assert.equal(m.rig.knochen.kopf, kopf);
  assert.equal(m.rig.knochen.handR, hand);
  assert.equal(m.root, root);
  assert.equal(schwert.parent, m.rig.sockel.handR);
  assert.equal(hut.parent, m.rig.sockel.kopf);
  assert.ok(m.masse.hoehe < 1.3 && m.look.oberteil.stil === 'hemd');
  assert.ok(m.meshes.every((x) => !alt.includes(x.geometry)));
  m.setLook({ kopfbedeckung: { stil: 'krone' } });
  assert.equal(m.look.haar.stil, 'wuschel', 'Teil-Look wird gemischt');
  assert.ok(m.meshes.some((x) => x.name === 'kopfbedeckung'));
  assert.deepEqual(m.loesen('handR'), [schwert]);
  assert.equal(schwert.parent, null);
  assert.deepEqual(m.loesen(hut), [hut]);
  assert.throws(() => m.befestigen('nase', schwert));
});

test('setSichtbar, Schatten-Option und dispose gibt Geometrien frei', () => {
  const m = createCharacterModel({ look: VORLAGEN.koenigin, schatten: false });
  assert.ok(m.meshes.every((x) => !x.castShadow && !x.receiveShadow));
  assert.ok(m.meshes.some((x) => x.name === 'umhang') && m.meshes.some((x) => x.name === 'kopf'));
  m.setSichtbar(false);
  assert.equal(m.root.visible, false);
  const szene = new THREE.Scene();
  szene.add(m.root);
  let frei = 0;
  for (const x of m.meshes) x.geometry.addEventListener('dispose', () => frei++);
  const n = m.meshes.length;
  m.dispose();
  assert.equal(frei, n);
  assert.equal(m.root.parent, null);
  assert.equal(m.meshes.length, 0);
});

test('Mimik: Ausdruck, Lider, Blinzeln, Blick; bleibt bei setLook; dispose ohne Lecks', () => {
  const m = createCharacterModel({ look: { ...VORLAGEN.koechin }, seed: 2 });
  const lider = () => m.meshes.find((x) => x.name === 'lider');
  const mimik = () => m.meshes.find((x) => x.name === 'mimik');
  assert.equal(m.ausdruck, 'froh', 'Start aus look.ausdruck');
  assert.equal(lider().parent.parent.parent, m.rig.knochen.kopf);
  const geos = new Set();
  for (const a of AUSDRUECKE) { m.setAusdruck(a); geos.add(mimik().geometry); assert.equal(m.ausdruck, a); }
  assert.ok(geos.size >= 14, 'viele verschiedene Formen: ' + geos.size);
  m.setAusdruck('quatsch');
  assert.equal(m.ausdruck, 'neutral');
  const offen = lider().rotation.x;
  m.setAusdruck('schlafend');
  assert.ok(lider().rotation.x > offen + 1, 'schlafend schließt die Lider');
  m.setAusdruck('neutral').blinzeln(0.2).updateGesicht(0.1);
  assert.ok(lider().rotation.x > offen + 1, 'Blinzeln: Mitte = zu');
  m.updateGesicht(0.15);
  assert.ok(Math.abs(lider().rotation.x - offen) < 1e-9, 'danach wieder offen');
  m.setLider(0.5);
  assert.ok(lider().rotation.x > offen);
  m.setLider(0).setBlick(1, -1);
  const p = m.meshes.find((x) => x.name === 'pupillen').position;
  assert.ok(p.x > 0 && p.y < 0);
  m.setBlick(9, 0);
  assert.ok(Math.abs(p.x - m.masse.kopfRadius * 0.17 * 0.24) < 1e-9, 'Blick begrenzt');
  m.setAugen(-0.5, 0.25, 0.3);
  assert.ok(p.x < 0 && p.y < 0, 'setAugen: yaw −, nick + = unten');
  m.setAugen(null, null, 0);
  assert.ok(p.x < 0, 'fehlende Werte bleiben');
  m.setAusdruck('wuetend').setLook({ haar: { stil: 'locken' } });
  assert.equal(m.ausdruck, 'wuetend', 'setLook behält Ausdruck');
  assert.equal(mimik().geometry, m.gesicht.meshes[2].geometry);
  m.setLook({ ausdruck: 'traurig' });
  assert.equal(m.ausdruck, 'traurig');
  // automatisches Blinzeln: innerhalb von 10 s mindestens einmal zu
  let zu = false;
  m.gesicht.autoBlinzeln = true;
  for (let i = 0; i < 600; i++) { m.updateGesicht(1 / 60); if (lider().rotation.x > 1) zu = true; }
  assert.ok(zu);
  assert.equal(createCharacterModel({}).gesicht.autoBlinzeln, true);
  m.setLook({ haar: { stil: 'kurz' } });
  assert.equal(m.gesicht.autoBlinzeln, false, 'nach blinzeln() von außen bleibt Auto aus');
  let frei = 0;
  for (const x of m.meshes) x.geometry.addEventListener('dispose', () => frei++);
  const n = m.meshes.length;
  m.dispose();
  assert.equal(frei, n, 'jede Geometrie genau einmal frei');
  // ohne Mimik: Funktionen da, tun nichts Schlimmes
  const s = createCharacterModel({ look: VORLAGEN.ritter, mimik: false });
  assert.equal(s.gesicht, null);
  assert.ok(!s.meshes.some((x) => x.name === 'lider'));
  s.setAusdruck('froh').blinzeln().setBlick(1, 1).setLider(1).setAugen(0.1, 0, 0.5).updateGesicht(0.1);
  assert.equal(s.ausdruck, 'froh');
  s.dispose();
});

test('Zubehör-Mesh nur bei Schal/Halsschmuck', () => {
  const ohne = createCharacterModel({ look: {} }), mit = createCharacterModel({ look: { schal: { stil: 'schal' } } });
  assert.ok(!ohne.meshes.some((x) => x.name === 'zubehoer'));
  assert.ok(mit.meshes.some((x) => x.name === 'zubehoer' && x.parent === mit.rig.knochen.torso));
  ohne.dispose(); mit.dispose();
});
