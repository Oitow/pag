import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKaempfer, berechneSchaden, ARTEN } from './kampf-werte.js';

const nah = (x = 0, z = 0) => ({ x, z });

test('ARTEN enthält acht Schadensarten', () => assert.equal(ARTEN.length, 8));

test('Schadensformel: Angriff, Rüstung, Resist, Durchdringung', () => {
  const nie = () => 0.99;
  assert.equal(berechneSchaden({ angriff: 50, krit: 0 }, { ruestung: 100 }, { menge: 100 }, nie).schaden, 75);
  assert.equal(berechneSchaden({ magie: 100, krit: 0 }, { resist: { feuer: 0.5 } }, { menge: 10, art: 'feuer' }, nie).schaden, 10);
  assert.ok(Math.abs(berechneSchaden({ krit: 0 }, { resist: { eis: 5 } }, { menge: 100, art: 'eis' }, nie).schaden - 10) < 1e-9); // Deckel 0.9
  assert.equal(berechneSchaden({ krit: 0 }, { ruestung: 100 }, { menge: 100, durchdringung: 0.5 }, nie).schaden, 100);
});

test('Krit deterministisch über r() und paket.krit', () => {
  const a = { krit: 0.5, kritFaktor: 2 };
  assert.equal(berechneSchaden(a, {}, { menge: 10 }, () => 0.1).schaden, 20);
  assert.equal(berechneSchaden(a, {}, { menge: 10 }, () => 0.9).krit, false);
  assert.equal(berechneSchaden({ krit: 0 }, {}, { menge: 10, krit: true }, () => 0.9).krit, true);
});

test('gleicher Seed → gleiche Ergebnisse', () => {
  const f = () => {
    const k = createKaempfer({ id: 'a', leben: 1000, seed: 5, werte: { ausweichen: 0.5 } });
    return Array.from({ length: 10 }, () => k.nimmSchaden({ menge: 10, wucht: 0 }, { krit: 0.5 }).schaden);
  };
  assert.deepEqual(f(), f());
});

test('Leben, Tod, Belebung, Heilung mit heilFaktor', () => {
  const k = createKaempfer({ id: 'a', leben: 50, werte: { heilFaktor: 2 } });
  const e = k.nimmSchaden({ menge: 30 });
  assert.equal(e.schaden, 30); assert.equal(k.leben, 20);
  assert.equal(k.heile(10), 20 > 0 ? 20 : 0); // 10×2 = 20, nur 30 fehlen
  assert.equal(k.leben, 40);
  assert.equal(k.nimmSchaden({ menge: 100 }).tot, true);
  assert.equal(k.tot, true);
  assert.equal(k.nimmSchaden({ menge: 5 }).schaden, 0);
  assert.equal(k.heile(10), 0);
  k.belebe(0.5); assert.equal(k.leben, 25);
});

test('Ausweichen und Unverwundbar', () => {
  const k = createKaempfer({ id: 'a', werte: { ausweichen: 1 } });
  assert.equal(k.nimmSchaden({ menge: 10 }).ausgewichen, true); assert.equal(k.leben, 100);
  const u = createKaempfer({ id: 'u' });
  u.setzeMod('x', { unverwundbar: true });
  assert.equal(u.nimmSchaden({ menge: 10 }).ausgewichen, true);
  u.entferneMod('x'); assert.equal(u.nimmSchaden({ menge: 10 }).ausgewichen, false);
});

test('Parade nur von vorn (yaw 0 blickt nach +z)', () => {
  const k = createKaempfer({ id: 'a' });
  k.abwehr.parade = true; k.abwehr.yaw = 0;
  assert.equal(k.nimmSchaden({ menge: 10, richtung: nah(0, -1) }).pariert, true); // Treffer fliegt gegen den Blick
  assert.equal(k.leben, 100);
  const hinten = k.nimmSchaden({ menge: 10, richtung: nah(0, 1) });
  assert.equal(hinten.pariert, false); assert.equal(hinten.schaden, 10);
  assert.equal(k.nimmSchaden({ menge: 10, richtung: nah(1, 0) }).pariert, false); // von der Seite
  assert.equal(k.nimmSchaden({ menge: 10 }).pariert, false); // ohne Richtung nie
});

test('Block von vorn mindert um blockAnteil, halbe Wucht', () => {
  const k = createKaempfer({ id: 'a', haltung: 100 });
  k.abwehr.block = true;
  const e = k.nimmSchaden({ menge: 100, wucht: 20, richtung: nah(0, -1) });
  assert.equal(e.geblockt, true); assert.ok(Math.abs(e.schaden - 30) < 1e-9);
  assert.equal(k.haltung, 90);
  assert.equal(k.nimmSchaden({ menge: 10, richtung: nah(0, 1) }).geblockt, false);
});

test('Schild frisst zuerst und läuft ab', () => {
  const k = createKaempfer({ id: 'a' });
  k.gibSchild(30, 2);
  const e = k.nimmSchaden({ menge: 50 });
  assert.equal(e.abgefangen, 30); assert.equal(e.schaden, 20); assert.equal(k.leben, 80); assert.equal(k.schild, 0);
  k.gibSchild(10, 1);
  assert.deepEqual(k.update(1.1), [{ typ: 'schildEnde' }]); assert.equal(k.schild, 0);
});

test('Haltung → Taumeln → Ende, Regeneration nach Pause', () => {
  const k = createKaempfer({ id: 'a', haltung: 30, leben: 1000 });
  assert.equal(k.nimmSchaden({ menge: 1, wucht: 20 }).taumelt, false);
  const e = k.nimmSchaden({ menge: 1, wucht: 20 });
  assert.equal(e.taumelt, true); assert.equal(k.taumelt, true); assert.equal(k.haltung, 0);
  assert.equal(k.nimmSchaden({ menge: 1, wucht: 20 }).taumelt, false); // nicht erneut
  assert.deepEqual(k.update(1), []);
  assert.deepEqual(k.update(0.6), [{ typ: 'taumelEnde' }]);
  assert.equal(k.taumelt, false); assert.equal(k.haltung, 30);
  k.nimmSchaden({ menge: 1, wucht: 20 });
  k.update(1); assert.equal(k.haltung, 10); // Pause 2 s
  k.update(1.5); assert.ok(k.haltung > 10);
});

test('Mods: additiv und multiplikativ', () => {
  const k = createKaempfer({ id: 'a', werte: { ruestung: 10, tempo: 1 } });
  k.setzeMod('a', { ruestung: 50, tempo: 0.5 }); k.setzeMod('b', { tempo: 2, schadenFaktor: 1.5 });
  assert.equal(k.werte.ruestung, 60); assert.equal(k.werte.tempo, 1); assert.equal(k.werte.schadenFaktor, 1.5);
  k.entferneMod('a'); assert.equal(k.werte.ruestung, 10);
});

test('zustand()/laden() Rundreise setzt Zufall fort', () => {
  const a = createKaempfer({ id: 'a', leben: 500, seed: 3, werte: { ausweichen: 0.3 } });
  a.setzeMod('m', { angriff: 5 }); a.gibSchild(10, 4);
  for (let i = 0; i < 5; i++) a.nimmSchaden({ menge: 10 }, { krit: 0.5 });
  const z = JSON.parse(JSON.stringify(a.zustand()));
  const b = createKaempfer({ id: 'b' }); b.laden(z);
  assert.equal(b.leben, a.leben); assert.equal(b.werte.angriff, 5); assert.equal(b.schild, a.schild);
  for (let i = 0; i < 5; i++) assert.deepEqual(b.nimmSchaden({ menge: 10 }, { krit: 0.5 }), a.nimmSchaden({ menge: 10 }, { krit: 0.5 }));
});
