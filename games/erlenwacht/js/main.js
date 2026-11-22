// Erlenwacht – die vereinte Testwelt fürs MMO. Nur Verdrahtung: die ganze Engine steckt in engine/spiel/spiel.js,
// alles Weitere sind Module (engine/spiel/modul-*.js, Vertrag: docs/ERLENWACHT-MODULE.md).
// URL: ?ort=<id> (Sprungmarke) · ?aus=zauber,gegner (Module abschalten) · ?test=1 (ohne Intro, Uhr steht) · ?q=niedrig|mittel|hoch
//      · ?seed=7 · ?zeit=18 (Stunde) · ?debug
import { createSpiel } from '../../../engine/spiel/spiel.js';
import { MODULE, MODUL_INFO } from './module-liste.js';

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

const spiel = await createSpiel({ canvas: $('c'), module: MODULE, seed: 1207, fehler: zeigeFehler });
globalThis.spiel = spiel;                       // für Tests/Konsole
const { kern } = spiel;
const welt = kern.api('welt'), spieler = kern.api('spieler');

// Sprungmarke ?ort=
const sprung = (id) => { const o = welt?.ort?.(id); if (o && spieler?.teleport) spieler.teleport(o.x, o.z, o.blick); return !!o; };
if (spiel.url.ort && !sprung(spiel.url.ort)) zeigeFehler(`unbekannter Ort „${spiel.url.ort}“ – bekannt: ${(welt?.orte || []).map((o) => o.id).join(', ')}`);
$('lade').hidden = true;

// Menü: Orte + Module an/aus (neu laden mit ?aus=)
const menue = $('menue');
$('menueKnopf').addEventListener('click', () => { menue.hidden = !menue.hidden; spiel.pause(!menue.hidden && !spiel.test); });
for (const o of welt?.orte || []) {
  const b = document.createElement('button'); b.textContent = o.name;
  b.addEventListener('click', () => { sprung(o.id); menue.hidden = true; spiel.pause(false); });
  $('orte').appendChild(b);
}
const aus = new Set(spiel.url.aus);
for (const m of MODULE) {
  const l = document.createElement('label');
  const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !aus.has(m.name);
  c.addEventListener('change', () => { if (c.checked) aus.delete(m.name); else aus.add(m.name); });
  const grund = kern.uebersprungen[m.name];
  l.append(c, `${MODUL_INFO[m.name] || m.name}${grund ? ' – ' + grund : ''}`);
  $('modulListe').appendChild(l);
}
$('neuLaden').addEventListener('click', () => {
  const u = new URLSearchParams(location.search);
  if (aus.size) u.set('aus', [...aus].join(',')); else u.delete('aus');
  location.search = u.toString();
});

// Info-Zeile: Region, Ort, Bildrate
let infoUhr = 0;
kern.ereignisse.an('modul:fehler', (d) => zeigeFehler(d.fehler, d.name));
spiel.renderer.domElement.addEventListener('webglcontextlost', () => zeigeFehler('WebGL-Kontext verloren'));
const info = $('info');
(function infoTakt() {
  requestAnimationFrame(infoTakt);
  if ((infoUhr = (infoUhr + 1) % 15)) return;
  const p = spieler?.position;
  const r = p && welt?.region ? welt.region(p.x, p.z) : null;
  const h = kern.api('himmel')?.uhr;
  const ri = spiel.renderer.info.render;
  info.innerHTML = `<b>${r?.name || '–'}</b>${h ? ' · ' + String(Math.floor(h.stunde)).padStart(2, '0') + ':' + String(Math.floor((h.stunde % 1) * 60)).padStart(2, '0') : ''}`
    + ` · ${spiel.fps.toFixed(0)} fps` + (spiel.url.debug ? ` · ${ri.calls} Calls · ${(ri.triangles / 1000).toFixed(0)} k △ · ${p ? `${p.x.toFixed(0)}/${p.z.toFixed(0)}` : ''}` : '');
})();
