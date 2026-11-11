import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../test/fake-dom.mjs';
import { createMenue, spielstandEintraege } from './menue.js';
import { createSpeicher } from '../core/speicher.js';

const alle = (e, out = []) => { out.push(e); e.children.forEach((k) => alle(k, out)); return out; };
const finde = (wurzel, text) => alle(wurzel).find((e) => e.textContent === text);
// Nächster Knopf/Eingabe-Vorfahr mit Klick-Hörer (Beschriftung steckt in Kind-Spans)
const knopfMit = (wurzel, text) => {
  const t = finde(wurzel, text);
  let e = t;
  while (e && e.tagName !== 'BUTTON') e = e.parentNode;
  return e;
};

function neu(o = {}) {
  const dom = installFakeDom();
  const log = { auf: 0, zu: 0 };
  const m = createMenue({ onAuf: () => log.auf++, onZu: () => log.zu++, ...o });
  return { dom, log, m };
}

test('anfangs zu, zeige/schliesse/schalte mit genau einem Callback je Übergang', () => {
  const { log, m } = neu();
  m.seite('start', { titel: 'Pause', eintraege: [] });
  assert.equal(m.offen, false);
  assert.equal(m.element.style.display, 'none');
  m.zeige(); m.zeige();
  assert.equal(m.offen, true); assert.equal(m.aktuell, 'start'); assert.equal(log.auf, 1);
  m.schliesse(); m.schliesse();
  assert.equal(m.offen, false); assert.equal(m.aktuell, null); assert.equal(log.zu, 1);
  m.schalte(); assert.equal(m.offen, true);
  m.schalte(); assert.equal(m.offen, false);
  assert.deepEqual(log, { auf: 2, zu: 2 });
});

test('Seite wird aufgebaut: Titel und Knopf-Texte; Aktion, inaktiv, nach, schliesst', () => {
  const { log, m } = neu();
  let n = 0, zaehler = 0;
  m.seite('start', { titel: 'Pause', eintraege: [
    { text: 'Los', aktion: () => n++ },
    { text: 'Tot', aktiv: false, aktion: () => n += 100 },
    { text: 'Optionen', nach: 'opt' },
    { text: 'Ende', schliesst: true },
  ] });
  m.seite('opt', { titel: 'Opt', zurueck: 'start', eintraege: [{ art: 'text', text: 'hallo' }] });
  m.zeige();
  assert.ok(finde(m.element, 'Pause'));
  knopfMit(m.element, 'Los').click(); assert.equal(n, 1);
  knopfMit(m.element, 'Tot').click(); assert.equal(n, 1);
  assert.equal(m.aktuell, 'start');
  knopfMit(m.element, 'Optionen').click();
  assert.equal(m.aktuell, 'opt'); assert.ok(finde(m.element, 'hallo')); assert.equal(log.auf, 1);
  m.zurueck(); assert.equal(m.aktuell, 'start');
  knopfMit(m.element, 'Ende').click(); assert.equal(m.offen, false);
  m.zurueck(); // zu: bleibt zu
  m.zeige('start'); m.zurueck(); assert.equal(m.offen, false); // ohne zurueck-Seite -> schließen
  assert.equal(zaehler, 0);
});

test('Schalter ruft setze(!wert) und zeigt den neuen Zustand', () => {
  const { m } = neu();
  let an = false;
  m.seite('start', { eintraege: [{ art: 'schalter', text: 'Ton', wert: () => an, setze: (v) => { an = v; } }] });
  m.zeige();
  assert.ok(finde(m.element, 'Aus'));
  knopfMit(m.element, 'Ton').click();
  assert.equal(an, true); assert.ok(finde(m.element, 'An'));
});

test('Regler: input ruft setze(Zahl) und format', () => {
  const { m } = neu();
  let v = 0.2;
  m.seite('start', { eintraege: [{ art: 'regler', text: 'Laut', wert: () => v, setze: (z) => { v = z; }, format: (z) => Math.round(z * 100) + ' %' }] });
  m.zeige();
  assert.ok(finde(m.element, '20 %'));
  const r = alle(m.element).find((e) => e.type === 'range');
  r.value = '0.5'; r.dispatch('input');
  assert.equal(v, 0.5); assert.ok(finde(m.element, '50 %'));
});

test('Auswahl wechselt reihum', () => {
  const { m } = neu();
  let q = 'a';
  m.seite('start', { eintraege: [{ art: 'auswahl', text: 'Q', optionen: [{ wert: 'a', text: 'Niedrig' }, 'Hoch'], wert: () => q, setze: (w) => { q = w; } }] });
  m.zeige();
  assert.ok(finde(m.element, 'Niedrig'));
  knopfMit(m.element, 'Q').click(); assert.equal(q, 'Hoch'); assert.ok(finde(m.element, 'Hoch'));
  knopfMit(m.element, 'Q').click(); assert.equal(q, 'a');
});

test('eintraege als Funktion wird bei aktualisiere neu ausgewertet; element hängt im Baum', () => {
  const { dom, m } = neu();
  let liste = [{ art: 'text', text: 'eins' }];
  const fremd = dom ? document.createElement('div') : null;
  m.seite('start', { eintraege: () => [...liste, { art: 'element', element: fremd }] });
  m.zeige();
  assert.ok(finde(m.element, 'eins')); assert.ok(m.element.contains(fremd));
  liste = [{ art: 'text', text: 'zwei' }];
  m.aktualisiere();
  assert.equal(finde(m.element, 'eins'), undefined); assert.ok(finde(m.element, 'zwei'));
});

test('Rand-Tipp (click mit target = Overlay) schließt; stopPropagation wird gerufen', () => {
  const { m } = neu();
  m.seite('start', { eintraege: [] });
  m.zeige();
  let n = 0;
  for (const t of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'touchstart']) {
    m.element.dispatch(t, { stopPropagation: () => n++ });
  }
  assert.equal(n, 5); assert.equal(m.offen, true);
  m.element.dispatch('click', { target: {}, stopPropagation: () => n++ });
  assert.equal(m.offen, true);
  m.element.dispatch('click', { stopPropagation: () => n++ });
  assert.equal(n, 7); assert.equal(m.offen, false);
});

test('randSchliesst:false lässt offen', () => {
  const { m } = neu({ randSchliesst: false });
  m.seite('start', {}); m.zeige(); m.element.dispatch('click');
  assert.equal(m.offen, true);
});

test('Escape öffnet, geht zurück, schließt; dispose meldet Hörer ab', () => {
  const { dom, m } = neu();
  m.seite('start', { eintraege: [] });
  m.seite('b', { zurueck: 'start' });
  const key = () => dom.docListener.keydown.forEach((f) => f({ key: 'Escape' }));
  key(); assert.equal(m.aktuell, 'start');
  m.zeige('b'); key(); assert.equal(m.aktuell, 'start');
  key(); assert.equal(m.offen, false);
  const parent = m.element.parentNode;
  m.dispose();
  assert.equal(dom.docListener.keydown.length, 0);
  assert.equal(m.element.parentNode, null);
  assert.equal(parent.children.includes(m.element), false);
});

test('taste:null registriert keinen Hörer', () => {
  const { dom } = neu({ taste: null });
  assert.equal((dom.docListener.keydown || []).length, 0);
});

test('spielstandEintraege: speichern, laden, löschen mit echtem Speicher', () => {
  const dom = installFakeDom();
  const sp = createSpeicher({ schluessel: 'mt', storage: globalThis.localStorage });
  let geladen = null, stand = { tag: 3 };
  const m = createMenue();
  m.seite('staende', { titel: 'Stände', eintraege: spielstandEintraege(sp, {
    holeDaten: () => stand, onLade: (d, s) => { geladen = [d, s]; }, beschreibe: (d) => 'Tag ' + d.tag,
  }) });
  m.zeige('staende');
  assert.ok(finde(m.element, 'Platz 1 – leer'));
  const laden = () => alle(m.element).filter((e) => e.tagName === 'BUTTON' && e.children[0]?.children[0]?.textContent === 'Laden');
  laden()[0].click(); assert.equal(geladen, null); // inaktiv
  alle(m.element).find((e) => e.tagName === 'BUTTON' && e.children[0]?.children[0]?.textContent === 'Speichern').click();
  assert.equal(sp.hat('1'), true);
  assert.ok(finde(m.element, 'Platz 1 – Tag 3'));
  laden()[0].click();
  assert.deepEqual(geladen, [{ tag: 3 }, '1']); assert.equal(m.offen, false);
  m.zeige('staende');
  alle(m.element).find((e) => e.tagName === 'BUTTON' && e.children[0]?.children[0]?.textContent === 'Löschen').click();
  assert.equal(sp.hat('1'), false); assert.ok(finde(m.element, 'Platz 1 – leer'));
  assert.ok(dom);
});
