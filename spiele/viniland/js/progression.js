// Viniland – Progression pro Spieler: Glut (Währung/EP), Stufe + Attribute, Inventar, Ausrüstung, Zauberbuch, Flakon,
// Respawn-Leuchtfeuer, Glutrest. Wendet alles über die Fighter-API (Kampf-Agent) an – mit Feature-Detection.
import { RELICS, CONSUMABLES, makeItem, itemMods, itemName, spellDef, UPGRADE_MAX } from './items.js';

export const ATTRS = [
  ['vit', 'Vitalität', 'Lebenspunkte'],
  ['end', 'Ausdauer', 'Ausdauer & Ausrüstungslast'],
  ['str', 'Stärke', 'Schaden schwerer Waffen'],
  ['dex', 'Geschick', 'Schaden leichter Waffen, Tempo'],
  ['int', 'Verstand', 'Zauberschaden (Verstand), Mana'],
  ['fai', 'Glaube', 'Heilung & Licht-Zauber'],
];
export const START_ATTRS = { vit: 10, end: 10, str: 10, dex: 10, int: 10, fai: 10 };

/** Glut-Kosten für den Aufstieg von Stufe L auf L+1: 60 + 40·L + 6·L² (1→2: 106, 5→6: 410, 10→11: 1060, 20→21: 3260) */
export const levelCost = L => Math.round(60 + 40 * L + 6 * L * L);
/** Schmieden: Steine + Glut für +u → +u+1 */
export const forgeCost = u => ({ stones: [1, 1, 2, 2, 3][u] ?? 99, glut: 150 + u * 200 });

/** Vorschau-Werte (Fighter darf eigene Formel haben → fighter.previewStats bevorzugt) */
export function derivedStats(a, mods = {}) {
  // gleiche Formeln wie fighter.setStats (Kampf-Agent): HP 100+9/Vit, Ausdauer 100+4/End, Mana 100+5/Ver+3/Gla
  const hp = Math.round((100 + (a.vit - 10) * 9) * (1 + (mods.maxHpMul || 0)));
  const sta = Math.round((100 + (a.end - 10) * 4) * (1 + (mods.maxStaMul || 0)));
  const mana = Math.round((100 + (a.int - 10) * 5 + (a.fai - 10) * 3) * (1 + (mods.maxManaMul || 0)));
  const phys = Math.round(100 + (a.str - 10) * 2.5 + (a.dex - 10) * 2);
  const magic = Math.round(100 + (a.int - 10) * 3 + (a.fai - 10) * 1.5);
  const heal = Math.round(100 + (a.fai - 10) * 2.5);
  return { hp, sta, mana, phys, magic, heal };
}

export class Progression {
  constructor(i) {
    this.i = i;
    this.level = 1; this.glut = 0; this.glutTotal = 0;
    this.attrs = { ...START_ATTRS };
    this.inventory = [];            // Item-Instanzen
    this.equip = { weapon: null, spells: [null, null], relics: [null, null] };   // uid | spellId
    this.learned = [];              // spellIds im Zauberbuch
    this.flaskMax = 3;
    this.respawn = null;            // { id, pos } Leuchtfeuer
    this.kindled = new Set();
    this.glutrest = null;           // Drop-Eintrag (loot.js)
    this.deaths = 0;
    this.dirty = true;              // → applyTo(fighter)
    this.log = [];                  // Nachrichten für UI-Popups { text, color, icon }
  }

  // ---------- Glut ----------
  mods() {
    const out = {};
    for (const uid of [this.equip.weapon, ...this.equip.relics]) {
      const it = this.get(uid); if (!it) continue;
      const m = itemMods(it); for (const k in m) out[k] = (out[k] || 0) + m[k];
    }
    return out;
  }
  addGlut(n, { raw = false } = {}) {
    const v = raw ? n : Math.round(n * (1 + (this.mods().glutMul || 0)));
    this.glut += v; if (!raw) this.glutTotal += v;
    return v;
  }
  get nextCost() { return levelCost(this.level); }
  /** Kosten für k zusätzliche Stufen ab der aktuellen */
  costFor(k) { let s = 0; for (let j = 0; j < k; j++) s += levelCost(this.level + j); return s; }
  /** alloc = { vit:+1, ... } (nur positive Werte). Gibt true bei Erfolg. */
  levelUp(alloc) {
    const k = Object.values(alloc).reduce((a, b) => a + Math.max(0, b), 0);
    if (k <= 0) return false;
    const c = this.costFor(k);
    if (c > this.glut) return false;
    this.glut -= c; this.level += k;
    for (const a in alloc) if (alloc[a] > 0 && a in this.attrs) this.attrs[a] = Math.min(99, this.attrs[a] + alloc[a]);
    this.dirty = true;
    return true;
  }

  // ---------- Inventar ----------
  get(uid) { return uid ? this.inventory.find(it => it.uid === uid) || null : null; }
  count(def) { return this.inventory.filter(it => it.def === def).reduce((s, it) => s + (it.count || 1), 0); }
  hasSigil(biome) { return this.inventory.some(it => it.kind === 'sigil' && it.biome === biome); }
  /** Gibt einen Text für das Popup zurück */
  addItem(inst) {
    if (inst.kind === 'consumable' && CONSUMABLES[inst.def]?.autoUse) {
      if (inst.def === 'flaskShard') { this.flaskMax = Math.min(12, this.flaskMax + (inst.count || 1)); this.dirty = true; this.flaskGain = true; return `${itemName(inst)} – Glutflakon jetzt ${this.flaskMax} Ladungen`; }
    }
    if (inst.kind === 'consumable' && CONSUMABLES[inst.def]?.stack) {
      const have = this.inventory.find(it => it.def === inst.def);
      if (have) { have.count = (have.count || 1) + (inst.count || 1); return itemName(inst); }
    }
    this.inventory.push(inst);
    // Komfort: erste Waffe / erste Rolle / erste Relikte direkt ausrüsten
    if (inst.kind === 'weapon' && !this.get(this.equip.weapon)) this.equipItem('weapon', inst.uid);
    if (inst.kind === 'relic') { const s = this.equip.relics.indexOf(null); if (s >= 0) this.equipItem('relic' + s, inst.uid); }
    return itemName(inst);
  }
  removeItem(uid, n = 1) {
    const it = this.get(uid); if (!it) return;
    if ((it.count || 1) > n) { it.count -= n; return; }
    this.inventory.splice(this.inventory.indexOf(it), 1);
    if (this.equip.weapon === uid) this.equip.weapon = null;
    this.equip.relics = this.equip.relics.map(u => (u === uid ? null : u));
    this.dirty = true;
  }
  consume(def, n = 1) {
    const it = this.inventory.find(x => x.def === def); if (!it || (it.count || 1) < n) return false;
    this.removeItem(it.uid, n); return true;
  }
  /** Item benutzen (Schriftrolle lernen, Glutkern) – gibt Text oder null */
  use(uid) {
    const it = this.get(uid); if (!it) return null;
    if (it.kind === 'scroll') {
      const fresh = this.learnSpell(it.spellId);
      this.removeItem(uid);
      return fresh ? `Gelernt: ${spellDef(it.spellId).name}` : `${spellDef(it.spellId).name} kennst du schon (+80 Glut)`;
    }
    if (it.kind === 'consumable' && CONSUMABLES[it.def]?.glut) { this.addGlut(CONSUMABLES[it.def].glut, { raw: true }); this.removeItem(uid); return `+${CONSUMABLES[it.def].glut} Glut`; }
    return null;
  }
  learnSpell(id) {
    if (this.learned.includes(id)) { this.addGlut(80, { raw: true }); return false; }
    this.learned.push(id);
    const s = this.equip.spells.indexOf(null); if (s >= 0) this.equip.spells[s] = id;
    this.dirty = true; return true;
  }
  /** slot: 'weapon' | 'spell0' | 'spell1' | 'relic0' | 'relic1'; value = uid / spellId / null */
  equipItem(slot, v) {
    if (slot === 'weapon') this.equip.weapon = v;
    else if (slot.startsWith('spell')) {
      const k = +slot.slice(5), o = 1 - k;
      if (v && this.equip.spells[o] === v) this.equip.spells[o] = this.equip.spells[k];
      this.equip.spells[k] = v;
    } else if (slot.startsWith('relic')) {
      const k = +slot.slice(5), o = 1 - k;
      if (v && this.equip.relics[o] === v) this.equip.relics[o] = this.equip.relics[k];
      this.equip.relics[k] = v;
    }
    this.dirty = true;
  }
  forge(uid) {
    const it = this.get(uid); if (!it || it.kind !== 'weapon' || (it.upgrade || 0) >= UPGRADE_MAX) return 'Nicht möglich';
    const c = forgeCost(it.upgrade || 0);
    if (this.count('forgeStone') < c.stones) return `Zu wenige Schmiedesteine (${c.stones} nötig)`;
    if (this.glut < c.glut) return `Zu wenig Glut (${c.glut} nötig)`;
    this.consume('forgeStone', c.stones); this.glut -= c.glut; it.upgrade = (it.upgrade || 0) + 1; this.dirty = true;
    return `${itemName(it)} geschmiedet`;
  }

  // ---------- Anwenden auf den Fighter (Kampf-API, alles optional) ----------
  stats() { return { ...this.attrs, level: this.level }; }
  preview(fighter, attrs = this.attrs) {
    try { if (typeof fighter?.previewStats === 'function') { const r = fighter.previewStats({ ...attrs, level: this.level }); if (r) return r; } } catch (e) { /* fallback */ }
    return derivedStats(attrs, this.mods());
  }
  applyTo(fighter) {
    if (!fighter) return;
    this.dirty = false;
    const w = this.get(this.equip.weapon);
    try {
      if (typeof fighter.setStats === 'function') fighter.setStats(this.stats());
      if (typeof fighter.equipWeapon === 'function') {
        if (w) fighter.equipWeapon({ uid: w.uid, weaponId: w.weaponId, upgrade: w.upgrade || 0, rarity: w.rarity, mods: itemMods(w), affixes: w.affixes });
        else fighter.equipWeapon('fists');
      }
      if (typeof fighter.equipSpells === 'function') fighter.equipSpells([...this.equip.spells]);
      const rel = this.equip.relics.map(u => this.get(u)).filter(Boolean).map(it => ({ id: it.def, name: RELICS[it.def]?.name, mods: itemMods(it) }));
      if ('relics' in fighter || typeof fighter.setStats === 'function') fighter.relics = rel;
      if (fighter.flask && typeof fighter.flask === 'object') { fighter.flask.max = this.flaskMax; if (this.flaskGain) { fighter.flask.charges = Math.min(this.flaskMax, (fighter.flask.charges || 0) + 1); this.flaskGain = false; } }
    } catch (e) { console.error('Progression.applyTo', e); }
  }
  /** Rasten: Flakon voll (HP/Sta/Mana macht main über Fighter) */
  refillFlask(fighter) { if (fighter?.flask) fighter.flask.charges = fighter.flask.max = this.flaskMax; }
}

/** Startausrüstung im Wrack: Treibholzknüppel + 1 Schriftrolle */
export function wreckLoot(spellIdsList) {
  const pref = ['glutkugel', 'frostring', 'heilung'].find(s => spellIdsList.includes(s)) || spellIdsList[0];
  const out = [makeItem({ weapon: 'driftwood', rarity: 'common' })];
  if (pref) out.push(makeItem({ scroll: pref }));
  return out;
}
