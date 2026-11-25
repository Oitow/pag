// Rauchsäule über jedem Vulkankrater: weiche Punkte, steigen auf, werden größer und blasser, treiben mit dem Wind.
// Hängt in einer Gruppe mit absoluten Planetenkoordinaten (planet.js: anker, Floating Origin). Ein Draw-Call für alle Vulkane.
import * as THREE from 'three';

const JE_VULKAN = 70, LEBEN = 1;   // Teilchen je Vulkan, Lebenszeit normiert (Phase 0…1)

export function createVulkanRauch(gruppe, { vulkane, planet, R }) {
  const n = vulkane.length * JE_VULKAN;
  const pos = new Float32Array(n * 3), phase = new Float32Array(n), zufall = new Float32Array(n);
  const quellen = vulkane.map((v) => {
    const d = new THREE.Vector3(...v.d).normalize();
    const boden = planet.oberflaeche(d.x, d.y, d.z, 20);
    return { d, p: d.clone().multiplyScalar(R + boden + 30), hoch: v.hoch };
  });
  for (let i = 0; i < n; i++) { phase[i] = (i % JE_VULKAN) / JE_VULKAN; zufall[i] = Math.random(); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('phase', new THREE.BufferAttribute(phase, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('zufall', new THREE.BufferAttribute(zufall, 1));
  const U = { uPixel: { value: 600 }, uLicht: { value: new THREE.Color(1, 1, 1) } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false,
    vertexShader: `
attribute float phase; attribute float zufall;
uniform float uPixel;
varying float vA; varying float vPh;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float groesse = mix(220.0, 1500.0, phase) * (0.7 + 0.6 * zufall);       // Meter
  gl_PointSize = clamp(groesse * uPixel / max(-mv.z, 1.0), 0.0, 512.0);
  vA = smoothstep(0.0, 0.02, phase) * (1.0 - phase); vPh = phase;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`,
    fragmentShader: `
uniform vec3 uLicht;
varying float vA; varying float vPh;
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float a = (1.0 - r * r) * vA * 0.5;
  vec3 c = mix(vec3(0.32, 0.3, 0.29), vec3(0.72, 0.71, 0.7), vPh) * uLicht;
  gl_FragColor = vec4(c, a);
}`,
  });
  const punkte = new THREE.Points(geo, mat);
  punkte.frustumCulled = false;
  gruppe.add(punkte);

  const tmp = new THREE.Vector3();
  /** dt (s), wind = Weltvektor (Einheit, tangential), pixel = Bildhöhe/(2·tan(fov/2)), licht = Farbe der Sonne */
  function update(dt, wind, pixel, licht) {
    U.uPixel.value = pixel; U.uLicht.value.copy(licht);
    for (let q = 0; q < quellen.length; q++) {
      const { d, p, hoch } = quellen[q];
      const steig = hoch * 1.1;                                     // so hoch steigt die Säule (m)
      for (let k = 0; k < JE_VULKAN; k++) {
        const i = q * JE_VULKAN + k;
        let ph = phase[i] + dt / 90 * LEBEN;                         // ~90 s vom Krater bis zum Verwehen
        if (ph >= 1) ph -= 1;
        phase[i] = ph;
        const z = zufall[i];
        tmp.copy(p).addScaledVector(d, steig * ph ** 0.7)             // steigt, wird oben langsamer
          .addScaledVector(wind, steig * 1.4 * ph * ph);             // oben treibt der Wind die Fahne ab
        tmp.x += (z - 0.5) * 300 * ph; tmp.z += (((z * 7.3) % 1) - 0.5) * 300 * ph;
        pos[i * 3] = tmp.x; pos[i * 3 + 1] = tmp.y; pos[i * 3 + 2] = tmp.z;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.phase.needsUpdate = true;
  }
  function dispose() { gruppe.remove(punkte); geo.dispose(); mat.dispose(); }
  return { update, dispose, punkte };
}
