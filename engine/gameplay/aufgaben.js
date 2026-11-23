/**
 * @modul    aufgaben
 * @zweck    Aufgaben-/Tutorial-Logik: Schritte (gehe-zu, sprich-mit, sammle, besiege, benutze, warte), Fortschritt, Signale, Speicherstand; reine Daten, serialisierbar
 * @api      createAufgaben({daten, ereignisse, zaehle, ortVon, punktVon}) -> { starte(id)->bool, status(id), aktiv(), fertig(id), melde(art, info)->n, update(dt, wer)->ereignisse[], aktuell(id?), springe(id, schritt), brichAb(id), zustand(), laden(z), onAenderung(fn)->abmelden, dispose() } ; pruefeDaten(daten) -> [fehlerText]
 * @beispiel
 *   import { createAufgaben } from '../../engine/gameplay/aufgaben.js';
 *   const a = createAufgaben({ daten: TUTORIAL, ereignisse, zaehle: (id) => inventar.anzahl(id), ortVon: (n) => plan.platz(n) });
 *   a.starte('tutorial');
 *   a.melde('gesprochen', { mit: 'mentor' });   // 'gesammelt' {id,anzahl} · 'besiegt' {art,anzahl} · 'benutzt' {was,anzahl}
 *   a.update(dt, { x: spieler.x, z: spieler.z }); // gehe-zu, warte, sammle (über zaehle)
 *   anzeige.setze(a.aktuell());
 * @tags     aufgabe, tutorial, quest, schritt, fortschritt, gameplay
 * @version  1.1.0
 * @status   entwurf
 * @three    nein
 */

export const ARTEN = Object.freeze(['gehe-zu', 'sprich-mit', 'sammle', 'besiege', 'benutze', 'warte', 'ereignis']);

/** Prüft Aufgaben-Daten, liefert Fehlertexte (leer = gültig). */
export function pruefeDaten(daten) {
  const f = [];
  if (!Array.isArray(daten)) return ['daten ist kein Array'];
  const ids = new Set(daten.map((a) => a?.id));
  const gesehen = new Set();
  for (const a of daten) {
    const an = `Aufgabe ${a?.id}`;
    if (!a || typeof a.id !== 'string' || !a.id) { f.push('Aufgabe ohne id'); continue; }
    if (gesehen.has(a.id)) f.push(`${an}: id doppelt`);
    gesehen.add(a.id);
    if (typeof a.name !== 'string') f.push(`${an}: name fehlt`);
    if (a.danach != null && !ids.has(a.danach)) f.push(`${an}: danach '${a.danach}' unbekannt`);
    if (!Array.isArray(a.schritte) || !a.schritte.length) { f.push(`${an}: keine schritte`); continue; }
    const sids = new Set();
    for (const [i, s] of a.schritte.entries()) {
      const sn = `${an} Schritt ${i} (${s?.id})`;
      if (typeof s?.id !== 'string' || !s.id) f.push(`${sn}: id fehlt`);
      else if (sids.has(s.id)) f.push(`${sn}: id doppelt`);
      sids.add(s?.id);
      if (!ARTEN.includes(s?.art)) { f.push(`${sn}: art '${s?.art}' unbekannt`); continue; }
      if (typeof s.text !== 'string' || !s.text) f.push(`${sn}: text fehlt`);
      if (s.radius != null && !(s.radius > 0)) f.push(`${sn}: radius ungültig`);
      if (s.anzahl != null && !(s.anzahl >= 1)) f.push(`${sn}: anzahl ungültig`);
      if (s.ort != null && typeof s.ort !== 'string' && !(Number.isFinite(s.ort.x) && Number.isFinite(s.ort.z))) f.push(`${sn}: ort ungültig`);
      if (s.art === 'gehe-zu' && s.ort == null) f.push(`${sn}: gehe-zu braucht ort`);
      if (s.art === 'warte' && !(s.dauer > 0)) f.push(`${sn}: warte braucht dauer`);
      if ((s.art === 'sprich-mit' || s.art === 'besiege') && !s.ziel) f.push(`${sn}: ziel fehlt`);
      if (s.art === 'sammle' && !s.ding) f.push(`${sn}: ding fehlt`);
      if ((s.art === 'benutze' || s.art === 'ereignis') && !s.was) f.push(`${sn}: was fehlt`);
      if (s.sagt != null && !(Array.isArray(s.sagt) && s.sagt.every((t) => typeof t === 'string'))) f.push(`${sn}: sagt muss Text-Liste sein`);
    }
  }
  const hatFunktion = (o) => o && typeof o === 'object' ? Object.values(o).some(hatFunktion) : typeof o === 'function';
  if (hatFunktion(daten)) f.push('daten enthalten Funktionen (nicht serialisierbar)');
  return f;
}

const passt = (muster, was) => typeof muster === 'string' && muster.endsWith('*') ? String(was).startsWith(muster.slice(0, -1)) : muster === was;

/** opts: daten = [], ereignisse = null (createEreignisse), zaehle = null ((dingId) => Anzahl), ortVon = null ((name) => {x,z}|null), punktVon = null ((punktId) => {x,z}|null, für Schritte mit punkt) */
export function createAufgaben({ daten = [], ereignisse = null, zaehle = null, ortVon = null, punktVon = null } = {}) {
  const fehler = pruefeDaten(daten);
  if (fehler.length) throw new Error('Aufgaben-Daten ungültig: ' + fehler[0]);
  const byId = new Map(daten.map((a) => [a.id, a]));
  let aktiv = new Map();      // id -> { schritt, wert, zeit }
  let erledigt = new Set();
  let hoerer = [];
  let ausgabe = null;

  const senden = (name, d) => { ausgabe?.push({ typ: name, ...d }); ereignisse?.sende(name, d); };
  const geaendert = () => { for (const fn of [...hoerer]) fn(); };
  const schritt = (id) => byId.get(id).schritte[aktiv.get(id).schritt];
  const ziel = (s) => (s.art === 'warte' ? s.dauer : (s.anzahl ?? 1));
  const ortVonSchritt = (s) => (s.punkt && punktVon?.(s.punkt)) || (s.ort == null ? null : typeof s.ort === 'string' ? (ortVon?.(s.ort) ?? null) : s.ort);

  function betrete(id) {
    const a = byId.get(id), z = aktiv.get(id), s = a.schritte[z.schritt];
    senden('aufgabe:schritt', { aufgabe: id, schritt: s.id, index: z.schritt });
    if (s.signal) senden('aufgabe:signal', { aufgabe: id, schritt: s.id, name: s.signal });
  }
  function schrittFertig(id) {
    const a = byId.get(id), z = aktiv.get(id), s = a.schritte[z.schritt];
    senden('aufgabe:schritt-fertig', { aufgabe: id, schritt: s.id, index: z.schritt });
    if (s.signalEnde) senden('aufgabe:signal', { aufgabe: id, schritt: s.id, name: s.signalEnde });
    if (z.schritt + 1 < a.schritte.length) { z.schritt++; z.wert = 0; z.zeit = 0; betrete(id); return; }
    aktiv.delete(id); erledigt.add(id);
    senden('aufgabe:fertig', { aufgabe: id, belohnung: a.belohnung ?? null });
    if (a.danach) starte(a.danach);
  }
  function fortschritt(id, wert) {
    const z = aktiv.get(id), s = schritt(id), neu = Math.min(wert, ziel(s));
    if (neu <= z.wert) return;
    z.wert = neu;
    senden('aufgabe:fortschritt', { aufgabe: id, schritt: s.id, index: z.schritt, wert: neu, ziel: ziel(s) });
    if (neu >= ziel(s)) schrittFertig(id);
  }

  function starte(id) {
    if (!byId.has(id) || aktiv.has(id) || erledigt.has(id)) return false;
    aktiv.set(id, { schritt: 0, wert: 0, zeit: 0 });
    senden('aufgabe:start', { aufgabe: id });
    betrete(id); geaendert();
    return true;
  }

  function melde(art, info = {}) {
    const n = info.anzahl ?? 1;
    let treffer = 0;
    for (const id of [...aktiv.keys()]) {
      const z = aktiv.get(id), s = schritt(id);
      let ok = false;
      if (art === 'gesprochen') ok = s.art === 'sprich-mit' && s.ziel === info.mit;
      else if (art === 'gesammelt') ok = s.art === 'sammle' && s.ding === info.id;
      else if (art === 'besiegt') ok = s.art === 'besiege' && s.ziel === info.art;
      else if (art === 'ereignis') ok = s.art === 'ereignis' && s.was === info.was;
      else if (art === 'benutzt') ok = s.art === 'benutze' && passt(s.was, info.was);
      if (!ok) continue;
      treffer++;
      fortschritt(id, z.wert + n);
    }
    if (treffer) geaendert();
    return treffer;
  }

  function update(dt, wer = null) {
    const aus = ausgabe = [];
    let neu = false;
    for (const id of [...aktiv.keys()]) {
      for (let g = 0; g < 32 && aktiv.has(id); g++) {
        const z = aktiv.get(id), s = schritt(id), index = z.schritt;
        const ort = ortVonSchritt(s);
        const drin = !ort ? s.art !== 'gehe-zu' : !!wer && Math.hypot(wer.x - ort.x, wer.z - ort.z) <= (s.radius ?? 3);
        if (s.art === 'gehe-zu') { if (drin) schrittFertig(id); }
        else if (s.art === 'warte') {
          if (drin) { z.zeit += dt; neu = true; if (z.zeit >= s.dauer) { z.zeit = s.dauer; schrittFertig(id); } }
        } else if (s.art === 'sammle' && zaehle) fortschritt(id, zaehle(s.ding) ?? 0);
        if (!aktiv.has(id) || aktiv.get(id).schritt === index) break;
      }
    }
    ausgabe = null;
    if (aus.length || neu) geaendert();
    return aus;
  }

  function aktuell(id) {
    id ??= aktiv.keys().next().value;
    const z = aktiv.get(id);
    if (!z) return null;
    const a = byId.get(id), s = a.schritte[z.schritt], zl = ziel(s);
    const wert = s.art === 'warte' ? z.zeit : z.wert;
    return { aufgabe: { id, name: a.name }, schritt: s, index: z.schritt, anzahl: a.schritte.length, wert, ziel: zl,
      anteil: Math.min(1, wert / zl), text: s.text, hinweis: s.hinweis ?? '', ort: ortVonSchritt(s) };
  }

  function springe(id, wohin) {
    const a = byId.get(id);
    if (!a) return;
    const index = typeof wohin === 'number' ? wohin : a.schritte.findIndex((s) => s.id === wohin);
    if (index < 0 || index >= a.schritte.length) return;
    const neu = !aktiv.has(id);
    erledigt.delete(id);
    aktiv.set(id, { schritt: index, wert: 0, zeit: 0 });
    if (neu) senden('aufgabe:start', { aufgabe: id });
    betrete(id); geaendert();
  }
  function brichAb(id) { if (aktiv.delete(id)) geaendert(); }

  const zustand = () => ({ v: 1, aktiv: Object.fromEntries([...aktiv].map(([id, z]) => [id, { ...z }])), fertig: [...erledigt] });
  function laden(z) {
    if (!z || z.v !== 1) return;
    aktiv = new Map(Object.entries(z.aktiv ?? {}).filter(([id, e]) => byId.has(id) && e.schritt >= 0 && e.schritt < byId.get(id).schritte.length)
      .map(([id, e]) => [id, { schritt: e.schritt, wert: e.wert ?? 0, zeit: e.zeit ?? 0 }]));
    erledigt = new Set((z.fertig ?? []).filter((id) => byId.has(id)));
    geaendert();
  }

  return {
    starte, melde, update, aktuell, springe, brichAb, zustand, laden,
    status: (id) => (erledigt.has(id) ? 'fertig' : aktiv.has(id) ? 'aktiv' : 'neu'),
    aktiv: () => [...aktiv.keys()],
    fertig: (id) => erledigt.has(id),
    onAenderung(fn) { hoerer.push(fn); return () => { hoerer = hoerer.filter((h) => h !== fn); }; },
    dispose() { aktiv.clear(); erledigt.clear(); hoerer = []; },
  };
}
