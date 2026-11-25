/**
 * @modul    mond
 * @zweck    Mond mit Kratertextur, Phase aus dem Sonnenwinkel und Mondlicht mit Schatten (für Szenen mit Floating Origin)
 * @api      createMond(scene, { abstand=900, seed=37, schattenweite=24, nachtseite='dunkel'|'durchsichtig' }) -> { update({ kamera, richtung, sonne, oben?, nacht?, anker?, sichtbar? }), dispose() }
 * @beispiel
 *   import { createMond } from '../../engine/render/mond.js';
 *   const mond = createMond(scene, { nachtseite: 'durchsichtig' });
 *   mond.update({ kamera: camera.position, richtung: mondDir, sonne: sonnenDir, nacht: 1 });
 * @tags     himmel, mond, licht, nacht, schatten
 * @version  1.1.0
 * @status   entwurf
 * @three    ja
 */
// Alle Richtungen im Weltsystem; anker und kamera im aktuellen Render-Koordinatensystem.
// nachtseite: 'dunkel' = schwach bläuliche Nachtseite (deckend), 'durchsichtig' = nur die beleuchtete Sichel (tagsüber keine Scheibe).
import * as THREE from 'three';
import { rng } from '../core/rng.js';

function mondOberflaeche(seed) {
  const zufall = rng(seed);
  const krater = [];
  for (let i = 0; i < 44; i++) {
    const y = zufall() * 2 - 1, phi = zufall() * Math.PI * 2;
    const k = Math.sqrt(1 - y * y);
    krater.push({ x: k * Math.cos(phi), y, z: k * Math.sin(phi), r: 0.035 + 0.18 * zufall() ** 2 });
  }
  const breite = 256, hoehe = 128, daten = new Uint8Array(breite * hoehe * 4);
  for (let j = 0; j < hoehe; j++) {
    const theta = Math.PI * (1 - (j + 0.5) / hoehe), y = Math.cos(theta);
    for (let i = 0; i < breite; i++) {
      const phi = (i + 0.5) / breite * 2 * Math.PI;
      const x = -Math.sin(theta) * Math.cos(phi), z = Math.sin(theta) * Math.sin(phi);
      const meere = Math.sin(7*x + 2*Math.sin(4*z)) + Math.cos(8*y + 5*z) + 0.4*Math.sin(14*x - 7*y);
      let hell = 190 - 57 * THREE.MathUtils.smoothstep(meere, 0.2, 1.4) + zufall() * 12;
      for (const c of krater) {
        const d2 = 2 * (1 - x*c.x - y*c.y - z*c.z) / (c.r*c.r);
        if (d2 < 1.5) {
          const d = Math.sqrt(Math.max(d2, 0));
          hell += 28 * Math.exp(-90 * (d - 0.92) ** 2) - 35 * (1 - THREE.MathUtils.smoothstep(d, 0.6, 0.95));
        }
      }
      const p = 4 * (j * breite + i);
      daten[p] = hell; daten[p+1] = hell; daten[p+2] = hell; daten[p+3] = 255;
    }
  }
  const karte = new THREE.DataTexture(daten, breite, hoehe);
  karte.wrapS = THREE.RepeatWrapping;
  karte.generateMipmaps = true;
  karte.minFilter = THREE.LinearMipmapLinearFilter;
  karte.magFilter = THREE.LinearFilter;
  karte.needsUpdate = true;
  return karte;
}

export function createMond(scene, { abstand = 900, seed = 37, schattenweite = 24, nachtseite = 'dunkel' } = {}) {
  const karte = mondOberflaeche(seed);
  const uniforms = { karte: { value: karte }, sonne: { value: new THREE.Vector3() } };
  const durch = nachtseite === 'durchsichtig';
  const material = new THREE.ShaderMaterial({
    uniforms, depthWrite: false, transparent: durch, defines: durch ? { DURCHSICHTIG: 1 } : {},
    vertexShader: `varying vec2 vUV;
varying vec3 vNormal;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vUV = uv;
  vNormal = mat3(modelMatrix) * normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  #include <logdepthbuf_vertex>
}`,
    fragmentShader: `uniform sampler2D karte;
uniform vec3 sonne;
varying vec2 vUV;
varying vec3 vNormal;
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  float licht = max(0., dot(normalize(vNormal), sonne));
  float grund = texture2D(karte, vUV).r;
  float hell = sqrt(licht);
#ifdef DURCHSICHTIG
  gl_FragColor = vec4(grund * vec3(1.,.965,.87) * hell, clamp(hell * 1.6, 0., 1.));
#else
  gl_FragColor = vec4(grund * (vec3(.025,.032,.045) + vec3(1.,.965,.87) * hell), 1.);
#endif
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
  const kugel = new THREE.Mesh(new THREE.SphereGeometry(abstand * 0.024, 40, 24), material);
  kugel.renderOrder = -1000;
  const licht = new THREE.DirectionalLight(0xaecaff, 0);
  licht.castShadow = true;
  licht.shadow.mapSize.set(512, 512);
  const sc = licht.shadow.camera;
  Object.assign(sc, { left: -schattenweite, right: schattenweite, top: schattenweite, bottom: -schattenweite, near: 0.1, far: schattenweite * 6 });
  sc.updateProjectionMatrix();
  licht.shadow.normalBias = 0.035;
  licht.shadow.bias = -0.00025;
  scene.add(kugel, licht, licht.target);
  const ursprung = new THREE.Vector3(), auf = new THREE.Vector3(0, 1, 0), richt = new THREE.Vector3();
  return {
    update({ kamera, richtung, sonne, oben = auf, nacht = 1, anker = ursprung, sichtbar = true }) {
      richt.copy(richtung).normalize();
      kugel.position.copy(kamera).addScaledVector(richt, abstand);
      uniforms.sonne.value.copy(sonne).normalize();
      const hoehe = oben.dot(richt);
      kugel.visible = sichtbar && hoehe > -0.025;
      const phase = (1 - richt.dot(uniforms.sonne.value)) / 2;
      licht.intensity = 0.85 * phase * THREE.MathUtils.clamp(nacht, 0, 1) * THREE.MathUtils.smoothstep(hoehe, 0, 0.24);
      if (!sichtbar) licht.intensity = 0;
      licht.visible = licht.intensity > 0.002;
      licht.target.position.copy(anker);
      licht.position.copy(anker).addScaledVector(richt, schattenweite * 3);
    },
    dispose() {
      scene.remove(kugel, licht, licht.target);
      kugel.geometry.dispose(); material.dispose(); karte.dispose(); licht.dispose();
    },
  };
}
