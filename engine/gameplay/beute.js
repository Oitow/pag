/**
 * @modul    beute
 * @zweck    Beute-Tabellen (ratte … boss, kiste), gewichtet per Seed: Material, Tränke, Gold und Ausrüstung mit Seltenheit, Stufe, Werten und Affixen; Namen wie "Scharfes Wolfszahn-Schwert"; Beschreibung für die Oberfläche
 * @api      BEUTE_TABELLEN ; wuerfle(tabelle, {seed|zufall, stufe}) -> [{id,anzahl,daten?}] ; erzeugeAusruestung(id, {zufall, stufe, seltenheit, stamm}) -> daten ; beschreibe(id, daten) -> {name, zeilen, farbe} ; seltenheitFarbe(s) ; ausruestungsName(id, daten)
 * @beispiel
 *   import { wuerfle, beschreibe } from '../../engine/gameplay/beute.js';
 *   const drops = wuerfle('wolf', { seed: 42, stufe: 4 });   // [{ id:'wolfszahn', anzahl:1 }, { id:'gold', anzahl:7 }, …]
 *   beschreibe('schwert', drops.find((d) => d.daten)?.daten);
 * @tags     beute, drop, loot, seltenheit, affix, gegenstand, seed, mmo
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Gleicher Seed + Tabelle + Stufe = gleiche Beute. Boss: immer mindestens 1 Teil Episch+ (Legendär 25 %).
 * daten = { stufe, seltenheit, werte:{…}, affixe:[{id,wert,betrag}], stamm? }. Werte wachsen mit Stufe (+18 %/Stufe) und Seltenheit.
 */
import { rng, hashSeed, weighted, int, range } from '../core/rng.js';
import { GEGENSTAENDE, SELTENHEITEN, AFFIXE, WERT_NAMEN } from './gegenstaende-daten.js';

const SW = { gewoehnlich: 70, selten: 25, episch: 4.5, legendaer: 0.5 };
const WAFFEN_ID = ['schwert', 'axt', 'dolch', 'stab', 'bogen'];
const RUESTUNG_ID = ['helm', 'harnisch', 'beinlinge', 'stiefel', 'ring'];
const AUSR = [...WAFFEN_ID, ...RUESTUNG_ID];

/** Tabelle: gold [min,max] (Stufe skaliert) · material [[id,gewicht,[a,b]]] · traenke [[id,gewicht]] · ausruestung Chance + stamm + Seltenheits-Gewichte · garantiert Anzahl Ausrüstung. */
export const BEUTE_TABELLEN = {
  ratte: { gold: [0, 2], gewichtMat: 0.5, material: [['rattenfell', 1, [1, 1]]], traenke: [['heiltrank', 1]], tr: 0.04, ausruestung: 0.04, stamm: 'Rattenfell' },
  riesenratte: { gold: [1, 4], gewichtMat: 0.8, material: [['rattenfell', 1, [1, 2]]], traenke: [['heiltrank', 3], ['manatrank', 1]], tr: 0.1, ausruestung: 0.12, stamm: 'Rattenfell' },
  wolf: { gold: [2, 6], gewichtMat: 0.7, material: [['wolfszahn', 1, [1, 2]]], traenke: [['heiltrank', 2], ['manatrank', 1]], tr: 0.12, ausruestung: 0.16, stamm: 'Wolfszahn' },
  keiler: { gold: [3, 8], gewichtMat: 0.7, material: [['keilerhauer', 1, [1, 1]]], traenke: [['heiltrank', 2]], tr: 0.12, ausruestung: 0.18, stamm: 'Keilerhauer' },
  irrlicht: { gold: [2, 7], gewichtMat: 0.8, material: [['irrlichtstaub', 1, [1, 2]]], traenke: [['manatrank', 3], ['heiltrank', 1]], tr: 0.14, ausruestung: 0.14, stamm: 'Irrlicht', sw: { gewoehnlich: 55, selten: 35, episch: 9, legendaer: 1 } },
  boss: { gold: [40, 70], gewichtMat: 1, material: [['wolfszahn', 1, [3, 5]], ['keilerhauer', 1, [2, 3]]], traenke: [['heiltrank', 1], ['manatrank', 1]], tr: 1, ausruestung: 1, garantiert: 2, bossSeltenheit: true, stamm: 'Wolfsfels' },
  kiste: { gold: [10, 25], gewichtMat: 0.6, material: [['irrlichtstaub', 1, [1, 3]], ['rattenfell', 1, [1, 3]]], traenke: [['heiltrank', 2], ['manatrank', 2]], tr: 0.9, ausruestung: 0.6, garantiert: 1, sw: { gewoehnlich: 40, selten: 40, episch: 17, legendaer: 3 } },
};

const runde = (v) => Math.round(v * 10) / 10;
export const seltenheitFarbe = (s) => SELTENHEITEN[s]?.farbe ?? '#c8c8c8';
const wuerfelSeltenheit = (r, sw) => weighted(r, Object.entries(sw));

/** Ausrüstung erzeugen (zufall = rng-Funktion). */
export function erzeugeAusruestung(id, { zufall, stufe = 1, seltenheit = 'gewoehnlich', stamm = null } = {}) {
  const g = GEGENSTAENDE[id];
  if (!g?.grundwerte) throw new Error(`beute: '${id}' ist keine Ausrüstung`);
  const s = Math.max(1, Math.floor(stufe)), sel = SELTENHEITEN[seltenheit] || SELTENHEITEN.gewoehnlich;
  const f = (1 + 0.18 * (s - 1)) * sel.mult;
  const werte = {};
  for (const [k, v] of Object.entries(g.grundwerte)) werte[k] = runde(v * f);
  const affixe = [];
  const pool = AFFIXE.filter((a) => g.art === 'waffe' || a.wert !== 'schaden');
  for (let i = 0; i < sel.affixe && pool.length; i++) {
    const a = pool.splice(Math.floor(zufall() * pool.length), 1)[0];
    const betrag = runde(Math.max(1, a.basis * (1 + 0.12 * (s - 1)) * (0.85 + zufall() * 0.3) * (0.8 + 0.2 * sel.affixe)));
    affixe.push({ id: a.id, wert: a.wert, betrag });
    werte[a.wert] = runde((werte[a.wert] || 0) + betrag);
  }
  const daten = { stufe: s, seltenheit, werte, affixe };
  if (stamm) daten.stamm = stamm;
  return daten;
}

/** Ausrüstungsname: "Scharfes Wolfszahn-Schwert" (Adjektiv des ersten Affixes, Stamm der Beutequelle). */
export function ausruestungsName(id, daten) {
  const g = GEGENSTAENDE[id];
  if (!g) return String(id);
  const a = daten?.affixe?.[0] && AFFIXE.find((x) => x.id === daten.affixe[0].id);
  const ende = { m: 'er', n: 'es', f: 'e', p: 'e' }[g.genus] || 'e';
  const kern = daten?.stamm ? `${daten.stamm}-${g.name}` : g.name;
  return a ? `${a.adj}${ende} ${kern}` : kern;
}

export function beschreibe(id, daten) {
  const g = GEGENSTAENDE[id];
  if (!g) return { name: String(id), zeilen: [], farbe: '#c8c8c8' };
  if (!daten || !g.grundwerte) {
    const z = [];
    if (g.art === 'trank') z.push(g.wirkung?.heile ? `Heilt ${g.wirkung.heile} Leben` : `Stellt ${g.wirkung?.mana ?? 0} Mana her`);
    else if (g.art === 'material') z.push('Handwerksmaterial');
    else if (g.art === 'gold') z.push('Währung');
    return { name: g.name, zeilen: z, farbe: '#c8c8c8' };
  }
  const sel = SELTENHEITEN[daten.seltenheit] || SELTENHEITEN.gewoehnlich;
  const zeilen = [`Stufe ${daten.stufe} · ${sel.name} · ${g.sockel}`];
  for (const [k, v] of Object.entries(daten.werte || {})) zeilen.push(`${v >= 0 ? '+' : ''}${v} ${WERT_NAMEN[k] || k}`);
  return { name: ausruestungsName(id, daten), zeilen, farbe: sel.farbe };
}

/** Beute würfeln. Gleiche Eingaben = gleiche Beute. */
export function wuerfle(tabelle, { seed = 1, zufall = null, stufe = 1 } = {}) {
  const t = typeof tabelle === 'string' ? BEUTE_TABELLEN[tabelle] : tabelle;
  if (!t) return [];
  const r = zufall || rng(hashSeed('beute', typeof tabelle === 'string' ? tabelle : 'x', seed));
  const aus = [];
  const gold = int(r, t.gold[0], t.gold[1]) * (1 + 0.25 * (stufe - 1));
  if (gold >= 1) aus.push({ id: 'gold', anzahl: Math.round(gold) });
  if (r() < t.gewichtMat) {
    const m = weighted(r, t.material.map((e) => [e, e[1]]));
    aus.push({ id: m[0], anzahl: int(r, m[2][0], m[2][1]) });
  }
  if (r() < t.tr) aus.push({ id: weighted(r, t.traenke), anzahl: 1 });
  let n = t.garantiert || 0;
  if (r() < t.ausruestung && n < 1) n = 1;
  for (let i = 0; i < n; i++) {
    const id = AUSR[Math.floor(r() * AUSR.length)];
    let sel = wuerfelSeltenheit(r, t.sw || SW);
    if (t.bossSeltenheit) sel = r() < 0.25 ? 'legendaer' : 'episch';
    else if (i === 0 && t.garantiert && sel === 'gewoehnlich') sel = 'selten';
    aus.push({ id, anzahl: 1, daten: erzeugeAusruestung(id, { zufall: r, stufe, seltenheit: sel, stamm: t.stamm }) });
  }
  return aus;
}
