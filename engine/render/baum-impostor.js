/**
 * @modul    baum-impostor
 * @zweck    Ferne Bäume als „Foto“ des echten Modells: jede Art wird beim Start aus N Richtungen in einen Atlas (Farbe + Normale) gerendert und fern als EIN Quad (2 Dreiecke) gezeigt, das sich zur Kamera dreht; Licht aus der gebackenen Normale → sieht aus wie der nahe Baum, kostet fast nichts
 * @api      createBaumImpostor({ renderer, baeume: [{ art, geometrie }], richtungen = 8, px = 128, streulicht = 0.28, alphaTest = 0.42 }) -> { material, geometrie(art) -> BufferGeometry (Quad, für InstancedMesh), hat(art), dispose() }
 * @beispiel
 *   import { createBaumImpostor } from '../../engine/render/baum-impostor.js';
 *   const imp = createBaumImpostor({ renderer, baeume: [{ art: 'eiche', geometrie: eicheGeo }] });
 *   const fern = new THREE.InstancedMesh(imp.geometrie('eiche'), imp.material, 500);   // Instanz-Matrix: Fußpunkt, +Y = oben, Drehung, Skala
 * @tags     render, baum, impostor, billboard, atlas, lod, fern, wald, performance, handy
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';

const VERT_KOPF = `
attribute float impZeile;
attribute vec2 impUv;
uniform float impRichtungen, impZeilen;
varying vec2 vImpUv;
varying vec3 vImpSeite, vImpOben, vImpZu;
`;
// Quad steht im Fußpunkt der Instanz, dreht sich um deren +Y zur Kamera; Bild = die Aufnahme aus der passenden Richtung
const VERT_PROJEKT = `
mat4 iM = modelMatrix * instanceMatrix;
vec3 iBasis = iM[3].xyz;
float iS = length(iM[1].xyz);
vec3 iOben = iM[1].xyz / iS;
vec3 iZu = cameraPosition - iBasis;
iZu -= iOben * dot(iZu, iOben);
float iL = length(iZu);
iZu = iL > 1e-4 ? iZu / iL : normalize(iM[2].xyz);
vec3 iSeite = cross(iOben, iZu);
float iWinkel = atan(dot(iZu, normalize(iM[0].xyz)), dot(iZu, normalize(iM[2].xyz)));
float iBild = mod(floor(iWinkel / 6.2831853 * impRichtungen + 0.5), impRichtungen);
vImpUv = vec2((iBild + impUv.x) / impRichtungen, (impZeile + impUv.y) / impZeilen);
vImpSeite = iSeite; vImpOben = iOben; vImpZu = iZu;
vec4 mvPosition = viewMatrix * vec4(iBasis + (iSeite * position.x + iOben * position.y) * iS, 1.0);
gl_Position = projectionMatrix * mvPosition;
`;

/** Atlas bauen: Zeile = Art, Spalte = Richtung. Ursprung der Geometrien am Fußpunkt, +Y oben, Meter. */
export function createBaumImpostor({ renderer, baeume, richtungen = 8, px = 128, streulicht = 0.28, alphaTest = 0.42 } = {}) {
  const n = baeume.length, W = richtungen * px, H = n * px;
  const ziel = (srgb) => {
    const rt = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: true });
    rt.texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return rt;
  };
  const farbRT = ziel(true), normRT = ziel(false);
  const farbMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const normMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vN;\nvoid main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vN;\nvoid main() { gl_FragColor = vec4(normalize(vN) * 0.5 + 0.5, 1.0); }',
  });
  const szene = new THREE.Scene(), cam = new THREE.OrthographicCamera(), mesh = new THREE.Mesh(undefined, farbMat);
  szene.add(mesh);
  const quads = new Map();

  // Renderer-Zustand sichern
  const altZiel = renderer.getRenderTarget(), altAuto = renderer.autoClear, altFarbe = new THREE.Color(), altAlpha = renderer.getClearAlpha();
  renderer.getClearColor(altFarbe);
  renderer.autoClear = false;

  baeume.forEach(({ art, geometrie }, zeile) => {
    geometrie.computeBoundingBox();
    const bb = geometrie.boundingBox, h = bb.max.y;
    let rxz = 0;
    const p = geometrie.attributes.position.array, c = geometrie.attributes.color.array, mittelF = [0, 0, 0];
    for (let i = 0; i < p.length; i += 3) {
      rxz = Math.max(rxz, Math.hypot(p[i], p[i + 2]));
      if (p[i + 1] > h * 0.5) { mittelF[0] += c[i]; mittelF[1] += c[i + 1]; mittelF[2] += c[i + 2]; }
    }
    const S = Math.max(h * 0.5, rxz) * 1.03, cy = Math.max(h * 0.5, S * 0.98 + bb.min.y);   // Quadrat um den ganzen Baum, Fuß unten
    const D = S * 4;
    Object.assign(cam, { left: -S, right: S, top: S, bottom: -S, near: 0.1, far: D + S * 2 });
    cam.updateProjectionMatrix();
    mesh.geometry = geometrie;
    // Rand-Farbe = mittlere Kronenfarbe mit Alpha 0 → keine dunklen Säume in den Mipmaps
    const summe = Math.max(1e-6, (mittelF[0] + mittelF[1] + mittelF[2]) / 3) ;
    const rand = new THREE.Color(mittelF[0] / summe * 0.25, mittelF[1] / summe * 0.25, mittelF[2] / summe * 0.25);
    for (const [rt, mat, klar] of [[farbRT, farbMat, rand], [normRT, normMat, new THREE.Color(0.5, 0.5, 1)]]) {
      mesh.material = mat;
      renderer.setRenderTarget(rt);
      for (let k = 0; k < richtungen; k++) {
        const th = (k / richtungen) * Math.PI * 2;
        cam.position.set(Math.sin(th) * D, cy, Math.cos(th) * D);
        cam.lookAt(0, cy, 0);
        rt.viewport.set(k * px, zeile * px, px, px);
        rt.scissor.set(k * px, zeile * px, px, px);
        rt.scissorTest = true;
        renderer.setRenderTarget(rt);
        renderer.setClearColor(klar, 0);
        renderer.clear(true, true, false);
        renderer.render(szene, cam);
      }
    }
    // Anzeige-Quad (lokal: x quer, y hoch; Fuß bei y = cy − S)
    const q = new THREE.BufferGeometry();
    q.setAttribute('position', new THREE.Float32BufferAttribute([-S, cy - S, 0, S, cy - S, 0, S, cy + S, 0, -S, cy + S, 0], 3));
    q.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    q.setAttribute('impUv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    q.setAttribute('impZeile', new THREE.Float32BufferAttribute([zeile, zeile, zeile, zeile], 1));
    q.setIndex([0, 1, 2, 0, 2, 3]);
    q.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, cy, 0), S * 1.5);
    quads.set(art, q);
  });
  for (const rt of [farbRT, normRT]) { rt.scissorTest = false; rt.viewport.set(0, 0, W, H); rt.scissor.set(0, 0, W, H); }
  renderer.setRenderTarget(altZiel);
  renderer.autoClear = altAuto;
  renderer.setClearColor(altFarbe, altAlpha);
  mesh.geometry = new THREE.BufferGeometry();
  farbMat.dispose(); normMat.dispose();

  const material = new THREE.MeshStandardMaterial({ map: farbRT.texture, alphaTest, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  material.onBeforeCompile = (sh) => {
    sh.uniforms.impRichtungen = { value: richtungen };
    sh.uniforms.impZeilen = { value: n };
    sh.uniforms.impNormal = { value: normRT.texture };
    sh.vertexShader = VERT_KOPF + sh.vertexShader.replace('#include <project_vertex>', VERT_PROJEKT);
    sh.fragmentShader = 'uniform sampler2D impNormal;\nvarying vec2 vImpUv;\nvarying vec3 vImpSeite, vImpOben, vImpZu;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', 'diffuseColor *= texture2D(map, vImpUv);')
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
{ vec3 iN = texture2D(impNormal, vImpUv).xyz * 2.0 - 1.0;
  normal = normalize((viewMatrix * vec4(normalize(vImpSeite * iN.x + vImpOben * iN.y + vImpZu * iN.z), 0.0)).xyz); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * ${streulicht.toFixed(3)};`);
  };
  material.customProgramCacheKey = () => 'baum-impostor';

  return {
    material,
    geometrie: (art) => quads.get(art),
    hat: (art) => quads.has(art),
    /** Nur für Tests/Galerie: die Atlas-Texturen. */
    atlas: { farbe: farbRT.texture, normale: normRT.texture },
    dispose() { for (const q of quads.values()) q.dispose(); material.dispose(); farbRT.dispose(); normRT.dispose(); },
  };
}
