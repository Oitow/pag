/**
 * @modul    speicher
 * @zweck    Spielstände sicher speichern/laden (localStorage mit Arbeitsspeicher-Fallback), Versionen, Migration, Autospeichern, Export/Import als Text, TypedArrays
 * @api      createSpeicher({schluessel,version,migriere,storage,jetzt}) -> {speichere(slot,daten), lade(slot), hat(slot), loesche(slot), slots(), exportText(slot), importText(slot,text), auto(slot,holeDaten,sekunden), update(dt), jetztSpeichern(), fluechtig, dispose()} ; packe(typedArray) -> {$ta,b64} ; entpacke(obj) -> TypedArray
 * @beispiel
 *   import { createSpeicher } from '../../engine/core/speicher.js';
 *   const sp = createSpeicher({ schluessel: 'meinspiel', version: 2 });
 *   sp.speichere('slot1', { punkte: 12, karte: new Uint8Array(64) });
 *   const stand = sp.lade('slot1');          // null, wenn nichts da
 *   sp.auto('auto', () => ({ punkte }), 30); // dann pro Frame: sp.update(dt)
 * @tags     speichern, spielstand, localStorage, autosave, export, migration, persistenz
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

const TYPEN = {
  Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
  Int32Array, Uint32Array, Float32Array, Float64Array,
};

function bytesZuB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}
function b64ZuBytes(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

/** TypedArray → { $ta: 'Float32Array', b64 } (Little-Endian-Bytes). */
export function packe(ta) {
  const name = ta && ta.constructor && ta.constructor.name;
  if (!TYPEN[name]) throw new Error('packe: nicht unterstützter Typ ' + name);
  const bytes = new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength);
  return { $ta: name, b64: bytesZuB64(bytes) };
}

/** { $ta, b64 } → TypedArray. */
export function entpacke(obj) {
  const T = TYPEN[obj && obj.$ta];
  if (!T) throw new Error('entpacke: unbekannter Typ');
  const bytes = b64ZuBytes(obj.b64);
  return new T(bytes.buffer, 0, Math.floor(bytes.length / T.BYTES_PER_ELEMENT));
}

const ersetzer = (k, v) => (ArrayBuffer.isView(v) && !(v instanceof DataView) ? packe(v) : v);
const beleber = (k, v) =>
  v && typeof v === 'object' && typeof v.$ta === 'string' && typeof v.b64 === 'string' && TYPEN[v.$ta]
    ? entpacke(v) : v;

function textZuB64(text) {
  return bytesZuB64(new TextEncoder().encode(text));
}
function b64ZuText(b64) {
  return new TextDecoder().decode(b64ZuBytes(b64));
}

/** Ersatz-Storage im Arbeitsspeicher. */
function speicherImRam() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

export function createSpeicher(opts = {}) {
  const { schluessel = 'pag', version = 1, migriere = null, jetzt = Date.now } = opts;
  let storage = opts.storage;
  if (storage === undefined) {
    try { storage = globalThis.localStorage; } catch (e) { storage = null; }
  }
  let fluechtig = false;
  try {
    if (!storage) throw new Error('kein storage');
    const probe = `${schluessel}:#probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
  } catch (e) {
    storage = speicherImRam();
    fluechtig = true;
  }

  const key = (slot) => `${schluessel}:${slot}`;
  const VERZ = `${schluessel}:#slots`;

  function verzeichnis() {
    try {
      const l = JSON.parse(storage.getItem(VERZ));
      return Array.isArray(l) ? l : [];
    } catch (e) { return []; }
  }
  function verzeichnisSchreiben(liste) {
    try { storage.setItem(VERZ, JSON.stringify(liste)); return true; } catch (e) { return false; }
  }
  function leseRoh(slot) {
    try {
      const o = JSON.parse(storage.getItem(key(slot)));
      if (o && typeof o === 'object' && typeof o.v === 'number' && 'd' in o) return o;
    } catch (e) { /* kaputt */ }
    return null;
  }
  function schreibeRoh(slot, text) {
    try {
      storage.setItem(key(slot), text);
      const l = verzeichnis();
      if (!l.includes(slot)) { l.push(slot); verzeichnisSchreiben(l); }
      return true;
    } catch (e) { return false; }
  }

  function speichere(slot, daten) {
    try {
      const text = JSON.stringify({ v: version, t: jetzt(), d: daten }, ersetzer);
      if (typeof text !== 'string') return false;
      return schreibeRoh(slot, text);
    } catch (e) { return false; }
  }

  function lade(slot) {
    let text;
    try { text = storage.getItem(key(slot)); } catch (e) { return null; }
    if (text == null) return null;
    let o;
    try { o = JSON.parse(text, beleber); } catch (e) { return null; }
    if (!o || typeof o !== 'object' || typeof o.v !== 'number' || !('d' in o)) return null;
    if (o.v > version) return null;
    if (o.v < version && typeof migriere === 'function') {
      try { return migriere(o.d, o.v); } catch (e) { return null; }
    }
    return o.d;
  }

  function hat(slot) {
    return leseRoh(slot) !== null;
  }

  function loesche(slot) {
    try { storage.removeItem(key(slot)); } catch (e) { /* ignorieren */ }
    verzeichnisSchreiben(verzeichnis().filter((s) => s !== slot));
  }

  function slots() {
    const out = [];
    for (const slot of verzeichnis()) {
      const o = leseRoh(slot);
      if (o) out.push({ slot, zeit: o.t, version: o.v });
    }
    return out.sort((a, b) => b.zeit - a.zeit);
  }

  function exportText(slot) {
    try {
      const text = storage.getItem(key(slot));
      if (text == null || !leseRoh(slot)) return null;
      return textZuB64(text);
    } catch (e) { return null; }
  }

  function importText(slot, text) {
    try {
      const o = JSON.parse(b64ZuText(String(text).trim()), beleber);
      if (!o || typeof o !== 'object' || typeof o.v !== 'number' || typeof o.t !== 'number' || !('d' in o)) return false;
      return schreibeRoh(slot, JSON.stringify(o, ersetzer));
    } catch (e) { return false; }
  }

  // Autospeichern (über update(dt), kein Timer)
  let autoSlot = null;
  let holeDaten = null;
  let intervall = 30;
  let zaehler = 0;

  function auto(slot, hole, sekunden = 30) {
    if (slot == null || typeof hole !== 'function') {
      autoSlot = null; holeDaten = null; zaehler = 0;
      return;
    }
    autoSlot = slot; holeDaten = hole; intervall = sekunden; zaehler = 0;
  }

  function jetztSpeichern() {
    if (autoSlot == null) return false;
    zaehler = 0;
    try { return speichere(autoSlot, holeDaten()); } catch (e) { return false; }
  }

  function update(dt) {
    if (autoSlot == null) return;
    zaehler += dt;
    if (zaehler >= intervall) jetztSpeichern();
  }

  function dispose() {
    auto(null);
  }

  return {
    speichere, lade, hat, loesche, slots, exportText, importText,
    auto, update, jetztSpeichern, dispose,
    get fluechtig() { return fluechtig; },
  };
}
