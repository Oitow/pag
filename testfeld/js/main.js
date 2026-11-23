// Testfeld – alle Erlenwacht-Module zusammen, auch unfertige (Stufe 'testfeld' und 'spiel' aus engine/spiel/module-register.js).
// Kein Titel, kein Spielstand: sofort in der Welt. Hier wird zusammengeführt, bevor ein Modul ins echte Spiel (erlenwacht/) darf.
// URL: ?nur=kampf (ein Modul + was es braucht) · ?labor=1 (auch Module auf Stufe 'labor') · ?klasse=magier · ?ort=<id> · ?aus=… · ?test=1 · ?debug
import { createSpiel, leseUrl } from '../../engine/spiel/spiel.js';
import { moduleFuer, MODUL_INFO } from '../../engine/spiel/module.js';
import { MODUL_REGISTER, registerEintrag } from '../../engine/spiel/module-register.js';

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
const nur = url.werte.nur || null;
const stufe = url.werte.labor ? 'labor' : 'testfeld';
const klasse = ['krieger', 'waldlaeufer', 'magier'].includes(url.werte.klasse) ? url.werte.klasse : 'krieger';
const MODULE = moduleFuer({ stufe, nur });

const spiel = await createSpiel({
  canvas: $('c'), module: MODULE, seed: 1207, fehler: zeigeFehler,
  optionen: {
    spieler: { name: 'Tester' },
    fortschritt: { name: 'Tester', klasse },
    kampf: { klasse },
    entitaeten: { zielRahmen: false },
    oberflaeche: { name: 'Tester', pause: (an) => spiel?.pause(an), entwickler: { module: MODULE.map((m) => m.name), info: MODUL_INFO } },
  },
});
globalThis.spiel = spiel;                       // für Tests/Konsole
const { kern } = spiel;
const welt = kern.api('welt'), spieler = kern.api('spieler');
kern.ereignisse.an('modul:fehler', (d) => zeigeFehler(d.fehler, d.name));
spiel.renderer.domElement.addEventListener('webglcontextlost', () => zeigeFehler('WebGL-Kontext verloren'));

const sprung = (id) => { const o = welt?.ort?.(id); if (o && spieler?.teleport) spieler.teleport(o.x, o.z, o.blick); return !!o; };
if (url.ort && !sprung(url.ort)) zeigeFehler(`unbekannter Ort „${url.ort}“ – bekannt: ${(welt?.orte || []).map((o) => o.id).join(', ')}`);
$('lade').hidden = true;

// Testfeld-Leiste: zeigt, was läuft; aufgeklappt Modul wählen, Ort springen
const leiste = $('testfeld');
const laufend = MODULE.map((m) => m.name);
const neueUrl = (aenderung) => {
  const u = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(aenderung)) { if (v) u.set(k, v); else u.delete(k); }
  location.search = u.toString();
};
function zeichneLeiste(offen) {
  leiste.toggleAttribute('data-offen', offen);
  const kopf = `🧪 <b>Testfeld</b> · ${nur ? 'nur ' + nur : stufe === 'labor' ? 'alle Module' : 'Testfeld + Spiel'} · ${laufend.length} Module ${offen ? '▴' : '▾'}`;
  if (!offen) { leiste.innerHTML = kopf; return; }
  const zeilen = MODUL_REGISTER.map((e) => `${laufend.includes(e.name) ? '✅' : '▫️'} ${e.titel} <small>(${e.stufe})</small>`);
  const wahl = ['<option value="">alle (Testfeld)</option>', ...MODUL_REGISTER.map((e) => `<option value="${e.name}"${nur === e.name ? ' selected' : ''}>nur ${e.titel}</option>`)].join('');
  const orte = ['<option value="">Ort springen …</option>', ...(welt?.orte || []).map((o) => `<option value="${o.id}">${o.name || o.id}</option>`)].join('');
  leiste.innerHTML = `${kopf}<div>${zeilen.join('<br>')}</div><label><select data-wahl="nur">${wahl}</select></label><label><select data-wahl="ort">${orte}</select></label>`;
  leiste.querySelector('[data-wahl="nur"]').addEventListener('change', (e) => neueUrl({ nur: e.target.value }));
  leiste.querySelector('[data-wahl="ort"]').addEventListener('change', (e) => { if (e.target.value) sprung(e.target.value); });
}
let offen = false;
leiste.addEventListener('click', (e) => { if (e.target.closest('select')) return; offen = !offen; zeichneLeiste(offen); });
zeichneLeiste(false);
if (nur && !registerEintrag(nur.split(',')[0])) zeigeFehler(`unbekanntes Modul „${nur}“`);

// Info-Zeile: Region · Uhrzeit · Bildrate
const info = $('info');
let letzteInfo = '';
setInterval(() => {
  const p = spieler?.position;
  const r = p && welt?.region ? welt.region(p.x, p.z) : null;
  const h = kern.api('himmel')?.uhr;
  const ri = spiel.renderer.info.render;
  const t = `${r?.name || '–'}${h ? ' · ' + String(Math.floor(h.stunde)).padStart(2, '0') + ':' + String(Math.floor((h.stunde % 1) * 60)).padStart(2, '0') : ''}`
    + ` · ${spiel.fps.toFixed(0)} fps · ${ri.calls} Calls · ${(ri.triangles / 1000).toFixed(0)} k △`;
  if (t !== letzteInfo) { letzteInfo = t; info.textContent = t; }
}, 500);
