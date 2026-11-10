import test from 'node:test';
import assert from 'node:assert/strict';
import { createRezepte } from './rezepte.js';
import { createInventar } from './inventar.js';
import { createRegister } from '../core/register.js';
import { createEreignisse } from '../core/ereignisse.js';

function aufbau(plaetze = 4) {
  const gegenstaende = createRegister({ art: 'gegenstand', standard: { stapel: 10 } });
  gegenstaende.definiereAlle({ holz: {}, stein: {}, brett: {}, axt: { stapel: 1, haltbarkeit: 5, tags: ['werkzeug', 'axt'] } });
  const ereignisse = createEreignisse();
  const inv = createInventar({ plaetze, register: gegenstaende });
  const rezepte = createRezepte({ gegenstaende, ereignisse });
  rezepte.definiereAlle({
    axt: { zutaten: { holz: 2, stein: 1 } },
    brett: { zutaten: { holz: 1 }, ergebnis: { id: 'brett', anzahl: 2 }, werkzeug: 'axt' },
    tisch: { zutaten: { brett: 4 }, ergebnis: 'brett', station: 'werkbank' },
  });
  return { gegenstaende, ereignisse, inv, rezepte };
}

test('definiere: Standard-Ergebnis, Name, unbekannte Gegenstände und doppelte ids werfen', () => {
  const { rezepte } = aufbau();
  assert.deepEqual({ ...rezepte.hole('axt').ergebnis }, { id: 'axt', anzahl: 1 });
  assert.deepEqual(rezepte.hole('brett').werkzeug, ['axt']);
  assert.throws(() => rezepte.definiere('axt', {}), /bereits/);
  assert.throws(() => rezepte.definiere('x', { zutaten: { gold: 1 }, ergebnis: 'holz' }), /gold/);
  assert.equal(rezepte.alle().length, 3);
});
test('pruefe: fehlende Zutaten, Werkzeug, Station', () => {
  const { inv, rezepte } = aufbau();
  inv.gib('holz', 3);
  assert.deepEqual(rezepte.pruefe('axt', inv), { ok: false, grund: 'zutaten', fehlt: { stein: 1 } });
  assert.equal(rezepte.pruefe('brett', inv).grund, 'werkzeug');
  assert.equal(rezepte.pruefe('gibtsnicht', inv).grund, 'unbekannt');
  inv.gib('stein', 1); inv.gib('brett', 4);
  assert.equal(rezepte.pruefe('axt', inv).ok, true);
  assert.equal(rezepte.pruefe('tisch', inv).grund, 'station');
  assert.equal(rezepte.pruefe('tisch', inv, { stationen: ['werkbank'] }).ok, true);
  assert.deepEqual(rezepte.moeglich(inv).map((r) => r.id), ['axt']);
});
test('stelleHer: verbraucht Zutaten, Haltbarkeit als Daten, Werkzeug bleibt, Ereignis', () => {
  const { inv, rezepte, ereignisse } = aufbau();
  const gemeldet = [];
  ereignisse.an('hergestellt', (e) => gemeldet.push(e.id));
  inv.gib('holz', 3); inv.gib('stein', 1);
  assert.deepEqual(rezepte.stelleHer('axt', inv), { id: 'axt', anzahl: 1 });
  assert.equal(inv.zaehle('holz'), 1); assert.equal(inv.zaehle('stein'), 0);
  assert.deepEqual(inv.plaetze.find((s) => s?.id === 'axt').daten, { haltbarkeit: 5 });
  assert.deepEqual(rezepte.stelleHer('brett', inv), { id: 'brett', anzahl: 2 });
  assert.equal(inv.zaehle('axt'), 1); assert.equal(inv.zaehle('brett'), 2);
  assert.equal(rezepte.stelleHer('brett', inv), null);
  assert.deepEqual(gemeldet, ['axt', 'brett']);
});
test('stelleHer: ohne Platz bleibt das Inventar unverändert', () => {
  const { inv, rezepte } = aufbau(2);
  inv.gib('holz', 12); inv.gib('axt', 1);   // beide Plätze … holz braucht 2 → axt passt nicht mehr
  const voll = createInventar({ plaetze: 2, register: inv.register });
  voll.gib('holz', 10); voll.gib('stein', 10);
  const vorher = JSON.stringify(voll.zustand());
  assert.equal(rezepte.pruefe('axt', voll).ok, true);
  assert.equal(rezepte.stelleHer('axt', voll), null);
  assert.equal(JSON.stringify(voll.zustand()), vorher);
});
