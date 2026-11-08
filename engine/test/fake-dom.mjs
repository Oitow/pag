/**
 * @modul    fake-dom
 * @zweck    Minimale Browser-Attrappe für Node-Tests: document, window, localStorage, requestAnimationFrame
 * @api      installFakeDom(opts) -> { els, rafs, storage, tick(dt) } ; fakeElement() -> Element-Attrappe
 * @beispiel
 *   import { installFakeDom } from '../test/fake-dom.mjs';
 *   const dom = installFakeDom({ breite: 400, hoehe: 800 });
 *   dom.tick(16); // führt alle angefragten Animation-Frames aus
 * @tags     test, dom, node, attrappe
 * @version  1.0.0
 * @status   stabil
 * @three    nein
 */

/** Element-Attrappe: merkt sich Listener, Style und Kinder. */
export function fakeElement(tag = 'div') {
  const listener = {};
  const kinder = [];
  return {
    tagName: tag.toUpperCase(), style: {}, dataset: {}, children: kinder, textContent: '', innerHTML: '', value: '',
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, an) { (an ?? !this._s.has(c)) ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    appendChild(k) { kinder.push(k); return k; }, prepend(k) { kinder.unshift(k); }, remove() {},
    setAttribute() {}, getAttribute() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener(t, f) { (listener[t] ??= []).push(f); }, removeEventListener() {},
    dispatch(t, ev = {}) { (listener[t] || []).forEach(f => f(ev)); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 800 }; },
    getContext() { return null; }, setPointerCapture() {}, releasePointerCapture() {}, focus() {}, blur() {},
    _listener: listener,
  };
}

/** Installiert die Attrappe global. Gibt Steuerobjekt zurück. */
export function installFakeDom({ breite = 400, hoehe = 800, pixelRatio = 2, storage = {} } = {}) {
  const els = {};
  const rafs = [];
  let zeit = 0;
  const body = fakeElement('body');
  globalThis.window = globalThis;
  globalThis.innerWidth = breite; globalThis.innerHeight = hoehe; globalThis.devicePixelRatio = pixelRatio;
  const winListener = {};
  globalThis.addEventListener = (t, f) => { (winListener[t] ??= []).push(f); };
  globalThis.removeEventListener = () => {};
  globalThis.document = {
    body, documentElement: fakeElement('html'), visibilityState: 'visible',
    getElementById: id => (els[id] ??= fakeElement()), createElement: t => fakeElement(t),
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
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
    els, rafs, storage, winListener,
    /** Führt alle wartenden Frames mit +dt ms aus. */
    tick(dt = 16) { zeit += dt; const f = rafs.splice(0); f.forEach(cb => cb(zeit)); },
  };
}
