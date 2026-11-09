/**
 * @modul    terrain-chunks
 * @zweck    Gekacheltes Gelände mit LOD (3–4 Stufen nach Kameraabstand, Skirts gegen Risse), Frustum-Culling und Streaming um die Kamera mit Zeitbudget pro Frame; Objekte (Bäume, Felsen …) nur in nahen Kacheln. Für endliche Welten (worldgen-adapter) und den unendlichen Modus (chunk-adapter)
 * @api      createTerrainChunks(opts) -> {gruppe,update(kamera,budgetMs),vorladen(kamera,maxMs),debug()->{kacheln,sichtbar,dreiecke,drawCalls,warteschlange,lod,objekte},stufen,sichtweite,dispose}
 * @beispiel
 *   import { createTerrainChunks } from '../../engine/world/terrain-chunks.js';
 *   const gelaende = createTerrainChunks({ adapter, kachel: 32, budgetMs: 4 });
 *   szene.add(gelaende.gruppe); gelaende.vorladen(kamera);
 *   // je Frame: gelaende.update(kamera); gelaende.debug().dreiecke
 * @tags     welt, terrain, gelaende, lod, chunks, streaming, culling, unendlich, objekte
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { biomFarben } from './terrain-mesh.js';
import { FORMEN, BLUMEN_FARBEN, baueForm, formName } from './scatter-mesh.js';
import { quelleAusAdapter, fuelleKachel } from './terrain-quelle.js';
import { kachelIndizes, vertexAnzahl, dreieckAnzahl, planeKacheln, abarbeiten } from './terrain-lod.js';

/**
 * opts: adapter (worldgen-adapter oder chunk-adapter, Pflicht), kachel (Zellen je Kachel, 32; unendlich: adapter.kachel),
 * lods (Stufen 1–4, Standard 4), stufen (LOD-Grenzen in Metern), sichtweite (Meter), objektWeite (Meter, Standard stufen[0]),
 * budgetMs (4), maxTeuer (volle Chunks je Frame im unendlichen Modus, 1), schatten, objekte (false = keine), formen, groesse,
 * farbRauschen, felsFarbe, skirt, material, flach.
 */
export function createTerrainChunks(opts = {}) {
  const adapter = opts.adapter;
  if (!adapter) throw new Error('terrain-chunks: opts.adapter fehlt');
  const q = quelleAusAdapter(adapter, { kachel: opts.kachel ?? 32 });
  const K = q.kachel, km = K * q.abb.m;
  const lods = Math.max(1, Math.min(opts.lods ?? 4, Math.log2(K) - 1));
  const stufen = (opts.stufen ?? [km * 1.5, km * 3, km * 6]).slice(0, lods - 1);
  const sichtweite = opts.sichtweite ?? km * 10;
  const objektWeite = opts.objekte === false ? -1 : opts.objektWeite ?? stufen[0] ?? km * 1.5;
  const schatten = opts.schatten !== false;
  const fc = new THREE.Color(opts.felsFarbe ?? 0x7d7468);
  const stil = { farben: biomFarben({ biome: q.biome }), fels: [fc.r, fc.g, fc.b], rauschen: opts.farbRauschen ?? 0.08, skirt: opts.skirt ?? 1.5 };
  const gruppe = new THREE.Group(); gruppe.name = 'gelaende-kacheln';
  const eigenesMat = !opts.material;
  const mat = opts.material ?? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: !!opts.flach });

  // ---- Geometrie-Pool je LOD: Index-Puffer geteilt, Vertex-Puffer wiederverwendet (kein GPU-Neuanlegen beim Streamen) ----
  const indizes = [], pool = [];
  for (let l = 0; l < lods; l++) { indizes.push(new THREE.BufferAttribute(kachelIndizes(K >> l), 1)); pool.push([]); }
  function nimmGeo(lod) {
    const alt = pool[lod].pop();
    if (alt) return alt;
    const n = vertexAnzahl(K >> lod) * 3, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n), 3));
    geo.setIndex(indizes[lod]);
    geo.boundingBox = new THREE.Box3(); geo.boundingSphere = new THREE.Sphere();
    geo.userData.lod = lod;
    return geo;
  }
  const gibGeo = (geo) => pool[geo.userData.lod].push(geo);

  // ---- Kacheln ----
  const kacheln = new Map();   // schluessel → { kx, ky, lod, mesh, box, obj }
  function baue(a) {
    const geo = nimmGeo(a.lod), at = geo.attributes;
    const r = fuelleKachel(q, a.kx, a.ky, a.lod, { pos: at.position.array, nor: at.normal.array, col: at.color.array }, stil);
    at.position.needsUpdate = at.normal.needsUpdate = at.color.needsUpdate = true;
    const rc = q.kachelRechteck(a.kx, a.ky), tief = Math.max(1, (1 << a.lod) * q.abb.m * stil.skirt);
    geo.boundingBox.min.set(rc.x0, r.minY - tief, rc.z0); geo.boundingBox.max.set(rc.x1, r.maxY, rc.z1);
    geo.boundingBox.getBoundingSphere(geo.boundingSphere);
    let t = kacheln.get(a.schluessel);
    if (!t) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `kachel ${a.kx},${a.ky}`; mesh.receiveShadow = schatten; mesh.matrixAutoUpdate = false;
      t = { kx: a.kx, ky: a.ky, lod: a.lod, mesh, box: new THREE.Box3(), obj: null };
      kacheln.set(a.schluessel, t);
      gruppe.add(mesh);
    } else { gibGeo(t.mesh.geometry); t.mesh.geometry = geo; }
    t.lod = a.lod; t.box.copy(geo.boundingBox);
  }
  function entferne(key) {
    const t = kacheln.get(key);
    gibGeo(t.mesh.geometry); gruppe.remove(t.mesh); kacheln.delete(key);
  }

  // ---- Objekte nur in nahen Kacheln: ein InstancedMesh je Form, neu befüllt, wenn sich die Menge der Kacheln ändert ----
  const formen = { ...FORMEN, ...opts.formen };
  const objGruppe = new THREE.Group(); objGruppe.name = 'objekte-nah';
  gruppe.add(objGruppe);
  const objMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const formGeo = new Map(), objMeshes = new Map();
  const faktor = (opts.groesse ?? 1) * Math.sqrt(q.abb.m);
  const m4 = new THREE.Matrix4(), qu = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3(), achse = new THREE.Vector3(0, 1, 0), farbe = new THREE.Color();
  function objekteVon(t) {
    const r = q.objekte(t.kx, t.ky), proForm = new Map();
    if (!r) return proForm;
    const o = r.o, liste = r.idx ?? { length: o.anzahl };
    for (let k = 0; k < liste.length; k++) {
      const i = r.idx ? r.idx[k] : k, name = formName(formen, o.typen[o.typ[i]], o.arten[o.art[i]]);
      const w = adapter.zuWelt(o.x[i], o.y[i]), y = adapter.bodenHoehe(w.x, w.z), wh = adapter.wasserHoehe(w.x, w.z);
      if (wh !== null && wh > y + 0.3) continue;
      let e = proForm.get(name); if (!e) proForm.set(name, e = { m: [], c: [] });
      const sk = (o.skala[i] || 1) * faktor;
      pv.set(w.x, y - 0.05 * sk, w.z); sv.set(sk, sk, sk); qu.setFromAxisAngle(achse, o.drehung ? o.drehung[i] : 0);
      m4.compose(pv, qu, sv).toArray(e.m, e.m.length);
      if (name === 'blume') { farbe.setHex(BLUMEN_FARBEN[i % BLUMEN_FARBEN.length]).multiplyScalar(1.2); e.c.push(farbe.r, farbe.g, farbe.b); }
    }
    return proForm;
  }
  function objMesh(name, n) {
    let im = objMeshes.get(name);
    if (im && im.instanceMatrix.count >= n) return im;
    if (im) { objGruppe.remove(im); im.dispose(); }
    let geo = formGeo.get(name); if (!geo) formGeo.set(name, geo = baueForm(formen[name]));
    im = new THREE.InstancedMesh(geo, objMat, Math.max(16, Math.ceil(n * 1.5)));
    im.name = name;
    if (name === 'blume') im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(im.instanceMatrix.count * 3), 3);
    im.castShadow = schatten && name !== 'blume' && name !== 'schilf'; im.receiveShadow = schatten;
    objMeshes.set(name, im); objGruppe.add(im);
    return im;
  }
  let objSatz = '', objAnzahl = 0, objKacheln = 0;
  function objekteAktualisieren(soll) {
    const nah = [];
    for (const [key, s] of soll) {
      const t = kacheln.get(key);
      if (s.objekte && t && (t.obj || q.endlich || adapter.hatChunk(t.kx, t.ky))) nah.push(key);
    }
    const satz = nah.sort((a, b) => a - b).join(',');
    if (satz === objSatz) return;
    let neu = 0;
    for (const key of nah) { const t = kacheln.get(key); if (!t.obj) { if (neu++ >= 2) return; t.obj = objekteVon(t); } }
    objSatz = satz;
    const summe = new Map();
    for (const key of nah) for (const [name, e] of kacheln.get(key).obj) summe.set(name, (summe.get(name) ?? 0) + e.m.length / 16);
    for (const [name, im] of objMeshes) if (!summe.has(name)) im.count = 0;
    objAnzahl = 0;
    for (const [name, n] of summe) {
      const im = objMesh(name, n), ma = im.instanceMatrix.array, ca = im.instanceColor?.array;
      let k = 0;
      for (const key of nah) {
        const e = kacheln.get(key).obj.get(name); if (!e) continue;
        ma.set(e.m, k * 16); if (ca && e.c.length) ca.set(e.c, k * 3);
        k += e.m.length / 16;
      }
      im.count = k; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      objAnzahl += k;
    }
    objKacheln = nah.length;
  }

  // ---- Je Frame: planen, streamen, cullen ----
  const frustum = new THREE.Frustum(), pm = new THREE.Matrix4(), kp = new THREE.Vector3(), tmpBox = new THREE.Box3();
  const stat = { kacheln: 0, sichtbar: 0, dreiecke: 0, drawCalls: 0, warteschlange: 0, lod: [0, 0, 0, 0], objekte: 0, objektKacheln: 0 };
  function sichtbar(kx, ky) {
    const rc = q.kachelRechteck(kx, ky);
    tmpBox.min.set(rc.x0, -q.hs, rc.z0); tmpBox.max.set(rc.x1, q.hs * 1.5, rc.z1);
    return frustum.intersectsBox(tmpBox);
  }
  function update(kamera, budgetMs = opts.budgetMs ?? 4) {
    kamera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(pm.multiplyMatrices(kamera.projectionMatrix, kamera.matrixWorldInverse));
    kamera.getWorldPosition(kp);
    const plan = planeKacheln({
      kamX: kp.x, kamZ: kp.z, kachelMeter: km, ursprungX: q.abb.ox, ursprungZ: q.abb.oz, sichtweite, stufen,
      bereich: q.bereich, vorhanden: kacheln, sichtbar, objektWeite,
    });
    for (const key of plan.entfernen) entferne(key);
    for (const a of plan.auftraege) a.teuer = q.teuer(a.kx, a.ky, a.lod);
    abarbeiten(plan.auftraege, baue, { budgetMs, maxTeuer: opts.maxTeuer ?? 1 });
    if (objektWeite >= 0) objekteAktualisieren(plan.soll);
    stat.lod.fill(0); stat.sichtbar = stat.dreiecke = 0;
    for (const t of kacheln.values()) {
      const v = frustum.intersectsBox(t.box);
      t.mesh.visible = v;
      if (v) { stat.sichtbar++; stat.dreiecke += dreieckAnzahl(K >> t.lod); stat.lod[t.lod]++; }
    }
    let objCalls = 0;
    for (const im of objMeshes.values()) if (im.count > 0) { objCalls++; stat.dreiecke += im.count * im.geometry.attributes.position.count / 3; }
    stat.kacheln = kacheln.size; stat.drawCalls = stat.sichtbar + objCalls; stat.warteschlange = plan.auftraege.length;
    stat.objekte = objAnzahl; stat.objektKacheln = objKacheln;
    return stat.warteschlange;
  }
  /** Lädt synchron (z. B. hinter dem Ladebildschirm), bis nichts mehr ansteht oder maxMs um ist. */
  function vorladen(kamera, maxMs = 3000) {
    const t0 = performance.now();
    while (update(kamera, 50) > 0 && performance.now() - t0 < maxMs) { /* weiter */ }
    for (let i = 0; i < 8; i++) update(kamera, 0);   // Objekte nachziehen (max. 2 neue Kacheln je Durchlauf)
  }

  return {
    gruppe, update, vorladen, stufen, sichtweite, kachelMeter: km,
    debug: () => ({ ...stat, lod: [...stat.lod] }),
    dispose() {
      for (const key of [...kacheln.keys()]) entferne(key);
      for (const l of pool) for (const g of l) g.dispose();
      for (const im of objMeshes.values()) im.dispose();
      for (const g of formGeo.values()) g.dispose();
      objMat.dispose(); if (eigenesMat) mat.dispose();
      objMeshes.clear(); formGeo.clear(); gruppe.remove(objGruppe);
      gruppe.removeFromParent();
    },
  };
}
