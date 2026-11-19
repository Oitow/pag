/**
 * @modul    boden-anpassung
 * @zweck    Gelände schmiegt sich an große Objekte (Wurzeln, Felsen, Ruinen): weicher Erdwulst aus lokalen Höhenkarten, Verdeckung (AO) am Fuß
 * @api      createBodenAnpassung({grundHoehe(x,z),zelle=0.6,bucket=32}) -> {fuegeFussabdruck({x,z,y?,drehung=0,skala=1,hoeheBei(lx,lz),radius,einbettung=0.35,ueberdeckung=0.12,boeschung=0.55,maxWulst=2.4,einsinken=0.3,aoHang=0.9,aoHoehe=3})->{y,wulstMax}|null, hoehe(x,z), grund(x,z), verdeckung(x,z)->0..1, fussabdruecke, dispose()}
 * @beispiel
 *   import { createBodenAnpassung } from '../../engine/world/boden-anpassung.js';
 *   const boden = createBodenAnpassung({ grundHoehe: (x, z) => gelaende(x, z) });
 *   const { y } = boden.fuegeFussabdruck({ x: 10, z: 40, drehung: 0.6, skala: 1.1, hoeheBei: baum.kollision.hoehenkarte.hoeheBei, radius: 30 });
 *   baumMesh.position.set(10, y, 40);                // Fuß auf y, der Boden wölbt sich an die Wurzeln
 *   const h = boden.hoehe(12, 41), ao = boden.verdeckung(12, 41);
 * @tags     gelaende, boden, wurzeln, hoehenkarte, ao, verdeckung, welt, worldgen, riesenbaum
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

// Ablauf je Fußabdruck (einmal beim Aufbau):
//  1. Weltachsiges Raster um das Objekt; je Zelle die lokale Objekthöhe R (hoeheBei, Objekt-Raum, NaN = nichts).
//  2. Zielhöhe des Bodens dort, wo das Objekt aufliegt: y + min(R·skala·einbettung + ueberdeckung, maxWulst) – der Fuß steckt im Boden.
//  3. Zwei Chamfer-Durchläufe (Kegel-Dilatation): F = max_j (Ziel_j − boeschung·Abstand) → der Wulst fällt weich nach außen ab.
//     Gleich mitgerechnet: A = max_j (Objektoberkante_j − aoHang·Abstand) für die Verdeckung.
//  4. F wird geglättet (2× 3×3-Kasten, danach unter dem Objekt wieder ≥ Ziel); das Raster wächst, bis F am Rand unter dem Grundgelände liegt (keine Stufe).
// Abfrage: Bucket-Gitter → nur Fußabdrücke der Zelle; Höhe = weiches Maximum aus Grundgelände und Wulst.

const D1 = 1, D2 = Math.SQRT2;
const NICHTS = -1e9;

/** Weiches Maximum (polynomial, Breite k in Metern). */
function smax(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

/** Kegel-Dilatation in-place über zwei Chamfer-Durchläufe (8 Nachbarn), Gefälle s je Meter. */
function dilatiere(f, n, m, s) {
  const s1 = s * D1, s2 = s * D2;
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
    const o = i + j * n; let v = f[o];
    if (i > 0) v = Math.max(v, f[o - 1] - s1);
    if (j > 0) {
      v = Math.max(v, f[o - n] - s1);
      if (i > 0) v = Math.max(v, f[o - n - 1] - s2);
      if (i < n - 1) v = Math.max(v, f[o - n + 1] - s2);
    }
    f[o] = v;
  }
  for (let j = m - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) {
    const o = i + j * n; let v = f[o];
    if (i < n - 1) v = Math.max(v, f[o + 1] - s1);
    if (j < m - 1) {
      v = Math.max(v, f[o + n] - s1);
      if (i < n - 1) v = Math.max(v, f[o + n + 1] - s2);
      if (i > 0) v = Math.max(v, f[o + n - 1] - s2);
    }
    f[o] = v;
  }
}

/** 3×3-Kastenfilter (Ränder geklemmt). */
function glaette(f, n, m, tmp) {
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
    const a = i > 0 ? i - 1 : i, b = i < n - 1 ? i + 1 : i, o = j * n;
    tmp[o + i] = (f[o + a] + f[o + i] + f[o + b]) / 3;
  }
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
    const a = j > 0 ? j - 1 : j, b = j < m - 1 ? j + 1 : j;
    f[i + j * n] = (tmp[i + a * n] + tmp[i + j * n] + tmp[i + b * n]) / 3;
  }
}

export function createBodenAnpassung({ grundHoehe, zelle = 0.6, bucket = 32 } = {}) {
  if (typeof grundHoehe !== 'function') throw new Error('boden-anpassung: grundHoehe(x,z) fehlt');
  const fussabdruecke = [];
  const eimer = new Map();
  const schluessel = (bx, bz) => bx * 73856093 ^ bz * 19349663;

  /** Bilineare Abfrage eines Rasters; NaN außerhalb. */
  function lies(fa, feld, x, z) {
    const fx = (x - fa.x0) / zelle, fz = (z - fa.z0) / zelle;
    if (!(fx >= 0 && fz >= 0 && fx <= fa.n - 1 && fz <= fa.m - 1)) return NaN;
    const i = Math.min(fa.n - 2, fx | 0), j = Math.min(fa.m - 2, fz | 0), tx = fx - i, tz = fz - j, o = i + j * fa.n;
    const a = feld[o] + (feld[o + 1] - feld[o]) * tx, b = feld[o + fa.n] + (feld[o + fa.n + 1] - feld[o + fa.n]) * tx;
    return a + (b - a) * tz;
  }

  /**
   * Objekt eintragen. hoeheBei(lx, lz) im Objekt-Raum (vor Skala/Drehung), Höhe über dem Fuß, NaN = nichts.
   * Drehung um y wie THREE (Object3D.rotation.y). y = Fußhöhe (Standard: Grundgelände in der Mitte − einsinken).
   * → { y, wulstMax } ; null, wenn hoeheBei nirgends etwas meldet.
   */
  function fuegeFussabdruck({ x, z, y, drehung = 0, skala = 1, hoeheBei, radius, einbettung = 0.35, ueberdeckung = 0.12, boeschung = 0.55, maxWulst = 2.4, einsinken = 0.3, aoHang = 0.9, aoHoehe = 3 }) {
    if (typeof hoeheBei !== 'function' || !(radius > 0)) throw new Error('boden-anpassung: hoeheBei und radius nötig');
    const fussY = Number.isFinite(y) ? y : grundHoehe(x, z) - einsinken;
    const c = Math.cos(drehung), s = Math.sin(drehung);
    let rand = (maxWulst + 1) / boeschung + zelle * 3;
    for (let versuch = 0; versuch < 5; versuch++) {
      const halb = radius + rand, n = Math.ceil((2 * halb) / zelle) + 1, x0 = x - halb, z0 = z - halb;
      const f = new Float32Array(n * n).fill(NICHTS), a = new Float32Array(n * n).fill(NICHTS);
      const ziel = new Float32Array(n * n).fill(NICHTS);
      let treffer = 0, wulstMax = 0;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const dx = x0 + i * zelle - x, dz = z0 + j * zelle - z;
        if (dx * dx + dz * dz > radius * radius) continue;
        const r = hoeheBei((dx * c - dz * s) / skala, (dx * s + dz * c) / skala);   // Welt → Objekt (inverse Drehung)
        if (!(r >= 0)) continue;
        const w = Math.min(r * skala * einbettung + ueberdeckung, maxWulst);
        f[i + j * n] = ziel[i + j * n] = fussY + w; a[i + j * n] = fussY + r * skala;
        if (w > wulstMax) wulstMax = w;
        treffer++;
      }
      if (!treffer) return null;
      dilatiere(f, n, n, boeschung * zelle);
      dilatiere(a, n, n, aoHang * zelle);
      const tmp = new Float32Array(n * n);
      glaette(f, n, n, tmp); glaette(f, n, n, tmp);
      for (let o = 0; o < n * n; o++) if (ziel[o] > f[o]) f[o] = ziel[o];   // unter dem Objekt nie tiefer als das Ziel (dünne Wurzelspitzen)
      // Rand prüfen: dort muss der Wulst unter dem Grundgelände liegen, sonst entstünde eine Kante
      let ok = true;
      for (let k = 0; k < n && ok; k += 2) {
        for (const [i, j] of [[k, 0], [k, n - 1], [0, k], [n - 1, k]]) {
          if (f[i + j * n] > grundHoehe(x0 + i * zelle, z0 + j * zelle) - 0.05) { ok = false; break; }
        }
      }
      if (ok || versuch === 4) {
        const fa = { x, z, y: fussY, x0, z0, n, m: n, f, a, aoHoehe, halb, wulstMax };
        fussabdruecke.push(fa);
        const b0x = Math.floor(x0 / bucket), b1x = Math.floor((x0 + (n - 1) * zelle) / bucket);
        const b0z = Math.floor(z0 / bucket), b1z = Math.floor((z0 + (n - 1) * zelle) / bucket);
        for (let bz = b0z; bz <= b1z; bz++) for (let bx = b0x; bx <= b1x; bx++) {
          const k = schluessel(bx, bz);
          let l = eimer.get(k); if (!l) eimer.set(k, (l = []));
          l.push(fa);
        }
        return { y: fussY, wulstMax };
      }
      rand *= 1.7;
    }
    return null;
  }

  const kandidaten = (x, z) => eimer.get(schluessel(Math.floor(x / bucket), Math.floor(z / bucket)));

  /** Angepasste Bodenhöhe: Grundgelände, weich angehoben zu den Fußabdrücken. */
  function hoehe(x, z) {
    let h = grundHoehe(x, z);
    const l = kandidaten(x, z);
    if (l) for (const fa of l) { const w = lies(fa, fa.f, x, z); if (w > h - 0.6) h = smax(h, w, 0.6); }
    return h;
  }

  /** Verdeckung 0..1 (1 = dicht am hohen Objektfuß) – für Vertexfarben/AO. */
  function verdeckung(x, z) {
    const l = kandidaten(x, z);
    if (!l) return 0;
    const h = hoehe(x, z);
    let v = 0;
    for (const fa of l) {
      const w = lies(fa, fa.a, x, z);
      if (w > h) v = Math.max(v, Math.min(1, (w - h) / fa.aoHoehe));
    }
    return v;
  }

  return {
    fuegeFussabdruck, hoehe, verdeckung, grund: grundHoehe, fussabdruecke,
    dispose() { fussabdruecke.length = 0; eimer.clear(); },
  };
}
