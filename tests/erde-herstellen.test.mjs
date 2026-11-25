// Prüft die Herstellen-Daten des Erde-Labors (labore/erde/js/herstellen-daten.js) mit engine/gameplay/rezepte + inventar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRezepte } from '../engine/gameplay/rezepte.js';
import { createInventar } from '../engine/gameplay/inventar.js';
import { REZEPTE, KLEIDUNG, NAMEN, rohstoffe, zwischenprodukte, stationenAus, kleidungWaerme, HACKE, AXT, stufe, hackeName } from '../labore/erde/js/herstellen-daten.js';
import { gegenstandName } from '../labore/erde/js/aktionen.js';
import { ernte } from '../labore/erde/js/ernte.js';
import { grabung } from '../labore/erde/js/boden.js';

// Gegenstands-IDs laut docs/plaene/ERDE-UEBERLEBEN.md (Vertrag mit Ernte, Graben, Tiere, Bauen)
const BEKANNT = new Set(('holz rinde ruten stoecke beeren fasern schilf moos laub pilz steinpilz fisch kokosnuss oliven kaktusfleisch ' +
  'steine schieferplatten wolle flechten eisenerz kupfererz kohle gold salz feuerstein quarz ammonit erde lehm sand ' +
  'axt schaufel spitzhacke eisenhacke fleisch fell knochen seil speer fackel fellmantel fellstiefel gebratenesFleisch ' +
  'gebratenerFisch beerenbrei pfeil bogen lagerfeuer werkbank ' +
  'holzkohle kupferbarren eisenbarren naegel kupferaxt kupferhacke eisenaxt eisenspeer schmelzofen amboss eisentuer gleiter').split(' '));
const STATION = new Set(['lagerfeuer', 'werkbank', 'schmelzofen', 'amboss', 'schmiede']);

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

test('Station nötig: Braten nur am Lagerfeuer, Barren im Schmelzofen, Eisenhacke nur an Werkbank + Amboss', () => {
  const { r, inv } = neu();
  for (const id of [...rohstoffe(), ...zwischenprodukte()]) inv.gib(id, 20);
  assert.equal(r.pruefe('gebratenesFleisch', inv).grund, 'station');
  assert.ok(r.pruefe('gebratenesFleisch', inv, { stationen: stationenAus(['lagerfeuer']) }).ok);
  assert.equal(r.pruefe('kupferbarren', inv, { stationen: stationenAus(['lagerfeuer', 'werkbank']) }).grund, 'station');
  assert.ok(r.pruefe('kupferbarren', inv, { stationen: stationenAus(['schmelzofen']) }).ok);
  assert.equal(r.pruefe('eisenhacke', inv, { stationen: stationenAus(['werkbank', 'lagerfeuer']) }).grund, 'station');
  assert.equal(r.pruefe('eisenhacke', inv, { stationen: stationenAus(['amboss']) }).grund, 'station');
  assert.ok(r.pruefe('eisenhacke', inv, { stationen: stationenAus(['werkbank', 'amboss']) }).ok);
  // Mit allen Roh- und Zwischenstoffen und allen Stationen geht jedes Rezept
  const alle = r.moeglich(inv, { stationen: stationenAus(['werkbank', 'lagerfeuer', 'schmelzofen', 'amboss']) }).map((x) => x.id);
  for (const id of Object.keys(REZEPTE)) assert.ok(alle.includes(id), id);
});

test('Fortschritt Stein → Kupfer → Eisen: aus Holz und Erz bis zur Eisen-Spitzhacke, jede Stufe schafft mehr', () => {
  const { r, inv } = neu();
  const st = { stationen: stationenAus(['lagerfeuer', 'werkbank', 'schmelzofen', 'amboss']) };
  const her = (id, n = 1) => { for (let k = 0; k < n; k++) assert.ok(r.stelleHer(id, inv, st), id); };
  const hat = (id) => inv.hat(id, 1), hacke = () => stufe(HACKE, hat);
  inv.gib('spitzhacke', 1); inv.gib('axt', 1); inv.gib('holz', 40);
  assert.equal(hacke(), 2);
  // Stein-Spitzhacke: Erzbrocken gibt Kupfer, das Eisenerz bleibt drin; Granit geht noch nicht
  const stein = ernte('erzbrocken', 1, { axt: 1, hacke: hacke() });
  assert.ok(stein.gibt.some(([id]) => id === 'kupfererz') && !stein.gibt.some(([id]) => id === 'eisenerz'));
  assert.deepEqual(stein.verpasst.map((v) => [v.id, hackeName(v.stufe)]), [['eisenerz', 'Kupfer-Spitzhacke']]);
  assert.equal(grabung('granit', [1, 2, 3], 5, hacke()).ok, false);
  inv.gib('kupfererz', 6);
  her('holzkohleOfen', 2); her('kupferbarren', 3); her('kupferhacke');
  assert.equal(hacke(), 3);
  assert.ok(grabung('granit', [1, 2, 3], 5, hacke()).ok);
  assert.ok(ernte('erzbrocken', 1, { axt: 1, hacke: hacke() }).gibt.some(([id]) => id === 'eisenerz'));
  inv.gib('eisenerz', 6);
  her('holzkohle', 2); her('holzkohleOfen', 2); her('eisenbarren', 3); her('eisenhacke');
  assert.equal(hacke(), 4);
  // Axt-Stufen: Eisen-Axt gibt mehr Holz als die Stein-Axt
  assert.equal(stufe(AXT, hat), 1);
  const holz = (axt) => ernte('eiche', 1, { axt, hacke: 0 }).gibt.find(([id]) => id === 'holz')[1];
  assert.ok(holz(3) > holz(2) && holz(2) > holz(1) && holz(true) === holz(1));
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
