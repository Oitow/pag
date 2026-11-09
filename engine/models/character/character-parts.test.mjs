import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeshBuilder } from '../../render/mesh-builder.js';
import { koerperMasse, createLook, STILE } from './character-look.js';
import { teilKontext, farbeMisch, baueTorso, baueHals, baueBecken, baueOberarm, baueUnterarm, baueHand, baueOberschenkel, baueUnterschenkel, baueFuss, baueUmhang, baueRucksack } from './character-parts.js';
import { baueKopf, baueKopfbedeckung, deckendeKopfbedeckung } from './character-parts-kopf.js';
import { baueZubehoer, hatZubehoer, baueBrille } from './character-parts-zubehoer.js';
import { createGesicht, AUSDRUCK_DATEN } from './character-parts-gesicht.js';
import { AUSDRUECKE } from './character-look.js';

const ctx = (teil, o) => { const l = createLook(teil); return teilKontext(l, koerperMasse(l), o); };
const box = (fn, k) => { const g = fn(createMeshBuilder(), k).geometry(); g.computeBoundingBox(); return g; };

test('farbeMisch', () => {
  assert.equal(farbeMisch(0x000000, 0xffffff, 0.5), 0x808080);
  assert.equal(farbeMisch(0x123456, 0, 0), 0x123456);
});

test('Rig-Konvention: Gliedmaßen hängen nach −Y, Fuß bis Boden und nach +Z, Kopf um y = R', () => {
  const k = ctx({}), m = k.m;
  for (const [fn, len] of [[baueOberarm, m.oberarm], [baueUnterarm, m.unterarm], [baueOberschenkel, m.oberschenkel], [baueUnterschenkel, m.unterschenkel]]) {
    const bb = box(fn, k).boundingBox;
    assert.ok(bb.min.y < -len * 0.95 && bb.max.y < 0.3 * len, fn.name);
  }
  const fuss = box(baueFuss, k).boundingBox, boden = m.fussHoehe - 0.02 * m.hoehe / 1.75;
  assert.ok(Math.abs(fuss.min.y + boden) < 0.005 && fuss.max.z > m.fussLaenge * 0.6, 'Fuß');
  const kopf = box(baueKopf, k).boundingBox;
  assert.ok(Math.abs((kopf.max.y + kopf.min.y) / 2 - k.R) < k.R * 0.25 && kopf.max.y < k.R * 2.2);
  const torso = box(baueTorso, k).boundingBox;
  assert.ok(torso.min.y >= -0.01 && torso.max.y < m.torsoLaenge + 0.08);
  assert.ok(box(baueHand, k).boundingBox.min.y < -m.hand * 0.7);
  assert.ok(box(baueHals, k).boundingBox.max.y > m.halsLaenge);
});

test('Stile ergeben unterschiedliche Geometrie', () => {
  const sig = (fn, teil) => { const a = box(fn, ctx(teil)).attributes.position.array; let h = a.length; for (const v of a) h = (Math.imul(h, 31) + Math.round(v * 1e4)) | 0; return h; };
  const verschieden = (fn, teil, liste) => assert.equal(new Set(liste.map((s) => sig(fn, { [teil]: { stil: s } }))).size, liste.length, teil);
  verschieden(baueKopf, 'haar', STILE.haar);
  verschieden(baueKopf, 'bart', STILE.bart);
  verschieden(baueTorso, 'oberteil', STILE.oberteil);
  verschieden(baueKopfbedeckung, 'kopfbedeckung', STILE.kopfbedeckung.slice(1));
  verschieden(baueUmhang, 'umhang', ['kurz', 'lang']);
  verschieden(baueFuss, 'schuhe', STILE.schuhe);
  verschieden(baueUmhang, 'umhang', STILE.umhang.slice(1));
  verschieden(baueBecken, 'oberteil', ['kittel', 'mantel', 'schuerze', 'kettenhemd', 'lederruestung', 'hemd']);
  verschieden(baueOberschenkel, 'hose', ['lang', 'kurz', 'pluder']);
  verschieden(baueKopf, 'brille', STILE.brille);
  verschieden(baueZubehoer, 'schal', STILE.schal.slice(1));
  verschieden(baueZubehoer, 'schmuck', ['kette', 'amulett', 'perlen']);
  assert.notEqual(sig(baueKopf, { schmuck: { stil: 'ohrringe' } }), sig(baueKopf, {}));
  assert.equal(hatZubehoer(ctx({ schmuck: { stil: 'ohrringe' } })), false);
  assert.equal(hatZubehoer(ctx({ schal: { stil: 'halstuch' } })), true);
  assert.equal(baueBrille(createMeshBuilder(), ctx({})).leer, true);
  assert.equal(deckendeKopfbedeckung('reif'), false);
  // Muskeln/Schultern verändern Arme und Torso
  assert.ok(ctx({ koerper: { muskeln: 1 } }).armR > ctx({}).armR);
  assert.notEqual(sig(baueTorso, { koerper: { schultern: 1.3 } }), sig(baueTorso, {}));
  assert.notEqual(sig(baueBecken, { hose: { stil: 'rock' } }), sig(baueBecken, { hose: { stil: 'lang' } }));
  assert.notEqual(sig(baueOberschenkel, { hose: { stil: 'kurz' } }), sig(baueOberschenkel, { hose: { stil: 'lang' } }));
  assert.notEqual(sig(baueBecken, { tasche: true }), sig(baueBecken, { tasche: false }));
  assert.ok(box(baueRucksack, ctx({})).attributes.position.count > 0);
  assert.equal(deckendeKopfbedeckung('krone'), false);
  assert.equal(deckendeKopfbedeckung('helm'), true);
});

test('Rock bleibt am Becken und endet oberhalb der Knöchel', () => {
  for (const teil of [{ oberteil: { stil: 'robe' } }, { hose: { stil: 'rock' } }, { oberteil: { stil: 'kleid' }, hose: { stil: 'rock' } }]) {
    const k = ctx(teil), bb = box(baueBecken, k).boundingBox;
    assert.ok(-bb.min.y < k.m.oberschenkel + k.m.unterschenkel * 0.5, JSON.stringify(teil));
  }
});

test('Kopf mit Mimik: ohne festes Gesicht, aber mit Augäpfeln', () => {
  const fest = box(baueKopf, ctx({})), mimik = box(baueKopf, ctx({}, { mimik: true }));
  assert.ok(mimik.attributes.position.count < fest.attributes.position.count + 200);
  assert.notEqual(mimik.attributes.position.count, fest.attributes.position.count);
});

test('Gesicht: 3 Meshes, Lider bedecken geschlossen die Pupillen', () => {
  const k = ctx({ ausdruck: 'ueberrascht' }, { mimik: true }), g = createGesicht(k, { seed: 4 });
  assert.equal(g.meshes.length, 3);
  assert.equal(g.ausdruck, 'ueberrascht');
  assert.deepEqual(Object.keys(AUSDRUCK_DATEN), AUSDRUECKE);
  g.gruppe.updateMatrixWorld(true);
  const welt = (m) => { m.geometry.computeBoundingBox(); return m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld); };
  g.setAusdruck('schlafend');
  g.gruppe.updateMatrixWorld(true);
  const lid = welt(g.meshes[1]), pup = welt(g.meshes[0]);
  assert.ok(lid.max.z > pup.max.z, `Lid vor Pupille (${lid.max.z} > ${pup.max.z})`);
  assert.ok(pup.max.z < k.R * 1.05 && pup.min.y > k.R * 0.7, 'Pupillen sitzen im Gesicht');
  g.dispose();
  assert.equal(g.gruppe.parent, null);
});
