// Erlenwacht – das echte Spiel. Verdrahtung: Titel → Held erstellen → createSpiel → Autospeichern.
// Module: nur die mit Stufe 'spiel' aus engine/spiel/module-register.js (alle Module testen: testfeld/).
// Die ganze Engine steckt in engine/spiel/spiel.js, Oberfläche (HUD, Chat, Menü) in engine/spiel/modul-oberflaeche.js.
// URL: ?test=1 (ohne Titel, Standard-Held Krieger, Uhr steht) · ?ort=<id> · ?aus=zauber,gegner · ?q=niedrig|mittel|hoch · ?seed=7 · ?zeit=18 · ?debug
// Spielstand: core/speicher, Slot 'held' = { held:{name,klasse}, look, kern: kern.zustand() } – alle 30 s, beim Verlassen und im Menü.
import { createSpiel, leseUrl } from '../../engine/spiel/spiel.js';
import { createSpeicher } from '../../engine/core/speicher.js';
import { moduleFuer, MODUL_INFO } from '../../engine/spiel/module.js';

const MODULE = moduleFuer({ stufe: 'spiel' });

const $ = (id) => document.getElementById(id);
const fehlerListe = [];
const zeigeFehler = (e, wo = '') => {
  const t = `${wo ? '[' + wo + '] ' : ''}${e?.stack || e?.message || e}`;
  fehlerListe.push(t); console.error(t);
  const f = $('fehler'); f.hidden = false; f.textContent = 'Fehler:\n' + fehlerListe.slice(-4).join('\n\n');
};
addEventListener('error', (e) => zeigeFehler(e.error || e.message));
addEventListener('unhandledrejection', (e) => zeigeFehler(e.reason));
$('fehler').addEventListener('click', (e) => { e.currentTarget.hidden = true; });

const url = leseUrl(location.search);
const speicher = createSpeicher({ schluessel: 'erlenwacht', version: 1 });
const stand = (() => { try { return speicher.lade('held'); } catch (e) { zeigeFehler(e, 'speicher'); return null; } })();

// 1. Wer spielt? (?test=1 überspringt den Titel)
let wahl;
if (url.test) wahl = { art: 'neu', held: { name: 'Held', klasse: 'krieger' }, look: null };
else {
  $('lade').hidden = true;
  const { zeigeStart } = await import('./start.js');
  wahl = await zeigeStart({ stand });
  $('lade').hidden = false;
}
const fortsetzen = wahl.art === 'fortsetzen' && stand;
const held = fortsetzen ? stand.held : wahl.held;
const look = fortsetzen ? stand.look : wahl.look;

// 2. Spiel starten
let spiel = null;
const speichere = () => {
  if (!spiel) return false;
  try { speicher.speichere('held', { held, look, kern: spiel.kern.zustand() }); return true; } catch (e) { zeigeFehler(e, 'speichern'); return false; }
};
const aufgesetzt = { name: held.name };
spiel = await createSpiel({
  canvas: $('c'), module: MODULE, seed: 1207, fehler: zeigeFehler,
  optionen: {
    spieler: { look: look || undefined, name: held.name },
    fortschritt: { name: held.name, klasse: held.klasse },
    kampf: { klasse: held.klasse },
    entitaeten: { zielRahmen: false },
    oberflaeche: {
      name: aufgesetzt.name, pause: (an) => spiel?.pause(an), entwickler: { module: MODULE.map((m) => m.name), info: MODUL_INFO },
      speichern: speichere, hatStand: () => speicher.hat('held'),
      laden: () => { const s = speicher.lade('held'); if (!s?.kern) return false; spiel.kern.lade(s.kern); return true; },
      zumTitel: () => { speichere(); location.href = location.pathname; },
    },
  },
});
globalThis.spiel = spiel;                       // für Tests/Konsole
const { kern } = spiel;
const welt = kern.api('welt'), spieler = kern.api('spieler');

if (fortsetzen) { try { kern.lade(stand.kern); } catch (e) { zeigeFehler(e, 'laden'); } }

// Sprungmarke ?ort= (nicht beim Fortsetzen – da zählt der Spielstand)
const sprung = (id) => { const o = welt?.ort?.(id); if (o && spieler?.teleport) spieler.teleport(o.x, o.z, o.blick); return !!o; };
if (spiel.url.ort && !fortsetzen && !sprung(spiel.url.ort)) zeigeFehler(`unbekannter Ort „${spiel.url.ort}“ – bekannt: ${(welt?.orte || []).map((o) => o.id).join(', ')}`);
$('lade').hidden = true;

// Autospeichern
if (!spiel.test) {
  setInterval(speichere, 30000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') speichere(); });
  addEventListener('pagehide', speichere);
}

// Info-Zeile (oben, schmal): Region · Uhrzeit · Bildrate
kern.ereignisse.an('modul:fehler', (d) => zeigeFehler(d.fehler, d.name));
spiel.renderer.domElement.addEventListener('webglcontextlost', () => zeigeFehler('WebGL-Kontext verloren'));
const info = $('info');
let letzteInfo = '';
setInterval(() => {
  const p = spieler?.position;
  const r = p && welt?.region ? welt.region(p.x, p.z) : null;
  const h = kern.api('himmel')?.uhr;
  const ri = spiel.renderer.info.render;
  const t = `${r?.name || '–'}${h ? ' · ' + String(Math.floor(h.stunde)).padStart(2, '0') + ':' + String(Math.floor((h.stunde % 1) * 60)).padStart(2, '0') : ''}`
    + (spiel.url.debug ? ` · ${spiel.fps.toFixed(0)} fps · ${ri.calls} Calls · ${(ri.triangles / 1000).toFixed(0)} k △` : '');
  if (t !== letzteInfo) { letzteInfo = t; info.textContent = t; }
}, 500);
