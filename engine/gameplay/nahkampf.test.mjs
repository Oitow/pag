import test from 'node:test';
import assert from 'node:assert/strict';
import { createNahkampf, WAFFEN, WAFFEN_NAMEN } from './nahkampf.js';

const POS = { x: 0, y: 0, z: 0, yaw: 0 }; // Blick +z
const vorn = { id: 'a', x: 0, y: 0, z: 1.5, radius: 0.4 };
const lauf = (nk, sek, ziele = [], pos = POS) => {
  const out = [];
  for (let i = 0; i < Math.round(sek / 0.01); i++) out.push(...nk.update(0.01, pos, ziele));
  return out;
};
const treffer = (ev) => ev.filter((e) => e.typ === 'treffer').flatMap((e) => e.treffer);

test('Waffen-Tabelle: alle Waffen, Finisher stärker', () => {
  assert.deepEqual(WAFFEN_NAMEN.sort(), ['axt', 'dolch', 'faust', 'hammer', 'schwert', 'speer', 'stab']);
  for (const n of WAFFEN_NAMEN) {
    const l = WAFFEN[n].leicht;
    assert.ok(l.length >= 3 && l.length <= 4);
    assert.ok(l.at(-1).stoss > l[0].stoss);
    assert.ok(WAFFEN[n].schwer.schaden > l.at(-1).schaden);
  }
  assert.ok(WAFFEN.hammer.tempo < WAFFEN.dolch.tempo);
  assert.ok(WAFFEN.speer.leicht[0].reichweite > WAFFEN.schwert.leicht[0].reichweite);
  assert.ok(WAFFEN.hammer.leicht[0].winkel > WAFFEN.speer.leicht[0].winkel);
});

test('Kombo-Kette läuft durch und setzt zurück', () => {
  const nk = createNahkampf({ waffe: 'schwert' });
  const kombos = [];
  let ende = 0;
  for (let i = 0; i < 300; i++) { // Dauerklicken
    nk.angriff('leicht');
    for (const e of nk.update(0.01, POS, [])) { if (e.typ === 'schwung') kombos.push(e.kombo); if (e.typ === 'komboEnde') ende++; }
  }
  assert.deepEqual(kombos.slice(0, 5), [0, 1, 2, 3, 0]);
  assert.ok(ende >= 1);
  const nk2 = createNahkampf();
  nk2.angriff('leicht'); lauf(nk2, 0.3);
  assert.equal(nk2.kombo, 0);
  lauf(nk2, 2);
  assert.equal(nk2.phase, 'bereit');
  assert.equal(nk2.zustand().n, 0);
  // vollständige Kette ohne Puffer: Finisher, dann Ende
  const nk3 = createNahkampf({ waffe: 'axt' });
  let ende3 = 0;
  for (let i = 0; i < 3; i++) { nk3.angriff('leicht'); ende3 += lauf(nk3, i < 2 ? 0.8 : 1.5).filter((e) => e.typ === 'komboEnde').length; }
  assert.equal(ende3, 1);
  assert.equal(nk3.kombo, 0);
});

test('Eingabe-Puffer: im Nachlauf gedrückt -> nächstes Glied; zu früh verfällt', () => {
  const nk = createNahkampf();
  nk.angriff('leicht');
  const s = WAFFEN.schwert.leicht[0];
  lauf(nk, s.vorlauf + s.aktiv + 0.05);
  assert.equal(nk.phase, 'nachlauf');
  assert.equal(nk.angriff('leicht').grund, 'puffer');
  const ev = lauf(nk, 0.5);
  assert.equal(ev.filter((e) => e.typ === 'schwung')[0].kombo, 1);
  const nk2 = createNahkampf();
  nk2.angriff('leicht'); nk2.angriff('leicht'); // sofort im Vorlauf, Puffer 0.3 s
  const ev2 = lauf(nk2, 1);
  assert.equal(ev2.filter((e) => e.typ === 'schwung').length, 1); // nur das erste Glied
});

test('Treffer nur in aktiv, nur im Kegel, nur einmal', () => {
  const nk = createNahkampf();
  const s = WAFFEN.schwert.leicht[0];
  nk.angriff('leicht');
  const vor = lauf(nk, s.vorlauf - 0.02, [vorn]);
  assert.equal(treffer(vor).length, 0);
  const aktiv = lauf(nk, 0.1, [vorn]);
  const t = treffer(aktiv);
  assert.equal(t.length, 1);
  assert.deepEqual(t[0].richtung, { x: 0, z: 1 });
  assert.ok(t[0].stoss.z > 0 && Math.abs(t[0].stoss.x) < 1e-9);
  assert.equal(treffer(lauf(nk, 1, [vorn])).length, 0); // nur einmal
  // hinten / zu weit / seitlich
  const nk2 = createNahkampf(); nk2.angriff('leicht');
  const ev = lauf(nk2, 0.6, [{ id: 'h', x: 0, y: 0, z: -1, radius: 0.3 }, { id: 'w', x: 0, y: 0, z: 9, radius: 0.3 }, { id: 's', x: 2, y: 0, z: 0.1, radius: 0.3 }]);
  assert.equal(treffer(ev).length, 0);
  // mehrere Ziele, je einmal
  const nk3 = createNahkampf(); nk3.angriff('leicht');
  const ev3 = lauf(nk3, 0.6, [vorn, { id: 'b', x: 0.3, y: 0, z: 1.2, radius: 0.3 }]);
  assert.deepEqual(treffer(ev3).map((x) => x.ziel).sort(), ['a', 'b']);
});

test('Ausweichen: unverwundbar, Cancel in Vor-/Nachlauf, nicht in aktiv', () => {
  const nk = createNahkampf();
  nk.angriff('leicht'); lauf(nk, 0.05);
  assert.equal(nk.phase, 'vorlauf');
  assert.equal(nk.ausweichen({ x: 3, z: 0 }).ok, true);
  assert.equal(nk.phase, 'ausweichen');
  assert.equal(nk.abwehr.unverwundbar, true);
  const ev = lauf(nk, 0.1);
  assert.equal(treffer(ev).length, 0);
  lauf(nk, 0.2);
  assert.equal(nk.abwehr.unverwundbar, false);
  lauf(nk, 0.2);
  assert.equal(nk.phase, 'bereit');
  nk.angriff('leicht'); lauf(nk, 0.2); // in aktiv
  assert.equal(nk.phase, 'aktiv');
  assert.equal(nk.ausweichen({ x: 1, z: 0 }).ok, false);
  const e = createNahkampf(); e.ausweichen({ x: 3, z: 4 });
  assert.deepEqual(e.update(0, POS, []).find((x) => x.typ === 'ausweichen').richtung, { x: 0.6, z: 0.8 });
});

test('Block und Parade-Fenster, Taumeln', () => {
  const nk = createNahkampf();
  nk.block(true);
  assert.deepEqual(nk.abwehr, { block: true, parade: true, unverwundbar: false });
  assert.ok(nk.tempoFaktor < 1);
  lauf(nk, 0.1);
  assert.equal(nk.abwehr.parade, true);
  lauf(nk, 0.3);
  assert.deepEqual(nk.abwehr, { block: true, parade: false, unverwundbar: false });
  assert.equal(nk.angriff('leicht').ok, false);
  nk.block(false);
  assert.equal(nk.phase, 'bereit');
  nk.taumle(0.5);
  assert.equal(nk.phase, 'taumeln');
  assert.equal(nk.angriff('leicht').ok, false);
  lauf(nk, 0.6);
  assert.equal(nk.phase, 'bereit');
});

test('Schwerer Schlag: Kraft wächst mit Ladezeit', () => {
  const schlag = (ladeSek) => {
    const nk = createNahkampf({ waffe: 'hammer' });
    nk.angriff('schwer');
    assert.equal(nk.phase, 'laden');
    assert.ok(nk.tempoFaktor < 1);
    const l = lauf(nk, ladeSek);
    if (ladeSek > 0.1) assert.ok(l.some((e) => e.typ === 'laden'));
    nk.lasseLos();
    return lauf(nk, 1.5, [vorn]);
  };
  const kurz = schlag(0.02), mittel = schlag(0.5), lang = schlag(3);
  const k = (ev) => ev.find((e) => e.typ === 'schwung').kraft;
  assert.ok(k(kurz) < k(mittel) && k(mittel) < k(lang));
  assert.ok(Math.abs(k(lang) - 1.8) < 1e-9);
  assert.ok(treffer(lang)[0].menge > treffer(kurz)[0].menge);
  assert.ok(treffer(lang)[0].stoss.z > treffer(kurz)[0].stoss.z);
});

test('zustand()/laden(): Rundlauf deterministisch', () => {
  const a = createNahkampf({ waffe: 'speer' });
  a.angriff('leicht'); lauf(a, 0.2);
  const z = JSON.parse(JSON.stringify(a.zustand()));
  const b = createNahkampf();
  b.laden(z);
  assert.equal(b.waffe, 'speer');
  assert.deepEqual(b.zustand(), z);
  assert.deepEqual(lauf(a, 1, [vorn]), lauf(b, 1, [vorn]));
  assert.equal(b.setWaffe('gibtsnicht'), false);
});
