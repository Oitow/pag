// Enklave – Kampf (schlank, Vorbild labore/figuren/js/{kampf,zauber,horde,grosszauber}-spiel.js): Faust-Nahkampf (F), Funkenschlag (1 / ✨), Großzauber Flutwelle (G / 🌊),
// Rattenhorde. Engine: gameplay/{nahkampf, zauber, horde, grosszauber, grosszauber-welle} + render/{horde-mesh, zauber-effekte, grosszauber-mesh} + ui/treffer-zahlen.
// Im Tutorial kann der Spieler nicht sterben (Leben fällt höchstens auf 1). Meldungen an tutorial.js: onBesiegt(art), onBenutzt(was).
import { createNahkampf } from '../../../engine/gameplay/nahkampf.js';
import { createZauberbuch, zielImKegel, ZAUBER } from '../../../engine/gameplay/zauber.js';
import { createHorde } from '../../../engine/gameplay/horde.js';
import { createGrosszauber } from '../../../engine/gameplay/grosszauber.js';
import { createWelle } from '../../../engine/gameplay/grosszauber-welle.js';
import { createHordeMesh } from '../../../engine/render/horde-mesh.js';
import { createZauberEffekte } from '../../../engine/render/zauber-effekte.js';
import { createGrosszauberMesh } from '../../../engine/render/grosszauber-mesh.js';
import { createWelleAnsicht } from '../../../engine/render/grosszauber-welle.js';
import { createTrefferZahlen } from '../../../engine/ui/treffer-zahlen.js';
import { createRatte } from '../../../engine/models/kreaturen/ratte.js';
import { CLIPS } from '../../../engine/models/character/character-clips.js';

const MAX_RATTEN = 40, HALTEN = 0.3;
export const FUNKEN = { ...ZAUBER.arkan, name: 'Funkenschlag', symbol: '✨', farbe: 0xffd84a, mana: 6, abkling: 0.8, schaden: 8 };
const ZAUBER_TABELLE = { funken: FUNKEN, flutwelle: ZAUBER.flutwelle };
const hex = (f) => '#' + f.toString(16).padStart(6, '0');

/**
 * opts: { szene, welt (Kollisions-Welt, wird für Großzauber erweitert), spieler (figur.js), kamera (follow-camera), hud, seed, ziele: [{id,x,z,radius,hoehe,y}] (Puppe, Zielscheibe),
 *         onBesiegt(art), onBenutzt(was), onTreffer(id) }
 * → { eingaben(dt, absicht, e), update(dt, hoehePx), spawneRatten(n), leereHorde(), setGrossFrei(an), horde, fx, zahlen, st, dispose() }
 */
export function createKampf({ szene, welt, spieler, kamera, hud, seed = 1, ziele: festeZiele = [], onBesiegt = () => {}, onBenutzt = () => {}, onTreffer = () => {} }) {
  const fig = spieler.figur, pos = () => fig.zustand.pos;
  const buch = createZauberbuch({ zauber: ZAUBER_TABELLE, welt, mana: 100 });
  const nk = createNahkampf({ waffe: 'faust' });
  const horde = createHorde({ seed, welt, max: MAX_RATTEN });
  const ratte = createRatte({ seed });
  const bild = createHordeMesh({ modelle: { ratte: ratte.frames }, max: MAX_RATTEN });
  const fx = createZauberEffekte({ seed, maxPartikel: 500 });
  const zahlen = createTrefferZahlen({ max: 16, seed });
  szene.add(bild.gruppe, fx.gruppe);

  // ---- Großzauber: Welt-Adapter an Ort und Stelle erweitern, damit Figuren/Ratten die Flut spüren ----
  const basis = { ...welt };
  const gross = createGrosszauber({ arten: { welle: createWelle }, welt: basis, seed });
  const erweitert = gross.adapter(basis), FUNKTIONEN = ['bodenHoehe', 'wasserHoehe', 'hindernisse'];   // nur die Gelände-Abfragen (kollision hat Getter)
  for (const k of FUNKTIONEN) welt[k] = erweitert[k];
  const grossBild = createGrosszauberMesh({ arten: { welle: createWelleAnsicht }, welt: basis });
  szene.add(grossBild.gruppe);
  const defs = new Map();

  const st = { leben: 100, lebenMax: 100, grossFrei: false, fHalt: 0, fAn: false, schwerAn: false, drehYaw: 0, drehRest: 0, bissSchutz: 0, ruhe: 0, schwungKraft: 1 };
  const ziele = [], zielNr = new Map();
  const blickYaw = () => (kamera.erstePerson ? kamera.yaw : kamera.blickYaw());
  const zahl = (p, t, o) => zahlen.zeige(p, String(t), o);

  function sammeln() {
    ziele.length = 0; zielNr.clear();
    for (const w of horde.ziele) { ziele.push(w); zielNr.set(w.id, w); }
    for (const z of festeZiele) { z.y = welt.bodenHoehe(z.x, z.z); ziele.push(z); zielNr.set(z.id, z); }
  }

  /** Schaden an einem Ziel (Ratte oder Übungsziel). */
  function schade(z, menge, farbe = 0xffffff, stoss = null) {
    const p = { x: z.x, y: z.y + z.hoehe + 0.3, z: z.z };
    if (z.fest) {   // Puppe/Zielscheibe: nur Zahl + Funken, zählt als Treffer
      zahl(p, Math.round(menge), { farbe: hex(farbe), groesse: 1, dauer: 0.7 });
      fx.funken({ x: z.x, y: z.y + z.hoehe * 0.6, z: z.z }, { farbe: 0xffe9a0, anzahl: 6, tempo: 2.5, dauer: 0.3, groesse: 0.35 });
      onTreffer(z.id);
      return;
    }
    const r = horde.schade(z, menge, { stoss });
    if (r.schaden) zahl(p, r.schaden, { farbe: r.tot ? '#ffe070' : hex(farbe), groesse: Math.min(1.8, 0.85 + r.schaden / 40), dauer: r.tot ? 0.9 : 0.7 });
    if (r.tot) {
      fx.funken({ x: z.x, y: z.y + 0.2, z: z.z }, { farbe: 0x8a1a14, anzahl: 8, tempo: 3.5, dauer: 0.6, groesse: 0.35, hoch: 2.5, schwerkraft: 10 });
      onBesiegt('ratte');
    } else if (r.schaden) fx.funken({ x: z.x, y: z.y + 0.2, z: z.z }, { farbe: farbe, anzahl: 4, tempo: 2.5, dauer: 0.35, groesse: 0.3 });
  }

  // ---- Zaubern ----
  function zielen(def) {
    const p = pos(), yaw = blickYaw();
    const a = def.art === 'gross' ? null : zielImKegel(ziele, p, yaw, def.reichweite || 20, 0.5) || zielImKegel(ziele, p, yaw, (def.reichweite || 20) * 0.6, Math.PI);
    const y = a ? Math.atan2(a.x - p.x, a.z - p.z) : yaw;
    return { yaw: y, ziel: a, punkt: a ? { x: a.x, z: a.z } : { x: p.x + Math.sin(y) * 10, z: p.z + Math.cos(y) * 10 } };
  }
  function handPos() { const v = fig.model.rig.sockel.handR.getWorldPosition(fig.model.rig.sockel.handR.position.clone()); return { x: v.x, y: v.y, z: v.z }; }
  function wirke(name) {
    const k = buch.kann(name);
    if (!k.ok) { if (k.grund === 'mana') hud.melde('Zu wenig Mana', { art: 'warnung', schluessel: 'mana' }); else if (k.grund === 'abklingzeit') hud.melde('Lädt noch …', { schluessel: 'abkling' }); return; }
    const def = k.def, clip = CLIPS[def.clip];
    fig.spiele(def.clip, { halteBei: true });
    buch.wirke(name, { vorlauf: Math.max(def.wirkzeit, clip.spannBei), schlag: clip.trefferBei - clip.spannBei,
      ziel: () => { const a = zielen(def); st.drehYaw = a.yaw; return { von: handPos(), fuss: pos(), yaw: a.yaw, ziel: a.ziel, punkt: a.punkt }; } });
    onBenutzt(def.art === 'gross' ? 'gross:' + (def.gross?.art || name) : 'zauber:' + name);
  }

  function zauberEreignis(e) {
    const def = e.def, f = def.farbe;
    if (e.typ === 'schlag') { fig.loese({ tempo: 1 }); st.drehRest = 0.5; kamera.schuetteln(0.08, 0.12); }
    else if (e.typ === 'start') fx.funken(e.von, { farbe: f, anzahl: 16, tempo: 3, dauer: 0.4, groesse: 0.5 });
    else if (e.typ === 'einschlag' || e.typ === 'durchschlag') {
      if (e.geschossId) fx.entferneKugel(e.geschossId);
      if (e.pos) fx.funken(e.pos, { farbe: f, anzahl: 12, tempo: 3, dauer: 0.4, groesse: 0.4 });
    } else if (e.typ === 'gross') {
      const id = gross.wirke(def.gross?.art, { von: e.von, punkt: e.punkt, yaw: e.yaw, kraft: e.kraft, def: { ...def, ...def.gross }, quelle: 'spieler' });
      if (id != null) defs.set(id, def);
      kamera.schuetteln(0.5, 0.4);
    }
    for (const t of e.treffer) schade(t.ziel, t.schaden, f, t.stoss);
  }
  function grossEreignis(e) {
    const def = defs.get(e.id) || { farbe: 0x3aa8ff };
    for (const t of e.treffer) schade(t.ziel, t.schaden, def.farbe, t.stoss);
    if (e.typ === 'beben') { const p = pos(), d = e.pos ? Math.hypot(e.pos.x - p.x, e.pos.z - p.z) : 0; kamera.schuetteln((e.staerke ?? 1) / (1 + d / 18), e.dauer ?? 0.4); }
    else if (e.typ === 'funken') fx.funken(e.pos, e.opts || {});
    else if (e.typ === 'ring') fx.ring(e.pos, e.opts || {});
    else if (e.typ === 'ende') defs.delete(e.id);
  }

  // ---- Nahkampf: F antippen = Schlag, halten = schwerer Schlag ----
  function nahkampfEreignis(e) {
    if (e.typ === 'schwung') {
      fig.spiele(e.clip);
      const a = zielen({ reichweite: 4.5 });
      if (a.ziel) { st.drehYaw = a.yaw; st.drehRest = 0.3; }
      const y = a.ziel ? a.yaw : fig.zustand.yaw;
      fig.stoss(Math.sin(y) * e.schritt * 4, 0, Math.cos(y) * e.schritt * 4);
    } else if (e.typ === 'treffer') {
      let n = 0;
      for (const t of e.treffer) { const z = zielNr.get(t.ziel); if (z) { schade(z, t.menge, 0xffffff, t.stoss); n++; } }
      if (n) kamera.schuetteln(e.schlag === 'schwer' ? 0.4 : 0.1, 0.15);
    }
  }
  function biss(e) {
    if (st.bissSchutz > 0) return;
    st.bissSchutz = 0.15; st.ruhe = 4;
    st.leben = Math.max(1, st.leben - e.schaden);
    const d = { x: pos().x - e.wesen.x, y: 0, z: pos().z - e.wesen.z };
    if (e.schaden >= 3) fig.treffer(d, 0.5, { welt: true });
    zahl({ x: pos().x, y: pos().y + 2, z: pos().z }, '−' + e.schaden, { farbe: '#ff5040', groesse: 0.8, dauer: 0.5 });
  }

  return {
    st, horde, fx, zahlen, buch,
    setGrossFrei(an) { st.grossFrei = !!an; },
    spawneRatten(n) { horde.spawneRing('ratte', n, pos(), { radius: 15, breite: 5, winkel: blickYaw(), bogen: 1.2 }); },
    leereHorde() { horde.leeren(); bild.update(horde.wesen); },
    /** Vor dem Figuren-Update: Tasten auswerten, Tempo/Blick der Absicht anpassen. */
    eingaben(dt, absicht, e) {
      const ein = spieler.eingabe, frei = !buch.wirkt;
      if (frei && ein.gedrueckt('zaubern')) wirke('funken');
      if (frei && ein.gedrueckt('gross')) { if (st.grossFrei) wirke('flutwelle'); else hud.melde('Großzauber noch nicht freigeschaltet', { schluessel: 'gross' }); }
      if (ein.gedrueckt('schlagen')) { st.fAn = true; st.fHalt = 0; }
      if (st.fAn) {
        if (ein.gehalten('schlagen')) { if (!st.schwerAn && (st.fHalt += dt) > HALTEN) { nk.angriff('schwer'); st.schwerAn = true; } }
        else { if (st.schwerAn) nk.lasseLos(); else nk.angriff('leicht'); st.fAn = st.schwerAn = false; }
      }
      const s = nk.tempoFaktor * (buch.wirkt ? 0.35 : 1);
      if (s !== 1) { absicht.x *= s; absicht.z *= s; if (s < 1) { absicht.sprint = false; absicht.springen = false; } }
      if (st.drehRest > 0) { st.drehRest -= dt; absicht.blickYaw = st.drehYaw; }
    },
    update(dt, hoehePx) {
      sammeln();
      const p = fig.zustand.pos;
      for (const e of nk.update(dt, { x: p.x, y: p.y, z: p.z, yaw: fig.zustand.yaw }, ziele)) nahkampfEreignis(e);
      for (const e of buch.update(dt, ziele)) zauberEreignis(e);
      for (const g of buch.geschosse) fx.kugel(g.id, g, { farbe: g.def.farbe, groesse: 0.15 });
      for (const e of gross.update(dt, ziele)) grossEreignis(e);
      grossBild.update(dt, gross.aktive);
      st.bissSchutz -= dt; st.ruhe -= dt;
      for (const e of horde.update(dt, horde.anzahl ? { x: p.x, y: p.y, z: p.z, radius: 0.35 } : null)) if (e.typ === 'biss') biss(e);
      bild.update(horde.wesen);
      if (st.ruhe <= 0 && st.leben < st.lebenMax) st.leben = Math.min(st.lebenMax, st.leben + dt * 6);   // ohne Biss heilt sich der Spieler
      hud.balken('leben', { wert: st.leben / st.lebenMax, zeichen: '❤', farbe: '#e0483c' });
      hud.balken('mana', { wert: buch.mana / buch.manaMax, zeichen: '✦', farbe: '#5a9bff' });
      fx.update(dt, { hoehePx });
    },
    dispose() {
      gross.dispose(); grossBild.dispose(); for (const k of FUNKTIONEN) welt[k] = basis[k];
      bild.dispose(); ratte.dispose(); horde.dispose(); fx.dispose(); zahlen.dispose(); buch.dispose(); nk.dispose();
    },
  };
}
