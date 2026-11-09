import test from 'node:test';
import assert from 'node:assert/strict';
import { createMotor, MOTOR_TUNING } from './character-motor.js';

const DT = 1 / 60;
const flach = { bodenHoehe: () => 0 };
const lauf = (m, sek, absicht, cb) => { for (let i = 0; i < Math.round(sek / DT); i++) { m.update(DT, typeof absicht === 'function' ? absicht(i) : absicht); cb?.(m.zustand, i); } };

test('flacher Boden: beschleunigt auf laufTempo und bremst', () => {
  const m = createMotor({ welt: flach, pos: { x: 0, z: 0 } });
  assert.equal(m.zustand.amBoden, true);
  lauf(m, 1, { x: 0, z: 1 });
  assert.ok(Math.abs(m.zustand.tempo - MOTOR_TUNING.laufTempo) < 0.01, `tempo ${m.zustand.tempo}`);
  assert.ok(m.zustand.tempoAnteil > 0.99);
  assert.ok(Math.abs(m.zustand.yaw) < 0.05);
  lauf(m, 1, { x: 0, z: 1, sprint: true });
  assert.ok(Math.abs(m.zustand.tempo - MOTOR_TUNING.sprintTempo) < 0.01);
  lauf(m, 0.5, null);
  assert.equal(m.zustand.tempo, 0);
  // halber Stick = gehen, Blick nach +X
  lauf(m, 1, { x: 0.5, z: 0 });
  assert.ok(Math.abs(m.zustand.tempo - MOTOR_TUNING.gehTempo) < 0.01);
  assert.ok(Math.abs(m.zustand.yaw - Math.PI / 2) < 0.05);
  // blickYaw: seitwärts gehen
  lauf(m, 1, { x: 1, z: 0, blickYaw: 0 });
  assert.ok(Math.abs(m.zustand.yaw) < 0.05 && m.zustand.vel.x > 4.9);
});

function sprungApex(halten) {
  const m = createMotor({ welt: flach, pos: { x: 0, z: 0 } });
  let max = 0, sprungFrames = 0;
  lauf(m, 2, (i) => ({ x: 0, z: 0, springen: i < halten }), (z) => { max = Math.max(max, z.pos.y); if (z.sprung) sprungFrames++; });
  return { max, sprungFrames, m };
}

test('Sprung erreicht sprungHoehe, sprung nur ein Frame; variable Höhe', () => {
  const lang = sprungApex(200);
  assert.ok(Math.abs(lang.max - MOTOR_TUNING.sprungHoehe) / MOTOR_TUNING.sprungHoehe < 0.1, `apex ${lang.max}`);
  assert.equal(lang.sprungFrames, 1);
  const kurz = sprungApex(4);
  assert.ok(kurz.max < lang.max * 0.75, `kurz ${kurz.max} lang ${lang.max}`);
  assert.equal(lang.m.zustand.amBoden, true);
});

test('landung nur im Lande-Frame', () => {
  const m = createMotor({ welt: flach, pos: { x: 0, y: 3, z: 0 } });
  assert.equal(m.zustand.amBoden, false);
  const landungen = [];
  lauf(m, 2, null, (z) => { if (z.landung > 0) landungen.push(z.landung); });
  assert.equal(landungen.length, 1);
  assert.ok(landungen[0] > 5);
});

test('Coyote-Time und Jump-Buffer', () => {
  const kante = { bodenHoehe: (x, z) => (z < 2 ? 3 : 0) };
  // kurz nach der Kante springen → klappt (Coyote)
  const m = createMotor({ welt: kante, pos: { x: 0, z: 1 } });
  let weg = -1, sprung = false;
  lauf(m, 1.5, (i) => {
    if (weg < 0 && !m.zustand.amBoden) weg = i;
    return { x: 0, z: 1, springen: weg >= 0 && i >= weg + 4 };
  }, (z) => { if (z.sprung) sprung = true; });
  assert.ok(weg > 0 && sprung, 'Coyote-Sprung');
  // zu spät → kein Sprung (hohe Kante, damit der Buffer nicht bei der Landung greift)
  const m2 = createMotor({ welt: { bodenHoehe: (x, z) => (z < 2 ? 20 : 0) }, pos: { x: 0, z: 1 } });
  weg = -1; sprung = false;
  lauf(m2, 1.5, (i) => {
    if (weg < 0 && !m2.zustand.amBoden) weg = i;
    return { x: 0, z: 1, springen: weg >= 0 && i >= weg + 15 };
  }, (z) => { if (z.sprung) sprung = true; });
  assert.equal(sprung, false);
  // Buffer: kurz vor der Landung gedrückt → springt bei Landung
  const m3 = createMotor({ welt: flach, pos: { x: 0, y: 2, z: 0 } });
  let gedrueckt = false, sprungFrame = false;
  lauf(m3, 1.5, () => {
    const press = !gedrueckt && m3.zustand.pos.y < 0.3 && m3.zustand.vel.y < 0;
    if (press) gedrueckt = true;
    return { x: 0, z: 0, springen: press };
  }, (z) => { if (z.sprung) sprungFrame = true; });
  assert.ok(gedrueckt && sprungFrame, 'Buffer-Sprung');
});

test('Stufe 0.3 m wird erstiegen, Wand 1.5 m blockiert', () => {
  const stufe = createMotor({ welt: { bodenHoehe: (x) => (x > 1 ? 0.3 : 0) }, pos: { x: 0, z: 0 } });
  lauf(stufe, 1, { x: 1, z: 0 });
  assert.ok(stufe.zustand.pos.x > 2 && Math.abs(stufe.zustand.pos.y - 0.3) < 1e-9 && stufe.zustand.amBoden);
  const wand = createMotor({ welt: { bodenHoehe: (x) => (x > 1 ? 1.5 : 0) }, pos: { x: 0, z: 0 } });
  lauf(wand, 2, { x: 1, z: 0.3 });
  assert.ok(wand.zustand.pos.x <= 1 && wand.zustand.pos.y === 0, `x ${wand.zustand.pos.x}`);
  assert.ok(wand.zustand.pos.z > 1, 'gleitet an der Wand entlang');
});

test('steiler Hang → rutscht, flacher nicht', () => {
  const m = createMotor({ welt: { bodenHoehe: (x) => x * 1.5 }, pos: { x: 0, z: 0 } });
  let rutscht = false;
  lauf(m, 1, { x: 1, z: 0 }, (z) => { if (z.rutscht) rutscht = true; });
  assert.ok(rutscht && m.zustand.pos.x < -0.5, `x ${m.zustand.pos.x}`);
  const f = createMotor({ welt: { bodenHoehe: (x) => x * 0.5 }, pos: { x: 0, z: 0 } });
  lauf(f, 1, null, (z) => assert.equal(z.rutscht, false));
  assert.ok(Math.abs(f.zustand.pos.x) < 1e-9);
});

test('Ground-Snap: Kuppe bergab ohne Abheben', () => {
  const m = createMotor({ welt: { bodenHoehe: (x) => (x < 0 ? 0 : -x * 0.6) }, pos: { x: -2, z: 0 } });
  lauf(m, 1.5, { x: 1, z: 0, sprint: true }, (z) => assert.ok(z.amBoden));
});

test('Hindernis-Kreis wird nicht durchdrungen', () => {
  const welt = {
    bodenHoehe: () => 0,
    hindernisse(x, z, r) {
      const dx = x - 3, dz = z - 0.1, d = Math.hypot(dx, dz), min = 0.5 + r;
      return d < min ? { x: dx / d * (min - d), z: dz / d * (min - d) } : null;
    },
  };
  const m = createMotor({ welt, pos: { x: 0, z: 0 } });
  lauf(m, 3, { x: 1, z: 0 }, (z) => assert.ok(Math.hypot(z.pos.x - 3, z.pos.z - 0.1) >= 0.8 - 1e-6));
  assert.ok(m.zustand.pos.x > 3.5, 'rutscht seitlich vorbei');
});

test('Wasser: schwimmt, Kopf über Wasser, Sprung ans Ufer', () => {
  // Wasser bei y=0, Boden fällt nach +z ab, Ufer-Kante bei z<0 auf 0.2 m
  const welt = { bodenHoehe: (x, z) => (z < 0 ? 0.2 : -3), wasserHoehe: () => 0 };
  const m = createMotor({ welt, pos: { x: 0, y: 1, z: 3 } });
  lauf(m, 3, null);
  const z = m.zustand;
  assert.ok(z.imWasser && !z.amBoden);
  assert.ok(z.pos.y + 1.75 > 0.3 && z.pos.y < 0, `y ${z.pos.y}`);
  assert.ok(z.eintauchen > 0.5 && z.eintauchen <= 1);
  lauf(m, 1, { x: 0, z: 1 });
  assert.ok(Math.abs(z.tempo - MOTOR_TUNING.schwimmTempo) < 0.05);
  // zur Kante schwimmen (blockiert), dann springen → an Land
  lauf(m, 4, () => ({ x: 0, z: -1, springen: z.pos.z < 0.2 }));
  assert.ok(z.pos.z < 0 && z.amBoden && !z.imWasser && Math.abs(z.pos.y - 0.2) < 1e-9, JSON.stringify(z.pos));
});

test('robust: große dt, NaN-Absicht, kaputte Welt', () => {
  const m = createMotor({ welt: flach, pos: { x: 0, z: 0 } });
  m.update(5, { x: NaN, z: Infinity, springen: 'ja' });
  m.update(NaN, null);
  m.update(-1, { x: 3, z: 0 });
  m.update(0.25, { x: 1e9, z: 0 });
  const z = m.zustand;
  assert.ok(Number.isFinite(z.pos.x + z.pos.y + z.pos.z + z.vel.x + z.tempo + z.yaw));
  const kaputt = createMotor({ welt: { bodenHoehe: () => NaN, wasserHoehe: () => NaN, hindernisse: () => ({ x: NaN, z: 1 }) }, pos: {} });
  kaputt.update(0.1, { x: 1, z: 0 });
  assert.ok(Number.isFinite(kaputt.zustand.pos.x + kaputt.zustand.pos.y));
});

test('stoss, springeJetzt, teleport, setTuning', () => {
  const m = createMotor({ welt: flach, pos: { x: 0, z: 0 } });
  m.stoss(5, 0, 0);
  lauf(m, 1, null);
  assert.ok(m.zustand.pos.x > 0.4);
  m.springeJetzt(); m.update(DT, null);
  assert.ok(m.zustand.sprung && m.zustand.vel.y > 0);
  let max = 0; lauf(m, 1.5, null, (z) => { max = Math.max(max, z.pos.y); });
  assert.ok(max > MOTOR_TUNING.sprungHoehe * 0.9, 'erzwungener Sprung hat volle Höhe');
  m.teleport({ x: 10, z: 10 }, 1);
  assert.deepEqual([m.zustand.pos.x, m.zustand.pos.y, m.zustand.yaw], [10, 0, 1]);
  m.setTuning({ laufTempo: 2 }); lauf(m, 1, { x: 1, z: 0 });
  assert.ok(Math.abs(m.zustand.tempo - 2) < 0.01 && MOTOR_TUNING.laufTempo === 5);
  m.dispose();
});

test('Determinismus und Bildraten-Unabhängigkeit grob', () => {
  const welt = { bodenHoehe: (x, z) => Math.sin(x * 0.7) * 0.4 + Math.cos(z * 0.5) * 0.3 };
  const spur = () => { const m = createMotor({ welt, pos: { x: 0, z: 0 } }); lauf(m, 4, (i) => ({ x: Math.sin(i * 0.02), z: 1, springen: i % 50 < 20 })); return { ...m.zustand.pos }; };
  assert.deepEqual(spur(), spur());
});

test('flaches Ufer: hineinwaten → schwimmen → wieder herauslaufen', () => {
  const welt = { bodenHoehe: (x, z) => 1 - z * 0.25, wasserHoehe: () => 0 };
  const m = createMotor({ welt, pos: { x: 0, z: 0 } });
  let geschwommen = false, watet = false;
  lauf(m, 6, { x: 0, z: 1 }, (z) => { if (z.imWasser) geschwommen = true; if (z.amBoden && z.eintauchen > 0.2) watet = true; assert.ok(z.pos.y + 1.75 > 0.2); });
  assert.ok(geschwommen && watet);
  lauf(m, 8, { x: 0, z: -1 });
  assert.ok(m.zustand.amBoden && !m.zustand.imWasser && m.zustand.pos.z < 2, JSON.stringify(m.zustand.pos));
});

test('radius/hoehe zur Laufzeit setzbar', () => {
  const m = createMotor({ welt: flach, pos: { x: 0, z: 0 } });
  assert.ok('radius' in m && 'hoehe' in m);
  m.radius = 0.5; m.hoehe = NaN;
  assert.deepEqual([m.radius, m.hoehe], [0.5, 1.75]);
});

// ---------- 1.1.0: Rolle, Dash, Doppelsprung, Gleiten, Tauchen, Kantenschutz, Stoß ----------

test('Ausweichrolle: schneller Vorstoß, Abklingzeit, Zustandsfelder', () => {
  const m = createMotor({ welt: flach, pos: { x: 0, z: 0 } });
  let rollFrames = 0, maxTempo = 0;
  lauf(m, 0.3, (i) => ({ x: 0, z: 0, rollen: i < 3 }), (z) => { if (z.rollt) { rollFrames++; maxTempo = Math.max(maxTempo, z.tempo); } });
  assert.ok(rollFrames > 10, `rollFrames ${rollFrames}`);
  assert.ok(maxTempo > MOTOR_TUNING.laufTempo, `rollTempo ${maxTempo}`);
  assert.ok(m.zustand.pos.z > 1, 'rollt in Blickrichtung (+Z)');
  // während der Abklingzeit keine neue Rolle
  lauf(m, 0.25, null);
  assert.equal(m.zustand.rollt, false);
  assert.ok(m.zustand.abklingzeit > 0);
  lauf(m, 0.05, { rollen: true });
  assert.equal(m.zustand.rollt, false, 'Abklingzeit blockiert');
  lauf(m, 0.6, null);
  assert.equal(m.zustand.abklingzeit, 0);
  m.rolleJetzt({ x: 1, z: 0 });
  m.update(DT, null);
  assert.equal(m.zustand.rollt, true);
  assert.ok(m.zustand.vel.x > 5 && m.zustand.rollAnteil >= 0);
});

test('Dash in der Luft: einmal je Luftphase, ohne Schwerkraft', () => {
  const m = createMotor({ welt: flach, pos: { x: 0, z: 0 } });
  lauf(m, 0.2, { springen: true });
  assert.equal(m.zustand.amBoden, false);
  const y0 = m.zustand.pos.y;
  lauf(m, 0.1, (i) => ({ springen: true, rollen: i < 2, x: 1, z: 0 }));
  assert.equal(m.zustand.dash, true);
  assert.ok(Math.abs(m.zustand.pos.y - y0) < 1e-6, 'Höhe bleibt beim Dash');
  assert.ok(m.zustand.vel.x > 10);
  lauf(m, 0.7, (i) => ({ rollen: i % 2 === 0 }));
  let dashs = 0;
  // zweiter Dash erst nach Landung möglich
  lauf(m, 2, null, (z) => { if (z.dash) dashs++; });
  assert.equal(dashs, 0);
  assert.equal(m.zustand.amBoden, true);
});

test('Doppelsprung nur mit Tuning, sprungZahl zählt', () => {
  const ohne = createMotor({ welt: flach, pos: { x: 0, z: 0 } });
  let max = 0;
  lauf(ohne, 2, (i) => ({ springen: i < 20 || (i > 30 && i < 60) }), (z) => { max = Math.max(max, z.pos.y); });
  assert.ok(max < MOTOR_TUNING.sprungHoehe * 1.1);
  const mit = createMotor({ welt: flach, pos: { x: 0, z: 0 }, tuning: { doppelSprung: 1 } });
  let max2 = 0, doppel = 0;
  lauf(mit, 2, (i) => ({ springen: i < 20 || (i > 30 && i < 60) || (i > 62 && i < 64) }), (z) => { max2 = Math.max(max2, z.pos.y); if (z.doppelSprung) doppel++; });
  assert.equal(doppel, 1, 'genau ein Luftsprung');
  assert.ok(max2 > MOTOR_TUNING.sprungHoehe + 0.3, `apex ${max2}`);
  assert.equal(mit.zustand.sprungZahl, 0, 'nach Landung zurückgesetzt');
});

test('Gleiten begrenzt die Fallgeschwindigkeit', () => {
  const welt = { bodenHoehe: () => 0 };
  const a = createMotor({ welt, pos: { x: 0, y: 20, z: 0 } }), b = createMotor({ welt, pos: { x: 0, y: 20, z: 0 } });
  lauf(a, 1, null); lauf(b, 1, { gleiten: true });
  assert.equal(b.zustand.gleitet, true);
  assert.ok(b.zustand.vel.y >= -MOTOR_TUNING.gleitFallTempo - 0.01, `vy ${b.zustand.vel.y}`);
  assert.ok(b.zustand.pos.y > a.zustand.pos.y + 5);
  lauf(b, 12, { gleiten: true });
  assert.equal(b.zustand.amBoden, true);
  assert.equal(b.zustand.gleitet, false);
});

test('Tauchen: Absicht.tauchen zieht unter die Schwimmlage, Auftrieb holt zurück', () => {
  const welt = { bodenHoehe: () => -6, wasserHoehe: () => 0 };
  const m = createMotor({ welt, pos: { x: 0, y: -1.2, z: 0 } });
  lauf(m, 2, null);
  assert.equal(m.zustand.imWasser, true);
  const lage = m.zustand.pos.y;
  lauf(m, 2, { tauchen: true });
  assert.equal(m.zustand.taucht, true);
  assert.ok(m.zustand.pos.y < lage - 2, `tauchY ${m.zustand.pos.y}`);
  lauf(m, 4, null);
  assert.equal(m.zustand.taucht, false);
  assert.ok(Math.abs(m.zustand.pos.y - lage) < 0.1);
});

test('Kantenschutz: geduckt bzw. per Option nicht von der Klippe', () => {
  const klippe = { bodenHoehe: (x, z) => (z > 3 ? -5 : 0) };
  for (const [opts, absicht] of [[{}, { x: 0, z: 1, ducken: true }], [{ kantenSchutz: true }, { x: 0, z: 1 }], [{}, { x: 0, z: 1, kantenSchutz: true }]]) {
    const m = createMotor({ welt: klippe, pos: { x: 0, z: 0 }, ...opts });
    let kante = false;
    lauf(m, 3, absicht, (z) => { kante ||= z.anKante; });
    assert.equal(m.zustand.amBoden, true);
    assert.ok(m.zustand.pos.z <= 3 && m.zustand.pos.z > 2.4, `z ${m.zustand.pos.z}`);
    assert.ok(kante);
  }
  // ohne Schutz fällt man hinunter, schräg an der Kante wird entlang gerutscht
  const frei = createMotor({ welt: klippe, pos: { x: 0, z: 0 } });
  lauf(frei, 2, { x: 0, z: 1 });
  assert.ok(frei.zustand.pos.y < -4);
  const schraeg = createMotor({ welt: klippe, pos: { x: 0, z: 2.5 }, kantenSchutz: true });
  lauf(schraeg, 1, { x: 0.7, z: 0.7 });
  assert.ok(schraeg.zustand.pos.x > 2 && schraeg.zustand.pos.y === 0);
});

test('Schleichen = geduckt langsam; Stoß mit Betäubung und Wand', () => {
  const m = createMotor({ welt: flach, pos: { x: 0, z: 0 } });
  lauf(m, 1, { x: 0, z: 1, schleichen: true });
  assert.equal(m.zustand.schleicht, true);
  assert.ok(m.zustand.tempo <= MOTOR_TUNING.duckTempo + 1e-6);
  let getroffen = 0;
  m.stoss(6, 0, 0, { betaeubung: 0.5 });
  lauf(m, 0.3, { x: 0, z: 1 }, (z) => { if (z.getroffen) getroffen++; });
  assert.equal(getroffen, 1);
  assert.ok(m.zustand.betaeubt > 0 && m.zustand.betaeubt < 0.5);
  assert.ok(m.zustand.pos.x > 0.4);
  // Stoß gegen eine Wand verpufft (kein Kleben/Weiterdrücken nach Wandende)
  const wand = { bodenHoehe: (x, z) => (x > 1 && z < 2 ? 3 : 0) };
  const w = createMotor({ welt: wand, pos: { x: 0.5, z: 0 } });
  w.stoss(20, 0, 0);
  lauf(w, 0.2, null);
  assert.ok(w.zustand.pos.x <= 1);
  lauf(w, 0.5, { x: 0, z: 1 });
  assert.ok(w.zustand.pos.x <= 1.05, `x ${w.zustand.pos.x}`);
});
