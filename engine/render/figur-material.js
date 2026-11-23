/**
 * @modul    figur-material
 * @zweck    Weiches Figuren-Material: Standard-Material mit Randlicht (Fresnel), aufgehellter Schattenseite und kräftigeren Farben – Figuren heben sich vom Gelände ab
 * @api      figurMaterial(opts) -> THREE.MeshStandardMaterial (geteilt je Optionen) ; FIGUR_MATERIAL_STANDARD
 * @beispiel
 *   import { figurMaterial } from '../../engine/render/figur-material.js';
 *   const mat = figurMaterial();                              // eins für alle Figuren (ein Shader-Programm)
 *   const geist = figurMaterial({ rand: 1, randFarbe: 0x80c0ff, material: { transparent: true, opacity: 0.6 } });
 * @tags     figur, charakter, material, shader, randlicht, rim, look
 * @version  1.1.0
 * @status   entwurf
 * @three    ja
 *
 * 1.1 (additiv): glatt = true → weiche Normalen (für den organischen Körper aus figur-haut); hautWaerme = warmes Durchscheinen auf der
 *      Schattenseite, wo das Vertex-Attribut „haut“ = 1 ist (Ohren, Hände, Gesicht wirken lebendig statt nach Plastik). Ohne Attribut: 0.
 */
import * as THREE from 'three';

/** Standardwerte: rand = Stärke des Randlichts, weich = Aufhellung der Schattenseite, saettigung = Farbkraft (1 = unverändert). */
export const FIGUR_MATERIAL_STANDARD = Object.freeze({ rand: 0.5, randFarbe: 0xfff0d8, randSchaerfe: 2.6, weich: 0.22, saettigung: 1.18, glatt: false, hautWaerme: 0.3 });

const cache = new Map();

/**
 * opts: { rand = 0.5, randFarbe = 0xfff0d8, randSchaerfe = 2.6, weich = 0.22, saettigung = 1.18,
 *         material: weitere MeshStandardMaterial-Parameter }. Gleiche Optionen → dasselbe Material (nicht selbst dispose()n).
 */
export function figurMaterial(opts = {}) {
  const o = { ...FIGUR_MATERIAL_STANDARD, ...opts };
  const key = JSON.stringify(o);
  let mat = cache.get(key);
  if (mat) return mat;
  mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: !o.glatt, roughness: o.glatt ? 0.72 : 0.8, metalness: 0, ...(o.material || {}) });
  const u = {
    uRand: { value: o.rand }, uRandFarbe: { value: new THREE.Color(o.randFarbe) }, uRandSchaerfe: { value: o.randSchaerfe },
    uWeich: { value: o.weich }, uSatt: { value: o.saettigung }, uHaut: { value: o.hautWaerme },
  };
  mat.userData.figur = u;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    if (shader.vertexShader) shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float haut;\nvarying float vHaut;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHaut = haut;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uRand, uRandSchaerfe, uWeich, uSatt, uHaut;\nuniform vec3 uRandFarbe;\nvarying float vHaut;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        { float g = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)); diffuseColor.rgb = max(mix(vec3(g), diffuseColor.rgb, uSatt), 0.0); }`)
      .replace('#include <opaque_fragment>', `
        { // Schattenseite mit der Eigenfarbe aufhellen + Randlicht (oben stärker, wie Himmelslicht)
          vec3 fn = normalize(normal); vec3 fv = normalize(vViewPosition);
          float f = pow(1.0 - clamp(dot(fn, fv), 0.0, 1.0), uRandSchaerfe);
          float oben = 0.55 + 0.45 * clamp(fn.y * 0.5 + 0.5, 0.0, 1.0);
          outgoingLight += diffuseColor.rgb * uWeich;
          float hell = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
          outgoingLight += diffuseColor.rgb * vec3(1.0, 0.42, 0.3) * (uHaut * vHaut * (1.0 - smoothstep(0.0, 0.6, hell)) * (0.4 + 0.6 * f));
          outgoingLight += uRandFarbe * (f * uRand * oben) * (0.35 + 0.65 * diffuseColor.rgb);
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'figur-material-2';
  cache.set(key, mat);
  return mat;
}
