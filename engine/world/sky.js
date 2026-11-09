/**
 * @modul    sky
 * @zweck    Prozeduraler Himmel als Shader-Kuppel um die Kamera: Farbverlauf Zenit→Horizont, Sonnenscheibe mit Glut, Mond, funkelnde Sterne nachts; handytauglich (ein Mesh, kein Texturzugriff) – passt zu daynight.js
 * @api      createSky(opts) -> {mesh,uniforms,setzeZustand,update,dispose}
 * @beispiel
 *   import { createSky } from '../../engine/world/sky.js';
 *   const himmel = createSky({ radius: 900 });
 *   szene.add(himmel.mesh);
 *   himmel.update(dt, kamera); // Kuppel folgt der Kamera, Sterne funkeln
 * @tags     welt, himmel, sonne, mond, sterne, shader, atmosphaere
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */

import * as THREE from 'three';

const VERTEX = /* glsl */`
varying vec3 vRichtung;
void main() {
  vRichtung = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT = /* glsl */`
uniform vec3 uOben, uHorizont, uNebel, uSonne, uSonnenFarbe, uMond;
uniform float uSterne, uScheibe, uZeit, uSternDichte, uSonnenGroesse;
varying vec3 vRichtung;
void main() {
  vec3 d = normalize(vRichtung);
  float y = d.y;
  // Verlauf: oben gesättigt, am Horizont hell; knapp über/unter dem Horizont Nebelfarbe → keine Naht zum Gelände
  vec3 farbe = mix(uHorizont, uOben, pow(clamp(y, 0.0, 1.0), 0.5));
  farbe = mix(uNebel, farbe, smoothstep(-0.02, 0.12, y));
  // Sonne: Scheibe + weiche Glut (stärker nahe am Horizont = Abendrot)
  float s = dot(d, uSonne);
  float horizontNah = 1.0 - smoothstep(0.0, 0.5, uSonne.y);
  farbe += uSonnenFarbe * smoothstep(uSonnenGroesse, uSonnenGroesse + 0.0006, s) * 1.6 * uScheibe;
  farbe += uSonnenFarbe * pow(max(s, 0.0), 12.0) * (0.12 + 0.35 * horizontNah) * clamp(uScheibe + 0.3, 0.0, 1.0);
  // Mond: Scheibe + leichter Hof, nachts kräftig, tags blass
  float m = dot(d, uMond);
  float mondSicht = (0.25 + 0.75 * uSterne) * smoothstep(-0.05, 0.05, uMond.y);
  farbe += vec3(0.92, 0.94, 1.0) * smoothstep(0.9990, 0.9994, m) * mondSicht;
  farbe += vec3(0.20, 0.25, 0.40) * pow(max(m, 0.0), 60.0) * uSterne;
  // Sterne: Hash auf einem Richtungsgitter, funkeln über die Zeit, nur über dem Horizont
  if (uSterne > 0.001) {
    vec3 q = floor(d * uSternDichte);
    float h = fract(sin(dot(q, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    float stern = step(0.9965, h) * (0.55 + 0.45 * sin(uZeit * 2.0 + h * 90.0));
    farbe += vec3(stern) * uSterne * smoothstep(0.02, 0.25, y);
  }
  gl_FragColor = vec4(farbe, 1.0);
  #include <colorspace_fragment>
}`;

/**
 * opts: radius (900 m – kleiner als kamera.far), segmente ([32,16]), sternDichte (230), sonnenGroesse (Kosinus des
 * Scheibenradius, 0.9988), farben {oben,horizont,nebel} als Hex für den Start.
 */
export function createSky(opts = {}) {
  const radius = opts.radius ?? 900, [sx, sy] = opts.segmente ?? [32, 16];
  const uniforms = {
    uOben: { value: new THREE.Color(opts.farben?.oben ?? 0x4a80bc) },
    uHorizont: { value: new THREE.Color(opts.farben?.horizont ?? 0xa9cbe6) },
    uNebel: { value: new THREE.Color(opts.farben?.nebel ?? 0x9cc4e4) },
    uSonne: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() },
    uSonnenFarbe: { value: new THREE.Color(0xfff1d6) },
    uMond: { value: new THREE.Vector3(-0.3, -0.8, -0.5).normalize() },
    uSterne: { value: 0 }, uScheibe: { value: 1 }, uZeit: { value: 0 },
    uSternDichte: { value: opts.sternDichte ?? 230 },
    uSonnenGroesse: { value: opts.sonnenGroesse ?? 0.9988 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT,
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, sx, sy), material);
  mesh.name = 'himmel';
  mesh.renderOrder = -1000; // zuerst zeichnen, alles andere liegt davor
  mesh.frustumCulled = false;

  return {
    mesh, uniforms,
    /** Zustand aus daynight.tageszeitZustand übernehmen (Farben sRGB 0..1, Richtungen [x,y,z]). */
    setzeZustand(z) {
      uniforms.uOben.value.setRGB(z.oben[0], z.oben[1], z.oben[2], THREE.SRGBColorSpace);
      uniforms.uHorizont.value.setRGB(z.horizont[0], z.horizont[1], z.horizont[2], THREE.SRGBColorSpace);
      const n = z.nebel ?? z.horizont;
      uniforms.uNebel.value.setRGB(n[0], n[1], n[2], THREE.SRGBColorSpace);
      uniforms.uSonne.value.fromArray(z.sonnenRichtung).normalize();
      uniforms.uMond.value.fromArray(z.mondRichtung).normalize();
      const l = z.mondLicht ? [1, 0.75, 0.5] : z.licht; // Sonnenglut unter dem Horizont bleibt warm
      uniforms.uSonnenFarbe.value.setRGB(l[0], l[1], l[2], THREE.SRGBColorSpace);
      uniforms.uSterne.value = z.sterne;
      uniforms.uScheibe.value = z.sonnenScheibe ?? 1;
    },
    /** Kuppel auf die Kamera setzen (wirkt unendlich weit) und Sterne funkeln lassen. */
    update(dt, kamera) {
      uniforms.uZeit.value += dt;
      if (kamera) mesh.position.copy(kamera.position);
    },
    dispose() {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
