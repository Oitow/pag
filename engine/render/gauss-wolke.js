/**
 * @modul    gauss-wolke
 * @zweck    Echte 3D-Gauß-Splats, prozedural befüllt: jeder Splat ist ein Ellipsoid (Mitte, 3 Standardabweichungen, Drehung, Farbe, Deckkraft), gezeichnet als instanziertes Viereck mit 3D→2D-Kovarianz, vormultipliziertem Alpha und Tiefen-Sortierung – Meshes verdecken Splats korrekt
 * @api      createGaussWolke({ max = 120000, sortiereAlle = 3, maxPixel = 220 }) -> { mesh, anzahl, max, fuege(daten, { matrix = null, anteil = 1 }) -> anzahl neu, leere(), setze({ nebelFarbe, nebelDichte, licht, wind }), update(kamera, zeit, breitePx, hoehePx), dispose() }
 * @beispiel
 *   import { createGaussWolke } from '../../engine/render/gauss-wolke.js';
 *   const wolke = createGaussWolke({ max: 90000 });
 *   szene.add(wolke.mesh);
 *   wolke.fuege(baum.splats, { matrix: baumMatrix, anteil: 0.7 });      // daten aus gauss-saat.js (lokal) → Welt
 *   wolke.setze({ nebelFarbe: szene.fog.color, nebelDichte: szene.fog.density, licht: [1.1, 0.95, 0.8], wind: 0.6 });
 *   // je Bild VOR renderer.render: wolke.update(kamera, zeit, canvas.width, canvas.height);
 * @tags     splat, gauss, gaussian, 3dgs, wolke, instanziert, shader, transparenz, moos, laub, dunst
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
// Sortier-Variante: Die Splat-Daten liegen EINMAL in einer Float-Textur (4 Texel je Splat) und werden nie umkopiert.
// Sortiert wird nur EIN Uint32-Instanz-Attribut `nr` (4 Byte je Splat ≈ 0.5 MB bei 120 k); umgepackte Attribute wären
// 60 Byte je Splat ≈ 7 MB Upload je Sortierung – am Handy ist der Puffer-Upload der Engpass, nicht die 4 texelFetch im Vertex-Shader.
// Die Tiefe entlang der Blickrichtung hängt nur von der Blick-RICHTUNG ab (der Augpunkt verschiebt alle Tiefen gleich),
// deshalb löst reines Gehen keine neue Sortierung aus – nur Drehen (> ~0.5°) oder neue Daten.
import * as THREE from 'three';
import { createTiefenSortierer } from './gauss-sortierung.js';

const JE_ZEILE = 512, TEXEL = 4, FLOATS = 16;         // Textur 2048 breit: Mitte+Wind | Skala+Deck | Drehung | Farbe
const DREH_SCHWELLE = 0.99996;                         // cos(~0.5°)

const VS = /* glsl */`
  uniform highp sampler2D tDaten;
  uniform vec2 uBild; uniform float uMaxPixel; uniform float uZeit; uniform float uWind;
  uniform vec3 uLicht; uniform vec3 uNebelFarbe; uniform float uNebelDichte;
  attribute uint nr;
  varying vec3 vFarbe; varying vec3 vQ;                // vQ.xy = Abstand in Sigma, vQ.z = Deckkraft
  void main() {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);            // „verworfen“ = außerhalb des Sichtvolumens
    int i = int(nr);
    ivec2 k = ivec2((i % ${JE_ZEILE}) * ${TEXEL}, i / ${JE_ZEILE});
    vec4 mw = texelFetch(tDaten, k, 0);
    vec4 sd = texelFetch(tDaten, k + ivec2(1, 0), 0);
    vec4 q = texelFetch(tDaten, k + ivec2(2, 0), 0);
    vec3 farbe = texelFetch(tDaten, k + ivec2(3, 0), 0).rgb;
    vec3 p = mw.xyz;
    float w = mw.w * uWind;
    if (w > 0.0) {                                     // sanftes Wiegen: Böe (langsam, groß) + Zittern (schnell, klein)
      float boe = sin(uZeit * 0.45 + p.x * 0.05 + p.z * 0.04);
      vec3 s = vec3(sin(uZeit * 1.3 + p.x * 0.35 + p.z * 0.27 + p.y * 0.2), 0.35 * sin(uZeit * 1.7 + p.y * 0.4 + p.x * 0.3), cos(uZeit * 1.1 + p.z * 0.31 - p.x * 0.2));
      p += (s * 0.07 + vec3(0.1, 0.0, 0.06) * boe) * w;
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float tz = -mv.z;
    if (tz < 0.05) return;
    float x = q.x, y = q.y, z = q.z, qw = q.w;
    mat3 R = mat3(1.0 - 2.0 * (y * y + z * z), 2.0 * (x * y + qw * z), 2.0 * (x * z - qw * y),
                  2.0 * (x * y - qw * z), 1.0 - 2.0 * (x * x + z * z), 2.0 * (y * z + qw * x),
                  2.0 * (x * z + qw * y), 2.0 * (y * z - qw * x), 1.0 - 2.0 * (x * x + y * y));
    mat3 M = mat3(modelViewMatrix) * R;
    M[0] *= sd.x; M[1] *= sd.y; M[2] *= sd.z;
    mat3 S = M * transpose(M);                         // 3D-Kovarianz im Kameraraum
    float px = projectionMatrix[0][0], py = projectionMatrix[1][1];
    float fx = px * uBild.x * 0.5, fy = py * uBild.y * 0.5;
    float tx = clamp(mv.x / tz, -1.3 / px, 1.3 / px), ty = clamp(mv.y / tz, -1.3 / py, 1.3 / py);
    vec3 j0 = vec3(fx / tz, 0.0, fx * tx / tz), j1 = vec3(0.0, fy / tz, fy * ty / tz);   // Jacobi-Zeilen der Projektion (Pixel)
    vec3 s0 = S * j0, s1 = S * j1;
    float a = dot(j0, s0), b = dot(j0, s1), c = dot(j1, s1);                            // 2D-Kovarianz [a b; b c]
    float det0 = a * c - b * b;
    a += 0.3; c += 0.3;                                // Tiefpass gegen Flimmern …
    float deck = sd.w * sqrt(max(det0, 0.0) / max(a * c - b * b, 1e-6));                // … energieerhaltend
    float mitte = 0.5 * (a + c), r = sqrt(max(0.25 * (a - c) * (a - c) + b * b, 1e-8));
    float l1 = mitte + r, l2 = max(mitte - r, 0.05);
    if (l1 - 0.3 < 0.0136 || deck < 0.004) return;     // kleiner als ~0.7 px (6 Sigma) oder unsichtbar
    vec2 v1 = abs(b) > 1e-5 ? normalize(vec2(b, l1 - a)) : (a >= c ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
    float r1 = sqrt(l1), r2 = sqrt(l2);
    float weite = clamp(sqrt(2.0 * log(deck * 255.0)), 0.6, 3.0);                       // Viereck nur so weit, wie Alpha > 1/255
    float gross = 2.0 * weite * r1;
    if (gross > uMaxPixel) { float kk = uMaxPixel / gross; r1 *= kk; r2 *= kk; deck *= kk; }   // nahe Riesen: kleiner UND blasser
    vec2 versatz = (position.x * r1 * v1 + position.y * r2 * vec2(-v1.y, v1.x)) * weite;
    vec4 clip = projectionMatrix * mv;
    clip.xy += versatz * 2.0 / uBild * clip.w;
    gl_Position = clip;
    vQ = vec3(position.xy * weite, deck);
    float nebel = 1.0 - exp(-uNebelDichte * uNebelDichte * tz * tz);
    vFarbe = mix(farbe * uLicht, uNebelFarbe, nebel);
  }
`;
const FS = /* glsl */`
  varying vec3 vFarbe; varying vec3 vQ;
  void main() {
    float alpha = vQ.z * exp(-0.5 * dot(vQ.xy, vQ.xy));
    if (alpha < 0.0039) discard;
    gl_FragColor = vec4(vFarbe, 1.0);                  // erst Tonemapping + Farbraum auf die reine Farbe (wie bei Meshes) …
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    gl_FragColor = vec4(gl_FragColor.rgb * alpha, alpha);   // … dann vormultiplizieren
  }
`;

/** Splat-Wolke mit festem Budget `max`. `mesh` in die Szene hängen (unverschoben lassen – die Sortierung rechnet in Weltkoordinaten). */
export function createGaussWolke({ max = 120000, sortiereAlle = 3, maxPixel = 220 } = {}) {
  const grenze = Math.max(1, max | 0), zeilen = Math.ceil(grenze / JE_ZEILE);
  const daten = new Float32Array(JE_ZEILE * TEXEL * zeilen * 4);
  const position = new Float32Array(grenze * 3);       // Welt-Mitten für die Sortierung
  const textur = new THREE.DataTexture(daten, JE_ZEILE * TEXEL, zeilen, THREE.RGBAFormat, THREE.FloatType);
  textur.minFilter = textur.magFilter = THREE.NearestFilter;
  textur.generateMipmaps = false;
  textur.needsUpdate = true;

  const geometrie = new THREE.InstancedBufferGeometry();
  geometrie.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  geometrie.setIndex([0, 1, 2, 0, 2, 3]);
  const nummern = new Uint32Array(grenze);
  for (let i = 0; i < grenze; i++) nummern[i] = i;
  const nr = new THREE.InstancedBufferAttribute(nummern, 1);
  nr.setUsage(THREE.DynamicDrawUsage);
  geometrie.setAttribute('nr', nr);
  geometrie.instanceCount = 0;

  const uniforms = {
    tDaten: { value: textur }, uBild: { value: new THREE.Vector2(960, 540) }, uMaxPixel: { value: maxPixel }, uZeit: { value: 0 }, uWind: { value: 0.5 },
    uLicht: { value: new THREE.Vector3(1, 1, 1) }, uNebelFarbe: { value: new THREE.Color(0.5, 0.55, 0.6) }, uNebelDichte: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(geometrie, material);
  mesh.name = 'gauss-wolke';
  mesh.frustumCulled = false;
  mesh.renderOrder = 900;
  mesh.matrixAutoUpdate = false;

  const sortierer = createTiefenSortierer(grenze);
  const blick = [0, 0, -1], auge = [0, 0, 0], letzterBlick = [0, 0, 0];
  const mPos = new THREE.Vector3(), mQuat = new THREE.Quaternion(), mSkala = new THREE.Vector3();
  let anzahl = 0, bild = 0, unsortiert = false;

  function fuege(d, { matrix = null, anteil = 1 } = {}) {
    const n = d && d.anzahl | 0;
    if (!(n > 0) || !(anteil > 0) || anzahl >= grenze) return 0;
    const a = Math.min(1, anteil), e = matrix ? matrix.elements : null;
    let mx = 0, my = 0, mz = 0, mw = 1, ms = 1;
    if (matrix) {                                      // Dreh-Anteil + gleichmäßige Skalierung (Mittel der drei Achsen)
      matrix.decompose(mPos, mQuat, mSkala);
      mx = mQuat.x; my = mQuat.y; mz = mQuat.z; mw = mQuat.w;
      ms = (Math.abs(mSkala.x) + Math.abs(mSkala.y) + Math.abs(mSkala.z)) / 3;
    }
    const start = anzahl;
    for (let i = 0; i < n && anzahl < grenze; i++) {
      if (Math.floor((i + 1) * a + 1e-9) === Math.floor(i * a + 1e-9)) continue;       // gleichmäßig ausdünnen, deterministisch
      const i3 = i * 3, i4 = i * 4, o = anzahl * FLOATS, p3 = anzahl * 3;
      let x = d.position[i3], y = d.position[i3 + 1], z = d.position[i3 + 2];
      let qx = d.drehung[i4], qy = d.drehung[i4 + 1], qz = d.drehung[i4 + 2], qw = d.drehung[i4 + 3];
      if (e) {
        const wx = e[0] * x + e[4] * y + e[8] * z + e[12], wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14];
        x = wx; y = wy; z = wz;
        const rx = mw * qx + mx * qw + my * qz - mz * qy, ry = mw * qy - mx * qz + my * qw + mz * qx;
        const rz = mw * qz + mx * qy - my * qx + mz * qw, rw = mw * qw - mx * qx - my * qy - mz * qz;
        qx = rx; qy = ry; qz = rz; qw = rw;
      }
      const ql = Math.hypot(qx, qy, qz, qw) || 1;
      position[p3] = x; position[p3 + 1] = y; position[p3 + 2] = z;
      daten[o] = x; daten[o + 1] = y; daten[o + 2] = z; daten[o + 3] = d.wind ? d.wind[i] : 0;
      daten[o + 4] = d.skala[i3] * ms; daten[o + 5] = d.skala[i3 + 1] * ms; daten[o + 6] = d.skala[i3 + 2] * ms; daten[o + 7] = d.deck ? d.deck[i] : 1;
      daten[o + 8] = qx / ql; daten[o + 9] = qy / ql; daten[o + 10] = qz / ql; daten[o + 11] = qw / ql;
      daten[o + 12] = d.farbe[i3]; daten[o + 13] = d.farbe[i3 + 1]; daten[o + 14] = d.farbe[i3 + 2]; daten[o + 15] = 0;
      anzahl++;
    }
    if (anzahl > start) { textur.needsUpdate = true; unsortiert = true; }
    return anzahl - start;
  }

  function leere() { anzahl = 0; geometrie.instanceCount = 0; unsortiert = false; }

  function setze({ nebelFarbe, nebelDichte, licht, wind } = {}) {
    if (nebelFarbe) uniforms.uNebelFarbe.value.copy(nebelFarbe);
    if (nebelDichte !== undefined) uniforms.uNebelDichte.value = nebelDichte;
    if (licht) uniforms.uLicht.value.set(licht[0], licht[1], licht[2]);
    if (wind !== undefined) uniforms.uWind.value = wind;
  }

  /** Je Bild vor dem Rendern: Uniformen setzen; sortiert nur bei neuen Daten oder wenn sich der Blick gedreht hat (höchstens alle `sortiereAlle` Bilder). */
  function update(kamera, zeit, breitePx, hoehePx) {
    uniforms.uZeit.value = zeit;
    uniforms.uBild.value.set(Math.max(1, breitePx), Math.max(1, hoehePx));
    bild++;
    if (anzahl === 0) { geometrie.instanceCount = 0; return; }
    kamera.updateMatrixWorld();
    const e = kamera.matrixWorld.elements;
    blick[0] = -e[8]; blick[1] = -e[9]; blick[2] = -e[10];
    const l = Math.hypot(blick[0], blick[1], blick[2]) || 1;
    blick[0] /= l; blick[1] /= l; blick[2] /= l;
    const gedreht = blick[0] * letzterBlick[0] + blick[1] * letzterBlick[1] + blick[2] * letzterBlick[2] < DREH_SCHWELLE;
    if (!unsortiert && !(gedreht && bild % sortiereAlle === 0)) return;
    auge[0] = e[12]; auge[1] = e[13]; auge[2] = e[14];
    nummern.set(sortierer.sortiere(position, anzahl, blick, auge));
    nr.clearUpdateRanges();
    nr.addUpdateRange(0, anzahl);
    nr.needsUpdate = true;
    geometrie.instanceCount = anzahl;
    letzterBlick[0] = blick[0]; letzterBlick[1] = blick[1]; letzterBlick[2] = blick[2];
    unsortiert = false;
  }

  function dispose() {
    leere();
    geometrie.dispose(); material.dispose(); textur.dispose();
    if (mesh.parent) mesh.parent.remove(mesh);
  }

  return { mesh, get anzahl() { return anzahl; }, max: grenze, fuege, leere, setze, update, dispose };
}
