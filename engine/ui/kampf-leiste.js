/**
 * @modul    kampf-leiste
 * @zweck    MMO-Aktionsleiste als DOM-Overlay: Plätze mit Symbol/Taste, Abklingzeit, GCD, Ladungen, Ausgrauen, Wirkbalken, Ressourcenbalken
 * @api      createKampfLeiste({eltern,plaetze,onNutze,unten,zIndex}) -> { element, setPlaetze(liste), update(dt, leiste), blitz(name), dispose() }
 * @beispiel
 *   import { createKampfLeiste } from '../../engine/ui/kampf-leiste.js';
 *   const kl = createKampfLeiste({ plaetze: [{ name: 'feuerball', symbol: '🔥', taste: '1' }], onNutze: (n) => leiste.nutze(n, { ziel }) });
 *   kl.update(dt, leiste);   // jedes Bild; leiste wie aus createLeiste (abkling, ladungen, kann, gcdAnteil, wirkt, ressource)
 *   kl.blitz('feuerball');   // kurzes Aufblitzen (z. B. bei Ereignis 'fertig')
 * @tags     ui, overlay, kampf, mmo, hotbar, abklingzeit, gcd, wirkbalken, ressource, leiste, touch
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

const SCHRIFT = 'system-ui,-apple-system,"Segoe UI",sans-serif';
const RESSOURCEN = { mana: '#4a8fe8', wut: '#d8453a', energie: '#e6c93c' };
const BLITZ_ZEIT = 0.25;
const klemme = (x) => (x > 1 ? 1 : x > 0 ? x : 0);
const prozent = (x) => Math.round(klemme(x) * 100) + '%';

/**
 * opts: eltern (document.body), plaetze = [{ name, symbol, taste }], onNutze = (name) => {}, unten = 16 (px), zIndex = 3
 */
export function createKampfLeiste({ eltern = globalThis.document?.body, plaetze = [], onNutze = () => {}, unten = 16, zIndex = 3 } = {}) {
  const neu = (css, text) => {
    const e = document.createElement('div');
    e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  };
  const wurzel = neu(`position:fixed;left:50%;transform:translateX(-50%);bottom:max(${unten}px,calc(env(safe-area-inset-bottom) + ${unten}px));` +
    `z-index:${zIndex};display:flex;flex-direction:column;align-items:center;gap:4px;width:min(96vw,420px);pointer-events:none;font:600 12px/1.2 ${SCHRIFT};color:#eef1f4;`);
  const bahn = 'position:relative;overflow:hidden;border-radius:6px;background:rgba(18,22,28,.82);border:1px solid rgba(255,255,255,.14);';
  const wirkBox = neu(bahn + 'width:70%;height:18px;display:none;');
  const wirkFuell = neu('position:absolute;left:0;top:0;bottom:0;width:0%;background:#e8b44a;');
  const wirkText = neu('position:absolute;inset:0;text-align:center;line-height:18px;text-shadow:0 1px 2px #000;', '');
  wirkBox.append(wirkFuell, wirkText);
  const resBox = neu('display:flex;flex-direction:column;gap:2px;width:100%;');
  const reihe = neu('display:flex;justify-content:center;gap:4px;width:100%;pointer-events:auto;');
  wurzel.append(wirkBox, resBox, reihe);
  eltern?.append(wurzel);

  let slots = [];
  const resZeilen = {}; // name -> { zeile, fuell, text, cache }
  const maxAbkling = {}; // name -> größte gesehene Abklingzeit (für den Überzug)
  const dumm = (e) => e.preventDefault?.();

  function baue(liste) {
    for (const s of slots) s.el.remove();
    slots = [];
    for (const p of liste) {
      const el = neu(`position:relative;overflow:hidden;flex:0 1 52px;min-width:44px;height:52px;box-sizing:border-box;border-radius:8px;` +
        'background:rgba(18,22,28,.85);border:1px solid rgba(255,255,255,.25);cursor:pointer;touch-action:manipulation;user-select:none;-webkit-user-select:none;');
      const symbol = neu('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:24px;', p.symbol ?? '?');
      const taste = neu('position:absolute;left:3px;top:1px;font-size:10px;color:#cfd6dd;text-shadow:0 1px 2px #000;', p.taste ?? '');
      const gcd = neu('position:absolute;left:0;right:0;bottom:0;height:0%;background:rgba(255,255,255,.22);');
      const abkling = neu('position:absolute;left:0;right:0;bottom:0;height:0%;background:rgba(0,0,0,.65);');
      const zeit = neu('position:absolute;inset:0;display:none;align-items:center;justify-content:center;font-size:16px;text-shadow:0 1px 3px #000;', '');
      const ladung = neu('position:absolute;right:3px;bottom:1px;font-size:12px;color:#ffd45a;text-shadow:0 1px 2px #000;display:none;', '');
      const tint = neu('position:absolute;inset:0;background:transparent;');
      const blitz = neu('position:absolute;inset:0;background:#fff;opacity:0;');
      el.append(symbol, tint, gcd, abkling, zeit, ladung, taste, blitz);
      const slot = { name: p.name, el, gcd, abkling, zeit, ladung, tint, blitz, symbol, blitzRest: 0, cache: {} };
      el.addEventListener('pointerdown', (e) => { dumm(e); onNutze(slot.name); });
      el.addEventListener('click', () => { if (!el._pointer) onNutze(slot.name); });
      el.title = p.name ?? '';
      reihe.append(el);
      slots.push(slot);
    }
  }
  baue(plaetze);

  /** Setzt einen Stil nur bei Änderung (DOM möglichst wenig anfassen). */
  const setze = (s, el, key, wert) => { if (s.cache[key] !== wert) { s.cache[key] = wert; return true; } return false; };

  function ressourcen(leiste) {
    for (const n in RESSOURCEN) {
      const r = leiste?.ressource?.(n);
      let z = resZeilen[n];
      if (!r || !(r.max > 0)) { if (z) { z.zeile.style.display = 'none'; } continue; }
      if (!z) {
        const zeile = neu(bahn + 'height:10px;');
        const fuell = neu(`position:absolute;left:0;top:0;bottom:0;width:0%;background:${RESSOURCEN[n]};`);
        const text = neu('position:absolute;inset:0;text-align:center;font-size:9px;line-height:10px;text-shadow:0 1px 2px #000;', '');
        zeile.append(fuell, text);
        resBox.append(zeile);
        z = resZeilen[n] = { zeile, fuell, text, w: null };
      }
      z.zeile.style.display = 'block';
      const w = prozent(r.wert / r.max) + '|' + Math.floor(r.wert);
      if (z.w !== w) { z.w = w; z.fuell.style.width = prozent(r.wert / r.max); z.text.textContent = `${Math.floor(r.wert)} / ${Math.floor(r.max)}`; }
    }
  }

  return {
    element: wurzel,
    get plaetze() { return slots.map(s => s.name); },
    setPlaetze(liste) { baue(liste ?? []); },
    blitz(name) { for (const s of slots) if (s.name === name) s.blitzRest = BLITZ_ZEIT; },
    update(dt = 0, leiste = null) {
      for (const s of slots) {
        const rest = leiste?.abkling?.(s.name) ?? 0;
        if (rest > (maxAbkling[s.name] ?? 0) || rest <= 0) maxAbkling[s.name] = rest > 0 ? rest : 0;
        const anteil = rest > 0 ? rest / (maxAbkling[s.name] || rest) : 0;
        const h = prozent(anteil);
        if (setze(s, s.abkling, 'ab', h)) s.abkling.style.height = h;
        const zt = rest > 0 ? (rest >= 10 ? String(Math.ceil(rest)) : rest.toFixed(1)) : '';
        if (setze(s, s.zeit, 'zt', zt)) { s.zeit.textContent = zt; s.zeit.style.display = zt ? 'flex' : 'none'; }
        const g = prozent(leiste?.gcdAnteil ?? 0);
        if (setze(s, s.gcd, 'gcd', g)) s.gcd.style.height = g;
        const l = leiste?.ladungen?.(s.name);
        const lt = l != null && l > 1 ? String(l) : '';
        if (setze(s, s.ladung, 'l', lt)) { s.ladung.textContent = lt; s.ladung.style.display = lt ? 'block' : 'none'; }
        const k = leiste?.kann?.(s.name);
        const grund = k && !k.ok ? (k.grund ?? 'sonst') : '';
        if (setze(s, s.tint, 'k', grund)) {
          s.tint.style.background = grund === 'ressource' ? 'rgba(40,90,200,.45)' : grund === 'reichweite' ? 'rgba(200,40,40,.45)' : grund ? 'rgba(0,0,0,.35)' : 'transparent';
          s.symbol.style.opacity = grund ? '0.55' : '1';
        }
        if (s.blitzRest > 0) s.blitzRest = Math.max(0, s.blitzRest - dt);
        const o = String(Math.round((s.blitzRest / BLITZ_ZEIT) * 70) / 100);
        if (setze(s, s.blitz, 'bl', o)) s.blitz.style.opacity = o;
      }
      const w = leiste?.wirkt;
      if (w) {
        let a = klemme(w.anteil ?? 0);
        if (w.kanal) a = 1 - a; // Kanal läuft rückwärts
        wirkBox.style.display = 'block';
        wirkFuell.style.width = prozent(a);
        if (wirkText.textContent !== w.name) wirkText.textContent = w.name ?? '';
      } else if (wirkBox.style.display !== 'none') wirkBox.style.display = 'none';
      ressourcen(leiste);
    },
    dispose() { wurzel.remove(); slots = []; },
  };
}
