/**
 * @modul    schnappschuss-puffer
 * @zweck    Mehrspieler-Grundlage: speichert verspätete Zustände fremder Figuren mit Zeitstempel und liefert weich interpolierte Zustände (leicht in der Vergangenheit)
 * @api      createSchnappschussPuffer({verzoegerung=0.1, maxExtrapolation=0.25, groesse=32, winkel=['yaw'], sprungDistanz=8}) -> { schiebe(zeit,zustand), lese(zeit,out={}) -> out|null, anzahl, neueste, leeren(), dispose() }
 * @beispiel
 *   import { createSchnappschussPuffer } from '../../engine/core/schnappschuss-puffer.js';
 *   const puffer = createSchnappschussPuffer({ verzoegerung: 0.1 });
 *   puffer.schiebe(netzZeit, { x, y, z, yaw, clip: 'winken' });   // je Paket
 *   const z = puffer.lese(jetzt, zielObjekt);                      // je Bild, ohne Allokation
 * @tags     netzwerk, mehrspieler, interpolation, zeit
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { lerp, angleDiff, numOr } from './math.js';

const istZahl = (v) => typeof v === 'number' && Number.isFinite(v);

export function createSchnappschussPuffer(opts = {}) {
  const verzoegerung = Math.max(0, numOr(opts.verzoegerung, 0.1));
  const maxExtrapolation = Math.max(0, numOr(opts.maxExtrapolation, 0.25));
  const groesse = Math.max(2, Math.floor(numOr(opts.groesse, 32)));
  const sprungDistanz = numOr(opts.sprungDistanz, 8);
  const winkelNamen = new Set(opts.winkel || ['yaw']);
  let liste = []; // { zeit, w } aufsteigend nach Zeit

  /** Abstand (x,y,z) zwischen zwei Zustandsobjekten. */
  function abstand(a, b) {
    const dx = numOr(b.x, 0) - numOr(a.x, 0);
    const dy = numOr(b.y, 0) - numOr(a.y, 0);
    const dz = numOr(b.z, 0) - numOr(a.z, 0);
    return Math.hypot(dx, dy, dz);
  }

  /** Alle Felder von w nach out kopieren (nur endliche Zahlen und Nicht-Zahlen). */
  function kopiere(out, w) {
    for (const k in w) {
      const v = w[k];
      if (typeof v !== 'number' || Number.isFinite(v)) out[k] = v;
    }
  }

  /** Zwischen a und b mit Anteil f mischen. Nicht-Zahlen: von a (fehlt es dort: von b). */
  function mische(out, a, b, f) {
    for (const k in a) {
      const va = a[k], vb = b[k];
      if (typeof va !== 'number') { out[k] = va; continue; }
      const okA = Number.isFinite(va), okB = istZahl(vb);
      if (okA && okB) out[k] = winkelNamen.has(k) ? va + angleDiff(va, vb) * f : lerp(va, vb, f);
      else if (okA) out[k] = va;
      else if (okB) out[k] = vb;
    }
    for (const k in b) {
      if (k in a) continue;
      const vb = b[k];
      if (typeof vb !== 'number' || Number.isFinite(vb)) out[k] = vb;
    }
  }

  /** Über b hinaus mit der Geschwindigkeit a→b weiterrechnen (Zeitspanne extra). */
  function extrapoliere(out, a, b, dt, extra) {
    kopiere(out, b);
    for (const k in b) {
      const vb = b[k], va = a[k];
      if (!istZahl(vb) || !istZahl(va)) continue;
      const d = winkelNamen.has(k) ? angleDiff(va, vb) : vb - va;
      out[k] = vb + (d / dt) * extra;
    }
  }

  return {
    schiebe(zeit, zustand) {
      if (!Number.isFinite(zeit) || !zustand || typeof zustand !== 'object') return;
      const eintrag = { zeit, w: { ...zustand } };
      let i = liste.length;
      while (i > 0 && liste[i - 1].zeit > zeit) i--;
      if (i > 0 && liste[i - 1].zeit === zeit) liste[i - 1] = eintrag;
      else liste.splice(i, 0, eintrag);
      if (liste.length > groesse) liste.splice(0, liste.length - groesse);
    },

    lese(zeit, out = {}) {
      const n = liste.length;
      if (n === 0) return null;
      const t = zeit - verzoegerung;
      if (n === 1 || t <= liste[0].zeit) { kopiere(out, liste[0].w); return out; }
      const letzter = liste[n - 1];
      if (t >= letzter.zeit) {
        const vor = liste[n - 2];
        const dt = letzter.zeit - vor.zeit;
        const extra = Math.min(t - letzter.zeit, maxExtrapolation);
        if (extra <= 0 || dt <= 0 || abstand(vor.w, letzter.w) > sprungDistanz) kopiere(out, letzter.w);
        else extrapoliere(out, vor.w, letzter.w, dt, extra);
        return out;
      }
      let i = 1;
      while (liste[i].zeit <= t) i++;
      const a = liste[i - 1], b = liste[i];
      if (abstand(a.w, b.w) > sprungDistanz) { kopiere(out, a.w); return out; }
      mische(out, a.w, b.w, (t - a.zeit) / (b.zeit - a.zeit));
      return out;
    },

    get anzahl() { return liste.length; },
    get neueste() { return liste.length ? liste[liste.length - 1].zeit : -Infinity; },
    leeren() { liste.length = 0; },
    dispose() { liste = []; },
  };
}
