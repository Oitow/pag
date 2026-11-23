import test from 'node:test';
import assert from 'node:assert/strict';
import { createLook, koerperMasse, STILE, VORLAGEN } from './character-look.js';
import { createRig } from './character-rig.js';
import { formKontext, BINDE_POSE } from './figur-haut.js';
import { createFigurForm } from './figur-form.js';
import { baueKoerperForm } from './figur-koerper.js';
import { baueKleidungForm } from './figur-kleidung.js';
import { baueHaarForm } from './figur-haar.js';

/** Nackte Figur in Bindungs-Pose + Kontext (wie figur-haut). */
function figur(teil) {
  const look = createLook(teil), masse = koerperMasse(look), rig = createRig(masse), k = rig.knochen;
  k.schulterL.rotation.z = BINDE_POSE.arm; k.schulterR.rotation.z = -BINDE_POSE.arm;
  k.ellbogenL.rotation.x = BINDE_POSE.ellbogen; k.ellbogenR.rotation.x = BINDE_POSE.ellbogen;
  k.huefteL.rotation.z = BINDE_POSE.bein; k.huefteR.rotation.z = -BINDE_POSE.bein;
  rig.root.updateMatrixWorld(true);
  const ctx = formKontext(look, masse, rig), form = createFigurForm({ glatt: 0.02 * ctx.g });
  baueKoerperForm(form, ctx);
  return { ctx, form, nackt: form.anzahl };
}

test('jeder Oberteil-, Hosen- und Schuh-Stil baut ohne Fehler, fügt Körper hinzu und bleibt endlich', () => {
  const n = Math.max(STILE.oberteil.length, STILE.hose.length, STILE.schuhe.length);
  for (let i = 0; i < n; i++) {
    const teil = { oberteil: { stil: STILE.oberteil[i % 10] }, hose: { stil: STILE.hose[i % 4] }, schuhe: { stil: STILE.schuhe[i % 5] }, tasche: i % 2 === 0 };
    const { ctx, form, nackt } = figur(teil);
    baueKleidungForm(form, ctx);
    assert.ok(form.anzahl > nackt + 3, JSON.stringify(teil));
    for (const p of [[0, 1.2, 0.2], [0.1, 0.3, 0.1], [0, 0.02, 0.15]]) assert.ok(Number.isFinite(form.abstand(...p)), JSON.stringify(teil));
  }
});

test('Budget: Kleidung + Haar aller Vorlagen höchstens ~45 Körper', () => {
  for (const [name, v] of Object.entries(VORLAGEN)) {
    const { ctx, form, nackt } = figur(v);
    baueHaarForm(baueKleidungForm(form, ctx), ctx);
    assert.ok(form.anzahl - nackt <= 46, `${name}: ${form.anzahl - nackt}`);
  }
});

test('barfuß baut keine Schuhe, Stiefel decken den Fuß; Robe macht die Figur an den Knöcheln breiter', () => {
  const bar = figur({ schuhe: { stil: 'barfuss' } }), st = figur({ schuhe: { stil: 'stiefel' } });
  baueKleidungForm(bar.form, bar.ctx); baueKleidungForm(st.form, st.ctx);
  assert.ok(st.form.anzahl - st.nackt >= bar.form.anzahl - bar.nackt + 6, 'Stiefel: Sohle, Oberschuh, Knöchel, Schaft, Stulpe je Fuß');
  const [x, , z] = bar.ctx.P('fussL', [0, 0, bar.ctx.m.fussLaenge * 0.3]);
  assert.ok(bar.form.einfluss(x, 0.02, z + 0.05).haut > 0.5 || bar.form.abstand(x, 0.02, z + 0.05) > 0, 'barfuß: Fuß bleibt Haut');
  const robe = figur({ oberteil: { stil: 'robe' }, hose: { stil: 'rock' } }), hose = figur({});
  baueKleidungForm(robe.form, robe.ctx); baueKleidungForm(hose.form, hose.ctx);
  const p = [0, 0.2, 0.18];                                 // vor den Schienbeinen, zwischen den Beinen
  assert.ok(hose.form.abstand(...p) > 0, 'Hose: dort ist Luft');
  assert.ok(robe.form.abstand(...p) < 0, 'Robe: dort ist Stoff');
});
