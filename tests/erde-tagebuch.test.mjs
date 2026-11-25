// Prüft die Tagebuch-Ziele des Erde-Labors (labore/erde/js/tagebuch-daten.js) gegen engine/gameplay/aufgaben und die Gegenstände.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pruefeDaten, createAufgaben } from '../engine/gameplay/aufgaben.js';
import { ZIELE, EREIGNISSE, SPAETER, verlangteDinge, naechstesZiel, entdeckungBei } from '../labore/erde/js/tagebuch-daten.js';
import { NAMEN } from '../labore/erde/js/herstellen-daten.js';
import { ERNTE } from '../labore/erde/js/ernte.js';
import { STOFFE } from '../labore/erde/js/boden.js';

test('Ziele sind gültige Aufgaben-Daten, jedes Ereignis wird erkannt', () => {
  assert.deepEqual(pruefeDaten(ZIELE), []);
  for (const z of ZIELE) for (const s of z.schritte) if (s.art === 'ereignis') assert.ok(EREIGNISSE[s.was], `${z.id}: Ereignis ${s.was} unbekannt`);
  for (const z of ZIELE) {
    assert.ok(z.name.length <= 26, `${z.id}: Name zu lang für die Meldung`);
    for (const s of z.schritte) assert.ok(s.text.length <= 32, `${z.id}/${s.id}: Text zu lang für die Ziel-Zeile`);
  }
});

test('Jeder verlangte Gegenstand existiert (Herstellen, Ernte, Boden) oder ist als „kommt noch“ markiert', () => {
  const ernte = new Set(Object.values(ERNTE).flatMap((e) => e.gibt.map(([id]) => id)));
  for (const id of verlangteDinge()) {
    const da = NAMEN[id] || ernte.has(id) || STOFFE[id] || SPAETER.includes(id);
    assert.ok(da, `Gegenstand ${id} gibt es nicht`);
  }
});

test('Kette läuft durch: Tasche + Ereignisse erledigen alle Ziele, fehlende Module werden übersprungen und später nachgeholt', () => {
  const tasche = new Map(), da = new Set(['felder']);
  const a = createAufgaben({ daten: ZIELE, zaehle: (id) => tasche.get(id) ?? 0 });
  const verfuegbar = (z) => !z.dienst || da.has(z.dienst);
  const fertig = [];
  for (let runde = 0; runde < 60; runde++) {
    const z = naechstesZiel(ZIELE, (id) => a.fertig(id), verfuegbar);
    if (!z) break;
    if (a.status(z.id) === 'neu') a.starte(z.id);
    const s = a.aktuell(z.id).schritt;
    if (s.art === 'sammle') tasche.set(s.ding, s.anzahl ?? 1);
    a.update(0.5);
    if (s.art === 'ereignis') a.melde('ereignis', { was: s.was });
    if (a.fertig(z.id)) fertig.push(z.id);
  }
  // ohne Gleiter-Modul: alles außer dem Gleiter erledigt
  assert.deepEqual(fertig, ZIELE.filter((z) => z.dienst !== 'gleiter').map((z) => z.id));
  da.add('gleiter');
  const z = naechstesZiel(ZIELE, (id) => a.fertig(id), verfuegbar);
  assert.equal(z?.id, 'gleiter');
});

test('Sammeln zählt den höchsten Stand: verbrauchte Stöcke werfen das Ziel nicht zurück', () => {
  const rekord = new Map(), tasche = new Map([['stoecke', 4]]);
  const zaehle = (id) => { const n = Math.max(tasche.get(id) ?? 0, rekord.get(id) ?? 0); rekord.set(id, n); return n; };
  const a = createAufgaben({ daten: ZIELE, zaehle });
  a.starte('sammeln'); a.update(0.5);
  assert.equal(a.aktuell('sammeln').schritt.id, 'steine');
  tasche.set('stoecke', 0); tasche.set('steine', 6); a.update(0.5);
  assert.ok(a.fertig('sammeln'));
});

test('Entdeckungen: Vulkan vor Meer vor Biom, See/Fluss zählen nicht als Meer', () => {
  assert.equal(entdeckungBei({ h: 900, wasser: -Infinity, vulkan: 0.8 }, 'Tundra').id, 'vulkan');
  assert.equal(entdeckungBei({ h: -3, wasser: 0, meer: 1, vulkan: 0 }, 'Grasland').id, 'meer');
  assert.equal(entdeckungBei({ h: 10, wasser: 12, meer: 0, vulkan: 0 }, 'Mischwald'), null);
  assert.deepEqual(entdeckungBei({ h: 10, wasser: -Infinity, vulkan: 0 }, 'Tundra'), { id: 'biom:Tundra', text: 'Tundra' });
});
