// Dämmerwald – Licht & Luft mit Tag-Nacht: Sonne/Mond wandern (tageslicht.js → engine/world/himmel-stand), Farben von Licht, Dunst, Himmel und Wasser folgen.
// Kronendach-Lichtkarte (engine/render/kronen-lichtkarte): Sonnentupfer auf Boden/Bewuchs/Stämmen, Lichtstrahlen nur in echten Lücken, Staub leuchtet nur im Licht.
// ?licht=einfach: keine Lichtkarte, Strahlen an festen Bahnen (alte, billige Variante). exp²-Dunst + Höhendunst bleiben.
// Der Engine-Himmel (world/himmel) passt hier nicht: er steuert linearen Nebel und Wolken – wir brauchen exp²-Dunst in Horizontfarbe.
import * as THREE from 'three';
import { rng, hashSeed } from '../../../engine/core/rng.js';
import { createKronenLichtkarte, waehleLuecken } from '../../../engine/render/kronen-lichtkarte.js';
import { pfadX, PFAD_ENDE } from './plan-daten.js';
import { tageslicht, START_STUNDE } from './tageslicht.js';

// Startwert der Sonne (Richtung ZUR Sonne) – zur Laufzeit gilt licht.richtung (wandert)
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

/** Himmelsfarbe als GLSL-Funktion (auch fürs Wasser: Spiegelung + Dunst zum Horizont). Farben in sRGB, ohne Tonemapping – wie die Nebelfarbe der Meshes.
 *  uSonne = sichtbare Scheibe (tags Sonne, nachts Mond), uSterne 0..1. */
export const HIMMEL_GLSL = `uniform vec3 uSonne, uDunst, uWarm, uZenit, uSonnenFarbe; uniform float uSterne;
vec3 dwHimmel(vec3 d) {
  float zs = max(dot(normalize(d.xz + 1e-5), normalize(uSonne.xz + 1e-5)), 0.0);
  vec3 horizont = mix(uDunst, uWarm, pow(zs, 3.0) * 0.95);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 c = mix(horizont, uZenit, pow(h, 0.6));
  c = mix(c, uWarm, pow(zs, 6.0) * (1.0 - pow(h, 0.35)) * 0.5);
  float sd = max(dot(d, uSonne), 0.0);
  c += uSonnenFarbe * (pow(sd, 900.0) * 1.2 + pow(sd, 60.0) * 0.32 + pow(sd, 8.0) * 0.12);
  if (uSterne > 0.0) { vec3 q = floor(d * 260.0); float s = fract(sin(dot(q, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    c += vec3(0.75, 0.82, 1.0) * step(0.9975, s) * smoothstep(0.08, 0.35, d.y) * uSterne * 0.8; }
  return c;
}
`;
// Gemeinsame Uniformen (Himmel + Wasser): ein Satz, je Bild von createLicht gesetzt
const neueHimmelUniforms = () => ({ uSonne: { value: SONNE.clone() }, uDunst: { value: srgb(FARBEN.dunst) }, uWarm: { value: srgb(FARBEN.warm) }, uZenit: { value: srgb(FARBEN.zenit) },
  uSonnenFarbe: { value: srgb(FARBEN.sonne) }, uSterne: { value: 0 }, uTief: { value: new THREE.Vector3(0.07, 0.105, 0.11) } });
/** Frischer Satz je Aufruf (kein modulweiter Zustand): main legt ihn an und reicht ihn an gelaende und createLicht weiter. */
export const himmelUniforms = neueHimmelUniforms;

function baueHimmel(himmelU) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false, uniforms: himmelU,
    vertexShader: 'varying vec3 vR;\nvoid main() { vR = position; gl_Position = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: 'varying vec3 vR;\n' + HIMMEL_GLSL + 'void main() { gl_FragColor = vec4(dwHimmel(normalize(vR)), 1.0); }',
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), mat);
  m.frustumCulled = false; m.renderOrder = -10; m.name = 'himmel';
  return m;
}

// Lichtstrahlen: je Strahl zwei gekreuzte Vierecke entlang der Lichtrichtung, additiv; Geometrie wird bei neuer Lichtkarte neu gefüllt (≤ MAX_STRAHLEN)
const MAX_STRAHLEN = 14;
function baueStrahlen() {
  const n = MAX_STRAHLEN * 8, geo = new THREE.BufferGeometry(), idx = [];
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('staerke', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
  for (let k = 0; k < MAX_STRAHLEN * 2; k++) { const a = k * 4; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  geo.setIndex(idx); geo.setDrawRange(0, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false,
    uniforms: { uFarbe: { value: srgb(FARBEN.sonne) }, uZeit: { value: 0 }, uDichte: { value: DUNST_DICHTE }, uHell: { value: 1 } },
    vertexShader: `attribute float staerke; varying vec2 vUv; varying float vSt; varying float vTiefe; varying vec3 vW;
void main() { vUv = uv; vSt = staerke; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vTiefe = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec2 vUv; varying float vSt; varying float vTiefe; varying vec3 vW; uniform vec3 uFarbe; uniform float uZeit, uDichte, uHell;
void main() {
  float quer = 1.0 - vUv.x * vUv.x; quer *= quer;
  float laengs = smoothstep(0.0, 0.45, vUv.y) * (1.0 - smoothstep(0.9, 1.0, vUv.y));
  float streifen = 0.72 + 0.28 * sin(vUv.x * 9.0 + vW.z * 0.21 + sin(uZeit * 0.13 + vW.x * 0.1));
  float nah = smoothstep(5.0, 32.0, vTiefe), fern = exp(-pow(vTiefe * uDichte * 0.8, 2.0));
  gl_FragColor = vec4(uFarbe * quer * laengs * streifen * nah * fern * vSt * uHell, 1.0);
}`,
  });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 5; m.name = 'lichtstrahlen';
  const a1 = new THREE.Vector3(), a2 = new THREE.Vector3(), r = new THREE.Vector3(), oben = new THREE.Vector3(), unten = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  /** liste: [{ x, y, z (Fuß am Boden), breite, laenge, staerke, richtung? }] */
  m.userData.setze = (liste, richtung) => {
    const p = geo.attributes.position.array, uv = geo.attributes.uv.array, st = geo.attributes.staerke.array;
    let v = 0;
    for (const b of liste.slice(0, MAX_STRAHLEN)) {
      r.copy(b.richtung || richtung).normalize();
      a1.crossVectors(r, Y).normalize(); a2.crossVectors(r, a1).normalize();
      unten.set(b.x, b.y - 0.5, b.z).addScaledVector(r, -3); oben.set(b.x, b.y, b.z).addScaledVector(r, b.laenge);
      for (const a of [a1, a2]) for (const [q, vv] of [[oben, 0], [unten, 1]]) for (const u of [-1, 1]) {
        p[v * 3] = q.x + a.x * u * b.breite / 2; p[v * 3 + 1] = q.y + a.y * u * b.breite / 2; p[v * 3 + 2] = q.z + a.z * u * b.breite / 2;
        uv[v * 2] = u; uv[v * 2 + 1] = vv; st[v] = b.staerke; v++;
      }
    }
    for (const n of ['position', 'uv', 'staerke']) geo.attributes[n].needsUpdate = true;
    geo.setDrawRange(0, (v / 4) * 6);
  };
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
    uniforms: { uZeit: { value: 0 }, uFarbe: { value: srgb(farbe) }, uGroesse: { value: groesse }, uHoehe: { value: 540 }, uDichte: { value: DUNST_DICHTE }, uHell: { value: 1 } },
    vertexShader: `attribute vec4 phase; uniform float uZeit, uGroesse, uHoehe, uDichte, uHell; varying float vA;
void main() {
  vec3 p = position; float t = uZeit * phase.y;
  ${vogel
    ? 'float w = phase.x + t * 0.11; float rad = 30.0 + 40.0 * phase.w; p.x += cos(w) * rad; p.z += sin(w) * rad * 0.7; p.y += sin(t * 0.4 + phase.z) * 5.0;'
    : 'p.x += sin(t * 0.6 + phase.x) * 1.4 + sin(t * 0.23 + phase.z) * 2.0; p.y += sin(t * 0.9 + phase.z) * 0.5; p.z += cos(t * 0.5 + phase.x * 1.7) * 1.6;'}
  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
  float fern = exp(-pow(-mv.z * uDichte, 2.0));
  ${vogel
    ? 'gl_PointSize = clamp(uGroesse * uHoehe / -mv.z, 1.5, 5.0); vA = (0.75 * fern + 0.1) * uHell;'
    : 'float blink = smoothstep(0.1, 0.9, sin(t * 1.3 + phase.x * 3.0) * 0.5 + 0.5); gl_PointSize = clamp(uGroesse * uHoehe / -mv.z, 1.0, 22.0) * (0.6 + 0.4 * blink) * (0.8 + 0.35 * uHell); vA = blink * fern * smoothstep(1.5, 6.0, -mv.z) * uHell;'}
}`,
    fragmentShader: `uniform vec3 uFarbe; varying float vA;
void main() { vec2 q = gl_PointCoord - 0.5; float d = length(q) * 2.0; float a = ${vogel ? 'step(d, 1.0) * (1.0 - smoothstep(0.25, 1.0, abs(q.y) * 3.0))' : 'pow(max(1.0 - d, 0.0), 2.2)'};
  gl_FragColor = vec4(uFarbe ${additiv ? '* a * vA, 1.0' : ', a * vA'}); }`,
  });
  const m = new THREE.Points(geo, mat); m.frustumCulled = false; m.renderOrder = 6; m.name = art;
  return m;
}

// Lichtstaub: feine Schwebeteilchen in einem Kasten um die Kamera (wandert mit, Modulo), leuchten nur, wo die Lichtkarte Licht durchlässt
function baueStaub(anzahl, seed, lk) {
  const r = rng(hashSeed('staub', seed)), pos = new Float32Array(anzahl * 3), ph = new Float32Array(anzahl);
  for (let i = 0; i < anzahl; i++) { pos.set([r(), r(), r()], i * 3); ph[i] = r() * 6.28; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
    uniforms: { ...lk.uniforms, uZeit: { value: 0 }, uMitte: { value: new THREE.Vector3() }, uKasten: { value: new THREE.Vector3(44, 22, 44) }, uFarbe: { value: new THREE.Vector3(1, 0.85, 0.6) }, uHell: { value: 1 }, uHoehe: { value: 540 } },
    vertexShader: lk.GLSL + `attribute float phase; uniform float uZeit, uHell, uHoehe; uniform vec3 uMitte, uKasten; varying float vA;
void main() {
  vec3 drift = vec3(sin(uZeit * 0.05 + phase) * 1.5 + uZeit * 0.12, sin(uZeit * 0.11 + phase * 2.0) * 0.8 - uZeit * 0.03, cos(uZeit * 0.07 + phase) * 1.5);
  vec3 p = uMitte + mod(position * uKasten + drift - uMitte + uKasten * 0.5, uKasten) - uKasten * 0.5;
  vec4 mv = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
  float licht = lkLicht(p, 0.0); licht = smoothstep(0.55, 0.95, licht);
  float d = -mv.z, rand = smoothstep(uKasten.x * 0.5, uKasten.x * 0.3, length(p.xz - uMitte.xz));
  float funkel = 0.6 + 0.4 * sin(uZeit * (1.0 + fract(phase) * 1.5) + phase * 7.0);
  gl_PointSize = clamp(0.05 * uHoehe / max(d, 0.5), 1.0, 5.0);
  vA = licht * rand * funkel * uHell * smoothstep(0.8, 3.0, d) * (1.0 - smoothstep(18.0, 30.0, d));
}`,
    fragmentShader: `uniform vec3 uFarbe; varying float vA;
void main() { float d = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(uFarbe * pow(max(1.0 - d, 0.0), 1.6) * vA, 1.0); }`,
  });
  const m = new THREE.Points(geo, mat); m.frustumCulled = false; m.renderOrder = 7; m.name = 'lichtstaub';
  return m;
}

const lin = (c, rgb) => c.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);

/**
 * opts: { szene, renderer, bodenHoehe, seed, bahnen: [{x,y,z,breite,laenge,staerke,richtung?}] (nur ?licht=einfach), einfach, karte: { groesse, weite }, staub (Anzahl) }
 * → { sonne, himmelslicht, dunstFarbe, richtung (Vector3, aktuell), zustand (tageslicht), kronenLicht, lichtkarte|null, setzeSchatten(groesse),
 *     fuegeVerdecker(objekt, opts), mitLichtkarte(material), update(zeit, kamera, mitte, stunde), dispose() }
 */
export function createLicht({ szene, renderer, bodenHoehe, seed = 1, bahnen = [], einfach = false, karte = {}, staub = 700, himmel: himmelU = himmelUniforms() }) {
  szene.fog = new THREE.FogExp2(FARBEN.dunst, DUNST_DICHTE);
  const dunstFarbe = szene.fog.color;                                        // FogExp2 kopiert die Farbe → genau dieses Objekt nachführen
  szene.background = dunstFarbe;
  const himmel = baueHimmel(himmelU);
  const sonne = new THREE.DirectionalLight(0xffe0c2, 2.3);
  sonne.castShadow = true;
  const s = sonne.shadow; s.mapSize.set(2048, 2048); s.bias = -0.0006; s.normalBias = 0.35;
  Object.assign(s.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 900 });
  const himmelslicht = new THREE.HemisphereLight(0x9bbcc0, 0x3a4038, 2.0);   // kühle, blaugrüne Schatten – nie schwarz
  const gegen = new THREE.DirectionalLight(0x7fa0a8, 0.6);                    // schwaches Gegenlicht aus dem Wald (formt die Stämme im Schatten)
  gegen.position.set(-0.4, 0.5, 0.8);
  const strahlen = baueStrahlen();
  const gluehen = bauePunkte({ art: 'gluehwuermchen', anzahl: 150, seed, farbe: 0xd8e878, groesse: 0.16, additiv: true,
    platz: (r) => { const z = 45 + r() * (PFAD_ENDE - 35), x = pfadX(z) + (r() - 0.5) * 34; return [x, bodenHoehe(x, z) + 0.4 + r() * 2.4, z]; } });
  const voegel = bauePunkte({ art: 'voegel', anzahl: 16, seed, farbe: 0x2a3034, groesse: 0.9, additiv: false,
    platz: (r, i) => [(r() - 0.5) * 160, 62 + r() * 50, i < 6 ? -60 - r() * 120 : 40 + r() * 260] });
  const lk = einfach ? null : createKronenLichtkarte({ renderer, groesse: karte.groesse ?? 256, weite: karte.weite ?? 150, hoehe: 80, verschiebung: 1.0, aussen: 0.75, stammBis: 62, minBilder: karte.minBilder ?? 20 });
  const lichtstaub = lk ? baueStaub(staub, seed, lk) : null;
  szene.add(himmel, sonne, sonne.target, himmelslicht, gegen, strahlen, gluehen, voegel);
  if (lichtstaub) szene.add(lichtstaub);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  const raster = (120 / 2048) * 4;
  const richtung = SONNE.clone(), zustand = tageslicht(START_STUNDE), kronenLicht = { sonne: richtung, farbe: new THREE.Color(), umgebung: new THREE.Color(), boden: new THREE.Color() };
  const fwd = new THREE.Vector3(), letzte = { richtung: new THREE.Vector3(), yaw: 1e9, stunde: -1, suche: 0, strahlenAn: false };
  const U = himmelU;

  function setzeFarben(z) {
    const f = z.farben;
    lin(dunstFarbe, f.dunst);
    U.uDunst.value.fromArray(f.dunst); U.uWarm.value.fromArray(f.warm); U.uZenit.value.fromArray(f.zenit); U.uSonnenFarbe.value.fromArray(f.scheibeHell);
    U.uSonne.value.fromArray(z.scheibe).normalize(); U.uSterne.value = z.sterne;
    U.uTief.value.set(0.07, 0.105, 0.11).multiplyScalar(0.3 + 0.7 * z.tag);
    richtung.fromArray(z.richtung).normalize();
    lin(sonne.color, f.licht); sonne.intensity = z.lichtI;
    lin(himmelslicht.color, f.himmel); lin(himmelslicht.groundColor, f.boden); himmelslicht.intensity = z.himmelI;
    lin(gegen.color, f.gegen); gegen.intensity = z.gegenI; gegen.position.set(-richtung.x, 0.5, -richtung.z);
    // Kronen (three: Lambert-Anteil = Farbe · Stärke / π)
    kronenLicht.farbe.copy(sonne.color).multiplyScalar(sonne.intensity / Math.PI);
    kronenLicht.umgebung.copy(himmelslicht.color).multiplyScalar(himmelslicht.intensity / Math.PI * 1.15);
    kronenLicht.boden.copy(himmelslicht.groundColor).multiplyScalar(himmelslicht.intensity / Math.PI);
    // Mit Lichtkarte trifft die Sonne nur noch die Tupfer: etwas kräftiger (Kontrast Licht/Schatten), Himmelslicht leicht angehoben (Waldboden nicht dunkler als vorher)
    if (lk) { sonne.intensity *= 1.3; himmelslicht.intensity *= 1.12; }
    strahlen.material.uniforms.uFarbe.value.fromArray(f.scheibe); strahlen.material.uniforms.uHell.value = z.strahlen;
    gluehen.material.uniforms.uHell.value = 0.45 + 1.1 * z.nacht;
    voegel.material.uniforms.uHell.value = 1 - z.nacht;
    if (lichtstaub) { lichtstaub.material.uniforms.uFarbe.value.fromArray(z.mond ? [0.55, 0.65, 0.9] : f.scheibe); lichtstaub.material.uniforms.uHell.value = 0.35 + 0.65 * z.strahlen; }
  }

  // Strahlen-Füße: hellste Lücken (Lichtkarte, Readback) in einem Raster vor der Kamera
  function sucheStrahlen(mitte, kamera) {
    kamera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const cx = mitte.x + fwd.x * 22, cz = mitte.z + fwd.z * 22, punkte = [];
    for (let x = -36; x <= 36; x += 2.5) for (let z = -36; z <= 36; z += 2.5) {
      const px = cx + x, pz = cz + z, y = bodenHoehe(px, pz), l = lk.lichtBei(px, y + 1, pz, 2);
      if (l > 0.5) punkte.push({ x: px, y, z: pz, licht: l });
    }
    const hoch = Math.max(richtung.y, 0.12), flach = 1 - 0.4 * (1 - Math.min(1, richtung.y / 0.3)), laenge = Math.min(230, 80 / hoch);
    return waehleLuecken(punkte, { max: MAX_STRAHLEN, abstand: 7, schwelle: 0.62 }).map((p) => {
      const weit = lk.lichtBei(p.x, p.y + 1, p.z, 5);                           // breite Lücke → breiter Strahl
      return { ...p, breite: 1.6 + 4 * weit * weit * flach, laenge, staerke: 0.05 + 0.08 * (p.licht - 0.6) / 0.4 + 0.04 * weit * flach };
    });
  }

  setzeFarben(zustand);
  return {
    sonne, himmelslicht, dunstFarbe, lichtbahnen: strahlen, richtung, zustand, kronenLicht, lichtkarte: lk,
    get stunde() { return zustand.stunde; },
    setzeSchatten(groesse) {
      sonne.castShadow = groesse > 0;
      if (groesse > 0 && s.mapSize.x !== groesse) { s.map?.dispose(); s.map = null; s.mapSize.set(groesse, groesse); }
    },
    /** Verdecker für die Lichtkarte (Laub, Stämme); ohne Lichtkarte wirkungslos. */
    fuegeVerdecker(objekt, opts) { lk?.fuege(objekt, opts); },
    /** Sonnentupfer auf einem beleuchteten Material; ohne Lichtkarte wirkungslos. */
    mitLichtkarte(material, opts) { if (lk) lk.mitLichtkarte(material, opts); return material; },
    update(zeit, kamera, mitte, stunde = START_STUNDE) {
      himmel.scale.setScalar(kamera.far * 0.9);
      if (letzte.stunde < 0 || Math.abs(stunde - letzte.stunde) >= 0.05) { tageslicht(stunde, undefined, zustand); setzeFarben(zustand); letzte.stunde = stunde; }
      // Schattenkarte nur nah um die Figur (≤ 60 m), auf ein Raster gerundet (kein Flimmern)
      const mx = Math.round(mitte.x / raster) * raster, mz = Math.round(mitte.z / raster) * raster;
      sonne.target.position.set(mx, mitte.y, mz);
      sonne.position.copy(sonne.target.position).addScaledVector(richtung, 420);
      if (lk) {
        // Bild N: Neu-Rendern · N+1: Readback (in lk.update) · N+2: Strahlensuche
        const neu = lk.update(richtung, mitte);
        kamera.getWorldDirection(fwd);
        const yaw = Math.atan2(fwd.x, fwd.z), gedreht = Math.abs(Math.atan2(Math.sin(yaw - letzte.yaw), Math.cos(yaw - letzte.yaw))) > 0.5;
        const an = zustand.strahlen > 0.02, schwelle = an && !letzte.strahlenAn;      // Schwelle von unten überschritten → neu suchen
        letzte.strahlenAn = an;
        if (neu) letzte.suche = 2;
        else if (letzte.suche > 0) { if (--letzte.suche === 0) { strahlen.userData.setze(an ? sucheStrahlen(mitte, kamera) : [], richtung); letzte.yaw = yaw; } }
        else if ((gedreht || schwelle) && lk.gelesen) { strahlen.userData.setze(an ? sucheStrahlen(mitte, kamera) : [], richtung); letzte.yaw = yaw; }
        const u = lichtstaub.material.uniforms; u.uZeit.value = zeit; u.uMitte.value.copy(kamera.position);
      } else if (letzte.richtung.angleTo(richtung) > 0.01) {
        letzte.richtung.copy(richtung);
        strahlen.userData.setze(bahnen, richtung);
      }
      strahlen.material.uniforms.uZeit.value = zeit; gluehen.material.uniforms.uZeit.value = zeit; voegel.material.uniforms.uZeit.value = zeit;
      const hPx = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(kamera.fov) / 2));
      gluehen.material.uniforms.uHoehe.value = hPx; voegel.material.uniforms.uHoehe.value = hPx;
      if (lichtstaub) lichtstaub.material.uniforms.uHoehe.value = hPx;
    },
    dispose() {
      for (const o of [himmel, strahlen, gluehen, voegel, lichtstaub]) if (o) { o.geometry.dispose(); o.material.dispose(); szene.remove(o); }
      lk?.dispose(); s.map?.dispose(); szene.remove(sonne, sonne.target, himmelslicht, gegen); szene.fog = null;
    },
  };
}
