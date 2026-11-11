import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from './worldgen/worldgen.js';
import { createWeltAdapter } from './worldgen/worldgen-adapter.js';
import { createScatterMesh, FORMEN } from './scatter-mesh.js';
import { createAssetCache } from '../models/natur/natur-assets.js';

const welt = createWorld({ preset: 'insel', seed: 3, breite: 96, tiefe: 96, qualitaet: 'schnell' });
const adapter = createWeltAdapter(welt, { hoehenSkala: 40, meterProZelle: 2 });

/** Kleine Kunstwelt mit beliebigen Typnamen auf dem echten Adapter. */
function kunstAdapter(eintraege) {
  const o = { anzahl: eintraege.length, x: [], y: [], art: [], typ: [], skala: [], drehung: [], arten: [], typen: [] };
  for (const [k, [art, typ]] of eintraege.entries()) {
    if (!o.arten.includes(art)) o.arten.push(art);
    if (!o.typen.includes(typ)) o.typen.push(typ);
    o.x.push(40 + k); o.y.push(48); o.art.push(o.arten.indexOf(art)); o.typ.push(o.typen.indexOf(typ)); o.skala.push(1); o.drehung.push(0);
  }
  return { ...adapter, welt: { ...welt, objekte: o } };
}

test('Assets: InstancedMesh je (Typ, Variante), Varianten gestreut, Wind-Update', () => {
  const s = createScatterMesh(adapter, { assets: createAssetCache, varianten: 3, detail: 0 });
  assert.ok(s.anzahl > 0 && s.dreiecke > 0);
  let summe = 0;
  const varianten = new Map();
  for (const m of s.gruppe.children) {
    assert.ok(m.isInstancedMesh);
    assert.ok(m.geometry.attributes.wind, m.name);
    const [typ, v] = m.name.split('#');
    if (!varianten.has(typ)) varianten.set(typ, new Set());
    varianten.get(typ).add(v);
    summe += m.count;
  }
  assert.equal(summe, s.anzahl);
  assert.equal(s.meshes, s.gruppe.children.length);
  const viele = [...varianten.values()].filter(v => v.size > 1);
  assert.ok(viele.length > 0, 'mehrere Varianten');
  s.update(1.5, { staerke: 0.5 });
  s.dispose();
});

test('Typnamen: unbekannt → Ersatz nach Art, sonst weglassen; Bodendecker ohne Schatten', () => {
  const a = kunstAdapter([['baum', 'mammutbaum'], ['quatsch', 'drache'], ['bodendecker', 'grasbueschel'], ['fels', 'findling']]);
  const s = createScatterMesh(a, { assets: createAssetCache({ varianten: 1, detail: 0 }) });
  const namen = s.gruppe.children.map(m => m.name.split('#')[0]).sort();
  assert.deepEqual(namen, ['eiche', 'findling', 'grasbueschel']);
  assert.equal(s.anzahl, 3);
  for (const m of s.gruppe.children) assert.equal(m.castShadow, m.name.startsWith('grasbueschel') ? false : true);
  s.dispose();
  // ohne Assets: alte Formen, unbekannte Art → weglassen (keine Busch-Kugel mehr)
  const alt = createScatterMesh(a);
  assert.deepEqual(alt.gruppe.children.map(m => m.name).sort(), ['eiche', 'fels']);
  alt.dispose();
});

test('Seerose liegt auf dem Wasser', () => {
  const s = createScatterMesh(adapter, { assets: createAssetCache({ varianten: 1, detail: 0 }), nurArten: ['seerose'] });
  const m = s.gruppe.children[0];
  if (!m) return;   // keine Seerosen in dieser Welt
  for (let k = 0; k < m.count; k++) {
    const e = m.instanceMatrix.array.subarray(k * 16, k * 16 + 16);
    const x = e[12], y = e[13], z = e[14];
    assert.ok(Math.abs(y - (adapter.wasserHoehe(x, z) + 0.02)) < 1e-3);
  }
  s.dispose();
});

test('Eigene Formen gehen vor Assets', () => {
  const s = createScatterMesh(adapter, { assets: createAssetCache({ varianten: 1, detail: 0 }), formen: { eiche: FORMEN.busch } });
  const eiche = s.gruppe.children.find(m => m.name === 'eiche');
  if (eiche) assert.equal(eiche.geometry.attributes.wind, undefined);
  s.dispose();
});

test('Kacheln + Fern-Detail: zwei Meshes je Kachel, update schaltet nach Kamera-Entfernung', () => {
  const s = createScatterMesh(adapter, { assets: createAssetCache, varianten: 1, detail: 1, kachel: 48, fernWeite: 60, nurArten: ['baum'] });
  const nah = s.gruppe.children.filter(m => !m.name.endsWith('#fern')), fern = s.gruppe.children.filter(m => m.name.endsWith('#fern'));
  assert.ok(nah.length > 1 && nah.length === fern.length);
  let summe = 0; for (const m of nah) summe += m.count;
  assert.equal(summe, s.anzahl);
  s.update(0, { kamera: { x: 1e5, z: 1e5 } });
  assert.ok(nah.every(m => !m.visible) && fern.every(m => m.visible));
  s.update(0, { kamera: { position: { x: 0, z: 0 } } });
  assert.ok(nah.some(m => m.visible));
  assert.ok(fern[0].geometry.attributes.position.count < nah[0].geometry.attributes.position.count || fern[0].name !== nah[0].name + '#fern');
  s.dispose();
});

test('setzeAufBoden: Objekte folgen dem geänderten Gelände, versteckte bleiben versteckt', () => {
  const w = createWorld({ preset: 'insel', seed: 3, breite: 96, tiefe: 96, qualitaet: 'schnell' });
  const a = createWeltAdapter(w, { hoehenSkala: 40, meterProZelle: 2 });
  const s = createScatterMesh(a, { assets: createAssetCache, varianten: 2, detail: 0 });
  const o = w.objekte;
  let i = -1, j = -1;
  for (let k = 0; k < o.anzahl && j < 0; k++) { if (!s.lage(k) || o.arten[o.art[k]] === 'seerose') continue; if (i < 0) i = k; else if (Math.hypot(o.x[k] - o.x[i], o.y[k] - o.y[i]) > 6) j = k; }
  assert.ok(i >= 0 && j >= 0);
  const vorher = s.lage(i).y, fern = s.lage(j).y;
  const cx = Math.floor(o.x[i]), cy = Math.floor(o.y[i]);
  for (let y = cy - 1; y <= cy + 2; y++) for (let x = cx - 1; x <= cx + 2; x++) w.hoehe[y * 96 + x] -= 0.05;   // 2 m tiefer
  assert.equal(s.setzeAufBoden(null), 0);
  const n = s.setzeAufBoden({ x0: cx - 1, y0: cy - 1, x1: cx + 2, y1: cy + 2 });
  assert.ok(n >= 1);
  assert.ok(Math.abs(s.lage(i).y - (vorher - 2)) < 1e-3);
  assert.equal(s.lage(j).y, fern);
  // versteckt → Matrix bleibt null, nach dem Einblenden steht es auf dem neuen Boden
  s.verstecke(i);
  for (let y = cy - 1; y <= cy + 2; y++) for (let x = cx - 1; x <= cx + 2; x++) w.hoehe[y * 96 + x] += 0.025;
  s.setzeAufBoden({ x0: cx, y0: cy, x1: cx + 1, y1: cy + 1 });
  const mesh = s.gruppe.children.find((m) => { for (let k = 0; k < m.count; k++) if (m.instanceMatrix.array[k * 16 + 15] === 0) return true; return false; });
  assert.ok(mesh);
  s.verstecke(i, false);
  assert.ok(Math.abs(s.lage(i).y - (vorher - 1)) < 1e-3);
  s.dispose();
});
