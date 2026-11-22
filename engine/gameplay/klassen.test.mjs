import test from 'node:test';
import assert from 'node:assert/strict';
import { KLASSEN, KLASSEN_FAEHIGKEITEN, FREI_STUFEN, freigeschaltet, neuFreigeschaltet, ressourcenVon } from './klassen-daten.js';
import { createLeiste } from './faehigkeiten.js';

test('Daten vollständig: Krieger/Waldläufer je 5 Fähigkeiten auf Stufe 1/3/5/8/12, Magier acht Zauber', () => {
  for (const k of ['krieger', 'waldlaeufer']) {
    const stufen = KLASSEN[k].faehigkeiten.map((n) => KLASSEN_FAEHIGKEITEN[n].freiStufe);
    assert.deepEqual(stufen, [...FREI_STUFEN]);
  }
  assert.equal(KLASSEN.magier.faehigkeiten.length, 8);
  for (const d of Object.values(KLASSEN_FAEHIGKEITEN)) assert.ok(d.name && d.symbol && d.wirkung?.typ && d.ressource);
});

test('Freischaltung je Stufe', () => {
  assert.deepEqual(freigeschaltet('krieger', 1), ['wuchtschlag']);
  assert.deepEqual(freigeschaltet('krieger', 4), ['wuchtschlag', 'wirbelwind']);
  assert.equal(freigeschaltet('waldlaeufer', 12).length, 5);
  assert.deepEqual(freigeschaltet('magier', 5), ['feuerball', 'eislanze', 'wasserguss', 'blitz']);
  assert.deepEqual(freigeschaltet('unbekannt', 5), []);
});

test('neuFreigeschaltet nennt nur das Neue', () => {
  assert.deepEqual(neuFreigeschaltet('krieger', 3), ['wirbelwind']);
  assert.deepEqual(neuFreigeschaltet('krieger', 4), []);
  assert.deepEqual(neuFreigeschaltet('magier', 8, 5), ['erdstachel', 'windstoss']);
});

test('Ressourcen-Regeln: Wut startet leer, verfällt und wächst durch gib(); Energie regeneriert', () => {
  const kr = createLeiste({ faehigkeiten: KLASSEN_FAEHIGKEITEN, ressourcen: ressourcenVon('krieger') });
  assert.equal(kr.ressource('wut').wert, 0);
  assert.equal(kr.nutze('wirbelwind').ok, false);       // zu wenig Wut
  kr.gib('wut', 40); kr.update(1);
  assert.equal(Math.round(kr.ressource('wut').wert), 38);
  assert.equal(kr.nutze('wirbelwind').ok, true);
  const wl = createLeiste({ faehigkeiten: KLASSEN_FAEHIGKEITEN, ressourcen: ressourcenVon('waldlaeufer') });
  assert.equal(wl.nutze('pfeilhagel').ok, true);
  wl.update(1);
  assert.ok(wl.ressource('energie').wert > 50);
  assert.equal(wl.ressource('wut'), null);
});

test('Jede Nicht-Magier-Wirkung hat einen bekannten Typ', () => {
  const typen = new Set(['nahkampf', 'wirbel', 'ansturm', 'schild', 'beben', 'schuss', 'gift', 'salto', 'hagel', 'fokus', 'zauber']);
  for (const d of Object.values(KLASSEN_FAEHIGKEITEN)) assert.ok(typen.has(d.wirkung.typ), d.name);
});
