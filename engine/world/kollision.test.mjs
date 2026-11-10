import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKollisionsWelt } from './kollision.js';
import { createMotor } from '../gameplay/character-motor.js';

const flach = () => ({ bodenHoehe: () => 0 });
const nah = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

test('Kreis schiebt aus, entfernen hebt die Sperre auf', () => {
  const w = createKollisionsWelt({ welt: flach() });
  const id = w.fuege({ x: 0, z: 0, radius: 1 });
  const s = w.hindernisse(1.1, 0, 0.3);
  assert.ok(nah(s.x, 0.2) && nah(s.z, 0));
  assert.equal(w.hindernisse(2, 0, 0.3), null);
  assert.equal(w.entferne(id), true);
  assert.equal(w.hindernisse(1.1, 0, 0.3), null);
  assert.equal(w.anzahl, 0);
});

test('gedrehter Kasten: Seite, Ecke und Mittelpunkt innen', () => {
  const w = createKollisionsWelt({ welt: flach() });
  w.fuege({ form: 'kasten', x: 0, z: 0, bx: 2, bz: 0.5 });
  let s = w.hindernisse(0, 0.7, 0.3);
  assert.ok(nah(s.x, 0) && nah(s.z, 0.1));
  s = w.hindernisse(0.2, 0.1, 0.3);                 // innen → über die nächste Seite hinaus
  assert.ok(nah(s.z, 0.4 + 0.3) && nah(s.x, 0));
  assert.equal(w.hindernisse(2.3, 0.8, 0.3), null);  // Ecke: Abstand > Radius
  const d = createKollisionsWelt({ welt: flach() });
  d.fuege({ form: 'kasten', x: 0, z: 0, bx: 2, bz: 0.5, winkel: Math.PI / 2 });   // jetzt lang in z
  assert.equal(d.hindernisse(1, 0, 0.3), null);
  assert.ok(d.hindernisse(0, 1.8, 0.3) !== null && d.hindernisse(0.7, 1.8, 0.3) !== null && d.hindernisse(0.9, 1.8, 0.3) === null);
});

test('Höhen-Filter: drüber, drunter, begehbar ab Stufenhöhe', () => {
  const w = createKollisionsWelt({ welt: flach(), stufe: 0.45 });
  const id = w.fuege({ x: 0, z: 0, radius: 1, hoehe: 1, begehbar: true });
  assert.ok(w.hindernisse(0.5, 0, 0.3, { y: 0, hoehe: 1.75 }));
  assert.equal(w.hindernisse(0.5, 0, 0.3, { y: 0.6, hoehe: 1.75 }), null);   // Oberkante in Stufenhöhe
  assert.equal(w.hindernisse(0.5, 0, 0.3, { y: -3, hoehe: 1.75 }), null);    // darunter
  assert.equal(w.hindernisse(0.5, 0, 0.3, { y: 0, ausser: id }), null);
  assert.equal(w.bodenHoehe(0.5, 0), 0);                                      // ohne y: nur Gelände
  assert.equal(w.bodenHoehe(0.5, 0, 0), 0);                                   // zu hoch zum Hochsteigen
  assert.equal(w.bodenHoehe(0.5, 0, 0.6), 1);
  assert.equal(w.bodenHoehe(3, 0, 0.6), 0);
});

test('weich: nur ein Teil des Ausschiebens; fest=false schiebt gar nicht', () => {
  const w = createKollisionsWelt({ welt: flach() });
  w.fuege({ x: 0, z: 0, radius: 0.3, weich: 0.5 });
  assert.ok(nah(w.hindernisse(0.4, 0, 0.3).x, 0.1));
  const g = createKollisionsWelt({ welt: flach() });
  g.fuege({ x: 0, z: 0, radius: 1, fest: false });
  assert.equal(g.hindernisse(0.4, 0, 0.3), null);
  assert.ok(g.strahl({ x: -5, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 10));
});

test('Adapter-Hindernisse werden addiert, übrige Felder durchgereicht', () => {
  const w = createKollisionsWelt({ welt: { bodenHoehe: () => 2, hindernisse: () => ({ x: 0.5, z: 0 }), biomBei: () => 'wiese' } });
  assert.equal(w.hindernisse(0, 0, 0.3).x, 0.5);
  assert.equal(w.biomBei(0, 0), 'wiese');
  assert.equal(w.wasserHoehe(0, 0), null);
  w.fuege({ x: 0, z: 1, radius: 1 });
  assert.equal(w.hole(1).y0, 2);                    // Unterkante = Boden
  const s = w.hindernisse(0, 0, 0.3);
  assert.ok(nah(s.x, 0.5) && nah(s.z, -0.3));
});

test('bewegen verschiebt den Körper', () => {
  const w = createKollisionsWelt({ welt: flach() });
  const id = w.fuege({ x: 0, z: 0, radius: 0.5 });
  assert.equal(w.bewege(id, 50, 50, 3), true);
  assert.equal(w.hindernisse(0, 0, 0.3), null);
  assert.ok(w.hindernisse(50, 50.2, 0.3, { y: 3 }));
  assert.equal(w.bewege('gibtsnicht', 0, 0), false);
});

test('Strahl trifft Boden, Zylinder und Kasten – das Nächste gewinnt', () => {
  const w = createKollisionsWelt({ welt: { bodenHoehe: (x) => (x > 20 ? 10 : 0) } });
  let t = w.strahl({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 50);
  assert.equal(t.art, 'boden'); assert.ok(nah(t.distanz, 20, 0.01));
  const a = w.fuege({ x: 10, z: 0, radius: 1, hoehe: 2, daten: 'fass' });
  t = w.strahl({ x: 0, y: 1, z: 0 }, { x: 2, y: 0, z: 0 }, 50);
  assert.equal(t.id, a); assert.equal(t.daten, 'fass'); assert.ok(nah(t.distanz, 9)); assert.ok(nah(t.x, 9));
  assert.equal(w.strahl({ x: 0, y: 3, z: 0 }, { x: 1, y: 0, z: 0 }, 15), null);          // über dem Fass, vor der Wand
  assert.equal(w.strahl({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 50, { ausser: a }).art, 'boden');
  const k = w.fuege({ form: 'kasten', x: 5, z: 0, bx: 0.5, bz: 2, hoehe: 1.5, winkel: 0.3 });
  t = w.strahl({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 50);
  assert.equal(t.id, k); assert.ok(t.distanz > 4 && t.distanz < 4.6);
  t = w.strahl({ x: 5, y: 9, z: 0 }, { x: 0, y: -1, z: 0 }, 50);                         // senkrecht von oben
  assert.equal(t.id, k); assert.ok(nah(t.distanz, 7.5));
  assert.equal(w.strahl({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }, 5), null);
});

test('Motor: läuft gegen die Kiste, springt drauf, läuft wieder runter', () => {
  const w = createKollisionsWelt({ welt: flach() });
  w.fuege({ form: 'kasten', x: 0, z: 5, bx: 1, bz: 1, hoehe: 0.9, begehbar: true });
  const m = createMotor({ welt: w, pos: { x: 0, y: 0, z: 0 } });
  for (let i = 0; i < 120; i++) m.update(1 / 60, { x: 0, z: 1 });
  assert.ok(m.zustand.pos.z < 4 - 0.29 && m.zustand.pos.z > 3.5, 'steht vor der Kiste: ' + m.zustand.pos.z);
  assert.equal(m.zustand.pos.y, 0);
  m.update(1 / 60, { x: 0, z: 1, springen: true });
  let aufKiste = false;
  for (let i = 0; i < 50; i++) { m.update(1 / 60, { x: 0, z: 1, springen: true }); if (m.zustand.amBoden && Math.abs(m.zustand.pos.y - 0.9) < 1e-6) { aufKiste = true; break; } }
  assert.ok(aufKiste, 'landet auf der Kiste');
  for (let i = 0; i < 90; i++) m.update(1 / 60, { x: 0, z: 1 });
  assert.ok(m.zustand.pos.z > 6.3 && m.zustand.pos.y === 0 && m.zustand.amBoden, 'auf der anderen Seite unten');
});

test('Motor: niedrige begehbare Stufe wird ohne Sprung genommen', () => {
  const w = createKollisionsWelt({ welt: flach() });
  w.fuege({ form: 'kasten', x: 0, z: 3, bx: 1, bz: 1, hoehe: 0.3, begehbar: true });
  const m = createMotor({ welt: w, pos: { x: 0, y: 0, z: 0 } });
  let max = 0;
  for (let i = 0; i < 60; i++) { m.update(1 / 60, { x: 0, z: 1 }); max = Math.max(max, m.zustand.pos.y); }
  assert.ok(nah(max, 0.3) && m.zustand.pos.z > 4);
});

test('Motor: eigener Körper zählt nicht, fremde Figur (weich) bremst nur', () => {
  const w = createKollisionsWelt({ welt: flach() });
  const ich = w.fuege({ x: 0, z: 0, radius: 0.3, hoehe: 1.75, weich: 0.5 });
  const m = createMotor({ welt: w, pos: { x: 0, y: 0, z: 0 }, kollisionsId: ich });
  m.update(0.1, { x: 0, z: 1 });
  assert.ok(m.zustand.pos.z > 0.05, 'nicht vom eigenen Körper festgehalten');
  w.fuege({ x: 0.05, z: 2, radius: 0.3, hoehe: 1.75, weich: 0.5 });
  for (let i = 0; i < 120; i++) { m.update(1 / 60, { x: 0, z: 1 }); w.bewege(ich, m.zustand.pos.x, m.zustand.pos.z); }
  assert.ok(m.zustand.pos.z > 3, 'drängelt sich vorbei: ' + m.zustand.pos.z);
  assert.ok(Math.abs(m.zustand.pos.x) > 0.1, 'wurde zur Seite geschoben');
});

test('Motor: Dash tunnelt nicht durch einen dünnen Stamm', () => {
  const w = createKollisionsWelt({ welt: flach() });
  w.fuege({ x: 0, z: 3, radius: 0.16 });
  const m = createMotor({ welt: w, pos: { x: 0.01, y: 0, z: 0 }, tuning: { rollTempo: 30, rollDauer: 0.3 } });
  m.update(1 / 20, { x: 0, z: 1, rollen: true });
  for (let i = 0; i < 12; i++) { m.update(1 / 20, { x: 0, z: 1, rollen: true }); assert.ok(Math.hypot(m.zustand.pos.x, m.zustand.pos.z - 3) >= 0.45, 'nie im Stamm'); }
  assert.ok(Math.abs(m.zustand.pos.x) > 0.3 || m.zustand.pos.z < 3, 'außen herum statt hindurch');
});

test('Motor: speichern/laden stellt den Lauf exakt wieder her', () => {
  const w = createKollisionsWelt({ welt: { bodenHoehe: (x, z) => Math.sin(x * 0.3) * 2 + z * 0.05 } });
  const m = createMotor({ welt: w, pos: { x: 0, z: 0 }, tuning: { doppelSprung: 1 } });
  const eingabe = (i) => ({ x: Math.sin(i * 0.1), z: 1, springen: i % 40 < 8, rollen: i % 90 === 5, sprint: i % 3 === 0 });
  for (let i = 0; i < 100; i++) m.update(1 / 60, eingabe(i));
  m.stoss(3, 2, 0);
  const stand = JSON.parse(JSON.stringify(m.speichern()));
  for (let i = 100; i < 200; i++) m.update(1 / 60, eingabe(i));
  const ziel = JSON.stringify(m.zustand);
  assert.equal(m.laden(stand), true);
  for (let i = 100; i < 200; i++) m.update(1 / 60, eingabe(i));
  assert.equal(JSON.stringify(m.zustand), ziel);
  assert.equal(m.laden(null), false);
});
