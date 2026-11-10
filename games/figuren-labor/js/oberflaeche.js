// Figuren-Labor – Handy-Oberfläche: Menü-Blatt mit Reitern (unten am Handy, links am großen Bildschirm),
// Zauberleiste mit Abklingzeiten, Leben-/Mana-Balken, Meldungen. Reine DOM-Arbeit, Spiel-Logik kommt über Rückrufe.
const hex = (f) => '#' + f.toString(16).padStart(6, '0');

/**
 * opts: { zauber (Tabelle), ausruestung: [namen], kameras: [namen],
 *   onZauber(name) (wirken), onAusruestung(name|null), onKamera(name), onSchalter(id, an), onKnopf(id), onOffen(offen) }
 */
export function createOberflaeche({ zauber, ausruestung = [], kameras = [], onZauber, onAusruestung, onKamera, onSchalter, onKnopf, onOffen }) {
  const $ = (id) => document.getElementById(id);
  const blatt = $('blatt'), leiste = $('zleiste'), namen = Object.keys(zauber);
  let gewaehlt = namen[0], meldeUhr = 0;

  // ---- Blatt + Reiter ----
  const tabs = [...blatt.querySelectorAll('.tabs button')], seiten = [...blatt.querySelectorAll('section[data-tab]')];
  function zeigeTab(id) {
    for (const t of tabs) t.classList.toggle('an', t.dataset.tab === id);
    for (const s of seiten) s.classList.toggle('an', s.dataset.tab === id);
  }
  function oeffne(tab) {
    if (tab) zeigeTab(tab);
    blatt.classList.add('offen'); $('bMenue').classList.add('an'); document.body.classList.add('blatt-offen');
    onOffen?.(true);
  }
  function schliesse() {
    blatt.classList.remove('offen'); $('bMenue').classList.remove('an'); document.body.classList.remove('blatt-offen');
    document.activeElement?.blur?.();
    onOffen?.(false);
  }
  $('bMenue').onclick = () => (blatt.classList.contains('offen') ? schliesse() : oeffne());
  $('bZu').onclick = schliesse;
  for (const t of tabs) t.onclick = () => zeigeTab(t.dataset.tab);

  // ---- Zauberleiste (immer sichtbar): tippen = wählen, nochmal tippen = wirken ----
  leiste.innerHTML = namen.map((n, i) => `<button class="zk" data-z="${n}" style="--f:${hex(zauber[n].farbe)}" title="${zauber[n].name} (Taste ${(i + 1) % 10})" aria-label="${zauber[n].name}"><span>${zauber[n].symbol}</span><i class="cd"></i><small>${zauber[n].mana}</small></button>`).join('');
  const knoepfe = Object.fromEntries([...leiste.children].map((b) => [b.dataset.z, b]));
  const karten = {};
  $('zliste').innerHTML = namen.map((n) => { const z = zauber[n]; return `<button class="zkarte" data-z="${n}" style="--f:${hex(z.farbe)}"><span class="sym">${z.symbol}</span><span class="txt"><b>${z.name}</b><em>${z.text}</em><small>💧 ${z.mana} · ⏱ ${z.abkling} s${z.schaden ? ' · 💥 ' + z.schaden : ''}${z.heilt ? ' · ❤ +' + z.heilt : ''}${z.schild ? ' · 🛡 ' + z.schild : ''}</small></span></button>`; }).join('');
  for (const b of $('zliste').children) karten[b.dataset.z] = b;
  function waehle(name, sichtbar = true) {
    if (!zauber[name]) return;
    gewaehlt = name;
    for (const n of namen) { knoepfe[n].classList.toggle('an', n === name); karten[n].classList.toggle('an', n === name); }
    $('bZaubern').textContent = `${zauber[name].symbol} ${zauber[name].name} (R)`;
    if (sichtbar) knoepfe[name].scrollIntoView?.({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
  }
  leiste.onclick = (e) => {
    const b = e.target.closest('.zk'); if (!b) return;
    if (b.dataset.z === gewaehlt) onZauber?.(gewaehlt); else waehle(b.dataset.z, false);
    b.blur();
  };
  $('zliste').onclick = (e) => { const b = e.target.closest('.zkarte'); if (b) waehle(b.dataset.z); };
  $('bZaubern').onclick = (e) => { onZauber?.(gewaehlt); e.currentTarget.blur(); };
  waehle(gewaehlt, false);

  // ---- Ausrüstung, Kamera, Schalter, Knöpfe ----
  $('ausr').innerHTML = `<button data-a="">🚫 nichts</button>` + ausruestung.map((n) => `<button data-a="${n}">${n}</button>`).join('');
  function setAusruestung(aktiv) { for (const b of $('ausr').children) b.classList.toggle('an', b.dataset.a ? aktiv.includes(b.dataset.a) : !aktiv.length); }
  $('ausr').onclick = (e) => { const b = e.target.closest('button'); if (b) setAusruestung(onAusruestung?.(b.dataset.a || null) || []); };
  setAusruestung([]);
  $('kameras').innerHTML = kameras.map((n, i) => `<button data-k="${n}"${i ? '' : ' class="an"'}>${n}</button>`).join('');
  $('kameras').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    for (const c of $('kameras').children) c.classList.toggle('an', c === b);
    onKamera?.(b.dataset.k);
  };
  blatt.addEventListener('click', (e) => {
    const s = e.target.closest('[data-schalter]'), k = e.target.closest('[data-knopf]');
    if (s) { s.classList.toggle('an'); onSchalter?.(s.dataset.schalter, s.classList.contains('an')); }
    if (k) onKnopf?.(k.dataset.knopf);
  });

  const lebenEl = $('hud').querySelector('.leben i'), manaEl = $('hud').querySelector('.mana i'), schildEl = $('hud').querySelector('.leben u');
  const alt = {};
  const setze = (schluessel, wert, fn) => { if (alt[schluessel] !== wert) { alt[schluessel] = wert; fn(wert); } };

  return {
    get gewaehlt() { return gewaehlt; },
    get offen() { return blatt.classList.contains('offen'); },
    /** Höhe bzw. Breite, die das offene Blatt verdeckt → { unten, links } in Pixeln (für den Kamera-Versatz). */
    verdeckt() {
      if (!blatt.classList.contains('offen')) return { unten: 0, links: 0 };
      const r = blatt.getBoundingClientRect();
      return r.width < innerWidth - 2 ? { unten: 0, links: r.width } : { unten: r.height, links: 0 };
    },
    waehle, oeffne, schliesse, setAusruestung,
    seite: (id) => seiten.find((s) => s.dataset.tab === id),
    melde(text) { const m = $('meldung'); m.textContent = text; m.classList.add('an'); meldeUhr = 1.4; },
    /** Pro Frame: Balken, Abklingzeiten, „zu wenig Mana“. buch = Zauberbuch, st = { leben, lebenMax, schild }. */
    update(dt, buch, st) {
      setze('leben', Math.round(st.leben / st.lebenMax * 100), (w) => { lebenEl.style.width = w + '%'; });
      setze('schild', Math.round(Math.min(1, st.schild / st.lebenMax) * 100), (w) => { schildEl.style.width = w + '%'; });
      setze('mana', Math.round(buch.mana / buch.manaMax * 100), (w) => { manaEl.style.width = w + '%'; });
      for (const n of namen) {
        setze('cd' + n, Math.round(buch.abklingAnteil(n) * 50) / 50, (w) => knoepfe[n].style.setProperty('--cd', w));
        setze('leer' + n, buch.mana < zauber[n].mana, (w) => knoepfe[n].classList.toggle('leer', w));
      }
      if (meldeUhr > 0 && (meldeUhr -= dt) <= 0) $('meldung').classList.remove('an');
    },
  };
}
