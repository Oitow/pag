// Dunst / Luftperspektive für Wildgrund: ersetzt THREEs Nebel-Bausteine (ein Mal, vor dem ersten Material).
// Kosten: nur ein paar Rechenschritte im Fragment-Shader, keine Extra-Pässe.
// - Entfernung (EXP2) × Höhe: im Tal dicker, oben dünner, im Weltraum weg.
// - Farbe: Himmelsfarbe, leicht aufgehellt; zur Sonne hin Glanz in Sonnenfarbe (abends warm, nachts schwarz).
// - Die Sonne ist (als erstes, schattenwerfendes) Richtungslicht schon in jedem Shader: Richtung+Farbe kommen von dort.
import * as THREE from 'three';

// Gemeinsamer GLSL-Teil für Fernwald-Punkte (eigener Shader): Sonnenglanz im Dunst
export const DUNST_GLSL = `
vec3 dunstGlanz(vec3 richtung, vec3 sonneRicht, vec3 sonneFarbe, float anteil) {
  float s = max(dot(normalize(richtung), sonneRicht), 0.0);
  return sonneFarbe * (0.05 * pow(s, 3.0) + 0.09 * pow(s, 14.0)) * anteil;
}`;

let _da = false;
export function installiereDunst() {
  if (_da) return; _da = true;
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = `#ifdef USE_FOG\nvarying float vFogDepth; varying vec3 vFogRicht;\n#endif`;
  C.fog_vertex = `#ifdef USE_FOG\nvFogDepth = - mvPosition.z; vFogRicht = mvPosition.xyz;\n#endif`;
  C.fog_pars_fragment = `#ifdef USE_FOG
uniform vec3 fogColor; varying float vFogDepth; varying vec3 vFogRicht;
#ifdef FOG_EXP2
uniform float fogDensity;
#else
uniform float fogNear; uniform float fogFar;
#endif
${DUNST_GLSL}
#endif`;
  C.fog_fragment = `#ifdef USE_FOG
#ifdef FOG_EXP2
float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
#else
float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
#endif
vec3 dunstC = fogColor;
#if NUM_DIR_LIGHTS > 0 && ( defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG ) || defined( TOON ) )   // nur beleuchtete Materialien haben directionalLights
dunstC += dunstGlanz(vFogRicht, directionalLights[0].direction, directionalLights[0].color, fogFactor);
#endif
gl_FragColor.rgb = mix(gl_FragColor.rgb, linearToOutputTexel(vec4(dunstC, 1.0)).rgb, fogFactor);
#endif`;
}

const _hell = new THREE.Color(0.62, 0.7, 0.8), _warm = new THREE.Color(1, 0.5, 0.25);
const _s = new THREE.Color();
// Pro Bild: Nebelfarbe + -dichte setzen. o = { fog, himmel, hs (Sonnenhöhe -1..1), tag, raum, hoehe (m über Boden), W (Wetter) }
export function aktualisiereDunst(o) {
  const { fog, himmel, hs, tag, raum, hoehe, W, R } = o, sm = THREE.MathUtils.smoothstep;
  // Farbe: Himmel, tagsüber zum Horizont hin blasser/kühler; in der Dämmerung warm
  const daemmer = sm(hs, -0.15, 0.0) * (1 - sm(hs, 0.03, 0.35));
  fog.color.copy(himmel).lerp(_hell, 0.3 * tag * (1 - raum)).lerp(_warm, 0.25 * daemmer * (1 - raum));
  // Dichte: Grunddunst nimmt mit der Höhe ab (Tal dick, Berg dünn), Bodennebel morgens/abends tief unten
  const grund = (0.45 + 0.55 * Math.exp(-Math.max(hoehe, 0) / 1800)) * (1 + 1.4 * daemmer * Math.exp(-Math.max(hoehe, 0) / 250));
  fog.density = (1 - raum) * (3.4 / (R * 0.35) * grund + W.nebel * 0.006 + (W.regen + W.schnee) * 0.0012);
}
