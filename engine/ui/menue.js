/**
 * @modul    menue
 * @zweck    Menü/Fenster als DOM-Overlay mit Seiten (Pause, Optionen, Spielstände, Truhe, Werkbank …): Knöpfe, Schalter, Regler, Auswahl, eigene Elemente; Escape/Rand-Tipp, fingerfreundlich, alle Stile inline
 * @api      createMenue({eltern,zIndex,breite,randSchliesst,taste,onAuf,onZu,farben}) -> {element, offen, aktuell, seite(name,{titel,eintraege|()=>[],zurueck,schliessbar}), zeige(name='start'), schliesse(), schalte(name), zurueck(), aktualisiere(), dispose()} ; spielstandEintraege(speicher,{slots,holeDaten,onLade,beschreibe,namen}) -> () => Einträge
 * @beispiel
 *   import { createMenue, spielstandEintraege } from '../../engine/ui/menue.js';
 *   const m = createMenue({ onAuf: () => pausiere(true), onZu: () => pausiere(false) });
 *   m.seite('start', { titel: 'Pause', schliessbar: true, eintraege: [
 *     { text: 'Weiter', schliesst: true },
 *     { text: 'Optionen', nach: 'optionen' },
 *     { text: 'Spielstände', nach: 'staende' } ] });
 *   m.seite('optionen', { titel: 'Optionen', zurueck: 'start', eintraege: [
 *     { art: 'regler', text: 'Lautstärke', wert: () => vol, setze: v => vol = v, format: v => Math.round(v * 100) + ' %' } ] });
 *   m.seite('staende', { titel: 'Spielstände', zurueck: 'start',
 *     eintraege: spielstandEintraege(speicher, { holeDaten: () => stand(), onLade: d => lade(d) }) });
 *   // Escape öffnet/zurück/schließt; m.schalte() per Knopf
 * @tags     ui, menue, pause, optionen, fenster, overlay, dialog, spielstand, dom, handy
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Einträge einer Seite (art fehlt → knopf): knopf{text,zeichen,hinweis,aktiv,aktion,nach,schliesst} | schalter{text,wert,setze} | regler{text,min,max,schritt,wert,setze,format} | auswahl{text,optionen,wert,setze} | text | trenner | element | reihe{eintraege}
 */

const FARBEN = {
  flaeche: 'rgba(18,22,28,.92)', rand: '1px solid rgba(255,255,255,.14)', text: '#eef1f4',
  gedimmt: '#a6b0ba', akzent: '#ffd45a', knopf: 'rgba(255,255,255,.08)',
};
const SCHRIFT = 'system-ui,-apple-system,"Segoe UI",sans-serif';
const BLOCK_EREIGNISSE = ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'touchstart', 'click'];

const wert = (x) => (typeof x === 'function' ? x() : x);

function el(tag, css, text) {
  const e = document.createElement(tag);
  e.style.cssText = css;
  if (text != null) e.textContent = text;
  return e;
}

export function createMenue(opts = {}) {
  const { eltern = document.body, zIndex = 20, breite = 'min(92vw, 380px)', randSchliesst = true,
    taste = 'Escape', onAuf = null, onZu = null } = opts;
  const F = { ...FARBEN, ...(opts.farben || {}) };
  const seiten = new Map();
  let offen = false, aktuell = null;

  const overlay = el('div', `position:fixed;top:0;right:0;bottom:0;left:0;z-index:${zIndex};display:none;` +
    `align-items:center;justify-content:center;background:rgba(0,0,0,.55);font-family:${SCHRIFT};` +
    'touch-action:pan-y;');
  overlay.style.display = 'none';
  const tafel = el('div', `box-sizing:border-box;width:${breite};max-height:86vh;overflow-y:auto;` +
    `touch-action:pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:12px;` +
    `border-radius:14px;background:${F.flaeche};border:${F.rand};color:${F.text};font-size:16px;` +
    'line-height:1.3;display:flex;flex-direction:column;gap:8px;');
  overlay.appendChild(tafel);
  eltern.appendChild(overlay);

  // Eingaben dürfen nicht ins Spiel durchdringen (kein preventDefault: Regler und Scrollen sollen gehen).
  // Rand-Tipp: 'click' auf dem Overlay selbst (nicht pointerdown, damit Scrollen nichts schließt).
  const sperre = (e) => e.stopPropagation();
  const randTipp = (e) => { e.stopPropagation(); if (randSchliesst && e.target === overlay) schliesse(); };
  for (const t of BLOCK_EREIGNISSE) overlay.addEventListener(t, t === 'click' ? randTipp : sperre);

  const knopfCss = (extra = '') => 'box-sizing:border-box;min-width:0;min-height:44px;margin:0;padding:8px 12px;' +
    `font:inherit;color:${F.text};background:${F.knopf};border:${F.rand};border-radius:10px;` +
    `cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px;` +
    `width:100%;text-align:left;-webkit-appearance:none;appearance:none;touch-action:manipulation;${extra}`;

  function knopf(e, inReihe) {
    const b = el('button', knopfCss(inReihe ? 'flex:1 1 0;justify-content:center;text-align:center;width:auto;' : ''));
    b.type = 'button';
    const aktiv = () => e.aktiv === undefined || !!wert(e.aktiv);
    const links = el('span', 'min-width:0;display:flex;flex-direction:column;', null);
    links.appendChild(el('span', 'font:inherit;', (e.zeichen ? e.zeichen + ' ' : '') + (e.text ?? '')));
    if (e.hinweis) links.appendChild(el('span', `font-size:12px;color:${F.gedimmt};`, e.hinweis));
    b.appendChild(links);
    if (!aktiv()) { b.disabled = true; b.style.cssText += 'opacity:.45;cursor:default;'; }
    b.addEventListener('click', () => {
      if (!aktiv()) return;
      if (e.aktion) e.aktion();
      if (e.schliesst) schliesse();
      else if (e.nach) zeige(e.nach);
      else aktualisiere();
    });
    return b;
  }

  function schalter(e) {
    let an = !!wert(e.wert);
    const b = el('button', knopfCss());
    b.type = 'button';
    const anzeige = el('span', `font-weight:700;color:${F.akzent};`);
    const zeichne = () => { anzeige.textContent = an ? 'An' : 'Aus'; anzeige.style.color = an ? F.akzent : F.gedimmt; };
    b.append(el('span', 'font:inherit;', e.text), anzeige);
    zeichne();
    b.addEventListener('click', () => {
      const neu = !an;
      e.setze(neu);
      an = typeof e.wert === 'function' ? !!e.wert() : neu;
      zeichne();
    });
    return b;
  }

  function regler(e) {
    const { min = 0, max = 1, schritt = 0.1 } = e;
    const fmt = (z) => (e.format ? e.format(z) : String(z));
    const box = el('div', `box-sizing:border-box;padding:6px 12px;background:${F.knopf};border:${F.rand};border-radius:10px;`);
    const kopf = el('div', 'display:flex;justify-content:space-between;gap:10px;');
    const anzeige = el('span', `font-weight:700;color:${F.akzent};`, fmt(Number(wert(e.wert))));
    kopf.append(el('span', 'font:inherit;', e.text), anzeige);
    const r = el('input', 'box-sizing:border-box;display:block;width:100%;min-width:0;min-height:32px;margin:4px 0 0;' +
      `padding:0;font:inherit;color:${F.text};background:transparent;accent-color:${F.akzent};touch-action:pan-y;`);
    r.type = 'range'; r.min = String(min); r.max = String(max); r.step = String(schritt);
    r.value = String(wert(e.wert));
    r.addEventListener('input', () => {
      const z = Number(r.value);
      e.setze(z);
      anzeige.textContent = fmt(z);
    });
    box.append(kopf, r);
    return box;
  }

  function auswahl(e) {
    const opt = e.optionen.map((o) => (o !== null && typeof o === 'object' ? o : { wert: o, text: String(o) }));
    let i = Math.max(0, opt.findIndex((o) => o.wert === wert(e.wert)));
    const b = el('button', knopfCss());
    b.type = 'button';
    const anzeige = el('span', `font-weight:700;color:${F.akzent};`);
    const zeichne = () => { anzeige.textContent = opt[i] ? opt[i].text : ''; };
    b.append(el('span', 'font:inherit;', e.text), anzeige);
    zeichne();
    b.addEventListener('click', () => {
      if (!opt.length) return;
      i = (i + 1) % opt.length;
      e.setze(opt[i].wert);
      if (typeof e.wert === 'function') i = Math.max(0, opt.findIndex((o) => o.wert === e.wert()));
      zeichne();
    });
    return b;
  }

  function baueEintrag(e, inReihe = false) {
    switch (e.art || 'knopf') {
      case 'schalter': return schalter(e);
      case 'regler': return regler(e);
      case 'auswahl': return auswahl(e);
      case 'text': return el('div', `color:${F.gedimmt};font-size:14px;padding:2px 4px;`, e.text);
      case 'trenner': return el('div', 'height:1px;margin:2px 0;background:rgba(255,255,255,.14);');
      case 'element': return e.element;
      case 'reihe': {
        const r = el('div', 'display:flex;gap:8px;');
        for (const k of e.eintraege || []) r.appendChild(baueEintrag(k, true));
        return r;
      }
      default: return knopf(e, inReihe);
    }
  }

  function baue(name) {
    const s = seiten.get(name);
    const oben = tafel.scrollTop;
    tafel.replaceChildren();
    if (s.titel || s.zurueck || s.schliessbar) {
      const kopf = el('div', 'display:flex;align-items:center;gap:8px;');
      const knoepfchen = (zeichen, f) => {
        const b = el('button', knopfCss('width:44px;flex:none;justify-content:center;padding:0;'), zeichen);
        b.type = 'button';
        b.addEventListener('click', f);
        return b;
      };
      if (s.zurueck) kopf.appendChild(knoepfchen('←', zurueck));
      kopf.appendChild(el('div', `flex:1;min-width:0;font-size:20px;font-weight:700;color:${F.akzent};`, s.titel));
      if (s.schliessbar) kopf.appendChild(knoepfchen('✕', schliesse));
      tafel.appendChild(kopf);
    }
    for (const e of wert(s.eintraege) || []) tafel.appendChild(baueEintrag(e));
    if (typeof oben === 'number') tafel.scrollTop = oben;
  }

  function seite(name, def = {}) {
    seiten.set(name, { titel: '', eintraege: [], zurueck: null, schliessbar: true, ...def });
    if (offen && aktuell === name) baue(name);
  }
  function zeige(name = 'start') {
    if (!seiten.has(name)) return;
    if (name !== aktuell) tafel.scrollTop = 0;
    aktuell = name;
    baue(name);
    if (!offen) { offen = true; overlay.style.display = 'flex'; if (onAuf) onAuf(); }
  }
  function schliesse() {
    if (!offen) return;
    offen = false; aktuell = null;
    overlay.style.display = 'none';
    tafel.replaceChildren();
    if (onZu) onZu();
  }
  const schalte = (name = 'start') => (offen ? schliesse() : zeige(name));
  function zurueck() {
    const z = offen && seiten.get(aktuell)?.zurueck;
    if (z && seiten.has(z)) zeige(z); else schliesse();
  }
  function aktualisiere() { if (offen && aktuell != null) baue(aktuell); }

  const bei = (e) => { if (e.key === taste || e.code === taste) { if (offen) zurueck(); else zeige('start'); } };
  if (taste != null) document.addEventListener('keydown', bei);

  function dispose() {
    if (taste != null) document.removeEventListener('keydown', bei);
    offen = false; aktuell = null;
    overlay.remove();
  }

  return {
    element: overlay,
    get offen() { return offen; },
    get aktuell() { return aktuell; },
    seite, zeige, schliesse, schalte, zurueck, aktualisiere, dispose,
  };
}

/** Einträge für eine Spielstand-Seite: je Slot eine Textzeile und die Knöpfe Speichern/Laden/Löschen. */
export function spielstandEintraege(speicher, o = {}) {
  const { slots = ['1', '2', '3'], holeDaten, onLade, namen = (s) => 'Platz ' + s } = o;
  const beschreibe = o.beschreibe || ((d, info) => (info && info.zeit ? new Date(info.zeit).toLocaleString('de-DE') : 'belegt'));
  return () => {
    const liste = [];
    const infos = speicher.slots();
    for (const slot of slots) {
      const da = speicher.hat(slot);
      const info = infos.find((i) => i.slot === slot);
      liste.push({ art: 'text', text: namen(slot) + ' – ' + (da ? beschreibe(speicher.lade(slot), info) : 'leer') });
      liste.push({ art: 'reihe', eintraege: [
        { text: 'Speichern', aktion: () => speicher.speichere(slot, holeDaten()) },
        { text: 'Laden', aktiv: da, schliesst: true, aktion: () => onLade(speicher.lade(slot), slot) },
        { text: 'Löschen', aktiv: da, aktion: () => speicher.loesche(slot) },
      ] });
    }
    return liste;
  };
}
