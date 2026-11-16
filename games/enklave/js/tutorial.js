// Enklave – Tutorial „Erste Schritte“: gameplay/aufgaben (Daten: tutorial-daten.js) + ui/aufgaben-anzeige. Hier steckt nur die Verdrahtung:
// Signale → Ratten spawnen, Großzauber freischalten, Kamerafahrt zur Aussicht, Tor öffnen, Banner „Willkommen in der Enklave“.
// Fortschritt wird im Speicher (localStorage) abgelegt; ?schritt=<Nr|id> springt direkt zu einem Schritt.
import { createAufgaben } from '../../../engine/gameplay/aufgaben.js';
import { createAufgabenAnzeige } from '../../../engine/ui/aufgaben-anzeige.js';
import { createEreignisse } from '../../../engine/core/ereignisse.js';
import { TUTORIAL } from './tutorial-daten.js';

const ID = 'tutorial';

/** opts: { w (baueWelt), npcs, dinge, kampf, stadt, spieler (figur.js), speicher, neu (gespeicherten Stand ignorieren) } → { aufgaben, anzeige, update(dt), onAnsprechen(npc) -> [text]|null, melde(art, info), springe(n), ortVor(n), dispose() } */
export function createTutorial({ w, npcs, dinge, kampf, stadt, spieler, speicher, neu = false }) {
  const { plan, adapter } = w;
  const ereignisse = createEreignisse();
  const ortVon = (n) => { const o = (plan.platz(n) ?? (() => { try { return plan.zone(n); } catch { return null; } })()); return o ? { x: o.x, z: o.z } : null; };
  const aufgaben = createAufgaben({ daten: TUTORIAL, ereignisse, zaehle: (id) => dinge.inventar.zaehle(id), ortVon });
  const anzeige = createAufgabenAnzeige({ oben: 62 })   // unter den HUD-Balken (Leben/Mana);
  const schritte = TUTORIAL[0].schritte;
  const nr = (id) => schritte.findIndex((s) => s.id === id);
  const pos = () => spieler.position;
  const ab = [];

  /** Zustand zum aktuellen Schritt herstellen (nach Laden/Springen): Alwine folgt, Großzauber frei, Tor, Ratten. */
  function wendeAn() {
    const a = aufgaben.aktuell(ID), fertig = aufgaben.fertig(ID), i = fertig ? schritte.length : (a?.index ?? 0);
    npcs.mentorFolgt(i >= 1 && !fertig);
    kampf.setGrossFrei(i >= nr('flutwelle'));
    if (fertig) stadt.oeffneTor(null);
    if (a?.schritt.signal?.startsWith('ratten')) kampf.spawneRatten(Math.max(0, a.ziel - a.wert));
    if (i > nr('welle-ratten')) kampf.leereHorde();
    anzeige.setze(a);
  }

  function signal(name) {
    if (name === 'ratten-klein') kampf.spawneRatten(6);
    else if (name === 'ratten-welle') { kampf.setGrossFrei(true); kampf.spawneRatten(12); dinge.hud.melde('Großzauber frei: G / 🌊', { art: 'gut' }); }
    else if (name === 'kamera-aussicht') {
      const p = pos(), th = plan.platz('mauer-torhaus');
      spieler.kamera.fahrt({ pos: { x: p.x, y: p.y + 7, z: p.z }, blick: { x: th.x, y: adapter.bodenHoehe(th.x, th.z) + 6, z: th.z }, dauer: 2, halten: 1.4 });
    } else if (name === 'tor-auf') {
      kampf.leereHorde();
      stadt.oeffneTor({ x: pos().x, z: pos().z });
      npcs.sprich('wache0', ['Alwine! Und du musst die Neue sein. Tretet ein!']);
    }
  }

  ab.push(ereignisse.an('aufgabe:schritt', ({ index }) => {
    const s = schritte[index], a = aufgaben.aktuell(ID);
    anzeige.setze(a);
    if (s.art !== 'sprich-mit' && s.sagt) npcs.sprich('mentor', s.sagt);   // bei Gesprächs-Schritten spricht der Angesprochene (onAnsprechen)
  }));
  ab.push(ereignisse.an('aufgabe:fortschritt', () => anzeige.setze(aufgaben.aktuell(ID))));
  ab.push(ereignisse.an('aufgabe:schritt-fertig', () => anzeige.blitz('Geschafft!', { dauer: 1.2 })));
  ab.push(ereignisse.an('aufgabe:signal', ({ name }) => signal(name)));
  ab.push(ereignisse.an('aufgabe:fertig', ({ belohnung }) => {
    anzeige.setze(null);
    anzeige.blitz('Willkommen in der Enklave', { gross: true, dauer: 5 });
    for (const g of belohnung?.gegenstaende ?? []) dinge.gib(g.id, g.anzahl);
    if (belohnung?.text) npcs.sprich('mentor', [belohnung.text]);
    npcs.mentorFolgt(false);
  }));
  const speichern = () => speicher.speichere('tutorial', aufgaben.zustand());
  ab.push(aufgaben.onAenderung(speichern));
  ab.push(dinge.ereignisse.an('rucksack:auf', () => aufgaben.melde('benutzt', { was: 'inventar' })));

  const alt = speicher.lade('tutorial');
  if (!neu && alt?.v === 1 && (alt.fertig?.length || Object.keys(alt.aktiv ?? {}).length)) aufgaben.laden(alt); else aufgaben.starte(ID);
  wendeAn();

  return {
    aufgaben, anzeige,
    get fertig() { return aufgaben.fertig(ID); },
    melde: (art, info) => aufgaben.melde(art, info),
    /** Spieler spricht NPC an: zählt für „sprich-mit“, liefert die Zeilen des Schritts (oder null → Standardspruch). */
    onAnsprechen(npc) {
      const a = aufgaben.aktuell(ID), s = a?.schritt;
      if (s?.art === 'sprich-mit' && s.ziel === npc.id) { aufgaben.melde('gesprochen', { mit: npc.id }); return s.sagt ?? null; }
      return null;
    },
    /** Zu Schritt n (Nr. oder id) springen. */
    springe(n) { aufgaben.springe(ID, typeof n === 'number' ? n : n); wendeAn(); },
    /** Position kurz vor Schritt n (Ort des letzten vorherigen Schritts mit Ort) – zum Teleportieren. */
    ortVor(n) {
      const i = typeof n === 'number' ? n : nr(n);
      for (let k = i - 1; k >= 0; k--) { const o = typeof schritte[k].ort === 'string' ? ortVon(schritte[k].ort) : schritte[k].ort; if (o) return o; }
      return null;
    },
    update(dt) {
      aufgaben.update(dt, pos());
      const info = aufgaben.aktuell(ID), o = info?.ort;
      anzeige.ziel(o ? { x: o.x, y: adapter.bodenHoehe(o.x, o.z) + 1.8, z: o.z } : null);
      anzeige.update(spieler.kamera.kamera, dt, pos());
    },
    dispose() { for (const f of ab) f(); aufgaben.dispose(); anzeige.dispose(); ereignisse.dispose?.(); },
  };
}
