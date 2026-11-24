// Herstellen im Erde-Labor: Knopf „🧰 Herstellen“ → Fenster mit Rezepten (engine/gameplay/rezepte), Kleidung an/aus.
// Vertrag: erweiterungen.js. Dienst welt.dienste.herstellen = { kleidungWaerme() → °C, traegt(id) → bool }.
// Daten und Regeln (ohne DOM/THREE): herstellen-daten.js. Stationen: welt.dienste.bau?.naheStationen?.(welt.cam, 4).
// Testschalter: ?herstellen=offen (Fenster beim Start offen), ?tasche=voll (nur mit ?test=1: je Rohstoff 20 in die Tasche).
import { createRezepte } from '../../../engine/gameplay/rezepte.js';
import { gegenstandName } from './aktionen.js';
import { REZEPTE, NAMEN, STATIONEN, GRUPPEN, KLEIDUNG, rohstoffe, stationenAus, getragen, kleidungWaerme } from './herstellen-daten.js';

const STIL = `
#herstellen{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(94vw,440px);max-height:min(82vh,720px);
  display:none;flex-direction:column;background:rgba(6,10,20,.9);border:1px solid rgba(255,255,255,.18);border-radius:16px;z-index:12;
  color:#e8eef6;box-shadow:0 8px 30px rgba(0,0,0,.5);box-sizing:border-box}
#herstellen.auf{display:flex}
#herstellen .kopf{display:flex;align-items:center;justify-content:space-between;padding:10px 10px 8px 14px;border-bottom:1px solid rgba(255,255,255,.12)}
#herstellen .kopf b{font-size:17px}
#herstellen .zu{min-width:48px;min-height:44px;font-size:20px;padding:0;display:flex;align-items:center;justify-content:center}
#herstellen .inhalt{overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain;padding:4px 10px 12px}
#herstellen .titel{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.6;margin:12px 4px 6px}
#herstellen .stat{font-size:12px;opacity:.75;margin:8px 4px 0}
#herstellen .zeile{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.05);border-radius:12px;padding:8px 8px 8px 12px;margin-bottom:6px}
#herstellen .zeile .text{flex:1;min-width:0}
#herstellen .name{font-size:15px;font-weight:600}
#herstellen .zut{font-size:13px;margin-top:3px;line-height:1.5}
#herstellen .zut span{white-space:nowrap}
#herstellen .fehlt{color:#ff8f7a}
#herstellen .ort{font-size:12px;margin-top:2px;opacity:.85}
#herstellen .zeile .b{min-width:104px;min-height:46px;font-size:14px;display:flex;align-items:center;justify-content:center}
#herstellen .b.gelb{background:rgba(200,150,50,.55)}
#herstellen .b.grau{opacity:.38;pointer-events:none}
`;

export function createHerstellen(welt) {
  const P = new URLSearchParams(globalThis.location?.search || '');
  const inv = welt.inventar;
  const name = (id) => NAMEN[id] ?? gegenstandName(id);
  const rezepte = createRezepte();
  for (const [id, r] of Object.entries(REZEPTE)) {
    const e = typeof r.ergebnis === 'string' ? r.ergebnis : r.ergebnis.id;
    rezepte.definiere(id, { ...r, name: r.name ?? name(e) });
  }
  let traegtListe = [];                 // gewünschte Kleidung; zählt nur, solange sie in der Tasche ist
  const hat = (id) => inv.hat(id, 1);
  const stationen = () => stationenAus(welt.dienste.bau?.naheStationen?.(welt.cam, 4) ?? []);

  if (P.get('test') === '1' && P.get('tasche') === 'voll') for (const id of rohstoffe()) inv.gib(id, 20);

  // ---------- Fenster ----------
  const stil = document.createElement('style');
  stil.textContent = STIL;
  document.head.appendChild(stil);
  const fenster = document.createElement('div');
  fenster.id = 'herstellen'; fenster.className = 'ui';
  fenster.innerHTML = '<div class="kopf"><b>🧰 Herstellen</b><div class="b zu" title="Schließen">✕</div></div><div class="inhalt"></div>';
  document.body.appendChild(fenster);
  const inhalt = fenster.querySelector('.inhalt');
  // Nichts aus dem Fenster soll Kamera/Steuerung erreichen (Wischen scrollt nur die Liste)
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'wheel', 'click']) {
    fenster.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  }
  fenster.querySelector('.zu').addEventListener('click', () => zeige(false));
  inhalt.addEventListener('click', (e) => {
    const k = e.target.closest('[data-tu]');
    if (!k || k.classList.contains('grau')) return;
    const [was, id] = k.dataset.tu.split(':');
    if (was === 'mach') mach(id); else ziehe(id);
  });

  let offen = false, merk = '', pruefT = 0;
  function zeige(an) {
    offen = an;
    fenster.classList.toggle('auf', an);
    knopf?.classList.toggle('on', an);
    if (an) { merk = ''; zeichne(); }
  }

  function mach(id) {
    const r = rezepte.hole(id);
    const p = rezepte.pruefe(id, inv, { stationen: stationen() });
    if (!p.ok) { welt.melde(p.grund === 'station' ? `${STATIONEN[r.station]} nötig` : 'Zutaten fehlen', false); return; }
    const e = rezepte.stelleHer(id, inv, { stationen: stationen() });
    if (!e) { welt.melde('Tasche voll', false); return; }
    welt.melde(`+${e.anzahl} ${name(e.id)}`);
    welt.speichern?.();
    zeichne();
  }

  function ziehe(id) {
    const an = traegt(id);
    traegtListe = traegtListe.filter((k) => k !== id && (an || KLEIDUNG[k].platz !== KLEIDUNG[id].platz));
    if (!an) traegtListe.push(id);
    welt.melde(`${name(id)} ${an ? 'ausgezogen' : `angezogen (+${KLEIDUNG[id].waerme} °C)`}`);
    welt.speichern?.();
    zeichne();
  }

  const traegt = (id) => getragen(traegtListe, hat).includes(id);

  function zeileRezept(r, st) {
    const p = rezepte.pruefe(r.id, inv, { stationen: st });
    const zut = Object.entries(r.zutaten).map(([id, n]) => {
      const fehlt = p.fehlt[id] > 0;
      return `<span class="${fehlt ? 'fehlt' : ''}">${n}× ${name(id)}${fehlt ? ` (${inv.zaehle(id)})` : ''}</span>`;
    }).join(' · ');
    const ort = r.station ? `<div class="ort ${st.includes(r.station) ? '' : 'fehlt'}">📍 ${STATIONEN[r.station] ?? r.station}</div>` : '';
    const anz = r.ergebnis.anzahl > 1 ? ` ×${r.ergebnis.anzahl}` : '';
    return `<div class="zeile"><div class="text"><div class="name">${r.name}${anz}</div><div class="zut">${zut}</div>${ort}</div>` +
      `<div class="b ${p.ok ? 'gelb' : 'grau'}" data-tu="mach:${r.id}">Herstellen</div></div>`;
  }

  function zeichne() {
    const st = stationen();
    let h = '';
    const kleid = Object.keys(KLEIDUNG).filter(hat);
    if (kleid.length) {
      h += '<div class="titel">👕 Tragen</div>';
      for (const id of kleid) {
        const an = traegt(id);
        h += `<div class="zeile"><div class="text"><div class="name">${name(id)}</div><div class="zut">+${KLEIDUNG[id].waerme} °C${an ? ' · wird getragen' : ''}</div></div>` +
          `<div class="b ${an ? 'on' : ''}" data-tu="trag:${id}">${an ? 'Ausziehen' : 'Anziehen'}</div></div>`;
      }
    }
    for (const [g, titel] of GRUPPEN) {
      h += `<div class="titel">${titel}</div>`;
      for (const r of rezepte.alle()) if (REZEPTE[r.id].gruppe === g) h += zeileRezept(r, st);
    }
    const nah = st.filter((s) => s !== 'schmiede').map((s) => STATIONEN[s] ?? s);
    h += `<div class="stat">In der Nähe: ${nah.length ? nah.join(', ') : 'keine Station (Lagerfeuer/Werkbank bauen)'}</div>`;
    if (h !== merk) { merk = h; inhalt.innerHTML = h; }
  }

  const knopf = welt.knopf?.('aHerstellen', '🧰 Herstellen', () => zeige(!offen));
  const abmelden = inv.onAenderung?.(() => { if (offen) zeichne(); });
  if (P.get('herstellen') === 'offen') zeige(true);

  welt.dienste.herstellen = {
    kleidungWaerme: () => kleidungWaerme(traegtListe, hat),
    traegt,
  };

  return {
    name: 'herstellen',
    update(dt) {
      if (!offen) return;
      pruefT += dt;
      if (pruefT > 0.5) { pruefT = 0; zeichne(); }   // Stationen ändern sich beim Gehen
    },
    aktion: () => null,
    hud() {
      const g = getragen(traegtListe, hat);
      return g.length ? `Kleidung: ${g.map(name).join(', ')} (+${kleidungWaerme(g, hat)} °C)` : '';
    },
    zustand: () => ({ getragen: [...traegtListe] }),
    lade(z) { traegtListe = (z?.getragen || []).filter((id) => KLEIDUNG[id]); },
    dispose() {
      abmelden?.();
      fenster.remove(); stil.remove(); knopf?.remove();
      if (welt.dienste.herstellen?.traegt === traegt) delete welt.dienste.herstellen;
      rezepte.dispose();
    },
  };
}
