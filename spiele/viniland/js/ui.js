// Viniland – RPG-Oberfläche pro Splitscreen-Ansicht (DOM + CSS): Inventar/Ausrüstung, Zauberbuch, Optionen,
// Leuchtfeuer-Menü (Rasten, Stufe aufsteigen, Schmieden), Loot-Popups, Interaktions-Hinweis, Biom-Titel, Glut/Flakon-HUD.
// Komplett per Gamepad/Tastatur bedienbar über ui-Intents: uiUp/uiDown/uiLeft/uiRight, uiConfirm, uiBack, uiTabL/uiTabR
// (fehlen sie in input.js, leitet deriveUiIntents() sie aus Bewegung/Sprung/Rolle/Zielwechsel ab). Maus: Klick = wählen + bestätigen.
import { OPTIONS, OPTION_DEFS, setOption } from './options.js';
import { RARITIES, itemName, itemIcon, itemTooltip, spellDef, weaponPower, formatMod, UPGRADE_MAX } from './items.js';
import { ATTRS, forgeCost } from './progression.js';

const INK = { common: '#4a4034', rare: '#1d4fb0', epic: '#6a1fa8', legendary: '#9a4f00' };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const UI_CSS = `
.rpg { position:absolute; inset:0; pointer-events:none; font-family: 'Cinzel','Trajan Pro','Palatino Linotype','Book Antiqua',Palatino,Georgia,serif; color:#e8dcc0; }
.rpg .glut { position:absolute; right:12px; bottom:14px; zoom:var(--hud,1); padding:4px 12px 4px 30px; background:linear-gradient(#1c1610ee,#0d0a07ee); border:1px solid #6d5733; box-shadow:0 0 0 1px #000, inset 0 0 8px #000; font-size:17px; letter-spacing:1px; color:#ffd890; text-shadow:0 0 6px #ff7a1a88, 1px 1px 0 #000; }
.rpg .glut::before { content:''; position:absolute; left:10px; top:50%; width:11px; height:11px; margin-top:-6px; transform:rotate(45deg); background:radial-gradient(#fff2b0,#ff8a20 60%,#a02a00); box-shadow:0 0 8px #ff8a20; }
.rpg .glut small { display:block; font-size:10px; color:#b8a27a; letter-spacing:2px; }
.rpg .glut.bump { animation: glutbump .35s; } @keyframes glutbump { 40% { transform:scale(1.12); color:#fff; } }
.rpg .flask { position:absolute; left:10px; top:144px; zoom:var(--hud,1); display:flex; gap:6px; align-items:center; font-size:13px; text-shadow:1px 1px 0 #000; }
.rpg .flask .fi { width:30px; height:34px; border:2px solid #6b4f2e; border-radius:6px 6px 10px 10px; background:#1a140ecc; position:relative; overflow:hidden; text-align:center; line-height:32px; font-size:17px; }
.rpg .flask .fi i { position:absolute; left:0; right:0; bottom:0; background:linear-gradient(#ffb050,#c8401a); opacity:.55; }
.rpg .flask b { font:bold 13px monospace; color:#ffd890; } .rpg .flask em { font-style:normal; opacity:.7; font-size:11px; font-family:monospace; }
.rpg .wpn { position:absolute; left:10px; top:184px; zoom:var(--hud,1); font-size:12px; color:#d8c8a0; text-shadow:1px 1px 0 #000; letter-spacing:.5px; }
.rpg .prompt { position:absolute; left:50%; bottom:92px; transform:translateX(-50%); zoom:var(--hud,1); padding:6px 16px; white-space:nowrap; background:linear-gradient(90deg,#0000,#0d0a07e6 15%,#0d0a07e6 85%,#0000); border-top:1px solid #c9a24a66; border-bottom:1px solid #c9a24a66; font-size:15px; letter-spacing:1px; display:none; }
.rpg .prompt kbd { display:inline-block; min-width:18px; padding:0 5px; margin-right:6px; border:1px solid #c9a24a; border-radius:4px; background:#2a2016; color:#ffd890; font:bold 12px monospace; text-align:center; }
.rpg .pops { position:absolute; right:12px; bottom:70px; zoom:var(--hud,1); display:flex; flex-direction:column; align-items:flex-end; gap:4px; }
.rpg .pop { padding:4px 12px; background:linear-gradient(90deg,#0000,#120d09ee 25%); border-right:3px solid currentColor; font-size:14px; text-shadow:1px 1px 0 #000; animation: popin 3.6s forwards; white-space:nowrap; }
.rpg .pop small { color:#b8a27a; margin-right:6px; letter-spacing:1px; }
@keyframes popin { 0% { opacity:0; transform:translateX(30px); } 8% { opacity:1; transform:none; } 80% { opacity:1; } 100% { opacity:0; } }
.rpg .title { position:absolute; left:0; right:0; top:26%; text-align:center; opacity:0; pointer-events:none; }
.rpg .title.show { animation: titlein 4.6s forwards; }
.rpg .title h1 { margin:0; font-weight:400; font-size:clamp(22px,5.2vw,58px); letter-spacing:.18em; color:#efe0b8; text-transform:uppercase; text-shadow:0 0 18px #000, 0 0 3px #000, 2px 2px 0 #000; }
.rpg .title h2 { margin:4px 0 0; font-weight:400; font-size:clamp(11px,1.5vw,16px); letter-spacing:.5em; color:#c9a24a; text-shadow:1px 1px 0 #000; text-transform:uppercase; }
.rpg .title hr { width:40%; margin:8px auto; border:0; height:1px; background:linear-gradient(90deg,#0000,#c9a24a,#0000); }
.rpg .title.banner h1 { color:#ffcf6a; letter-spacing:.12em; } .rpg .title.banner.death h1 { color:#b8241a; }
.rpg .title.banner { top:40%; background:linear-gradient(#0000,#000a 30%,#000a 70%,#0000); padding:14px 0; }
@keyframes titlein { 0% { opacity:0; letter-spacing:.3em; } 15% { opacity:1; } 75% { opacity:1; } 100% { opacity:0; } }
.rpg .panel { position:absolute; inset:5% 4%; pointer-events:auto; display:none; flex-direction:column; zoom:var(--hud,1);
  background: radial-gradient(ellipse at 50% 0%, #2a2117f2, #0e0b08f6 70%); border:2px solid #4b3d2c; box-shadow:0 0 0 1px #000, 0 0 0 4px #1a140e, 0 0 0 5px #8a6d3a, 0 10px 40px #000; }
.rpg .panel.open { display:flex; }
.rpg .panel .ph { display:flex; align-items:center; gap:10px; padding:10px 16px 6px; border-bottom:1px solid #8a6d3a; background:linear-gradient(#0000,#0006); }
.rpg .panel .ph h3 { margin:0; font-weight:400; font-size:20px; letter-spacing:.2em; color:#e9cf8a; text-transform:uppercase; flex:1; }
.rpg .panel .ph .gl { font-size:14px; color:#ffd890; letter-spacing:1px; }
.rpg .tabs { display:flex; gap:2px; padding:6px 12px 0; }
.rpg .tabs span { padding:4px 12px; font-size:13px; letter-spacing:.12em; text-transform:uppercase; color:#9a8a6a; border:1px solid #3a2e20; border-bottom:none; background:#14100b; cursor:pointer; }
.rpg .tabs span.on { color:#ffe2a0; background:#2a2016; border-color:#8a6d3a; }
.rpg .tabs .tk { border:none; background:none; color:#c9a24a; font:bold 11px monospace; padding:6px 4px; cursor:default; }
.rpg .pb { flex:1; display:flex; gap:12px; padding:10px 12px; min-height:0; }
.rpg .list { flex:1.15; overflow-y:auto; min-width:0; scrollbar-width:thin; }
.rpg .row { display:flex; align-items:center; gap:8px; padding:5px 8px; margin:1px 0; border:1px solid transparent; font-size:14px; cursor:pointer; font-family: Georgia, 'Palatino Linotype', serif; }
.rpg .row .ic { width:24px; text-align:center; font-size:16px; }
.rpg .row .lb { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.rpg .row .sl { color:#9a8a6a; font-size:11px; letter-spacing:.1em; text-transform:uppercase; min-width:68px; }
.rpg .row .vl { font-family:monospace; color:#e8d4a0; }
.rpg .row.sel { border-color:#c9a24a; background:linear-gradient(90deg,#c9a24a33,#c9a24a08); box-shadow: inset 3px 0 0 #ffd070; }
.rpg .row.dis { opacity:.45; }
.rpg .row.hdr { cursor:default; color:#c9a24a; font-size:11px; letter-spacing:.25em; text-transform:uppercase; border-bottom:1px solid #3a2e20; margin-top:6px; }
.rpg .row .arr { color:#c9a24a; font-family:monospace; }
.rpg .row .eq { color:#ffd070; font-size:11px; }
.rpg .tip { flex:1; min-width:0; overflow-y:auto; padding:12px 14px; color:#2a1d10; font-family: Georgia,'Palatino Linotype',serif; font-size:13.5px; line-height:1.45;
  background: radial-gradient(ellipse at 30% 20%, #e6d6ae, #cdb68a 60%, #b39a6a); box-shadow: inset 0 0 30px #6a4a2299, 0 0 0 1px #000, 0 0 0 3px #3a2c1c; border-radius:2px; }
.rpg .tip .big { font-size:17px; font-weight:bold; font-family:'Cinzel','Palatino Linotype',Georgia,serif; letter-spacing:.04em; }
.rpg .tip .dim { color:#5a4630; font-style:italic; }
.rpg .tip hr { border:0; height:1px; background:#6a4a2266; margin:6px 0; }
.rpg .tip table { border-collapse:collapse; width:100%; } .rpg .tip td { padding:1px 4px; } .rpg .tip td.n { text-align:right; font-family:monospace; } .rpg .tip .up { color:#1a6a1a; font-weight:bold; }
.rpg .pf { padding:5px 14px 8px; font: 11px monospace; color:#9a8a6a; border-top:1px solid #3a2e20; letter-spacing:.05em; }
.rpg .pf b { color:#e9cf8a; }
.rpg .msg { color:#ffb070; font-size:12px; padding:4px 8px; min-height:16px; font-family:Georgia,serif; }
@media (max-width: 700px) { .rpg .pb { flex-direction:column; } .rpg .tip { flex:0 0 38%; } .rpg .panel { inset:2%; } }
`;
let cssDone = false;
function injectCss() { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.textContent = UI_CSS; document.head.appendChild(s); }

/** Leitet fehlende ui-Intents aus normalen Spiel-Intents ab (Kanten). state = { px, py } pro Spieler. */
export function deriveUiIntents(o, st) {
  const has = 'uiUp' in o;
  const sx = o.moveX || 0, sy = o.moveY || 0;
  const dirX = Math.abs(sx) > 0.6 ? Math.sign(sx) : 0, dirY = Math.abs(sy) > 0.6 ? Math.sign(sy) : 0;
  // Auto-Repeat beim Halten
  const now = performance.now();
  const rep = (k, d) => { if (!d) { st[k] = 0; st[k + 't'] = 0; return false; } if (st[k] !== d) { st[k] = d; st[k + 't'] = now + 380; return true; } if (now > st[k + 't']) { st[k + 't'] = now + 110; return true; } return false; };
  const ry = rep('py', dirY), rx = rep('px', dirX);
  if (!has) {
    o.uiUp = ry && dirY > 0; o.uiDown = ry && dirY < 0; o.uiLeft = rx && dirX < 0; o.uiRight = rx && dirX > 0;
    o.uiConfirm = !!(o.jumpPressed || o.chopPressed); o.uiBack = !!o.rollPressed;
    o.uiTabL = o.switchTarget < 0; o.uiTabR = o.switchTarget > 0;
  } else {
    // auch mit echten ui-Intents: Stick-Navigation zusätzlich erlauben
    o.uiUp ||= ry && dirY > 0; o.uiDown ||= ry && dirY < 0; o.uiLeft ||= rx && dirX < 0; o.uiRight ||= rx && dirX > 0;
  }
  return o;
}

/**
 * ctx (von main): {
 *   prog (Progression), fighter, i,
 *   keyLabel(action) -> 'E' | 'X' ...,  inCombat() -> bool,
 *   onRest(), onLevelUp(alloc) -> bool, onForge(uid) -> text, onEquip(), onClose(),
 *   onOptionChange(key)
 * }
 */
export class RpgUI {
  constructor(viewEl, ctx) {
    injectCss();
    this.ctx = ctx;
    const root = this.root = document.createElement('div');
    root.className = 'rpg';
    root.innerHTML = `<div class="flask"><div class="fi">🧪<i></i></div><b></b><em></em></div><div class="wpn"></div>
      <div class="glut"><small>GLUT</small><span>0</span></div><div class="prompt"></div><div class="pops"></div>
      <div class="title"><h1></h1><hr><h2></h2></div><div class="panel"></div>`;
    viewEl.appendChild(root);
    this.el = {
      glut: root.querySelector('.glut'), glutN: root.querySelector('.glut span'), flask: root.querySelector('.flask'),
      flaskB: root.querySelector('.flask b'), flaskI: root.querySelector('.flask i'), flaskE: root.querySelector('.flask em'), wpn: root.querySelector('.wpn'),
      prompt: root.querySelector('.prompt'), pops: root.querySelector('.pops'), title: root.querySelector('.title'), panel: root.querySelector('.panel'),
    };
    this.stack = [];        // Screens: { id, tab, sel, ... }
    this.lastGlut = -1; this.msg = ''; this.promptTxt = '';
    this.el.panel.addEventListener('click', e => this.onClick(e));
  }

  get isOpen() { return this.stack.length > 0; }
  get top() { return this.stack[this.stack.length - 1]; }

  // ---------- HUD ----------
  update(dt) {
    const p = this.ctx.prog, f = this.ctx.fighter;
    if (p.glut !== this.lastGlut) {
      this.el.glutN.textContent = p.glut.toLocaleString('de-DE');
      if (this.lastGlut >= 0 && p.glut > this.lastGlut) { this.el.glut.classList.remove('bump'); void this.el.glut.offsetWidth; this.el.glut.classList.add('bump'); }
      this.lastGlut = p.glut;
    }
    const fl = f?.flask;
    const ch = fl ? fl.charges : null, mx = fl ? fl.max : p.flaskMax;
    const t = ch == null ? `${mx}` : `${ch}/${mx}`;
    if (this.el.flaskB.textContent !== t) { this.el.flaskB.textContent = t; this.el.flaskI.style.height = ((ch ?? mx) / Math.max(1, mx) * 100).toFixed(0) + '%'; }
    const k = this.ctx.keyLabel?.('flask') || '';
    if (this.el.flaskE.textContent !== k) this.el.flaskE.textContent = k;
    const w = p.get(p.equip.weapon), wn = w ? itemName(w) : 'Fäuste';
    const wk = wn + '|' + p.level;
    if (this.el.wpn.dataset.t !== wk) { this.el.wpn.dataset.t = wk; this.el.wpn.innerHTML = `${w ? itemIcon(w) : '👊'} <span style="color:${w ? RARITIES[w.rarity].css : '#c9c1ae'}">${esc(wn)}</span> · Stufe ${p.level}`; }
  }
  setPrompt(text, action = 'interact') {
    const t = text ? `<kbd>${esc(this.ctx.keyLabel?.(action) || 'E')}</kbd>${esc(text)}` : '';
    if (t === this.promptTxt) return;
    this.promptTxt = t; this.el.prompt.innerHTML = t; this.el.prompt.style.display = t && !this.isOpen ? 'block' : 'none';
  }
  popup(text, color = '#e8dcc0', label = 'Aufgehoben') {
    const d = document.createElement('div'); d.className = 'pop'; d.style.color = color;
    d.innerHTML = (label ? `<small>${esc(label)}</small>` : '') + `<span>${esc(text)}</span>`;
    d.querySelector('span').style.color = color;
    this.el.pops.appendChild(d);
    while (this.el.pops.children.length > 5) this.el.pops.firstChild.remove();
    setTimeout(() => d.remove(), 3700);
  }
  showTitle(h1, h2 = '', banner = '') {
    const t = this.el.title;
    t.className = 'title' + (banner ? ' banner ' + banner : '');
    t.querySelector('h1').textContent = h1; t.querySelector('h2').textContent = h2;
    t.querySelector('hr').style.display = h2 ? '' : 'none';
    void t.offsetWidth; t.classList.add('show');
  }

  // ---------- Screens ----------
  open(id, opt = {}) {
    if (!this.isOpen) this.ctx.onOpen?.();
    this.stack.push({ id, tab: opt.tab || 0, sel: 0, ...opt });
    this.msg = '';
    this.render();
  }
  back() { this.stack.pop(); this.msg = ''; if (!this.isOpen) this.close(); else this.render(); }
  close() { this.stack.length = 0; this.el.panel.classList.remove('open'); this.ctx.onClose?.(); this.el.prompt.style.display = this.promptTxt ? 'block' : 'none'; }
  toggleInventory() { if (this.isOpen) this.close(); else this.open('inventory'); }

  /** Gibt true zurück, wenn die Eingabe verbraucht wurde (Panel offen) */
  handle(o) {
    if (!this.isOpen) return false;
    const s = this.top, rows = this.rows(s), sel = () => rows[s.sel];
    const move = d => { if (!rows.length) return; let k = s.sel; for (let n = 0; n < rows.length; n++) { k = (k + d + rows.length) % rows.length; if (!rows[k].hdr) break; } s.sel = k; this.ctx.sfx?.('ui'); };
    if (s.sel >= rows.length) s.sel = Math.max(0, rows.length - 1);
    if (rows[s.sel]?.hdr) move(1);
    let changed = false;
    if (o.uiUp) { move(-1); changed = true; }
    if (o.uiDown) { move(1); changed = true; }
    if (o.uiLeft && sel()?.left) { sel().left(); changed = true; }
    if (o.uiRight && sel()?.right) { sel().right(); changed = true; }
    const tabs = this.tabs(s);
    if (tabs && (o.uiTabL || o.uiTabR)) { s.tab = (s.tab + (o.uiTabR ? 1 : -1) + tabs.length) % tabs.length; s.sel = 0; this.msg = ''; changed = true; this.ctx.sfx?.('ui'); }
    if (o.uiConfirm && sel() && !sel().dis && sel().ok) { sel().ok(); this.ctx.sfx?.('uiConfirm'); changed = true; }
    if (o.uiBack) { this.back(); return true; }
    if (changed && this.isOpen) this.render();
    return true;
  }
  onClick(e) {
    const tab = e.target.closest('[data-tab]'), row = e.target.closest('[data-row]');
    if (tab) { this.top.tab = +tab.dataset.tab; this.top.sel = 0; this.render(); return; }
    if (e.target.closest('[data-close]')) { this.close(); return; }
    if (row) {
      const s = this.top, rows = this.rows(s), k = +row.dataset.row;
      if (s.sel === k && rows[k]?.ok && !rows[k].dis) rows[k].ok(); else if (rows[k]?.right && e.offsetX > row.clientWidth * 0.6) rows[k].right(); else if (rows[k]?.left && e.offsetX < 40) rows[k].left();
      s.sel = k;
      if (this.isOpen) this.render();
    }
  }

  tabs(s) { return s.id === 'inventory' ? ['Ausrüstung', 'Inventar', 'Zauberbuch', 'Optionen'] : null; }

  /** Zeilen eines Screens: { ic, sl, lb, vl, c, dis, hdr, ok(), left(), right(), tip:()=>html } */
  rows(s) {
    const p = this.ctx.prog, C = this.ctx, R = [];
    const itemRow = (it, extra = {}) => ({ ic: itemIcon(it), lb: itemName(it), c: RARITIES[it.rarity]?.css, tip: () => this.itemTip(it), ...extra });
    const equipped = uid => uid && (p.equip.weapon === uid || p.equip.relics.includes(uid));
    if (s.id === 'inventory') {
      const tab = this.tabs(s)[s.tab];
      if (tab === 'Ausrüstung') {
        const w = p.get(p.equip.weapon);
        R.push({ hdr: true, lb: 'Bewaffnung' });
        R.push({ sl: 'Waffe', ic: w ? itemIcon(w) : '👊', lb: w ? itemName(w) : 'Fäuste', c: w ? RARITIES[w.rarity].css : null, tip: () => w ? this.itemTip(w) : this.textTip('Fäuste', 'Nichts in den Händen. Schnell, aber schwach.'), ok: () => this.open('choose', { slot: 'weapon' }) });
        for (let k = 0; k < 2; k++) {
          const sp = p.equip.spells[k], S = sp ? spellDef(sp) : null;
          R.push({ sl: 'Zauber ' + (k + 1), ic: S?.icon || '·', lb: S ? S.name : '— leer —', tip: () => S ? this.spellTip(sp) : this.textTip('Zauber-Slot', 'Schriftrollen lernen, dann hier ausrüsten.'), ok: () => this.open('choose', { slot: 'spell' + k }) });
        }
        R.push({ hdr: true, lb: 'Relikte' });
        for (let k = 0; k < 2; k++) {
          const it = p.get(p.equip.relics[k]);
          R.push({ sl: 'Relikt ' + (k + 1), ic: it ? itemIcon(it) : '·', lb: it ? itemName(it) : '— leer —', c: it ? RARITIES[it.rarity].css : null, tip: () => it ? this.itemTip(it) : this.textTip('Relikt-Slot', 'Relikte gewähren passive Boni.'), ok: () => this.open('choose', { slot: 'relic' + k }) });
        }
        R.push({ hdr: true, lb: 'Werkzeug' });
        const fl = C.fighter?.flask;
        R.push({ sl: 'Flakon', ic: '🧪', lb: `Glutflakon ${fl ? fl.charges + '/' : ''}${p.flaskMax}`, tip: () => this.textTip('Glutflakon', 'Heilt einen Teil deiner Lebenspunkte. Am Leuchtfeuer aufgefüllt. Glutflakon-Splitter erhöhen die Ladungen.') });
        R.push({ sl: 'Stufe', ic: '🔥', lb: `Stufe ${p.level} · Glut ${p.glut}`, tip: () => this.statsTip() });
      } else if (tab === 'Inventar') {
        const order = ['weapon', 'relic', 'scroll', 'consumable', 'sigil'], names = { weapon: 'Waffen', relic: 'Relikte', scroll: 'Schriftrollen', consumable: 'Verbrauchsgüter', sigil: 'Siegel' };
        for (const kind of order) {
          const list = p.inventory.filter(it => it.kind === kind);
          if (!list.length) continue;
          R.push({ hdr: true, lb: names[kind] });
          for (const it of list) R.push(itemRow(it, {
            vl: equipped(it.uid) ? '<span class="eq">◆ ausgerüstet</span>' : '',
            ok: () => {
              if (it.kind === 'weapon') { p.equipItem('weapon', p.equip.weapon === it.uid ? null : it.uid); C.onEquip?.(); }
              else if (it.kind === 'relic') { const k = p.equip.relics.indexOf(it.uid); if (k >= 0) p.equipItem('relic' + k, null); else p.equipItem('relic' + Math.max(0, p.equip.relics.indexOf(null)), it.uid); C.onEquip?.(); }
              else { const t = p.use(it.uid); if (t) { this.msg = t; C.onEquip?.(); } }
            },
          }));
        }
        if (!R.length) R.push({ lb: 'Leer. Plündere Wracks und Feinde.', dis: true });
      } else if (tab === 'Zauberbuch') {
        const busy = C.inCombat?.();
        if (!p.learned.length) R.push({ lb: 'Noch keine Zauber gelernt.', dis: true });
        for (const id of p.learned) {
          const S = spellDef(id), k = p.equip.spells.indexOf(id);
          R.push({ ic: S.icon || '✨', lb: S.name, vl: k >= 0 ? `<span class="eq">◆ Slot ${k + 1}</span>` : '', dis: busy, tip: () => this.spellTip(id),
            ok: () => { const slot = k >= 0 ? k : (p.equip.spells.indexOf(null) >= 0 ? p.equip.spells.indexOf(null) : 0); p.equipItem('spell' + (k >= 0 ? (1 - k) : slot), id); C.onEquip?.(); },
            left: () => { p.equipItem('spell0', id); C.onEquip?.(); }, right: () => { p.equipItem('spell1', id); C.onEquip?.(); } });
        }
        if (busy) this.msg = 'Zauber lassen sich im Kampf nicht wechseln.';
      } else {
        for (const [k, type, label, min, max, step, names] of OPTION_DEFS) {
          const v = OPTIONS[k];
          const val = type === 'bool' ? (names ? names[v ? 1 : 0] : v ? 'An' : 'Aus') : (+v).toFixed(step < 0.1 ? 2 : 1);
          const ch = d => { setOption(k, type === 'bool' ? !v : v + d * step); C.onOptionChange?.(k); };
          R.push({ lb: label, vl: `<span class="arr">◂</span> ${val} <span class="arr">▸</span>`, ok: () => ch(1), left: () => ch(-1), right: () => ch(1),
            tip: () => this.textTip(label, type === 'bool' ? 'Bestätigen oder ◂ ▸ zum Umschalten.' : `◂ ▸ ändern (${min} … ${max}).`) });
        }
      }
    } else if (s.id === 'choose') {
      const slot = s.slot;
      R.push({ ic: '✕', lb: slot === 'weapon' ? 'Fäuste (nichts)' : '— leer —', ok: () => { p.equipItem(slot, null); C.onEquip?.(); this.back(); } });
      if (slot.startsWith('spell')) {
        if (C.inCombat?.()) this.msg = 'Zauber lassen sich im Kampf nicht wechseln.';
        for (const id of p.learned) { const S = spellDef(id); R.push({ ic: S.icon || '✨', lb: S.name, dis: C.inCombat?.(), vl: p.equip.spells.includes(id) ? '<span class="eq">◆</span>' : '', tip: () => this.spellTip(id), ok: () => { p.equipItem(slot, id); C.onEquip?.(); this.back(); } }); }
      } else {
        const kind = slot === 'weapon' ? 'weapon' : 'relic';
        for (const it of p.inventory.filter(x => x.kind === kind)) R.push(itemRow(it, { vl: equipped(it.uid) ? '<span class="eq">◆</span>' : '', ok: () => { p.equipItem(slot, it.uid); C.onEquip?.(); this.back(); } }));
      }
    } else if (s.id === 'shrine') {
      R.push({ ic: '🔥', lb: 'Rasten', tip: () => this.textTip('Rasten', 'Volle Heilung, Glutflakon auffüllen, Respawn-Punkt setzen. Alle Feinde (außer Bossen) kehren zurück.'), ok: () => { C.onRest?.(); this.msg = 'Du rastest. Die Glut wärmt dich.'; } });
      R.push({ ic: '⬆️', lb: `Stufe aufsteigen`, vl: `${p.nextCost} Glut`, tip: () => this.statsTip(), ok: () => this.open('levelup', { alloc: {} }) });
      R.push({ ic: '📖', lb: 'Zauber wechseln', tip: () => this.textTip('Zauberbuch', `${p.learned.length} Zauber gelernt.`), ok: () => this.open('inventory', { tab: 2 }) });
      R.push({ ic: '🎒', lb: 'Ausrüstung', tip: () => this.textTip('Ausrüstung', 'Waffe, Zauber und Relikte wechseln.'), ok: () => this.open('inventory', { tab: 0 }) });
      R.push({ ic: '⚒️', lb: 'Schmieden', vl: `🪨 ${p.count('forgeStone')}`, tip: () => this.textTip('Schmieden', 'Waffen mit Schmiedesteinen und Glut verstärken (+1 … +5).'), ok: () => this.open('forge') });
      R.push({ ic: '🚪', lb: 'Verlassen', ok: () => this.close() });
    } else if (s.id === 'levelup') {
      const al = s.alloc, k = Object.values(al).reduce((a, b) => a + b, 0), cost = p.costFor(k), next = p.costFor(k + 1);
      for (const [id, name, desc] of ATTRS) {
        R.push({ sl: name, lb: '', vl: `${p.attrs[id]}${al[id] ? ` <span class="arr">→</span> <b style="color:#8fe08f">${p.attrs[id] + al[id]}</b>` : ''} <span class="arr">◂ ▸</span>`,
          tip: () => this.levelTip(s, desc),
          left: () => { if (al[id] > 0) al[id]--; },
          right: () => { if (next <= p.glut) al[id] = (al[id] || 0) + 1; else this.msg = 'Nicht genug Glut.'; },
          ok: () => { if (next <= p.glut) al[id] = (al[id] || 0) + 1; else this.msg = 'Nicht genug Glut.'; } });
      }
      R.push({ ic: '✔', lb: k ? `Bestätigen (+${k} Stufe${k > 1 ? 'n' : ''}, ${cost} Glut)` : 'Bestätigen', dis: !k, tip: () => this.levelTip(s, ''),
        ok: () => { if (C.onLevelUp?.(s.alloc)) { s.alloc = {}; this.msg = `Stufe ${p.level} erreicht.`; } } });
    } else if (s.id === 'forge') {
      const ws = p.inventory.filter(it => it.kind === 'weapon');
      if (!ws.length) R.push({ lb: 'Keine Waffen zum Schmieden.', dis: true });
      for (const it of ws) {
        const u = it.upgrade || 0, c = forgeCost(u), max = u >= UPGRADE_MAX;
        R.push(itemRow(it, { vl: max ? 'max' : `🪨${c.stones} · ${c.glut}`, dis: max, tip: () => this.forgeTip(it), ok: () => { this.msg = C.onForge?.(it.uid) || ''; } }));
      }
    }
    return R;
  }

  // ---------- Tooltips ----------
  itemTip(it) {
    const st = this.ctx.prog.attrs;
    return itemTooltip(it, st).map(l => `<div class="${l.big ? 'big' : ''} ${l.dim ? 'dim' : ''}" style="${l.c ? 'color:' + (l.big ? INK[it.rarity] : l.c === '#9fd4a0' ? '#1a5a1a' : l.c === '#f0c27a' ? '#7a4a00' : l.c) : ''}">${esc(l.t)}</div>`).join('');
  }
  spellTip(id) {
    const S = spellDef(id);
    return `<div class="big">${esc(S.icon || '')} ${esc(S.name)}</div><div class="dim">${S.school === 'glaube' ? 'Glaube' : 'Verstand'}</div><hr>` +
      (S.mana != null ? `<div>Mana ${S.mana} · Abklingzeit ${S.cd ?? '?'} s</div>` : '') + (S.desc ? `<div class="dim">${esc(S.desc)}</div>` : '');
  }
  textTip(h, t) { return `<div class="big">${esc(h)}</div><hr><div class="dim">${esc(t)}</div>`; }
  statsTip() {
    const p = this.ctx.prog, d = p.preview(this.ctx.fighter);
    return `<div class="big">Stufe ${p.level}</div><div class="dim">Glut ${p.glut} · nächste Stufe ${p.nextCost}</div><hr><table>` +
      ATTRS.map(([id, n]) => `<tr><td>${n}</td><td class="n">${p.attrs[id]}</td></tr>`).join('') + '</table><hr><table>' +
      [['Lebenspunkte', d.hp], ['Ausdauer', d.sta], ['Mana', d.mana], ['Phys. Schaden', d.phys + ' %'], ['Magie', d.magic + ' %']].map(([n, v]) => `<tr><td>${n}</td><td class="n">${v}</td></tr>`).join('') + '</table>' +
      (Object.keys(p.mods()).length ? '<hr>' + Object.entries(p.mods()).map(([k, v]) => `<div style="color:#1a5a1a">◆ ${esc(formatMod(k, v))}</div>`).join('') : '');
  }
  levelTip(s, desc) {
    const p = this.ctx.prog, al = s.alloc, k = Object.values(al).reduce((a, b) => a + b, 0);
    const na = { ...p.attrs }; for (const a in al) na[a] += al[a];
    const d0 = p.preview(this.ctx.fighter), d1 = p.preview(this.ctx.fighter, na);
    const row = (n, a, b) => `<tr><td>${n}</td><td class="n">${a}</td><td class="n">${a !== b ? `→ <span class="up">${b}</span>` : ''}</td></tr>`;
    return `<div class="big">Stufe ${p.level}${k ? ` → ${p.level + k}` : ''}</div>` + (desc ? `<div class="dim">${esc(desc)}</div>` : '') +
      `<hr><table>${row('Glut', p.glut, p.glut - p.costFor(k))}${row('Kosten', p.costFor(k), p.costFor(k))}<tr><td colspan=3 class="dim">nächste Stufe: ${p.costFor(k + 1) - p.costFor(k)} Glut</td></tr></table><hr><table>` +
      row('Lebenspunkte', d0.hp, d1.hp) + row('Ausdauer', d0.sta, d1.sta) + row('Mana', d0.mana, d1.mana) + row('Phys. Schaden %', d0.phys, d1.phys) + row('Magie %', d0.magic, d1.magic) + row('Heilung %', d0.heal, d1.heal) + '</table>';
  }
  forgeTip(it) {
    const u = it.upgrade || 0, p = this.ctx.prog;
    if (u >= UPGRADE_MAX) return this.itemTip(it) + '<hr><div class="dim">Vollständig verstärkt.</div>';
    const c = forgeCost(u), next = { ...it, upgrade: u + 1 };
    return this.itemTip(it) + `<hr><table><tr><td>Angriffskraft</td><td class="n">${weaponPower(it, p.attrs)}</td><td class="n">→ <span class="up">${weaponPower(next, p.attrs)}</span></td></tr>
      <tr><td>Schmiedesteine</td><td class="n">${p.count('forgeStone')}</td><td class="n">/ ${c.stones}</td></tr><tr><td>Glut</td><td class="n">${p.glut}</td><td class="n">/ ${c.glut}</td></tr></table>`;
  }

  render() {
    const s = this.top; if (!s) return;
    const P = this.el.panel; P.classList.add('open');
    this.el.prompt.style.display = 'none';
    const rows = this.rows(s);
    if (s.sel >= rows.length) s.sel = Math.max(0, rows.length - 1);
    if (rows[s.sel]?.hdr && rows.length > 1) s.sel = rows.findIndex((r, k) => k >= s.sel && !r.hdr);
    if (s.sel < 0) s.sel = 0;
    const title = { inventory: 'Ausrüstung', choose: 'Auswählen', shrine: 'Leuchtfeuer', levelup: 'Stufe aufsteigen', forge: 'Schmiede' }[s.id];
    const tabs = this.tabs(s), K = this.ctx.keyLabel || (() => '');
    const cur = rows[s.sel];
    P.innerHTML = `<div class="ph"><h3>${title}</h3><span class="gl">◆ ${this.ctx.prog.glut} Glut · Stufe ${this.ctx.prog.level}</span><span data-close style="cursor:pointer;padding:0 6px">✕</span></div>` +
      (tabs ? `<div class="tabs"><span class="tk">${esc(K('tabL'))}</span>${tabs.map((t, k) => `<span data-tab="${k}" class="${k === s.tab ? 'on' : ''}">${t}</span>`).join('')}<span class="tk">${esc(K('tabR'))}</span></div>` : '') +
      `<div class="pb"><div class="list">${rows.map((r, k) => r.hdr ? `<div class="row hdr">${esc(r.lb)}</div>` :
        `<div class="row ${k === s.sel ? 'sel' : ''} ${r.dis ? 'dis' : ''}" data-row="${k}">${r.ic != null ? `<span class="ic">${r.ic}</span>` : ''}${r.sl ? `<span class="sl">${esc(r.sl)}</span>` : ''}<span class="lb" style="${r.c ? 'color:' + r.c : ''}">${esc(r.lb)}</span>${r.vl ? `<span class="vl">${r.vl}</span>` : ''}</div>`).join('')}
        <div class="msg">${esc(this.msg)}</div></div>
        <div class="tip">${cur?.tip ? cur.tip() : this.textTip(title, '')}</div></div>` +
      `<div class="pf"><b>${esc(K('confirm'))}</b> wählen · <b>${esc(K('back'))}</b> zurück · <b>${esc(K('nav'))}</b> navigieren${tabs ? ` · <b>${esc(K('tabL'))}/${esc(K('tabR'))}</b> Reiter` : ''}${s.id === 'levelup' || (tabs && s.tab === 3) ? ' · ◂ ▸ ändern' : ''}</div>`;
    const selEl = P.querySelector('.row.sel'); if (selEl) selEl.scrollIntoView({ block: 'nearest' });
  }
}
