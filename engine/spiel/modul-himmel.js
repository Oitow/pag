/**
 * @modul    modul-himmel
 * @zweck    Spiel-Modul 'himmel': Spieluhr, Himmel (Sonne, Mond, Sterne, Wolken, Nebel), Wetter mit Regen/Schnee; Sonnenlicht mit Schatten, der dem Fokus folgt (Größe nach Qualitätsstufe); Walddunst für andere Module (`dunst` 0..1)
 * @api      HIMMEL_MODUL -> api { uhr, stand(), wetter, sonne (DirectionalLight), umgebung, sonnenRichtung (Vector3 zur Sonne), lichtRichtung (Vector3 zum Hauptlicht, nachts Mond), himmel, dunst (0..1, setzbar), setzeStunde(h), setzeWetter(art, sofort) }
 * @beispiel
 *   import { HIMMEL_MODUL } from '../../engine/spiel/modul-himmel.js';
 *   const spiel = await createSpiel({ canvas, module: [WELT_MODUL, HIMMEL_MODUL] });   // URL: ?zeit=18 ?tempo=20 ?wetter=regen ?test=1 (Uhr steht)
 *   spiel.api('himmel').setzeStunde(6.5);
 * @tags     spiel, modul, himmel, tag, nacht, sonne, mond, wetter, regen, nebel, schatten, uhr
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { createSpielzeit } from '../core/zeit.js';
import { himmelStand } from '../world/himmel-stand.js';
import { createHimmel } from '../world/himmel.js';
import { createWetter, WETTER_ARTEN } from '../world/wetter.js';
import { createNiederschlag } from '../render/niederschlag.js';

// Klima je Biom (für den Wetterwechsel): temperatur/feuchte 0..1
const KLIMA = { wiese: [0.6, 0.5], wald: [0.55, 0.7], urwald: [0.55, 0.8], moor: [0.5, 0.9], gebirge: [0.25, 0.55], strand: [0.65, 0.55], kueste: [0.65, 0.55] };
let aktiv = null;   // laufende Instanz (der Modul-Kern ruft dispose/zustand ohne ctx)
const zahl = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

export const HIMMEL_MODUL = {
  name: 'himmel', braucht: ['render'], optional: ['welt'],
  standard: {
    stunde: 17.75,            // goldene Abendstunde (wie der Dämmerwald)
    tag: 15,                  // Vollmond um Tag 15
    sekundenProStunde: 50,    // ein Tag ≈ 20 min
    breite: 48, wetter: 'klar', wetterWechsel: true,
    jahresAnteil: 0.25,       // fester Hochsommer (lange Abende); null = Jahreszeit der Uhr
    offen: { nah: 70, fern: null },      // Nebel im Freien (fern = render.stufe.sicht)
    wald: { nah: 6, fern: 230 },         // Nebel bei dunst = 1 (unter Kronen)
    waldTon: [0.78, 0.92, 0.84],          // Walddunst: grünlich-grau, etwas dunkler
  },

  async start(ctx) {
    const render = ctx.braucht('render'), welt = ctx.optional('welt');
    const { szene, kamera, stufe, url } = render, o = ctx.optionen, w = url.werte || {};
    const sekunden = Math.max(0.05, zahl(w.tempo, o.sekundenProStunde));
    const uhr = createSpielzeit({ stunde: ((zahl(w.zeit, o.stunde) % 24) + 24) % 24, tag: o.tag, sekundenProStunde: sekunden });
    uhr.pause = !!render.test;

    const wetter = createWetter({ seed: ctx.seed });
    const art = WETTER_ARTEN[w.wetter] ? w.wetter : o.wetter;
    wetter.setze(art, true);
    const wechsel = o.wetterWechsel && !render.test && !w.wetter;

    const weite = () => (stufe.name === 'niedrig' ? 45 : 70);
    const himmel = createHimmel({ szene, schattenWeite: weite(), schattenAufloesung: stufe.schatten || 1024, schattenAbstand: 300,
      radius: Math.min(2500, (kamera.far || 3000) * 0.8), sterne: stufe.name === 'niedrig' ? 500 : 900, seed: ctx.seed,
      nebel: { nah: o.offen.nah, fern: o.offen.fern ?? stufe.sicht } });
    const sonne = himmel.licht;
    sonne.shadow.normalBias = 0.06;
    sonne.shadow.bias = -0.0004;

    const regen = createNiederschlag({ seed: ctx.seed + 3, anzahl: stufe.name === 'niedrig' ? 1000 : 1800 });
    szene.add(regen.objekt);

    // Schattengröße folgt der Qualität (automatische Rückstufung des Hosts)
    const abQual = ctx.ereignisse.an?.('qualitaet', (neu) => {
      const s = Math.max(256, Math.min(stufe.schatten || 1024, neu?.schatten || stufe.schatten || 1024));
      if (s === sonne.shadow.mapSize.x) return;
      sonne.shadow.mapSize.set(s, s);
      sonne.shadow.map?.dispose(); sonne.shadow.map = null;
    });

    let stand = himmelStand({ stunde: uhr.stunde, jahresAnteil: o.jahresAnteil ?? uhr.jahresAnteil, tag: uhr.tag, breite: o.breite, wetter });
    const sonnenRichtung = new THREE.Vector3(), lichtRichtung = new THREE.Vector3(), mitte = new THREE.Vector3(), ton = new THREE.Color();
    let zeit = 0, letzteStunde = uhr.tag * 24 + uhr.stunde, dunstIst = 0;
    const api = {
      uhr, wetter, sonne, umgebung: himmel.umgebung, himmel, sonnenRichtung, lichtRichtung,
      /** Walddunst 0..1 – setzt z. B. der Riesenwald, solange der Fokus unter den Kronen ist (wird weich angeglichen). */
      dunst: 0,
      stand: () => stand,
      setzeStunde(h) { uhr.setze({ stunde: ((h % 24) + 24) % 24 }); letzteStunde = uhr.tag * 24 + uhr.stunde; },
      setzeWetter(neu, sofort = false) { if (WETTER_ARTEN[neu]) wetter.setze(neu, sofort); },
    };

    function fokus() {
      const f = ctx.dienst('fokus');
      const p = typeof f === 'function' ? f() : null;
      if (p && Number.isFinite(p.x)) mitte.set(p.x, Number.isFinite(p.y) ? p.y : (welt?.bodenHoehe?.(p.x, p.z) ?? 0), p.z);
      else mitte.copy(kamera.position);
      return mitte;
    }

    api.update = (dt) => {
      zeit += dt;
      uhr.update(dt);
      const jetzt = uhr.tag * 24 + uhr.stunde, dStunden = Math.max(0, jetzt - letzteStunde);
      letzteStunde = jetzt;
      const m = fokus();
      if (wechsel) {
        const k = KLIMA[welt?.region?.(m.x, m.z)?.biom] || KLIMA.wiese;
        wetter.update(dStunden, { temperatur: k[0], feuchte: k[1] });
        wetter.blitzUpdate(dt);
      }
      stand = himmelStand({ stunde: uhr.stunde, jahresAnteil: o.jahresAnteil ?? uhr.jahresAnteil, tag: uhr.tag, breite: o.breite, wetter }, stand);
      sonnenRichtung.fromArray(stand.sonneRichtung); lichtRichtung.fromArray(stand.lichtRichtung);
      // Walddunst weich angleichen (im Test sofort, damit Bilder stimmen)
      const ziel = Math.min(1, Math.max(0, +api.dunst || 0));
      dunstIst = render.test ? ziel : dunstIst + (ziel - dunstIst) * Math.min(1, dt * 1.5);
      const fern = o.offen.fern ?? stufe.sicht;
      himmel.setNebel(o.offen.nah + (o.wald.nah - o.offen.nah) * dunstIst, fern + (Math.min(fern, o.wald.fern) - fern) * dunstIst);
      himmel.update(stand, { kamera, mitte: m, zeit, wind: wetter.wind, windRichtung: wetter.windRichtung });
      if (dunstIst > 0.001 && szene.fog) {
        ton.setRGB(szene.fog.color.r * o.waldTon[0], szene.fog.color.g * o.waldTon[1], szene.fog.color.b * o.waldTon[2]);
        szene.fog.color.lerp(ton, dunstIst);
        if (szene.background?.isColor) szene.background.copy(szene.fog.color);
      }
      regen.update(dt, { kamera, regen: wetter.regen, schnee: wetter.schnee, wind: wetter.wind, windRichtung: wetter.windRichtung, hoehePx: render.canvas?.height || 800 });
    };
    api.dispose = () => {
      abQual?.();
      szene.remove(regen.objekt); regen.dispose();
      himmel.dispose(); wetter.dispose?.(); uhr.dispose?.();
    };
    api.update(0);
    aktiv = api;
    return api;
  },
  // nach Figur/Kamera: Kuppel und Schatten an die neue Kameraposition
  spaet(dt) { aktiv?.update(dt); },
  zustand() { return aktiv ? { uhr: aktiv.uhr.zustand(), wetter: aktiv.wetter.zustand() } : null; },
  lade(z) { if (!aktiv || !z) return; if (z.uhr) aktiv.uhr.lade(z.uhr); if (z.wetter) aktiv.wetter.lade(z.wetter); aktiv.setzeStunde(aktiv.uhr.stunde); },
  dispose() { aktiv?.dispose(); aktiv = null; },
};
