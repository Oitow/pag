/**
 * @modul    worldgen-scatter
 * @zweck    Blue-Noise-Verteilung von Objekten (Bäume, Büsche, Felsen, Kakteen, Schilf, Blumen …) mit Dichte pro Biom, Lichtungen und Hangregeln; reihenfolgeunabhängig und dadurch nahtlos über Chunks
 * @api      STANDARD_OBJEKTE (Daten aus worldgen-vegetation) ; verteile(quelle, arten, opts, bereich) -> objekte ; weltQuelle(welt) -> quelle ; stufeObjekte(welt, opts) -> void
 * @beispiel
 *   import { stufeObjekte } from '../../engine/world/worldgen/worldgen-scatter.js';
 *   stufeObjekte(welt, opts);
 *   const o = welt.objekte;   // { anzahl, x, y, art, typ, skala, drehung, arten:[…], typen:[…] }
 *   for (let i = 0; i < o.anzahl; i++) if (o.arten[o.art[i]] === 'baum') pflanze(o.typen[o.typ[i]], o.x[i], o.y[i]);
 * @tags     welt, worldgen, objekte, baeume, verteilung, poisson, blue-noise
 * @version  1.1.0
 * @status   entwurf
 * @three    nein
 */
import { hash2, hashSeed } from '../../core/rng.js';
import { createNoise2D } from '../../core/noise.js';
import { smoothstep } from '../../core/math.js';
import { FLAG, WASSER } from './worldgen-grid.js';
import { STANDARD_OBJEKTE } from './worldgen-vegetation.js';

/** Standard-Objektarten (Daten in worldgen-vegetation.js, hier für bestehende Importe weiter exportiert). */
export { STANDARD_OBJEKTE };

/**
 * Quelle für eine fertige Welt: punkt(x,y,aus) füllt aus = [biom, hang, hoehe, wasserDist, flags, belegt, temperatur, feuchte, wasserspiegel]
 * (x,y in Zellen; die Felder ab 6 nur, wenn aus lang genug ist).
 */
export function weltQuelle(welt) {
  const { breite: b, tiefe: t } = welt;
  const belegt = new Uint8Array(b * t);
  const T = welt.temperatur, M = welt.feuchte, WS = welt.wasserstand;
  return {
    belegt,
    punkt(x, y, aus) {
      let ix = Math.round(x), iy = Math.round(y);
      if (ix < 0) ix = 0; else if (ix >= b) ix = b - 1;
      if (iy < 0) iy = 0; else if (iy >= t) iy = t - 1;
      const i = iy * b + ix;
      aus[0] = welt.biom[i]; aus[1] = welt.hang[i]; aus[2] = welt.hoehe[i];
      aus[3] = welt.wasserDistanz[i]; aus[4] = welt.flags[i]; aus[5] = belegt[i];
      if (aus.length > 8) { aus[6] = T ? T[i] : 0.5; aus[7] = M ? M[i] : 0.5; aus[8] = WS ? WS[i] : aus[2]; }
      return x >= 0 && y >= 0 && x <= b - 1 && y <= t - 1;
    },
    belege(x, y, r) {
      const R = Math.ceil(r), cx = Math.round(x), cy = Math.round(y);
      for (let yy = cy - R; yy <= cy + R; yy++) for (let xx = cx - R; xx <= cx + R; xx++) {
        if (xx < 0 || yy < 0 || xx >= b || yy >= t) continue;
        const dx = xx - x, dy = yy - y;
        if (dx * dx + dy * dy <= r * r + 0.25) belegt[yy * b + xx] = 1;
      }
    },
  };
}

// Bedingungen eines Typ-Eintrags: Feld → Index in info und Unschärfe (weiche Grenzen per Zufallsversatz)
const BED = [['hoehe', 2, 0.03], ['temp', 6, 0.04], ['feuchte', 7, 0.05], ['hang', 1, 0.008], ['wasserDist', 3, 1]];
const NB = BED.length;

/** Typ-Eintrag vereinheitlichen: { name, w, lo, hi (Float64 je Bedingung), skala }. */
function eintrag(e) {
  if (typeof e === 'string') return { name: e, w: 1, lo: null, hi: null, skala: null };
  const lo = new Float64Array(NB).fill(-1e9), hi = new Float64Array(NB).fill(1e9);
  let bed = false;
  BED.forEach(([k], j) => { if (e[k]) { lo[j] = e[k][0]; hi[j] = e[k][1]; bed = true; } });
  return { name: e.typ, w: e.w ?? 1, lo: bed ? lo : null, hi: bed ? hi : null, skala: e.skala || null };
}

/** Dichte-Tabelle und Typ-Einträge einer Art pro Biom-Id. */
function dichteArray(art, biome) {
  const d = new Float32Array(256), basis = art.dichte?._ ?? 0;
  const typIdx = new Array(256), cache = new Map(), alle = [];
  biome.forEach((bm, id) => {
    d[id] = art.dichte?.[bm.key] ?? basis;
    const liste = art.typen?.[bm.key] || art.typen?._ || [art.key];
    if (!cache.has(liste)) cache.set(liste, liste.map(e => { const n = eintrag(e); n.nr = alle.length; alle.push(n); return n; }));
    typIdx[id] = cache.get(liste);
  });
  return { d, typIdx, alle };
}

/** Gewichtete Typwahl mit weichen Bedingungen; null, wenn kein Eintrag passt. */
function waehleTyp(liste, info, wurfTyp, versatz) {
  let summe = 0;
  for (let k = 0; k < liste.length; k++) if (passt(liste[k], info, versatz)) summe += liste[k].w;
  if (summe <= 0) return null;
  let r = wurfTyp * summe;
  for (let k = 0; k < liste.length; k++) {
    const e = liste[k];
    if (!passt(e, info, versatz)) continue;
    r -= e.w;
    if (r < 0) return e;
  }
  return liste[liste.length - 1];
}
function passt(e, info, v) {
  if (!e.lo) return true;
  for (let j = 0; j < NB; j++) {
    const x = info[BED[j][1]] + v * BED[j][2];
    if (x < e.lo[j] || x > e.hi[j]) return false;
  }
  return true;
}

/**
 * Verteilt Objekte im Bereich {x0,y0,x1,y1} (Zellen, x1/y1 exklusiv). Das Ergebnis hängt nur von Seed und Position ab
 * (nicht von der Reihenfolge) → Chunks passen nahtlos. opts: { seed, dichte (Faktor), artDichte {key: Faktor}, massstab, biome, zelle, waldArt ('baum') }
 * Arten-Felder siehe worldgen-vegetation.js (unterWald, rand, hangFuss, wasser/tiefe, skala, gewichtete Typen mit Bedingungen).
 */
export function verteile(quelle, arten, opts, bereich) {
  const seed = opts.seed ?? 1, faktor = opts.dichte ?? 1, zelle = opts.zelle ?? 1;
  const s = 1 / (opts.massstab || 256);
  const biome = opts.biome;
  const typen = [], typNr = new Map();
  const ox = [], oy = [], oart = [], otyp = [], oskala = [], odreh = [];
  const info = new Float64Array(9), nb = new Float64Array(9);
  const nCl = createNoise2D(hashSeed(seed, 'lichtung'));
  const clusterBei = (cl, a, x, y) => smoothstep(cl.schwelle, cl.schwelle + cl.weich, nCl(x * s * cl.frequenz + a * 31.7, y * s * cl.frequenz - a * 17.3));

  // Kronendach-Wert (0..1) aus Baumdichte des Bioms × Lichtungsrauschen der Baumart – reine Funktion von Ort und Punktinfo
  const wA = arten.findIndex(a => a.key === (opts.waldArt ?? 'baum'));
  let waldD = null, waldCl = null;
  if (wA >= 0) {
    waldD = dichteArray(arten[wA], biome).d;
    let m = 0; for (let i = 0; i < 256; i++) if (waldD[i] > m) m = waldD[i];
    if (m > 0) for (let i = 0; i < 256; i++) waldD[i] /= m; else waldD = null;
    waldCl = arten[wA]?.cluster;
  }
  const waldBei = (inf, x, y) => {
    if (!waldD || inf[4] & WASSER) return 0;
    const w = waldD[inf[0]];
    return w > 0 && waldCl ? w * clusterBei(waldCl, wA, x, y) : w;
  };
  // vier Nachbarpunkte im Abstand d (leicht gedreht gegen Gitterartefakte)
  const RX = [0.92, -0.38, -0.92, 0.38], RY = [0.38, 0.92, -0.38, -0.92];

  for (let a = 0; a < arten.length; a++) {
    const art = arten[a];
    const r = art.radius ?? 2, c = r, r2 = r * r;
    const as = hashSeed(seed, 'objekt', art.key) | 0;
    const { d: dichte, typIdx, alle } = dichteArray(art, biome);
    const af = faktor * (opts.artDichte?.[art.key] ?? 1);
    let maxD = 0;
    for (let i = 0; i < 256; i++) if (dichte[i] > maxD) maxD = dichte[i];
    const rand = art.rand, hf = art.hangFuss, unterWald = art.unterWald ?? 0;
    maxD *= af * (rand ? 1 + (rand.gewicht ?? 2) : 1);
    if (maxD <= 0) continue;
    const hang = art.hang || [0, 1e9], hoehe = art.hoehe || [-1e9, 1e9], wd = art.wasserDist || [0, 1e9];
    const imSee = art.wasser === 'see', tiefe = art.tiefe || [-1e9, 1e9], ohneBelegt = art.belegt === false;
    const sk0 = art.skala?.[0] ?? 0.8, skD = (art.skala?.[1] ?? 1.2) - sk0;
    const cl = art.cluster;
    const gx0 = Math.floor(bereich.x0 / c) - 1, gy0 = Math.floor(bereich.y0 / c) - 1;
    const gx1 = Math.floor((bereich.x1 - 1e-6) / c) + 1, gy1 = Math.floor((bereich.y1 - 1e-6) / c) + 1;
    const GW = gx1 - gx0 + 1, GH = gy1 - gy0 + 1;
    const px = new Float32Array(GW * GH), py = new Float32Array(GW * GH), ok = new Uint8Array(GW * GH);
    const wahl = new Int32Array(GW * GH);
    // 1) Kandidaten pro Gitterzelle + Dichteprüfung + Typwahl
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const k = gy * GW + gx, X = gx + gx0, Y = gy + gy0;
      const wurf = hash2(X, Y, as ^ 0x5bd1e995);
      if (wurf >= maxD) continue;
      const x = (X + hash2(X, Y, as)) * c, y = (Y + hash2(X, Y, as + 1)) * c;
      if (!quelle.punkt(x, y, info)) continue;
      const fl = info[4];
      if (fl & FLAG.FREI || (info[5] && !ohneBelegt)) continue;
      if (imSee) {
        if (!(fl & FLAG.SEE)) continue;
        const tf = info[8] - info[2];
        if (tf < tiefe[0] || tf > tiefe[1]) continue;
      } else if (fl & WASSER) continue;
      if (info[1] < hang[0] || info[1] > hang[1] || info[2] < hoehe[0] || info[2] > hoehe[1] || info[3] < wd[0] || info[3] > wd[1]) continue;
      let p = dichte[info[0]] * af;
      if (p <= 0) continue;
      if (cl) p *= clusterBei(cl, a, x, y);
      if (unterWald > 0) p *= smoothstep(unterWald - 0.2, unterWald + 0.15, waldBei(info, x, y));
      if (wurf >= p * (rand ? 1 + (rand.gewicht ?? 2) : 1)) continue;
      if (rand || hf) {
        // Umgebung: stärkster Wald / steilster Hang rundum (mitten im Wald gibt es keinen Rand → Abkürzung)
        const w0 = rand ? waldBei(info, x, y) : 0;
        if (hf || w0 <= 0.9) {
          const dd = (rand ? rand.dist : hf.dist) ?? 3;
          let wMax = 0, hMax = 0;
          for (let q = 0; q < 4; q++) {
            const qx = x + RX[q] * dd, qy = y + RY[q] * dd;
            quelle.punkt(qx, qy, nb);
            if (rand) { const w = waldBei(nb, qx, qy); if (w > wMax) wMax = w; }
            if (hf && nb[1] > hMax) hMax = nb[1];
          }
          if (rand) p *= 1 + (rand.gewicht ?? 2) * Math.max(0, wMax - w0);
          if (hf) p *= smoothstep(hf.min, hf.min + (hf.weich ?? 0.04), hMax - info[1]);
        }
        if (wurf >= p) continue;
      }
      const e = waehleTyp(typIdx[info[0]], info, hash2(X, Y, as + 3), hash2(X, Y, as + 6) * 2 - 1);
      if (!e) continue;
      ok[k] = 1; px[k] = x; py[k] = y; wahl[k] = e.nr;
    }
    // 2) Konflikte: ein Kandidat bleibt, wenn kein gültiger Nachbar näher als r eine höhere Priorität hat
    for (let gy = 1; gy < GH - 1; gy++) for (let gx = 1; gx < GW - 1; gx++) {
      const k = gy * GW + gx;
      if (!ok[k]) continue;
      const X = gx + gx0, Y = gy + gy0, x = px[k], y = py[k];
      if (x < bereich.x0 || y < bereich.y0 || x >= bereich.x1 || y >= bereich.y1) continue;
      const prio = hash2(X, Y, as + 2);
      let frei = true;
      for (let dy = -1; dy <= 1 && frei; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const j = k + dy * GW + dx;
        if (!ok[j]) continue;
        const ex = px[j] - x, ey = py[j] - y;
        if (ex * ex + ey * ey >= r2) continue;
        const pj = hash2(X + dx, Y + dy, as + 2);
        if (pj > prio || (pj === prio && j > k)) { frei = false; break; }
      }
      if (!frei) continue;
      const e = alle[wahl[k]];
      let tn = typNr.get(e.name);
      if (tn === undefined) { tn = typen.length; typen.push(e.name); typNr.set(e.name, tn); }
      const h4 = hash2(X, Y, as + 4);
      ox.push(x * zelle); oy.push(y * zelle); oart.push(a); otyp.push(tn);
      oskala.push(e.skala ? e.skala[0] + (e.skala[1] - e.skala[0]) * h4 : sk0 + skD * h4); odreh.push(hash2(X, Y, as + 5) * Math.PI * 2);
      if (quelle.belege && art.platz) quelle.belege(x, y, art.platz);
    }
  }
  return {
    anzahl: ox.length, x: Float32Array.from(ox), y: Float32Array.from(oy), art: Uint8Array.from(oart), typ: Uint8Array.from(otyp),
    skala: Float32Array.from(oskala), drehung: Float32Array.from(odreh), arten: arten.map(a => a.key), typen,
  };
}

/**
 * Pipeline-Stufe Objekte: welt.objekte.
 * opts.objekte: { aktiv, dichte, artDichte {key: Faktor} (z. B. { bodendecker: 0.5 }), arten (ersetzt), extra (anhängen), aus: [keys] (z. B. ['bodendecker']) }
 */
export function stufeObjekte(welt, opts) {
  const O = opts.objekte || {};
  if (O.aktiv === false) { welt.objekte = verteile(weltQuelle(welt), [], { biome: welt.biome }, { x0: 0, y0: 0, x1: 0, y1: 0 }); return; }
  const aus = new Set(O.aus || []);
  const arten = [...(O.arten || STANDARD_OBJEKTE), ...(O.extra || [])].filter(a => !aus.has(a.key));
  welt.objekte = verteile(weltQuelle(welt), arten,
    { seed: opts.seed, dichte: O.dichte ?? 1, artDichte: O.artDichte, massstab: opts.hoehe?.massstab || Math.max(welt.breite, welt.tiefe), biome: welt.biome, zelle: welt.zelle },
    { x0: 0, y0: 0, x1: welt.breite, y1: welt.tiefe });
}
