/**
 * @modul    inventar-ansicht
 * @zweck    Zeigt ein Inventar als Reihe/Raster von Plätzen (Schnellleiste, Rucksack, Truhe): Zeichen, Anzahl, Haltbarkeits-Strich, gewählter Platz, Tippen und Gedrückt-halten
 * @api      createInventarAnsicht({inventar,register,eltern,von,bis,spalten,groesse,breite,gewaehlt,titel,onTipp,onLang,langMs,zeichen,farben}) -> {element,felder,zeichne(),update(dt),dispose()}
 * @beispiel
 *   import { createInventarAnsicht } from '../../engine/ui/inventar-ansicht.js';
 *   const leiste = createInventarAnsicht({ inventar: inv, register: items, eltern: document.body, bis: 8,
 *     gewaehlt: () => hand.platz, onTipp: (platz) => hand.waehle(platz) });
 *   // jedes Bild: leiste.update(dt);   // dt in Sekunden; nötig für onLang und für den Wechsel des gewählten Platzes
 * @tags     ui, inventar, schnellleiste, hotbar, rucksack, truhe, raster, hud, touch
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

const FARBEN = {
  flaeche: 'rgba(18,22,28,.82)', rand: 'rgba(255,255,255,.14)', text: '#eef1f4',
  akzent: '#ffd45a', gut: '#7bd66a', warnung: '#e0683c',
};

/**
 * opts: inventar (Pflicht), register (hole(id) -> {name,zeichen,haltbarkeit}), eltern (dort anhängen),
 *   von = 0, bis = Ende, spalten = bis − von (kleiner → Umbruch), groesse = 44 (px, Obergrenze), breite = '94vw',
 *   gewaehlt() -> Platz-Index oder −1, titel, onTipp(platz, inhalt, ereignis), onLang(platz, inhalt), langMs = 450,
 *   zeichen(id, eintrag) -> Text, farben = { flaeche, rand, text, akzent, gut, warnung }
 */
export function createInventarAnsicht({
  inventar, register = null, eltern = null, von = 0, bis = inventar.plaetze.length, spalten = 0, groesse = 44,
  breite = '94vw', gewaehlt = null, titel = null, onTipp = null, onLang = null, langMs = 450, zeichen = null, farben = {},
} = {}) {
  const f = { ...FARBEN, ...farben };
  const n = Math.max(0, bis - von);
  const sp = Math.max(1, Math.min(n || 1, spalten > 0 ? spalten : n));
  const el = document.createElement('div');
  el.style.cssText = `display:grid;grid-template-columns:repeat(${sp},var(--b));gap:4px;pointer-events:auto;`
    + `--b:min(${groesse}px,calc((${breite} - ${(sp - 1) * 4}px) / ${sp}));box-sizing:border-box;width:max-content;`
    + `max-width:100%;font-family:system-ui,sans-serif;color:${f.text};touch-action:none;user-select:none;-webkit-user-select:none`;
  if (titel != null) {
    const t = document.createElement('div');
    t.textContent = titel;
    t.style.cssText = `grid-column:1/-1;font-size:12px;line-height:1.2;color:${f.text};opacity:.85`;
    el.append(t);
  }

  const standardZeichen = (id, e) => e?.zeichen ?? String(e?.name ?? id).slice(0, 2);
  const zeichenFn = zeichen ?? standardZeichen;
  const felder = [];
  const sigs = [];
  let druck = null; // { platz, t, fertig }

  const hoehe = (s) => {
    const e = s && register?.hole?.(s.id);
    return e?.haltbarkeit ? { e, rest: s.daten?.haltbarkeit ?? e.haltbarkeit } : null;
  };

  function baue(knopf, s, i, gew) {
    const e = s ? register?.hole?.(s.id) ?? null : null;
    knopf.style.borderColor = gew ? f.akzent : f.rand;
    knopf.title = s ? String(e?.name ?? s.id) : '';
    const kinder = [];
    if (s) {
      const z = document.createElement('span');
      z.textContent = String(zeichenFn(s.id, e));
      z.style.cssText = 'font-size:18px;line-height:1;pointer-events:none';
      kinder.push(z);
      if (s.anzahl > 1) {
        const a = document.createElement('span');
        a.textContent = String(s.anzahl);
        a.style.cssText = `position:absolute;right:3px;bottom:2px;font-size:10px;line-height:1;color:${f.text};pointer-events:none`;
        kinder.push(a);
      }
      const h = hoehe(s);
      if (h) {
        const anteil = Math.max(0, Math.min(1, h.rest / h.e.haltbarkeit));
        const strich = document.createElement('span');
        strich.style.cssText = `position:absolute;left:10%;bottom:2px;height:3px;border-radius:2px;pointer-events:none;`
          + `width:${anteil * 80}%;background:${anteil > 0.3 ? f.gut : f.warnung}`;
        kinder.push(strich);
      }
    }
    knopf.replaceChildren(...kinder);
  }

  function zeichne() {
    const g = gewaehlt ? gewaehlt() : -1;
    for (let k = 0; k < n; k++) {
      const i = von + k;
      const s = inventar.plaetze[i] ?? null;
      const gew = g === i;
      const h = hoehe(s);
      const sig = `${s?.id ?? ''}|${s?.anzahl ?? 0}|${h ? h.rest : ''}|${gew ? 1 : 0}`;
      if (sig === sigs[k]) continue;
      sigs[k] = sig;
      baue(felder[k], s, i, gew);
    }
  }

  const ende = (e, abbruch) => {
    if (!druck) return;
    const d = druck; druck = null;
    if (!d.fertig && !abbruch) onTipp?.(d.platz, inventar.plaetze[d.platz] ?? null, e);
  };

  for (let k = 0; k < n; k++) {
    const i = von + k;
    const b = document.createElement('button');
    b.type = 'button';
    b.style.cssText = `position:relative;width:var(--b);height:var(--b);min-width:0;min-height:0;padding:0;margin:0;`
      + `box-sizing:border-box;font:inherit;color:${f.text};background:${f.flaeche};border:1px solid ${f.rand};border-radius:8px;`
      + `display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:none;-webkit-tap-highlight-color:transparent`;
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      if (!onLang) { onTipp?.(i, inventar.plaetze[i] ?? null, e); return; }
      druck = { platz: i, t: 0, fertig: false };
    });
    b.addEventListener('pointerup', (e) => ende(e, false));
    b.addEventListener('pointercancel', (e) => ende(e, true));
    b.addEventListener('pointerleave', (e) => ende(e, false));
    felder.push(b);
    el.append(b);
  }

  const abmelden = inventar.onAenderung(() => zeichne());
  zeichne();
  eltern?.append(el);

  function update(dt) {
    zeichne();
    if (!druck || druck.fertig || !onLang) return;
    druck.t += dt * 1000;
    if (druck.t >= langMs) { druck.fertig = true; onLang(druck.platz, inventar.plaetze[druck.platz] ?? null); }
  }

  function dispose() {
    abmelden?.();
    el.remove();
    druck = null;
  }

  return { element: el, felder, zeichne, update, dispose };
}
