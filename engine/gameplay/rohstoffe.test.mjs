import test from 'node:test';
import assert from 'node:assert/strict';
import { createRohstoffe } from './rohstoffe.js';
import { createEreignisse } from '../core/ereignisse.js';

const ARTEN = {
  baum: { gibt: [{ id: 'holz', min: 2, max: 4 }, { id: 'apfel', chance: 0.5 }], dauer: 2, werkzeug: 'axt', ohneFaktor: 3, nachwachsen: 2 },
  erz: { gibt: [{ id: 'eisen', anzahl: 1 }], dauer: 3, werkzeug: 'hacke', noetig: true, abnutzung: 2 },
  busch: { gibt: [{ id: 'beere', min: 1, max: 1 }], dauer: 0.5, nachwachsen: 1 },
};
const AXT = { id: 'steinaxt', tags: ['axt'], tempo: 2 }, HACKE = { id: 'hacke' };

test('pruefe: Dauer mit/ohne Werkzeug, Tempo, nötiges Werkzeug', () => {
  const roh = createRohstoffe({ arten: ARTEN });
  assert.deepEqual(roh.pruefe('baum'), { ok: true, grund: null, dauer: 6, passt: false });
  assert.deepEqual(roh.pruefe('baum', AXT), { ok: true, grund: null, dauer: 1, passt: true });
  assert.equal(roh.pruefe('baum', HACKE).dauer, 6);
  assert.equal(roh.pruefe('erz').grund, 'werkzeug');
  assert.equal(roh.pruefe('erz', HACKE).ok, true);
  assert.equal(roh.pruefe('busch', AXT).dauer, 0.5);
  assert.equal(roh.pruefe('nix').grund, 'unbekannt');
});
test('baueAb: Beute in Grenzen, Abnutzung nur mit passendem Werkzeug, kein zweites Mal', () => {
  const weg = [], bus = createEreignisse(), gemeldet = [];
  bus.an('abgebaut', (e) => gemeldet.push(e.schluessel));
  const roh = createRohstoffe({ arten: ARTEN, seed: 7, ereignisse: bus, onWeg: (k) => weg.push(k) });
  for (let k = 0; k < 30; k++) {
    const e = roh.baueAb(k, 'baum', { werkzeug: k % 2 ? AXT : null, jetzt: 1 });
    const holz = e.beute.find((b) => b.id === 'holz').anzahl;
    assert.ok(holz >= 2 && holz <= 4);
    assert.equal(e.abnutzung, k % 2 ? 1 : 0);
    assert.equal(e.reif, 3);
  }
  assert.equal(roh.baueAb(0, 'baum'), null);
  assert.equal(roh.baueAb('e', 'erz'), null);
  const erz = roh.baueAb('e', 'erz', { werkzeug: HACKE });
  assert.deepEqual(erz, { beute: [{ id: 'eisen', anzahl: 1 }], abnutzung: 2, reif: Infinity });
  assert.equal(weg.length, 31); assert.equal(gemeldet.length, 31); assert.equal(roh.anzahl, 31);
});
test('gleicher Seed → gleiche Beute', () => {
  const lauf = () => { const roh = createRohstoffe({ arten: ARTEN, seed: 3 }); return JSON.stringify([1, 2, 3, 4, 5].map((k) => roh.baueAb(k, 'baum').beute)); };
  assert.equal(lauf(), lauf());
});
test('update: Nachwachsen zur rechten Zeit, onDa darf aufschieben, nie = bleibt weg', () => {
  const da = []; let besetzt = true;
  const roh = createRohstoffe({ arten: ARTEN, warte: 0.5, onDa: (k) => (k === 'b' && besetzt ? false : (da.push(k), true)) });
  roh.baueAb('a', 'busch', { jetzt: 0 }); roh.baueAb('b', 'baum', { jetzt: 0 }); roh.baueAb('e', 'erz', { werkzeug: HACKE, jetzt: 0 });
  assert.equal(roh.update(0.9), 0);
  assert.equal(roh.update(1), 1); assert.equal(roh.istWeg('a'), false);
  assert.equal(roh.update(2), 0); assert.equal(roh.istWeg('b'), true);     // besetzt → verschoben auf 2.5
  besetzt = false;
  assert.equal(roh.update(2.4), 0);
  assert.equal(roh.update(2.5), 1);
  assert.equal(roh.update(1e9), 0); assert.equal(roh.istWeg('e'), true);
  assert.deepEqual(da, ['a', 'b']);
});
test('zustand/lade: reines JSON, onWeg beim Laden, wächst danach weiter nach', () => {
  const a = createRohstoffe({ arten: ARTEN });
  a.baueAb(5, 'baum', { jetzt: 1.5 }); a.baueAb('e', 'erz', { werkzeug: HACKE });
  const stand = JSON.parse(JSON.stringify(a.zustand()));
  assert.deepEqual(stand, [[5, 'baum', 3.5], ['e', 'erz', null]]);
  const weg = [];
  const b = createRohstoffe({ arten: ARTEN, onWeg: (k) => weg.push(k) });
  b.lade(stand);
  assert.deepEqual(weg, [5, 'e']);
  assert.equal(b.update(3.5), 1); assert.equal(b.istWeg('e'), true);
  b.lade(null); assert.equal(b.anzahl, 0);
});
