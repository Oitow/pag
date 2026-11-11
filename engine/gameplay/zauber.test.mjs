import test from 'node:test';
import assert from 'node:assert/strict';
import { createZauberbuch, ZAUBER, ZAUBER_NAMEN, zielImKegel } from './zauber.js';
import { CLIPS } from '../models/character/character-clips.js';

const lauf = (buch, ziele, s, dt = 1 / 60) => {
  const alle = [];
  for (let t = 0; t < s; t += dt) for (const e of buch.update(dt, ziele)) alle.push({ ...e });
  return alle;
};
const gegner = (id, x, z, hoehe = 1.7) => ({ id, x, y: 0, z, radius: 0.35, hoehe });
const HAND = { x: 0, y: 1.2, z: 0 }, FUSS = { x: 0, y: 0, z: 0 };

test('Tabelle: 12 Zauber, jede Geste ist ein registrierter Clip mit Spann- und Treffer-Moment', () => {
  assert.equal(ZAUBER_NAMEN.length, 12);
  for (const n of ZAUBER_NAMEN) {
    const d = ZAUBER[n];
    assert.ok(CLIPS[d.clip], `${n}: Clip ${d.clip}`);
    assert.ok(d.name && d.symbol && d.text && d.mana > 0 && d.abkling > 0 && d.wirkzeit > 0 && d.gewicht > 0, n);
    assert.ok(CLIPS[d.clip].trefferBei > CLIPS[d.clip].spannBei && CLIPS[d.clip].spannBei > 0, `${n}: spannBei < trefferBei`);
  }
});

test('Mana, Wirkzeit, Schlag und Abklingzeit', () => {
  const buch = createZauberbuch({ mana: 30, manaRegen: 0 });
  assert.equal(buch.wirke('gibtsnicht').grund, 'unbekannt');
  assert.equal(buch.wirke('feuerball', { vorlauf: 0.3, schlag: 0.1, ziel: { von: HAND, yaw: 0 } }).ok, true);
  assert.equal(buch.mana, 14);
  assert.equal(buch.wirkt, 'feuerball');
  assert.equal(buch.wirke('eislanze').grund, 'wirkt');
  assert.equal(buch.abklingzeit('feuerball'), 0);               // Abklingzeit beginnt erst mit dem Schlag
  assert.equal(lauf(buch, [], 0.2).length, 0);                  // lädt noch
  assert.ok(buch.ladung.anteil > 0.5 && buch.ladung.phase === 'laden');
  assert.deepEqual(lauf(buch, [], 0.15).map((e) => e.typ), ['schlag']);
  assert.equal(buch.ladung.phase, 'schlag');
  assert.equal(lauf(buch, [], 0.1)[0].typ, 'start');
  assert.equal(buch.geschosse.length, 1);
  assert.equal(buch.wirke('feuerball').grund, 'abklingzeit');
  assert.ok(buch.abklingAnteil('feuerball') > 0.5);
  assert.equal(buch.wirke('meteor').grund, 'mana');
  buch.setFreiesMana(true);
  assert.equal(buch.wirke('meteor').ok, true);
});

test('Halten überlädt: mehr Schaden, größerer Radius, mehr Geschosse; Abbrechen gibt Mana zurück', () => {
  const ziele = [gegner('a', 0, 8)];
  const buch = createZauberbuch({ manaRegen: 0 });
  buch.wirke('feuerball', { halten: true, ziel: { von: HAND, yaw: 0, ziel: ziele[0] } });
  assert.equal(lauf(buch, ziele, 3).length, 0);                 // gehalten: schlägt nie von selbst zu
  assert.equal(buch.ladung.ueber, 1);
  assert.ok(Math.abs(buch.ladung.kraft - 1.6) < 1e-9);
  buch.lasseLos();
  const es = lauf(buch, ziele, 3);
  const ein = es.find((e) => e.typ === 'einschlag');
  assert.ok(Math.abs(es[0].kraft - 1.6) < 1e-9 && es[0].typ === 'schlag');
  assert.equal(ein.treffer[0].schaden, Math.round(ZAUBER.feuerball.schaden * 1.6));
  assert.ok(ein.radius > ZAUBER.feuerball.radius * 1.3);
  assert.equal(ZAUBER.feuerball.schaden, 34);                   // Tabelle bleibt unverändert

  const b2 = createZauberbuch({ freiesMana: true });
  b2.wirke('arkan', { halten: true, ziel: { von: HAND, yaw: 0 } });
  lauf(b2, [], 3); b2.lasseLos(); lauf(b2, [], 0.05);
  assert.equal(b2.geschosse.length, 6);

  const b3 = createZauberbuch({ manaRegen: 0 });
  b3.wirke('meteor', { halten: true });
  lauf(b3, [], 0.3);
  assert.equal(b3.mana, 55);
  assert.equal(b3.brichAb(), true);
  assert.equal(b3.mana, 100);
  assert.equal(b3.wirkt, null);
  assert.equal(b3.kann('meteor').ok, true);
  assert.equal(b3.brichAb(), false);
});

test('Alle Arten liefern ihre Ereignisse und Treffer', () => {
  const ziele = [gegner('a', 0, 6), gegner('b', 1.5, 7), gegner('c', -30, -30)];
  const typen = {};
  for (const n of ZAUBER_NAMEN) {
    const buch = createZauberbuch({ freiesMana: true, welt: { bodenHoehe: () => 0 } });
    assert.equal(buch.wirke(n, { vorlauf: 0.1, ziel: () => ({ von: HAND, fuss: FUSS, yaw: 0, ziel: ziele[0] }) }).ok, true);
    const es = lauf(buch, ziele, 6);
    typen[n] = [...new Set(es.map((e) => e.typ))];
    const getroffen = es.flatMap((e) => e.treffer.map((t) => t.id));
    if (!['heilung', 'schild', 'blinzeln'].includes(n)) assert.ok(getroffen.includes('a'), `${n} trifft a (${typen[n]})`);
    assert.ok(!getroffen.includes('c'), `${n} trifft c nicht`);
    assert.equal(buch.geschosse.length, 0, `${n}: Geschosse aufgeräumt`);
    assert.equal(buch.felder.length, 0, `${n}: Felder aufgeräumt`);
  }
  assert.deepEqual(typen.feuerball, ['schlag', 'start', 'einschlag', 'feld', 'feldTakt', 'feldEnde']);
  assert.deepEqual(typen.arkan, ['schlag', 'start', 'einschlag']);
  assert.deepEqual(typen.blitz, ['schlag', 'start', 'strahl']);
  assert.deepEqual(typen.frostnova, ['schlag', 'start', 'nova']);
  assert.deepEqual(typen.meteor, ['schlag', 'start', 'ankuendigung', 'einschlag', 'feld', 'feldTakt', 'feldEnde']);
  assert.deepEqual(typen.blinzeln, ['schlag', 'start', 'teleport']);
  assert.deepEqual(typen.heilung, ['schlag', 'start', 'selbst']);
});

test('Feuerball im Bogen auf einen Bodenpunkt, Fläche trifft Nachbarn schwächer', () => {
  const ratten = [gegner('a', 0, 9, 0.34), gegner('b', 1.5, 10, 0.34), gegner('c', 0, 20, 0.34)];
  const buch = createZauberbuch({ freiesMana: true, welt: { bodenHoehe: () => 0 } });
  buch.wirke('feuerball', { vorlauf: 0, ziel: { von: HAND, yaw: 0, punkt: { x: 0, y: 0, z: 9 } } });
  let hoch = 0;
  const es = [];
  for (let t = 0; t < 2; t += 1 / 60) { for (const e of buch.update(1 / 60, ratten)) es.push({ ...e }); for (const g of buch.geschosse) hoch = Math.max(hoch, g.y); }
  const e = es.find((x) => x.typ === 'einschlag');
  assert.ok(hoch > 1.3, 'fliegt im Bogen über Handhöhe');
  assert.ok(Math.hypot(e.pos.x, e.pos.z - 9) < 0.8, `landet am Zielpunkt (${e.pos.z})`);
  const a = e.treffer.find((t) => t.id === 'a'), b = e.treffer.find((t) => t.id === 'b');
  assert.ok(a.schaden > b.schaden && b.schaden >= 17);
  assert.ok(b.stoss.y > 0);
  assert.ok(!e.treffer.some((t) => t.id === 'c'));
});

test('Eislanze durchbohrt eine Reihe niedriger Gegner, Blitz springt weiter, Teleport in Blickrichtung', () => {
  const reihe = [3, 5, 7, 9, 11].map((z, i) => gegner('r' + i, 0, z, 0.34));
  let buch = createZauberbuch({ freiesMana: true, welt: { bodenHoehe: () => 0 } });
  buch.wirke('eislanze', { vorlauf: 0, ziel: { von: HAND, yaw: 0, ziel: reihe[0] } });
  const es = lauf(buch, reihe, 2);
  const ids = es.filter((e) => e.typ === 'durchschlag' || e.typ === 'einschlag').flatMap((e) => e.treffer.map((t) => t.id));
  assert.deepEqual(ids, ['r0', 'r1', 'r2', 'r3', 'r4']);
  assert.ok(es.some((e) => e.typ === 'durchschlag' && e.treffer[0].verlangsamt > 0));

  const ziele = [gegner('a', 0, 6), gegner('b', 1.5, 7)];
  buch = createZauberbuch({ freiesMana: true });
  buch.wirke('blitz', { vorlauf: 0, ziel: { von: HAND, yaw: 0 } });   // ohne Ziel: sucht selbst im Kegel
  const s = lauf(buch, ziele, 0.1).find((x) => x.typ === 'strahl');
  assert.deepEqual(s.treffer.map((t) => t.id), ['a', 'b']);
  assert.equal(s.punkte.length, 3);
  assert.ok(s.treffer[1].schaden < s.treffer[0].schaden);
  buch = createZauberbuch({ freiesMana: true });
  buch.wirke('blinzeln', { vorlauf: 0, ziel: { von: { x: 1, y: 0, z: 1 }, yaw: Math.PI / 2 } });
  const t = lauf(buch, [], 0.1).find((x) => x.typ === 'teleport');
  assert.ok(Math.abs(t.nach.x - 10) < 1e-6 && Math.abs(t.nach.z - 1) < 1e-6);
  assert.equal(zielImKegel(ziele, { x: 0, z: 0 }, Math.PI, 20, 0.5), null);
});

test('Sog zieht zur Mitte und endet mit einem Schluss-Schlag, Nova trifft rundum', () => {
  const ziele = [gegner('a', 4, 10, 0.34), gegner('b', -3, 10, 0.34), gegner('fern', 0, 30, 0.34)];
  let buch = createZauberbuch({ freiesMana: true, welt: { bodenHoehe: () => 0 } });
  buch.wirke('sog', { vorlauf: 0, ziel: { von: HAND, yaw: 0, punkt: { x: 0, y: 0, z: 10 } } });
  const es = [];
  for (let t = 0; t < 4; t += 1 / 60) for (const e of buch.update(1 / 60, ziele)) {
    es.push({ ...e });
    for (const tr of e.treffer) if (tr.zug) { tr.ziel.x += tr.zug.x * 0.1; tr.ziel.z += tr.zug.z * 0.1; }   // Spiel wendet den Zug an
  }
  const feld = es.find((e) => e.typ === 'feld'), takt = es.find((e) => e.typ === 'feldTakt'), ende = es.find((e) => e.typ === 'feldEnde');
  assert.ok(feld.sog > 0 && feld.dauer > 2);
  assert.ok(takt.treffer.find((t) => t.id === 'a').zug.x < 0, 'zieht a nach links zur Mitte');
  assert.ok(Math.abs(ziele[0].x) < 1.2 && Math.abs(ziele[1].x) < 1.2, 'beide liegen am Ende in der Mitte');
  assert.equal(ende.schlag, true);
  assert.deepEqual(ende.treffer.map((t) => t.id).sort(), ['a', 'b']);
  assert.ok(ende.treffer[0].schaden >= 15 && ende.treffer[0].umwerfen);

  buch = createZauberbuch({ freiesMana: true });
  const rund = [gegner('v', 0, 4), gegner('h', 0, -4), gegner('weit', 0, 12)];
  buch.wirke('frostnova', { vorlauf: 0, ziel: { von: HAND, fuss: FUSS, yaw: 0 } });
  const nova = lauf(buch, rund, 0.1).find((e) => e.typ === 'nova');
  assert.deepEqual(nova.treffer.map((t) => t.id), ['v', 'h']);
  assert.ok(nova.treffer[0].verlangsamt > 0);
});
