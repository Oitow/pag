import test from 'node:test';
import assert from 'node:assert/strict';
import { createSchleife } from './schleife.js';

const nah = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('schleife: variabler Schritt mit maxDt', () => {
  const ups = [], rs = [];
  const s = createSchleife({ update: (dt, z) => ups.push([dt, z]), render: (a, dt) => rs.push([a, dt]), maxDt: 0.05 });
  s.tick(0); // Zeitbasis
  assert.equal(ups.length, 0);
  s.tick(16);
  s.tick(1016); // 1 s -> auf 0.05 begrenzt
  assert.equal(ups.length, 2);
  nah(ups[0][0], 0.016);
  nah(ups[1][0], 0.05);
  nah(s.zeit, 0.066);
  assert.equal(rs[1][0], 1);
  nah(rs[1][1], 0.05);
});

test('schleife: fester Schritt, alpha, maxSchritte', () => {
  let ups = 0, alpha = -1;
  const s = createSchleife({ update: () => { ups++; }, render: (a) => { alpha = a; }, fest: 0.01, maxSchritte: 5 });
  s.tick(0);
  s.tick(25); // 2 Schritte, Rest 5 ms
  assert.equal(ups, 2);
  nah(alpha, 0.5);
  s.tick(1025); // 1 s -> gedeckelt auf 5, Rest verworfen
  assert.equal(ups, 7);
  nah(alpha, 0);
  nah(s.zeit, 0.07);
});

test('schleife: start/stop mit Fake-raf', () => {
  const q = new Map();
  let nr = 0, ups = 0;
  const raf = (fn) => { q.set(++nr, fn); return nr; };
  const caf = (i) => q.delete(i);
  const s = createSchleife({ update: () => { ups++; }, raf, caf });
  assert.equal(s.laeuft, false);
  s.start();
  assert.equal(s.laeuft, true);
  const lauf = (ts) => { const [i, fn] = [...q][0]; q.delete(i); fn(ts); };
  lauf(0); lauf(16); lauf(32);
  assert.equal(ups, 2);
  s.stop();
  assert.equal(s.laeuft, false);
  assert.equal(q.size, 0);
  s.dispose();
});

test('schleife: Fehlerbehandlung', () => {
  const s1 = createSchleife({ update: () => { throw new Error('x'); } });
  s1.tick(0);
  assert.throws(() => s1.tick(16), /x/);
  const fehler = [];
  let r = 0;
  const s2 = createSchleife({ update: () => { throw new Error('y'); }, render: () => { r++; }, fehler: (e) => fehler.push(e.message) });
  s2.tick(0); s2.tick(16);
  assert.deepEqual(fehler, ['y']);
  assert.equal(r, 1);
});

test('schleife: fps geglaettet', () => {
  const s = createSchleife({});
  for (let t = 0; t <= 2000; t += 10) s.tick(t);
  assert.ok(s.fps > 90 && s.fps < 110, String(s.fps));
});
