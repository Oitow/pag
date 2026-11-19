/**
 * @modul    laub-karten
 * @zweck    Dichtes Laub als EIN instanziertes Mesh aus Blatt-Karten (zur Kamera gedreht): Blatt-Silhouette prozedural im Fragment-Shader (keine Textur), Alpha-Test bzw. alphaToCoverage, Richtungslicht mit Durchscheinen zur Sonne, dunkler Kern, Wind, exp²-Nebel + eigener Höhendunst
 * @api      createLaubKarten({ karten, sonne: Vector3, sonnenFarbe: Color, umgebung: Color, boden: Color, blatt = 0.6, hoehenDunst = { ab: 60, bis: 170, max: 0.4 }, wind = 1, alphaToCoverage = false }) -> { mesh, material, anzahl, setzeLicht({ sonne, farbe, umgebung, boden }), update(zeit), dispose() }
 * @beispiel
 *   import { createLaubKarten } from '../../engine/render/laub-karten.js';
 *   const laub = createLaubKarten({ karten, sonne: new THREE.Vector3(0.5, 0.4, -0.8).normalize(), sonnenFarbe: new THREE.Color(0.7, 0.6, 0.5), umgebung: new THREE.Color(0.25, 0.32, 0.33) });
 *   szene.add(laub.mesh);                                 // karten aus engine/models/natur/laub-klumpen.js (sammleKarten → Welt)
 *   laub.setzeLicht({ sonne: neueRichtung });             // Tag-Nacht: je Bild setzbar (Richtung ZUR Sonne, Farben linear inkl. Stärke)
 *   laub.update(zeit);                                    // Wind
 * @tags     natur, laub, blatt, karten, instanziert, shader, alpha, transluzenz, wind, krone, render
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
// alphaToCoverage nur bewusst einschalten: im Software-Renderer (SwiftShader) gab es damit helle 1-px-Umrisslinien; Alpha-Test ist sauber.

const VERT = /* glsl */`
attribute vec3 iMitte, iNormale, iFarbe, iDaten;
uniform float uZeit, uWind;
varying vec2 vUv; varying vec3 vFarbe, vN, vBeule, vW; varying float vTief, vSkala, vSaat;
#include <fog_pars_vertex>
void main() {
  float g = iDaten.x, ph = iDaten.z * 6.2831;
  vec3 rechts = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), oben = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float c = cos(ph), s = sin(ph);
  vec2 q = vec2(c * position.x - s * position.y, s * position.x + c * position.y);   // je Karte gedreht → Blattmuster wiederholt sich nicht
  vec3 m = iMitte;
  m.xz += uWind * g * 0.06 * vec2(sin(uZeit * 0.7 + ph + m.y * 0.05), cos(uZeit * 0.53 + ph * 1.3));
  vec3 w = m + (rechts * position.x + oben * position.y) * g;
  vUv = q; vFarbe = iFarbe; vN = iNormale; vBeule = rechts * position.x + oben * position.y; vW = w; vTief = iDaten.y; vSkala = g; vSaat = iDaten.z;
  vec4 mvPosition = viewMatrix * vec4(w, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */`
uniform vec3 uSonne, uSonnenFarbe, uUmgebung, uBoden, uDunst;
uniform float uBlatt;
varying vec2 vUv; varying vec3 vFarbe, vN, vBeule, vW; varying float vTief, vSkala, vSaat;
#include <fog_pars_fragment>
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float r = length(vUv), wink = atan(vUv.y, vUv.x);
  // Umriss des Klumpens: gelappt, nie rund
  float rand = 0.8 + 0.1 * sin(wink * 5.0 + vSaat * 40.0) + 0.06 * sin(wink * 11.0 + vSaat * 91.0) + 0.04 * sin(wink * 23.0 + vSaat * 57.0);
  float huelle = r - rand;
  // Blätter: drei versetzte Zellraster, je Zelle ein spitzes Blatt mit Zufallsdrehung
  vec2 p = vUv * vSkala / uBlatt;
  float best = 1e3, ton = 0.5;
  for (int k = 0; k < 3; k++) {
    vec2 pp = p + vec2(float(k) * 0.47, float(k) * 0.31) + vSaat * 17.0, z = floor(pp), f = fract(pp) - 0.5;
    float a = h21(z + float(k) * 7.3) * 6.2831, ca = cos(a), sa = sin(a);
    f -= (vec2(h21(z + 3.1), h21(z + 5.7)) - 0.5) * 0.18;
    vec2 b = vec2(ca * f.x - sa * f.y, sa * f.x + ca * f.y) / 0.46;
    float breit = mix(0.62, 0.36, smoothstep(0.2, 0.9, r));            // innen breitere Blätter = dichter
    float d = (abs(b.y) - breit * (1.0 - b.x * b.x)) * 0.46;
    if (abs(b.x) > 1.0) d = max(d, (abs(b.x) - 1.0) * 0.46);
    if (d < best) { best = d; ton = h21(z + 11.0 + float(k)); }
  }
  float fwB = max(length(fwidth(p)), 1e-4), fwH = max(length(fwidth(vUv)), 1e-4);   // stetige Ableitungen (Zellgrenzen/atan springen)
  float aBlatt = clamp(0.5 - best / fwB, 0.0, 1.0);
  aBlatt = mix(aBlatt, 1.0, smoothstep(0.14, 0.42, fwB));        // fern: Blätter < 2 px → geschlossene Fläche statt Flimmern
  float a = aBlatt * clamp(0.5 - huelle / fwH, 0.0, 1.0);
  #ifdef MIT_A2C
    a = clamp((a - 0.5) / max(fwidth(a), 1e-4) + 0.5, 0.0, 1.0);    // geschärftes Alpha-to-Coverage: deckend, nur 1 px weiche Kante
    if (a < 0.02) discard;
  #else
    if (a < 0.5) discard;
    a = 1.0;
  #endif
  // Licht: Kartennormale + Wölbung des Klumpens + Blattneigung
  vec3 n = normalize(vN + vBeule * 0.55 + (vec3(h21(vec2(ton, 1.0)), h21(vec2(ton, 2.0)), h21(vec2(ton, 3.0))) - 0.5) * 0.5);
  vec3 L = normalize(uSonne), V = normalize(vW - cameraPosition);
  float innen = mix(0.38, 1.0, vTief) * mix(0.75, 1.0, smoothstep(0.0, 0.7, r));     // Kern und Klumpenmitte dunkler
  float diff = max(dot(n, L) * 0.65 + 0.35, 0.0); diff *= diff;
  vec3 umg = mix(uBoden, uUmgebung, n.y * 0.5 + 0.5);
  float durch = pow(max(dot(V, L), 0.0), 5.0) * (0.35 + 0.65 * smoothstep(0.35, 1.0, r)) * vTief;   // Gegenlicht scheint am Rand durch
  vec3 albedo = vFarbe * (0.82 + 0.36 * ton);
  vec3 farbe = albedo * (umg * innen + uSonnenFarbe * diff * innen * vTief) + albedo * vec3(1.25, 1.5, 0.55) * uSonnenFarbe * durch * 1.6;
  farbe *= mix(0.72, 1.0, smoothstep(0.0, 0.1, -huelle));               // Klumpenrand dunkler → keine hellen Umrisslinien
  gl_FragColor = vec4(farbe, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #ifdef USE_FOG
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, smoothstep(uDunst.x, uDunst.y, vW.y) * uDunst.z);
  #endif
  #include <fog_fragment>
}`;

/** Laub-Mesh aus Karten (laub-klumpen.js, Weltkoordinaten). Ein Draw-Call, keine Textur. */
export function createLaubKarten({ karten, sonne = new THREE.Vector3(0.5, 0.5, -0.7), sonnenFarbe = new THREE.Color(0.7, 0.62, 0.52), umgebung = new THREE.Color(0.22, 0.3, 0.31),
  boden = new THREE.Color(0.06, 0.07, 0.06), blatt = 0.6, hoehenDunst = { ab: 60, bis: 170, max: 0.4 }, wind = 1, alphaToCoverage = false } = {}) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const n = karten.anzahl;
  geo.setAttribute('iMitte', new THREE.InstancedBufferAttribute(karten.mitte.subarray(0, n * 3), 3));
  geo.setAttribute('iNormale', new THREE.InstancedBufferAttribute(karten.normale.subarray(0, n * 3), 3));
  geo.setAttribute('iFarbe', new THREE.InstancedBufferAttribute(karten.farbe.subarray(0, n * 3), 3));
  geo.setAttribute('iDaten', new THREE.InstancedBufferAttribute(karten.daten.subarray(0, n * 3), 3));
  geo.instanceCount = n;
  // Grenzkugel aus den Kartenmitten (sonst schneidet three das Mesh am Ursprungs-Viereck ab)
  const box = new THREE.Box3(), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) box.expandByPoint(v.fromArray(karten.mitte, i * 3));
  geo.boundingSphere = n ? box.getBoundingSphere(new THREE.Sphere()) : new THREE.Sphere(new THREE.Vector3(), 1);
  geo.boundingSphere.radius += 12;

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, fog: true, side: THREE.DoubleSide, alphaToCoverage,
    defines: alphaToCoverage ? { MIT_A2C: '' } : {},
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uZeit: { value: 0 }, uWind: { value: wind }, uBlatt: { value: blatt },
      uSonne: { value: new THREE.Vector3() }, uSonnenFarbe: { value: new THREE.Color() }, uUmgebung: { value: new THREE.Color() }, uBoden: { value: new THREE.Color() },
      uDunst: { value: new THREE.Vector3(hoehenDunst.ab, hoehenDunst.bis, hoehenDunst.max) },
    }]),
  });
  const u = material.uniforms;
  /** Licht je Bild setzbar (Tag-Nacht): sonne = Richtung ZUR Sonne, Farben linear inkl. Stärke. Fehlende Werte bleiben. */
  function setzeLicht({ sonne: s, farbe, umgebung: um, boden: bo } = {}) {
    if (s) u.uSonne.value.copy(s).normalize();
    if (farbe) u.uSonnenFarbe.value.copy(farbe);
    if (um) u.uUmgebung.value.copy(um);
    if (bo) u.uBoden.value.copy(bo);
  }
  setzeLicht({ sonne, farbe: sonnenFarbe, umgebung, boden });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'laub-karten';
  return {
    mesh, material, anzahl: n, setzeLicht,
    update(zeit) { u.uZeit.value = zeit; },
    dispose() { mesh.removeFromParent(); geo.dispose(); material.dispose(); },
  };
}
