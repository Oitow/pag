/**
 * @modul    modul-oberflaeche
 * @zweck    Spiel-Modul 'oberflaeche': Spieler-Rahmen (Name, Stufe, Leben, Ressource, EP), Ziel-Rahmen, Minikarte, Chat (hört auf alle Ereignisse), ☰-Menü mit Fenstern Charakter/Inventar/Talente/Karte/Optionen/Spielstand/Entwickler, Stufenaufstiegs-Einblendung – alles tolerant, wenn Nachbarmodule fehlen
 * @api      OBERFLAECHE_MODUL -> api { chat, menue, hud, minikarte, zeigeFenster(name), banner(text,farbe) }
 * @beispiel
 *   createSpiel({ module: [..., OBERFLAECHE_MODUL], optionen: { oberflaeche: { name: 'Goi', speichern: () => …, laden: () => … } } });
 *   spiel.api('oberflaeche').chat.sende('system', 'Willkommen!');   // oder Ereignis chat:sende {kanal,text}
 * @tags     spiel, modul, ui, hud, chat, menue, minikarte, talente, inventar, mmo, handy
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Optionen: name (sonst Spieler-Name), pause(bool) (Menü pausiert das Spiel; fehlt = keine Pause), speichern() / laden() / hatStand() / zumTitel(),
 *   entwickler { module: [Namen], info: {Name: Text} }. Takt: eigene Schleife (requestAnimationFrame), DOM höchstens 10×/s und nur bei Änderung.
 * Ereignisse, die in den Chat laufen: fort:xp|stufe|beute|ausgeruestet|talent, kampf:faehigkeit, aufgabe:neu|schritt|fertig, chat:sende, gegner:boss, ent:tod.
 */
import { createChat } from '../ui/chat.js';
import { createMenue } from '../ui/menue.js';
import { createHud } from '../ui/hud.js';
import { createZielRahmen } from '../ui/ziel-rahmen.js';
import { createMinikarte } from '../ui/minikarte.js';
import { baueFenster } from './oberflaeche-fenster.js';

const KLASSEN = { krieger: 'Krieger', magier: 'Magier', waldlaeufer: 'Waldläufer' };
const RESSOURCE = { mana: '#4a8fe8', wut: '#d8453a', energie: '#e0c040', fokus: '#58c070' };
const SELTEN = { gewoehnlich: '#c8c8c8', selten: '#4aa3ff', episch: '#b46cff', legendaer: '#ffa63a' };
const el = (css, text) => { const e = document.createElement('div'); e.style.cssText = css; if (text != null) e.textContent = text; return e; };

let laufend = null;   // Aufräum-Funktion der laufenden Instanz (Kern ruft dispose ohne ctx)

export const OBERFLAECHE_MODUL = {
  name: 'oberflaeche', braucht: ['render'],
  optional: ['welt', 'himmel', 'entitaeten', 'spieler', 'zauber', 'gegner', 'fortschritt', 'kampf', 'tutorial'],
  standard: { name: null, pause: null, speichern: null, laden: null, hatStand: null, zumTitel: null, entwickler: null },
  start(ctx) {
    const render = ctx.braucht('render'), ui = render.ui, o = ctx.optionen, bus = ctx.ereignisse;
    if (!ui || !globalThis.document) return {};
    const api = {
      fort: () => ctx.optional('fortschritt'), welt: () => ctx.optional('welt'), spieler: () => ctx.optional('spieler'),
      ents: () => ctx.optional('entitaeten'), kern: ctx.kern,
    };
    const ab = [];                                                        // Abmelder / Aufräumer
    const spielerName = () => o.name || api.fort()?.held?.name || api.spieler()?.figur?.name || 'Du';

    // --- Chat + Befehle ---
    const chat = createChat({ eltern: ui, name: spielerName() });
    const sp = () => api.spieler();
    chat.befehl('ort', ([id]) => {
      const w = api.welt(); if (!w?.orte) return 'Keine Welt.';
      const ort = id && w.ort?.(id);
      if (!ort) return 'Orte: ' + w.orte.map((x) => x.id).join(', ');
      sp()?.teleport?.(ort.x, ort.z, ort.blick); return `Du reist nach ${ort.name}.`;
    }, '/ort <id> – dorthin springen');
    chat.befehl('stufe', ([n]) => {
      const f = api.fort(); if (!f) return 'Kein Fortschritt-Modul.';
      for (let i = 0; i < 30 && n && f.stufe < Number(n); i++) f.gibXp(Math.max(1, (f.xpNaechste ?? 100) - (f.xp ?? 0)), 'Befehl');
      return `Du bist Stufe ${f.stufe} (EP ${f.xp ?? 0}/${f.xpNaechste ?? '–'}).`;
    }, '/stufe [n] – Stufe zeigen oder erreichen');
    chat.befehl('zeit', ([h]) => {
      const hi = ctx.optional('himmel'); if (!hi?.setzeStunde) return 'Kein Himmel.';
      if (h != null && Number.isFinite(+h)) hi.setzeStunde(+h);
      const s = hi.uhr?.stunde ?? +h; return `Es ist ${String(Math.floor(s)).padStart(2, '0')}:${String(Math.floor((s % 1) * 60)).padStart(2, '0')} Uhr.`;
    }, '/zeit <stunde>');
    chat.befehl('wer', () => {
      const e = api.ents(), p = sp()?.position; if (!e?.imUmkreis || !p) return 'Niemand zu sehen.';
      const n = e.imUmkreis(p.x, p.z, 40, { ausser: sp()?.id }).filter((x) => x.lebt !== false).map((x) => x.name || x.art);
      return n.length ? 'In der Nähe: ' + [...new Set(n)].join(', ') : 'Niemand in 40 m Umkreis.';
    }, '/wer – wer ist in der Nähe');
    chat.befehl('tanz', () => {
      const f = sp()?.figur; for (const c of ['tanzen', 'tanz', 'winken']) if (f?.aktion?.(c)) return null;
      return 'Du wiegst dich ein wenig.';
    }, '/tanz');
    chat.befehl('heilen', () => { const e = api.ents(), id = sp()?.id; if (e?.heile && id != null) e.heile(id, 9999); return 'Du fühlst dich besser.'; }, '/heilen');
    chat.sende('system', 'Willkommen in Erlenwacht! Tippe aufs Chat-Fenster, /hilfe zeigt Befehle.');

    // --- Rahmen oben links (Spieler) und Mitte (Ziel), Minikarte rechts, ☰ ---
    const rahmen = createZielRahmen({ eltern: ui, ecke: 'oben-links', breite: 150 });
    const epBahn = el('height:4px;border-radius:2px;background:rgba(255,255,255,.12);overflow:hidden;');
    const epFuell = el('height:100%;width:0%;background:#b46cff;');
    epBahn.append(epFuell); rahmen.element.append(epBahn);
    const zielRahmen = createZielRahmen({ eltern: ui, ecke: 'oben-mitte', breite: 190 });
    zielRahmen.element.style.top = 'calc(env(safe-area-inset-top) + 78px)';   // unter dem Spieler-Rahmen, nichts überdeckt sich
    const hud = createHud({ eltern: ui, unten: 300 });
    const welt = api.welt();
    let menue = null, minikarte = null;
    const pausiere = (an) => { if (!render.test) o.pause?.(an); };
    menue = createMenue({ eltern: document.body, zIndex: 40, onAuf: () => pausiere(true), onZu: () => pausiere(false) });
    minikarte = createMinikarte({ eltern: ui, welt, entitaeten: api.ents(), spieler: sp(), onTipp: () => menue.zeige('karte') });
    const menueKnopf = el('position:fixed;top:calc(env(safe-area-inset-top) + 8px);right:8px;width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;' +
      'font-size:22px;color:#eef1f4;background:rgba(18,22,28,.82);border:1px solid rgba(255,255,255,.2);pointer-events:auto;touch-action:manipulation;z-index:4;', '☰');
    menueKnopf.addEventListener('click', (e) => { e.stopPropagation(); menue.schalte('start'); });
    for (const t of ['pointerdown', 'touchstart']) menueKnopf.addEventListener(t, (e) => e.stopPropagation());
    ui.append(menueKnopf);
    const fenster = baueFenster({ menue, render, chat, api, opt: o, ereignisse: bus, karte: minikarte });

    // --- Einblendung (Stufenaufstieg, Besiegt) ---
    const banner = el('position:fixed;left:50%;top:26%;transform:translate(-50%,0);padding:10px 22px;border-radius:14px;background:rgba(10,14,18,.72);font:800 30px/1.2 system-ui,sans-serif;' +
      'letter-spacing:2px;text-align:center;pointer-events:none;z-index:9;opacity:0;transition:opacity .35s;text-shadow:0 2px 8px #000;max-width:90vw;');
    ui.append(banner);
    let bannerUhr = null;
    const zeigeBanner = (text, farbe = '#ffd45a', ms = 2000) => {
      banner.textContent = text; banner.style.color = farbe; banner.style.opacity = '1';
      clearTimeout(bannerUhr); bannerUhr = setTimeout(() => { banner.style.opacity = '0'; }, ms);
    };

    // --- Ereignisse → Chat ---
    const an = (name, fn) => ab.push(bus.an(name, fn));
    const sel = (s) => SELTEN[s] || undefined;
    an('fort:xp', (d) => chat.sende('kampf', `+${d.menge} EP${d.grund ? ' (' + d.grund + ')' : ''}`));
    an('fort:stufe', (d) => { chat.sende('system', `Stufe ${d.stufe} erreicht!${d.punkte ? ` Talentpunkte: ${d.punkte}` : ''}`, { farbe: '#ffd45a' }); zeigeBanner(`STUFE ${d.stufe}`); });
    an('fort:beute', (d) => {
      const t = `${d.name || d.gegenstand}${d.anzahl > 1 ? ' ×' + d.anzahl : ''}`;
      chat.sende('beute', `Du erhältst ${t}.`, { farbe: sel(d.seltenheit) }); hud.melde(`+ ${t}`, { dauer: 2.2, schluessel: 'beute:' + (d.gegenstand || d.name), anzahl: d.anzahl || 1 });
    });
    an('fort:ausgeruestet', (d) => chat.sende('beute', d.gegenstand ? `Angelegt: ${api.fort()?.beschreibe?.(d.gegenstand?.id ?? d.gegenstand, d.gegenstand?.daten)?.name ?? d.sockel}` : `Abgelegt (${d.sockel}).`));
    an('fort:talent', (d) => chat.sende('system', `Talent gelernt: ${d.id}${d.stufe > 1 ? ' (Stufe ' + d.stufe + ')' : ''}.`));
    an('kampf:faehigkeit', (d) => chat.sende('kampf', `Neue Fähigkeit: ${d.name}`, { farbe: '#ffd45a' }));
    an('aufgabe:neu', (d) => chat.sende('aufgabe', `Neue Aufgabe: ${d.titel}`));
    an('aufgabe:schritt', (d) => chat.sende('aufgabe', d.text));
    an('aufgabe:fertig', (d) => { chat.sende('aufgabe', `Aufgabe erledigt: ${d.titel}`, { farbe: '#a8e070' }); hud.melde(`✔ ${d.titel}`, { art: 'gut', dauer: 3 }); });
    an('chat:sende', (d) => chat.zeile(d.kanal || 'system', d.text, { von: d.von, farbe: d.farbe }));
    an('gegner:boss', (d) => { chat.sende('welt', `${d.name} – Phase ${d.phase}!`, { farbe: '#ff8f73' }); if (d.phase <= 1) zeigeBanner(d.name, '#ff8f73'); });
    an('ent:tod', (d) => {
      const e = api.ents(), s = sp();
      if (s?.id != null && d.id === s.id) { chat.sende('system', 'Du wurdest besiegt.', { farbe: '#ff6b5e' }); zeigeBanner('Du wurdest besiegt', '#ff6b5e', 2500); return; }
      const t = e?.hole?.(d.id);
      if (t?.team === 'feind' && s?.id != null && d.quelle === s.id) chat.sende('kampf', `Du hast ${t.name || 'einen Gegner'} besiegt.`);
    });

    // --- Takt: eigene Schleife, DOM ≤ 10×/s und nur bei Änderung ---
    let raf = 0, letzt = 0, akku = 0, sigS = '', sigZ = '';
    const tick = (jetzt) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.25, (jetzt - letzt) / 1000 || 0); letzt = jetzt; akku += dt;
      if (akku < 0.1) return;
      const dtA = akku; akku = 0;
      const ents = api.ents(), s = sp(), f = api.fort();
      const me = ents && s?.id != null ? ents.hole?.(s.id) : null;
      if (me) {
        const k = ctx.optional('kampf')?.ressource, z = ctx.optional('zauber')?.buch;
        const res = k ? { name: k.name, wert: k.wert, max: k.max } : (z ? { name: 'mana', wert: z.mana, max: z.manaMax } : null);
        const sig = `${spielerName()}|${f?.stufe}|${Math.ceil(me.leben)}|${me.lebenMax}|${res ? Math.round(res.wert) + '/' + res.max + res.name : ''}`;
        if (sig !== sigS) { sigS = sig; rahmen.zeige({ name: spielerName(), stufe: f?.stufe, leben: me.leben, lebenMax: me.lebenMax, ressource: res && { wert: res.wert, max: res.max, farbe: RESSOURCE[res.name] } }); }
        if (f?.xpNaechste > 0) { const w = Math.min(100, Math.round(((f.xp ?? 0) / f.xpNaechste) * 100)) + '%'; if (epFuell.style.width !== w) epFuell.style.width = w; }
        rahmen.update(dtA);
      }
      const zr = s?.ziel; const ze = zr && ents ? ents.hole?.(typeof zr === 'string' ? zr : zr.id) : null;
      if (ze?.lebt !== false && ze) {
        const sig = `${ze.id}|${Math.ceil(ze.leben)}|${ze.lebenMax}`;
        if (sig !== sigZ) { sigZ = sig; zielRahmen.zeige({ name: ze.name || ze.art, stufe: ze.daten?.stufe, leben: ze.leben, lebenMax: ze.lebenMax, feindlich: ze.team === 'feind' }); }
        zielRahmen.update(dtA);
      } else if (sigZ) { sigZ = ''; zielRahmen.zeige(null); }
      minikarte.update(dtA); hud.update(dtA);
    };
    raf = requestAnimationFrame(tick);

    laufend = () => {
      cancelAnimationFrame(raf); clearTimeout(bannerUhr);
      for (const f of ab) f?.();
      fenster.dispose(); menue.dispose(); minikarte.dispose(); rahmen.dispose(); zielRahmen.dispose(); hud.dispose(); chat.dispose(); menueKnopf.remove(); banner.remove();
    };
    return { chat, menue, hud, minikarte, zeigeFenster: (name = 'start') => menue.zeige(name), banner: zeigeBanner };
  },
  dispose() { laufend?.(); laufend = null; },
};
