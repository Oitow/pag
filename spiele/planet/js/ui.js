// Oberfläche des Spiels: HUD (#hud), Toasts, Biom-Banner, Warnungen, Menüs (#menues).
// Wird von spiel.js mit einer internen Sicht (I) erzeugt.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function erzeugeUI(I) {
  const { ctx, S, T, SD } = I;
  const DATA = ctx.DATA, F = DATA.FAEHIGKEITEN;
  const hud = document.getElementById('hud'), men = document.getElementById('menues');
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const istSchmal = () => innerWidth < 520;

  // ================= HUD =================
  const top = el('div', 'ui-top');
  top.innerHTML = `
    <div class="ui-reihe">
      <button class="ui-balken" data-hud="essen" title="Tippen: essen (H)">
        <div class="ui-bar ui-bar-leben"><i></i><span></span></div>
        <div class="ui-bar ui-bar-ausdauer"><i></i><span></span></div>
      </button>
      <button class="ui-biom" data-hud="ziele" title="Biom">
        <div class="ui-biom-name"></div><div class="ui-biom-info"></div>
      </button>
      <button class="ui-kugel" data-hud="kugel" title="Fangkugel wechseln (K)">
        <span class="ui-kugel-icon"></span><b class="ui-kugel-n"></b><small class="ui-kugel-st"></small>
      </button>
      <button class="ui-menuknopf" data-hud="menu" title="Menü">☰</button>
    </div>
    <div class="ui-reihe ui-reihe2">
      <div class="ui-team"></div>
      <button class="ui-quest" data-hud="ziele"><span class="ui-quest-t"></span><b class="ui-quest-n"></b></button>
    </div>`;
  const mitte = el('div', 'ui-mitte');
  const warnEl = el('div', 'ui-warnung'); warnEl.hidden = true;
  const toastsEl = el('div', 'ui-toasts');
  mitte.append(warnEl, toastsEl);
  const banner = el('div', 'ui-banner', '<div class="ui-banner-name"></div><div class="ui-banner-sub"></div>');
  const vignette = el('div', 'ui-vignette');
  hud.append(vignette, top, mitte, banner);
  const q = sel => top.querySelector(sel);
  const H = {
    leben: q('.ui-bar-leben i'), lebenT: q('.ui-bar-leben span'), aus: q('.ui-bar-ausdauer i'), ausT: q('.ui-bar-ausdauer span'),
    biomName: q('.ui-biom-name'), biomInfo: q('.ui-biom-info'), biom: q('.ui-biom'),
    kugelIcon: q('.ui-kugel-icon'), kugelN: q('.ui-kugel-n'), kugelSt: q('.ui-kugel-st'), kugel: q('.ui-kugel'),
    team: q('.ui-team'), questT: q('.ui-quest-t'), questN: q('.ui-quest-n'), quest: q('.ui-quest'),
  };
  top.addEventListener('click', e => {
    const b = e.target.closest('[data-hud]'); if (!b) return;
    const a = b.dataset.hud;
    if (a === 'essen') I.essenBestes();
    else if (a === 'kugel') I.naechsteKugel();
    else if (a === 'menu') oeffne(letzterTab || 'inventar');
    else if (a === 'ziele') oeffne('ziele');
    else if (a === 'team') oeffne('team');
  });
  // Pointer-Events nicht in die Welt durchreichen (Kamera-Ziehen etc.)
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) top.addEventListener(ev, e => { if (e.target.closest('button')) e.stopPropagation(); }, { passive: true });

  let dirty = true, hudTimer = 0, teamSig = null;
  function tagesIcon() {
    const pl = ctx.planet, sp = ctx.spieler; if (!pl || !sp?.pos) return '☀️';
    const up = sp.pos.clone().normalize();
    const nacht = pl.istNacht?.(up);
    const h = pl.sunDir ? pl.sunDir.dot(up) : 0.5;
    if (nacht) return '🌙';
    return h < 0.18 ? '🌅' : '☀️';
  }
  function updateHud() {
    const l = Math.max(0, S.leben), a = Math.max(0, S.ausdauer);
    H.leben.style.width = l + '%'; H.lebenT.textContent = '❤️ ' + Math.ceil(l);
    H.aus.style.width = a + '%'; H.ausT.textContent = '⚡ ' + Math.floor(a);
    top.classList.toggle('ui-kritisch', l < 25);
    if (performance.now() - letzterTreffer > 1000) vignette.style.opacity = l < 25 ? String(0.22 + 0.12 * Math.sin(performance.now() / 300)) : '0';
    const b = T.biom, B = DATA.BIOME[b];
    if (B) {
      const g = B.gefahr ? (SD.GEFAHREN[B.gefahr]?.icon || '⚠️') : '';
      H.biomName.textContent = (SD.BIOM_ICON[b] || '') + ' ' + B.name;
      H.biomInfo.innerHTML = `<span class="ui-stern">★${B.stufe}</span>${g ? ' <span class="' + (T.gefahr ? 'ui-gefahr-an' : 'ui-gefahr') + '">' + g + '</span>' : ''} <span>${tagesIcon()}</span>`;
    } else { H.biomName.textContent = '🌍 Planet'; H.biomInfo.textContent = tagesIcon(); }
    // Kugel
    const k = I.aktiveKugel(), kd = DATA.KUGELN.find(x => x.id === k);
    H.kugelIcon.textContent = k ? I.itemIcon(k) : '⭕';
    H.kugelN.textContent = k ? I.inventar.count(k) : '0';
    H.kugelSt.textContent = kd ? 'St.' + kd.stufe : '–';
    H.kugel.classList.toggle('ui-leer', !k);
    H.kugel.classList.toggle('ui-zuschwach', !!(kd && B && kd.stufe < B.stufe));
    // Team
    const aktive = I.gefangenListe().filter(t => t.aktiv);
    const sig = aktive.map(t => t.uid + JSON.stringify(t.faehigkeiten)).join('|');
    if (sig !== teamSig) {
      teamSig = sig;
      H.team.innerHTML = aktive.length ? aktive.map(t => `<button class="ui-tk" data-hud="team" title="${esc(t.name)}"><span class="ui-tk-n">${esc(kurz(t.name))}</span>${faehIcons(t.faehigkeiten, true)}</button>`).join('')
        : '<button class="ui-tk ui-tk-leer" data-hud="team">🐾 kein Begleiter</button>';
    }
    // Quest
    const qu = I.aktuelleQuest();
    if (qu) { const f = I.questFortschritt(qu); H.questT.textContent = '🎯 ' + qu.titel; H.questN.textContent = f.soll > 1 ? f.ist + '/' + f.soll : ''; }
    else { H.questT.textContent = '🏆 Alle Ziele erreicht!'; H.questN.textContent = ''; }
  }
  const kurz = n => { n = String(n || ''); return n.length > 9 ? n.slice(0, 8) + '…' : n; };
  function faehIcons(f, mitStufe) {
    return Object.entries(f || {}).filter(([, s]) => s > 0).map(([n, s]) => `<span class="ui-fi" title="${esc(F[n]?.name || n)} ${s}">${F[n]?.icon || '•'}${mitStufe && s > 1 ? '<sub>' + s + '</sub>' : ''}</span>`).join('');
  }

  // ================= Toasts =================
  const itemToasts = {};
  let fangToastZeit = 0;
  function toast(text, ms = 2200, art = '') {
    text = String(text ?? '');
    if (!art && /gefangen!/.test(text)) { art = 'feier'; ms = Math.max(ms, 3600); fangToastZeit = performance.now(); }
    const t = el('div', 'ui-toast' + (art ? ' ui-toast-' + art : ''));
    t.textContent = text;
    toastsEl.append(t);
    while (toastsEl.children.length > 4) toastsEl.firstChild.remove();
    requestAnimationFrame(() => t.classList.add('ui-an'));
    const weg = () => { t.classList.remove('ui-an'); t.classList.add('ui-weg'); setTimeout(() => t.remove(), 350); };
    t._timer = setTimeout(weg, ms); t._weg = weg;
    return t;
  }
  function itemToast(id, n) {
    const alt = itemToasts[id];
    const text = c => `+${c} ${I.itemIcon(id)} ${I.itemName(id)}`;
    if (alt && alt.el.isConnected && !alt.el.classList.contains('ui-weg')) {
      alt.n += n; alt.el.textContent = text(alt.n);
      clearTimeout(alt.el._timer); alt.el._timer = setTimeout(alt.el._weg, 2000);
      alt.el.classList.remove('ui-puls'); void alt.el.offsetWidth; alt.el.classList.add('ui-puls');
      return;
    }
    itemToasts[id] = { n, el: toast(text(n), 2000, 'item') };
  }
  function feier(name, icons) {
    toast(`🎉 ${name} gefangen!${icons ? '  ' + icons : ''}`, 3600, 'feier');
  }

  // ================= Warnung, Vignette, Banner =================
  let warnSig = '';
  function warnung(info) {
    if (!info) { if (!warnEl.hidden) { warnEl.hidden = true; warnSig = ''; } return; }
    const sig = info.gefahr + info.titel + info.teilweise;
    if (sig === warnSig) return; warnSig = sig;
    warnEl.hidden = false;
    warnEl.className = 'ui-warnung' + (info.leicht ? ' ui-warnung-leicht' : '');
    warnEl.innerHTML = `<b>${info.icon} ${esc(info.titel)}</b>${info.teilweise ? ' <em>(Schutz zu schwach)</em>' : ''}<span>${esc(info.hilfe)}</span>`;
  }
  let vigT = null, letzterTreffer = 0;
  function treffer(staerke, quelle) {
    letzterTreffer = performance.now();
    const leicht = String(quelle || '').startsWith('gefahr:');
    vignette.style.transition = 'none';
    vignette.style.opacity = String(leicht ? Math.min(0.55, staerke) : Math.min(1, staerke + 0.2));
    clearTimeout(vigT);
    vigT = setTimeout(() => { vignette.style.transition = 'opacity .7s ease-out'; vignette.style.opacity = S.leben < 25 ? '0.35' : '0'; }, 60);
  }
  let bannerT = null, bannerBiom = null, bannerWarte = null;
  function biomBanner(biom) {
    if (!biom || biom === bannerBiom) return;
    if (hauptOffen) { bannerWarte = biom; return; }
    bannerBiom = biom;
    const B = DATA.BIOME[biom]; if (!B) return;
    const G = B.gefahr ? SD.GEFAHREN[B.gefahr] : null;
    banner.querySelector('.ui-banner-name').textContent = B.name;
    banner.querySelector('.ui-banner-sub').textContent = `Stufe ${B.stufe}` + (G ? `  ·  ${G.icon} ${G.titel.replace('!', '')}${B.gefahr === 'dunkel' ? ' (nachts)' : ''}` : '  ·  sicher');
    banner.classList.remove('ui-an'); void banner.offsetWidth; banner.classList.add('ui-an');
    clearTimeout(bannerT); bannerT = setTimeout(() => banner.classList.remove('ui-an'), 3200);
  }

  // ================= Menüs =================
  const TABS = [
    ['inventar', '🎒', 'Inventar', 'I'], ['craften', '🔨', 'Craften', 'C'], ['team', '🐾', 'Stall', 'T'],
    ['buch', '📖', 'Buch', 'B'], ['ziele', '🎯', 'Ziele', ''], ['hilfe', '❓', 'Hilfe', ''], ['system', '⚙️', 'Spiel', ''],
  ];
  const overlay = el('div', 'ui-overlay'); overlay.hidden = true;
  overlay.innerHTML = `<div class="ui-panel" role="dialog">
      <div class="ui-kopf"><div class="ui-tabs">${TABS.map(([id, ic, n, k]) => `<button class="ui-tab" data-tab="${id}" title="${n}${k ? ' (' + k + ')' : ''}"><span class="ui-tab-ic">${ic}</span><span class="ui-tab-n">${n}</span></button>`).join('')}</div>
      <button class="ui-zu" data-act="zu" title="Schließen (Esc)">✕</button></div>
      <div class="ui-titel"></div>
      <div class="ui-inhalt"></div>
      <div class="ui-fuss"></div></div>`;
  men.append(overlay);
  const panel = overlay.querySelector('.ui-panel'), inhalt = overlay.querySelector('.ui-inhalt'), fuss = overlay.querySelector('.ui-fuss'), titelEl = overlay.querySelector('.ui-titel');
  let aktTab = null, letzterTab = null;
  const M = { invSel: null, craftGruppe: 'alle', buchFilter: 'alle', seedOffen: false };

  function oeffne(tab = 'inventar', unter) {
    if (tab === 'craften' && unter) M.craftGruppe = unter;
    aktTab = tab; letzterTab = tab; overlay.hidden = false;
    for (const b of overlay.querySelectorAll('.ui-tab')) b.classList.toggle('ui-aktiv', b.dataset.tab === tab);
    inhalt.scrollTop = 0; render(true);
  }
  function schliesse() { overlay.hidden = true; aktTab = null; }
  const istOffen = () => !overlay.hidden || hauptOffen || !todEl.hidden;

  overlay.addEventListener('click', e => {
    if (e.target === overlay) return schliesse();
    const t = e.target.closest('[data-tab]'); if (t) return oeffne(t.dataset.tab);
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    aktion(b.dataset.act, b.dataset.v, b);
  });
  overlay.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.ui-seed')) aktion('neuewelt'); });
  for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'wheel']) overlay.addEventListener(ev, e => e.stopPropagation(), { passive: true });

  function aktion(a, v, btn) {
    switch (a) {
      case 'zu': return schliesse();
      case 'sel': M.invSel = M.invSel === v ? null : v; break;
      case 'essen': I.essen(v); break;
      case 'anlegen': I.anlegen(v); break;
      case 'ablegen': I.ablegen(v); break;
      case 'platzieren': if (I.platziereFeuer()) schliesse(); break;
      case 'kugel': I.waehleKugel(v); toast(I.itemIcon(v) + ' ' + I.itemName(v) + ' gewählt', 1400); break;
      case 'wegwerfen': { const n = I.inventar.count(v); if (n) { I.inventar.remove(v, n); toast('🗑️ ' + n + '× ' + I.itemName(v) + ' weggeworfen', 1600); } M.invSel = null; break; }
      case 'craft': I.craften(v); break;
      case 'cgruppe': M.craftGruppe = v; break;
      case 'aktiv': {
        const kr = ctx.kreaturen, t = I.gefangenListe().find(x => String(x.uid) === v); if (!t || !kr?.setAktiv) break;
        const max = kr.maxAktiv || 3, n = I.gefangenListe().filter(x => x.aktiv).length;
        if (!t.aktiv && n >= max) { toast(`Höchstens ${max} Begleiter – schicke erst einen in den Stall`, 2400, 'schlecht'); break; }
        const r = kr.setAktiv(t.uid, !t.aktiv);
        if (r === false) toast('Geht gerade nicht', 1400, 'schlecht');
        else toast(t.aktiv ? `🐾 ${t.name} begleitet dich` : `🏠 ${t.name} ruht im Stall`, 1600);
        teamSig = ''; break;
      }
      case 'bfilter': M.buchFilter = v; break;
      case 'speichern': toast(I.speichern() ? '💾 Gespeichert' : 'Speichern nicht möglich', 1600); break;
      case 'haupt': schliesse(); hauptmenue({ weiter: true }); return;
      case 'seedzeigen': M.seedOffen = true; break;
      case 'wuerfel': { const i = (btn.closest('.ui-seedbox') || document).querySelector('.ui-seed'); if (i) i.value = zufallsSeed(); return; }
      case 'neuewelt': {
        const i = document.querySelector('.ui-seedbox:not([hidden]) .ui-seed') || document.querySelector('.ui-seed');
        I.neueWelt(i?.value || zufallsSeed()); return;
      }
    }
    render(true);
  }
  const zufallsSeed = () => String(Math.floor(Math.random() * 900000) + 100000);

  function render(sofort) {
    if (!aktTab) return;
    const st = inhalt.scrollTop;
    const tab = TABS.find(t => t[0] === aktTab);
    titelEl.textContent = tab ? tab[1] + ' ' + ({ buch: 'Sammelbuch', team: 'Stall & Begleiter' }[tab[0]] || tab[2]) : '';
    fuss.innerHTML = ''; fuss.hidden = true;
    const r = { inventar: renderInventar, craften: renderCraften, team: renderTeam, buch: renderBuch, ziele: renderZiele, hilfe: renderHilfe, system: renderSystem }[aktTab];
    inhalt.innerHTML = r ? r() : '';
    inhalt.scrollTop = st;
  }

  // ---------- Inventar ----------
  function itemText(id) {
    const a = SD.AUSRUESTUNG[id], n = SD.NAHRUNG[id], k = DATA.KUGELN.find(x => x.id === id);
    if (a) return a.text;
    if (n) return `Essen: +${n.leben} ❤️` + (n.ausdauer ? ` +${n.ausdauer} ⚡` : '') + (n.regen ? ` · ${n.regen} s Regeneration` : '');
    if (k) return kugelText(k);
    return SD.ITEM_TEXT[id] || '';
  }
  function kugelText(k) {
    const biome = Object.entries(DATA.BIOME).filter(([, b]) => b.stufe === k.stufe).map(([id, b]) => (SD.BIOM_ICON[id] || '') + ' ' + b.name);
    return `Stufe ${k.stufe}${k.bonus ? ` · +${Math.round(k.bonus * 100)} % Fangchance` : ''}` + (biome.length ? ` · für ${biome.join(', ')}` : '');
  }
  function sortSchluessel(id) {
    if (id.startsWith('kugel_')) return '0' + (DATA.KUGELN.findIndex(k => k.id === id) + 10);
    if (SD.NAHRUNG[id]) return '1' + id;
    if (SD.AUSRUESTUNG[id] || id === 'lagerfeuer') return '2' + id;
    return '3' + Object.keys(DATA.ITEMS).indexOf(id).toString().padStart(3, '0');
  }
  function renderInventar() {
    const liste = I.inventar.liste().sort((a, b) => sortSchluessel(a.id) < sortSchluessel(b.id) ? -1 : 1);
    const kugel = I.aktiveKugel();
    let h = `<div class="ui-zeile"><span class="ui-platz">🎒 Plätze <b>${I.inventar.slots}/${I.inventar.maxSlots}</b></span>
      <span class="ui-werte">❤️ ${Math.ceil(S.leben)} · ⚡ ${Math.floor(S.ausdauer)}</span></div>`;
    h += '<div class="ui-slots">' + Object.entries(SD.SLOTS).map(([slot, name]) => {
      const id = S.ausgeruestet[slot], a = SD.AUSRUESTUNG[id];
      const proz = a?.dauer ? Math.max(0, Math.min(100, (S.zustand[id] ?? a.dauer) / a.dauer * 100)) : null;
      return `<button class="ui-slot${id ? '' : ' ui-slot-leer'}" ${id ? `data-act="sel" data-v="${id}"` : 'disabled'}>
        <span class="ui-slot-ic">${id ? I.itemIcon(id) : '·'}</span><small>${name}</small>${proz != null ? `<i class="ui-haltbar"><i style="width:${proz}%"></i></i>` : ''}</button>`;
    }).join('') + '</div>';
    if (!liste.length) h += '<p class="ui-leertext">Dein Inventar ist leer. Sammle Holz, Steine und Fasern!</p>';
    h += '<div class="ui-grid">' + liste.map(it => {
      const marke = I.istAngelegt(it.id) ? '<em class="ui-marke">✓</em>' : it.id === kugel ? '<em class="ui-marke">🎯</em>' : '';
      return `<button class="ui-item${M.invSel === it.id ? ' ui-sel' : ''}" data-act="sel" data-v="${it.id}" title="${esc(it.name)}">
        <span class="ui-item-ic">${it.icon}</span><b>${it.n}</b>${marke}<small>${esc(it.name)}</small></button>`;
    }).join('') + '</div>';
    // Detail im Fuß
    const id = M.invSel;
    if (id && I.inventar.count(id) > 0) {
      const btns = [];
      if (SD.NAHRUNG[id]) btns.push(`<button class="ui-knopf ui-gut" data-act="essen" data-v="${id}">🍽️ Essen</button>`);
      if (SD.AUSRUESTUNG[id]) btns.push(I.istAngelegt(id) ? `<button class="ui-knopf" data-act="ablegen" data-v="${SD.AUSRUESTUNG[id].slot}">Ablegen</button>` : `<button class="ui-knopf ui-gut" data-act="anlegen" data-v="${id}">Anlegen</button>`);
      if (id === 'lagerfeuer') btns.push(`<button class="ui-knopf ui-gut" data-act="platzieren">🏕️ Platzieren</button>`);
      if (id.startsWith('kugel_')) btns.push(id === kugel ? '<button class="ui-knopf" disabled>🎯 Gewählt</button>' : `<button class="ui-knopf ui-gut" data-act="kugel" data-v="${id}">🎯 Wählen</button>`);
      btns.push(`<button class="ui-knopf ui-klein" data-act="wegwerfen" data-v="${id}" title="Alles wegwerfen">🗑️</button>`);
      fuss.hidden = false;
      fuss.innerHTML = `<div class="ui-detail"><span class="ui-detail-ic">${I.itemIcon(id)}</span><div class="ui-detail-t"><b>${esc(I.itemName(id))} ×${I.inventar.count(id)}</b><small>${esc(itemText(id))}</small></div></div><div class="ui-knoepfe">${btns.join('')}</div>`;
    }
    return h;
  }

  // ---------- Craften ----------
  function renderCraften() {
    const amFeuer = I.amFeuer();
    let h = '<div class="ui-chips">' + [['alle', 'Alle'], ...Object.entries(SD.REZEPT_GRUPPEN)].map(([g, n]) =>
      `<button class="ui-chip${M.craftGruppe === g ? ' ui-aktiv' : ''}" data-act="cgruppe" data-v="${g}">${n}</button>`).join('') + '</div>';
    if (amFeuer) h += '<p class="ui-hinweis ui-gut-t">🔥 Du stehst am Lagerfeuer – hier kannst du kochen.</p>';
    const rez = SD.REZEPTE.filter(r => M.craftGruppe === 'alle' || r.gruppe === M.craftGruppe);
    h += '<div class="ui-rezepte">' + rez.map(r => {
      const fehlt = I.fehlendeZutaten(r), ok = I.kannCraften(r);
      const zut = Object.entries(r.zutaten).map(([id, n]) => {
        const c = I.inventar.count(id);
        return `<span class="ui-zutat${c >= n ? ' ui-hat' : ' ui-fehlt'}" title="${esc(I.itemName(id))}">${I.itemIcon(id)} ${esc(I.itemName(id))} <b>${Math.min(c, 999)}/${n}</b></span>`;
      }).join('');
      const station = r.station === 'feuer' ? `<span class="ui-zutat ${amFeuer ? 'ui-hat' : 'ui-fehlt'}">🔥 am Lagerfeuer</span>` : '';
      const fehltTxt = r.station === 'feuer' && !amFeuer ? 'Stell dich an ein Lagerfeuer' : '';
      return `<div class="ui-rezept${ok ? ' ui-ok' : ''}">
        <span class="ui-rezept-ic">${I.itemIcon(r.id)}</span>
        <div class="ui-rezept-t"><b>${esc(I.itemName(r.id))}${r.n > 1 ? ' ×' + r.n : ''}</b><small>${esc(itemText(r.id))}</small>
          <div class="ui-zutaten">${zut}${station}</div>${fehltTxt ? `<small class="ui-fehlt-t">${esc(fehltTxt)}</small>` : ''}</div>
        <button class="ui-knopf${ok ? ' ui-gut' : ''}" data-act="craft" data-v="${r.id}" ${ok ? '' : 'disabled'}>🔨<span class="ui-knopf-n"> Herstellen</span></button>
      </div>`;
    }).join('') + '</div>';
    return h;
  }

  // ---------- Stall / Team ----------
  function renderTeam() {
    const kr = ctx.kreaturen, liste = I.gefangenListe().slice();
    const max = kr?.maxAktiv || 3, aktiv = liste.filter(t => t.aktiv).length;
    let h = '<h3 class="ui-h">Deine Fähigkeiten</h3><div class="ui-faeh">';
    const quellIcon = { tier: '🐾', ausruestung: '🧥', feuer: '🔥' };
    const alle = Object.keys(F).map(n => [n, I.faehigkeit(n), I.faehigkeitQuelle(n)]).sort((a, b) => (b[1] > 0) - (a[1] > 0));
    h += alle.map(([n, s, qu]) => `<span class="ui-fchip${s > 0 ? '' : ' ui-aus'}" title="${esc(F[n].text)}">${F[n].icon} ${F[n].name} <b>${s || '–'}</b>${qu ? ' <small>' + quellIcon[qu] + '</small>' : ''}</span>`).join('');
    h += '</div><p class="ui-hinweis">🐾 = von Begleitern · 🧥 = Ausrüstung · 🔥 = Lagerfeuer in der Nähe. Es zählt immer die höchste Stufe.</p>';
    h += `<h3 class="ui-h">Begleiter <span class="ui-zahl">${aktiv}/${max} aktiv</span></h3>`;
    if (!kr || !Array.isArray(kr.gefangen)) return h + '<p class="ui-leertext">Die Tierwelt erwacht noch…</p>';
    if (!liste.length) return h + '<p class="ui-leertext">Noch keine Tiere gefangen. Schwäche ein Tier und wirf eine Fangkugel (Q / Rechtsklick / 🟢-Knopf).</p>';
    liste.sort((a, b) => (b.aktiv - a.aktiv) || ((b.stufe || 0) - (a.stufe || 0)));
    h += '<div class="ui-tiere">' + liste.map(t => {
      const fs = Object.entries(t.faehigkeiten || {}).filter(([, s]) => s > 0).map(([n, s]) => `<span class="ui-fchip ui-klein">${F[n]?.icon || ''} ${esc(F[n]?.name || n)} ${s}</span>`).join('') || '<small class="ui-leertext">keine Fähigkeit</small>';
      const voll = !t.aktiv && aktiv >= max;
      return `<div class="ui-tier${t.aktiv ? ' ui-aktiv' : ''}">
        <div class="ui-tier-t"><b>${esc(t.name || t.id)}</b> <small>Stufe ${t.stufe ?? '?'}</small><div class="ui-zutaten">${fs}</div></div>
        <button class="ui-knopf${t.aktiv ? ' ui-gut' : ''}${voll ? ' ui-grau' : ''}" data-act="aktiv" data-v="${esc(t.uid)}">${t.aktiv ? '🐾 Dabei' : '🏠 Im Stall'}</button></div>`;
    }).join('') + '</div>';
    return h;
  }

  // ---------- Sammelbuch ----------
  function renderBuch() {
    const lex = I.lexikon();
    const total = lex.length || 148, gef = lex.filter(e => e.gefangen).length, ges = lex.filter(e => e.gesehen && !e.gefangen).length;
    let h = `<div class="ui-fortschritt"><div class="ui-fbar"><i style="width:${gef / total * 100}%"></i></div>
      <span><b>${gef}/${total}</b> gefangen · ${ges} gesehen</span></div>`;
    h += '<div class="ui-chips">' + [['alle', 'Alle'], ['gefangen', 'Gefangen'], ['gesehen', 'Gesehen'], ['fehlt', 'Fehlend']].map(([f, n]) =>
      `<button class="ui-chip${M.buchFilter === f ? ' ui-aktiv' : ''}" data-act="bfilter" data-v="${f}">${n}</button>`).join('') + '</div>';
    if (!lex.length) return h + '<p class="ui-leertext">Das Sammelbuch füllt sich, sobald du Tiere entdeckst.</p>';
    const filt = lex.filter(e => M.buchFilter === 'alle' || (M.buchFilter === 'gefangen' ? e.gefangen : M.buchFilter === 'gesehen' ? e.gesehen && !e.gefangen : !e.gefangen));
    h += '<div class="ui-buch">' + filt.map((e, i) => {
      const bi = (e.biome || []).map(b => SD.BIOM_ICON[b] || '').join('');
      if (e.gefangen) return `<div class="ui-karte ui-gefangen"><span class="ui-karte-bi">${bi}</span><b>${esc(e.name)}</b><small>★${e.stufe ?? '?'} ${faehIcons(e.faehigkeiten, true)}</small></div>`;
      if (e.gesehen) return `<div class="ui-karte ui-gesehen"><span class="ui-karte-bi">${bi}</span><b>???</b><small>gesehen · ★${e.stufe ?? '?'}</small></div>`;
      return `<div class="ui-karte ui-unbekannt"><span class="ui-karte-bi">❔</span><b>???</b><small>Nr. ${lex.indexOf(e) + 1}</small></div>`;
    }).join('') + '</div>';
    return h;
  }

  // ---------- Ziele ----------
  function renderZiele() {
    const qu = I.aktuelleQuest();
    let h = '';
    if (qu) {
      const f = I.questFortschritt(qu);
      const bel = qu.belohnung ? Object.entries(qu.belohnung).map(([id, n]) => `${n}× ${I.itemIcon(id)}`).join(' ') : '';
      h += `<div class="ui-questkarte"><small>Aktuelles Ziel</small><b>🎯 ${esc(qu.titel)}</b><p>${esc(qu.hilfe)}</p>
        <div class="ui-fbar"><i style="width:${f.ist / f.soll * 100}%"></i></div><span>${f.ist}/${f.soll}${bel ? ' · Belohnung: ' + bel : ''}</span></div>`;
      const next = SD.QUESTS.slice(S.quest + 1, S.quest + 3);
      if (next.length) h += '<h3 class="ui-h">Danach</h3><ul class="ui-qliste">' + next.map(x => `<li class="ui-spaeter">🔒 ${esc(x.titel)}</li>`).join('') + '</ul>';
    } else h += '<div class="ui-questkarte"><b>🏆 Alle Ziele erreicht!</b><p>Du hast den Planeten gemeistert. Erkunde weiter und vervollständige dein Sammelbuch.</p></div>';
    const fertig = SD.QUESTS.filter(x => S.questsFertig.includes(x.id));
    if (fertig.length) h += `<h3 class="ui-h">Erledigt <span class="ui-zahl">${fertig.length}/${SD.QUESTS.length}</span></h3><ul class="ui-qliste">` + fertig.slice().reverse().map(x => `<li>✅ ${esc(x.titel)}</li>`).join('') + '</ul>';
    // aktuelle Biom-Info
    const B = DATA.BIOME[T.biom];
    if (B) {
      const G = B.gefahr ? SD.GEFAHREN[B.gefahr] : null, sch = B.gefahr ? SD.schutzFuer(B.gefahr) : null;
      h += `<h3 class="ui-h">Hier: ${SD.BIOM_ICON[T.biom] || ''} ${esc(B.name)}</h3><p class="ui-hinweis">Stufe ${B.stufe} – Tiere hier brauchen Fangkugeln ab Stufe ${B.stufe}.` +
        (G ? ` Gefahr: ${G.icon} ${esc(G.titel)} ${sch ? `Schutz: ${F[sch].icon} ${F[sch].name} ${DATA.GEFAHR_STUFE[B.gefahr] || 1} (du hast ${I.faehigkeit(sch)}).` : ''}` : ' Keine Umweltgefahr.') + '</p>';
    }
    return h;
  }

  // ---------- Hilfe ----------
  function renderHilfe() {
    const zeile = (k, t) => `<tr><td><kbd>${k}</kbd></td><td>${t}</td></tr>`;
    return `<div class="ui-hilfe">
      <h3 class="ui-h">So spielst du</h3>
      <ul class="ui-tipps">
        <li>🐾 <b>Fange Tiere</b>: erst schwächen, dann Fangkugel werfen. Die Kugel-Stufe muss zur Biom-Stufe passen.</li>
        <li>💡 <b>Begleiter schützen dich</b>: Jedes Biom hat eine Gefahr (Dunkelheit, Gift, Kälte, Hitze, Tiefe). Ein Tier mit der passenden Fähigkeit macht dich immun.</li>
        <li>🔨 <b>Crafte</b> bessere Fangkugeln aus den Erzen des nächsten Bioms.</li>
        <li>🏕️ <b>Lagerfeuer</b> wärmt, heilt und ist dein Respawn-Punkt. Dort kannst du Fleisch braten.</li>
        <li>💀 Beim Tod verlierst du ${Math.round(SD.TOD_VERLUST * 100)} % deiner Rohstoffe – Kugeln und Ausrüstung bleiben.</li>
      </ul>
      <h3 class="ui-h">💻 Tastatur & Maus</h3>
      <table class="ui-tasten">
        ${zeile('W A S D', 'Laufen')}${zeile('Maus ziehen', 'Kamera drehen')}${zeile('Leertaste', 'Springen')}${zeile('Shift', 'Sprinten (Ausdauer)')}
        ${zeile('Linksklick / F', 'Angreifen, Bäume fällen, abbauen')}${zeile('Q / Rechtsklick', 'Fangkugel werfen')}${zeile('E', 'Interagieren / Sammeln')}
        ${zeile('R', 'Reiten an/aus')}${zeile('M', 'Planeten-Karte')}${zeile('K', 'Fangkugel wechseln')}${zeile('H', 'Essen')}
        ${zeile('I', 'Inventar')}${zeile('C', 'Craften')}${zeile('T', 'Stall / Begleiter')}${zeile('B', 'Sammelbuch')}${zeile('Esc', 'Menü schließen')}
      </table>
      <h3 class="ui-h">📱 Touch</h3>
      <table class="ui-tasten">
        ${zeile('Joystick links unten', 'Laufen')}${zeile('Rechts ziehen', 'Kamera drehen')}${zeile('Knöpfe rechts unten', 'Angriff, Werfen, Springen, Interagieren')}
        ${zeile('❤️-Leiste antippen', 'Essen')}${zeile('Kugel-Knopf oben', 'Fangkugel wechseln')}${zeile('☰', 'Menü')}
      </table></div>`;
  }

  // ---------- System ----------
  function renderSystem() {
    const st = S.stat;
    return `<div class="ui-zeile"><span>🌍 Welt-Seed: <b>${esc(ctx.seedText)}</b></span></div>
      <p class="ui-hinweis">Gefangen: ${st.gefangen} · Hergestellt: ${st.gecraftet} · Tode: ${st.tode} · Ziele: ${S.questsFertig.length}/${SD.QUESTS.length}</p>
      <div class="ui-knoepfe ui-spalte">
        <button class="ui-knopf ui-gross" data-act="speichern">💾 Jetzt speichern</button>
        <button class="ui-knopf ui-gross" data-act="haupt">🏠 Hauptmenü</button>
      </div>
      <h3 class="ui-h">Neue Welt</h3>
      <p class="ui-hinweis">Erschafft einen neuen Planeten. <b>Dein aktueller Spielstand wird gelöscht.</b></p>
      ${seedBox()}`;
  }
  const seedBox = () => `<div class="ui-seedbox"><input class="ui-seed" type="text" inputmode="numeric" maxlength="40" value="${zufallsSeed()}" aria-label="Seed">
      <button class="ui-knopf" data-act="wuerfel" title="Zufällig">🎲</button><button class="ui-knopf ui-gut" data-act="neuewelt">🌍 Erschaffen</button></div>`;

  // ================= Hauptmenü =================
  const haupt = el('div', 'ui-haupt'); haupt.hidden = true; men.append(haupt);
  let hauptOffen = false;
  function hauptmenue({ weiter } = {}) {
    hauptOffen = true; haupt.hidden = false;
    const sv = I.leseSave();
    const wann = sv?.zeit ? new Date(sv.zeit).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '';
    haupt.innerHTML = `<div class="ui-haupt-box">
      <div class="ui-logo">🪐</div><h1>Planet</h1><p class="ui-unter">Tierfänger</p>
      <div class="ui-knoepfe ui-spalte">
        <button class="ui-knopf ui-gross ui-gut" data-h="weiter">${weiter ? '▶ Weiter' : '▶ Losspielen'}<small>Welt ${esc(ctx.seedText)}${weiter && wann ? ' · ' + wann : ''}</small></button>
        <button class="ui-knopf ui-gross" data-h="neu">🌍 Neue Welt</button>
        <div class="ui-neu" hidden><p class="ui-hinweis">Seed für den neuen Planeten (gleicher Seed = gleiche Welt)${weiter ? '. <b>Der aktuelle Spielstand wird gelöscht.</b>' : '.'}</p>${seedBox()}</div>
        <button class="ui-knopf ui-gross" data-h="hilfe">❓ Hilfe & Steuerung</button>
      </div></div>`;
  }
  haupt.addEventListener('click', e => {
    const b = e.target.closest('[data-h],[data-act]'); if (!b) return;
    if (b.dataset.act) return aktion(b.dataset.act, b.dataset.v, b);
    const a = b.dataset.h;
    if (a === 'weiter') { schliesseHaupt(); if (T.istNeu) willkommen(true); }
    else if (a === 'neu') { const n = haupt.querySelector('.ui-neu'); n.hidden = !n.hidden; if (!n.hidden) n.querySelector('.ui-seed')?.focus(); }
    else if (a === 'hilfe') { schliesseHaupt(); oeffne('hilfe'); }
  });
  haupt.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.ui-seed')) aktion('neuewelt'); });
  for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'wheel']) haupt.addEventListener(ev, e => e.stopPropagation(), { passive: true });
  function schliesseHaupt() {
    hauptOffen = false; haupt.hidden = true;
    if (bannerWarte) { const b = bannerWarte; bannerWarte = null; setTimeout(() => biomBanner(b), 300); }
  }
  function willkommen(neu) {
    if (neu) {
      toast('🌍 Willkommen auf Planet ' + ctx.seedText + '!', 3200, 'quest');
      const qu = I.aktuelleQuest(); if (qu) setTimeout(() => toast('🎯 Ziel: ' + qu.titel, 3600, 'quest'), 1200);
    } else toast('▶ Spielstand geladen', 1800);
  }

  // ================= Tod =================
  const todEl = el('div', 'ui-tod'); todEl.hidden = true; men.append(todEl);
  let todT = null;
  function todesBildschirm({ verlust, amFeuer }) {
    todEl.hidden = false;
    const v = verlust.length ? verlust.map(([id, n]) => `<span class="ui-zutat ui-fehlt">−${n} ${I.itemIcon(id)} ${esc(I.itemName(id))}</span>`).join('') : '<span class="ui-leertext">Nichts verloren.</span>';
    todEl.innerHTML = `<div class="ui-tod-box"><div class="ui-logo">💀</div><h2>Du bist gestorben</h2>
      <p>${amFeuer ? '🏕️ Du erwachst an deinem Lagerfeuer.' : '🌼 Du erwachst am Startpunkt. Ein Lagerfeuer wäre ein besserer Respawn-Punkt!'}</p>
      <div class="ui-zutaten ui-mitte-z">${v}</div>
      <button class="ui-knopf ui-gross ui-gut" data-tod="ok">Weiter</button></div>`;
    clearTimeout(todT); todT = setTimeout(() => { todEl.hidden = true; }, 7000);
    vignette.style.opacity = '0';
  }
  todEl.addEventListener('click', e => { if (e.target.closest('[data-tod]') || e.target === todEl) { todEl.hidden = true; } });
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) todEl.addEventListener(ev, e => e.stopPropagation(), { passive: true });

  // ================= Tastatur =================
  addEventListener('keydown', e => {
    if (e.target?.matches?.('input, textarea')) { if (e.key === 'Escape') e.target.blur(); return; }
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      if (!todEl.hidden) todEl.hidden = true;
      else if (!overlay.hidden) schliesse();
      else if (hauptOffen) schliesseHaupt();
      else oeffne(letzterTab || 'inventar');
      return;
    }
    if (hauptOffen) return;
    const map = { i: 'inventar', c: 'craften', t: 'team', b: 'buch' };
    if (map[k]) { if (aktTab === map[k]) schliesse(); else oeffne(map[k]); return; }
    if (k === 'k') I.naechsteKugel();
    else if (k === 'h') I.essenBestes();
    else if (/^[1-7]$/.test(k) && !aktTab) { const kd = DATA.KUGELN[+k - 1]; if (kd && I.inventar.count(kd.id)) { I.waehleKugel(kd.id); toast(I.itemIcon(kd.id) + ' ' + I.itemName(kd.id), 1200); } }
  });

  // ================= Takt =================
  function update(dt) {
    hudTimer += dt;
    if (hudTimer > 0.2) { hudTimer = 0; updateHud(); if (dirty && aktTab && aktTab !== 'system' && aktTab !== 'hilfe' && !overlay.contains(document.activeElement?.matches?.('input') ? document.activeElement : null)) { dirty = false; render(); } }
  }
  updateHud();

  return {
    toast, itemToast, feier, kuerzlichFangToast: () => performance.now() - fangToastZeit < 800, warnung, treffer, biomBanner, hauptmenue, willkommen, todesBildschirm,
    oeffne, schliesse, istOffen, update, markDirty() { dirty = true; },
  };
}
