// Verträge zwischen den Daten-Dateien (Beute ↔ Gegenstände ↔ Gegner, Klassen ↔ Zauber).
// Fängt den typischen Fehler, wenn zwei KIs/Agents getrennt an Daten arbeiten: eine ID wird umbenannt, die andere Datei kennt sie nicht.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BEUTE_TABELLEN, wuerfle } from './beute.js';
import { GEGENSTAENDE, SELTENHEITEN, SOCKEL } from './gegenstaende-daten.js';
import { KLASSEN, KLASSEN_FAEHIGKEITEN } from './klassen-daten.js';
import { ZAUBER } from './zauber-daten.js';

test('Beute: jede ID in den Tabellen ist ein Gegenstand', () => {
  for (const [name, t] of Object.entries(BEUTE_TABELLEN)) {
    for (const [id] of t.material) assert.ok(GEGENSTAENDE[id], `${name}: Material ${id}`);
    for (const [id] of t.traenke) assert.ok(GEGENSTAENDE[id], `${name}: Trank ${id}`);
    for (const s of Object.keys(t.sw || {})) assert.ok(SELTENHEITEN[s], `${name}: Seltenheit ${s}`);
  }
  for (let seed = 1; seed <= 40; seed++) for (const name of Object.keys(BEUTE_TABELLEN))
    for (const d of wuerfle(name, { seed, stufe: 1 + (seed % 15) })) {
      assert.ok(GEGENSTAENDE[d.id], `${name}/${seed}: ${d.id}`);
      if (d.daten) assert.ok(SOCKEL.includes(GEGENSTAENDE[d.id].sockel), `${d.id}: Sockel`);
    }
});

test('Gegner: jede Art aus modul-gegner hat eine Beute-Tabelle', () => {
  const src = fs.readFileSync(new URL('../spiel/modul-gegner.js', import.meta.url), 'utf8');
  const arten = new Set();
  for (const m of src.matchAll(/(?:besatzung|nachtExtra):\s*\{([^}]*)\}/g)) for (const k of m[1].matchAll(/(\w+):/g)) arten.add(k[1]);
  assert.ok(arten.size >= 4, 'Arten gefunden');
  for (const a of arten) assert.ok(BEUTE_TABELLEN[a], `Gegnerart ${a} ohne Beute-Tabelle`);
  assert.ok(BEUTE_TABELLEN.boss, 'Boss-Tabelle');
});

test('Klassen: Fähigkeiten existieren, Zauber-Fähigkeiten zeigen auf echte Zauber, Startwaffe ist ein Gegenstand', () => {
  // Zauber = zauber-daten + Extra-Zauber, die modul-zauber selbst anlegt (z. B. wasserguss)
  const extra = fs.readFileSync(new URL('../spiel/modul-zauber.js', import.meta.url), 'utf8');
  const zauberDa = (n) => !!ZAUBER[n] || new RegExp(`^\\s+${n}:\\s*\\{\\s*name:`, 'm').test(extra);
  for (const [k, def] of Object.entries(KLASSEN)) {
    assert.ok(GEGENSTAENDE[def.waffe], `${k}: Waffe ${def.waffe}`);
    for (const f of def.faehigkeiten) {
      const fd = KLASSEN_FAEHIGKEITEN[f];
      assert.ok(fd, `${k}: Fähigkeit ${f}`);
      if (fd.wirkung?.typ === 'zauber') assert.ok(zauberDa(fd.wirkung.zauber), `${f}: Zauber ${fd.wirkung.zauber}`);
      assert.ok(def.ressourcen[fd.ressource], `${f}: Ressource ${fd.ressource} gehört nicht zu ${k}`);
    }
  }
});
