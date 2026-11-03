// Spielsysteme: Inventar, Fähigkeiten, Craften, Leben/Ausdauer, Biom-Gefahren, Lagerfeuer,
// Quests, Speichern. Die Oberfläche (HUD, Menüs) liegt in ui.js.
import * as SD from './spiel-daten.js';
import { erzeugeUI } from './ui.js';

const SAVE_KEY = 'planet-save-v1';
const AUTOSAVE_SEK = 20;

export async function init(ctx) {
  const { THREE, DATA } = ctx;
  const ITEMS = DATA.ITEMS;
  const params = new URLSearchParams(location.search);
  let ui = null; // wird am Ende gesetzt (ui.js)

  // ---------- Zustand (wird gespeichert) ----------
  const S = {
    inv: {},                 // id → Anzahl
    ausgeruestet: {},        // slot → item-id
    zustand: {},             // item-id → verbleibende Sekunden (Ausrüstung mit dauer)
    kugelWahl: null,
    leben: 100, ausdauer: 100,
    feuer: [],               // [[x,y,z]] Richtungen (Einheitsvektoren)
    respawn: -1,             // Index in feuer
    quest: 0, questZaehler: 0, questsFertig: [],
    stat: { gefangen: 0, tode: 0, gecraftet: 0 },
    regenBonus: 0,           // Sekunden mit Extra-Regeneration durch Essen
  };

  // flüchtiger Zustand
  const T = {
    letzterSchaden: -99, letzteAusdauer: -99, unverwundbarBis: 0,
    biom: null, gefahr: null, gefahrInfo: null, atem: SD.ATEM_SEK,
    tick: 0, autosave: 0, keinSpeichern: false, geladen: false, tot: false,
  };

  // ---------- Inventar ----------
  const slotsBelegt = (inv = S.inv) => Object.entries(inv).reduce((s, [id, n]) => s + (n > 0 ? Math.ceil(n / SD.stapelGroesse(id)) : 0), 0);
  const slotsMax = () => 16 + Math.round(faehigkeit('tragen')) * 6;
  const inventar = {
    add(id, n = 1) {
      n = Math.floor(n); if (!(n > 0) || !id) return 0;
      const st = SD.stapelGroesse(id), c = S.inv[id] || 0;
      const frei = Math.max(0, slotsMax() - slotsBelegt());
      const platz = frei * st + (c % st ? st - (c % st) : 0);
      const add = Math.min(n, platz);
      if (add > 0) S.inv[id] = c + add;
      if (add < n) ui?.toast('🎒 Inventar voll! ' + (n - add) + '× ' + itemName(id) + ' verloren', 2600, 'schlecht');
      if (add > 0) ui?.markDirty();
      return add;
    },
    remove(id, n = 1) {
      if ((S.inv[id] || 0) < n) return false;
      S.inv[id] -= n; if (S.inv[id] <= 0) delete S.inv[id];
      if (!S.inv[id]) for (const sl in S.ausgeruestet) if (S.ausgeruestet[sl] === id) delete S.ausgeruestet[sl];
      ui?.markDirty();
      return true;
    },
    has(id, n = 1) { return (S.inv[id] || 0) >= n; },
    count(id) { return S.inv[id] || 0; },
    alle() { return { ...S.inv }; },
    liste() { return Object.entries(S.inv).filter(([, n]) => n > 0).map(([id, n]) => ({ id, n, ...(ITEMS[id] || { name: id, icon: '❔' }) })); },
    get slots() { return slotsBelegt(); },
    get maxSlots() { return slotsMax(); },
  };
  const itemName = id => ITEMS[id]?.name || id;
  const itemIcon = id => ITEMS[id]?.icon || '❔';

  // ---------- Fähigkeiten ----------
  function ausruestungStufe(name) {
    let s = 0;
    for (const id of Object.values(S.ausgeruestet)) {
      const a = SD.AUSRUESTUNG[id];
      if (a && S.inv[id] > 0) s = Math.max(s, a.faehigkeiten[name] || 0);
    }
    return s;
  }
  const _v = new THREE.Vector3();
  function naechstesFeuer(pos = ctx.spieler?.pos) {
    if (!pos) return null;
    let best = null, bd = Infinity;
    feuerObjekte.forEach((f, i) => { const d = f.position.distanceTo(pos); if (d < bd) { bd = d; best = { i, d, obj: f }; } });
    return best;
  }
  function feuerStufe(name) {
    const f = naechstesFeuer();
    return f && f.d < SD.FEUER.radius ? (SD.FEUER.faehigkeiten[name] || 0) : 0;
  }
  function tierStufe(name) { return +(ctx.kreaturen?.faehigkeit?.(name) || 0); }
  function faehigkeit(name) { return Math.max(tierStufe(name), ausruestungStufe(name), feuerStufe(name)); }
  function faehigkeitQuelle(name) {
    const t = tierStufe(name), a = ausruestungStufe(name), f = feuerStufe(name);
    const m = Math.max(t, a, f);
    if (!m) return null;
    return t === m ? 'tier' : f === m ? 'feuer' : 'ausruestung';
  }

  // ---------- Fangkugeln ----------
  function besitzKugeln() { return DATA.KUGELN.filter(k => (S.inv[k.id] || 0) > 0); }
  function aktiveKugel() {
    if (S.kugelWahl && S.inv[S.kugelWahl] > 0) return S.kugelWahl;
    const b = besitzKugeln(); return b.length ? b[b.length - 1].id : null;
  }
  function waehleKugel(id) { S.kugelWahl = id; ui?.markDirty(); }
  function naechsteKugel() {
    const b = besitzKugeln(); if (!b.length) { ui?.toast('Keine Fangkugeln – stelle welche her (C)', 2200, 'schlecht'); return; }
    const akt = aktiveKugel(); const i = b.findIndex(k => k.id === akt);
    const k = b[(i + 1) % b.length]; waehleKugel(k.id);
    ui?.toast(itemIcon(k.id) + ' ' + itemName(k.id) + ' (Stufe ' + k.stufe + ')', 1400);
  }

  // ---------- Leben / Ausdauer ----------
  function verbraucheAusdauer(n) {
    if (S.ausdauer < n || T.tot) return false;
    S.ausdauer = Math.max(0, S.ausdauer - n); T.letzteAusdauer = ctx.zeit.t; return true;
  }
  function heilen(n) { S.leben = Math.min(100, S.leben + n); }
  function nimmSchaden(n, quelle) {
    if (T.tot || !(n > 0) || ctx.zeit.t < T.unverwundbarBis) return;
    S.leben = Math.max(0, S.leben - n);
    T.letzterSchaden = ctx.zeit.t;
    ui?.treffer(Math.min(1, n / 25 + 0.25), quelle);
    if (S.leben <= 0) sterben(quelle);
  }

  function essen(id) {
    const f = SD.NAHRUNG[id]; if (!f || !inventar.has(id)) return false;
    if (S.leben >= 100 && S.ausdauer >= 100) { ui?.toast('Du bist satt.', 1400); return false; }
    inventar.remove(id, 1);
    heilen(f.leben); S.ausdauer = Math.min(100, S.ausdauer + (f.ausdauer || 0));
    if (f.regen) S.regenBonus = Math.max(S.regenBonus, f.regen);
    ui?.toast(itemIcon(id) + ' ' + itemName(id) + ' gegessen  +' + f.leben + ' ❤️', 1600, 'gut');
    return true;
  }
  function essenBestes() {
    const fehlt = 100 - S.leben;
    const opts = Object.keys(SD.NAHRUNG).filter(id => S.inv[id] > 0);
    if (!opts.length) { ui?.toast('Nichts zu essen dabei – sammle Beeren 🫐', 2000, 'schlecht'); return; }
    // das kleinste, das die Lücke füllt, sonst das größte
    opts.sort((a, b) => SD.NAHRUNG[a].leben - SD.NAHRUNG[b].leben);
    essen(opts.find(id => SD.NAHRUNG[id].leben >= fehlt) || opts[opts.length - 1]);
  }

  function sterben(quelle) {
    T.tot = true; S.stat.tode++;
    const verlust = [];
    for (const [id, n] of Object.entries(S.inv)) {
      if (SD.AUSRUESTUNG[id] || id.startsWith('kugel_') || id === 'lagerfeuer') continue;
      const weg = Math.floor(n * SD.TOD_VERLUST);
      if (weg > 0) { inventar.remove(id, weg); verlust.push([id, weg]); }
    }
    const fi = respawnIndex();
    ctx.emit('spieler:tod', { dir: respawnDir(), quelle });
    S.leben = 100; S.ausdauer = 100; T.atem = SD.ATEM_SEK;
    T.unverwundbarBis = ctx.zeit.t + 3;
    T.tot = false;
    ui?.todesBildschirm({ verlust, amFeuer: fi >= 0, quelle });
    speichern();
  }
  function respawnIndex() { return S.respawn >= 0 && S.feuer[S.respawn] ? S.respawn : (S.feuer.length ? S.feuer.length - 1 : -1); }
  // Richtung zum Wiedererwachen: neben dem Lagerfeuer (nicht mitten drin) oder Spawn
  function respawnDir() {
    const fi = respawnIndex();
    if (fi < 0) return ctx.planet?.spawnDir?.clone() || null;
    const d = new THREE.Vector3(...S.feuer[fi]).normalize();
    return d.applyAxisAngle(tangente(d), 2.5 / (ctx.R || 400)).normalize();
  }
  function tangente(d) { const a = Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0); return a.cross(d).normalize(); }

  // ---------- Craften ----------
  function rezept(id) { return SD.REZEPTE.find(r => r.id === id); }
  function fehlendeZutaten(r) {
    const f = {};
    for (const [id, n] of Object.entries(r.zutaten)) { const c = S.inv[id] || 0; if (c < n) f[id] = n - c; }
    return f;
  }
  function amFeuer() { const f = naechstesFeuer(); return !!(f && f.d < SD.FEUER.kochRadius); }
  function kannCraften(id) {
    const r = typeof id === 'string' ? rezept(id) : id; if (!r) return false;
    if (r.station === 'feuer' && !amFeuer()) return false;
    return !Object.keys(fehlendeZutaten(r)).length;
  }
  function craften(id) {
    const r = rezept(id); if (!r) return false;
    if (r.station === 'feuer' && !amFeuer()) { ui?.toast('🔥 Dafür musst du an einem Lagerfeuer stehen', 2200, 'schlecht'); return false; }
    if (Object.keys(fehlendeZutaten(r)).length) { ui?.toast('Es fehlen Zutaten', 1600, 'schlecht'); return false; }
    // Platz prüfen (grob: Zutaten werden frei, Ergebnis braucht Platz)
    const probe = { ...S.inv };
    for (const [z, n] of Object.entries(r.zutaten)) { probe[z] -= n; if (probe[z] <= 0) delete probe[z]; }
    probe[r.id] = (probe[r.id] || 0) + r.n;
    if (slotsBelegt(probe) > slotsMax()) { ui?.toast('🎒 Kein Platz im Inventar', 1800, 'schlecht'); return false; }
    for (const [z, n] of Object.entries(r.zutaten)) inventar.remove(z, n);
    inventar.add(r.id, r.n); S.stat.gecraftet++;
    ui?.toast('🔨 ' + itemIcon(r.id) + ' ' + (r.n > 1 ? r.n + '× ' : '') + itemName(r.id) + ' hergestellt', 1800, 'gut');
    ctx.emit('item:gecraftet', { id: r.id, n: r.n });
    // Ausrüstung automatisch anlegen, wenn der Slot frei ist
    const a = SD.AUSRUESTUNG[r.id]; if (a && !S.ausgeruestet[a.slot]) anlegen(r.id);
    pruefeQuest();
    return true;
  }

  // ---------- Ausrüstung ----------
  function anlegen(id) {
    const a = SD.AUSRUESTUNG[id]; if (!a || !inventar.has(id)) return false;
    S.ausgeruestet[a.slot] = id;
    if (a.dauer && !(S.zustand[id] > 0)) S.zustand[id] = a.dauer;
    ui?.toast(itemIcon(id) + ' ' + itemName(id) + ' angelegt', 1400); ui?.markDirty();
    return true;
  }
  function ablegen(slot) { delete S.ausgeruestet[slot]; ui?.markDirty(); }
  function istAngelegt(id) { return Object.values(S.ausgeruestet).includes(id); }
  // verbraucht Haltbarkeit der Ausrüstung, die gerade gegen eine Gefahr schützt
  function verschleiss(faeh, dt) {
    for (const [slot, id] of Object.entries(S.ausgeruestet)) {
      const a = SD.AUSRUESTUNG[id]; if (!a?.dauer || !a.faehigkeiten[faeh]) continue;
      S.zustand[id] = (S.zustand[id] ?? a.dauer) - dt;
      if (S.zustand[id] <= 0) {
        inventar.remove(id, 1);
        ui?.toast(itemIcon(id) + ' ' + itemName(id) + ' ist verbraucht!', 2600, 'schlecht');
        if (S.inv[id] > 0) { S.zustand[id] = a.dauer; S.ausgeruestet[slot] = id; } else delete S.zustand[id];
      }
      ui?.markDirty();
    }
  }

  // ---------- Lagerfeuer (3D) ----------
  const feuerObjekte = [];
  const geoHolz = new THREE.CylinderGeometry(0.09, 0.11, 1.1, 6);
  const geoStein = new THREE.DodecahedronGeometry(0.16, 0);
  const geoFlamme = new THREE.ConeGeometry(0.32, 0.9, 7);
  const geoKern = new THREE.ConeGeometry(0.18, 0.55, 6);
  const matHolz = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
  const matStein = new THREE.MeshLambertMaterial({ color: 0x77777f });
  const matFlamme = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.9 });
  const matKern = new THREE.MeshBasicMaterial({ color: 0xffe066 });
  const feuerLicht = new THREE.PointLight(0xff9a3c, 0, 16, 1.6);
  ctx.scene.add(feuerLicht);
  function baueFeuer(dir) {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const h = new THREE.Mesh(geoHolz, matHolz);
      h.rotation.z = Math.PI / 2 - 0.45; h.position.y = 0.22;
      const p = new THREE.Group(); p.rotation.y = i * Math.PI / 2 + 0.3; p.add(h); h.position.x = 0.2; g.add(p);
    }
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Mesh(geoStein, matStein); const a = i / 9 * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.62, 0.08, Math.sin(a) * 0.62); s.rotation.set(a, a * 2, 0); g.add(s);
    }
    const fl = new THREE.Mesh(geoFlamme, matFlamme); fl.position.y = 0.55; g.add(fl);
    const k = new THREE.Mesh(geoKern, matKern); k.position.y = 0.42; g.add(k);
    g.userData.flammen = [fl, k];
    const d = dir.clone().normalize();
    const p = ctx.planet?.surfacePoint?.(d) || d.clone().multiplyScalar(ctx.R);
    g.position.copy(p);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    g.scale.setScalar(1.2);
    ctx.scene.add(g); feuerObjekte.push(g);
    return g;
  }
  function entferneAlleFeuer() { for (const g of feuerObjekte) ctx.scene.remove(g); feuerObjekte.length = 0; }
  function platziereFeuer() {
    const sp = ctx.spieler; if (!sp?.pos) return false;
    if (!inventar.has('lagerfeuer')) return false;
    const fw = sp.forward?.clone?.() || new THREE.Vector3();
    const dir = sp.pos.clone().addScaledVector(fw, 2.2).normalize();
    if ((ctx.planet?.heightAt?.(dir) ?? 1) < 0) { ui?.toast('Nicht im Wasser!', 1600, 'schlecht'); return false; }
    inventar.remove('lagerfeuer', 1);
    S.feuer.push([dir.x, dir.y, dir.z]); baueFeuer(dir);
    if (S.feuer.length > SD.FEUER.max) { S.feuer.shift(); ctx.scene.remove(feuerObjekte.shift()); }
    S.respawn = S.feuer.length - 1;
    ui?.toast('🏕️ Lagerfeuer entzündet – hier erwachst du nach dem Tod', 2800, 'gut');
    pruefeQuest(); speichern();
    return true;
  }
  // Interaktion am Feuer
  ctx.ziele.push(pos => {
    const f = naechstesFeuer(pos); if (!f || f.d > 3.5) return [];
    return [{ dist: f.d, label: '🔥 Lagerfeuer', act: () => {
      S.respawn = f.i; heilen(5); ui?.toast('🏕️ Respawn-Punkt gesetzt', 1800, 'gut'); ui?.oeffne('craften', 'nahrung');
    } }];
  });

  // ---------- Quests ----------
  function aktuelleQuest() { return SD.QUESTS[S.quest] || null; }
  function lexikon() { try { return ctx.kreaturen?.lexikon?.() || []; } catch (e) { return []; } }
  function gefangenListe() { return Array.isArray(ctx.kreaturen?.gefangen) ? ctx.kreaturen.gefangen : []; }
  function questFortschritt(q = aktuelleQuest()) {
    if (!q) return { ist: 0, soll: 0 };
    switch (q.typ) {
      case 'besitz': return { ist: Math.min(q.n, S.inv[q.item] || 0), soll: q.n };
      case 'fangen': return { ist: Math.min(q.n, S.questZaehler), soll: q.n };
      case 'fangenF': return { ist: gefangenListe().some(t => (t.faehigkeiten?.[q.faehigkeit] || 0) >= q.stufe) ? 1 : 0, soll: 1 };
      case 'aktiv': return { ist: Math.min(q.n, gefangenListe().filter(t => t.aktiv).length), soll: q.n };
      case 'platzieren': return { ist: Math.min(q.n, S.questZaehler), soll: q.n };
      case 'biom': return { ist: T.biom === q.biom ? 1 : S.questZaehler ? 1 : 0, soll: 1 };
      case 'buch': { const n = lexikon().filter(e => e.gefangen).length; return { ist: Math.min(q.n, n), soll: q.n }; }
    }
    return { ist: 0, soll: 1 };
  }
  function pruefeQuest() {
    let q = aktuelleQuest(), runden = 0;
    while (q && runden++ < 5) {
      const f = questFortschritt(q);
      if (f.ist < f.soll) break;
      S.questsFertig.push(q.id); S.quest++; S.questZaehler = 0;
      let txt = '✅ Ziel erreicht: ' + q.titel;
      if (q.belohnung) {
        const b = []; for (const [id, n] of Object.entries(q.belohnung)) { inventar.add(id, n); b.push(n + '× ' + itemIcon(id)); }
        txt += '  🎁 ' + b.join(' ');
      }
      ui?.toast(txt, 3800, 'quest');
      const nq = aktuelleQuest();
      if (nq) setTimeout(() => ui?.toast('🎯 Neues Ziel: ' + nq.titel, 3200, 'quest'), 900);
      q = nq;
      ui?.markDirty();
    }
  }

  // ---------- Biom-Gefahren (1×/s) ----------
  function pruefeBiom(dt) {
    const sp = ctx.spieler, pl = ctx.planet; if (!sp?.pos || !pl?.biomeAt) return;
    const dir = sp.pos.clone().normalize();
    const biom = pl.biomeAt(dir);
    if (biom !== T.biom) {
      T.biom = biom; ui?.biomBanner(biom);
      const q = aktuelleQuest(); if (q?.typ === 'biom' && q.biom === biom) S.questZaehler = 1;
    }
    let gefahr = DATA.BIOME[biom]?.gefahr || null;
    if (gefahr === 'dunkel' && !pl.istNacht?.(dir)) gefahr = null;
    if (gefahr === 'tiefe' && !(sp.inWasser && biom === 'ozean')) gefahr = null;
    if (gefahr !== 'tiefe') T.atem = Math.min(SD.ATEM_SEK, T.atem + dt * 3);
    let info = null;
    if (gefahr) {
      const schutz = SD.schutzFuer(gefahr), noetig = DATA.GEFAHR_STUFE[gefahr] || 1;
      const hat = schutz ? faehigkeit(schutz) : 0;
      if (hat >= noetig) {
        if (faehigkeitQuelle(schutz) === 'ausruestung') verschleiss(schutz, dt);
      } else {
        const G = SD.GEFAHREN[gefahr] || { dps: 3, icon: '⚠️', titel: 'Gefahr!', hilfe: '' };
        if (gefahr === 'tiefe' && T.atem > 0) {
          T.atem -= dt; info = { gefahr, ...G, titel: 'Luft: ' + Math.ceil(T.atem) + ' s', leicht: true };
        } else {
          const dmg = G.dps * (noetig - hat) / noetig * dt;
          info = { gefahr, ...G, teilweise: hat > 0 };
          nimmSchaden(dmg, 'gefahr:' + gefahr);
        }
      }
    }
    T.gefahr = info?.gefahr || null; T.gefahrInfo = info;
    ui?.warnung(info);
  }

  // ---------- Events ----------
  ctx.on('item:erhalten', e => {
    if (!e?.id) return;
    const n = Math.max(1, Math.floor(e.n ?? 1));
    const add = inventar.add(e.id, n);
    if (add > 0) ui?.itemToast(e.id, add);
    pruefeQuest();
  });
  ctx.on('spieler:schaden', e => nimmSchaden(+(e?.n ?? 10), e?.quelle));
  ctx.on('gefangen', e => {
    S.stat.gefangen++;
    const t = gefangenListe().find(x => x.uid === e?.uid);
    const lex = lexikon().find(x => x.id === e?.id);
    const name = t?.name || lex?.name || e?.name || e?.id || 'Tier';
    const faeh = t?.faehigkeiten || lex?.faehigkeiten || {};
    const icons = Object.entries(faeh).map(([f, s]) => (DATA.FAEHIGKEITEN[f]?.icon || '') + s).join(' ');
    if (!ui?.kuerzlichFangToast()) ui?.feier(name, icons);
    const q = aktuelleQuest();
    if (q?.typ === 'fangen' && (!q.biom || q.biom === T.biom || (q.biom === 'wiese' && T.biom === 'strand'))) S.questZaehler++;
    pruefeQuest(); ui?.markDirty();
    speichern();
  });
  ctx.on('spieler:biom', e => { if (e?.biom && e.biom !== T.biom) { T.wand = 0; pruefeBiom(0); } });

  // ---------- Speichern / Laden ----------
  function save() {
    return JSON.parse(JSON.stringify(S));
  }
  function load(d) {
    if (!d || typeof d !== 'object') return;
    Object.assign(S, d);
    S.inv ||= {}; S.ausgeruestet ||= {}; S.zustand ||= {}; S.feuer ||= []; S.questsFertig ||= [];
    S.stat = { gefangen: 0, tode: 0, gecraftet: 0, ...(S.stat || {}) };
    entferneAlleFeuer();
    for (const f of S.feuer) baueFeuer(new THREE.Vector3(...f));
    ui?.markDirty();
  }
  function modulSave(name) { try { return ctx[name]?.save?.() ?? null; } catch (e) { console.warn('save', name, e); return null; } }
  function speichern() {
    if (T.keinSpeichern || !T.geladen) return false;
    const daten = { seed: ctx.seedText, zeit: Date.now(), spieler: modulSave('spieler'), flora: modulSave('flora'), kreaturen: modulSave('kreaturen'), spiel: save() };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(daten)); return true; } catch (e) { console.warn('Speichern fehlgeschlagen', e); return false; }
  }
  function leseSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; } }
  function neueWelt(seed) {
    T.keinSpeichern = true;
    try {
      const alt = localStorage.getItem(SAVE_KEY);
      if (alt) localStorage.setItem(SAVE_KEY + '-backup', alt);
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
    location.search = '?seed=' + encodeURIComponent(String(seed || Math.floor(Math.random() * 1e6)).trim().slice(0, 40));
  }
  ctx.on('bereit', () => {
    const d = leseSave();
    if (d && String(d.seed) === String(ctx.seedText)) {
      for (const name of ['planet', 'flora', 'kreaturen', 'spieler']) {
        if (d[name] != null) { try { ctx[name]?.load?.(d[name]); } catch (e) { console.warn('load', name, e); } }
      }
      load(d.spiel);
      T.istNeu = false;
    } else {
      if (d) { try { localStorage.setItem(SAVE_KEY + '-backup', JSON.stringify(d)); } catch (e) {} }
      for (const [id, n] of Object.entries(SD.START_INVENTAR)) inventar.add(id, n);
      T.istNeu = true;
    }
    T.geladen = true;
    pruefeBiom(0);
    T.hatteSave = !!d && String(d.seed) === String(ctx.seedText);
    ui?.markDirty();
    const zeigeMenue = !params.has('seed') || params.has('menu');
    if (zeigeMenue) ui?.hauptmenue({ weiter: T.hatteSave });
    else ui?.willkommen(T.istNeu);
    speichern();
  });
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') speichern(); });
  addEventListener('pagehide', () => speichern());

  // ---------- Update ----------
  function update(dt) {
    const t = ctx.zeit.t;
    // Ausdauer
    if (t - T.letzteAusdauer > 0.9) S.ausdauer = Math.min(100, S.ausdauer + dt * (16 + faehigkeit('heilung') * 4));
    // Leben
    if (S.leben < 100 && t - T.letzterSchaden > 4) {
      let r = 0.35 + faehigkeit('heilung') * 1.2;
      if (S.regenBonus > 0) r += 1.5;
      const f = naechstesFeuer(); if (f && f.d < SD.FEUER.radius) r += 2;
      heilen(r * dt);
    }
    if (S.regenBonus > 0) S.regenBonus = Math.max(0, S.regenBonus - dt);
    // Gefahren 1×/s
    // (Takt nach Wanduhr, damit es auch bei sehr niedriger Bildrate 1×/s prüft; Schaden nach Spielzeit)
    T.tick += dt;
    const jetzt = performance.now();
    if (jetzt - (T.wand || 0) >= 1000) { T.wand = jetzt; pruefeBiom(T.tick); T.tick = 0; if (Math.random() < 0.25) pruefeQuest(); }
    // Feuer-Flackern + Licht am nächsten Feuer
    if (feuerObjekte.length) {
      for (const g of feuerObjekte) {
        const [fl, k] = g.userData.flammen, s = 1 + Math.sin(t * 13 + g.id) * 0.08 + Math.sin(t * 7.3 + g.id * 2) * 0.06;
        fl.scale.set(s, s * (1 + Math.sin(t * 9 + g.id) * 0.12), s); k.scale.setScalar(2 - s);
        fl.rotation.y = t * 1.5;
      }
      const f = naechstesFeuer(ctx.camera.position);
      if (f && f.d < 80) {
        feuerLicht.position.copy(f.obj.position).addScaledVector(_v.copy(f.obj.position).normalize(), 1.2);
        feuerLicht.intensity = (ctx.planet?.istNacht?.(f.obj.position) ? 9 : 3) + Math.sin(t * 11) * 1.2 + Math.sin(t * 17) * 0.8;
      } else feuerLicht.intensity = 0;
    }
    // Autosave
    T.autosave += dt;
    if (T.autosave > AUTOSAVE_SEK) { T.autosave = 0; speichern(); }
    ui?.update(dt);
  }

  // ---------- Öffentliche API ----------
  const api = {
    inventar, faehigkeit, aktiveKugel, waehleKugel, naechsteKugel,
    toast: (text, ms) => ui?.toast(text, ms),
    get leben() { return S.leben; }, set leben(v) { S.leben = Math.max(0, Math.min(100, v)); },
    get ausdauer() { return S.ausdauer; }, set ausdauer(v) { S.ausdauer = Math.max(0, Math.min(100, v)); },
    verbraucheAusdauer, heilen, schaden: nimmSchaden, essen, essenBestes,
    rezepte: SD.REZEPTE, kannCraften, craften, fehlendeZutaten,
    anlegen, ablegen, istAngelegt,
    lagerfeuer: { platzieren: platziereFeuer, get liste() { return feuerObjekte.slice(); }, naechstes: naechstesFeuer },
    get biom() { return T.biom; }, get gefahr() { return T.gefahr; },
    get menuOffen() { return !!ui?.istOffen(); },
    oeffneMenue: (tab) => ui?.oeffne(tab), schliesseMenue: () => ui?.schliesse(),
    aktuelleQuest, questFortschritt,
    respawnDir, speichern, neueWelt,
    update, save, load,
  };
  // interne Sicht für ui.js
  const intern = {
    S, T, api, ctx, SD, inventar, faehigkeit, faehigkeitQuelle, tierStufe, ausruestungStufe, aktiveKugel, besitzKugeln,
    waehleKugel, naechsteKugel, essen, essenBestes, craften, kannCraften, fehlendeZutaten, amFeuer, anlegen, ablegen,
    istAngelegt, platziereFeuer, aktuelleQuest, questFortschritt, lexikon, gefangenListe, speichern, neueWelt,
    leseSave, itemName, itemIcon,
  };
  ui = erzeugeUI(intern);
  return api;
}
