/**
 * @modul    modul-zauber
 * @zweck    Spiel-Modul 'zauber': Zauberbuch (gameplay/zauber) + Effekte + Großzauber (Flutwelle, Erdwall, Zyklon, Erdriss) in der großen Welt, alle Treffer laufen durch gameplay/element-reaktionen (Schock, Einfrieren, Dampf, Feuersturm …); Ziele = Entitäten Team 'feind'; Zauber-Gesten der Figur; Handy-Leiste mit Halten = Aufladen und Mana-Balken
 * @api      ZAUBER_MODUL -> api { buch, elemente, setzeLeiste(namen) (leer = Leiste aus), wirke(name,{halten}) -> bool, loslassen(), abbrechen(), leiste (Namen), tabelle, grosszauber, weltAdapter, tempoFaktor, ladung }
 * @beispiel
 *   import { ZAUBER_MODUL } from '../../engine/spiel/modul-zauber.js';
 *   // in engine/spiel/module.js + module-register.js anmelden; ?zauber=wasserguss,blitz wirkt in ?test=1 nacheinander, ?puppen=5 stellt Übungsziele auf
 *   kern.api('zauber').wirke('feuerball');
 * @tags     spiel, modul, zauber, magie, element, reaktion, großzauber, kampf, leiste, handy
 * @version  1.1.0
 * @status   entwurf
 * @three    ja
 *
 * Optionen: { leiste: [8 Namen], mana: 100, manaRegen: 8, partikel: 900, freiesMana: false, leisteUnten (px; Handy 228 = über Stick/Knöpfen) }.
 * Ereignisse: sendet 'zauber:wirke' {name}, 'zauber:reaktion' {name,id,pos}; hört auf 'ent:tod' (vergisst Zustände).
 * Mit Modul 'gegner': hat es horde(id) -> {horde, wesen}, bekommen Treffer zusätzlich Sog/Umwerfen/Verlangsamen und Einfrieren = benommen.
 */
import { createZauberbuch, zielImKegel, ZAUBER } from '../gameplay/zauber.js';
import { createElementReaktionen, normElement } from '../gameplay/element-reaktionen.js';
import { createZauberEffekte } from '../render/zauber-effekte.js';
import { CLIPS } from '../models/character/character-clips.js';
import { createZauberLeiste } from '../ui/zauber-leiste.js';
import { createTrefferZahlen } from '../ui/treffer-zahlen.js';
import { createZauberAnzeige } from './zauber-anzeige.js';
import { createZauberGross } from './zauber-gross.js';

const mit = (n, e, x = {}) => ({ ...ZAUBER[n], element: e, ...x });
/** Erlenwacht-Tabelle: Elemente auf die sechs Reaktions-Elemente gebracht, dazu Wasserguss. */
export const ERLENWACHT_ZAUBER = Object.freeze({
  feuerball: mit('feuerball', 'feuer'), eislanze: mit('eislanze', 'frost'), blitz: mit('blitz', 'blitz'),
  wasserguss: { name: 'Wasserguss', symbol: '💧', element: 'wasser', farbe: 0x3a9cff, art: 'ort', clip: 'zauberWurf', mana: 12, abkling: 1.6, wirkzeit: 0.35, gewicht: 0.45,
    schaden: 10, radius: 3.6, reichweite: 16, verzug: 0.3, stoss: 6, verlangsamt: 1.5, text: 'Ein Schwall Wasser – macht Gegner und Boden nass. Danach Blitz oder Frost!' },
  erdstachel: mit('erdstachel', 'erde'), windstoss: mit('windstoss', 'wind'), frostnova: mit('frostnova', 'frost'), meteor: mit('meteor', 'feuer'),
  flutwelle: mit('flutwelle', 'wasser'), erdwall: mit('erdwall', 'erde'), zyklon: mit('zyklon', 'wind'), erdriss: mit('erdriss', 'feuer'),
});
const LEISTE = ['feuerball', 'eislanze', 'blitz', 'wasserguss', 'erdstachel', 'windstoss', 'flutwelle', 'erdwall'];
const GROESSE = { feuerball: 0.34, eislanze: 0.17 };
const GRUND = { mana: 'Zu wenig Mana', abklingzeit: 'Lädt noch …' };
let lauf = null;

function starte(ctx) {
  const o = ctx.optionen, render = ctx.braucht('render'), welt = ctx.braucht('welt'), spieler = ctx.braucht('spieler');
  const ent = ctx.optional('entitaeten'), gegner = ctx.optional('gegner');
  const { szene, THREE } = render;
  const tabelle = { ...ERLENWACHT_ZAUBER, ...(o.zauber || {}) };
  const buch = createZauberbuch({ zauber: tabelle, mana: o.mana ?? 100, manaRegen: o.manaRegen ?? 8, welt, freiesMana: !!o.freiesMana || render.test });
  const elemente = createElementReaktionen();
  const fx = createZauberEffekte({ seed: ctx.seed, maxPartikel: o.partikel ?? (render.stufe.name === 'niedrig' ? 500 : 900) });
  fx.anteil = render.stufe.name === 'niedrig' ? 0.6 : 1;
  szene.add(fx.gruppe);
  const anzeige = createZauberAnzeige({ szene, welt, fx, anteil: fx.anteil });
  const zahlen = createTrefferZahlen({ eltern: render.ui, max: 12, seed: ctx.seed });
  const v = new THREE.Vector3(), v2 = new THREE.Vector3();
  const st = { ladeStufe: -1, uhr: 0, bodenUhr: 0, texte: new Map() };
  const quelle = () => spieler.id ?? 'spieler';
  const figur = () => spieler.figur || null;
  const fuss = () => figur()?.zustand?.pos || spieler.position || { x: welt.startPunkt?.x || 0, y: welt.bodenHoehe(welt.startPunkt?.x || 0, welt.startPunkt?.z || 0), z: welt.startPunkt?.z || 0 };
  const blick = () => (typeof spieler.blickYaw === 'function' ? spieler.blickYaw() : Number.isFinite(spieler.blickYaw) ? spieler.blickYaw : figur()?.zustand?.yaw ?? 0);
  const melde = (text, farbe = '#ffffff') => { const p = fuss(); zahlen.zeige({ x: p.x, y: p.y + 2.4, z: p.z }, text, { farbe, groesse: 0.9, dauer: 0.9, streuung: 0 }); };
  ctx.ereignisse.an?.('qualitaet', (q) => { fx.anteil = q?.name === 'niedrig' ? 0.6 : 1; });

  /** Hand(e) der Figur – Ursprung des Zaubers. */
  function handPos(clip) {
    const s = figur()?.model?.rig?.sockel, p = fuss(), y = blick();
    if (!s?.handR) return { x: p.x + Math.sin(y) * 0.4, y: p.y + 1.4, z: p.z + Math.cos(y) * 0.4 };
    s.handR.getWorldPosition(v);
    if (clip !== 'zauberWurf' && clip !== 'zauberFinger' && s.handL) v.add(s.handL.getWorldPosition(v2)).multiplyScalar(0.5);
    return { x: v.x, y: v.y, z: v.z };
  }

  // ---- Ziele: Entitäten Team 'feind' rund um den Spieler ----
  const ziele = [], zielObj = new Map();
  function zieleSammeln() {
    ziele.length = 0;
    if (!ent?.imUmkreis) return;
    const p = fuss();
    for (const e of ent.imUmkreis(p.x, p.z, 80, { team: 'feind' }) || []) {
      if (e.lebt === false) continue;
      let z = zielObj.get(e.id);
      if (!z) zielObj.set(e.id, (z = { id: e.id }));
      z.ent = e; z.x = e.pos.x; z.y = e.pos.y; z.z = e.pos.z; z.radius = e.radius || 0.4; z.hoehe = e.daten?.hoehe ?? Math.max(0.6, (e.radius || 0.4) * 3);
      ziele.push(z);
    }
  }
  const zielZu = (e) => (e ? ziele.find((z) => z.id === (e.id ?? e)) || null : null);

  function zielen(def) {
    const p = fuss(), yaw = blick(), lock = zielZu(spieler.ziel);
    if (def.art === 'selbst' || def.art === 'nova' || def.art === 'kegel' || def.art === 'teleport') return { yaw, ziel: null, punkt: null };
    const flaeche = def.art === 'gross' || (def.radius > 0 && (def.art === 'ort' || def.fall));
    const vorn = (f) => ({ x: p.x + Math.sin(yaw) * (def.reichweite || 15) * f, z: p.z + Math.cos(yaw) * (def.reichweite || 15) * f });
    if (lock) return { yaw: Math.atan2(lock.x - p.x, lock.z - p.z), ziel: flaeche ? null : lock, punkt: { x: lock.x, z: lock.z } };
    if (flaeche) {
      const a = zielImKegel(ziele, p, yaw, def.reichweite || 15, 0.6);
      const q = a ? { x: a.x, z: a.z } : vorn(def.art === 'gross' ? 0.7 : 0.55);
      return { yaw: a ? Math.atan2(q.x - p.x, q.z - p.z) : yaw, ziel: null, punkt: q };
    }
    const a = zielImKegel(ziele, p, yaw, def.reichweite || 20, 0.45) || zielImKegel(ziele, p, yaw, (def.reichweite || 20) * 0.6, Math.PI);
    return { yaw: a ? Math.atan2(a.x - p.x, a.z - p.z) : yaw, ziel: a, punkt: a ? { x: a.x, z: a.z } : vorn(0.6) };
  }

  function wirke(name, { halten = false } = {}) {
    const k = buch.kann(name);
    if (!k.ok) { if (GRUND[k.grund]) melde(GRUND[k.grund], '#9fc8ff'); return false; }
    const def = k.def, clip = CLIPS[def.clip], f = figur();
    if (f && clip) f.spiele(def.clip, { halteBei: true });
    const r = buch.wirke(name, {
      halten, vorlauf: Math.max(def.wirkzeit, clip?.spannBei ?? 0), schlag: clip ? clip.trefferBei - clip.spannBei : 0.1,
      ziel: () => {
        const a = zielen(tabelle[name]), fz = figur()?.zustand;
        if (fz && Number.isFinite(fz.yaw)) fz.yaw = a.yaw;   // zum Ziel drehen
        return { von: handPos(def.clip), fuss: fuss(), yaw: a.yaw, ziel: a.ziel, punkt: a.punkt };
      },
    });
    if (r?.ok === false) { f?.stoppe?.(def.clip); return false; }
    ctx.ereignisse.sende('zauber:wirke', { name });
    return true;
  }

  // ---- Treffer → Element-Reaktion → Schaden ----
  function hordeExtras(id, t, r) {
    if (!gegner) return;
    if (r?.betaeubt > 0) gegner.betaeube?.(id, r.betaeubt);
    const tempo = elemente.tempo(id);   // Schlamm/Kälte bremsen
    const w = (t.zug || t.verlangsamt || tempo < 1) && gegner.wesen?.(id), horde = w && gegner.lagerVon?.(id)?.horde;
    if (horde?.schade) horde.schade(w, 0, { zug: t.zug, verlangsamt: Math.max(t.verlangsamt || 0, tempo < 1 ? 2 : 0) });
  }
  function schadeEnt(id, menge, element, stoss) {
    if (!ent?.schade) return 0;
    const l = stoss ? Math.hypot(stoss.x, stoss.z) : 0;
    return ent.schade(id, { menge: Math.round(menge), element, quelle: quelle(), stoss: l > 0.05 ? { x: stoss.x / l, z: stoss.z / l, kraft: l } : null });
  }
  function folgen(liste, basis, ausser) {
    for (const f of liste) {
      anzeige.reaktion(f, { x: f.x, z: f.z });
      if (f.art !== 'flaeche' || !ent?.imUmkreis) continue;
      const mitte = { x: f.x, y: welt.bodenHoehe(f.x, f.z) + 1, z: f.z }, punkte = [];
      for (const e of ent.imUmkreis(f.x, f.z, f.radius, { team: 'feind' }) || []) {
        if (e.id === ausser || e.lebt === false) continue;
        if (f.nurMit && !elemente.hat(e.id, f.nurMit) && !elemente.bodenBei(e.pos.x, e.pos.z).some((b) => b.zustand === f.nurMit)) continue;
        const r = elemente.treffer(e.id, f.element, { x: e.pos.x, z: e.pos.z, menge: basis * f.faktor, folge: true });
        if (f.setzt) elemente.setze(e.id, f.setzt);
        const dx = e.pos.x - f.x, dz = e.pos.z - f.z, d = Math.hypot(dx, dz) || 1, k = f.sturm ? 9 : 3;
        schadeEnt(e.id, r.menge, f.element, { x: dx / d * k, z: dz / d * k });
        if (f.element === 'blitz' && punkte.length < 6) punkte.push({ x: e.pos.x, y: e.pos.y + 1, z: e.pos.z });
      }
      for (const q of punkte) fx.blitz([mitte, q], { farbe: 0xfff27a, dauer: 0.3 });
    }
  }
  function zeigeReaktion(r, id, pos) {
    if (!r.reaktion) return;
    const n = r.reaktion.name, alt = st.texte.get(n);   // eine Schrift je Reaktion und Ort, nicht je Ziel
    if (alt && alt.rest > 0 && Math.hypot(alt.x - pos.x, alt.z - pos.z) < 8) return ctx.ereignisse.sende('zauber:reaktion', { name: n, id, pos: { x: pos.x, y: pos.y, z: pos.z } });
    st.texte.set(n, { x: pos.x, z: pos.z, rest: 0.4 });
    const farbe = '#' + r.reaktion.farbe.toString(16).padStart(6, '0');
    zahlen.zeige({ x: pos.x, y: (pos.y || 0) + 2.6, z: pos.z }, r.reaktion.text, { farbe, groesse: 1.1, dauer: 1, streuung: 0.3 });
    if (r.reaktion.name === 'schock') fx.funken({ x: pos.x, y: (pos.y || 0) + 1, z: pos.z }, { farbe: 0xfff27a, anzahl: 20, tempo: 6, dauer: 0.3, groesse: 0.35, schwerkraft: 0 });
    if (r.reaktion.name === 'einfrieren') anzeige.glanz(pos, 1, r.betaeubt || 2.5);
    ctx.ereignisse.sende('zauber:reaktion', { name: r.reaktion.name, id, pos: { x: pos.x, y: pos.y, z: pos.z } });
  }
  /** Ein Treffer aus Zauberbuch oder Großzauber: t = { id, ziel, schaden, stoss, umwerfen, verlangsamt, zug }. */
  function treffer(t, def) {
    const z = t.ziel, el = normElement(def.element) || 'erde';
    const r = elemente.treffer(z.id, el, { x: z.x, z: z.z, menge: t.schaden || 0 });
    if (r.menge > 0 || t.stoss) schadeEnt(z.id, r.menge, el, t.zug ? null : t.stoss);
    hordeExtras(z.id, t, r);
    zeigeReaktion(r, z.id, z);
    if (r.folgen.length) folgen(r.folgen, t.schaden || 10, z.id);
  }
  /** Element trifft den Boden (Pfütze, Brandfleck …). */
  function amBoden(def, pos, radius) {
    const el = normElement(def.element);
    if (!el || !(radius > 0)) return;
    const r = elemente.boden(el, pos.x, pos.z, radius);
    if (r.reaktion) { zeigeReaktion(r, null, { x: pos.x, y: welt.bodenHoehe(pos.x, pos.z), z: pos.z }); folgen(r.folgen, def.schaden || 10, null); }
  }

  const gross = createZauberGross({ szene, welt, fx, elemente, amBoden, treffer, spieler, seed: ctx.seed });

  function ereignis(e) {
    const def = e.def, f = def.farbe, g = def.gewicht || 0.3, kraft = e.kraft || 1, p = fuss();
    if (e.typ === 'schlag') {
      figur()?.loese?.({ tempo: 1 + 0.2 * (kraft - 1) });
      spieler.kamera?.schuetteln?.(0.1 + g * 0.25 * kraft, 0.15 + g * 0.1);
      if (g >= 0.5) fx.ring(p, { farbe: 0xd8c8a8, radius: 0.8 + g * kraft, dauer: 0.35 });
    } else if (e.typ === 'start') {
      fx.funken(e.von, { farbe: f, anzahl: Math.round(12 + 14 * g * kraft), tempo: 3 + 2 * g, dauer: 0.4, groesse: 0.5 });
      if (def.art === 'kegel') {
        const d = { x: Math.sin(e.yaw), y: 0.05, z: Math.cos(e.yaw) };
        fx.funken(e.von, { farbe: f, anzahl: Math.round(70 * kraft), tempo: def.reichweite * 2.4, dauer: 0.6, groesse: 0.8, schwerkraft: -0.5, streuung: 0.4, richtung: d });
        amBoden(def, { x: p.x + d.x * def.reichweite * 0.6, z: p.z + d.z * def.reichweite * 0.6 }, def.reichweite * 0.6);
      }
    } else if (e.typ === 'ankuendigung') {
      fx.ring(e.pos, { farbe: f, radius: e.radius, dauer: Math.max(0.15, e.verzug), wachsen: false });
      if (e.zauber === 'meteor') fx.sturz(e.pos, { farbe: f, dauer: e.verzug, groesse: 0.9 * Math.sqrt(kraft) });
      if (e.zauber === 'wasserguss') fx.funken({ x: e.pos.x, y: e.pos.y + 5, z: e.pos.z }, { farbe: f, anzahl: 40, tempo: 1.5, dauer: e.verzug + 0.2, groesse: 0.7, schwerkraft: 30, streuung: e.radius * 0.5 });
    } else if (e.typ === 'einschlag' || e.typ === 'nova') {
      if (e.geschossId) fx.entferneKugel(e.geschossId);
      const r = e.radius;
      if (e.zauber === 'erdstachel') fx.stacheln(e.pos, { farbe: f, radius: r, anzahl: Math.round(8 + 3 * kraft), hoehe: 1.5 * Math.sqrt(kraft) });
      if (e.typ === 'nova') fx.stacheln(e.pos, { farbe: 0xd8f4ff, radius: r * 0.9, anzahl: 12, dauer: 1.2, hoehe: 0.9 });
      fx.funken(e.pos, { farbe: f, anzahl: r > 0 ? Math.round(30 + r * 20) : 12, tempo: r > 0 ? 4 + r * 2 : 3.5, dauer: r > 0 ? 0.9 : 0.4, groesse: r > 0 ? 0.9 : 0.4, hoch: r > 0 ? 2.5 : 0 });
      if (r > 0) { fx.ring(e.pos, { farbe: f, radius: r, dauer: 0.5 }); spieler.kamera?.schuetteln?.(Math.min(1.2, r / 4.5 * g * 1.4), 0.25 + r * 0.06); }
      amBoden(def, e.pos, r);
    } else if (e.typ === 'durchschlag') fx.funken(e.pos, { farbe: f, anzahl: 8, tempo: 3, dauer: 0.3, groesse: 0.4 });
    else if (e.typ === 'strahl') { fx.blitz(e.punkte, { farbe: f, dauer: 0.32 }); spieler.kamera?.schuetteln?.(0.3, 0.15); }
    else if (e.typ === 'feld') { fx.ring(e.pos, { farbe: f, radius: e.radius, dauer: e.dauer, wachsen: false }); amBoden(def, e.pos, e.radius); }
    else if (e.typ === 'gross') { gross.wirke(e); spieler.kamera?.schuetteln?.(0.5 * kraft, 0.4); }
    for (const t of e.treffer) treffer(t, def);
  }

  /** Aufladen zeigen: Kugel an der Hand, Funken, Ziel-Kreis am Boden. */
  function ladenZeigen(dt) {
    const l = buch.ladung;
    if (!l || l.phase !== 'laden') { if (st.ladeStufe >= 0) { fx.entferneKugel('ladung'); st.ladeStufe = -1; } anzeige.kreis(null); return; }
    const def = l.def, hand = handPos(def.clip), stufe = Math.round((0.3 + 0.7 * l.anteil + l.ueber) * 8);
    if (stufe !== st.ladeStufe) { fx.entferneKugel('ladung'); st.ladeStufe = stufe; }
    fx.kugel('ladung', hand, { farbe: def.farbe, groesse: 0.03 + stufe * 0.012, schweif: false });
    if (ctx.zufall() < dt * (6 + 14 * l.ueber)) fx.funken(hand, { farbe: def.farbe, anzahl: 2, tempo: 1.2, dauer: 0.25, groesse: 0.3, schwerkraft: 0, streuung: 0.4 });
    const a = zielen(def), radius = (def.radius || 0) * (1 + (l.kraft - 1) * 0.6), p = fuss();
    const kp = def.art === 'nova' ? p : def.art === 'gross' ? a.punkt : radius > 0 ? a.punkt : a.ziel;
    anzeige.kreis(kp, def.art === 'gross' ? 4 : radius > 0 ? radius : (a.ziel?.radius || 0.4) + 0.3, def.farbe, l.anteil);
  }

  // ---- Leiste ----
  const leisteNamen = (o.leiste || LEISTE).filter((n) => tabelle[n]).slice(0, 8);
  const baueLeiste = (namen) => createZauberLeiste({
    eltern: render.ui, groesse: render.handy ? 46 : 52, unten: o.leisteUnten ?? (render.handy ? 228 : 12),   // Handy: über Stick und Knopf-Bogen
    plaetze: namen.map((n, i) => ({ name: n, symbol: tabelle[n].symbol, farbe: tabelle[n].farbe, taste: String(i + 1), gross: tabelle[n].art === 'gross' })),
    onDruck: (n) => wirke(n, { halten: true }), onLos: () => buch.lasseLos(),
  });
  let leiste = baueLeiste(leisteNamen);
  /** Leiste neu setzen (Klassen-Freischaltung); leer = Zauberleiste ausblenden. */
  function setzeLeiste(namen) {
    const neu = (namen || []).filter((n) => tabelle[n]).slice(0, 8);
    leiste.dispose(); leisteNamen.length = 0; leisteNamen.push(...neu);
    leiste = baueLeiste(neu);
    if (!neu.length && leiste.element) leiste.element.style.display = 'none';
  }
  const abm = ctx.ereignisse.an?.('ent:tod', (d) => { elemente.vergiss(d?.id); zielObj.delete(d?.id); });

  // ---- Test: ?zauber=a,b  wirkt nacheinander, ?puppen=n stellt Übungsziele auf ----
  const testFolge = render.test && render.url.werte.zauber ? render.url.werte.zauber.split(',').filter((n) => tabelle[n]) : [];
  const puppen = [];
  if (render.test && ent?.neu && +render.url.werte.puppen > 0) {
    const p = fuss(), y = blick(), n = Math.min(12, +render.url.werte.puppen);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.9 }), geo = new THREE.CylinderGeometry(0.3, 0.35, 1.7, 8).translate(0, 0.85, 0);
    for (let i = 0; i < n; i++) {
      const s = (i - (n - 1) / 2) * 1.6, x = p.x + Math.sin(y) * 11 + Math.cos(y) * s, z = p.z + Math.cos(y) * 11 - Math.sin(y) * s, h = welt.bodenHoehe(x, z);
      const id = ent.neu({ art: 'ding', team: 'feind', pos: { x, y: h, z }, radius: 0.4, leben: 9999, name: 'Übungspuppe', daten: { hoehe: 1.7 } });
      const m = new THREE.Mesh(geo, mat); m.position.set(x, h, z); m.castShadow = true; szene.add(m);
      puppen.push({ id, m });
    }
    puppen.mat = mat; puppen.geo = geo;
  }

  return {
    buch, elemente, fx, anzeige, gross, tabelle, leiste: leisteNamen, ziele,
    wirke, setzeLeiste, loslassen: () => buch.lasseLos(), abbrechen: () => { const a = buch.brichAb(); if (a) figur()?.stoppe?.(); return a; },
    get weltAdapter() { return gross.weltAdapter; },
    get ladung() { return buch.ladung; },
    /** Lauf-Faktor beim Aufladen (das Spieler-Modul kann ihn lesen). */
    get tempoFaktor() { const l = buch.ladung; return !l ? 1 : l.phase === 'laden' ? Math.max(0.2, 1 - (0.35 + 0.4 * l.anteil) * (0.4 + (l.def.gewicht || 0.3))) : 0.3; },
    _fest(dt) {
      for (const t of st.texte.values()) t.rest -= dt;
      zieleSammeln();
      if (testFolge.length && (st.uhr += dt) > 1.2 && !buch.ladung) { const n = testFolge.shift(); st.uhr = tabelle[n].art === 'gross' ? -4 : 0; wirke(n); }
      for (const e of buch.update(dt, ziele)) ereignis(e);
      gross.fest(dt, ziele);
      for (const t of elemente.update(dt)) schadeEnt(t.id, t.menge, t.element, null);   // Brennen
      if ((st.bodenUhr += dt) > 0.5) { st.bodenUhr = 0; for (const z of ziele) elemente.amBoden(z.id, z.x, z.z); }
    },
    _update(dt) {
      ladenZeigen(dt);
      for (const g of buch.geschosse) fx.kugel(g.id, g, { farbe: g.def.farbe, groesse: (GROESSE[g.zauber] || 0.2) * Math.sqrt(g.kraft || 1) });
      gross.update(dt);
      anzeige.flecken(elemente.flecken); anzeige.update(dt);
      fx.update(dt, { hoehePx: render.renderer.domElement.height });
    },
    _spaet(dt) {
      zahlen.update(render.kamera, dt);
      leiste.update({ mana: buch.mana, manaMax: buch.manaMax, abkling: (n) => buch.abklingAnteil(n), kann: (n) => buch.kann(n).ok, ladung: buch.ladung });
    },
    _dispose() {
      abm?.(); leiste.dispose(); gross.dispose(); anzeige.dispose(); zahlen.dispose(); buch.dispose(); elemente.dispose();
      szene.remove(fx.gruppe); fx.dispose();
      for (const p of puppen) { szene.remove(p.m); ent?.entferne?.(p.id); }
      puppen.mat?.dispose(); puppen.geo?.dispose();
    },
  };
}

export const ZAUBER_MODUL = {
  name: 'zauber', braucht: ['render', 'welt', 'spieler'], optional: ['entitaeten', 'gegner', 'himmel'],
  standard: { leiste: LEISTE, mana: 100, manaRegen: 8, freiesMana: false },
  start(ctx) { lauf = starte(ctx); return lauf; },
  fest(dt) { lauf?._fest(dt); },
  update(dt) { lauf?._update(dt); },
  spaet(dt) { lauf?._spaet(dt); },
  zustand() { return lauf ? { mana: lauf.buch.mana, elemente: lauf.elemente.zustand() } : null; },
  lade(z) { if (lauf && z?.elemente) lauf.elemente.lade(z.elemente); },
  dispose() { lauf?._dispose(); lauf = null; },
};
