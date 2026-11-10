/**
 * @modul    register
 * @zweck    Datenkatalog für Gegenstände, Rezepte usw. mit stabilen Nummern und eingefrorenen Einträgen
 * @api      createRegister({art,standard}) -> {definiere(id,daten,{ersetzen}),definiereAlle({id:daten}),hole(id),brauche(id),hat(id),nummer(id),idVon(nummer),alle(),filter(fn),mitTag(tag),anzahl,dispose()}
 * @beispiel
 *   import { createRegister } from '../../engine/core/register.js';
 *   const items = createRegister({ art: 'gegenstand', standard: { stapel: 99 } });
 *   items.definiere('holz', { name: 'Holz', tags: ['material'] });
 *   items.brauche('holz').name; items.nummer('holz'); items.mitTag('material');
 * @tags     daten, katalog, gegenstand, rezept, register
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

export function createRegister({ art = 'eintrag', standard = {} } = {}) {
  const eintraege = new Map(); // id -> Eintrag
  const ids = [];              // nummer -> id

  function definiere(id, daten = {}, { ersetzen = false } = {}) {
    if (typeof id !== 'string' || id === '') {
      throw new Error(`${art}: ungültige id (${String(id)})`);
    }
    const vorhanden = eintraege.has(id);
    if (vorhanden && !ersetzen) throw new Error(`${art} '${id}' ist bereits definiert`);
    const nummer = vorhanden ? eintraege.get(id).nummer : ids.length;
    if (!vorhanden) ids.push(id);
    const eintrag = Object.freeze({ ...standard, ...daten, id, nummer });
    eintraege.set(id, eintrag);
    return eintrag;
  }

  function definiereAlle(objekt) {
    for (const [id, daten] of Object.entries(objekt || {})) definiere(id, daten);
  }

  const hole = (id) => eintraege.get(id);
  const hat = (id) => eintraege.has(id);

  function brauche(id) {
    const e = eintraege.get(id);
    if (!e) throw new Error(`${art} '${id}' ist unbekannt`);
    return e;
  }

  function nummer(id) {
    const e = eintraege.get(id);
    return e ? e.nummer : -1;
  }

  const idVon = (n) => ids[n];
  const alle = () => ids.map((id) => eintraege.get(id));
  const filter = (fn) => alle().filter(fn);
  const mitTag = (tag) => alle().filter((e) => Array.isArray(e.tags) && e.tags.includes(tag));

  function dispose() {
    eintraege.clear();
    ids.length = 0;
  }

  return {
    definiere, definiereAlle, hole, brauche, hat, nummer, idVon, alle, filter, mitTag, dispose,
    get anzahl() { return ids.length; },
  };
}
