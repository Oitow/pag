/**
 * @modul    himmel
 * @zweck    Zeichnet den Himmel aus einem himmel-stand: Himmelskuppel mit Farbverlauf, Sonnenscheibe mit Schein, Mond mit Phase, ziehende Wolken, Sterne; steuert Sonnen-/Mondlicht mit mitlaufendem Schatten, Umgebungslicht und Nebel der Szene
 * @api      createHimmel({ szene, schatten=true, schattenWeite=45, schattenAufloesung=2048, schattenAbstand=150, radius=900, sterne=900, seed=1, nebel={nah:120,fern:520}, wolken=true }) -> { gruppe, licht, umgebung, uniforms, update(stand, { kamera, mitte?, zeit?, wind?, windRichtung? }), setNebel(nah, fern), dispose() }
 * @beispiel
 *   import { createHimmel } from '../../engine/world/himmel.js';
 *   import { himmelStand } from '../../engine/world/himmel-stand.js';
 *   const himmel = createHimmel({ szene });
 *   // je Bild:
 *   himmel.update(himmelStand({ stunde, wetter }, stand), { kamera, mitte: figur.position, zeit });
 * @tags     himmel, sonne, mond, sterne, wolken, licht, schatten, nebel, tag, nacht, shader
 * @version  1.1.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { rng } from '../core/rng.js';

const VERT = /* glsl */`
varying vec3 vRicht;
void main() {
  vRicht = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */`
uniform vec3 uZenit, uHorizont, uNebel, uSonneFarbe, uSonne, uMond;
uniform float uTag, uMondHell, uWolken, uZeit;
uniform vec2 uWind;
varying vec3 vRicht;
float hsh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rauschen(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hsh(i), hsh(i + vec2(1, 0)), f.x), mix(hsh(i + vec2(0, 1)), hsh(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec3 d = normalize(vRicht);
  float h = max(d.y, 0.0);
  vec3 farbe = mix(uHorizont, uZenit, pow(h, 0.45));
  farbe = mix(farbe, uNebel, smoothstep(0.0, -0.12, d.y));                 // unter dem Horizont: Nebelfarbe
  // Sonne: Scheibe + Schein
  float cs = dot(d, uSonne);
  float schein = pow(max(cs, 0.0), 180.0) * 0.55 + pow(max(cs, 0.0), 12.0) * 0.16;
  vec3 gestirne = uSonneFarbe * (smoothstep(0.99935, 0.9997, cs) * 6.0 + schein) * (1.0 - uWolken * 0.7);
  // Mond: Scheibe als Kugel beleuchtet aus Richtung Sonne → Phase
  float cm = dot(d, uMond);
  float rand = 0.028;
  vec3 quer = (d - uMond * cm) / rand;
  float q2 = dot(quer, quer);
  if (q2 < 1.0 && cm > 0.0) {
    vec3 n = quer - uMond * sqrt(1.0 - q2);
    float hell = smoothstep(-0.08, 0.12, dot(n, uSonne));
    float krater = 0.82 + 0.18 * rauschen(quer.xy * 3.0 + 7.0);
    gestirne += vec3(0.92, 0.94, 1.0) * (0.03 + hell * krater) * (1.0 - uTag * 0.75) * smoothstep(1.0, 0.85, q2) * (1.0 - uWolken * 0.6);
  }
  gestirne += vec3(0.5, 0.6, 1.0) * pow(max(cm, 0.0), 60.0) * 0.12 * uMondHell * (1.0 - uTag);
  farbe += gestirne * smoothstep(-0.03, 0.02, d.y);
#ifdef WOLKEN
  if (uWolken > 0.01 && d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.14) * 1.6 + uWind * uZeit;
    float n = rauschen(uv) * 0.5 + rauschen(uv * 2.1 + 3.7) * 0.3 + rauschen(uv * 4.3 + 9.1) * 0.2;
    float kante = 1.0 - uWolken * 0.95;
    float decke = smoothstep(kante, kante + 0.3, n) * smoothstep(0.0, 0.16, d.y);
    float lichtSeite = clamp(0.55 + 0.45 * rauschen(uv * 1.3 + uSonne.xz * 0.6), 0.0, 1.0);
    vec3 hellW = mix(vec3(0.07, 0.08, 0.12), mix(uSonneFarbe, vec3(1.0), 0.6), uTag);
    vec3 dunkelW = mix(vec3(0.02, 0.025, 0.04), uHorizont * 0.55 + 0.12, uTag);
    vec3 wolke = mix(dunkelW, hellW, lichtSeite * (1.0 - uWolken * 0.55));
    farbe = mix(farbe, wolke, decke * 0.92);
  }
#endif
  gl_FragColor = vec4(farbe, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <dithering_fragment>
}`;

const setzeFarbe = (ziel, c) => ziel.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);

/** Erzeugt Kuppel, Sterne und Lichter und hängt sie in opts.szene (falls gegeben). */
export function createHimmel(opts = {}) {
  const { szene = null, schatten = true, schattenWeite = 45, schattenAufloesung = 2048, schattenAbstand = 150,
    radius = 900, sterne = 900, seed = 1, wolken = true } = opts;
  const nebel = { nah: 120, fern: 520, ...opts.nebel };
  const gruppe = new THREE.Group();
  gruppe.name = 'himmel';

  // --- Kuppel ---
  const uniforms = {
    uZenit: { value: new THREE.Color() }, uHorizont: { value: new THREE.Color() }, uNebel: { value: new THREE.Color() },
    uSonneFarbe: { value: new THREE.Color() }, uSonne: { value: new THREE.Vector3(0, 1, 0) }, uMond: { value: new THREE.Vector3(0, -1, 0) },
    uTag: { value: 1 }, uMondHell: { value: 1 }, uWolken: { value: 0 }, uZeit: { value: 0 }, uWind: { value: new THREE.Vector2(0.01, 0.004) },
  };
  const kuppelMat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide,
    depthWrite: false, depthTest: false, fog: false, defines: wolken ? { WOLKEN: 1 } : {} });
  const kuppel = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), kuppelMat);
  kuppel.scale.setScalar(radius);
  kuppel.frustumCulled = false; kuppel.renderOrder = -1000;
  gruppe.add(kuppel);

  // --- Sterne (drehen sich mit der Stunde um die Himmelsachse) ---
  let sternPunkte = null;
  if (sterne > 0) {
    const r = rng(seed), pos = new Float32Array(sterne * 3), col = new Float32Array(sterne * 3);
    for (let i = 0; i < sterne; i++) {
      const y = r() * 2 - 1, a = r() * Math.PI * 2, q = Math.sqrt(1 - y * y), hell = 0.35 + 0.65 * r() ** 3, ton = r();
      pos[i * 3] = Math.cos(a) * q; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(a) * q;
      col[i * 3] = hell * (0.85 + 0.15 * ton); col[i * 3 + 1] = hell * 0.92; col[i * 3 + 2] = hell * (1 - 0.15 * ton);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    sternPunkte = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, transparent: true,
      opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    sternPunkte.scale.setScalar(radius * 0.98);
    sternPunkte.frustumCulled = false; sternPunkte.renderOrder = -999; sternPunkte.visible = false;
    gruppe.add(sternPunkte);
  }

  // --- Lichter ---
  const licht = new THREE.DirectionalLight(0xffffff, 2);
  if (schatten) {
    licht.castShadow = true;
    licht.shadow.mapSize.set(schattenAufloesung, schattenAufloesung);
    Object.assign(licht.shadow.camera, { left: -schattenWeite, right: schattenWeite, top: schattenWeite, bottom: -schattenWeite, near: 1, far: schattenAbstand * 2.2 });
    licht.shadow.bias = -0.0005;
  }
  const umgebung = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  gruppe.add(licht, licht.target, umgebung);

  let eigenerNebel = null, alterHintergrund;
  if (szene) {
    szene.add(gruppe);
    if (!szene.fog) szene.fog = eigenerNebel = new THREE.Fog(0xffffff, nebel.nah, nebel.fern);
    alterHintergrund = szene.background;
    szene.background = new THREE.Color();
  }
  const achse = new THREE.Vector3(), null3 = new THREE.Vector3();

  return {
    gruppe, licht, umgebung, uniforms,
    /** Basis-Nebelweite in Metern (klares Wetter); der Stand skaliert sie über `sichtweite`. */
    setNebel(nah, fern) { nebel.nah = nah; nebel.fern = fern; },
    /** Je Bild: stand aus himmelStand(); kamera = THREE.Camera, mitte = Punkt, dem der Schatten folgt (Default Kamera). */
    update(stand, { kamera = null, mitte = null, zeit = 0, wind = 0.3, windRichtung = 0.6 } = {}) {
      const f = stand.farben, u = uniforms;
      setzeFarbe(u.uZenit.value, f.zenit); setzeFarbe(u.uHorizont.value, f.horizont); setzeFarbe(u.uNebel.value, f.nebel);
      setzeFarbe(u.uSonneFarbe.value, f.sonne);
      u.uSonne.value.fromArray(stand.sonneRichtung); u.uMond.value.fromArray(stand.mondRichtung);
      u.uTag.value = stand.tag; u.uMondHell.value = stand.mondHell; u.uWolken.value = stand.wolken; u.uZeit.value = zeit;
      const tempo = 0.004 + wind * 0.02;
      u.uWind.value.set(Math.cos(windRichtung) * tempo, Math.sin(windRichtung) * tempo);

      const kPos = kamera ? kamera.position : null3, m = mitte || kPos;
      kuppel.position.copy(kPos);
      if (sternPunkte) {
        sternPunkte.position.copy(kPos);
        sternPunkte.visible = stand.sterne > 0.01;
        sternPunkte.material.opacity = stand.sterne;
        // Himmelsachse zeigt nach Norden (−z), um den Breitengrad angehoben; grob aus Sonne+Mond nicht nötig → feste 48°
        achse.set(0, 0.743, -0.669);
        sternPunkte.quaternion.setFromAxisAngle(achse, -zeit * 0.002);
      }
      const L = stand.lichtRichtung;
      licht.position.set(m.x + L[0] * schattenAbstand, m.y + L[1] * schattenAbstand, m.z + L[2] * schattenAbstand);
      licht.target.position.copy(m);
      licht.intensity = stand.lichtStaerke;
      setzeFarbe(licht.color, stand.lichtFarbe);
      if (schatten) licht.castShadow = stand.lichtStaerke > 0.02;
      umgebung.intensity = stand.umgebungStaerke;
      setzeFarbe(umgebung.color, f.umgebungHimmel); setzeFarbe(umgebung.groundColor, f.umgebungBoden);
      if (szene) {
        if (szene.fog) {
          setzeFarbe(szene.fog.color, f.nebel);
          if (szene.fog.isFog) { szene.fog.near = nebel.nah * stand.sichtweite * stand.sichtweite; szene.fog.far = nebel.fern * stand.sichtweite; }
        }
        if (szene.background?.isColor) setzeFarbe(szene.background, f.nebel);
      }
    },
    dispose() {
      gruppe.removeFromParent();
      kuppel.geometry.dispose(); kuppelMat.dispose();
      if (sternPunkte) { sternPunkte.geometry.dispose(); sternPunkte.material.dispose(); }
      licht.dispose?.(); umgebung.dispose?.();
      if (szene) { if (eigenerNebel && szene.fog === eigenerNebel) szene.fog = null; szene.background = alterHintergrund ?? null; }
    },
  };
}
