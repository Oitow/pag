/**
 * @modul    natur-material
 * @zweck    Gemeinsames Material für Natur-Assets: MeshStandardMaterial (Vertexfarben, flatShading) mit Wind-Schwingen im Vertex-Shader über das Attribut 'wind' (0 starr … 1 voll); Phase je Instanz aus der Weltposition; passendes Schatten-Material; optional Ausblenden ab Kamera-Entfernung
 * @api      createNaturMaterial({ wind, weite, staerke, richtung, amplitude, grund, roughness }) -> MeshStandardMaterial & { update(zeit, { staerke, richtung }), tiefenMaterial, uniforms } ; patcheShader(shader, uniforms, { wind, weite }) -> shader
 * @beispiel
 *   import { createNaturMaterial } from '../../engine/render/natur-material.js';
 *   const mat = createNaturMaterial({ wind: true });
 *   const baum = new THREE.InstancedMesh(geometrie, mat, 100);
 *   baum.customDepthMaterial = mat.tiefenMaterial;   // Schatten schwingt mit
 *   // je Bild: mat.update(zeit, { staerke: 1, richtung: [1, 0.3] });
 * @tags     natur, material, wind, shader, vegetation, instanzen, render
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';

// Wind: Auslenkung ∝ wind² × Höhe (Meter in Objektkoordinaten) in Windrichtung (Welt), Böen + Pendeln + Blattflattern.
// Phase aus der Weltposition des Objekts/der Instanz → nicht alles schwingt im Takt.
const KOPF = /* glsl */`
uniform float nwZeit, nwStaerke, nwAmp, nwGrund, nwWeite;
uniform vec2 nwRicht;
#ifdef NATUR_WIND
attribute float wind;
#endif
`;
const KOERPER = /* glsl */`
#include <begin_vertex>
{
  mat4 nwM = modelMatrix;
  #ifdef USE_INSTANCING
    nwM = modelMatrix * instanceMatrix;
  #endif
  vec3 nwBasis = nwM[3].xyz;
  #ifdef NATUR_WIND
  if (wind > 0.0 && nwStaerke > 0.0) {
    float nwW = wind * wind;
    float nwT = nwZeit + dot(nwBasis.xz, vec2(0.173, 0.291));
    // Windrichtung (Welt, xz) in Objektkoordinaten: transpose(s·R) = s·Rᵀ, normalisiert → Rᵀ
    mat3 nwR = transpose(mat3(nwM));
    vec3 nwDir = normalize(nwR * vec3(nwRicht.x, 0.0, nwRicht.y));
    vec3 nwSeite = normalize(nwR * vec3(-nwRicht.y, 0.0, nwRicht.x));
    float nwBoe = 0.5 + 0.5 * sin(nwT * 0.83) * sin(nwT * 0.31 + 2.0);
    float nwAus = nwStaerke * nwW * (max(position.y, 0.0) * nwAmp + nwGrund);
    transformed += nwDir * nwAus * (0.55 * nwBoe + 0.35 * sin(nwT * 1.9 + position.y * 0.15));
    transformed += nwSeite * nwAus * 0.22 * sin(nwT * 2.7 + 1.3);
    transformed.y -= nwAus * nwAus * 0.15;
    float nwFl = sin(nwZeit * 9.0 + dot(position, vec3(5.1, 3.7, 4.3)));
    transformed += vec3(0.6, 0.35, 0.6) * (0.035 * nwStaerke * nwW * nwFl);
  }
  #endif
  #ifdef NATUR_WEITE
    transformed *= 1.0 - smoothstep(nwWeite * 0.8, nwWeite, distance(nwBasis.xz, cameraPosition.xz));
  #endif
}
`;

/** Baut den Wind-/Weite-Code in einen three.js-Shader ein (für onBeforeCompile). Exportiert für Tests. */
export function patcheShader(shader, uniforms, { wind = true, weite = 0 } = {}) {
  Object.assign(shader.uniforms, uniforms);
  const defs = (wind ? '#define NATUR_WIND\n' : '') + (weite > 0 ? '#define NATUR_WEITE\n' : '');
  shader.vertexShader = defs + KOPF + shader.vertexShader.replace('#include <begin_vertex>', KOERPER);
  return shader;
}

/**
 * opts: wind (true), weite (0 = aus; >0: Instanzen ab 80 % dieser Kamera-Entfernung schrumpfen auf 0 – für Bodendecker),
 * staerke (1), richtung ([1, 0.35]), amplitude (0.035 m je m Höhe), grund (0.25 m Grund-Auslenkung bei wind=1), roughness (0.9).
 */
export function createNaturMaterial(opts = {}) {
  const { wind = true, weite = 0, staerke = 1, richtung = [1, 0.35], amplitude = 0.035, grund = 0.25, roughness = 0.9 } = opts;
  const uniforms = {
    nwZeit: { value: 0 }, nwStaerke: { value: staerke }, nwAmp: { value: amplitude }, nwGrund: { value: grund },
    nwWeite: { value: weite }, nwRicht: { value: new THREE.Vector2(...richtung).normalize() },
  };
  const flags = { wind, weite };
  const schluessel = `natur-${wind ? 'w' : ''}${weite > 0 ? 'f' : ''}`;
  const aktiv = wind || weite > 0;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness, metalness: 0 });
  const tiefe = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  for (const m of [mat, tiefe]) {
    if (!aktiv) continue;
    m.onBeforeCompile = (shader) => patcheShader(shader, uniforms, flags);
    m.customProgramCacheKey = () => schluessel;
    m.defaultAttributeValues = { ...(m.defaultAttributeValues || {}), wind: [0] };   // Geometrie ohne 'wind' → starr
  }
  mat.tiefenMaterial = tiefe;
  mat.uniforms = uniforms;
  /** Zeit in Sekunden; staerke 0 = Flaute, 1 = normal, 2 = Sturm; richtung [x, z] (Welt). */
  mat.update = (zeit, { staerke: s, richtung: r } = {}) => {
    uniforms.nwZeit.value = zeit;
    if (s !== undefined) uniforms.nwStaerke.value = s;
    if (r) uniforms.nwRicht.value.set(r[0], r[1]).normalize();
  };
  const disposeBasis = mat.dispose.bind(mat);
  mat.dispose = () => { tiefe.dispose(); disposeBasis(); };
  return mat;
}
