/**
 * @modul    touch-stick
 * @zweck    Touch-Steuerung fürs Handy: dynamischer virtueller Joystick (linke Hälfte), Kamera-Wischen + Pinch-Zoom (rechte Hälfte), runde Aktionsknöpfe unten rechts
 * @api      createTouchStick(opts) -> { stick {x, y, an}, sprint, nimmKamera() -> {dx, dy, zoom}, benutzt, zeigen(bool), reset(), dispose() } ; istTouchGeraet() -> bool
 * @beispiel
 *   import { createTouchStick } from '../../engine/input/touch-stick.js';
 *   const t = createTouchStick({ element: canvas, knoepfe: [{ name: 'springen', knopf: '⤒' }],
 *     beiKnopf: (name, unten) => console.log(name, unten), beiErstemTouch: () => t.zeigen(true) });
 *   const { dx, dy, zoom } = t.nimmKamera();   // Pixel bzw. ln(Abstandsverhältnis) seit dem letzten Aufruf
 * @tags     eingabe, touch, joystick, handy, knoepfe, pinch, zoom
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

const CSS = `
.mi-ui{position:fixed;inset:0;pointer-events:none;z-index:40;display:none;user-select:none;-webkit-user-select:none;
  -webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;touch-action:none;font-family:system-ui,sans-serif}
.mi-ui.mi-sichtbar{display:block}
.mi-stick{position:absolute;border-radius:50%;transform:translate(-50%,-50%);opacity:.38;transition:opacity .15s;
  background:radial-gradient(circle,rgba(255,255,255,.06) 0 55%,rgba(255,255,255,.16) 56% 100%);
  border:2px solid rgba(255,255,255,.55);box-shadow:0 2px 14px rgba(0,0,0,.25),inset 0 0 18px rgba(0,0,0,.18)}
.mi-stick.mi-an{opacity:.95;transition:none}
.mi-stick.mi-sprint{border-color:rgba(255,214,90,.95);box-shadow:0 0 18px rgba(255,200,60,.55)}
.mi-knauf{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;
  background:radial-gradient(circle at 35% 30%,#fff,rgba(225,232,245,.92) 55%,rgba(170,182,205,.9));
  box-shadow:0 3px 10px rgba(0,0,0,.35)}
.mi-knopf{position:absolute;pointer-events:auto;touch-action:none;border-radius:50%;padding:0;margin:0;
  display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;line-height:1;
  background:radial-gradient(circle at 40% 30%,rgba(255,255,255,.32),rgba(30,38,55,.42));
  border:2px solid rgba(255,255,255,.6);box-shadow:0 3px 12px rgba(0,0,0,.3);text-shadow:0 1px 3px rgba(0,0,0,.5);
  -webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);transition:transform .08s,background .08s;outline:none}
.mi-knopf.mi-gross{font-size:34px}
.mi-knopf.mi-an{transform:scale(.9);background:radial-gradient(circle at 40% 30%,rgba(255,255,255,.6),rgba(80,120,200,.6))}
`;

/** Grobe Erkennung von Touch-Geräten (Handy/Tablet). */
export function istTouchGeraet() {
  try {
    if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) return true;
  } catch (_) { /* egal */ }
  return typeof window !== 'undefined' && ('ontouchstart' in window || (globalThis.navigator?.maxTouchPoints || 0) > 0);
}

// Kreisbogen-Plätze (Grad, 0 = rechts, 90 = oben) um den Sprungknopf, nach Anzahl der weiteren Knöpfe
const stil = { n: 0, el: null };
const BOGEN = [[], [168], [178, 112], [186, 138, 90], [190, 150, 110, 72]];

export function createTouchStick({
  element = document.body, stickRadius = 56, knoepfe = [], beiKnopf = () => {}, beiErstemTouch = () => {},
  totzone = 0.12, sprintZeit = 0.3, sichtbar = false,
} = {}) {
  const el = (tag, cls, txt) => { const e = document.createElement(tag); e.className = cls; if (txt != null) e.textContent = txt; return e; };
  // Ein gemeinsames <style> für alle Instanzen (Referenzzähler), beim letzten dispose entfernt
  if (stil.n++ === 0) { stil.el = el('style', ''); stil.el.textContent = CSS; (document.head || document.body).appendChild(stil.el); }

  const ui = el('div', 'mi-ui');
  const basis = el('div', 'mi-stick'); const knauf = el('div', 'mi-knauf'); basis.appendChild(knauf);
  const durchm = (stickRadius + 26) * 2;
  basis.style.width = basis.style.height = durchm + 'px';
  ui.appendChild(basis);

  const stick = { x: 0, y: 0, an: false };
  const kam = { dx: 0, dy: 0, zoom: 0 };
  let stickId = null, sx = 0, sy = 0, vollSeit = -1;
  const kamZeiger = new Map();      // pointerId → {x, y}
  let pinch = 0;
  let benutzt = false, weg = false;
  const jetzt = () => performance.now() / 1000;

  function ruhe() {                 // Geister-Stick unten links
    basis.classList.remove('mi-an', 'mi-sprint');
    basis.style.left = `calc(${durchm / 2 + 22}px + env(safe-area-inset-left, 0px))`;
    basis.style.top = `calc(100% - ${durchm / 2 + 26}px - env(safe-area-inset-bottom, 0px))`;
    knauf.style.transform = '';
  }
  ruhe();

  // ---------- Knöpfe ----------
  const reihe = el('div', '');
  reihe.style.cssText = 'position:absolute;right:calc(18px + env(safe-area-inset-right, 0px));bottom:calc(22px + env(safe-area-inset-bottom, 0px));width:0;height:0';
  ui.appendChild(reihe);
  const knopfEls = [];
  const plaetze = BOGEN[Math.min(knoepfe.length - 1, 4)] || [];
  knoepfe.forEach((k, i) => {
    const gross = i === 0;
    const b = el('button', 'mi-knopf' + (gross ? ' mi-gross' : ''), k.knopf);
    b.type = 'button';
    b.setAttribute('aria-label', k.titel || k.name);
    const g = gross ? 78 : 60;
    // Sprungknopf in der Ecke, weitere auf Bögen (r = 100, ab dem 5. weiter außen)
    let rc = 39, bc = 39;           // Mittelpunkt: Abstand von rechter/unterer Kante
    if (!gross) {
      const a = (plaetze[i - 1] ?? (200 - (i - 5) * 36)) * Math.PI / 180, r = i <= 4 ? 100 : 172;
      rc = 39 - Math.cos(a) * r; bc = 39 + Math.sin(a) * r;
    }
    Object.assign(b.style, { width: g + 'px', height: g + 'px', right: (rc - g / 2) + 'px', bottom: (bc - g / 2) + 'px' });
    let zeiger = null;
    const runter = e => {
      e.preventDefault?.(); e.stopPropagation?.();
      try { b.setPointerCapture(e.pointerId); } catch (_) { /* egal */ }
      if (zeiger !== null) return;
      zeiger = e.pointerId; b.classList.add('mi-an'); beiKnopf(k.name, true);
    };
    const hoch = e => {
      if (zeiger === null || (e && e.pointerId !== undefined && e.pointerId !== zeiger)) return;
      zeiger = null; b.classList.remove('mi-an'); beiKnopf(k.name, false);
    };
    const sperre = e => { e.preventDefault?.(); e.stopPropagation?.(); };
    const paare = [['pointerdown', runter], ['pointerup', hoch], ['pointercancel', hoch], ['lostpointercapture', hoch], ['contextmenu', sperre], ['click', sperre]];
    for (const [t, f] of paare) b.addEventListener(t, f);
    knopfEls.push({ b, paare, hoch: () => hoch() });
    reihe.appendChild(b);
  });
  document.body.appendChild(ui);

  // ---------- Zeiger auf der Fläche ----------
  const abstand = () => { const p = [...kamZeiger.values()]; return p.length < 2 ? 0 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); };

  function stickSetzen(dx, dy) {
    const l = Math.hypot(dx, dy);
    if (l > stickRadius) {         // Basis wandert mit, wenn man weiter zieht
      const ue = l - stickRadius; sx += dx / l * ue; sy += dy / l * ue;
      dx = dx / l * stickRadius; dy = dy / l * stickRadius;
      basis.style.left = sx + 'px'; basis.style.top = sy + 'px';
    }
    knauf.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / stickRadius, ny = dy / stickRadius, m = Math.min(1, Math.hypot(nx, ny));
    const f = m < totzone ? 0 : (m - totzone) / (1 - totzone) / (Math.hypot(nx, ny) || 1);
    stick.x = nx * f; stick.y = -ny * f;
    if (m > 0.96) { if (vollSeit < 0) vollSeit = jetzt(); } else vollSeit = -1;
  }

  const runter = e => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    e.preventDefault?.();
    if (!benutzt) { benutzt = true; beiErstemTouch(); }
    try { element.setPointerCapture?.(e.pointerId); } catch (_) { /* egal */ }
    const r = element.getBoundingClientRect?.() || { left: 0, width: innerWidth };
    const breite = r.width || innerWidth;
    if (stickId === null && e.clientX - r.left < breite / 2) {
      stickId = e.pointerId; sx = e.clientX; sy = e.clientY; vollSeit = -1;
      stick.an = true; basis.classList.add('mi-an');
      basis.style.left = sx + 'px'; basis.style.top = sy + 'px';
      stickSetzen(0, 0);
    } else {
      kamZeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (kamZeiger.size >= 2) pinch = abstand();
    }
  };
  const bewegt = e => {
    if (e.pointerId === stickId) { stickSetzen(e.clientX - sx, e.clientY - sy); return; }
    const k = kamZeiger.get(e.pointerId);
    if (!k) return;
    const dx = e.clientX - k.x, dy = e.clientY - k.y;
    k.x = e.clientX; k.y = e.clientY;
    if (kamZeiger.size >= 2) {
      const d = abstand();
      if (pinch > 0 && d > 0) kam.zoom += Math.log(d / pinch);
      pinch = d;
    } else { kam.dx += dx; kam.dy += dy; }
  };
  const stickLos = () => { stickId = null; stick.x = stick.y = 0; stick.an = false; vollSeit = -1; ruhe(); };
  const hoch = e => {
    if (e.pointerId === stickId) stickLos();
    if (kamZeiger.delete(e.pointerId)) pinch = abstand();
  };
  const flaeche = [['pointerdown', runter], ['pointermove', bewegt], ['pointerup', hoch], ['pointercancel', hoch]];
  for (const [t, f] of flaeche) element.addEventListener(t, f);

  const alt = { ta: element.style?.touchAction, us: element.style?.userSelect };
  function zeigen(an) {
    ui.classList.toggle('mi-sichtbar', !!an);
    if (element.style) { element.style.touchAction = an ? 'none' : alt.ta || ''; element.style.userSelect = an ? 'none' : alt.us || ''; }
  }
  zeigen(sichtbar);

  return {
    stick,
    get benutzt() { return benutzt; },
    /** Sprint: Stick ganz ausgelenkt und länger als sprintZeit gehalten. */
    get sprint() {
      const s = stickId !== null && vollSeit >= 0 && jetzt() - vollSeit >= sprintZeit;
      basis.classList.toggle('mi-sprint', s);
      return s;
    },
    nimmKamera() { const r = { dx: kam.dx, dy: kam.dy, zoom: kam.zoom }; kam.dx = kam.dy = kam.zoom = 0; return r; },
    zeigen,
    reset() {
      stickLos(); kamZeiger.clear(); pinch = 0; kam.dx = kam.dy = kam.zoom = 0;
      for (const k of knopfEls) k.hoch();
    },
    dispose() {
      if (weg) return; weg = true;
      this.reset();
      for (const [t, f] of flaeche) element.removeEventListener(t, f);
      for (const k of knopfEls) for (const [t, f] of k.paare) k.b.removeEventListener(t, f);
      zeigen(false);
      ui.remove();
      if (--stil.n === 0) { stil.el.remove(); stil.el = null; }
    },
  };
}
