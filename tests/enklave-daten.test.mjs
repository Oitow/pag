import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createAufgaben, pruefeDaten } from '../engine/gameplay/aufgaben.js';
import { TUTORIAL } from '../games/enklave/js/tutorial-daten.js';

const planPfad = new URL('../games/enklave/js/plan-daten.js', import.meta.url);
const existiert = existsSync(planPfad);

test('Tutorial-Daten sind gültig', () => {
  assert.deepEqual(pruefeDaten(TUTORIAL), []);
  const t = TUTORIAL[0];
  assert.equal(t.id, 'tutorial');
  assert.ok(t.schritte.length >= 13);
  assert.ok(t.schritte.every((s) => s.text.length <= 60), 'Schritt-Texte kurz (Handy)');
  for (const n of ['ratten-klein', 'ratten-welle', 'kamera-aussicht', 'tor-auf'])
    assert.ok(t.schritte.some((s) => s.signal === n || s.signalEnde === n), 'Signal ' + n);
  assert.equal(t.schritte.at(-1).ziel, undefined);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(TUTORIAL)));
});

test('Tutorial lässt sich komplett durchspielen', () => {
  const orte = { lagerfeuer: [0, 0], steinkreis: [0, 0], stamm: [0, 0], puppe: [0, 0], zielscheibe: [0, 0], wegweiser: [0, 0], aussicht: [0, 0] };
  const signale = [];
  const ereignisse = { sende: (n, d) => { if (n === 'aufgabe:signal') signale.push(d.name); } };
  const a = createAufgaben({ daten: TUTORIAL, ereignisse, zaehle: () => 0, ortVon: (n) => (orte[n] ? { x: orte[n][0], z: orte[n][1] } : null) });
  a.starte('tutorial');
  for (let i = 0; i < 100 && a.aktiv().length; i++) {
    const s = a.aktuell().schritt;
    if (s.art === 'sprich-mit') a.melde('gesprochen', { mit: s.ziel });
    else if (s.art === 'sammle') a.melde('gesammelt', { id: s.ding, anzahl: s.anzahl });
    else if (s.art === 'besiege') a.melde('besiegt', { art: s.ziel, anzahl: s.anzahl });
    else if (s.art === 'benutze') a.melde('benutzt', { was: s.was.replace('*', 'funken'), anzahl: s.anzahl });
    else {
      const o = typeof s.ort === 'string' ? orte[s.ort] : [s.ort.x, s.ort.z];
      a.update(s.dauer ?? 0, { x: o[0], z: o[1] });
    }
  }
  assert.equal(a.fertig('tutorial'), true);
  assert.deepEqual(signale, ['ratten-klein', 'ratten-welle', 'kamera-aussicht', 'tor-auf']);
});

test('Orte (Namen) stimmen mit dem Plan überein', { skip: !existiert }, async () => {
  const mod = await import(planPfad.href);
  const plan = mod.ENKLAVE_PLAN ?? mod.default;
  const namen = new Set([...(plan.plaetze ?? []).map((p) => p.id), ...(plan.zonen ?? []).map((z) => z.id)]);
  for (const s of TUTORIAL[0].schritte)
    if (typeof s.ort === 'string') assert.ok(namen.has(s.ort), `Ort '${s.ort}' (Schritt ${s.id}) fehlt im Plan`);
});
