/**
 * @modul    treffer-zahlen
 * @zweck    Schadens-Zahlen als DOM-Overlay: ploppen über Treffern auf, schweben nach oben und blenden aus (fester Pool, handytauglich)
 * @api      createTrefferZahlen({eltern=document.body, max=28, zIndex=6, seed=1}) -> { zeige(pos,text,{farbe,groesse,dauer,steigen,streuung}), update(kamera,dt), anzahl, grenze (Obergrenze setzen), dispose() }
 * @beispiel
 *   import { createTrefferZahlen } from '../../engine/ui/treffer-zahlen.js';
 *   const zahlen = createTrefferZahlen({ max: 28 });
 *   zahlen.zeige({ x, y, z }, '−30', { farbe: '#ffd870', groesse: 1.4 });
 *   zahlen.update(kamera, dt); // jedes Bild
 * @tags     ui, treffer, schaden, zahlen, overlay, dom
 * @version  1.1.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { rng } from '../core/rng.js';

export function createTrefferZahlen({ eltern = document.body, max = 28, zIndex = 6, seed = 1 } = {}) {
  const zufall = rng(seed);
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  const pool = [];
  let zaehler = 0, grenze = max;
  for (let i = 0; i < max; i++) {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'fixed', left: '0', top: '0', display: 'none', pointerEvents: 'none', zIndex: String(zIndex),
      fontWeight: '800', fontSize: '18px', fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap', willChange: 'transform, opacity',
      textShadow: '0 0 3px #000, 0 0 3px #000, 1px 1px 2px #000',
    });
    eltern.appendChild(el);
    pool.push({ el, aktiv: false, alter: 0, dauer: 1, nr: 0, an: false, o: -1, x: 0, y: 0, z: 0, steigen: 0 });
  }

  function zeige(pos, text, o = {}) {
    if (!max) return;
    const { farbe = '#ffffff', groesse = 1, dauer = 0.8, steigen = 1.2, streuung = 0.3 } = o;
    // freien Platz suchen, sonst die älteste Zahl wiederverwenden
    const lim = Math.min(grenze, pool.length);
    let z = null;
    for (let i = 0; i < lim; i++) if (!pool[i].aktiv) { z = pool[i]; break; }
    if (!z) { z = pool[0]; for (let i = 1; i < lim; i++) if (pool[i].nr < z.nr) z = pool[i]; }
    z.aktiv = true; z.alter = 0; z.dauer = Math.max(0.01, dauer); z.nr = ++zaehler; z.steigen = steigen;
    z.x = pos.x + (zufall() - 0.5) * 2 * streuung;
    z.y = pos.y;
    z.z = pos.z + (zufall() - 0.5) * 2 * streuung;
    z.el.textContent = String(text);
    z.el.style.color = farbe;
    z.el.style.fontSize = (18 * groesse).toFixed(1) + 'px';
    z.el.style.display = 'none'; z.an = false; z.o = -1;
  }

  function update(kamera, dt = 0) {
    if (!kamera) return;
    dt = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    kamera.updateMatrixWorld?.();
    const bw = globalThis.innerWidth || 1, bh = globalThis.innerHeight || 1;
    for (const z of pool) {
      if (!z.aktiv) continue;
      z.alter += dt;
      const t = z.alter / z.dauer;
      if (t >= 1) { z.aktiv = false; z.an = false; z.el.style.display = 'none'; continue; }
      v.set(z.x, z.y + z.steigen * t, z.z);
      if (w.copy(v).applyMatrix4(kamera.matrixWorldInverse).z > -0.1) { if (z.an) { z.el.style.display = 'none'; z.an = false; } continue; }
      v.project(kamera);
      const x = (v.x + 1) / 2 * bw, y = (1 - v.y) / 2 * bh;
      const s = t < 0.2 ? 1.5 - 0.5 * (t / 0.2) : 1;
      const o = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
      if (!z.an) { z.el.style.display = ''; z.an = true; }
      z.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%) scale(${s.toFixed(3)})`;
      if (z.o !== o) { z.o = o; z.el.style.opacity = o.toFixed(2); }
    }
  }

  let weg = false;
  return {
    zeige, update,
    /** Obergrenze gleichzeitiger Zahlen (≤ max, z. B. für Qualitätsstufen). */
    get grenze() { return grenze; }, set grenze(n) { grenze = Math.max(1, Math.min(max, Math.floor(+n) || 1)); },
    get anzahl() { let n = 0; for (const p of pool) if (p.aktiv) n++; return n; },
    dispose() {
      if (weg) return; weg = true;
      for (const p of pool) p.el.remove();
      pool.length = 0;
    },
  };
}
