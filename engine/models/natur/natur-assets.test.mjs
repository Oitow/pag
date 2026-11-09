import test from 'node:test';
import assert from 'node:assert/strict';
import { TYP_ZU_GENERATOR, FAMILIEN, familieVon, alleTypen, erzeugeAsset, createAssetCache } from './natur-assets.js';

const VERTRAG = ['eiche', 'buche', 'birke', 'ahorn', 'weide', 'tanne', 'fichte', 'kiefer', 'pinie', 'tropenbaum', 'palme', 'akazie', 'olive',
  'toterBaum', 'fels', 'felsbrocken', 'findling', 'geroell', 'felsplatte', 'felsnadel', 'baumstumpf', 'liegenderStamm', 'ast',
  'busch', 'beerenbusch', 'ginster', 'zwergstrauch', 'farn', 'grasbueschel', 'blume', 'pilz', 'schilf', 'seerose', 'kaktus', 'saeulenkaktus', 'agave'];

test('Registry kennt alle Typen aus dem Vertrag', () => {
  for (const t of VERTRAG) assert.equal(typeof TYP_ZU_GENERATOR[t], 'function', t);
  assert.deepEqual(new Set(alleTypen()), new Set(Object.values(FAMILIEN).flat()));
  assert.equal(familieVon('eiche'), 'baum');
  assert.equal(familieVon('seerose'), 'bodendecker');
  assert.equal(familieVon('quatsch'), null);
});

test('erzeugeAsset: Vertrag + unbekannter Typ → null', () => {
  assert.equal(erzeugeAsset('drache', 1), null);
  for (const t of alleTypen()) {
    const a = erzeugeAsset(t, 3, { detail: 0 });
    assert.ok(a.geometrie.attributes.position.count > 0, t);
    assert.ok(a.hoehe > 0 && a.radius > 0 && a.stammRadius >= 0, t);
    a.geometrie.dispose();
  }
});

test('Winter gibt Felsen Schnee (hellere Farben)', () => {
  const mittel = (a) => { const c = a.geometrie.attributes.color.array; let s = 0; for (const v of c) s += v; return s / c.length; };
  assert.ok(mittel(erzeugeAsset('findling', 5, { jahreszeit: 'winter' })) > mittel(erzeugeAsset('findling', 5, {})));
});

test('Cache: gleiche Geometrie je (typ, variante), Varianten verschieden, dispose', () => {
  const c = createAssetCache({ varianten: 3, detail: 0 });
  assert.equal(c.holen('quatsch', 0), null);
  assert.equal(c.hat('birke'), true);
  const a = c.holen('birke', 1);
  assert.equal(c.holen('birke', 1), a);
  assert.equal(c.holen('birke', 4), a);          // modulo
  assert.notEqual(c.holen('birke', 0).geometrie, a.geometrie);
  assert.notDeepEqual(c.holen('birke', 0).geometrie.attributes.position.array, a.geometrie.attributes.position.array);
  assert.equal(c.anzahl(), 2);
  c.dispose();
  assert.equal(c.anzahl(), 0);
});

test('Cache ist deterministisch', () => {
  const a = createAssetCache({ seed: 9 }).holen('fichte', 2), b = createAssetCache({ seed: 9 }).holen('fichte', 2);
  assert.deepEqual(a.geometrie.attributes.position.array, b.geometrie.attributes.position.array);
});
