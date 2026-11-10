import test from 'node:test';
import assert from 'node:assert/strict';
import { createZauberbuch, ZAUBER, ZAUBER_NAMEN, zielImKegel } from './zauber.js';
import { CLIPS } from '../models/character/character-clips.js';

const lauf = (buch, ziele, s, dt = 1 / 60) => {
  const alle = [];
  for (let t = 0; t < s; t += dt) for (const e of buch.update(dt, ziele)) alle.push({ ...e });
  return alle;
};
const gegner = (id, x, z) => ({ id, x, y: 0, z, radius: 0.35, hoehe: 1.7 });

test('Tabelle: 10 Zauber, jede Geste ist ein registrierter Clip', () => {
  assert.equal(ZAUBER_NAMEN.length, 10);
  for (const n of ZAUBER_NAMEN) {
    const d = ZAUBER[n];
    assert.ok(CLIPS[d.clip], `${n}: Clip ${d.clip}`);
    assert.ok(d.name && d.symbol && d.text && d.mana > 0 && d.abkling > 0, n);
    assert.ok(CLIPS[d.clip].trefferBei > 0);
  }
});

test('Mana, Abklingzeit und Wirkzeit', () => {
  const buch = createZauberbuch({ mana: 30, manaRegen: 0 });
  assert.equal(buch.wirke('gibtsnicht').grund, 'unbekannt');
  assert.equal(buch.wirke('feuerball', { vorlauf: 0.3, ziel: { von: { x: 0, y: 1, z: 0 }, yaw: 0 } }).ok, true);
  assert.equal(buch.mana, 12);
  assert.equal(buch.wirkt, 'feuerball');
  assert.equal(buch.wirke('eislanze').grund, 'wirkt');
  assert.equal(lauf(buch, [], 0.2).length, 0);                 // noch in der Geste
  assert.equal(lauf(buch, [], 0.2)[0].typ, 'start');
  assert.equal(buch.geschosse.length, 1);
  assert.equal(buch.wirke('feuerball').grund, 'abklingzeit');
  assert.ok(buch.abklingAnteil('feuerball') > 0.5);
  assert.equal(buch.wirke('meteor').grund, 'mana');
  buch.setFreiesMana(true);
  assert.equal(buch.wirke('meteor').ok, true);
});

test('Alle Arten liefern ihre Ereignisse und Treffer', () => {
  const ziele = [gegner('a', 0, 6), gegner('b', 1.5, 7), gegner('c', -30, -30)];
  const typen = {};
  for (const n of ZAUBER_NAMEN) {
    const buch = createZauberbuch({ freiesMana: true, welt: { bodenHoehe: () => 0 } });
    assert.equal(buch.wirke(n, { vorlauf: 0.1, ziel: () => ({ von: { x: 0, y: 1.2, z: 0 }, fuss: { x: 0, y: 0, z: 0 }, yaw: 0, ziel: ziele[0] }) }).ok, true);
    const es = lauf(buch, ziele, 3);
    typen[n] = es.map((e) => e.typ);
    const getroffen = es.flatMap((e) => e.treffer.map((t) => t.id));
    if (!['heilung', 'schild', 'blinzeln'].includes(n)) assert.ok(getroffen.includes('a'), `${n} trifft a (${typen[n]})`);
    assert.ok(!getroffen.includes('c'), `${n} trifft c nicht`);
    assert.equal(buch.geschosse.length, 0, `${n}: Geschosse aufgeräumt`);
  }
  assert.deepEqual(typen.feuerball, ['start', 'einschlag']);
  assert.deepEqual(typen.arkan, ['start', 'einschlag', 'einschlag', 'einschlag']);
  assert.deepEqual(typen.blitz, ['start', 'strahl']);
  assert.deepEqual(typen.meteor, ['start', 'ankuendigung', 'einschlag']);
  assert.deepEqual(typen.blinzeln, ['start', 'teleport']);
  assert.deepEqual(typen.heilung, ['start', 'selbst']);
});

test('Feuerball: Fläche trifft Nachbarn schwächer, Blitz springt weiter, Teleport in Blickrichtung', () => {
  const ziele = [gegner('a', 0, 6), gegner('b', 1.5, 7)];
  let buch = createZauberbuch({ freiesMana: true });
  buch.wirke('feuerball', { ziel: { von: { x: 0, y: 1.2, z: 0 }, yaw: 0, ziel: ziele[0] } });
  const e = lauf(buch, ziele, 2).find((x) => x.typ === 'einschlag');
  const a = e.treffer.find((t) => t.id === 'a'), b = e.treffer.find((t) => t.id === 'b');
  assert.equal(a.schaden, 30);
  assert.ok(b.schaden < 30 && b.schaden >= 15);
  assert.ok(b.stoss.y > 0);
  buch = createZauberbuch({ freiesMana: true });
  buch.wirke('blitz', { ziel: { von: { x: 0, y: 1.2, z: 0 }, yaw: 0 } });   // ohne Ziel: sucht selbst im Kegel
  const s = lauf(buch, ziele, 0.1).find((x) => x.typ === 'strahl');
  assert.deepEqual(s.treffer.map((t) => t.id), ['a', 'b']);
  assert.equal(s.punkte.length, 3);
  assert.ok(s.treffer[1].schaden < s.treffer[0].schaden);
  buch = createZauberbuch({ freiesMana: true });
  buch.wirke('blinzeln', { ziel: { von: { x: 1, y: 0, z: 1 }, yaw: Math.PI / 2 } });
  const t = lauf(buch, [], 0.1).find((x) => x.typ === 'teleport');
  assert.ok(Math.abs(t.nach.x - 9) < 1e-6 && Math.abs(t.nach.z - 1) < 1e-6);
  assert.equal(zielImKegel(ziele, { x: 0, z: 0 }, Math.PI, 20, 0.5), null);
});
