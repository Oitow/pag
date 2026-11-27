// Überleben im Erde-Labor: Leben, Hunger, Durst, Körperwärme (Regeln: ueberleben-regeln.js).
// Zeitbasis = Spielstunden aus welt.zw.uhr (läuft mit dem Zeitraffer). Werte ändern sich nur zu Fuß (spieler().gehen).
// Dienst welt.dienste.ueberleben = { schaden(n, grund), heile(n), iss(id) → bool, leben (0…100), tot }.
// Testschalter: ?ueberleben=aus (Modul aus) · ?leben= ?hunger= ?durst= ?waerme= (Startwerte 0…1, 1 = gut/voll).
import { rng, hashSeed } from '../../../engine/core/rng.js';
import {
  LEBEN_MAX, ESSEN, neuerZustand, gefuehlteTemp, schritt, bestesEssen, iss, trinke, todVerlust, wiederbeleben, waermeWort,
} from './ueberleben-regeln.js';

const OHNMACHT_S = 3;          // so lange (echte s) liegt man nach dem Tod, bevor man aufwacht
const MAX_DH = 1;              // größere Uhr-Sprünge (Uhr gestellt) zählen nicht

const balken = (x, n = 5) => {
  const v = Math.max(0, Math.min(1, x)) * n, voll = Math.floor(v), halb = v - voll >= 0.5 && voll < n;
  return '█'.repeat(voll) + (halb ? '▓' : '') + '░'.repeat(n - voll - (halb ? 1 : 0));
};

export function createUeberleben(welt) {
  const P = new URLSearchParams(globalThis.location?.search || '');
  if (P.get('ueberleben') === 'aus') return { name: 'ueberleben', update() {}, dispose() {} };

  const z = neuerZustand();
  const zufall = rng(hashSeed(welt.seed ?? 1, 'ueberleben'));
  const startWerte = () => {
    const w = (k) => (P.has(k) && Number.isFinite(+P.get(k)) ? Math.max(0, Math.min(1, +P.get(k))) : null);
    if (w('leben') != null) z.leben = w('leben') * LEBEN_MAX;
    if (w('hunger') != null) z.satt = w('hunger');
    if (w('durst') != null) z.wasser = w('durst');
    if (w('waerme') != null) z.waerme = w('waerme');
  };
  startWerte();

  let uhrVorher = null, letzterGrund = '', ohnmacht = 0, speicherT = 0, schadenBlitz = 0;

  // ---------- Bildschirmrand: blau bei Kälte, rot bei Schaden ----------
  const rand = document.createElement('div');
  rand.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;transition:box-shadow .4s;box-shadow:none';
  document.body.appendChild(rand);
  let randAlt = '';
  function zeigeRand() {
    const kalt = welt.spieler().gehen ? Math.max(0, 0.6 - z.waerme) / 0.6 : 0;
    const rot = Math.max(schadenBlitz, z.leben < 25 ? 0.35 * (1 - z.leben / 25) : 0, ohnmacht > 0 ? 0.9 : 0);
    let s = 'none';
    if (rot > 0.03) s = `inset 0 0 ${Math.round(60 + 80 * rot)}px rgba(200,20,20,${(0.25 + 0.5 * rot).toFixed(2)})`;
    else if (kalt > 0.03) s = `inset 0 0 ${Math.round(50 + 90 * kalt)}px rgba(120,190,255,${(0.25 + 0.5 * kalt).toFixed(2)})`;
    if (s !== randAlt) { rand.style.boxShadow = s; randAlt = s; }
  }

  // ---------- Leben ----------
  function pruefeTod() {
    if (z.leben > 0 || ohnmacht > 0) return;
    z.leben = 0; ohnmacht = OHNMACHT_S;
    const wie = { Kälte: 'erfroren', Hunger: 'verhungert', Durst: 'verdurstet' }[letzterGrund] || 'gestorben';
    welt.melde(`💀 Du bist ${wie}${letzterGrund && !['Kälte', 'Hunger', 'Durst'].includes(letzterGrund) ? ` (${letzterGrund})` : ''} …`, false);
  }
  let imVerlust = false;   // während die Tasche halbiert wird, gilt man noch als tot (Tagebuch zählt das nicht als Essen)
  function aufwachen() {
    imVerlust = true;
    for (const { id, anzahl } of todVerlust(welt.inventar.plaetze)) welt.inventar.nimm(id, anzahl);
    imVerlust = false;
    wiederbeleben(z);
    welt.aufwachen?.();                       // zurück zum Startplatz (planet.js), sonst stirbt man am selben Ort gleich wieder
    welt.melde('Du wachst auf – die Hälfte der Tasche ist weg', false);
    welt.speichern?.();
  }
  const darf = () => welt.spieler().gehen && ohnmacht <= 0;

  function schaden(n, grund = '') {
    if (!darf() || !(n > 0)) return;
    z.leben = Math.max(0, z.leben - n);
    letzterGrund = grund; schadenBlitz = Math.min(1, schadenBlitz + 0.3 + n / 30);
    pruefeTod();
  }
  function heile(n) { if (darf() && n > 0) z.leben = Math.min(LEBEN_MAX, z.leben + n); }

  function esse(id) {
    if (!darf() || !ESSEN[id] || !welt.inventar.hat(id, 1)) return null;
    welt.inventar.nimm(id, 1);
    const r = iss(z, id, zufall());
    if (r.uebel) { letzterGrund = 'Übelkeit'; schadenBlitz = Math.max(schadenBlitz, 0.5); pruefeTod(); }
    return r;
  }

  welt.dienste.ueberleben = {
    schaden, heile,
    iss: (id) => !!esse(id)?.ok,
    get leben() { return z.leben; },
    get satt() { return z.satt; },
    get wasser() { return z.wasser; },
    get tot() { return ohnmacht > 0 || imVerlust; },
  };

  const knopf = welt.knopf('aEssen', '🍖 Essen', () => {
    if (!welt.spieler().gehen) { welt.melde('Erst „Gehen“ – dann essen', false); return; }
    if (ohnmacht > 0) return;
    const id = bestesEssen(z, (i) => welt.inventar.zaehle(i));
    if (!id) {
      const da = Object.keys(ESSEN).some((i) => welt.inventar.zaehle(i) > 0);
      welt.melde(da ? 'Du bist satt' : 'Nichts zu essen in der Tasche (Beeren, Pilze, Fisch …)', false);
      return;
    }
    const r = esse(id);
    welt.melde(`${r.text} · Hunger ${balken(z.satt)}`, r.ok);
    welt.speichern?.();
  });
  // schmaler als die Standard-Knöpfe, damit die Aktionsleiste im Hochformat noch passt
  if (knopf?.style) {
    knopf.style.minWidth = '0'; knopf.style.padding = '6px 9px';
    if ((globalThis.innerWidth ?? 1000) < 480) { knopf.textContent = '🍖'; knopf.title = 'Essen'; }
  }

  // ---------- Trinken: „Nehmen“ auf Wasser oder im Wasser ----------
  function wasserBei(ziel) {
    if (ziel?.art === 'boden' && ziel.p) {
      const l = ziel.p.length() || 1, x = ziel.p.x / l, y = ziel.p.y / l, zz = ziel.p.z / l;
      const pr = welt.planet.probe(x, y, zz, 0.5);
      if (pr.wasser > pr.h) return { meer: !!pr.meer && !pr.fluss };
    }
    if (welt.spieler().schwimmt && ziel?.art !== 'natur') {
      const c = welt.cam, l = c.length() || 1;
      const pr = welt.planet.probe(c.x / l, c.y / l, c.z / l, 0.5);
      return { meer: !!pr.meer && !pr.fluss };
    }
    return null;
  }

  function update(dt) {
    const uhr = welt.zw.uhr, jetzt = uhr.tag * 24 + uhr.stunde;
    const dh = uhrVorher == null ? 0 : jetzt - uhrVorher;
    uhrVorher = jetzt;
    schadenBlitz = Math.max(0, schadenBlitz - dt * 1.2);
    if (ohnmacht > 0) { ohnmacht -= dt; if (ohnmacht <= 0) aufwachen(); zeigeRand(); return; }
    const sp = welt.spieler();
    if (!sp.gehen) { zeigeRand(); return; }

    const W = welt.zw.wetter, d = welt.dienste;
    const dach = !!d.bau?.unterDach?.(welt.cam);
    const feuer = d.bau?.waermeBei?.(welt.cam) ?? 0;
    const tGefuehlt = gefuehlteTemp({
      luft: welt.zw.tJetzt, wind: W.wind, regen: W.regen, schnee: W.schnee, nass: z.nass, dach, feuer,
      kleidung: d.herstellen?.kleidungWaerme?.() ?? 0,
    });
    // Lava verbrennt (Kraterboden, siehe planet-hoehe: Feld lava)
    { const c = welt.cam, l = c.length() || 1, pr = welt.planet.probe(c.x / l, c.y / l, c.z / l, 0.5);
      if (pr.lava > 0.3 && l - welt.R - pr.h < 3) schaden(40 * dt, 'Lava'); }
    if (dh > 0 && dh <= MAX_DH) {
      const gruende = schritt(z, dh, { tGefuehlt, schwimmt: sp.schwimmt, regen: dach ? 0 : W.regen, feuer });
      if (gruende.length) { letzterGrund = gruende[0]; pruefeTod(); }
    } else z.tGefuehlt = tGefuehlt;
    if ((speicherT += dt) > 30) { speicherT = 0; welt.speichern?.(); }
    zeigeRand();
  }

  return {
    name: 'ueberleben',
    update,
    aktion(was, ziel) {
      if (was !== 'nehmen' || ohnmacht > 0) return null;
      const w = wasserBei(ziel);
      if (!w) return null;
      return trinke(z, w.meer);
    },
    hud() {
      if (!welt.spieler().gehen) return '';
      if (ohnmacht > 0) return 'Leben ░░░░░ · bewusstlos …';
      return `Leben ${balken(z.leben / LEBEN_MAX)} · Hunger ${balken(z.satt)} · Durst ${balken(z.wasser)} · ` +
        `Wärme ${Math.round(z.tGefuehlt)} °C (${waermeWort(z)})${z.nass > 0.15 ? ' · nass' : ''}`;
    },
    zustand: () => ({ leben: z.leben, satt: z.satt, wasser: z.wasser, waerme: z.waerme, nass: z.nass }),
    lade(s) { Object.assign(z, neuerZustand(s)); if (z.leben <= 0) wiederbeleben(z); startWerte(); },
    dispose() {
      rand.remove(); knopf?.remove?.();
      if (welt.dienste.ueberleben) delete welt.dienste.ueberleben;
    },
  };
}
