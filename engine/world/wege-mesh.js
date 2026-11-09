/**
 * @modul    wege-mesh
 * @zweck    Holzbrücken für die Wege einer Welt als Three-Meshes: Bohlendeck, Längsbalken, Geländer und Pfeiler bis zum Flussgrund, passend geneigt zwischen beiden Ufern (Lage aus wege-lage)
 * @api      createWegeMesh(adapter, opts) -> {gruppe,lagen,anzahl,dispose}
 * @beispiel
 *   import { createWegeMesh } from '../../engine/world/wege-mesh.js';
 *   import { mitBruecken } from '../../engine/world/wege-lage.js';
 *   const wege = createWegeMesh(adapter, { schatten: true });
 *   szene.add(wege.gruppe);
 *   const begehbar = mitBruecken(adapter, wege.lagen);   // diesen Adapter der Figur geben
 * @tags     welt, wege, bruecke, holz, mesh
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { createMeshBuilder } from '../render/mesh-builder.js';
import { hashSeed } from '../core/rng.js';
import { brueckenLagen } from './wege-lage.js';

const HOLZ = 0x9a7850, HOLZ_DUNKEL = 0x5f4731, HOLZ_HELL = 0xb18f62;

/** Baut eine Brücke im lokalen Raum: Z = Längsrichtung, Deckoberkante bei y = 0, Mitte im Ursprung. */
function baueBruecke(l, adapter, seed) {
  const b = createMeshBuilder({ seed, jitter: 0.1 });
  const L = l.laenge, B = l.breite, halb = L / 2, rand = B / 2 - 0.1;
  // Bohlen
  const n = Math.max(4, Math.round(L / 0.42)), bl = L / n;
  for (let i = 0; i < n; i++) b.box(B, 0.1, bl * 0.92, i % 3 ? HOLZ : HOLZ_HELL, { y: -0.05, z: -halb + (i + 0.5) * bl });
  // Längsbalken und Geländer
  for (const s of [-1, 1]) {
    b.box(0.2, 0.22, L, HOLZ_DUNKEL, { x: s * B * 0.34, y: -0.21 });
    b.box(0.09, 0.09, L, HOLZ, { x: s * rand, y: 0.95 });
    b.box(0.06, 0.06, L, HOLZ, { x: s * rand, y: 0.52 });
    const pfosten = Math.max(2, Math.round(L / 1.7)) + 1;
    for (let i = 0; i < pfosten; i++) b.box(0.13, 1.05, 0.13, HOLZ_DUNKEL, { x: s * rand, y: 0.47, z: -halb + 0.1 + (i / (pfosten - 1)) * (L - 0.2) });
  }
  // Pfeiler bis in den Grund
  const stellen = L > 9 ? [-0.3, 0, 0.3] : [-0.25, 0.25];
  for (const f of stellen) {
    const z = f * L, deck = l.y1 + (f + 0.5) * (l.y2 - l.y1);
    const tiefe = Math.max(0.4, deck - adapter.bodenHoehe(l.x + l.rx * z, l.z + l.rz * z) + 0.6);
    for (const s of [-1, 1]) b.box(0.24, tiefe, 0.24, HOLZ_DUNKEL, { x: s * B * 0.34, y: -0.3 - tiefe / 2, z });
    b.box(B * 0.8, 0.14, 0.14, HOLZ_DUNKEL, { y: -0.38, z });
  }
  return b.mesh();
}

/**
 * opts: { schatten (false), seed (Welt-Seed) + alle Optionen von brueckenLagen (breite, ueberstand, freiraum) }
 * gruppe enthält je Brücke ein Mesh (name 'bruecke'). lagen passt zu mitBruecken() aus wege-lage.
 */
export function createWegeMesh(adapter, opts = {}) {
  const gruppe = new THREE.Group();
  gruppe.name = 'wege';
  const lagen = brueckenLagen(adapter, opts);
  const seed = hashSeed(opts.seed ?? adapter.welt.seed ?? 1, 'wege-mesh');
  lagen.forEach((l, i) => {
    const mesh = baueBruecke(l, adapter, seed + i);
    const neigung = Math.atan2(l.y2 - l.y1, l.laenge);
    mesh.name = 'bruecke';
    mesh.rotation.order = 'YXZ';
    mesh.rotation.set(-neigung, l.winkel, 0);
    mesh.scale.z = 1 / Math.cos(neigung);
    mesh.position.set(l.x, (l.y1 + l.y2) / 2, l.z);
    mesh.castShadow = mesh.receiveShadow = !!opts.schatten;
    gruppe.add(mesh);
  });
  return {
    gruppe, lagen, anzahl: lagen.length,
    dispose() {
      gruppe.removeFromParent();
      for (const m of gruppe.children) m.geometry.dispose();   // Material ist geteilt (standardMaterial)
      gruppe.clear();
    },
  };
}
