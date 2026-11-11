/**
 * @modul    psx
 * @zweck    PS1-Look für eine ganze Szene (aus Viniland übernommen): Eckpunkte rasten auf ein grobes Bildraster (Wackeln), wenige Farbstufen mit Bayer-Dithering, grobe Pixel (kleine interne Auflösung, hart hochskaliert), Stimmung (Kontrast, Sättigung, Tönung, Vignette je Ansicht/Splitscreen) – live an/aus ohne Neu-Kompilieren
 * @api      createPsx({ an, raster, farbtiefe, dither, zeilen, kontrast, saettigung, belichtung, vignette, toenung, nachfassen }) -> { an, werte, uniforms, setze(teil), wendeAn(wurzel), patche(material), material(opts), aufloesung(renderer, breite, hoehe, { pixelRatio }), update(dt, wurzel?), dispose() } ; psxAufloesung(breite, hoehe, zeilen) -> { breite, hoehe, faktor } ; patchePsxShader(shader, uniforms) -> shader ; PSX_STANDARD
 * @beispiel
 *   import { createPsx } from '../../engine/render/psx.js';
 *   const psx = createPsx({ zeilen: 300 });
 *   psx.wendeAn(szene);                                   // alle Materialien der Szene (auch figurMaterial, Natur, Gelände, Himmel)
 *   psx.aufloesung(renderer, innerWidth, innerHeight);    // statt renderer.setSize – auch bei 'resize'
 *   // je Bild: psx.update(dt, szene);                    // fasst später hinzugekommene Dinge nach
 *   psx.setze({ an: false });                             // Vergleich: normaler Look (danach wieder psx.aufloesung(…))
 * @tags     psx, ps1, retro, look, shader, dithering, pixel, vertex-snap, splitscreen, stimmung, grading
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';

/**
 * raster = Zeilen des Rasters, auf das Eckpunkte einrasten (0 = aus, kleiner = wackeliger), farbtiefe = Bit je Farbkanal (0 = aus),
 * dither = Stärke des Musters 0…1, zeilen = interne Auflösung der kurzen Bildseite (0 = volle Auflösung),
 * kontrast/saettigung/belichtung 1 = unverändert, vignette 0…1, toenung = Farbe im Ausgabe-Raum, nachfassen = Sekunden zwischen zwei Durchläufen in update().
 */
export const PSX_STANDARD = Object.freeze({
  an: true, raster: 240, farbtiefe: 5, dither: 1, zeilen: 300,
  kontrast: 1, saettigung: 1, belichtung: 1, vignette: 0, toenung: 0xffffff, nachfassen: 0.5,
});

const VERT_KOPF = 'uniform float uPsxRaster;\nuniform vec4 uPsxAnsicht;\n';
const VERT = /* glsl */`
  #include <project_vertex>
  if (uPsxRaster > 0.0 && gl_Position.w > 0.0) {
    vec2 psxR = vec2(uPsxRaster * uPsxAnsicht.z / max(uPsxAnsicht.w, 1.0), uPsxRaster) * 0.5;
    vec3 psxP = gl_Position.xyz / gl_Position.w;
    psxP.xy = floor(psxP.xy * psxR + 0.5) / psxR;
    gl_Position.xyz = psxP * gl_Position.w;
  }
`;
const FRAG_KOPF = 'uniform vec4 uPsxStimmung;\nuniform vec3 uPsxToenung;\nuniform vec4 uPsxAnsicht;\nuniform vec2 uPsxFarbe;\n';
const FRAG = /* glsl */`
  #include <dithering_fragment>
  {
    vec3 psxC = gl_FragColor.rgb * uPsxStimmung.w;
    float psxG = dot(psxC, vec3(0.299, 0.587, 0.114));
    psxC = mix(vec3(psxG), psxC, uPsxStimmung.y);
    psxC = (psxC - 0.5) * uPsxStimmung.x + 0.5;
    psxC *= uPsxToenung;
    if (uPsxStimmung.z > 0.0) {
      vec2 psxQ = (gl_FragCoord.xy - uPsxAnsicht.xy) / max(uPsxAnsicht.zw, vec2(1.0)) - 0.5;
      psxQ.x *= uPsxAnsicht.z / max(uPsxAnsicht.w, 1.0);
      psxC *= 1.0 - uPsxStimmung.z * smoothstep(0.3, 0.95, length(psxQ));
    }
    psxC = clamp(psxC, 0.0, 1.0);
    if (uPsxFarbe.x > 0.5) {
      int psxX = int(mod(gl_FragCoord.x, 4.0));
      int psxY = int(mod(gl_FragCoord.y, 4.0));
      float psxB[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
      float psxD = ((psxB[psxY * 4 + psxX] + 0.5) / 16.0 - 0.5) * uPsxFarbe.y;
      psxC = floor(psxC * uPsxFarbe.x + psxD + 0.5) / uPsxFarbe.x;
    }
    gl_FragColor.rgb = psxC;
  }
`;

/**
 * Baut den PS1-Code in einen three.js-Shader ein (für onBeforeCompile). Greift nur, wo der Shader die Marken
 * '#include <project_vertex>' (Einrasten) bzw. '#include <dithering_fragment>' (Farben) enthält – eigene
 * ShaderMaterials machen mit, sobald sie '#include <dithering_fragment>' als letzte Zeile von main() haben.
 */
export function patchePsxShader(shader, uniforms) {
  const vs = shader.vertexShader, fs = shader.fragmentShader;
  if (vs && vs.includes('#include <project_vertex>') && !vs.includes('uPsxRaster')) {
    shader.vertexShader = VERT_KOPF + vs.replace('#include <project_vertex>', VERT);
  }
  if (fs && fs.includes('#include <dithering_fragment>') && !fs.includes('uPsxFarbe')) {
    shader.fragmentShader = FRAG_KOPF + fs.replace('#include <dithering_fragment>', FRAG);
  }
  Object.assign(shader.uniforms, uniforms);
  return shader;
}

/** Interne Auflösung: die kurze Bildseite bekommt höchstens `zeilen` Pixel (0 = unverändert), nie mehr als das Original. */
export function psxAufloesung(breite, hoehe, zeilen) {
  const kurz = Math.min(breite, hoehe);
  const faktor = zeilen > 0 && kurz > 0 ? Math.min(1, zeilen / kurz) : 1;
  return { breite: Math.max(2, Math.round(breite * faktor)), hoehe: Math.max(2, Math.round(hoehe * faktor)), faktor };
}

const STANDARD_HOOK = THREE.Material.prototype.onBeforeCompile;

export function createPsx(opts = {}) {
  const w = { ...PSX_STANDARD, ...opts };
  const uniforms = {
    uPsxRaster: { value: 0 },
    uPsxFarbe: { value: new THREE.Vector2(0, 0) },           // x = Farbstufen − 1 (0 = aus), y = Dither-Stärke
    uPsxStimmung: { value: new THREE.Vector4(1, 1, 0, 1) },  // Kontrast, Sättigung, Vignette, Belichtung
    uPsxToenung: { value: new THREE.Color(1, 1, 1) },
    uPsxAnsicht: { value: new THREE.Vector4(0, 0, 1, 1) },   // aktueller Viewport in Pixeln (je Splitscreen-Ansicht)
  };
  const gepatcht = new WeakSet();       // Materialien, die den PS1-Code schon tragen
  const eigene = new Map();             // Materialien aus material() – gehören diesem Objekt
  const szenen = new Map();             // Szene → vorheriges onBeforeRender
  const vp = new THREE.Vector4();
  let seit = 0, tot = false;

  function uebertrage() {
    const an = w.an && !tot;
    uniforms.uPsxRaster.value = an ? Math.max(0, w.raster) : 0;
    uniforms.uPsxFarbe.value.set(an && w.farbtiefe > 0 ? 2 ** w.farbtiefe - 1 : 0, w.dither);
    uniforms.uPsxStimmung.value.set(an ? w.kontrast : 1, an ? w.saettigung : 1, an ? w.vignette : 0, an ? w.belichtung : 1);
    const t = uniforms.uPsxToenung.value;
    if (!an) t.setRGB(1, 1, 1);
    else if (w.toenung && w.toenung.isColor) t.copy(w.toenung);
    else if (typeof w.toenung === 'string') t.setStyle(w.toenung, THREE.LinearSRGBColorSpace);
    else t.setHex(w.toenung, THREE.LinearSRGBColorSpace);     // Wert gilt im Ausgabe-Raum, keine Umrechnung
  }
  uebertrage();

  /** Ein Material mit dem PS1-Look versehen (vorhandene Shader-Hooks bleiben erhalten). Gibt das Material zurück. */
  function patche(material) {
    if (!material || gepatcht.has(material) || material.userData?.psx === false) return material;
    gepatcht.add(material);
    const hook = material.onBeforeCompile;
    const eigenerSchluessel = Object.prototype.hasOwnProperty.call(material, 'customProgramCacheKey') ? material.customProgramCacheKey : null;
    material.onBeforeCompile = function (shader, renderer) {
      if (hook) hook.call(this, shader, renderer);
      patchePsxShader(shader, uniforms);
    };
    material.customProgramCacheKey = function () {
      return (eigenerSchluessel ? eigenerSchluessel.call(this) : (hook && hook !== STANDARD_HOOK ? hook.toString() : '')) + '|psx-1';
    };
    material.needsUpdate = true;
    return material;
  }

  /** Vor jedem Rendern den Viewport merken: Vignette und Raster stimmen dann je Ansicht (Splitscreen). */
  function verfolge(szene) {
    if (szenen.has(szene)) return;
    const vorher = szene.onBeforeRender;
    szenen.set(szene, vorher);
    szene.onBeforeRender = function (renderer, sz, kamera, ziel) {
      if (vorher) vorher.call(this, renderer, sz, kamera, ziel);
      if (ziel) uniforms.uPsxAnsicht.value.set(0, 0, ziel.width, ziel.height);
      else { renderer.getCurrentViewport(vp); uniforms.uPsxAnsicht.value.copy(vp); }
    };
  }

  /** Alle Materialien unter `wurzel` patchen (beliebig oft aufrufbar, schon erledigte kosten nichts). Ausnahme: userData.psx === false. */
  function wendeAn(wurzel) {
    if (!wurzel || tot) return api;
    if (wurzel.isScene) verfolge(wurzel);
    wurzel.traverse((o) => {
      const m = o.material;
      if (!m || o.userData?.psx === false) return;
      if (Array.isArray(m)) for (const x of m) patche(x); else patche(m);
    });
    return api;
  }

  /**
   * Fertiges PS1-Material (Lambert, Vertexfarben, flache Flächen), geteilt je Optionen. opts wie MeshLambertMaterial,
   * zusätzlich einzeln: true (eigenes, nicht geteiltes Material).
   */
  function material(o = {}) {
    const { einzeln, ...rest } = o;
    const p = { vertexColors: true, flatShading: true, ...rest };
    const key = JSON.stringify(p, (k, v) => (v && v.isColor ? v.getHex() : (v && v.isTexture ? v.uuid : v)));
    if (!einzeln && eigene.has(key)) return eigene.get(key);
    const m = patche(new THREE.MeshLambertMaterial(p));
    eigene.set(einzeln ? Symbol('einzeln') : key, m);
    return m;
  }

  /**
   * Größe des Renderers setzen (statt renderer.setSize): bei aktivem Look grobe Pixel, sonst volle Auflösung mit `pixelRatio`.
   * breite/hoehe in CSS-Pixeln. Liefert { breite, hoehe, faktor } der internen Auflösung.
   */
  function aufloesung(renderer, breite, hoehe, { pixelRatio = 1 } = {}) {
    const grob = w.an && !tot && w.zeilen > 0;
    const a = grob ? psxAufloesung(breite, hoehe, w.zeilen) : { breite, hoehe, faktor: 1 };
    renderer.setPixelRatio(grob ? 1 : pixelRatio);
    renderer.setSize(a.breite, a.hoehe, false);
    const stil = renderer.domElement?.style;
    if (stil) { stil.width = breite + 'px'; stil.height = hoehe + 'px'; stil.imageRendering = grob ? 'pixelated' : ''; }
    return a;
  }

  const api = {
    uniforms,
    get an() { return w.an && !tot; },
    /** Kopie der aktuellen Einstellungen. */
    get werte() { return { ...w }; },
    /** Einstellungen ändern (nur übergebene Felder). Nach an/zeilen die Größe neu setzen: aufloesung(…). */
    setze(teil = {}) {
      for (const k of Object.keys(teil)) if (k in PSX_STANDARD && teil[k] !== undefined) w[k] = teil[k];
      uebertrage();
      return api;
    },
    patche, wendeAn, material, aufloesung,
    /** Je Bild: mit `wurzel` werden alle `nachfassen` Sekunden neu hinzugekommene Materialien gepatcht. */
    update(dt, wurzel) {
      if (!wurzel || tot) return;
      seit += dt;
      if (seit >= w.nachfassen) { seit = 0; wendeAn(wurzel); }
    },
    /** Look abschalten (gepatchte Materialien rendern wieder normal), Szenen-Hooks lösen, eigene Materialien freigeben. */
    dispose() {
      tot = true;
      uebertrage();
      for (const [szene, vorher] of szenen) szene.onBeforeRender = vorher;
      szenen.clear();
      for (const m of eigene.values()) m.dispose();
      eigene.clear();
    },
  };
  return api;
}
