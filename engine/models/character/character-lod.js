/**
 * @modul    character-lod
 * @zweck    Fern-Darstellung für viele Figuren: alle in EINEM Draw-Call (InstancedMesh, ~250 Dreiecke), Look-Farben als Instanz-Attribute, Lauf-Pendeln im Vertex-Shader
 * @api      createFigurLod({ max, material }) -> { objekt, anzahl, setze(id,{look,pos,yaw,tempo,sichtbar}), entferne(id), update(dt,zeit), dispose() } ; lookZuLod(look) -> { hoehe, breite, farben[7], flags[6] } ; baueLodGeometrie() -> { pos, slot, teil } ; LOD_DREIECKE
 * @beispiel
 *   import { createFigurLod } from '../../engine/models/character/character-lod.js';
 *   const lod = createFigurLod({ max: 64 });
 *   szene.add(lod.objekt);
 *   lod.setze('bauer1', { look, pos: { x, y, z }, yaw: 1.2, tempo: 1.3 });   // pro Bild/Schritt; sichtbar:false blendet aus
 *   lod.update(dt, zeit);                                                     // pro Bild (Zeit für das Pendeln)
 * @tags     figur, charakter, lod, fern, instanced, performance, menge, npc, mmo, draw-calls
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 *
 * Eine gemeinsame Form (Rumpf, Kopf, Beine, Arme + schaltbar: Haar, langes Haar, Kappe, Krempenhut, Robe, Rock). Der Look bestimmt nur Farben,
 * Schalter und Maße (Höhe/Breite) je Instanz – kein Backen pro Look nötig, ein einziges Shader-Programm. Standard-Material (PS1-Look über psx.wendeAn/update).
 * Draw-Calls: 1, unabhängig von der Zahl der Figuren.
 */
import * as THREE from 'three';
import { createLook, farbeZahl } from './character-look.js';
import { koerperMasse } from './character-look.js';
import { figurMaterial } from '../../render/figur-material.js';

const REF_HOEHE = 1.75;   // Höhe der Standardfigur in m (Maßstab der Form)
// Teile: 0 fest, 1/2 Bein L/R, 3/4 Arm L/R, 5 Kappe, 6 Krempenhut, 7 Haar, 8 langes Haar, 9 Robe, 10 Rock
// Farb-Plätze: 0 Haut, 1 Haar, 2 Oberteil, 3 Hose, 4 Schuhe, 5 Hut, 6 Unterbein
const LANG = new Set(['lang', 'zopf', 'zoepfe', 'pferdeschwanz', 'locken']);
const KREMPE = new Set(['hut', 'strohhut', 'zauberhut', 'dreispitz', 'federhut']);
const KAPPE = new Set(['kapuze', 'helm', 'bandana', 'muetze', 'krone', 'topfhelm', 'kopftuch', 'turban', 'reif']);
const ROBE = new Set(['robe', 'kleid', 'mantel']);

/** Look → Maße, 7 Farben (0xrrggbb) und Schalter [kappe, krempe, haar, langhaar, robe, rock] (0/1). Rein, ohne WebGL. */
export function lookZuLod(look) {
  const l = createLook(look), m = koerperMasse(l), c = (f, e) => farbeZahl(f) ?? e;
  const haut = c(l.haut, 0xe0ac88), haar = c(l.haar.farbe, 0x4a3020), hose = c(l.hose.farbe, 0x5a4a3a);
  const hut = l.kopfbedeckung.stil, hutStil = KREMPE.has(hut) ? 2 : KAPPE.has(hut) ? 1 : 0;
  const kurzeHose = l.hose.stil === 'kurz' || l.hose.stil === 'rock';
  return {
    hoehe: m.hoehe, breite: m.breite,
    farben: [haut, haar, c(l.oberteil.farbe, 0x4f7a5a), hose, l.schuhe.stil === 'barfuss' ? haut : c(l.schuhe.farbe, 0x4a3426), c(l.kopfbedeckung.farbe, 0x7a5a3a), kurzeHose ? haut : hose],
    flags: [hutStil === 1 ? 1 : 0, hutStil === 2 ? 1 : 0, l.haar.stil !== 'glatze' && !hutStil ? 1 : 0, LANG.has(l.haar.stil) ? 1 : 0, ROBE.has(l.oberteil.stil) ? 1 : 0, l.hose.stil === 'rock' ? 1 : 0],
  };
}

/** Gemeinsame Form (Meter, Füße bei y = 0, Blick +Z): { pos: Float32Array, slot: Float32Array (Farb-Platz je Vertex), teil: Float32Array } – nicht indiziert. */
export function baueLodGeometrie() {
  const pos = [], slot = [], teil = [];
  const tri = (a, b, c, s, t) => { pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) { slot.push(s); teil.push(t); } };
  const quad = (a, b, c, d, s, t) => { tri(a, b, c, s, t); tri(a, c, d, s, t); };
  /** Kegelstumpf mit n Ecken entlang y (oben ro, unten ru), Mitte (cx, cz). */
  function rohr(cx, cz, y0, y1, ro, ru, n, s, t, rz = 1) {
    const ring = (y, r) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [cx + Math.sin(a) * r, y, cz + Math.cos(a) * r * rz]; });
    const o = ring(y1, ro), u = ring(y0, ru), mo = [cx, y1, cz], mu = [cx, y0, cz];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      quad(u[i], u[j], o[j], o[i], s, t);
      if (ro > 0) tri(mo, o[i], o[j], s, t);
      if (ru > 0) tri(mu, u[j], u[i], s, t);
    }
  }
  function kasten(x0, x1, y0, y1, z0, z1, s, t) {
    const p = (x, y, z) => [x, y, z];
    quad(p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1), s, t); quad(p(x1, y0, z0), p(x0, y0, z0), p(x0, y1, z0), p(x1, y1, z0), s, t);
    quad(p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0), s, t); quad(p(x1, y0, z1), p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), s, t);
    quad(p(x0, y1, z1), p(x1, y1, z1), p(x1, y1, z0), p(x0, y1, z0), s, t); quad(p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1), s, t);
  }
  /** Kugel-Hälfte/Kugel: lat Ringe von Pol zu Pol-Bereich [w0, w1] (Winkel ab Nordpol). */
  function kugel(cy, r, rows, cols, w0, w1, s, t, sy = 1) {
    const pt = (i, k) => { const w = w0 + (w1 - w0) * (i / rows), a = (k / cols) * Math.PI * 2; return [Math.sin(a) * Math.sin(w) * r, cy + Math.cos(w) * r * sy, Math.cos(a) * Math.sin(w) * r]; };
    for (let i = 0; i < rows; i++) for (let k = 0; k < cols; k++) {
      const a = pt(i, k), b = pt(i, k + 1), c = pt(i + 1, k + 1), d = pt(i + 1, k);
      if (i === 0 && w0 === 0) tri(a, d, c, s, t); else quad(a, d, c, b, s, t);
    }
  }
  // Rumpf, Becken
  kasten(-0.17, 0.17, 0.94, 1.44, -0.1, 0.1, 2, 0);
  kasten(-0.16, 0.16, 0.86, 0.97, -0.09, 0.09, 3, 0);
  kugel(1.635, 0.115, 3, 6, 0, Math.PI, 0, 0);                        // Kopf
  // Beine (Schwenkpunkt Hüfte y 0,89) mit Fuß
  for (const [sx, t] of [[-1, 1], [1, 2]]) {
    rohr(sx * 0.1, 0, 0.5, 0.9, 0.07, 0.06, 4, 3, t);
    rohr(sx * 0.1, 0, 0.07, 0.5, 0.06, 0.05, 4, 6, t);
    kasten(sx * 0.1 - 0.045, sx * 0.1 + 0.045, 0, 0.07, -0.06, 0.18, 4, t);
  }
  // Arme (Schwenkpunkt Schulter y 1,37)
  for (const [sx, t] of [[-1, 3], [1, 4]]) {
    rohr(sx * 0.22, 0, 0.8, 1.38, 0.05, 0.04, 4, 2, t);
  }
  kugel(1.66, 0.125, 3, 6, 0, Math.PI * 0.62, 1, 7, 1);                 // Haar
  kasten(-0.1, 0.1, 1.25, 1.7, -0.14, -0.08, 1, 8);                   // langes Haar
  kugel(1.655, 0.13, 3, 6, 0, Math.PI * 0.55, 5, 5, 1.1);             // Kappe
  rohr(0, 0, 1.72, 1.73, 0.3, 0.3, 6, 5, 6); rohr(0, 0, 1.73, 1.98, 0.02, 0.14, 6, 5, 6);   // Krempenhut (Krempe + Spitze)
  rohr(0, 0, 0.1, 1.0, 0.19, 0.3, 6, 2, 9); rohr(0, 0, 0.5, 0.92, 0.19, 0.24, 6, 3, 10);   // Robe, Rock
  return { pos: new Float32Array(pos), slot: new Float32Array(slot), teil: new Float32Array(teil) };
}
export const LOD_DREIECKE = baueLodGeometrie().pos.length / 9;

const pack = (n) => n & 0xffffff;
const VS_KOPF = `
attribute float aSlot; attribute float aTeil;
attribute vec4 aFarbA; attribute vec4 aFarbB; attribute vec4 aMasse; attribute vec4 aSchalt; attribute vec2 aSchalt2;
uniform float uZeit;
vec3 entpack(float p) { return pow(vec3(floor(p / 65536.0), mod(floor(p / 256.0), 256.0), mod(p, 256.0)) / 255.0, vec3(2.2)); }
vec3 drehX(vec3 p, vec3 o, float w) { vec3 d = p - o; float c = cos(w), s = sin(w); return o + vec3(d.x, d.y * c - d.z * s, d.y * s + d.z * c); }`;
const VS_BEGIN = `
vec3 transformed = position;
{
  float s = aSlot, t = aTeil;
  vColor = entpack(s < 3.5 ? aFarbA[int(s)] : aFarbB[int(s) - 4]);
  float f = t < 4.5 ? 1.0 : t < 5.5 ? aSchalt.x : t < 6.5 ? aSchalt.y : t < 7.5 ? aSchalt.z : t < 8.5 ? aSchalt.w : t < 9.5 ? aSchalt2.x : aSchalt2.y;
  transformed = mix(vec3(0.0, 1.62, 0.0), transformed, f);                           // abgeschaltete Teile fallen im Kopf zusammen
  float tempo = aMasse.w, amp = clamp(tempo / 1.6, 0.0, 1.0), w = uZeit * (2.5 + tempo * 2.6) + aMasse.z, sw = sin(w) * amp * 0.7;
  float atem = sin(uZeit * 1.7 + aMasse.z) * 0.012 * (1.0 - amp);
  if (t > 0.5 && t < 2.5) transformed = drehX(transformed, vec3(0.0, 0.89, 0.0), t < 1.5 ? sw : -sw);
  else if (t > 2.5 && t < 4.5) transformed = drehX(transformed, vec3(0.0, 1.37, 0.0), (t < 3.5 ? -sw : sw) * 0.85 + atem * 4.0);
  transformed.y += abs(sin(w)) * 0.03 * amp + atem * step(0.5, transformed.y);
  transformed *= vec3(aMasse.y, aMasse.x, aMasse.y);
}`;

/** opts: { max = 64, material }. Ein Objekt (THREE.InstancedMesh), 1 Draw-Call. Aus 20–60 m: Pendeln nach tempo (m/s) + Phase je Figur. */
export function createFigurLod({ max = 64, material = null } = {}) {
  const g = baueLodGeometrie(), geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(g.pos, 3));
  geo.setAttribute('aSlot', new THREE.BufferAttribute(g.slot, 1));
  geo.setAttribute('aTeil', new THREE.BufferAttribute(g.teil, 1));
  const inst = (n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * n), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
  const aFarbA = inst(4), aFarbB = inst(4), aMasse = inst(4), aSchalt = inst(4), aSchalt2 = inst(2);
  Object.entries({ aFarbA, aFarbB, aMasse, aSchalt, aSchalt2 }).forEach(([k, a]) => geo.setAttribute(k, a));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

  const basis = figurMaterial(), uZeit = { value: 0 };
  const mat = material || new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8, metalness: 0 });
  if (!material) {
    mat.onBeforeCompile = (shader, renderer) => {
      basis.onBeforeCompile(shader, renderer);   // Randlicht/Aufhellung wie volle Figuren
      shader.uniforms.uZeit = uZeit;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>' + VS_KOPF).replace('#include <begin_vertex>', VS_BEGIN)
        .replace('#include <color_vertex>', '');
    };
    mat.customProgramCacheKey = () => 'figur-lod';
  }
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.name = 'figur-lod'; mesh.frustumCulled = false; mesh.count = 0;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const eintraege = new Map(), dicht = [];   // id → Eintrag ; dicht = sichtbare Einträge (Instanz-Reihenfolge)
  let schmutzig = true;
  const q = new THREE.Quaternion(), p = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1), mtx = new THREE.Matrix4(), ay = new THREE.Vector3(0, 1, 0);
  const lookCache = new WeakMap();

  function schreibeEinmal(e, i) {
    const d = e.daten, f = d.farben, fl = d.flags;
    aFarbA.array.set([pack(f[0]), pack(f[1]), pack(f[2]), pack(f[3])], i * 4); aFarbB.array.set([pack(f[4]), pack(f[5]), pack(f[6]), 0], i * 4);
    aSchalt.array.set(fl.slice(0, 4), i * 4); aSchalt2.array.set(fl.slice(4), i * 2);
    aMasse.array[i * 4] = d.hoehe / REF_HOEHE; aMasse.array[i * 4 + 1] = d.breite; aMasse.array[i * 4 + 2] = e.phase;
  }
  function uebertrage() {
    dicht.length = 0;
    for (const e of eintraege.values()) if (e.sichtbar && dicht.length < max) dicht.push(e);
    dicht.forEach((e, i) => { schreibeEinmal(e, i); e.neu = true; });
    mesh.count = dicht.length; schmutzig = false;
    for (const a of [aFarbA, aFarbB, aMasse, aSchalt, aSchalt2]) a.needsUpdate = true;
  }

  return {
    objekt: mesh,
    get anzahl() { return mesh.count; },
    /** Figur anlegen/aktualisieren. look nur beim ersten Mal / bei Wechsel nötig. sichtbar = false blendet aus. */
    setze(id, { look, pos, yaw = 0, tempo = 0, sichtbar = true } = {}) {
      let e = eintraege.get(id);
      if (!e) {
        if (eintraege.size >= max || !look) return;
        e = { id, look: null, daten: null, phase: ((id.length * 2.399 + eintraege.size * 1.713) % 6.283), sichtbar: false, pos: new THREE.Vector3(), yaw: 0, tempo: 0 };
        eintraege.set(id, e);
      }
      if (look && look !== e.look) {
        e.look = look;
        let dd = lookCache.get(look); if (!dd) lookCache.set(look, dd = lookZuLod(look));
        e.daten = dd; schmutzig = true;
      }
      if (e.sichtbar !== sichtbar) { e.sichtbar = sichtbar; schmutzig = true; }
      if (pos) e.pos.set(pos.x, pos.y, pos.z);
      e.yaw = yaw; e.tempo = tempo;
    },
    entferne(id) { if (eintraege.delete(id)) schmutzig = true; },
    update(dt, zeit) {
      uZeit.value = zeit ?? uZeit.value + dt;
      if (schmutzig) uebertrage();
      for (let i = 0; i < dicht.length; i++) {
        const e = dicht[i];
        q.setFromAxisAngle(ay, e.yaw); p.copy(e.pos);
        mtx.compose(p, q, s1); mtx.toArray(mesh.instanceMatrix.array, i * 16);
        aMasse.array[i * 4 + 3] = e.tempo;
      }
      mesh.instanceMatrix.needsUpdate = true; aMasse.needsUpdate = true;
    },
    dispose() { eintraege.clear(); dicht.length = 0; mesh.count = 0; mesh.parent?.remove(mesh); geo.dispose(); if (!material) mat.dispose(); },
  };
}
