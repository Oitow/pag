/**
 * @modul    minikarte
 * @zweck    Runde Minikarte (Canvas, 92 px) fürs MMO: Gelände-Farbbild der ganzen Welt einmal vorberechnet (in kleinen Zeit-Stückchen), Spieler-Pfeil, Orte als Punkte, Gegner rot (4×/s); dieselbe Zeichnung auch groß mit Ortsnamen für ein Karten-Fenster
 * @api      createMinikarte({eltern,welt,entitaeten,spieler,groesse,radius,bild,onTipp,zIndex,oben}) -> {element, fertig, update(dt), zeichneIn(canvas,{radius,namen,rund}), dispose()}
 * @beispiel
 *   import { createMinikarte } from '../../engine/ui/minikarte.js';
 *   const karte = createMinikarte({ eltern: render.ui, welt, entitaeten, spieler, onTipp: () => menue.zeige('karte') });
 *   // jedes Bild: karte.update(dt);   // zeichnet höchstens 4×/s
 *   karte.zeichneIn(grossCanvas, { radius: 2000, namen: true });
 * @tags     ui, minikarte, karte, canvas, mmo, orte, gegner, handy
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

const REGION_FARBE = {
  kueste: [214, 196, 140], daemmerwald: [32, 74, 52], erlenwacht: [96, 138, 78], moor: [88, 98, 66], hochland: [118, 140, 78], gebirge: [128, 128, 126],
};
const STANDARD_FARBE = [86, 128, 74];
const WASSER = [34, 68, 104];
const klemme = (x, a, b) => (x < a ? a : x > b ? b : x);
const spaeter = (f) => setTimeout(f, 24);   // kleine Stücke (≈2 ms) statt requestIdleCallback: das hungert bei vollem Bild aus

export function createMinikarte({ eltern = null, welt = null, entitaeten = null, spieler = null, groesse = 92, radius = 450, bild = 128,
  onTipp = null, zIndex = 4, oben = null } = {}) {
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  const mk = (b, h) => { const c = document.createElement('canvas'); c.width = b; c.height = h; return c; };
  const gel = mk(bild, bild);                                   // Gelände: 1 Pixel pro Raster-Zelle
  const gctx = gel.getContext('2d');
  const gx = welt?.groesse?.x || 4000, gz = welt?.groesse?.z || 4000;
  let zeile = 0, fertig = false, abgebrochen = false;
  if (gctx) { gctx.fillStyle = '#10161a'; gctx.fillRect(0, 0, bild, bild); }

  function baueStueck() {
    if (abgebrochen || !gctx || !welt?.bodenHoehe) { fertig = true; return; }
    const bis = Math.min(bild, zeile + 4), img = gctx.createImageData(bild, bis - zeile), d = img.data;
    for (let j = zeile; j < bis; j++) for (let i = 0; i < bild; i++) {
      const x = ((i + 0.5) / bild - 0.5) * gx, z = ((j + 0.5) / bild - 0.5) * gz;
      let h = 0, h2 = 0, c = STANDARD_FARBE, wasser = false;
      try {
        h = welt.bodenHoehe(x, z); h2 = welt.bodenHoehe(x + gx / bild, z);
        const r = welt.region?.(x, z); c = REGION_FARBE[r?.id] || STANDARD_FARBE;
        const w = welt.wasserHoehe?.(x, z); wasser = w != null && w > h;
      } catch { /* Zelle bleibt Standard */ }
      let s = klemme(0.78 + h / 900 + (h - h2) * 0.05, 0.5, 1.25);    // Höhe + Schummerung (Licht von Westen)
      const f = wasser ? WASSER : c; if (wasser) s = klemme(1 + h / 60, 0.55, 1.05);
      const o = ((j - zeile) * bild + i) * 4;
      d[o] = klemme(f[0] * s, 0, 255); d[o + 1] = klemme(f[1] * s, 0, 255); d[o + 2] = klemme(f[2] * s, 0, 255); d[o + 3] = 255;
    }
    gctx.putImageData(img, 0, zeile);
    zeile = bis;
    if (zeile >= bild) { fertig = true; schmutzig = true; } else spaeter(baueStueck);
  }
  spaeter(baueStueck);

  const el = document.createElement('canvas');
  el.width = el.height = Math.round(groesse * dpr);
  el.style.cssText = `position:fixed;${oben ?? 'top:calc(env(safe-area-inset-top) + 56px)'};right:8px;width:${groesse}px;height:${groesse}px;z-index:${zIndex};` +
    'border-radius:50%;border:2px solid rgba(224,181,106,.7);box-shadow:0 0 8px rgba(0,0,0,.6);pointer-events:auto;touch-action:manipulation;background:#10161a;';
  el.addEventListener('click', (e) => { e.stopPropagation(); onTipp?.(); });
  for (const t of ['pointerdown', 'touchstart']) el.addEventListener(t, (e) => e.stopPropagation());
  eltern?.append(el);

  /** Zeichnet Gelände + Marken in ein Canvas, Spieler in der Mitte (rund) oder – bei radius ≥ halber Welt – an echter Stelle (große Karte). */
  function zeichneIn(cv, { radius: R = radius, namen = false, rund = true } = {}) {
    const c = cv.getContext?.('2d'); if (!c) return;
    const W = cv.width, p = spieler?.position, px = p?.x ?? 0, pz = p?.z ?? 0;
    const ganz = R >= Math.max(gx, gz) / 2;
    const mx = ganz ? 0 : px, mz = ganz ? 0 : pz, k = W / (2 * R);          // Pixel pro Meter
    const sx = (x) => (x - mx) * k + W / 2, sz = (z) => (z - mz) * k + W / 2;
    c.save(); c.clearRect(0, 0, W, W);
    if (rund) { c.beginPath(); c.arc(W / 2, W / 2, W / 2, 0, 7); c.clip(); }
    c.fillStyle = '#10161a'; c.fillRect(0, 0, W, W);
    c.imageSmoothingEnabled = true;
    c.drawImage(gel, 0, 0, bild, bild, sx(-gx / 2), sz(-gz / 2), gx * k, gz * k);
    const px2 = Math.max(2, W / 46);
    for (const o of welt?.orte || []) {
      const x = sx(o.x), y = sz(o.z);
      if (x < -20 || y < -20 || x > W + 20 || y > W + 20) continue;
      c.fillStyle = '#ffd45a'; c.beginPath(); c.arc(x, y, px2, 0, 7); c.fill();
      if (namen) { c.font = `600 ${Math.round(W / 34)}px system-ui,sans-serif`; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 3; c.strokeText(o.name, x + px2 + 3, y + 4); c.fillText(o.name, x + px2 + 3, y + 4); }
    }
    const feinde = p && entitaeten?.imUmkreis ? entitaeten.imUmkreis(px, pz, ganz ? R : R * 1.2, { team: 'feind' }) : [];
    c.fillStyle = '#ff4a3a';
    for (const e of feinde) { if (!e.lebt) continue; c.beginPath(); c.arc(sx(e.pos.x), sz(e.pos.z), px2 * 0.8, 0, 7); c.fill(); }
    if (p) {                                                              // Pfeil, Norden oben
      c.translate(sx(px), sz(pz)); c.rotate(Math.PI - (spieler.blickYaw || 0));
      const a = rund ? Math.max(5, W / 16) : W / 38;
      c.beginPath(); c.moveTo(0, -a); c.lineTo(a * 0.7, a * 0.8); c.lineTo(0, a * 0.4); c.lineTo(-a * 0.7, a * 0.8); c.closePath();
      c.fillStyle = '#fff'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#000'; c.stroke();
    }
    c.restore();
  }

  let uhr = 0, schmutzig = true, letzte = '';
  function update(dt) {
    uhr += dt; if (uhr < 0.25 && !schmutzig) return;
    uhr = 0;
    const p = spieler?.position;
    const sig = p ? `${Math.round(p.x)}|${Math.round(p.z)}|${(spieler.blickYaw || 0).toFixed(1)}` : '';
    if (sig === letzte && !entitaeten) return;                            // Stehen ohne Gegner-Quelle: nichts neu
    letzte = sig; schmutzig = false;
    zeichneIn(el);
  }
  return { element: el, get fertig() { return fertig; }, update, zeichneIn, dispose() { abgebrochen = true; el.remove(); } };
}
