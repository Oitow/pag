// Viniland – Spieler-Optionen (RPG besitzt die Datei, alle anderen Module LESEN nur).
// OPTIONS ist ein einfaches, mutierbares Objekt: input/controller/camera/fighter/audio lesen es live pro Frame.
// Gespeichert in localStorage ('viniland.options'), Fehler (Privatmodus, file://) werden ignoriert.

export const OPTION_DEFAULTS = {
  sprintToggle: false,   // true = Sprint-Taste schaltet um, false = halten
  autoRun: false,        // Auto-Laufen (Taste/Option: läuft weiter geradeaus, bis Stick zurück)
  invertX: false,        // Kamera horizontal invertieren
  invertY: false,        // Kamera vertikal invertieren
  camSens: 1,            // Empfindlichkeit Maus/Tastatur-Kamera (0.2..3)
  padSens: 1,            // Empfindlichkeit Gamepad-Kamera (0.2..3)
  lockToggle: true,      // true = Lock-On umschalten, false = halten
  autoAlign: true,       // Kamera richtet sich automatisch hinter der Figur aus
  damageNumbers: true,   // Schadenszahlen anzeigen
  screenShake: 1,        // Kamera-Shake-Stärke (0..2)
  rumble: true,          // Gamepad-Vibration
  autoPickup: false,     // Loot automatisch aufheben (sonst per Interagieren)
  hudScale: 1,           // HUD-Größe (0.7..1.5)
  musicVol: 0.6,         // Musik-Lautstärke 0..1
  sfxVol: 0.8,           // Effekt-Lautstärke 0..1
  showHitboxes: false,   // Debug: Hitboxen zeigen
};

export const OPTIONS = { ...OPTION_DEFAULTS };

/** Beschreibung für das Menü (ui.js / main.js): [key, typ, label, min, max, step] */
export const OPTION_DEFS = [
  ['sprintToggle', 'bool', 'Sprint', 0, 0, 0, ['Halten', 'Umschalten']],
  ['autoRun', 'bool', 'Auto-Laufen'],
  ['invertX', 'bool', 'Kamera invertieren X'],
  ['invertY', 'bool', 'Kamera invertieren Y'],
  ['camSens', 'num', 'Empfindlichkeit Maus', 0.2, 3, 0.05],
  ['padSens', 'num', 'Empfindlichkeit Pad', 0.2, 3, 0.05],
  ['lockToggle', 'bool', 'Lock-On', 0, 0, 0, ['Halten', 'Umschalten']],
  ['autoAlign', 'bool', 'Auto-Ausrichtung Kamera'],
  ['damageNumbers', 'bool', 'Schadenszahlen'],
  ['screenShake', 'num', 'Kamera-Shake', 0, 2, 0.05],
  ['rumble', 'bool', 'Vibration'],
  ['autoPickup', 'bool', 'Auto-Aufheben'],
  ['hudScale', 'num', 'HUD-Größe', 0.7, 1.5, 0.05],
  ['musicVol', 'num', 'Musik-Lautstärke', 0, 1, 0.05],
  ['sfxVol', 'num', 'Effekt-Lautstärke', 0, 1, 0.05],
  ['showHitboxes', 'bool', 'Hitboxen zeigen'],
];

const KEY = 'viniland.options';
const listeners = new Set();

export function loadOptions() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (const k in OPTION_DEFAULTS) if (k in s && typeof s[k] === typeof OPTION_DEFAULTS[k]) OPTIONS[k] = s[k];
  } catch (e) { /* ok */ }
  return OPTIONS;
}
export function saveOptions() {
  try { localStorage.setItem(KEY, JSON.stringify(OPTIONS)); } catch (e) { /* ok */ }
  for (const f of listeners) { try { f(OPTIONS); } catch (e) { console.error(e); } }
}
export function resetOptions() { Object.assign(OPTIONS, OPTION_DEFAULTS); saveOptions(); }
/** Wird nach jedem saveOptions() aufgerufen (z. B. Audio-Lautstärke, Hitboxen). */
export function onOptionsChange(f) { listeners.add(f); return () => listeners.delete(f); }
/** Setzt einen Wert mit Typ-/Bereichsprüfung und speichert. */
export function setOption(k, v) {
  const def = OPTION_DEFS.find(d => d[0] === k);
  if (!def) return;
  if (def[1] === 'bool') OPTIONS[k] = !!v;
  else OPTIONS[k] = Math.round(Math.min(def[4], Math.max(def[3], +v)) / def[5]) * def[5];
  saveOptions();
}

loadOptions();
