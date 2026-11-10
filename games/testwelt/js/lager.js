// Testwelt – Lagerplatz neben dem Start: Schuppen mit Tür, Truhe und Werkbank. Nur Verdrahtung von Engine-Bausteinen:
//   world/welt-aenderung (Bauplatz einebnen + freiräumen) · gameplay/tueren (Tür auf/zu, Kollision nur solange zu)
//   gameplay/behaelter (Truhe mit eigenem Inventar) · gameplay/stationen (Werkbank für Rezepte) · world/kollision (Wände)
import * as THREE from 'three';
import { createTueren } from '../../../engine/gameplay/tueren.js';
import { createBehaelter } from '../../../engine/gameplay/behaelter.js';
import { createStationen } from '../../../engine/gameplay/stationen.js';
import { rng, hashSeed, range } from '../../../engine/core/rng.js';

const PLATZ_RADIUS = 4.6;   // so viel wird eingeebnet und von Bäumen/Felsen befreit
const TRUHE_INHALT = [{ id: 'schaufel', anzahl: 1 }, { id: 'holz', anzahl: 4 }, { id: 'stein', anzahl: 3 }, { id: 'apfel', anzahl: 2 }];

/** Trockenen, halbwegs flachen, änderbaren Platz in der Nähe des Starts suchen: { x, z, winkel } (Tür zeigt zum Start) oder null. */
export function findeLagerPlatz(aend, adapter, start, seed) {
  const r = rng(hashSeed('lager', seed)), w0 = range(r, 0, Math.PI * 2);
  for (const abstand of [13, 16, 20]) for (let k = 0; k < 12; k++) {
    const w = w0 + k * Math.PI / 6, x = start.x + Math.sin(w) * abstand, z = start.z + Math.cos(w) * abstand;
    let ok = true, tief = Infinity, hoch = -Infinity;
    for (let dz = -6; dz <= 6 && ok; dz += 2) for (let dx = -6; dx <= 6; dx += 2) {
      if (Math.hypot(dx, dz) > PLATZ_RADIUS + 1.5) continue;
      const h = adapter.bodenHoehe(x + dx, z + dz), wasser = adapter.wasserHoehe(x + dx, z + dz);
      if (!aend.kannAendern(x + dx, z + dz) || (wasser !== null && wasser > h - 0.2)) { ok = false; break; }
      tief = Math.min(tief, h); hoch = Math.max(hoch, h);
    }
    if (ok && hoch - tief < 3) return { x, z, winkel: Math.atan2(start.x - x, start.z - z) };
  }
  return null;
}

/** Bauplatz einebnen und Objekte dort entfernen. Danach `aend.festschreiben()` rufen – der Platz gehört dann zur Ausgangswelt. */
export function bereiteLagerPlatz(aend, p) {
  aend.pinsel('ebnen', p.x, p.z, { radius: PLATZ_RADIUS + 3, staerke: 1 });
  aend.pinsel('ebnen', p.x, p.z, { radius: PLATZ_RADIUS + 3, staerke: 1 });
  aend.pinsel('ebnen', p.x, p.z, { radius: PLATZ_RADIUS, staerke: 1, form: 'hart' });
  for (const i of aend.objekteImUmkreis(p.x, p.z, PLATZ_RADIUS)) aend.entferneObjekt(i);
}

/**
 * opts: { szene, welt (Kollisions-Welt), interaktion, ereignisse, register, platz {x, z, winkel}, stand (aus zustand()) }
 * Liefert { tueren, behaelter, stationen, update(dt, wer), zustand(), dispose() }.
 */
export function createLager({ szene, welt, interaktion, ereignisse, register, platz, stand = null }) {
  const y0 = welt.bodenHoehe(platz.x, platz.z), c = Math.cos(platz.winkel), s = Math.sin(platz.winkel);
  // lokal (lx, lz) → Welt; wie eine THREE-Gruppe mit rotation.y = winkel (und wie `winkel` beim Kasten der Kollision)
  const zuWelt = (lx, lz) => ({ x: platz.x + lx * c + lz * s, z: platz.z - lx * s + lz * c });
  const wurzel = new THREE.Group(); wurzel.name = 'lager';
  const gruppe = new THREE.Group();
  gruppe.position.set(platz.x, y0, platz.z); gruppe.rotation.y = platz.winkel;
  wurzel.add(gruppe); szene.add(wurzel);
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = (farbe) => new THREE.MeshStandardMaterial({ color: farbe, flatShading: true, roughness: 0.9 });
  const mats = { wand: mat(0x9a7a52), dach: mat(0x5d4630), boden: mat(0x7d6648), truhe: mat(0x7a4f25), deckel: mat(0x5f3c1b), bank: mat(0x6e5a44), platte: mat(0xb89468), tuer: mat(0x6b4a2e) };
  const koerper = [];
  /** Kasten als Mesh (+ Kollisions-Körper). unten = Unterkante über dem Boden; der Körper reicht 0.3 m in den Boden. */
  function kasten(lx, lz, bx, bz, hoehe, material, { unten = 0, fest = true, begehbar = false, art = 'wand', eltern = gruppe } = {}) {
    const mesh = new THREE.Mesh(geo, material);
    const tief = unten === 0 ? 0.3 : 0;
    mesh.scale.set(bx * 2, hoehe + tief, bz * 2); mesh.position.set(lx, unten + (hoehe - tief) / 2, lz);
    mesh.castShadow = mesh.receiveShadow = true;
    eltern.add(mesh);
    if (fest) koerper.push(welt.fuege({ form: 'kasten', ...zuWelt(lx, lz), bx, bz, winkel: platz.winkel, y0: y0 + unten - tief, hoehe: hoehe + tief, begehbar, daten: { art } }));
    return mesh;
  }

  // ---- Schuppen: 3,2 × 2,8 m, Tür vorn (lokal +z, zeigt zum Start) ----
  const W = 1.6, T = 1.4, D = 0.075, H = 2.2, TUER = 1.1;
  kasten(0, -T, W + D, D, H, mats.wand);
  kasten(-W, 0, D, T, H, mats.wand);
  kasten(W, 0, D, T, H, mats.wand);
  const seite = (W - TUER / 2) / 2;
  kasten(-(TUER / 2 + seite), T, seite, D, H, mats.wand);
  kasten(TUER / 2 + seite, T, seite, D, H, mats.wand);
  kasten(0, T, TUER / 2, D, H - 2, mats.wand, { unten: 2, fest: false });            // Sturz über der Tür
  kasten(0, 0, W + 0.3, T + 0.3, 0.12, mats.dach, { unten: H, fest: false });        // Dach
  kasten(0, 0, W, T, 0.04, mats.boden, { unten: 0.01, fest: false });                // Dielen

  const tueren = createTueren({ welt, interaktion, ereignisse });
  const tuer = tueren.neu('schuppen', { ...zuWelt(0, T), y: y0, winkel: platz.winkel, breite: TUER, dicke: 0.08, hoehe: 2, angel: 'links', name: 'Tür' });
  const angel = new THREE.Group();
  const blatt = new THREE.Mesh(geo, mats.tuer);
  blatt.scale.set(TUER - 0.04, 1.96, 0.08); blatt.position.set(TUER / 2, 1, 0); blatt.castShadow = true;
  angel.add(blatt); wurzel.add(angel);
  const stelleTuer = () => { const a = tuer.angelPos; angel.position.set(a.x, tuer.y, a.z); angel.rotation.y = tuer.winkel + tuer.drehung; };

  // ---- Truhe im Schuppen (Deckel klappt auf, solange sie offen ist) ----
  const behaelter = createBehaelter({ register, interaktion, ereignisse, plaetze: 12 });
  const tx = -0.95, tz = -0.95;
  kasten(tx, tz, 0.42, 0.28, 0.45, mats.truhe, { begehbar: true, art: 'truhe' });
  const deckel = new THREE.Group();
  deckel.position.set(tx, 0.45, tz - 0.28);
  const deckelMesh = new THREE.Mesh(geo, mats.deckel);
  deckelMesh.scale.set(0.9, 0.12, 0.6); deckelMesh.position.set(0, 0.06, 0.28); deckelMesh.castShadow = true;
  deckel.add(deckelMesh); gruppe.add(deckel);
  const truhe = behaelter.neu('truhe', { pos: { ...zuWelt(tx, tz), y: y0 }, name: 'Truhe', radius: 0.45, inhalt: stand?.truhen ? null : TRUHE_INHALT });

  // ---- Werkbank vor dem Schuppen ----
  const stationen = createStationen({ interaktion, ereignisse });
  const bx = 2.75, bz = 0.5;
  kasten(bx, bz, 0.62, 0.3, 0.78, mats.bank, { begehbar: true, art: 'werkbank' });
  kasten(bx, bz, 0.8, 0.42, 0.1, mats.platte, { unten: 0.78, fest: false });
  stationen.neu('werkbank', { art: 'werkbank', pos: { ...zuWelt(bx, bz), y: y0 }, radius: 0.8, name: 'Werkbank' });

  if (stand) { tueren.lade(stand.tueren); behaelter.lade(stand.truhen); }
  stelleTuer();
  return {
    tueren, behaelter, stationen, platz,
    /** Je Bild: Tür schwingen lassen, Truhe schließen, wenn die Figur weggeht, Deckel bewegen. */
    update(dt, wer) {
      if (tueren.update(dt)) stelleTuer();
      behaelter.pruefe(wer);
      const ziel = truhe.offenFuer ? -1.15 : 0;
      if (deckel.rotation.x !== ziel) { const d = ziel - deckel.rotation.x, schritt = dt * 6; deckel.rotation.x = Math.abs(d) <= schritt ? ziel : deckel.rotation.x + Math.sign(d) * schritt; }
    },
    zustand: () => ({ tueren: tueren.zustand(), truhen: behaelter.zustand() }),
    dispose() {
      tueren.dispose(); behaelter.dispose(); stationen.dispose();
      for (const id of koerper) welt.entferne(id);
      geo.dispose(); for (const m of Object.values(mats)) m.dispose();
      wurzel.removeFromParent();
    },
  };
}
