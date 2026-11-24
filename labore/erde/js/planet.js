// Erde-Labor: erfundener Planet mit Detailstufen, nahtlos vom Orbit bis zum Boden – und zu Fuß begehbar.
// Würfel-Kugel + Quadtree-Kacheln (planet-baum), Geologie/Klima/Gestein einmal beim Start (geologie),
// Höhe/Farbe je Punkt (planet-hoehe), Natur aus dem Naturfundus (natur-streu → natur),
// Kachelbau + Streuung im Worker (kachel-worker, Rückfall: Hauptthread), Kamera bleibt im Ursprung (Floating Origin).
import * as THREE from 'three';
import { createPlanetHoehe } from './planet-hoehe.js';
import { berechneGeologie, GESTEIN_NAME, GESTEIN_FARBE } from './geologie.js';
import { biom, BIOM_NAME, tempAm, waldDichte, bodenFarbe } from './klima.js';
import { streuKacheln, streueKachel, streuStufe } from './natur-streu.js';
import { createNatur } from './natur.js';
import { createEingriffe } from './eingriffe.js';
import { createZeitWetter } from './zeit-wetter.js';
import { createAktionen, gegenstandName, GRAB_RADIUS } from './aktionen.js';
import { waechstHier } from './wachstum.js';
import { STOFFE } from './boden.js';
import { kachelMitte } from './planet-baum.js';
import { createInventar } from '../../../engine/gameplay/inventar.js';
import { createGeoGitter } from './geo-gitter.js';
import { waehleKacheln, maxStufeFuer } from './planet-baum.js';
import { baueKachel, ZELLEN } from './kachel-bau.js';
import { createKachelStrom } from './kachel-strom.js';
import { laenge } from './mass.js';

const P = new URLSearchParams(location.search);
const SEED = +(P.get('seed') || 7);
const R = (+(P.get('r') || 100)) * 1000;          // Radius in m (Standard 100 km)
const ATMO = R * 0.25;                             // Dicke der Lufthülle (Himmel wird ab ~6 km dunkler)
const SONNE = new THREE.Vector3(0.75, 0.45, 0.48).normalize();
const MAX_STUFE = maxStufeFuer(R, ZELLEN, 1.0);    // feinste Kacheln: ~1 m Punktabstand
// Geologie einmal beim Start (Platten, Erosion, Flüsse, Seen), danach Feinheiten je Kachel
const ladeText = document.querySelector('#load div');
ladeText.textContent = 'Berechne Geologie…';
await new Promise((r) => setTimeout(r, 30));
const tGeo = performance.now();
const GITTER = createGeoGitter(192);
const geo = berechneGeologie({ seed: SEED, radius: R, G: GITTER });
const geoMs = performance.now() - tGeo;
ladeText.textContent = 'Erschaffe Planet…';
// Spielstand (Graben, Gefälltes, Inventar, Uhr) je Seed im Browser – ?neu=1 fängt frisch an
const SPEICHER = `erde-${SEED}-${R}`;
let stand = null;
try { if (!P.has('neu') && !P.has('test')) stand = JSON.parse(localStorage.getItem(SPEICHER) || 'null'); } catch { stand = null; }
const eingriffe = createEingriffe({ radius: R, zustand: stand?.eingriffe });
const planet = createPlanetHoehe({ seed: SEED, radius: R, geo, G: GITTER, eingriffe });

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.info.autoReset = false; // Zählung über Hauptszene + Niederschlag (Reset je Bild in der Schleife)
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.2, 5e8);
const sonne = new THREE.DirectionalLight(0xfff1dc, 2.4);
sonne.position.copy(SONNE);
const himmelLicht = new THREE.HemisphereLight(0xa8ccff, 0x3b3424, 0.7);
scene.add(sonne, himmelLicht, new THREE.AmbientLight(0x404858, 0.25));
scene.fog = new THREE.FogExp2(0x9cc4ec, 0);

const bodenMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
// Wasser: glatt (Sonnenglanz), wandernde Wellen in der Normalen, Himmel spiegelt sich im flachen Blickwinkel (Fresnel).
// Weltlage = Kachellage relativ zur Kamera + Kamera (wasserCam) → Wellen bleiben beim Fliegen am Ort.
const wasserU = { wZeit: { value: 0 }, wasserCam: { value: new THREE.Vector3() }, wHimmel: { value: new THREE.Color() } };
bodenMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, wasserU);
  sh.vertexShader = 'attribute float nass;\nuniform vec3 wasserCam;\nvarying float vNass;\nvarying vec3 vWelt;\nvarying vec3 vObenW;\n' + sh.vertexShader
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvNass = nass;\nvWelt = (modelMatrix * vec4(position, 1.0)).xyz + wasserCam;\nvObenW = normalize(vWelt);');
  sh.fragmentShader = 'uniform float wZeit;\nuniform vec3 wHimmel;\nvarying float vNass;\nvarying vec3 vWelt;\nvarying vec3 vObenW;\n' + sh.fragmentShader
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, vNass);')
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
if (vNass > 0.01) {
  vec3 p = vWelt * 0.45; float t = wZeit;
  vec3 st = vec3(sin(p.x * 1.1 + t * 1.3) + 0.6 * sin((p.y + p.z) * 2.3 - t * 1.7),
                 sin(p.y * 0.9 - t * 1.1) + 0.6 * sin((p.z - p.x) * 2.1 + t * 1.5),
                 sin(p.z * 1.0 + t * 0.9) + 0.6 * sin((p.x + p.y) * 1.9 + t * 1.2));
  st -= vObenW * dot(st, vObenW);                       // nur in der Wasserebene kippen
  float nahW = 1.0 - smoothstep(25.0, 220.0, length(vViewPosition));   // fern: keine Wellen (sonst Gittermuster)
  vec3 nW = normalize(vObenW + st * 0.07 * vNass * nahW);
  normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
}`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (vNass > 0.01) {
  float fr = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
  totalEmissiveRadiance += wHimmel * fr * 0.55 * vNass;
}`);
};
bodenMat.customProgramCacheKey = () => 'erde-boden-wasser';
const stufenMat = []; // Debug: jede Stufe eigene Farbe
for (let i = 0; i <= MAX_STUFE; i++) stufenMat.push(new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL((i * 0.13) % 1, 0.6, 0.55), roughness: 1 }));
let stufenFarben = false;

// ---------- Kacheln ----------
const welt = new THREE.Group();
scene.add(welt);
function erzeuge(d) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(d.nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(d.col, 3, true));
  geo.setAttribute('nass', new THREE.BufferAttribute(d.nass, 1, true));
  geo.setIndex(new THREE.BufferAttribute(d.idx, 1));
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, stufenFarben ? stufenMat[d.L] : bodenMat);
  m.userData = { mitte: d.mitte, L: d.L };
  m.visible = false;
  welt.add(m);
  return m;
}
const zeige = (m, an) => { if (m) m.visible = an; };
const entsorge = (m) => { welt.remove(m); m.geometry.dispose(); };

// Worker-Pool; bei file:// oder Fehler: Bau im Hauptthread mit Zeitbudget
const hauptQueue = [];
let worker = [];
let bauMs = 0, bauN = 0;
function starteWorker() {
  const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
  try {
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./kachel-worker.js', import.meta.url), { type: 'module' });
      w.offen = new Map();
      w.onmessage = (e) => {
        if (e.data.typ === 'streu') { w.offen.delete('s:' + e.data.key); streuFertig(e.data); return; }
        w.offen.delete(e.data.key); bauMs += e.data.ms; bauN++; strom.fertigGebaut(e.data.key, e.data);
      };
      w.onerror = () => { // Worker kaputt → seine Aufträge in den Hauptthread
        worker = worker.filter((x) => x !== w);
        for (const [key, k] of w.offen) (key.startsWith('s:') ? streuQueue : hauptQueue).push(k);
        w.terminate();
      };
      w.postMessage({ art: 'planet', opts: { seed: SEED, radius: R, geo }, eingriffe: eingriffe.zustand() });
      worker.push(w);
    }
  } catch { worker = []; }
}
let wi = 0;
function bauen(k) {
  if (!worker.length) { hauptQueue.push(k); return; }
  const w = worker[wi++ % worker.length];
  w.offen.set(k.key, k);
  w.postMessage({ art: 'bau', k });
}
function hauptBau(budgetMs) {
  const t0 = performance.now();
  while (streuQueue.length && performance.now() - t0 < budgetMs * 0.4) streuFertig(streueKachel(streuQueue.shift(), planet));
  while (hauptQueue.length && performance.now() - t0 < budgetMs) {
    const k = hauptQueue.shift();
    const t = performance.now();
    const d = baueKachel(k, planet);
    bauMs += performance.now() - t; bauN++;
    strom.fertigGebaut(k.key, d);
  }
}
// ---------- Natur: Streu-Kacheln (~80 m) rund um die Kamera, gebaut im Worker ----------
const STREU_L = streuStufe(R), STREU_RADIUS = 330;
const streuQueue = [], streuDa = new Map(), streuLaeuft = new Set();
let streuSchnitt = 0; // reihum über die Worker
function streuFertig(d) { streuLaeuft.delete(d.key); streuDa.set(d.key, d); natur.neu(); }
function streuen(wunsch) {
  for (const k of wunsch) {
    if (streuDa.has(k.key) || streuLaeuft.has(k.key)) continue;
    if (streuLaeuft.size >= 8) break;
    streuLaeuft.add(k.key);
    if (!worker.length) { streuQueue.push(k); continue; }
    const w = worker[streuSchnitt++ % worker.length];
    w.offen.set('s:' + k.key, k);
    w.postMessage({ art: 'streu', k });
  }
  if (streuDa.size > 500) { // weit entfernte vergessen
    const nah = new Set(wunsch.map((k) => k.key));
    for (const key of streuDa.keys()) if (!nah.has(key) && streuDa.size > 300) streuDa.delete(key);
  }
}
const natur = createNatur(scene, { istWeg: eingriffe.istWeg });

// ---------- Zeit, Wetter, Inventar, Aktionen ----------
const zw = createZeitWetter({ seed: SEED, zustand: stand?.zeit });
const inventar = createInventar({ plaetze: 30, stapel: 999 });
if (stand?.inventar) inventar.lade(stand.inventar);
else for (const w of ['axt', 'schaufel', 'spitzhacke']) inventar.gib(w, 1);
let speicherT = null;
function speichern() {
  clearTimeout(speicherT);
  speicherT = setTimeout(() => {
    try { localStorage.setItem(SPEICHER, JSON.stringify({ eingriffe: eingriffe.zustand(), inventar: inventar.zustand(), zeit: zw.zustand() })); } catch { /* voll/privat */ }
  }, 800);
}
/** Kachel vom Eingriff e betroffen? (Mitte näher als halbe Diagonale + Radius) */
function betroffen(k, e) {
  const { d, kante } = kachelMitte(k, R);
  const cos = d[0] * e.d[0] + d[1] * e.d[1] + d[2] * e.d[2];
  return Math.acos(Math.min(1, cos)) * R < kante * 0.8 + e.r + 1;
}
const aktionen = createAktionen({
  planet, eingriffe, natur, inventar, seed: SEED,
  beiEingriff: (e) => { for (const w of worker) w.postMessage({ art: 'eingriff', e }); strom.erneuere((k) => betroffen(k, e)); speichern(); },
  beiEntfernen: () => { natur.neu(); speichern(); },
});

starteWorker();
const strom = createKachelStrom({ bauen, erzeuge, zeige, entsorge, parallel: Math.max(2, worker.length * 2) });

// ---------- Lufthülle von außen, Sterne ----------
const atmo = new THREE.Mesh(new THREE.SphereGeometry(R + ATMO, 160, 80), new THREE.ShaderMaterial({
  uniforms: { sonne: { value: SONNE }, innen: { value: R / (R + ATMO) } },
  vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz);
vW = normalize(normal); gl_Position = projectionMatrix*mv;
#include <logdepthbuf_vertex>
}`,
  fragmentShader: `#include <logdepthbuf_pars_fragment>
uniform vec3 sonne; uniform float innen; varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){
#include <logdepthbuf_fragment>
  float d = -dot(vN, vV);
  float rand = sqrt(max(0.0, 1.0 - innen*innen));      // dort beginnt der Planet
  float k = smoothstep(0.0, rand, d);
  float tag = clamp(dot(vW, sonne) + 0.3, 0.05, 1.0);
  gl_FragColor = vec4(vec3(0.32, 0.6, 1.0) * k * tag * 1.3, 1.0);
}`,
  side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
}));
scene.add(atmo);
const sterne = (() => {
  const a = [];
  for (let i = 0; i < 4000; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(3e8); a.push(v.x, v.y, v.z); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }));
  p.frustumCulled = false; return p;
})();
scene.add(sterne);

// ---------- Besondere Orte aus der Geologie (Berg, Küste, Fluss, See, Vulkan) ----------
const orte = (() => {
  const { hoehe: H, spiegel: F, flaeche: A, ab } = geo, { n, dir, nb } = GITTER;
  const D = (c) => new THREE.Vector3(dir[c * 3], dir[c * 3 + 1], dir[c * 3 + 2]);
  let berg = 0, fluss = -1, see = -1, seeT = 0;
  for (let c = 0; c < n; c++) {
    if (H[c] > H[berg]) berg = c;
    if (H[c] > 40 && F[c] <= H[c] + 1 && A[c] > geo.amin && (fluss < 0 || A[c] > A[fluss])) fluss = c;
    if (F[c] > 0 && F[c] - H[c] > seeT) { seeT = F[c] - H[c]; see = c; }
  }
  let kueste = berg, kBest = -2;
  for (let c = 0; c < n; c++) {
    if (H[c] < 3 || H[c] > 40) continue;
    let amMeer = false;
    for (let k = 0; k < 8; k++) { const q = nb[c * 8 + k]; if (q >= 0 && H[q] < 0) amMeer = true; }
    if (!amMeer) continue;
    const s = D(c).dot(D(berg));
    if (s > kBest) { kBest = s; kueste = c; }
  }
  const v = geo.vulkane.reduce((a, b) => (b.hoch > a.hoch ? b : a));
  let wald = kueste, wBest = 0; // dichter Wald in mildem Tiefland, nahe der Küste
  for (let c = 0; c < n; c++) {
    if (H[c] < 30 || H[c] > 700 || F[c] > H[c] + 1 || A[c] >= geo.amin) continue;
    const w = waldDichte(tempAm(geo.temp0[c], H[c]), geo.feuchte[c]) * (1 + 0.3 * D(c).dot(D(kueste)));
    if (w > wBest) { wBest = w; wald = c; }
  }
  // je Biom ein Beispielort: flaches Land, kein Wasser, möglichst nah an der Küsten-Startstelle
  const biome = BIOM_NAME.map(() => ({ c: -1, s: -2 }));
  for (let c = 0; c < n; c++) {
    if (H[c] < 20 || H[c] > 900 || F[c] > H[c] + 1 || A[c] >= geo.amin) continue;
    const b = biome[biom(tempAm(geo.temp0[c], H[c]), geo.feuchte[c])];
    let rand = false;  // nicht am Biom-Rand
    for (let k = 0; k < 8; k++) { const q = nb[c * 8 + k]; if (q >= 0 && biom(tempAm(geo.temp0[q], H[q]), geo.feuchte[q]) !== biom(tempAm(geo.temp0[c], H[c]), geo.feuchte[c])) rand = true; }
    if (rand) continue;
    const sc = D(c).dot(D(kueste));
    if (sc > b.s) { b.s = sc; b.c = c; }
  }
  const biomOrte = {};
  biome.forEach((b, i) => { if (b.c >= 0) biomOrte['biom' + i] = D(b.c); });
  return { ...biomOrte, wald: D(wald),
    berg: D(berg), kueste: D(kueste), fluss: D(fluss >= 0 ? fluss : kueste),
    flussAb: D(fluss >= 0 ? ab[ab[ab[fluss]] >= 0 ? ab[fluss] : fluss] : kueste),
    see: D(see >= 0 ? see : kueste), vulkan: new THREE.Vector3(...v.d),
  };
})();
// Sonne so stellen, dass am Ort Vormittag ist (später: echte Tageszeit)
// Beim Springen an einen Ort: dort Vormittag (die Uhr läuft danach weiter, Sonne wandert)
function sonneZu(d) { zw.stelleOrtszeit([d.x, d.y, d.z], 9.5); }

// ---------- Kamera: Lage (m, Planetenmitte = 0), Blick nach vorn (tangential) + Neigung ----------
const cam = new THREE.Vector3();
const vorn = new THREE.Vector3();
let neigung = 0;
const oben = new THREE.Vector3(), blick = new THREE.Vector3(), rechts = new THREE.Vector3(), tmp = new THREE.Vector3();
const boden = (v) => { tmp.copy(v).normalize(); return Math.max(0, planet.oberflaeche(tmp.x, tmp.y, tmp.z, 0.5)); };

const ORTE = {
  orbit:  { ziel: 'kueste', h: 900_000, nei: -89, blick: 'berg' },
  berg:   { ziel: 'berg', h: 7000, nei: -18, blick: 'berg', weg: 12000 },
  kueste: { ziel: 'kueste', h: 400, nei: -12, blick: 'berg' },
  boden:  { ziel: 'kueste', h: 1.8, nei: -3, blick: 'berg' },
  fluss:  { ziel: 'fluss', h: 60, nei: -14, blick: 'flussAb', weg: 150 },
  see:    { ziel: 'see', h: 250, nei: -10, blick: 'see', weg: 2500 },
  vulkan: { ziel: 'vulkan', h: 2500, nei: -8, blick: 'vulkan', weg: 9000 },
  wald:   { ziel: 'wald', h: 1.8, nei: 2, blick: 'berg', gehen: true },
};
const BIOM_ORTE = Object.keys(orte).filter((k) => k.startsWith('biom'));
for (const k of BIOM_ORTE) ORTE[k] = { ziel: k, h: 1.8, nei: 2, blick: 'berg', gehen: true };
let biomWahl = -1;
document.getElementById('bBiom').onclick = (e) => {
  biomWahl = (biomWahl + 1) % BIOM_ORTE.length;
  setzeOrt(BIOM_ORTE[biomWahl]);
  e.currentTarget.textContent = '▸ ' + BIOM_NAME[+BIOM_ORTE[biomWahl].slice(4)];
};
function setzeOrt(name) {
  const o = ORTE[name] || ORTE.orbit;
  const d = orte[o.ziel].clone().normalize();
  if (o.weg) { // ein Stück abseits stehen, damit das Ziel im Blick ist
    const quer = new THREE.Vector3(0.3, 1, 0.2).cross(d).normalize();
    d.applyAxisAngle(quer, o.weg / R);
  }
  cam.copy(d).multiplyScalar(R + boden(d) + o.h);
  sonneZu(d);
  oben.copy(d);
  vorn.copy(orte[o.blick]).multiplyScalar(R).sub(cam).projectOnPlane(oben);
  if (vorn.lengthSq() < 1e-6) vorn.set(0, 1, 0).projectOnPlane(oben);
  vorn.normalize();
  neigung = THREE.MathUtils.degToRad(o.nei);
  auto = null;
  setzeGehen(!!o.gehen);
}

// ---------- Geh-Modus: Schwerkraft, Springen, Schwimmen, Bäume/Felsen sind fest ----------
let gehen = false, fallV = 0, amBoden = false, schwimmt = false;
const AUGE = 1.7, GEH_TEMPO = 4.2, SPRUNG = 5.2, G_ERDE = 9.81;
const bGehen = document.getElementById('bGehen');
function setzeGehen(an) {
  gehen = an; fallV = 0;
  document.getElementById('aktionen').style.display = an ? 'flex' : 'none';
  bGehen.textContent = an ? '🕊 Fliegen' : '🚶 Gehen';
  bGehen.classList.toggle('on', an);
  if (an) { auto = null; neigung = THREE.MathUtils.clamp(neigung, -0.6, 0.6); }
}
bGehen.onclick = () => { setzeGehen(!gehen); if (gehen) { const d = cam.clone().normalize(); cam.copy(d).multiplyScalar(R + boden(d) + AUGE); } };

// ---------- Aktionen zu Fuß: Blickstrahl findet Natur-Stück oder Boden ----------
const WERKZEUGE = new Set(['axt', 'schaufel', 'spitzhacke', 'eisenhacke']);
let invText = '';
function inventarText() {
  const z = new Map();
  for (const p of inventar.plaetze) if (p && !WERKZEUGE.has(p.id)) z.set(p.id, (z.get(p.id) || 0) + p.anzahl);
  return z.size ? [...z].map(([id, n]) => `${gegenstandName(id)} ${n}`).join(' · ') : 'leer (graben, fällen, pflücken …)';
}
const zielP = new THREE.Vector3();
/** Was liegt im Blick (bis 7 m)? → { art: 'natur', o } | { art: 'boden', p } | null */
function zielSuchen() {
  for (let t = 0.4; t <= 7; t += 0.15) {
    zielP.copy(cam).addScaledVector(blick, t);
    const o = natur.finde(zielP, 0.05);
    if (o) return { art: 'natur', o, p: zielP.clone() };
    tmp.copy(zielP).normalize();
    const pr = planet.probe(tmp.x, tmp.y, tmp.z, 0.5);
    if (zielP.length() - R <= Math.max(pr.h, pr.wasser)) return { art: 'boden', p: tmp.clone().multiplyScalar(R + pr.h) };
  }
  return null;
}
const meldungEl = document.getElementById('meldung'), zielEl = document.getElementById('ziel');
let meldungT = null;
function melde(text, gut = true) {
  meldungEl.textContent = text; meldungEl.style.opacity = 1; meldungEl.classList.toggle('schlecht', !gut);
  clearTimeout(meldungT); meldungT = setTimeout(() => { meldungEl.style.opacity = 0; }, 2200);
}
function handle(was) {
  if (!gehen) { melde('Erst „Gehen“ – dann graben, fällen, bauen', false); return; }
  const z = zielSuchen();
  if (!z) { melde('Nichts in Reichweite', false); return; }
  let r;
  if (was === 'nehmen') r = z.art === 'natur' ? aktionen.nehmen(z.o) : { ok: false, text: 'Hier ist nichts zum Nehmen – graben?' };
  else if (was === 'graben') r = z.art === 'natur' ? aktionen.nehmen(z.o) : aktionen.graben(z.p);
  else r = aktionen.bauen(z.art === 'boden' ? z.p : z.p);
  melde(r.text, r.ok);
  invText = inventarText();
}
let zielT = 0;
function zielAnzeigen() {
  zielEl.style.display = gehen ? 'block' : 'none';
  if (!gehen || (zielT += 1) % 6) return; // nicht jedes Bild
  const z = zielSuchen();
  zielEl.classList.toggle('treffer', !!z);
  zielEl.dataset.text = z ? (z.art === 'natur' ? z.o.art : 'Boden') : '';
}
document.getElementById('aNehmen').onclick = () => handle('nehmen');
document.getElementById('aGraben').onclick = () => handle('graben');
document.getElementById('aBauen').onclick = () => handle('bauen');
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyF') handle('nehmen');
  if (e.code === 'KeyG') handle('graben');
  if (e.code === 'KeyB') handle('bauen');
});
const ZEITRAFFER = [1, 20, 200];
document.getElementById('bZeit').onclick = (e) => {
  zw.tempo = ZEITRAFFER[(ZEITRAFFER.indexOf(zw.tempo) + 1) % ZEITRAFFER.length];
  e.currentTarget.textContent = `⏩ Zeit ${zw.tempo}×`;
};
document.getElementById('bReset').onclick = () => {
  if (!confirm('Gegrabenes, Gefälltes und Tasche zurücksetzen?')) return;
  try { localStorage.removeItem(SPEICHER); } catch { /* egal */ }
  location.reload();
};
setInterval(speichern, 15000); // Uhr/Wetter ab und zu sichern

// ---------- Steuerung ----------
const tasten = new Set();
addEventListener('keydown', (e) => tasten.add(e.code));
addEventListener('keyup', (e) => tasten.delete(e.code));
const stick = { id: null, x0: 0, y0: 0, x: 0, y: 0 };
const blickZ = { id: null, x: 0, y: 0 };
const joyEl = document.getElementById('joy'), knopfEl = document.getElementById('knob');
const cv = renderer.domElement;
cv.addEventListener('pointerdown', (e) => {
  cv.setPointerCapture(e.pointerId);
  if (e.pointerType !== 'mouse' && e.clientX < innerWidth * 0.45 && stick.id === null) {
    Object.assign(stick, { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, y: 0 });
    joyEl.style.display = 'block'; joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px';
  } else if (blickZ.id === null) Object.assign(blickZ, { id: e.pointerId, x: e.clientX, y: e.clientY });
});
cv.addEventListener('pointermove', (e) => {
  if (e.pointerId === stick.id) {
    let dx = e.clientX - stick.x0, dy = e.clientY - stick.y0;
    const l = Math.hypot(dx, dy), m = 55;
    if (l > m) { dx *= m / l; dy *= m / l; }
    stick.x = dx / m; stick.y = dy / m;
    knopfEl.style.transform = `translate(${dx}px,${dy}px)`;
  } else if (e.pointerId === blickZ.id) {
    const dx = e.clientX - blickZ.x, dy = e.clientY - blickZ.y;
    blickZ.x = e.clientX; blickZ.y = e.clientY;
    drehe(-dx * 0.004, -dy * 0.004);
    auto = null;
  }
});
const los = (e) => {
  if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; joyEl.style.display = 'none'; knopfEl.style.transform = ''; }
  if (e.pointerId === blickZ.id) blickZ.id = null;
};
cv.addEventListener('pointerup', los);
cv.addEventListener('pointercancel', los);
function drehe(gier, nick) {
  oben.copy(cam).normalize();
  vorn.applyAxisAngle(oben, gier);
  neigung = THREE.MathUtils.clamp(neigung + nick, -1.55, 1.55);
}
let hochRunter = 0;
for (const [id, w] of [['hoch', 1], ['runter', -1]]) {
  const el = document.getElementById(id);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); hochRunter = w; auto = null; });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, () => { hochRunter = 0; });
}
const tempoEl = document.getElementById('tempo');

// ---------- Orbit-Test: automatisch vom All zum Boden und zurück ----------
let auto = null;
const AUTO_STUFEN = [1_500_000, 200_000, 20_000, 2_000, 200, 20, 2];
document.getElementById('bOrbit').onclick = () => {
  setzeOrt('kueste'); setzeGehen(false);
  const d = cam.clone().normalize();
  cam.copy(d).multiplyScalar(R + boden(d) + AUTO_STUFEN[0]);
  auto = { stufen: [...AUTO_STUFEN, ...AUTO_STUFEN.slice(0, -1).reverse()], pause: 0, punkt: d };
};
for (const [id, ort] of [['bAll', 'orbit'], ['bBerg', 'berg'], ['bKueste', 'kueste'], ['bBoden', 'boden'], ['bFluss', 'fluss'], ['bSee', 'see'], ['bVulkan', 'vulkan'], ['bWald', 'wald']])
  document.getElementById(id).onclick = () => setzeOrt(ort);
document.getElementById('bLod').onclick = (e) => {
  stufenFarben = !stufenFarben;
  e.currentTarget.classList.toggle('on', stufenFarben);
  welt.children.forEach((m) => { m.material = stufenFarben ? stufenMat[m.userData.L] : bodenMat; });
};
document.getElementById('bSeed').onclick = () => {
  const p = new URLSearchParams(location.search); p.set('seed', String(1 + Math.floor(Math.random() * 99999)));
  location.search = p.toString();
};

// ---------- Karte: Geologie von oben (Höhen, Flüsse, Seen), Tippen = hinfliegen ----------
const karteBox = document.getElementById('karteBox'), karteEl = document.getElementById('karte'), punktEl = document.getElementById('kpunkt');
const KW = 360, KH = 180;
const KARTEN = ['Höhe', 'Gestein', 'Klima'];
let karteModus = -1; // -1 = aus
const kf = [0, 0, 0];
function zeichneKarte() {
  karteEl.width = KW; karteEl.height = KH;
  const modus = KARTEN[karteModus];
  const ctx = karteEl.getContext('2d'), bildDaten = ctx.createImageData(KW, KH), px = bildDaten.data;
  const g = GITTER.neueGewichte();
  for (let y = 0; y < KH; y++) for (let x = 0; x < KW; x++) {
    const lat = (0.5 - (y + 0.5) / KH) * Math.PI, lon = ((x + 0.5) / KW) * 2 * Math.PI;
    GITTER.gewichte(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon), g);
    const h = GITTER.lese(geo.hoehe, g), f = GITTER.lese(geo.spiegel, g), c = g.naechste;
    let r, gg, b;
    if (h < 0) { const t = Math.min(1, -h / 4000); r = 20 * (1 - t) + 6; gg = 95 * (1 - t) + 22; b = 150 * (1 - t) + 62; }
    else if (modus === 'Gestein') { const fc = GESTEIN_FARBE[geo.gestein[c]]; r = fc[0] * 300; gg = fc[1] * 300; b = fc[2] * 300; }
    else if (modus === 'Klima') {
      const T = tempAm(GITTER.lese(geo.temp0, g), h), Fe = GITTER.lese(geo.feuchte, g);
      bodenFarbe(T, Fe, 0.5, kf); r = kf[0] * 290; gg = kf[1] * 290; b = kf[2] * 290;
      if (T < -6) { r = gg = b = 240; }
    }
    else { const t = Math.min(1, h / 3200); r = 80 + 140 * t; gg = 130 + 50 * t - 50 * t * t; b = 60 + 130 * t * t; }
    if (f > h + 1 && f > 0) { r = 50; gg = 120; b = 210; }
    if (geo.hoehe[c] >= 0 && geo.flaeche[c] >= geo.amin) { const s2 = Math.min(1, Math.log10(geo.flaeche[c] / geo.amin) / 2.3); r += (40 - r) * s2; gg += (110 - gg) * s2; b += (235 - b) * s2; }
    const i = (y * KW + x) * 4; px[i] = r; px[i + 1] = gg; px[i + 2] = b; px[i + 3] = 255;
  }
  ctx.putImageData(bildDaten, 0, 0);
  const chip = (rgb, t) => `<b style="background:rgb(${rgb.map((v) => Math.min(255, v * 300 | 0))})"></b>${t}`;
  document.getElementById('legende').innerHTML =
    modus === 'Gestein' ? GESTEIN_NAME.map((n, i) => chip(GESTEIN_FARBE[i], n)).join('') :
    modus === 'Klima' ? 'Grün = Wald · Gelb = Gras/Steppe · Sand = Wüste · Weiß = Eis' :
    'Braun/Grau = Gebirge · Blau = Flüsse und Seen · Tippen = hinfliegen';
}
// Knopf schaltet reihum: Höhe → Gestein → Klima → aus
document.getElementById('bKarte').onclick = (e) => {
  karteModus = karteModus + 1 >= KARTEN.length ? -1 : karteModus + 1;
  const an = karteModus >= 0;
  if (an) zeichneKarte();
  karteBox.style.display = an ? 'block' : 'none';
  e.currentTarget.classList.toggle('on', an);
  e.currentTarget.textContent = an ? 'Karte: ' + KARTEN[karteModus] : 'Karte';
};
karteEl.addEventListener('pointerdown', (e) => {
  const r = karteEl.getBoundingClientRect();
  const lat = (0.5 - (e.clientY - r.top) / r.height) * Math.PI, lon = ((e.clientX - r.left) / r.width) * 2 * Math.PI;
  const d = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
  cam.copy(d).multiplyScalar(R + boden(d) + 3000);
  neigung = THREE.MathUtils.degToRad(-35); auto = null; setzeGehen(false);
});
function karteMarker() {
  if (karteBox.style.display !== 'block') return;
  const d = tmp.copy(cam).normalize();
  const lat = Math.asin(d.y), lon = (Math.atan2(d.z, d.x) + 2 * Math.PI) % (2 * Math.PI);
  punktEl.style.left = (lon / (2 * Math.PI)) * 100 + '%'; punktEl.style.top = (0.5 - lat / Math.PI) * 100 + '%';
}

// ---------- Schleife ----------
const hud = document.getElementById('hud');
const grau = new THREE.Color(), abend = new THREE.Color(1, 0.55, 0.3);
const blau = new THREE.Color(0x8fbfea), nacht = new THREE.Color(0x0a1020), schwarz = new THREE.Color(0x01030a), himmel = new THREE.Color();
let alt = performance.now(), fpsT = 0, fpsN = 0, fps = 0, wahlT = 1, info = { angezeigt: 0, gebaut: 0, laufend: 0, offen: 0 };
let geladen = false, tempoAnzeige = 0, ortT = 1, ortText = '';
/** Was ist hier? Gestein, Biom/Gewässer, Temperatur, Feuchte – direkt aus der Geologie. */
const klimaHier = { tMittel: 10, feuchte: 0.5 };
let bodenText = '', waechstText = '';
function ortsInfo(d) {
  const p = planet.probe(d.x, d.y, d.z, 2);
  klimaHier.tMittel = p.temp; klimaHier.feuchte = p.feuchte;
  if (gehen) {
    const u = aktionen.untergrund(d.clone().multiplyScalar(R + p.h));
    let t = 0;
    bodenText = u.schichten.map((x) => { const s = `${STOFFE[x.stoff].name}${x.dicke < 1e9 ? ' ' + x.dicke.toFixed(1) + ' m' : ''}`; t += x.dicke; return s; }).join(' · ') + (u.tiefe > 0.05 ? ` (gegraben ${u.tiefe.toFixed(1)} m)` : '');
    const w = waechstHier(p.temp, p.feuchte);
    waechstText = w.length ? w.slice(0, 6).join(', ') : 'kaum etwas';
  }
  let was;
  if (p.wasser > p.h + 0.05) was = p.meer ? 'Meer' : p.fluss ? 'Fluss' : 'See';
  else was = BIOM_NAME[biom(p.temp, p.feuchte)];
  const tiefe = p.wasser > p.h ? ` · ${Math.round(p.wasser - p.h)} m tief` : '';
  return `${was} · ${GESTEIN_NAME[p.gestein]} · ${p.temp.toFixed(0)} °C · Feuchte ${Math.round(p.feuchte * 100)} %${tiefe}${gehen ? (schwimmt ? ' · schwimmt' : ' · zu Fuß') : ''}`;
}
const ladeEl = document.getElementById('load');

function bild() {
  const jetzt = performance.now(), dt = Math.min(0.1, (jetzt - alt) / 1000);
  alt = jetzt;
  fpsT += dt; fpsN++; if (fpsT > 0.5) { fps = fpsN / fpsT; fpsT = 0; fpsN = 0; }

  oben.copy(cam).normalize();
  const grund = boden(cam);
  let hoeheBoden = cam.length() - R - grund;

  // Bewegung
  vorn.projectOnPlane(oben).normalize();
  blick.copy(vorn).multiplyScalar(Math.cos(neigung)).addScaledVector(oben, Math.sin(neigung));
  rechts.crossVectors(vorn, oben).normalize();
  const tempo = gehen ? GEH_TEMPO * (schwimmt ? 0.45 : 1) * 2 ** (+tempoEl.value) : Math.max(3, hoeheBoden * 1.2) * 2 ** (+tempoEl.value);
  let vor = -stick.y, seit = stick.x, hoch = hochRunter;
  if (tasten.has('KeyW') || tasten.has('ArrowUp')) vor += 1;
  if (tasten.has('KeyS') || tasten.has('ArrowDown')) vor -= 1;
  if (tasten.has('KeyD')) seit += 1;
  if (tasten.has('KeyA')) seit -= 1;
  if (tasten.has('ArrowLeft')) drehe(1.5 * dt, 0);
  if (tasten.has('ArrowRight')) drehe(-1.5 * dt, 0);
  if (tasten.has('Space') || tasten.has('KeyE')) hoch += 1;
  if (tasten.has('ShiftLeft') || tasten.has('KeyQ')) hoch -= 1;
  if (vor || seit || hoch) auto = null;
  const altPos = cam.clone();
  if (gehen) {
    // waagerecht laufen (Blick hoch/runter ändert die Richtung nicht), Sprung mit ▲/Leertaste
    const l = Math.hypot(vor, seit);
    const schritt = tmp.set(0, 0, 0).addScaledVector(vorn, vor).addScaledVector(rechts, seit);
    if (l > 1) schritt.multiplyScalar(1 / l);
    cam.addScaledVector(schritt, tempo * dt);
    if (hoch > 0 && (amBoden || schwimmt)) { fallV = schwimmt ? 2.5 : SPRUNG; amBoden = false; }
    fallV -= G_ERDE * dt;
    cam.addScaledVector(oben, fallV * dt);
    // Kollision mit Stämmen und Felsen (waagerecht hinausschieben)
    for (const h of natur.naheHindernisse()) {
      tmp.set(cam.x - h.x, cam.y - h.y, cam.z - h.z);
      const hoehe = tmp.dot(oben);
      if (hoehe > 12 || hoehe < -2) continue;
      tmp.addScaledVector(oben, -hoehe);
      const d = tmp.length(), r = h.r + 0.3;
      if (d < r && d > 1e-4) cam.addScaledVector(tmp, (r - d) / d);
    }
  } else {
    const schritt = tmp.set(0, 0, 0).addScaledVector(blick, vor).addScaledVector(rechts, seit).addScaledVector(oben, hoch);
    cam.addScaledVector(schritt, tempo * dt);
  }

  if (auto) { // Orbit-Test
    const ziel = auto.stufen[0];
    const neu = Math.exp(THREE.MathUtils.lerp(Math.log(Math.max(hoeheBoden, 0.5)), Math.log(ziel), 1 - Math.exp(-dt * 0.9)));
    cam.copy(auto.punkt).multiplyScalar(R + grund + neu);
    neigung = -THREE.MathUtils.degToRad(THREE.MathUtils.lerp(6, 89, THREE.MathUtils.smoothstep(Math.log10(neu), 0.5, 4.8)));
    if (Math.abs(Math.log(neu / ziel)) < 0.04) { auto.pause += dt; if (auto.pause > 0.6) { auto.stufen.shift(); auto.pause = 0; if (!auto.stufen.length) auto = null; } }
  }
  // Nie unter den Boden (Augenhöhe 1,7 m), nie zu weit weg. Zu Fuß: im tiefen Wasser schwimmen (Kopf über Wasser).
  oben.copy(cam).normalize();
  const pr = planet.probe(oben.x, oben.y, oben.z, 0.5);
  const g2 = Math.max(0, pr.h, pr.wasser);
  schwimmt = gehen && pr.wasser > pr.h + AUGE - 0.3;
  const minR = R + (schwimmt ? pr.wasser + 0.3 : Math.max(pr.h, pr.wasser) + AUGE), maxR = R + 3e7;
  const lc = cam.length();
  if (lc < minR) { cam.setLength(minR); if (fallV < 0) fallV = 0; amBoden = true; }
  else if (lc > maxR) cam.setLength(maxR);
  else if (gehen && lc > minR + 0.05) amBoden = false;
  if (gehen && schwimmt && fallV < 0) fallV = Math.max(fallV, -1);
  hoeheBoden = cam.length() - R - g2;
  tempoAnzeige = THREE.MathUtils.lerp(tempoAnzeige, cam.distanceTo(altPos) / Math.max(dt, 1e-3), 0.1);

  // Kacheln wählen (10× pro Sekunde reicht)
  wahlT += dt;
  if (wahlT > 0.1) {
    wahlT = 0;
    const wunsch = waehleKacheln([cam.x, cam.y, cam.z], { R, maxStufe: MAX_STUFE, hBoden: Math.max(0, g2) }).filter((k) => !k.verdeckt);
    info = strom.update(wunsch);
  }
  // Natur nur nah am Boden
  const naturAn = hoeheBoden < 1200 && !stufenFarben;
  if (wahlT === 0 && naturAn) streuen(streuKacheln([cam.x, cam.y, cam.z], R, STREU_L, STREU_RADIUS));
  if (!worker.length) hauptBau(geladen ? 8 : 30);
  natur.update(cam, naturAn ? [...streuDa.values()] : [], jetzt / 1000, naturAn);

  // Floating Origin: Kamera im Ursprung, Welt verschoben
  for (const m of strom.sichtbar()) {
    const c = m.userData.mitte;
    m.position.set(c[0] - cam.x, c[1] - cam.y, c[2] - cam.z);
  }
  atmo.position.set(-cam.x, -cam.y, -cam.z);
  camera.position.set(0, 0, 0);
  camera.up.copy(oben);
  camera.lookAt(blick);

  // Zeit & Wetter (Klima vom Ort, alle 0,3 s erneuert)
  zw.update(dt, oben, klimaHier);
  SONNE.copy(zw.sonne); sonne.position.copy(SONNE);
  natur.setzeWind(0.25 + 1.6 * zw.wetter.wind, zw.windWelt);
  // Himmel, Nebel, Licht nach Höhe und Tageszeit
  const ueberMeer = cam.length() - R;
  const raum = THREE.MathUtils.smoothstep(ueberMeer, ATMO * 0.25, ATMO * 1.3);
  const W = zw.wetter, hs = oben.dot(SONNE);
  const tag = THREE.MathUtils.smoothstep(hs, -0.2, 0.25);
  const wolken = W.wolken * (1 - raum), blitz = W.blitz * (1 - raum);
  himmel.copy(nacht).lerp(blau, tag).lerp(grau.setRGB(0.55, 0.6, 0.65).multiplyScalar(0.25 + 0.75 * tag), wolken * 0.85).lerp(schwarz, raum);
  himmel.r += blitz * 0.5; himmel.g += blitz * 0.5; himmel.b += blitz * 0.55;
  scene.background = himmel;
  scene.fog.color.copy(himmel);
  scene.fog.density = (1 - raum) * (2.6 / (R * 0.35) + W.nebel * 0.006 + (W.regen + W.schnee) * 0.0012);
  // Sonne: Stand aus der Uhr, abends rötlich, Wolken dämpfen
  sonne.intensity = 2.4 * THREE.MathUtils.smoothstep(hs, -0.03, 0.12) * (1 - 0.7 * wolken) + blitz * 2;
  sonne.color.setRGB(1, 0.95, 0.86).lerp(abend, (1 - THREE.MathUtils.smoothstep(hs, 0.02, 0.3)) * 0.8);
  atmo.visible = ueberMeer > ATMO * 0.6;
  sterne.visible = raum > 0.5 || tag < 0.3;
  himmelLicht.position.copy(oben);
  himmelLicht.intensity = 0.12 + (0.5 * tag * (1 - 0.3 * wolken) + blitz) * (1 - raum);

  wasserU.wZeit.value = jetzt / 1000;
  wasserU.wasserCam.value.copy(cam);
  wasserU.wHimmel.value.copy(himmel).lerp(blau, 0.3);
  renderer.info.reset();
  renderer.render(scene, camera);
  zw.zeichne(renderer, camera);
  karteMarker();
  zielAnzeigen();

  if (!geladen && (info.angezeigt > 0 && info.offen < 8 || jetzt > 8000)) { geladen = true; ladeEl.remove(); }
  else if (!geladen) ladeEl.querySelector('i').textContent = `${info.angezeigt} Kacheln`;

  const r = renderer.info.render;
  ortT += dt;
  if (ortT > 0.3) { ortT = 0; ortText = ortsInfo(oben); invText = inventarText(); }
  const zeitText = zw.text(oben);
  const kompakt = innerWidth < 640; // Handy hochkant: nur das Wichtigste
  hud.textContent = kompakt ?
    `${ortText}\n${zeitText}\n` + (gehen ? `${invText}\n` : '') +
    `Höhe ${laenge(Math.max(0, hoeheBoden))} · Boden ${laenge(Math.max(0, g2))} · ${Math.round(tempoAnzeige * 3.6)} km/h\n` +
    `${fps.toFixed(0)} fps · ${r.triangles.toLocaleString('de-DE')} Dreiecke · Natur ${natur.info.anzahl}` :
    `Hier        ${ortText}\n` +
    `Zeit        ${zeitText} · Tempo ${zw.tempo}×\n` +
    (gehen ? `Boden       ${bodenText}\nWächst      ${waechstText}\nTasche      ${invText}\n` : '') +
    `Höhe        ${laenge(Math.max(0, hoeheBoden))} über Boden\n` +
    `Meereshöhe  ${laenge(Math.max(0, g2))} Boden · ${laenge(Math.max(0, ueberMeer))} Kamera\n` +
    `Tempo       ${Math.round(tempoAnzeige * 3.6).toLocaleString('de-DE')} km/h\n` +
    `Kacheln     ${info.angezeigt} sichtbar · ${info.gebaut} gebaut · ${info.offen} offen\n` +
    `Bau         ${worker.length ? worker.length + ' Worker' : 'Hauptthread'} · ${(bauMs / Math.max(1, bauN)).toFixed(1)} ms/Kachel\n` +
    `Planet      R ${laenge(R)} · Seed ${SEED} · Stufen 0–${MAX_STUFE}\n` +
    `Natur       ${natur.info.anzahl.toLocaleString('de-DE')} Stück · ${natur.info.dreiecke.toLocaleString('de-DE')} Dreiecke · ${streuDa.size} Streu-Kacheln\n` +
    `Geologie    ${geo.platten.length} Platten · Land ${(geo.stat.land * 100).toFixed(0)} % · ${geo.stat.flussZellen} Fluss- · ${geo.stat.seeZellen} See-Zellen · ${(geoMs / 1000).toFixed(1)} s\n` +
    `Dreiecke    ${r.triangles.toLocaleString('de-DE')} · ${r.calls} Draw-Calls · ${fps.toFixed(0)} fps`;
  requestAnimationFrame(bild);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
setzeOrt(P.get('ort') || 'orbit');
// Testschalter: ?wetter=regen|schnee|gewitter|nebel|sturm|klar … und ?uhr=19 (Ortszeit)
if (P.get('wetter')) zw.wetter.setze(P.get('wetter'), true);
if (P.get('uhr')) zw.stelleOrtszeit([cam.x / cam.length(), cam.y / cam.length(), cam.z / cam.length()], +P.get('uhr'));
requestAnimationFrame(bild);
