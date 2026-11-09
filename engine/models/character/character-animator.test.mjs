import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRig } from './character-rig.js';
import { koerperMasse, VORLAGEN } from './character-look.js';
import { GANZ, BEINE } from './character-pose.js';
import { CLIPS } from './character-clips.js';
import { createAnimator } from './character-animator.js';

const DT = 1 / 60;
function neu(look = {}, opts = {}) {
  const masse = koerperMasse(look);
  const model = { rig: createRig(masse), masse };
  return { model, anim: createAnimator(model, { seed: 3, ...opts }) };
}
function endlich(pose) {
  for (const k of GANZ) for (const a of ['x', 'y', 'z']) if (!Number.isFinite(pose[k][a])) return `${k}.${a}`;
  return null;
}

test('viele Zustände je 10 s ohne NaN (auch NPC nur mit tempo, Lookwechsel)', () => {
  const zustaende = [
    {}, { tempo: 0 }, { tempo: 1.4 }, { tempo: 5.5 }, { tempo: 9, sprintet: true }, { tempo: 2, duckt: true },
    { tempo: 6, rutscht: true }, { tempo: 3, amBoden: false, vel: { y: 6 } }, { tempo: 3, amBoden: false, vel: { y: -12 } },
    { tempo: 1.5, imWasser: true, eintauchen: 0.75, amBoden: false }, { tempo: 0, imWasser: true, eintauchen: 0.3 },
    { tempo: 4, drehRate: -3 }, { tempo: NaN, vel: {} }, { tempo: 2, landung: 12 },
  ];
  const { model, anim } = neu();
  let i = 0;
  for (const z of zustaende) {
    if (i++ === 5) model.masse = koerperMasse(VORLAGEN.kind);   // setLook ändert masse
    for (let t = 0; t < 10; t += DT) assert.equal(endlich(anim.update(t < 5 ? DT : 0.3, z)), null, JSON.stringify(z));
  }
  for (const n of Object.keys(CLIPS)) { anim.spiele(n); for (let t = 0; t < 2; t += DT) assert.equal(endlich(anim.update(DT, { tempo: 2 })), null, n); }
});

test('onSchritt: einmal pro Fußaufsetzen, Frequenz ≈ tempo / Schrittlänge', () => {
  const schritte = [];
  const { model, anim } = neu({}, { onSchritt: (f, s) => schritte.push([f, s]) });
  for (let t = 0; t < 2; t += DT) anim.update(DT, { tempo: 1.8 });
  schritte.length = 0;
  const dauer = 10;
  for (let t = 0; t < dauer; t += DT) anim.update(DT, { tempo: 1.8 });
  const erwartet = (1.8 / model.masse.schrittLaenge) * dauer;
  assert.ok(Math.abs(schritte.length - erwartet) <= 1.5, `${schritte.length} vs ${erwartet}`);
  for (let i = 1; i < schritte.length; i++) assert.notEqual(schritte[i][0], schritte[i - 1][0], 'L/R im Wechsel');
  schritte.length = 0;
  for (let t = 0; t < 3; t += DT) anim.update(DT, { tempo: 0.1 });
  for (let t = 0; t < 3; t += DT) anim.update(DT, { tempo: 4, amBoden: false });
  assert.equal(schritte.length, 0, 'kein Schritt beim Stehen / in der Luft');
});

test('Füße rutschen nicht: Standfuß bleibt in Weltkoordinaten stehen (gehen + laufen)', () => {
  for (const tempo of [1.2, 1.8, 5.5]) {
    const { model, anim } = neu();
    const rig = model.rig, p = new THREE.Vector3();
    for (let t = 0; t < 3; t += DT) anim.update(DT, { tempo });
    let stand = [], maxDrift = 0, phasen = 0;
    for (let i = 0; i < 300; i++) {
      anim.update(DT, { tempo });
      rig.root.updateMatrixWorld(true);
      rig.knochen.fussL.getWorldPosition(p);
      const weltZ = p.z + tempo * i * DT;
      if (p.y < model.masse.fussHoehe - 0.02 * model.masse.hoehe / 1.75 + 0.004) stand.push(weltZ);
      else if (stand.length) {
        if (stand.length > 3) { maxDrift = Math.max(maxDrift, Math.max(...stand) - Math.min(...stand)); phasen++; }
        stand = [];
      }
    }
    assert.ok(phasen >= 2, `Standphasen erkannt (${tempo})`);
    assert.ok(maxDrift < 0.04, `Drift ${maxDrift.toFixed(3)} m bei ${tempo} m/s`);
  }
});

test('Aktion: dauer/trefferBei durch tempo geteilt, endet von selbst; Schleife läuft bis stoppe()', () => {
  const { anim } = neu();
  const r = anim.spiele('schlagen', { tempo: 2 });
  assert.ok(Math.abs(r.dauer - CLIPS.schlagen.dauer / 2) < 1e-9 && Math.abs(r.trefferBei - CLIPS.schlagen.trefferBei / 2) < 1e-9);
  assert.equal(anim.aktion, 'schlagen');
  for (let t = 0; t < r.dauer + 0.05; t += DT) anim.update(DT, {});
  assert.equal(anim.aktion, null);
  assert.deepEqual(anim.spiele('gibtsNicht'), { dauer: 0, trefferBei: 0 });
  anim.spiele('tanzen');
  for (let t = 0; t < 5; t += DT) anim.update(DT, {});
  assert.equal(anim.aktion, 'tanzen');
  anim.stoppe('winken'); assert.equal(anim.aktion, 'tanzen', 'anderer Name stoppt nicht');
  anim.stoppe(); assert.equal(anim.aktion, null);
  anim.spiele('tod');
  for (let t = 0; t < 4; t += DT) anim.update(DT, {});
  assert.equal(anim.aktion, 'tod'); assert.ok(anim.pose.basis.x < -1.3, 'liegt');
});

test("Maske 'oben': Beine laufen wie ohne Aktion weiter, Arme folgen dem Clip; 'ganz' übernimmt Beine", () => {
  const a = neu().anim, b = neu().anim;
  for (let t = 0; t < 1; t += DT) { a.update(DT, { tempo: 1.8 }); b.update(DT, { tempo: 1.8 }); }
  b.spiele('winken');
  for (let t = 0; t < 0.6; t += DT) { a.update(DT, { tempo: 1.8 }); b.update(DT, { tempo: 1.8 }); }
  for (const k of BEINE) assert.ok(Math.abs(a.pose[k].x - b.pose[k].x) < 1e-9, k);
  assert.ok(b.pose.schulterR.z < -2, 'Arm oben');
  const c = neu().anim;
  c.spiele('sitzen');
  for (let t = 0; t < 1.5; t += DT) c.update(DT, { tempo: 0 });
  assert.ok(c.pose.huefteL.x < -1.2 && c.pose.basisPos.y < -0.5, 'sitzt');
});

test('Blick, Gewicht, dispose', () => {
  const { anim } = neu();
  anim.blickZu({ x: 1, y: 0, z: 0.2 });
  for (let t = 0; t < 1; t += DT) anim.update(DT, {});
  assert.ok(anim.pose.kopf.y > 0.4, 'Kopf dreht nach links (+X)');
  anim.blickZu(null);
  anim.gewicht = 0;
  anim.update(DT, { tempo: 3 });
  assert.equal(anim.pose.knieL.x, 0);
  anim.dispose();
});

test('1.1: Idle-Variante nach Ruhe, bricht beim Loslaufen ab; aus per Option', () => {
  const { anim } = neu({}, { idleNach: [2, 3] });
  let name = null;
  for (let t = 0; t < 6 && !name; t += DT) { anim.update(DT, {}); name = anim.idleVariante; }
  assert.ok(name, 'Variante gestartet');
  assert.equal(anim.aktion, null, 'keine Aktion');
  for (let t = 0; t < 0.6; t += DT) anim.update(DT, { tempo: 2 });
  assert.equal(anim.idleVariante, null);
  const aus = neu({}, { idleVarianten: false, idleNach: [0.5, 0.5] }).anim;
  for (let t = 0; t < 3; t += DT) aus.update(DT, {});
  assert.equal(aus.idleVariante, null);
});

test('1.1: Treffer klingt ab, Umfallen liegt bis aufstehen, Mimik-Hook + Modell-Duck-Typing', () => {
  const infos = [], gesetzt = [];
  const { model, anim } = neu({}, { mimik: (i) => infos.push(i.ausdruck) });
  model.setAusdruck = (a) => gesetzt.push(a);
  for (let t = 0; t < 0.5; t += DT) anim.update(DT, {});
  const ruhe = anim.pose.torso.x;
  anim.treffer({ x: 0, z: 1 }, 1);
  let max = -1;
  for (let t = 0; t < 0.3; t += DT) max = Math.max(max, anim.update(DT, {}).torso.x);
  assert.ok(max > ruhe + 0.1, 'kippt nach vorn');
  assert.ok(infos.includes('schmerz') && gesetzt.includes('schmerz'));
  anim.spiele('winken');
  anim.umfallen({ x: 0, z: -1 });
  assert.equal(anim.aktion, null, 'Aktion gestoppt');
  for (let t = 0; t < 3; t += DT) assert.equal(endlich(anim.update(DT, {})), null);
  assert.ok(anim.liegt && anim.pose.basis.x < -1.3 && anim.mimik.ausdruck === 'bewusstlos');
  anim.aufstehen(0.3);
  for (let t = 0; t < 1; t += DT) anim.update(DT, {});
  assert.ok(!anim.faellt && Math.abs(anim.pose.basis.x) < 0.05);
  anim.ausdruck = 'wuetend'; anim.update(DT, {}); assert.equal(anim.mimik.ausdruck, 'wuetend');
});

test('1.1: Hang aus bodenHoehe, Anhalten läuft den Schritt aus, Umhang-Sockel schwingt, Motor-Sonderfelder', () => {
  const { model, anim } = neu({}, { bodenHoehe: (x, z) => 0.4 * z });
  for (let t = 0; t < 1; t += DT) anim.update(DT, { pos: { x: 0, y: 0, z: 0 }, yaw: 0 });
  assert.ok(anim.hang.vor > 0.39 && anim.pose.torso.x > 0.1, 'lehnt bergauf');
  const b = neu().anim;
  for (let t = 0; t < 2; t += DT) b.update(DT, { tempo: 1.8 });
  const ph = b.phase;
  for (let t = 0; t < 1; t += DT) b.update(DT, { tempo: 0 });
  assert.ok(b.phase > ph + 0.05, 'Schritt zu Ende');
  const { model: m2, anim: c } = neu();
  for (let t = 0; t < 2; t += DT) c.update(DT, { tempo: 6 });
  assert.ok(m2.rig.sockel.umhang.rotation.x > 0.2, 'Umhang weht nach hinten');
  for (const z of [{ rollt: true, rollAnteil: 0.5 }, { amBoden: false, doppelSprung: true }, { amBoden: false, gleitet: true },
    { schleicht: true, tempo: 1 }, { anKante: true }, { betaeubt: 1 }, { getroffen: true, vel: { x: 3, y: 0, z: 0 } },
    { imWasser: true, eintauchen: 0.9, taucht: true, tauchTiefe: 1, amBoden: false }]) {
    for (let t = 0; t < 0.5; t += DT) assert.equal(endlich(c.update(DT, z)), null, JSON.stringify(z));
  }
  assert.ok(model && CLIPS.schlagen && CLIPS.winken, 'NPC-Brain braucht schlagen + winken');
  c.dispose();
});
