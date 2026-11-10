import test from 'node:test';
import assert from 'node:assert/strict';
import { himmelStand, sonnenRichtung } from './himmel-stand.js';

const laenge = (v) => Math.hypot(v[0], v[1], v[2]);
const alleFarbenOk = (s) => Object.values(s.farben).every(c => c.every(x => x >= 0 && x <= 1.0001 && Number.isFinite(x)));

test('Sonne: mittags hoch im Süden, morgens im Osten, nachts unter dem Horizont', () => {
  const mittag = sonnenRichtung(12, 0.25, 48), morgen = sonnenRichtung(7, 0.25, 48), nacht = sonnenRichtung(0, 0.25, 48);
  assert.ok(mittag[1] > 0.8 && mittag[2] > 0);          // +z = Süden
  assert.ok(morgen[0] > 0.5 && morgen[1] > 0);          // +x = Osten
  assert.ok(nacht[1] < 0);
  for (const v of [mittag, morgen, nacht]) assert.ok(Math.abs(laenge(v) - 1) < 1e-6);
});

test('Jahreszeit: Sommertage sind länger als Wintertage', () => {
  assert.ok(sonnenRichtung(5.5, 0.25, 48)[1] > 0);
  assert.ok(sonnenRichtung(7, 0.75, 48)[1] < 0);
  assert.ok(sonnenRichtung(12, 0.25, 48)[1] > sonnenRichtung(12, 0.75, 48)[1]);
});

test('Tag hell, Nacht dunkel mit Sternen; Farben bleiben gültig über 24 h', () => {
  const tag = himmelStand({ stunde: 12 }), nacht = himmelStand({ stunde: 0, tag: 15 });
  assert.ok(tag.lichtStaerke > 1.5 && tag.tag > 0.95 && tag.sterne === 0);
  assert.ok(nacht.lichtStaerke < 0.7 && nacht.tag < 0.05 && nacht.sterne > 0.9);
  assert.ok(nacht.umgebungStaerke < tag.umgebungStaerke * 0.65);
  for (let h = 0; h < 24; h += 0.25) {
    const s = himmelStand({ stunde: h, tag: 9, wetter: { wolken: h / 24, nebel: 0.3, blitz: h > 20 ? 1 : 0 } });
    assert.ok(alleFarbenOk(s), 'Farben bei ' + h);
    assert.ok(s.lichtStaerke >= 0 && s.lichtRichtung[1] > 0, 'Licht kommt von oben bei ' + h);
    assert.ok(s.sichtweite > 0 && s.sichtweite <= 1);
  }
});

test('Lichtstärke springt nicht beim Wechsel Sonne ↔ Mond', () => {
  let alt = himmelStand({ stunde: 15, tag: 15 }).lichtStaerke;
  for (let h = 15; h < 24; h += 0.02) {
    const s = himmelStand({ stunde: h, tag: 15 }).lichtStaerke;
    assert.ok(Math.abs(s - alt) < 0.08, `Sprung bei ${h}: ${alt} → ${s}`);
    alt = s;
  }
});

test('Mond: Vollmond steht der Sonne gegenüber und leuchtet, Neumond nicht', () => {
  const voll = himmelStand({ stunde: 0, tag: 1 + 14.75 }), neu = himmelStand({ stunde: 0, tag: 1 });
  assert.ok(voll.mondHell > 0.95 && voll.mondHoehe > 0.2);
  assert.ok(neu.mondHell < 0.05 && neu.mondHoehe < 0);
  assert.ok(voll.lichtStaerke > neu.lichtStaerke + 0.1);
});

test('Wetter: Wolken dämpfen die Sonne, Nebel senkt die Sichtweite, Blitz hellt auf', () => {
  const klar = himmelStand({ stunde: 12 }), trueb = himmelStand({ stunde: 12, wetter: { wolken: 1, regen: 0.8 } });
  assert.ok(trueb.lichtStaerke < klar.lichtStaerke * 0.4);
  assert.ok(trueb.farben.zenit[2] - trueb.farben.zenit[0] < klar.farben.zenit[2] - klar.farben.zenit[0]);
  assert.ok(himmelStand({ stunde: 12, wetter: { nebel: 1 } }).sichtweite < 0.25);
  assert.ok(himmelStand({ stunde: 1, wetter: { blitz: 1 } }).umgebungStaerke > himmelStand({ stunde: 1 }).umgebungStaerke + 1);
});

test('ziel wird wiederverwendet', () => {
  const z = himmelStand({ stunde: 3 });
  assert.equal(himmelStand({ stunde: 14 }, z), z);
  assert.ok(z.tag > 0.9);
});
