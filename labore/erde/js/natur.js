// Natur am Boden: zeigt die gestreute Natur (natur-streu) als InstancedMesh – eine Gruppe je Art/Variante.
// Quellen: Naturfundus (labore/erde/naturfundus), Landschaftsgruppen (labore/naturstimmungen/gruppen.js)
// und engine/models/natur (natur-assets, echte Größen, Wind-Attribut). Bäume/Felsen/Büsche werfen Schatten.
// Nah: volles Asset. Fern (nur Bäume): schlanke Form aus Maßen und Farben des Assets (~30 Dreiecke).
// Wind wie engine/render/natur-material, aber für die Kugel: Windrichtung je Instanz in die Tangentialebene gelegt,
// Phase aus der echten Weltlage (wackelt nicht beim Laufen). Kleines blendet am Rand weich aus (schrumpft) statt zu ploppen.
// Floating Origin: Instanzen relativ zu einem Anker; der Anker springt bei jedem Neuaufbau zur Kamera.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { baueNaturAsset } from '../naturfundus/naturfundus.mjs';
import { baueGruppe } from '../../naturstimmungen/gruppen.js';
import { createAssetCache } from '../../../engine/models/natur/natur-assets.js';
import { STREU_ARTEN, STRIDE } from './natur-streu.js';

const FUNDUS = new Set(['fichte', 'birke', 'granitblock', 'schiefer', 'rohrkolben', 'seerose', 'steinpilz', 'forelle', 'barsch']);
const GRUPPEN = new Set(['wollgras', 'pilzholz', 'flechtenbank']);   // aus labore/naturstimmungen/gruppen.js
// Werfen Schatten (Gras, Moos, Blumen u. ä. nicht – kostet viel, sieht man kaum)
const WIRFT = (art) => BAUM.has(art) || MITTEL.has(art) || ['granitblock', 'schiefer', 'felsnadel', 'pilzholz', 'flechtenbank', 'rohrkolben'].includes(art);
const BAUM = new Set(['fichte', 'birke', 'kiefer', 'tanne', 'eiche', 'buche', 'ahorn', 'weide', 'tropenbaum', 'palme', 'akazie', 'olive', 'pinie', 'toterBaum']);
const NADEL = new Set(['fichte', 'tanne']);
const KLEIN = new Set(['wollgras', 'pilzholz', 'farn', 'wedelfarn', 'zwergstrauch', 'moospolster', 'laubstreu', 'blume', 'pilz', 'steinpilz', 'seerose', 'rohrkolben']);
const MITTEL = new Set(['flechtenbank', 'busch', 'beerenbusch', 'ginster', 'busch_unterholz', 'kaktus', 'saeulenkaktus', 'agave', 'baumstumpf', 'liegenderStamm', 'geroell']);
const FISCH = new Set(['forelle', 'barsch']);
// Zielhöhe (m) je Art: jedes Asset wird beim Laden darauf gebracht – egal, wie groß es gebaut ist
// (Naturfundus und Engine dürfen ihre Modelle frei ändern). Ohne Eintrag: Größe des Assets bleibt.
export const ZIEL_HOEHE = {
  fichte: 22, tanne: 24, kiefer: 18, birke: 15, buche: 20, eiche: 16, ahorn: 16, weide: 9, olive: 6, pinie: 13,
  akazie: 9, palme: 14, tropenbaum: 28, toterBaum: 8, rohrkolben: 1.8, kaktus: 3, saeulenkaktus: 4,
};
// Sichtweiten (m): nah = volles Asset, fern = Fern-Form (nur Bäume)
function sicht(art) {
  // Bäume: nah volles Asset, mittel (nur Engine) Detailstufe 0, fern schlanke Form
  if (art === 'fichte') return { nah: 70, mittel: 0, fern: 320, varianten: 3 };
  if (art === 'birke') return { nah: 30, mittel: 0, fern: 320, varianten: 3 };
  if (BAUM.has(art)) return { nah: 22, mittel: 65, fern: 320, varianten: 3 };
  if (art === 'grasbueschel') return { nah: 30, fern: 0, varianten: 3 };
  if (KLEIN.has(art)) return { nah: 45, fern: 0, varianten: 2 };
  if (MITTEL.has(art)) return { nah: 95, fern: 0, varianten: 2 };
  if (FISCH.has(art)) return { nah: 35, fern: 0, varianten: 1 };
  return { nah: 230, fern: 0, varianten: art === 'granitblock' ? 3 : 2 };          // Felsen
}

/** Fundus-Geometrie: Wind-Attribut nachrüsten (Pflanzen schwingen oben, Steine/Pilze/Fische starr). */
function mitWind(geo, art) {
  const pos = geo.attributes.position, n = pos.count, w = new Float32Array(n);
  geo.computeBoundingBox();
  const h = geo.boundingBox.max.y || 1;
  const schwingt = art === 'fichte' || art === 'birke' || art === 'rohrkolben' || art === 'seerose' || art === 'wollgras';
  if (schwingt) for (let i = 0; i < n; i++) w[i] = Math.min(1, Math.max(0, pos.getY(i) / h)) ** 1.5 * (art === 'seerose' ? 0.2 : art === 'wollgras' ? 1 : 0.8);
  geo.setAttribute('wind', new THREE.BufferAttribute(w, 1));
  return geo;
}

/** Schlanke Fern-Form eines Baums aus dessen Geometrie: Maße + Durchschnittsfarbe der Krone. */
function fernForm(art, geo) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox, h = bb.max.y, r = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2;
  const pos = geo.attributes.position, col = geo.attributes.color;
  const krone = [0, 0, 0], stamm = [0, 0, 0];
  let nk = 0, ns = 0;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), achse = Math.hypot(pos.getX(i), pos.getZ(i));
    if (y > h * 0.55) { krone[0] += col.getX(i); krone[1] += col.getY(i); krone[2] += col.getZ(i); nk++; }
    else if (y < h * 0.3 && achse < r * 0.15) { stamm[0] += col.getX(i); stamm[1] += col.getY(i); stamm[2] += col.getZ(i); ns++; }
  }
  const kf = new THREE.Color(...krone.map((v) => v / Math.max(1, nk))).offsetHSL(0, 0.18, 0.02), sf = ns ? new THREE.Color(...stamm.map((v) => v / ns)) : new THREE.Color(0x5a4330);
  const teile = [];
  const teil = (g, farbe, wind, x, y, z, sx, sy, sz) => {
    const t = g.index ? g.toNonIndexed() : g;
    t.deleteAttribute('uv'); t.scale(sx, sy, sz).translate(x, y, z); t.computeVertexNormals();
    const c = new Float32Array(t.attributes.position.count * 3), w = new Float32Array(t.attributes.position.count).fill(wind);
    for (let i = 0; i < c.length; i += 3) farbe.toArray(c, i);
    t.setAttribute('color', new THREE.BufferAttribute(c, 3));
    t.setAttribute('wind', new THREE.BufferAttribute(w, 1));
    teile.push(t);
  };
  const dicke = Math.max(0.12, r * 0.05);
  if (NADEL.has(art)) {
    teil(new THREE.CylinderGeometry(0.8, 1, 1, 5, 1, true), sf, 0, 0, h * 0.12, 0, dicke, h * 0.24, dicke);
    teil(new THREE.ConeGeometry(1, 1, 6), kf.clone().multiplyScalar(0.85), 0.4, 0, h * 0.5, 0, r * 0.95, h * 0.82, r * 0.95);
  } else {
    const flach = art === 'akazie' || art === 'pinie' || art === 'palme';
    teil(new THREE.CylinderGeometry(0.8, 1, 1, 5, 1, true), sf, 0, 0, h * 0.3, 0, dicke, h * 0.6, dicke);
    teil(new THREE.IcosahedronGeometry(1, 0), kf, 0.5, 0, h * (flach ? 0.85 : 0.65), 0, r * 0.85, h * (flach ? 0.15 : 0.33), r * 0.85);
  }
  const g = mergeGeometries(teile); teile.forEach((t) => t.dispose());
  return g;
}

// Wind/Ausblenden-Shader für die Kugel
const KOPF = `
uniform float kwZeit, kwStaerke, kwWeite;
uniform vec3 kwRicht, kwCam;
attribute float wind;
`;
const KOERPER = `
#include <begin_vertex>
{
  mat4 kwM = modelMatrix * instanceMatrix;
  vec3 kwBasis = kwM[3].xyz;                       // Lage relativ zur Kamera (Floating Origin)
  if (wind > 0.0 && kwStaerke > 0.0) {
    float kwW = wind * wind;
    float kwT = kwZeit + dot(kwBasis + kwCam, vec3(0.173, 0.291, 0.211));
    mat3 kwR = transpose(mat3(kwM));
    vec3 kwDir = kwR * kwRicht; kwDir.y = 0.0; kwDir = normalize(kwDir + vec3(1e-4, 0.0, 0.0));
    vec3 kwSeite = vec3(-kwDir.z, 0.0, kwDir.x);
    float kwBoe = 0.5 + 0.5 * sin(kwT * 0.83) * sin(kwT * 0.31 + 2.0);
    float kwAus = kwStaerke * kwW * (max(position.y, 0.0) * 0.035 + 0.25);
    transformed += kwDir * kwAus * (0.55 * kwBoe + 0.35 * sin(kwT * 1.9 + position.y * 0.15));
    transformed += kwSeite * kwAus * 0.22 * sin(kwT * 2.7 + 1.3);
    transformed.y -= kwAus * kwAus * 0.15;
    transformed += vec3(0.6, 0.35, 0.6) * (0.035 * kwStaerke * kwW * sin(kwZeit * 9.0 + dot(position, vec3(5.1, 3.7, 4.3))));
  }
  if (kwWeite > 0.0) transformed *= 1.0 - smoothstep(kwWeite * 0.75, kwWeite, length(kwBasis));
}
`;

/** istWeg(kachelKey, index) → true: Stück wurde entfernt (gefällt, abgebaut, ausgegraben). */
export function createNatur(scene, { istWeg = () => false } = {}) {
  const gruppe = new THREE.Group();
  scene.add(gruppe);
  const wind = { kwZeit: { value: 0 }, kwStaerke: { value: 1 }, kwRicht: { value: new THREE.Vector3(1, 0.3, 0.6).normalize() }, kwCam: { value: new THREE.Vector3() } };
  let weiteF = 1; // Grafik-Stufe: Sichtweiten der Natur × weiteF
  const materialien = new Map(); // weite → Material (+ .tiefe für den Schatten: gleicher Wind, gleiches Ausblenden)
  const material = (weite) => {
    if (materialien.has(weite)) return materialien.get(weite);
    const tiefe = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    tiefe.customProgramCacheKey = () => 'kugelwind-tiefe-' + weite;
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0 });
    m.tiefe = tiefe;
    m.userData.u = { kwWeite: { value: weite * weiteF } };
    tiefe.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, wind, m.userData.u);
      sh.vertexShader = KOPF + sh.vertexShader.replace('#include <begin_vertex>', KOERPER);
    };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, wind, m.userData.u);
      sh.vertexShader = KOPF + sh.vertexShader.replace('#include <begin_vertex>', KOERPER);
      // Streulicht durch Laub und vom Boden: Schatten- und Rückseiten nicht schwarz
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.28;');
    };
    m.customProgramCacheKey = () => 'kugelwind-' + weite;
    materialien.set(weite, m);
    return m;
  };

  const engine = createAssetCache({ varianten: 3, detail: 1, seed: 17 });
  const engineGrob = createAssetCache({ varianten: 1, detail: 0, seed: 17 });
  const aufZiel = (art, geo) => { // auf Zielhöhe bringen (einmal, an der Geometrie) → Faktor
    geo.computeBoundingBox();
    const h = geo.boundingBox.max.y, s0 = ZIEL_HOEHE[art] && h > 0.01 ? ZIEL_HOEHE[art] / h : 1;
    if (s0 !== 1) { geo.scale(s0, s0, s0); geo.computeBoundingBox(); }
    return s0;
  };
  const MITTEL_T = {};
  const toepfe = []; // { art, geo, mat, mesh, n, kap }
  const NAH = {}, FERN = {}, CFG = {};
  for (const art of STREU_ARTEN) {
    const cfg = { ...sicht(art) };
    NAH[art] = [];
    let erste = null;
    for (let v = 0; v < cfg.varianten; v++) {
      let geo;
      if (FUNDUS.has(art) || GRUPPEN.has(art)) {
        const m = (GRUPPEN.has(art) ? baueGruppe : baueNaturAsset)(art, 11 + v * 977);
        m.material.dispose(); geo = mitWind(m.geometry, art);
      }
      else {
        const a = engine.holen(art, v);
        geo = a.geometrie;
        if (v === 0) cfg.stamm = a.stammRadius;
      }
      const s0 = aufZiel(art, geo);
      if (v === 0) cfg.s0 = s0;
      erste ??= geo;
      const weite = BAUM.has(art) && cfg.fern ? 0 : cfg.nah;
      NAH[art].push({ art, geo, mat: material(weite), mesh: null, n: 0, kap: 0 });
    }
    toepfe.push(...NAH[art]);
    if (cfg.mittel) {
      const g = engineGrob.holen(art, 0).geometrie;
      aufZiel(art, g);
      MITTEL_T[art] = { art, geo: g, mat: material(0), mesh: null, n: 0, kap: 0 };
      toepfe.push(MITTEL_T[art]);
    }
    if (cfg.fern) { FERN[art] = { art, geo: fernForm(art, erste), mat: material(cfg.fern), mesh: null, n: 0, kap: 0 }; toepfe.push(FERN[art]); }
    // Kollisionsradius bei Skala 1 (Geh-Modus): Fundus von Hand, Engine aus dem Asset
    cfg.kolli = ({ fichte: 0.22, birke: 0.16, granitblock: 0.85, schiefer: 0.8 }[art] ?? (FUNDUS.has(art) ? 0 : cfg.stamm || 0)) * cfg.s0;
    cfg.hoehe = erste.boundingBox ? erste.boundingBox.max.y : 1;
    cfg.groesse = erste.boundingBox ? Math.max(0.3, (erste.boundingBox.max.x - erste.boundingBox.min.x) * 0.25) : 0.5; // fürs Antippen
    CFG[art] = cfg;
  }
  const kapazitaet = (t, n) => {
    if (t.mesh && t.kap >= n) return;
    if (t.mesh) { gruppe.remove(t.mesh); t.mesh.dispose(); }
    t.kap = Math.max(32, 1 << Math.ceil(Math.log2(n + 1)));
    t.mesh = new THREE.InstancedMesh(t.geo, t.mat, t.kap);
    t.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    t.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    t.mesh.frustumCulled = false;
    t.mesh.receiveShadow = true;
    t.mesh.castShadow = WIRFT(t.art) && t !== FERN[t.art] && t !== MITTEL_T[t.art];   // nur Nahes wirft (Schattenkasten ±40 m)
    t.mesh.customDepthMaterial = t.mat.tiefe;
    gruppe.add(t.mesh);
  };

  const anker = new THREE.Vector3(), letzteKamera = new THREE.Vector3(1e12, 0, 0);
  const teuer = new Map(); // Art → Dreiecke (fürs HUD: wo geht die Leistung hin?)
  let schmutzig = true, fische = [], hindernisse = [], nahe = [], dreiecke = 0, anzahl = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qd = new THREE.Quaternion(), oben = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3(), skal = new THREE.Vector3(), farbe = new THREE.Color();
  const tan = new THREE.Vector3(), tan2 = new THREE.Vector3(), vor = new THREE.Vector3(), lokX = new THREE.Vector3(), kreuz = new THREE.Vector3();

  function lage(ax, ay, az, dreh, s) {
    oben.set(ax, ay, az).normalize();
    q.setFromUnitVectors(Y, oben);
    qd.setFromAxisAngle(Y, dreh);
    q.multiply(qd);
    pos.set(ax - anker.x, ay - anker.y, az - anker.z);
    skal.setScalar(s);
    return m4.compose(pos, q, skal);
  }

  /** Neu aufbauen, wenn neue Streu-Kacheln da sind oder die Kamera > 12 m weiter ist. kacheln = [{mitte, daten, anzahl}]. */
  function update(cam, kacheln, zeit, aktiv) {
    gruppe.visible = aktiv;
    if (!aktiv) return;
    wind.kwZeit.value = zeit;
    wind.kwCam.value.copy(cam);
    if (schmutzig || cam.distanceTo(letzteKamera) > 12) {
      schmutzig = false;
      letzteKamera.copy(cam);
      anker.copy(cam);
      for (const t of toepfe) t.n = 0;
      const wahl = [];
      fische = []; hindernisse = []; nahe = [];
      let idx = 0;
      for (const k of kacheln) {
        const d = k.daten, [mx, my, mz] = k.mitte;
        for (let i = 0; i < k.anzahl; i++, idx++) {
          if (istWeg(k.key, i)) continue;
          const o = i * STRIDE, art = STREU_ARTEN[d[o]], cfg = CFG[art];
          const ax = mx + d[o + 1], ay = my + d[o + 2], az = mz + d[o + 3];
          const ab = Math.hypot(ax - cam.x, ay - cam.y, az - cam.z) / weiteF;
          if (ab < 60) {
            const id = k.key + '#' + i;
            const sk = d[o + 4];
            nahe.push({ id, art, x: ax, y: ay, z: az, s: sk, fest: cfg.kolli > 0, h: cfg.hoehe * sk,
              r: BAUM.has(art) ? Math.max(0.45, cfg.kolli * sk * 1.6) : Math.max(0.25, cfg.groesse * sk) });
          }
          let t = null;
          if (ab < cfg.nah) t = NAH[art][idx % cfg.varianten];
          else if (ab < cfg.mittel) t = MITTEL_T[art];
          else if (ab < cfg.fern && (ab < 180 || idx % 2 === 0)) t = FERN[art]; // weit weg: jeder zweite reicht
          if (!t) continue;
          t.n++;
          wahl.push(t, ax, ay, az, o, d);
          if (cfg.kolli && ab < 60) hindernisse.push({ x: ax, y: ay, z: az, r: cfg.kolli * d[o + 4] });
        }
      }
      for (const t of toepfe) { kapazitaet(t, t.n); t.mesh.count = 0; }
      dreiecke = 0; anzahl = 0; teuer.clear();
      for (let w = 0; w < wahl.length; w += 6) {
        const t = wahl[w], ax = wahl[w + 1], ay = wahl[w + 2], az = wahl[w + 3], o = wahl[w + 4], d = wahl[w + 5];
        const i = t.mesh.count++;
        t.mesh.setMatrixAt(i, lage(ax, ay, az, d[o + 5], d[o + 4]));
        t.mesh.setColorAt(i, farbe.setRGB(d[o + 6], d[o + 7], d[o + 8]));
        if (FISCH.has(t.art)) fische.push({ t, i, ax, ay, az, dreh: d[o + 5], s: d[o + 4] });
      }
      for (const t of toepfe) {
        t.mesh.instanceMatrix.needsUpdate = true;
        if (t.mesh.instanceColor) t.mesh.instanceColor.needsUpdate = true;
        t.mesh.visible = t.mesh.count > 0;
        const dr = t.mesh.count * t.geo.attributes.position.count / 3;
        dreiecke += dr;
        teuer.set(t.art, (teuer.get(t.art) || 0) + dr);
        anzahl += t.mesh.count;
      }
    }
    // Fische schwimmen kleine Kreise unter der Wasseroberfläche
    for (const f of fische) {
      oben.set(f.ax, f.ay, f.az).normalize();
      tan.set(0.3, 1, 0.2).cross(oben).normalize(); tan2.crossVectors(oben, tan);
      const w = zeit * (0.5 + 0.15 * f.s) + f.dreh, r = 1.5 * f.s;
      const x = f.ax + (tan.x * Math.cos(w) + tan2.x * Math.sin(w)) * r;
      const y = f.ay + (tan.y * Math.cos(w) + tan2.y * Math.sin(w)) * r;
      const z = f.az + (tan.z * Math.cos(w) + tan2.z * Math.sin(w)) * r;
      // Blickrichtung = Bahntangente; Fisch schaut nach +X. Erst Grundlage (Drehung 0) → lokale X-Achse, dann Winkel dazu.
      lage(x, y, z, 0, f.s);
      vor.copy(tan).multiplyScalar(-Math.sin(w)).addScaledVector(tan2, Math.cos(w));
      lokX.set(1, 0, 0).applyQuaternion(q);
      const winkel = Math.atan2(kreuz.crossVectors(lokX, vor).dot(oben), lokX.dot(vor)) + Math.sin(zeit * 9 + f.dreh) * 0.12;
      f.t.mesh.setMatrixAt(f.i, lage(x, y, z, winkel, f.s));
      f.t.mesh.instanceMatrix.needsUpdate = true;
    }
    gruppe.position.set(anker.x - cam.x, anker.y - cam.y, anker.z - cam.z);
  }

  /** Stämme/Felsen in der Nähe (Weltkoordinaten) – für Kollision im Geh-Modus. */
  const naheHindernisse = () => hindernisse;
  /** Nächstes Natur-Stück an Punkt p (Weltkoordinaten): stehender Zylinder (Radius r, Höhe h) um jedes Stück,
   *  p höchstens `weite` m vom Mantel entfernt. → { id, art, s, fest, r, h, x, y, z } | null */
  function finde(p, weite = 1) {
    let best = null, bd = Infinity;
    for (const o of nahe) {
      const dx = p.x - o.x, dy = p.y - o.y, dz = p.z - o.z;
      const l = Math.hypot(o.x, o.y, o.z), hoch = (dx * o.x + dy * o.y + dz * o.z) / l;
      if (hoch < -0.6 || hoch > o.h + 0.4) continue;
      const quer = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - hoch * hoch)) - o.r;
      if (quer < weite && quer < bd) { bd = quer; best = o; }
    }
    return best;
  }
  /** Wind: staerke 0 (still) … 2 (Sturm), richtung = Weltvektor (wird je Pflanze in den Boden gelegt). */
  function setzeWind(staerke, richtung) { wind.kwStaerke.value = staerke; wind.kwRicht.value.copy(richtung); }

  function dispose() {
    for (const t of toepfe) { if (t.mesh) { gruppe.remove(t.mesh); t.mesh.dispose(); } if (FUNDUS.has(t.art) || GRUPPEN.has(t.art) || t === FERN[t.art]) t.geo.dispose(); }
    engine.dispose(); engineGrob.dispose();
    for (const m of materialien.values()) { m.tiefe.dispose(); m.dispose(); }
    scene.remove(gruppe);
  }

  /** Sichtweiten-Faktor (Grafik-Stufe), 0.5 … 1 */
  function setzeWeite(f) { weiteF = f; schmutzig = true; for (const [w, m] of materialien) { if (m.userData.u) m.userData.u.kwWeite.value = w * f; } }
  return { update, naheHindernisse, finde, setzeWind, setzeWeite, neu: () => { schmutzig = true; }, dispose, get info() {
    const top = [...teuer].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([a, n]) => `${a} ${Math.round(n / 1000)}k`).join(', ');
    return { anzahl, dreiecke: Math.round(dreiecke), top };
  } };
}
