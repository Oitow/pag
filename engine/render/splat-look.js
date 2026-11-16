/**
 * @modul    splat-look
 * @zweck    Gaussian-Splat-Look für eine fertige Szene: das Bild wird klein gerendert und als zehntausende weiche, längliche Gauß-Flecken neu gemalt (entlang der Kanten ausgerichtet, nah größer als fern) – Stil-Experiment, keine echten 3D-Splats
 * @api      createSplatLook({ dichte, groesse, laenge, streuung, seed }) -> { an, werte, setze(teil), aufloesung(breite, hoehe), render(renderer, szene, kamera), dispose() } ; splatRaster(breite, hoehe, dichte) -> { spalten, zeilen, anzahl } ; SPLAT_STANDARD
 * @beispiel
 *   import { createSplatLook } from '../../engine/render/splat-look.js';
 *   const splat = createSplatLook({ dichte: 150 });
 *   splat.aufloesung(innerWidth, innerHeight);                       // auch bei 'resize'
 *   // je Bild: if (splat.an) splat.render(renderer, szene, kamera); else renderer.render(szene, kamera);
 * @tags     splat, gaussian, gauss, look, stil, nachbearbeitung, postprocessing, maler, shader
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { rng } from '../core/rng.js';

/** dichte = Splats je kurzer Bildseite, groesse = Fleck-Durchmesser in Zellen, laenge = Streckung entlang Kanten (1 = rund),
 *  streuung = Zufallsversatz in Zellen (0…1). */
export const SPLAT_STANDARD = Object.freeze({ an: false, dichte: 150, groesse: 1.9, laenge: 2.2, streuung: 0.8, seed: 7 });

/** Splat-Gitter fürs Bild: kurze Seite bekommt `dichte` Reihen. */
export function splatRaster(breite, hoehe, dichte) {
  const kurz = Math.max(1, Math.min(breite, hoehe)), d = Math.max(8, Math.round(dichte));
  const spalten = Math.max(1, Math.round(breite / kurz * d)), zeilen = Math.max(1, Math.round(hoehe / kurz * d));
  return { spalten, zeilen, anzahl: spalten * zeilen };
}

const VS = /* glsl */`
  #include <packing>
  uniform sampler2D tFarbe; uniform sampler2D tTiefe;
  uniform vec2 uZelle; uniform vec2 uTexel; uniform vec3 uForm; uniform vec2 uKamera;
  attribute vec2 basis; attribute vec3 zufall;
  varying vec3 vFarbe; varying vec2 vQ;
  float hell(vec2 p) { return dot(texture(tFarbe, p).rgb, vec3(0.299, 0.587, 0.114)); }
  void main() {
    vec2 uv = basis + (zufall.xy - 0.5) * uZelle * uForm.z;
    vec4 f = texture(tFarbe, uv);
    vFarbe = f.rgb * (0.93 + 0.14 * zufall.y);                         // jeder Fleck etwas anders hell – macht die Splats sichtbar
    float z = -perspectiveDepthToViewZ(texture(tTiefe, uv).r, uKamera.x, uKamera.y);
    float nah = mix(1.7, 0.75, smoothstep(2.0, 70.0, z));               // nahe Flecken größer – wie echte Splats im Raum
    vec2 g = vec2(hell(uv + vec2(uTexel.x, 0.0)) - hell(uv - vec2(uTexel.x, 0.0)), hell(uv + vec2(0.0, uTexel.y)) - hell(uv - vec2(0.0, uTexel.y)));
    float gs = length(g);
    vec2 kante = gs > 1e-4 ? vec2(-g.y, g.x) / gs : vec2(cos(zufall.z * 6.2832), sin(zufall.z * 6.2832));
    float streck = mix(1.0, uForm.y, smoothstep(0.01, 0.12, gs));      // an Kanten länglich, in Flächen rund
    vec2 q = position.xy;                                               // −1…1
    vec2 achseA = kante * streck, achseB = vec2(-kante.y, kante.x) / sqrt(streck);
    vec2 versatz = (q.x * achseA + q.y * achseB) * uZelle * uForm.x * nah * (0.85 + 0.3 * zufall.z);
    vQ = q;
    gl_Position = vec4((uv + versatz) * 2.0 - 1.0, 0.0, 1.0);
  }
`;
const FS = /* glsl */`
  varying vec3 vFarbe; varying vec2 vQ;
  void main() {
    float a = exp(-dot(vQ, vQ) * 3.2);
    if (a < 0.03) discard;
    gl_FragColor = vec4(vFarbe, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
const GRUND_VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const GRUND_FS = /* glsl */`
  uniform sampler2D tFarbe; varying vec2 vUv;
  void main() {
    gl_FragColor = vec4(texture(tFarbe, vUv).rgb, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createSplatLook(opts = {}) {
  const w = { ...SPLAT_STANDARD, ...opts };
  let ziel = null, breite = 2, hoehe = 2, raster = null, tot = false;
  const uniforms = {
    tFarbe: { value: null }, tTiefe: { value: null },
    uZelle: { value: new THREE.Vector2() }, uTexel: { value: new THREE.Vector2() },
    uForm: { value: new THREE.Vector3() }, uKamera: { value: new THREE.Vector2(0.1, 400) },
  };
  const splatMat = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: false, depthWrite: false });
  const grundMat = new THREE.ShaderMaterial({ uniforms: { tFarbe: uniforms.tFarbe }, vertexShader: GRUND_VS, fragmentShader: GRUND_FS, depthTest: false, depthWrite: false });
  const grund = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), grundMat);
  grund.frustumCulled = false; grund.renderOrder = 0;
  const quad = new THREE.PlaneGeometry(2, 2);
  let splats = null;
  const buehne = new THREE.Scene(), ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  buehne.add(grund);

  function formUebertragen() { uniforms.uForm.value.set(w.groesse, Math.max(1, w.laenge), w.streuung); }
  formUebertragen();

  function baueSplats() {
    const r = splatRaster(breite, hoehe, w.dichte);
    if (splats && raster && r.anzahl === raster.anzahl && r.spalten === raster.spalten) return;
    raster = r;
    if (splats) { buehne.remove(splats); splats.geometry.dispose(); }
    const zufall = rng(w.seed >>> 0), n = r.anzahl;
    const reihenfolge = new Uint32Array(n);
    for (let i = 0; i < n; i++) reihenfolge[i] = i;
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(zufall() * (i + 1)); const t = reihenfolge[i]; reihenfolge[i] = reihenfolge[j]; reihenfolge[j] = t; }
    const basis = new Float32Array(n * 2), zz = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      const i = reihenfolge[k], x = i % r.spalten, y = (i / r.spalten) | 0;
      basis[k * 2] = (x + 0.5) / r.spalten; basis[k * 2 + 1] = (y + 0.5) / r.zeilen;
      zz[k * 3] = zufall(); zz[k * 3 + 1] = zufall(); zz[k * 3 + 2] = zufall();
    }
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index; g.setAttribute('position', quad.getAttribute('position'));
    g.setAttribute('basis', new THREE.InstancedBufferAttribute(basis, 2));
    g.setAttribute('zufall', new THREE.InstancedBufferAttribute(zz, 3));
    g.instanceCount = n;
    splats = new THREE.Mesh(g, splatMat);
    splats.frustumCulled = false; splats.renderOrder = 1;
    buehne.add(splats);
    uniforms.uZelle.value.set(1 / r.spalten, 1 / r.zeilen);
  }

  function baueZiel(renderer) {
    // Szene etwas feiner als das Splat-Gitter rendern; HDR, wenn das Gerät es kann (Tonemapping erst beim Malen)
    const f = Math.min(1, (w.dichte * 1.6) / Math.max(1, Math.min(breite, hoehe)));
    const zb = Math.max(2, Math.round(breite * f)), zh = Math.max(2, Math.round(hoehe * f));
    if (ziel && ziel.width === zb && ziel.height === zh) return;
    ziel?.dispose();
    const hdr = renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float');
    ziel = new THREE.WebGLRenderTarget(zb, zh, { type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, depthTexture: new THREE.DepthTexture(zb, zh), samples: 0 });
    ziel.texture.minFilter = ziel.texture.magFilter = THREE.LinearFilter;
    uniforms.tFarbe.value = ziel.texture; uniforms.tTiefe.value = ziel.depthTexture;
    uniforms.uTexel.value.set(1.5 / zb, 1.5 / zh);
  }

  const api = {
    get an() { return w.an && !tot; },
    werte: w,
    /** Teilwerte ändern (an, dichte, groesse, laenge, streuung, seed). */
    setze(teil) {
      Object.assign(w, teil);
      formUebertragen();
      if ('dichte' in teil || 'seed' in teil) { raster = null; ziel?.dispose(); ziel = null; }
      return api;
    },
    /** Bildgröße in CSS-Pixeln (Seitenverhältnis + Gitter). */
    aufloesung(b, h) { breite = Math.max(2, b | 0); hoehe = Math.max(2, h | 0); raster = raster && splatRaster(breite, hoehe, w.dichte).anzahl === raster.anzahl ? raster : null; return api; },
    /** Statt renderer.render(szene, kamera). */
    render(renderer, szene, kamera) {
      if (tot) return;
      baueZiel(renderer);
      if (!raster) baueSplats();
      uniforms.uKamera.value.set(kamera.near, kamera.far);
      const vorher = renderer.getRenderTarget();
      renderer.setRenderTarget(ziel);
      renderer.render(szene, kamera);
      renderer.setRenderTarget(vorher);
      renderer.render(buehne, ortho);
    },
    dispose() {
      tot = true;
      ziel?.dispose(); splats?.geometry.dispose(); quad.dispose(); grund.geometry.dispose(); splatMat.dispose(); grundMat.dispose();
    },
  };
  return api;
}
