// PSX/PS2-Look: Vertex-Snapping, Farb-Quantisierung mit Bayer-Dithering, Lambert-Flat-Shading.
// Jedes Modul nutzt psxMat() für seine Materialien, damit der Look global steuerbar ist.
import * as THREE from 'three';

export const PSX = {
  uniforms: {
    uSnap: { value: 220.0 },     // Raster der Vertex-Snapping (kleiner = wackeliger). 0 = aus
    uDither: { value: 1.0 },     // 1 = Dithering + Farbtiefe 5 Bit, 0 = aus
    uTime: { value: 0.0 },
    // Farb-Grading (global, wird von world.applyAtmosphere pro Ansicht gesetzt)
    uGrade: { value: new THREE.Vector4(1, 1, 0, 1) },   // x = contrast, y = saturation, z = vignette, w = exposure
    uTint: { value: new THREE.Color(1, 1, 1) },
    uView: { value: new THREE.Vector4(0, 0, 1, 1) },    // aktueller Viewport in Pixeln (für Vignette pro Splitscreen-Ansicht)
  },
};

/** Farb-Grading setzen: { contrast=1, saturation=1, tint=0xffffff|Color, vignette=0, exposure=1 } – nur übergebene Felder. */
export function setGrade({ contrast, saturation, tint, vignette, exposure } = {}) {
  const g = PSX.uniforms.uGrade.value;
  if (contrast !== undefined) g.x = contrast;
  if (saturation !== undefined) g.y = saturation;
  if (vignette !== undefined) g.z = vignette;
  if (exposure !== undefined) g.w = exposure;
  if (tint !== undefined) { if (tint.isColor) PSX.uniforms.uTint.value.copy(tint); else PSX.uniforms.uTint.value.setHex(tint, THREE.LinearSRGBColorSpace); } // Werte im Ausgabe-Raum (sRGB), keine Konvertierung
}

/** Hängt an scene.onBeforeRender, damit die Vignette jeder Splitscreen-Ansicht zentriert ist. */
const _vp = new THREE.Vector4();
export function trackViewport(scene) {
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = (renderer, sc, cam, rt) => {
    if (prev) prev(renderer, sc, cam, rt);
    if (rt) PSX.uniforms.uView.value.set(0, 0, rt.width, rt.height);
    else { renderer.getCurrentViewport(_vp); PSX.uniforms.uView.value.copy(_vp); }
  };
}

export function setPSX({ snap, dither } = {}) {
  if (snap !== undefined) PSX.uniforms.uSnap.value = snap;
  if (dither !== undefined) PSX.uniforms.uDither.value = dither ? 1 : 0;
}

const SNAP_VERT = /* glsl */`
  #include <project_vertex>
  if (uSnap > 0.0) {
    vec4 snapPos = gl_Position;
    snapPos.xyz /= snapPos.w;
    snapPos.xy = floor(snapPos.xy * uSnap + 0.5) / uSnap;
    snapPos.xyz *= snapPos.w;
    gl_Position = snapPos;
  }
`;

const DITHER_FRAG = /* glsl */`
  #include <dithering_fragment>
  {
    vec3 gc = gl_FragColor.rgb * uGrade.w;
    float gl = dot(gc, vec3(0.299, 0.587, 0.114));
    gc = mix(vec3(gl), gc, uGrade.y);
    gc = (gc - 0.5) * uGrade.x + 0.5;
    gc *= uTint;
    vec2 vq = (gl_FragCoord.xy - uView.xy) / max(uView.zw, vec2(1.0)) - 0.5;
    vq.x *= uView.z / max(uView.w, 1.0);
    gc *= 1.0 - uGrade.z * smoothstep(0.3, 0.95, length(vq));
    gl_FragColor.rgb = clamp(gc, 0.0, 1.0);
  }
  if (uDither > 0.5) {
    int bx = int(mod(gl_FragCoord.x, 4.0));
    int by = int(mod(gl_FragCoord.y, 4.0));
    float bayer[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
    float d = (bayer[by * 4 + bx] / 16.0 - 0.5) / 31.0;
    gl_FragColor.rgb = floor((gl_FragColor.rgb + d) * 31.0 + 0.5) / 31.0;
  }
`;

/** Patcht ein beliebiges three.js-Material mit dem PSX-Look. Gibt das Material zurück. */
export function patchPSX(material) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    shader.uniforms.uSnap = PSX.uniforms.uSnap;
    shader.uniforms.uDither = PSX.uniforms.uDither;
    shader.uniforms.uTime = PSX.uniforms.uTime;
    shader.uniforms.uGrade = PSX.uniforms.uGrade;
    shader.uniforms.uTint = PSX.uniforms.uTint;
    shader.uniforms.uView = PSX.uniforms.uView;
    shader.vertexShader = 'uniform float uSnap;\nuniform float uTime;\n' +
      shader.vertexShader.replace('#include <project_vertex>', SNAP_VERT);
    shader.fragmentShader = 'uniform float uDither;\nuniform vec4 uGrade;\nuniform vec3 uTint;\nuniform vec4 uView;\n' +
      shader.fragmentShader.replace('#include <dithering_fragment>', DITHER_FRAG);
  };
  material.customProgramCacheKey = () => 'psx-' + (material.userData.psxKey || '');
  return material;
}

const cache = new Map();
/**
 * Standard-Material für alles. opts wie MeshLambertMaterial.
 * Ohne opts: geteiltes Vertex-Color-Flat-Material (empfohlen, spart Draw-State).
 */
export function psxMat(opts = {}) {
  const o = { vertexColors: true, flatShading: true, ...opts };
  const key = JSON.stringify(o, (k, v) => (v && v.isColor ? v.getHex() : (v && v.isTexture ? v.uuid : v)));
  if (!opts.noCache && cache.has(key)) return cache.get(key);
  delete o.noCache;
  const m = patchPSX(new THREE.MeshLambertMaterial(o));
  cache.set(key, m);
  return m;
}
