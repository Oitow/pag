import test from 'node:test';
import assert from 'node:assert/strict';
import { createSinne, imSichtkegel } from './character-sinne.js';

const flach = { bodenHoehe: () => 0 };
const ich = { pos: { x: 0, y: 0, z: 0 }, yaw: 0 }; // blickt nach +Z

test('Sichtkegel: Winkel, Reichweite, Nahbereich rundum', () => {
  assert.equal(imSichtkegel({ x: 0, z: 0 }, 0, { x: 0, z: 5 }, 10, Math.PI / 2), true);
  assert.equal(imSichtkegel({ x: 0, z: 0 }, 0, { x: 5, z: 1 }, 10, Math.PI / 2), false, 'zu weit seitlich');
  assert.equal(imSichtkegel({ x: 0, z: 0 }, 0, { x: 0, z: 11 }, 10, Math.PI / 2), false, 'zu weit');
  assert.equal(imSichtkegel({ x: 0, z: 0 }, 0, { x: 0, z: -1 }, 10, Math.PI / 2, 1.5), true, 'Nahbereich hinten');
  assert.equal(imSichtkegel({ x: 0, z: 0 }, Math.PI / 2, { x: 5, z: 1 }, 10, Math.PI / 2), true, 'gedreht');
});

test('Sichtlinie: Hügel verdeckt, welt.sichtBlockiert', () => {
  const huegel = { bodenHoehe: (x, z) => (z > 4 && z < 6 ? 3 : 0) };
  const s = createSinne({ welt: huegel });
  assert.equal(s.siehtPunkt(ich, { x: 0, y: 0, z: 10 }), false);
  assert.equal(s.siehtPunkt(ich, { x: 0, y: 0, z: 3 }), true);
  assert.equal(s.siehtPunkt(ich, { x: 0, y: 5, z: 10 }), true, 'oben auf etwas Hohem');
  const ohne = createSinne({ welt: huegel, sichtlinie: false });
  assert.equal(ohne.siehtPunkt(ich, { x: 0, y: 0, z: 10 }), true);
  const wand = createSinne({ welt: { bodenHoehe: () => 0, sichtBlockiert: (a, b) => b.x > 0 } });
  assert.equal(wand.siehtPunkt(ich, { x: 1, y: 0, z: 5 }), false);
  assert.equal(wand.siehtPunkt(ich, { x: -1, y: 0, z: 5 }), true);
});

test('Hören, Geräusche, Gedächtnis vergisst', () => {
  const s = createSinne({ welt: flach, hoerRadius: 6, vergessenNach: 3 });
  let w = s.update(0.1, ich, [{ id: 'dieb', x: 0, z: -5, laut: 1 }]); // hinter mir, laut
  assert.deepEqual(w.gehoert, ['dieb']);
  assert.equal(s.erinnerung('dieb').art, 'gehoert');
  w = s.update(0.1, ich, [{ id: 'dieb', x: 0, z: -5, laut: 0.5 }]);
  assert.equal(w.gehoert.length, 0, 'leise genug');
  s.geraeusch(3, -3, 1, 'knall');
  w = s.update(0.1, ich, []);
  assert.deepEqual(w.gehoert, ['knall']);
  s.update(2, ich, []);
  assert.ok(s.erinnerung('dieb') && s.erinnerung('dieb').alter > 2);
  s.update(1.5, ich, []);
  assert.equal(s.erinnerung('dieb'), null, 'vergessen');
  assert.equal(s.bekannte().length, 0);
});

test('Entdeckzeit: Verdacht steigt, Verstecken verkürzt Sicht, letzte Position bleibt', () => {
  const s = createSinne({ welt: flach, sichtWeite: 10, entdeckZeit: 1 });
  s.update(0.2, ich, [{ id: 'sp', x: 0, z: 8 }]);
  const e = s.erinnerung('sp');
  assert.ok(e.sichtbar && e.verdacht > 0 && !e.entdeckt);
  for (let i = 0; i < 10; i++) s.update(0.2, ich, [{ id: 'sp', x: 0, z: 8 }]);
  assert.equal(e.entdeckt, true);
  // aus dem Blick → Position gemerkt, Alter wächst
  s.update(0.5, ich, [{ id: 'sp', x: 0, z: -8 }]);
  assert.equal(e.sichtbar, false);
  assert.equal(e.z, 8);
  assert.ok(e.alter >= 0.5);
  assert.equal(s.naechste((x) => x.entdeckt), e);
  // versteckt (0.5 → Sichtweite 7,5) auf 8 m nicht sichtbar
  const t = createSinne({ welt: flach, sichtWeite: 10 });
  assert.deepEqual(t.update(0.1, ich, [{ id: 'a', x: 0, z: 8, versteckt: 1 }]).gesehen, []);
  assert.deepEqual(t.update(0.1, ich, [{ id: 'a', x: 0, z: 4, versteckt: 1 }]).gesehen, ['a']);
  assert.equal(t.erinnerung('a').entdeckt, true, 'ohne entdeckZeit sofort');
  t.vergiss(); assert.equal(t.bekannte().length, 0);
  t.dispose(); s.dispose();
});
