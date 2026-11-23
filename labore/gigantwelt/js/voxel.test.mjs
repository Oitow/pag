import test from 'node:test';
import assert from 'node:assert/strict';
import { heightAt, forestAt, ss, gn } from './welt.js';
import { createKern, runJob, CW, VS, PAD, P, P2 } from './voxel-kern.js';

const W = { heightAt, forestAt, ss, gn };
const kern = createKern(W), kernH = createKern(W, { hoehlenAnteil: 1 });
const hoehe = (x, z) => Math.floor(heightAt(x, z) / CW);
const key = (x, y, z) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
const welt = (ch, r) => { const s = new Set(); for (let i = 0; i < r.pos.length; i += 3) s.add(key(ch.ox + r.pos[i], ch.oy + r.pos[i + 1], ch.oz + r.pos[i + 2])); return s; };

test('Naht: benachbarte Chunks erzeugen an der Grenze dieselben Vertices', () => {
  const cx = 3, cz = 5, cy = hoehe(cx * CW + 8, cz * CW + 8);
  const a = kernH.genChunk(cx, cy, cz), b = kernH.genChunk(cx + 1, cy, cz);
  const ra = kernH.meshChunk(a), rb = kernH.meshChunk(b);
  assert.ok(ra && rb);
  const sb = welt(b, rb); let n = 0;
  for (let i = 0; i < ra.pos.length; i += 3) {
    const x = a.ox + ra.pos[i];
    if (x >= b.ox && x < b.ox + .45) { n++; assert.ok(sb.has(key(x, a.oy + ra.pos[i + 1], a.oz + ra.pos[i + 2])), 'Vertex fehlt im Nachbarn'); }
  }
  assert.ok(n > 10, 'Überlapp enthält Vertices: ' + n);
});

test('Winding passt zu den Normalen (Dreiecke zeigen nach außen)', () => {
  const cx = -4, cz = 2, ch = kern.genChunk(cx, hoehe(cx * CW + 8, cz * CW + 8), cz), r = kern.meshChunk(ch);
  let gut = 0, n = r.idx.length / 3;
  for (let t = 0; t < n; t++) {
    const [a, b, c] = [r.idx[t * 3], r.idx[t * 3 + 1], r.idx[t * 3 + 2]], p = i => [r.pos[i * 3], r.pos[i * 3 + 1], r.pos[i * 3 + 2]];
    const A = p(a), B = p(b), C = p(c), u = B.map((v, i) => v - A[i]), w = C.map((v, i) => v - A[i]);
    const g = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const nn = [0, 1, 2].map(i => r.nor[a * 3 + i] + r.nor[b * 3 + i] + r.nor[c * 3 + i]);
    if (g[0] * nn[0] + g[1] * nn[1] + g[2] * nn[2] >= 0) gut++;
  }
  assert.ok(gut / n > .97, `nur ${gut}/${n} richtig herum`);
});

test('Graben (t=0) macht Luft, Auftragen (t=1) macht fest; Kugel ändert den Nachbarchunk an der Grenze mit', () => {
  const cx = 2, cz = 2, x = (cx + 1) * CW - .5, z = 40, y = heightAt(x, z) - 1, cy = Math.floor(y / CW);
  const ch = kern.genChunk(cx, cy, cz), nb = kern.genChunk(cx + 1, cy, cz);
  assert.ok(kern.sample(ch, x, y, z) > 0);
  const op = { t: 0, x, y, z, r: 2, mat: 2, shape: 0 };
  kern.applyOp(ch, op); kern.applyOp(nb, op);
  assert.ok(kern.sample(ch, x, y, z) < 0 && kern.sample(nb, x, y, z) < 0);
  kern.applyOp(ch, { ...op, t: 1, mat: 3 });
  assert.ok(kern.sample(ch, x, y, z) > 0);
});

test('Determinismus: gleiche Eingabe gleiches Ergebnis, Worker-Auftrag = direkter Aufruf', () => {
  const cx = 7, cz = -3, cy = hoehe(cx * CW + 8, cz * CW + 8), ops = [{ t: 0, x: cx * CW + 8, y: heightAt(cx * CW + 8, cz * CW + 8), z: cz * CW + 8, r: 1.5, mat: 2, shape: 0 }];
  const a = kernH.genChunk(cx, cy, cz, ops), b = createKern(W, { hoehlenAnteil: 1 }).genChunk(cx, cy, cz, ops);
  assert.deepEqual(a.d, b.d); assert.deepEqual(a.m, b.m);
  const { res } = runJob(createKern(W, { hoehlenAnteil: 1 }), { t: 'gen', id: 1, cx, cy, cz, ops });
  assert.deepEqual(res.mesh.pos, kernH.meshChunk(a).pos);
});

test('Höhlen: im Höhlengebiet gibt es Luft unter der Oberfläche, nie im Fernmaß ohne Höhlen', () => {
  let luft = 0, ohne = 0;
  for (let cx = 0; cx < 12; cx++) for (let cz = 0; cz < 12; cz++) {
    const x = cx * CW, z = cz * CW, cy = hoehe(x + 8, z + 8) - 1;
    for (const [k, set] of [[kernH, 0], [kern, 1]]) {
      const ch = k.genChunk(cx, cy, cz), h = k.colData(cx, cz).h;
      for (let kk = 0; kk < P; kk += 2) for (let j = 0; j < P; j += 2) for (let i = 0; i < P; i += 2) {
        const dep = h[i + P * kk] - (ch.oy + (j - PAD) * VS);
        if (dep > 6 && dep < 2.9 + 40 && ch.d[i + P * j + P2 * kk] < 0) set ? ohne++ : luft++;
      }
    }
  }
  assert.ok(luft > 0, 'keine Höhle gefunden');
  assert.ok(ohne <= luft, 'Standardanteil darf nicht häufiger sein als Vollbetrieb');
});
