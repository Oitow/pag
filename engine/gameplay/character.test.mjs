import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCharacter } from './character.js';

const welt = { bodenHoehe: () => 0 };
const STOP = { x: 0, z: 0 };

test('läuft, Zusatz-Flags in der Absicht stören nicht, kein NaN', () => {
  const f = createCharacter({ welt, pos: { x: 0, y: 0, z: 0 } });
  for (let i = 0; i < 60; i++) f.update(1 / 60, { x: 0, z: 1, rollen: false, gleiten: false, unbekannt: true });
  assert.ok(f.zustand.pos.z > 0.3, `z ${f.zustand.pos.z}`);
  assert.ok(Number.isFinite(f.root.position.x) && f.root.position.z === f.zustand.pos.z);
  f.dispose(); f.dispose();
});

test('aktion: Clip, Motor-Befehl, unbekannt', () => {
  const f = createCharacter({ welt });
  assert.ok(f.aktion('winken').dauer > 0);
  assert.equal(f.animator.aktion, 'winken');
  assert.equal(f.aktion('gibtsnicht'), null);
  const motorKann = typeof f.motor.springeJetzt === 'function';
  assert.equal(f.aktion('springen') !== null, motorKann);
  f.dispose();
});

test('ausruesten/ablegen, setAusdruck per Feature-Check, Sichtbarkeit, abstandZu', () => {
  const f = createCharacter({ welt, pos: { x: 1, y: 0, z: 1 } });
  const schwert = new THREE.Object3D(), axt = new THREE.Object3D();
  f.ausruesten('handR', schwert);
  assert.ok(f.ausruestung.get('handR') === schwert);
  assert.ok(!!schwert.parent, 'hängt am Sockel');
  f.ausruesten('handR', axt);
  assert.ok(schwert.parent === null, 'altes ersetzt'); assert.ok(!!axt.parent);
  f.ablegen(axt);
  assert.ok(axt.parent === null); assert.equal(f.ausruestung.size, 0);
  assert.equal(f.setAusdruck('froh'), typeof f.model.setAusdruck === 'function');
  f.setSichtbar(false); assert.equal(f.model.rig.root.visible, false); f.setSichtbar(true);
  assert.ok(Math.abs(f.abstandZu({ x: 4, z: 5 }) - 5) < 1e-6);
  assert.equal(f.abstandZu(null), Infinity);
  f.dispose();
});

test('blickZu Figur/Punkt, sage mit Schild-Attrappe, dispose löst aus der Szene', () => {
  const gesagt = [];
  const schilder = { neu: (ziel, o) => ({ ziel, o, sage: (t) => gesagt.push(t), setName() {}, setLeben() {}, zeige() {}, entfernen() { this.weg = true; } }) };
  const a = createCharacter({ welt, name: 'Jupp', schilder, pos: { x: 0, y: 0, z: 0 } });
  const b = createCharacter({ welt, pos: { x: 3, y: 0, z: 0 } });
  const szene = new THREE.Group(); szene.add(a.root);
  assert.equal(a.name, 'Jupp'); assert.equal(a.schild.o.name, 'Jupp');
  assert.equal(a.sage('Moin', { geste: 'nicken' }), true);
  assert.deepEqual(gesagt, ['Moin']);
  assert.equal(b.sage('x'), false, 'ohne Schilder');
  a.blickZu(b);
  for (let i = 0; i < 30; i++) { a.update(1 / 60, STOP); b.update(1 / 60, STOP); }
  a.blickZu({ x: 0, y: 1, z: 5 }); a.update(1 / 60, STOP);
  a.blickZu(null); a.update(1 / 60, STOP);
  const schild = a.schild;
  a.dispose();
  assert.ok(a.root.parent === null); assert.equal(schild.weg, true);
  b.dispose();
});

test('Brain anhängen: Optionen oder fertiges Objekt, Absicht + Clip', () => {
  const f = createCharacter({ welt, seed: 3, brain: { grund: { zustand: 'wandern', radius: 5 } } });
  assert.equal(typeof f.brain.update, 'function');
  for (let i = 0; i < 300; i++) f.update(1 / 30, null, { stunde: 10 });
  assert.ok(Number.isFinite(f.zustand.pos.x));
  let n = 0;
  const attrappe = { update: () => ({ absicht: { x: 1, z: 0 }, aktion: n++ === 0 ? 'winken' : null, aktionNeu: n === 1 }) };
  f.setBrain(attrappe);
  f.update(1 / 30);
  assert.equal(f.animator.aktion, 'winken');
  for (let i = 0; i < 30; i++) f.update(1 / 30);
  assert.ok(f.zustand.pos.x > 0.2, 'Brain-Absicht bewegt');
  f.update(1 / 30, { x: 0, z: 0 });                // eigene Absicht hat Vorrang
  f.setBrain(null); assert.equal(f.brain, null);
  f.dispose();
});
