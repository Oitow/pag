// Tests für figur-koerper: Verträge mit Boden, Waffen-Sockel und starrem Gesicht (Augäpfel, Mund).
import test from 'node:test';
import assert from 'node:assert/strict';
import { VORLAGEN, createLook, koerperMasse } from './character-look.js';
import { createRig } from './character-rig.js';
import { formKontext, BINDE_POSE } from './figur-haut.js';
import { createFigurForm } from './figur-form.js';
import { baueKoerperForm } from './figur-koerper.js';
import { AUGE } from './character-parts-kopf.js';

function bau(name) {
  const look = createLook(VORLAGEN[name]), masse = koerperMasse(look), rig = createRig(masse), k = rig.knochen;
  k.schulterL.rotation.z = BINDE_POSE.arm; k.schulterR.rotation.z = -BINDE_POSE.arm;
  k.ellbogenL.rotation.x = BINDE_POSE.ellbogen; k.ellbogenR.rotation.x = BINDE_POSE.ellbogen;
  k.huefteL.rotation.z = BINDE_POSE.bein; k.huefteR.rotation.z = -BINDE_POSE.bein;
  rig.root.updateMatrixWorld(true);
  const ctx = formKontext(look, masse, rig), form = createFigurForm({ glatt: 0.02 * ctx.g });
  baueKoerperForm(form, ctx);
  return { ctx, form, masse, d: (p) => form.abstand(p[0], p[1], p[2]) };
}

test('Sohle liegt flach bei y ≈ 0, darunter ist nichts', () => {
  for (const n of ['bauer', 'kind']) {
    const { ctx, d, masse } = bau(n);
    for (const s of ['L', 'R']) for (const z of [-0.02, 0.06, 0.12]) {
      const p = ctx.P('fuss' + s, [0, 0, z * masse.fussLaenge / 0.24]);
      assert.ok(d([p[0], 0.008, p[2]]) < 0, `${n} ${s} z=${z}: Fuß reicht bis zum Boden`);
      assert.ok(d([p[0], -0.006, p[2]]) > 0, `${n} ${s} z=${z}: nichts unter dem Boden`);
    }
  }
});

test('Griff am Hand-Sockel steckt in der Faust', () => {
  const { ctx, d, masse } = bau('bauer');
  for (const s of ['L', 'R']) {
    const v = d(ctx.P('hand' + s, [0, -masse.hand * 0.55, 0]));
    assert.ok(v < -0.01 && v > -0.04, `${s}: Abstand ${v.toFixed(3)} – Faust umschließt den Griff (r ≈ 0.017)`);
  }
});

test('Augäpfel sitzen bündig, Mund liegt auf der Gesichtsfläche', () => {
  for (const n of ['magierin', 'kind', 'schmied']) {
    const { ctx, d } = bau(n), R = ctx.R, kopf = (x, y, z) => d(ctx.P('kopf', [x * R, y * R, z * R]));
    for (const s of [-1, 1]) {
      const vorn = kopf(s * AUGE.x, AUGE.y, AUGE.z + AUGE.r * AUGE.sz);
      assert.ok(vorn > 0.002 && vorn < 0.025, `${n}: Augapfel-Front ${vorn.toFixed(3)} m vor der Haut (nicht vergraben/schwebend)`);
      const rand = kopf(s * (AUGE.x + AUGE.r * 1.1), AUGE.y, AUGE.z);
      assert.ok(Math.abs(rand) < 0.012, `${n}: Haut am Augenrand ${rand.toFixed(3)}`);
    }
    const mund = kopf(0, 0.52, 0.88);
    assert.ok(Math.abs(mund) < 0.01, `${n}: Mundfläche ${mund.toFixed(3)}`);
  }
});

test('Kind kleiner und mit verhältnismäßig größerem Kopf als Erwachsener', () => {
  const kind = bau('kind'), gross = bau('bauer');
  const hoehe = (b) => b.form.grenzen().max[1];
  assert.ok(hoehe(kind) < hoehe(gross) * 0.7);
  assert.ok(kind.ctx.R / kind.masse.hoehe > 1.3 * gross.ctx.R / gross.masse.hoehe);
  assert.ok(kind.form.anzahl <= 50 && gross.form.anzahl <= 50, `Körper-Anzahl ${gross.form.anzahl}`);
});
