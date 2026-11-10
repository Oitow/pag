/**
 * @modul    figur-material
 * @zweck    Weiches Figuren-Material: Standard-Material mit Randlicht (Fresnel), aufgehellter Schattenseite und kräftigeren Farben – Figuren heben sich vom Gelände ab
 * @api      figurMaterial(opts) -> THREE.MeshStandardMaterial (geteilt je Optionen) ; FIGUR_MATERIAL_STANDARD
 * @beispiel
 *   import { figurMaterial } from '../../engine/render/figur-material.js';
 *   const mat = figurMaterial();                              // eins für alle Figuren (ein Shader-Programm)
 *   const geist = figurMaterial({ rand: 1, randFarbe: 0x80c0ff, material: { transparent: true, opacity: 0.6 } });
 * @tags     figur, charakter, material, shader, randlicht, rim, look
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';

/** Standardwerte: rand = Stärke des Randlichts, weich = Aufhellung der Schattenseite, saettigung = Farbkraft (1 = unverändert). */
export const FIGUR_MATERIAL_STANDARD = Object.freeze({ rand: 0.5, randFarbe: 0xfff0d8, randSchaerfe: 2.6, weich: 0.22, saettigung: 1.18 });

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
  mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8, metalness: 0, ...(o.material || {}) });
  const u = {
    uRand: { value: o.rand }, uRandFarbe: { value: new THREE.Color(o.randFarbe) }, uRandSchaerfe: { value: o.randSchaerfe },
    uWeich: { value: o.weich }, uSatt: { value: o.saettigung },
  };
  mat.userData.figur = u;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uRand, uRandSchaerfe, uWeich, uSatt;\nuniform vec3 uRandFarbe;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        { float g = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)); diffuseColor.rgb = max(mix(vec3(g), diffuseColor.rgb, uSatt), 0.0); }`)
      .replace('#include <opaque_fragment>', `
        { // Schattenseite mit der Eigenfarbe aufhellen + Randlicht (oben stärker, wie Himmelslicht)
          vec3 fn = normalize(normal); vec3 fv = normalize(vViewPosition);
          float f = pow(1.0 - clamp(dot(fn, fv), 0.0, 1.0), uRandSchaerfe);
          float oben = 0.55 + 0.45 * clamp(fn.y * 0.5 + 0.5, 0.0, 1.0);
          outgoingLight += diffuseColor.rgb * uWeich;
          outgoingLight += uRandFarbe * (f * uRand * oben) * (0.35 + 0.65 * diffuseColor.rgb);
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'figur-material-1';
  cache.set(key, mat);
  return mat;
}
