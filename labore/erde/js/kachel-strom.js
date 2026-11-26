// Kachel-Verwaltung für den Planeten (reine Logik, ohne THREE).
// - baut fehlende Kacheln (nächste zuerst), höchstens `parallel` gleichzeitig
// - alte Kacheln bleiben sichtbar, bis ihr Bereich von fertigen neuen Kacheln bedeckt ist (keine Löcher, kein Doppel)
// - fertige, gerade nicht gebrauchte Kacheln bleiben im Zwischenspeicher (schneller zurück)
// - erneuere(): Kacheln nach einem Eingriff (Graben) neu bauen – die alte bleibt sichtbar, bis die neue da ist
// - Bild-Budget (Sinkflug!): mit `budget: true` landen fertige Worker-Daten erst im Eingang; verarbeite(ms, n) macht
//   daraus je Bild nur so viele Meshes, wie ins Budget passen – größte/sichtbarste zuerst (Feld `prio` aus waehleKacheln),
//   nicht mehr gewünschte werden verworfen (kein GPU-Hochladen für Kacheln, an denen man längst vorbei ist).

// Zahl-Schlüssel (f, L ≤ 31, ix/iy < 2^20) – kein Text je Vergleich
const nk = (f, L, ix, iy) => ((f * 32 + L) * 1048576 + ix) * 1048576 + iy;
const wichtig = (a, b) => (b.prio ?? -b.dist) - (a.prio ?? -a.dist);

export function createKachelStrom({ bauen, erzeuge, zeige, entsorge, parallel = 2, speicher = 500, budget = false }) {
  const fertig = new Map();     // key → { k, obj, zuletzt }
  const laufend = new Map();    // key → k
  let angezeigt = new Map();    // key → k
  const nochmal = new Set();
  let wartend = [];              // gewünscht, noch nicht gestartet (nächste zuerst) – fertigGebaut() startet sofort die nächste    // während des Baus veraltet → danach gleich noch einmal
  let zeit = 0;
  const eingang = new Map();     // key → daten (budget: fertig im Worker, noch kein Mesh)
  let wKeys = new Map();         // letzte Wunschliste (key → k)

  function fertigGebaut(key, daten) {
    if (!laufend.has(key)) return;
    if (budget) { eingang.set(key, daten); return; }   // Platz im Worker bleibt belegt, bis verarbeite() es abholt (Gegendruck)
    uebernimm(key, daten);
  }
  /** Budget-Modus: je Bild aufrufen. → Zahl der erzeugten Meshes. */
  function verarbeite(ms = 3, maxN = 4, uhr = () => performance.now()) {
    if (!eingang.size) return 0;
    const t0 = uhr(), liste = [];
    for (const [key, d] of eingang) {
      const k = laufend.get(key);
      // an der Kamera vorbei (nicht mehr gewünscht, nicht angezeigt): verwerfen statt hochladen
      if (!k || (!wKeys.has(key) && !angezeigt.has(key))) { eingang.delete(key); laufend.delete(key); nochmal.delete(key); continue; }
      liste.push(wKeys.get(key) ?? k);
    }
    liste.sort(wichtig);
    let n = 0;
    for (const k of liste) {
      if (n >= maxN || (n > 0 && uhr() - t0 > ms)) break;
      const d = eingang.get(k.key); eingang.delete(k.key);
      uebernimm(k.key, d); n++;
    }
    nachschieben();
    return n;
  }
  function uebernimm(key, daten) {
    const k = laufend.get(key);
    laufend.delete(key);
    if (!k) return;
    const alt = fertig.get(key), obj = erzeuge(daten);
    if (alt) { // Ersatz für eine veraltete Kachel: nahtlos tauschen
      if (angezeigt.has(key)) { zeige(alt.obj, false); zeige(obj, true); }
      entsorge(alt.obj);
    }
    fertig.set(key, { k, obj, zuletzt: zeit, veraltet: nochmal.delete(key) });
    if (!budget) nachschieben();
  }
  function nachschieben() {
    while (laufend.size < parallel && wartend.length) {
      const n = wartend.shift();
      const e = fertig.get(n.key);
      if ((e && !e.veraltet) || laufend.has(n.key)) continue;
      laufend.set(n.key, n);
      bauen(n);
    }
  }

  /** Kacheln, für die betroffen(k) wahr ist, neu bauen (fertige und gerade laufende). */
  function erneuere(betroffen) {
    for (const [key, e] of fertig) if (betroffen(e.k)) e.veraltet = true;
    for (const [key, k] of laufend) if (betroffen(k)) nochmal.add(key);
  }

  function update(wunsch) {
    zeit++;
    wKeys = new Map(wunsch.map((k) => [k.key, k]));

    // 1) Bauaufträge: wichtigste zuerst (Bildschirmgröße/Blick, sonst nächste)
    const fehlt = wunsch.filter((k) => (!fertig.has(k.key) || fertig.get(k.key).veraltet) && !laufend.has(k.key)).sort(wichtig);
    wartend = fehlt;
    nachschieben();

    // Vorfahren-Tabellen (statt jede alte gegen jede gewünschte Kachel zu prüfen: O(n·Stufen) statt O(n²))
    const wNum = new Map(), unten = new Map();   // wunsch: Zahl → fertig? · Vorfahr-Zahl → [Kinder, davon fertig]
    for (const w of wunsch) {
      const f = fertig.has(w.key);
      wNum.set(nk(w.f, w.L, w.ix, w.iy), f);
      for (let L = w.L - 1; L >= 0; L--) {
        const a = nk(w.f, L, w.ix >> (w.L - L), w.iy >> (w.L - L));
        let e = unten.get(a); if (!e) unten.set(a, (e = [0, 0]));
        e[0]++; if (f) e[1]++;
      }
    }
    // 2) Was bleibt von den bisher angezeigten?
    const bleibt = new Map(), bNum = new Set(), bOben = new Set();
    for (const [key, o] of angezeigt) {
      if (wKeys.has(key)) continue;
      let vorfahr = false, vorfahrFertig = false;
      for (let L = o.L - 1; L >= 0; L--) {
        const f = wNum.get(nk(o.f, L, o.ix >> (o.L - L), o.iy >> (o.L - L)));
        if (f !== undefined) { vorfahr = true; if (f) vorfahrFertig = true; }
      }
      const e = unten.get(nk(o.f, o.L, o.ix, o.iy)), kinder = e ? e[0] : 0, kinderFertig = e ? e[1] : 0;
      // bedeckt: fertiger Vorfahr, alle Kinder fertig, oder der Bereich wird gar nicht mehr gebraucht (hinter dem Horizont)
      const bedeckt = vorfahrFertig || (kinder > 0 && kinderFertig === kinder) || (kinder === 0 && !vorfahr);
      if (!bedeckt && fertig.has(key)) {
        bleibt.set(key, o); bNum.add(nk(o.f, o.L, o.ix, o.iy));
        for (let L = o.L - 1; L >= 0; L--) bOben.add(nk(o.f, L, o.ix >> (o.L - L), o.iy >> (o.L - L)));
      }
    }
    // 3) Neue Anzeige: gewünschte fertige Kacheln, sofern keine bleibende alte sie überlappt
    const neu = new Map(bleibt);
    for (const w of wunsch) {
      if (!fertig.has(w.key)) continue;
      let ueberlappt = bOben.has(nk(w.f, w.L, w.ix, w.iy));   // eine bleibende alte liegt darin
      for (let L = w.L; L >= 0 && !ueberlappt && bNum.size; L--) ueberlappt = bNum.has(nk(w.f, L, w.ix >> (w.L - L), w.iy >> (w.L - L)));
      if (!ueberlappt) neu.set(w.key, w);
    }
    for (const [key] of angezeigt) if (!neu.has(key)) zeige(fertig.get(key)?.obj, false);
    for (const [key] of neu) { const e = fertig.get(key); e.zuletzt = zeit; if (!angezeigt.has(key)) zeige(e.obj, true); }
    angezeigt = neu;

    // 4) veraltete, die gerade keiner braucht, weg (sonst kämen sie alt zurück)
    for (const [key, e] of fertig) if (e.veraltet && !angezeigt.has(key) && !wKeys.has(key)) { entsorge(e.obj); fertig.delete(key); }
    // 5) Speicher aufräumen: älteste unbenutzte zuerst
    if (fertig.size > speicher) {
      const frei = [...fertig].filter(([key]) => !angezeigt.has(key) && !wKeys.has(key)).sort((a, b) => a[1].zuletzt - b[1].zuletzt);
      for (let i = 0; i < frei.length && fertig.size > speicher; i++) { entsorge(frei[i][1].obj); fertig.delete(frei[i][0]); }
    }
    return { angezeigt: angezeigt.size, gebaut: fertig.size, laufend: laufend.size, offen: fehlt.length, eingang: eingang.size };
  }

  function* sichtbar() { for (const [key] of angezeigt) yield fertig.get(key).obj; }

  function dispose() { for (const [, e] of fertig) entsorge(e.obj); fertig.clear(); laufend.clear(); angezeigt.clear(); eingang.clear(); }

  return { update, fertigGebaut, verarbeite, erneuere, sichtbar, dispose, get anzahl() { return angezeigt.size; }, get eingang() { return eingang.size; } };
}
