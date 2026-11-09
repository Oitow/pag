// Figuren-Labor – Testgelände: Hügel, Teich, Treppe, Rampe, Felsen/Bäume als Hindernisse.
// Liefert die Szene-Objekte und den Welt-Adapter für Motor + Kamera (siehe docs/FIGUREN-SYSTEM.md).
import * as THREE from 'three';
import { createNoise2D, fbm2 } from '../../../engine/core/noise.js';
import { rng, range, hashSeed } from '../../../engine/core/rng.js';
import { smoothstep } from '../../../engine/core/math.js';

const GROESSE = 120, AUFL = 160;
const TEICH = { x: -14, z: 10, r: 9 };
const WASSER_Y = 0;
// Treppe (5 Stufen à 0,25 m) und Plateau, nördlich vom Start
const TREPPE = { x0: -3, x1: 3, z0: -10, stufe: 0.25, tiefe: 0.8, n: 5 };
// Steile Rampe (zum Rutschen) östlich
const RAMPE = { x0: 12, x1: 20, z0: -4, z1: 4, hoehe: 10 };   // ~51° → zu steil, man rutscht

export function createWelt(seed = 1) {
  const n = createNoise2D(hashSeed('labor', seed));

  function natur(x, z) {
    const d = Math.hypot(x, z);
    let h = fbm2(n, x * 0.025, z * 0.025, 4) * 2.2 * smoothstep(8, 30, d);   // flache Mitte, Hügel außen
    h += smoothstep(40, 58, d) * 9;                                           // Randwall
    const t = Math.hypot(x - TEICH.x, z - TEICH.z);
    h -= (1 - smoothstep(TEICH.r * 0.3, TEICH.r, t)) * 2.4;                   // Teichmulde
    return h + 0.4;
  }
  function bauten(x, z) {
    let h = -Infinity;
    if (x > TREPPE.x0 && x < TREPPE.x1) {
      const i = Math.floor((TREPPE.z0 - z) / TREPPE.tiefe) + 1;               // nach −Z steigend
      if (i >= 1) h = 0.4 + Math.min(i, TREPPE.n) * TREPPE.stufe;
      if (z < TREPPE.z0 - TREPPE.n * TREPPE.tiefe - 6) h = -Infinity;          // Plateau 6 m tief
    }
    if (x > RAMPE.x0 && x < RAMPE.x1 && z > RAMPE.z0 && z < RAMPE.z1) h = Math.max(h, 0.4 + (x - RAMPE.x0) / (RAMPE.x1 - RAMPE.x0) * RAMPE.hoehe);
    return h;
  }
  const bodenHoehe = (x, z) => Math.max(natur(x, z), bauten(x, z));
  const wasserHoehe = (x, z) => (Math.hypot(x - TEICH.x, z - TEICH.z) < TEICH.r + 2 ? WASSER_Y : null);

  // Hindernisse: Kreise (Baumstämme, Felsen)
  const r = rng(hashSeed('hindernisse', seed));
  const kreise = [];
  for (let i = 0; i < 40 && kreise.length < 22; i++) {
    const a = range(r, 0, Math.PI * 2), d = range(r, 14, 42);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x - TEICH.x, z - TEICH.z) < TEICH.r + 3) continue;
    if (x > RAMPE.x0 - 3 && x < RAMPE.x1 + 3 && Math.abs(z) < 8) continue;
    if (Math.abs(x) < 6 && z < -6 && z > -20) continue;
    kreise.push({ x, z, radius: range(r, 0.35, 1.2), art: r() < 0.6 ? 'baum' : 'fels' });
  }
  function hindernisse(x, z, radius) {
    let px = 0, pz = 0, hit = false;
    for (const k of kreise) {
      const dx = x - k.x, dz = z - k.z, d = Math.hypot(dx, dz), min = k.radius + radius;
      if (d < min && d > 1e-6) { px += dx / d * (min - d); pz += dz / d * (min - d); hit = true; }
    }
    return hit ? { x: px, z: pz } : null;
  }

  // ---- Szene ----
  const gruppe = new THREE.Group();
  const geo = new THREE.PlaneGeometry(GROESSE, GROESSE, AUFL, AUFL);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, farben = new Float32Array(pos.count * 3);
  const gras = new THREE.Color('#6f9a4a'), grasH = new THREE.Color('#9ab85a'), sand = new THREE.Color('#d8c890'),
    fels = new THREE.Color('#8a8478'), stein = new THREE.Color('#b0a898'), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = natur(x, z);
    pos.setY(i, h);
    c.copy(gras).lerp(grasH, (fbm2(n, x * 0.1, z * 0.1, 2) + 1) / 2);
    if (h < 0.5) c.lerp(sand, smoothstep(0.5, -0.2, h));
    if (h > 5) c.lerp(fels, smoothstep(5, 8, h));
    farben.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  geo.computeVertexNormals();
  const boden = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  boden.receiveShadow = true;
  gruppe.add(boden);

  // Treppe + Plateau als Blöcke, Rampe als Keil (exakt wie bauten())
  const steinM = new THREE.MeshStandardMaterial({ color: stein, roughness: 0.9, flatShading: true });
  const block = (x0, x1, z0, z1, hoch, keil) => {
    const g = new THREE.BoxGeometry(x1 - x0, hoch + 2, z1 - z0);
    if (keil) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0 && p.getX(i) < 0) p.setY(i, -(hoch + 2) / 2 + 2); g.computeVertexNormals(); }
    const m = new THREE.Mesh(g, steinM);
    m.position.set((x0 + x1) / 2, hoch - (hoch + 2) / 2 + 0.4, (z0 + z1) / 2);
    m.castShadow = m.receiveShadow = true; gruppe.add(m);
  };
  for (let i = 1; i <= TREPPE.n; i++) block(TREPPE.x0, TREPPE.x1, TREPPE.z0 - i * TREPPE.tiefe, TREPPE.z0 - (i - 1) * TREPPE.tiefe, i * TREPPE.stufe);
  block(TREPPE.x0, TREPPE.x1, TREPPE.z0 - TREPPE.n * TREPPE.tiefe - 6, TREPPE.z0 - TREPPE.n * TREPPE.tiefe, TREPPE.n * TREPPE.stufe);
  block(RAMPE.x0, RAMPE.x1, RAMPE.z0, RAMPE.z1, RAMPE.hoehe, true);

  const wasser = new THREE.Mesh(new THREE.CircleGeometry(TEICH.r + 2, 40),
    new THREE.MeshStandardMaterial({ color: '#3a7aa8', transparent: true, opacity: 0.72, roughness: 0.15, metalness: 0.1 }));
  wasser.rotation.x = -Math.PI / 2; wasser.position.set(TEICH.x, WASSER_Y, TEICH.z);
  gruppe.add(wasser);

  const stamm = new THREE.MeshStandardMaterial({ color: '#6a4a30', roughness: 1, flatShading: true });
  const krone = new THREE.MeshStandardMaterial({ color: '#4a7a3a', roughness: 1, flatShading: true });
  const felsM = new THREE.MeshStandardMaterial({ color: '#8a8680', roughness: 1, flatShading: true });
  for (const k of kreise) {
    const y = bodenHoehe(k.x, k.z);
    if (k.art === 'baum') {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(k.radius * 0.7, k.radius, 3, 7), stamm);
      s.position.set(k.x, y + 1.5, k.z);
      const kr = new THREE.Mesh(new THREE.IcosahedronGeometry(k.radius * 2.6 + 0.8, 0), krone);
      kr.position.set(k.x, y + 3 + k.radius * 2, k.z);
      for (const m of [s, kr]) { m.castShadow = m.receiveShadow = true; gruppe.add(m); }
    } else {
      const f = new THREE.Mesh(new THREE.DodecahedronGeometry(k.radius * 1.15, 0), felsM);
      f.position.set(k.x, y + k.radius * 0.5, k.z); f.scale.y = 0.8; f.rotation.y = k.x;
      f.castShadow = f.receiveShadow = true; gruppe.add(f);
    }
  }

  return {
    gruppe, kreise, teich: TEICH,
    adapter: { bodenHoehe, wasserHoehe, hindernisse },
    dispose() { gruppe.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); }); gruppe.removeFromParent(); },
  };
}
