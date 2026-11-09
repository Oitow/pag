import test from 'node:test';
import assert from 'node:assert/strict';
import { createGruppe, schwarmKraft, GRUPPE_STANDARD } from './character-gruppe.js';

test('Separation drückt weg, Kohäsion zieht zur Mitte, Ausrichtung folgt', () => {
  const nah = schwarmKraft({ x: 0, z: 0 }, [{ x: 0.5, z: 0 }], { ...GRUPPE_STANDARD, kohaesion: 0, ausrichtung: 0 });
  assert.ok(nah.x < 0 && Math.abs(nah.z) < 1e-9);
  const fern = schwarmKraft({ x: 0, z: 0 }, [{ x: 4, z: 0 }, { x: 4, z: 1 }], { ...GRUPPE_STANDARD, separation: 0, ausrichtung: 0 });
  assert.ok(fern.x > 0);
  const aus = schwarmKraft({ x: 0, z: 0 }, [{ x: 3, z: 0, vx: 0, vz: 2 }], { ...GRUPPE_STANDARD, separation: 0, kohaesion: 0 });
  assert.ok(aus.z > 0 && Math.abs(aus.x) < 1e-9);
  assert.deepEqual(schwarmKraft({ x: 0, z: 0 }, [{ x: 50, z: 0 }]), { x: 0, z: 0 }, 'außer Sicht');
  assert.deepEqual(schwarmKraft({ x: 0, z: 0 }, [{ x: NaN, z: 0 }, { x: 0, z: 0 }]), { x: 0, z: 0 }, 'kaputt / selbst');
});

test('createGruppe: Gewichte, maxKraft, dispose', () => {
  const g = createGruppe({ separation: 10, maxKraft: 0.5 });
  const k = g.kraft({ x: 0, z: 0 }, [{ x: 0.2, z: 0 }]);
  assert.ok(Math.abs(Math.hypot(k.x, k.z) - 0.5) < 1e-9);
  g.setGewichte({ separation: 0, kohaesion: 0, ausrichtung: 0 });
  const n = g.kraft({ x: 0, z: 0 }, [{ x: 0.2, z: 0 }]);
  assert.equal(Math.hypot(n.x, n.z), 0);
  g.dispose();
});
