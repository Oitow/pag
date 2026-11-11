/**
 * @modul    hud
 * @zweck    Spiel-Anzeige als DOM-Overlay: Hinweis-Zeile mit Fortschritt, Kurzmeldungen (zusammenzählbar), Lebens-/Ausdauer-Balken und Bereiche für Leisten
 * @api      createHud({eltern,unten,zIndex,maxMeldungen,farben}) -> { element, hinweis(text, anteil?), melde(text, {dauer, art, schluessel, anzahl}) -> meldung, balken(id, {wert, farbe, zeichen, text}|null), bereich(name) -> Element, update(dt), zeige(an), sichtbar, meldungen, dispose() }
 * @beispiel
 *   import { createHud } from '../../engine/ui/hud.js';
 *   const hud = createHud({ unten: 124 });
 *   hud.balken('leben', { wert: 0.8, zeichen: '❤', farbe: '#e0683c' });
 *   hud.hinweis('E – Aufheben');                       // jedes Bild aufrufen ist ok, '' blendet aus
 *   hud.melde('+{n} 🪵 Holz', { schluessel: 'holz', anzahl: 3 });
 *   hud.bereich('leiste').append(meineLeiste);         // Bereiche: leiste, ueberLeiste, obenLinks, obenRechts, mitte
 *   hud.update(dt);                                    // jedes Bild (lässt Meldungen altern)
 * @tags     ui, hud, hinweis, meldung, toast, balken, leben, leiste, overlay
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

const FARBEN = {
  flaeche: 'rgba(18,22,28,.82)', rand: 'rgba(255,255,255,.14)', text: '#eef1f4', dim: '#a6b0ba',
  akzent: '#ffd45a', gut: '#7bd66a', warnung: '#e0683c',
};
const SCHRIFT = 'system-ui,-apple-system,"Segoe UI",sans-serif';
const FADE = 0.4;
const klemme = (x) => (x > 1 ? 1 : x > 0 ? x : 0);

/**
 * opts: eltern (document.body), unten = 124 (px Abstand der unteren Spalte, Platz für Touch-Knöpfe), zIndex = 3,
 *   maxMeldungen = 4, farben = { flaeche, rand, text, dim, akzent, gut, warnung }
 */
export function createHud({ eltern = globalThis.document?.body, unten = 124, zIndex = 3, maxMeldungen = 4, farben = {} } = {}) {
  const f = { ...FARBEN, ...farben };
  const neu = (css, text) => {
    const e = document.createElement('div');
    e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  };
  const kachel = `background:${f.flaeche};border:1px solid ${f.rand};border-radius:10px;color:${f.text};font:600 14px/1.3 ${SCHRIFT};`;

  const wurzel = neu('position:fixed;inset:0;pointer-events:none;z-index:' + zIndex + ';');
  const spalte = neu(`position:fixed;left:50%;transform:translateX(-50%);bottom:max(${unten}px,calc(env(safe-area-inset-bottom) + ${unten}px));` +
    'display:flex;flex-direction:column;align-items:center;gap:6px;max-width:96vw;pointer-events:none;');
  const meldBox = neu('display:flex;flex-direction:column;align-items:center;gap:4px;');
  const hinweisBox = neu(kachel + 'padding:6px 12px;text-align:center;visibility:hidden;display:flex;flex-direction:column;gap:4px;min-width:40px;');
  const hinweisText = neu('', ' ');
  const hinweisBahn = neu('height:5px;border-radius:3px;background:rgba(255,255,255,.18);overflow:hidden;display:none;');
  const hinweisFuell = neu(`height:100%;width:0%;background:${f.akzent};`);
  hinweisBahn.append(hinweisFuell);
  hinweisBox.append(hinweisText, hinweisBahn);

  const bereiche = {};
  const mitSpalte = { ueberLeiste: 'display:flex;flex-direction:column;align-items:center;gap:4px;pointer-events:auto;max-width:96vw;', leiste: 'display:flex;align-items:center;gap:6px;pointer-events:auto;max-width:96vw;' };
  for (const n in mitSpalte) bereiche[n] = neu(mitSpalte[n]);
  spalte.append(meldBox, hinweisBox, bereiche.ueberLeiste, bereiche.leiste);
  wurzel.append(spalte);
  eltern?.append(wurzel);

  const frei = {
    obenLinks: 'top:calc(env(safe-area-inset-top) + 8px);left:8px;display:flex;flex-direction:column;gap:4px;align-items:flex-start;',
    obenRechts: 'top:calc(env(safe-area-inset-top) + 8px);right:8px;display:flex;flex-direction:column;gap:4px;align-items:flex-end;',
    mitte: 'top:50%;left:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;',
  };
  /** Benannter Bereich (wird beim ersten Aufruf angelegt, danach dasselbe Element). */
  function bereich(name) {
    if (!bereiche[name]) {
      bereiche[name] = neu('position:fixed;pointer-events:auto;' + (frei[name] ?? frei.mitte));
      wurzel.append(bereiche[name]);
    }
    return bereiche[name];
  }

  // --- Hinweis ---
  let hText = '', hProz = null, hAn = false;
  function hinweis(text, anteil = null) {
    const t = text == null ? '' : String(text);
    const an = t !== '';
    const prozent = an && anteil != null ? Math.round(klemme(anteil) * 100) : null;
    if (an && t !== hText) { hText = t; hinweisText.textContent = t; }
    if (prozent !== hProz) {
      hProz = prozent;
      hinweisBahn.style.display = prozent == null ? 'none' : 'block';
      if (prozent != null) hinweisFuell.style.width = prozent + '%';
    }
    if (an !== hAn) { hAn = an; hinweisBox.style.visibility = an ? 'visible' : 'hidden'; }
  }

  // --- Meldungen ---
  let liste = [];
  const artFarbe = (art) => (art === 'gut' ? f.gut : art === 'warnung' ? f.warnung : f.text);
  function setzeText(m) { m.text = m._basis.replace('{n}', m.anzahl ?? ''); m.element.textContent = m.text; }
  function melde(text, { dauer = 2.5, art = 'info', schluessel = null, anzahl = null } = {}) {
    if (schluessel != null) {
      const alt = liste.find(m => m._schluessel === schluessel);
      if (alt) {
        alt.anzahl = (alt.anzahl ?? 0) + (anzahl ?? 0);
        alt._basis = String(text); alt._dauer = dauer; alt.rest = dauer;
        setzeText(alt);
        if (alt._opa !== 1) { alt._opa = 1; alt.element.style.opacity = '1'; }
        return alt;
      }
    }
    const m = { text: '', anzahl, rest: dauer, element: neu(kachel + `padding:4px 12px;color:${artFarbe(art)};text-align:center;`), _basis: String(text), _schluessel: schluessel, _dauer: dauer, _opa: 1 };
    setzeText(m);
    meldBox.append(m.element);
    liste.push(m);
    while (liste.length > maxMeldungen) liste.shift().element.remove();
    return m;
  }

  // --- Balken ---
  const zeilen = new Map();
  function balken(id, opts) {
    let z = zeilen.get(id);
    if (opts == null) { if (z) { z.zeile.remove(); zeilen.delete(id); } return; }
    if (!z) {
      const zeile = neu(kachel + 'display:flex;align-items:center;gap:6px;padding:3px 8px;');
      const zeichen = neu(`color:${f.akzent};display:none;`);
      const bahn = neu('width:120px;height:8px;border-radius:4px;background:rgba(255,255,255,.18);overflow:hidden;');
      const fuelle = neu(`height:100%;width:0%;background:${f.gut};`);
      const txt = neu(`color:${f.dim};font-size:12px;display:none;`);
      bahn.append(fuelle);
      zeile.append(zeichen, bahn, txt);
      bereich('obenLinks').append(zeile);
      z = { zeile, zeichen, fuelle, txt, wert: null, farbe: null, zch: null, t: null };
      zeilen.set(id, z);
    }
    const { wert, farbe, zeichen, text } = opts;
    if (wert != null) {
      const p = Math.round(klemme(wert) * 100);
      if (p !== z.wert) { z.wert = p; z.fuelle.style.width = p + '%'; }
    }
    const fa = farbe ?? f.gut;
    if (fa !== z.farbe) { z.farbe = fa; z.fuelle.style.background = fa; }
    const zc = zeichen ?? '';
    if (zc !== z.zch) { z.zch = zc; z.zeichen.textContent = zc; z.zeichen.style.display = zc ? 'block' : 'none'; }
    const tx = text ?? '';
    if (tx !== z.t) { z.t = tx; z.txt.textContent = tx; z.txt.style.display = tx ? 'block' : 'none'; }
  }

  function update(dt) {
    if (!liste.length) return;
    for (const m of liste) {
      m.rest -= dt;
      if (m.rest > 0) {
        const o = m.rest < FADE ? Math.round((m.rest / FADE) * 20) / 20 : 1;
        if (o !== m._opa) { m._opa = o; m.element.style.opacity = String(o); }
      }
    }
    for (const m of liste) if (m.rest <= 0) m.element.remove();
    liste = liste.filter(m => m.rest > 0);
  }

  let an = true;
  function zeige(a = true) { an = !!a; wurzel.style.display = an ? '' : 'none'; }

  function dispose() {
    wurzel.remove();
    liste = []; zeilen.clear();
    for (const k in bereiche) delete bereiche[k];
  }

  return {
    element: wurzel, hinweis, melde, balken, bereich, update, zeige, dispose,
    get sichtbar() { return an; },
    get meldungen() { return liste.length; },
  };
}
