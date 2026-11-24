// Prüft die Herstellen-Daten des Erde-Labors (labore/erde/js/herstellen-daten.js) mit engine/gameplay/rezepte + inventar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRezepte } from '../engine/gameplay/rezepte.js';
import { createInventar } from '../engine/gameplay/inventar.js';
import { REZEPTE, KLEIDUNG, NAMEN, rohstoffe, stationenAus, kleidungWaerme } from '../labore/erde/js/herstellen-daten.js';
import { gegenstandName } from '../labore/erde/js/aktionen.js';

// Gegenstands-IDs laut docs/plaene/ERDE-UEBERLEBEN.md (Vertrag mit Ernte, Graben, Tiere, Bauen)
const BEKANNT = new Set(('holz rinde ruten stoecke beeren fasern schilf moos laub pilz steinpilz fisch kokosnuss oliven kaktusfleisch ' +
  'steine schieferplatten wolle flechten eisenerz kupfererz kohle gold salz feuerstein quarz ammonit erde lehm sand ' +
  'axt schaufel spitzhacke eisenhacke fleisch fell knochen seil speer fackel fellmantel fellstiefel gebratenesFleisch ' +
  'gebratenerFisch beerenbrei pfeil bogen lagerfeuer werkbank').split(' '));
const STATION = new Set(['lagerfeuer', 'werkbank', 'schmiede']);

function neu(plaetze = 30) {
  const r = createRezepte();
  r.definiereAlle(REZEPTE);
  return { r, inv: createInventar({ plaetze, stapel: 999 }) };
}

test('Jede Zutat und jedes Ergebnis ist eine bekannte Gegenstands-ID mit deutschem Namen, Stationen gibt es', () => {
  const { r } = neu();
  for (const rz of r.alle()) {
    for (const id of [rz.ergebnis.id, ...Object.keys(rz.zutaten)]) {
      assert.ok(BEKANNT.has(id), `${rz.id}: unbekannte ID '${id}'`);
      const n = NAMEN[id] ?? gegenstandName(id);
      assert.ok(n !== id && /^[A-ZÄÖÜ]/.test(n), `${id}: kein Anzeigename`);
    }
    assert.ok(rz.station === null || STATION.has(rz.station), `${rz.id}: Station ${rz.station}`);
  }
  for (const id of Object.keys(KLEIDUNG)) assert.ok(r.alle().some((rz) => rz.ergebnis.id === id), `${id} nicht herstellbar`);
});

test('Herstellen ist alles oder nichts: fehlt eine Zutat oder ist die Tasche voll, bleibt alles gleich', () => {
  const { r, inv } = neu(1);
  inv.gib('fasern', 2);
  assert.equal(r.stelleHer('seil', inv), null);
  assert.equal(inv.zaehle('fasern'), 2);
  inv.gib('fasern', 2);                               // 4 Fasern, aber kein Platz fürs Seil
  assert.equal(r.stelleHer('seil', inv), null);
  assert.equal(inv.zaehle('fasern'), 4);
  const g = neu();
  g.inv.gib('fasern', 4);
  assert.deepEqual(g.r.stelleHer('seil', g.inv), { id: 'seil', anzahl: 1 });
  assert.equal(g.inv.zaehle('fasern'), 1);
  assert.equal(g.inv.zaehle('seil'), 1);
});

test('Station nötig: Braten nur am Lagerfeuer, Eisenhacke nur an Lagerfeuer + Werkbank', () => {
  const { r, inv } = neu();
  for (const id of rohstoffe()) inv.gib(id, 20);
  assert.equal(r.pruefe('gebratenesFleisch', inv).grund, 'station');
  assert.ok(r.pruefe('gebratenesFleisch', inv, { stationen: stationenAus(['lagerfeuer']) }).ok);
  assert.equal(r.pruefe('eisenhacke', inv, { stationen: stationenAus(['werkbank']) }).grund, 'station');
  assert.ok(r.pruefe('eisenhacke', inv, { stationen: stationenAus(['werkbank', 'lagerfeuer']) }).ok);
  // Mit allen Rohstoffen und allen Stationen geht jedes Rezept, das kein Zwischenprodukt braucht
  const alle = r.moeglich(inv, { stationen: stationenAus(['werkbank', 'lagerfeuer']) }).map((x) => x.id);
  for (const [id, rz] of Object.entries(REZEPTE)) if (!rz.zutaten.seil) assert.ok(alle.includes(id), id);
});

test('Kleidungswärme: Mantel +8 °C, Stiefel +3 °C, nur was in der Tasche ist, je Platz ein Stück', () => {
  const tasche = new Set(['fellmantel', 'fellstiefel']);
  const hat = (id) => tasche.has(id);
  assert.equal(kleidungWaerme([], hat), 0);
  assert.equal(kleidungWaerme(['fellmantel'], hat), 8);
  assert.equal(kleidungWaerme(['fellmantel', 'fellstiefel', 'fellmantel'], hat), 11);
  tasche.delete('fellmantel');                       // z. B. beim Tod verloren
  assert.equal(kleidungWaerme(['fellmantel', 'fellstiefel'], hat), 3);
  assert.equal(kleidungWaerme(['seil', 'unbekannt'], () => true), 0);
});
