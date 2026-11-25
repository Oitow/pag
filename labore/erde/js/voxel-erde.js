// Voxel-Nahzone der Erde: Graben in alle Richtungen (Gruben, Tunnel), Stoff je Voxel aus den Bodenschichten.
// Vertrag: docs/plaene/ERDE-FUNDAMENT.md. Kern: engine/world/voxel-kugel.js (Worker-tauglich, ohne THREE).
// - createVoxelBauer(planet): im Worker (oder Hauptthread) → baue({ key, ops }) → Chunk-Daten + Netz mit Farben
// - createVoxelErde(...):     im Hauptthread → Eingriffe, Chunks laden/entladen, Meshes, Loch-Maske, Kollision, Zielstrahl
// Voxel gibt es nur in Säulen (16 × 16 m), in denen gegraben wurde; dort wird das Höhenfeld ausgeschnitten.
import { createVoxelKugel } from '../../../engine/world/voxel-kugel.js';
import { schichten, STOFFE } from './boden.js';
import { biom } from './klima.js';
import { GESTEIN_FARBE } from './geologie.js';

export const VOXEL_STOFFE = Object.keys(STOFFE);
export const stoffId = (name) => VOXEL_STOFFE.indexOf(name) + 1;
export const stoffName = (id) => VOXEL_STOFFE[id - 1] ?? null;
const GESTEIN_NR = { sandstein: 0, kalkstein: 1, granit: 2, schiefer: 3, basalt: 4 };
const FUND_FARBE = { kohle: [0.1, 0.1, 0.1], eisenerz: [0.55, 0.32, 0.22], kupfererz: [0.35, 0.55, 0.45], gold: [0.85, 0.7, 0.25], salz: [0.9, 0.88, 0.85], quarz: [0.85, 0.85, 0.9] };
/** Farbe eines Stoffs (linear 0…1). */
export function stoffFarbe(name) {
  const s = STOFFE[name];
  if (!s) return [0.4, 0.35, 0.3];
  if (s.farbe) return s.farbe;
  if (name in GESTEIN_NR) return GESTEIN_FARBE[GESTEIN_NR[name]];
  return FUND_FARBE[name] ?? [0.5, 0.48, 0.45];
}
const glatt = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Voxel-Kugel mit Planetenhöhe und Bodenschichten (gleich in Worker und Hauptthread). */
function voxelKugelFuer(planet) {
  const R = planet.radius, e = 2 / R;
  return createVoxelKugel({
    radius: R,
    saeule(dx, dy, dz) {
      const pr = planet.probe(dx, dy, dz, 0.5);
      // Hangneigung aus einer Nachbarprobe (wie aktionen.steilAm) → am Steilhang dünner Boden
      const a = Math.abs(dy) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      let tx = dy * a[2] - dz * a[1], ty = dz * a[0] - dx * a[2], tz = dx * a[1] - dy * a[0];
      const tl = Math.hypot(tx, ty, tz); tx /= tl; ty /= tl; tz /= tl;
      const qx = dx + tx * e, qy = dy + ty * e, qz = dz + tz * e, ql = Math.hypot(qx, qy, qz);
      const steil = Math.abs(planet.probe(qx / ql, qy / ql, qz / ql, 0.5).h - pr.h) / 2;
      const sch = schichten(pr, biom(pr.temp, pr.feuchte), steil);
      const bis = new Float32Array(sch.length), ids = new Uint8Array(sch.length);
      let t = 0;
      sch.forEach((x, i) => { t += x.dicke; bis[i] = t; ids[i] = stoffId(x.stoff); });
      return { h: pr.h, bis, ids };
    },
    stoff(s, tiefe) {
      for (let i = 0; i < s.bis.length; i++) if (tiefe < s.bis[i]) return s.ids[i];
      return s.ids[s.ids.length - 1];
    },
  });
}

/** Worker-Seite. */
export function createVoxelBauer(planet) {
  const vk = voxelKugelFuer(planet), R = planet.radius;
  const ff = [0, 0, 0];
  function baue({ key, ops }) {
    const t0 = performance.now();
    const D = vk.erzeuge(key, ops), N = vk.netz(D, { rand: true });
    const nv = N.pos.length / 3, col = new Uint8Array(nv * 3), nass = new Uint8Array(nv);
    const [ox, oy, oz] = N.ursprung;
    for (let v = 0; v < nv; v++) {
      const x = ox + N.pos[v * 3], y = oy + N.pos[v * 3 + 1], z = oz + N.pos[v * 3 + 2], l = Math.hypot(x, y, z);
      const dx = x / l, dy = y / l, dz = z / l;
      const tiefe = N.tiefe[v], name = stoffName(N.stoff[v]), st = stoffFarbe(name);
      let r = st[0], g = st[1], b = st[2];
      if (STOFFE[name]?.gestein) {   // Gesteinsbänke: waagrechte Lagen (~1,4 m), leicht wellig – sieht man in jeder Grubenwand
        const hoch = l - R, welle = 0.6 * Math.sin(dx * R / 37 + dz * R / 41) + 0.4 * Math.sin(dy * R / 29 - dx * R / 53);
        const bank = 0.5 + 0.5 * Math.sin(hoch * 4.5 + welle * 1.8), fein = 0.5 + 0.5 * Math.sin(hoch * 17 + welle * 3);
        const k = 0.78 + 0.32 * bank + 0.08 * fein;
        r *= k; g *= k * (0.98 + 0.04 * bank); b *= k * (0.96 + 0.06 * (1 - bank));
      }
      if (tiefe < 0.6) {   // an der alten Oberfläche: dieselbe Farbe wie das Höhenfeld (Gras, Sand …)
        const pr = { ...planet.probe(dx, dy, dz, 0.5) };
        pr.wasser = -Infinity;
        const flach = N.nor[v * 3] * dx + N.nor[v * 3 + 1] * dy + N.nor[v * 3 + 2] * dz;
        planet.farbe(dx, dy, dz, pr, Math.max(0, flach), ff);
        const w = glatt(0.12, 0.6, tiefe) * (1 - glatt(0.6, 0.9, flach) * (tiefe < 0.25 ? 1 : 0));
        r = ff[0] + (r - ff[0]) * w; g = ff[1] + (g - ff[1]) * w; b = ff[2] + (b - ff[2]) * w;
      }
      const dunkel = 1 - 0.3 * glatt(2, 10, tiefe);   // tief im Berg etwas dunkler (wenig Streulicht)
      col[v * 3] = Math.min(255, r * dunkel * 255); col[v * 3 + 1] = Math.min(255, g * dunkel * 255); col[v * 3 + 2] = Math.min(255, b * dunkel * 255);
    }
    return {
      typ: 'voxel', key, ms: performance.now() - t0,
      dichte: D.dichte, stoff: D.stoff, hMin: D.hMin, hMax: D.hMax,
      pos: N.pos, nor: N.nor, col, nass, index: N.index, ursprung: N.ursprung,
    };
  }
  return { baue, vk };
}
export const voxelTransfer = (r) => [r.dichte.buffer, r.stoff.buffer, r.pos.buffer, r.nor.buffer, r.col.buffer, r.nass.buffer, r.index.buffer];

export const LOCH_MAX = 12;          // so viele Säulen schneidet der Bodenshader höchstens aus
const LADEN = 170, ENTLADEN = 230;   // m: Chunks um die Kamera halten

/**
 * Hauptthread. THREE, gruppe (Object3D für die Meshes), material (Boden-Material mit define VOXEL),
 * sende(job) → false wenn kein Worker (dann baut der Hauptthread), zustand = gespeicherte Ops.
 */
export function createVoxelErde({ THREE, planet, gruppe, material, sende = () => false, zustand = null }) {
  const R = planet.radius;
  const bauer = createVoxelBauer(planet), vk = bauer.vk, Z = vk.zelle, CH = vk.n * Z;
  const ops = (zustand?.ops ?? []).map((o) => ({ ...o }));
  const opsJe = new Map();        // chunkKey → [op-Index]
  const chunks = new Map();       // chunkKey → { D?, mesh?, laeuft, alt (braucht Neubau), urs }
  const saeulen = new Map();      // f:ci:cj → { hMin, hMax, bereit, mitte:[x,y,z], a:[..], b:[..] }
  const warte = [];               // Hauptthread-Bauaufträge (ohne Worker)
  const loch = { M: [], A: [], B: [], n: { value: 0 } };
  for (let i = 0; i < LOCH_MAX; i++) { loch.M.push(new THREE.Vector4()); loch.A.push(new THREE.Vector4()); loch.B.push(new THREE.Vector4()); }
  const uniforms = { uLochM: { value: loch.M }, uLochA: { value: loch.A }, uLochB: { value: loch.B }, uLochN: loch.n };
  let version = 0;

  const saeuleVon = (key) => { const [f, ci, cj] = vk.zerlege(key); return `${f}:${ci}:${cj}`; };
  function einordnen(i) {
    for (const k of vk.chunksFuerOp(ops[i])) {
      if (!opsJe.has(k)) opsJe.set(k, []);
      opsJe.get(k).push(i);
      const c = chunks.get(k);
      if (c) c.alt = true; else chunks.set(k, { alt: true, laeuft: false, sk: saeuleVon(k) });
      const sk = saeuleVon(k);
      if (!saeulen.has(sk)) saeulen.set(sk, neueSaeule(sk));
    }
  }
  function neueSaeule(sk) {
    const [f, ci, cj] = sk.split(':').map(Number), n = vk.n;
    const m = vk.punkt(f, ci * n + n / 2, cj * n + n / 2, 0), a = vk.punkt(f, ci * n + n, cj * n + n / 2, 0), b = vk.punkt(f, ci * n + n / 2, cj * n + n, 0);
    const ach = (p) => { const v = [p[0] - m[0], p[1] - m[1], p[2] - m[2]], l = Math.hypot(...v); return v.map((x) => x / l); };
    return { f, ci, cj, hMin: null, hMax: null, bereit: false, mitte: m, a: ach(a), b: ach(b), halb: CH / 2 };
  }
  ops.forEach((_, i) => einordnen(i));

  /** Alle Chunks, die eine Säule braucht, damit ihre Oberfläche ganz aus Voxeln besteht. */
  function oberflaechenChunks(s) {
    const lo = Math.floor((s.hMin - 1.5) / CH), hi = Math.floor((s.hMax + 1.5) / CH), keys = [];
    for (let ck = lo; ck <= hi; ck++) keys.push(vk.schluessel(s.f, s.ci, s.cj, ck));
    return keys;
  }

  function auftrag(key, c) {
    c.laeuft = true; c.alt = false;
    const job = { art: 'voxel', key, ops: (opsJe.get(key) ?? []).map((i) => ops[i]) };
    if (!sende(job)) warte.push(job);
  }

  function fertig(r) {
    const c = chunks.get(r.key);
    if (!c) return;
    c.laeuft = false;
    c.D = { ...vk_D(r) };
    c.urs = r.ursprung;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(r.pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(r.nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(r.col, 3, true));
    geo.setAttribute('land', new THREE.BufferAttribute(r.col, 3, true));
    geo.setAttribute('nass', new THREE.BufferAttribute(r.nass, 1, true));
    geo.setIndex(new THREE.BufferAttribute(r.index, 1));
    geo.computeBoundingSphere();
    if (c.mesh) { gruppe.remove(c.mesh); c.mesh.geometry.dispose(); }
    c.mesh = new THREE.Mesh(geo, material);
    c.mesh.castShadow = true; c.mesh.receiveShadow = true;
    c.mesh.visible = false;
    gruppe.add(c.mesh);
    const sk = saeuleVon(r.key), s = saeulen.get(sk) ?? neueSaeule(sk);
    saeulen.set(sk, s);
    if (s.hMin === null) {
      s.hMin = r.hMin; s.hMax = r.hMax;
      s.oben = oberflaechenChunks(s);
      for (const k of s.oben) if (!chunks.has(k)) chunks.set(k, { alt: true, laeuft: false, sk });
    }
    version++;
  }
  // Chunk-Daten so, wie voxel-kugel sie für dichteAn/stoffAn braucht
  function vk_D(r) {
    const [f, ci, cj, ck] = vk.zerlege(r.key), n = vk.n;
    return { key: r.key, f, ci, cj, ck, i0: ci * n - 2, j0: cj * n - 2, k0: ck * n - 2, dichte: r.dichte, stoff: r.stoff, hMin: r.hMin, hMax: r.hMax };
  }

  /** Je Bild: laden/entladen, Meshes an die Kamera rücken, Säulen bereit schalten, Loch-Maske füllen. */
  function update(cam) {
    // Hauptthread-Bau (ohne Worker)
    // ein Auftrag je Bild (ein Chunk dauert schon einige ms); ein kaputter Chunk friert das Spiel nicht ein
    if (warte.length) {
      const job = warte.shift();
      try { fertig(bauer.baue(job)); } catch (e) { const c = chunks.get(job.key); if (c) { c.laeuft = false; c.alt = false; } console.warn('Voxel-Chunk', job.key, e); }
    }
    for (const [key, c] of chunks) {
      if (!c.urs) { const [f, ci, cj, ck] = vk.zerlege(key), n = vk.n; c.urs = vk.punkt(f, ci * n + n / 2, cj * n + n / 2, ck * n + n / 2); }
      const ab = Math.hypot(c.urs[0] - cam.x, c.urs[1] - cam.y, c.urs[2] - cam.z);
      if (ab > ENTLADEN && c.D && !c.laeuft) { if (c.mesh) { gruppe.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh = null; } c.D = null; c.alt = true; continue; }
      if (ab < LADEN && c.alt && !c.laeuft) auftrag(key, c);
      if (c.mesh) c.mesh.position.set(c.urs[0] - cam.x, c.urs[1] - cam.y, c.urs[2] - cam.z);
    }
    // Säule bereit = alle Oberflächen-Chunks haben Daten → Höhenfeld aus, Voxel an
    // nur die LOCH_MAX nächsten fertigen Säulen werden Voxel (sonst gäbe es Voxel ohne Loch im Höhenfeld)
    const liste = [];
    for (const s of saeulen.values()) {
      const ab = Math.hypot(s.mitte[0] - cam.x, s.mitte[1] - cam.y, s.mitte[2] - cam.z);
      let fertig = s.oben && ab < ENTLADEN;
      if (fertig) for (const k of s.oben) { if (!chunks.get(k)?.D) { fertig = false; break; } }
      if (fertig) liste.push([ab, s]); else if (s.bereit) { s.bereit = false; version++; }
    }
    liste.sort((x, y) => x[0] - y[0]);
    liste.forEach(([, s], i) => { const b = i < LOCH_MAX; if (b !== s.bereit) { s.bereit = b; version++; } });
    for (const c of chunks.values()) if (c.mesh) c.mesh.visible = !!saeulen.get(c.sk)?.bereit;
    const anz = Math.min(LOCH_MAX, liste.length);
    for (let i = 0; i < anz; i++) {
      const s = liste[i][1], h = s.halb + 0.4 * Z;   // etwas größer als die Säule: der Voxel-Rand (+1 Zelle) deckt die Kante
      const k = (R + (s.hMin + s.hMax) / 2) / R;   // Mitte auf Höhe der Oberfläche (die Maske prüft ±60 m um diesen Punkt)
      loch.M[i].set(s.mitte[0] * k - cam.x, s.mitte[1] * k - cam.y, s.mitte[2] * k - cam.z, 1);
      loch.A[i].set(s.a[0] / h, s.a[1] / h, s.a[2] / h, 0);
      loch.B[i].set(s.b[0] / h, s.b[1] / h, s.b[2] / h, 0);
    }
    loch.n.value = anz;
  }

  // ---------- Abfragen (Kollision, Zielen) ----------
  function saeuleAn(x, y, z) {
    const g = vk.zelleVon(x, y, z), s = saeulen.get(`${g.f}:${Math.floor(g.i / vk.n)}:${Math.floor(g.j / vk.n)}`);
    return s?.bereit ? s : null;
  }
  /** Fest an diesem Punkt? null = keine Voxel-Säule (→ Höhenfeld fragen). */
  function fest(x, y, z) {
    const s = saeuleAn(x, y, z);
    if (!s) return null;
    const c = chunks.get(vk.chunkVon(x, y, z));
    if (c?.D) { const d = vk.dichteAn(c.D, x, y, z); if (!Number.isNaN(d)) return d > 0; }
    const h = Math.hypot(x, y, z) - R;   // kein Chunk hier: über/unter der Oberfläche ohne Eingriff
    if (h > s.hMax + 0.5) return false;
    if (h < s.hMin - 0.5) return true;
    const l = h + R;
    return h < planet.probe(x / l, y / l, z / l, 0.5).h;
  }
  /** Boden unter den Füßen (m über R) in einer Voxel-Säule, sonst null. Sucht ab Kniehöhe abwärts. */
  function boden(pos, auge) {
    const l = pos.length(), ox = pos.x / l, oy = pos.y / l, oz = pos.z / l;
    if (!saeuleAn(pos.x, pos.y, pos.z)) return null;
    const r0 = l - auge + 0.55;
    const an = (r) => fest(ox * r, oy * r, oz * r);
    if (an(r0)) return r0 - R;
    for (let r = r0 - 0.1; r > r0 - 40; r -= 0.1) {
      if (an(r)) {   // genauer: halbieren zwischen Luft (r + 0.1) und fest (r)
        let lo = r, hi = r + 0.1;
        for (let i = 0; i < 6; i++) { const m = (lo + hi) / 2; if (an(m)) lo = m; else hi = m; }
        return lo - R;
      }
    }
    return null;
  }
  /** Wände/Decke: Spieler waagerecht aus festem Stoff schieben. → { decke } */
  const t = new THREE.Vector3(), g = new THREE.Vector3(), q = new THREE.Vector3();
  function schiebe(pos, oben, auge) {
    if (!saeuleAn(pos.x, pos.y, pos.z)) return { decke: false };
    let decke = false;
    for (const hh of [0.7, 1.3, auge + 0.15]) {
      for (let it = 0; it < 4; it++) {
        q.copy(pos).addScaledVector(oben, hh - auge);
        if (!fest(q.x, q.y, q.z)) break;
        if (hh > auge) decke = true;
        // waagerechter Gradient (Richtung in die Luft) aus 4 Proben
        g.set(0, 0, 0);
        t.copy(oben).cross(Math.abs(oben.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
        const u = t.clone().cross(oben).normalize();
        for (const [ax, sg] of [[t, 1], [t, -1], [u, 1], [u, -1]]) {
          const p = q.clone().addScaledVector(ax, 0.35 * sg);
          if (!fest(p.x, p.y, p.z)) g.addScaledVector(ax, sg);
        }
        if (g.lengthSq() < 1e-6) break;   // ringsum fest: nicht schieben (Boden-Suche hebt an)
        pos.addScaledVector(g.normalize(), 0.12);
      }
    }
    return { decke };
  }
  /** Zielstrahl: erster feste Punkt (Voxel wo vorhanden, sonst Höhenfeld). → { p, voxel } | null */
  function strahl(o, d, max = 7) {
    const p = new THREE.Vector3();
    let vorher = o.clone();
    for (let s = 0.3; s <= max; s += 0.08) {
      p.copy(o).addScaledVector(d, s);
      let f = fest(p.x, p.y, p.z), voxel = true;
      if (f === null) {
        voxel = false;
        const l = p.length(), pr = planet.probe(p.x / l, p.y / l, p.z / l, 0.5);
        f = l - R <= Math.max(pr.h, pr.wasser);
      }
      if (f) return { p: voxel ? vorher.clone().lerp(p, 0.5) : p.clone(), voxel };
      vorher = p.clone();
    }
    return null;
  }
  /** Stoff knapp hinter einem Zielpunkt in Blickrichtung (null = keine Voxel-Daten). */
  function stoffAm(p, d) {
    const x = p.x + d.x * 0.3, y = p.y + d.y * 0.3, z = p.z + d.z * 0.3;
    if (!saeuleAn(x, y, z)) return null;
    const c = chunks.get(vk.chunkVon(x, y, z));
    return c?.D ? stoffName(vk.stoffAn(c.D, x, y, z)) : null;
  }

  /** Eingriff: typ 'weg' (graben) | 'fest' (aufschütten, stoff = Name). */
  function eingriff(typ, p, r, stoff = null) {
    const op = { typ, x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3), r };
    if (stoff) op.stoff = stoffId(stoff);
    ops.push(op);
    einordnen(ops.length - 1);
    return op;
  }
  /** Wie tief liegt p unter der ursprünglichen Oberfläche (m)? */
  function tiefe(p) {
    const l = p.length(), pr = planet.probe(p.x / l, p.y / l, p.z / l, 0.5);
    return Math.max(0, pr.h - (l - R));
  }

  return {
    uniforms, update, fertig,
    /** Worker abgestürzt: laufende Aufträge neu vergeben. */
    verloren() { for (const c of chunks.values()) if (c.laeuft) { c.laeuft = false; c.alt = true; } }, fest, boden, schiebe, strahl, stoffAm, eingriff, tiefe,
    get version() { return version; },
    info: () => ({ ops: ops.length, chunks: [...chunks.values()].filter((c) => c.D).length, saeulen: [...saeulen.values()].filter((s) => s.bereit).length }),
    zustand: () => ({ ops }),
  };
}
