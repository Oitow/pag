// Tagebuch im Erde-Labor: Ziele für die ersten Stunden (wie die Raben in Valheim) + Entdeckungen (neue Biome, Vulkan, Meer).
// Vertrag: erweiterungen.js. Ziel-Daten: tagebuch-daten.js (Format engine/gameplay/aufgaben). Eigenes DOM:
// kleine Ziel-Zeile oben (antippen → Tagebuch mit allen Zielen und Entdeckungen, ✕ schließt), kurze Meldung „✔ Erstes Feuer“.
// Erkennung ohne Ereignisse anderer Module: alle 0,5 s Tasche (welt.inventar.zaehle) und Dienste (welt.dienste.*) abfragen.
// Testschalter: ?tagebuch=offen (Tagebuch beim Start offen), ?tagebuch=aus (nichts anzeigen; Fortschritt läuft weiter).
import { createAufgaben } from '../../../engine/gameplay/aufgaben.js';
import { gegenstandName } from './aktionen.js';
import { biom, BIOM_NAME } from './klima.js';
import { ZIELE, SPAETER, verlangteDinge, naechstesZiel, entdeckungBei } from './tagebuch-daten.js';

const STIL = `
#tbZeile{position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:7;max-width:min(78vw,340px);box-sizing:border-box;
  display:flex;align-items:center;gap:7px;padding:6px 11px;border-radius:12px;background:rgba(6,10,20,.5);border:1px solid rgba(255,255,255,.12);
  color:#e8eef6;font-size:12.5px;line-height:1.25;cursor:pointer;user-select:none;-webkit-user-select:none;transition:background .3s,opacity .3s}
#tbZeile .t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
#tbZeile .n{opacity:.7;font-size:11.5px;white-space:nowrap}
#tbZeile.gut{background:rgba(40,110,60,.82);border-color:rgba(160,255,180,.35)}
#tbZeile.fund{background:rgba(40,80,130,.82);border-color:rgba(160,210,255,.35)}
#tbZeile.leer{padding:6px 9px}
#tagebuch{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(94vw,420px);max-height:min(82vh,700px);
  display:none;flex-direction:column;background:rgba(6,10,20,.9);border:1px solid rgba(255,255,255,.18);border-radius:16px;z-index:12;
  color:#e8eef6;box-shadow:0 8px 30px rgba(0,0,0,.5);box-sizing:border-box}
#tagebuch.auf{display:flex}
#tagebuch .kopf{display:flex;align-items:center;justify-content:space-between;padding:10px 10px 8px 14px;border-bottom:1px solid rgba(255,255,255,.12)}
#tagebuch .kopf b{font-size:17px}
#tagebuch .zu{min-width:48px;min-height:44px;font-size:20px;padding:0;display:flex;align-items:center;justify-content:center}
#tagebuch .inhalt{overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain;padding:4px 10px 12px}
#tagebuch .titel{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.6;margin:12px 4px 6px}
#tagebuch .ziel{display:flex;gap:10px;align-items:flex-start;border-radius:12px;padding:7px 10px;margin-bottom:4px;background:rgba(255,255,255,.04)}
#tagebuch .ziel .i{width:18px;text-align:center;flex:none;font-size:14px;line-height:20px}
#tagebuch .ziel .name{font-size:14px;font-weight:600;line-height:20px}
#tagebuch .ziel .text{font-size:12.5px;opacity:.85;margin-top:1px}
#tagebuch .ziel .hin{font-size:12px;opacity:.7;margin-top:3px}
#tagebuch .ziel.fertig{opacity:.62}
#tagebuch .ziel.fertig .i{color:#8fe3a0}
#tagebuch .ziel.jetzt{background:rgba(200,150,50,.2);border:1px solid rgba(255,210,120,.3)}
#tagebuch .ziel.spaeter{opacity:.4}
#tagebuch .fund{font-size:13px;padding:4px 10px;opacity:.9}
#tagebuch .fund i{font-style:normal;opacity:.55;font-size:11.5px}
`;
const POLL = 0.5, ORT_TAKT = 2, MELDUNG = 2.4;

export function createTagebuch(welt) {
  const P = new URLSearchParams(globalThis.location?.search || '');
  const aus = P.get('tagebuch') === 'aus';
  const inv = welt.inventar, d = welt.dienste;
  const DINGE = verlangteDinge();
  let rekord = {};               // höchster je gesehener Stand je verlangtem Gegenstand (Verbrauch wirft nicht zurück)
  let gesehen = new Set();       // erkannte Ereignisse (bleiben erkannt, auch wenn man weggeht)
  let entdeckt = [];             // [{ id, text, tag }]
  const aufgaben = createAufgaben({ daten: ZIELE, zaehle: (id) => Math.max(inv.zaehle(id), rekord[id] || 0) });

  // „Brate Fleisch und iss es“: gebratenes Fleisch verschwindet aus der Tasche, ohne dass man gestorben ist
  let gebraten = inv.zaehle('gebratenesFleisch');
  const abmelden = inv.onAenderung?.(() => {
    const n = inv.zaehle('gebratenesFleisch');
    if (n < gebraten && !d.ueberleben?.tot) gesehen.add('gegessen');
    gebraten = n;
  });

  // Ist ein Ziel schon spielbar? Modul (Dienst) da bzw. Gegenstand aus einem kommenden Modul bekannt
  const bekannt = (id) => gegenstandName(id) !== id || (rekord[id] || 0) > 0;
  const verfuegbar = (z) => (z.dienst ? !!d[z.dienst] : z.schritte.every((s) => s.art !== 'sammle' || !SPAETER.includes(s.ding) || bekannt(s.ding)));
  const fertig = (id) => aufgaben.fertig(id);
  const anzahl = (b) => (Array.isArray(b) ? b.length : typeof b === 'number' ? b : b?.length ?? b?.size ?? 0);

  function ereignissePruefen() {
    const bau = d.bau, cam = welt.cam, sp = welt.spieler?.() ?? {};
    const st = bau?.naheStationen?.(cam, 30) ?? [];
    if (st.includes('lagerfeuer')) gesehen.add('lagerfeuer');
    if (st.includes('werkbank')) gesehen.add('werkbank');
    if (sp.gehen && bau?.unterDach?.(cam)) gesehen.add('unterDach');
    if (anzahl(d.felder?.beete?.()) > 0) gesehen.add('feld');
    const g = d.gleiter;
    if (typeof g?.fliegt === 'function' ? g.fliegt() : g && (rekord.gleiter || 0) > 0) gesehen.add('fliegt');
  }

  // ---------- Meldungen (nacheinander, je 2,4 s in der Ziel-Zeile) ----------
  const schlange = [];
  let meldT = 0, meldung = null;
  const neueMeldung = (text, art) => schlange.push({ text, art });

  function pruefen() {
    for (const id of DINGE) rekord[id] = Math.max(rekord[id] || 0, inv.zaehle(id));
    ereignissePruefen();
    for (let runde = 0; runde < 12; runde++) {        // mehrere Ziele auf einmal (z. B. volle Tasche) in einem Takt
      const z = naechstesZiel(ZIELE, fertig, verfuegbar);
      if (!z) break;
      if (aufgaben.status(z.id) === 'neu') aufgaben.starte(z.id);
      aufgaben.update(POLL);
      for (const was of gesehen) aufgaben.melde('ereignis', { was });
      if (!fertig(z.id)) break;
      neueMeldung('✔ ' + z.name, 'gut');
    }
  }

  // ---------- Entdeckungen ----------
  const o = new welt.THREE.Vector3();
  function ortPruefen() {
    if (!welt.spieler?.().gehen) return;
    o.copy(welt.cam).normalize();
    const p = welt.planet.probe(o.x, o.y, o.z, 2);
    const e = entdeckungBei(p, BIOM_NAME[biom(p.temp, p.feuchte)]);
    if (!e || entdeckt.some((x) => x.id === e.id)) return;
    const still = !entdeckt.length && e.id.startsWith('biom:');    // Start-Biom: nur eintragen, keine Meldung
    entdeckt.push({ ...e, tag: welt.zw?.uhr?.tag ?? 0 });
    if (!still) neueMeldung('🧭 Entdeckt: ' + e.text, 'fund');
    if (offen) zeichneBuch();
  }

  // ---------- DOM ----------
  const stil = document.createElement('style');
  stil.textContent = STIL;
  document.head.appendChild(stil);
  const zeile = document.createElement('div');
  zeile.id = 'tbZeile'; zeile.className = 'ui'; zeile.title = 'Tagebuch öffnen';
  const fenster = document.createElement('div');
  fenster.id = 'tagebuch'; fenster.className = 'ui';
  fenster.innerHTML = '<div class="kopf"><b>📖 Tagebuch</b><div class="b zu" title="Schließen">✕</div></div><div class="inhalt"></div>';
  const inhalt = fenster.querySelector('.inhalt');
  if (aus) zeile.style.display = 'none';
  document.body.append(zeile, fenster);
  // Nichts aus Zeile/Fenster soll Kamera/Steuerung erreichen
  for (const el of [zeile, fenster]) for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'wheel', 'click']) {
    el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  }
  let offen = false;
  function zeige(an) { offen = an && !aus; fenster.classList.toggle('auf', offen); if (offen) zeichneBuch(); }
  zeile.addEventListener('click', () => zeige(!offen));
  fenster.querySelector('.zu').addEventListener('click', () => zeige(false));

  function schrittText(info) {
    const s = info.schritt;
    const n = s.art === 'sammle' && info.ziel > 1 ? ` ${Math.floor(info.wert)}/${info.ziel}` : '';
    return { text: s.text, n };
  }

  let zeileMerk = '';
  function zeichneZeile() {
    let h, k = '';
    if (meldung) { h = `<span class="t">${meldung.text}</span>`; k = meldung.art; }
    else {
      const z = naechstesZiel(ZIELE, fertig, verfuegbar), info = z && aufgaben.aktuell(z.id);
      if (info) { const t = schrittText(info); h = `<span>📖</span><span class="t">${t.text}</span>${t.n ? `<span class="n">${t.n.trim()}</span>` : ''}`; }
      else { h = '<span>📖</span>'; k = 'leer'; }
    }
    if (h + k === zeileMerk) return;
    zeileMerk = h + k;
    zeile.innerHTML = h;
    zeile.className = 'ui' + (k ? ' ' + k : '');
  }

  let buchMerk = '';
  function zeichneBuch() {
    const jetzt = naechstesZiel(ZIELE, fertig, verfuegbar);
    const n = ZIELE.filter((z) => fertig(z.id)).length;
    let h = `<div class="titel">Ziele · ${n} von ${ZIELE.length}</div>`;
    for (const z of ZIELE) {
      const f = fertig(z.id), j = z === jetzt, sp = !f && !verfuegbar(z);
      const info = j ? aufgaben.aktuell(z.id) : null;
      const text = info ? schrittText(info) : null;
      const zeilen = f ? z.schritte.map((s) => s.text).join(' · ') : text ? z.schritte.map((s, i) => (i < info.index ? '✔ ' : '') + s.text + (i === info.index ? text.n : '')).join(' → ') : z.schritte.map((s) => s.text).join(' → ');
      h += `<div class="ziel${f ? ' fertig' : j ? ' jetzt' : sp ? ' spaeter' : ''}"><div class="i">${f ? '✔' : j ? '▶' : sp ? '⌛' : '○'}</div><div>`
        + `<div class="name">${z.name}${sp ? ' · kommt noch' : ''}</div><div class="text">${zeilen}</div>`
        + (info?.hinweis ? `<div class="hin">💡 ${info.hinweis}</div>` : '') + '</div></div>';
    }
    h += '<div class="titel">Entdeckungen</div>';
    h += entdeckt.length ? entdeckt.map((e) => `<div class="fund">🧭 ${e.text} <i>· Tag ${e.tag}</i></div>`).join('')
      : '<div class="fund"><i>Noch nichts – zieh los!</i></div>';
    if (h !== buchMerk) { buchMerk = h; inhalt.innerHTML = h; }
  }

  // Platz oben: zwischen HUD (links) und Knöpfen (rechts) – reicht er nicht, direkt unter das HUD
  const hudEl = document.getElementById('hud'), kopfEl = document.querySelector('#rechts .kopf') || document.getElementById('rechts');
  let lageMerk = '';
  function platziere() {
    const B = innerWidth, w = zeile.getBoundingClientRect().width || 200;      // sichtbare px (mit zoom --ui)
    const zm = +getComputedStyle(document.documentElement).getPropertyValue('--ui') || 1;
    const hr = hudEl?.getBoundingClientRect(), kr = kopfEl?.getBoundingClientRect();
    const hud = hr && hr.width > 0 && hr.height > 0 ? hr : null;
    const L = (hud ? hud.right : 0) + 8, R = (kr && kr.width > 0 ? kr.left : B) - 8;
    let x, y;
    if (R - L >= w) { x = Math.min(Math.max(B / 2, L + w / 2), R - w / 2); y = 8; }
    else { x = B / 2; y = Math.max(hud ? hud.bottom : 0, kr ? kr.bottom : 0) + 6; }
    const l = `${Math.round(x / zm)}|${Math.round(y / zm)}`;
    if (l === lageMerk) return;
    lageMerk = l; zeile.style.left = Math.round(x / zm) + 'px'; zeile.style.top = Math.round(y / zm) + 'px';
  }

  let takt = POLL, ortT = 1;
  if (P.get('tagebuch') === 'offen') zeige(true);

  return {
    name: 'tagebuch',
    update(dt) {
      takt += dt; ortT += dt;
      if (takt >= POLL) { takt = 0; pruefen(); if (!aus) { platziere(); if (offen) zeichneBuch(); } }
      if (ortT >= ORT_TAKT) { ortT = 0; ortPruefen(); }
      if (meldung) { meldT -= dt; if (meldT <= 0) meldung = null; }
      if (!meldung && schlange.length) { meldung = schlange.shift(); meldT = MELDUNG; }
      if (!aus) zeichneZeile();
    },
    hud: () => '',
    zustand: () => ({ v: 1, aufgaben: aufgaben.zustand(), rekord: { ...rekord }, gesehen: [...gesehen], entdeckt: entdeckt.slice() }),
    lade(z) {
      if (!z || z.v !== 1) return;
      aufgaben.laden(z.aufgaben);
      rekord = { ...(z.rekord || {}) };
      gesehen = new Set(z.gesehen || []);
      entdeckt = Array.isArray(z.entdeckt) ? z.entdeckt.filter((e) => e && e.id && e.text) : [];
    },
    dispose() {
      abmelden?.();
      zeile.remove(); fenster.remove(); stil.remove();
      aufgaben.dispose();
    },
  };
}
