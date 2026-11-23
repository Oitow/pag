// Figuren-Labor – Übungsgegner für das Kampfsystem: Trainingspuppe (viel Leben, zeigt deinen DPS) und Ritter-Rivale mit einfacher
// Nahkampf-KI (Kombos, angekündigter schwerer Schlag, Block, Ausweichen, taumelt nach Parade oder leerer Haltung).
// Logik: engine/gameplay/kampf + nahkampf. Blick = (sin yaw, cos yaw) in (x, z).
import { createCharacter } from '../../../engine/gameplay/character.js';
import { createNahkampf } from '../../../engine/gameplay/nahkampf.js';
import { VORLAGEN } from '../../../engine/models/character/character-look.js';
import { createAusruestung } from '../../../engine/models/character/character-ausruestung.js';
import { rng, hashSeed } from '../../../engine/core/rng.js';

const STEHEN = { x: 0, z: 0 };
const PUPPE_HEILT = 5;        // s nach Kampfende, dann wieder voll
const RIVALE_NEU = 4;         // s liegen, dann neu
const ANSAGE = 0.6;           // s zwischen „‼“ und schwerem Schlag

/**
 * opts: { kampf (createKampf), szene, welt (Adapter), schilder, seed, spieler (Figur), klang,
 *   spielerSchaden(paket) -> ergebnis (Rivalen-Schläge auf den Spieler), spielerPhase() -> Nahkampf-Phase des Spielers, onMeldung(text) }
 */
export function createGegner({ kampf, szene, welt, schilder, seed = 1, spieler, klang = null, spielerSchaden, spielerPhase = () => 'bereit', onMeldung = () => {} }) {
  const zufall = rng(hashSeed('gegner', seed));
  let puppe = null, riv = null, dpsText = '';

  const vorn = (m) => { const p = spieler.zustand.pos, y = spieler.zustand.yaw; return { x: p.x + Math.sin(y) * m, y: p.y, z: p.z + Math.cos(y) * m, yaw: y }; };
  function figur(name, look, pos, yaw) {
    const aussehen = spieler.model.koerper;          // wie der Spieler: organisch oder Blöcke
    const fig = createCharacter({ look: { ...look, name }, seed: hashSeed(name, seed), welt, pos: { x: pos.x, y: pos.y, z: pos.z }, yaw, schilder, name, aussehen, zelle: 0.017 });
    szene.add(fig.root);
    return fig;
  }
  const ziel = (kid, fig) => ({ id: kid, kid, fig, x: 0, y: 0, z: 0, radius: fig.model.masse.radius, hoehe: fig.model.masse.augenHoehe + 0.15 });
  const lebensAnteil = (kid) => { const k = kampf.kaempfer(kid); return k.lebenMax > 0 ? k.leben / k.lebenMax : 0; };

  // ---- Trainingspuppe ----
  function stellePuppe() {
    if (puppe) return;
    const p = vorn(4);
    const fig = figur('Trainingspuppe', VORLAGEN.bauer, p, p.yaw + Math.PI);
    kampf.melde('puppe', { team: 'puppe', leben: 1500, haltung: 200 });
    puppe = { fig, ziel: ziel('puppe', fig), anteil: -1 };
    onMeldung('🎯 Trainingspuppe steht – dein DPS erscheint am Namensschild');
  }
  function entfernePuppe() {
    if (!puppe) return;
    puppe.fig.dispose(); kampf.entferne('puppe'); puppe = null;
  }
  function updatePuppe(dt) {
    const k = kampf.kaempfer('puppe');
    if (k.leben < k.lebenMax && !kampf.imKampf('puppe')) { if ((puppe.heilt = (puppe.heilt || 0) + dt) >= PUPPE_HEILT) { k.belebe(1); puppe.heilt = 0; } } else puppe.heilt = 0;
    if (k.tot) k.belebe(1);
    puppe.fig.update(dt, STEHEN);
    const a = Math.round(lebensAnteil('puppe') * 50);
    if (a !== puppe.anteil) { puppe.anteil = a; puppe.fig.setLeben(a / 50); }
    const t = 'Trainingspuppe · DPS ' + Math.round(kampf.dps('spieler'));
    if (t !== dpsText) { dpsText = t; puppe.fig.setName(t); }
  }

  // ---- Rivale ----
  function rufeRivale() {
    if (riv) return;
    const p = vorn(7);
    const fig = figur('Rivale', VORLAGEN.ritter, p, p.yaw + Math.PI);
    const masse = fig.model.masse;
    fig.ausruesten('handR', createAusruestung('schwert', { sockel: 'handR', seed, masse }));
    fig.ausruesten('handL', createAusruestung('schild', { sockel: 'handL', seed, masse }));
    kampf.melde('rivale', { team: 'rivale', leben: 300, haltung: 120, werte: { ruestung: 30, schadenFaktor: 0.6, krit: 0.1 } });
    riv = { fig, nk: createNahkampf({ waffe: 'schwert' }), ziel: ziel('rivale', fig), home: p, abs: { x: 0, z: 0, blickYaw: undefined },
      denk: 1.5, kombo: 0, ansage: 0, blockRest: 0, reakt: 0, tot: 0, anteil: -1 };
    onMeldung('🤺 Der Rivale tritt an! Parieren (B kurz vor dem Treffer) macht ihn wehrlos');
  }
  function entlasseRivale() {
    if (!riv) return;
    riv.fig.dispose(); riv.nk.dispose(); kampf.entferne('rivale'); riv = null;
  }
  function rivaleEreignis(e) {
    const { fig, nk } = riv, y = fig.zustand.yaw, hinten = { x: -Math.sin(y), y: 0, z: -Math.cos(y) };
    if (e.typ === 'kampf:pariert' && e.quelle === 'rivale') {
      nk.taumle(1.2); riv.kombo = 0; riv.ansage = 0;
      fig.treffer(hinten, 1.2, { welt: true });
      onMeldung('Parade!'); klang?.spiele('wumms', { staerke: 1, tonhoehe: 1.8 });
    } else if (e.typ === 'kampf:taumelt' && e.ziel === 'rivale') {
      nk.taumle(1.5); riv.kombo = 0; riv.ansage = 0;
      fig.treffer(hinten, 1.6, { welt: true });
      onMeldung('Kritischer Moment! Schaden ×1.5');
    } else if (e.typ === 'kampf:tot' && e.ziel === 'rivale') {
      fig.umfallen(hinten, { staerke: 1.4, welt: true });
      riv.tot = RIVALE_NEU; riv.kombo = 0; riv.ansage = 0;
      onMeldung('Rivale besiegt – in 4 s steht er wieder da');
    }
  }
  function updateRivale(dt) {
    const { fig, nk, abs } = riv, k = kampf.kaempfer('rivale'), z = fig.zustand, f = kampf.zustaende('rivale').faktoren();
    if (riv.tot > 0) {
      fig.update(dt, STEHEN);
      if ((riv.tot -= dt) <= 0) { k.belebe(1); fig.teleport(riv.home, z.yaw); fig.aufstehen(); kampf.bedrohung.leere('rivale'); riv.tot = 0; }
      return;
    }
    const sp = kampf.kaempfer('spieler'), pz = spieler.zustand.pos;
    const dx = pz.x - z.pos.x, dz = pz.z - z.pos.z, d = Math.hypot(dx, dz) || 0.001;
    if (sp.tot) kampf.bedrohung.leere('rivale');
    else if (!kampf.bedrohung.ziel('rivale') && d < 9) kampf.bedrohung.add('rivale', 'spieler', 1);   // Spieler zu nah: Kampf beginnt
    const kampfBereit = kampf.bedrohung.ziel('rivale') === 'spieler' && f.kannHandeln !== false;
    const ph = nk.phase, frei = ph === 'bereit';
    abs.x = abs.z = 0; abs.blickYaw = undefined;
    if (kampfBereit) {
      abs.blickYaw = Math.atan2(dx, dz);
      // Bewegung: auf ~2 m heranrücken, zu nahe weichen; beim Block langsam
      if (ph === 'bereit' || ph === 'block') {
        const v = (ph === 'block' ? 0.3 : 0.6) * nk.tempoFaktor * f.tempo;
        if (d > 2.2) { abs.x = (dx / d) * v; abs.z = (dz / d) * v; } else if (d < 1.3) { abs.x = -(dx / d) * 0.3; abs.z = -(dz / d) * 0.3; }
      }
      // Reaktion auf deinen Schlag: manchmal blocken, manchmal ausweichen
      if ((riv.reakt -= dt) <= 0 && spielerPhase() === 'vorlauf' && d < 3.4 && (frei || ph === 'block')) {
        riv.reakt = 1.2;
        const w = zufall();
        if (w < 0.25) {
          const s = zufall() < 0.5 ? 1 : -1, r = { x: (-dz / d) * s, z: (dx / d) * s };
          if (nk.ausweichen(r).ok) fig.stoss(r.x * 7, 0, r.z * 7);
        } else if (w < 0.55) riv.blockRest = 0.9;
      }
      // Angriff wählen
      if ((riv.denk -= dt) <= 0 && frei && d <= 2.6 && riv.kombo <= 0 && riv.ansage <= 0 && riv.blockRest <= 0) {
        const w = zufall();
        if (w < 0.5) riv.kombo = zufall() < 0.4 ? 3 : 2;
        else if (w < 0.78) { riv.ansage = ANSAGE; fig.sage('‼', { dauer: 0.8, ausdruck: 'wuetend' }); fig.setAusdruck('wuetend', { dauer: 1 }); klang?.spiele('entladen', { staerke: 0.8, tonhoehe: 0.7 }); }
        else { riv.blockRest = 0.8 + zufall() * 0.8; riv.denk = 0.5; }
      }
      if (riv.kombo > 0 && frei) { if (d <= 3) { nk.angriff('leicht'); if (--riv.kombo === 0) riv.denk = 0.9 + zufall() * 1.1; } else riv.kombo = 0; }
      if (riv.ansage > 0 && (riv.ansage -= dt) <= 0) { if (frei) { nk.angriff('schwer'); nk.lasseLos(); riv.denk = 1.6 + zufall(); } else riv.ansage = 0.05; }
    } else riv.kombo = riv.ansage = 0;
    // Block halten
    if (riv.blockRest > 0 && (riv.blockRest -= dt) > 0 && kampfBereit) { if (ph !== 'block') nk.block(true); }
    else if (ph === 'block') nk.block(false);
    abs.x *= f.kannLaufen === false ? 0 : 1; abs.z *= f.kannLaufen === false ? 0 : 1;
    const ziele = [{ id: 'spieler', x: pz.x, y: pz.y, z: pz.z, radius: spieler.model.masse.radius }];
    for (const e of nk.update(dt, { x: z.pos.x, y: z.pos.y, z: z.pos.z, yaw: z.yaw }, f.kannHandeln === false ? [] : ziele)) {
      if (e.typ === 'schwung') { fig.spiele(e.clip); fig.stoss(Math.sin(z.yaw) * e.schritt * 4, 0, Math.cos(z.yaw) * e.schritt * 4); klang?.spiele('zisch', { staerke: 0.35, tonhoehe: 1.3 }); }
      else if (e.typ === 'treffer') for (const t of e.treffer) {
        const r = spielerSchaden({ quelle: 'rivale', menge: t.menge, art: t.art, wucht: t.wucht, richtung: t.richtung });
        if (r.schaden > 0 && !r.geblockt) spieler.stoss(t.stoss.x, t.stoss.y, t.stoss.z);
      }
    }
    const a = nk.abwehr;
    Object.assign(k.abwehr, { block: a.block, parade: a.parade, unverwundbar: a.unverwundbar, yaw: z.yaw });
    fig.update(dt, abs);
    const l = Math.round(lebensAnteil('rivale') * 50);
    if (l !== riv.anteil) { riv.anteil = l; fig.setLeben(l / 50); }
  }

  return {
    stellePuppe, entfernePuppe, rufeRivale, entlasseRivale,
    get puppe() { return !!puppe; },
    get rivale() { return !!riv; },
    /** Lebende Ziele für Treffer und Zauber: { id, kid, fig, x, y, z, radius, hoehe } (Objekte werden wiederverwendet). */
    ziele() {
      const out = [];
      for (const g of [puppe, riv]) {
        if (!g || g.tot > 0) continue;
        const p = g.fig.zustand.pos, z = g.ziel;
        z.x = p.x; z.y = p.y; z.z = p.z; out.push(z);
      }
      return out;
    },
    /** Kampf-Ereignisse (kampf.update) weiterreichen: Parade, Taumeln, Tod des Rivalen. */
    ereignis(e) { if (riv) rivaleEreignis(e); },
    alleHeilen() {
      if (puppe) kampf.kaempfer('puppe').belebe(1);
      if (riv) { kampf.kaempfer('rivale').belebe(1); if (riv.tot > 0) { riv.tot = 0; riv.fig.aufstehen(); } }
    },
    update(dt) { if (puppe) updatePuppe(dt); if (riv) updateRivale(dt); },
    dispose() { entfernePuppe(); entlasseRivale(); },
  };
}
