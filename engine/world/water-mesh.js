/**
 * @modul    water-mesh
 * @zweck    Handytaugliches Wasser für Meer, Seen und Flüsse aus den worldgen-Daten: ein Netz auf dem Wasserspiegel plus Meeresring bis zum Horizont, eigener leichter Shader mit animierten Wellen, Tiefenfärbung (flach türkis → tief dunkel), Uferschaum und Flussströmung in Abflussrichtung – alles prozedural, ohne Texturen
 * @api      createWaterMesh(opts) -> {gruppe,mesh,material,uniforms,gitter,update(dt),setSonne(richtung,farbe?),setHimmel(farbe),dispose}
 * @beispiel
 *   import { createWaterMesh } from '../../engine/world/water-mesh.js';
 *   const wasser = createWaterMesh({ adapter, sonne: new THREE.Vector3(60, 120, 40) });
 *   szene.add(wasser.gruppe);  // in der Schleife: wasser.update(dt)
 * @tags     welt, wasser, meer, see, fluss, shader, wellen, schaum, stroemung
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */

import * as THREE from 'three';
import { wasserGitter } from './water-field.js';

// Summe von vier gerichteten Sinuswellen (Tiefwasser-Dispersion): x = Höhe, yz = Ableitung nach x/z
const WELLEN = /* glsl */`
vec3 wellen(vec2 p, float t, float L) {
  vec3 s = vec3(0.0);
  vec2 R[4]; R[0] = vec2(0.8, 0.6); R[1] = vec2(-0.45, 0.89); R[2] = vec2(0.96, -0.28); R[3] = vec2(-0.7, -0.71);
  float F[4]; F[0] = 1.0; F[1] = 0.61; F[2] = 0.37; F[3] = 0.23;
  float A[4]; A[0] = 0.45; A[1] = 0.27; A[2] = 0.17; A[3] = 0.11;
  for (int i = 0; i < 4; i++) {
    float k = 6.2831853 / (L * F[i]), ph = dot(R[i], p) * k + t * sqrt(9.81 * k) + float(i) * 1.7;
    s.x += A[i] * sin(ph); s.yz += A[i] * k * cos(ph) * R[i];
  }
  return s;
}`;

const VERTEX = /* glsl */`
uniform float uZeit, uWellenHoehe, uWellenLaenge;
attribute float aTiefe, aUfer, aWelle;
attribute vec2 aStroem;
varying vec3 vWelt;
varying float vTiefe, vUfer, vAmp;
varying vec2 vStroem;
#include <common>
#include <fog_pars_vertex>
${WELLEN}
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vAmp = uWellenHoehe * aWelle * smoothstep(0.0, 2.5, aTiefe + 0.3);
  w.y += vAmp * wellen(w.xz, uZeit, uWellenLaenge).x;
  vWelt = w.xyz; vTiefe = aTiefe; vUfer = aUfer; vStroem = aStroem;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAGMENT = /* glsl */`
uniform float uZeit, uWellenLaenge, uTiefeSkala, uSchaumBreite, uKlarheit;
uniform vec3 uFlach, uTief, uSchaum, uHimmel, uSonneRichtung, uSonneFarbe;
varying vec3 vWelt;
varying float vTiefe, vUfer, vAmp;
varying vec2 vStroem;
#include <common>
#include <fog_pars_fragment>
${WELLEN}
// Kleine Kräusel (nur Ableitung), werden bei Flüssen mit der Strömung verschoben
vec2 kraeusel(vec2 p) {
  vec2 a = vec2(0.71, 0.7), b = vec2(-0.83, 0.55);
  float k1 = 2.3, k2 = 3.7;
  return a * k1 * cos(dot(a, p) * k1) * 0.5 + b * k2 * cos(dot(b, p) * k2 + 1.3) * 0.3;
}
float rausch(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.55), b = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.55);
  float c = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.55), d = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.55);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
void main() {
  vec2 p = vWelt.xz;
  vec2 g = vAmp * wellen(p, uZeit, uWellenLaenge).yz;
  float tempo = length(vStroem), schaumStrom = 0.0;
  if (tempo > 0.02) {
    // Flowmap mit zwei Phasen, damit das Muster nicht endlos gedehnt wird
    float f1 = fract(uZeit * 0.4), f2 = fract(uZeit * 0.4 + 0.5), m = abs(1.0 - 2.0 * f1);
    vec2 o1 = vStroem * f1 * 2.5, o2 = vStroem * f2 * 2.5;
    g += (kraeusel(p - o1) * m + kraeusel(p - o2 + 3.1) * (1.0 - m)) * 0.06 * min(1.0, tempo);
    float r = mix(rausch((p - o2) * 0.9), rausch((p - o1) * 0.9 + 5.0), m);
    schaumStrom = smoothstep(0.72, 0.9, r) * min(1.0, tempo * 0.6) * 0.5;
  } else {
    g += kraeusel(p * 1.3 + uZeit * 0.35) * 0.03;
  }
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 v = normalize(cameraPosition - vWelt), l = normalize(uSonneRichtung);
  float tief = smoothstep(0.0, uTiefeSkala, vTiefe);
  vec3 farbe = mix(uFlach, uTief, tief) * (0.6 + 0.4 * max(dot(n, l), 0.0)) * uSonneFarbe;
  float fresnel = 0.03 + 0.97 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  farbe = mix(farbe, uHimmel, fresnel * 0.75);
  farbe += uSonneFarbe * pow(max(dot(reflect(-l, n), v), 0.0), 90.0) * 1.6;
  // Uferschaum: rollende Linien zum Ufer hin, dazu Gischt im ganz flachen Wasser
  float nahe = 1.0 - smoothstep(0.0, uSchaumBreite, vUfer);
  float linien = sin(vUfer * 2.2 - uZeit * 1.5 + rausch(p * 0.35) * 4.0) * 0.5 + 0.5;
  float schaum = nahe * smoothstep(0.55, 0.95, linien * (0.6 + 0.4 * rausch(p * 1.7 + uZeit * 0.2)));
  schaum = max(schaum, (1.0 - smoothstep(0.0, 0.35, vTiefe)) * (0.55 + 0.45 * rausch(p * 2.0 - uZeit * 0.5)));
  schaum = clamp(max(schaum, schaumStrom), 0.0, 1.0);
  farbe = mix(farbe, uSchaum, schaum * 0.85);
  float alpha = max(mix(uKlarheit, 0.96, smoothstep(0.0, uTiefeSkala * 0.5, vTiefe)) + fresnel * 0.3, schaum);
  gl_FragColor = vec4(farbe, clamp(alpha, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const farbe = (wert, std) => (wert && wert.isColor ? wert.clone() : new THREE.Color(wert ?? std));

/**
 * opts: adapter (Pflicht, worldgen-adapter), schritt (Gitterzellen je Vertex, 1), meer (Ring bis zum Horizont, true),
 * meerGroesse (Vielfaches der Karte, 6), versatz (m über dem Spiegel, 0.04), flachFarbe, tiefFarbe, schaumFarbe, himmelFarbe,
 * sonne (Richtung, Vector3 oder {x,y,z}), sonnenFarbe, wellenHoehe (m, 0.35), wellenLaenge (m, 14), tiefeSkala (m bis „tief“, 8),
 * schaumBreite (m, 6), klarheit (Deckkraft im Flachen, 0.45), tempo (Flusstempo m/s, 1.2), seeWelle, flussWelle.
 */
export function createWaterMesh(opts = {}) {
  const adapter = opts.adapter;
  if (!adapter) throw new Error('createWaterMesh: opts.adapter fehlt');
  const welt = adapter.welt, z = welt.zelle, hs = adapter.hoehenSkala, versatz = opts.versatz ?? 0.04;
  const B = welt.breite, T = welt.tiefe;
  const gitter = wasserGitter(welt, { ...opts, hoehenSkala: hs, meterProZelle: adapter.meterProZelle });
  const { nx, nz, schritt: s } = gitter;

  const pos = [], tiefe = [], ufer = [], welle = [], strom = [], idx = [];
  const nr = new Int32Array(nx * nz).fill(-1);
  const punkt = (x, y, zz, t, u, w, sx, sz) => { pos.push(x, y, zz); tiefe.push(t); ufer.push(u); welle.push(w); strom.push(sx, sz); return pos.length / 3 - 1; };
  const welt3 = (i, j) => adapter.zuWelt(Math.min(B - 1, i * s) * z, Math.min(T - 1, j * s) * z);
  function vertex(i, j) {
    const k = j * nx + i;
    if (nr[k] < 0) {
      const p = welt3(i, j);
      nr[k] = punkt(p.x, gitter.spiegel[k] + versatz, p.z, gitter.tiefe[k], gitter.ufer[k], gitter.welle[k], gitter.stroemX[k], gitter.stroemZ[k]);
    }
    return nr[k];
  }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    if (!gitter.quads[j * (nx - 1) + i]) continue;
    const a = vertex(i, j), b = vertex(i + 1, j), c = vertex(i, j + 1), d = vertex(i + 1, j + 1);
    idx.push(a, c, b, b, c, d);
  }

  // Meeresring: vier Trapeze vom Kartenrand bis weit hinaus; innen dieselben Werte wie das Gitter → keine Naht
  if (opts.meer !== false) {
    const p0 = welt3(0, 0), p1 = welt3(nx - 1, nz - 1);
    const cx = (p0.x + p1.x) / 2, cz = (p0.z + p1.z) / 2, f = (opts.meerGroesse ?? 6) * adapter.groesse.x / Math.max(1e-6, p1.x - p0.x);
    const tiefRand = opts.randTiefe ?? 0.8 * hs;
    const seiten = [
      Array.from({ length: nx }, (_, i) => [i, 0]), Array.from({ length: nz }, (_, j) => [nx - 1, j]),
      Array.from({ length: nx }, (_, i) => [nx - 1 - i, nz - 1]), Array.from({ length: nz }, (_, j) => [0, nz - 1 - j]),
    ];
    for (const seite of seiten) {
      let vi = -1, va = -1;
      for (const [i, j] of seite) {
        const k = j * nx + i, p = welt3(i, j);
        const ni = punkt(p.x, versatz, p.z, gitter.spiegel[k] <= 1e-4 ? gitter.tiefe[k] : 0, gitter.ufer[k], 1, 0, 0);
        const na = punkt(cx + (p.x - cx) * f, versatz, cz + (p.z - cz) * f, tiefRand, 1e4, 1, 0, 0);
        if (vi >= 0) idx.push(vi, ni, va, ni, na, va);
        vi = ni; va = na;
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aTiefe', new THREE.Float32BufferAttribute(tiefe, 1));
  geo.setAttribute('aUfer', new THREE.Float32BufferAttribute(ufer, 1));
  geo.setAttribute('aWelle', new THREE.Float32BufferAttribute(welle, 1));
  geo.setAttribute('aStroem', new THREE.Float32BufferAttribute(strom, 2));
  geo.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeBoundingSphere();

  const sonne = new THREE.Vector3(opts.sonne?.x ?? 0.45, opts.sonne?.y ?? 0.8, opts.sonne?.z ?? 0.3).normalize();
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uZeit: { value: 0 }, uWellenHoehe: { value: opts.wellenHoehe ?? 0.35 }, uWellenLaenge: { value: opts.wellenLaenge ?? 14 },
    uTiefeSkala: { value: opts.tiefeSkala ?? 8 }, uSchaumBreite: { value: opts.schaumBreite ?? 6 }, uKlarheit: { value: opts.klarheit ?? 0.45 },
    uFlach: { value: farbe(opts.flachFarbe, 0x3fc2c0) }, uTief: { value: farbe(opts.tiefFarbe, 0x0b2f4a) },
    uSchaum: { value: farbe(opts.schaumFarbe, 0xf2f8fa) }, uHimmel: { value: farbe(opts.himmelFarbe, 0x9cc4e4) },
    uSonneRichtung: { value: sonne }, uSonneFarbe: { value: farbe(opts.sonnenFarbe, 0xffffff) },
  }]);
  uniforms.uSonneRichtung.value = sonne;   // merge() klont – setSonne soll dieselbe Instanz ändern
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, fog: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'wasser';
  mesh.renderOrder = 1;
  const gruppe = new THREE.Group(); gruppe.name = 'wasser';
  gruppe.add(mesh);

  return {
    gruppe, mesh, material, uniforms, gitter,
    /** Zeit weiterdrehen (Sekunden). Läuft nach einer Stunde um, damit die Genauigkeit im Shader bleibt. */
    update(dt) { uniforms.uZeit.value = (uniforms.uZeit.value + dt) % 3600; },
    /** Sonnenrichtung (zur Sonne hin) und optional Lichtfarbe, z. B. für Tag/Nacht. */
    setSonne(richtung, licht) {
      sonne.set(richtung.x, richtung.y, richtung.z).normalize();
      if (licht !== undefined) uniforms.uSonneFarbe.value.set(licht);
    },
    /** Himmelfarbe für die Spiegelung (Fresnel). */
    setHimmel(f) { uniforms.uHimmel.value.set(f); },
    dispose() { geo.dispose(); material.dispose(); gruppe.removeFromParent(); },
  };
}
