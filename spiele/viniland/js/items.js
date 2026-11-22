// Viniland – Item-Definitionen: Seltenheiten, Affixe, Waffen-Items (verweisen auf WEAPONS-IDs), Zauber-Schriftrollen,
// Relikte (passive Mods für fighter.relics), Verbrauchsgüter, Siegel. Reine Daten + kleine Helfer, keine Three.js-Objekte.
//
// Item-INSTANZ (im Inventar / auf dem Boden):
//   { uid, def:'<itemId>', kind:'weapon'|'scroll'|'relic'|'consumable'|'sigil', rarity:'common'|'rare'|'epic'|'legendary',
//     weaponId?, upgrade?:0..5, spellId?, affixes?:[affixId], count?:n }
// fighter.equipWeapon(inst) bekommt zusätzlich inst.mods (Summe der Affix- und Seltenheits-Mods) und inst.dmgMul.
import { WEAPONS } from './weapons.js';
import { SPELLS } from './spells.js';

export const RARITIES = {
  common:    { id: 'common',    name: 'Gewöhnlich', color: 0xc9c1ae, css: '#c9c1ae', dmgMul: 1.00, affixes: 0, glow: 0.5 },
  rare:      { id: 'rare',      name: 'Selten',     color: 0x4f8dff, css: '#5f9bff', dmgMul: 1.06, affixes: 1, glow: 0.8 },
  epic:      { id: 'epic',      name: 'Episch',     color: 0xb35cff, css: '#bd72ff', dmgMul: 1.12, affixes: 2, glow: 1.0 },
  legendary: { id: 'legendary', name: 'Legendär',   color: 0xffa424, css: '#ffb040', dmgMul: 1.20, affixes: 2, glow: 1.3 },
};
export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

/** Relikt-/Affix-Mods (alle additiv, fehlend = 0). Kampf (fighter.js) liest sie; RPG wertet glutMul/pickupRange selbst aus. */
export const MOD_LABELS = {
  dmgMul: ['Schaden', '%'], dmgMulFullHp: ['Schaden bei voller HP', '%'], dmgMulLowHp: ['Schaden unter 30 % HP', '%'],
  spellDmgMul: ['Zauberschaden', '%'], hpOnKill: ['HP pro Kill', ''], manaOnKill: ['Mana pro Kill', ''],
  maxHpMul: ['Max. HP', '%'], maxStaMul: ['Max. Ausdauer', '%'], maxManaMul: ['Max. Mana', '%'],
  staRegenMul: ['Ausdauer-Regeneration', '%'], manaRegenMul: ['Mana-Regeneration', '%'], rollCostMul: ['Rollen-Kosten', '%'],
  dmgTakenMul: ['Erlittener Schaden', '%'], flaskHealMul: ['Flakon-Heilung', '%'], glutMul: ['Glut-Ausbeute', '%'],
  staggerMul: ['Haltungsschaden', '%'], atkSpeedMul: ['Angriffstempo', '%'], lifesteal: ['Lebensraub', '%'],
};
export function formatMod(k, v) {
  const L = MOD_LABELS[k] || [k, ''];
  const val = L[1] === '%' ? `${v > 0 ? '+' : ''}${Math.round(v * 100)} %` : `${v > 0 ? '+' : ''}${v}`;
  return `${L[0]} ${val}`;
}

/** Affixe für Waffen (Selten: 1, Episch/Legendär: 2) */
export const AFFIXES = {
  scharf:     { name: 'der Schärfe',    mods: { dmgMul: 0.06 } },
  wuchtig:    { name: 'der Wucht',      mods: { staggerMul: 0.15 } },
  flink:      { name: 'der Flinkheit',  mods: { atkSpeedMul: 0.06 } },
  durstig:    { name: 'des Durstes',    mods: { lifesteal: 0.03 } },
  glimmend:   { name: 'der Glut',       mods: { spellDmgMul: 0.08 } },
  gierig:     { name: 'der Gier',       mods: { glutMul: 0.12 } },
  zaeh:       { name: 'der Zähigkeit',  mods: { maxHpMul: 0.05 } },
  atemruhig:  { name: 'des Atems',      mods: { staRegenMul: 0.1 } },
  ernte:      { name: 'der Ernte',      mods: { hpOnKill: 4 } },
};

// ---------- Relikte (passive Boni, 2 Slots) ----------
export const RELICS = {
  glutherz:      { name: 'Glutherz',            rarity: 'rare',      icon: '❤️‍🔥', desc: 'Ein Herz, das nie ganz erkaltet.',               mods: { dmgMulFullHp: 0.12 } },
  aschenring:    { name: 'Aschenring',          rarity: 'common',    icon: '💍', desc: 'Aus der Asche Gefallener gepresst.',             mods: { hpOnKill: 8 } },
  rabenfeder:    { name: 'Rabenfeder',          rarity: 'rare',      icon: '🪶', desc: 'Leicht wie der Schatten eines Raben.',           mods: { rollCostMul: -0.25 } },
  treibholz:     { name: 'Treibholz-Amulett',   rarity: 'common',    icon: '🪵', desc: 'Vom Meer geschliffen, von Hoffnung getragen.',    mods: { maxHpMul: 0.10 } },
  seemannsknoten:{ name: 'Seemannsknoten',      rarity: 'common',    icon: '🪢', desc: 'Hält, was er verspricht.',                       mods: { staRegenMul: 0.20 } },
  sporenbeutel:  { name: 'Sporenbeutel',        rarity: 'rare',      icon: '🍄', desc: 'Leuchtet schwach im Dunkeln.',                   mods: { manaRegenMul: 0.50, maxManaMul: 0.1 } },
  kathedralkerze:{ name: 'Kathedralenkerze',    rarity: 'epic',      icon: '🕯️', desc: 'Ihr Docht brennt mit fremdem Licht.',            mods: { spellDmgMul: 0.15 } },
  eisenzahn:     { name: 'Eisenzahn',           rarity: 'rare',      icon: '🦷', desc: 'Ein Zahn aus geschmiedetem Eisen.',              mods: { dmgMul: 0.08 } },
  bernsteinauge: { name: 'Bernsteinauge',       rarity: 'rare',      icon: '🟠', desc: 'Sieht Glut, wo andere nur Asche sehen.',          mods: { glutMul: 0.25 } },
  totenglocke:   { name: 'Totenglocke',         rarity: 'epic',      icon: '🔔', desc: 'Ihr Klang lässt Klingen zögern.',                mods: { dmgTakenMul: -0.10 } },
  wachskork:     { name: 'Wachskork',           rarity: 'common',    icon: '🍾', desc: 'Kein Tropfen geht verloren.',                    mods: { flaskHealMul: 0.25 } },
  blutmond:      { name: 'Blutmond-Splitter',   rarity: 'epic',      icon: '🌘', desc: 'Am Rand des Todes am stärksten.',                mods: { dmgMulLowHp: 0.25 } },
  galgenstrick:  { name: 'Galgenstrick',        rarity: 'rare',      icon: '➰', desc: 'Wer einmal hing, fürchtet nichts mehr.',          mods: { manaOnKill: 6, dmgTakenMul: 0.05, dmgMul: 0.06 } },
  // Boss-Relikte (garantiert von Bossen)
  weisse_maehne: { name: 'Weiße Mähne',         rarity: 'epic',      icon: '🤍', desc: 'Blancos Fell, kalt wie Nebel.',                  mods: { maxStaMul: 0.15, rollCostMul: -0.15 } },
  laternenglas:  { name: 'Laternenglas',        rarity: 'epic',      icon: '🏮', desc: 'Morras Glut, gefangen hinter Glas.',             mods: { spellDmgMul: 0.12, manaRegenMul: 0.3 } },
  kohlherz:      { name: 'Kohlherz',            rarity: 'legendary', icon: '🖤', desc: 'Das grollende Herz des Kolosses.',               mods: { dmgMul: 0.10, hpOnKill: 5, staggerMul: 0.2 } },
};

// ---------- Verbrauchsgüter ----------
export const CONSUMABLES = {
  flaskShard: { name: 'Glutflakon-Splitter', rarity: 'epic', icon: '🧪', desc: 'Verschmilzt mit deinem Glutflakon: +1 Ladung (dauerhaft).', autoUse: true },
  forgeStone: { name: 'Schmiedestein',       rarity: 'rare', icon: '🪨', desc: 'Verstärkt eine Waffe am Leuchtfeuer (+1 … +5).', stack: true },
  glutkern:   { name: 'Glutkern',            rarity: 'rare', icon: '🔶', desc: 'Benutzen: +250 Glut.', stack: true, glut: 250 },
};

// ---------- Siegel (Schlüssel der Siegelträger, öffnen Nebeltore fromBiome → toBiome) ----------
export const SIGILS = {
  kueste:      { name: 'Siegel der Grauen Küste', icon: '⚜️', desc: 'Von Kohlherz gehütet. Öffnet das Nebeltor in den Düsterwald.' },
  duesterwald: { name: 'Siegel des Düsterwalds',  icon: '⚜️', desc: 'Öffnet das Nebeltor zum Leuchtpilzhain.' },
  pilzhain:    { name: 'Siegel des Leuchtpilzhains', icon: '⚜️', desc: 'Öffnet das Nebeltor zur Aschenöde.' },
  aschenoede:  { name: 'Siegel der Aschenöde',    icon: '⚜️', desc: 'Öffnet das Nebeltor zum Frostgipfel.' },
};

// ---------- Waffen ----------
/** Fallback-Liste, falls WEAPONS (Kampf) noch fehlt/weniger enthält */
const WEAPON_FALLBACK = {
  fists: { name: 'Fäuste', class: 'light' }, driftwood: { name: 'Treibholzknüppel', class: 'medium' },
};
export const weaponDefs = () => (WEAPONS && Object.keys(WEAPONS).length ? WEAPONS : WEAPON_FALLBACK);
export const weaponIds = (withFists = false) => Object.keys(weaponDefs()).filter(id => withFists || id !== 'fists');
/** Boss-Waffen-Wunsch (falls die ID in WEAPONS fehlt → passende Ersatz-Waffe) */
const pickExisting = (...ids) => ids.find(id => weaponDefs()[id]) || weaponIds()[0] || 'driftwood';
export const spellIds = () => Object.keys(SPELLS || {});
export const spellDef = id => (SPELLS && SPELLS[id]) || { name: id, icon: '✨', desc: '' };

const SCALE_COEF = { S: 0.9, A: 0.7, B: 0.5, C: 0.35, D: 0.2, E: 0.1, '-': 0 };
export const UPGRADE_MAX = 5;
export const upgradeMul = u => 1 + 0.12 * (u || 0);

let uidN = 1;
const newUid = () => 'it' + (uidN++).toString(36) + Math.floor(Math.random() * 1e6).toString(36);

/** Summe der Mods eines Items (Affixe + Relikt-Basis) */
export function itemMods(inst) {
  const out = {};
  const add = m => { for (const k in m) out[k] = (out[k] || 0) + m[k]; };
  if (inst.kind === 'relic' && RELICS[inst.def]) add(RELICS[inst.def].mods);
  for (const a of inst.affixes || []) if (AFFIXES[a]) add(AFFIXES[a].mods);
  if (inst.kind === 'weapon' && inst.rarity === 'legendary') add({ dmgMul: 0.04 });
  return out;
}

/** Erzeugt eine Item-Instanz. spec: 'forgeStone' | { weapon:'sword', rarity } | { scroll:'glutkugel' } | { relic:'aschenring' } | { sigil:'kueste' } */
export function makeItem(spec, r = Math.random) {
  if (typeof spec === 'string') {
    if (CONSUMABLES[spec]) spec = { consumable: spec };
    else if (RELICS[spec]) spec = { relic: spec };
    else if (spec.startsWith('scroll_')) spec = { scroll: spec.slice(7) };
    else if (spec.startsWith('sigil_')) spec = { sigil: spec.slice(6) };
    else spec = { weapon: spec };
  }
  const it = { uid: newUid() };
  if (spec.weapon) {
    const id = weaponDefs()[spec.weapon] ? spec.weapon : pickExisting(spec.weapon, 'driftwood');
    Object.assign(it, { def: 'w_' + id, kind: 'weapon', weaponId: id, upgrade: spec.upgrade || 0, rarity: spec.rarity || 'common' });
    const n = spec.affixes ? 0 : RARITIES[it.rarity].affixes, keys = Object.keys(AFFIXES);
    it.affixes = spec.affixes ? [...spec.affixes] : [];
    for (let k = 0; k < n; k++) { const a = keys[Math.floor(r() * keys.length)]; if (!it.affixes.includes(a)) it.affixes.push(a); }
  } else if (spec.scroll) {
    const S = spellDef(spec.scroll);
    Object.assign(it, { def: 'scroll_' + spec.scroll, kind: 'scroll', spellId: spec.scroll, rarity: S.rarity || spec.rarity || 'rare' });
  } else if (spec.relic) {
    Object.assign(it, { def: spec.relic, kind: 'relic', rarity: RELICS[spec.relic]?.rarity || 'common' });
  } else if (spec.consumable) {
    Object.assign(it, { def: spec.consumable, kind: 'consumable', rarity: CONSUMABLES[spec.consumable].rarity, count: spec.count || 1 });
  } else if (spec.sigil) {
    Object.assign(it, { def: 'sigil_' + spec.sigil, kind: 'sigil', biome: spec.sigil, rarity: 'legendary' });
  }
  return it;
}

export function itemName(inst) {
  if (!inst) return '—';
  if (inst.kind === 'weapon') {
    const W = weaponDefs()[inst.weaponId] || {};
    const af = (inst.affixes || []).map(a => AFFIXES[a]?.name).filter(Boolean);
    return `${W.name || inst.weaponId}${af[0] ? ' ' + af[0] : ''}${inst.upgrade ? ' +' + inst.upgrade : ''}`;
  }
  if (inst.kind === 'scroll') return 'Schriftrolle: ' + spellDef(inst.spellId).name;
  if (inst.kind === 'relic') return RELICS[inst.def]?.name || inst.def;
  if (inst.kind === 'consumable') return CONSUMABLES[inst.def].name + (inst.count > 1 ? ' ×' + inst.count : '');
  if (inst.kind === 'sigil') return SIGILS[inst.biome]?.name || 'Siegel';
  return inst.def;
}
export function itemIcon(inst) {
  if (!inst) return '·';
  if (inst.kind === 'weapon') return weaponDefs()[inst.weaponId]?.icon || ({ fists: '👊', staff: '🪄', daggers: '🗡️', spear: '🔱', hammer: '🔨', axe: '🪓', scythe: '🌙', greatsword: '⚔️' }[inst.weaponId] || '🗡️');
  if (inst.kind === 'scroll') return '📜';
  if (inst.kind === 'relic') return RELICS[inst.def]?.icon || '🔮';
  if (inst.kind === 'consumable') return CONSUMABLES[inst.def].icon;
  if (inst.kind === 'sigil') return '⚜️';
  return '?';
}
export const rarityOf = inst => RARITIES[inst?.rarity] || RARITIES.common;

/** Grobe Angriffskraft für Tooltips/Schmiede-Vorschau. stats = { str, dex, int, fai } */
export function weaponPower(inst, stats = {}) {
  const W = weaponDefs()[inst.weaponId] || {};
  const base = W.base?.dmg ?? W.combo?.[0]?.dmg ?? 10;
  const sc = W.scaling || {};
  let bonus = 0;
  for (const k of ['str', 'dex', 'int', 'fai']) bonus += base * (SCALE_COEF[sc[k]] || 0) * Math.max(0, ((stats[k] ?? 10) - 10)) / 25;
  const m = itemMods(inst);
  return Math.round((base * rarityOf(inst).dmgMul * upgradeMul(inst.upgrade) + bonus) * (1 + (m.dmgMul || 0)));
}

/** Zeilen für Tooltips: [{ t:'text', c?:css }] */
export function itemTooltip(inst, stats) {
  const R = rarityOf(inst), L = [];
  L.push({ t: itemName(inst), c: R.css, big: true });
  L.push({ t: R.name + ' · ' + ({ weapon: 'Waffe', scroll: 'Zauber-Schriftrolle', relic: 'Relikt', consumable: 'Verbrauchsgut', sigil: 'Siegel' }[inst.kind] || ''), dim: true });
  if (inst.kind === 'weapon') {
    const W = weaponDefs()[inst.weaponId] || {};
    L.push({ t: `Angriffskraft ${weaponPower(inst, stats)}` });
    const cls = { light: 'leicht', medium: 'mittel', heavy: 'schwer' }[W.class] || W.class;
    if (cls) L.push({ t: `Gewicht: ${cls}` });
    const sc = W.scaling ? Object.entries(W.scaling).map(([k, v]) => ({ str: 'Stä', dex: 'Ges', int: 'Ver', fai: 'Gla' }[k] || k) + ' ' + v).join(' · ') : '';
    if (sc) L.push({ t: 'Skalierung: ' + sc });
    L.push({ t: `Verstärkung +${inst.upgrade || 0} / +${UPGRADE_MAX}` });
    if (W.art?.name) L.push({ t: `Waffenkunst: ${W.art.name}`, c: '#f0c27a' }), W.art.desc && L.push({ t: W.art.desc, dim: true });
    for (const a of inst.affixes || []) if (AFFIXES[a]) L.push({ t: `◆ ${AFFIXES[a].name}: ${Object.entries(AFFIXES[a].mods).map(([k, v]) => formatMod(k, v)).join(', ')}`, c: '#9fd4a0' });
    if (inst.rarity === 'legendary') L.push({ t: '◆ Legendär: Schaden +4 %', c: '#9fd4a0' });
    if (W.desc) L.push({ t: W.desc, dim: true });
  } else if (inst.kind === 'scroll') {
    const S = spellDef(inst.spellId);
    L.push({ t: `${S.icon || '✨'} ${S.name}` });
    if (S.school) L.push({ t: `Schule: ${S.school === 'glaube' ? 'Glaube' : 'Verstand'}` });
    if (S.mana != null) L.push({ t: `Mana ${S.mana} · Abklingzeit ${S.cd ?? '?'} s` });
    if (S.desc) L.push({ t: S.desc, dim: true });
    L.push({ t: 'Benutzen: ins Zauberbuch aufnehmen', c: '#f0c27a' });
  } else if (inst.kind === 'relic') {
    const D = RELICS[inst.def];
    for (const [k, v] of Object.entries(itemMods(inst))) L.push({ t: '◆ ' + formatMod(k, v), c: '#9fd4a0' });
    if (D?.desc) L.push({ t: D.desc, dim: true });
  } else if (inst.kind === 'consumable') {
    L.push({ t: CONSUMABLES[inst.def].desc, dim: true });
  } else if (inst.kind === 'sigil') {
    L.push({ t: SIGILS[inst.biome]?.desc || 'Öffnet ein Nebeltor.', dim: true });
  }
  return L;
}

/** Bevorzugte Boss-Belohnungen (Waffe/Relikt/Zauber). Unbekannte Bosse bekommen Zufalls-Belohnung (loot.js). */
export const BOSS_REWARDS = {
  dogo:     () => ({ weapon: pickExisting('sword', 'spear', 'greatsword'), relic: 'weisse_maehne', scroll: 'frostring' }),
  morra:    () => ({ weapon: pickExisting('staff', 'scythe', 'daggers'), relic: 'laternenglas', scroll: 'glutkugel' }),
  kohlherz: () => ({ weapon: pickExisting('hammer', 'greatsword', 'axe'), relic: 'kohlherz', scroll: null }),
};
