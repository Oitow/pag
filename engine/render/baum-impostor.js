/**
 * @modul    baum-impostor
 * @zweck    Ferne Bäume als „Foto“ des echten Modells: jede Art wird beim Start aus N Richtungen und 2 Höhen (seitlich, 40° von oben) in einen Atlas (Farbe + Normale) gerendert und fern als EIN Quad (2 Dreiecke) gezeigt, das sich zur Kamera dreht; Licht aus der gebackenen Normale → sieht aus wie der nahe Baum, kostet fast nichts
 * @api      createBaumImpostor({ renderer, baeume: [{ art, geometrie }], richtungen = 8, px = 128, streulicht = 0.28, alphaTest = 0.42 }) (Instanz-Attribut `ueber` optional, engine/render/ueberblenden) -> { material, geometrie(art) -> BufferGeometry (Quad, für InstancedMesh), hat(art), dispose() }
 * @beispiel
 *   import { createBaumImpostor } from '../../engine/render/baum-impostor.js';
 *   const imp = createBaumImpostor({ renderer, baeume: [{ art: 'eiche', geometrie: eicheGeo }] });
 *   const fern = new THREE.InstancedMesh(imp.geometrie('eiche'), imp.material, 500);   // Instanz-Matrix: Fußpunkt, +Y = oben, Drehung, Skala
 * @tags     render, baum, impostor, billboard, atlas, lod, fern, wald, performance, handy
 * @version  1.1.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { UEBER_VERT_KOPF, UEBER_VERT, UEBER_FRAG_KOPF, UEBER_FRAG } from './ueberblenden.js';

const HOCH = 40 * Math.PI / 180;   // zweite Aufnahme-Höhe (Blick von schräg oben, z. B. Gleiter)

const VERT_KOPF = UEBER_VERT_KOPF + `
attribute float impZeile;
attribute vec2 impUv;
attribute float impMitte;
uniform float impRichtungen, impZeilen;
varying vec2 vImpUv;
varying vec3 vImpSeite, vImpOben, vImpZu;
`;
// Quad steht im Fußpunkt der Instanz, dreht sich um deren +Y zur Kamera; Bild = die Aufnahme aus der passenden Richtung
const VERT_PROJEKT = UEBER_VERT + `
mat4 iM = modelMatrix * instanceMatrix;
vec3 iBasis = iM[3].xyz;
float iS = length(iM[1].xyz);
vec3 iOben = iM[1].xyz / iS;
vec3 iMitte = iBasis + iOben * impMitte * iS;
vec3 iBlick = normalize(cameraPosition - iMitte);
vec3 iFlach = iBlick - iOben * dot(iBlick, iOben);
float iL = length(iFlach);
vec3 iZuH = iL > 1e-4 ? iFlach / iL : normalize(iM[2].xyz);
float iWinkel = atan(dot(iZuH, normalize(iM[0].xyz)), dot(iZuH, normalize(iM[2].xyz)));
float iBild = mod(floor(iWinkel / 6.2831853 * impRichtungen + 0.5), impRichtungen);
float iHoch = dot(iBlick, iOben) > 0.34 ? 1.0 : 0.0;          // ab ~20° von oben: Aufnahme von schräg oben
// Blickrichtung des gewählten Bildes (wie bei der Aufnahme) → Quad steht senkrecht dazu, um die Baummitte
float iE = iHoch * ${HOCH.toFixed(4)};
vec3 iZu = normalize(iZuH * cos(iE) + iOben * sin(iE));
vec3 iSeite = normalize(cross(iOben, iZuH));
vec3 iAuf = cross(iZu, iSeite);
vImpUv = vec2((iBild + impUv.x) / impRichtungen, (impZeile * 2.0 + iHoch + impUv.y) / impZeilen);
vImpSeite = iSeite; vImpOben = iAuf; vImpZu = iZu;
vec4 mvPosition = viewMatrix * vec4(iMitte + (iSeite * position.x + iAuf * position.y) * iS, 1.0);
gl_Position = projectionMatrix * mvPosition;
`;

/** Atlas bauen: Zeile = Art, Spalte = Richtung. Ursprung der Geometrien am Fußpunkt, +Y oben, Meter. */
export function createBaumImpostor({ renderer, baeume, richtungen = 8, px = 128, streulicht = 0.28, alphaTest = 0.42 } = {}) {
  const n = baeume.length, W = richtungen * px, H = n * 2 * px;
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
    // Quadrat um den ganzen Baum (auch schräg von oben gesehen), Mitte in halber Höhe
    const cy = h * 0.5, S = Math.max(h * 0.5, rxz, 0.5 * (h * Math.cos(HOCH) + 2 * rxz * Math.sin(HOCH))) * 1.04;
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
      for (let k = 0; k < richtungen * 2; k++) {
        const th = ((k % richtungen) / richtungen) * Math.PI * 2, e = k < richtungen ? 0 : HOCH, z2 = zeile * 2 + (k < richtungen ? 0 : 1);
        cam.position.set(Math.sin(th) * Math.cos(e) * D, cy + Math.sin(e) * D, Math.cos(th) * Math.cos(e) * D);
        cam.up.set(0, 1, 0);
        cam.lookAt(0, cy, 0);
        rt.viewport.set((k % richtungen) * px, z2 * px, px, px);
        rt.scissor.set((k % richtungen) * px, z2 * px, px, px);
        rt.scissorTest = true;
        renderer.setRenderTarget(rt);
        renderer.setClearColor(klar, 0);
        renderer.clear(true, true, false);
        renderer.render(szene, cam);
      }
    }
    // Anzeige-Quad (um die Baummitte: x quer, y hoch; impMitte = Höhe der Mitte)
    const q = new THREE.BufferGeometry();
    q.setAttribute('position', new THREE.Float32BufferAttribute([-S, -S, 0, S, -S, 0, S, S, 0, -S, S, 0], 3));
    q.setAttribute('impMitte', new THREE.Float32BufferAttribute([cy, cy, cy, cy], 1));
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
    sh.uniforms.impZeilen = { value: n * 2 };
    sh.uniforms.impNormal = { value: normRT.texture };
    sh.vertexShader = VERT_KOPF + sh.vertexShader.replace('#include <project_vertex>', VERT_PROJEKT);
    sh.fragmentShader = UEBER_FRAG_KOPF + 'uniform sampler2D impNormal;\nvarying vec2 vImpUv;\nvarying vec3 vImpSeite, vImpOben, vImpZu;\n' + sh.fragmentShader
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + UEBER_FRAG)
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
