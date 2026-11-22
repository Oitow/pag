/**
 * @modul    progression
 * @zweck    Stufen 1–15 (XP-Kurve), Talentpunkte, Klassen-Attribute pro Stufe und Talentbaum (3 Zweige × 4 Talente je Klasse) als reine Logik; werte() summiert Grund + Stufe + Talente + Ausrüstung
 * @api      createProgression({klasse,name,stufe,xp}) -> {klasse,name,stufe,xp,xpNaechste,punkte,gibXp(n)->{aufstiege:[stufe],stufe},lerne(id)->{ok,grund},talentStufe(id),hat(id),baum,werte(ausruestung?)->{…},zustand(),lade(z)} ; xpFuer(stufe) ; MAX_STUFE ; KLASSEN ; TALENTBAUM {klasse:[zweig]}
 * @beispiel
 *   import { createProgression } from '../../engine/gameplay/progression.js';
 *   const p = createProgression({ klasse: 'krieger', name: 'Goi' });
 *   p.gibXp(200).aufstiege;                 // [2]
 *   p.lerne('kr_schlag');                   // { ok: true }
 *   p.werte({ schaden: 8 }).leben;          // Grund + Stufe + Talente + Ausrüstung
 * @tags     fortschritt, stufe, xp, talent, attribute, klasse, mmo
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * XP: xpFuer(s) = round(80·s^1.6) für den Weg von Stufe s zu s+1; xp zählt innerhalb der Stufe. Talentpunkt: 1 je Stufe ab 2.
 * Talent: { id, name, max, voraus (Punkte im selben Zweig), wirkung:{wert:betrag je Stufe} }.
 */

export const MAX_STUFE = 15;
export const KLASSEN = ['krieger', 'magier', 'waldlaeufer'];
export const xpFuer = (s) => Math.round(80 * Math.pow(Math.max(1, s), 1.6));

const NULL = { staerke: 0, intellekt: 0, geschick: 0, ausdauer: 0, ruestung: 0, schaden: 0, zauberkraft: 0, krit: 0, tempo: 0, leben: 0, mana: 0 };
const A = (o) => ({ ...NULL, ...o });
const GRUND = {
  krieger: A({ staerke: 10, intellekt: 3, geschick: 5, ausdauer: 9, leben: 90, mana: 30, ruestung: 6, krit: 5 }),
  magier: A({ staerke: 3, intellekt: 11, geschick: 5, ausdauer: 6, leben: 60, mana: 90, ruestung: 1, krit: 5 }),
  waldlaeufer: A({ staerke: 5, intellekt: 5, geschick: 11, ausdauer: 7, leben: 70, mana: 50, ruestung: 3, krit: 8 }),
};
const PRO_STUFE = {
  krieger: A({ staerke: 3, intellekt: 1, geschick: 1.5, ausdauer: 2.5, leben: 14, mana: 3, ruestung: 1 }),
  magier: A({ staerke: 1, intellekt: 3.5, geschick: 1.5, ausdauer: 1.5, leben: 7, mana: 12 }),
  waldlaeufer: A({ staerke: 1.5, intellekt: 1.5, geschick: 3.5, ausdauer: 2, leben: 10, mana: 6, ruestung: 0.5 }),
};
const HAUPT = { krieger: 'staerke', magier: 'intellekt', waldlaeufer: 'geschick' };

const T = (id, name, max, voraus, wirkung) => ({ id, name, max, voraus, wirkung });
const Z = (id, name, talente) => ({ id, name, talente });
/** Zweig-Punkte-Voraussetzung: 0 / 2 / 4 / 6 Punkte im selben Zweig. */
export const TALENTBAUM = {
  krieger: [
    Z('waffen', 'Waffenmeister', [T('kr_schlag', 'Kräftiger Schlag', 3, 0, { schaden: 2 }), T('kr_klinge', 'Scharfe Klinge', 3, 2, { krit: 1.5 }), T('kr_wucht', 'Wucht', 3, 4, { staerke: 2 }), T('kr_meister', 'Meisterstreich', 1, 6, { schaden: 6, krit: 4 })]),
    Z('schutz', 'Bollwerk', [T('kr_haut', 'Dicke Haut', 3, 0, { ruestung: 3 }), T('kr_zaeh', 'Zähigkeit', 3, 2, { ausdauer: 2 }), T('kr_leben', 'Lebenskraft', 3, 4, { leben: 20 }), T('kr_fels', 'Fels in der Brandung', 1, 6, { ruestung: 10, leben: 30 })]),
    Z('zorn', 'Berserker', [T('kr_wut', 'Wut', 3, 0, { staerke: 1, tempo: 2 }), T('kr_hast', 'Hast', 3, 2, { tempo: 3 }), T('kr_blut', 'Blutrausch', 3, 4, { krit: 2, schaden: 1 }), T('kr_rasen', 'Rasender Zorn', 1, 6, { schaden: 5, tempo: 6 })]),
  ],
  magier: [
    Z('feuer', 'Feuer', [T('ma_glut', 'Glut', 3, 0, { zauberkraft: 3 }), T('ma_funke', 'Funkenflug', 3, 2, { krit: 1.5 }), T('ma_brand', 'Inferno', 3, 4, { zauberkraft: 4 }), T('ma_nova', 'Feuernova', 1, 6, { zauberkraft: 10, krit: 4 })]),
    Z('frost', 'Frost', [T('ma_kalt', 'Kälte', 3, 0, { intellekt: 2 }), T('ma_eis', 'Eispanzer', 3, 2, { ruestung: 3 }), T('ma_klar', 'Klarer Geist', 3, 4, { mana: 15 }), T('ma_sturm', 'Froststurm', 1, 6, { zauberkraft: 8, mana: 25 })]),
    Z('arkan', 'Arkan', [T('ma_fokus', 'Fokus', 3, 0, { zauberkraft: 2 }), T('ma_fluss', 'Manafluss', 3, 2, { mana: 12 }), T('ma_tempo', 'Zauberhast', 3, 4, { tempo: 3 }), T('ma_macht', 'Arkane Macht', 1, 6, { intellekt: 8, zauberkraft: 6 })]),
  ],
  waldlaeufer: [
    Z('jagd', 'Jagd', [T('wl_ziel', 'Ruhige Hand', 3, 0, { schaden: 2 }), T('wl_blick', 'Falkenblick', 3, 2, { krit: 1.5 }), T('wl_pfeil', 'Durchschlag', 3, 4, { geschick: 2 }), T('wl_meister', 'Meisterschuss', 1, 6, { schaden: 6, krit: 5 })]),
    Z('schatten', 'Schatten', [T('wl_huschen', 'Huschen', 3, 0, { tempo: 3 }), T('wl_dolch', 'Dolchkunst', 3, 2, { geschick: 2 }), T('wl_gift', 'Gift', 3, 4, { schaden: 2, krit: 1 }), T('wl_tod', 'Lautloser Tod', 1, 6, { krit: 8, tempo: 4 })]),
    Z('natur', 'Natur', [T('wl_rinde', 'Rindenhaut', 3, 0, { ruestung: 2 }), T('wl_kraut', 'Kräuterkunde', 3, 2, { leben: 15 }), T('wl_wald', 'Waldgeist', 3, 4, { ausdauer: 2, mana: 8 }), T('wl_hain', 'Segen des Hains', 1, 6, { leben: 40, ruestung: 6 })]),
  ],
};

export function createProgression({ klasse = 'krieger', name = 'Held', stufe = 1, xp = 0 } = {}) {
  if (!GRUND[klasse]) klasse = 'krieger';
  const baum = TALENTBAUM[klasse];
  const talente = {};          // id -> Stufe
  const info = new Map();      // id -> { talent, zweig }
  for (const z of baum) for (const t of z.talente) info.set(t.id, { t, z });
  const st = { stufe: Math.min(MAX_STUFE, Math.max(1, stufe | 0)), xp: Math.max(0, xp) };
  const zweigPunkte = (z) => z.talente.reduce((n, t) => n + (talente[t.id] || 0), 0);
  const ausgegeben = () => { let n = 0; for (const id in talente) n += talente[id]; return n; };

  function gibXp(n) {
    const aufstiege = [];
    if (st.stufe >= MAX_STUFE || !(n > 0)) return { aufstiege, stufe: st.stufe };
    st.xp += n;
    while (st.stufe < MAX_STUFE && st.xp >= xpFuer(st.stufe)) { st.xp -= xpFuer(st.stufe); st.stufe++; aufstiege.push(st.stufe); }
    if (st.stufe >= MAX_STUFE) st.xp = 0;
    return { aufstiege, stufe: st.stufe };
  }

  function lerne(id) {
    const e = info.get(id);
    if (!e) return { ok: false, grund: 'unbekannt' };
    if ((talente[id] || 0) >= e.t.max) return { ok: false, grund: 'maximal' };
    if (api.punkte < 1) return { ok: false, grund: 'keine Punkte' };
    if (zweigPunkte(e.z) < e.t.voraus) return { ok: false, grund: `${e.t.voraus} Punkte in ${e.z.name} nötig` };
    talente[id] = (talente[id] || 0) + 1;
    return { ok: true, stufe: talente[id] };
  }

  /** Alle Werte: Grund + (stufe-1)·proStufe + Talente + Ausrüstung, dann abgeleitete Anteile. */
  function werte(ausr = null) {
    const w = { ...GRUND[klasse] }, p = PRO_STUFE[klasse], s = st.stufe - 1;
    for (const k in w) w[k] += p[k] * s;
    for (const id in talente) for (const k in info.get(id).t.wirkung) w[k] += info.get(id).t.wirkung[k] * talente[id];
    if (ausr) for (const k in ausr) w[k] = (w[k] || 0) + ausr[k];
    w.leben += w.ausdauer * 5; w.mana += w.intellekt * 4;
    w.schaden += w[HAUPT[klasse]] * 0.5; w.zauberkraft += w.intellekt * 0.6;
    w.krit += w.geschick * 0.1; w.ruestung += w.ausdauer * 0.4;
    for (const k in w) w[k] = Math.round(w[k] * 10) / 10;
    return w;
  }

  const api = {
    klasse, name, baum,
    get stufe() { return st.stufe; },
    get xp() { return st.xp; },
    get xpNaechste() { return st.stufe >= MAX_STUFE ? 0 : xpFuer(st.stufe); },
    get punkte() { return st.stufe - 1 - ausgegeben(); },
    gibXp, lerne, werte,
    talentStufe: (id) => talente[id] || 0,
    hat: (id) => (talente[id] || 0) > 0,
    zustand: () => ({ klasse, name, stufe: st.stufe, xp: st.xp, talente: { ...talente } }),
    lade(z) {
      if (!z) return;
      st.stufe = Math.min(MAX_STUFE, Math.max(1, z.stufe | 0 || 1)); st.xp = Math.max(0, +z.xp || 0);
      for (const id in talente) delete talente[id];
      let rest = st.stufe - 1;
      for (const id in z.talente || {}) {
        const n = Math.min(z.talente[id] | 0, info.get(id)?.t.max || 0, rest);
        if (n > 0) { talente[id] = n; rest -= n; }
      }
    },
  };
  return api;
}
