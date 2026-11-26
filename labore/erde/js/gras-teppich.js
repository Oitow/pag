// Gras-Teppich für Wildgrund: Gras überall, komplett auf der Grafikkarte – keine Instanz-Matrizen, kein Neuaufbau in JS.
//
// So geht es:
// 1) Höhenkarte: Die Gelände-Kacheln (Ebene 5) werden ab und zu von oben (Orthokamera) in zwei kleine Bilder gezeichnet:
//    A = Höhe (16 Bit in R+G, linear filterbar, weil hi·256+lo linear ist), Gras-Menge, Trockenheit · B = Bodenfarbe.
//    → Halme stehen genau auf dem GEZEICHNETEN Boden (auch an Böschungen, nach LOD-Wechsel), nicht unter Wasser, nicht in Gruben.
// 2) Halme: je Ring ein Gitter K×K um die Kamera (InstancedBufferGeometry, nur Zellennummern). Der Vertex-Shader legt
//    jede Zelle in ein weltfestes Raster (Anker A), würfelt Lage/Höhe/Neigung aus einem Ganzzahl-Hash, liest Höhe/Menge
//    aus Bild A und baut die Halme. Nah: feines Raster, mehr Halme, mehr Segmente; fern: grobes Raster, breitere Halme.
//    Ringe blenden mit Zufallsraster ineinander, am Rand schrumpft das Gras weg (Boden-Shader hat dort schon Grasfarbe).
// 3) Licht: MeshLambert (Sonne, Himmel, Schatten, Dunst wie alles andere) + Durchscheinen gegen die Sonne.
// Kosten je Bild: ein paar Uniforms. Höhenkarte: 2 kleine Renderdurchgänge alle ~20 m Bewegung bzw. wenn sich das Netz ändert.
import * as THREE from 'three';

export const GRAS_EBENE = 5;   // Layer der Gelände-Kacheln für den Höhenkarten-Durchgang

// Ringe je Stufe: abst = Raster (m), bis = Außenradius (m), halme je Zelle, seg = Segmente je Halm
export const GRAS_STUFEN = [
  null,                                                                                                    // 0: aus
  { res: 512,  ringe: [{ abst: 0.4, bis: 12, halme: 3, seg: 2 }, { abst: 0.85, bis: 32, halme: 3, seg: 1 }] },
  { res: 512,  ringe: [{ abst: 0.32, bis: 15, halme: 3, seg: 2 }, { abst: 0.65, bis: 38, halme: 3, seg: 1 }, { abst: 1.3, bis: 70, halme: 2, seg: 1 }] },
  { res: 1024, ringe: [{ abst: 0.26, bis: 19, halme: 3, seg: 3 }, { abst: 0.52, bis: 45, halme: 3, seg: 2 }, { abst: 1.05, bis: 90, halme: 3, seg: 1 }] },
  { res: 1024, ringe: [{ abst: 0.2, bis: 24, halme: 4, seg: 3 }, { abst: 0.42, bis: 55, halme: 3, seg: 2 }, { abst: 0.85, bis: 120, halme: 3, seg: 1 }] },
];

const H_BEREICH = 512;   // Höhe in Bild A: ±512 m um die Kamera (1,6 cm Schritte)

function halmGeometrie(K, halme, seg) {
  // Ein Grasbüschel = `halme` Halme; Halm = seg Segmente (Paare links/rechts) + Spitze. halm = (Nummer, t 0…1, Seite −1/0/1)
  const h = [], idx = [];
  for (let b = 0; b < halme; b++) {
    const s0 = h.length / 3;
    for (let k = 0; k < seg; k++) { const t = k / seg; h.push(b, t, -1, b, t, 1); }
    h.push(b, 1, 0);
    for (let k = 0; k < seg - 1; k++) { const a = s0 + k * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    const a = s0 + (seg - 1) * 2; idx.push(a, a + 1, a + 2);
  }
  const g = new THREE.InstancedBufferGeometry();
  const n = h.length / 3;
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));   // Pflicht für THREE, Lage kommt aus dem Shader
  g.setAttribute('halm', new THREE.BufferAttribute(new Float32Array(h), 3));
  g.setIndex(idx);
  const z = new Float32Array(K * K * 2);
  for (let j = 0, q = 0; j < K; j++) for (let i = 0; i < K; i++) { z[q++] = i - (K >> 1); z[q++] = j - (K >> 1); }
  g.setAttribute('zelle', new THREE.InstancedBufferAttribute(z, 2));
  g.instanceCount = K * K;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
  return g;
}

const GRAS_VERT_KOPF = /* glsl */`
attribute vec3 halm; attribute vec2 zelle;
uniform sampler2D uKarteA, uKarteB;
uniform vec3 uU, uT1, uT2, uRef, uWindRicht;
uniform vec2 uCamGitter, uRefGitter;
uniform float uS, uAbst, uVon, uVonBand, uBis, uBisBand, uBreite, uHoehe, uZeit, uWind, uAus;
varying float vT;
uint grHash(uvec2 v) {
  v = v * 1664525u + 1013904223u; v.x += v.y * 1664525u; v.y += v.x * 1664525u; v ^= v >> 16u;
  v.x += v.y * 1664525u; v.y += v.x * 1664525u; v ^= v >> 16u; return v.x ^ v.y;
}
float gr01(uvec2 z, uint s) { return float(grHash(z + uvec2(s * 7919u, s * 104729u)) & 0xffffffu) / 16777216.0; }
float grRausch(vec2 p) {   // Wertrauschen fürs Büschel-Muster (Flecken dicht/licht)
  vec2 i = floor(p), f = p - i; f = f * f * (3.0 - 2.0 * f); uvec2 u = uvec2(ivec2(i));
  return mix(mix(gr01(u, 91u), gr01(u + uvec2(1u, 0u), 91u), f.x), mix(gr01(u + uvec2(0u, 1u), 91u), gr01(u + uvec2(1u, 1u), 91u), f.x), f.y);
}
`;

const GRAS_VERT = /* glsl */`
vec3 grasPos = vec3(0.0), grasNorm = uU;
vT = halm.y;
{
  ivec2 zi = ivec2(floor(uCamGitter / uAbst) + zelle);
  uvec2 zu = uvec2(zi);
  uint b = uint(halm.x + 0.5);
  vec2 gP = (vec2(zi) + vec2(gr01(zu, 1u), gr01(zu, 2u))) * uAbst;        // Büschel-Mitte, weltfest (Anker-Ebene)
  vec2 off = (vec2(gr01(zu, 20u + b), gr01(zu, 30u + b)) - 0.5) * uAbst * 0.8;
  vec2 hP = gP + off;                                                      // Halm-Fuß
  vec2 rel = hP - uCamGitter;
  float d = length(rel);
  vec2 refP = hP - uRefGitter;
  vec2 uv = 0.5 + refP / uS;
  // Ring: innen einblenden (wo der feinere Ring ausblendet), außen ausblenden – erst danach Bild lesen (spart die meisten Zugriffe)
  float wIn = uVonBand > 0.0 ? smoothstep(uVon - uVonBand, uVon, d) : 1.0;
  float wAus = 1.0 - smoothstep(uBis - uBisBand, uBis, d);
  float sicht = step(gr01(zu, 4u), wIn * wAus) * step(max(abs(uv.x - 0.5), abs(uv.y - 0.5)), 0.495) * step(uAus, 0.99);
  // hinter der Kamera (Höhe grob = Augenhöhe): weglassen – spart rund die Hälfte der Arbeit
  vec4 vGrob = viewMatrix * vec4(uRef + uT1 * refP.x + uT2 * refP.y, 1.0);
  sicht *= step(vGrob.z, 2.5 + uAbst * 2.0);
  vec4 A = vec4(0.0);
  if (sicht > 0.5) {
    A = textureLod(uKarteA, uv, 0.0);
    float menge = A.b * (0.45 + 1.1 * grRausch(gP * 0.16)) * (0.75 + 0.5 * grRausch(gP * 0.9 + 17.0));
    sicht = step(gr01(zu, 3u), menge);
  }
  float hRel = (A.r * 65280.0 + A.g * 255.0) / 65535.0 * ${(2 * H_BEREICH).toFixed(1)} - ${H_BEREICH.toFixed(1)};
  if (sicht > 0.5) {
    float ang = gr01(zu, 10u + b) * 6.2832;
    vec3 seit = uT1 * cos(ang) + uT2 * sin(ang);
    vec3 vor = cross(uU, seit);
    float rand = smoothstep(uBis, uBis - uBisBand * 2.0, d);                 // am äußersten Rand kleiner werden
    float hoehe = uHoehe * (0.5 + 0.85 * gr01(zu, 40u + b)) * (0.55 + 0.6 * A.b) * (0.35 + 0.65 * rand) * (1.0 - uAus);   // uAus: beim Hochfliegen sanft einziehen
    float breite = uBreite * (0.7 + 0.6 * gr01(zu, 50u + b));
    // Neigung: eigene Richtung + Wind (große Böen-Wellen übers Feld + Zittern)
    vec3 wd = uWindRicht - uU * dot(uWindRicht, uU);
    float boe = 0.5 + 0.5 * sin(uZeit * 1.3 - dot(hP, vec2(0.23, 0.17)) * (1.0 + 0.3 * sin(uZeit * 0.11)));
    float zittern = sin(uZeit * (5.0 + 3.0 * gr01(zu, 60u + b)) + gr01(zu, 61u + b) * 6.28) * 0.12;
    vec3 neig = vor * (gr01(zu, 70u + b) - 0.5) * 0.9 + wd * uWind * (0.15 + 0.65 * boe * boe) + seit * zittern * uWind;
    float t = halm.y;
    float biege = t * t;
    vec3 fuss = uRef + uT1 * refP.x + uT2 * refP.y + uU * (hRel - 0.03);
    grasPos = fuss + uU * hoehe * t * (1.0 - 0.3 * biege * min(1.0, length(neig))) + neig * hoehe * biege
            + seit * breite * halm.z * (1.0 - t * 0.8);
    grasNorm = normalize(uU + 0.45 * normalize(neig + vor * 0.3));
    // Farbe: Bodenfarbe mit Grasfarbe gemischt (frisch ↔ Stroh), unten dunkel (Verdeckung im Büschel), Spitze heller
    vec3 boden = textureLod(uKarteB, uv, 0.0).rgb;
    vec3 gras = mix(vec3(0.07, 0.19, 0.025), vec3(0.36, 0.3, 0.1), clamp(A.a + 0.3 * (grRausch(gP * 0.07 + 3.0) - 0.5), 0.0, 1.0));
    vec3 c = mix(boden, gras, 0.72) * (0.8 + 0.4 * gr01(zu, 80u + b));
    c *= mix(0.32, 1.0, smoothstep(0.0, 0.7, t)) * (1.0 + 0.18 * t * t);
    vColor = c;
  } else vColor = vec3(0.0);
}
`;

const KARTE_VERT = /* glsl */`
attribute float nass; attribute vec2 gras;
uniform vec3 uU;
varying float vH, vNass; varying vec2 vGras; varying vec3 vFarbe; varying vec3 vRelW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vRelW = w.xyz; vH = dot(w.xyz, uU); vNass = nass; vGras = gras;
#ifdef USE_COLOR
  vFarbe = color;
#else
  vFarbe = vec3(0.5);
#endif
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export function createGrasTeppich({ renderer, scene, loch = null }) {
  const gruppe = new THREE.Group();
  gruppe.frustumCulled = false;
  scene.add(gruppe);
  const lochU = loch?.uniforms || {}, lochGlsl = loch?.glsl || 'varying vec3 vRelW;\nbool imLoch(vec3 p) { return false; }\n';

  // --- Höhenkarte ---
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);
  ortho.layers.set(GRAS_EBENE);
  const kU = { uU: { value: new THREE.Vector3(0, 1, 0) } };
  const matA = new THREE.ShaderMaterial({
    uniforms: { ...kU, ...lochU }, vertexColors: true, vertexShader: KARTE_VERT,
    fragmentShader: /* glsl */`varying float vH, vNass; varying vec2 vGras; varying vec3 vFarbe;
${lochGlsl}
void main() {
  float menge = vGras.x * (1.0 - smoothstep(0.488, 0.5, vNass));   // 0.502 = Uferlinie: am Wasser kein Gras
  if (imLoch(vRelW)) menge = 0.0;
  float t = clamp((vH + ${H_BEREICH.toFixed(1)}) / ${(2 * H_BEREICH).toFixed(1)}, 0.0, 1.0) * 65535.0;
  float hi = floor(t / 256.0);
  gl_FragColor = vec4(hi / 255.0, (t - hi * 256.0) / 255.0, menge, vGras.y);
}` });
  const matB = new THREE.ShaderMaterial({ uniforms: { ...kU }, vertexColors: true, vertexShader: KARTE_VERT,
    fragmentShader: 'varying vec3 vFarbe;\nvoid main() { gl_FragColor = vec4(vFarbe, 1.0); }' });
  let rtA = null, rtB = null;
  const ziel = (res) => new THREE.WebGLRenderTarget(res, res, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: true });

  // --- Halme ---
  const gemeinsam = {
    uKarteA: { value: null }, uKarteB: { value: null }, uU: kU.uU, uT1: { value: new THREE.Vector3(1, 0, 0) }, uT2: { value: new THREE.Vector3(0, 0, 1) },
    uRef: { value: new THREE.Vector3() }, uWindRicht: { value: new THREE.Vector3(1, 0, 0) }, uCamGitter: { value: new THREE.Vector2() },
    uRefGitter: { value: new THREE.Vector2() }, uS: { value: 256 }, uZeit: { value: 0 }, uWind: { value: 0.3 }, uAus: { value: 1 },
  };
  let ringe = [], stufe = 0, S = 256;
  function baueRinge(n) {
    for (const r of ringe) { gruppe.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); }
    ringe = [];
    rtA?.dispose(); rtB?.dispose(); rtA = rtB = null;
    stufe = n;
    const st = GRAS_STUFEN[n];
    if (!st) return;
    const bisMax = st.ringe[st.ringe.length - 1].bis;
    S = Math.ceil(((bisMax + 4) * 2) / 0.76);
    rtA = ziel(st.res); rtB = ziel(st.res);
    gemeinsam.uKarteA.value = rtA.texture; gemeinsam.uKarteB.value = rtB.texture; gemeinsam.uS.value = S;
    let von = 0, vonBand = 0;
    st.ringe.forEach((rg) => {
      const band = Math.max(2.5, rg.bis * 0.14);
      const K = Math.ceil((2 * (rg.bis + rg.abst)) / rg.abst) + 2;
      const eigen = { uAbst: { value: rg.abst }, uVon: { value: von }, uVonBand: { value: vonBand }, uBis: { value: rg.bis }, uBisBand: { value: band },
        uBreite: { value: 0.022 * Math.pow(rg.abst / 0.26, 0.75) * (4 / (rg.halme + 1)) }, uHoehe: { value: 0.42 } };
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
      mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, gemeinsam, eigen);
        sh.vertexShader = GRAS_VERT_KOPF + sh.vertexShader
          .replace('#include <color_vertex>', '#include <color_vertex>\n' + GRAS_VERT)
          .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = grasNorm;')
          .replace('#include <begin_vertex>', 'vec3 transformed = grasPos;');
        sh.fragmentShader = 'varying float vT;\n' + sh.fragmentShader
          // beide Seiten gleich beleuchtet (Normale zeigt immer nach oben, nicht zur Kamera geklappt)
          .replace('#include <normal_fragment_begin>', 'float faceDirection = 1.0;\nvec3 normal = normalize(vNormal);\nvec3 nonPerturbedNormal = normal;')
          .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
#if NUM_DIR_LIGHTS > 0
{ // Gegenlicht: Sonne hinter dem Halm → Spitzen leuchten grün-gelb durch
  float tr = pow(max(dot(normalize(-vViewPosition), -directionalLights[0].direction), 0.0), 4.0);
  reflectedLight.directDiffuse += diffuseColor.rgb * vec3(1.1, 1.25, 0.6) * directionalLights[0].color * tr * vT * vT * 0.45;
}
#endif`);
      };
      mat.customProgramCacheKey = () => 'gras-teppich-1';
      const mesh = new THREE.Mesh(halmGeometrie(K, rg.halme, rg.seg), mat);
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.matrixAutoUpdate = false;
      gruppe.add(mesh);
      ringe.push({ mesh, K, halme: rg.halme, seg: rg.seg });
      von = rg.bis; vonBand = band;
    });
  }

  // --- Lage ---
  const anker = new THREE.Vector3(), ref = new THREE.Vector3(), d = new THREE.Vector3();
  let hatAnker = false, hatKarte = false, karteT = 99, schmutzig = true;
  const altBg = { c: new THREE.Color() };
  function neuerAnker(cam) {
    anker.copy(cam); hatAnker = true; hatKarte = false;
    const U = kU.uU.value.copy(cam).normalize();
    const hilf = Math.abs(U.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    gemeinsam.uT2.value.crossVectors(U, hilf).normalize();
    gemeinsam.uT1.value.crossVectors(gemeinsam.uT2.value, U).normalize();   // = Bild-x der Orthokamera (up = T2, Blick −U)
  }
  const gitter = (p, out) => { d.subVectors(p, anker); return out.set(d.dot(gemeinsam.uT1.value), d.dot(gemeinsam.uT2.value)); };

  function zeichneKarte(cam) {
    ref.copy(cam);
    gitter(ref, gemeinsam.uRefGitter.value);
    const U = kU.uU.value;
    ortho.left = -S / 2; ortho.right = S / 2; ortho.top = S / 2; ortho.bottom = -S / 2;
    ortho.position.copy(U).multiplyScalar(1500);
    ortho.up.copy(gemeinsam.uT2.value);
    ortho.lookAt(0, 0, 0);
    ortho.updateProjectionMatrix(); ortho.updateMatrixWorld();
    const bg = scene.background, ov = scene.overrideMaterial, ziel0 = renderer.getRenderTarget();
    const sAuto = renderer.shadowMap.autoUpdate, sNeu = renderer.shadowMap.needsUpdate;
    renderer.getClearColor(altBg.c); const alpha = renderer.getClearAlpha();
    scene.background = null; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
    renderer.setClearColor(0x000000, 0);
    scene.overrideMaterial = matA; renderer.setRenderTarget(rtA); renderer.clear(); renderer.render(scene, ortho);
    scene.overrideMaterial = matB; renderer.setRenderTarget(rtB); renderer.clear(); renderer.render(scene, ortho);
    scene.overrideMaterial = ov; scene.background = bg; renderer.setRenderTarget(ziel0);
    renderer.setClearColor(altBg.c, alpha);
    renderer.shadowMap.autoUpdate = sAuto; renderer.shadowMap.needsUpdate = sNeu;
    hatKarte = true; karteT = 0; schmutzig = false;
  }

  const tmp2 = new THREE.Vector2();
  /** Jedes Bild. cam = Weltlage (Kamera im Ursprung gezeichnet), an = Gras zeigen, aus 0…1 = einziehen (Höhe), wind 0…2, windRicht = Weltvektor. */
  function update(dt, cam, { an = true, aus = 0, zeit = 0, wind = 0.5, windRicht = null } = {}) {
    gruppe.visible = an && stufe > 0 && aus < 0.99;
    if (!gruppe.visible) return;
    if (!hatAnker || cam.distanceTo(anker) > 900) neuerAnker(cam);
    karteT += dt;
    gitter(cam, gemeinsam.uCamGitter.value);
    // Karte neu: wenn die Kamera aus der Mitte wandert, oder das Netz sich änderte (höchstens alle 0,4 s)
    const weg = hatKarte ? tmp2.copy(gemeinsam.uCamGitter.value).sub(gemeinsam.uRefGitter.value).length() : Infinity;
    if (!hatKarte || weg > S * 0.1 || (schmutzig && karteT > 0.4) || karteT > 4) zeichneKarte(cam);
    gemeinsam.uRef.value.subVectors(ref, cam);
    gemeinsam.uZeit.value = zeit;
    gemeinsam.uWind.value = wind;
    if (windRicht) gemeinsam.uWindRicht.value.copy(windRicht);
    gemeinsam.uAus.value = aus;
  }
  /** Gelände hat sich geändert (Kacheln getauscht, gegraben) → Höhenkarte bald neu. */
  const neu = () => { schmutzig = true; };
  function setzeStufe(n) { if (n !== stufe) baueRinge(n); }
  function dispose() { baueRinge(0); matA.dispose(); matB.dispose(); scene.remove(gruppe); }
  return { update, neu, setzeStufe, dispose, gruppe, get info() {
    let dr = 0;
    for (const r of ringe) dr += r.K * r.K * r.halme * (2 * r.seg - 1);
    return { stufe, dreieckeMax: dr };
  } };
}
