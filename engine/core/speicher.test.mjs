import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeicher, packe, entpacke } from './speicher.js';

function fakeStorage() {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

test('speicher: Rundreise mit verschachtelten TypedArrays', () => {
  const sp = createSpeicher({ storage: fakeStorage() });
  const daten = {
    name: 'Vini',
    tief: { liste: [{ pos: new Float32Array([0.1, -2.5, 1e10]) }], karte: new Uint8Array([0, 1, 255]) },
    w: new Float64Array([Math.PI]),
  };
  assert.equal(sp.fluechtig, false);
  assert.equal(sp.speichere('a', daten), true);
  const d = sp.lade('a');
  assert.ok(d.tief.liste[0].pos instanceof Float32Array);
  assert.deepEqual([...d.tief.liste[0].pos], [...daten.tief.liste[0].pos]);
  assert.ok(d.tief.karte instanceof Uint8Array);
  assert.deepEqual([...d.tief.karte], [0, 1, 255]);
  assert.equal(d.w[0], Math.PI);
  assert.equal(d.name, 'Vini');
  const p = packe(new Int16Array([-5, 7]));
  assert.equal(p.$ta, 'Int16Array');
  assert.deepEqual([...entpacke(p)], [-5, 7]);
});

test('speicher: slots-Reihenfolge, hat, loesche', () => {
  let t = 100;
  const sp = createSpeicher({ storage: fakeStorage(), jetzt: () => t });
  sp.speichere('alt', 1); t = 200;
  sp.speichere('neu', 2); t = 150;
  sp.speichere('mitte', 3);
  assert.deepEqual(sp.slots().map((s) => s.slot), ['neu', 'mitte', 'alt']);
  assert.equal(sp.slots()[0].zeit, 200);
  assert.equal(sp.slots()[0].version, 1);
  assert.equal(sp.hat('alt'), true);
  sp.loesche('alt');
  assert.equal(sp.hat('alt'), false);
  assert.equal(sp.lade('alt'), null);
  assert.deepEqual(sp.slots().map((s) => s.slot), ['neu', 'mitte']);
});

test('speicher: kaputtes JSON → null', () => {
  const st = fakeStorage();
  const sp = createSpeicher({ storage: st });
  st.setItem('pag:x', '{kaputt');
  assert.equal(sp.lade('x'), null);
  assert.equal(sp.hat('x'), false);
});

test('speicher: Migration und zu neue Version', () => {
  const st = fakeStorage();
  createSpeicher({ storage: st, version: 1 }).speichere('s', { gold: 5 });
  const ohne = createSpeicher({ storage: st, version: 2 });
  assert.deepEqual(ohne.lade('s'), { gold: 5 });
  const mit = createSpeicher({
    storage: st, version: 2,
    migriere: (d, von) => ({ ...d, gold: d.gold * 10, von }),
  });
  assert.deepEqual(mit.lade('s'), { gold: 50, von: 1 });
  createSpeicher({ storage: st, version: 3 }).speichere('neu', 1);
  assert.equal(mit.lade('neu'), null);
});

test('speicher: Fallback bei werfendem storage', () => {
  const kaputt = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  const sp = createSpeicher({ storage: kaputt });
  assert.equal(sp.fluechtig, true);
  assert.equal(sp.speichere('a', { z: 1 }), true);
  assert.deepEqual(sp.lade('a'), { z: 1 });
  // ohne storage (Node hat kein localStorage) ebenfalls flüchtig
  assert.equal(createSpeicher({ storage: null }).fluechtig, true);
});

test('speicher: Quota-Fehler → false', () => {
  const st = fakeStorage();
  const sp = createSpeicher({ storage: st });
  st.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(sp.speichere('a', { z: 1 }), false);
  const zirk = {}; zirk.selbst = zirk;
  assert.equal(sp.speichere('b', zirk), false);
});

test('speicher: export/import mit Umlauten und Emoji', () => {
  const a = createSpeicher({ storage: fakeStorage() });
  const daten = { text: 'Größe ÄÖÜ ß 🎮🐉', f: new Float32Array([1.5, 2.5]) };
  a.speichere('s', daten);
  const txt = a.exportText('s');
  assert.equal(typeof txt, 'string');
  assert.equal(a.exportText('gibtsnicht'), null);
  const b = createSpeicher({ storage: fakeStorage() });
  assert.equal(b.importText('z', txt), true);
  const d = b.lade('z');
  assert.equal(d.text, daten.text);
  assert.deepEqual([...d.f], [1.5, 2.5]);
  assert.equal(b.importText('q', '!!!kein base64'), false);
  assert.equal(b.importText('q', btoa('{"a":1}')), false);
  assert.equal(b.hat('q'), false);
});

test('speicher: auto + update + dispose', () => {
  const sp = createSpeicher({ storage: fakeStorage() });
  let n = 0;
  sp.auto('auto', () => ({ n: ++n }), 10);
  sp.update(4);
  assert.equal(sp.hat('auto'), false);
  sp.update(6);
  assert.deepEqual(sp.lade('auto'), { n: 1 });
  sp.update(5);
  assert.deepEqual(sp.lade('auto'), { n: 1 });
  assert.equal(sp.jetztSpeichern(), true);
  assert.deepEqual(sp.lade('auto'), { n: 2 });
  sp.auto(null);
  sp.update(100);
  assert.deepEqual(sp.lade('auto'), { n: 2 });
  assert.equal(sp.jetztSpeichern(), false);
  sp.auto('auto', () => ({ n: 9 }), 1);
  sp.dispose();
  sp.update(5);
  assert.deepEqual(sp.lade('auto'), { n: 2 });
});
