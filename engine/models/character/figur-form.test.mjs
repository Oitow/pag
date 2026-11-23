import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFigurForm } from './figur-form.js';

test('Vereinigen und Abziehen: Abstand innen negativ, Höhlung wird außen', () => {
  const f = createFigurForm({ glatt: 0.01 });
  f.kugel([0, 1, 0], 0.2, { farbe: 0xff0000 });
  assert.ok(f.abstand(0, 1, 0) < -0.19);
  assert.ok(Math.abs(f.abstand(0.2, 1, 0)) < 1e-3);
  f.kugel([0, 1, 0.2], 0.08, { abzug: true });
  assert.ok(f.abstand(0, 1, 0.18) > 0, 'abgezogener Bereich ist außen');
});

test('eingrenzen ändert den Abstand nahe der Oberfläche nicht', () => {
  const f = createFigurForm({ glatt: 0.03 });
  f.kapsel([0, 0, 0], [0, 1, 0], 0.1, 0.05, { tief: 0.7 });
  f.ellipsoid([0.3, 0.5, 0], [0.1, 0.2, 0.05], { dreh: [0.3, 0.2, 0.1] });
  f.rundbox([-0.3, 0.5, 0], [0.1, 0.1, 0.1], 0.02);
  f.ring([0, 0.5, 0], 0.15, 0.02);
  const punkte = [[0.1, 0.5, 0], [0.38, 0.6, 0.02], [-0.2, 0.45, 0], [0, 0.5, 0.15]];
  const voll = punkte.map((p) => f.abstand(...p));
  f.eingrenzen([-0.5, 0.3, -0.2], [0.5, 0.7, 0.2], 0.02);
  punkte.forEach((p, i) => assert.ok(Math.abs(f.abstand(...p) - voll[i]) < 1e-9));
  f.eingrenzen(null);
});

test('einfluss: Farbe vom äußeren Körper, Knochen-Gewichte summieren zu 1 und blenden am Gelenk', () => {
  const f = createFigurForm({ glatt: 0.02 });
  f.kapsel([0, 1, 0], [0, 0.7, 0], 0.05, 0.05, { knochen: 'schulterL', farbe: 0xff0000 });
  f.kapsel([0, 0.7, 0], [0, 0.4, 0], 0.05, 0.04, { knochen: 'ellbogenL', farbe: 0x00ff00 });
  const oben = f.einfluss(0.05, 0.9, 0), gelenk = f.einfluss(0.05, 0.7, 0);
  assert.ok(oben.farbe[0] > 0.9 && oben.farbe[1] < 0.1);
  const summe = Object.values(gelenk.knochen).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(summe - 1) < 1e-9);
  assert.ok(gelenk.knochen.schulterL > 0.2 && gelenk.knochen.ellbogenL > 0.2, 'am Ellbogen beide Knochen');
});
