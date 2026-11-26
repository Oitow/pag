// Erde-Labor: erfundener Planet mit Detailstufen, nahtlos vom Orbit bis zum Boden – und zu Fuß begehbar.
// Würfel-Kugel + Quadtree-Kacheln (planet-baum), Geologie/Klima/Gestein einmal beim Start (geologie),
// Höhe/Farbe je Punkt (planet-hoehe), Natur aus dem Naturfundus (natur-streu → natur),
// Kachelbau + Streuung im Worker (kachel-worker, Rückfall: Hauptthread), Kamera bleibt im Ursprung (Floating Origin).
import * as THREE from 'three';
import { createPlanetHoehe } from './planet-hoehe.js';
import { berechneGeologie, GESTEIN_NAME, GESTEIN_FARBE } from './geologie.js';
import { biom, BIOM_NAME, tempAm, waldDichte, bodenFarbe } from './klima.js';
import { streuKacheln, streueKachel, streuStufe, STREU_ARTEN, STRIDE } from './natur-streu.js';
import { createNatur, ZIEL_HOEHE } from './natur.js';
import { installiereDunst, aktualisiereDunst, DUNST_GLSL } from './dunst.js';
import { createMond } from '../../../engine/render/mond.js';
import { createEingriffe } from './eingriffe.js';
import { createVoxelErde, LOCH_MAX } from './voxel-erde.js';
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
import { createErweiterungen } from './erweiterungen.js';
import { createVulkanRauch } from './vulkan-rauch.js';
import { createWolken } from './wolken.js';
import { WERKZEUGE } from './herstellen-daten.js';
import { createFernSchatten } from './fernschatten.js';
import { createBodenNetz } from './boden-netz.js';
import { createGrasTeppich, GRAS_EBENE } from './gras-teppich.js';
import { createGrabFeld } from './graben-feld.js';

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
// Graben = feines Höhenfeld (graben-feld.js, 0,2 m) – Voxel-Gruben/Tunnel nur noch zum Ausprobieren mit ?voxel=1
const VOXEL_MODUS = P.get('voxel') === '1';
let planet = null;
const feld = createGrabFeld({ radius: R, basis: (x, y, z) => { const p = planet.probe(x, y, z, 1); return p.h - p.feld; } });
planet = createPlanetHoehe({ seed: SEED, radius: R, geo, G: GITTER, eingriffe, feld });
{ // alter Spielstand mit Voxel-Gruben → als Gruben ins Höhenfeld übernehmen
  let fz = stand?.feld;
  if (!fz && stand?.voxel?.ops?.length && !VOXEL_MODUS) fz = { ops: stand.voxel.ops.flatMap((o) => {
    const l = Math.hypot(o.x, o.y, o.z), h = l - R, d = [o.x / l, o.y / l, o.z / l];
    if (h < planet.oberflaeche(d[0], d[1], d[2], 1) - 3.5) return [];   // tief im Berg (Tunnel): geht im Höhenfeld nicht
    return [{ typ: o.typ, d, r: o.r * 1.15, ziel: o.typ === 'weg' ? h - o.r * 0.8 : h + o.r * 0.8 }];
  }) };
  if (fz) feld.lade(fz);
}

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// Filmische Tonwerte: helle Sonne ohne ausgebrannte Flächen, satte Schatten (Himmel-Hintergrund bleibt unberührt)
renderer.toneMapping = P.get('ton') === 'aus' ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = +(P.get('belichtung') || 1.15);   // 1,3 wirkte am Handy blass/ausgewaschen
renderer.info.autoReset = false; // Zählung über Hauptszene + Niederschlag (Reset je Bild in der Schleife)
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.2, 5e8);
const sonne = new THREE.DirectionalLight(0xfff1dc, 2.4);
sonne.position.copy(SONNE);
// Schatten der Sonne: Kasten ±SCHATTEN m um den Spieler, folgt der Kamera in Texel-Schritten (kein Flimmern)
const SCHATTEN = 40, SCHATTEN_KARTE = Math.min(innerWidth, innerHeight) < 700 ? 1024 : 2048;
let SCHATTEN_TEXEL = (2 * SCHATTEN) / SCHATTEN_KARTE;   // ändert sich mit der Grafik-Einstellung
sonne.castShadow = true;
sonne.shadow.mapSize.set(SCHATTEN_KARTE, SCHATTEN_KARTE);
Object.assign(sonne.shadow.camera, { left: -SCHATTEN, right: SCHATTEN, top: SCHATTEN, bottom: -SCHATTEN, near: 1, far: 700 });
sonne.shadow.camera.updateProjectionMatrix();
sonne.shadow.bias = -0.0004;
sonne.shadow.normalBias = 0.06;
const himmelLicht = new THREE.HemisphereLight(0xa8ccff, 0x3b3424, 0.7);
const hellBlau = new THREE.Color(0xa8ccff);
// Fernschatten (Berge über Täler, ~1,6 km): zweites, dunkles Richtungslicht direkt nach der Sonne (Schattenindex 1)
const fern = createFernSchatten({ renderer });
scene.add(sonne, sonne.target, fern.licht, fern.licht.target, himmelLicht, new THREE.AmbientLight(0x404858, 0.25));
installiereDunst(); // vor dem ersten Material: Nebel-Bausteine ersetzen
scene.fog = new THREE.FogExp2(0x9cc4ec, 0);

// Nahdetail des Bodens: Wertrauschen, Zellen modulo Periode (1024 m * Frequenz) → kein Sprung, wenn die Kamera die Wrap-Grenze quert
const BODEN_RAUSCHEN = `
float bHash(vec3 c, float per) { vec3 q = fract(mod(c, per) * 0.1031); q += dot(q, q.zyx + 31.32); return fract((q.x + q.y) * q.z); }
float bRausch(vec3 p, float f) {
  vec3 x = p * f, i = floor(x), u = x - i; u = u * u * (3.0 - 2.0 * u); float per = 1024.0 * f;
  return mix(mix(mix(bHash(i, per), bHash(i + vec3(1,0,0), per), u.x), mix(bHash(i + vec3(0,1,0), per), bHash(i + vec3(1,1,0), per), u.x), u.y),
             mix(mix(bHash(i + vec3(0,0,1), per), bHash(i + vec3(1,0,1), per), u.x), mix(bHash(i + vec3(0,1,1), per), bHash(i + vec3(1,1,1), per), u.x), u.y), u.z);
}
`;
const bodenMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
// Loch-Maske: in Voxel-Säulen (Grabstellen) wird das Höhenfeld ausgeschnitten – Mitte/Achsen kommen kamerarelativ aus voxel-erde.js
const LOCH_GLSL = `uniform vec4 uLochM[${LOCH_MAX}]; uniform vec4 uLochA[${LOCH_MAX}]; uniform vec4 uLochB[${LOCH_MAX}]; uniform int uLochN;
varying vec3 vRelW;
bool imLoch(vec3 p) {
  for (int i = 0; i < ${LOCH_MAX}; i++) {
    if (i >= uLochN) break;
    vec3 q = p - uLochM[i].xyz;
    if (abs(dot(q, uLochA[i].xyz)) < 1.0 && abs(dot(q, uLochB[i].xyz)) < 1.0 && dot(q, q) < 3600.0) return true;
  }
  return false;
}
`;
// Wasser: glatt (Sonnenglanz), wandernde Wellen in der Normalen, Himmel spiegelt sich im flachen Blickwinkel (Fresnel).
// Weltlage = Kachellage relativ zur Kamera + Kamera (wasserCam) → Wellen bleiben beim Fliegen am Ort.
// bodenVers = Kameralage modulo 1024 m und Kamera-Radius modulo Schicht-Periode – in JS (double) gerechnet, sonst wackelt das Muster (float32 bei 1e5 m ≈ 1 cm)
const SCHICHT_PER = Math.PI * 2 * 20 / 11;
const wasserU = { uHohl: { value: 1 }, uWasserQ: { value: 1 }, wZeit: { value: 0 }, wasserCam: { value: new THREE.Vector3() }, wHimmel: { value: new THREE.Color() }, bodenVers: { value: new THREE.Vector4() }, uFuell: { value: 0 } };
bodenMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, wasserU);
  sh.vertexShader = 'attribute vec2 gras;\nvarying vec2 vGras;\nattribute float nass;\nattribute float hohl;\nvarying float vHohl;\nattribute vec3 land;\nvarying vec3 vLand;\nuniform vec3 wasserCam;\nvarying float vNass;\nvarying vec3 vWelt;\nvarying vec3 vObenW;\nvarying vec3 vRelW;\n' + sh.vertexShader
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef VOXEL\nvHohl = 1.0;\nvGras = vec2(0.0);\n#else\nvHohl = hohl;\nvGras = gras;\n#endif\nvNass = nass;\nvLand = land;\nvRelW = (modelMatrix * vec4(position, 1.0)).xyz;\nvWelt = vRelW + wasserCam;\nvObenW = normalize(vWelt);');
  sh.fragmentShader = 'varying vec2 vGras;\nuniform float wZeit;\nuniform float uHohl;\nuniform float uWasserQ;\nvarying float vHohl;\nuniform vec3 wHimmel;\nvarying vec3 vLand;\nvarying float vNass;\nfloat wT;\nfloat wSchaum;\nvarying vec3 vWelt;\nvarying vec3 vObenW;\nuniform vec3 wasserCam;\nuniform vec4 bodenVers;\nuniform float uFuell;\n' + LOCH_GLSL + BODEN_RAUSCHEN + sh.fragmentShader
    // vNass = Wassertiefe (0.5 = Uferlinie, ±3.2 m): flaches Wasser klar (Grund scheint durch), Schaumsaum, nasser Sand
    .replace('#include <color_fragment>', `#include <color_fragment>
wT = smoothstep(0.497, 0.51, vNass);
#ifndef VOXEL
if (wT < 0.5 && imLoch(vRelW)) discard;   // Grabstelle: hier zeigen die Voxel den Boden (Wasserfläche bleibt)
#endif
float wKlar = 1.0 - smoothstep(0.505, 0.62, vNass);
vec3 wFarbe = mix(diffuseColor.rgb, mix(vLand, diffuseColor.rgb * vec3(0.75, 1.05, 1.08), 0.5), wKlar);
diffuseColor.rgb = mix(vLand, wFarbe, wT);
diffuseColor.rgb *= 1.0 - 0.32 * smoothstep(0.44, 0.497, vNass) * (1.0 - wT);
float wFern = 1.0 - smoothstep(60.0, 420.0, length(vViewPosition));
float wSaum = smoothstep(0.497, 0.505, vNass) * (1.0 - smoothstep(0.512, 0.545, vNass));
float wWel = 0.5 + 0.5 * sin(dot(vWelt, vec3(0.71, 0.53, 0.62)) * 0.9 - wZeit * 1.4 + 1.7 * sin(dot(vWelt, vec3(-0.3, 0.6, 0.45)) * 0.35 + wZeit * 0.3));
wSchaum = wSaum * (0.4 + 0.6 * smoothstep(0.3, 0.8, wWel)) * wFern;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.94, 0.95), wSchaum * 0.8);`)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, wT * (1.0 - wSchaum));')
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
if (wT > 0.01) {
  vec3 p = vWelt * 0.45; float t = wZeit;
  vec3 st = vec3(sin(p.x * 1.1 + t * 1.3) + 0.6 * sin((p.y + p.z) * 2.3 - t * 1.7),
                 sin(p.y * 0.9 - t * 1.1) + 0.6 * sin((p.z - p.x) * 2.1 + t * 1.5),
                 sin(p.z * 1.0 + t * 0.9) + 0.6 * sin((p.x + p.y) * 1.9 + t * 1.2));
  float wD = length(vViewPosition);
  if (uWasserQ > 1.5) {   // Wasser-Detail Hoch: feine Kräusel (Wind), quer laufend – bricht die Spiegelung auf
    vec3 q = vWelt * 2.3;
    st += 0.45 * (1.0 - smoothstep(8.0, 70.0, wD)) * vec3(sin(q.x * 1.7 - t * 3.1 + sin(q.z * 0.9)), sin(q.y * 1.5 + t * 2.7 + sin(q.x * 1.1)), sin(q.z * 1.9 - t * 2.9 + sin(q.y * 0.8)));
  }
  st -= vObenW * dot(st, vObenW);                       // nur in der Wasserebene kippen
  float nahW = 1.0 - smoothstep(25.0, 140.0 + 160.0 * uWasserQ, wD);   // fern: keine Wellen (sonst Gittermuster)
  vec3 nW = normalize(vObenW + st * 0.07 * wT * nahW * min(1.0, uWasserQ + 0.35));
  normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
}`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ // Boden-Detail (Land): großflächige Farbflecken, Erdstellen, Körnung, Felsstruktur, Bump.
  // An die WELT geheftet: vRelW (Lage relativ zum Spieler) + Versatz aus JS – nicht an die Kamera (sonst rutscht das Muster
  // mit Kopfwippen/3.-Person-Kamera mit). Jede Wellenlänge blendet aus, sobald sie kleiner als ~3 Pixel wird (kein Flimmern).
  vec3 bP = vRelW + bodenVers.xyz;
  vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
  float bPix = max(max(length(dpx), length(dpy)), 1e-4);
  float bLand = (1.0 - wT) * (1.0 - wSchaum) * (1.0 - smoothstep(0.55, 0.72, diffuseColor.r - diffuseColor.b));
  if (bLand > 0.01) {
    vec3 nW = normalize(transpose(mat3(viewMatrix)) * normal);
    float bSteil = 1.0 - dot(nW, vObenW);
    vec3 c = diffuseColor.rgb;
    float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    float gras = smoothstep(-0.03, 0.03, c.g - c.r) * smoothstep(0.03, 0.1, c.g - c.b);
    float fels = max(1.0 - smoothstep(0.05, 0.15, sat), smoothstep(0.3, 0.55, bSteil) * (1.0 - gras * 0.5));
    float a32 = 1.0 - smoothstep(0.08, 0.3, bPix / 32.0), a8 = 1.0 - smoothstep(0.08, 0.3, bPix / 8.0);
    float a4 = 1.0 - smoothstep(0.1, 0.35, bPix / 4.0), a1 = 1.0 - smoothstep(0.1, 0.35, bPix / 1.0);
    float a05 = 1.0 - smoothstep(0.1, 0.35, bPix / 0.5), a012 = 1.0 - smoothstep(0.1, 0.35, bPix / 0.125);
    float m1 = mix(0.5, bRausch(bP, 1.0 / 32.0), a32);
    float m2 = a8 > 0.01 ? mix(0.5, bRausch(bP, 0.125), a8) : 0.5;
    float e1 = a4 > 0.01 ? mix(0.5, bRausch(bP, 0.25), a4) : 0.5;
    float g1 = a1 > 0.01 ? mix(0.5, bRausch(bP, 1.0), a1) : 0.5;
    float g2 = a05 > 0.01 ? mix(0.5, bRausch(bP, 2.0), a05) : 0.5;
    float g3 = a012 > 0.01 ? mix(0.5, bRausch(bP, 8.0), a012) : 0.5;
    // 1) großflächig: hell/dunkel + Gras mal trocken-gelblich, mal satt-grün
    c *= 1.0 + (m1 - 0.5) * 0.26 + (m2 - 0.5) * 0.18;
    c = mix(c, c * vec3(1.13, 1.06, 0.72), gras * smoothstep(0.55, 0.8, m1) * 0.7);
    c = mix(c, c * vec3(0.8, 1.02, 0.84), gras * smoothstep(0.45, 0.2, m2) * 0.55);
    // 2) offene Erde: weiche Flecken (kein harter Rand), an Hängen öfter
    float erde = smoothstep(0.6, 0.8, e1 * 0.55 + m2 * 0.45 + 0.12 * smoothstep(0.1, 0.35, bSteil)) * (1.0 - fels) * (0.35 + 0.65 * gras);
    c = mix(c, vec3(0.34, 0.27, 0.19) * (0.85 + 0.3 * m1), erde * 0.7);
    // 3) Körnung: Halme/Krümel (Gras feiner und kontrastreicher, Erde gröber)
    float korn = (g1 - 0.5) * 0.22 + (g2 - 0.5) * 0.28 + (g3 - 0.5) * (0.24 + 0.2 * gras);
    c *= 1.0 + korn * (1.0 - 0.5 * fels);
    // 4) Fels: Schichtbänder waagrecht (konzentrisch zum Planeten), Risse, gröbere Flecken – auf jede Entfernung
    float hoeheW = dot(vRelW, vObenW) + bodenVers.w;
    float band = 0.5 + 0.5 * sin(hoeheW * 1.7 + 5.0 * m2 + 2.0 * m1) * a1 + 0.25 * sin(hoeheW * 0.37 + 3.0 * m1) * a4;
    float riss = a4 > 0.01 ? (1.0 - smoothstep(0.0, 0.05 + bPix * 0.3, abs(e1 - 0.5))) * a4 : 0.0;
    vec3 fc = mix(c, vec3(dot(c, vec3(0.33))) * vec3(1.04, 1.0, 0.94), 0.45) * (0.78 + 0.34 * band) * (1.0 - 0.3 * riss);
    c = mix(c, fc, fels);
    // 5) Gras-Teppich: Boden unter dem Gras dunkler/grüner (Wurzelschatten); fern trägt die Farbe allein das Gras-Bild
    float gM = vGras.x * (0.6 + 0.8 * m2) * (1.0 - fels);
    vec3 gF = mix(vec3(0.07, 0.17, 0.03), vec3(0.33, 0.28, 0.1), clamp(vGras.y + 0.3 * (m1 - 0.5), 0.0, 1.0));
    c = mix(c, mix(c, gF, 0.55) * 0.8, clamp(gM, 0.0, 1.0) * 0.7);
    diffuseColor.rgb = mix(diffuseColor.rgb, c, bLand);
    // Bump: glattes Höhenfeld (cm) aus denselben Rauschen → keine Kantenlinien; per Bildschirmableitung in die Normale
    float hoehe = m2 * 0.6 + e1 * 0.5 + g1 * 0.35 + g2 * 0.2 + g3 * 0.08 + fels * band * 0.6 - erde * 0.25;
    vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
    float hs = (0.05 + 0.1 * fels) * bLand * (1.0 - smoothstep(30.0, 90.0, length(vViewPosition)));
    vec2 dh = vec2(dFdx(hoehe), dFdy(hoehe)) * hs;
    normal = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2));
  }
}`)
    .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
{ // Gelände-Verdeckung (Mulden, Täler, Hangfüße): weniger Himmelslicht, etwas weniger Sonne
  float ao = mix(1.0, vHohl, uHohl * (1.0 - wT));
  reflectedLight.indirectDiffuse *= ao; reflectedLight.indirectSpecular *= ao;
  reflectedLight.directDiffuse *= mix(1.0, ao, 0.35);
}`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * smoothstep(0.72, 0.9, diffuseColor.r - diffuseColor.b) * 1.6; // Lava glüht
#ifdef VOXEL
totalEmissiveRadiance += diffuseColor.rgb * uFuell;   // Streulicht in Gruben/Tunneln (sonst schwarz) – Schichten bleiben lesbar
#endif
if (wT > 0.01) {
  float fr = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
  totalEmissiveRadiance += wHimmel * fr * (0.45 + 0.15 * uWasserQ) * wT;
}`);
};
bodenMat.customProgramCacheKey = () => 'erde-boden-wasser-detail6';
// Schattenbild der Kacheln: dieselbe Loch-Maske (sonst wirft der unsichtbare alte Boden Schatten in die Grube)
const bodenTiefe = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
bodenTiefe.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, wasserU);
  sh.vertexShader = 'varying vec3 vRelW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRelW = (modelMatrix * vec4(position, 1.0)).xyz;');
  sh.fragmentShader = LOCH_GLSL + sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (imLoch(vRelW)) discard;');
};
bodenTiefe.customProgramCacheKey = () => 'erde-boden-tiefe-loch';
// Voxel-Meshes (Grabstellen): gleiches Bodenmaterial (Licht, Körnung, Farben) ohne Loch-Maske, beidseitig
const voxelMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
voxelMat.defines = { VOXEL: 1 };
voxelMat.shadowSide = THREE.BackSide;   // Schattenbild aus den Rückseiten: kein Selbstschatten-Flimmern (Akne) auf der Grabfläche
voxelMat.onBeforeCompile = bodenMat.onBeforeCompile;
voxelMat.customProgramCacheKey = () => 'erde-boden-voxel';
const stufenMat = []; // Debug: jede Stufe eigene Farbe
for (let i = 0; i <= MAX_STUFE; i++) stufenMat.push(new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL((i * 0.13) % 1, 0.6, 0.55), roughness: 1 }));
let stufenFarben = false;

// ---------- Kacheln ----------
const welt = new THREE.Group();
scene.add(welt);
// ---------- Fernwald: Bäume als Punkte (Silhouette im Shader), hängen an ihrer Gelände-Kachel ----------
const fernU = { uPixel: { value: 600 }, uNah: { value: 270 }, uLicht: { value: new THREE.Color(1, 1, 1) }, uNebelDichte: { value: 0 }, uNebelFarbe: { value: new THREE.Color() }, uSonneV: { value: new THREE.Vector3(0, 1, 0) }, uSonneFarbe: { value: new THREE.Color() } };
const fernMat = new THREE.ShaderMaterial({
  uniforms: fernU,
  vertexShader: `
attribute float groesse; attribute float art; attribute vec3 farbe;
uniform float uPixel, uNah;
varying vec3 vFarbe, vRicht; varying float vArt, vAlpha, vNebel;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float d = length(mv.xyz);
  vAlpha = smoothstep(uNah, uNah + 60.0, d);                  // nah stehen die echten Bäume
  float px = groesse * uPixel / max(d, 1.0);
  vAlpha *= smoothstep(1.2, 3.0, px);                         // unter ~2 px ausblenden: sonst dunkle Krümel von hoch oben
  gl_PointSize = vAlpha < 0.01 ? 0.0 : clamp(px, 1.5, 64.0);
  vFarbe = farbe; vArt = art; vNebel = d; vRicht = mv.xyz;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`,
  fragmentShader: `
uniform vec3 uLicht, uNebelFarbe, uSonneV, uSonneFarbe; uniform float uNebelDichte;
varying vec3 vFarbe, vRicht; varying float vArt, vAlpha, vNebel;
#include <logdepthbuf_pars_fragment>
${DUNST_GLSL}
void main() {
  vec2 p = gl_PointCoord; p.y = 1.0 - p.y;                    // 0 unten … 1 oben
  float x = abs(p.x - 0.5), hell;
  if (vArt < 0.5) {                                           // Nadelbaum: Kegel mit Stamm
    if (p.y < 0.1) { if (x > 0.04) discard; hell = 0.5; }
    else { if (x > (1.0 - p.y) * 0.42) discard; hell = 0.75 + 0.35 * p.y - 0.4 * x; }
  } else {                                                    // Laubbaum: runde Krone über Stamm
    vec2 k = vec2(x, p.y - 0.6);
    if (length(k * vec2(1.0, 1.15)) > 0.4) { if (p.y > 0.3 || x > 0.05) discard; hell = 0.5; }
    else hell = 0.8 + 0.4 * (p.y - 0.4) - 0.3 * x;
  }
  #include <logdepthbuf_fragment>
  vec3 c = vFarbe * hell * uLicht;
  float nebel = (1.0 - exp(-uNebelDichte * vNebel)) * mix(0.42, 1.0, smoothstep(6e-5, 6e-4, uNebelDichte));   // wie dunst.js
  gl_FragColor = vec4(mix(c, uNebelFarbe + dunstGlanz(vRicht, uSonneV, uSonneFarbe, nebel), nebel), 1.0);
  if (vAlpha < 0.5 && fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) > vAlpha * 2.0) discard; // weiches Einblenden ohne Sortieren
}`,
});
function erzeuge(d) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(d.nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(d.col, 3, true));
  geo.setAttribute('nass', new THREE.BufferAttribute(d.nass, 1, true));
  geo.setAttribute('land', new THREE.BufferAttribute(d.land, 3, true));
  geo.setAttribute('hohl', new THREE.BufferAttribute(d.hohl, 1, true));
  geo.setAttribute('gras', new THREE.BufferAttribute(d.gras, 2, true));   // Gras-Teppich: Menge, Trockenheit
  geo.setIndex(new THREE.BufferAttribute(d.idx, 1));
  if (d.kugel) geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(d.kugel[0], d.kugel[1], d.kugel[2]), d.kugel[3]); else geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, stufenFarben ? stufenMat[d.L] : bodenMat);
  m.receiveShadow = true;
  m.customDepthMaterial = bodenTiefe;
  m.layers.enable(GRAS_EBENE);   // Höhenkarte des Gras-Teppichs liest nur die Gelände-Kacheln
  m.castShadow = true;   // nah: feine Kacheln (Böschungen, Grubenränder); fern: Berge in die Fernschatten-Karte
  m.userData = { mitte: d.mitte, L: d.L, netz: netzDaten(d) };
  m.visible = false;
  if (d.baeume) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(d.baeume.pos, 3));
    const ga = new THREE.InterleavedBuffer(d.baeume.groesse, 2);
    g.setAttribute('groesse', new THREE.InterleavedBufferAttribute(ga, 1, 0));
    g.setAttribute('art', new THREE.InterleavedBufferAttribute(ga, 1, 1));
    g.setAttribute('farbe', new THREE.BufferAttribute(d.baeume.farbe, 3, true));
    g.computeBoundingSphere();
    const punkte = new THREE.Points(g, fernMat);
    m.add(punkte);
  }
  welt.add(m);
  return m;
}
// Boden-Netz: welche Kachel gerade gezeichnet wird → Natur sitzt genau auf dem sichtbaren Boden (boden-netz.js)
const bodenNetz = createBodenNetz({ N: ZELLEN, maxStufe: MAX_STUFE + 2 });   // +2: feinere Kacheln an Grabstellen
let netzNeu = false, netzT = 0;
function netzDaten(d) {
  const [f, L, ix, iy] = String(d.key).split('/').map(Number), M = ZELLEN + 1, radien = d.radien ?? new Float32Array(M * M);
  if (!d.radien) for (let v = 0; v < M * M; v++) radien[v] = Math.hypot(d.pos[v * 3] + d.mitte[0], d.pos[v * 3 + 1] + d.mitte[1], d.pos[v * 3 + 2] + d.mitte[2]);
  return { key: d.key, k: { f, L, ix, iy }, radien, nass: d.nass.subarray(0, M * M) };
}
const zeige = (m, an) => {
  if (!m) return;
  m.visible = an;
  const n = m.userData.netz;
  if (an) bodenNetz.setze(n.key, n.k, n.radien, n.nass); else bodenNetz.weg(n.key);
  netzNeu = true;
  if (an) grasTeppich?.neu();
};
const entsorge = (m) => { bodenNetz.weg(m.userData.netz.key); welt.remove(m); m.geometry.dispose(); for (const c of m.children) c.geometry.dispose(); };

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
        if (e.data.typ === 'voxel') { voxel.fertig(e.data); return; }
        if (e.data.typ === 'streu') { w.offen.delete('s:' + e.data.key); streuFertig(e.data); return; }
        w.offen.delete(e.data.key); bauMs += e.data.ms; bauN++; strom.fertigGebaut(e.data.key, e.data);
      };
      w.onerror = () => { // Worker kaputt → seine Aufträge in den Hauptthread
        worker = worker.filter((x) => x !== w);
        voxel?.verloren();
        for (const [key, k] of w.offen) (key.startsWith('s:') ? streuQueue : hauptQueue).push(k);
        w.terminate();
      };
      w.postMessage({ art: 'planet', opts: { seed: SEED, radius: R, geo }, eingriffe: eingriffe.zustand(), feld: feld.zustand() });
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
let naturNeu = false;   // neue Streu-Kachel → Natur neu, aber nicht im selben Bild wie neue Kachel-Meshes
function streuFertig(d) { streuLaeuft.delete(d.key); streuDa.set(d.key, d); naturNeu = true; }
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
const natur = createNatur(scene, { istWeg: eingriffe.istWeg, renderer, bodenNetz });

// ---------- Zeit, Wetter, Inventar, Aktionen ----------
const zw = createZeitWetter({ seed: SEED, zustand: stand?.zeit });
const inventar = createInventar({ plaetze: 30, stapel: 999 });
if (stand?.inventar) inventar.lade(stand.inventar);
else for (const w of ['axt', 'schaufel', 'spitzhacke']) inventar.gib(w, 1);
let speicherT = null, erw = null;
function speichern() {
  if (P.get('test')) return;   // ?test=1: kein Spielstand
  clearTimeout(speicherT);
  speicherT = setTimeout(() => {
    try { localStorage.setItem(SPEICHER, JSON.stringify({ eingriffe: eingriffe.zustand(), feld: feld.zustand(), voxel: VOXEL_MODUS ? voxel.zustand() : stand?.voxel, inventar: inventar.zustand(), zeit: zw.zustand(), erw: erw?.zustand() })); } catch { /* voll/privat */ }
  }, 800);
}
/** Kachel vom Eingriff e betroffen? (Mitte näher als halbe Diagonale + Radius) */
function betroffen(k, e) {
  const { d, kante } = kachelMitte(k, R);
  const cos = d[0] * e.d[0] + d[1] * e.d[1] + d[2] * e.d[2];
  return Math.acos(Math.min(1, cos)) * R < kante * 0.8 + e.r + 1;
}
// ---------- Voxel-Nahzone: Gruben, Tunnel (docs/plaene/ERDE-FUNDAMENT.md) ----------
const voxelGruppe = new THREE.Group();
scene.add(voxelGruppe);
const voxel = createVoxelErde({
  THREE, planet, gruppe: voxelGruppe, material: voxelMat, zustand: VOXEL_MODUS ? stand?.voxel : null,
  sende(job) { if (!worker.length) return false; worker[wi++ % worker.length].postMessage(job); return true; },
});
Object.assign(wasserU, voxel.uniforms);
// Gras-Teppich: Gras überall (GPU), liest Höhe/Menge aus einer Höhenkarte der gezeichneten Kacheln; Grabstellen bleiben frei
let lochAlt = -1;
const naturBlick = { dir: new THREE.Vector3(0, 0, 1), cos: 0 };
var grasTeppich = createGrasTeppich({ renderer, scene, loch: { uniforms: voxel.uniforms, glsl: LOCH_GLSL } });
let grobT = 0;
const grobOffen = [];
const aktionen = createAktionen({
  planet, eingriffe, natur, inventar, seed: SEED, voxel: VOXEL_MODUS ? voxel : null, feld: VOXEL_MODUS ? null : feld,
  beiVoxel: () => speichern(),
  beiFeld: ({ op, betroffen }) => {
    for (const w of worker) w.postMessage({ art: 'feld', op });
    // je Schlag nur die feinen Kacheln (≤ ~40 m) sofort neu; grobe (bis ~1,2 km) gesammelt 2 s nach dem letzten Schlag
    strom.erneuere((k) => k.L >= 11 && feld.kachelTrifft(k, betroffen));
    grobOffen.push(...betroffen); clearTimeout(grobT);
    grobT = setTimeout(() => { const b = grobOffen.splice(0); strom.erneuere((k) => k.L >= 7 && k.L < 11 && feld.kachelTrifft(k, b)); }, 2000);
    speichern();
  },
  beiEingriff: (e) => { for (const w of worker) w.postMessage({ art: 'eingriff', e }); strom.erneuere((k) => betroffen(k, e)); speichern(); },
  beiEntfernen: () => { natur.neu(); speichern(); },
});

starteWorker();
const strom = createKachelStrom({ bauen, erzeuge, zeige, entsorge, parallel: Math.max(3, worker.length * 3), budget: true });   // Meshes je Bild nach Budget (Sinkflug)

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
  let kueste = berg, kBest = -2, meer = -1;
  for (let c = 0; c < n; c++) {
    if (H[c] < 3 || H[c] > 40) continue;
    let amMeer = -1;
    for (let k = 0; k < 8; k++) { const q = nb[c * 8 + k]; if (q >= 0 && H[q] < 0) amMeer = q; }
    if (amMeer < 0) continue;
    const s = D(c).dot(D(berg));
    if (s > kBest) { kBest = s; kueste = c; meer = amMeer; }
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
  // je Gestein ein Ort (flach, trocken, nah an der Küste) – ?ort=gestein0…4
  const gst = GESTEIN_NAME.map(() => ({ c: -1, s: -2 }));
  for (let c = 0; c < n; c++) {
    if (H[c] < 40 || H[c] > 900 || F[c] > H[c] + 1 || A[c] >= geo.amin) continue;
    const g = gst[geo.gestein[c]], sc = D(c).dot(D(kueste));
    if (sc > g.s) { g.s = sc; g.c = c; }
  }
  // Tafelberge: trocken-warm, Sandstein/Kalk, kein Gebirge, mittlere Höhe – am liebsten mit Fluss (Schlucht) in der Nähe
  let tafel = kueste, tBest = -1;
  for (let c = 0; c < n; c++) {
    if (H[c] < 150 || H[c] > 1500 || geo.gestein[c] > 1 || geo.gebirge[c] > 0.12 || F[c] > H[c] + 1 || geo.feuchte[c] > 0.36 || geo.temp0[c] < 9) continue;
    const w = Math.min(1, (0.4 - geo.feuchte[c]) / 0.2) * Math.min(1, (geo.temp0[c] - 7) / 7) * (A[c] > geo.amin ? 1.5 : 1);
    if (w > tBest) { tBest = w; tafel = c; }
  }
  const biomOrte = {};
  gst.forEach((g, i) => { if (g.c >= 0) biomOrte['gestein' + i] = D(g.c); });
  biome.forEach((b, i) => { if (b.c >= 0) biomOrte['biom' + i] = D(b.c); });
  return { ...biomOrte, wald: D(wald), tafel: D(tafel),
    berg: D(berg), kueste: D(kueste), meer: D(meer >= 0 ? meer : kueste), fluss: D(fluss >= 0 ? fluss : kueste),
    flussAb: D(fluss >= 0 ? ab[ab[ab[fluss]] >= 0 ? ab[fluss] : fluss] : kueste),
    see: D(see >= 0 ? see : kueste), vulkan: new THREE.Vector3(...v.d), kraterWeg: (v.rad || 0.035) * R * 0.32,
  };
})();
// Sonne so stellen, dass am Ort Vormittag ist (später: echte Tageszeit)
// Schatten-Kasten an der Kamera, in Texel-Schritten der Sonnen-Ebene eingerastet; Sonne 300 m davor
const sU = new THREE.Vector3(), sV = new THREE.Vector3(), sZiel = new THREE.Vector3();
function schattenZiel(s) {
  sU.set(0, 1, 0).cross(s); if (sU.lengthSq() < 1e-6) sU.set(1, 0, 0).cross(s); sU.normalize();
  sV.crossVectors(s, sU);
  const texel = SCHATTEN_TEXEL;
  const u = cam.dot(sU), v = cam.dot(sV);
  sZiel.copy(sU).multiplyScalar(Math.round(u / texel) * texel - u).addScaledVector(sV, Math.round(v / texel) * texel - v);
  sonne.target.position.copy(sZiel);
  sonne.position.copy(sZiel).addScaledVector(s, 300);
}
// Mond (engine/render/mond.js): umkreist den Planeten in 29,5 Tagen, Phase aus dem Winkel zur Sonne
const mond = createMond(scene, { abstand: 3000, schattenweite: 30, nachtseite: 'durchsichtig' });
const mondDir = new THREE.Vector3();
function mondRichtung(s, uhr) {
  const a = 2 * Math.PI * ((uhr.tag + uhr.stunde / 24) / 29.5 + 0.5);   // Tag 1 ≈ Vollmond
  const c = Math.cos(a), si = Math.sin(a);
  return mondDir.set(s.x * c - s.z * si, s.y * 0.6 + 0.08 * Math.sin(a * 0.5), s.x * si + s.z * c).normalize();
}
// Beim Springen an einen Ort: dort Vormittag (die Uhr läuft danach weiter, Sonne wandert)
function sonneZu(d) { zw.stelleOrtszeit([d.x, d.y, d.z], 9.5); }

// ---------- Kamera: Lage (m, Planetenmitte = 0), Blick nach vorn (tangential) + Neigung ----------
const cam = new THREE.Vector3();
const vorn = new THREE.Vector3();
let neigung = 0;
const oben = new THREE.Vector3(), blick = new THREE.Vector3(), rechts = new THREE.Vector3(), tmp = new THREE.Vector3();
const wandAlt = new THREE.Vector3(), schrittV = new THREE.Vector3();
const boden = (v) => { tmp.copy(v).normalize(); return Math.max(0, planet.oberflaeche(tmp.x, tmp.y, tmp.z, 0.5)); };

const ORTE = {
  orbit:  { ziel: 'kueste', h: 900_000, nei: -89, blick: 'berg' },
  berg:   { ziel: 'berg', h: 7000, nei: -18, blick: 'berg', weg: 12000 },
  kueste: { ziel: 'kueste', h: 400, nei: -12, blick: 'berg' },
  boden:  { ziel: 'kueste', h: 1.8, nei: -3, blick: 'berg' },
  himmel: { ziel: 'kueste', h: 1.8, nei: 40, blick: 'berg' },
  fluss:  { ziel: 'fluss', h: 60, nei: -14, blick: 'flussAb', weg: 150 },
  ufer:   { ziel: 'fluss', h: 1.8, nei: -8, blick: 'fluss', weg: 35, gehen: true },
  see:    { ziel: 'see', h: 250, nei: -10, blick: 'see', weg: 2500 },
  vulkan: { ziel: 'vulkan', h: 2500, nei: -8, blick: 'vulkan', weg: 9000 },
  krater: { ziel: 'vulkan', h: 1500, nei: -55, blick: 'vulkan', weg: orte.kraterWeg },
  wald:   { ziel: 'wald', h: 1.8, nei: 2, blick: 'berg', gehen: true },
  strand: { ziel: 'kueste', h: 1.8, nei: -9, blick: 'meer', gehen: true },
  tafel:  { ziel: 'tafel', h: 120, nei: -10, blick: 'berg', weg: 900 },
};
const BIOM_ORTE = Object.keys(orte).filter((k) => k.startsWith('biom'));
for (const k of Object.keys(orte).filter((k) => k.startsWith('gestein'))) ORTE[k] = { ziel: k, h: 1.8, nei: -6, blick: 'berg', gehen: true, weg: 3 };
for (const k of BIOM_ORTE) ORTE[k] = { ziel: k, h: 1.8, nei: 2, blick: 'berg', gehen: true };
let biomWahl = -1;
document.getElementById('bBiom').onclick = (e) => {
  biomWahl = (biomWahl + 1) % BIOM_ORTE.length;
  setzeOrt(BIOM_ORTE[biomWahl]);
  e.currentTarget.textContent = '▸ ' + BIOM_NAME[+BIOM_ORTE[biomWahl].slice(4)];
};
let heimat = orte.kueste.clone().normalize();   // Aufwach-Platz nach dem Tod (letzter Sprung zu Fuß)
function setzeOrt(name) {
  const o = ORTE[name] || ORTE.orbit;
  const d = orte[o.ziel].clone().normalize();
  if (o.weg) { // ein Stück abseits stehen, damit das Ziel im Blick ist
    const quer = new THREE.Vector3(0.3, 1, 0.2).cross(d).normalize();
    d.applyAxisAngle(quer, o.weg / R);
  }
  cam.copy(d).multiplyScalar(R + boden(d) + o.h);
  if (o.gehen) heimat.copy(d);
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

// ---------- Erweiterungen (Überleben, Bauen, Tiere, Herstellen): Vertrag in erweiterungen.js ----------
const anker = new THREE.Group();
scene.add(anker);
const rauch = createVulkanRauch(anker, { vulkane: geo.vulkane, planet, R });
const wolkenDecke = P.get('wolken') === 'aus' ? null : createWolken(scene, { R });
const erwWelt = {
  THREE, scene, R, seed: SEED, anker, cam, oben, vorn, blick, planet, inventar, zw, natur, eingriffe, dienste: {},
  bodenHoehe: (d) => boden(d),
  bodenPunkt(d, out = new THREE.Vector3()) {
    out.copy(d).normalize();
    const pr = planet.probe(out.x, out.y, out.z, 0.5);
    return out.multiplyScalar(R + Math.max(pr.h, pr.wasser));
  },
  spieler: () => ({ gehen, schwimmt, amBoden, fallV }),
  ansicht: () => (MENUE.person === 1 ? 1 : 3),
  setzeFall: (v) => { fallV = v; },
  drehe: (w) => { vorn.applyAxisAngle(oben, w); },   // Blick um die Ortsnormale drehen (Bogenmaß, + = links)
  melde: (t, gut = true) => melde(t, gut),
  speichern: () => speichern(),
  // nach dem Tod: zurück zum Startplatz (Ort beim Start bzw. letzter Sprung), zu Fuß
  aufwachen() {
    const d = heimat.clone();
    cam.copy(d).multiplyScalar(R + boden(d) + AUGE); fallV = 0;
    if (!gehen) setzeGehen(true);
  },
  knopf(id, text, onklick) {
    const el = document.createElement('div');
    el.className = 'b'; el.id = id; el.textContent = text;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); onklick(); });
    document.getElementById('aktionen').appendChild(el);
    return el;
  },
};
erw = createErweiterungen(erwWelt, stand?.erw);

// ---------- Aktionen zu Fuß: Blickstrahl findet Natur-Stück oder Boden ----------
let invText = '';
function inventarText() {
  const z = new Map();
  for (const p of inventar.plaetze) if (p && !WERKZEUGE.has(p.id)) z.set(p.id, (z.get(p.id) || 0) + p.anzahl);
  return z.size ? [...z].map(([id, n]) => `${gegenstandName(id)} ${n}`).join(' · ') : 'leer (graben, fällen, pflücken …)';
}
const zielP = new THREE.Vector3();
/** Was liegt im Blick (bis 7 m)? → { art: 'natur', o } | { art: 'boden', p } | null */
function zielSuchen() {
  const treffer = voxel.strahl(cam, blick, 7);   // Voxel in Grabstellen, sonst Höhenfeld
  const bis = treffer ? treffer.p.distanceTo(cam) : 7;
  for (let t = 0.4; t <= bis; t += 0.15) {
    zielP.copy(cam).addScaledVector(blick, t);
    const o = natur.finde(zielP, 0.05);
    if (o) return { art: 'natur', o, p: zielP.clone() };
  }
  return treffer ? { art: 'boden', p: treffer.p, richtung: blick.clone() } : null;
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
  const re = erw.aktion(was, z);
  if (re) { melde(re.text, re.ok); invText = inventarText(); speichern(); return; }
  if (!z) { melde('Nichts in Reichweite', false); return; }
  let r;
  if (was === 'nehmen') r = z.art === 'natur' ? aktionen.nehmen(z.o) : { ok: false, text: 'Hier ist nichts zum Nehmen – graben?' };
  else if (was === 'graben') r = z.art === 'natur' ? aktionen.nehmen(z.o) : aktionen.graben(z.p, z.richtung);
  else r = aktionen.bauen(z.p, z.richtung ?? blick.clone());
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

// ---------- Menü: auf/zu, Größe, Info-Box (alles gespeichert) ----------
const MENUE = (() => { try { return JSON.parse(localStorage.getItem('erde-menue') || 'null'); } catch { return null; } })()
  || { auf: !(navigator.maxTouchPoints > 0 || innerWidth < 700), groesse: 1, info: innerWidth < 640 ? 'kurz' : 'voll' };
const menueEl = document.getElementById('menue'), hudEl = document.getElementById('hud');
if (P.get('info')) MENUE.info = P.get('info');
if (P.get('debug')) window.__erde = { natur, renderer, scene, grasTeppich, get cam() { return cam; } };   // Testschalter: Messen im Browser   // Testschalter: ?info=kurz|aus
if (P.get('person')) MENUE.person = +P.get('person') === 1 ? 1 : 3;
else if (MENUE.person == null) MENUE.person = 3;
function menueSichern() { try { localStorage.setItem('erde-menue', JSON.stringify(MENUE)); } catch { /* egal */ } }
function menueZeigen() {
  menueEl.classList.toggle('auf', MENUE.auf);
  document.body.classList.toggle('menueAuf', MENUE.auf);
  document.getElementById('bMenue').classList.toggle('on', MENUE.auf);
  document.documentElement.style.setProperty('--ui', MENUE.groesse);
  hudEl.classList.toggle('aus', MENUE.info === 'aus');
  document.getElementById('bInfo').textContent = 'Info: ' + MENUE.info;
}
document.getElementById('bMenue').onclick = () => { MENUE.auf = !MENUE.auf; menueZeigen(); menueSichern(); };
document.getElementById('bKleiner').onclick = () => { MENUE.groesse = Math.max(0.7, +(MENUE.groesse - 0.1).toFixed(2)); menueZeigen(); menueSichern(); };
document.getElementById('bGroesser').onclick = () => { MENUE.groesse = Math.min(1.5, +(MENUE.groesse + 0.1).toFixed(2)); menueZeigen(); menueSichern(); };
document.getElementById('bPerson').textContent = MENUE.person === 1 ? '1. Person' : '3. Person';
document.getElementById('bPerson').onclick = (e) => { MENUE.person = MENUE.person === 1 ? 3 : 1; e.target.textContent = MENUE.person === 1 ? '1. Person' : '3. Person'; menueSichern(); };
document.getElementById('bInfo').onclick = () => { const s = ['voll', 'kurz', 'aus']; MENUE.info = s[(s.indexOf(MENUE.info) + 1) % 3]; menueZeigen(); menueSichern(); };
// Auf dem Handy schließt das Menü nach einem Ortssprung (Blick frei)
menueEl.addEventListener('click', (e) => { if (e.target.closest('.raster') && innerWidth < 700 && /^b(All|Berg|Kueste|Boden|Fluss|See|Vulkan|Wald|Orbit)$/.test(e.target.id)) { MENUE.auf = false; menueZeigen(); menueSichern(); } });
menueZeigen();
// Hilfe-Text nur am Anfang
setTimeout(() => { const h = document.getElementById('hilfe'); if (h) h.style.transition = 'opacity 1s', h.style.opacity = 0; }, 12000);

// ---------- Grafik: Stufen + einzelne Regler (Handy: Mittel) ----------
// Stufe setzt alle Regler; einzelne Regler im Fenster „Grafik ⚙“ ändern → Stufe „Eigen“. Gespeichert im Browser.
// Testschalter ?grafik=Niedrig|Mittel|Hoch|Ultra (wird nicht gespeichert).
const REGLER = {
  pixel:    { name: 'Auflösung',       werte: [1, 1.5, 2, 3], text: (v) => v + '×' },
  teilung:  { name: 'Gelände-Detail',  werte: [1.25, 1.5, 1.8, 2.2], text: (v) => ['grob', 'mittel', 'fein', 'sehr fein'][[1.25, 1.5, 1.8, 2.2].indexOf(v)] },
  natur:    { name: 'Natur-Weite',     werte: [0.5, 0.75, 1, 1.25], text: (v) => Math.round(v * 100) + ' %' },
  schatten: { name: 'Schatten nah',    werte: [0, 1024, 2048, 4096], text: (v) => v ? (v === 4096 ? '4096 weich' : v) : 'aus' },
  fern:     { name: 'Bergschatten',    werte: [0, 1024, 2048, 4096], text: (v) => v ? v + ' (1,6 km)' : 'aus' },
  hohl:     { name: 'Gelände-AO',      werte: [0, 0.6, 1], text: (v) => v ? (v < 1 ? 'leicht' : 'voll') : 'aus' },
  wasser:   { name: 'Wasser',          werte: [0, 1, 2], text: (v) => ['einfach', 'Wellen', 'Wellen + Kräusel'][v] },
  dunst:    { name: 'Luft/Dunst',      werte: [0.6, 1, 1.4], text: (v) => ['klar', 'normal', 'dicht'][[0.6, 1, 1.4].indexOf(v)] },
  gras:     { name: 'Gras',            werte: [0, 1, 2, 3, 4], text: (v) => ['aus', 'wenig', 'mittel', 'viel', 'sehr viel'][v] },
};
const GRAFIK = {
  Niedrig: { pixel: 1,   teilung: 1.25, natur: 0.5,  schatten: 0,    fern: 0,    hohl: 0.6, wasser: 0, dunst: 1, gras: 1 },
  Mittel:  { pixel: 1.5, teilung: 1.5,  natur: 0.75, schatten: 1024, fern: 1024, hohl: 1,   wasser: 1, dunst: 1, gras: 2 },
  Hoch:    { pixel: 2,   teilung: 1.8,  natur: 1,    schatten: 2048, fern: 2048, hohl: 1,   wasser: 2, dunst: 1, gras: 3 },
  Ultra:   { pixel: 3,   teilung: 2.2,  natur: 1.25, schatten: 4096, fern: 4096, hohl: 1,   wasser: 2, dunst: 1, gras: 4 },
};
let grafik = 'Hoch', G_OPT = null;
try {
  const gespeichert = JSON.parse(localStorage.getItem('erde-grafik2') || 'null');
  if (gespeichert && gespeichert.opt) { grafik = gespeichert.stufe; G_OPT = { ...GRAFIK.Mittel, ...gespeichert.opt }; }
  else grafik = localStorage.getItem('erde-grafik') || ((navigator.maxTouchPoints > 0 || innerWidth < 700) ? 'Mittel' : 'Hoch');
} catch { /* egal */ }
if (P.get('grafik')) { grafik = P.get('grafik'); G_OPT = null; }
if (grafik !== 'Eigen' && !GRAFIK[grafik]) grafik = 'Hoch';
if (!G_OPT) G_OPT = { ...GRAFIK[grafik === 'Eigen' ? 'Mittel' : grafik] };
const gEl = document.getElementById('grafikBox');
function wendeGrafikAn(speichern = true) {
  const g = G_OPT;
  renderer.setPixelRatio(Math.min(devicePixelRatio, g.pixel));
  renderer.setSize(innerWidth, innerHeight);
  natur.setzeWeite(g.natur);
  grasTeppich.setzeStufe(P.get('gras') !== null ? +P.get('gras') : g.gras ?? 2);
  // Sonnenschatten nah: Kartengröße; 4096 = weich (PCFSoft, alle Materialien werden einmal neu übersetzt)
  if (g.schatten && sonne.shadow.mapSize.x !== g.schatten) {
    sonne.shadow.mapSize.set(g.schatten, g.schatten);
    if (sonne.shadow.map) { sonne.shadow.map.dispose(); sonne.shadow.map = null; }
    SCHATTEN_TEXEL = (2 * SCHATTEN) / g.schatten;
  }
  const typ = g.schatten === 4096 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  if (renderer.shadowMap.type !== typ) { renderer.shadowMap.type = typ; scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); }); bodenMat.needsUpdate = true; }
  fern.setzeGroesse(g.fern);
  wasserU.uHohl.value = g.hohl;
  wasserU.uWasserQ.value = g.wasser;
  document.getElementById('bGrafik').textContent = 'Grafik: ' + grafik;
  if (gEl) gEl.innerHTML = '<div class="titel">Grafik-Stufe</div><div class="raster4">' +
    Object.keys(GRAFIK).map((n) => `<div class="b${n === grafik ? ' on' : ''}" data-stufe="${n}">${n}</div>`).join('') + '</div>' +
    '<div class="titel">Einzeln (tippen = nächster Wert)</div>' +
    Object.entries(REGLER).map(([k, r]) => `<div class="zeile" data-regler="${k}"><span>${r.name}</span><b>${r.text(g[k])}</b></div>`).join('') +
    '<div class="b" data-zu="1" style="margin-top:6px">Schließen</div>';
  if (speichern) try { localStorage.setItem('erde-grafik2', JSON.stringify({ stufe: grafik, opt: G_OPT })); } catch { /* egal */ }
}
function setzeGrafik(name) { grafik = name; G_OPT = { ...GRAFIK[name] }; wendeGrafikAn(); }
document.getElementById('bGrafik').onclick = () => { const n = Object.keys(GRAFIK); setzeGrafik(n[(n.indexOf(grafik) + 1) % n.length]); };
document.getElementById('bGrafikMehr').onclick = () => gEl.classList.toggle('auf');
gEl.addEventListener('click', (e) => {
  const st = e.target.closest('[data-stufe]'), rg = e.target.closest('[data-regler]');
  if (st) setzeGrafik(st.dataset.stufe);
  else if (rg) { const k = rg.dataset.regler, w = REGLER[k].werte; G_OPT[k] = w[(w.indexOf(G_OPT[k]) + 1) % w.length]; grafik = 'Eigen'; wendeGrafikAn(); }
  else if (e.target.closest('[data-zu]')) gEl.classList.remove('auf');
});
wendeGrafikAn(!P.get('grafik'));

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
const nullPunkt = new THREE.Vector3();
const kamOff = new THREE.Vector3(), kamAbs = new THREE.Vector3(), kamZiel = new THREE.Vector3();
// Kamera-Lebendigkeit (nur Darstellung, die Physik-Position `cam` bleibt unberührt)
const WACKELN = P.get('wackeln') !== 'aus';
const FOV_BASIS = 65;
let wackelPhase = 0, wackelAmp = 0, landeAmp = 0, landeT = 1, fovExtra = 0, kamGlatt = null;
const daempf = (rate, dt) => 1 - Math.exp(-rate * dt);   // bildratenunabhängige Glättung
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
  const fallVAnfang = fallV, warAmBoden = amBoden;
  let kleben = 0;   // Bergab-Klebedistanz (m): >0 nur, wenn man zu Fuß am Boden lief und nicht springt
  if (gehen && erw.bewegung(dt, { vor, seit, hoch, tempo: 2 ** (+tempoEl.value) })) {
    // ein Modul (z. B. Gleiter) bewegt den Spieler selbst; Boden-Grenze unten gilt weiter
  } else if (gehen) {
    // waagerecht laufen (Blick hoch/runter ändert die Richtung nicht), Sprung mit ▲/Leertaste
    const l = Math.hypot(vor, seit);
    const schritt = schrittV.set(0, 0, 0).addScaledVector(vorn, vor).addScaledVector(rechts, seit);   // eigener Vektor: boden() benutzt tmp
    if (l > 1) schritt.multiplyScalar(1 / l);
    // Steile Wände (Grubenrand, Klippe) kann man nicht hinauflaufen: Schritt verwerfen, wenn der Boden vorn zu steil steigt
    if (amBoden && !schwimmt && l > 0) {
      wandAlt.copy(cam);
      const hAlt = boden(cam), weit = tempo * dt;
      cam.addScaledVector(schritt, weit);
      if ((boden(cam) - hAlt) / Math.max(weit, 0.02) > 2.4) cam.copy(wandAlt);   // steiler als ~67°: Wand (springen geht, Rampe graben auch)
    } else cam.addScaledVector(schritt, tempo * dt);
    if (amBoden && !schwimmt && hoch <= 0) kleben = 0.6 + tempo * dt * Math.min(l, 1) * 1.5;
    if (hoch > 0 && (amBoden || schwimmt)) { fallV = schwimmt ? 2.5 : SPRUNG; amBoden = false; }
    fallV -= G_ERDE * dt;
    cam.addScaledVector(oben, fallV * dt);
    // Kollision mit Stämmen und Felsen (waagerecht hinausschieben)
    for (const h of [...natur.naheHindernisse(), ...(erwWelt.dienste.bau?.hindernisse?.(cam, 12) ?? [])]) {
      tmp.set(cam.x - h.x, cam.y - h.y, cam.z - h.z);
      const hoehe = tmp.dot(oben);
      if (hoehe > 12 || hoehe < -2) continue;
      tmp.addScaledVector(oben, -hoehe);
      const d = tmp.length(), r = h.r + 0.3;
      if (d < r && d > 1e-4) cam.addScaledVector(tmp, (r - d) / d);
    }
    // Grabstellen: Tunnelwände schieben, Decke stoppt den Sprung
    if (voxel.schiebe(cam, oben, AUGE).decke && fallV > 0) fallV = 0;
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
  const bau = gehen ? (erwWelt.dienste.bau?.bodenUnter?.(cam) ?? null) : null;   // Fundament, Boden, Treppe
  const vb = voxel.boden(cam, AUGE);   // in einer Grabstelle: Boden aus Voxeln (Grube, Tunnel), sonst null
  const hG = vb ?? pr.h;
  const g2 = Math.max(vb === null ? 0 : -Infinity, hG, pr.wasser, bau ?? -Infinity);
  schwimmt = gehen && bau === null && pr.wasser > hG + AUGE - 0.3 && cam.length() < R + pr.wasser + AUGE + 0.5;   // nicht hoch in der Luft über dem Meer
  const minR = R + (schwimmt ? pr.wasser + 0.3 : Math.max(hG, pr.wasser, bau ?? -Infinity) + AUGE), maxR = R + 3e7;
  const lc = cam.length();
  if (lc < minR) { cam.setLength(minR); if (fallV < 0) fallV = 0; amBoden = true; }
  else if (lc > maxR) cam.setLength(maxR);
  else if (gehen && kleben > 0 && !schwimmt && lc > minR + 0.05 && lc <= minR + kleben) { cam.setLength(minR); fallV = 0; amBoden = true; }   // bergab am Boden bleiben statt hüpfen
  else if (gehen && lc > minR + 0.05) amBoden = false;
  if (gehen && schwimmt && fallV < 0) fallV = Math.max(fallV, -1);
  hoeheBoden = cam.length() - R - g2;
  // Landestoß: Aufprallgeschwindigkeit merken (nur wenn man vorher in der Luft war)
  if (gehen && amBoden && !warAmBoden && !schwimmt && fallVAnfang < -3.5) { landeAmp = Math.min(0.28, -fallVAnfang * 0.014); landeT = 0; }
  tempoAnzeige = THREE.MathUtils.lerp(tempoAnzeige, cam.distanceTo(altPos) / Math.max(dt, 1e-3), 0.1);

  // Kacheln wählen (10× pro Sekunde reicht)
  wahlT += dt;
  if (wahlT > 0.1) {
    wahlT = 0;
    camera.getWorldDirection(tmp);
    const wunsch = waehleKacheln([cam.x, cam.y, cam.z], { R, maxStufe: MAX_STUFE, hBoden: Math.max(0, g2), teilung: G_OPT.teilung, fein: (k) => feld.inFleck(k.f, k.L, k.ix, k.iy), blick: [tmp.x, tmp.y, tmp.z] }).filter((k) => !k.verdeckt);
    info = strom.update(wunsch);
  }
  // Natur nur nah am Boden
  const naturAn = hoeheBoden < 1200 && !stufenFarben;
  if (wahlT === 0 && naturAn) streuen(streuKacheln([cam.x, cam.y, cam.z], R, STREU_L, STREU_RADIUS));
  if (!worker.length) hauptBau(geladen ? 8 : 30);
  const neuMeshes = strom.verarbeite(geladen ? 2.5 : 30, geladen ? 3 : 200);   // Kachel-Meshes: Bild-Budget, wichtigste zuerst
  bodenNetz.fokus(oben.x, oben.y, oben.z, 1500 / R);   // nur Netz-Änderungen nahe der Kamera betreffen die Natur
  netzT += dt;
  if (naturNeu && !neuMeshes) { naturNeu = false; natur.neu(); }
  if (netzNeu && !neuMeshes && netzT > 0.6) { netzNeu = false; netzT = 0; natur.neu(); }   // Kacheln verfeinert/neu → Natur neu aufs Netz setzen
  { // Blickkegel für die Natur: halbe Bild-Diagonale + 30° Rand
  const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), diag = Math.atan(Math.hypot(tv, tv * camera.aspect));
  camera.getWorldDirection(naturBlick.dir);
  naturBlick.cos = Math.cos(Math.min(Math.PI * 0.95, diag + 0.52));
}
natur.update(cam, naturAn ? [...streuDa.values()] : [], jetzt / 1000, naturAn, hoeheBoden, naturBlick);
  voxel.update(cam);

  // Floating Origin: Kamera im Ursprung, Welt verschoben
  for (const m of strom.sichtbar()) {
    const c = m.userData.mitte;
    m.position.set(c[0] - cam.x, c[1] - cam.y, c[2] - cam.z);
  }
  atmo.position.set(-cam.x, -cam.y, -cam.z);
  anker.position.set(-cam.x, -cam.y, -cam.z);
  if (voxel.uniforms.uLochN.value !== lochAlt) { lochAlt = voxel.uniforms.uLochN.value; grasTeppich.neu(); }   // neue Grabstelle → Gras dort weg
  grasTeppich.update(dt, cam, { an: naturAn, aus: THREE.MathUtils.smoothstep(hoeheBoden, 45, 90), zeit: jetzt / 1000, wind: 0.25 + 1.1 * zw.wetter.wind, windRicht: zw.windWelt });
  erw.update(dt);
  camera.position.set(0, 0, 0);
  camera.up.copy(oben);
  if (gehen && MENUE.person !== 1) {
    // 3. Person: Kamera hinter und etwas über der Figur (über die rechte Schulter), nie im Boden
    const fliegt = !!erwWelt.dienste.gleiter?.fliegt?.();   // im Gleiter weiter weg, damit Schirm + Figur ins Bild passen
    kamOff.copy(blick).multiplyScalar(fliegt ? -9 : -4.6).addScaledVector(oben, fliegt ? 2.2 : 1.0).addScaledVector(rechts, fliegt ? 0 : 0.6);
    // weich nachziehen (Wunschversatz → geglätteter Versatz); bei Sprüngen (Ortswechsel, Modus) sofort
    if (!kamGlatt || kamGlatt.distanceTo(kamOff) > 6) kamGlatt = (kamGlatt ?? new THREE.Vector3()).copy(kamOff);
    else kamGlatt.lerp(kamOff, daempf(9, dt));
    kamOff.copy(kamGlatt);
    // Boden-Abstand an Kamera und Mitte zwischen Kamera und Figur prüfen (Hang: Kamera nicht in den Berg)
    let unter = 0;
    for (const f of [1, 0.5]) {
      kamAbs.copy(cam).addScaledVector(kamOff, f);
      const kd = tmp.copy(kamAbs).normalize(), kp = planet.probe(kd.x, kd.y, kd.z, 0.5);
      unter = Math.max(unter, R + Math.max(kp.h, kp.wasser) + 0.4 - kamAbs.length());
    }
    // In Grabstellen (Grube, Tunnel): Strahl vom Kopf zur Wunschkamera, bei Fels davor stehen bleiben – nicht hochheben
    if (voxel.fest(cam.x, cam.y, cam.z) !== null) {
      let frei = 1;
      for (let f = 0.05; f <= 1.001; f += 0.05) {
        kamAbs.copy(cam).addScaledVector(kamOff, f);
        let hart = voxel.fest(kamAbs.x, kamAbs.y, kamAbs.z);
        if (hart === null) { const kd = tmp.copy(kamAbs).normalize(), kp = planet.probe(kd.x, kd.y, kd.z, 0.5); hart = kamAbs.length() < R + Math.max(kp.h, kp.wasser) + 0.2; }
        if (hart) { frei = f - 0.1; break; }
      }
      kamOff.multiplyScalar(Math.max(0.04, frei));
    } else if (unter > 0) kamOff.addScaledVector(oben, unter);
    camera.position.copy(kamOff);
    camera.lookAt(kamZiel.copy(blick).multiplyScalar(12).addScaledVector(oben, fliegt ? 1.2 : -0.6));
  } else {
    kamGlatt = null;
    // 1. Person: Kopfwippen beim Gehen am Boden + Landestoß, nur als Darstellungsversatz
    const gleitet = !!erwWelt.dienste.gleiter?.fliegt?.();
    const laeuft = WACKELN && gehen && amBoden && !schwimmt && !gleitet && !auto;
    const v = Math.min(tempoAnzeige, GEH_TEMPO * 2.5);
    wackelAmp += ((laeuft && v > 0.6 ? 1 : 0) - wackelAmp) * daempf(8, dt);
    wackelPhase += dt * v * 1.9;   // ≈ 2 Schritte/s bei Gehtempo
    landeT = Math.min(1, landeT + dt / 0.25);
    const dip = WACKELN ? -landeAmp * Math.sin(Math.PI * landeT) * (1 - landeT) * 1.6 : 0;
    const bobY = Math.sin(wackelPhase * 2) * 0.035 * wackelAmp, bobX = Math.sin(wackelPhase) * 0.02 * wackelAmp;
    camera.position.set(0, 0, 0).addScaledVector(oben, bobY + dip).addScaledVector(rechts, bobX);
    camera.lookAt(tmp.copy(blick).add(camera.position));
  }
  // Blickfeld: schneller Gleitflug / Sprint weitet leicht, sonst normal
  const gl = !!erwWelt.dienste.gleiter?.fliegt?.();
  const fovZiel = !gehen ? 0 : gl ? 9 * THREE.MathUtils.smoothstep(tempoAnzeige, 14, 40) : 7 * THREE.MathUtils.smoothstep(tempoAnzeige, GEH_TEMPO * 1.25, GEH_TEMPO * 2);
  fovExtra += (fovZiel - fovExtra) * daempf(3, dt);
  if (Math.abs(camera.fov - (FOV_BASIS + fovExtra)) > 0.01) { camera.fov = FOV_BASIS + fovExtra; camera.updateProjectionMatrix(); }

  // Zeit & Wetter (Klima vom Ort, alle 0,3 s erneuert)
  zw.update(dt, oben, klimaHier);
  SONNE.copy(zw.sonne);
  schattenZiel(SONNE);
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
  aktualisiereDunst({ fog: scene.fog, himmel, hs, tag, raum, hoehe: hoeheBoden, W, R });
  scene.fog.density *= G_OPT.dunst;   // Grafik-Regler Luft/Dunst
  // Sonne: Stand aus der Uhr, abends rötlich, Wolken dämpfen
  sonne.intensity = 2.4 * THREE.MathUtils.smoothstep(hs, -0.03, 0.12) * (1 - 0.7 * wolken) + blitz * 2;
  sonne.color.setRGB(1, 0.95, 0.86).lerp(abend, (1 - THREE.MathUtils.smoothstep(hs, 0.02, 0.3)) * 0.8);
  atmo.visible = ueberMeer > ATMO * 0.6;
  himmelLicht.position.copy(oben);
  // Himmelslicht in der Farbe des Himmels (abends warm, mittags blau), Bodenlicht = warmes Erdbraun, im Gras grünlich
  himmelLicht.color.copy(himmel).lerp(hellBlau, 0.35 * tag);
  { const m = Math.max(himmelLicht.color.r, himmelLicht.color.g, himmelLicht.color.b, 1e-3); himmelLicht.color.multiplyScalar(1 / m); }
  himmelLicht.groundColor.setRGB(0.26, 0.24, 0.15);
  himmelLicht.intensity = 0.12 + (0.5 * tag * (1 - 0.3 * wolken) + blitz) * (1 - raum);
  wasserU.uFuell.value = 0.05 + 0.3 * tag * (1 - 0.3 * wolken);
  // Schatten nur nah am Boden und wenn die Sonne scheint; Wolken machen sie weich/blass
  const schattenAn = G_OPT.schatten > 0 && hoeheBoden < 300 && hs > -0.03 && !stufenFarben;
  sonne.shadow.intensity = schattenAn ? 0.85 * (1 - 0.75 * wolken) : 0;
  // Bergschatten (bis 1,6 km): solange die Sonne über dem Horizont steht und man nicht hoch im Himmel ist
  fern.update(dt, cam, SONNE, G_OPT.fern > 0 && hs > 0 && hoeheBoden < 4000 && !stufenFarben,
    0.8 * (1 - 0.75 * wolken) * THREE.MathUtils.smoothstep(hs, 0, 0.06));
  mond.update({ kamera: nullPunkt, richtung: mondRichtung(SONNE, zw.uhr), sonne: SONNE, oben, nacht: (1 - tag) * (1 - 0.8 * wolken), anker: sZiel, sichtbar: raum < 0.2 });
  renderer.shadowMap.autoUpdate = schattenAn || (tag < 0.5 && G_OPT.schatten > 0);
  sterne.visible = raum > 0.5 || (tag < 0.3 && wolken < 0.6);

  // Fernwald: Pixelmaßstab, Licht wie die Natur (Sonne + Himmel), Nebel wie die Szene
  fernU.uPixel.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  fernU.uNah.value = 270 * G_OPT.natur;
  const lichtStaerke = 0.3 + 0.85 * THREE.MathUtils.smoothstep(hs, -0.05, 0.25) * (1 - 0.5 * wolken) + 0.1 * (1 - tag);
  fernU.uLicht.value.copy(sonne.color).multiplyScalar(lichtStaerke);
  fernU.uNebelDichte.value = scene.fog.density;
  fernU.uNebelFarbe.value.copy(scene.fog.color).convertLinearToSRGB(); // Punkt-Shader gibt ohne Farbraum-Baustein aus
  fernU.uSonneV.value.copy(SONNE).transformDirection(camera.matrixWorldInverse);
  fernU.uSonneFarbe.value.copy(sonne.color).multiplyScalar(sonne.intensity);
  wasserU.wZeit.value = jetzt / 1000;
  wasserU.wasserCam.value.copy(cam);
  { const md = (a, p) => ((a % p) + p) % p;
    wasserU.bodenVers.value.set(md(cam.x, 1024), md(cam.y, 1024), md(cam.z, 1024), md(Math.hypot(cam.x, cam.y, cam.z), SCHICHT_PER)); }
  wasserU.wHimmel.value.copy(himmel).lerp(blau, 0.3);
  rauch.update(dt, zw.windWelt, fernU.uPixel.value, fernU.uLicht.value);
  wolkenDecke?.update(dt, { cam, wetter: W, windWelt: zw.windWelt, sonne: SONNE, tag, licht: fernU.uLicht.value, himmel, raum });
  renderer.info.reset();
  renderer.render(scene, camera);
  fern.nachRender();
  zw.zeichne(renderer, camera);
  karteMarker();
  zielAnzeigen();

  if (!geladen && (info.angezeigt > 0 && info.offen < 8 || jetzt > 8000)) { geladen = true; ladeEl.remove(); }
  else if (!geladen) ladeEl.querySelector('i').textContent = `${info.angezeigt} Kacheln`;

  const r = renderer.info.render;
  ortT += dt;
  if (ortT > 0.3) { ortT = 0; ortText = ortsInfo(oben); invText = inventarText(); }
  const zeitText = zw.text(oben);
  const kompakt = MENUE.info === 'kurz';
  hud.textContent = kompakt ?
    `${ortText}\n${zeitText}\n` + (gehen ? `${invText}\n` + erw.hud().map((z) => z + '\n').join('') : '') +
    `Höhe ${laenge(Math.max(0, hoeheBoden))} · Boden ${laenge(Math.max(0, g2))} · ${Math.round(tempoAnzeige * 3.6)} km/h\n` +
    `${fps.toFixed(0)} fps · ${r.triangles.toLocaleString('de-DE')} Dreiecke · Natur ${natur.info.anzahl}` :
    `Hier        ${ortText}\n` +
    `Zeit        ${zeitText} · Tempo ${zw.tempo}×\n` +
    (gehen ? `Boden       ${bodenText}\nWächst      ${waechstText}\nTasche      ${invText}\n` + erw.hud().map((z) => z + '\n').join('') : '') +
    `Höhe        ${laenge(Math.max(0, hoeheBoden))} über Boden\n` +
    `Meereshöhe  ${laenge(Math.max(0, g2))} Boden · ${laenge(Math.max(0, ueberMeer))} Kamera\n` +
    `Tempo       ${Math.round(tempoAnzeige * 3.6).toLocaleString('de-DE')} km/h\n` +
    `Kacheln     ${info.angezeigt} sichtbar · ${info.gebaut} gebaut · ${info.offen} offen · ${info.eingang} im Eingang\n` +
    `Bau         ${worker.length ? worker.length + ' Worker' : 'Hauptthread'} · ${(bauMs / Math.max(1, bauN)).toFixed(1)} ms/Kachel\n` +
    `Planet      R ${laenge(R)} · Seed ${SEED} · Stufen 0–${MAX_STUFE}\n` +
    `Natur       ${natur.info.anzahl.toLocaleString('de-DE')} Stück · ${natur.info.dreiecke.toLocaleString('de-DE')} Dreiecke (${natur.info.top}) · ${streuDa.size} Streu-Kacheln\n` +
    `Geologie    ${geo.platten.length} Platten · Land ${(geo.stat.land * 100).toFixed(0)} % · ${geo.stat.flussZellen} Fluss- · ${geo.stat.seeZellen} See-Zellen · ${(geoMs / 1000).toFixed(1)} s\n` +
    `Dreiecke    ${r.triangles.toLocaleString('de-DE')} · ${r.calls} Draw-Calls · ${fps.toFixed(0)} fps`;
  requestAnimationFrame(bild);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
setzeOrt(P.get('ort') || 'orbit');
if (P.get('nei')) neigung = THREE.MathUtils.degToRad(+P.get('nei'));
if (P.get('ueber')) { setzeGehen(false); cam.setLength(R + boden(cam) + +P.get('ueber')); }   // Testschalter: so viele m über dem Boden schweben   // Testschalter: Blick-Neigung in Grad
// Testschalter: ?wetter=regen|schnee|gewitter|nebel|sturm|klar … und ?uhr=19 (Ortszeit)
if (P.get('wetter')) zw.wetter.setze(P.get('wetter'), true);
// Testschalter ?zeige=<art>: nach dem Laden vor das nächste Stück dieser Art stellen (z. B. ammonit, quarzdruse)
if (P.get('zeige')) setTimeout(() => {
  const ai = STREU_ARTEN.indexOf(P.get('zeige'));
  let best = null, bd = Infinity;
  for (const k of streuDa.values()) for (let i = 0; i < k.anzahl; i++) {
    if (k.daten[i * STRIDE] !== ai) continue;
    const x = k.mitte[0] + k.daten[i * STRIDE + 1], y = k.mitte[1] + k.daten[i * STRIDE + 2], z = k.mitte[2] + k.daten[i * STRIDE + 3];
    const d = Math.hypot(x - cam.x, y - cam.y, z - cam.z);
    if (d < bd) { bd = d; best = new THREE.Vector3(x, y, z); }
  }
  if (!best) return;
  const auf = best.clone().normalize(), seite = new THREE.Vector3(0.3, 1, 0.2).cross(auf).normalize();
  const baum = ZIEL_HOEHE[P.get('zeige')];          // Bäume: aus Abstand ansehen (ganzer Baum im Bild)
  cam.copy(best).addScaledVector(seite, baum ? baum * 0.75 : 1.6).addScaledVector(auf, baum ? 1.7 : 1.8);
  vorn.copy(best).sub(cam).projectOnPlane(auf).normalize();
  neigung = baum ? 0.32 : -0.75;
}, 9000);
// Testschalter ?grabtest=1 (an den Rand einer 4-m-Grube mit Tunnel stellen) | 2 (im Tunnel stehen): Voxel-Graben ansehen
if (P.get('grabtest') && !VOXEL_MODUS) {
  // Feines Höhenfeld: Grube 3 m tief (2 × 4 m) mit Rampe, daneben ein Erdhügel – so wie ein Spieler es gräbt (Schlag für Schlag)
  const auf = cam.clone().normalize(), v = vorn.clone(), q = new THREE.Vector3().crossVectors(auf, v).normalize();
  const dir = (vor, quer) => auf.clone().multiplyScalar(R).addScaledVector(v, vor).addScaledVector(q, quer).normalize();
  const hier = (d) => feld.hoehe(d.x, d.y, d.z);
  const alle = [];
  for (let t = 0; t < 7; t++) for (let a = 0; a <= 4; a += 0.7) for (const b of [-0.7, 0, 0.7]) {
    const d = dir(6 + a, b);
    alle.push(...feld.setze({ typ: 'weg', d: [d.x, d.y, d.z], r: 0.95, ziel: hier(d) - 0.45 }).betroffen);
  }
  for (let a = 0; a < 3; a += 0.5) { const d = dir(6 - a * 0.9, 0); const ziel = hier(dir(6, 0)) + a; alle.push(...feld.setze({ typ: 'weg', d: [d.x, d.y, d.z], r: 0.9, ziel: Math.min(ziel, hier(d)) }).betroffen); }   // Rampe
  for (let t = 0; t < 4; t++) { const d = dir(8, 3.5); alle.push(...feld.setze({ typ: 'fest', d: [d.x, d.y, d.z], r: 1.3, ziel: hier(d) + 0.45 }).betroffen); }
  for (const w of worker) w.postMessage({ art: 'planet', opts: { seed: SEED, radius: R, geo }, eingriffe: eingriffe.zustand(), feld: feld.zustand() });
  setzeGehen(true);
  cam.copy(dir(1.5, -1.2)).multiplyScalar(R + boden(dir(1.5, -1.2)) + AUGE);
  neigung = -0.45;
} else if (P.get('grabtest')) {
  const auf = cam.clone().normalize(), v = vorn.clone();
  const bei = (vor, tief) => { const d = auf.clone().multiplyScalar(R).addScaledVector(v, vor).normalize(); return d.multiplyScalar(R + boden(d) - tief); };
  for (let t = 0; t <= 4; t += 0.5) voxel.eingriff('weg', bei(7, t), 1.4);                 // Grube
  for (let w = 0; w <= 12; w += 0.5) voxel.eingriff('weg', bei(7 + w, 3.2), 1.25);       // Tunnel vom Grubenboden
  setzeGehen(true);
  const stelle = () => {
    if (P.get('grabtest') === '2') { cam.copy(bei(9.5, 3.2 + 1.25 - 0.1)); neigung = -0.1; }
    else { cam.copy(bei(3.2, -AUGE)); neigung = -0.55; }
    if (voxel.info().saeulen < 2) setTimeout(stelle, 400);   // erst wenn die Voxel stehen, sonst hebt der alte Boden einen heraus
  };
  stelle();
}
if (P.get('uhr')) zw.stelleOrtszeit([cam.x / cam.length(), cam.y / cam.length(), cam.z / cam.length()], +P.get('uhr'));
requestAnimationFrame(bild);
