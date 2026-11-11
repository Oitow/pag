/**
 * @modul    psx
 * @zweck    PS1-Look für eine ganze Szene (aus Viniland übernommen): Eckpunkte rasten aufs Pixelraster (Wackeln), wenige Farbstufen mit Bayer-Dithering, grobe Pixel (kleine interne Auflösung, hart hochskaliert, alle Pixel gleich groß), Stimmung (Kontrast, Sättigung, Tönung, Vignette je Ansicht/Splitscreen) – ruhig in Bewegung: das Farbmuster wandert mit der Kamera mit statt am Bildschirm zu kleben; live an/aus ohne Neu-Kompilieren
 * @api      createPsx({ an, raster, farbtiefe, dither, ditherFolgt, zeilen, ganzePixel, kontrast, saettigung, belichtung, vignette, toenung, nachfassen }) -> { an, werte, uniforms, setze(teil), wendeAn(wurzel), patche(material), material(opts), aufloesung(renderer, breite, hoehe, { pixelRatio, geraet }), update(dt, wurzel?), dispose() } ; psxAufloesung(breite, hoehe, zeilen, geraet?) -> { breite, hoehe, faktor, pixel } ; patchePsxShader(shader, uniforms) -> shader ; PSX_STANDARD
 * @beispiel
 *   import { createPsx } from '../../engine/render/psx.js';
 *   const psx = createPsx({ zeilen: 300 });
 *   psx.wendeAn(szene);                                   // alle Materialien der Szene (auch figurMaterial, Natur, Gelände, Himmel)
 *   psx.aufloesung(renderer, innerWidth, innerHeight);    // statt renderer.setSize – auch bei 'resize'
 *   // je Bild: psx.update(dt, szene);                    // fasst später hinzugekommene Dinge nach
 *   psx.setze({ an: false });                             // Vergleich: normaler Look (danach wieder psx.aufloesung(…))
 * @tags     psx, ps1, retro, look, shader, dithering, pixel, vertex-snap, splitscreen, stimmung, grading, flimmern, ruhig
 * @version  1.1.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';

/**
 * raster = Raster, auf das Eckpunkte einrasten: 'pixel' = genau das Pixelraster des Bildes (ruhig, wie die echte PS1),
 *   Zahl = eigene Zeilenzahl (kleiner = wackeliger; passt sie nicht zur Auflösung, flimmert es beim Schwenken), 0 = aus,
 * farbtiefe = Bit je Farbkanal (0 = aus), dither = Stärke des Musters 0…1,
 * ditherFolgt = das Muster wandert in ganzen Pixeln mit der Kamera-Bewegung mit (Drehen, seitlich Gehen, Umkreisen), statt
 *   am Bildschirm zu kleben, während die Welt darunter durchrutscht (false = klebt, wie die echte PS1),
 * zeilen = gewünschte interne Auflösung der kurzen Bildseite (0 = volle Auflösung), ganzePixel = jedes grobe Pixel ist gleich
 *   viele Bildschirm-Pixel groß (die Zeilenzahl weicht dafür etwas vom Wunsch ab; false = genau `zeilen`, ungleiche Pixel),
 * kontrast/saettigung/belichtung 1 = unverändert, vignette 0…1, toenung = Farbe im Ausgabe-Raum, nachfassen = Sekunden zwischen zwei Durchläufen in update().
 */
export const PSX_STANDARD = Object.freeze({
  an: true, raster: 'pixel', farbtiefe: 5, dither: 1, ditherFolgt: true, zeilen: 300, ganzePixel: true,
  kontrast: 1, saettigung: 1, belichtung: 1, vignette: 0, toenung: 0xffffff, nachfassen: 0.5,
});

/** Tiefen-Schichten des Farbmusters je 1/Meter: jede Schicht verschiebt ihr Muster passend zu ihrer Entfernung (Parallaxe). */
const SCHICHTEN = 16;

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
const FRAG_KOPF = 'uniform vec4 uPsxStimmung;\nuniform vec3 uPsxToenung;\nuniform vec4 uPsxAnsicht;\nuniform vec2 uPsxFarbe;\nuniform vec4 uPsxMuster;\n' +
  'const float psxB[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);\n';
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
      float psxT = floor(gl_FragCoord.w * ${SCHICHTEN}.0 + 0.5) / ${SCHICHTEN}.0;
      vec2 psxM = gl_FragCoord.xy - floor(uPsxMuster.xy + uPsxMuster.zw * psxT + 0.5);
      int psxX = int(mod(psxM.x, 4.0));
      int psxY = int(mod(psxM.y, 4.0));
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

/**
 * Interne Auflösung: die kurze Bildseite bekommt höchstens `zeilen` Pixel (0 = unverändert), nie mehr als das Original.
 * Mit `geraet` (devicePixelRatio) wird auf ganze Bildschirm-Pixel gerundet: jedes grobe Pixel ist `pixel` × `pixel` Bildschirm-Pixel
 * groß (gleichmäßiges Raster ohne Streifen), die Zeilenzahl liegt dann nur in der Nähe von `zeilen`.
 */
export function psxAufloesung(breite, hoehe, zeilen, geraet = 0) {
  const kurz = Math.min(breite, hoehe);
  if (geraet > 0 && zeilen > 0 && kurz > 0) {
    const pixel = Math.max(1, Math.round(kurz * geraet / zeilen));
    const b = Math.max(2, Math.round(breite * geraet / pixel)), h = Math.max(2, Math.round(hoehe * geraet / pixel));
    return { breite: b, hoehe: h, faktor: Math.min(b / breite, h / hoehe), pixel };
  }
  const faktor = zeilen > 0 && kurz > 0 ? Math.min(1, zeilen / kurz) : 1;
  return { breite: Math.max(2, Math.round(breite * faktor)), hoehe: Math.max(2, Math.round(hoehe * faktor)), faktor, pixel: 1 / faktor };
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
    uPsxMuster: { value: new THREE.Vector4(0, 0, 0, 0) },    // Versatz des Farbmusters in Pixeln: xy = Drehung, zw = Bewegung (× 1/Tiefe)
  };
  const gepatcht = new WeakSet();       // Materialien, die den PS1-Code schon tragen
  const eigene = new Map();             // Materialien aus material() – gehören diesem Objekt
  const szenen = new Map();             // Szene → vorheriges onBeforeRender
  const kameras = new WeakMap();        // Kamera → { p, q, ax, ay, bx, by } (Lage beim letzten Bild + aufgelaufener Muster-Versatz)
  const vp = new THREE.Vector4(), kp = new THREE.Vector3(), kq = new THREE.Quaternion(), kqi = new THREE.Quaternion(), ks = new THREE.Vector3(), kv = new THREE.Vector3();
  let seit = 0, tot = false;

  /** Zeilen des Einrast-Rasters: 'pixel' = Höhe der aktuellen Ansicht in Pixeln (vor dem ersten Bild 240). */
  function rasterZeilen() {
    if (w.raster !== 'pixel') return Math.max(0, +w.raster || 0);
    const h = uniforms.uPsxAnsicht.value.w;
    return h > 1 ? h : 240;
  }

  /**
   * Farbmuster mit der Kamera mitführen. Ein Punkt in Bildmitte wandert beim Drehen um f·tan(Winkel) Pixel, beim seitlichen
   * Bewegen um f·Weg/Tiefe – genau so weit wird das Muster verschoben (in ganzen Pixeln, je Tiefen-Schicht), damit es an der
   * Welt haftet. Vor/zurück Gehen bleibt ohne Versatz (das Bild dehnt sich dabei, ein Muster kann das nicht mitmachen).
   */
  function fuehreMuster(kamera) {
    const m = uniforms.uPsxMuster.value;
    if (!kamera?.matrixWorld || !w.ditherFolgt || !w.an || tot) { m.set(0, 0, 0, 0); return; }
    kamera.matrixWorld.decompose(kp, kq, ks);
    let z = kameras.get(kamera);
    if (!z) { z = { p: kp.clone(), q: kq.clone(), ax: 0, ay: 0, bx: 0, by: 0 }; kameras.set(kamera, z); }
    const e = kamera.projectionMatrix.elements;
    const fx = e[0] * vp.z / 2, fy = e[5] * vp.w / 2;         // Pixel je Einheit in 1 m Tiefe (bzw. je Meter bei Ortho)
    kqi.copy(kq).invert();
    kv.copy(kp).sub(z.p).applyQuaternion(kqi);                // Weg der Kamera seit dem letzten Bild, in ihrem eigenen Raum
    if (kamera.isOrthographicCamera) { z.ax -= fx * kv.x; z.ay -= fy * kv.y; }
    else {
      z.bx -= fx * kv.x; z.by -= fy * kv.y;
      kv.set(0, 0, -1).applyQuaternion(z.q).applyQuaternion(kqi);   // alte Blickrichtung, von der neuen Lage aus gesehen
      if (kv.z < -0.2) { z.ax += fx * kv.x / -kv.z; z.ay += fy * kv.y / -kv.z; }
    }
    if (!Number.isFinite(z.ax + z.ay + z.bx + z.by)) z.ax = z.ay = z.bx = z.by = 0;
    const um = (x, n) => x - n * Math.floor(x / n);          // das Muster wiederholt sich alle 4 Pixel – Zahlen klein halten
    z.ax = um(z.ax, 4); z.ay = um(z.ay, 4); z.bx = um(z.bx, 4 * SCHICHTEN); z.by = um(z.by, 4 * SCHICHTEN);
    z.p.copy(kp); z.q.copy(kq);
    m.set(z.ax, z.ay, z.bx, z.by);
  }

  function uebertrage() {
    const an = w.an && !tot;
    uniforms.uPsxRaster.value = an ? rasterZeilen() : 0;
    uniforms.uPsxFarbe.value.set(an && w.farbtiefe > 0 ? 2 ** w.farbtiefe - 1 : 0, w.dither);
    uniforms.uPsxStimmung.value.set(an ? w.kontrast : 1, an ? w.saettigung : 1, an ? w.vignette : 0, an ? w.belichtung : 1);
    const t = uniforms.uPsxToenung.value;
    if (!an) t.setRGB(1, 1, 1);
    else if (w.toenung && w.toenung.isColor) t.copy(w.toenung);
    else if (typeof w.toenung === 'string') t.setStyle(w.toenung, THREE.LinearSRGBColorSpace);
    else t.setHex(w.toenung, THREE.LinearSRGBColorSpace);     // Wert gilt im Ausgabe-Raum, keine Umrechnung
  }
  uebertrage();

  /**
   * Ein Material mit dem PS1-Look versehen (vorhandene Shader-Hooks bleiben erhalten). Gibt das Material zurück.
   * Eigene Hooks (onBeforeCompile, customProgramCacheKey) VOR dem Patchen setzen; ein createPsx je Szene.
   */
  function patche(material) {
    if (!material || tot || gepatcht.has(material) || material.userData?.psx === false) return material;
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

  /** Vor jedem Rendern Viewport und Kamera merken: Vignette, Raster und Farbmuster stimmen dann je Ansicht (Splitscreen). */
  function verfolge(szene) {
    if (szenen.has(szene)) return;
    const vorher = szene.onBeforeRender;
    szenen.set(szene, vorher);
    szene.onBeforeRender = function (renderer, sz, kamera, ziel) {
      if (vorher) vorher.call(this, renderer, sz, kamera, ziel);
      renderer.getCurrentViewport(vp);                      // gilt auch für Render-Ziele (deren Viewport)
      uniforms.uPsxAnsicht.value.copy(vp);
      uniforms.uPsxRaster.value = w.an && !tot ? rasterZeilen() : 0;
      fuehreMuster(kamera);
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
   * breite/hoehe in CSS-Pixeln, geraet = devicePixelRatio des Bildschirms (Standard: der echte). Liefert { breite, hoehe, faktor, pixel }
   * der internen Auflösung (pixel = Bildschirm-Pixel je grobem Pixel).
   */
  function aufloesung(renderer, breite, hoehe, { pixelRatio = 1, geraet = globalThis.devicePixelRatio || 1 } = {}) {
    const grob = w.an && !tot && w.zeilen > 0;
    const a = grob ? psxAufloesung(breite, hoehe, w.zeilen, w.ganzePixel ? geraet : 0) : { breite, hoehe, faktor: 1, pixel: 1 / pixelRatio };
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
    /** Einstellungen ändern (nur übergebene Felder). Nach an/zeilen/ganzePixel die Größe neu setzen: aufloesung(…). */
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
    /** Look abschalten (gepatchte Materialien rendern wieder normal), Szenen-Hooks lösen, eigene Materialien freigeben. Danach die Größe selbst neu setzen (renderer.setSize). */
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
