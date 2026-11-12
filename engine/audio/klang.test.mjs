import test from 'node:test';
import assert from 'node:assert/strict';
import { createKlang, KLAENGE } from './klang.js';

function param() {
  return { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {},
    setTargetAtTime() {}, cancelScheduledValues() {} };
}
function attrappe() {
  const z = { osz: 0, quelle: 0, gain: 0, filter: 0, komp: 0, closed: 0, resumed: 0 };
  const knoten = () => ({ connect() {}, disconnect() {}, start() {}, stop() {} });
  const ctx = {
    z, currentTime: 0, sampleRate: 8000, state: 'running', destination: {},
    createOscillator() { z.osz++; return { ...knoten(), type: '', frequency: param() }; },
    createBufferSource() { z.quelle++; return { ...knoten(), buffer: null }; },
    createGain() { z.gain++; return { ...knoten(), gain: param() }; },
    createBiquadFilter() { z.filter++; return { ...knoten(), type: '', frequency: param(), Q: param() }; },
    createDynamicsCompressor() { z.komp++; return knoten(); },
    createBuffer(k, n) { const d = new Float32Array(n); return { getChannelData: () => d }; },
    resume() { z.resumed++; return Promise.resolve(); },
    close() { z.closed++; return Promise.resolve(); },
  };
  return ctx;
}

test('ohne AudioContext: still, nichts wirft', () => {
  const k = createKlang();
  assert.equal(k.bereit, false);
  assert.equal(k.spiele('wumms'), false);
  k.dauerton('laden', { staerke: 1 }); k.dauerton('laden', null);
  k.setLautstaerke(0.2); k.stumm = true; k.entsperren(); k.dispose();
  assert.ok(k.namen.length >= 12);
});

test('jeder Klang spielbar und erzeugt Knoten', () => {
  const ctx = attrappe(), k = createKlang({ kontext: ctx });
  assert.equal(k.bereit, true);
  assert.deepEqual(k.namen, Object.keys(KLAENGE));
  for (const n of k.namen) {
    const vor = ctx.z.osz + ctx.z.quelle;
    assert.equal(k.spiele(n, { verzug: 0.1 }), true, n);
    assert.ok(ctx.z.osz + ctx.z.quelle > vor, n);
  }
  assert.equal(k.spiele('gibtsnicht'), false);
});

test('Drosselung und Zeitfortschritt', () => {
  const ctx = attrappe(), k = createKlang({ kontext: ctx });
  const erg = [1, 2, 3, 4, 5].map(() => k.spiele('wumms'));
  assert.ok(erg.includes(false));
  ctx.currentTime = 5;
  assert.equal(k.spiele('wumms'), true);
});

test('stumm: spiele() false', () => {
  const k = createKlang({ kontext: attrappe() });
  k.stumm = true;
  assert.equal(k.stumm, true);
  assert.equal(k.spiele('biss'), false);
});

test('Dauerton: ein Satz Knoten, dispose schließt fremden Kontext nicht', () => {
  const ctx = attrappe(), k = createKlang({ kontext: ctx });
  k.dauerton('laden', { staerke: 0.4, tonhoehe: 1.3 });
  const osz = ctx.z.osz;
  k.dauerton('laden', { staerke: 0.5, tonhoehe: 1.5 });
  assert.equal(ctx.z.osz, osz);
  assert.equal(osz, 3);
  k.dauerton('laden', null);
  k.dispose();
  assert.equal(ctx.z.closed, 0);
});
