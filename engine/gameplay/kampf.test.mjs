import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKampf } from './kampf.js';
import { createEreignisse } from '../core/ereignisse.js';

function welt(opts) {
  const k = createKampf({ seed: 1, ...opts });
  k.melde('held', { team: 1, leben: 100, werte: { krit: 0 } });
  k.melde('ork', { team: 2, leben: 50, werte: { krit: 0 } });
  return k;
}

test('melde/feindlich/entferne/alle', () => {
  const k = welt();
  assert.equal(k.alle().length, 2); assert.equal(k.feindlich('held', 'ork'), true);
  k.melde('knappe', { team: 1 }); assert.equal(k.feindlich('held', 'knappe'), false);
  k.entferne('knappe'); assert.equal(k.kaempfer('knappe'), null);
});

test('schade: Ergebnis, Ereignis, Bedrohung, imKampf, dps', () => {
  const ev = createEreignisse(); const gehoert = [];
  ev.an('kampf:treffer', (d) => gehoert.push(d));
  const k = welt({ ereignisse: ev });
  const e = k.schade({ quelle: 'held', ziel: 'ork', menge: 20 });
  assert.equal(e.schaden, 20); assert.equal(k.kaempfer('ork').leben, 30);
  assert.equal(gehoert.length, 1); assert.equal(gehoert[0].ziel, 'ork');
  assert.equal(k.bedrohung.ziel('ork'), 'held');
  assert.equal(k.imKampf('ork'), true); assert.equal(k.imKampf('held'), true);
  assert.equal(k.dps('held', 5), 4);
  k.update(6); assert.equal(k.imKampf('ork'), false); assert.equal(k.dps('held', 5), 0);
});

test('schade: Tod meldet kampf:tot, leert Bedrohung und Zustände', () => {
  const k = welt();
  k.gibZustand('ork', 'gift');
  const e = k.schade({ quelle: 'held', ziel: 'ork', menge: 80 });
  assert.equal(e.tot, true);
  const typen = k.update(0).map((x) => x.typ);
  assert.ok(typen.includes('kampf:treffer')); assert.ok(typen.includes('kampf:tot'));
  assert.equal(k.zustaende('ork').liste().length, 0);
  assert.equal(k.bedrohung.ziel('ork'), null);
  assert.equal(k.schade({ quelle: 'held', ziel: 'ork', menge: 5 }).schaden, 0);
});

test('Quelle-Werte fließen ein (Angriff, schadenFaktor aus Zustand Wut)', () => {
  const k = createKampf();
  k.melde('a', { team: 1, werte: { angriff: 100, krit: 0 } }); k.melde('b', { team: 2, leben: 1000 });
  assert.equal(k.schade({ quelle: 'a', ziel: 'b', menge: 10 }).schaden, 20);
  k.gibZustand('a', 'wut');
  assert.equal(k.schade({ quelle: 'a', ziel: 'b', menge: 10 }).schaden, 25);
});

test('Zustand-Rüstung und Verlangsamung wirken auf Kämpfer-Werte', () => {
  const k = welt();
  k.gibZustand('ork', 'schutz'); k.gibZustand('ork', 'verlangsamt');
  const w = k.kaempfer('ork').werte;
  assert.equal(w.ruestung, 50); assert.equal(w.tempo, 0.6);
  assert.ok(Math.abs(k.schade({ quelle: 'held', ziel: 'ork', menge: 30 }).schaden - 20) < 1e-9);
  k.update(11); assert.equal(k.kaempfer('ork').werte.ruestung, 0);
});

test('DoT über update tickt, nutzt Quelle, ignoriert Wucht', () => {
  const k = welt();
  k.schade({ quelle: 'held', ziel: 'ork', menge: 1, wucht: 0, zustand: { name: 'brennen', dauer: 3 } });
  assert.equal(k.zustaende('ork').hat('brennen'), true);
  const ev = k.update(1);
  assert.equal(k.kaempfer('ork').leben, 49 - 4);
  assert.ok(ev.some((e) => e.typ === 'kampf:zustand'));
  k.update(2);
  assert.equal(k.kaempfer('ork').leben, 49 - 12);
  assert.equal(k.zustaende('ork').hat('brennen'), false);
  assert.equal(k.kaempfer('ork').haltung, 100);
});

test('DoT kann töten', () => {
  const k = welt();
  k.kaempfer('ork').nimmSchaden({ menge: 48 });
  k.gibZustand('ork', 'brennen', { quelle: 'held' });
  const typen = k.update(1).map((e) => e.typ);
  assert.ok(typen.includes('kampf:tot')); assert.equal(k.kaempfer('ork').tot, true);
});

test('eingefroren bricht beim Treffer', () => {
  const k = welt();
  k.gibZustand('ork', 'eingefroren');
  assert.equal(k.zustaende('ork').faktoren().kannHandeln, false);
  const typen = (k.schade({ quelle: 'held', ziel: 'ork', menge: 5 }), k.update(0).map((e) => e.typ));
  assert.ok(typen.includes('kampf:zustandEnde'));
  assert.equal(k.zustaende('ork').hat('eingefroren'), false);
});

test('Parade meldet kampf:pariert, Taumeln kampf:taumelt', () => {
  const k = welt();
  const o = k.kaempfer('ork'); o.abwehr.parade = true;
  k.schade({ quelle: 'held', ziel: 'ork', menge: 5, richtung: { x: 0, z: -1 } });
  assert.ok(k.update(0).some((e) => e.typ === 'kampf:pariert'));
  o.abwehr.parade = false;
  k.schade({ quelle: 'held', ziel: 'ork', menge: 1, wucht: 150 });
  assert.ok(k.update(0).some((e) => e.typ === 'kampf:taumelt'));
});

test('Heilung: Ereignis, Bedrohung ½ auf lebende Feinde', () => {
  const k = welt();
  k.melde('heiler', { team: 1, leben: 100 });
  k.kaempfer('held').nimmSchaden({ menge: 50 });
  assert.equal(k.heile({ quelle: 'heiler', ziel: 'held', menge: 40 }), 40);
  assert.equal(k.bedrohung.liste('ork')[0].wert, 20);
  assert.ok(k.update(0).some((e) => e.typ === 'kampf:heilung'));
});

test('Zustand-Paket wird bei Parade/Ausweichen nicht angewendet', () => {
  const k = welt();
  k.kaempfer('ork').abwehr.unverwundbar = true;
  k.schade({ quelle: 'held', ziel: 'ork', menge: 5, zustand: { name: 'gift' } });
  assert.equal(k.zustaende('ork').hat('gift'), false);
});

test('Spott über k.bedrohung', () => {
  const k = welt(); k.melde('tank', { team: 1 });
  k.schade({ quelle: 'held', ziel: 'ork', menge: 40 });
  k.bedrohung.spott('ork', 'tank', 3);
  assert.equal(k.bedrohung.ziel('ork'), 'tank');
});

test('zustand()/laden() Rundreise läuft identisch weiter', () => {
  const a = createKampf({ seed: 9 });
  a.melde('h', { team: 1, leben: 200, werte: { angriff: 20 } }); a.melde('o', { team: 2, leben: 300, werte: { ausweichen: 0.3 } });
  a.schade({ quelle: 'h', ziel: 'o', menge: 10 }); a.gibZustand('o', 'gift', { quelle: 'h' }); a.update(1.2);
  const s = JSON.parse(JSON.stringify(a.zustand()));
  const b = createKampf({ seed: 9 }); b.laden(s);
  assert.equal(b.kaempfer('o').leben, a.kaempfer('o').leben);
  assert.equal(b.zustaende('o').stapel('gift'), 1);
  assert.equal(b.bedrohung.ziel('o'), 'h'); assert.equal(b.dps('h'), a.dps('h'));
  for (let i = 0; i < 4; i++) {
    assert.deepEqual(b.schade({ quelle: 'h', ziel: 'o', menge: 7 }), a.schade({ quelle: 'h', ziel: 'o', menge: 7 }));
    b.update(1); a.update(1);
  }
  assert.equal(b.kaempfer('o').leben, a.kaempfer('o').leben);
});

test('dispose', () => {
  const k = welt(); k.dispose(); assert.equal(k.alle().length, 0);
});
