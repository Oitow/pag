import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from './worldgen/worldgen.js';
import { createWeltAdapter } from './worldgen/worldgen-adapter.js';
import { createWegeMesh } from './wege-mesh.js';
import { deckHoehe } from './wege-lage.js';

let adapter = null;
for (let seed = 1; seed < 40 && !adapter; seed++) {
  const w = createWorld({ preset: 'kontinent', seed, breite: 128, tiefe: 128, qualitaet: 'schnell', wasser: { flussMenge: 1.2 }, wege: { aktiv: true } });
  if (w.wege.some(x => x.bruecken.length)) adapter = createWeltAdapter(w, { hoehenSkala: 40, meterProZelle: 2 });
}

test('Brücken-Mesh: je Brücke ein Mesh, Deck liegt auf der berechneten Höhe', () => {
  assert.ok(adapter, 'keine Testwelt mit Brücke gefunden');
  const w = createWegeMesh(adapter, { schatten: true });
  assert.ok(w.anzahl > 0);
  assert.equal(w.gruppe.children.length, w.anzahl);
  w.gruppe.updateMatrixWorld(true);
  w.gruppe.children.forEach((m, i) => {
    const l = w.lagen[i];
    assert.ok(m.isMesh && m.castShadow && m.geometry.attributes.position.count > 100);
    for (const v of m.geometry.attributes.position.array) assert.ok(Number.isFinite(v));
    // lokale Deckpunkte (y = 0) landen in der Welt auf deckHoehe
    for (const z of [-l.laenge / 2 + 0.01, 0, l.laenge / 2 - 0.01]) {
      const p = m.localToWorld(m.position.clone().set(0, 0, z));
      const soll = deckHoehe(l, p.x, p.z);
      assert.ok(soll !== null, 'Deckpunkt liegt nicht auf der Brücke');
      assert.ok(Math.abs(p.y - soll) < 0.05, `Deck ${p.y.toFixed(2)} statt ${soll.toFixed(2)}`);
    }
  });
  w.dispose();
  assert.equal(w.gruppe.children.length, 0);
});

test('Brücken-Mesh: Welt ohne Wege ergibt eine leere Gruppe', () => {
  const ohne = createWeltAdapter(createWorld({ preset: 'insel', seed: 3, breite: 64, tiefe: 64, qualitaet: 'schnell' }), { hoehenSkala: 40, meterProZelle: 2 });
  const w = createWegeMesh(ohne);
  assert.equal(w.anzahl, 0);
  w.dispose();
});
