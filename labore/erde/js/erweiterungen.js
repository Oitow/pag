// Erweiterungen: Spiel-Module, die sich ins Erde-Labor einklinken (Überleben, Bauen, Tiere, Herstellen …).
// planet.js baut das Objekt `welt` und ruft createErweiterungen(welt, stand) einmal auf.
//
// Vertrag für ein Modul (Datei labore/erde/js/<name>.js, Fabrik createX(welt) → Objekt):
//   name                       eindeutiger Kurzname (Schlüssel im Spielstand)
//   update(dt)                 je Bild (dt in echten Sekunden; Spielzeit: welt.zw.uhr, Zeitraffer welt.zw.tempo)
//   aktion?(was, ziel)         Knopf gedrückt ('nehmen' | 'graben' | 'bauen' | eigener Knopf-Name);
//                              → { ok, text } wenn das Modul die Aktion übernimmt, sonst null (dann das nächste Modul / Standard)
//   hud?()                     → eine kurze Textzeile fürs HUD (oder '')
//   zustand?() / lade?(z)      Spielstand (JSON); lade wird gleich nach dem Erzeugen aufgerufen, falls etwas gespeichert ist
//   dispose()
// Module reden nur über welt.dienste miteinander (alle Aufrufe optional: welt.dienste.bau?.waermeBei?.(p) ?? 0).
// Siehe docs/plaene/ERDE-UEBERLEBEN.md für Dienste, Gegenstände und Aufgabenteilung.
//
// `welt` (von planet.js):
//   THREE, scene, R (Radius m), seed
//   anker        THREE.Group, wird jedes Bild auf −cam gesetzt: Kinder mit ABSOLUTEN Planetenkoordinaten (m) hineinhängen
//   cam, oben, vorn, blick   THREE.Vector3 (nur lesen): Augenpunkt absolut, Ortsnormale, Blick waagerecht, Blickstrahl
//   planet       probe(x,y,z,s) → { h, wasser, … } und oberflaeche(x,y,z,s) → m über R (x,y,z = Einheitsrichtung)
//   bodenPunkt(dir, out?)       → absoluter Punkt auf Boden/Wasser in Richtung dir; bodenHoehe(dir) → m über R
//   spieler()    → { gehen, schwimmt, amBoden, fallV }
//   inventar (engine/gameplay/inventar), zw (Uhr, Wetter, tJetzt °C), natur, eingriffe
//   melde(text, gut), knopf(id, text, onklick) → Element in der Aktionsleiste, speichern()
//   dienste      {} – gemeinsames Brett der Module

import { createUeberleben } from './ueberleben.js';
import { createBauen } from './bauen.js';
import { createTiere } from './tiere.js';
import { createHerstellen } from './herstellen.js';

// Reihenfolge = Reihenfolge bei aktion(): wer zuerst kommt, darf zuerst übernehmen
const LISTE = [createTiere, createBauen, createHerstellen, createUeberleben];

export function createErweiterungen(welt, stand = {}) {
  const module = [];
  for (const fabrik of LISTE) {
    try {
      const m = fabrik(welt);
      if (stand?.[m.name] && m.lade) m.lade(stand[m.name]);
      module.push(m);
    } catch (e) { console.warn('Erweiterung fehlgeschlagen:', fabrik.name, e); }
  }
  return {
    module,
    update(dt) { for (const m of module) m.update(dt); },
    aktion(was, ziel) { for (const m of module) { const r = m.aktion?.(was, ziel); if (r) return r; } return null; },
    hud() { return module.map((m) => m.hud?.() || '').filter(Boolean); },
    zustand() { const z = {}; for (const m of module) if (m.zustand) z[m.name] = m.zustand(); return z; },
    dispose() { for (const m of module) m.dispose(); },
  };
}
