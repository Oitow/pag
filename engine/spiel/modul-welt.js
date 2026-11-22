/**
 * @modul    modul-welt
 * @zweck    Erlenwacht-Welt (≈4×4 km): Karte/Regionen/Orte/Wege aus world/welt-regionen, Gelände als gestreamte Kacheln mit Detailstufen (world/chunk-strom), Streu-Bäume/Felsen/Büsche je Kachel als Instanzen samt Kollision, Meer und Moortümpel – rund um den Dienst `fokus`
 * @api      WELT_MODUL -> api wie im Vertrag (docs/ERLENWACHT-MODULE.md) + karte, statistik
 * @beispiel
 *   import { WELT_MODUL } from '../../engine/spiel/modul-welt.js';
 *   const welt = spiel.api('welt'); welt.bodenHoehe(0, 600); welt.region(-1200, 400).id; // 'moor'
 *   // Optionen: kachelSegmente, streuWeite, kleinWeite, teilung, budget · Debug-Kamera: ?weltblick=gipfel oder ?weltblick=x,z,hoehe,yaw,pitch
 * @tags     spiel, modul, welt, gelaende, streaming, lod, regionen, wege, wasser, erlenwacht, mmo
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { createKollisionsWelt } from '../world/kollision.js';
import { createWeltRegionen, MOOR_WASSER } from '../world/welt-regionen.js';
import { createChunkStrom, createKachelRing } from '../world/chunk-strom.js';
import { streuKachel } from '../world/welt-streu.js';
import { srgbZuLinear } from '../world/terrain-farben.js';
import { createAssetCache } from '../models/natur/natur-assets.js';
import { createNaturMaterial } from '../render/natur-material.js';
import { createWasserGlanz } from '../world/wasser-glanz.js';

let aktiv = null;   // laufende Instanz (der Modul-Kern ruft dispose ohne ctx)
const SCHATTEN_TYPEN = new Set(['eiche', 'buche', 'birke', 'weide', 'tanne', 'fichte', 'kiefer', 'toterBaum', 'findling', 'felsbrocken']);

/** Gelände-Kachel: (N+1)² Punkte + Schürzen an allen vier Rändern (verdeckt Risse zwischen Detailstufen). */
function baueKachelGeo(karte, k, N) {
  const g = k.groesse, s = g / N, M = N + 3;   // Höhenraster mit 1 Punkt Rand für Normalen
  const H = new Float32Array(M * M);
  let min = Infinity, max = -Infinity;
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    const h = karte.hoehe(k.x0 + (i - 1) * s, k.z0 + (j - 1) * s); H[j * M + i] = h;
    if (h < min) min = h; if (h > max) max = h;
  }
  if (max < -5) return null;   // ganz unter dem Meer: nichts zeichnen
  const P = N + 1, rand = 4 * N, anzahl = P * P + rand + 4;
  const pos = new Float32Array(anzahl * 3), nor = new Float32Array(anzahl * 3), col = new Float32Array(anzahl * 3), c3 = [0, 0, 0];
  for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) {
    const m = (j + 1) * M + i + 1, v = (j * P + i) * 3;
    const nx = H[m - 1] - H[m + 1], nz = H[m - M] - H[m + M], ny = 2 * s, l = Math.hypot(nx, ny, nz);
    pos[v] = i * s; pos[v + 1] = H[m]; pos[v + 2] = j * s;
    nor[v] = nx / l; nor[v + 1] = ny / l; nor[v + 2] = nz / l;
    karte.farbe(k.x0 + i * s, k.z0 + j * s, H[m], 1 - ny / l, c3);
    col[v] = srgbZuLinear(Math.min(1, c3[0])); col[v + 1] = srgbZuLinear(Math.min(1, c3[1])); col[v + 2] = srgbZuLinear(Math.min(1, c3[2]));
  }
  const idx = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * P + i, b = a + 1, c = a + P, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  // Schürze: Randring (gegen den Uhrzeigersinn), jede Randkante bekommt eine abgesenkte Kopie
  const ring = [];
  for (let i = 0; i < N; i++) ring.push(i);
  for (let j = 0; j < N; j++) ring.push(j * P + N);
  for (let i = N; i > 0; i--) ring.push(N * P + i);
  for (let j = N; j > 0; j--) ring.push(j * P);
  const tief = s * 1.5 + 1.5;
  ring.forEach((q, r) => {
    const v = (P * P + r) * 3;
    pos[v] = pos[q * 3]; pos[v + 1] = pos[q * 3 + 1] - tief; pos[v + 2] = pos[q * 3 + 2];
    for (let c = 0; c < 3; c++) { nor[v + c] = nor[q * 3 + c]; col[v + c] = col[q * 3 + c]; }
  });
  for (let r = 0; r < ring.length; r++) {
    const a = ring[r], b = ring[(r + 1) % ring.length], a2 = P * P + r, b2 = P * P + (r + 1) % ring.length;
    idx.push(a, b, a2, b, b2, a2, a, a2, b, b, a2, b2);   // beidseitig, damit die Wickelrichtung egal ist
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(anzahl > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

export const WELT_MODUL = {
  name: 'welt', braucht: ['render'],
  standard: { kachelSegmente: null, streuWeite: null, kleinWeite: null, teilung: 0.6, budget: 1 },
  start(ctx) {
    const render = ctx.braucht('render');
    const { szene, kamera, stufe, url } = render;
    const opt = ctx.optionen || {};
    const niedrig = stufe.name === 'niedrig';
    const karte = createWeltRegionen({ seed: ctx.seed });
    const sicht = stufe.sicht, weite = Math.max(sicht * 1.6, 700);   // Fern-Gelände etwas über die Sichtweite (Dunst verdeckt den Rand)
    const N = opt.kachelSegmente || (niedrig ? 24 : 32);
    const streuWeite = opt.streuWeite || (niedrig ? 110 : stufe.name === 'hoch' ? 200 : 150);
    const kleinWeite = opt.kleinWeite || (niedrig ? 40 : 60);
    const dichte = Math.min(1.2, Math.max(0.5, stufe.dichte));
    const gruppe = new THREE.Group(); gruppe.name = 'welt'; szene.add(gruppe);
    const sperren = [];
    const kollision = createKollisionsWelt({ welt: { bodenHoehe: karte.hoehe, wasserHoehe: (x, z) => karte.wasserHoehe(x, z), hindernisse: () => null } });
    const zuhoerer = new Set();
    const melde = (d) => { for (const f of zuhoerer) f(d); };

    // --- Gelände ---
    const bodenMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    let aufbauMs = 0;
    const strom = createChunkStrom({
      wurzel: 512, blatt: 64, teilung: opt.teilung ?? 0.6, sicht: weite, budget: opt.budget ?? 1,
      baue(k) {
        const t0 = performance.now();
        const geo = baueKachelGeo(karte, k, N);
        aufbauMs += performance.now() - t0;
        if (!geo) return null;
        const m = new THREE.Mesh(geo, bodenMat);
        m.position.set(k.x0, 0, k.z0); m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix();
        m.name = 'kachel ' + k.key; gruppe.add(m);
        return m;
      },
      entferne(k, m) { if (m) { gruppe.remove(m); m.geometry.dispose(); } },
    });

    // --- Wasser: Meer folgt dem Fokus, Moortümpel als eine Fläche über dem Moor ---
    const meerMat = new THREE.MeshStandardMaterial({ color: 0x2b4850, roughness: 0.3, metalness: 0, transparent: true, opacity: 0.88 });
    const moorMat = new THREE.MeshStandardMaterial({ color: 0x3b4436, roughness: 0.35, metalness: 0, transparent: true, opacity: 0.85 });
    const meer = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), meerMat);
    meer.name = 'meer'; meer.renderOrder = 1; gruppe.add(meer);
    const mb = karte.moor;
    const moor = new THREE.Mesh(new THREE.PlaneGeometry(mb.x1 - mb.x0, mb.z1 - mb.z0).rotateX(-Math.PI / 2), moorMat);
    moor.position.set((mb.x0 + mb.x1) / 2, MOOR_WASSER, (mb.z0 + mb.z1) / 2); moor.name = 'moorwasser'; moor.renderOrder = 1; gruppe.add(moor);
    const glanz = createWasserGlanz([meerMat, moorMat]);

    // --- Streu ---
    const assets = createAssetCache({ varianten: 2, detail: niedrig ? 0 : 1, seed: ctx.seed });
    const infoCache = new Map();
    const info = (typ) => { if (!infoCache.has(typ)) { const a = assets.hat(typ) ? assets.holen(typ, 0) : null; infoCache.set(typ, a && { radius: a.radius, stammRadius: a.stammRadius, hoehe: a.hoehe }); } return infoCache.get(typ); };
    const frei = (x, z, r) => { for (const s of sperren) if ((x - s.x) ** 2 + (z - s.z) ** 2 < (s.r + r) ** 2) return false; return true; };
    const matGross = createNaturMaterial({ wind: true }), matKlein = createNaturMaterial({ wind: true, weite: kleinWeite });
    const pools = new Map();   // typ#v → { im, cap }
    let streuNeu = true, streuAnzahl = 0;
    const ladeStreu = (art) => (k) => {
      const objs = streuKachel(karte, k, { art, seed: ctx.seed, dichte, frei, info });
      const ids = [];
      if (art === 'gross') for (const o of objs) if (o.r > 0.05) ids.push(kollision.fuege({ x: o.x, z: o.z, radius: o.r, y0: o.y - 0.2, hoehe: o.fels ? o.hoehe * 0.9 : Math.max(3, o.hoehe), begehbar: o.fels, daten: { art: o.baum ? 'baum' : 'fels', typ: o.typ } }));
      streuNeu = true;
      if (art === 'gross') melde({ cx: k.cx, cz: k.cz, groesse: k.groesse, geladen: true });
      return { objs, ids };
    };
    const entladeStreu = (art) => (k, e) => {
      for (const id of e.ids) kollision.entferne(id);
      streuNeu = true;
      if (art === 'gross') melde({ cx: k.cx, cz: k.cz, groesse: k.groesse, geladen: false });
    };
    const ringGross = createKachelRing({ groesse: 64, radius: streuWeite, budget: 2, lade: ladeStreu('gross'), entlade: entladeStreu('gross') });
    const ringKlein = createKachelRing({ groesse: 64, radius: kleinWeite, budget: 2, lade: ladeStreu('klein'), entlade: entladeStreu('klein') });
    function baueStreu() {
      const zaehl = new Map();
      for (const ring of [ringGross, ringKlein]) for (const e of ring.geladen.values()) for (const o of e.obj.objs) {
        const key = o.typ + '#' + o.v; zaehl.set(key, (zaehl.get(key) || 0) + 1);
      }
      for (const [key, p] of pools) if (!zaehl.has(key)) { p.im.count = 0; p.im.visible = false; }
      const fuell = new Map();
      for (const [key, n] of zaehl) {
        let p = pools.get(key);
        if (!p || p.cap < n) {
          if (p) { gruppe.remove(p.im); p.im.dispose(); }
          const [typ, v] = key.split('#');
          if (!assets.hat(typ)) continue;
          const klein = !SCHATTEN_TYPEN.has(typ) && !['fels', 'felsplatte', 'liegenderStamm', 'baumstumpf'].includes(typ);
          const cap = Math.ceil(n * 1.5) + 16;
          const im = new THREE.InstancedMesh(assets.holen(typ, +v).geometrie, klein ? matKlein : matGross, cap);
          im.name = 'streu ' + key; im.frustumCulled = false; im.receiveShadow = true;
          im.castShadow = SCHATTEN_TYPEN.has(typ); if (im.castShadow) im.customDepthMaterial = matGross.tiefenMaterial;
          gruppe.add(im); pools.set(key, p = { im, cap });
        }
        fuell.set(key, 0);
      }
      streuAnzahl = 0;
      for (const ring of [ringGross, ringKlein]) for (const e of ring.geladen.values()) for (const o of e.obj.objs) {
        const key = o.typ + '#' + o.v, p = pools.get(key); if (!p) continue;
        const i = fuell.get(key), a = p.im.instanceMatrix.array, b = i * 16, c = Math.cos(o.rot) * o.s, sn = Math.sin(o.rot) * o.s;
        a[b] = c; a[b + 1] = 0; a[b + 2] = -sn; a[b + 3] = 0; a[b + 4] = 0; a[b + 5] = o.s; a[b + 6] = 0; a[b + 7] = 0;
        a[b + 8] = sn; a[b + 9] = 0; a[b + 10] = c; a[b + 11] = 0; a[b + 12] = o.x; a[b + 13] = o.y - 0.05; a[b + 14] = o.z; a[b + 15] = 1;
        fuell.set(key, i + 1); streuAnzahl++;
      }
      for (const [key, n] of fuell) { const im = pools.get(key).im; im.count = n; im.visible = n > 0; im.instanceMatrix.needsUpdate = true; }
      streuNeu = false;
    }

    // --- Fokus + Debug-Kamera ---
    const blick = parseBlick(url?.werte?.weltblick, karte);
    const fokus = () => {
      if (blick) return blick;
      const f = ctx.dienst('fokus');
      const p = typeof f === 'function' ? f() : null;
      return p && Number.isFinite(p.x) ? p : karte.startPunkt;
    };
    function stroemen(max) {
      const f = fokus();
      strom.update(f.x, f.z, max);
      ringGross.update(f.x, f.z, max === Infinity ? Infinity : 2);
      ringKlein.update(f.x, f.z, max === Infinity ? Infinity : 2);
      if (streuNeu) baueStreu();
      const s = Math.max(64, sicht / 8);
      meer.position.set(Math.round(f.x / s) * s, 0, Math.round(f.z / s) * s);
    }
    const t0 = performance.now();
    stroemen(Infinity);
    const startMs = performance.now() - t0;
    if (render.debug) console.info(`[welt] Aufbau ${startMs.toFixed(0)} ms (Gelände ${aufbauMs.toFixed(0)} ms), ${strom.anzahl} Kacheln, ${streuAnzahl} Streu`);

    const normale = (x, z) => {
      const e = 0.75, nx = karte.hoehe(x - e, z) - karte.hoehe(x + e, z), nz = karte.hoehe(x, z - e) - karte.hoehe(x, z + e), l = Math.hypot(nx, 2 * e, nz);
      return { x: nx / l, y: 2 * e / l, z: nz / l };
    };
    let zeit = 0;
    const api = {
      bodenHoehe: (x, z, y) => kollision.bodenHoehe(x, z, y),
      wasserHoehe: (x, z) => karte.wasserHoehe(x, z),
      hindernisse: (x, z, r, f) => kollision.hindernisse(x, z, r, f),
      kollision, karte,
      startPunkt: { ...karte.startPunkt }, groesse: { ...karte.groesse }, regionen: karte.regionen,
      region: (x, z) => karte.region(x, z), orte: karte.orte, ort: (id) => karte.orte.find((o) => o.id === id) || null,
      wege: karte.wege, abstandZumWeg: (x, z) => karte.abstandZumWeg(x, z), normale,
      flaecheFrei(x, z, r = 1) {
        const h = karte.hoehe(x, z);
        if (karte.wasserHoehe(x, z, h) !== null) return false;
        for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) if (Math.abs(karte.hoehe(x + dx, z + dz) - h) > r * 0.45 + 0.1) return false;
        return kollision.hindernisse(x, z, r) === null;
      },
      onChunk(fn) { zuhoerer.add(fn); return () => zuhoerer.delete(fn); },
      /** Keine Streu-Objekte im Kreis (Riesenbäume, Siedlung): betroffene Kacheln werden neu gesetzt. */
      sperreObjekte(x, z, r) {
        sperren.push({ x, z, r });
        const trifft = (k) => x + r > k.x0 && x - r < k.x0 + k.groesse && z + r > k.z0 && z - r < k.z0 + k.groesse;
        ringGross.neuLaden(trifft); ringKlein.neuLaden(trifft);
      },
      get statistik() { return { kacheln: strom.anzahl, streu: streuAnzahl, koerper: kollision.anzahl, startMs, aufbauMs }; },
    };

    // Debug-Kamera (?weltblick=gipfel oder ?weltblick=x,z,hoehe,yaw,pitch) – yaw wie Figuren: 0 = Blick nach Süden (+z)
    const setzeBlick = () => {
      kamera.position.set(blick.x, Math.max(0, karte.hoehe(blick.x, blick.z)) + blick.hoehe, blick.z);
      kamera.rotation.set(blick.pitch, blick.yaw + Math.PI, 0, 'YXZ');
    };
    if (blick) { setzeBlick(); render.vorBild.add(setzeBlick); }   // vor dem Bild: überstimmt die Spieler-Kamera
    aktiv = {
      update(dt) {
        zeit += dt;
        stroemen(undefined);
        matGross.update?.(zeit); matKlein.update?.(zeit); glanz.update(zeit);
      },
      dispose() {
        render.vorBild.delete(setzeBlick);
        strom.dispose(); ringGross.dispose(); ringKlein.dispose();
        for (const p of pools.values()) p.im.dispose();
        szene.remove(gruppe);
        meer.geometry.dispose(); moor.geometry.dispose(); meerMat.dispose(); moorMat.dispose(); bodenMat.dispose();
        matGross.dispose(); matKlein.dispose(); glanz.dispose(); assets.dispose(); kollision.dispose(); zuhoerer.clear();
      },
    };
    return api;
  },
  update(dt) { aktiv?.update(dt); },
  dispose() { aktiv?.dispose(); aktiv = null; },
};

function parseBlick(wert, karte) {
  if (!wert) return null;
  const o = karte.orte.find((q) => q.id === wert);
  if (o) return { x: o.x, z: o.z, hoehe: 1.7, yaw: o.blick ?? 0, pitch: -0.05 };
  const t = String(wert).split(',').map(Number);
  if (t.length < 2 || !t.every(Number.isFinite)) return null;
  return { x: t[0], z: t[1], hoehe: t[2] ?? 1.7, yaw: t[3] ?? 0, pitch: t[4] ?? -0.05 };
}
