/**
 * @modul    chat
 * @zweck    Chat-Fenster fürs MMO: Kanäle (system, kampf, beute, sagen, aufgabe, welt) mit Farben und Reiter-Filter, eingeklappt 3 Zeilen halbtransparent, antippen = groß mit Eingabezeile; Befehle (/hilfe, /ort …) als Register; Ring-Puffer 80 Zeilen; Logik ohne DOM testbar
 * @api      createChatLogik({max,kanaele,name}) -> {zeile(kanal,text,{von,farbe}), zeilen(filter?,n?), filter, setzeFilter(k), befehl(name,fn,hilfe), befehle(), eingabe(text)->bool, onAenderung(fn)->abmelden, kanaele, anzahl} ; createChat({eltern,max,kanaele,name,unten,zIndex}) -> {...logik, element, sende(kanal,text,opts), gross(an), istGross, dispose()}
 * @beispiel
 *   import { createChat } from '../../engine/ui/chat.js';
 *   const chat = createChat({ eltern: render.ui, name: 'Alwe' });
 *   chat.befehl('tanz', () => 'Du tanzt.', 'Tanzen');
 *   chat.sende('kampf', 'Du triffst Ratte für 12.');
 *   chat.eingabe('/tanz');   // Befehl;  chat.eingabe('Hallo') → Kanal „sagen“
 * @tags     ui, chat, befehle, kanaele, mmo, dom, handy, protokoll
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

export const KANAELE = {
  system: { name: 'System', farbe: '#ffd45a' }, kampf: { name: 'Kampf', farbe: '#ff8f73' }, beute: { name: 'Beute', farbe: '#a8e070' },
  sagen: { name: 'Sagen', farbe: '#f2f4f6' }, aufgabe: { name: 'Aufgabe', farbe: '#7fd4ff' }, welt: { name: 'Welt', farbe: '#c9a8ff' },
};
const SCHRIFT = 'system-ui,-apple-system,"Segoe UI",sans-serif';

/** Reine Logik: Ring-Puffer, Filter, Befehls-Parsing. name = Absender für eigene Eingaben. */
export function createChatLogik({ max = 80, kanaele = KANAELE, name = 'Du' } = {}) {
  const puffer = [], reg = new Map(), hoerer = new Set();
  let filter = 'alle', nr = 0;
  const melde = () => { for (const f of [...hoerer]) f(); };
  function zeile(kanal, text, { von = null, farbe = null } = {}) {
    const k = kanaele[kanal] ? kanal : 'system';
    const z = { nr: ++nr, kanal: k, text: String(text ?? ''), von, farbe: farbe || kanaele[k].farbe };
    puffer.push(z);
    if (puffer.length > max) puffer.splice(0, puffer.length - max);
    melde();
    return z;
  }
  const L = {
    kanaele, zeile,
    get filter() { return filter; }, get anzahl() { return puffer.length; },
    setzeFilter(k) { const neu = k === 'alle' || kanaele[k] ? k : 'alle'; if (neu !== filter) { filter = neu; melde(); } },
    zeilen(f = filter, n = Infinity) { const l = f === 'alle' ? puffer : puffer.filter((z) => z.kanal === f); return n >= l.length ? l.slice() : l.slice(-n); },
    befehl(n, fn, hilfe = '') { reg.set(String(n).toLowerCase().replace(/^\//, ''), { fn, hilfe }); },
    befehle() { return [...reg].map(([n, b]) => ({ name: n, hilfe: b.hilfe })); },
    /** Eingabezeile: „/name arg …“ → Befehl (Rückgabetext erscheint im System-Kanal), sonst Kanal „sagen“. true = angenommen. */
    eingabe(text) {
      const t = String(text ?? '').trim();
      if (!t) return false;
      if (t[0] !== '/') { zeile('sagen', t, { von: name }); return true; }
      const [n, ...args] = t.slice(1).split(/\s+/);
      const b = reg.get(n.toLowerCase());
      if (!b) { zeile('system', `Unbekannter Befehl „/${n}“ – /hilfe zeigt alle.`); return false; }
      try { const r = b.fn(args, L); if (r) zeile('system', r); } catch (e) { zeile('system', `Fehler bei /${n}: ${e?.message || e}`); }
      return true;
    },
    onAenderung(fn) { hoerer.add(fn); return () => hoerer.delete(fn); },
  };
  L.befehl('hilfe', () => 'Befehle: ' + L.befehle().map((b) => '/' + b.name).join(' '), 'Alle Befehle');
  return L;
}

/** Chat als DOM-Fenster. opts: eltern, max = 80, name, unten = 206 (px über dem Rand, Platz für den Stick), zIndex = 5. */
export function createChat({ eltern = globalThis.document?.body, max = 80, kanaele = KANAELE, name = 'Du', unten = 206, zIndex = 5 } = {}) {
  const L = createChatLogik({ max, kanaele, name });
  const el = (css, text, tag = 'div') => { const e = document.createElement(tag); e.style.cssText = css; if (text != null) e.textContent = text; return e; };
  const wurzel = el(`position:fixed;left:8px;bottom:${unten}px;z-index:${zIndex};width:min(54vw,250px);box-sizing:border-box;padding:4px 6px;border-radius:10px;` +
    `background:rgba(10,14,18,.38);color:#f2f4f6;font:13px/1.3 ${SCHRIFT};pointer-events:auto;touch-action:manipulation;opacity:1;transition:opacity .4s;`);
  const tabs = el('display:none;gap:4px;margin-bottom:4px;flex-wrap:wrap;');
  const liste = el('display:flex;flex-direction:column;justify-content:flex-end;gap:1px;overflow:hidden;max-height:4.1em;word-break:break-word;');
  const zu = el('display:none;min-width:44px;min-height:44px;margin:0;padding:0;font:inherit;border:0;border-radius:8px;background:rgba(255,255,255,.12);color:#f2f4f6;', '✕', 'button');
  const eingabeZeile = el('display:none;gap:6px;margin-top:6px;');
  const feld = el(`flex:1;min-width:0;min-height:44px;box-sizing:border-box;padding:0 10px;font:16px ${SCHRIFT};color:#fff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:8px;`, null, 'input');
  feld.type = 'text'; feld.maxLength = 200; feld.placeholder = 'Sagen oder /hilfe'; feld.setAttribute?.('enterkeyhint', 'send'); feld.setAttribute?.('autocomplete', 'off');
  const sendKnopf = el('min-width:56px;min-height:44px;margin:0;padding:0 10px;font:inherit;font-weight:700;border:0;border-radius:8px;background:#e0b56a;color:#1a1408;', 'Senden', 'button');
  const kopf = el('display:none;justify-content:space-between;align-items:flex-start;gap:6px;');
  eingabeZeile.append(feld, sendKnopf);
  kopf.append(tabs, zu);
  wurzel.append(kopf, liste, eingabeZeile);
  eltern?.append(wurzel);

  let gross = false, schmutzig = true, zeitgeber = null, dimmer = null;
  const tabKnoepfe = {};
  for (const k of ['alle', ...Object.keys(kanaele)]) {
    const b = el('min-height:36px;margin:0;padding:0 9px;font:inherit;font-size:12px;border:1px solid rgba(255,255,255,.2);border-radius:8px;background:transparent;', k === 'alle' ? 'Alle' : kanaele[k].name, 'button');
    b.addEventListener('click', (e) => { e.stopPropagation(); L.setzeFilter(k); });
    tabKnoepfe[k] = b; tabs.append(b);
  }
  function zeichne() {
    schmutzig = false;
    const n = gross ? 60 : 3;
    liste.replaceChildren(...L.zeilen(gross ? L.filter : 'alle', n).map((z) => {
      const d = el(`color:${z.farbe};`);
      if (z.von) d.append(el('font-weight:700;', z.von + ': ', 'span'));
      d.append(document.createTextNode(z.text));
      return d;
    }));
    if (gross) liste.scrollTop = liste.scrollHeight;
    for (const k in tabKnoepfe) tabKnoepfe[k].style.background = k === L.filter ? 'rgba(224,181,106,.35)' : 'transparent';
  }
  const plane = () => { schmutzig = true; if (!zeitgeber) zeitgeber = setTimeout(() => { zeitgeber = null; if (schmutzig) zeichne(); }, 100); };
  const aufwecken = () => {
    wurzel.style.opacity = '1'; clearTimeout(dimmer);
    if (!gross) dimmer = setTimeout(() => { wurzel.style.opacity = '.45'; }, 9000);
  };
  const abmelden = L.onAenderung(() => { plane(); aufwecken(); });

  function setzeGross(an) {
    if (an === gross) return;
    gross = !!an;
    const s = wurzel.style;
    if (gross) { s.left = '8px'; s.right = '8px'; s.width = 'auto'; s.bottom = '8px'; s.background = 'rgba(10,14,18,.92)'; }
    else { s.left = '8px'; s.right = ''; s.width = 'min(54vw,250px)'; s.bottom = unten + 'px'; s.background = 'rgba(10,14,18,.38)'; feld.blur?.(); }
    kopf.style.display = tabs.style.display = gross ? 'flex' : 'none';
    zu.style.display = gross ? 'block' : 'none';
    eingabeZeile.style.display = gross ? 'flex' : 'none';
    liste.style.maxHeight = gross ? 'min(46vh,340px)' : '4.1em';
    liste.style.overflowY = gross ? 'auto' : 'hidden';
    aufwecken(); zeichne();
    if (gross) feld.focus?.();
  }
  const sende = () => { const t = feld.value; feld.value = ''; if (t.trim()) L.eingabe(t); };
  wurzel.addEventListener('click', () => setzeGross(true));
  zu.addEventListener('click', (e) => { e.stopPropagation(); setzeGross(false); });
  sendKnopf.addEventListener('click', (e) => { e.stopPropagation(); sende(); feld.focus?.(); });
  // Tasten im Eingabefeld dürfen die Spielsteuerung (WASD) nicht erreichen
  for (const t of ['keydown', 'keyup', 'keypress']) feld.addEventListener(t, (e) => {
    e.stopPropagation();
    if (t === 'keydown') { if (e.key === 'Enter') sende(); else if (e.key === 'Escape') setzeGross(false); }
  });
  for (const t of ['pointerdown', 'touchstart']) wurzel.addEventListener(t, (e) => e.stopPropagation());
  const taste = (e) => { if (e.key === 'Enter' && !gross) setzeGross(true); };
  document.addEventListener('keydown', taste);
  zeichne(); aufwecken();

  return Object.assign(L, {
    element: wurzel, get istGross() { return gross; }, gross: setzeGross,
    sende: (kanal, text, o) => L.zeile(kanal, text, o),
    dispose() { abmelden(); clearTimeout(zeitgeber); clearTimeout(dimmer); document.removeEventListener('keydown', taste); wurzel.remove(); },
  });
}
