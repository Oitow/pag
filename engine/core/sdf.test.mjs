import test from 'node:test';
import assert from 'node:assert/strict';
import { createSdf, weichMin } from './sdf.js';

const nah = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test('sdf: Kugel und Kapsel liefern echte Abstände (innen negativ)', () => {
  const s = createSdf(); s.kugel([0, 0, 0], 2);
  nah(s.abstand(5, 0, 0), 3); nah(s.abstand(0, 0, 0), -2); nah(s.abstand(0, 2, 0), 0);
  const k = createSdf(); k.kapsel([0, 0, 0], [0, 10, 0], 2, 1);
  nah(k.abstand(4, 0, 0), 2); nah(k.abstand(4, 10, 0), 3); nah(k.abstand(0, 5, 0), -1.5); nah(k.abstand(0, 13, 0), 2);
});

test('sdf: weiche Vereinigung liegt nie über dem harten Minimum und verschmilzt in der Kehle', () => {
  const hart = createSdf({ glatt: 1e-4 }), weich = createSdf({ glatt: 1.5 });
  for (const s of [hart, weich]) { s.kugel([-1.5, 0, 0], 2); s.kugel([1.5, 0, 0], 2); }
  for (let i = 0; i < 200; i++) {
    const x = Math.sin(i * 1.7) * 5, y = Math.cos(i * 2.3) * 5, z = Math.sin(i * 0.9) * 5;
    assert.ok(weich.abstand(x, y, z) <= hart.abstand(x, y, z) + 1e-6);
  }
  assert.ok(weich.abstand(0, 1.6, 0) < hart.abstand(0, 1.6, 0) - 0.2, 'Kehle wird aufgefüllt');
  nah(weichMin(1, 5, 2), 1); nah(weichMin(1, 1, 2), 0.5);
});

test('sdf: Kette ist in sich hart (keine Beule am Gelenk) und streckY macht den Querschnitt hochkant', () => {
  const s = createSdf({ glatt: 1 });
  s.kette([[0, 0, 0], [5, 0, 0], [10, 0, 0]], 1);
  nah(s.abstand(5, 3, 0), 2);
  const b = createSdf(); b.kette([[0, 0, 0], [10, 0, 0]], 1, { streckY: 3 });
  nah(b.abstand(5, 3, 0), 0); nah(b.abstand(5, 0, 1), 0);
  assert.ok(b.abstand(5, 2.5, 0) < 0 && b.abstand(5, 0, 1.2) > 0);
  assert.ok(b.grenzen().max[1] >= 3 && b.grenzen().min[1] <= -3);
});

test('sdf: Ellipsoid, Abzug und Störung', () => {
  const e = createSdf(); e.ellipsoid([0, 0, 0], [4, 1, 2]);
  nah(e.abstand(4, 0, 0), 0, 1e-6); nah(e.abstand(0, 1, 0), 0, 1e-6); assert.ok(e.abstand(0, 0, 0) < 0 && e.abstand(0, 3, 0) > 0);
  const a = createSdf({ glatt: 0.2 }); a.kugel([0, 0, 0], 3).abzugKugel([3, 0, 0], 1.5);
  assert.ok(a.abstand(2.5, 0, 0) > 0, 'ausgehöhlt'); assert.ok(a.abstand(-2.5, 0, 0) < 0);
  const st = createSdf(); st.kugel([0, 0, 0], 2).stoerung(() => 0.25, 0.25);
  nah(st.abstand(3, 0, 0), 1.25); nah(st.spiel, 0.25);
});

test('sdf: Normale zeigt nach außen, Grenzen umschließen alles', () => {
  const s = createSdf(); s.kapsel([0, 0, 0], [0, 6, 0], 2).kugel([7, 0, 0], 1);
  const n = s.normale(2, 3, 0, [0, 0, 0]);
  nah(n[0], 1, 1e-3); nah(n[1], 0, 1e-3);
  const g = s.grenzen();
  assert.ok(g.min[0] <= -2 && g.max[0] >= 8 && g.min[1] <= -2 && g.max[1] >= 8);
  assert.equal(s.anzahl, 2);
});

test('sdf: eingrenzen ändert den Abstand nahe der Oberfläche nicht', () => {
  const s = createSdf({ glatt: 0.8 });
  for (let i = 0; i < 30; i++) s.kette([[i * 3, 0, 0], [i * 3 + 2, 2, 1], [i * 3 + 3, 4, 0]], [1, 0.8, 0.5]);
  const proben = [];
  for (let i = 0; i < 400; i++) { const x = 30 + Math.sin(i) * 3, y = 1 + Math.cos(i * 1.3) * 3, z = Math.sin(i * 0.7) * 2; proben.push([x, y, z, s.abstand(x, y, z)]); }
  const aktiv = s.eingrenzen([27, -2, -2], [33, 4, 2], 1.5);
  assert.ok(aktiv > 0 && aktiv < s.anzahl, `aktiv ${aktiv}/${s.anzahl}`);
  for (const [x, y, z, d] of proben) if (Math.abs(d) <= 1.5) nah(s.abstand(x, y, z), d, 1e-9);
  assert.equal(s.eingrenzen(null), s.anzahl);
});
