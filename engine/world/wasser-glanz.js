/**
 * @modul    wasser-glanz
 * @zweck    Lebendiges Wasser für vorhandene Wasser-Materialien (Seen/Flüsse/Meer aus terrain-mesh): wandernde Helligkeits-Wellen, kleine Glitzerpunkte und ein Schaumsaum am Ufer – reiner Shader-Hook, keine neue Geometrie, kein Draw-Call mehr
 * @api      createWasserGlanz(materialien, { staerke, glitzer, schaum, schaumFarbe, groesse, tempo }) -> { uniforms, update(zeit), setze(teil), dispose() } ; patcheGlanzShader(shader, uniforms, { ufer }) -> shader
 * @beispiel
 *   import { createWasserGlanz } from '../../engine/world/wasser-glanz.js';
 *   const glanz = createWasserGlanz([gelaende.wasser?.material, gelaende.meer.material]);   // VOR psx.wendeAn(szene)
 *   // je Bild: glanz.update(zeitInSekunden);
 * @tags     wasser, fluss, see, meer, shader, glanz, schaum, ufer, animation, welt
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';

export const GLANZ_STANDARD = Object.freeze({ staerke: 0.14, glitzer: 0.22, schaum: 0.7, schaumFarbe: 0xdfeef2, groesse: 1, tempo: 1 });

const VERT_KOPF = 'varying vec3 vGlanzPos;\n#ifdef GLANZ_UFER\nattribute float ufer;\nvarying float vGlanzUfer;\n#endif\n';
const VERT = `#include <begin_vertex>
  vGlanzPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
#ifdef GLANZ_UFER
  vGlanzUfer = ufer;
#endif
`;
const FRAG_KOPF = 'varying vec3 vGlanzPos;\nuniform vec4 uGlanz;\nuniform vec3 uGlanzSchaum;\nuniform float uGlanzZeit;\n#ifdef GLANZ_UFER\nvarying float vGlanzUfer;\n#endif\n';
// uGlanz = (Stärke, Glitzer, Schaum, 1/Größe)
const FRAG = `#include <color_fragment>
  {
    vec2 gp = vGlanzPos.xz * uGlanz.w;
    float gt = uGlanzZeit;
    float gw = sin(gp.x * 0.9 + gt * 1.3) * sin(gp.y * 0.7 - gt * 1.1) + 0.5 * sin((gp.x + gp.y) * 0.45 + gt * 0.8);
    diffuseColor.rgb *= 1.0 + gw * uGlanz.x;
    float gg = sin(gp.x * 3.1 - gt * 2.3) * sin(gp.y * 2.7 + gt * 1.9);
    diffuseColor.rgb += smoothstep(0.82, 1.0, gg * (0.6 + 0.4 * gw)) * uGlanz.y;
  #ifdef GLANZ_UFER
    float gs = smoothstep(0.62, 0.95, vGlanzUfer + 0.1 * sin(gp.x * 2.1 + gt * 2.0) * sin(gp.y * 1.7 - gt * 1.6));
    diffuseColor.rgb = mix(diffuseColor.rgb, uGlanzSchaum, gs * uGlanz.z);
    diffuseColor.a = mix(diffuseColor.a, 1.0, gs * uGlanz.z * 0.7);
  #endif
  }
`;

/** Shader-Teil einbauen (genau einmal). ufer = Geometrie hat das Attribut `ufer` (terrain-mesh ≥ 1.3). */
export function patcheGlanzShader(shader, uniforms, { ufer = false } = {}) {
  const vs = shader.vertexShader, fs = shader.fragmentShader;
  const def = ufer ? '#define GLANZ_UFER\n' : '';
  if (vs && vs.includes('#include <begin_vertex>') && !vs.includes('vGlanzPos')) {
    shader.vertexShader = def + VERT_KOPF + vs.replace('#include <begin_vertex>', VERT);
  }
  if (fs && fs.includes('#include <color_fragment>') && !fs.includes('vGlanzPos')) {
    shader.fragmentShader = def + FRAG_KOPF + fs.replace('#include <color_fragment>', FRAG);
  }
  Object.assign(shader.uniforms, uniforms);
  return shader;
}

/**
 * materialien: ein Material oder eine Liste (null/undefined werden übersprungen). Schaum nur, wenn ein Mesh mit dem Material
 * das Attribut `ufer` trägt und material.userData.ufer = true ist (setzt terrain-mesh ≥ 1.3). Vor psx.wendeAn() aufrufen (psx behält fremde Hooks).
 */
export function createWasserGlanz(materialien, opts = {}) {
  const w = { ...GLANZ_STANDARD, ...opts };
  const uniforms = {
    uGlanz: { value: new THREE.Vector4() },
    uGlanzSchaum: { value: new THREE.Color() },
    uGlanzZeit: { value: 0 },
  };
  function uebertrage() {
    uniforms.uGlanz.value.set(w.staerke, w.glitzer, w.schaum, 1 / Math.max(0.05, w.groesse));
    uniforms.uGlanzSchaum.value.setHex(w.schaumFarbe, THREE.LinearSRGBColorSpace);
  }
  uebertrage();
  const liste = (Array.isArray(materialien) ? materialien : [materialien]).filter(Boolean);
  const vorher = new Map();
  for (const m of liste) {
    if (vorher.has(m)) continue;
    const hook = m.onBeforeCompile, schluessel = m.customProgramCacheKey;
    vorher.set(m, { hook, schluessel, eigen: Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile') });
    m.onBeforeCompile = function (shader, renderer) {
      if (hook) hook.call(this, shader, renderer);
      patcheGlanzShader(shader, uniforms, { ufer: !!m.userData.ufer });
    };
    m.customProgramCacheKey = function () { return (schluessel ? schluessel.call(this) : '') + '|glanz-1' + (m.userData.ufer ? 'u' : ''); };
    m.needsUpdate = true;
  }
  let zeit0 = null;
  return {
    uniforms,
    /** zeit = Sekunden (beliebiger Nullpunkt). */
    update(zeit) { if (zeit0 === null) zeit0 = zeit; uniforms.uGlanzZeit.value = ((zeit - zeit0) * w.tempo) % 10000; },
    setze(teil) { Object.assign(w, teil); uebertrage(); },
    dispose() {
      for (const [m, v] of vorher) {
        if (v.eigen) m.onBeforeCompile = v.hook; else delete m.onBeforeCompile;
        delete m.customProgramCacheKey;
        if (v.schluessel && v.schluessel !== THREE.Material.prototype.customProgramCacheKey) m.customProgramCacheKey = v.schluessel;
        m.needsUpdate = true;
      }
      vorher.clear();
    },
  };
}
