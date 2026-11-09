import test from 'node:test';
import assert from 'node:assert/strict';
import { tageszeitZustand, createDayNight, formatUhrzeit, SCHLUESSEL } from './daynight.js';

const laenge = (v) => Math.hypot(v[0], v[1], v[2]);
const endlich = (z) => {
  for (const k of ['oben', 'horizont', 'nebel', 'licht', 'umgebungOben', 'umgebungUnten'])
    for (const c of z[k]) assert.ok(Number.isFinite(c) && c >= 0 && c <= 1, `${k} ${c}`);
  for (const k of ['lichtStaerke', 'umgebungStaerke', 'sterne', 'tag', 'sonnenScheibe']) assert.ok(Number.isFinite(z[k]) && z[k] >= 0, k);
};

test('Sonnenbahn: Aufgang Osten, Mittag oben, Untergang Westen, Mitternacht unten', () => {
  const auf = tageszeitZustand(6), mittag = tageszeitZustand(12), unter = tageszeitZustand(18), nacht = tageszeitZustand(0);
  assert.ok(Math.abs(auf.sonnenHoehe) < 1e-9 && auf.sonnenRichtung[0] > 0.99);
  assert.ok(unter.sonnenRichtung[0] < -0.99);
  assert.ok(mittag.sonnenHoehe > 0.8 && mittag.sonnenRichtung[2] > 0.5, 'Mittag hoch im Süden (+z)');
  assert.ok(nacht.sonnenHoehe < -0.8 && nacht.mondRichtung[1] > 0.8);
  for (const h of [0, 3.3, 7, 12, 19.9]) assert.ok(Math.abs(laenge(tageszeitZustand(h).sonnenRichtung) - 1) < 1e-9);
  // Drehung um y lässt die Höhe unverändert
  assert.ok(Math.abs(tageszeitZustand(9, { drehung: 1.2 }).sonnenHoehe - tageszeitZustand(9).sonnenHoehe) < 1e-12);
});

test('Farben und Licht: Tag hell, Nacht dunkel mit Sternen und Mondlicht', () => {
  for (let h = 0; h < 24; h += 0.25) endlich(tageszeitZustand(h));
  const tag = tageszeitZustand(12), nacht = tageszeitZustand(0), abend = tageszeitZustand(18.1);
  const hell = (c) => c[0] + c[1] + c[2];
  assert.ok(hell(tag.oben) > hell(nacht.oben) * 3);
  assert.ok(tag.lichtStaerke > 2 && tag.sterne === 0 && tag.tag === 1 && !tag.mondLicht);
  assert.ok(nacht.sterne === 1 && nacht.mondLicht && nacht.lichtRichtung === nacht.mondRichtung && nacht.tag === 0);
  assert.ok(abend.horizont[0] > abend.horizont[2], 'Abendrot am Horizont');
  // Vormittag und Nachmittag sind symmetrisch
  const a = tageszeitZustand(9), b = tageszeitZustand(15);
  assert.ok(Math.abs(a.lichtStaerke - b.lichtStaerke) < 1e-9 && Math.abs(a.nebel[1] - b.nebel[1]) < 1e-9);
  // kein Sprung in der Lichtstärke beim Wechsel Sonne → Mond
  let alt = tageszeitZustand(17).lichtStaerke;
  for (let h = 17; h < 20; h += 0.02) { const s = tageszeitZustand(h).lichtStaerke; assert.ok(Math.abs(s - alt) < 0.15, `Sprung bei ${h}`); alt = s; }
  assert.ok(SCHLUESSEL.every((s, i) => i === 0 || s.y > SCHLUESSEL[i - 1].y));
});

test('Bewölkung dämpft Sonne und Sterne', () => {
  const klar = tageszeitZustand(12), trueb = tageszeitZustand(12, { bewoelkung: 1 });
  endlich(trueb);
  assert.ok(trueb.lichtStaerke < klar.lichtStaerke * 0.4 && trueb.sonnenScheibe === 0);
  assert.equal(tageszeitZustand(0, { bewoelkung: 1 }).sterne, 0);
});

test('Steuerung: Zeit läuft, Pause, Ziele per Duck-Typing', () => {
  const farbe = () => ({ rgb: null, setRGB(r, g, b, cs) { this.rgb = [r, g, b, cs]; return this; } });
  const vec = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { Object.assign(this, { x, y, z }); } });
  const sonne = { color: farbe(), intensity: 0, position: vec(), target: { position: vec() } };
  const umgebung = { color: farbe(), groundColor: farbe(), intensity: 0 };
  const szene = { fog: { color: farbe() }, background: Object.assign(farbe(), { isColor: true }) };
  let himmel = null;
  const tn = createDayNight({ stunde: 23, geschwindigkeit: 1, sonne, umgebung, szene, himmel: { setzeZustand(z) { himmel = z; } }, lichtAbstand: 100 });
  tn.update(2, { x: 10, y: 5, z: -3 });
  assert.ok(Math.abs(tn.stunde - 1) < 1e-9, 'über Mitternacht');
  assert.ok(himmel && himmel === tn.zustand && sonne.color.rgb[3] === 'srgb');
  assert.ok(Math.abs(Math.hypot(sonne.position.x - 10, sonne.position.y - 5, sonne.position.z + 3) - 100) < 1e-6);
  assert.equal(sonne.target.position.x, 10);
  assert.ok(sonne.position.y > 5, 'nachts kommt das Licht vom Mond (oben)');
  tn.laeuft = false; tn.update(5); assert.ok(Math.abs(tn.stunde - 1) < 1e-9);
  tn.setStunde(-2); assert.equal(tn.stunde, 22);
  assert.ok(umgebung.intensity > 0 && szene.background.rgb && szene.fog.color.rgb);
  tn.dispose();
  assert.equal(formatUhrzeit(13.5), '13:30');
  assert.equal(formatUhrzeit(23.999), '00:00');
  assert.equal(formatUhrzeit(-1), '23:00');
});
