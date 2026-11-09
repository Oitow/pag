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

test('Hindernisse (Welt-Adapter) entlang des Strahls: heran und weich zurück', () => {
  let stamm = true;
  // Baumstamm 3 m hinter der Figur (Kamera blickt nach +Z, steht also bei −Z)
  const welt = { bodenHoehe: () => 0, hindernisse: (x, z, r) => (stamm && Math.hypot(x, z + 3) < 0.4 + r ? { x: 0, z: 1 } : null) };
  const cam = createFollowCamera({ welt, autoAusrichten: 0 });
  const ziel = { x: 0, y: 0, z: 0 };
  lauf(cam, ziel, {}, 1);
  const nah = horizAbstand(cam.kamera, ziel);
  assert.ok(nah < 3, `vor dem Stamm: ${nah}`);
  stamm = false;
  cam.update(1 / 60, ziel, {});
  const einBild = horizAbstand(cam.kamera, ziel);
  assert.ok(einBild < nah + 0.5, `kein Sprung zurück: ${einBild}`);
  lauf(cam, ziel, {}, 3);
  assert.ok(horizAbstand(cam.kamera, ziel) > 5.5);
});

test('Lock-On: Zielwechsel gleitet, Funktion als Ziel', () => {
  const cam = createFollowCamera({ autoAusrichten: 0 });
  const ziel = { x: 0, y: 0, z: 0 };
  cam.lockOn(() => ({ x: 10, y: 0, z: 0 }));
  lauf(cam, ziel, {}, 3);
  assert.ok(Math.abs(cam.yaw - Math.PI / 2) < 0.02);
  cam.lockOn({ x: 0, y: 0, z: 10 });
  cam.update(1 / 60, ziel, {});
  assert.ok(cam.yaw > 1.3, `kein Sprung: ${cam.yaw}`);
  lauf(cam, ziel, {}, 3);
  assert.ok(Math.abs(cam.yaw) < 0.03, `yaw ${cam.yaw}`);
  assert.equal(typeof cam.lockZiel, 'object');
});

test('Erste Person beim Reinzoomen, raus beim Rauszoomen', () => {
  const modi = [];
  const cam = createFollowCamera({ erstePerson: true, autoAusrichten: 0, onModus: m => modi.push(m) });
  const ziel = { x: 1, y: 2, z: 3 };
  cam.zoomen(100); lauf(cam, ziel, {}, 1);
  assert.equal(cam.erstePerson, false);
  cam.zoomen(0.5);
  assert.equal(cam.erstePerson, true);
  lauf(cam, ziel, { augenHoehe: 1.7 }, 2);
  const p = cam.kamera.position;
  assert.ok(Math.hypot(p.x - 1, p.z - 3) < 0.2 && Math.abs(p.y - 3.7) < 0.05, `${p.x},${p.y},${p.z}`);
  assert.equal(cam.figurAusblenden, true);
  cam.drehen(0, -1.5);                            // Ego: weit nach oben schauen erlaubt
  assert.ok(cam.pitch < -1);
  cam.zoomen(-0.2);
  assert.equal(cam.erstePerson, false);
  assert.ok(cam.pitch >= -0.35);
  assert.deepEqual(modi, ['erste', 'dritte']);
});

test('Presets: weich anfahren, sofort, Schulter-Versatz, unbekannt', () => {
  const cam = createFollowCamera({ autoAusrichten: 0 });
  const ziel = { x: 0, y: 0, z: 0 };
  assert.equal(cam.setPreset('gibtsnicht'), false);
  cam.setPreset('weit'); lauf(cam, ziel, {}, 3);
  assert.ok(Math.abs(cam.distanz - 11) < 0.05 && Math.abs(cam.pitch - 0.55) < 0.01);
  cam.setPreset('schulter', { sofort: true }); cam.update(1 / 60, ziel, {});
  assert.equal(cam.preset, 'schulter');
  assert.ok(cam.kamera.position.x < -0.3, `rechts der Figur (−X): ${cam.kamera.position.x}`);
  cam.drehen(0, 0.2);                             // manuelles Drehen gewinnt gegen den Preset-Pitch
  const p = cam.pitch; lauf(cam, ziel, {}, 1);
  assert.equal(cam.pitch, p);
});

test('Kamerafahrt: hin, halten, zurück, Promise', async () => {
  const cam = createFollowCamera({ autoAusrichten: 0 });
  const ziel = { x: 0, y: 0, z: 0 };
  lauf(cam, ziel, {}, 1);
  const normal = cam.kamera.position.clone();
  let fertig = false;
  const pr = cam.fahrt({ pos: { x: 20, y: 10, z: 20 }, blick: { x: 0, y: 0, z: 0 }, dauer: 0.5, halten: 0.5 });
  pr.then(() => { fertig = true; });
  lauf(cam, ziel, {}, 0.8);
  assert.ok(cam.inFahrt && cam.kamera.position.distanceTo({ x: 20, y: 10, z: 20 }) < 0.01);
  lauf(cam, ziel, {}, 1);
  await pr;
  assert.ok(fertig && !cam.inFahrt);
  assert.ok(cam.kamera.position.distanceTo(normal) < 0.01);
  cam.fahrt({ pos: { x: 5, y: 5, z: 5 }, halten: Infinity, dauer: 0.2 });
  lauf(cam, ziel, {}, 2);
  assert.ok(cam.inFahrt);
  cam.beendeFahrt(); lauf(cam, ziel, {}, 0.5);
  assert.ok(!cam.inFahrt);
});
