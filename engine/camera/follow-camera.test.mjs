import test from 'node:test';
import assert from 'node:assert/strict';
import { createFollowCamera, stickRichtung } from './follow-camera.js';

const horizAbstand = (k, z) => Math.hypot(k.position.x - z.x, k.position.z - z.z);
const lauf = (cam, ziel, info, sek, dt = 1 / 60) => { for (let t = 0; t < sek; t += dt) cam.update(dt, ziel, info); };
const endlich = k => ['x', 'y', 'z'].every(a => Number.isFinite(k.position[a])) && Number.isFinite(k.fov);

test('folgt einem bewegten Ziel, Abstand konvergiert auf distanz', () => {
  const cam = createFollowCamera({ distanz: 6, autoAusrichten: 0 });
  const ziel = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < 300; i++) { ziel.x += 0.05; ziel.z += 0.02; cam.update(1 / 60, ziel, { tempo: 3, yaw: 0, amBoden: true }); }
  lauf(cam, ziel, {}, 3);
  const k = cam.kamera;
  const dy = k.position.y - (ziel.y + 1.5);
  const d = Math.hypot(horizAbstand(k, ziel), dy);
  assert.ok(Math.abs(d - 6) < 0.05, `Abstand ${d}`);
  assert.ok(Math.abs(dy - Math.sin(0.35) * 6) < 0.05);
  assert.ok(endlich(k));
});

test('bleibt über dem Boden (Hügel hinter der Figur)', () => {
  const boden = (x, z) => (z < -1 ? 6 : 0);
  const cam = createFollowCamera({ bodenHoehe: boden, autoAusrichten: 0 });
  lauf(cam, { x: 0, y: 0, z: 0 }, {}, 2);
  const p = cam.kamera.position;
  assert.ok(p.y >= boden(p.x, p.z) + 0.3 - 1e-9, `y ${p.y}`);
});

test('Hindernis-Callback rückt Kamera vor', () => {
  const cam = createFollowCamera({ hindernis: () => 2.5, autoAusrichten: 0 });
  lauf(cam, { x: 0, y: 0, z: 0 }, {}, 1);
  const p = cam.kamera.position;
  assert.ok(Math.hypot(p.x, p.y - 1.5, p.z) < 2.4);
});

test('Auto-Ausrichtung dreht hinter die Laufrichtung, nicht direkt nach Drehen', () => {
  const cam = createFollowCamera();
  const ziel = { x: 0, y: 0, z: 0 };
  const info = { tempo: 5, yaw: 1.2, amBoden: true, sprintet: false };
  cam.drehen(0.001, 0);                          // Spieler hat gerade gedreht
  lauf(cam, ziel, info, 1.0);
  assert.ok(Math.abs(cam.yaw) < 0.01, `zu früh: ${cam.yaw}`);
  lauf(cam, ziel, info, 12);
  assert.ok(Math.abs(cam.yaw - 1.2) < 0.05, `yaw ${cam.yaw}`);
  const stehend = createFollowCamera();
  lauf(stehend, ziel, { tempo: 0, yaw: 1.2, amBoden: true }, 5);
  assert.equal(stehend.yaw, 0);
});

test('Pitch-Grenzen, Zoom-Grenzen, drehen-Richtung', () => {
  const cam = createFollowCamera();
  cam.drehen(0, 10); assert.equal(cam.pitch, 1.25);
  cam.drehen(0, -10); assert.equal(cam.pitch, -0.35);
  cam.drehen(0.5, 0); assert.ok(Math.abs(cam.yaw + 0.5) < 1e-9, 'rechts schwenken = yaw kleiner');
  cam.zoomen(100); lauf(cam, { x: 0, y: 0, z: 0 }, {}, 3);
  assert.ok(Math.abs(cam.distanz - 2) < 0.01);
  cam.zoomen(-100); lauf(cam, { x: 0, y: 0, z: 0 }, {}, 3);
  assert.ok(Math.abs(cam.distanz - 14) < 0.05);
});

test('richtungAusStick(0,1) zeigt horizontal von der Kamera weg', () => {
  const cam = createFollowCamera({ autoAusrichten: 0 });
  cam.drehen(-2.1, 0.3);
  const ziel = { x: 3, y: 1, z: -2 };
  cam.springeZu(ziel);
  const r = cam.richtungAusStick(0, 1);
  const wx = ziel.x - cam.kamera.position.x, wz = ziel.z - cam.kamera.position.z, l = Math.hypot(wx, wz);
  assert.ok(Math.abs(r.x - wx / l) < 1e-6 && Math.abs(r.z - wz / l) < 1e-6, JSON.stringify(r));
  const re = cam.richtungAusStick(1, 0);           // rechts: Kreuzprodukt zeigt nach unten (Y−)
  assert.ok(r.z * re.x - r.x * re.z < 0);
  assert.deepEqual(stickRichtung(0, 1, cam.blickYaw()), r);
});

test('Sprint-FOV, Schütteln klingt ab, Lock-On, kein NaN', () => {
  const cam = createFollowCamera({ autoAusrichten: 0 });
  const ziel = { x: 0, y: 0, z: 0 };
  lauf(cam, ziel, { tempo: 8, sprintet: true }, 2);
  assert.ok(Math.abs(cam.kamera.fov - 68) < 0.1);
  lauf(cam, ziel, {}, 0.5);
  const ruhig = cam.kamera.position.clone();
  cam.schuetteln(2, 0.3);
  cam.update(1 / 60, ziel, {});
  assert.ok(cam.kamera.position.distanceTo(ruhig) > 1e-4);
  lauf(cam, ziel, {}, 0.5);
  assert.ok(cam.kamera.position.distanceTo(ruhig) < 1e-6);
  cam.lockOn({ x: 10, y: 0, z: 0 });
  lauf(cam, ziel, {}, 3);
  assert.ok(Math.abs(cam.yaw - Math.PI / 2) < 0.02, `yaw ${cam.yaw}`);
  cam.lockOn(null);
  cam.update(NaN, { x: NaN, y: undefined, z: 1 }, { tempo: NaN, yaw: NaN });
  cam.drehen(NaN, Infinity); cam.zoomen(NaN);
  cam.update(1 / 60, ziel, null);
  assert.ok(endlich(cam.kamera) && Number.isFinite(cam.yaw) && Number.isFinite(cam.distanz));
  cam.dispose();
});
