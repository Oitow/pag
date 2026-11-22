// Flora: Bäume, Felsen, Gras, Erze, Sammelpflanzen auf dem Kugelplaneten.
// Streaming in Zellen (Cube-Sphere-Gitter, ~20 m), deterministisch aus Seed + Zelle.
// Alles wird über wenige InstancedMeshes gezeichnet (ein Mesh pro Modell-Teil).
import { mulberry32, hashSeed, createNoise3D } from './noise.js';
import { baueModelle } from './flora-modelle.js';
import { TYPEN, STREU, BIOM_FLORA, UFER } from './flora-daten.js';

const N = 32;                 // Zellen pro Würfelkante → 6·32² = 6144 Zellen, ≈ 20 m
const LADE_R = 150, ENTLADE_R = 180, STREU_R = 40, STREU_LADE_R = 52;
const KLEIN_R = 75;           // kleine Objekte (Pilze, Steine, Büsche) nur bis hier
const ZIEL_R = 3.2;           // Reichweite für E-Interaktion
const BUCKET = 8;             // Raster für Kollision/Ziele (m)

export async function init(ctx) {
  const { THREE, scene, planet, DATA } = ctx;
  const R = ctx.R;
  const V3 = () => new THREE.Vector3();

  // ---------- Erze aus DATA.ERZE ----------
  const ERZ_FARBE = { kupfer: 0xd9822b, eisen: 0x9a4a2a, silber: 0xe4e8f0, gold: 0xf7cc3a, eiskristall: 0x7fe8ff, bernstein: 0xffa820, obsidian: 0x6a3aa8, kristall: 0xd08cff };
  const ERZ_IM_BIOM = {};
  for (const [id, e] of Object.entries(DATA.ERZE || {})) {
    TYPEN['erz_' + id] = {
      art: 'erz', erz: id, abbau: e.abbau || 0, hp: 6, beute: [[id, 1, 2], ['stein', 1, 1, 0.6]],
      gr: [0.8, 1.2], kol: 1.1, kolH: 1.4, neig: 0.45, aus: 'mix', abst: 3, nw: 900,
      splitter: [ERZ_FARBE[id] ?? 0xcccccc, 0x7a756e], modell: 'erz_' + id,
    };
    for (const b of e.biome || []) (ERZ_IM_BIOM[b] ||= []).push('erz_' + id);
  }

  // ---------- Materialien ----------
  const uZeit = { value: 0 };
  // Ein Material für alles Beleuchtete; Attribut 'wiegen' steuert den Wind pro Vertex.
  const festMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  festMat.onBeforeCompile = sh => {
    sh.uniforms.uZeit = uZeit;
    sh.vertexShader = 'uniform float uZeit;\nattribute float wiegen;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      if (wiegen > 0.0) {
        #ifdef USE_INSTANCING
          vec3 flIp = instanceMatrix[3].xyz;
        #else
          vec3 flIp = vec3(0.0);
        #endif
        float flPh = uZeit * 1.6 + dot(flIp, vec3(0.11, 0.17, 0.13));
        float flH = max(position.y, 0.0) * wiegen;
        transformed.x += sin(flPh) * flH;
        transformed.z += cos(flPh * 0.83) * 0.7 * flH;
      }`);
  };
  festMat.customProgramCacheKey = () => 'flora-fest';
  const MAT = { fest: festMat, glow: new THREE.MeshBasicMaterial({ vertexColors: true }) };
  // kleine Objekte (ohne Kollision) nur im mittleren Radius zeichnen
  for (const d of Object.values(TYPEN)) d.klein = !d.kol && !d.kolMulti;

  // ---------- Modelle → InstancedMesh-Gruppen ----------
  const MODELLE = baueModelle(ctx.seed);
  const gruppen = {};  // modell → [{ teil, geo, mesh, cap, n }]
  const weiss = new THREE.Color(1, 1, 1);
  function neuesMesh(t) {
    if (t.mesh) { scene.remove(t.mesh); t.mesh.dispose(); }
    const m = new THREE.InstancedMesh(t.geo, MAT[t.teil], t.cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.setColorAt(0, weiss);
    m.count = 0; m.frustumCulled = false; m.visible = false;
    m.name = 'flora:' + t.modell + ':' + t.teil;
    scene.add(m); t.mesh = m;
  }
  function gruppe(modell) {
    if (gruppen[modell]) return gruppen[modell];
    const geos = MODELLE[modell] || MODELLE.fels_klein;
    const g = gruppen[modell] = Object.entries(geos).map(([teil, geo]) => ({ modell, teil, geo, cap: 64, n: 0, mesh: null }));
    for (const t of g) neuesMesh(t);
    return g;
  }

  // ---------- Hilfen ----------
  const lichtNoise = createNoise3D(hashSeed('flora-lichtung', ctx.seed));
  const _d = V3(), _n = V3(), _t = V3(), _t2 = V3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m4 = new THREE.Matrix4(), _s = V3();
  const Y = new THREE.Vector3(0, 1, 0);
  const boden = (d, out) => {
    if (planet.groundAt) { const r = planet.groundAt(d, out); if (r && r.isVector3) return r; }
    return planet.surfacePoint(d, out);
  };
  const feuchte = d => { const f = planet.feuchteAt?.(d); return typeof f === 'number' ? f : 0.5; };
  const faehig = n => ctx.spiel?.faehigkeit?.(n) || 0;
  const toast = (t, ms) => ctx.spiel?.toast?.(t, ms);
  const itemName = id => DATA.ITEMS?.[id]?.name || id;

  function zelleDir(f, a, b, out) {
    const u = Math.tan(a * Math.PI / 4), v = Math.tan(b * Math.PI / 4);
    switch (f) {
      case 0: out.set(1, v, -u); break; case 1: out.set(-1, v, u); break;
      case 2: out.set(u, 1, -v); break; case 3: out.set(u, -1, v); break;
      case 4: out.set(u, v, 1); break; default: out.set(-u, v, -1);
    }
    return out.normalize();
  }
  const ZAHL = 6 * N * N;
  const mitten = new Float32Array(ZAHL * 3);
  for (let f = 0, k = 0; f < 6; f++) for (let i = 0; i < N; i++) for (let j = 0; j < N; j++, k++) {
    zelleDir(f, (i + 0.5) / N * 2 - 1, (j + 0.5) / N * 2 - 1, _d);
    mitten[k * 3] = _d.x; mitten[k * 3 + 1] = _d.y; mitten[k * 3 + 2] = _d.z;
  }

  function waehle(liste, r) {
    let s = 0; for (const e of liste) s += e[1];
    let x = r * s; for (const e of liste) { x -= e[1]; if (x <= 0) return e; }
    return liste[liste.length - 1];
  }

  // Instanz-Matrix für ein Objekt am Ort dir
  function setzeMatrix(out, pos, up, nrm, aus, rot, s, sink) {
    let o = up;
    if (aus === 'normal') o = nrm;
    else if (aus === 'mix') o = _t2.copy(nrm).lerp(up, 0.5).normalize();
    _q.setFromUnitVectors(Y, o);
    _q2.setFromAxisAngle(Y, rot);
    _q.multiply(_q2);
    _t.copy(pos).addScaledVector(o, -sink * s);
    _m4.compose(_t, _q, _s.set(s, s, s));
    _m4.toArray(out);
  }

  // ---------- Zellen ----------
  const zellen = new Map();     // k → zelle
  const abgebaut = new Map();   // id → Ablaufzeit (uhr)
  let uhr = 0, dirty = true, streuDirty = true;
  const queue = [];

  function erzeugeZelle(k) {
    const f = Math.floor(k / (N * N)), i = Math.floor(k / N) % N, j = k % N;
    const rng = mulberry32(hashSeed('flora', ctx.seed, f, i, j));
    const zelle = { k, f, i, j, nodes: [], streu: null, landBiom: null, mitte: V3().fromArray(mitten, k * 3) };
    // Kandidaten: erst Biom-Stichproben für "Land-Biom" der Zelle
    const zaehl = {};
    for (let s = 0; s < 5; s++) {
      zelleDir(f, (i + rng()) / N * 2 - 1, (j + rng()) / N * 2 - 1, _d);
      const b = planet.biomeAt(_d); if (b !== 'ozean') zaehl[b] = (zaehl[b] || 0) + 1;
    }
    let best = null, bn = 0; for (const [b, n] of Object.entries(zaehl)) if (n > bn) { best = b; bn = n; }
    zelle.landBiom = best;
    if (!best) return zelle;   // reine Ozeanzelle
    const tab = BIOM_FLORA[best] || BIOM_FLORA.wiese;
    const gross = [];          // [pos, abst] für Abstandsprüfung
    const n = Math.round((tab.n || 0) * 1.0) + (ERZ_IM_BIOM[best] && rng() < (tab.erz || 0) ? 1 : 0);
    for (let c = 0; c < n + 6; c++) {
      const a = (i + rng()) / N * 2 - 1, b = (j + rng()) / N * 2 - 1;
      const r1 = rng(), r2 = rng(), r3 = rng(), r4 = rng();
      const dir = zelleDir(f, a, b, V3());
      const h = planet.heightAt(dir);
      let biom = h < 0 ? 'ozean' : planet.biomeAt(dir);
      let typ;
      if (c >= n) {
        // Ufer-Kandidaten (Seerosen, Schilf im flachen Wasser)
        if (!(h < 0.2 && h > -1.6)) continue;
        const u = UFER[best]; if (!u) continue;
        typ = waehle(u, r1)[0];
      } else if (c === n - 1 && n > (tab.n || 0)) {
        if (biom === 'ozean') continue;
        const l = ERZ_IM_BIOM[biom] || ERZ_IM_BIOM[best]; if (!l) continue;
        typ = l[Math.floor(r1 * l.length)];
      } else {
        if (biom === 'ozean') continue;
        const t2 = BIOM_FLORA[biom] || tab;
        if (!t2.liste.length) continue;
        typ = waehle(t2.liste, r1)[0];
        const def0 = TYPEN[typ];
        if (def0.art === 'baum') {
          // Lichtungen + Feuchte
          const ln = lichtNoise(dir.x * 14, dir.y * 14, dir.z * 14) + lichtNoise(dir.x * 40, dir.y * 40, dir.z * 40) * 0.35;
          const fe = feuchte(dir);
          const p = THREE.MathUtils.smoothstep(ln, (t2.lichtung ?? 0) - 0.15, (t2.lichtung ?? 0) + 0.35) * (0.45 + fe * 0.9);
          if (r4 > p) continue;
        }
      }
      const def = TYPEN[typ]; if (!def) continue;
      const ort = def.ort || 'land';
      if (ort === 'land' && h < 0.25) continue;
      if (ort === 'ufer' && (h > 0.6 || h < -1.4)) continue;
      if (ort === 'wasser' && (h > -0.25 || h < -2.5)) continue;
      const up = dir;
      const nrm = planet.normalAt(dir, V3());
      if (def.neig && nrm.dot(up) < def.neig) continue;
      const pos = ort === 'wasser' ? V3().copy(dir).multiplyScalar(R + 0.03) : boden(dir, V3());
      if (def.abst) {
        let ok = true;
        for (const [p, ab] of gross) if (p.distanceToSquared(pos) < (ab + def.abst) * (ab + def.abst) * 0.25) { ok = false; break; }
        if (!ok) continue;
        gross.push([pos, def.abst]);
      }
      const s = def.gr[0] + (def.gr[1] - def.gr[0]) * r2;
      const m = new Float32Array(16);
      const steil = nrm.dot(up);
      const steinig = def.art === 'fels' || def.art === 'erz';
      setzeMatrix(m, pos, up, nrm, steinig && steil < 0.75 ? 'normal' : def.aus, r3 * Math.PI * 2, s, steinig ? 0.12 + (1 - steil) * 0.5 : 0.05 + (1 - steil) * 0.4);
      const tint = 0.88 + rng() * 0.22;
      zelle.nodes.push({ id: f + '.' + i + '.' + j + '.' + c, typ, def, modell: def.modell || typ, pos, up, nrm, m, s, tint, hp: def.hp || 1, zelle, slots: null });
    }
    return zelle;
  }

  function erzeugeStreu(zelle) {
    zelle.streu = [];
    const b = zelle.landBiom; if (!b) return;
    const st = STREU[b]; if (!st || !st.n) return;
    const rng = mulberry32(hashSeed('flora-streu', ctx.seed, zelle.k));
    const { f, i, j } = zelle;
    for (let c = 0; c < st.n; c++) {
      const a = (i + rng()) / N * 2 - 1, bb = (j + rng()) / N * 2 - 1, r1 = rng(), r2 = rng(), r3 = rng(), r4 = rng();
      const dir = zelleDir(f, a, bb, V3());
      const h = planet.heightAt(dir); if (h < 0.15) continue;
      const biom = planet.biomeAt(dir);
      const st2 = STREU[biom] || st; if (!st2.liste.length) continue;
      if (st2 !== st && r4 > st2.n / st.n) continue;
      const e = waehle(st2.liste, r1);
      const nrm = planet.normalAt(dir, V3());
      if (nrm.dot(dir) < 0.6) continue;
      const pos = boden(dir, V3());
      const m = new Float32Array(16);
      setzeMatrix(m, pos, dir, nrm, 'mix', r2 * 6.283, 0.8 + r3 * 0.6, 0.03);
      const farbe = e[2] ? new THREE.Color(e[2][Math.floor(r3 * e[2].length)]) : new THREE.Color(1, 1, 1);
      farbe.multiplyScalar(0.9 + r4 * 0.2);
      zelle.streu.push({ modell: e[0], pos, m, farbe });
    }
  }

  // ---------- Spielerposition ----------
  const spPos = V3();
  function spielerPos() {
    const p = ctx.spieler?.pos;
    if (p && p.isVector3) return spPos.copy(p);
    return boden(planet.spawnDir, spPos);
  }

  const letzterScan = V3(); let gescannt = false;
  function scan(pos) {
    letzterScan.copy(pos); gescannt = true;
    const up = _d.copy(pos).normalize();
    const cL = Math.cos(LADE_R / R), cE = Math.cos(ENTLADE_R / R), cS = Math.cos(STREU_LADE_R / R);
    queue.length = 0;
    const neu = [];
    for (let k = 0; k < ZAHL; k++) {
      const d = mitten[k * 3] * up.x + mitten[k * 3 + 1] * up.y + mitten[k * 3 + 2] * up.z;
      const z = zellen.get(k);
      if (z) {
        if (d < cE) { zellen.delete(k); dirty = true; streuDirty = true; }
        else if (d > cS && !z.streu) neu.push([k, -d - 1]);   // Streu nachladen (hohe Priorität)
      } else if (d > cL) neu.push([k, -d]);
    }
    neu.sort((a, b) => a[1] - b[1]);
    for (const e of neu) queue.push(e[0]);
  }
  function arbeite(budgetMs) {
    const t0 = performance.now();
    const pos = letzterScan, cS = Math.cos(STREU_LADE_R / R), up = _n.copy(pos).normalize();
    while (queue.length && performance.now() - t0 < budgetMs) {
      const k = queue.shift();
      let z = zellen.get(k);
      if (!z) { z = erzeugeZelle(k); zellen.set(k, z); dirty = true; }
      if (!z.streu && z.mitte.dot(up) > cS) { erzeugeStreu(z); streuDirty = true; }
    }
  }

  // ---------- Instanzen neu schreiben ----------
  const kolHash = new Map(), alleHash = new Map();
  const bkey = (x, y, z) => ((x & 1023) << 20) | ((y & 1023) << 10) | (z & 1023);
  function insHash(h, node, p) {
    const k = bkey(Math.floor(p.x / BUCKET), Math.floor(p.y / BUCKET), Math.floor(p.z / BUCKET));
    let l = h.get(k); if (!l) h.set(k, l = []); l.push(node);
  }
  function abfrage(h, p, r, fn) {
    const x0 = Math.floor((p.x - r) / BUCKET), x1 = Math.floor((p.x + r) / BUCKET);
    const y0 = Math.floor((p.y - r) / BUCKET), y1 = Math.floor((p.y + r) / BUCKET);
    const z0 = Math.floor((p.z - r) / BUCKET), z1 = Math.floor((p.z + r) / BUCKET);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const l = h.get(bkey(x, y, z)); if (l) for (const n of l) fn(n);
    }
  }
  const _c = new THREE.Color();
  function schreibe(g, m, farbe) {
    for (const t of g) {
      if (t.n >= t.cap) { t.cap *= 2; neuesMesh(t); t.voll = true; }
    }
    const slots = [];
    for (const t of g) {
      t.mesh.instanceMatrix.array.set(m, t.n * 16);
      t.mesh.setColorAt(t.n, farbe);
      slots.push(t, t.n); t.n++;
    }
    return slots;
  }
  function ruecksetzen(alle) {
    for (const g of Object.values(gruppen)) for (const t of g) if (alle || t.streu) t.n = 0;
  }
  function abschliessen(nurStreu) {
    for (const g of Object.values(gruppen)) for (const t of g) {
      if (nurStreu && !t.streu) continue;
      t.mesh.count = t.n; t.mesh.visible = t.n > 0;
      t.mesh.instanceMatrix.needsUpdate = true;
      if (t.mesh.instanceColor) t.mesh.instanceColor.needsUpdate = true;
    }
  }
  const aufbauPos = V3();
  function neuaufbau() {
    // Streu-Modelle teilen sich keine Gruppen mit Objekten (eigener Schlüssel)
    let nochmal = true;
    while (nochmal) {
      nochmal = false;
      for (const g of Object.values(gruppen)) for (const t of g) if (!t.streu) { t.n = 0; t.voll = false; }
      kolHash.clear(); alleHash.clear();
      aufbauPos.copy(letzterScan);
      const k2 = KLEIN_R * KLEIN_R;
      for (const z of zellen.values()) for (const node of z.nodes) {
        const weg = abgebaut.has(node.id);
        node.slots = null;
        const modell = weg ? node.def.leer : node.modell;
        if (modell && !(node.def.klein && node.pos.distanceToSquared(aufbauPos) > k2)) {
          const g = gruppe(modell);
          node.slots = schreibe(g, node.m, _c.setScalar(node.tint));
          if (g.some(t => t.voll)) nochmal = true;
        }
        if (!weg) {
          if (node.def.art) insHash(alleHash, node, node.pos);
          if (node.def.kol || node.def.kolMulti) insHash(kolHash, node, node.pos);
        }
      }
    }
    abschliessen(false);
    // Animationen auf neue Slots
    for (const a of wackeln) if (a.node.slots == null) a.t = 99;
  }
  const streuPos = V3();
  function streuAufbau(pos) {
    streuPos.copy(pos);
    for (const g of Object.values(gruppen)) for (const t of g) if (t.streu) t.n = 0;
    const r2 = STREU_R * STREU_R, rIn = (STREU_R - 10) * (STREU_R - 10);
    const tmp = new Float32Array(16);
    for (const z of zellen.values()) {
      if (!z.streu) continue;
      for (const s of z.streu) {
        const d2 = s.pos.distanceToSquared(pos); if (d2 > r2) continue;
        let g = gruppen['streu:' + s.modell];
        if (!g) {
          const geos = MODELLE[s.modell];
          g = gruppen['streu:' + s.modell] = Object.entries(geos).map(([teil, geo]) => ({ modell: s.modell, teil, geo, cap: 256, n: 0, mesh: null, streu: true }));
          for (const t of g) neuesMesh(t);
        }
        let m = s.m;
        if (d2 > rIn) { // am Rand ausblenden (kleiner skalieren)
          const f = 1 - (Math.sqrt(d2) - (STREU_R - 10)) / 10;
          tmp.set(s.m); for (let q = 0; q < 11; q++) if (q % 4 !== 3) tmp[q] *= f; m = tmp;
        }
        for (const t of g) if (t.n >= t.cap) { t.cap *= 2; const alt = t.mesh; const arr = alt.instanceMatrix.array.slice(0, t.n * 16), col = alt.instanceColor.array.slice(0, t.n * 3); neuesMesh(t); t.mesh.instanceMatrix.array.set(arr); t.mesh.instanceColor.array.set(col); }
        for (const t of g) { t.mesh.instanceMatrix.array.set(m, t.n * 16); t.mesh.setColorAt(t.n, s.farbe); t.n++; }
      }
    }
    abschliessen(true);
  }

  // ---------- Effekte: Wackeln, Fallen, Splitter ----------
  const wackeln = [];   // { node, t, achse }
  const fallend = [];   // { obj, t, basis, achse, node, m0 }
  const _mA = new THREE.Matrix4(), _mB = new THREE.Matrix4(), _mC = new THREE.Matrix4();
  function drehUmBasis(out, m0arr, basis, achse, winkel) {
    _mA.makeTranslation(basis.x, basis.y, basis.z);
    _mB.makeRotationAxis(achse, winkel);
    _mC.makeTranslation(-basis.x, -basis.y, -basis.z);
    out.copy(_mA).multiply(_mB).multiply(_mC).multiply(_mA.clone().fromArray(m0arr));
    return out;
  }
  function wackle(node, von) {
    const achse = V3().subVectors(node.pos, von).cross(node.up).normalize();
    if (achse.lengthSq() < 0.1) achse.set(1, 0, 0);
    const alt = wackeln.find(a => a.node === node);
    if (alt) { alt.t = 0; alt.achse = achse; } else wackeln.push({ node, t: 0, achse });
  }
  const _mw = new THREE.Matrix4();
  function updateWackeln(dt) {
    for (let w = wackeln.length - 1; w >= 0; w--) {
      const a = wackeln[w]; a.t += dt;
      const fertig = a.t > 0.6;
      const amp = a.node.def.art === 'baum' ? 0.07 : 0.035;
      const ang = fertig ? 0 : Math.sin(a.t * 28) * amp * Math.exp(-a.t * 5);
      const sl = a.node.slots;
      if (sl) {
        drehUmBasis(_mw, a.node.m, a.node.pos, a.achse, ang);
        for (let q = 0; q < sl.length; q += 2) { const t = sl[q]; _mw.toArray(t.mesh.instanceMatrix.array, sl[q + 1] * 16); t.mesh.instanceMatrix.needsUpdate = true; }
      }
      if (fertig) wackeln.splice(w, 1);
    }
  }
  function faelle(node, von) {
    const g = new THREE.Group(); g.matrixAutoUpdate = false;
    for (const [teil, geo] of Object.entries(MODELLE[node.modell] || {})) {
      const m = new THREE.Mesh(geo, MAT[teil]); m.matrixAutoUpdate = false; g.add(m);
    }
    scene.add(g);
    const weg = V3().subVectors(node.pos, von); weg.addScaledVector(node.up, -weg.dot(node.up));
    if (weg.lengthSq() < 0.01) weg.set(1, 0, 0).addScaledVector(node.up, -node.up.x);
    weg.normalize();
    const achse = V3().crossVectors(node.up, weg).normalize();
    g.matrix.fromArray(node.m);
    fallend.push({ obj: g, t: 0, achse, node, weg, aufschlag: false });
  }
  const _mf = new THREE.Matrix4(), _sc = new THREE.Matrix4();
  function updateFallen(dt) {
    for (let i = fallend.length - 1; i >= 0; i--) {
      const f = fallend[i]; f.t += dt;
      const T = 1.25;
      const k = Math.min(f.t / T, 1);
      const ang = k * k * Math.PI * 0.47;
      drehUmBasis(_mf, f.node.m, f.node.pos, f.achse, ang);
      if (f.t > T) {
        if (!f.aufschlag) {
          f.aufschlag = true;
          const h = (f.node.def.kolH || 4) * f.node.s;
          const p = V3().copy(f.node.pos).addScaledVector(f.weg, h * 0.7).addScaledVector(f.node.up, 0.5);
          splitter(p, f.node.up, f.node.def.splitter, 18, 3.5);
        }
        const sk = Math.max(0.001, 1 - (f.t - T) / 0.6);
        _sc.makeTranslation(f.node.pos.x, f.node.pos.y, f.node.pos.z).multiply(_mA.makeScale(sk, sk, sk)).multiply(_mB.makeTranslation(-f.node.pos.x, -f.node.pos.y, -f.node.pos.z));
        _mf.premultiply(_sc);
      }
      f.obj.matrix.copy(_mf); f.obj.matrixWorldNeedsUpdate = true;
      if (f.t > T + 0.6) { scene.remove(f.obj); fallend.splice(i, 1); }
    }
  }
  // Partikel
  const PMAX = 160;
  const pMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ flatShading: true }), PMAX);
  pMesh.setColorAt(0, weiss); pMesh.count = 0; pMesh.frustumCulled = false; pMesh.name = 'flora:splitter';
  scene.add(pMesh);
  const partikel = [];
  function splitter(p, up, farben = [0xaaaaaa], n = 8, kraft = 2.5) {
    for (let i = 0; i < n; i++) {
      if (partikel.length >= PMAX) partikel.shift();
      const v = V3().set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(kraft).addScaledVector(up, kraft * (0.6 + Math.random() * 0.6));
      partikel.push({ p: p.clone().addScaledVector(V3().randomDirection(), 0.25), v, t: 0, life: 0.6 + Math.random() * 0.6, s: 0.08 + Math.random() * 0.1, c: new THREE.Color(farben[i % farben.length]), rot: Math.random() * 6 });
    }
  }
  const _pm = new THREE.Matrix4(), _pq = new THREE.Quaternion(), _ps = V3(), _pg = V3();
  function updatePartikel(dt) {
    let n = 0;
    for (let i = partikel.length - 1; i >= 0; i--) {
      const q = partikel[i]; q.t += dt;
      if (q.t > q.life) { partikel.splice(i, 1); continue; }
      q.v.addScaledVector(_pg.copy(q.p).normalize(), -9.8 * dt);
      q.p.addScaledVector(q.v, dt);
      const s = q.s * (1 - q.t / q.life * 0.6);
      _pq.setFromAxisAngle(Y, q.rot + q.t * 6);
      _pm.compose(q.p, _pq, _ps.set(s, s, s));
      pMesh.setMatrixAt(n, _pm); pMesh.setColorAt(n, q.c); n++;
    }
    pMesh.count = n;
    if (n) { pMesh.instanceMatrix.needsUpdate = true; pMesh.instanceColor.needsUpdate = true; }
  }

  // ---------- Beute ----------
  function gibBeute(node, mult = 1) {
    const rng = Math.random;
    const bonus = faehig('sammeln');
    const erhalten = [];
    for (const [id, a, b, ch = 1] of node.def.beute || []) {
      if (rng() > ch) continue;
      let n = a + Math.floor(rng() * (b - a + 1));
      if (bonus > 0 && ch >= 1) n += bonus;
      n = Math.max(1, Math.round(n * mult));
      ctx.emit('item:erhalten', { id, n });
      erhalten.push('+' + n + ' ' + itemName(id));
    }
    return erhalten;
  }
  function abbauen(node) {
    abgebaut.set(node.id, uhr + (node.def.nw || 300) * (0.8 + Math.random() * 0.4));
    node.hp = node.def.hp || 1;
    dirty = true;
  }

  // ---------- Angriff ----------
  const _v = V3(), _dirT = V3();
  ctx.on('angriff', e => {
    if (!e || !e.pos) return;
    const pos = e.pos, up = _n.copy(pos).normalize();
    const reich = (e.reichweite ?? 2.2);
    _dirT.copy(e.dir || ctx.spieler?.forward || Y); _dirT.addScaledVector(up, -_dirT.dot(up));
    if (_dirT.lengthSq() < 1e-6) _dirT.set(1, 0, 0); _dirT.normalize();
    let best = null, bestD = Infinity;
    abfrage(alleHash, pos, reich + 3, node => {
      const art = node.def.art; if (art !== 'baum' && art !== 'fels' && art !== 'erz') return;
      _v.subVectors(node.pos, pos); _v.addScaledVector(up, -_v.dot(up));
      const rad = (node.def.kol || 0.4) * node.s;
      const d = Math.max(0, _v.length() - rad);
      if (d > reich) return;
      const cos = _v.lengthSq() > 1e-6 ? _v.normalize().dot(_dirT) : 1;
      if (cos < 0.3 && d > 0.6) return;
      const score = d - cos * 0.5;
      if (score < bestD) { bestD = score; best = node; }
    });
    if (!best) return;
    const node = best, def = node.def;
    const trefferPunkt = V3().copy(node.pos).addScaledVector(node.up, def.art === 'baum' ? 1.1 : 0.6 * node.s);
    if (def.art === 'erz') {
      const hat = faehig('abbau');
      if (hat < def.abbau) {
        toast('Du brauchst ein Tier mit Abbau ≥ ' + def.abbau + ' für ' + itemName(def.erz) + '.', 2200);
        wackle(node, pos); splitter(trefferPunkt, node.up, [0x8a8a90], 3, 1.5);
        return;
      }
    }
    const schaden = Math.max(1, Math.round((e.schaden ?? 10) / 10));
    node.hp -= schaden;
    splitter(trefferPunkt, node.up, def.splitter, 6, 2.2);
    if (node.hp > 0) { wackle(node, pos); return; }
    // gefällt / abgebaut
    if (def.fall) faelle(node, pos);
    else splitter(trefferPunkt, node.up, def.splitter, 16, 3);
    gibBeute(node);
    abbauen(node);
  });

  // ---------- Interaktion (E) ----------
  ctx.ziele.push(pos => {
    if (!pos) return [];
    const out = [], up = _t.copy(pos).normalize();
    abfrage(alleHash, pos, ZIEL_R + 1, node => {
      if (node.def.art !== 'sammeln' || abgebaut.has(node.id)) return;
      const v = V3().subVectors(node.pos, pos); v.addScaledVector(up, -v.dot(up));
      const dist = v.length(); if (dist > ZIEL_R) return;
      out.push({
        dist, label: node.def.label || 'Sammeln', pos: node.pos, typ: node.typ,
        act: () => {
          if (abgebaut.has(node.id)) return;
          splitter(V3().copy(node.pos).addScaledVector(node.up, 0.4), node.up, node.def.splitter, 10, 1.8);
          gibBeute(node); abbauen(node);
        },
      });
    });
    return out;
  });

  // ---------- Kollision & Abfragen (für andere Module) ----------
  const _k = V3(), _kp = V3();
  function kollision(pos, radius = 0.4) {
    if (!pos) return null;
    let push = null, treffer = null;
    abfrage(kolHash, pos, radius + 6, node => {
      const def = node.def;
      const list = def.kolMulti || [[0, def.kol]];
      for (const [ox, r0] of list) {
        if (ox) _kp.set(ox, 0, 0).applyMatrix4(_m4.fromArray(node.m)); else _kp.copy(node.pos);
        _k.subVectors(pos, _kp);
        const hoch = _k.dot(node.up);
        if (hoch < -1 || hoch > (def.kolH || 2) * node.s) continue;
        _k.addScaledVector(node.up, -hoch);
        const d = _k.length(), r = r0 * node.s + radius;
        if (d >= r) continue;
        if (!push) push = V3();
        if (d < 1e-4) _k.set(1, 0, 0).addScaledVector(node.up, -node.up.x).normalize(); else _k.multiplyScalar(1 / d);
        push.addScaledVector(_k, r - d);
        treffer = node;
      }
    });
    return push ? { push, typ: treffer.typ, id: treffer.id, art: treffer.def.art } : null;
  }
  function naechste(pos, typ, maxDist = 200) {
    let best = null, bd = maxDist * maxDist;
    for (const z of zellen.values()) for (const node of z.nodes) {
      if (abgebaut.has(node.id) || !node.def.art) continue;
      if (typ && !(node.typ === typ || node.def.art === typ || node.def.erz === typ || (node.def.beute || []).some(b => b[0] === typ))) continue;
      const d = node.pos.distanceToSquared(pos);
      if (d < bd) { bd = d; best = node; }
    }
    return best ? { pos: best.pos.clone(), dist: Math.sqrt(bd), typ: best.typ, art: best.def.art, id: best.id, abbau: best.def.abbau || 0 } : null;
  }

  // ---------- Erstes Laden (synchron um den Spawn) ----------
  let ladeMs = 0;
  function vollLaden() {
    const t0 = performance.now();
    const p = spielerPos(); scan(p); arbeite(1e9); neuaufbau(); dirty = false; streuAufbau(p); streuDirty = false;
    ladeMs = Math.round(performance.now() - t0);
  }
  vollLaden();
  ctx.on('bereit', () => { const p = spielerPos(); if (p.distanceTo(letzterScan) > 5) vollLaden(); });

  let respawnT = 0;
  const statistik = () => {
    let objekte = 0, streu = 0, meshes = 0, dreiecke = 0;
    for (const g of Object.values(gruppen)) for (const t of g) {
      if (t.n) { meshes++; dreiecke += t.n * t.geo.attributes.position.count / 3; }
      if (t.streu) streu += t.n; else objekte += t.n;
    }
    return { ladeMs, zellen: zellen.size, objekte, streu, meshes, dreiecke, abgebaut: abgebaut.size };
  };

  return {
    update(dt) {
      uhr += dt; uZeit.value += dt;
      const pos = spielerPos();
      const sprung = !gescannt || pos.distanceToSquared(letzterScan) > 60 * 60;
      if (sprung) { vollLaden(); }  // Teleport
      else if (pos.distanceToSquared(letzterScan) > 16) scan(pos);
      if (queue.length) arbeite(4);
      if ((respawnT -= dt) <= 0) {
        respawnT = 2;
        for (const [id, t] of abgebaut) if (t <= uhr) { abgebaut.delete(id); dirty = true; }
      }
      if (dirty || pos.distanceToSquared(aufbauPos) > 144) { neuaufbau(); dirty = false; }
      if (streuDirty || pos.distanceToSquared(streuPos) > 9) { streuAufbau(pos); streuDirty = false; }
      if (wackeln.length) updateWackeln(dt);
      if (fallend.length) updateFallen(dt);
      if (partikel.length || pMesh.count) updatePartikel(dt);
    },
    kollision, naechste, statistik,
    istAbgebaut: id => abgebaut.has(id),
    save() {
      const ab = {};
      for (const [id, t] of abgebaut) ab[id] = Math.max(1, Math.round(t - uhr));
      return { v: 1, ab };
    },
    load(d) {
      abgebaut.clear();
      if (d && d.ab) for (const [id, rest] of Object.entries(d.ab)) abgebaut.set(id, uhr + (+rest || 0));
      dirty = true;
    },
  };
}
