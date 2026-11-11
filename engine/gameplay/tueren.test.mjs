import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTueren } from './tueren.js';
import { createKollisionsWelt } from '../world/kollision.js';
import { createInteraktion } from './interaktion.js';
import { createInventar } from './inventar.js';

const basis = () => createKollisionsWelt({ welt: { bodenHoehe: () => 0, wasserHoehe: () => null, hindernisse: () => null } });
const nah = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const lauf = (t, s) => { for (let i = 0; i < Math.round(s / 0.05); i++) t.update(0.05); };

test('neu legt Körper an, öffnen entfernt ihn, schließen setzt ihn wieder', () => {
  const welt = basis(), t = createTueren({ welt });
  const d = t.neu('a', { x: 5, z: 5 });
  assert.equal(welt.anzahl, 1);
  assert.ok(welt.hindernisse(5, 5.1, 0.3));
  assert.equal(t.oeffne('a').ok, true);
  assert.equal(welt.anzahl, 0);
  assert.equal(welt.hindernisse(5, 5.1, 0.3), null);
  assert.equal(t.schliesse('a').ok, true);
  assert.equal(welt.anzahl, 1);
  assert.equal(d.offen, false);
  assert.equal(t.oeffne('x').grund, 'unbekannt');
});

test('anteil läuft in update von 0 auf 1 in ~dauer', () => {
  const t = createTueren({ dauer: 0.4 });
  const d = t.neu('a', { x: 0, z: 0 });
  t.oeffne('a');
  assert.equal(d.anteil, 0);
  assert.equal(t.update(0.2), 1);
  assert.ok(nah(d.anteil, 0.5));
  t.update(0.2);
  assert.equal(d.anteil, 1);
  assert.equal(t.update(0.1), 0);
  assert.ok(nah(Math.abs(d.drehung), 1.75));
  t.schliesse('a'); lauf(t, 0.5);
  assert.equal(d.anteil, 0);
  assert.equal(d.drehung, 0);
});

// freies Ende des Blatts nach der Drehung um die Angel (rotation.y = d)
function freiesEnde(d) {
  const a = d.angelPos, ax = Math.cos(d.winkel), az = -Math.sin(d.winkel);
  const v = d.angel === 'links' ? 1 : -1, lx = ax * v * d.breite, lz = az * v * d.breite, w = d.drehung;
  return { x: a.x + lx * Math.cos(w) + lz * Math.sin(w), z: a.z - lx * Math.sin(w) + lz * Math.cos(w) };
}

test('Blatt schwingt von der Figur weg (alle Winkel/Angeln)', () => {
  for (const angel of ['links', 'rechts']) for (const winkel of [0, 0.7, 2.2]) for (const s of [1, -1]) {
    const t = createTueren({ dauer: 0 });
    const d = t.neu('a', { x: 3, z: -2, winkel, angel, breite: 1.2 });
    const n = { x: Math.sin(winkel), z: Math.cos(winkel) };
    t.oeffne('a', { x: 3 + n.x * s * 2, z: -2 + n.z * s * 2 });
    t.update(1);
    const e = freiesEnde(d);
    const seite = (e.x - d.x) * n.x + (e.z - d.z) * n.z;
    assert.ok(seite * s < -0.5, `${angel} ${winkel} ${s}`);
    assert.equal(Math.sign(d.drehung), d.seite);
  }
});

test('angelPos links/rechts und Seite bleibt ohne wer', () => {
  const t = createTueren();
  const l = t.neu('l', { x: 10, z: 0, breite: 2, angel: 'links' });
  const r = t.neu('r', { x: 10, z: 0, breite: 2, angel: 'rechts' });
  assert.ok(nah(l.angelPos.x, 9) && nah(r.angelPos.x, 11));
  const q = t.neu('q', { x: 0, z: 0, breite: 2, winkel: Math.PI / 2, angel: 'rechts' });
  assert.ok(nah(q.angelPos.x, 0) && nah(q.angelPos.z, -1));
  t.oeffne('l', { x: 10, z: 3 }); const s = l.seite;
  t.schliesse('l'); t.oeffne('l');
  assert.equal(l.seite, s);
});

test('schließen wird blockiert, wenn etwas in der Öffnung steht', () => {
  const welt = basis(), t = createTueren({ welt });
  t.neu('a', { x: 0, z: 0 });
  t.oeffne('a');
  const k = welt.fuege({ x: 0.1, z: 0.2, radius: 0.3 });
  const r = t.schliesse('a');
  assert.deepEqual(r, { ok: false, grund: 'blockiert', offen: true });
  assert.equal(welt.anzahl, 1);
  welt.entferne(k);
  assert.equal(t.schliesse('a').ok, true);
});

test('Schlüssel: ohne verschlossen, mit auf, verbraucht nimmt ihn weg', () => {
  const log = [];
  const t = createTueren({ ereignisse: { sende: (n) => log.push(n) } });
  const d = t.neu('a', { x: 0, z: 0, schluessel: 'schluessel', verbraucht: true });
  assert.equal(d.verschlossen, true);
  assert.deepEqual(t.oeffne('a', { x: 0, z: 2 }), { ok: false, grund: 'verschlossen', offen: false });
  assert.deepEqual(log, ['tuer:verschlossen']);
  const inv = createInventar({ plaetze: 4 });
  inv.gib('schluessel', 1);
  assert.equal(t.oeffne('a', { x: 0, z: 2, inventar: inv }).ok, true);
  assert.equal(d.verschlossen, false);
  assert.equal(inv.zaehle('schluessel'), 0);
  assert.deepEqual(log, ['tuer:verschlossen', 'tuer:auf']);
  t.schliesse('a');
  assert.equal(t.oeffne('a').ok, true);   // bleibt aufgeschlossen
  const b = t.neu('b', { x: 5, z: 0, schluessel: 'schluessel' });
  inv.gib('schluessel', 1);
  t.oeffne('b', { inventar: inv });
  assert.equal(inv.zaehle('schluessel'), 1);
  t.schliesse('b'); t.sperre('b');
  assert.equal(b.verschlossen, true);
});

test('autoZu schließt von selbst, bei Blockade nach 1 s erneut', () => {
  const welt = basis(), t = createTueren({ welt, autoZu: 2, dauer: 0.1 });
  const d = t.neu('a', { x: 0, z: 0 });
  t.oeffne('a'); lauf(t, 1.5);
  assert.equal(d.offen, true);
  lauf(t, 1);
  assert.equal(d.offen, false);
  t.oeffne('a');
  const k = welt.fuege({ x: 0, z: 0.1, radius: 0.3 });
  lauf(t, 2.5);
  assert.equal(d.offen, true);
  welt.entferne(k);
  lauf(t, 0.3);
  assert.equal(d.offen, true);
  lauf(t, 1);
  assert.equal(d.offen, false);
});

test('Interaktions-Ziel mit wechselndem Text', () => {
  const ia = createInteraktion();
  const t = createTueren({ interaktion: ia });
  t.neu('a', { x: 2, z: 2, name: 'Tor', schluessel: 'k' });
  const z = ia.hole('tuer:a');
  assert.equal(z.art, 'tuer');
  assert.equal(z.text, 'Tor (verschlossen)');
  t.sperre('a', false);
  assert.equal(ia.hole('tuer:a').text, 'Tor öffnen');
  ia.ausloesen({ x: 2, z: 3 });
  assert.equal(t.hole('a').offen, true);
  assert.equal(ia.hole('tuer:a').text, 'Tor schließen');
});

test('zustand/lade über JSON, Körper passend', () => {
  const welt = basis(), t = createTueren({ welt });
  t.neu('a', { x: 0, z: 0 }); t.neu('b', { x: 5, z: 0, schluessel: 's' });
  t.oeffne('a');
  const stand = JSON.parse(JSON.stringify(t.zustand()));
  assert.deepEqual(stand, { a: { o: 1, v: 0, s: 1 }, b: { o: 0, v: 1, s: 1 } });
  const w2 = basis(), t2 = createTueren({ welt: w2 });
  t2.neu('a', { x: 0, z: 0 }); t2.neu('b', { x: 5, z: 0, schluessel: 's' });
  t2.lade(stand);
  assert.equal(t2.hole('a').offen, true);
  assert.equal(t2.hole('a').anteil, 1);
  assert.equal(t2.hole('b').verschlossen, true);
  assert.equal(w2.anzahl, 1);
  t2.lade({ a: { o: 0, v: 0 }, zz: { o: 1, v: 0 } });
  assert.equal(w2.anzahl, 2);
  assert.equal(t2.hole('a').anteil, 0);
});

test('entferne/dispose räumen Körper und Ziele ab', () => {
  const welt = basis(), ia = createInteraktion(), t = createTueren({ welt, interaktion: ia });
  t.neu('a', { x: 0, z: 0 }); t.neu('b', { x: 5, z: 0 });
  assert.equal(t.entferne('a'), true);
  assert.equal(welt.anzahl, 1);
  assert.equal(ia.hat('tuer:a'), false);
  assert.equal(t.anzahl, 1);
  t.dispose();
  assert.equal(welt.anzahl, 0);
  assert.equal(ia.anzahl, 0);
  assert.equal(t.anzahl, 0);
});

test('1.0.1: Schwenkrichtung einer offenen Tür übersteht Speichern/Laden', () => {
  const a = createTueren(), b = createTueren();
  const t = a.neu('t', { x: 0, z: 0 }), u = b.neu('t', { x: 0, z: 0 });
  a.oeffne('t', { x: 0, z: -2 }); a.update(1);
  const s1 = t.seite;
  a.schliesse('t'); a.update(1);
  a.oeffne('t', { x: 0, z: 2 }); a.update(1);
  assert.equal(t.seite, -s1);
  b.lade(JSON.parse(JSON.stringify(a.zustand())));
  assert.equal(u.offen, true);
  assert.equal(u.seite, t.seite);
  assert.equal(u.drehung, t.drehung);
});
