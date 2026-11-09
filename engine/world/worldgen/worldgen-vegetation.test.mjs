import test from 'node:test';
import assert from 'node:assert/strict';
import { STANDARD_OBJEKTE, VEGETATION_TYPEN, typenVon } from './worldgen-vegetation.js';
import { createWorld } from './worldgen.js';
import { FLAG, WASSER } from './worldgen-grid.js';

// Typnamen aus docs/NATUR-ASSETS.md (gemeinsam mit den Asset-Generatoren)
const VERTRAG = ['eiche', 'buche', 'birke', 'ahorn', 'weide', 'tanne', 'fichte', 'kiefer', 'pinie', 'tropenbaum', 'palme', 'akazie', 'olive',
  'toterBaum', 'fels', 'felsbrocken', 'findling', 'geroell', 'felsplatte', 'felsnadel', 'baumstumpf', 'liegenderStamm', 'ast',
  'busch', 'beerenbusch', 'ginster', 'zwergstrauch', 'farn', 'grasbueschel', 'blume', 'pilz', 'schilf', 'seerose', 'kaktus', 'saeulenkaktus', 'agave'];

test('Vegetation: nur Typnamen aus dem Asset-Vertrag, alle Vertragstypen kommen vor', () => {
  for (const t of VEGETATION_TYPEN) assert.ok(VERTRAG.includes(t), `unbekannter Typ ${t}`);
  for (const t of VERTRAG) assert.ok(VEGETATION_TYPEN.includes(t), `Vertragstyp ${t} wird nie verteilt`);
  const keys = STANDARD_OBJEKTE.map(a => a.key);
  assert.equal(new Set(keys).size, keys.length, 'doppelte Art');
  assert.deepEqual(typenVon({ key: 'x' }), ['x']);
});

const zaehle = (o, f) => { let n = 0; for (let i = 0; i < o.anzahl; i++) if (f(i)) n++; return n; };
const welt = createWorld({ preset: 'insel', seed: 5, breite: 128, tiefe: 128, qualitaet: 'schnell' });
const o = welt.objekte, art = i => o.arten[o.art[i]], typ = i => o.typen[o.typ[i]];
const zelle = (i) => Math.min(welt.breite - 1, Math.round(o.x[i] / welt.zelle)) + Math.min(welt.tiefe - 1, Math.round(o.y[i] / welt.zelle)) * welt.breite;

test('Vegetation: Ebenen vorhanden, Seerosen nur auf Seen, alles andere an Land', () => {
  for (const k of ['baum', 'busch', 'unterholz', 'bodendecker', 'fels']) assert.ok(zaehle(o, i => art(i) === k) > 0, `keine Art ${k}`);
  assert.ok(new Set(Array.from({ length: o.anzahl }, (_, i) => typ(i))).size >= 10, 'zu wenig Typvielfalt');
  for (let i = 0; i < o.anzahl; i++) {
    const fl = welt.flags[zelle(i)];
    if (art(i) === 'seerose') assert.ok(fl & FLAG.SEE, 'Seerose nicht auf See');
    else if (art(i) !== 'schilf') assert.ok(!(fl & WASSER), `${art(i)} im Wasser`);
    assert.ok(o.skala[i] > 0.4 && o.skala[i] < 1.6);
  }
});

test('Vegetation: Unterholz nur in Waldbiomen, Bodendecker abschaltbar und dosierbar', () => {
  const wald = new Set(['laubwald', 'nadelwald', 'birkenwald', 'regenwald', 'sumpf', 'hartlaubwald']);
  for (let i = 0; i < o.anzahl; i++) if (art(i) === 'unterholz') assert.ok(wald.has(welt.biome[welt.biom[zelle(i)]].key));
  const opts = { preset: 'insel', seed: 5, breite: 128, tiefe: 128, qualitaet: 'schnell' };
  const ohne = createWorld({ ...opts, objekte: { aus: ['bodendecker'] } }).objekte;
  assert.ok(!ohne.arten.includes('bodendecker'));
  const halb = createWorld({ ...opts, objekte: { artDichte: { bodendecker: 0.5 } } }).objekte;
  const n = x => zaehle(x, i => x.arten[x.art[i]] === 'bodendecker');
  assert.ok(n(halb) < n(o) * 0.75 && n(halb) > 0, `artDichte wirkt nicht (${n(halb)} von ${n(o)})`);
  // andere Arten bleiben unverändert (Reihenfolgeunabhängigkeit je Art)
  assert.equal(zaehle(halb, i => halb.arten[halb.art[i]] === 'baum'), zaehle(o, i => art(i) === 'baum'));
});
