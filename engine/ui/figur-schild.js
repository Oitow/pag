/**
 * @modul    figur-schild
 * @zweck    Namensschild + Sprechblase + Lebensbalken über Figuren (DOM-Overlay): folgt dem Kopf, skaliert und blendet nach Abstand aus, verschwindet hinter der Kamera
 * @api      createFigurSchilder(opts) -> { neu(ziel, {name, leben, farbe, versatz, nameAb}) -> schild, update(kamera, dt), anzahl, dispose() } — jedes Schild: { setName(t), sage(text, {dauer}) , schweige(), setLeben(anteil|null), setFarbe(css), zeige(bool), ziel, spricht, sichtbar, entfernen() }
 * @beispiel
 *   import { createFigurSchilder } from '../../engine/ui/figur-schild.js';
 *   const schilder = createFigurSchilder();
 *   const s = schilder.neu(npc.model.rig.sockel.kopf, { name: 'Bauer Jupp', leben: 0.8 });   // Object3D, {x,y,z} oder Funktion
 *   s.sage('Schönes Wetter heute!');
 *   schilder.update(kamera, dt);   // jedes Bild nach der Kamera, vor/nach dem Rendern
 * @tags     ui, namensschild, sprechblase, dialog, lebensbalken, hp, figur, npc, overlay, hud
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { clamp, smoothstep } from '../core/math.js';

const CSS = `
.fs-ebene{position:fixed;inset:0;pointer-events:none;z-index:2;overflow:hidden;font-family:system-ui,sans-serif}
.fs-schild{position:absolute;left:0;top:0;display:flex;flex-direction:column;align-items:center;gap:3px;
  transform-origin:50% 100%;will-change:transform,opacity;white-space:nowrap}
.fs-name{font-size:13px;font-weight:600;color:#fff;padding:1px 7px;border-radius:8px;background:rgba(20,24,32,.55);
  text-shadow:0 1px 2px rgba(0,0,0,.6)}
.fs-leben{width:56px;height:6px;border-radius:3px;background:rgba(20,24,32,.6);overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.35)}
.fs-leben i{display:block;height:100%;width:100%;transition:width .2s}
.fs-blase{position:relative;max-width:220px;white-space:normal;text-align:center;font-size:14px;line-height:1.3;color:#2a2218;
  background:#fffdf6;border-radius:12px;padding:6px 10px;box-shadow:0 2px 8px rgba(0,0,0,.3);margin-bottom:6px}
.fs-blase::after{content:'';position:absolute;left:50%;bottom:-7px;margin-left:-7px;border:7px solid transparent;border-bottom:0;border-top-color:#fffdf6}
`;

const leer = (t) => t == null || t === '';

/**
 * opts: wurzel (document.body), maxAbstand = 35 (Name/Balken ganz weg), ausblendAb = 22, refAbstand = 7 (Skala 1),
 *   minSkala = 0.55, maxSkala = 1.15, blaseMaxAbstand = 50, groesse() -> {breite, hoehe} (Standard: Fenster)
 */
export function createFigurSchilder({
  wurzel = globalThis.document?.body, maxAbstand = 35, ausblendAb = 22, refAbstand = 7, minSkala = 0.55, maxSkala = 1.15,
  blaseMaxAbstand = 50, groesse = null,
} = {}) {
  const el = (cls, tag = 'div') => { const e = document.createElement(tag); e.className = cls; return e; };
  const stil = el('', 'style'); stil.textContent = CSS;
  (document.head || document.body).appendChild(stil);
  const ebene = el('fs-ebene');
  wurzel.appendChild(ebene);
  const liste = new Set();
  const v = new THREE.Vector3(), w = new THREE.Vector3();

  function weltPos(ziel, out) {
    const z = typeof ziel === 'function' ? ziel() : ziel;
    if (!z) return null;
    if (z.isObject3D) { z.updateWorldMatrix?.(true, false); return z.getWorldPosition(out); }
    if (!Number.isFinite(+z.x) || !Number.isFinite(+z.z)) return null;
    return out.set(+z.x, +z.y || 0, +z.z);
  }

  function neu(ziel, { name = '', leben = null, farbe = null, versatz = 0.25, nameAb = 0 } = {}) {
    const dom = el('fs-schild');
    const blase = el('fs-blase'), nameEl = el('fs-name'), balken = el('fs-leben'), fuell = el('', 'i');
    balken.appendChild(fuell);
    dom.appendChild(blase); dom.appendChild(nameEl); dom.appendChild(balken);
    ebene.appendChild(dom);
    const st = { ziel, versatz, nameAb, an: true, sichtbar: false, blaseRest: 0, blaseDauer: 0, leben: null, name: '' };
    const s = {
      get ziel() { return st.ziel; }, set ziel(z) { st.ziel = z; },
      get spricht() { return st.blaseRest > 0; },
      get sichtbar() { return st.sichtbar; },
      get name() { return st.name; },
      setName(t) { st.name = leer(t) ? '' : String(t); nameEl.textContent = st.name; nameEl.style.display = st.name ? '' : 'none'; return s; },
      setFarbe(css) { nameEl.style.color = css || ''; return s; },
      /** Sprechblase; dauer in Sekunden (Standard nach Textlänge 2…8 s). Leerer Text = schweigen. */
      sage(text, { dauer } = {}) {
        if (leer(text)) return s.schweige();
        text = String(text);
        blase.textContent = text;
        st.blaseDauer = st.blaseRest = Number.isFinite(dauer) && dauer > 0 ? dauer : clamp(1.5 + text.length * 0.06, 2, 8);
        return s;
      },
      schweige() { st.blaseRest = 0; blase.style.display = 'none'; return s; },
      /** anteil 0…1 (Farbe grün → gelb → rot) oder null = Balken aus. */
      setLeben(anteil) {
        st.leben = anteil == null || !Number.isFinite(+anteil) ? null : clamp(+anteil, 0, 1);
        balken.style.display = st.leben == null ? 'none' : '';
        if (st.leben != null) { fuell.style.width = (st.leben * 100).toFixed(1) + '%'; fuell.style.background = `hsl(${Math.round(st.leben * 120)},70%,45%)`; }
        return s;
      },
      zeige(an) { st.an = !!an; if (!an) { dom.style.display = 'none'; st.sichtbar = false; } return s; },
      entfernen() { if (!liste.delete(s)) return; dom.remove(); },
      _st: st, _dom: { dom, blase, nameEl, balken, fuell },
    };
    s.setName(name).setLeben(leben).setFarbe(farbe).schweige();
    liste.add(s);
    return s;
  }

  /** Projiziert alle Schilder; kamera = THREE.Camera (nach ihrem update), dt in Sekunden für Sprechblasen. */
  function update(kamera, dt = 0) {
    if (!kamera) return;
    dt = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    kamera.updateMatrixWorld?.();
    const g = groesse ? groesse() : { breite: globalThis.innerWidth || 1, hoehe: globalThis.innerHeight || 1 };
    for (const s of liste) {
      const st = s._st, d = s._dom;
      if (st.blaseRest > 0) st.blaseRest = Math.max(0, st.blaseRest - dt);
      if (!st.an) continue;
      const p = weltPos(st.ziel, v);
      if (!p) { d.dom.style.display = 'none'; st.sichtbar = false; continue; }
      p.y += st.versatz;
      w.copy(p).applyMatrix4(kamera.matrixWorldInverse);
      const abstand = w.length();               // Kamera-Raum: Länge = Abstand zur Kamera
      const spricht = st.blaseRest > 0;
      const aName = (st.name || st.leben != null) && abstand >= st.nameAb ? 1 - smoothstep(ausblendAb, maxAbstand, abstand) : 0;
      const aBlase = spricht ? (1 - smoothstep(blaseMaxAbstand * 0.7, blaseMaxAbstand, abstand)) * clamp(st.blaseRest / 0.3, 0, 1) : 0;
      if (w.z > -0.1 || (aName <= 0.01 && aBlase <= 0.01)) { d.dom.style.display = 'none'; st.sichtbar = false; continue; }
      p.project(kamera);
      const x = (p.x + 1) / 2 * g.breite, y = (1 - p.y) / 2 * g.hoehe;
      const k = clamp(refAbstand / Math.max(0.1, abstand), minSkala, maxSkala);
      d.dom.style.display = '';
      d.dom.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%) scale(${k.toFixed(3)})`;
      d.dom.style.zIndex = String(Math.max(0, Math.round(10000 - abstand * 10)));
      d.nameEl.style.opacity = d.balken.style.opacity = aName.toFixed(2);
      d.blase.style.display = spricht ? '' : 'none';
      if (spricht) d.blase.style.opacity = aBlase.toFixed(2);
      st.sichtbar = true;
    }
  }

  let weg = false;
  return {
    neu, update,
    get anzahl() { return liste.size; },
    dispose() {
      if (weg) return; weg = true;
      for (const s of [...liste]) s.entfernen();
      ebene.remove(); stil.remove();
    },
  };
}
