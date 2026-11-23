import test from 'node:test';
import assert from 'node:assert/strict';
import { createLook, koerperMasse, STILE } from './character-look.js';
import { createRig } from './character-rig.js';
import { formKontext } from './figur-haut.js';
import { createFigurForm } from './figur-form.js';
import { baueKoerperForm } from './figur-koerper.js';
import { baueHaarForm } from './figur-haar.js';
import { strahl } from './figur-kleidung-basis.js';

function kopf(teil) {
  const look = createLook(teil), masse = koerperMasse(look), rig = createRig(masse);
  rig.root.updateMatrixWorld(true);
  const ctx = formKontext(look, masse, rig), form = createFigurForm({ glatt: 0.02 * ctx.g });
  baueKoerperForm(form, ctx);
  return { ctx, form, nackt: form.anzahl };
}

test('alle Frisuren und Bärte bauen; Augen und Mund bleiben frei', () => {
  for (let i = 0; i < STILE.haar.length; i++) {
    const teil = { haar: { stil: STILE.haar[i] }, bart: { stil: STILE.bart[i % STILE.bart.length] } };
    const { ctx, form, nackt } = kopf(teil), R = ctx.R, m = ctx.P('kopf', [0, R, 0]);
    baueHaarForm(form, ctx);
    const leer = teil.haar.stil === 'glatze' && teil.bart.stil === 'keiner';
    assert.ok(leer || form.anzahl > nackt, JSON.stringify(teil));
    // Starrer Mund (z ≈ 0.9R, y ≈ 0.52R) bleibt vor dem Bart sichtbar
    assert.ok(form.abstand(...ctx.P('kopf', [0, R * 0.52, R * 0.95])) > 0, `${JSON.stringify(teil)}: Bart vor dem Mund`);
    // Oberfläche in Richtung Augen und Brauen bleibt Haut
    for (const [x, y, z] of [[0.34, 1.02, 0.9], [-0.34, 1.02, 0.9], [0.36, 1.27, 0.88], [-0.36, 1.27, 0.88]]) {
      const ziel = ctx.P('kopf', [x * R, y * R, z * R]), d = ziel.map((v, k) => v - m[k]), l = Math.hypot(...d), t = strahl(form, m, d.map((v) => v / l));
      const p = m.map((v, k) => v + d[k] / l * t);
      assert.ok(form.einfluss(...p).haut > 0.5, `${JSON.stringify(teil)}: Gesicht bei ${[x, y, z]} verdeckt`);
    }
  }
});

test('deckender Hut → weniger Haar, Oberkopf bleibt unter der Hut-Kugel', () => {
  for (const haar of ['wuschel', 'dutt', 'locken', 'irokese']) {
    const frei = kopf({ haar: { stil: haar } }), hut = kopf({ haar: { stil: haar }, kopfbedeckung: { stil: 'kapuze' } });
    baueHaarForm(frei.form, frei.ctx); baueHaarForm(hut.form, hut.ctx);
    assert.ok(hut.form.anzahl - hut.nackt < frei.form.anzahl - frei.nackt, haar);
    const R = hut.ctx.R, oben = hut.ctx.P('kopf', [0, R * 2.15, -R * 0.1]);
    assert.ok(hut.form.abstand(...oben) > 0, `${haar}: Haar ragt durch den Hut`);
  }
});
