// Kachel-Verwaltung für den Planeten (reine Logik, ohne THREE).
// - baut fehlende Kacheln (nächste zuerst), höchstens `parallel` gleichzeitig
// - alte Kacheln bleiben sichtbar, bis ihr Bereich von fertigen neuen Kacheln bedeckt ist (keine Löcher, kein Doppel)
// - fertige, gerade nicht gebrauchte Kacheln bleiben im Zwischenspeicher (schneller zurück)
import { enthaelt } from './planet-baum.js';

export function createKachelStrom({ bauen, erzeuge, zeige, entsorge, parallel = 2, speicher = 500 }) {
  const fertig = new Map();     // key → { k, obj, zuletzt }
  const laufend = new Map();    // key → k
  let angezeigt = new Map();    // key → k
  let zeit = 0;

  function fertigGebaut(key, daten) {
    const k = laufend.get(key);
    laufend.delete(key);
    if (!k) return;
    fertig.set(key, { k, obj: erzeuge(daten), zuletzt: zeit });
  }

  function update(wunsch) {
    zeit++;
    const wKeys = new Map(wunsch.map((k) => [k.key, k]));

    // 1) Bauaufträge: nächste zuerst
    const fehlt = wunsch.filter((k) => !fertig.has(k.key) && !laufend.has(k.key)).sort((a, b) => a.dist - b.dist);
    for (const k of fehlt) {
      if (laufend.size >= parallel) break;
      laufend.set(k.key, k);
      bauen(k);
    }

    // 2) Was bleibt von den bisher angezeigten?
    const bleibt = new Map();
    for (const [key, o] of angezeigt) {
      if (wKeys.has(key)) continue;
      let vorfahr = false, vorfahrFertig = false, kinder = 0, kinderFertig = 0;
      for (const w of wunsch) {
        if (enthaelt(w, o)) { vorfahr = true; if (fertig.has(w.key)) vorfahrFertig = true; }
        else if (enthaelt(o, w)) { kinder++; if (fertig.has(w.key)) kinderFertig++; }
      }
      // bedeckt: fertiger Vorfahr, alle Kinder fertig, oder der Bereich wird gar nicht mehr gebraucht (hinter dem Horizont)
      const bedeckt = vorfahrFertig || (kinder > 0 && kinderFertig === kinder) || (kinder === 0 && !vorfahr);
      if (!bedeckt && fertig.has(key)) bleibt.set(key, o);
    }
    // 3) Neue Anzeige: gewünschte fertige Kacheln, sofern keine bleibende alte sie überlappt
    const neu = new Map(bleibt);
    for (const w of wunsch) {
      if (!fertig.has(w.key)) continue;
      let ueberlappt = false;
      for (const [, o] of bleibt) if (enthaelt(o, w) || enthaelt(w, o)) { ueberlappt = true; break; }
      if (!ueberlappt) neu.set(w.key, w);
    }
    for (const [key] of angezeigt) if (!neu.has(key)) zeige(fertig.get(key)?.obj, false);
    for (const [key] of neu) { const e = fertig.get(key); e.zuletzt = zeit; if (!angezeigt.has(key)) zeige(e.obj, true); }
    angezeigt = neu;

    // 4) Speicher aufräumen: älteste unbenutzte zuerst
    if (fertig.size > speicher) {
      const frei = [...fertig].filter(([key]) => !angezeigt.has(key) && !wKeys.has(key)).sort((a, b) => a[1].zuletzt - b[1].zuletzt);
      for (let i = 0; i < frei.length && fertig.size > speicher; i++) { entsorge(frei[i][1].obj); fertig.delete(frei[i][0]); }
    }
    return { angezeigt: angezeigt.size, gebaut: fertig.size, laufend: laufend.size, offen: fehlt.length };
  }

  function* sichtbar() { for (const [key] of angezeigt) yield fertig.get(key).obj; }

  function dispose() { for (const [, e] of fertig) entsorge(e.obj); fertig.clear(); laufend.clear(); angezeigt.clear(); }

  return { update, fertigGebaut, sichtbar, dispose, get anzahl() { return angezeigt.size; } };
}
