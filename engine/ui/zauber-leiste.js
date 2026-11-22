/**
 * @modul    zauber-leiste
 * @zweck    Handy-taugliche Zauber-Leiste als DOM-Overlay: große Knöpfe (≥ 44 px) mit Symbol, Taste, Abklingzeit-Schleier und Lade-Ring; Halten = Aufladen/Überladen, Loslassen = Wirken (Zeiger UND Tasten 1–8); Mana-Balken darüber
 * @api      createZauberLeiste({eltern,plaetze,onDruck,onLos,unten,groesse,tasten}) -> { element, update({mana,manaMax,abkling(name)->0…1,kann(name)->bool,ladung:{name,anteil,ueber}|null}), blitz(name), dispose() }
 * @beispiel
 *   import { createZauberLeiste } from '../../engine/ui/zauber-leiste.js';
 *   const leiste = createZauberLeiste({ eltern: render.ui, plaetze: [{ name: 'feuerball', symbol: '🔥', farbe: 0xff7a2a }],
 *     onDruck: (n) => zauber.wirke(n, { halten: true }), onLos: () => buch.lasseLos() });
 *   leiste.update({ mana: buch.mana, manaMax: buch.manaMax, abkling: (n) => buch.abklingAnteil(n), kann: (n) => buch.kann(n).ok, ladung: buch.ladung });
 * @tags     ui, overlay, zauber, leiste, hotbar, touch, handy, mana, aufladen, halten
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * plaetze: [{ name, symbol, farbe (Zahl), taste (Standard '1' … '8'), gross (Großzauber: goldener Rand) }].
 * Die Wurzel hat pointer-events:none, nur die Knöpfe fangen Zeiger. Tasten mit Wiederholung werden ignoriert.
 */
const SCHRIFT = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
const hex = (f) => '#' + (f >>> 0).toString(16).padStart(6, '0');

export function createZauberLeiste({ eltern = globalThis.document?.body, plaetze = [], onDruck = () => {}, onLos = () => {}, unten = 12, groesse = 46, tasten = true } = {}) {
  const doc = globalThis.document;
  if (!doc) return { element: null, update() {}, blitz() {}, dispose() {} };
  const wurzel = doc.createElement('div');
  wurzel.style.cssText = `position:absolute;left:50%;bottom:calc(${unten}px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:max-content;max-width:calc(100vw - 12px);` +
    `display:flex;flex-direction:column;align-items:center;gap:4px;pointer-events:none;font:700 11px/1 ${SCHRIFT};color:#eef1f4;user-select:none;-webkit-user-select:none`;
  const mana = doc.createElement('div');
  mana.style.cssText = 'position:relative;width:100%;max-width:260px;height:7px;border-radius:4px;background:rgba(10,14,20,.7);overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.15)';
  const manaFuell = doc.createElement('div');
  manaFuell.style.cssText = 'position:absolute;inset:0;transform-origin:left;background:linear-gradient(90deg,#3a6cff,#7ab8ff)';
  mana.appendChild(manaFuell);
  const reihe = doc.createElement('div');
  reihe.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:4px;max-width:calc(100vw - 12px);pointer-events:none';
  wurzel.append(mana, reihe);
  eltern?.appendChild(wurzel);

  const knoepfe = new Map();   // name → { el, schleier, ring, slot }
  const gedrueckt = new Set();
  const druck = (name) => { if (gedrueckt.has(name)) return; gedrueckt.add(name); onDruck(name); };
  const los = (name) => { if (!gedrueckt.delete(name)) return; onLos(name); };

  plaetze.forEach((slot, i) => {
    const el = doc.createElement('div');
    const g = Math.max(44, groesse), rand = slot.gross ? '#e8c060' : 'rgba(255,255,255,.28)';
    const breit = `clamp(44px,calc((100vw - 48px) / ${Math.max(1, plaetze.length)}),${g}px)`;
    el.style.cssText = `box-sizing:border-box;position:relative;width:${breit};height:${breit};flex:0 0 auto;border-radius:12px;display:flex;align-items:center;justify-content:center;` +
      `font-size:${Math.round(g * 0.5)}px;background:radial-gradient(circle at 50% 40%,${hex(slot.farbe ?? 0x888888)}55,rgba(16,20,26,.88) 70%);` +
      `border:2px solid ${rand};pointer-events:auto;touch-action:none;cursor:pointer;overflow:hidden;transition:transform .06s`;
    el.textContent = slot.symbol || '?';
    const schleier = doc.createElement('div');
    schleier.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:0;background:rgba(0,0,0,.6);pointer-events:none';
    const ring = doc.createElement('div');
    ring.style.cssText = `position:absolute;inset:0;border-radius:10px;pointer-events:none;opacity:0;box-shadow:inset 0 0 0 3px ${hex(slot.farbe ?? 0xffffff)}`;
    const taste = doc.createElement('span');
    taste.textContent = slot.taste ?? String(i + 1);
    taste.style.cssText = 'position:absolute;left:4px;top:3px;font-size:10px;opacity:.75;pointer-events:none;text-shadow:0 1px 2px #000';
    el.append(schleier, ring, taste);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); el.setPointerCapture?.(e.pointerId); druck(slot.name); });
    const loslassen = (e) => { e.preventDefault?.(); los(slot.name); };
    el.addEventListener('pointerup', loslassen);
    el.addEventListener('pointercancel', loslassen);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    reihe.appendChild(el);
    knoepfe.set(slot.name, { el, schleier, ring, slot, taste: slot.taste ?? String(i + 1), grau: null });
  });

  const nachTaste = (k) => { for (const k2 of knoepfe.values()) if (k2.taste === k) return k2.slot.name; return null; };
  const runter = (e) => { if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return; const n = nachTaste(e.key); if (n) { e.preventDefault(); druck(n); } };
  const hoch = (e) => { const n = nachTaste(e.key); if (n) los(n); };
  if (tasten) { globalThis.addEventListener?.('keydown', runter); globalThis.addEventListener?.('keyup', hoch); }

  let blitzRest = new Map();
  return {
    element: wurzel,
    update({ mana: m = 0, manaMax = 100, abkling = () => 0, kann = () => true, ladung = null } = {}) {
      manaFuell.style.transform = `scaleX(${Math.max(0, Math.min(1, m / Math.max(1, manaMax)))})`;
      for (const [name, k] of knoepfe) {
        const a = Math.max(0, Math.min(1, abkling(name) || 0));
        k.schleier.style.height = `${Math.round(a * 100)}%`;
        const grau = !kann(name) && !(ladung && ladung.name === name);
        if (grau !== k.grau) { k.grau = grau; k.el.style.filter = grau ? 'grayscale(.7) brightness(.7)' : ''; }
        const l = ladung && ladung.name === name ? ladung : null;
        k.ring.style.opacity = l ? String(0.35 + 0.65 * (l.anteil ?? 0)) : '0';
        k.el.style.transform = l ? `scale(${1 + 0.08 * (l.anteil ?? 0) + 0.06 * (l.ueber ?? 0)})` : (blitzRest.get(name) > 0 ? 'scale(1.12)' : '');
        if (l && l.ueber > 0.98) k.ring.style.boxShadow = `inset 0 0 0 3px #fff, 0 0 12px ${hex(k.slot.farbe ?? 0xffffff)}`;
        else k.ring.style.boxShadow = `inset 0 0 0 3px ${hex(k.slot.farbe ?? 0xffffff)}`;
        if (blitzRest.get(name) > 0) blitzRest.set(name, blitzRest.get(name) - 1);
      }
    },
    blitz(name) { blitzRest.set(name, 8); },
    dispose() {
      if (tasten) { globalThis.removeEventListener?.('keydown', runter); globalThis.removeEventListener?.('keyup', hoch); }
      wurzel.remove(); knoepfe.clear(); blitzRest = new Map();
    },
  };
}
