import test from 'node:test';
import assert from 'node:assert/strict';
import { createSchnappschussPuffer } from './schnappschuss-puffer.js';

const nah = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
const neu = (o = {}) => createSchnappschussPuffer({ verzoegerung: 0, sprungDistanz: 1000, ...o });

test('leerer Puffer -> null', () => {
  const p = neu();
  assert.equal(p.lese(1), null);
  assert.equal(p.anzahl, 0);
  assert.equal(p.neueste, -Infinity);
});
test('Interpolation in der Mitte, Verzögerung wirkt', () => {
  const p = createSchnappschussPuffer({ verzoegerung: 0.1, sprungDistanz: 1000 });
  p.schiebe(0, { x: 0, y: 0 });
  p.schiebe(1, { x: 10, y: 4 });
  const o = p.lese(0.6);
  nah(o.x, 5); nah(o.y, 2);
});
test('Winkel über ±π nehmen den kürzesten Weg', () => {
  const p = neu();
  p.schiebe(0, { yaw: Math.PI - 0.1 });
  p.schiebe(1, { yaw: -Math.PI + 0.1 });
  const o = p.lese(0.5);
  nah(Math.cos(o.yaw), -1, 1e-9);
});
test('verspätetes Paket wird einsortiert', () => {
  const p = neu();
  p.schiebe(0, { x: 0 });
  p.schiebe(2, { x: 20 });
  p.schiebe(1, { x: 10 });
  assert.equal(p.anzahl, 3);
  assert.equal(p.neueste, 2);
  nah(p.lese(1.5).x, 15);
});
test('gleiche Zeit ersetzt', () => {
  const p = neu();
  p.schiebe(1, { x: 1 });
  p.schiebe(1, { x: 7 });
  assert.equal(p.anzahl, 1);
  assert.equal(p.lese(1).x, 7);
});
test('nicht endliche Zeit wird ignoriert', () => {
  const p = neu();
  p.schiebe(NaN, { x: 1 });
  p.schiebe(Infinity, { x: 1 });
  assert.equal(p.anzahl, 0);
});
test('Überlauf verwirft die ältesten', () => {
  const p = neu({ groesse: 3 });
  for (let i = 0; i < 6; i++) p.schiebe(i, { x: i });
  assert.equal(p.anzahl, 3);
  assert.equal(p.lese(0).x, 3); // vor dem ältesten -> ältester (3)
});
test('Extrapolation ist begrenzt', () => {
  const p = neu({ maxExtrapolation: 0.25 });
  p.schiebe(0, { x: 0 });
  p.schiebe(1, { x: 2 });
  nah(p.lese(1.1).x, 2.2);
  nah(p.lese(5).x, 2.5);
});
test('ein Schnappschuss wird unverändert geliefert', () => {
  const p = neu();
  p.schiebe(1, { x: 3 });
  assert.equal(p.lese(0).x, 3);
  assert.equal(p.lese(9).x, 3);
});
test('Teleport springt statt zu gleiten', () => {
  const p = neu({ sprungDistanz: 8 });
  p.schiebe(0, { x: 0 });
  p.schiebe(1, { x: 100 });
  assert.equal(p.lese(0.9).x, 0);
  assert.equal(p.lese(1).x, 100);
  assert.equal(p.lese(1.1).x, 100); // keine Extrapolation nach Sprung
});
test('fehlende und nicht endliche Felder ergeben kein NaN', () => {
  const p = neu();
  p.schiebe(0, { x: 0, tempo: 2 });
  p.schiebe(1, { x: 10, tempo: NaN, hoehe: 5 });
  const o = p.lese(0.5);
  nah(o.x, 5);
  assert.equal(o.tempo, 2);
  assert.equal(o.hoehe, 5);
  for (const v of Object.values(o)) assert.ok(typeof v !== 'number' || Number.isFinite(v));
});
test('Nicht-Zahlen kommen vom älteren; out wird wiederverwendet; Eingabe wird kopiert', () => {
  const p = neu();
  const eingabe = { x: 0, clip: 'winken', amBoden: true };
  p.schiebe(0, eingabe);
  p.schiebe(1, { x: 2, clip: 'laufen', amBoden: false });
  eingabe.clip = 'verändert';
  const out = {};
  const r = p.lese(0.5, out);
  assert.equal(r, out);
  assert.equal(out.clip, 'winken');
  assert.equal(out.amBoden, true);
});
test('leeren und dispose', () => {
  const p = neu();
  p.schiebe(0, { x: 0 });
  p.leeren();
  assert.equal(p.lese(0), null);
  p.dispose();
  assert.equal(p.anzahl, 0);
});
