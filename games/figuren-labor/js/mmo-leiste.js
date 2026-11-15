// Figuren-Labor – Kampfmodus-Umschalter: „✨ Action-Zauber“ (die bisherige Zauberleiste, Ziffern 1–0) ↔ „🎯 MMO-Leiste“
// (engine/gameplay/faehigkeiten + engine/ui/kampf-leiste: Rolle, GCD, Ressourcen, Wirkzeit, Ziel per Lock-On T, Ziffern 1–4).
// Dazu zwei Ziel-Rahmen (engine/ui/ziel-rahmen): Spieler oben links, Ziel (Lock-On bzw. zuletzt getroffen) darunter bzw. oben mitte.
import { createLeiste, FAEHIGKEITEN } from '../../../engine/gameplay/faehigkeiten.js';
import { createKampfLeiste } from '../../../engine/ui/kampf-leiste.js';
import { createZielRahmen } from '../../../engine/ui/ziel-rahmen.js';

export const ROLLEN = {
  krieger: { name: '⚔ Krieger', plaetze: ['hieb', 'wirbelwind', 'spott', 'ansturm'], ressourcen: { wut: { max: 100, regen: -2, start: 0 } } },
  magier: { name: '🔥 Magier', plaetze: ['feuerball', 'frostnova', 'blinzeln', 'pyroschlag'], ressourcen: { mana: { max: 100, regen: 5 } } },
  heiler: { name: '💚 Heiler', plaetze: ['heilung', 'erneuerung', 'laeuterung', 'schutzwall'], ressourcen: { mana: { max: 100, regen: 5 } } },
};
const GRUND = { abklingzeit: 'Lädt noch …', ressource: 'Zu wenig Ressource', reichweite: 'Zu weit weg', ziel: 'Kein Ziel – T wählt eins', gesperrt: 'Gesperrt' };
const FARBE = { mana: '#4a8fe8', wut: '#d8453a', energie: '#e6c93c' };
const ZIFFERN = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];

/**
 * opts: { ks (createKampfSpiel), zauber() -> Zauber-Spiel, spieler, kamera, lockZiel() -> Figur|null, freiMana() -> bool,
 *   wurzel (Menü-Seite ⚔ Kampf mit [data-modus]/[data-rolle]-Knöpfen und #kWaffe), waffen: [namen], onWaffe(name), onMeldung(text), klang }
 */
export function createMmoLeiste({ ks, zauber, spieler, kamera, lockZiel = () => null, freiMana = () => false, wurzel, waffen = [], onWaffe = () => {}, onMeldung = () => {}, klang = null }) {
  const kampf = ks.kampf, $ = (id) => document.getElementById(id);
  const grob = matchMedia('(pointer: coarse)').matches;
  let modus = 'zauber', rolle = 'krieger', leiste = null, plaetze = [], waffeAlt = null;

  // ---- Ziel-Rahmen: schmal (Handy) links/rechts nebeneinander unter der Zauberleiste, breit: Spieler links, Ziel mitte ----
  const schmal = innerWidth < 600, breite = schmal ? 160 : 230, oben = 'env(safe-area-inset-top, 0px)';
  const rahmenSpieler = createZielRahmen({ ecke: 'oben-links', breite }), rahmenZiel = createZielRahmen({ ecke: 'oben-mitte', breite });
  rahmenSpieler.element.style.top = `calc(${oben} + ${schmal ? 124 : 56}px)`;
  Object.assign(rahmenZiel.element.style, schmal
    ? { top: `calc(${oben} + 124px)`, left: 'auto', right: '8px', transform: 'none' } : { top: `calc(${oben} + 142px)` });

  const kl = createKampfLeiste({ plaetze: [], onNutze: (n) => nutzen(n), unten: grob ? 285 : 52 });
  // Handy: Leiste links über dem Stick, damit der Knopfbogen rechts (🎯 🛡 ⚔) frei bleibt
  if (grob) Object.assign(kl.element.style, { left: '8px', transform: 'none', width: 'min(62vw, 300px)', alignItems: 'flex-start' });
  kl.element.style.display = 'none';

  function setRolle(r) {
    if (!ROLLEN[r]) return;
    rolle = r;
    leiste?.dispose?.();
    leiste = createLeiste({ ressourcen: ROLLEN[r].ressourcen });
    plaetze = ROLLEN[r].plaetze;
    kl.setPlaetze(plaetze.map((n, i) => ({ name: n, symbol: FAEHIGKEITEN[n].symbol, taste: String(i + 1) })));
    markiere();
  }
  function setModus(m) {
    modus = m === 'mmo' ? 'mmo' : 'zauber';
    const mmo = modus === 'mmo';
    kl.element.style.display = mmo ? '' : 'none';
    if ($('zleiste')) $('zleiste').style.display = mmo ? 'none' : '';
    if ($('bZaubern')) $('bZaubern').style.display = mmo ? 'none' : '';
    markiere();
    onMeldung(mmo ? `🎯 MMO-Leiste: ${ROLLEN[rolle].name} – Ziffern 1–4, T = Ziel` : '✨ Action-Zauber: Ziffern 1–0, R halten = aufladen');
  }
  function markiere() {
    for (const b of wurzel.querySelectorAll('[data-modus]')) b.classList.toggle('an', b.dataset.modus === modus);
    for (const b of wurzel.querySelectorAll('[data-rolle]')) b.classList.toggle('an', b.dataset.rolle === rolle);
    for (const b of wurzel.querySelectorAll('[data-waffe]')) b.classList.toggle('an', b.dataset.waffe === ks.waffe);
  }
  const wf = wurzel.querySelector('#kWaffe');
  if (wf) wf.innerHTML = waffen.map((w) => `<button data-waffe="${w}">${w}</button>`).join('');
  wurzel.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.modus) setModus(b.dataset.modus);
    else if (b.dataset.rolle) { setRolle(b.dataset.rolle); setModus('mmo'); }
    else if (b.dataset.waffe) { onWaffe(b.dataset.waffe); markiere(); }
    b.blur();
  });
  const taste = (e) => {
    if (modus !== 'mmo' || e.repeat || e.target.matches?.('input, select, textarea')) return;
    const i = ZIFFERN.indexOf(e.code);
    if (i >= 0 && plaetze[i]) nutzen(plaetze[i]);
  };
  addEventListener('keydown', taste);

  // ---- Ziel und Kontext ----
  const abstandZu = (z) => Math.max(0, Math.hypot(z.x - spieler.zustand.pos.x, z.z - spieler.zustand.pos.z) - (z.radius || 0));
  function naechster(reich) {
    let best = null, bd = reich;
    for (const z of ks.gegnerListe()) { const d = abstandZu(z); if (d < bd) { best = z; bd = d; } }
    return best?.id ?? null;
  }
  /** Ziel-Kennung: Lock-On, sonst zuletzt getroffen. */
  const zielId = () => { const f = lockZiel(); return (f && ks.kidVon(f)) || ks.letzterId(); };
  function kontext(def) {
    const art = def.zielArt || 'feind', sperren = kampf.zustaende('spieler').faktoren();
    if (art === 'selbst') return { sperren };
    let id = zielId();
    if (art === 'freund') {   // Verbündete: Lock-On-Ziel, sonst du selbst
      const z = id && ks.zielDaten(id);
      return z && lockZiel() ? { sperren, ziel: { id, feind: false }, abstand: abstandZu(z) } : { sperren, ziel: { id: 'spieler', feind: false }, abstand: 0 };
    }
    if (!id || !ks.zielDaten(id)) id = naechster(def.reichweite || 3);   // ohne Ziel: der nächste Gegner
    const z = id && ks.zielDaten(id);
    return z ? { sperren, ziel: { id, feind: true }, abstand: abstandZu(z) } : { sperren };
  }
  function nutzen(name) {
    if (modus !== 'mmo' || !FAEHIGKEITEN[name] || zauber().tot) return;
    const r = leiste.nutze(name, { ...kontext(FAEHIGKEITEN[name]), bewegt: bewegtZuletzt });
    if (!r.ok && GRUND[r.grund]) { onMeldung(GRUND[r.grund]); klang?.spiele('fehl'); }
    else if (r.ok) kl.blitz(name);
  }

  // ---- Wirkungen ----
  function wirke(e) {
    const w = e.def.wirkung, id = e.ziel?.id || 'spieler', p = spieler.zustand.pos, zp = zauber();
    const z = ks.zielDaten(id), dx = z ? z.x - p.x : Math.sin(spieler.zustand.yaw), dz = z ? z.z - p.z : Math.cos(spieler.zustand.yaw), l = Math.hypot(dx, dz) || 1;
    if (e.typ === 'fertig' && w.wutGewinn) leiste.gib('wut', w.wutGewinn);
    if (w.typ === 'zauber') {   // das Zauberbuch wirkt, die Kosten trägt die Leiste (kein Buch-Mana)
      const frei = freiMana();
      zp.buch.setFreiesMana(true);
      const ok = zp.wirke(w.zauber);
      zp.buch.setFreiesMana(frei);
      if (!ok) onMeldung('Zauber noch nicht bereit');
    } else if (w.typ === 'nahkampf') ks.angriff(w.angriff);
    else if (w.typ === 'schaden') {
      if (e.def.kanal) spieler.spiele('fegen');
      const liste = w.radius ? ks.gegnerListe().filter((q) => abstandZu(q) <= w.radius) : z ? [z] : [];
      if (w.ansturm && z) spieler.stoss((dx / l) * 14, 0, (dz / l) * 14);
      for (const q of liste.slice()) {
        const qx = q.x - p.x, qz = q.z - p.z, ql = Math.hypot(qx, qz) || 1;
        ks.schadeGegner(q.id, { menge: w.menge, art: w.art, wucht: 14, richtung: { x: qx / ql, z: qz / ql }, stoss: { x: (qx / ql) * 4, y: 0.6, z: (qz / ql) * 4 } });
      }
      if (w.radius) zp.fx.ring(p, { farbe: 0xd8c8a8, radius: w.radius, dauer: 0.3 });
      kamera.schuetteln(0.12, 0.12); klang?.spiele('wumms', { staerke: 0.5, tonhoehe: 1.2 });
    } else if (w.typ === 'heilung') {
      kampf.heile({ quelle: 'spieler', ziel: id, menge: w.menge });
      const q = z || { x: p.x, y: p.y, z: p.z };
      zp.fx.funken({ x: q.x, y: (q.y || 0) + 0.5, z: q.z }, { farbe: 0x6dff8a, anzahl: 30, tempo: 0.8, dauer: 1, groesse: 0.5, schwerkraft: -2.5, streuung: 0.6 });
      klang?.spiele('heilen', { staerke: 0.8 });
    } else if (w.typ === 'zustand') {
      if (w.reinige) kampf.zustaende(id)?.reinige(w.reinige); else kampf.gibZustand(id, w.zustand, { quelle: 'spieler', dauer: w.dauer });
      zp.fx.ring(z || p, { farbe: 0x6dff8a, radius: 1.2, dauer: 0.5 });
      klang?.spiele('heilen', { staerke: 0.6, tonhoehe: 1.3 });
    } else if (w.typ === 'spott') {
      kampf.bedrohung.spott(id, 'spieler', w.dauer);
      onMeldung('📢 Spott!'); klang?.spiele('entladen', { staerke: 0.8, tonhoehe: 0.6 });
    }
  }

  // ---- Rahmen ----
  function ressource() {
    const n = modus === 'mmo' ? Object.keys(ROLLEN[rolle].ressourcen)[0] : 'mana';
    const r = modus === 'mmo' ? leiste.ressource(n) : { wert: zauber().buch.mana, max: zauber().buch.manaMax };
    return r && { wert: r.wert, max: r.max, farbe: FARBE[n] };
  }
  function rahmen(dt) {
    const k = kampf.kaempfer('spieler');
    rahmenSpieler.zeige({ name: spieler.name || 'Du', leben: k.leben, lebenMax: k.lebenMax, schild: k.schild, haltung: k.haltung, haltungMax: k.haltungMax, taumelt: k.taumelt,
      ressource: ressource(), zustaende: kampf.zustaende('spieler').liste(), imKampf: kampf.imKampf('spieler') });
    const id = zielId(), i = id && ks.info(id);
    rahmenZiel.zeige(i || null);
    rahmenSpieler.update(dt); rahmenZiel.update(dt);
  }

  let bewegtZuletzt = false;
  // Sicht der Leiste fürs Aussehen: „kann“ mit Ziel und Reichweite (rot = zu weit weg), alles andere direkt aus der Leiste
  const sicht = {
    abkling: (n) => leiste.abkling(n), ladungen: (n) => leiste.ladungen(n), ressource: (n) => leiste.ressource(n),
    get gcdAnteil() { return leiste.gcdAnteil; }, get wirkt() { return leiste.wirkt; },
    kann: (n) => leiste.kann(n, { ...kontext(FAEHIGKEITEN[n]), bewegt: false }),
  };
  setRolle('krieger');
  return {
    get modus() { return modus; }, get rolle() { return rolle; },
    setModus, setRolle,
    /** Treffer des Spielers geben Wut (Krieger). */
    gibWut(n) { leiste?.gib('wut', n); },
    /** Pro Frame: bewegt = Eingabe-Stick/Tasten aktiv. */
    update(dt, bewegt) {
      bewegtZuletzt = bewegt;
      if (modus === 'mmo') {
        const f = kampf.zustaende('spieler').faktoren();
        for (const e of leiste.update(dt, { bewegt, getroffen: ks.nimmGetroffen(), sperren: f })) {
          if (e.typ === 'fertig' && e.def.kanal > 0) continue;   // Kanal: die Takte haben schon gewirkt
          if (e.typ === 'fertig' || e.typ === 'kanalTakt') { wirke(e); if (e.typ === 'fertig') kl.blitz(e.name); }
          else if (e.typ === 'unterbrochen') onMeldung('Unterbrochen' + (e.grund === 'bewegt' ? ' (bewegt)' : ''));
        }
        kl.update(dt, sicht);
      }
      if (ks.waffe !== waffeAlt) { waffeAlt = ks.waffe; markiere(); }
      rahmen(dt);
    },
    dispose() { removeEventListener('keydown', taste); kl.dispose?.(); rahmenSpieler.dispose(); rahmenZiel.dispose(); leiste?.dispose?.(); },
  };
}
