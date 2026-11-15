/**
 * @modul    bedrohung
 * @zweck    Klassische Aggro-Tabelle: Bedrohung je Gegner und Quelle, Zielwechsel erst bei 110 %, Spott, Heilungs-Bedrohung
 * @api      createBedrohung({verfall,wechsel}) -> {add(gegner,quelle,menge),heilung(quelle,menge,gegnerListe),spott(gegner,quelle,dauer),ziel(gegner)->quelleId|null,liste(gegner)->[{id,wert}],entferne(id),leere(gegner),update(dt),zustand(),laden(z),dispose()}
 * @beispiel
 *   import { createBedrohung } from '../../engine/gameplay/bedrohung.js';
 *   const b = createBedrohung();
 *   b.add('ork', 'tank', 100); b.add('ork', 'magier', 105);
 *   b.ziel('ork'); // 'tank' – Magier braucht > 110
 *   b.spott('ork', 'tank', 3);
 * @tags     aggro, bedrohung, tank, kampf, ki, mmo
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

export function createBedrohung({ verfall = 0, wechsel = 1.1 } = {}) {
  const tabelle = new Map(); // gegner -> Map(quelle -> wert)
  const aktuell = new Map(); // gegner -> quelle (aktuelles Ziel)
  const spotte = new Map(); // gegner -> { quelle, rest }

  const zeile = (g) => { let t = tabelle.get(g); if (!t) tabelle.set(g, (t = new Map())); return t; };
  function oben(t) {
    let id = null, max = -Infinity;
    for (const [q, w] of t) if (w > max) { max = w; id = q; }
    return id === null ? null : { id, wert: max };
  }

  function add(gegner, quelle, menge) {
    const t = zeile(gegner);
    t.set(quelle, Math.max(0, (t.get(quelle) || 0) + menge));
  }

  function ziel(gegner) {
    const t = tabelle.get(gegner);
    const sp = spotte.get(gegner);
    if (sp && t?.has(sp.quelle)) return sp.quelle;
    if (!t || !t.size) return null;
    const top = oben(t);
    const cur = aktuell.get(gegner);
    if (cur === undefined || !t.has(cur)) aktuell.set(gegner, top.id);
    else if (top.id !== cur && top.wert > wechsel * t.get(cur)) aktuell.set(gegner, top.id);
    return aktuell.get(gegner);
  }

  return {
    add, ziel,
    heilung(quelle, menge, gegnerListe = []) { for (const g of gegnerListe) add(g, quelle, menge * 0.5); },
    spott(gegner, quelle, dauer = 3) {
      const t = zeile(gegner);
      const top = oben(t);
      t.set(quelle, Math.max(t.get(quelle) || 0, top ? top.wert * wechsel + 1 : 1));
      aktuell.set(gegner, quelle);
      spotte.set(gegner, { quelle, rest: dauer });
    },
    liste(gegner) {
      const t = tabelle.get(gegner);
      return t ? [...t].map(([id, wert]) => ({ id, wert })).sort((a, b) => b.wert - a.wert) : [];
    },
    entferne(id) {
      tabelle.delete(id); aktuell.delete(id); spotte.delete(id);
      for (const t of tabelle.values()) t.delete(id);
      for (const [g, q] of [...aktuell]) if (q === id) aktuell.delete(g);
      for (const [g, s] of [...spotte]) if (s.quelle === id) spotte.delete(g);
    },
    leere(gegner) { tabelle.delete(gegner); aktuell.delete(gegner); spotte.delete(gegner); },
    update(dt) {
      for (const [g, s] of [...spotte]) { s.rest -= dt; if (s.rest <= 0) spotte.delete(g); }
      if (verfall > 0) {
        const f = Math.max(0, 1 - verfall * dt);
        for (const t of tabelle.values()) for (const [q, w] of t) t.set(q, w * f);
      }
    },
    zustand() {
      return {
        tabelle: [...tabelle].map(([g, t]) => [g, [...t]]),
        aktuell: [...aktuell], spott: [...spotte].map(([g, s]) => [g, { ...s }]),
      };
    },
    laden(z) {
      tabelle.clear(); aktuell.clear(); spotte.clear();
      for (const [g, t] of z.tabelle) tabelle.set(g, new Map(t));
      for (const [g, q] of z.aktuell) aktuell.set(g, q);
      for (const [g, s] of z.spott) spotte.set(g, { ...s });
    },
    dispose() { tabelle.clear(); aktuell.clear(); spotte.clear(); },
  };
}
