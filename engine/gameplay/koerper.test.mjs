import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKoerperWelt } from './koerper.js';
import { createKollisionsWelt } from '../world/kollision.js';

const flach = { bodenHoehe: () => 0 };
const lauf = (p, s) => { for (let i = 0; i < s * 60; i++) p.update(1 / 60); };

test('fällt, prallt ab, bleibt liegen und schläft ein', () => {
  const aufprall = [];
  const p = createKoerperWelt({ welt: flach, onAufprall: (k, tempo, art) => aufprall.push([art, tempo]) });
  const k = p.neu({ pos: { x: 0, y: 3, z: 0 }, radius: 0.2, sprung: 0.5 });
  let maxNachAufprall = 0, unten = false;
  for (let i = 0; i < 300; i++) {
    p.update(1 / 60);
    assert.ok(k.pos.y >= 0.2 - 1e-9, 'nie im Boden');
    if (k.amBoden) unten = true; else if (unten) maxNachAufprall = Math.max(maxNachAufprall, k.pos.y);
  }
  assert.ok(maxNachAufprall > 0.5 && maxNachAufprall < 2, 'springt hoch, aber niedriger: ' + maxNachAufprall);
  assert.ok(k.ruht && k.amBoden && Math.abs(k.pos.y - 0.2) < 1e-9);
  assert.equal(aufprall[0][0], 'boden'); assert.ok(aufprall[0][1] > 8);
  assert.equal(p.update(1 / 60), 0);
});

test('Wurf: Reibung bremst, sprung 0 hüpft nicht', () => {
  const p = createKoerperWelt({ welt: flach });
  const k = p.neu({ pos: { x: 0, y: 1, z: 0 }, vel: { x: 5, y: 2, z: 0 }, sprung: 0 });
  lauf(p, 4);
  assert.ok(k.ruht && k.pos.x > 2 && k.pos.x < 8, 'x=' + k.pos.x);
  const roller = p.neu({ pos: { x: 0, y: 0.15, z: 5 }, vel: { x: 5, y: 0, z: 0 }, reibung: 1 });
  const fest = p.neu({ pos: { x: 0, y: 0.15, z: 9 }, vel: { x: 5, y: 0, z: 0 }, reibung: 8 });
  lauf(p, 8);
  assert.ok(roller.pos.x > fest.pos.x * 3, 'wenig Reibung rollt viel weiter');
});

test('Hang: haftet auf flachem, rutscht auf steilem; haftung 1 rollt immer', () => {
  const sanft = createKoerperWelt({ welt: { bodenHoehe: (x) => -x * 0.3 } });
  const a = sanft.neu({ pos: { x: 0, y: 0.5, z: 0 }, sprung: 0 });
  const ball = sanft.neu({ pos: { x: 0, y: 0.5, z: 3 }, sprung: 0, haftung: 1, reibung: 0.5 });
  lauf(sanft, 3);
  assert.ok(a.ruht && Math.abs(a.pos.x) < 0.2, 'liegt: ' + a.pos.x);
  assert.ok(ball.pos.x > 3 && !ball.ruht, 'Ball rollt bergab: ' + ball.pos.x);
  const steil = createKoerperWelt({ welt: { bodenHoehe: (x) => -x * 1.5 } });
  const b = steil.neu({ pos: { x: 0, y: 0.5, z: 0 }, sprung: 0 });
  lauf(steil, 3);
  assert.ok(b.pos.x > 2 && b.pos.y < -3, 'rutscht: ' + b.pos.x);
  const liegtAuf = createKoerperWelt({ welt: { bodenHoehe: (x) => -x * 0.8 } });       // ohne Fallhöhe direkt auf den Hang gelegt
  const c = liegtAuf.neu({ pos: { x: 0, z: 0 } });
  lauf(liegtAuf, 3);
  assert.ok(c.pos.x > 2 && !c.ruht, 'rutscht auch aus der Ruhe: ' + c.pos.x);
});

test('Wasser: Leichtes schwimmt an der Oberfläche, Schweres sinkt auf den Grund', () => {
  const p = createKoerperWelt({ welt: { bodenHoehe: () => -5, wasserHoehe: () => 0 } });
  const holz = p.neu({ pos: { x: 0, y: 2, z: 0 }, radius: 0.2, auftrieb: 1.5 });
  const stein = p.neu({ pos: { x: 2, y: 2, z: 0 }, radius: 0.2, auftrieb: 0.3 });
  lauf(p, 10);
  assert.ok(Math.abs(holz.pos.y) < 0.2 && holz.imWasser, 'schwimmt: ' + holz.pos.y);
  assert.ok(holz.ruht, 'kommt zur Ruhe');
  assert.ok(Math.abs(stein.pos.y - -4.8) < 1e-6 && stein.amBoden, 'liegt am Grund: ' + stein.pos.y);
});

test('Kollisions-Welt: prallt vom Stamm ab, bleibt auf der Kiste liegen', () => {
  const w = createKollisionsWelt({ welt: flach });
  w.fuege({ x: 3, z: 0, radius: 0.5 });
  w.fuege({ form: 'kasten', x: 0, z: 5, bx: 1, bz: 1, hoehe: 1, begehbar: true });
  const p = createKoerperWelt({ welt: w });
  const k = p.neu({ pos: { x: 0, y: 0.15, z: 0 }, vel: { x: 8, y: 0, z: 0 }, reibung: 0.5, sprung: 0.6 });
  let minAbstand = 9, zurueck = false;
  for (let i = 0; i < 120; i++) { p.update(1 / 60); minAbstand = Math.min(minAbstand, Math.hypot(k.pos.x - 3, k.pos.z)); if (k.vel.x < -1) zurueck = true; }
  assert.ok(minAbstand >= 0.65 - 1e-6 && zurueck, 'abgeprallt');
  const oben = p.neu({ pos: { x: 0, y: 3, z: 5 }, sprung: 0 });
  lauf(p, 2);
  assert.ok(Math.abs(oben.pos.y - 1.15) < 1e-6 && oben.ruht, 'liegt auf der Kiste: ' + oben.pos.y);
});

test('schiebe: Figur kickt Dinge weg und weckt sie; Höhe wird beachtet', () => {
  const p = createKoerperWelt({ welt: flach });
  const k = p.neu({ pos: { x: 0.3, y: 0.15, z: 0 } });
  const hoch = p.neu({ pos: { x: 0.3, y: 5, z: 0 } }); hoch.ruht = true;
  lauf(p, 1);
  assert.ok(k.ruht);
  assert.equal(p.schiebe(0, 0, 0.3, 4, 0, 0, 1.75), 1);
  assert.ok(!k.ruht && k.vel.x > 3 && k.pos.x >= 0.45 - 1e-9);
  assert.ok(hoch.ruht);
});

test('impuls, weckeUmkreis, entfernen, eigene id, deterministisch', () => {
  const p = createKoerperWelt({ welt: flach });
  const k = p.neu({ id: 'ball', pos: { x: 0, z: 0 } });
  assert.equal(k.pos.y, 0.15);
  lauf(p, 1); assert.ok(k.ruht);
  p.weckeUmkreis(5, 0, 1); assert.ok(k.ruht);
  p.weckeUmkreis(0.5, 0, 1); assert.ok(!k.ruht);
  p.impuls(k, 0, 5, 0); p.update(1 / 60); assert.ok(k.pos.y > 0.2);
  assert.equal(p.hole('ball'), k);
  assert.equal(p.entferne('ball'), true); assert.equal(p.entferne(k), false); assert.equal(p.anzahl, 0);
  const einmal = (dts) => { const q = createKoerperWelt({ welt: { bodenHoehe: (x, z) => Math.sin(x) * 0.5 } }); const b = q.neu({ pos: { x: 0, y: 3, z: 0 }, vel: { x: 3, y: 0, z: 1 } }); for (const dt of dts) q.update(dt); return b.pos; };
  const a = einmal(Array(120).fill(1 / 60)), b = einmal(Array(240).fill(1 / 120));
  assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9, 'gleiches Ergebnis bei anderer Bildrate');
  assert.throws(() => createKoerperWelt({}));
});
