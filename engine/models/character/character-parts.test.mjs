import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeshBuilder } from '../../render/mesh-builder.js';
import { koerperMasse, createLook, STILE } from './character-look.js';
import { teilKontext, farbeMisch, baueTorso, baueHals, baueBecken, baueOberarm, baueUnterarm, baueHand, baueOberschenkel, baueUnterschenkel, baueFuss, baueUmhang, baueRucksack } from './character-parts.js';
import { baueKopf, baueKopfbedeckung, deckendeKopfbedeckung } from './character-parts-kopf.js';

const ctx = (teil) => { const l = createLook(teil); return teilKontext(l, koerperMasse(l)); };
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
