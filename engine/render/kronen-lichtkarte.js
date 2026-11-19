/**
 * @modul    kronen-lichtkarte
 * @zweck    Lichtkarte unter einem Kronendach: kleines Render-Target, orthografisch entlang der Licht-(Sonnen-/Mond-)Richtung, nur Verdecker (Laub, Stämme) – selten neu gerendert (Sonne merklich gewandert oder Mitte verlassen). Liefert Sonnentupfer für beliebige beleuchtete Materialien (ein Texture-Lookup je Fragment, dämpft nur das erste Richtungslicht), GLSL für eigene Shader, CPU-Abfrage aus dem Readback (Lücken für Lichtstrahlen) und reine Helfer zur Lücken-Wahl
 * @api      createKronenLichtkarte({ renderer, groesse = 256, weite = 140, abstand = 700, hoehe = 80, verschiebung = 1.2, wegAnteil = 0.2, minHoehe = 0.12, aussen = 0.7, luft = 25, stammBis = Infinity, minBilder = 20, lesen = true }) -> { textur, uniforms: { uLkKarte, uLkMatrix, uLkStaerke, uLkAussen }, GLSL, fuege(objekt, { geometrie?, material? }), mitLichtkarte(material, { nurLaub }), update(richtung, mitte, zwingen?) -> bool, lichtBei(x, y, z, radius = 1, kanal = 0) -> 0..1, zahlen: { neu, calls }, dispose() } ; brauchtNeu(alt, neu, opts) -> bool ; probeKarte(daten, groesse, u, v, radius = 1, kanal = 0, stride = 4) -> 0..1 Mittelwert ; waehleLuecken(punkte, { max = 10, abstand = 8, schwelle = 0.5 }) -> punkte
 * @beispiel
 *   import { createKronenLichtkarte } from '../../engine/render/kronen-lichtkarte.js';
 *   const lk = createKronenLichtkarte({ renderer, groesse: 256, weite: 140 });
 *   lk.fuege(laub.mesh, { material: laub.deckMaterial }); for (const m of riesen) lk.fuege(m);
 *   lk.mitLichtkarte(boden.material);                     // vor dem ersten Rendern: Sonnentupfer auf dem Boden
 *   if (lk.update(sonnenRichtung, figur.position)) baueStrahlen(lk.lichtBei);   // nur bei Neu-Rendern true
 * @tags     licht, schatten, kronen, wald, sonnentupfer, lichtstrahlen, render-target, tag, nacht, render
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';

// ---------- reine Logik (ohne THREE) ----------

/** Muss neu gerendert werden? alt/neu: { richtung: [x,y,z] (zum Licht), mitte: [x,y,z] }. Bodenverschiebung eines Schattens aus `hoehe` m Höhe > `verschiebung` m oder Mitte > weg m entfernt. */
export function brauchtNeu(alt, neu, { hoehe = 80, verschiebung = 1.2, weg = 28 } = {}) {
  if (!alt) return true;
  const a = alt.richtung, b = neu.richtung, ay = Math.max(a[1], 1e-3), by = Math.max(b[1], 1e-3);
  const dx = a[0] / ay - b[0] / by, dz = a[2] / ay - b[2] / by;           // Bodenversatz je m Höhe
  if (hoehe * Math.hypot(dx, dz) > verschiebung) return true;
  return Math.hypot(alt.mitte[0] - neu.mitte[0], alt.mitte[2] - neu.mitte[2]) > weg;
}

/** Mittelwert eines Kanals (0 … 1, hier: Durchlass) im Fenster (2·radius+1)² um uv aus einem RGBA8-Readback. Außerhalb: null. */
export function probeKarte(daten, groesse, u, v, radius = 1, kanal = 0, stride = 4) {
  if (!daten || u < 0 || v < 0 || u > 1 || v > 1) return null;
  const cx = Math.min(groesse - 1, Math.floor(u * groesse)), cy = Math.min(groesse - 1, Math.floor(v * groesse));
  let s = 0, n = 0;
  for (let y = Math.max(0, cy - radius); y <= Math.min(groesse - 1, cy + radius); y++)
    for (let x = Math.max(0, cx - radius); x <= Math.min(groesse - 1, cx + radius); x++) { s += daten[(y * groesse + x) * stride + kanal]; n++; }
  return s / (n * 255);
}

/** Wählt die hellsten Punkte (licht ≥ schwelle) mit Mindestabstand (m, in xz). punkte: [{ x, z, licht, … }] → höchstens max, hellste zuerst. */
export function waehleLuecken(punkte, { max = 10, abstand = 8, schwelle = 0.5 } = {}) {
  const gut = punkte.filter((p) => p.licht >= schwelle).sort((a, b) => b.licht - a.licht), aus = [];
  for (const p of gut) {
    if (aus.length >= max) break;
    if (aus.every((q) => Math.hypot(q.x - p.x, q.z - p.z) >= abstand)) aus.push(p);
  }
  return aus;
}

// ---------- GLSL ----------

/** Für eigene Shader: uniforms aus `lk.uniforms` einhängen, dann lkLicht(weltPos, nurLaub) → 0 (Schatten) … 1 (Licht); nurLaub = 1: Stämme zählen nicht. */
const GLSL = /* glsl */`uniform sampler2D uLkKarte; uniform mat4 uLkMatrix; uniform float uLkStaerke, uLkAussen;
float lkLicht(vec3 w, float nurLaub) {
  vec4 p = uLkMatrix * vec4(w, 1.0); vec2 uv = p.xy * 0.5 + 0.5;
  vec2 r = min(uv, 1.0 - uv); float innen = smoothstep(0.0, 0.06, min(r.x, r.y));
  vec4 k = texture2D(uLkKarte, uv);
  float d = mix(1.0 - uLkAussen, mix(k.r, k.g, nurLaub), innen);
  return mix(1.0, d, uLkStaerke);
}
`;

/**
 * opts: renderer; groesse (Pixel², 256–512); weite (m quer zur Lichtrichtung); abstand (m, Kamera vor der Mitte zum Licht hin);
 * hoehe/verschiebung (Neu-Rendern, siehe brauchtNeu); minBilder (mindestens so viele update-Aufrufe zwischen zwei Neu-Rendern → Kosten gedeckelt); wegAnteil (Mitte darf so viel der weite wandern); minHoehe (flachste Lichthöhe, sonst endlose Schatten);
 * aussen (Verdeckung außerhalb der Karte); stammBis (Welt-y: Standard-Verdecker darüber ignorieren, z. B. Astwerk im Laub); luft (m über dem Boden, die noch abgedeckt sein sollen: Staub, Figur); lesen (Readback für lichtBei – synchron, nur beim Neu-Rendern).
 */
export function createKronenLichtkarte({ renderer, groesse = 256, weite = 140, abstand = 700, hoehe = 80, verschiebung = 1.2, wegAnteil = 0.2, minHoehe = 0.12, aussen = 0.7, luft = 25, stammBis = Infinity, minBilder = 20, lesen = true } = {}) {
  const ziel = new THREE.WebGLRenderTarget(groesse, groesse, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, generateMipmaps: false });
  ziel.texture.name = 'kronen-lichtkarte';
  const kamera = new THREE.OrthographicCamera(-weite / 2, weite / 2, weite / 2, -weite / 2, 1, abstand * 2);
  const szene = new THREE.Scene();                                   // eigene Szene: keine Lichter, kein Nebel, keine Schattenkarten
  szene.matrixWorldAutoUpdate = false;
  // Karte = Durchlass (1 frei … 0 dicht). Kanäle: R = alle Verdecker, G = nur Laub (Stämme beschatten sich sonst selbst).
  // Multiplikative Mischung ohne Tiefentest: jede Schicht multipliziert ihren Durchlass → Laub wird mit der Zahl der Schichten dichter (wie Beer-Lambert), Reihenfolge egal.
  const malMischung = (m) => Object.assign(m, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, depthTest: false, depthWrite: false });
  const standard = malMischung(new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide, fog: false }));
  // Stämme nur bis `stammBis` (Welt-y): darüber sitzt das Astwerk im Laub, das schon über das Laub-Material zählt
  if (Number.isFinite(stammBis)) standard.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying float vLkY;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
  { vec4 q = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    q = instanceMatrix * q;
  #endif
    vLkY = (modelMatrix * q).y; }`);
    sh.fragmentShader = 'varying float vLkY;\n' + sh.fragmentShader.replace('void main() {', `void main() {\n  if (vLkY > ${stammBis.toFixed(2)}) discard;`);
  };
  const stellvertreter = [], daten = lesen ? new Uint8Array(groesse * groesse * 4) : null;
  const uniforms = { uLkKarte: { value: ziel.texture }, uLkMatrix: { value: new THREE.Matrix4() }, uLkStaerke: { value: 1 }, uLkAussen: { value: aussen } };
  const zahlen = { neu: 0, calls: 0 };
  let stand = null, gelesen = false, bilder = Infinity;
  const r = new THREE.Vector3(), farbeAlt = new THREE.Color();

  /** Verdecker eintragen: Mesh/InstancedMesh (Geometrie und Instanzen werden geteilt, nicht kopiert). geometrie: z. B. eine grobe LOD-Stufe.
   *  Standard: undurchsichtig nur in R (Stamm). material (optional, z. B. laub.deckMaterial): schreibt rgb = Durchlass je Fragment; wird auf multiplikative Mischung umgestellt. */
  function fuege(objekt, { geometrie = objekt.geometry, material = standard } = {}) {
    if (material !== standard) malMischung(material);
    const s = objekt.isInstancedMesh ? new THREE.InstancedMesh(geometrie, material, 0) : new THREE.Mesh(geometrie, material);
    if (objekt.isInstancedMesh) { s.instanceMatrix = objekt.instanceMatrix; s.count = objekt.count; }
    s.matrixAutoUpdate = false; s.frustumCulled = false; s.userData.quelle = objekt;
    szene.add(s); stellvertreter.push(s);
    return s;
  }

  /** Licht-Richtung (ZUM Licht) und Mitte (z. B. Figur). Rendert nur, wenn nötig; true = neu gerendert. */
  function update(richtung, mitte, zwingen = false) {
    r.set(richtung.x, Math.max(richtung.y, minHoehe), richtung.z).normalize();
    const neu = { richtung: [r.x, r.y, r.z], mitte: [mitte.x, mitte.y, mitte.z] };
    bilder++;
    if (!zwingen && (bilder < minBilder || !brauchtNeu(stand, neu, { hoehe, verschiebung, weg: weite * wegAnteil }))) return false;
    stand = neu; bilder = 0;
    kamera.position.set(mitte.x, mitte.y, mitte.z).addScaledVector(r, abstand);
    kamera.up.set(0, 1, 0); if (Math.abs(r.y) > 0.98) kamera.up.set(0, 0, 1);
    kamera.lookAt(mitte.x, mitte.y, mitte.z);
    // Hochkant nur so viel, wie der Boden (± weite/2 entlang der Lichtrichtung) plus `luft` m darüber braucht → bei tiefer Sonne doppelte Auflösung
    const cosE = Math.sqrt(1 - r.y * r.y);
    kamera.top = (weite / 2) * r.y + luft * cosE; kamera.bottom = -(weite / 2) * r.y - 4;
    kamera.updateMatrixWorld(); kamera.updateProjectionMatrix();
    uniforms.uLkMatrix.value.multiplyMatrices(kamera.projectionMatrix, kamera.matrixWorldInverse);
    for (const s of stellvertreter) {
      const q = s.userData.quelle; q.updateWorldMatrix(true, false); s.matrixWorld.copy(q.matrixWorld);
      if (q.isInstancedMesh) s.count = q.count;
      s.visible = q.visible !== false;
    }
    // Zustand des Renderers sichern: Ziel, Klarfarbe, Schatten (sollen hier nicht neu entstehen), Zähler
    const altZiel = renderer.getRenderTarget(), altAlpha = renderer.getClearAlpha(), sm = renderer.shadowMap, altAuto = sm.autoUpdate, altNeed = sm.needsUpdate, altReset = renderer.info.autoReset;
    renderer.getClearColor(farbeAlt);
    sm.autoUpdate = false; sm.needsUpdate = false; renderer.info.autoReset = false;
    const c0 = renderer.info.render.calls;
    renderer.setRenderTarget(ziel); renderer.setClearColor(0xffffff, 1); renderer.clear(true, true, false);
    renderer.render(szene, kamera);
    zahlen.calls = renderer.info.render.calls - c0; zahlen.neu++;
    if (daten) { renderer.readRenderTargetPixels(ziel, 0, 0, groesse, groesse, daten); gelesen = true; }
    renderer.setRenderTarget(altZiel); renderer.setClearColor(farbeAlt, altAlpha);
    sm.autoUpdate = altAuto; sm.needsUpdate = altNeed; renderer.info.autoReset = altReset;
    return true;
  }

  const p4 = new THREE.Vector4();
  /** Licht (0 … 1) an einem Weltpunkt aus dem letzten Readback (radius in Pixeln: gemittelt; kanal 0 = alle, 1 = nur Laub). Ohne Readback/außerhalb: 1 − aussen. */
  function lichtBei(x, y, z, radius = 1, kanal = 0) {
    if (!gelesen) return 1 - aussen;
    p4.set(x, y, z, 1).applyMatrix4(uniforms.uLkMatrix.value);
    const d = probeKarte(daten, groesse, p4.x * 0.5 + 0.5, p4.y * 0.5 + 0.5, radius, kanal);
    return d ?? 1 - aussen;
  }

  /** Sonnentupfer für ein beleuchtetes three-Material (Standard/Lambert/Phong, auch instanziert): dämpft das erste Richtungslicht (die Sonne). Vor dem ersten Rendern.
   *  nurLaub: nur das Laub beschattet (für Stämme selbst – sonst beschatten sie sich, die Karte kennt kein Davor/Dahinter). */
  function mitLichtkarte(material, { nurLaub = false } = {}) {
    const vorher = material.onBeforeCompile, alt = material.customProgramCacheKey?.bind(material);
    material.onBeforeCompile = (s, rr) => {
      vorher?.call(material, s, rr);
      Object.assign(s.uniforms, uniforms);
      s.vertexShader = 'varying vec3 vLkW;\n' + s.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
  { vec4 lkP = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    lkP = instanceMatrix * lkP;
  #endif
    vLkW = (modelMatrix * lkP).xyz; }`);
      const licht = THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalLightInfo( directionalLight, directLight );', `getDirectionalLightInfo( directionalLight, directLight );
		#if ( UNROLLED_LOOP_INDEX == 0 )
		directLight.color *= lkWert;
		#endif`);
      s.fragmentShader = 'varying vec3 vLkW;\n' + GLSL + s.fragmentShader.replace('#include <lights_fragment_begin>', `float lkWert = lkLicht(vLkW, ${nurLaub ? '1.0' : '0.0'});\n` + licht);
    };
    material.customProgramCacheKey = () => 'lichtkarte' + (nurLaub ? 'L' : '') + '|' + (alt ? alt() : '');
    material.needsUpdate = true;
    return material;
  }

  return {
    textur: ziel.texture, uniforms, GLSL, kamera, zahlen, fuege, update, lichtBei, mitLichtkarte,
    get gelesen() { return gelesen; },
    /** Letzter Readback (RGBA8, groesse²) – für Fehlersuche. */
    get daten() { return daten; },
    dispose() { for (const s of stellvertreter) szene.remove(s); stellvertreter.length = 0; standard.dispose(); ziel.dispose(); },
  };
}
