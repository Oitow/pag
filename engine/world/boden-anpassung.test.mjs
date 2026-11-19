import test from 'node:test';
import assert from 'node:assert/strict';
import { createBodenAnpassung } from './boden-anpassung.js';

// Testobjekt: eine "Wurzel" als Balken entlang +x im Objekt-Raum (Höhe 2 m, 1.5 m breit, 3..12 m vom Fuß)
const wurzel = (lx, lz) => (lx > 3 && lx < 12 && Math.abs(lz) < 0.75 ? 2 : NaN);
const hang = (x, z) => -0.15 * x;                      // Boden fällt nach +x ab

test('Boden hebt sich an die Wurzel, kein Luftspalt, Fuß steckt im Boden', () => {
  const b = createBodenAnpassung({ grundHoehe: hang });
  const r = b.fuegeFussabdruck({ x: 0, z: 0, hoeheBei: wurzel, radius: 14 });
  assert.ok(r && Math.abs(r.y - (hang(0, 0) - 0.3)) < 1e-9);
  for (let lx = 3.5; lx < 11.5; lx += 0.5) {
    const h = b.hoehe(lx, 0);
    assert.ok(h > r.y + 0.05, `Spalt unter der Wurzel bei x=${lx}`);       // Wurzel-Unterkante (= y) liegt unter dem Boden
    assert.ok(h < r.y + 2, `Wurzel ganz begraben bei x=${lx}`);           // Oberkante schaut heraus
  }
  // weich: kein Sprung zwischen Nachbarpunkten, auch quer zur Wurzel
  for (let z = -8; z < 8; z += 0.25) assert.ok(Math.abs(b.hoehe(8, z + 0.25) - b.hoehe(8, z)) < 0.25, `Kante bei z=${z}`);
  // weit weg: unverändert
  assert.equal(b.hoehe(40, 30), hang(40, 30));
  assert.ok(b.hoehe(-6, 0) >= hang(-6, 0));
});

test('Drehung und Skala wie THREE (rotation.y)', () => {
  const b = createBodenAnpassung({ grundHoehe: () => 0 });
  const r = b.fuegeFussabdruck({ x: 5, z: 5, y: 0, drehung: Math.PI / 2, skala: 2, hoeheBei: wurzel, radius: 30, einsinken: 0 });
  // lokal +x → Welt −z bei Drehung 90°; Skala 2 → Wurzel bei 6..24 m
  assert.ok(b.hoehe(5, 5 - 15) > 0.5, 'Wulst an der gedrehten Wurzel');
  assert.ok(b.hoehe(5 + 15, 5) < 0.05, 'kein Wulst auf der falschen Seite');
  assert.equal(r.y, 0);
});

test('Verdeckung: dunkel neben der Wurzel, 0 im Freien', () => {
  const b = createBodenAnpassung({ grundHoehe: () => 0 });
  b.fuegeFussabdruck({ x: 0, z: 0, y: 0, hoeheBei: wurzel, radius: 14 });
  const nah = b.verdeckung(7, 1.4), fern = b.verdeckung(7, 6), aussen = b.verdeckung(80, 80);
  assert.ok(nah > 0.2 && nah <= 1, `nah ${nah}`);
  assert.ok(fern < nah);
  assert.equal(aussen, 0);
});

test('Mehrere Fußabdrücke, leere Höhenkarte, dispose', () => {
  const b = createBodenAnpassung({ grundHoehe: () => 1 });
  assert.equal(b.fuegeFussabdruck({ x: 0, z: 0, hoeheBei: () => NaN, radius: 5 }), null);
  b.fuegeFussabdruck({ x: 0, z: 0, hoeheBei: wurzel, radius: 14 });
  b.fuegeFussabdruck({ x: 100, z: 0, hoeheBei: wurzel, radius: 14 });
  assert.equal(b.fussabdruecke.length, 2);
  assert.ok(b.hoehe(107, 0) > 1.2 && b.hoehe(7, 0) > 1.2);
  assert.throws(() => b.fuegeFussabdruck({ x: 0, z: 0, radius: 3 }));
  b.dispose();
  assert.equal(b.hoehe(7, 0), 1);
});
