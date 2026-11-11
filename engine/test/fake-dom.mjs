/**
 * @modul    fake-dom
 * @zweck    Minimale Browser-Attrappe für Node-Tests: document, window, localStorage, requestAnimationFrame
 * @api      installFakeDom(opts) -> { els, rafs, storage, winListener, docListener, tick(dt) } ; fakeElement(tag) -> Element-Attrappe { children, parentNode, style, appendChild, append, prepend, insertBefore, removeChild, replaceChildren, remove, contains, addEventListener, removeEventListener, dispatch(typ, ereignis), click() }
 * @beispiel
 *   import { installFakeDom } from '../test/fake-dom.mjs';
 *   const dom = installFakeDom({ breite: 400, hoehe: 800 });
 *   dom.tick(16); // führt alle angefragten Animation-Frames aus
 * @tags     test, dom, node, attrappe
 * @version  1.1.0
 * @status   stabil
 * @three    nein
 */

/** Element-Attrappe: merkt sich Listener, Style, Kinder und Eltern (ab 1.1: append/remove/replaceChildren wirken wirklich). */
export function fakeElement(tag = 'div') {
  const listener = {};
  const kinder = [];
  const lose = (k) => { const e = k?.parentNode; if (!e) return; const i = e.children.indexOf(k); if (i >= 0) e.children.splice(i, 1); k.parentNode = null; };
  const el = {
    tagName: tag.toUpperCase(), style: {}, dataset: {}, children: kinder, parentNode: null, textContent: '', innerHTML: '', value: '',
    className: '', title: '', hidden: false, disabled: false, checked: false, type: '',
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, an) { (an ?? !this._s.has(c)) ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    appendChild(k) { lose(k); kinder.push(k); k.parentNode = el; return k; },
    append(...ks) { for (const k of ks) el.appendChild(k); },
    prepend(k) { lose(k); kinder.unshift(k); k.parentNode = el; },
    insertBefore(k, vor) { lose(k); const i = vor ? kinder.indexOf(vor) : -1; if (i < 0) kinder.push(k); else kinder.splice(i, 0, k); k.parentNode = el; return k; },
    removeChild(k) { if (k.parentNode === el) lose(k); return k; },
    replaceChildren(...ks) { for (const k of kinder.splice(0)) k.parentNode = null; el.append(...ks); },
    remove() { lose(el); },
    contains(k) { for (let e = k; e; e = e.parentNode) if (e === el) return true; return false; },
    setAttribute(n, w) { (el._attribute ??= {})[n] = String(w); }, getAttribute(n) { return el._attribute?.[n] ?? null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener(t, f) { (listener[t] ??= []).push(f); },
    removeEventListener(t, f) { const l = listener[t]; if (!l) return; const i = l.indexOf(f); if (i >= 0) l.splice(i, 1); },
    /** Hörer auslösen; das Ereignis bekommt target/currentTarget und leere preventDefault/stopPropagation, falls sie fehlen. */
    dispatch(t, ev = {}) {
      ev.type ??= t; ev.target ??= el; ev.currentTarget = el; ev.preventDefault ??= () => {}; ev.stopPropagation ??= () => {};
      [...(listener[t] || [])].forEach(f => f(ev));
      return ev;
    },
    click() { el.dispatch('click'); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 800 }; },
    getContext() { return null; }, setPointerCapture() {}, releasePointerCapture() {}, focus() {}, blur() {},
    _listener: listener,
  };
  return el;
}

/** Installiert die Attrappe global. Gibt Steuerobjekt zurück. */
export function installFakeDom({ breite = 400, hoehe = 800, pixelRatio = 2, storage = {} } = {}) {
  const els = {};
  const rafs = [];
  let zeit = 0;
  const body = fakeElement('body');
  globalThis.window = globalThis;
  globalThis.innerWidth = breite; globalThis.innerHeight = hoehe; globalThis.devicePixelRatio = pixelRatio;
  const winListener = {}, docListener = {};
  globalThis.addEventListener = (t, f) => { (winListener[t] ??= []).push(f); };
  globalThis.removeEventListener = (t, f) => { const l = winListener[t]; if (!l) return; const i = l.indexOf(f); if (i >= 0) l.splice(i, 1); };
  globalThis.document = {
    body, documentElement: fakeElement('html'), visibilityState: 'visible',
    getElementById: id => (els[id] ??= fakeElement()), createElement: t => fakeElement(t),
    head: fakeElement('head'), querySelector: () => null, querySelectorAll: () => [],
    addEventListener(t, f) { (docListener[t] ??= []).push(f); },
    removeEventListener(t, f) { const l = docListener[t]; if (!l) return; const i = l.indexOf(f); if (i >= 0) l.splice(i, 1); },
  };
  globalThis.localStorage = {
    getItem: k => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); },
    removeItem: k => { delete storage[k]; }, clear: () => { for (const k in storage) delete storage[k]; },
  };
  globalThis.requestAnimationFrame = f => rafs.push(f);
  globalThis.cancelAnimationFrame = () => {};
  globalThis.performance ??= { now: () => zeit };
  if (!globalThis.navigator) globalThis.navigator = { getGamepads: () => [] };
  return {
    els, rafs, storage, winListener, docListener,
    /** Führt alle wartenden Frames mit +dt ms aus. */
    tick(dt = 16) { zeit += dt; const f = rafs.splice(0); f.forEach(cb => cb(zeit)); },
  };
}
