import test from 'node:test';
import assert from 'node:assert/strict';
import { STANDARD_OBJEKTE, VEGETATION_TYPEN, typenVon } from './worldgen-vegetation.js';
import { createWorld } from './worldgen.js';
import { FLAG, WASSER } from './worldgen-grid.js';

// Typnamen aus docs/plaene/NATUR-ASSETS.md (gemeinsam mit den Asset-Generatoren)
const VERTRAG = ['eiche', 'buche', 'birke', 'ahorn', 'weide', 'tanne', 'fichte', 'kiefer', 'pinie', 'tropenbaum', 'palme', 'akazie', 'olive',
  'toterBaum', 'fels', 'felsbrocken', 'findling', 'geroell', 'felsplatte', 'felsnadel', 'baumstumpf', 'liegenderStamm', 'ast',
  'busch', 'beerenbusch', 'ginster', 'zwergstrauch', 'farn', 'grasbueschel', 'blume', 'pilz', 'schilf', 'seerose', 'kaktus', 'saeulenkaktus', 'agave'];

test('Vegetation: nur Typnamen aus dem Asset-Vertrag, alle Vertragstypen kommen vor', () => {
  for (const t of VEGETATION_TYPEN) assert.ok(VERTRAG.includes(t), `unbekannter Typ ${t}`);
  for (const t of VERTRAG) assert.ok(VEGETATION_TYPEN.includes(t), `Vertragstyp ${t} wird nie verteilt`);
  const keys = STANDARD_OBJEKTE.map(a => a.key);
  assert.equal(new Set(keys).size, keys.length, 'doppelte Art');
  assert.deepEqual(typenVon({ key: 'x' }), ['x']);
});

const zaehle = (o, f) => { let n = 0; for (let i = 0; i < o.anzahl; i++) if (f(i)) n++; return n; };
const welt = createWorld({ preset: 'insel', seed: 5, breite: 128, tiefe: 128, qualitaet: 'schnell' });
const o = welt.objekte, art = i => o.arten[o.art[i]], typ = i => o.typen[o.typ[i]];
const zelle = (i) => Math.min(welt.breite - 1, Math.round(o.x[i] / welt.zelle)) + Math.min(welt.tiefe - 1, Math.round(o.y[i] / welt.zelle)) * welt.breite;

test('Vegetation: Ebenen vorhanden, Seerosen nur auf Seen, alles andere an Land', () => {
  for (const k of ['baum', 'busch', 'unterholz', 'bodendecker', 'fels']) assert.ok(zaehle(o, i => art(i) === k) > 0, `keine Art ${k}`);
  assert.ok(new Set(Array.from({ length: o.anzahl }, (_, i) => typ(i))).size >= 10, 'zu wenig Typvielfalt');
  for (let i = 0; i < o.anzahl; i++) {
    const fl = welt.flags[zelle(i)];
    if (art(i) === 'seerose') assert.ok(fl & FLAG.SEE, 'Seerose nicht auf See');
    else if (art(i) !== 'schilf') assert.ok(!(fl & WASSER), `${art(i)} im Wasser`);
    assert.ok(o.skala[i] > 0.4 && o.skala[i] < 1.6);
  }
});

test('Vegetation: Unterholz nur in Waldbiomen, Bodendecker abschaltbar und dosierbar', () => {
  const wald = new Set(['laubwald', 'nadelwald', 'birkenwald', 'regenwald', 'sumpf', 'hartlaubwald']);
  for (let i = 0; i < o.anzahl; i++) if (art(i) === 'unterholz') assert.ok(wald.has(welt.biome[welt.biom[zelle(i)]].key));
  const opts = { preset: 'insel', seed: 5, breite: 128, tiefe: 128, qualitaet: 'schnell' };
  const ohne = createWorld({ ...opts, objekte: { aus: ['bodendecker'] } }).objekte;
  assert.ok(!ohne.arten.includes('bodendecker'));
  const halb = createWorld({ ...opts, objekte: { artDichte: { bodendecker: 0.5 } } }).objekte;
  const n = x => zaehle(x, i => x.arten[x.art[i]] === 'bodendecker');
  assert.ok(n(halb) < n(o) * 0.75 && n(halb) > 0, `artDichte wirkt nicht (${n(halb)} von ${n(o)})`);
  // andere Arten bleiben unverändert (Reihenfolgeunabhängigkeit je Art)
  assert.equal(zaehle(halb, i => halb.arten[halb.art[i]] === 'baum'), zaehle(o, i => art(i) === 'baum'));
});

// ---- Urwald (Dämmerwald-Stil) ----
import { URWALD_OBJEKTE, URWALD_TYPEN } from './worldgen-vegetation.js';
import { verteile } from './worldgen-scatter.js';
import { TYP_ZU_GENERATOR } from '../../models/natur/natur-assets.js';

test('Urwald: Typen gebaut von der Registry (außer Platzhalter riese), Preset daemmerwald = urwald', () => {
  for (const t of URWALD_TYPEN) if (t !== 'riese') assert.equal(typeof TYP_ZU_GENERATOR[t], 'function', t);
  for (const t of ['riese', 'wedelfarn', 'busch_unterholz', 'moospolster', 'wurzelschoessling', 'laubstreu', 'farn']) assert.ok(URWALD_TYPEN.includes(t), t);
  const a = createWorld({ preset: 'daemmerwald', seed: 3, breite: 96, tiefe: 96, qualitaet: 'schnell' }).objekte;
  const b = createWorld({ preset: 'urwald', seed: 3, breite: 96, tiefe: 96, qualitaet: 'schnell' }).objekte;
  assert.equal(a.anzahl, b.anzahl);
});

const uw = createWorld({ preset: 'urwald', seed: 3, breite: 160, tiefe: 160, qualitaet: 'schnell' });
const uo = uw.objekte, uart = (i) => uo.arten[uo.art[i]];
test('Urwald: Riesen mit Mindestabstand, viel Unterwuchs, nur auf Urwald-Boden', () => {
  const R = [];
  for (let i = 0; i < uo.anzahl; i++) if (uart(i) === 'riese') R.push([uo.x[i], uo.y[i]]);
  assert.ok(R.length >= 20, `nur ${R.length} Riesen`);
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) assert.ok(Math.hypot(R[i][0] - R[j][0], R[i][1] - R[j][1]) >= 9 - 1e-3, 'Riesen zu nah');
  const unter = zaehle(uo, (i) => uart(i) === 'urwald_unterwuchs');
  assert.ok(unter > R.length * 15, `Unterwuchs zu dünn (${unter})`);
  const uid = uw.biome.findIndex((bm) => bm.key === 'urwald');
  for (let i = 0; i < uo.anzahl; i++) if (['riese', 'moospolster'].includes(uart(i))) {
    const k = Math.min(uw.breite - 1, Math.round(uo.x[i])) + Math.min(uw.tiefe - 1, Math.round(uo.y[i])) * uw.breite;
    assert.equal(uw.biom[k], uid);
  }
});

// Eigene Quelle (wie im Spiel): ein Biom, Pfad über FLAG.FREI, belegte Stammfüße, Dichtefeld
const quelleMit = ({ staemme = [], dichte = null } = {}) => ({
  punkt(x, y, aus) {
    aus[0] = 0; aus[1] = 0; aus[2] = 0.1; aus[3] = 50; aus[4] = Math.abs(x - 50) < 2 ? FLAG.FREI : 0;
    aus[5] = staemme.some(([sx, sy]) => Math.hypot(x - sx, y - sy) < 3) ? 1 : 0;
    return true;
  },
  ...(dichte ? { dichte } : {}),
});
const ART = URWALD_OBJEKTE.find((a) => a.key === 'urwald_unterwuchs');
const OPTS = { seed: 4, massstab: 100, biome: [{ key: 'urwald' }], dichte: 0.35 };
const BER = { x0: 0, y0: 0, x1: 100, y1: 100 };
test('verteile: Pfad frei, dichter am Stammfuß, Dichtefeld dünnt aus', () => {
  const ohne = verteile(quelleMit(), [{ ...ART, lichtung: null, cluster: null }], OPTS, BER);
  for (let i = 0; i < ohne.anzahl; i++) assert.ok(Math.abs(ohne.x[i] - 50) >= 2, 'auf dem Pfad');
  const staemme = [[20, 20], [80, 30], [25, 75], [75, 80]];
  const mit = verteile(quelleMit({ staemme }), [{ ...ART, lichtung: null, cluster: null }], OPTS, BER);
  const ring = (o) => zaehle(o, (i) => staemme.some(([sx, sy]) => { const d = Math.hypot(o.x[i] - sx, o.y[i] - sy); return d > 3 && d < 6.5; }));
  assert.ok(ring(mit) > ring(ohne) * 1.25, `Stammfuß wirkt nicht (${ring(mit)} vs ${ring(ohne)})`);
  const duenn = verteile(quelleMit({ dichte: (x) => (x < 50 ? 1 : 0.2) }), [{ ...ART, lichtung: null, cluster: null }], OPTS, BER);
  const links = zaehle(duenn, (i) => duenn.x[i] < 48), rechts = zaehle(duenn, (i) => duenn.x[i] > 52);
  assert.ok(rechts < links * 0.4 && rechts > 0, `Dichtefeld wirkt nicht (${links}/${rechts})`);
  // Lichtung: gemeinsames Rauschen → Riesen und Unterwuchs teilen dieselben freien Stellen
  const li = verteile(quelleMit(), [ART], OPTS, BER);
  assert.ok(li.anzahl < ohne.anzahl, 'Lichtungen fehlen');
});
