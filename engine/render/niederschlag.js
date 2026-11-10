/**
 * @modul    niederschlag
 * @zweck    Regen/Schnee als ein Points-Objekt um die Kamera; Bewegung komplett im Vertex-Shader (kein CPU-Aufwand je Partikel)
 * @api      createNiederschlag({anzahl,radius,hoehe,seed}) -> {objekt, update(dt,{kamera|mitte,regen,schnee,wind,windRichtung,hoehePx}), dispose()}
 * @beispiel
 *   import { createNiederschlag } from '../../engine/render/niederschlag.js';
 *   const ns = createNiederschlag({ seed: 3 });
 *   scene.add(ns.objekt);
 *   ns.update(dt, { kamera, regen: wetter.regen, schnee: wetter.schnee, wind: wetter.wind, windRichtung: wetter.windRichtung });
 * @tags     wetter, regen, schnee, partikel, shader
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { rng } from '../core/rng.js';
import { clamp, numOr } from '../core/math.js';

const VERT = /* glsl */`
attribute float aZufall;  // 0..1: Partikel sichtbar, wenn aZufall < Stärke
attribute float aArt;     // 0 = Regen, 1 = Schnee
uniform float uZeit, uRegen, uSchnee, uSkala, uDeckkraft;
uniform vec3 uMitte, uBox;
uniform vec2 uWind;       // Windversatz in m/s (x, z)
varying float vArt;
varying float vAlpha;
void main() {
  bool schnee = aArt > 0.5;
  float staerke = schnee ? uSchnee : uRegen;
  vArt = aArt;
  if (aZufall >= staerke) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vAlpha = 0.0; return; }
  float tempo = fract(aZufall * 97.13);
  vec3 p = position;
  p.y -= uZeit * (schnee ? 1.5 : 14.0) * (0.8 + 0.4 * tempo);
  p.xz += uWind * uZeit * (schnee ? 0.6 : 0.3);
  if (schnee) p.xz += vec2(sin(uZeit * 1.3 + aZufall * 60.0), cos(uZeit * 1.1 + aZufall * 37.0)) * 0.7;
  vec3 rel = mod(p - uMitte + 0.5 * uBox, uBox) - 0.5 * uBox;   // Quader folgt der Kamera
  vec4 mv = viewMatrix * vec4(uMitte + rel, 1.0);
  gl_Position = projectionMatrix * mv;
  float rand = 1.0 - smoothstep(0.7, 1.0, length(rel.xz) / (0.5 * uBox.x)); // weich am Rand
  gl_PointSize = min(uSkala * (schnee ? 0.012 : 0.07), uSkala * (schnee ? 0.16 : 0.45) / max(0.1, -mv.z));   // nah an der Kamera begrenzt
  vAlpha = uDeckkraft * rand * (schnee ? 0.9 : 0.55);
}`;

const FRAG = /* glsl */`
varying float vArt;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a;
  if (vArt < 0.5) a = (1.0 - smoothstep(0.03, 0.08, abs(c.x))) * (1.0 - smoothstep(0.4, 0.5, abs(c.y))); // Strich
  else a = 1.0 - smoothstep(0.2, 0.5, length(c));                                                         // Flocke
  a *= vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(0.82, 0.88, 1.0, a);
}`;

export function createNiederschlag(opts = {}) {
  const { anzahl = 1800, radius = 28, hoehe = 24, seed = 1 } = opts;
  const r = rng(seed);
  const pos = new Float32Array(anzahl * 3), zuf = new Float32Array(anzahl), art = new Float32Array(anzahl);
  for (let i = 0; i < anzahl; i++) {
    pos[i * 3] = (r() - 0.5) * 2 * radius;
    pos[i * 3 + 1] = r() * hoehe;
    pos[i * 3 + 2] = (r() - 0.5) * 2 * radius;
    zuf[i] = r();
    art[i] = r() < 0.5 ? 0 : 1; // je Partikel Regen- oder Schnee-Anteil
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aZufall', new THREE.BufferAttribute(zuf, 1));
  geo.setAttribute('aArt', new THREE.BufferAttribute(art, 1));

  const uniforms = {
    uZeit: { value: 0 }, uRegen: { value: 0 }, uSchnee: { value: 0 }, uSkala: { value: 800 },
    uDeckkraft: { value: 1 }, uMitte: { value: new THREE.Vector3() },
    uBox: { value: new THREE.Vector3(radius * 2, hoehe, radius * 2) }, uWind: { value: new THREE.Vector2() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, fog: false,
  });
  const objekt = new THREE.Points(geo, mat);
  objekt.frustumCulled = false;
  objekt.renderOrder = 999;
  objekt.visible = false;

  function update(dt, p = {}) {
    uniforms.uZeit.value += Math.max(0, numOr(dt, 0));
    const regen = clamp(numOr(p.regen, 0), 0, 1), schnee = clamp(numOr(p.schnee, 0), 0, 1);
    uniforms.uRegen.value = regen;
    uniforms.uSchnee.value = schnee;
    const wind = clamp(numOr(p.wind, 0), 0, 1), rich = numOr(p.windRichtung, 0);
    uniforms.uWind.value.set(Math.cos(rich) * wind * 8, Math.sin(rich) * wind * 8);
    uniforms.uSkala.value = numOr(p.hoehePx, 800);
    if (p.kamera) p.kamera.getWorldPosition(uniforms.uMitte.value);
    else if (p.mitte) uniforms.uMitte.value.copy(p.mitte);
    objekt.visible = regen > 0.001 || schnee > 0.001;
  }

  return {
    objekt, update,
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
