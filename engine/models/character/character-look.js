/**
 * @modul    character-look
 * @zweck    Aussehen einer Figur als reine Daten: Körperbau, Haut, Haar, Bart, Kleidung, Kopfbedeckung, Accessoires (Brille, Schal, Schmuck), Grund-Mimik; Vorlagen, Zufalls-Looks per Seed, abgeleitete Körpermaße
 * @api      LOOK_STANDARD ; STILE ; TEIL_NAMEN ; AUSDRUECKE ; VORLAGEN ; createLook(teil) -> look ; randomLook(seed,opts) -> look ; koerperMasse(look) -> masse ; farbeZahl(farbe) -> int
 * @beispiel
 *   import { createLook, randomLook, koerperMasse, VORLAGEN } from '../../engine/models/character/character-look.js';
 *   const held = createLook({ ...VORLAGEN.wanderer, haar: { farbe: '#c8a040' }, brille: { stil: 'rund' } });
 *   const npc = randomLook(hashSeed('dorf', 7));   // gleicher Seed → gleicher Look
 * @tags     figur, charakter, aussehen, look, spieler, npc, avatar, editor, speichern, accessoires, mimik
 * @version  1.1.0
 * @status   entwurf
 * @three    nein
 *
 * 1.1: neue Stile (Haar, Bart, Oberteil, Hose, Schuhe, Kopfbedeckung, Umhang), neue Teile brille/schal/schmuck,
 *      Körper schultern/muskeln, Feld ausdruck (Grund-Mimik), neue Vorlagen. Alte Spielstände bleiben gültig
 *      (fehlende Felder → Standard; erste Einträge in STILE und Körper-Standards unverändert).
 */
import { rng, pick, range, chance } from '../../core/rng.js';
import { clamp, numOr } from '../../core/math.js';

/** Erlaubte Stile je Teil (erster Eintrag = Standard). Für Editor-Menüs direkt nutzbar. */
export const STILE = {
  haar: ['kurz', 'glatze', 'lang', 'zopf', 'dutt', 'wuschel', 'irokese', 'locken', 'pferdeschwanz', 'zoepfe', 'kranz', 'scheitel'],
  bart: ['keiner', 'stoppel', 'voll', 'schnurrbart', 'ziege', 'lang', 'koteletten', 'zwirbel', 'kinnbart'],
  oberteil: ['kittel', 'hemd', 'robe', 'ruestung', 'weste', 'kleid', 'mantel', 'schuerze', 'kettenhemd', 'lederruestung'],
  hose: ['lang', 'kurz', 'rock', 'pluder'],
  schuhe: ['stiefel', 'schuhe', 'barfuss', 'sandalen', 'schnabelschuhe'],
  kopfbedeckung: ['keine', 'kapuze', 'hut', 'strohhut', 'helm', 'bandana', 'muetze', 'krone', 'zauberhut', 'dreispitz', 'topfhelm', 'kopftuch', 'federhut', 'reif', 'turban'],
  umhang: ['kein', 'kurz', 'lang', 'kragen'],
  brille: ['keine', 'rund', 'eckig', 'sonnenbrille', 'augenklappe', 'monokel'],
  schal: ['kein', 'schal', 'halstuch', 'pelzkragen'],
  schmuck: ['kein', 'ohrringe', 'kette', 'amulett', 'perlen'],
};

/** Anzeigenamen der Teile (Editor-Beschriftung). */
export const TEIL_NAMEN = {
  haar: 'Haar', bart: 'Bart', oberteil: 'Oberteil', hose: 'Hose', schuhe: 'Schuhe', kopfbedeckung: 'Kopf', umhang: 'Umhang',
  brille: 'Brille', schal: 'Schal', schmuck: 'Schmuck',
};

/** Gesichtsausdrücke (character-model: setAusdruck). Erster = Standard. */
export const AUSDRUECKE = ['neutral', 'froh', 'wuetend', 'traurig', 'ueberrascht', 'schlafend'];

/** Seltene Kopfbedeckungen: randomLook nimmt sie nur, wenn opts.stile.kopfbedeckung sie ausdrücklich erlaubt. */
const SELTEN_HUT = ['krone', 'helm', 'topfhelm', 'reif', 'zauberhut'];

/** Körper-Faktoren: [min, max] (1 = Durchschnitt; bauch, muskeln 0…1). */
const KOERPER_GRENZEN = {
  groesse: [0.5, 1.4], breite: [0.75, 1.35], kopf: [0.8, 1.5], beine: [0.8, 1.2], arme: [0.85, 1.15], bauch: [0, 1],
  schultern: [0.8, 1.3], muskeln: [0, 1],
};

export const LOOK_STANDARD = Object.freeze({
  name: 'Figur',
  koerper: { groesse: 1, breite: 1, kopf: 1, beine: 1, arme: 1, bauch: 0, schultern: 1, muskeln: 0 },
  haut: '#e0ac88',
  augen: '#2a2a3a',
  haar: { stil: 'kurz', farbe: '#4a3020' },
  bart: { stil: 'keiner', farbe: null },          // null = wie Haar
  oberteil: { stil: 'kittel', farbe: '#4f7a5a', akzent: '#8a6a3e' },
  hose: { stil: 'lang', farbe: '#5a4a3a' },
  schuhe: { stil: 'stiefel', farbe: '#4a3426' },
  kopfbedeckung: { stil: 'keine', farbe: '#7a5a3a', akzent: '#3a2a1a' },
  umhang: { stil: 'kein', farbe: '#6a2a24' },
  brille: { stil: 'keine', farbe: '#3a3430' },
  schal: { stil: 'kein', farbe: '#a83a2a', akzent: '#e8d8b0' },
  schmuck: { stil: 'kein', farbe: '#d8b048', akzent: '#3a8ac0' },   // farbe = Metall, akzent = Stein
  ausdruck: 'neutral',
  guertel: '#3a2a1a',                              // null = kein Gürtel
  tasche: false,
  rucksack: false,
});

/** Fertige Looks (Teil-Looks, werden mit createLook ergänzt). */
export const VORLAGEN = {
  wanderer: { name: 'Wanderer', haar: { stil: 'kurz', farbe: '#5a3a22' }, bart: { stil: 'stoppel' }, oberteil: { stil: 'kittel', farbe: '#4f6a7a', akzent: '#9a7a4a' },
    kopfbedeckung: { stil: 'kapuze', farbe: '#5a5040' }, umhang: { stil: 'kurz', farbe: '#5a5040' }, rucksack: true },
  baeuerin: { name: 'Bäuerin', koerper: { breite: 0.95 }, haut: '#eab894', haar: { stil: 'zopf', farbe: '#b8863a' }, oberteil: { stil: 'kleid', farbe: '#a85a3a', akzent: '#f0e0c0' },
    hose: { stil: 'rock', farbe: '#6a4a3a' }, schuhe: { stil: 'schuhe', farbe: '#5a4030' }, kopfbedeckung: { stil: 'strohhut', farbe: '#d8b860', akzent: '#a83a2a' }, tasche: true },
  ritter: { name: 'Ritter', koerper: { breite: 1.15, groesse: 1.05 }, haar: { stil: 'kurz', farbe: '#2a2018' }, bart: { stil: 'voll' }, oberteil: { stil: 'ruestung', farbe: '#9aa0a8', akzent: '#a83a2a' },
    hose: { stil: 'lang', farbe: '#4a4a52' }, kopfbedeckung: { stil: 'helm', farbe: '#9aa0a8', akzent: '#c8a040' }, umhang: { stil: 'lang', farbe: '#8a2a24' } },
  magierin: { name: 'Magierin', koerper: { breite: 0.9 }, haut: '#f0c8a8', haar: { stil: 'lang', farbe: '#d8d8e0' }, oberteil: { stil: 'robe', farbe: '#3a3a7a', akzent: '#d8b040' },
    hose: { stil: 'rock', farbe: '#2a2a5a' }, schuhe: { stil: 'schuhe', farbe: '#2a2030' }, kopfbedeckung: { stil: 'hut', farbe: '#2a2a6a', akzent: '#d8b040' }, guertel: '#d8b040' },
  schmied: { name: 'Schmied', koerper: { breite: 1.3, bauch: 0.6 }, haut: '#b07a58', haar: { stil: 'glatze', farbe: '#2a2018' }, bart: { stil: 'voll', farbe: '#3a2a1a' },
    oberteil: { stil: 'weste', farbe: '#5a3a24', akzent: '#3a2a1a' }, hose: { stil: 'lang', farbe: '#3a3430' }, kopfbedeckung: { stil: 'bandana', farbe: '#8a2a1e', akzent: '#5a1a12' } },
  kind: { name: 'Kind', koerper: { groesse: 0.62, kopf: 1.35, beine: 0.9, breite: 0.9 }, haut: '#f2c6a0', haar: { stil: 'wuschel', farbe: '#c87a3a' },
    oberteil: { stil: 'hemd', farbe: '#e0b030', akzent: '#3a7ab0' }, hose: { stil: 'kurz', farbe: '#3a5a8a' }, schuhe: { stil: 'barfuss' }, guertel: null },
  koenigin: { name: 'Königin', koerper: { groesse: 1.02, breite: 0.92 }, haut: '#e8b898', haar: { stil: 'dutt', farbe: '#2a1810' }, oberteil: { stil: 'kleid', farbe: '#6a1a3a', akzent: '#e0c060' },
    hose: { stil: 'rock', farbe: '#4a1028' }, schuhe: { stil: 'schuhe', farbe: '#3a1020' }, kopfbedeckung: { stil: 'krone', farbe: '#e0c060', akzent: '#c03040' }, umhang: { stil: 'lang', farbe: '#8a1a2a' }, guertel: '#e0c060' },
  punk: { name: 'Rebell', haar: { stil: 'irokese', farbe: '#d03a8a' }, bart: { stil: 'ziege', farbe: '#2a1a1a' }, oberteil: { stil: 'weste', farbe: '#2a2a2a', akzent: '#c0c0c0' },
    hose: { stil: 'lang', farbe: '#2a3a5a' }, schuhe: { stil: 'stiefel', farbe: '#1a1a1a' }, schmuck: { stil: 'ohrringe', farbe: '#c0c0c0' } },
  magier: { name: 'Magier', koerper: { breite: 0.9, groesse: 1.02 }, haut: '#e8b898', haar: { stil: 'lang', farbe: '#d8d8d8' }, bart: { stil: 'lang', farbe: '#e0e0e0' },
    oberteil: { stil: 'robe', farbe: '#2a3a8a', akzent: '#d8c060' }, hose: { stil: 'rock', farbe: '#1a2a6a' }, schuhe: { stil: 'schnabelschuhe', farbe: '#3a2a5a' },
    kopfbedeckung: { stil: 'zauberhut', farbe: '#2a3a8a', akzent: '#d8c060' }, schmuck: { stil: 'amulett', akzent: '#40c0a0' }, guertel: '#d8c060' },
  haendler: { name: 'Händler', koerper: { breite: 1.15, bauch: 0.7 }, haut: '#d8a07a', haar: { stil: 'kranz', farbe: '#3a2a1a' }, bart: { stil: 'zwirbel', farbe: '#3a2a1a' },
    oberteil: { stil: 'mantel', farbe: '#7a2a4a', akzent: '#d8b048' }, hose: { stil: 'pluder', farbe: '#4a3a2a' }, schuhe: { stil: 'schnabelschuhe', farbe: '#5a3a1a' },
    kopfbedeckung: { stil: 'turban', farbe: '#e0c890', akzent: '#c03040' }, schmuck: { stil: 'kette' }, tasche: true },
  alter: { name: 'Greis', koerper: { groesse: 0.94, breite: 0.9, schultern: 0.88, bauch: 0.25 }, haut: '#e0b090', haar: { stil: 'kranz', farbe: '#d8d4cc' },
    bart: { stil: 'voll', farbe: '#e0dcd4' }, oberteil: { stil: 'weste', farbe: '#5a5a4a', akzent: '#8a7a5a' }, hose: { stil: 'lang', farbe: '#4a4038' },
    schuhe: { stil: 'schuhe', farbe: '#3a2a1a' }, brille: { stil: 'rund', farbe: '#8a7a5a' }, schal: { stil: 'schal', farbe: '#6a4a3a', akzent: '#a89070' } },
  wache: { name: 'Wache', koerper: { breite: 1.12, schultern: 1.1, muskeln: 0.6 }, haar: { stil: 'kurz', farbe: '#3a2a1a' }, bart: { stil: 'stoppel' },
    oberteil: { stil: 'kettenhemd', farbe: '#8a8e94', akzent: '#2a4a8a' }, hose: { stil: 'lang', farbe: '#3a3a44' }, schuhe: { stil: 'stiefel', farbe: '#2a2018' },
    kopfbedeckung: { stil: 'helm', farbe: '#8a8e94', akzent: '#2a4a8a' }, umhang: { stil: 'kurz', farbe: '#2a4a8a' }, ausdruck: 'wuetend' },
  pirat: { name: 'Piratin', koerper: { breite: 0.98, muskeln: 0.3 }, haut: '#c08a64', haar: { stil: 'locken', farbe: '#1a1410' },
    oberteil: { stil: 'hemd', farbe: '#e8e0d0', akzent: '#a82a2a' }, hose: { stil: 'pluder', farbe: '#2a2a3a' }, schuhe: { stil: 'stiefel', farbe: '#1a1410' },
    kopfbedeckung: { stil: 'dreispitz', farbe: '#1a1a1a', akzent: '#d8b048' }, brille: { stil: 'augenklappe', farbe: '#101010' },
    schal: { stil: 'halstuch', farbe: '#a82a2a' }, schmuck: { stil: 'ohrringe' }, guertel: '#5a3a1a' },
  jaegerin: { name: 'Jägerin', koerper: { breite: 0.92, muskeln: 0.4 }, haut: '#d8a882', haar: { stil: 'pferdeschwanz', farbe: '#6a3a1a' },
    oberteil: { stil: 'lederruestung', farbe: '#6a4a2a', akzent: '#3a5a2a' }, hose: { stil: 'lang', farbe: '#3a4a2a' }, schuhe: { stil: 'stiefel', farbe: '#3a2a1a' },
    kopfbedeckung: { stil: 'federhut', farbe: '#3a5a2a', akzent: '#c03030' }, umhang: { stil: 'kragen', farbe: '#3a5a2a' }, tasche: true },
  koechin: { name: 'Köchin', koerper: { breite: 1.15, bauch: 0.5 }, haut: '#f0c0a0', haar: { stil: 'dutt', farbe: '#8a5a2a' },
    oberteil: { stil: 'schuerze', farbe: '#6a8aa8', akzent: '#f0ece0' }, hose: { stil: 'rock', farbe: '#4a5a6a' }, schuhe: { stil: 'schuhe', farbe: '#4a3426' },
    kopfbedeckung: { stil: 'kopftuch', farbe: '#e0e0d0', akzent: '#c04040' }, ausdruck: 'froh' },
  gelehrte: { name: 'Gelehrte', koerper: { breite: 0.88 }, haut: '#c89070', haar: { stil: 'scheitel', farbe: '#2a2018' }, bart: { stil: 'kinnbart', farbe: '#2a2018' },
    oberteil: { stil: 'mantel', farbe: '#2a4a3a', akzent: '#c8b080' }, hose: { stil: 'lang', farbe: '#2a2a2a' }, schuhe: { stil: 'schuhe', farbe: '#1a1410' },
    brille: { stil: 'eckig', farbe: '#2a2018' }, schal: { stil: 'schal', farbe: '#8a2a2a', akzent: '#d8c8a0' } },
  bauer: { name: 'Bauer', koerper: { breite: 1.08, muskeln: 0.5 }, haut: '#c89070', haar: { stil: 'wuschel', farbe: '#8a5a2a' }, bart: { stil: 'koteletten', farbe: '#8a5a2a' },
    oberteil: { stil: 'kittel', farbe: '#8a7a4a', akzent: '#5a4a2a' }, hose: { stil: 'lang', farbe: '#5a4a3a' }, schuhe: { stil: 'sandalen', farbe: '#6a4a2a' },
    kopfbedeckung: { stil: 'strohhut', farbe: '#d8b860', akzent: '#5a4a2a' }, schal: { stil: 'halstuch', farbe: '#a83a2a' } },
};

const HEX = /^#[0-9a-fA-F]{6}$/;
/** '#rrggbb' | 0xrrggbb → Zahl (0xrrggbb). Ungültig → null. */
export function farbeZahl(f) {
  if (typeof f === 'number' && Number.isFinite(f)) return f & 0xffffff;
  if (typeof f === 'string' && HEX.test(f)) return parseInt(f.slice(1), 16);
  return null;
}
const farbe = (f, ersatz) => (farbeZahl(f) == null ? ersatz : (typeof f === 'number' ? '#' + (f & 0xffffff).toString(16).padStart(6, '0') : f.toLowerCase()));
const stil = (liste, s) => (liste.includes(s) ? s : liste[0]);

/** Teil-Look (auch Spielstand-JSON) → vollständiger, gültiger Look. Unbekanntes wird verworfen, Fehlendes ergänzt. */
export function createLook(teil = {}) {
  const S = LOOK_STANDARD, t = teil && typeof teil === 'object' ? teil : {};
  const k = { ...S.koerper };
  for (const [n, [a, b]] of Object.entries(KOERPER_GRENZEN)) k[n] = clamp(numOr(t.koerper?.[n], S.koerper[n]), a, b);
  const teilFarbig = (name, felder) => {
    const q = t[name] || {}, d = S[name], o = {};
    if ('stil' in d) o.stil = stil(STILE[name], q.stil ?? d.stil);
    for (const f of felder) o[f] = d[f] === null && (q[f] == null) ? null : farbe(q[f], d[f]);
    return o;
  };
  return {
    name: typeof t.name === 'string' && t.name.trim() ? t.name.trim().slice(0, 40) : S.name,
    koerper: k,
    haut: farbe(t.haut, S.haut),
    augen: farbe(t.augen, S.augen),
    haar: teilFarbig('haar', ['farbe']),
    bart: teilFarbig('bart', ['farbe']),
    oberteil: teilFarbig('oberteil', ['farbe', 'akzent']),
    hose: teilFarbig('hose', ['farbe']),
    schuhe: teilFarbig('schuhe', ['farbe']),
    kopfbedeckung: teilFarbig('kopfbedeckung', ['farbe', 'akzent']),
    umhang: teilFarbig('umhang', ['farbe']),
    brille: teilFarbig('brille', ['farbe']),
    schal: teilFarbig('schal', ['farbe', 'akzent']),
    schmuck: teilFarbig('schmuck', ['farbe', 'akzent']),
    ausdruck: stil(AUSDRUECKE, t.ausdruck),
    guertel: t.guertel === null ? null : farbe(t.guertel, S.guertel),
    tasche: !!(t.tasche ?? S.tasche),
    rucksack: !!(t.rucksack ?? S.rucksack),
  };
}

const HAUT = ['#f6d2b8', '#eab894', '#e0ac88', '#c89070', '#b07a58', '#8a5a3e', '#6a4230', '#4a2e22'];
const HAAR = ['#1a1410', '#2a2018', '#4a3020', '#6a4a2a', '#8a5a2a', '#b8863a', '#d8b870', '#a83a1e', '#c8c0b8', '#e8e4dc'];
const STOFF = ['#4f7a5a', '#4f6a7a', '#7a4a3a', '#8a6a3e', '#5a5a6a', '#6a3a5a', '#a85a3a', '#3a5a3a', '#7a7a4a', '#2f4f6f', '#9a8a6a', '#6a2a24'];
const METALL = ['#9aa0a8', '#8a8a86', '#a8a49a', '#7a8088', '#b0a080'];
const LEDER = ['#4a3426', '#3a2a1a', '#5a4030', '#2a2018', '#6a5040'];
const STEIN = ['#c03040', '#3a8ac0', '#40a060', '#a040c0', '#e0e0f0'];
const VORNAMEN = ['Alma', 'Bert', 'Cora', 'Dirk', 'Elsa', 'Finn', 'Greta', 'Hugo', 'Ida', 'Jonas', 'Kira', 'Lutz', 'Mila', 'Nils', 'Olga', 'Paul', 'Rike', 'Sven', 'Tilda', 'Udo', 'Vera', 'Wim'];

/**
 * Zufälliger, stimmiger Look aus Seed. opts: { kind: bool, grundlage: Teil-Look, stile: { oberteil: [...] } (erlaubte Auswahl) }
 * Seltene Teile (Krone, Helme, Zauberhut, Reif) nur, wenn opts.stile.kopfbedeckung gesetzt ist.
 */
export function randomLook(seed, opts = {}) {
  const r = rng(seed);
  const w = (name, liste = STILE[name]) => pick(r, opts.stile?.[name] || liste);
  const kind = !!opts.kind;
  const haarStil = kind ? w('haar', ['kurz', 'wuschel', 'zopf', 'lang', 'locken', 'pferdeschwanz', 'zoepfe', 'scheitel']) : w('haar');
  const haarFarbe = pick(r, chance(r, kind ? 0 : 0.12) ? HAAR.slice(-2) : HAAR);
  const muskeln = !kind && chance(r, 0.3) ? range(r, 0.2, 0.9) : 0;
  const teil = {
    name: pick(r, VORNAMEN),
    koerper: kind
      ? { groesse: range(r, 0.55, 0.72), kopf: range(r, 1.25, 1.45), beine: range(r, 0.85, 0.95), breite: range(r, 0.85, 0.95), schultern: range(r, 0.85, 0.95) }
      : { groesse: range(r, 0.9, 1.1), breite: range(r, 0.85, 1.25), kopf: range(r, 0.92, 1.1), beine: range(r, 0.92, 1.08), arme: range(r, 0.95, 1.05),
        bauch: chance(r, 0.3) ? range(r, 0.2, 0.8) : 0, schultern: range(r, 0.9, 1.12) + muskeln * 0.08, muskeln },
    haut: pick(r, HAUT),
    haar: { stil: haarStil, farbe: haarFarbe },
    bart: { stil: !kind && chance(r, 0.35) ? w('bart', STILE.bart.slice(1)) : 'keiner', farbe: haarFarbe },
    oberteil: { stil: kind ? w('oberteil', ['hemd', 'kittel', 'schuerze']) : w('oberteil'), farbe: pick(r, STOFF), akzent: pick(r, STOFF) },
    hose: { stil: kind ? w('hose', ['kurz', 'lang']) : w('hose'), farbe: pick(r, STOFF) },
    schuhe: { stil: w('schuhe'), farbe: pick(r, LEDER) },
    kopfbedeckung: { stil: chance(r, 0.45) ? w('kopfbedeckung') : 'keine', farbe: pick(r, STOFF), akzent: pick(r, LEDER) },
    umhang: { stil: chance(r, 0.2) ? w('umhang', STILE.umhang.slice(1)) : 'kein', farbe: pick(r, STOFF) },
    brille: { stil: chance(r, kind ? 0.05 : 0.14) ? w('brille', kind ? ['rund'] : STILE.brille.slice(1)) : 'keine', farbe: pick(r, LEDER) },
    schal: { stil: chance(r, 0.15) ? w('schal', STILE.schal.slice(1)) : 'kein', farbe: pick(r, STOFF), akzent: pick(r, STOFF) },
    schmuck: { stil: chance(r, kind ? 0.05 : 0.2) ? w('schmuck', STILE.schmuck.slice(1)) : 'kein', farbe: pick(r, METALL.concat('#d8b048', '#e0c060')), akzent: pick(r, STEIN) },
    guertel: chance(r, 0.75) ? pick(r, LEDER) : null,
    tasche: chance(r, 0.3),
    rucksack: chance(r, 0.15),
  };
  // Rüstungen in Metall/Leder statt Stoff
  const o = teil.oberteil.stil;
  if (o === 'ruestung' || o === 'kettenhemd') teil.oberteil.farbe = pick(r, METALL);
  if (o === 'lederruestung') teil.oberteil.farbe = pick(r, LEDER.concat('#7a5a3a', '#8a6a42'));
  if (o === 'schuerze') teil.oberteil.akzent = pick(r, ['#f0ece0', '#e0d8c0', '#d8d0b8', teil.oberteil.akzent]);
  // Seltenes nur, wenn ausdrücklich erlaubt
  if (!opts.stile?.kopfbedeckung && SELTEN_HUT.includes(teil.kopfbedeckung.stil)) teil.kopfbedeckung.stil = 'muetze';
  if (teil.kopfbedeckung.stil === 'helm') teil.kopfbedeckung.farbe = pick(r, METALL);
  return createLook(mischen(teil, opts.grundlage));
}

function mischen(a, b) {
  if (!b) return a;
  const o = { ...a };
  for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? { ...a[k], ...v } : v;
  return o;
}

/**
 * Abgeleitete Maße in Metern (Ursprung an den Füßen, Blick +Z). Grundlage für Skelett, Animation und Kollision.
 * → { hoehe, radius, fussHoehe, fussLaenge, unterschenkel, oberschenkel, hueftHoehe, beckenBreite, torsoAbstand,
 *     torsoLaenge, schulterX, schulterY, oberarm, unterarm, hand, halsLaenge, kopfRadius, breite, bauch, schrittLaenge, augenHoehe }
 */
export function koerperMasse(look = LOOK_STANDARD) {
  const k = createLook(look).koerper, g = k.groesse, w = k.breite;
  const fussHoehe = 0.07 * g, bein = 0.41 * g * k.beine;
  const hueftHoehe = fussHoehe + bein * 2;
  const torsoAbstand = 0.05 * g, torsoLaenge = 0.5 * g, halsLaenge = 0.08 * g, kopfRadius = 0.115 * g * k.kopf;
  const hoehe = hueftHoehe + torsoAbstand + torsoLaenge + halsLaenge + kopfRadius * 2;
  return {
    hoehe, radius: 0.3 * g * w,
    fussHoehe, fussLaenge: 0.24 * g, unterschenkel: bein, oberschenkel: bein, hueftHoehe,
    beckenBreite: 0.1 * g * w, torsoAbstand, torsoLaenge,
    schulterX: 0.2 * g * w * k.schultern, schulterY: torsoLaenge - 0.07 * g,
    oberarm: 0.27 * g * k.arme, unterarm: 0.24 * g * k.arme, hand: 0.08 * g,
    halsLaenge, kopfRadius, breite: w, bauch: k.bauch,
    schrittLaenge: bein * 2 * 0.8,                       // ein Schritt (ein Fuß) beim Gehen
    augenHoehe: hoehe - kopfRadius * 0.9,
  };
}
