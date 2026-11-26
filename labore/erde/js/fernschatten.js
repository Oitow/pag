// Fernschatten für Wildgrund: Berge werfen Schatten über Täler (bis ~1,6 km um den Spieler).
// Zweites Richtungslicht ohne eigene Helligkeit (intensity 0) mit großer, grober Schattenkarte. Ein kleiner
// Eingriff in THREEs Licht-Baustein multipliziert dessen Schatten auf die Sonne (Licht 0) – für ALLE Materialien
// (Boden, Bäume, Felsen), nah blendet er aus (dort gilt die feine Sonnenschattenkarte ±40 m).
// Billig: Die Karte wird nur selten neu gerendert (Kamera ≥ 120 m gewandert, Sonne gewandert oder alle 1,5 s).
// Floating Origin: zwischen zwei Neuberechnungen wird die Schattenmatrix um den Kameraweg verschoben.
// Vertrag: muss VOR dem Mond (oder anderen schattenwerfenden Richtungslichtern) direkt nach der Sonne in die Szene,
// damit es Schattenindex 1 bekommt (Sonne = 0).
import * as THREE from 'three';

export const FERN_WEITE = 1600;   // m, halbe Kantenlänge des Schattenkastens
const NAH_AUS = 30, NAH_EIN = 38;  // m: hier übernimmt der Fernschatten von der feinen Sonnenschattenkarte

let _da = false;
function installiere() {
  if (_da) return; _da = true;
  const C = THREE.ShaderChunk;
  C.shadowmap_pars_fragment += `
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 1
float fernSchatten(float d) {
  DirectionalLightShadow fs = directionalLightShadows[ 1 ];
  float w = smoothstep(${NAH_AUS.toFixed(1)}, ${NAH_EIN.toFixed(1)}, d) * (1.0 - smoothstep(${(FERN_WEITE * 0.72).toFixed(1)}, ${(FERN_WEITE * 0.95).toFixed(1)}, d));
  if (w < 0.001 || fs.shadowIntensity < 0.001) return 1.0;
  float s = getShadow( directionalShadowMap[ 1 ], fs.shadowMapSize, fs.shadowIntensity, fs.shadowBias, fs.shadowRadius, vDirectionalShadowCoord[ 1 ] );
  return mix(1.0, s, w);
}
#endif`;
  const alt = 'vDirectionalShadowCoord[ i ] ) : 1.0;\n\t\t#endif';
  if (!C.lights_fragment_begin.includes(alt)) { console.warn('fernschatten: Licht-Baustein unbekannt – Fernschatten aus'); return; }
  C.lights_fragment_begin = C.lights_fragment_begin.replace(alt, `${alt}
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX == 0 ) && ( NUM_DIR_LIGHT_SHADOWS > 1 )
		directLight.color *= receiveShadow ? fernSchatten( length( geometryPosition ) ) : 1.0;
		#endif`);
}

/** licht in die Szene hängen (direkt nach der Sonne). update() jedes Bild VOR renderer.render(), nachRender() danach. */
export function createFernSchatten({ renderer }) {
  installiere();
  const licht = new THREE.DirectionalLight(0xffffff, 0);   // gibt kein Licht, nur die Schattenkarte
  licht.castShadow = true;
  licht.shadow.autoUpdate = false;
  licht.shadow.intensity = 0;
  const sc = licht.shadow.camera;
  Object.assign(sc, { left: -FERN_WEITE, right: FERN_WEITE, top: FERN_WEITE, bottom: -FERN_WEITE, near: 10, far: 50000 });
  sc.updateProjectionMatrix();
  let groesse = 0;
  const M0 = new THREE.Matrix4(), C0 = new THREE.Vector3(), S0 = new THREE.Vector3(), T = new THREE.Matrix4();
  const u = new THREE.Vector3(), v = new THREE.Vector3();
  let hatKarte = false, faengtAuf = false, uhr = 0;

  function setzeGroesse(n) {
    groesse = n;
    if (!n) { licht.shadow.intensity = 0; return; }
    if (licht.shadow.mapSize.x !== n) {
      licht.shadow.mapSize.set(n, n);
      if (licht.shadow.map) { licht.shadow.map.dispose(); licht.shadow.map = null; }
      hatKarte = false;
    }
    const texel = (2 * FERN_WEITE) / n;
    licht.shadow.bias = -0.00004;            // × 50 km Tiefe ≈ 2 m
    licht.shadow.normalBias = texel * 1.5;   // grobe Texel: Gelände nicht selbst beschatten
    licht.shadow.radius = 1;
  }

  /** cam = Kameralage (m, absolut), sonne = Richtung zur Sonne (Einheit), an = Schatten jetzt sinnvoll, staerke 0…1. */
  function update(dt, cam, sonne, an, staerke) {
    uhr += dt;
    if (!groesse || !an) { licht.shadow.intensity = 0; return; }
    licht.shadow.intensity = staerke;
    // beim schnellen Fliegen nicht jedes Bild neu (ganze Welt in 2048²): Abstand/Sonne lösen höchstens alle 0,35 s aus
    const neu = !hatKarte || uhr > 1.5 || ((cam.distanceTo(C0) > 120 || sonne.dot(S0) < 0.99998) && uhr > 0.35);
    if (neu) {
      // Kasten um die Kamera, in Texelschritten der Sonnenebene eingerastet (kein Flimmern an Kanten)
      u.set(0, 1, 0).cross(sonne); if (u.lengthSq() < 1e-6) u.set(1, 0, 0).cross(sonne); u.normalize();
      v.crossVectors(sonne, u);
      const texel = (2 * FERN_WEITE) / groesse;
      const a = cam.dot(u), b = cam.dot(v);
      licht.target.position.copy(u).multiplyScalar(Math.round(a / texel) * texel - a).addScaledVector(v, Math.round(b / texel) * texel - b);
      licht.position.copy(licht.target.position).addScaledVector(sonne, 25000);
      licht.target.updateMatrixWorld();
      licht.shadow.needsUpdate = true;
      renderer.shadowMap.needsUpdate = true;
      C0.copy(cam); S0.copy(sonne); uhr = 0; faengtAuf = true;
    } else if (hatKarte) {
      // Zwischenbild: Welt ist um (cam − C0) verschoben → Matrix nachführen (wird von THREE erst beim nächsten Rendern der Karte überschrieben)
      licht.shadow.matrix.multiplyMatrices(M0, T.makeTranslation(cam.x - C0.x, cam.y - C0.y, cam.z - C0.z));
    }
  }
  function nachRender() { if (faengtAuf) { M0.copy(licht.shadow.matrix); hatKarte = true; faengtAuf = false; } }
  return { licht, update, nachRender, setzeGroesse, get groesse() { return groesse; } };
}
