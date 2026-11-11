import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWeltAenderung, PINSEL_ARTEN } from './welt-aenderung.js';
import { createWeltAdapter } from './worldgen/worldgen-adapter.js';
import { createSpeicher } from '../core/speicher.js';
import { createEreignisse } from '../core/ereignisse.js';
import { FLAG } from './worldgen/worldgen-grid.js';

/** Kleine flache Welt (Höhe 0.1) mit einem Fluss in Spalte 3, einem Weg in Zeile 28 und drei Objekten. */
function miniWelt(B = 32, T = 32) {
  const hoehe = new Float32Array(B * T).fill(0.1), flags = new Uint8Array(B * T);
  for (let y = 0; y < T; y++) flags[y * B + 3] = FLAG.FLUSS;
  for (let x = 6; x < B; x++) flags[28 * B + x] = FLAG.WEG;
  const objekte = { anzahl: 3, x: Float32Array.of(16.2, 17.5, 25), y: Float32Array.of(16.4, 16, 8), typ: Uint8Array.of(0, 1, 0), art: Uint8Array.of(0, 1, 0),
    skala: Float32Array.of(1, 1, 1), typen: ['eiche', 'gras'], arten: ['baum', 'bodendecker'] };
  return { breite: B, tiefe: T, zelle: 1, seed: 1, hoehe, flags, wasserstand: new Float32Array(B * T), objekte, biome: [{ name: 'Wiese' }], biom: new Uint8Array(B * T) };
}
const mitAdapter = (welt = miniWelt()) => createWeltAdapter(welt, { hoehenSkala: 50, meterProZelle: 2 });   // Karte 64 m, Mitte = (0, 0)
const nah = (a, b, e = 1e-4) => Math.abs(a - b) <= e;

test('heben/senken in Metern: Mitte voll, Rand weich, Adapter sieht es sofort', () => {
  const a = mitAdapter(), aend = createWeltAenderung(a);
  assert.deepEqual([...PINSEL_ARTEN], ['heben', 'senken', 'glaetten', 'ebnen']);
  const vorher = a.bodenHoehe(0, 0);
  const ber = aend.pinsel('heben', 0, 0, { radius: 6, staerke: 2 });
  assert.ok(nah(a.bodenHoehe(0, 0), vorher + 2));
  assert.ok(a.bodenHoehe(4, 0) > vorher && a.bodenHoehe(4, 0) < vorher + 2);
  assert.ok(nah(a.bodenHoehe(8, 0), vorher));
  assert.ok(ber.x0 >= 13 && ber.x1 <= 19 && ber.y0 >= 13 && ber.y1 <= 19);
  assert.ok(ber.volumen > 0);
  assert.ok(nah(aend.delta(16 * 32 + 16), 2));
  const tief = aend.pinsel('senken', 0, 0, { radius: 6, staerke: 2 });
  assert.ok(nah(a.bodenHoehe(0, 0), vorher) && nah(tief.volumen, -ber.volumen, 1e-2));
  assert.throws(() => aend.pinsel('sprengen', 0, 0));
});

test('ebnen zieht auf die Zielhöhe, glätten mittelt eine Spitze weg', () => {
  const a = mitAdapter(), aend = createWeltAenderung(a), H = a.welt.hoehe;
  aend.pinsel('heben', 0, 0, { radius: 2, staerke: 3, form: 'hart' });
  const spitze = H[16 * 32 + 16];
  aend.pinsel('glaetten', 0, 0, { radius: 6, staerke: 1 });
  assert.ok(H[16 * 32 + 16] < spitze && H[16 * 32 + 16] > 0.1);
  aend.pinsel('ebnen', 0, 0, { radius: 8, staerke: 1, ziel: 7, form: 'hart' });
  for (const [x, z] of [[0, 0], [4, 2], [-6, 0]]) assert.ok(nah(a.bodenHoehe(x, z), 7));
  // ohne ziel: Höhe in der Pinselmitte
  aend.pinsel('heben', 20, 20, { radius: 2, staerke: 1, form: 'hart' });
  aend.pinsel('ebnen', 20, 20, { radius: 6, staerke: 1, form: 'hart' });
  assert.ok(nah(a.bodenHoehe(24, 20), a.bodenHoehe(20, 20)));
});

test('Sperrzonen: Wasser samt Ufer und Wege bleiben unberührt', () => {
  const a = mitAdapter(), aend = createWeltAenderung(a), H = a.welt.hoehe, B = 32;
  const amFluss = a.zuWelt(3, 10), amWeg = a.zuWelt(15, 28), frei = a.zuWelt(15, 10);
  assert.equal(aend.kannAendern(amFluss.x, amFluss.z), false);
  assert.equal(aend.kannAendern(a.zuWelt(4, 10).x, amFluss.z), false);    // Ufer-Nachbar
  assert.equal(aend.kannAendern(a.zuWelt(5, 10).x, amFluss.z), true);
  assert.equal(aend.kannAendern(amWeg.x, amWeg.z), false);
  assert.equal(aend.kannAendern(a.zuWelt(15, 27).x, a.zuWelt(15, 27).z), true);   // Weg sperrt nur sich selbst
  assert.equal(aend.kannAendern(frei.x, frei.z), true);
  assert.equal(aend.kannAendern(999, 0), false);
  aend.pinsel('senken', amFluss.x, amFluss.z, { radius: 6, staerke: 1 });
  for (const x of [2, 3, 4]) assert.equal(H[10 * B + x], Math.fround(0.1));
  assert.ok(H[10 * B + 5] < 0.1);
  assert.equal(aend.pinsel('heben', amFluss.x, amFluss.z, { radius: 1 }), null);
  // Sperre abschaltbar
  const ohne = createWeltAenderung(mitAdapter(), { sperrFlags: 0 });
  assert.equal(ohne.kannAendern(amFluss.x, amFluss.z), true);
});

test('Grenzen: maxAbweichung, minHoehe, maxHoehe', () => {
  const a = mitAdapter(), aend = createWeltAenderung(a, { maxAbweichung: 1.5, maxHoehe: 6 });
  for (let k = 0; k < 10; k++) aend.pinsel('senken', 0, 0, { radius: 4, staerke: 1 });
  assert.ok(nah(a.bodenHoehe(0, 0), 5 - 1.5));
  assert.equal(aend.pinsel('senken', 0, 0, { radius: 1, staerke: 1, form: 'hart' }), null);   // nichts mehr zu holen
  for (let k = 0; k < 10; k++) aend.pinsel('heben', 0, 0, { radius: 4, staerke: 1 });
  assert.ok(nah(a.bodenHoehe(0, 0), 6));
});

test('Rückgängig/Wiederholen: ein Strich = ein Schritt, neue Änderung verwirft Wiederholen', () => {
  const a = mitAdapter(), aend = createWeltAenderung(a, { maxSchritte: 3 }), H = a.welt.hoehe, start = H.slice();
  assert.equal(aend.kannRueckgaengig, false);
  assert.equal(aend.rueckgaengig(), null);
  aend.beginne();
  aend.pinsel('heben', 0, 0, { radius: 4, staerke: 1 });
  aend.pinsel('heben', 2, 0, { radius: 4, staerke: 1 });
  assert.equal(aend.beende(), true);
  const nachStrich = H.slice();
  aend.pinsel('senken', 10, 10, { radius: 4, staerke: 1 });
  assert.equal(aend.anzahl.schritte, 2);
  const e = aend.rueckgaengig();
  assert.equal(e.grund, 'rueckgaengig');
  assert.ok(e.bereich.x0 <= 21 && e.bereich.x1 >= 21);
  assert.deepEqual(H, nachStrich);
  aend.rueckgaengig();
  assert.deepEqual(H, start);
  assert.equal(aend.kannWiederholen, true);
  aend.wiederholen();
  assert.deepEqual(H, nachStrich);
  aend.pinsel('heben', -10, -10, { radius: 2 });
  assert.equal(aend.kannWiederholen, false);
  for (let k = 0; k < 5; k++) aend.pinsel('heben', -10, -10, { radius: 2 });
  assert.equal(aend.anzahl.schritte, 3);                      // älteste Schritte fallen raus
  assert.equal(aend.beende(), false);                         // leerer Strich zählt nicht
});

test('Objekte entfernen, wiederherstellen, im Umkreis finden', () => {
  const a = mitAdapter(), bus = createEreignisse(), aend = createWeltAenderung(a, { ereignisse: bus });
  const gemeldet = [];
  bus.an('welt:geaendert', (e) => gemeldet.push(e));
  const p = a.zuWelt(16, 16);
  assert.deepEqual(aend.objekteImUmkreis(p.x, p.z, 4).sort(), [0, 1]);
  assert.deepEqual(aend.objekteImUmkreis(p.x, p.z, 4, (i, typ, art) => art === 'bodendecker'), [1]);
  assert.equal(aend.entferneObjekt(1), true);
  assert.equal(aend.entferneObjekt(1), false);
  assert.equal(aend.entferneObjekt(99), false);
  assert.equal(aend.istEntfernt(1), true);
  assert.deepEqual(aend.objekteImUmkreis(p.x, p.z, 4), [0]);
  assert.deepEqual(gemeldet.at(-1).objekte, [[1, true]]);
  assert.equal(gemeldet.at(-1).bereich, null);
  aend.rueckgaengig();
  assert.equal(aend.istEntfernt(1), false);
  assert.deepEqual(gemeldet.at(-1).objekte, [[1, false]]);
  aend.wiederholen();
  assert.deepEqual(aend.entfernte(), [1]);
  assert.equal(aend.stelleObjektHer(1), true);
  assert.deepEqual(aend.entfernte(), []);
});

test('Spielstand: nur Unterschiede, Rundreise über den Speicher in eine frische Welt', () => {
  const a = mitAdapter(), aend = createWeltAenderung(a);
  aend.pinsel('senken', 0, 0, { radius: 5, staerke: 1.2 });
  aend.pinsel('heben', 14, -10, { radius: 3, staerke: 0.7 });
  aend.entferneObjekt(2);
  const z = aend.zustand();
  assert.ok(z.i instanceof Uint32Array && z.d instanceof Float32Array);
  assert.ok(z.i.length > 0 && z.i.length < 60 && z.i.length === z.d.length);
  assert.deepEqual(z.weg, [2]);
  const storage = {}, sp = createSpeicher({ schluessel: 't', version: 1, storage: { getItem: (k) => storage[k] ?? null, setItem: (k, v) => { storage[k] = v; }, removeItem: (k) => delete storage[k] } });
  sp.speichere('s', { aenderung: z });
  const b = mitAdapter(), neu = createWeltAenderung(b);
  const gemeldet = [];
  neu.onAenderung((e) => gemeldet.push(e));
  const ber = neu.lade(sp.lade('s').aenderung);
  assert.deepEqual(b.welt.hoehe, a.welt.hoehe);
  assert.equal(neu.istEntfernt(2), true);
  assert.ok(ber.x0 <= 16 && ber.x1 >= 16);
  assert.equal(gemeldet.length, 1);
  assert.equal(gemeldet[0].grund, 'lade');
  assert.deepEqual(gemeldet[0].objekte, [[2, true]]);
  assert.deepEqual(neu.zustand().i, z.i);
  // noch einmal laden ersetzt (nicht addiert); falsche Kartengröße wird abgelehnt
  neu.lade(z);
  assert.deepEqual(b.welt.hoehe, a.welt.hoehe);
  assert.equal(neu.lade({ ...z, b: 64 }), null);
  assert.equal(neu.lade(null), null);
});

test('zuruecksetzen stellt die Ausgangswelt her; festschreiben macht den Stand zur Ausgangswelt', () => {
  const a = mitAdapter(), aend = createWeltAenderung(a), start = a.welt.hoehe.slice();
  aend.pinsel('heben', 0, 0, { radius: 5, staerke: 2 });
  aend.entferneObjekt(0);
  const ber = aend.zuruecksetzen();
  assert.ok(ber && ber.x1 >= ber.x0);
  assert.deepEqual(a.welt.hoehe, start);
  assert.equal(aend.istEntfernt(0), false);
  assert.equal(aend.kannRueckgaengig, false);
  assert.equal(aend.zuruecksetzen(), null);
  // Bauplatz einebnen und festschreiben → nicht im Spielstand, bleibt beim Zurücksetzen
  aend.pinsel('ebnen', 0, 0, { radius: 6, staerke: 1, ziel: 9, form: 'hart' });
  aend.entferneObjekt(0);
  aend.festschreiben();
  const platz = a.welt.hoehe.slice();
  assert.equal(aend.zustand().i.length, 0);
  assert.deepEqual(aend.zustand().weg, []);
  assert.equal(aend.istEntfernt(0), true);
  assert.deepEqual(aend.entfernte(), [0]);
  assert.equal(aend.stelleObjektHer(0), false);
  assert.equal(aend.delta(16 * 32 + 16), 0);
  aend.pinsel('senken', 0, 0, { radius: 3, staerke: 1 });
  aend.zuruecksetzen();
  assert.deepEqual(a.welt.hoehe, platz);
});

test('onAenderung meldet Bereich, zuWelt rechnet in Meter; rohe Welt ohne Adapter', () => {
  const a = mitAdapter(), aend = createWeltAenderung(a);
  const gemeldet = [];
  const ab = aend.onAenderung((e) => gemeldet.push(e));
  const ber = aend.pinsel('heben', 10, -6, { radius: 4 });
  assert.equal(gemeldet.length, 1);
  assert.equal(gemeldet[0].grund, 'pinsel');
  assert.equal(gemeldet[0].bereich, ber);
  const r = aend.zuWelt(ber);
  assert.ok(r.x0 <= 10 && r.x1 >= 10 && r.z0 <= -6 && r.z1 >= -6 && r.x1 - r.x0 <= 8.01);
  ab();
  aend.pinsel('heben', 10, -6, { radius: 4 });
  assert.equal(gemeldet.length, 1);
  // rohe Welt: Zellen und normierte Höhe
  const w = miniWelt(), roh = createWeltAenderung(w);
  roh.pinsel('heben', 16, 16, { radius: 2, staerke: 0.25, form: 'hart' });
  assert.ok(nah(w.hoehe[16 * 32 + 16], 0.35) && nah(w.hoehe[16 * 32 + 18], 0.35) && nah(w.hoehe[16 * 32 + 19], 0.1));
  assert.ok(nah(roh.delta(16 * 32 + 16), 0.25));
  assert.throws(() => createWeltAenderung({}));
  roh.dispose(); aend.dispose();
});

test('1.1: sperreUmkreis schützt Bauplätze; Pinsel an der Grenze erzeugt keinen leeren Rückgängig-Schritt', () => {
  const a = mitAdapter(), aend = createWeltAenderung(a, { maxAbweichung: 1 }), H = a.welt.hoehe;
  assert.ok(aend.sperreUmkreis(0, 0, 4) >= 9);
  assert.equal(aend.kannAendern(0, 0), false);
  assert.equal(aend.kannAendern(2, 2), false);
  assert.equal(aend.kannAendern(8, 0), true);
  aend.pinsel('senken', 0, 0, { radius: 10, staerke: 1 });
  assert.equal(H[16 * 32 + 16], Math.fround(0.1));        // Mitte unberührt
  assert.ok(H[16 * 32 + 19] < 0.1);                       // außerhalb der Zone gegraben
  aend.sperreUmkreis(0, 0, 4, false);
  assert.equal(aend.kannAendern(0, 0), true);
  assert.equal(aend.kannAendern(a.zuWelt(3, 10).x, a.zuWelt(3, 10).z), false);   // Fluss bleibt gesperrt
  // bis an die Grenze graben, dann weiter: keine neuen Schritte
  aend.zuruecksetzen();
  for (let k = 0; k < 4; k++) aend.pinsel('senken', 20, 20, { radius: 2, staerke: 1, form: 'hart' });
  const schritte = aend.anzahl.schritte;
  assert.equal(aend.pinsel('senken', 20, 20, { radius: 2, staerke: 1, form: 'hart' }), null);
  assert.equal(aend.anzahl.schritte, schritte);
  assert.ok(schritte <= 2);
});
