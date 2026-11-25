// Wolkendecke als Kugelschale (R + Höhe) um den Planeten: Bedeckung aus dem Wetter (zw.wetter.wolken), treibt mit dem Wind,
// von oben und unten sichtbar (beim Fliegen über die Wolken). Rauschen im Shader aus der Weltrichtung – kein Gitter sichtbar.
// Floating Origin: Mittelpunkt liegt bei −cam (planet.js setzt position).
import * as THREE from 'three';

export function createWolken(scene, { R, hoehe = 2200 }) {
  const U = {
    uBedeckung: { value: 0.3 }, uVersatz: { value: new THREE.Vector3() }, uSonne: { value: new THREE.Vector3(0, 1, 0) },
    uTag: { value: 1 }, uDunkel: { value: 0 }, uLicht: { value: new THREE.Color(1, 1, 1) }, uHimmel: { value: new THREE.Color(0.6, 0.7, 0.8) },
    uRadius: { value: R + hoehe },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `
varying vec3 vP; varying vec3 vView;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vP = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`,
    fragmentShader: `
uniform float uBedeckung, uTag, uDunkel, uRadius; uniform vec3 uVersatz, uSonne, uLicht, uHimmel;
varying vec3 vP; varying vec3 vView;
#include <logdepthbuf_pars_fragment>
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float rausch(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p, float okt) {
  float s = 0.0, a = 0.5;
  for (int o = 0; o < 5; o++) { if (float(o) >= okt) break; s += a * rausch(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return s;
}
void main() {
  #include <logdepthbuf_fragment>
  float dist = length(vView);
  float fern = 1.0 - smoothstep(25000.0, 70000.0, dist);
  if (fern <= 0.0) discard;
  vec3 p = (vP + uVersatz) / 2600.0;
  float okt = dist < 8000.0 ? 5.0 : dist < 20000.0 ? 4.0 : 3.0;          // fern weniger Feinheit (kein Flimmern)
  float n = fbm(p, okt) + 0.35 * (fbm(p * 0.23 + 4.1, 2.0) - 0.5);
  float schwelle = mix(0.56, 0.2, uBedeckung);
  float a = smoothstep(schwelle, schwelle + 0.1, n);
  if (a < 0.01) discard;
  vec3 auf = normalize(vP);
  float licht = 0.55 + 0.45 * max(0.0, dot(auf, uSonne));
  float dicht = smoothstep(schwelle, schwelle + 0.3, n);                 // dicke Stellen dunkler (Unterseite)
  vec3 sonneF = uLicht / max(max(uLicht.r, uLicht.g), max(uLicht.b, 0.001));   // nur der Farbton der Sonne (Abendrot)
  vec3 c = mix(vec3(1.0), sonneF, 0.35) * licht * (0.25 + 0.75 * uTag) * mix(1.0, 0.5, dicht * uDunkel);
  c = mix(c, uHimmel, 0.25 + 0.5 * smoothstep(8000.0, 60000.0, dist)); // Dunst
  gl_FragColor = vec4(c, a * fern * 0.92);
}`,
  });
  const kugel = new THREE.Mesh(new THREE.SphereGeometry(R + hoehe, 256, 128), mat);
  kugel.frustumCulled = false;
  kugel.renderOrder = 5;
  scene.add(kugel);

  /** cam = Kameraposition (absolut), wetter = zw.wetter, windWelt = Einheitsvektor, sonne = Richtung, tag 0…1, licht/himmel = Farben */
  function update(dt, { cam, wetter, windWelt, sonne, tag, licht, himmel, raum }) {
    kugel.position.set(-cam.x, -cam.y, -cam.z);
    kugel.visible = raum < 0.6;
    U.uBedeckung.value = wetter.wolken;
    U.uDunkel.value = Math.min(1, wetter.regen + wetter.schnee + (wetter.art === 'gewitter' ? 0.5 : 0));
    U.uVersatz.value.addScaledVector(windWelt, -(3 + 25 * wetter.wind) * dt);   // treibt mit dem Wind
    U.uSonne.value.copy(sonne);
    U.uTag.value = tag;
    U.uLicht.value.copy(licht);
    U.uHimmel.value.copy(himmel);
  }
  function dispose() { scene.remove(kugel); kugel.geometry.dispose(); mat.dispose(); }
  return { update, dispose, kugel };
}
