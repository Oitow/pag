import test from 'node:test';
import assert from 'node:assert/strict';
import { CLIPS, CLIP_NAMEN, clipPose, clipZeit, registriereClip } from './character-clips.js';
import { GANZ } from './character-pose.js';

const PFLICHT = ['winken', 'schlagen', 'stossen', 'hacken', 'werfen', 'aufheben', 'jubeln', 'treffer', 'tod', 'ausweichrolle', 'trinken', 'sitzen', 'tanzen'];

test('alle Pflicht-Clips vorhanden, Felder plausibel', () => {
  for (const n of PFLICHT) {
    const c = CLIPS[n];
    assert.ok(c, n);
    assert.ok(c.dauer > 0 && c.trefferBei >= 0 && c.trefferBei <= c.dauer, n);
    assert.ok(['ganz', 'oben'].includes(c.maske), n);
  }
  assert.ok(CLIPS.sitzen.schleife && CLIPS.tanzen.schleife && CLIPS.tod.halten);
  assert.ok(!CLIPS.schlagen.schleife);
  assert.deepEqual(CLIP_NAMEN, Object.keys(CLIPS));
});

test('alle Clips abtastbar: keine NaN, |rad| < 3.5', () => {
  for (const n of CLIP_NAMEN) {
    const c = CLIPS[n];
    for (let t = 0; t <= c.dauer * 2.5; t += 0.01) {
      const p = clipPose(n, t);
      for (const k of GANZ) for (const a of ['x', 'y', 'z']) {
        const v = p[k][a];
        assert.ok(Number.isFinite(v), `${n} ${k}.${a} @${t}`);
        assert.ok(Math.abs(v) < 3.5, `${n} ${k}.${a}=${v} @${t}`);
      }
    }
  }
});

test('Zeitabbildung: Schleife, Halten, Ende', () => {
  assert.equal(clipZeit(CLIPS.tanzen, CLIPS.tanzen.dauer + 0.5), 0.5);
  assert.equal(clipZeit(CLIPS.sitzen, 99), CLIPS.sitzen.dauer);
  assert.equal(clipZeit(CLIPS.tod, 99), CLIPS.tod.dauer);
  const ende = clipPose('tod', 99);
  assert.ok(ende.basis.x < -1.3, 'Tod bleibt liegen');
  const p = clipPose('schlagen', 99);
  assert.ok(Math.abs(p.schulterR.x - -0.5) < 1e-9, 'Ende = letzter Key');
});

test('Schlag-Treffer: rechter Arm vorn, Torso dreht nach links', () => {
  const p = clipPose('schlagen', CLIPS.schlagen.trefferBei);
  assert.ok(p.schulterR.x < -1 && p.torso.y > 0.3);
  const aus = clipPose('hacken', 0.3);
  assert.ok(aus.schulterR.x < -2.5 && aus.schulterL.x < -2.5, 'Axt über dem Kopf');
});

test('registriereClip: eigener Clip, Arrays → Vektoren, unbekannt → Ruhe', () => {
  const c = registriereClip('testVerbeugen', { dauer: 1, maske: 'ganz', keys: [{ t: 1, pose: { torso: [1] } }, { t: 0, pose: {} }] });
  assert.equal(c.keys[0].t, 0);
  assert.ok(CLIP_NAMEN.includes('testVerbeugen'));
  const p = clipPose('testVerbeugen', 0.5);
  assert.ok(p.torso.x > 0.4 && p.torso.x < 0.6);
  assert.equal(clipPose('gibtsNicht', 0.3).torso.x, 0);
});
