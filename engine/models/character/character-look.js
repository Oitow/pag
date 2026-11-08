/**
 * @modul    character-look
 * @zweck    Aussehen einer Figur als reine Daten: Körperbau, Haut, Haar, Kleidung, Kopfbedeckung; Vorlagen, Zufalls-Looks per Seed, abgeleitete Körpermaße
 * @api      LOOK_STANDARD ; STILE ; VORLAGEN ; createLook(teil) -> look ; randomLook(seed,opts) -> look ; koerperMasse(look) -> masse ; farbeZahl(farbe) -> int
 * @beispiel
 *   import { createLook, randomLook, koerperMasse, VORLAGEN } from '../../engine/models/character/character-look.js';
 *   const held = createLook({ ...VORLAGEN.wanderer, haar: { farbe: '#c8a040' } });
 *   const npc = randomLook(hashSeed('dorf', 7));   // gleicher Seed → gleicher Look
 * @tags     figur, charakter, aussehen, look, spieler, npc, avatar, editor, speichern
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { rng, pick, range, chance } from '../../core/rng.js';
import { clamp, numOr } from '../../core/math.js';

/** Erlaubte Stile je Teil (erster Eintrag = Standard). Für Editor-Menüs direkt nutzbar. */
export const STILE = {
  haar: ['kurz', 'glatze', 'lang', 'zopf', 'dutt', 'wuschel', 'irokese'],
  bart: ['keiner', 'stoppel', 'voll', 'schnurrbart', 'ziege'],
  oberteil: ['kittel', 'hemd', 'robe', 'ruestung', 'weste', 'kleid'],
  hose: ['lang', 'kurz', 'rock'],
  schuhe: ['stiefel', 'schuhe', 'barfuss'],
  kopfbedeckung: ['keine', 'kapuze', 'hut', 'strohhut', 'helm', 'bandana', 'muetze', 'krone'],
  umhang: ['kein', 'kurz', 'lang'],
};

/** Körper-Faktoren: [min, max] (1 = Durchschnitt; bauch 0…1). */
const KOERPER_GRENZEN = {
  groesse: [0.5, 1.4], breite: [0.75, 1.35], kopf: [0.8, 1.5], beine: [0.8, 1.2], arme: [0.85, 1.15], bauch: [0, 1],
};

export const LOOK_STANDARD = Object.freeze({
  name: 'Figur',
  koerper: { groesse: 1, breite: 1, kopf: 1, beine: 1, arme: 1, bauch: 0 },
  haut: '#e0ac88',
  augen: '#2a2a3a',
  haar: { stil: 'kurz', farbe: '#4a3020' },
  bart: { stil: 'keiner', farbe: null },          // null = wie Haar
  oberteil: { stil: 'kittel', farbe: '#4f7a5a', akzent: '#8a6a3e' },
  hose: { stil: 'lang', farbe: '#5a4a3a' },
  schuhe: { stil: 'stiefel', farbe: '#4a3426' },
  kopfbedeckung: { stil: 'keine', farbe: '#7a5a3a', akzent: '#3a2a1a' },
  umhang: { stil: 'kein', farbe: '#6a2a24' },
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
    hose: { stil: 'lang', farbe: '#2a3a5a' }, schuhe: { stil: 'stiefel', farbe: '#1a1a1a' } },
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
    guertel: t.guertel === null ? null : farbe(t.guertel, S.guertel),
    tasche: !!(t.tasche ?? S.tasche),
    rucksack: !!(t.rucksack ?? S.rucksack),
  };
}

const HAUT = ['#f6d2b8', '#eab894', '#e0ac88', '#c89070', '#b07a58', '#8a5a3e', '#6a4230', '#4a2e22'];
const HAAR = ['#1a1410', '#2a2018', '#4a3020', '#6a4a2a', '#8a5a2a', '#b8863a', '#d8b870', '#a83a1e', '#c8c0b8', '#e8e4dc'];
const STOFF = ['#4f7a5a', '#4f6a7a', '#7a4a3a', '#8a6a3e', '#5a5a6a', '#6a3a5a', '#a85a3a', '#3a5a3a', '#7a7a4a', '#2f4f6f', '#9a8a6a', '#6a2a24'];
const LEDER = ['#4a3426', '#3a2a1a', '#5a4030', '#2a2018', '#6a5040'];
const VORNAMEN = ['Alma', 'Bert', 'Cora', 'Dirk', 'Elsa', 'Finn', 'Greta', 'Hugo', 'Ida', 'Jonas', 'Kira', 'Lutz', 'Mila', 'Nils', 'Olga', 'Paul', 'Rike', 'Sven', 'Tilda', 'Udo', 'Vera', 'Wim'];

/**
 * Zufälliger, stimmiger Look aus Seed. opts: { kind: bool, grundlage: Teil-Look, stile: { oberteil: [...] } (erlaubte Auswahl) }
 */
export function randomLook(seed, opts = {}) {
  const r = rng(seed);
  const w = (name) => pick(r, opts.stile?.[name] || STILE[name]);
  const kind = !!opts.kind;
  const haarStil = kind ? pick(r, ['kurz', 'wuschel', 'zopf', 'lang']) : w('haar');
  const haarFarbe = pick(r, HAAR);
  const teil = {
    name: pick(r, VORNAMEN),
    koerper: kind
      ? { groesse: range(r, 0.55, 0.72), kopf: range(r, 1.25, 1.45), beine: range(r, 0.85, 0.95), breite: range(r, 0.85, 0.95) }
      : { groesse: range(r, 0.9, 1.1), breite: range(r, 0.85, 1.25), kopf: range(r, 0.92, 1.1), beine: range(r, 0.92, 1.08), arme: range(r, 0.95, 1.05), bauch: chance(r, 0.3) ? range(r, 0.2, 0.8) : 0 },
    haut: pick(r, HAUT),
    haar: { stil: haarStil, farbe: haarFarbe },
    bart: { stil: !kind && chance(r, 0.35) ? pick(r, STILE.bart.slice(1)) : 'keiner', farbe: haarFarbe },
    oberteil: { stil: kind ? pick(r, ['hemd', 'kittel']) : w('oberteil'), farbe: pick(r, STOFF), akzent: pick(r, STOFF) },
    hose: { stil: kind ? pick(r, ['kurz', 'lang']) : w('hose'), farbe: pick(r, STOFF) },
    schuhe: { stil: w('schuhe'), farbe: pick(r, LEDER) },
    kopfbedeckung: { stil: chance(r, 0.45) ? w('kopfbedeckung') : 'keine', farbe: pick(r, STOFF), akzent: pick(r, LEDER) },
    umhang: { stil: chance(r, 0.2) ? pick(r, ['kurz', 'lang']) : 'kein', farbe: pick(r, STOFF) },
    guertel: chance(r, 0.75) ? pick(r, LEDER) : null,
    tasche: chance(r, 0.3),
    rucksack: chance(r, 0.15),
  };
  // Krone/Helm sind selten – nur wenn ausdrücklich erlaubt
  if (!opts.stile?.kopfbedeckung && ['krone', 'helm'].includes(teil.kopfbedeckung.stil)) teil.kopfbedeckung.stil = 'muetze';
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
    schulterX: 0.2 * g * w, schulterY: torsoLaenge - 0.07 * g,
    oberarm: 0.27 * g * k.arme, unterarm: 0.24 * g * k.arme, hand: 0.08 * g,
    halsLaenge, kopfRadius, breite: w, bauch: k.bauch,
    schrittLaenge: bein * 2 * 0.8,                       // ein Schritt (ein Fuß) beim Gehen
    augenHoehe: hoehe - kopfRadius * 0.9,
  };
}
