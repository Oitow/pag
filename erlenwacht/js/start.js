// Erlenwacht – Titelbildschirm und Held-Erstellung (DOM + kleiner eigener THREE-Renderer für die Figuren-Vorschau).
// zeigeStart({ eltern, stand }) -> Promise<{ art: 'fortsetzen' } | { art: 'neu', held: { name, klasse }, look }>
// Nach der Wahl ist alles wieder abgebaut (Renderer, Modell, Schleife, Elemente).
import * as THREE from 'three';
import { createCharacterModel } from '../../engine/models/character/character-model.js';
import { createLook, VORLAGEN } from '../../engine/models/character/character-look.js';
import { createFigurEditor } from '../../engine/ui/figur-editor.js';

export const KLASSEN = [
  { id: 'krieger', name: 'Krieger', text: 'Hält vorn die Stellung: viel Leben und harte Schläge im Nahkampf.', vorlage: 'ritter', symbol: '⚔' },
  { id: 'magier', name: 'Magier', text: 'Wirft Feuer, Eis und Blitze aus der Ferne – zart, aber mächtig.', vorlage: 'magierin', symbol: '✨' },
  { id: 'waldlaeufer', name: 'Waldläufer', text: 'Schnell und treffsicher: kämpft aus der Deckung mit Pfeil und Dolch.', vorlage: 'jaegerin', symbol: '🏹' },
];
const SCHRIFT = 'system-ui,-apple-system,"Segoe UI",sans-serif';
const LEUCHT = '#5ff2c8', GOLD = '#e0b56a';
const CSS = `
@keyframes ew-atmen{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.06)}}
@keyframes ew-schweb{0%{transform:translateY(0);opacity:0}15%{opacity:.9}100%{transform:translateY(-110vh);opacity:0}}
.ew-knopf{box-sizing:border-box;width:100%;min-height:60px;margin:0;padding:10px 16px;font:600 19px ${SCHRIFT};color:#eafff8;background:rgba(95,242,200,.08);
  border:1px solid rgba(95,242,200,.45);border-radius:14px;touch-action:manipulation;box-shadow:0 0 16px rgba(95,242,200,.15);}
.ew-knopf.haupt{background:rgba(95,242,200,.22);}
.ew-knopf small{display:block;font:400 13px ${SCHRIFT};color:#9fc9bd;margin-top:2px}`;
const el = (css, text, tag = 'div') => { const e = document.createElement(tag); e.style.cssText = css; if (text != null) e.textContent = text; return e; };
const knopf = (text, f, klasse = '', unter = '') => {
  const b = el('', null, 'button'); b.type = 'button'; b.className = 'ew-knopf ' + klasse; b.append(document.createTextNode(text));
  if (unter) b.append(el('', unter, 'small')); b.addEventListener('click', f); return b;
};

export function zeigeStart({ eltern = document.body, stand = null } = {}) {
  return new Promise((fertig) => {
    const stil = el('', null, 'style'); stil.textContent = CSS; document.head.append(stil);
    const wurzel = el(`position:fixed;inset:0;z-index:10;display:flex;flex-direction:column;overflow:hidden;color:#eafff8;font-family:${SCHRIFT};` +
      'background:radial-gradient(120% 70% at 50% 100%,#0d3a3a 0%,#08171c 45%,#04070a 100%);touch-action:none;');
    eltern.append(wurzel);
    let aufraeumen = null;
    const ende = (ergebnis) => { aufraeumen?.(); stil.remove(); wurzel.remove(); fertig(ergebnis); };

    // ---------- Titel ----------
    function titel() {
      aufraeumen?.(); aufraeumen = null; wurzel.replaceChildren();
      for (let i = 0; i < 16; i++) {                                    // Glühwürmchen (feste Werte, kein Zufall nötig)
        const s = 3 + (i * 7) % 5;
        wurzel.append(el(`position:absolute;left:${(i * 37) % 96 + 2}%;bottom:-10px;width:${s}px;height:${s}px;border-radius:50%;background:${i % 3 ? LEUCHT : '#b48cff'};` +
          `box-shadow:0 0 ${s * 3}px ${i % 3 ? LEUCHT : '#b48cff'};animation:ew-schweb ${9 + (i * 5) % 8}s linear ${-(i * 1.7) % 12}s infinite;pointer-events:none;`));
      }
      const mitte = el('flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:0 24px;');
      mitte.append(el(`font:800 clamp(40px,14vw,76px)/1.05 ${SCHRIFT};letter-spacing:.06em;color:#dffff6;text-shadow:0 0 18px ${LEUCHT},0 0 48px rgba(95,242,200,.55);animation:ew-atmen 5s ease-in-out infinite;`, 'Erlenwacht'),
        el('font:400 15px/1.4 ' + SCHRIFT + ';color:#8fc4b6;letter-spacing:.2em;text-transform:uppercase;', 'Der Wald leuchtet'));
      const unten = el('display:flex;flex-direction:column;gap:12px;padding:0 24px calc(env(safe-area-inset-bottom) + 40px);width:min(100%,420px);align-self:center;box-sizing:border-box;');
      if (stand?.held) unten.append(knopf('Fortsetzen', () => ende({ art: 'fortsetzen' }), 'haupt', `${stand.held.name} · ${(KLASSEN.find((k) => k.id === stand.held.klasse) || {}).name || ''}`));
      unten.append(knopf('Neuer Held', erstellen, stand?.held ? '' : 'haupt'));
      wurzel.append(mitte, unten);
    }

    // ---------- Held erstellen ----------
    function erstellen() {
      wurzel.replaceChildren();
      let klasse = KLASSEN[0], veraendert = false, programm = false;
      const vorschau = el('flex:none;height:min(38vh,340px);position:relative;background:radial-gradient(60% 70% at 50% 60%,rgba(95,242,200,.18),transparent 70%);');
      const flaeche = el('flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;padding:10px 14px;display:flex;flex-direction:column;gap:12px;box-sizing:border-box;');
      const kein = (e) => { e.style.flex = 'none'; return e; };
      const fuss = el('flex:none;display:flex;gap:10px;padding:10px 14px calc(env(safe-area-inset-bottom) + 12px);background:rgba(4,7,10,.9);border-top:1px solid rgba(95,242,200,.25);');
      wurzel.append(vorschau, flaeche, fuss);

      // Vorschau: eigener Renderer, Figur dreht sich
      const cv = el('position:absolute;inset:0;width:100%;height:100%;display:block;', null, 'canvas'); vorschau.append(cv);
      let renderer = null, modell = null, raf = 0, szene, kamera, t0 = 0;
      try {
        renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        szene = new THREE.Scene(); kamera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
        szene.add(new THREE.HemisphereLight(0xcfe8ff, 0x2a3a30, 1.4));
        const sonne = new THREE.DirectionalLight(0xfff0d8, 2.2); sonne.position.set(2, 3, 3); szene.add(sonne);
        const randlicht = new THREE.DirectionalLight(0x5ff2c8, 1.2); randlicht.position.set(-3, 2, -2); szene.add(randlicht);
        modell = createCharacterModel({ look: {}, schatten: false }); szene.add(modell.root);
        kamera.position.set(0, 1.15, 4.6); kamera.lookAt(0, 0.95, 0);
        const groesse = () => { const w = vorschau.clientWidth || 360, h = vorschau.clientHeight || 300; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false); kamera.aspect = w / h; kamera.updateProjectionMatrix(); };
        groesse(); addEventListener('resize', groesse);
        const schleife = (t) => { raf = requestAnimationFrame(schleife); const dt = Math.min(0.1, (t - t0) / 1000 || 0); t0 = t; modell.root.rotation.y += dt * 0.6; modell.updateGesicht?.(dt); renderer.render(szene, kamera); };
        raf = requestAnimationFrame(schleife);
        aufraeumen = () => { cancelAnimationFrame(raf); removeEventListener('resize', groesse); modell?.root.removeFromParent(); modell?.dispose?.(); editor?.dispose(); renderer.dispose(); renderer.forceContextLoss?.(); };
      } catch (e) { console.warn('Figuren-Vorschau nicht möglich:', e?.message || e); aufraeumen = () => editor?.dispose(); }

      // Name + Klasse
      const name = el(`box-sizing:border-box;width:100%;min-height:52px;padding:0 14px;font:600 18px ${SCHRIFT};color:#fff;background:rgba(255,255,255,.08);border:1px solid rgba(95,242,200,.4);border-radius:12px;`, null, 'input');
      name.style.flex = 'none'; name.type = 'text'; name.maxLength = 16; name.placeholder = 'Name deines Helden'; name.value = 'Held';
      name.addEventListener('keydown', (e) => e.stopPropagation());
      const karten = KLASSEN.map((k) => {
        const b = knopf(`${k.symbol} ${k.name}`, () => waehle(k), '', k.text); b.style.textAlign = 'left'; b.style.flex = 'none'; return [k, b];
      });
      const zeigeKlasse = () => { for (const [k, b] of karten) { b.style.borderColor = k === klasse ? GOLD : 'rgba(95,242,200,.45)'; b.style.background = k === klasse ? 'rgba(224,181,106,.18)' : 'rgba(95,242,200,.08)'; } };
      const setzeVorschau = (look) => { modell?.setLook(look); };
      const editor = createFigurEditor({ look: createLook({ ...VORLAGEN[KLASSEN[0].vorlage] }), seed: (performance.now() * 1000) | 0,
        onAenderung: (look) => { if (!programm) veraendert = true; setzeVorschau(look); } });
      function waehle(k) {
        klasse = k; zeigeKlasse();
        if (!veraendert) { programm = true; editor.setzeLook(VORLAGEN[k.vorlage]); programm = false; }
      }
      flaeche.append(el(`font:700 15px ${SCHRIFT};color:${GOLD};`, 'Name'), name, el(`font:700 15px ${SCHRIFT};color:${GOLD};`, 'Klasse'), ...karten.map(([, b]) => b),
        kein(editor.element));
      zeigeKlasse(); setzeVorschau(editor.look);

      fuss.append(knopf('Zurück', titel), knopf('Los geht’s', () => {
        const n = name.value.trim() || 'Held';
        ende({ art: 'neu', held: { name: n, klasse: klasse.id }, look: { ...editor.look, name: n } });
      }, 'haupt'));
      fuss.children[0].style.flex = '0 0 30%'; fuss.children[1].style.flex = '1';
    }
    titel();
  });
}
