// Figuren-Labor – Spielablauf „⚔ Schlacht“: Einstieg, 10 Wellen, Atempausen, Macht-Leiste (Großzauber), Mehrfach-Kills, Niederlage/Sieg.
// Alles per update(echtDt) – keine Timer-Ketten. Eigene DOM-Elemente mit Inline-Stilen. Außerhalb der Schlacht bleibt alles frei (Labor).
const REKORD = 'pag-labor-schlacht-rekord';
const LETZTE_WELLE = 10, PAUSE = 6, STUFEN = 3;
const KOSTEN = { zyklon: 2, flutwelle: 2 };          // alle anderen Großzauber: 1 Stufe
const MULTI = [[50, '☠ WELTUNTERGANG', '#ff4060'], [25, '☠ VERNICHTUNG', '#ff8040'], [10, '☠ MASSAKER', '#ffd060']];

function el(css, text = '', eltern = document.body) {
  const e = document.createElement('div');
  e.style.cssText = css; e.textContent = text; eltern.append(e);
  return e;
}
const sek = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** opts: { plage (horde-spiel), zauber(), kamera, spieler, ui, feld ({x,z,halb}), zumFeld(), heile(), klang, melde(text) } */
export function createAblauf({ plage, zauber, kamera, spieler, ui, feld, zumFeld, heile, klang = null, melde = () => {} }) {
  const S = { phase: 'aus', t: 0, macht: 0, zeit: 1, slow: 0, fade: 0, kills: 0, gesamtKills: 0, prevTot: 0, combo: 0, comboIdle: 0, bereitZeigen: 0,
    vorherGross: false, welleStat: null, fenster: [], burst: 0, burstMax: 0, countdown: 4 };
  const sicher = 'env(safe-area-inset-bottom,0px)', oben = 'env(safe-area-inset-top,0px)';
  // Handy: unten liegen Stick und Knöpfe → Macht-Leiste links oben unter der Wellen-Anzeige
  const handy = globalThis.matchMedia?.('(pointer: coarse)').matches;
  const leistePos = handy ? `left:12px;top:calc(272px + ${oben})` : `left:50%;transform:translateX(-50%);bottom:calc(108px + ${sicher})`;
  const bereitPos = handy ? `left:12px;top:calc(300px + ${oben});text-align:left` : `left:0;right:0;bottom:calc(150px + ${sicher})`;
  const fix = 'position:fixed;pointer-events:none;z-index:40;font-family:inherit;text-align:center;';

  // ---- DOM ----
  const knopf = el(`${fix}pointer-events:auto;left:50%;transform:translateX(-50%);top:calc(150px + ${oben});z-index:6;font-size:17px;font-weight:700;color:#fff;background:#b02030;padding:12px 22px;border-radius:14px;box-shadow:0 3px 10px #0006;cursor:pointer;white-space:nowrap`, '⚔ Schlacht');
  const ansage = el(`${fix}left:0;right:0;top:26%;font-weight:800;color:#fff;text-shadow:0 3px 12px #000,0 0 24px #000;opacity:0;font-size:48px`);
  const multiEl = el(`${fix}left:0;right:0;top:40%;font-weight:800;opacity:0;font-size:30px;text-shadow:0 2px 10px #000`);
  const comboEl = el(`${fix}right:10px;top:calc(190px + ${oben});font-size:22px;font-weight:800;color:#ffe070;text-shadow:0 2px 6px #000;opacity:0`);
  const bereitEl = el(`${fix}${bereitPos};font-size:15px;font-weight:800;color:#c8a0ff;text-shadow:0 0 10px #a060ff,0 2px 4px #000;opacity:0;letter-spacing:2px`, 'MACHT BEREIT');
  const leiste = el(`${fix}${leistePos};display:none;gap:6px;z-index:5`);
  const segmente = [];
  for (let i = 0; i < STUFEN; i++) {
    const s = el('width:62px;height:14px;border-radius:7px;background:#0008;border:2px solid #7a58b8;overflow:hidden;position:relative', '', leiste);
    segmente.push({ s, f: el('position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,#7a58e8,#c8a0ff)', '', s) });
  }
  const panel = el(`${fix}left:50%;top:34%;transform:translateX(-50%);display:none;min-width:240px;padding:14px 20px;border-radius:16px;background:#000b;color:#fff;font-size:17px;line-height:1.6`);
  const dunkel = el('position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:41');
  const karte = el('position:fixed;inset:0;z-index:42;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#000c;color:#fff;font-family:inherit;text-align:center;padding:20px;box-sizing:border-box');
  const karteTitel = el('font-size:40px;font-weight:800', '', karte), karteText = el('font-size:18px;line-height:1.7;white-space:pre-line', '', karte);
  const bStil = 'font:inherit;font-size:20px;font-weight:700;min-width:240px;min-height:58px;border:0;border-radius:16px;cursor:pointer;';
  const bNochmal = document.createElement('button'), bZurueck = document.createElement('button');
  bNochmal.style.cssText = bStil + 'background:#ffd870;color:#2a2218'; bNochmal.textContent = '⚔ Nochmal';
  bZurueck.style.cssText = bStil + 'background:#fff;color:#2a2218'; bZurueck.textContent = '↩ Zurück ins Labor';
  karte.append(bNochmal, bZurueck);

  // ---- Hilfen ----
  const laeuft = () => S.phase !== 'aus';
  let ansageZ = null, multiZ = null;
  function sage(text, { dauer = 2, groesse = 48, farbe = '#fff' } = {}) {
    ansageZ = { t: 0, dauer }; ansage.textContent = text; ansage.style.fontSize = groesse + 'px'; ansage.style.color = farbe;
  }
  function rekord() { try { return JSON.parse(localStorage.getItem(REKORD)) || { welle: 0, kills: 0 }; } catch { return { welle: 0, kills: 0 }; } }
  function rekordSpeichern(welle, kills) {
    const r = rekord(), neu = welle > r.welle || (welle === r.welle && kills > r.kills);
    if (neu) try { localStorage.setItem(REKORD, JSON.stringify({ welle, kills })); } catch { /* voll/privat */ }
    return { r: neu ? { welle, kills } : r, neu };
  }
  function neueStat() { return { kills: 0, schaden: 0, multi: 0, combo: 0, zeit: 0, paraden: 0 }; }
  function gewinne(x) {
    const vorher = Math.floor(S.macht);
    S.macht = Math.min(STUFEN, S.macht + x);
    if (Math.floor(S.macht) > vorher) { S.bereitZeigen = 1.6; klang?.spiele('wumms', { staerke: 0.4, tonhoehe: 1.8 }); }
  }
  function zeigeKarte(titel, text, farbe) {
    karteTitel.textContent = titel; karteTitel.style.color = farbe; karteText.textContent = text; karte.style.display = 'flex';
  }

  function start() {
    const z = plage.zustand;
    if (!laeuft()) S.vorherGross = z.gross;
    plage.setManuell(true); plage.setGross(false); plage.start();
    z.pause = 99;
    document.getElementById('welle').style.display = ''; document.getElementById('bPlage')?.classList.add('an');
    S.macht = 1; S.gesamtKills = 0; S.kills = 0; S.prevTot = 0; S.combo = 0; S.welleStat = neueStat();
    S.fenster.length = 0; S.burst = 0; S.slow = 0; S.fade = 0; S.zeit = 1;
    karte.style.display = 'none'; panel.style.display = 'none'; dunkel.style.opacity = 0;
    heile?.();
    if (zauber().tot) { /* fällt gleich wieder auf */ }
    zumFeld();
    S.phase = 'intro'; S.t = 0; S.countdown = 4; S.fahrt = false;
    sage('Welle 1', { dauer: 2.2, groesse: 64, farbe: '#ffd870' });
  }
  function ende() {
    plage.setManuell(false); plage.setGross(S.vorherGross);
    if (plage.an) plage.stopp();
    document.getElementById('welle').style.display = 'none';
    document.getElementById('bPlage')?.classList.remove('an');
    document.querySelector('[data-knopf="plage"]')?.classList.remove('an');
    S.phase = 'aus'; S.zeit = 1; dunkel.style.opacity = 0; karte.style.display = 'none'; panel.style.display = 'none';
    ansageZ = null; multiZ = null; S.slow = 0;
  }
  function welleStarten() {
    const z = plage.zustand, n = z.welle + 1;
    if (n >= 3) plage.setGross(true);
    plage.starteWelle();
    S.welleStat = neueStat(); S.phase = 'kampf'; S.t = 0;
  }
  function welleVorbei() {
    const z = plage.zustand, st = S.welleStat;
    gewinne(0.5);
    if (z.welle >= LETZTE_WELLE) {
      const { r, neu } = rekordSpeichern(z.welle, S.gesamtKills);
      S.phase = 'sieg'; S.t = 0; S.fade = 0;
      zeigeKarte('🏆 SIEG!', `Alle ${LETZTE_WELLE} Wellen überstanden\n☠ ${S.gesamtKills} Ratten erledigt\nRekord: Welle ${r.welle}, ☠ ${r.kills}${neu ? ' – NEU!' : ''}`, '#ffd870');
      return;
    }
    S.phase = 'pause'; S.t = 0; S.leer = false; S.angesagt = false;
    heile?.();
    panel.style.display = 'block';
    panel.innerHTML = `<b style="font-size:21px;color:#ffd870">Welle ${z.welle} geschafft</b><br>☠ getötet: ${st.kills}<br>Schaden erlitten: ${Math.round(st.schaden)}<br>`
      + `Beste Kombo: ×${st.combo}<br>Größter Mehrfach-Kill: ×${st.multi}<br>Zeit: ${sek(st.zeit)}<br><span style="color:#9fe89f">❤ Geheilt</span>`;
    sage('Welle geschafft!', { dauer: 1.8, groesse: 40, farbe: '#9fe89f' });
  }
  function niederlage() {
    S.phase = 'verloren'; S.t = 0; S.slow = 99; S.fade = 0;
    plage.zustand.verloren = true;
    sage('Überrannt …', { dauer: 2.4, groesse: 44, farbe: '#ff6060' });
  }

  // ---- Ereignisse von außen ----
  function kampfAktiv() { return S.phase === 'kampf' || S.phase === 'pause'; }
  function kill(n) {
    S.gesamtKills += n; S.welleStat.kills += n; S.combo += n; S.comboIdle = 0;
    gewinne(0.035 * n);
    const jetzt = performance.now() / 1000;
    for (let i = 0; i < n; i++) S.fenster.push(jetzt);
    while (S.fenster.length && S.fenster[0] < jetzt - 1.2) S.fenster.shift();
    const c = S.fenster.length;
    S.welleStat.multi = Math.max(S.welleStat.multi, c);
    for (const [schwelle, text, farbe] of MULTI) {
      if (c >= schwelle && S.burst < schwelle) {
        S.burst = schwelle; multiEl.textContent = `${text} ×${c}`; multiEl.style.color = farbe; multiZ = { t: 0, dauer: 1.6 };
        if (schwelle >= 25) S.slow = 0.7;
        klang?.spiele('wumms', { staerke: 0.8, tonhoehe: 0.7 });
        break;
      }
    }
  }

  const api = {
    get laeuft() { return laeuft(); },
    /** Zeitfaktor der Welt (Zeitlupe bei Vernichtung und Niederlage). */
    get zeit() { return S.zeit; },
    get macht() { return S.macht; },
    start, ende,
    /** Nahkampf-Treffer des Spielers. */
    treffer() { if (!kampfAktiv()) return; S.combo++; S.comboIdle = 0; gewinne(0.03); },
    /** Ergebnis eines Angriffs auf den Spieler (Parade/Schaden) – reicht es unverändert durch. */
    spielerErgebnis(r) {
      if (kampfAktiv() && r) {
        if (r.pariert) { S.combo++; S.comboIdle = 0; S.welleStat.paraden++; gewinne(0.25); }
        else if (r.schaden > 0) { S.combo = 0; S.welleStat.schaden += r.schaden; }
      }
      return r;
    },
    /** Tor für Großzauber (zauber-spiel): in der Schlacht kosten sie Macht. */
    grossTor: {
      pruefe(name) {
        if (!laeuft()) return true;
        const k = KOSTEN[name] ?? 1;
        if (S.macht >= k) return true;
        melde(`⚡ Macht reicht nicht (${k} Stufe${k > 1 ? 'n' : ''} nötig)`);
        return false;
      },
      zahle(name) { if (laeuft()) S.macht = Math.max(0, S.macht - (KOSTEN[name] ?? 1)); },
    },
    update(echtDt) {
      // Knopf nur ohne Schlacht
      knopf.style.display = laeuft() || ui.offen ? 'none' : '';
      const an = laeuft();
      leiste.style.display = an ? 'flex' : 'none';
      if (!an) { comboEl.style.opacity = 0; bereitEl.style.opacity = 0; ansage.style.opacity = 0; multiEl.style.opacity = 0; return; }
      if (!plage.an && S.phase !== 'verloren' && S.phase !== 'karte') { ende(); return; }   // 🐀-Knopf: Schlacht abgebrochen
      const dt = ui.offen ? 0 : echtDt;                        // offenes Menü = Pause der Abläufe
      const z = plage.zustand;
      S.t += dt;

      // Zeitlupe
      if (S.phase === 'verloren') S.zeit = 0.3;
      else if (S.slow > 0) { S.slow -= echtDt; S.zeit = 0.35; } else S.zeit = 1;

      // Kills zählen
      const g = plage.horde.getoetet, d = g >= S.prevTot ? g - S.prevTot : g;
      S.prevTot = g;
      if (d > 0 && kampfAktiv()) kill(d);
      if (S.burst && !S.fenster.length) S.burst = 0;
      if (S.fenster.length && S.fenster[0] < performance.now() / 1000 - 1.2) { S.fenster.shift(); if (!S.fenster.length) S.burst = 0; }

      if (S.phase === 'intro') {
        if (S.t >= 2.2 && !S.fahrt) {
          S.fahrt = true;
          const fz = spieler.zustand.pos;
          kamera.fahrt?.({ pos: { x: feld.x + 28, y: 20, z: fz.z - 6 }, blick: { x: feld.x, y: 1, z: feld.z + feld.halb * 0.3 }, dauer: 1.1, halten: 1, });
        }
        const rest = Math.ceil(5.2 - S.t);
        if (S.t >= 2.2 && S.t < 5.2 && rest !== S.countdown) { S.countdown = rest; sage(String(rest), { dauer: 0.9, groesse: 110, farbe: '#fff' }); klang?.spiele('wumms', { staerke: 0.3, tonhoehe: 1.4 }); }
        if (S.t >= 5.2) { sage('⚔ KÄMPFE!', { dauer: 1.2, groesse: 56, farbe: '#ffd870' }); welleStarten(); }
      } else if (S.phase === 'kampf') {
        S.welleStat.zeit += dt;
        if (plage.horde.anzahl <= (z.gross ? 6 : 2) && S.t > 2 && z.welle > 0) welleVorbei();
        else if (z.verloren || zauber().tot) niederlage();
      } else if (S.phase === 'pause') {
        if (S.t > 3 && !S.leer) { S.leer = true; plage.horde.leeren(); S.prevTot = 0; }
        const n = z.welle + 1;
        if (S.t > PAUSE - 2.4 && !S.angesagt) {
          S.angesagt = true; panel.style.display = 'none';
          if (n % 5 === 0) sage(`⚠ BOSSWELLE ${n} ⚠\nRattenkönig!`, { dauer: 2.3, groesse: 44, farbe: '#ff5050' });
          else sage(`Welle ${n}`, { dauer: 2.3, groesse: 64, farbe: '#ffd870' });
        }
        if (S.t >= PAUSE) welleStarten();
        else if (zauber().tot) niederlage();
      } else if (S.phase === 'verloren') {
        if (S.t > 1.6) { S.fade = Math.min(1, (S.t - 1.6) / 1); dunkel.style.opacity = S.fade; }
        if (S.t > 2.8) {
          const { r, neu } = rekordSpeichern(z.welle, S.gesamtKills);
          zeigeKarte('☠ Überrannt', `Erreichte Welle: ${z.welle}\n☠ ${S.gesamtKills} Ratten erledigt\nRekord: Welle ${r.welle}, ☠ ${r.kills}${neu ? ' – NEU!' : ''}`, '#ff6060');
          dunkel.style.opacity = 0; S.phase = 'karte'; S.zeit = 1;
        }
      }

      // Kombo-Zähler
      if (S.combo > 0 && kampfAktiv() && (S.comboIdle += dt) > 7) S.combo = 0;
      if (S.combo >= 2 && kampfAktiv()) {
        comboEl.textContent = `Kombo ×${S.combo}`; comboEl.style.opacity = 1; comboEl.style.fontSize = Math.min(34, 20 + S.combo / 3) + 'px';
        if (kampfAktiv()) S.welleStat.combo = Math.max(S.welleStat.combo, S.combo);
      } else comboEl.style.opacity = 0;

      // Macht-Leiste
      for (let i = 0; i < STUFEN; i++) {
        const a = Math.max(0, Math.min(1, S.macht - i)), voll = a >= 1;
        segmente[i].f.style.width = Math.round(a * 100) + '%';
        segmente[i].s.style.borderColor = voll ? '#e0c8ff' : '#7a58b8';
        segmente[i].s.style.boxShadow = voll ? '0 0 10px #b080ff' : 'none';
      }
      if (S.bereitZeigen > 0) { S.bereitZeigen -= echtDt; bereitEl.style.opacity = Math.min(1, S.bereitZeigen * 2); } else bereitEl.style.opacity = 0;

      // Ansagen (echte Zeit, blenden ein/aus)
      for (const [e, zz] of [[ansage, ansageZ], [multiEl, multiZ]]) {
        if (!zz) continue;
        zz.t += echtDt;
        e.style.opacity = zz.t >= zz.dauer ? 0 : Math.max(0, Math.min(1, zz.t / 0.2, (zz.dauer - zz.t) / 0.6));
        e.style.transform = `scale(${1 + Math.max(0, 0.3 - zz.t) * 1.2})`;
        e.style.whiteSpace = 'pre-line';
      }
    },
    dispose() { for (const e of [knopf, ansage, multiEl, comboEl, bereitEl, leiste, panel, dunkel, karte]) e.remove(); },
  };

  knopf.onclick = () => { ui.schliesse?.(); start(); };
  bNochmal.onclick = () => start();
  bZurueck.onclick = () => ende();
  return api;
}
