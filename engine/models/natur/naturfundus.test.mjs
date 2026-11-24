import test from 'node:test';
import assert from 'node:assert/strict';
import { arten, baueNaturAsset } from './naturfundus.js';
import { baueGruppe } from './landschaftsgruppen.js';

function pruefe(mesh, name) {
  const g = mesh.geometry;
  assert.ok(g.attributes.position.count > 0, name);
  assert.ok(g.attributes.color, name + ' hat Vertexfarben');
  g.computeBoundingBox();
  assert.ok(g.boundingBox.min.y > -0.6, name + ' Fußpunkt nahe Ursprung');
  g.dispose(); mesh.material.dispose();
}

test('jede Fundus-Art baut ein Mesh mit Farben, Fußpunkt am Ursprung', () => {
  for (const art of arten) pruefe(baueNaturAsset(art, 4), art);
});

test('Landschaftsgruppen bauen je ein Mesh', () => {
  for (const art of ['wollgras', 'pilzholz', 'flechtenbank']) pruefe(baueGruppe(art, 4), art);
});

test('unbekannte Arten werfen', () => {
  assert.throws(() => baueNaturAsset('drache'), RangeError);
  assert.throws(() => baueGruppe('drache', 1), RangeError);
});
