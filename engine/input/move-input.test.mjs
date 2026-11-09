import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../test/fake-dom.mjs';
import { createMoveInput, stickZuWelt, zuAbsicht, tastenText, ERWEITERTE_AKTIONEN } from './move-input.js';
import { autoStickRadius } from './touch-stick.js';

// Ergänzungen zur Attrappe: echtes removeEventListener für window und Elemente
function aufbau(opts) {
  const dom = installFakeDom();
  globalThis.removeEventListener = (t, f) => { const l = dom.winListener[t]; if (l) { const i = l.indexOf(f); if (i >= 0) l.splice(i, 1); } };
  const body = document.body;
  body.removeEventListener = (t, f) => { const l = body._listener[t]; if (l) { const i = l.indexOf(f); if (i >= 0) l.splice(i, 1); } };
  const win = (t, ev = {}) => (dom.winListener[t] || []).forEach(f => f(ev));
  const taste = (code, an = true) => win(an ? 'keydown' : 'keyup', { code, target: body, preventDefault() {} });
  const ein = createMoveInput({ touch: true, ...opts });
  return { dom, body, win, taste, ein };
}
const zeiger = (body, typ, id, x, y, art = 'touch', button = 0) =>
  body.dispatch(typ, { pointerId: id, clientX: x, clientY: y, pointerType: art, button, preventDefault() {} });
const nah = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('WASD → Achsen, Diagonale normalisiert, Pfeile', () => {
  const { taste, ein } = aufbau();
  taste('KeyW'); let e = ein.lesen();
  assert.equal(e.x, 0); assert.equal(e.y, 1); assert.equal(e.aktiv, 'tastatur');
  taste('KeyD'); e = ein.lesen();
  assert.ok(nah(e.x, Math.SQRT1_2) && nah(e.y, Math.SQRT1_2), `${e.x},${e.y}`);
  taste('KeyW', false); taste('KeyD', false); taste('ArrowLeft'); taste('ArrowDown'); e = ein.lesen();
  assert.ok(e.x < 0 && e.y < 0 && nah(Math.hypot(e.x, e.y), 1));
  taste('KeyA'); e = ein.lesen();               // A + Pfeil links = immer noch 1
  assert.ok(nah(Math.hypot(e.x, e.y), 1));
  ein.dispose();
});

test('Blur lässt alles los, Eingabefeld blockiert', () => {
  const { win, taste, ein } = aufbau();
  taste('KeyW'); taste('Space');
  assert.equal(ein.lesen().springen, true);
  win('blur');
  const e = ein.lesen();
  assert.equal(e.y, 0); assert.equal(e.springen, false);
  win('keydown', { code: 'KeyW', target: { tagName: 'INPUT' }, preventDefault() {} });
  assert.equal(ein.lesen().y, 0);
  ein.dispose();
});

test('gedrueckt: Flanke nur einmal, eigene Aktion, Halten', () => {
  const { taste, ein } = aufbau({ aktionen: [{ name: 'angriff', tasten: ['KeyF'], knopf: '⚔' }] });
  taste('KeyF'); taste('Space');
  ein.lesen();
  assert.equal(ein.gedrueckt('angriff'), true);
  assert.equal(ein.gedrueckt('springen'), true);
  assert.equal(ein.gehalten('angriff'), true);
  taste('KeyF');                                 // Auto-Repeat zählt nicht
  ein.lesen();
  assert.equal(ein.gedrueckt('angriff'), false);
  assert.equal(ein.gehalten('angriff'), true);
  taste('KeyF', false); ein.lesen();
  assert.equal(ein.gehalten('angriff'), false);
  taste('KeyC'); taste('ShiftLeft'); const e = ein.lesen();
  assert.equal(e.ducken, true); assert.equal(e.sprint, true);
  ein.dispose();
});

test('setAktiv(false) → alles 0', () => {
  const { body, taste, ein } = aufbau();
  taste('KeyW'); taste('Space');
  ein.setAktiv(false);
  zeiger(body, 'pointerdown', 9, 300, 400, 'mouse'); zeiger(body, 'pointermove', 9, 340, 400, 'mouse');
  const e = ein.lesen();
  assert.deepEqual([e.x, e.y, e.springen, e.kameraX, e.zoom], [0, 0, false, 0, 0]);
  assert.equal(ein.gedrueckt('springen'), false);
  ein.setAktiv(true); taste('KeyD');
  assert.equal(ein.lesen().x, 1);
  ein.dispose();
});

test('Touch-Stick: Richtung, Länge ≤ 1, loslassen → 0', () => {
  const { body, ein } = aufbau();
  zeiger(body, 'pointerdown', 1, 100, 600);
  zeiger(body, 'pointermove', 1, 100, 560);       // 40 px nach oben = vorwärts
  let e = ein.lesen();
  assert.equal(e.aktiv, 'touch');
  assert.ok(e.y > 0.5 && nah(e.x, 0), `${e.x},${e.y}`);
  zeiger(body, 'pointermove', 1, 400, 600);       // weit nach rechts → begrenzt
  e = ein.lesen();
  assert.ok(e.x > 0.9 && Math.hypot(e.x, e.y) <= 1 + 1e-9, `${e.x},${e.y}`);
  zeiger(body, 'pointerup', 1, 400, 600);
  e = ein.lesen();
  assert.equal(e.x, 0); assert.equal(e.y, 0);
  ein.dispose();
});

test('Touch rechts = Kamera-Delta, zwei Finger = Pinch-Zoom; Maus ziehen + Rad', () => {
  const { body, ein } = aufbau();
  zeiger(body, 'pointerdown', 2, 300, 400);
  zeiger(body, 'pointermove', 2, 340, 380);
  let e = ein.lesen();
  assert.ok(e.kameraX > 0 && e.kameraY < 0, `${e.kameraX},${e.kameraY}`);
  assert.equal(ein.lesen().kameraX, 0);          // Delta wird verbraucht
  zeiger(body, 'pointerdown', 3, 300, 500);       // zweiter Finger: Abstand 120 (zu 340/380)
  zeiger(body, 'pointermove', 3, 300, 700);
  e = ein.lesen();
  assert.ok(e.zoom > 0, 'auseinander = näher');
  zeiger(body, 'pointerup', 2, 0, 0); zeiger(body, 'pointerup', 3, 0, 0);
  zeiger(body, 'pointerdown', 7, 100, 100, 'mouse', 2);
  zeiger(body, 'pointermove', 7, 80, 130, 'mouse');
  body.dispatch('wheel', { deltaY: 100, preventDefault() {} });
  e = ein.lesen();
  assert.ok(e.kameraX < 0 && e.kameraY > 0 && e.zoom < 0);
  ein.dispose();
});

test('invertY und Empfindlichkeit', () => {
  const { body, ein } = aufbau({ invertY: true, empfindlichkeit: 2 });
  zeiger(body, 'pointerdown', 7, 100, 100, 'mouse');
  zeiger(body, 'pointermove', 7, 110, 110, 'mouse');
  const e = ein.lesen();
  assert.ok(nah(e.kameraX, 0.1) && nah(e.kameraY, -0.1), `${e.kameraX},${e.kameraY}`);
  ein.dispose();
});

test('Gamepad: linker Stick, Totzone, Knopf-Flanke, rechter Stick', () => {
  const alt = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const pad = { connected: true, axes: [0.05, -1, 0.8, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
  const { ein } = aufbau();
  Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [pad] }, configurable: true, writable: true });
  try {
    pad.buttons[0].pressed = true;
    let e = ein.lesen(1 / 60);
    assert.equal(e.aktiv, 'gamepad');
    assert.ok(nah(e.y, 1, 1e-2) && Math.abs(e.x) < 0.06, `${e.x},${e.y}`);
    assert.ok(e.kameraX > 0 && e.springen);
    assert.equal(ein.gedrueckt('springen'), true);
    ein.lesen(1 / 60);
    assert.equal(ein.gedrueckt('springen'), false);
    pad.axes = [0.1, 0.1, 0, 0];
    e = ein.lesen(1 / 60);
    assert.equal(e.x, 0); assert.equal(e.y, 0);
  } finally {
    if (alt) Object.defineProperty(globalThis, 'navigator', alt); else delete globalThis.navigator;
    ein.dispose();
  }
});

test('Touch-Knopf: Springen gehalten + Flanke', () => {
  const { ein } = aufbau();
  // Knöpfe hängen in ui > reihe > button
  const ui = document.body.children.find(k => k.className === 'mi-ui');
  const reihe = ui.children[1];
  const sprung = reihe.children[0];
  sprung.dispatch('pointerdown', { pointerId: 5, preventDefault() {}, stopPropagation() {} });
  let e = ein.lesen();
  assert.equal(e.springen, true); assert.equal(ein.gedrueckt('springen'), true);
  sprung.dispatch('pointerup', { pointerId: 5 });
  e = ein.lesen();
  assert.equal(e.springen, false);
  ein.dispose();
});

test('stickZuWelt: Kamera-relativ', () => {
  let r = stickZuWelt(0, 1, 0);
  assert.ok(nah(r.x, 0) && nah(r.z, 1));
  r = stickZuWelt(0, 1, Math.PI / 2);             // Kamera blickt nach +X
  assert.ok(nah(r.x, 1) && nah(r.z, 0));
  r = stickZuWelt(1, 0, 0);                       // rechts bei Blick +Z = −X
  assert.ok(nah(r.x, -1) && nah(r.z, 0));
  r = stickZuWelt(0.6, 0.8, 1.234);
  assert.ok(nah(Math.hypot(r.x, r.z), 1));
});

test('dispose entfernt Listener', () => {
  const { dom, body, taste, ein } = aufbau();
  const vorher = (dom.winListener.keydown || []).length;
  assert.ok(vorher > 0 && body._listener.pointerdown.length > 0);
  ein.dispose();
  assert.equal((dom.winListener.keydown || []).length, 0);
  assert.equal((dom.winListener.blur || []).length, 0);
  for (const t of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) assert.equal(body._listener[t].length, 0, t);
  taste('KeyW');
  assert.equal(ein.lesen().y, 0);
});

test('Erweiterte Aktionen per Name, Flags in lesen() und zuAbsicht', () => {
  const { taste, ein } = aufbau({ aktionen: ['rollen', 'interagieren', { name: 'gleiten', knopf: '»' }, 'eigen'] });
  const namen = ein.aktionen.map(a => a.name);
  assert.ok(['rollen', 'interagieren', 'gleiten', 'eigen'].every(n => namen.includes(n)));
  assert.equal(ein.aktionen.find(a => a.name === 'gleiten').knopf, '»');
  assert.equal(ein.aktionen.find(a => a.name === 'gleiten').padKnopf, ERWEITERTE_AKTIONEN.gleiten.padKnopf);
  taste('KeyQ'); taste('KeyW');
  const e = ein.lesen();
  assert.equal(e.rollen, true); assert.equal(e.interagieren, false); assert.equal(e.eigen, false);
  assert.equal(ein.gedrueckt('rollen'), true);
  const a = zuAbsicht(e, 0);
  assert.ok(nah(a.z, 1) && nah(a.x, 0));
  assert.equal(a.rollen, true); assert.equal(a.springen, false);
  assert.equal(a.aktiv, undefined, 'nur boolesche Felder');
  ein.dispose();
});

test('Tastenbelegung: Daten-Objekt, setBelegung, lerneTaste, Pad', async () => {
  const { taste, ein } = aufbau({ belegung: { tasten: { vor: ['KeyZ'], springen: ['KeyJ'] }, pad: { springen: 3 } } });
  taste('KeyZ'); taste('KeyJ');
  let e = ein.lesen();
  assert.equal(e.y, 1); assert.equal(e.springen, true);
  taste('KeyZ', false); taste('KeyJ', false); taste('KeyW');
  assert.equal(ein.lesen().y, 0, 'W ist nicht mehr vorwärts');
  taste('KeyW', false);
  const b = ein.belegung;
  assert.deepEqual(b.tasten.vor, ['KeyZ']); assert.equal(b.pad.springen, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(b)), b);
  ein.setBelegung({ tasten: { links: ['KeyH'] } });
  taste('KeyH'); assert.equal(ein.lesen().x, -1); taste('KeyH', false);
  const p = ein.lerneTaste('ducken');
  taste('KeyK');
  assert.equal(await p, 'KeyK');
  assert.equal(ein.belegung.tasten.ducken[0], 'KeyK');
  taste('KeyK', false); taste('KeyK');
  assert.equal(ein.lesen().ducken, true);
  const p2 = ein.lerneTaste('vor');
  taste('Escape');
  assert.equal(await p2, null);
  assert.equal(await ein.lerneTaste('gibtsnicht'), null);
  ein.dispose();
});

test('tastenText, autoStickRadius, zeigeKnopf, Vibration', () => {
  assert.equal(tastenText('KeyW'), 'W'); assert.equal(tastenText('Space'), 'Leertaste'); assert.equal(tastenText('Digit3'), '3');
  assert.equal(autoStickRadius(360, 740), 46); assert.equal(autoStickRadius(1024, 768), 76);
  assert.ok(autoStickRadius(500, 900) > 46 && autoStickRadius(500, 900) < 76);
  const summen = [];
  const altNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [], vibrate: ms => summen.push(ms) }, configurable: true, writable: true });
  const { ein } = aufbau({ aktionen: ['rollen'], vibration: true });
  try {
    const ui = document.body.children.filter(k => k.className === 'mi-ui').at(-1);
    const reihe = ui.children[1];
    const rolleK = reihe.children.find(b => b.textContent === ERWEITERTE_AKTIONEN.rollen.knopf);
    rolleK.dispatch('pointerdown', { pointerId: 4, preventDefault() {}, stopPropagation() {} });
    assert.equal(ein.lesen().rollen, true);
    assert.equal(summen.length, 1);
    ein.zeigeKnopf('rollen', false);
    assert.equal(rolleK.style.display, 'none');
    assert.equal(ein.lesen().rollen, false, 'ausblenden lässt los');
  } finally {
    if (altNav) Object.defineProperty(globalThis, 'navigator', altNav); else delete globalThis.navigator;
    ein.dispose();
  }
});
