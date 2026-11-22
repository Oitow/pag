/**
 * @modul    figur-editor
 * @zweck    Aussehen einer Figur bearbeiten (DOM, Handy): je Teil ◀ ▶ durch die Stile, Farb-Tupfer für Haut/Haar/Kleidung/Hose, Körper-Regler, Zufall-Knopf und Vorlagen – liefert nur den Look (Daten), die Vorschau zeichnet der Aufrufer
 * @api      createFigurEditor({eltern,look,seed,teile,onAenderung(look),vorlagen}) -> {element, look, setzeLook(teil), zufall(), dispose()}
 * @beispiel
 *   import { createFigurEditor } from '../../engine/ui/figur-editor.js';
 *   const ed = createFigurEditor({ eltern: box, look: createLook({}), onAenderung: (look) => vorschau.setLook(look) });
 * @tags     ui, editor, figur, aussehen, look, charakter, erstellen, farben, handy, dom
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { STILE, TEIL_NAMEN, VORLAGEN, createLook, randomLook } from '../models/character/character-look.js';

const SCHRIFT = 'system-ui,-apple-system,"Segoe UI",sans-serif';
const PALETTEN = {
  haut: ['#f6d2b8', '#eab894', '#e0ac88', '#c89070', '#b07a58', '#8a5a3e', '#6a4230', '#4a2e22'],
  haar: ['#1a1410', '#2a2018', '#4a3020', '#6a4a2a', '#8a5a2a', '#b8863a', '#d8b870', '#a83a1e', '#c8c0b8', '#e8e4dc', '#d03a8a', '#3a6ab0'],
  oberteil: ['#4f7a5a', '#4f6a7a', '#7a4a3a', '#8a6a3e', '#5a5a6a', '#6a3a5a', '#a85a3a', '#3a5a3a', '#7a7a4a', '#2f4f6f', '#9a8a6a', '#6a2a24', '#9aa0a8', '#2a2a2a'],
  hose: ['#5a4a3a', '#3a3430', '#4a4a52', '#2f4f6f', '#3a4a2a', '#6a2a24', '#7a6a4a', '#2a2a5a'],
};
const FARB_FELDER = [['haut', 'Haut', (l) => l.haut, (l, f) => { l.haut = f; }],
  ['haar', 'Haar', (l) => l.haar.farbe, (l, f) => { l.haar.farbe = f; }],
  ['oberteil', 'Kleidung', (l) => l.oberteil.farbe, (l, f) => { l.oberteil.farbe = f; }],
  ['hose', 'Hose', (l) => l.hose.farbe, (l, f) => { l.hose.farbe = f; }]];
const REGLER = [['groesse', 'Größe', 0.85, 1.15], ['breite', 'Breite', 0.85, 1.2], ['muskeln', 'Muskeln', 0, 1], ['schultern', 'Schultern', 0.85, 1.2], ['bauch', 'Bauch', 0, 1], ['kopf', 'Kopf', 0.9, 1.2]];
const STIL_TEILE = ['haar', 'bart', 'oberteil', 'hose', 'schuhe', 'kopfbedeckung', 'umhang', 'brille', 'schal', 'schmuck'];
const VORLAGEN_ANZEIGE = ['wanderer', 'ritter', 'magierin', 'jaegerin', 'schmied', 'baeuerin', 'gelehrte', 'wache', 'pirat', 'punk'];

export function createFigurEditor({ eltern = null, look = {}, seed = 1, onAenderung = null, vorlagen = VORLAGEN_ANZEIGE } = {}) {
  let aktuell = createLook(look), zaehler = seed >>> 0 || 1;
  const el = (css, text, tag = 'div') => { const e = document.createElement(tag); e.style.cssText = css; if (text != null) e.textContent = text; return e; };
  const knopf = (css, text, f) => { const b = el(`box-sizing:border-box;margin:0;padding:0;font:inherit;color:#eef1f4;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:10px;touch-action:manipulation;${css}`, text, 'button'); b.type = 'button'; b.addEventListener('click', f); return b; };
  const wurzel = el(`display:flex;flex-direction:column;gap:10px;color:#eef1f4;font:15px/1.3 ${SCHRIFT};touch-action:pan-y;`);
  const titel = (t) => el('font-weight:700;color:#e0b56a;margin-top:4px;', t);
  const aufUpdate = [];

  function aendere(fn) {
    const t = JSON.parse(JSON.stringify(aktuell)); fn(t);
    aktuell = createLook(t); refresh();
    onAenderung?.(aktuell);
  }
  function setze(teil) { aktuell = createLook({ ...teil, name: teil.name ?? aktuell.name }); refresh(); onAenderung?.(aktuell); }

  // Vorlagen + Zufall
  const kopfZeile = el('display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;touch-action:pan-x;');
  kopfZeile.append(knopf('min-height:44px;padding:0 14px;flex:none;background:#e0b56a;color:#1a1408;font-weight:700;', '🎲 Zufall', () => zufall()));
  for (const v of vorlagen) if (VORLAGEN[v]) kopfZeile.append(knopf('min-height:44px;padding:0 12px;flex:none;', VORLAGEN[v].name, () => setze(VORLAGEN[v])));
  wurzel.append(kopfZeile);

  // Stile ◀ ▶
  wurzel.append(titel('Aussehen'));
  for (const teil of STIL_TEILE) {
    const liste = STILE[teil];
    const zeile = el('display:flex;align-items:center;gap:6px;');
    const wert = el('flex:1;min-width:0;text-align:center;');
    const schritt = (d) => aendere((t) => { const i = liste.indexOf(t[teil].stil); t[teil].stil = liste[(i + d + liste.length) % liste.length]; });
    zeile.append(knopf('width:52px;height:44px;flex:none;font-size:18px;', '◀', () => schritt(-1)), wert, knopf('width:52px;height:44px;flex:none;font-size:18px;', '▶', () => schritt(1)));
    wurzel.append(zeile);
    aufUpdate.push(() => { const t = `${TEIL_NAMEN[teil]}: ${aktuell[teil].stil}`; if (wert.textContent !== t) wert.textContent = t; });
  }

  // Farb-Tupfer
  wurzel.append(titel('Farben'));
  for (const [pal, name, lies, schreib] of FARB_FELDER) {
    wurzel.append(el('font-size:13px;color:#a6b0ba;', name));
    const reihe = el('display:flex;flex-wrap:wrap;gap:6px;');
    const tupfer = PALETTEN[pal].map((f) => {
      const b = knopf(`width:40px;height:40px;border-radius:50%;background:${f};`, '', () => aendere((t) => schreib(t, f)));
      reihe.append(b); return [f, b];
    });
    wurzel.append(reihe);
    aufUpdate.push(() => { const c = lies(aktuell); for (const [f, b] of tupfer) b.style.borderColor = f === c ? '#fff' : 'rgba(255,255,255,.18)'; });
  }

  // Körper-Regler
  wurzel.append(titel('Körper'));
  for (const [k, name, min, max] of REGLER) {
    const box = el('display:flex;align-items:center;gap:8px;');
    const r = el('flex:1;min-width:0;min-height:36px;margin:0;accent-color:#e0b56a;touch-action:pan-y;', null, 'input');
    r.type = 'range'; r.min = String(min); r.max = String(max); r.step = '0.01';
    r.addEventListener('input', () => { const v = Number(r.value); aendere((t) => { t.koerper[k] = v; }); });
    box.append(el('width:84px;flex:none;', name), r);
    wurzel.append(box);
    aufUpdate.push(() => { if (document.activeElement !== r && Number(r.value) !== aktuell.koerper[k]) r.value = String(aktuell.koerper[k]); });
  }

  function refresh() { for (const f of aufUpdate) f(); }
  function zufall() {
    zaehler = (zaehler * 1664525 + 1013904223) >>> 0;
    const l = randomLook(zaehler);
    setze({ ...l, name: aktuell.name });
  }
  refresh();
  eltern?.append(wurzel);
  return { element: wurzel, get look() { return aktuell; }, setzeLook: setze, zufall, dispose() { wurzel.remove(); } };
}
