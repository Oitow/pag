// Riesenjagd: Seil-Haken (reine Logik) – Seil hält die Länge, Einholen zieht zum Anker, Stamm-Strahl trifft die Oberfläche.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeil, hakeEin, schritt, strahlStamm, stammProfil, HAKEN } from '../spiele/riesenjagd/js/haken.js';

test('straffes Seil: Abstand zum Anker wird nie länger als die Seillänge', () => {
  const s = createSeil({ x: 10, y: 20, z: 0 }, { x: 0, y: 0, z: 12 });
  hakeEin(s, { x: 0, y: 40, z: 0 });
  const L = s.laenge;
  for (let i = 0; i < 300; i++) schritt(s, 1 / 60, {});
  const d = Math.hypot(s.pos.x, s.pos.y - 40, s.pos.z);
  assert.ok(d <= L + 1e-6, `Abstand ${d} > ${L}`);
  assert.ok(s.pos.y < 40, 'hängt unter dem Anker');
});

test('Einholen zieht zum Anker und meldet die Ankunft', () => {
  const s = createSeil({ x: 0, y: 0, z: 0 });
  hakeEin(s, { x: 0, y: 30, z: 40 });
  let angekommen = false;
  for (let i = 0; i < 600 && !angekommen; i++) angekommen = schritt(s, 1 / 60, { einholen: true }).amZiel;
  assert.ok(angekommen, 'kommt an');
  assert.ok(Math.hypot(s.pos.x, s.pos.y - 30, s.pos.z - 40) < HAKEN.minLaenge + 1);
});

test('ohne Anker: freier Fall, Tempo bleibt unter dem Maximum', () => {
  const s = createSeil({ x: 0, y: 500, z: 0 }, { x: 80, y: 0, z: 0 });
  for (let i = 0; i < 300; i++) schritt(s, 1 / 60, {});
  assert.ok(Math.hypot(s.vel.x, s.vel.y, s.vel.z) <= HAKEN.maxTempo + 1e-6);
  assert.ok(s.pos.y < 500);
});

test('Strahl trifft den Stamm auf seiner Oberfläche', () => {
  const stamm = { x: 0, z: 30, fuss: 0, oben: 80, radius: stammProfil(5, 110) };
  const t = strahlStamm({ x: 0, y: 10, z: 0 }, { x: 0, y: 0, z: 1 }, stamm);
  assert.ok(t, 'Treffer');
  assert.ok(Math.abs(Math.hypot(t.x - stamm.x, t.z - stamm.z) - stamm.radius(10)) < 0.05);
  assert.equal(strahlStamm({ x: 0, y: 10, z: 0 }, { x: 1, y: 0, z: 0 }, stamm), null);
});
