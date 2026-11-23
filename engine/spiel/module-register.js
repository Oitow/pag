/**
 * @modul    module-register
 * @zweck    Modul-Register: welche Spiel-Module es gibt, wo jedes steht (labor → testfeld → spiel), wer welche Engine-Bausteine pflegt; wählt die Module für das echte Spiel, das Testfeld oder ein einzelnes Modul samt Abhängigkeiten
 * @api      STUFEN ; MODUL_REGISTER ; registerEintrag(name) ; namenFuerStufe(stufe) -> [name] ; mitAbhaengigkeiten(namen, brauchtVon) -> [name] ; waehle({stufe, nur, brauchtVon}) -> [name] ; pruefeRegister(brauchtVon) -> [fehler]
 * @beispiel
 *   import { waehle } from '../../engine/spiel/module-register.js';
 *   waehle({ stufe: 'spiel' });                                   // nur fertige Module (das echte Spiel)
 *   waehle({ stufe: 'testfeld' });                                // fertige + Module im Testfeld
 *   waehle({ nur: ['kampf'], brauchtVon: (n) => MODULE[n].braucht }); // ein Modul + alles, was es zwingend braucht
 * @tags     spiel, modul, register, stufe, testfeld, labor, agent, zustaendigkeit
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Stufen (aufsteigend): 'labor' = nur einzeln testbar (testfeld/?nur=<name>) · 'testfeld' = im gemeinsamen Testfeld ·
 * 'spiel' = im echten Spiel Erlenwacht. Ein Modul steigt nur auf, wenn alle Module, die es `braucht`, mindestens gleich weit sind.
 * Das Register ist reine Daten: die Modul-Objekte selbst steckt engine/spiel/module.js zusammen.
 * bausteine = Engine-Ordner/-Dateien, für die die KI an diesem Modul zuständig ist (andere fasst sie nicht an, siehe AGENTS.md).
 */

export const STUFEN = Object.freeze(['labor', 'testfeld', 'spiel']);

export const MODUL_REGISTER = Object.freeze([
  { name: 'welt', titel: '🗺 Welt (Gelände, Regionen, Wege)', stufe: 'spiel', labor: 'labore/welt',
    bausteine: ['engine/world/', 'engine/spiel/modul-welt.js'] },
  { name: 'himmel', titel: '☀️ Himmel (Tag/Nacht, Wetter)', stufe: 'spiel', labor: 'labore/handwerk',
    bausteine: ['engine/world/himmel.js', 'engine/world/himmel-stand.js', 'engine/world/wetter.js', 'engine/render/niederschlag.js', 'engine/core/zeit.js', 'engine/spiel/modul-himmel.js'] },
  { name: 'riesenwald', titel: '🌲 Dämmerwald-Riesen', stufe: 'spiel', labor: 'labore/daemmerwald',
    bausteine: ['engine/models/natur/', 'engine/render/laub-karten.js', 'engine/render/natur-material.js', 'engine/world/riesenwald-plan.js', 'engine/spiel/modul-riesenwald.js', 'engine/spiel/riesenwald-teile.js'] },
  { name: 'dorf', titel: '🏘 Startdorf Erlenwacht (Häuser, Licht, Treffpunkt)', stufe: 'spiel', labor: null,
    bausteine: ['engine/world/dorf-plan*.js', 'engine/models/bau/dorf-teile.js', 'engine/render/bau-instanzen.js', 'engine/render/licht-pool.js', 'engine/spiel/modul-dorf.js'] },
  { name: 'entitaeten', titel: '🆔 Entitäten (IDs, Leben, Befehle)', stufe: 'spiel', labor: null,
    bausteine: ['engine/core/entitaeten.js', 'engine/gameplay/befehle.js', 'engine/spiel/modul-entitaeten.js'] },
  { name: 'spieler', titel: '🧍 Spielfigur', stufe: 'spiel', labor: 'labore/figuren',
    bausteine: ['engine/models/character/', 'engine/gameplay/character*.js', 'engine/gameplay/ausdauer.js', 'engine/gameplay/klettern.js', 'engine/input/', 'engine/camera/', 'engine/spiel/modul-spieler.js'] },
  { name: 'bewohner', titel: '🏘 Bewohner', stufe: 'spiel', labor: 'labore/enklave',
    bausteine: ['engine/gameplay/character-brain.js', 'engine/spiel/modul-bewohner.js'] },
  { name: 'gegner', titel: '🐀 Gegner + Boss', stufe: 'spiel', labor: 'labore/figuren',
    bausteine: ['engine/models/kreaturen/', 'engine/gameplay/gegner-lager.js', 'engine/gameplay/horde.js', 'engine/gameplay/boss.js', 'engine/render/horde-mesh.js', 'engine/spiel/modul-gegner.js'] },
  { name: 'zauber', titel: '✨ Zauber', stufe: 'spiel', labor: 'labore/figuren',
    bausteine: ['engine/gameplay/zauber*.js', 'engine/gameplay/grosszauber*.js', 'engine/gameplay/element-reaktionen.js', 'engine/render/zauber-effekte.js', 'engine/render/grosszauber*.js', 'engine/ui/zauber-leiste.js', 'engine/spiel/modul-zauber.js', 'engine/spiel/zauber-*.js'] },
  { name: 'fortschritt', titel: '⭐ Stufen, Beute, Talente', stufe: 'spiel', labor: null,
    bausteine: ['engine/gameplay/progression.js', 'engine/gameplay/beute.js', 'engine/gameplay/gegenstaende-daten.js', 'engine/gameplay/inventar.js', 'engine/spiel/modul-fortschritt.js'] },
  { name: 'kampf', titel: '⚔ Nahkampf + Fähigkeiten', stufe: 'spiel', labor: 'labore/figuren',
    bausteine: ['engine/gameplay/nahkampf*.js', 'engine/gameplay/faehigkeiten*.js', 'engine/gameplay/klassen-daten.js', 'engine/gameplay/kampf*.js', 'engine/ui/kampf-leiste.js', 'engine/spiel/modul-kampf.js'] },
  { name: 'tutorial', titel: '📜 Tutorial + Aufgaben', stufe: 'spiel', labor: null,
    bausteine: ['engine/gameplay/aufgaben.js', 'engine/gameplay/interaktion.js', 'engine/ui/aufgaben-anzeige.js', 'engine/spiel/modul-tutorial.js', 'engine/spiel/tutorial-daten.js'] },
  { name: 'oberflaeche', titel: '🖥 Menü, Chat, HUD', stufe: 'spiel', labor: null,
    bausteine: ['engine/ui/chat.js', 'engine/ui/menue.js', 'engine/ui/hud.js', 'engine/ui/minikarte.js', 'engine/ui/ziel-rahmen.js', 'engine/spiel/modul-oberflaeche.js', 'engine/spiel/oberflaeche-fenster.js'] },
]);

const RANG = Object.fromEntries(STUFEN.map((s, i) => [s, i]));
const NACH_NAME = new Map(MODUL_REGISTER.map((e) => [e.name, e]));

/** Eintrag zu einem Modulnamen oder null. */
export const registerEintrag = (name) => NACH_NAME.get(name) || null;

/** Alle Module, die mindestens auf dieser Stufe stehen (in Register-Reihenfolge). */
export function namenFuerStufe(stufe = 'spiel', register = MODUL_REGISTER) {
  if (!(stufe in RANG)) throw new Error(`module-register: unbekannte Stufe „${stufe}“ – erlaubt: ${STUFEN.join(', ')}`);
  return register.filter((e) => RANG[e.stufe] >= RANG[stufe]).map((e) => e.name);
}

/** Namen + alles, was sie (transitiv) zwingend brauchen. 'render' liefert der Host selbst und fällt weg. */
export function mitAbhaengigkeiten(namen, brauchtVon = () => []) {
  const drin = new Set();
  const besuche = (n) => {
    if (n === 'render' || drin.has(n)) return;
    if (!NACH_NAME.has(n)) throw new Error(`module-register: unbekanntes Modul „${n}“`);
    drin.add(n);
    for (const b of brauchtVon(n) || []) besuche(b);
  };
  for (const n of namen) besuche(n);
  return MODUL_REGISTER.map((e) => e.name).filter((n) => drin.has(n));
}

/** Auswahl fürs Starten: nur=[…] → diese + Abhängigkeiten (egal welche Stufe), sonst alle ab stufe. */
export function waehle({ stufe = 'spiel', nur = null, brauchtVon = () => [] } = {}) {
  const liste = typeof nur === 'string' ? nur.split(',').map((s) => s.trim()).filter(Boolean) : nur;
  return liste?.length ? mitAbhaengigkeiten(liste, brauchtVon) : namenFuerStufe(stufe);
}

/** Prüft das Register gegen die echten Module. brauchtVon(name) -> [namen] oder undefined (Modul fehlt). Liefert Fehlertexte. */
export function pruefeRegister(brauchtVon, register = MODUL_REGISTER) {
  const fehler = [];
  const namen = new Set();
  for (const e of register) {
    if (namen.has(e.name)) fehler.push(`${e.name}: doppelt im Register`);
    namen.add(e.name);
    if (!(e.stufe in RANG)) fehler.push(`${e.name}: unbekannte Stufe „${e.stufe}“`);
    if (!e.titel) fehler.push(`${e.name}: titel fehlt`);
    const braucht = brauchtVon(e.name);
    if (braucht === undefined) { fehler.push(`${e.name}: kein Modul-Objekt dazu`); continue; }
    for (const b of braucht) {
      if (b === 'render') continue;
      const d = register.find((x) => x.name === b);
      if (!d) fehler.push(`${e.name}: braucht „${b}“, das nicht im Register steht`);
      else if (RANG[d.stufe] < RANG[e.stufe]) fehler.push(`${e.name} (${e.stufe}) braucht „${b}“, das erst auf Stufe ${d.stufe} ist`);
    }
  }
  return fehler;
}
