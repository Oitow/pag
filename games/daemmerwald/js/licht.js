// Dämmerwald – Licht & Luft: ewige Dämmerung (tiefe warme Sonne von Süd-West, kühles Himmelslicht), Dunst (FogExp2 + Höhendunst für Riesen),
// schlichter Verlaufshimmel (warm zur Sonne, kühl blaugrün im Wald), Lichtbahnen, Glühwürmchen, Vögel als Punkte.
// Der Engine-Himmel (world/himmel) passt hier nicht: er steuert linearen Nebel und Wolken/Sterne – wir brauchen exp²-Dunst in Horizontfarbe.
import * as THREE from 'three';
import { rng, hashSeed } from '../../../engine/core/rng.js';
import { pfadX, PFAD_ENDE } from './plan-daten.js';

// Sonne tief im Süd-Westen (Westen = +x, Süden = −z): Richtung ZUR Sonne
export const SONNE = new THREE.Vector3(0.52, 0.34, -0.78).normalize();
export const DUNST_DICHTE = 0.0055;        // 60 m: ~10 % · 200 m: ~70 % · 500 m: > 99 %
const srgb = (hex) => new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
export const FARBEN = { dunst: 0x8a9c98, warm: 0xe2bd94, zenit: 0x6f8790, sonne: 0xffd9a8 };

/** Höhendunst: Material verblasst mit der Welthöhe zur Dunstfarbe – so verschwinden die Kronen der Riesen. Vor dem ersten Rendern aufrufen. */
export function mitHoehenDunst(material, { ab = 30, bis = 105, max = 0.86 } = {}) {
  const vorher = material.onBeforeCompile;
  material.onBeforeCompile = (s, r) => {
    vorher?.(s, r);
    s.uniforms.uDwDunst = { value: new THREE.Vector3(ab, bis, max) };
    s.vertexShader = 'varying float vDwY;\n' + s.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
  { vec4 dwP = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    dwP = instanceMatrix * dwP;
  #endif
    vDwY = (modelMatrix * dwP).y; }`);
    s.fragmentShader = 'varying float vDwY;\nuniform vec3 uDwDunst;\n' + s.fragmentShader.replace('#include <fog_fragment>', `#ifdef USE_FOG
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, smoothstep(uDwDunst.x, uDwDunst.y, vDwY) * uDwDunst.z);
#endif
#include <fog_fragment>`);
  };
  const alt = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => 'dw-dunst|' + (alt ? alt() : '');
  return material;
}

/** Himmelsfarbe als GLSL-Funktion (auch fürs Wasser: Spiegelung + Dunst zum Horizont). Farben in sRGB, ohne Tonemapping – wie die Nebelfarbe der Meshes. */
export const HIMMEL_GLSL = `uniform vec3 uSonne, uDunst, uWarm, uZenit, uSonnenFarbe;
vec3 dwHimmel(vec3 d) {
  float zs = max(dot(normalize(d.xz + 1e-5), normalize(uSonne.xz)), 0.0);
  vec3 horizont = mix(uDunst, uWarm, pow(zs, 3.0) * 0.95);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 c = mix(horizont, uZenit, pow(h, 0.6));
  c = mix(c, uWarm, pow(zs, 6.0) * (1.0 - pow(h, 0.35)) * 0.5);
  float sd = max(dot(d, uSonne), 0.0);
  return c + uSonnenFarbe * (pow(sd, 900.0) * 1.2 + pow(sd, 60.0) * 0.32 + pow(sd, 8.0) * 0.12);
}
`;
export const himmelUniforms = () => ({ uSonne: { value: SONNE }, uDunst: { value: srgb(FARBEN.dunst) }, uWarm: { value: srgb(FARBEN.warm) }, uZenit: { value: srgb(FARBEN.zenit) }, uSonnenFarbe: { value: srgb(FARBEN.sonne) } });

function baueHimmel() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false, uniforms: himmelUniforms(),
    vertexShader: 'varying vec3 vR;\nvoid main() { vR = position; gl_Position = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: 'varying vec3 vR;\n' + HIMMEL_GLSL + 'void main() { gl_FragColor = vec4(dwHimmel(normalize(vR)), 1.0); }',
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), mat);
  m.frustumCulled = false; m.renderOrder = -10; m.name = 'himmel';
  return m;
}

// Lichtbahnen: je Bahn zwei gekreuzte Vierecke entlang der Sonnenrichtung, additiv, sehr schwach
function baueBahnen(bahnen) {
  const pos = [], uv = [], st = [], idx = [];
  const a1 = new THREE.Vector3(), a2 = new THREE.Vector3(), r = new THREE.Vector3(), oben = new THREE.Vector3(), unten = new THREE.Vector3();
  for (const b of bahnen) {
    r.copy(b.richtung || SONNE);
    a1.crossVectors(r, new THREE.Vector3(0, 1, 0)).normalize(); a2.crossVectors(r, a1).normalize();
    unten.set(b.x, b.y - 1, b.z).addScaledVector(r, -4); oben.set(b.x, b.y, b.z).addScaledVector(r, b.laenge);
    for (const a of [a1, a2]) {
      const n = pos.length / 3;
      for (const [p, v] of [[oben, 0], [unten, 1]]) for (const u of [-1, 1]) { pos.push(p.x + a.x * u * b.breite / 2, p.y + a.y * u * b.breite / 2, p.z + a.z * u * b.breite / 2); uv.push(u, v); st.push(b.staerke); }
      idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('staerke', new THREE.Float32BufferAttribute(st, 1));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false,
    uniforms: { uFarbe: { value: srgb(FARBEN.sonne) }, uZeit: { value: 0 }, uDichte: { value: DUNST_DICHTE } },
    vertexShader: `attribute float staerke; varying vec2 vUv; varying float vSt; varying float vTiefe; varying vec3 vW;
void main() { vUv = uv; vSt = staerke; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vTiefe = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec2 vUv; varying float vSt; varying float vTiefe; varying vec3 vW; uniform vec3 uFarbe; uniform float uZeit, uDichte;
void main() {
  float quer = 1.0 - vUv.x * vUv.x; quer *= quer;
  float laengs = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.82, 1.0, vUv.y));
  float streifen = 0.72 + 0.28 * sin(vUv.x * 9.0 + vW.z * 0.21 + sin(uZeit * 0.13 + vW.x * 0.1));
  float nah = smoothstep(3.0, 22.0, vTiefe), fern = exp(-pow(vTiefe * uDichte * 0.8, 2.0));
  gl_FragColor = vec4(uFarbe * quer * laengs * streifen * nah * fern * vSt, 1.0);
}`,
  });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 5; m.name = 'lichtbahnen';
  return m;
}

function bauePunkte({ anzahl, seed, platz, farbe, groesse, additiv, art }) {
  const r = rng(hashSeed(art, seed)), pos = new Float32Array(anzahl * 3), ph = new Float32Array(anzahl * 4);
  for (let i = 0; i < anzahl; i++) { const p = platz(r, i); pos.set(p, i * 3); ph.set([r() * 6.28, 0.5 + r(), r() * 6.28, 0.6 + r() * 0.8], i * 4); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('phase', new THREE.BufferAttribute(ph, 4));
  const vogel = art === 'voegel';
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additiv ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false, toneMapped: false,
    uniforms: { uZeit: { value: 0 }, uFarbe: { value: srgb(farbe) }, uGroesse: { value: groesse }, uHoehe: { value: 540 }, uDichte: { value: DUNST_DICHTE } },
    vertexShader: `attribute vec4 phase; uniform float uZeit, uGroesse, uHoehe, uDichte; varying float vA;
void main() {
  vec3 p = position; float t = uZeit * phase.y;
  ${vogel
    ? 'float w = phase.x + t * 0.11; float rad = 30.0 + 40.0 * phase.w; p.x += cos(w) * rad; p.z += sin(w) * rad * 0.7; p.y += sin(t * 0.4 + phase.z) * 5.0;'
    : 'p.x += sin(t * 0.6 + phase.x) * 1.4 + sin(t * 0.23 + phase.z) * 2.0; p.y += sin(t * 0.9 + phase.z) * 0.5; p.z += cos(t * 0.5 + phase.x * 1.7) * 1.6;'}
  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
  float fern = exp(-pow(-mv.z * uDichte, 2.0));
  ${vogel
    ? 'gl_PointSize = clamp(uGroesse * uHoehe / -mv.z, 1.5, 5.0); vA = 0.75 * fern + 0.1;'
    : 'float blink = smoothstep(0.1, 0.9, sin(t * 1.3 + phase.x * 3.0) * 0.5 + 0.5); gl_PointSize = clamp(uGroesse * uHoehe / -mv.z, 1.0, 22.0) * (0.6 + 0.4 * blink); vA = blink * fern * smoothstep(1.5, 6.0, -mv.z);'}
}`,
    fragmentShader: `uniform vec3 uFarbe; varying float vA;
void main() { vec2 q = gl_PointCoord - 0.5; float d = length(q) * 2.0; float a = ${vogel ? 'step(d, 1.0) * (1.0 - smoothstep(0.25, 1.0, abs(q.y) * 3.0))' : 'pow(max(1.0 - d, 0.0), 2.2)'};
  gl_FragColor = vec4(uFarbe ${additiv ? '* a * vA, 1.0' : ', a * vA'}); }`,
  });
  const m = new THREE.Points(geo, mat); m.frustumCulled = false; m.renderOrder = 6; m.name = art;
  return m;
}

/** opts: { szene, renderer, bodenHoehe, seed, bahnen: [{x,y,z,breite,laenge,staerke,richtung?}] } → { sonne, himmelslicht, dunstFarbe, setzeSchatten(groesse), update(zeit, kamera, mitte), dispose() } */
export function createLicht({ szene, renderer, bodenHoehe, seed = 1, bahnen = [] }) {
  const dunstFarbe = new THREE.Color(FARBEN.dunst);
  szene.fog = new THREE.FogExp2(dunstFarbe, DUNST_DICHTE);
  szene.background = dunstFarbe;
  const himmel = baueHimmel();
  const sonne = new THREE.DirectionalLight(0xffe0c2, 2.3);
  sonne.castShadow = true;
  const s = sonne.shadow; s.mapSize.set(2048, 2048); s.bias = -0.0006; s.normalBias = 0.35;
  Object.assign(s.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 900 });
  const himmelslicht = new THREE.HemisphereLight(0x9bbcc0, 0x3a4038, 2.0);   // kühle, blaugrüne Schatten – nie schwarz
  const gegen = new THREE.DirectionalLight(0x7fa0a8, 0.6);                    // schwaches Gegenlicht aus dem Wald (formt die Stämme im Schatten)
  gegen.position.set(-0.4, 0.5, 0.8);
  const lichtbahnen = baueBahnen(bahnen);
  const gluehen = bauePunkte({ art: 'gluehwuermchen', anzahl: 150, seed, farbe: 0xd8e878, groesse: 0.16, additiv: true,
    platz: (r) => { const z = 45 + r() * (PFAD_ENDE - 35), x = pfadX(z) + (r() - 0.5) * 34; return [x, bodenHoehe(x, z) + 0.4 + r() * 2.4, z]; } });
  const voegel = bauePunkte({ art: 'voegel', anzahl: 16, seed, farbe: 0x2a3034, groesse: 0.9, additiv: false,
    platz: (r, i) => [(r() - 0.5) * 160, 62 + r() * 50, i < 6 ? -60 - r() * 120 : 40 + r() * 260] });
  szene.add(himmel, sonne, sonne.target, himmelslicht, gegen, lichtbahnen, gluehen, voegel);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  const raster = (120 / 2048) * 4;
  return {
    sonne, himmelslicht, dunstFarbe, lichtbahnen,
    setzeSchatten(groesse) {
      sonne.castShadow = groesse > 0;
      if (groesse > 0 && s.mapSize.x !== groesse) { s.map?.dispose(); s.map = null; s.mapSize.set(groesse, groesse); }
    },
    update(zeit, kamera, mitte) {
      himmel.scale.setScalar(kamera.far * 0.9);
      // Schattenkarte nur nah um die Figur (≤ 60 m), auf ein Raster gerundet (kein Flimmern)
      const mx = Math.round(mitte.x / raster) * raster, mz = Math.round(mitte.z / raster) * raster;
      sonne.target.position.set(mx, mitte.y, mz);
      sonne.position.copy(sonne.target.position).addScaledVector(SONNE, 420);
      lichtbahnen.material.uniforms.uZeit.value = zeit; gluehen.material.uniforms.uZeit.value = zeit; voegel.material.uniforms.uZeit.value = zeit;
      const hPx = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(kamera.fov) / 2));
      gluehen.material.uniforms.uHoehe.value = hPx; voegel.material.uniforms.uHoehe.value = hPx;
    },
    dispose() {
      for (const o of [himmel, lichtbahnen, gluehen, voegel]) { o.geometry.dispose(); o.material.dispose(); }
      s.map?.dispose(); szene.remove(himmel, sonne, sonne.target, himmelslicht, gegen, lichtbahnen, gluehen, voegel); szene.fog = null;
    },
  };
}
