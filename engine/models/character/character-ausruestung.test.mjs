import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAusruestung, ausruestungsNamen, AUSRUESTUNG, baueAusruestung, ausruestungAusrichten } from './character-ausruestung.js';
import { createMeshBuilder } from '../../render/mesh-builder.js';
import { createCharacterModel } from './character-model.js';
import { koerperMasse, VORLAGEN } from './character-look.js';

const bb = (o) => { o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o); };

test('jeder Gegenstand baut: wenige Dreiecke, Griff am Ursprung, sinnvolle Größe', () => {
  assert.ok(ausruestungsNamen.length >= 15);
  for (const n of ['schwert', 'axt', 'hacke', 'schild', 'bogen', 'stab', 'fackel', 'laterne', 'korb', 'becher']) assert.ok(ausruestungsNamen.includes(n), n);
  for (const n of ausruestungsNamen) {
    const g = baueAusruestung(createMeshBuilder(), n).geometry();
    g.computeBoundingBox();
    const b = g.boundingBox, groesse = b.getSize(new THREE.Vector3()).length();
    assert.ok(g.attributes.position.count / 3 < 500, `${n}: ${g.attributes.position.count / 3} Dreiecke`);
    assert.ok(groesse > 0.08 && groesse < 2.2, `${n}: ${groesse}`);
    assert.ok(b.containsPoint(new THREE.Vector3()) || b.distanceToPoint(new THREE.Vector3()) < 0.1, `${n}: Griff nahe Ursprung`);
  }
  assert.throws(() => createAusruestung('kanone'));
});

test('Ausrichtung: Schwert in der Hand zeigt nach vorn, im Gürtel nach unten, Schild nach außen', () => {
  const s = createAusruestung('schwert');
  let b = bb(s);
  assert.ok(b.max.z > 0.7 && b.max.y < 0.15, 'Hand: +Z');
  ausruestungAusrichten(s, 'guertel');
  b = bb(s);
  assert.ok(b.min.y < -0.6 && b.max.z < 0.3, 'Gürtel: nach unten');
  assert.equal(s.userData.sockel, 'guertel');
  const schildL = createAusruestung('schild', { sockel: 'handL' }), schildR = createAusruestung('schild', { sockel: 'handR' });
  assert.ok(bb(schildL).max.x > 0.05 && bb(schildR).min.x < -0.05);
  const klein = createAusruestung('schwert', { masse: koerperMasse(VORLAGEN.kind) });
  assert.ok(bb(klein).max.z < 0.7 * 0.85);
});

test('Leuchtteile, Lichtpunkt, Farben, dispose, passt zu model.befestigen', () => {
  const f = createAusruestung('fackel');
  assert.ok(f.getObjectByName('leuchten') && f.getObjectByName('leuchten').material.emissive.getHex() !== 0);
  assert.ok(f.userData.lichtPunkt.z > 0.3, 'Flamme vorn-oben');
  assert.equal(createAusruestung('schwert').getObjectByName('leuchten'), undefined);
  const farbe = (o) => Array.from(o.getObjectByName('schild').geometry.attributes.color.array.slice(0, 3));
  assert.notDeepEqual(farbe(createAusruestung('schild', { farbe: '#ff0000' })), farbe(createAusruestung('schild', { farbe: '#0000ff' })));
  const m = createCharacterModel({ look: VORLAGEN.ritter });
  const s = m.befestigen('handR', createAusruestung('schwert'));
  assert.equal(s.parent, m.rig.sockel.handR);
  let frei = 0;
  s.traverse((o) => o.isMesh && o.geometry.addEventListener('dispose', () => frei++));
  m.loesen(s);
  s.dispose();
  assert.equal(frei, 1);
  for (const n of ausruestungsNamen) assert.ok(['vorn', 'schraeg', 'aufrecht', 'seite', 'haengend'].includes(AUSRUESTUNG[n].halt), n);
  m.dispose();
});
