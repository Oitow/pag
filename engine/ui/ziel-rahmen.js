/**
 * @modul    ziel-rahmen
 * @zweck    MMO-Ziel-/Spieler-Rahmen als DOM-Overlay: Name, Lebensbalken mit Schild und Schaden-Rest, Haltung, Ressource, Zustands-Symbole
 * @api      createZielRahmen({eltern,ecke,breite,zIndex}) -> { element, zeige(daten|null), update(dt), dispose() }
 * @beispiel
 *   import { createZielRahmen } from '../../engine/ui/ziel-rahmen.js';
 *   const ziel = createZielRahmen({ ecke: 'oben-mitte' });
 *   ziel.zeige({ name: 'Wolf', stufe: 3, leben: 40, lebenMax: 60, feindlich: true, zustaende: [{ name: 'Gift', symbol: '☠', rest: 4, dauer: 6, stapel: 2, nuetzlich: false }] });
 *   ziel.update(dt);   // jedes Bild (Schaden-Rest rutscht nach, Haltung blinkt)
 *   ziel.zeige(null);  // verstecken
 * @tags     ui, overlay, kampf, mmo, ziel, lebensbalken, buff, debuff, haltung, schild
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

const SCHRIFT = 'system-ui,-apple-system,"Segoe UI",sans-serif';
const klemme = (x) => (x > 1 ? 1 : x > 0 ? x : 0);
const prozent = (x) => (klemme(x) * 100).toFixed(1) + '%';
const NACHRUTSCH = 0.5; // Anteil pro Sekunde, um den der Schaden-Rest nachrutscht

const ECKEN = {
  'oben-links': 'top:calc(env(safe-area-inset-top) + 8px);left:8px;',
  'oben-mitte': 'top:calc(env(safe-area-inset-top) + 8px);left:50%;transform:translateX(-50%);',
  'oben-rechts': 'top:calc(env(safe-area-inset-top) + 8px);right:8px;',
  'unten-links': 'bottom:calc(env(safe-area-inset-bottom) + 8px);left:8px;',
  'unten-rechts': 'bottom:calc(env(safe-area-inset-bottom) + 8px);right:8px;',
};

/** opts: eltern (document.body), ecke = 'oben-links', breite = 220 (px, höchstens 96vw), zIndex = 3 */
export function createZielRahmen({ eltern = globalThis.document?.body, ecke = 'oben-links', breite = 220, zIndex = 3 } = {}) {
  const neu = (css, text) => {
    const e = document.createElement('div');
    e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  };
  const wurzel = neu(`position:fixed;${ECKEN[ecke] ?? ECKEN['oben-links']}z-index:${zIndex};width:${breite}px;max-width:96vw;box-sizing:border-box;` +
    `padding:5px 7px;display:none;flex-direction:column;gap:3px;pointer-events:none;background:rgba(18,22,28,.82);border:1px solid rgba(255,255,255,.14);` +
    `border-radius:10px;color:#eef1f4;font:600 13px/1.2 ${SCHRIFT};`);
  const kopf = neu('display:flex;justify-content:space-between;gap:6px;');
  const name = neu('overflow:hidden;white-space:nowrap;text-overflow:ellipsis;', '');
  const marke = neu('flex:none;color:#ffd45a;', '');
  kopf.append(name, marke);
  const lebenBahn = neu('position:relative;height:16px;border-radius:4px;overflow:hidden;background:rgba(255,255,255,.12);');
  const rest = neu('position:absolute;left:0;top:0;bottom:0;width:100%;background:#e6c93c;');
  const leben = neu('position:absolute;left:0;top:0;bottom:0;width:100%;background:#4caf50;');
  const schild = neu('position:absolute;top:0;bottom:0;width:0%;background:rgba(255,255,255,.85);');
  const zahl = neu('position:absolute;inset:0;text-align:center;font-size:11px;line-height:16px;text-shadow:0 1px 2px #000;', '');
  lebenBahn.append(rest, leben, schild, zahl);
  const haltungBahn = neu('position:relative;height:4px;border-radius:2px;overflow:hidden;background:rgba(255,255,255,.12);display:none;');
  const haltung = neu('position:absolute;left:0;top:0;bottom:0;width:0%;background:#f08a2a;');
  haltungBahn.append(haltung);
  const resBahn = neu('position:relative;height:6px;border-radius:3px;overflow:hidden;background:rgba(255,255,255,.12);display:none;');
  const resFuell = neu('position:absolute;left:0;top:0;bottom:0;width:0%;background:#4a8fe8;');
  resBahn.append(resFuell);
  const zustandBox = neu('display:flex;flex-wrap:wrap;gap:3px;');
  wurzel.style.display = 'none';
  wurzel.append(kopf, lebenBahn, haltungBahn, resBahn, zustandBox);
  eltern?.append(wurzel);

  let daten = null;
  let restAnteil = 0;
  let zeit = 0;
  let zKey = '';

  function zeichneZustaende(liste) {
    const key = liste.map(z => `${z.name}|${z.stapel ?? 1}|${Math.ceil(z.rest ?? 0)}|${z.nuetzlich ? 1 : 0}`).join(';');
    if (key === zKey) return;
    zKey = key;
    zustandBox.replaceChildren();
    for (const z of liste) {
      const rand = z.nuetzlich ? '#5fc24f' : '#d8453a';
      const box = neu(`position:relative;width:26px;height:26px;box-sizing:border-box;border:2px solid ${rand};border-radius:5px;background:rgba(0,0,0,.4);` +
        'display:flex;align-items:center;justify-content:center;font-size:14px;overflow:hidden;', z.symbol ?? '?');
      box.title = z.name ?? '';
      const t = neu('position:absolute;left:0;right:0;bottom:0;text-align:center;font-size:8px;line-height:9px;background:rgba(0,0,0,.6);', z.rest != null ? String(Math.ceil(z.rest)) : '');
      box.append(t);
      if ((z.stapel ?? 1) > 1) box.append(neu('position:absolute;right:1px;top:0;font-size:9px;color:#ffd45a;text-shadow:0 1px 2px #000;', String(z.stapel)));
      zustandBox.append(box);
    }
  }

  function zeichne() {
    const d = daten;
    name.textContent = d.stufe != null ? `${d.name} (${d.stufe})` : (d.name ?? '');
    name.style.color = d.feindlich ? '#ff6b5e' : '#eef1f4';
    marke.textContent = d.imKampf ? '⚔' : '';
    const max = d.lebenMax > 0 ? d.lebenMax : 1;
    const l = klemme(d.leben / max);
    const s = d.schild > 0 ? Math.min(d.schild / max, 1) : 0;
    leben.style.width = prozent(l);
    schild.style.left = prozent(l);
    schild.style.width = prozent(Math.min(s, 1 - l));
    zahl.textContent = `${Math.ceil(d.leben)} / ${Math.ceil(d.lebenMax)}` + (d.schild > 0 ? ` (+${Math.ceil(d.schild)})` : '');
    if (restAnteil < l) restAnteil = l; // Heilung: Rest folgt sofort
    rest.style.width = prozent(restAnteil);
    const hat = d.haltungMax > 0;
    haltungBahn.style.display = hat ? 'block' : 'none';
    if (hat) haltung.style.width = prozent((d.haltung ?? 0) / d.haltungMax);
    const r = d.ressource;
    resBahn.style.display = r && r.max > 0 ? 'block' : 'none';
    if (r && r.max > 0) { resFuell.style.width = prozent(r.wert / r.max); resFuell.style.background = r.farbe ?? '#4a8fe8'; }
    zeichneZustaende(d.zustaende ?? []);
  }

  return {
    element: wurzel,
    zeige(neueDaten) {
      if (!neueDaten) { daten = null; wurzel.style.display = 'none'; return; }
      const neuesZiel = !daten || daten.name !== neueDaten.name;
      daten = neueDaten;
      if (neuesZiel) restAnteil = klemme(daten.leben / (daten.lebenMax > 0 ? daten.lebenMax : 1));
      wurzel.style.display = 'flex';
      zeichne();
    },
    update(dt = 0) {
      if (!daten) return;
      zeit += dt;
      const l = klemme(daten.leben / (daten.lebenMax > 0 ? daten.lebenMax : 1));
      if (restAnteil > l) { restAnteil = Math.max(l, restAnteil - NACHRUTSCH * dt); rest.style.width = prozent(restAnteil); }
      haltung.style.opacity = daten.taumelt && Math.floor(zeit * 6) % 2 === 0 ? '0.3' : '1';
    },
    dispose() { wurzel.remove(); daten = null; },
  };
}
