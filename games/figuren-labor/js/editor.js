// Figuren-Labor – Look-Editor: Vorlagen, Zufall, Stile, Farben, Körperbau. Ruft onAenderung(look) bei jeder Änderung.
import { STILE, VORLAGEN, createLook, randomLook } from '../../../engine/models/character/character-look.js';

const NAMEN = {
  haar: 'Haar', bart: 'Bart', oberteil: 'Oberteil', hose: 'Hose', schuhe: 'Schuhe', kopfbedeckung: 'Kopf', umhang: 'Umhang',
};
const KOERPER = [['groesse', 'Größe', 0.5, 1.4], ['breite', 'Breite', 0.75, 1.35], ['kopf', 'Kopf', 0.8, 1.5], ['beine', 'Beine', 0.8, 1.2], ['arme', 'Arme', 0.85, 1.15], ['bauch', 'Bauch', 0, 1]];

export function createEditor({ wurzel, look, onAenderung }) {
  let aktuell = createLook(look);
  let zufallSeed = 1;
  const el = document.createElement('div');
  el.className = 'ed';
  wurzel.appendChild(el);

  const setze = (pfad, wert) => {
    const t = JSON.parse(JSON.stringify(aktuell));
    const [a, b] = pfad.split('.');
    if (b) t[a] = { ...(t[a] || {}), [b]: wert }; else t[a] = wert;
    aktuell = createLook(t);
    onAenderung(aktuell);
  };
  const ersetze = (l) => { aktuell = createLook(l); onAenderung(aktuell); zeichne(); };

  function zeichne() {
    const L = aktuell;
    let h = `<div class="ed-kopf"><b>👕 Aussehen</b><input class="ed-name" value="${L.name.replace(/"/g, '')}" maxlength="40" aria-label="Name"></div>`;
    h += `<div class="ed-reihe ed-vorlagen">${Object.entries(VORLAGEN).map(([k, v]) => `<button data-vorlage="${k}">${v.name}</button>`).join('')}<button data-zufall>🎲 Zufall</button><button data-zufall-kind>🎲 Kind</button></div>`;
    h += `<div class="ed-gitter">`;
    h += zeile('Haut', farbFeld('haut', L.haut)) + zeile('Augen', farbFeld('augen', L.augen));
    for (const teil of Object.keys(STILE)) {
      let f = `<select data-pfad="${teil}.stil">${STILE[teil].map(s => `<option${s === L[teil].stil ? ' selected' : ''}>${s}</option>`).join('')}</select>`;
      for (const k of ['farbe', 'akzent']) if (k in L[teil]) f += farbFeld(`${teil}.${k}`, L[teil][k] || L.haar.farbe);
      h += zeile(NAMEN[teil], f);
    }
    h += zeile('Gürtel', `<input type="checkbox" data-guertel${L.guertel ? ' checked' : ''}>` + (L.guertel ? farbFeld('guertel', L.guertel) : ''));
    h += zeile('Tasche', `<input type="checkbox" data-pfad="tasche"${L.tasche ? ' checked' : ''}>`);
    h += zeile('Rucksack', `<input type="checkbox" data-pfad="rucksack"${L.rucksack ? ' checked' : ''}>`);
    for (const [k, name, a, b] of KOERPER)
      h += `<label>${name}<input type="range" min="${a}" max="${b}" step="0.01" value="${L.koerper[k]}" data-pfad="koerper.${k}"></label>`;
    h += `</div>`;
    el.innerHTML = h;
  }
  const farbFeld = (pfad, wert) => `<input type="color" value="${wert}" data-pfad="${pfad}" aria-label="${pfad}">`;
  const zeile = (name, inhalt) => `<label><span>${name}</span><span class="ed-felder">${inhalt}</span></label>`;

  el.addEventListener('input', (e) => {
    const t = e.target;
    if (t.classList.contains('ed-name')) return setze('name', t.value);
    if (t.dataset.guertel !== undefined) { setze('guertel', t.checked ? '#3a2a1a' : null); return zeichne(); }
    const pfad = t.dataset.pfad;
    if (!pfad) return;
    const wert = t.type === 'checkbox' ? t.checked : t.type === 'range' ? +t.value : t.value;
    setze(pfad, wert);
    if (t.tagName === 'SELECT') zeichne();      // Akzent-Felder können sich ändern
  });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.vorlage) ersetze(VORLAGEN[b.dataset.vorlage]);
    else if (b.dataset.zufall !== undefined) ersetze(randomLook(Date.now() % 1e6 + zufallSeed++));
    else if (b.dataset.zufallKind !== undefined) ersetze(randomLook(Date.now() % 1e6 + zufallSeed++, { kind: true }));
  });
  zeichne();

  return {
    get look() { return aktuell; },
    setLook: ersetze,
    zeige(an) { el.classList.toggle('offen', an); },
    get offen() { return el.classList.contains('offen'); },
    dispose() { el.remove(); },
  };
}
