/**
 * @modul    oberflaeche-fenster
 * @zweck    Menü-Seiten fürs Spiel-Modul 'oberflaeche': Charakter (Werte, Ausrüstung), Inventar, Talente (3 Spalten), Karte, Optionen, Spielstände, Entwickler – alles über ui/menue, tolerant gegen fehlende Module
 * @api      baueFenster({menue,render,chat,api,opt,ereignisse,karte}) -> { dispose() } — Parameter api = { fort(), welt(), spieler(), ents(), kern } (Funktionen, geben null wenn Modul fehlt)
 * @beispiel
 *   const f = baueFenster({ menue, render, chat, api, opt: {}, ereignisse, karte });  // danach menue.zeige('charakter')
 * @tags     ui, menue, fenster, charakter, inventar, talente, karte, optionen, mmo
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { createInventarAnsicht } from '../ui/inventar-ansicht.js';

const SELTEN = { gewoehnlich: '#c8c8c8', selten: '#4aa3ff', episch: '#b46cff', legendaer: '#ffa63a' };
const SOCKEL = [['waffe', 'Waffe'], ['kopf', 'Kopf'], ['brust', 'Brust'], ['beine', 'Beine'], ['fuesse', 'Füße'], ['schmuck', 'Schmuck']];
const WERTE = [['staerke', 'Stärke'], ['intellekt', 'Intellekt'], ['geschick', 'Geschick'], ['ausdauer', 'Ausdauer'], ['ruestung', 'Rüstung'], ['schaden', 'Schaden'],
  ['zauberkraft', 'Zauberkraft'], ['krit', 'Krit'], ['tempo', 'Tempo'], ['leben', 'Leben'], ['mana', 'Mana']];
const KLASSEN = { krieger: 'Krieger', magier: 'Magier', waldlaeufer: 'Waldläufer' };
const GOLD = '#ffd45a', DIM = '#a6b0ba';

const el = (css, text, tag = 'div') => { const e = document.createElement(tag); e.style.cssText = css; if (text != null) e.textContent = text; return e; };
const knopfCss = 'box-sizing:border-box;margin:0;padding:6px 8px;font:inherit;color:#eef1f4;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:10px;text-align:left;touch-action:manipulation;cursor:pointer;';
/** Große Tipp-Fläche mit Titel (farbig) und kleinem Untertext. */
function zeile(titel, { farbe = '#eef1f4', sub = '', rand = null, klick = null, hoehe = 52 } = {}) {
  const b = el(`${knopfCss}width:100%;min-height:${hoehe}px;${rand ? `border-color:${rand};` : ''}`, null, 'button');
  b.type = 'button';
  b.append(el(`font-weight:700;color:${farbe};font-size:15px;`, titel));
  if (sub) b.append(el(`font-size:12px;color:${DIM};`, sub));
  if (klick) b.addEventListener('click', klick);
  return b;
}
const eintrag = (e) => ({ art: 'element', element: e });

export function baueFenster({ menue, render, chat, api, opt = {}, ereignisse, karte = null }) {
  const aufraeumen = [];
  const beschreibe = (item) => {
    const f = api.fort(); const id = typeof item === 'string' ? item : item?.id;
    const b = f?.beschreibe?.(id, typeof item === 'object' ? item?.daten : undefined);
    return { name: b?.name ?? String(id), zeilen: b?.zeilen ?? [], farbe: b?.farbe ?? SELTEN[item?.daten?.seltenheit] ?? SELTEN.gewoehnlich };
  };
  const nichts = (t) => [{ art: 'text', text: t }];
  const seite = (name, titel, eintraege) => menue.seite(name, { titel, zurueck: 'start', eintraege });

  menue.seite('start', { titel: 'Erlenwacht', schliessbar: true, eintraege: [
    { text: 'Charakter', zeichen: '🧍', nach: 'charakter' }, { text: 'Inventar', zeichen: '🎒', nach: 'inventar' },
    { text: 'Talente', zeichen: '🌿', nach: 'talente' }, { text: 'Karte', zeichen: '🗺', nach: 'karte' },
    { text: 'Optionen', zeichen: '⚙', nach: 'optionen' }, { text: 'Speichern / Laden', zeichen: '💾', nach: 'staende' },
    { text: 'Entwickler', zeichen: '🛠', nach: 'entwickler' }, { text: 'Weiter', schliesst: true } ] });

  // --- Charakter ---
  seite('charakter', 'Charakter', () => {
    const f = api.fort(); if (!f) return nichts('Das Fortschritts-Modul ist nicht aktiv.');
    const w = f.werte?.() || {};
    const raster = el('display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:14px;');
    for (const [k, n] of WERTE) if (w[k] != null) { const z = el('display:flex;justify-content:space-between;'); z.append(el(`color:${DIM};`, n), el('font-weight:700;', String(Math.round(w[k] * 10) / 10))); raster.append(z); }
    const liste = [{ art: 'text', text: `${f.held?.name ?? 'Held'} · ${KLASSEN[f.held?.klasse] ?? ''} · Stufe ${f.stufe}   (EP ${f.xp ?? 0} / ${f.xpNaechste ?? '–'})` }, eintrag(raster),
      { art: 'trenner' }, { art: 'text', text: 'Ausrüstung – antippen zum Ablegen' }];
    for (const [s, n] of SOCKEL) {
      const item = f.ausruestung?.hole?.(s);
      const b = item ? beschreibe(item) : null;
      liste.push(eintrag(zeile(`${n}: ${b ? b.name : '–'}`, { farbe: b ? b.farbe : DIM, rand: b ? b.farbe : null, sub: b ? b.zeilen.slice(0, 2).join(' · ') : 'leer',
        klick: b ? () => { f.ausruestung.ab(s); menue.aktualisiere(); } : null })));
    }
    return liste;
  });

  // --- Inventar (Ansicht einmal bauen, bleibt beim Seitenwechsel erhalten) ---
  let invAnsicht = null, invHoerer = null, detail = null, gewaehlt = -1;
  const faerbe = () => { const f = api.fort(); if (!invAnsicht || !f) return; invAnsicht.felder.forEach((b, i) => { const s = f.inventar.plaetze[i]; if (s?.daten) b.style.borderColor = beschreibe(s).farbe; }); };
  function inventarElement() {
    const f = api.fort(); if (!invAnsicht) {
      detail = el('font-size:13px;line-height:1.35;min-height:52px;color:' + DIM, 'Antippen = anlegen/benutzen · gedrückt halten = Beschreibung');
      invAnsicht = createInventarAnsicht({ inventar: f.inventar, register: f.register, spalten: 5, groesse: 58, breite: '100%', langMs: 350,
        gewaehlt: () => gewaehlt,
        onLang: (i, s) => { gewaehlt = i; if (!s) { detail.textContent = 'Leer'; return; } const b = beschreibe(s); detail.replaceChildren(el(`font-weight:700;color:${b.farbe};font-size:15px;`, `${b.name}${s.anzahl > 1 ? ' ×' + s.anzahl : ''}`), ...b.zeilen.map((t) => el('', t))); faerbe(); },
        onTipp: (i, s) => {
          gewaehlt = i; if (!s) return;
          const b = beschreibe(s); let ok = f.ausruestung?.lege?.(i);
          if (!ok && f.benutze) ok = f.benutze(i);
          chat.sende('system', ok ? `${b.name}: angelegt/benutzt.` : `${b.name} lässt sich nicht anlegen oder benutzen.`, { farbe: ok ? undefined : DIM });
        } });
      invHoerer = f.inventar.onAenderung?.(faerbe);
    }
    faerbe();
    return invAnsicht.element;
  }
  seite('inventar', 'Inventar', () => (api.fort()?.inventar ? [eintrag(inventarElement()), eintrag(detail)] : nichts('Kein Inventar (Fortschritt aus).')));
  const invTakt = setInterval(() => { if (menue.offen && menue.aktuell === 'inventar') invAnsicht?.update(0.05); }, 50);   // fürs Gedrückt-halten (Spiel pausiert evtl.)
  aufraeumen.push(() => { clearInterval(invTakt); invHoerer?.(); invAnsicht?.dispose(); });

  // --- Talente: Baum in 3 Spalten ---
  function talentListe(baum) {
    if (typeof baum === 'function') baum = baum();
    if (Array.isArray(baum) && baum.some((z) => Array.isArray(z?.talente))) return baum.flatMap((z) => z.talente.map((t) => ({ ...t, spalte: z.name ?? z.id })));
    if (Array.isArray(baum)) return baum;
    const out = [];
    for (const [k, v] of Object.entries(baum || {})) {
      if (Array.isArray(v)) v.forEach((t) => out.push({ spalte: k, ...t })); else if (v && typeof v === 'object') out.push({ id: k, ...v });
    }
    return out;
  }
  seite('talente', 'Talente', () => {
    const t = api.fort()?.talente; if (!t) return nichts('Keine Talente (Fortschritt aus).');
    const liste = talentListe(t.baum), spalten = new Map();
    liste.forEach((x, i) => { const k = x.spalte ?? x.zweig ?? x.baum ?? i % 3; if (!spalten.has(k)) spalten.set(k, []); spalten.get(k).push(x); });
    const reihe = el('display:flex;gap:6px;align-items:flex-start;');
    for (const [k, ts] of spalten) {
      const sp = el('flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:6px;');
      if (typeof k === 'string') sp.append(el(`font-size:12px;color:${GOLD};text-align:center;`, k));
      for (const x of ts) {
        const rang = t.stufe?.(x.id) ?? 0, max = x.max ?? x.stufen ?? 1;
        sp.append(zeile(x.name ?? x.id, { farbe: rang ? GOLD : '#eef1f4', rand: rang >= max ? GOLD : null, hoehe: 64, sub: `${rang}/${max}${x.voraus ? ' · ab ' + x.voraus + ' P.' : ''}`,
          klick: () => { const r = t.lerne(x.id); if (!r?.ok) chat.sende('system', r?.grund || 'Das geht noch nicht.'); menue.aktualisiere(); } }));
      }
      reihe.append(sp);
    }
    return [{ art: 'text', text: `Talentpunkte: ${t.punkte ?? 0}` }, eintrag(reihe)];
  });

  // --- Karte ---
  let karteCv = null;
  seite('karte', 'Karte', () => {
    if (!karte) return nichts('Keine Karte.');
    if (!karteCv) { karteCv = el('width:min(86vw,340px);height:min(86vw,340px);margin:0 auto;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:#10161a;', null, 'canvas'); karteCv.width = karteCv.height = 512; }
    karte.zeichneIn(karteCv, { radius: 2100, namen: true, rund: false });
    return [eintrag(karteCv), { art: 'text', text: 'Gelb = Orte · Rot = Feinde · Pfeil = du' }];
  });

  // --- Optionen ---
  const tonSpeicher = { lies: () => { try { return localStorage.getItem('erlenwacht:ton') !== '0'; } catch { return true; } }, schreibe: (an) => { try { localStorage.setItem('erlenwacht:ton', an ? '1' : '0'); } catch { /* egal */ } } };
  let ton = tonSpeicher.lies();
  seite('optionen', 'Optionen', [
    { art: 'auswahl', text: 'Qualität (lädt neu)', optionen: ['niedrig', 'mittel', 'hoch'], wert: () => render.stufe?.name ?? 'mittel',
      setze: (v) => { if (v === render.stufe?.name) return; const u = new URLSearchParams(globalThis.location?.search || ''); u.set('q', v); globalThis.location.search = u.toString(); } },
    { art: 'schalter', text: 'Ton', wert: () => ton, setze: (an) => { ton = an; tonSpeicher.schreibe(an); ereignisse.sende('ton', { an }); } },
  ]);

  // --- Speichern / Laden ---
  seite('staende', 'Speichern / Laden', () => {
    const l = [];
    if (opt.speichern) l.push({ text: 'Jetzt speichern', zeichen: '💾', aktion: () => { const ok = opt.speichern(); chat.sende('system', ok === false ? 'Speichern ging nicht.' : 'Spielstand gespeichert.'); } });
    if (opt.laden) l.push({ text: 'Letzten Stand laden', zeichen: '📂', aktiv: () => !opt.hatStand || opt.hatStand(), schliesst: true, aktion: () => { const ok = opt.laden(); chat.sende('system', ok === false ? 'Kein Spielstand da.' : 'Spielstand geladen.'); } });
    if (opt.zumTitel) l.push({ text: 'Zum Titelbildschirm', zeichen: '🏠', aktion: () => opt.zumTitel() });
    return l.length ? l : nichts('Speichern ist in diesem Start nicht angeschlossen.');
  });

  // --- Entwickler: Orte + Module an/aus (das alte ☰-Menü) ---
  const aus = new Set(render.url?.aus || []);
  seite('entwickler', 'Entwickler', () => {
    const l = [{ art: 'text', text: 'Zu Ort springen' }];
    const orte = api.welt()?.orte || [];
    for (let i = 0; i < orte.length; i += 2) l.push({ art: 'reihe', eintraege: orte.slice(i, i + 2).map((o) => ({ text: o.name, schliesst: true, aktion: () => api.spieler()?.teleport?.(o.x, o.z, o.blick) })) });
    l.push({ art: 'trenner' }, { art: 'text', text: 'Module (wirkt nach dem Neuladen)' });
    for (const m of opt.entwickler?.module || []) {
      const grund = api.kern.uebersprungen?.[m];
      l.push({ art: 'schalter', text: (opt.entwickler.info?.[m] || m) + (grund ? ' – ' + grund : ''), wert: () => !aus.has(m), setze: (an) => { if (an) aus.delete(m); else aus.add(m); } });
    }
    l.push({ text: 'Mit dieser Auswahl neu laden', zeichen: '🔄', aktion: () => { const u = new URLSearchParams(globalThis.location?.search || ''); if (aus.size) u.set('aus', [...aus].join(',')); else u.delete('aus'); globalThis.location.search = u.toString(); } });
    return l;
  });

  return { dispose() { for (const f of aufraeumen) f(); } };
}
