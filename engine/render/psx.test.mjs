import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPsx, psxAufloesung, patchePsxShader, PSX_STANDARD } from './psx.js';
import { figurMaterial } from './figur-material.js';

const leererShader = () => ({
  uniforms: {},
  vertexShader: 'void main() {\n#include <project_vertex>\n}',
  fragmentShader: '#include <common>\n#include <color_fragment>\n#include <opaque_fragment>\nvoid main() {\n#include <dithering_fragment>\n}',
});

test('psxAufloesung: kurze Seite bekommt die Zeilen, nie größer als das Original', () => {
  assert.deepEqual(psxAufloesung(1200, 600, 300), { breite: 600, hoehe: 300, faktor: 0.5 });
  const hoch = psxAufloesung(390, 844, 300);
  assert.equal(hoch.breite, 300);
  assert.equal(hoch.hoehe, Math.round(844 * 300 / 390));
  assert.deepEqual(psxAufloesung(200, 100, 300), { breite: 200, hoehe: 100, faktor: 1 });
  assert.deepEqual(psxAufloesung(800, 600, 0), { breite: 800, hoehe: 600, faktor: 1 });
});

test('patchePsxShader: baut Einrasten und Farbstufen genau einmal ein, lässt fremde Shader in Ruhe', () => {
  const u = createPsx().uniforms;
  const s = patchePsxShader(leererShader(), u);
  patchePsxShader(s, u);
  assert.equal(s.vertexShader.match(/uniform float uPsxRaster/g).length, 1);
  assert.equal(s.vertexShader.match(/#include <project_vertex>/g).length, 1);
  assert.equal(s.fragmentShader.match(/#include <dithering_fragment>/g).length, 1);
  assert.equal(s.uniforms.uPsxFarbe, u.uPsxFarbe);
  const fremd = patchePsxShader({ uniforms: {}, vertexShader: 'void main() {}', fragmentShader: 'void main() {}' }, u);
  assert.equal(fremd.vertexShader, 'void main() {}');
  assert.equal(fremd.fragmentShader, 'void main() {}');
});

test('patche: vorhandener Hook (figurMaterial) bleibt, Schlüssel wird erweitert, doppelt schadet nicht', () => {
  const psx = createPsx();
  const mat = figurMaterial({ rand: 0.77 });
  const vorher = mat.customProgramCacheKey();
  psx.patche(mat);
  const hook = mat.onBeforeCompile;
  psx.patche(mat);
  assert.equal(mat.onBeforeCompile, hook);
  assert.equal(mat.customProgramCacheKey(), vorher + '|psx-1');
  const s = leererShader();
  mat.onBeforeCompile(s);
  assert.match(s.fragmentShader, /uRandSchaerfe/);
  assert.match(s.fragmentShader, /uPsxFarbe/);
  // zwei schlichte Materialien mit verschiedenen Hooks dürfen sich kein Programm teilen
  const a = new THREE.MeshBasicMaterial(), b = new THREE.MeshBasicMaterial();
  b.onBeforeCompile = (sh) => { sh.fragmentShader += '// anders'; };
  psx.patche(a); psx.patche(b);
  assert.equal(a.customProgramCacheKey(), '|psx-1');
  assert.notEqual(a.customProgramCacheKey(), b.customProgramCacheKey());
});

test('setze / an: Uniforms folgen den Werten, aus = neutral', () => {
  const psx = createPsx({ raster: 200, farbtiefe: 4, vignette: 0.4, kontrast: 1.2, toenung: 0xff8000 });
  const u = psx.uniforms;
  assert.equal(u.uPsxRaster.value, 200);
  assert.equal(u.uPsxFarbe.value.x, 15);
  assert.equal(u.uPsxStimmung.value.z, 0.4);
  assert.ok(Math.abs(u.uPsxToenung.value.g - 128 / 255) < 1e-6);
  psx.setze({ an: false, unbekannt: 5 });
  assert.equal(psx.an, false);
  assert.equal(psx.werte.unbekannt, undefined);
  assert.equal(u.uPsxRaster.value, 0);
  assert.equal(u.uPsxFarbe.value.x, 0);
  assert.deepEqual(u.uPsxStimmung.value.toArray(), [1, 1, 0, 1]);
  assert.deepEqual(u.uPsxToenung.value.toArray(), [1, 1, 1]);
  psx.setze({ an: true, raster: 0 });
  assert.equal(u.uPsxRaster.value, 0);
  assert.equal(u.uPsxFarbe.value.x, 15);
  assert.equal(PSX_STANDARD.farbtiefe, 5);
});

test('wendeAn: patcht alle Materialien der Szene, Ausnahmen bleiben, update fasst nach, Viewport wird gemerkt', () => {
  const psx = createPsx({ nachfassen: 0.5 });
  const szene = new THREE.Scene();
  let vorherGerufen = 0;
  szene.onBeforeRender = () => { vorherGerufen++; };
  const a = new THREE.Mesh(new THREE.BufferGeometry(), [new THREE.MeshStandardMaterial(), new THREE.MeshBasicMaterial()]);
  const ohne = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  ohne.material.userData.psx = false;
  szene.add(a, ohne);
  psx.wendeAn(szene);
  assert.match(a.material[0].customProgramCacheKey(), /psx-1$/);
  assert.match(a.material[1].customProgramCacheKey(), /psx-1$/);
  assert.doesNotMatch(ohne.material.customProgramCacheKey(), /psx-1$/);

  const spaeter = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial());
  szene.add(spaeter);
  psx.update(0.3, szene);
  assert.doesNotMatch(spaeter.material.customProgramCacheKey(), /psx-1$/);
  psx.update(0.3, szene);
  assert.match(spaeter.material.customProgramCacheKey(), /psx-1$/);

  const renderer = { getCurrentViewport: (v) => v.set(10, 20, 320, 240) };
  szene.onBeforeRender(renderer, szene, null, null);
  assert.equal(vorherGerufen, 1);
  assert.deepEqual(psx.uniforms.uPsxAnsicht.value.toArray(), [10, 20, 320, 240]);

  psx.dispose();
  assert.equal(psx.an, false);
  assert.equal(psx.uniforms.uPsxFarbe.value.x, 0);
  szene.onBeforeRender(renderer, szene, null, null);
  assert.equal(vorherGerufen, 2);
  const danach = new THREE.MeshBasicMaterial();
  psx.patche(danach);
  assert.doesNotMatch(danach.customProgramCacheKey(), /psx-1$/);
});

test('material: geteilt je Optionen, einzeln auf Wunsch, dispose gibt frei', () => {
  const psx = createPsx();
  const a = psx.material(), b = psx.material(), c = psx.material({ einzeln: true }), d = psx.material({ color: 0xff0000, vertexColors: false });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.notEqual(a, d);
  assert.equal(a.isMeshLambertMaterial, true);
  assert.equal(a.flatShading, true);
  let frei = 0;
  for (const m of [a, c, d]) m.addEventListener('dispose', () => { frei++; });
  psx.dispose();
  assert.equal(frei, 3);
});

test('aufloesung: grobe Pixel bei aktivem Look, sonst volle Auflösung mit pixelRatio', () => {
  const rufe = [];
  const renderer = { domElement: { style: {} }, setPixelRatio: (p) => rufe.push(['pr', p]), setSize: (b, h, stil) => rufe.push(['size', b, h, stil]) };
  const psx = createPsx({ zeilen: 300 });
  assert.deepEqual(psx.aufloesung(renderer, 1200, 600, { pixelRatio: 2 }), { breite: 600, hoehe: 300, faktor: 0.5 });
  assert.deepEqual(rufe, [['pr', 1], ['size', 600, 300, false]]);
  assert.deepEqual(renderer.domElement.style, { width: '1200px', height: '600px', imageRendering: 'pixelated' });
  rufe.length = 0;
  psx.setze({ an: false });
  psx.aufloesung(renderer, 1200, 600, { pixelRatio: 2 });
  assert.deepEqual(rufe, [['pr', 2], ['size', 1200, 600, false]]);
  assert.equal(renderer.domElement.style.imageRendering, '');
});
