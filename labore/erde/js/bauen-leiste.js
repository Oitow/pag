// Bau-Leiste (DOM, handytauglich): Teilwahl + Drehen / Abreißen / Setzen. Sitzt über der Aktionsleiste,
// mittig, lässt rechts die ▲▼-Knöpfe und unten den Tempo-Regler frei. Nur sichtbar im Bau-Modus zu Fuß.
const SYMBOL = { fundament: '🧱', boden: '▦', wand: '🪵', tuerwand: '🚪', eisentuer: '🔩', dach: '🏠', treppe: '🪜', lagerfeuer: '🔥', werkbank: '🛠️',
  schmelzofen: '🏺', amboss: '⚒️' };
const KURZ = { tuerwand: 'Tür', eisentuer: 'Eisentür', lagerfeuer: 'Feuer', fundament: 'Fundam.', schmelzofen: 'Ofen' };

const CSS = `
#bauLeiste{position:fixed;left:50%;bottom:110px;transform:translateX(-50%);max-width:calc(100vw - 170px);display:none;flex-direction:column;gap:6px;z-index:6;align-items:center}
#bauLeiste .teile{display:flex;flex-wrap:wrap;justify-content:center;gap:4px}
#bauLeiste .t{width:50px;height:46px;border-radius:10px;background:rgba(6,10,20,.6);border:1px solid rgba(255,255,255,.18);color:#eef3fa;
  display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:18px;line-height:1;user-select:none;-webkit-user-select:none;cursor:pointer}
#bauLeiste .t small{font-size:9px;margin-top:3px;opacity:.85}
#bauLeiste .t.an{background:rgba(70,140,80,.75);border-color:#9fe0a0}
#bauLeiste .knoepfe{display:flex;gap:6px}
#bauLeiste .k{min-width:74px;height:38px;border-radius:12px;background:rgba(6,10,20,.6);border:1px solid rgba(255,255,255,.18);color:#eef3fa;
  display:flex;align-items:center;justify-content:center;font-size:13px;user-select:none;-webkit-user-select:none;cursor:pointer;padding:0 8px}
#bauLeiste .k.setzen{background:rgba(60,120,70,.75)}
`;

export function createBauLeiste({ teile, waehle, setzen, abreissen, drehen }) {
  const stil = document.createElement('style');
  stil.textContent = CSS;
  document.head.appendChild(stil);
  const el = document.createElement('div');
  el.id = 'bauLeiste'; el.className = 'ui';
  const reihe = document.createElement('div'); reihe.className = 'teile';
  const knoepfe = document.createElement('div'); knoepfe.className = 'knoepfe';
  el.append(reihe, knoepfe);
  const tipp = (e, fn) => e.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); fn(); });
  const wahlEl = new Map();
  for (const { art, name } of teile) {
    const b = document.createElement('div');
    b.className = 't'; b.title = name;
    b.innerHTML = `${SYMBOL[art] || '■'}<small>${KURZ[art] || name}</small>`;
    tipp(b, () => api.waehle(art));
    reihe.appendChild(b); wahlEl.set(art, b);
  }
  for (const [text, fn, kl] of [['⟳ Drehen', drehen, ''], ['✖ Abreißen', abreissen, ''], ['✔ Setzen', setzen, 'setzen']]) {
    const b = document.createElement('div');
    b.className = 'k ' + kl; b.textContent = text; tipp(b, fn);
    knoepfe.appendChild(b);
  }
  document.body.appendChild(el);

  let sichtbar = null, takt = 0;
  // immer knapp über der Aktionsleiste (die kann je nach Modulen/Breite ein- oder zweizeilig sein)
  function anpassen() {
    const ak = document.getElementById('aktionen');
    if (!ak?.getBoundingClientRect) return;
    const z = +getComputedStyle(document.documentElement).getPropertyValue('--ui') || 1;
    el.style.bottom = Math.max(0, (innerHeight - ak.getBoundingClientRect().top) / z + 8) + 'px';
  }
  const api = {
    waehle(art) { for (const [a, b] of wahlEl) b.classList.toggle('an', a === art); waehle(art); },
    zeige(an) {
      if (an !== sichtbar) { sichtbar = an; el.style.display = an ? 'flex' : 'none'; takt = 0; }
      if (an && takt-- <= 0) { takt = 30; anpassen(); }
    },
    dispose() { el.remove(); stil.remove(); },
  };
  api.waehle(teile[0].art);
  return api;
}
