// Grafik-Hilfen für kreaturen.js: Voxel-Modelle „backen“ (alle Voxel eines Tieres in EIN Mesh,
// verdeckte Innenflächen entfernt → 1 Draw-Call pro Tier), Materialien für Varianten,
// Fangkugel-Modell, Partikel, Namens-/HP-Schilder.
import * as THREE from 'three';
import { ladeModell, ladeLebendig } from './tiere-loader.js';

// ---------- Materialien ----------
const grad = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
const toon = o => new THREE.MeshToonMaterial({ gradientMap: grad, vertexColors: true, ...o });

export const MAT = {
  normal: toon(),
  alpha: [
    toon({ color: 0xffe0a0, emissive: 0x4a3000 }),   // golden
    toon({ color: 0xc8dcff, emissive: 0x10204a }),   // eisblau
    toon({ color: 0xffb0c8, emissive: 0x4a0a24 }),   // rosé
  ],
  glut: toon({ color: 0x6a4a48, emissive: 0xff3a00, emissiveIntensity: 0.3 }),
  leuchtTier: toon({ emissive: 0x2a3a50 }),
  glas: new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false }),
  leucht: new THREE.MeshBasicMaterial({ vertexColors: true }),
  leuchtGlut: new THREE.MeshBasicMaterial({ color: 0xffa040 }),
  blitz: new THREE.MeshBasicMaterial({ color: 0xffffff }),
};

// Das Tier-Modell vom Kachel-Boden der Vorschau-Datei befreien (der Loader übernimmt auch
// die Gras-/Wasserkachel der Szene) und neu normieren.
function saeubern(w) {
  const g = w.children[0];
  if (!g) return w;
  // Vorschau-Dateien fügen zuletzt das Tier hinzu (scene.add(root)); davor Kachel/Wasser/Deko.
  const gruppen = g.children.filter(c => c.isGroup);
  for (const c of g.children.slice()) if (c !== gruppen[gruppen.length - 1]) g.remove(c);
  g.scale.setScalar(1); g.position.set(0, 0, 0); g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g), sz = b.getSize(new THREE.Vector3());
  if (b.isEmpty()) return w;
  const s = 1 / Math.max(sz.x, sz.y, sz.z, 0.01);
  g.scale.setScalar(s);
  g.position.set(-(b.min.x + b.max.x) / 2 * s, -b.min.y * s, -(b.min.z + b.max.z) / 2 * s);
  w.updateMatrixWorld(true);
  return w;
}

// ---------- Backen ----------
const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _v = new THREE.Vector3(), _c = new THREE.Color(), _ic = new THREE.Color();

function eimerFuer(mat) {
  if (mat.isMeshBasicMaterial) return 'leucht';
  if (mat.transparent) return 'glas';
  return 'normal';
}

// Liefert { teile: [{ geo, art }], hoehe, laenge, breite } – Modell normiert (größte Ausdehnung 1,
// Füße bei y=0, mittig, Blick +Z).
export async function backe(id) {
  const proto = await ladeModell(id);
  const w = proto.clone(true);
  saeubern(w);
  const eimer = {};
  const holeEimer = art => (eimer[art] ||= { pos: [], nor: [], col: [], idx: [], flaechen: new Map() });

  const box = new THREE.Box3();
  w.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const e = holeEimer(eimerFuer(mat));
    const geo = o.geometry;
    const P = geo.attributes.position, N = geo.attributes.normal;
    const I = geo.index;
    const istBox = geo.type === 'BoxGeometry' && I && I.count === 36;
    const anzahl = o.isInstancedMesh ? o.count : 1;
    const basisFarbe = mat.color || _c.set(0xffffff);
    for (let i = 0; i < anzahl; i++) {
      if (o.isInstancedMesh) { o.getMatrixAt(i, _m); _m.premultiply(o.matrixWorld); }
      else _m.copy(o.matrixWorld);
      _n.getNormalMatrix(_m);
      _ic.copy(basisFarbe);
      if (o.isInstancedMesh && o.instanceColor) { _c.fromBufferAttribute(o.instanceColor, i); _ic.multiply(_c); }
      if (istBox) {
        // 6 Seiten à 4 Ecken; Innenflächen (zwei Voxel teilen sich die Fläche) später entfernen
        for (let f = 0; f < 6; f++) {
          const ecken = [];
          let cx = 0, cy = 0, cz = 0;
          for (let j = 0; j < 4; j++) {
            _v.fromBufferAttribute(P, f * 4 + j).applyMatrix4(_m);
            ecken.push(_v.x, _v.y, _v.z); cx += _v.x; cy += _v.y; cz += _v.z;
          }
          _v.fromBufferAttribute(N, f * 4).applyMatrix3(_n).normalize();
          const key = Math.round(cx * 100) + ',' + Math.round(cy * 100) + ',' + Math.round(cz * 100);
          const alt = e.flaechen.get(key);
          if (alt) { alt.weg = true; continue; }
          const ix = [];
          for (let k = 0; k < 6; k++) ix.push(I.array[f * 6 + k] - f * 4);
          e.flaechen.set(key, { ecken, ix, n: [_v.x, _v.y, _v.z], c: [_ic.r, _ic.g, _ic.b], weg: false });
        }
      } else {
        const ndx = I ? I.array : null;
        const basis = e.pos.length / 3;
        for (let j = 0; j < P.count; j++) {
          _v.fromBufferAttribute(P, j).applyMatrix4(_m); e.pos.push(_v.x, _v.y, _v.z);
          if (N) { _v.fromBufferAttribute(N, j).applyMatrix3(_n).normalize(); e.nor.push(_v.x, _v.y, _v.z); } else e.nor.push(0, 1, 0);
          e.col.push(_ic.r, _ic.g, _ic.b);
        }
        if (ndx) for (let j = 0; j < ndx.length; j++) e.idx.push(basis + ndx[j]);
        else for (let j = 0; j < P.count; j++) e.idx.push(basis + j);
      }
    }
  });

  // Flächen in Puffer schreiben
  for (const e of Object.values(eimer)) {
    for (const fl of e.flaechen.values()) {
      if (fl.weg) continue;
      const b0 = e.pos.length / 3;
      e.pos.push(...fl.ecken);
      for (let j = 0; j < 4; j++) { e.nor.push(...fl.n); e.col.push(...fl.c); }
      for (const k of fl.ix) e.idx.push(b0 + k);
    }
    for (let i = 0; i < e.pos.length; i += 3) box.expandByPoint(_v.set(e.pos[i], e.pos[i + 1], e.pos[i + 2]));
  }
  if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
  const sz = box.getSize(new THREE.Vector3());
  const s = 1 / Math.max(sz.x, sz.y, sz.z, 0.01);
  const ox = -(box.min.x + box.max.x) / 2, oy = -box.min.y, oz = -(box.min.z + box.max.z) / 2;
  const teile = [];
  for (const [art, e] of Object.entries(eimer)) {
    if (!e.pos.length) continue;
    const pos = new Float32Array(e.pos.length);
    for (let i = 0; i < pos.length; i += 3) {
      pos[i] = (e.pos[i] + ox) * s; pos[i + 1] = (e.pos[i + 1] + oy) * s; pos[i + 2] = (e.pos[i + 2] + oz) * s;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(e.nor), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(e.col), 3));
    geo.setIndex(e.idx);
    geo.computeBoundingSphere();
    teile.push({ geo, art });
  }
  return { teile, hoehe: sz.y * s, laenge: sz.z * s, breite: sz.x * s };
}

// Instanz eines gebackenen Modells. variante: { alpha: 0..2 | -1, glut, leuchtet }
export function instanz(modell, variante = {}) {
  const g = new THREE.Group();
  const inner = new THREE.Group(); g.add(inner);
  const meshes = [];
  for (const t of modell.teile) {
    let mat;
    if (t.art === 'glas') mat = MAT.glas;
    else if (t.art === 'leucht') mat = variante.glut ? MAT.leuchtGlut : MAT.leucht;
    else if (variante.glut) mat = MAT.glut;
    else if (variante.alpha >= 0) mat = MAT.alpha[variante.alpha % MAT.alpha.length];
    else if (variante.leuchtet) mat = MAT.leuchtTier;
    else mat = MAT.normal;
    const m = new THREE.Mesh(t.geo, mat);
    m.castShadow = true; m.receiveShadow = false;
    m.userData.mat = mat;
    inner.add(m); meshes.push(m);
  }
  return { obj: g, inner, meshes };
}

export function blitz(meshes, an) {
  for (const m of meshes) m.material = an ? MAT.blitz : m.userData.mat;
}

// Lebendiges Modell (Begleiter, mit Idle-Animation) – Kachel entfernt, normiert.
export async function lebendig(id) {
  const r = await ladeLebendig(id);
  saeubern(r.gruppe);
  return r;
}

// ---------- Fangkugel ----------
const KR = 0.17;
const kGeo = {
  oben: new THREE.SphereGeometry(KR, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  unten: new THREE.SphereGeometry(KR, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
  band: new THREE.TorusGeometry(KR * 1.005, KR * 0.11, 6, 24).rotateX(Math.PI / 2),
  knopf: new THREE.CylinderGeometry(KR * 0.3, KR * 0.3, KR * 0.25, 12).rotateX(Math.PI / 2).translate(0, 0, KR * 0.98),
};
const kMat = {}, weiss = new THREE.MeshLambertMaterial({ color: 0xf4f1ea }), dunkel = new THREE.MeshLambertMaterial({ color: 0x222228 });
export const KUGEL_RADIUS = KR;
export function kugelModell(farbe) {
  kMat[farbe] ||= new THREE.MeshLambertMaterial({ color: farbe, emissive: new THREE.Color(farbe).multiplyScalar(0.15) });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(kGeo.oben, kMat[farbe]), new THREE.Mesh(kGeo.unten, weiss), new THREE.Mesh(kGeo.band, dunkel));
  const knopfMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const knopf = new THREE.Mesh(kGeo.knopf, knopfMat);
  g.add(knopf);
  g.userData.knopf = knopfMat;
  return g;
}

// ---------- Partikel ----------
function punktTextur() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export class Partikel {
  constructor(scene, n = 500) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3); this.leben = new Float32Array(n); this.max = new Float32Array(n);
    this.farbe = new Float32Array(n * 3); this.grav = new Float32Array(n);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.punkte = new THREE.Points(this.geo, new THREE.PointsMaterial({
      size: 0.35, map: punktTextur(), vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }));
    this.punkte.frustumCulled = false; this.punkte.renderOrder = 5;
    scene.add(this.punkte);
    this.aktiv = 0;
  }
  // p: Ort, anzahl, farbe (hex), tempo, up (Vector3 – „oben“), leben (s), grav (m/s²)
  emit(p, anzahl, farbe, tempo = 3, up = null, leben = 0.8, grav = 4) {
    _c.set(farbe);
    for (let k = 0; k < anzahl; k++) {
      const i = this.i; this.i = (this.i + 1) % this.n;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(tempo * (0.4 + Math.random() * 0.6));
      if (up) _v.addScaledVector(up, tempo * 0.5);
      this.vel[i * 3] = _v.x; this.vel[i * 3 + 1] = _v.y; this.vel[i * 3 + 2] = _v.z;
      this.leben[i] = this.max[i] = leben * (0.6 + Math.random() * 0.6);
      this.farbe[i * 3] = _c.r; this.farbe[i * 3 + 1] = _c.g; this.farbe[i * 3 + 2] = _c.b;
      this.grav[i] = grav;
    }
    this.aktiv = 1.5;
  }
  update(dt) {
    if (this.aktiv <= 0) return;
    this.aktiv -= dt;
    const P = this.pos, V = this.vel, C = this.col;
    for (let i = 0; i < this.n; i++) {
      if (this.leben[i] <= 0) { if (C[i * 3] || C[i * 3 + 1] || C[i * 3 + 2]) { C[i * 3] = C[i * 3 + 1] = C[i * 3 + 2] = 0; } continue; }
      this.aktiv = Math.max(this.aktiv, 0.1);
      this.leben[i] -= dt;
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], l = Math.hypot(x, y, z) || 1, g = this.grav[i] * dt / l;
      V[i * 3] -= x * g; V[i * 3 + 1] -= y * g; V[i * 3 + 2] -= z * g;
      const d = Math.pow(0.2, dt);
      V[i * 3] *= d; V[i * 3 + 1] *= d; V[i * 3 + 2] *= d;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      const a = Math.max(0, this.leben[i] / this.max[i]);
      C[i * 3] = this.farbe[i * 3] * a; C[i * 3 + 1] = this.farbe[i * 3 + 1] * a; C[i * 3 + 2] = this.farbe[i * 3 + 2] * a;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

// ---------- Schild über dem Tier: Name, Stufe, HP-Balken ----------
export class Schild {
  constructor() {
    this.c = document.createElement('canvas'); this.c.width = 256; this.c.height = 64;
    this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, depthTest: false, transparent: true }));
    this.sprite.scale.set(1.6, 0.4, 1); this.sprite.renderOrder = 10;
    this.key = '';
  }
  zeichne(text, stufeOk, anteil, alpha, glut) {
    const key = text + stufeOk + Math.round(anteil * 40) + alpha;
    if (key === this.key) return;
    this.key = key;
    const x = this.c.getContext('2d');
    x.clearRect(0, 0, 256, 64);
    x.font = 'bold 26px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 5; x.strokeStyle = 'rgba(10,12,18,0.85)';
    x.strokeText(text, 128, 18);
    x.fillStyle = glut ? '#ffb070' : alpha ? '#ffe08a' : stufeOk ? '#f1eee6' : '#ff8a7a';
    x.fillText(text, 128, 18);
    if (anteil < 0.999) {
      x.fillStyle = 'rgba(10,12,18,0.8)'; x.fillRect(38, 40, 180, 16);
      x.fillStyle = anteil > 0.5 ? '#6fcf73' : anteil > 0.25 ? '#f2b84b' : '#e2574c';
      x.fillRect(41, 43, 174 * Math.max(0, anteil), 10);
    }
    this.tex.needsUpdate = true;
  }
  dispose() { this.tex.dispose(); this.sprite.material.dispose(); }
}
