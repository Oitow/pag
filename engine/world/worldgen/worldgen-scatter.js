/**
 * @modul    worldgen-scatter
 * @zweck    Blue-Noise-Verteilung von Objekten (Bäume, Büsche, Felsen, Kakteen, Schilf, Blumen …) mit Dichte pro Biom, Lichtungen und Hangregeln; reihenfolgeunabhängig und dadurch nahtlos über Chunks
 * @api      STANDARD_OBJEKTE ; verteile(quelle, arten, opts, bereich) -> objekte ; weltQuelle(welt) -> quelle ; stufeObjekte(welt, opts) -> void
 * @beispiel
 *   import { stufeObjekte } from '../../engine/world/worldgen/worldgen-scatter.js';
 *   stufeObjekte(welt, opts);
 *   const o = welt.objekte;   // { anzahl, x, y, art, typ, skala, drehung, arten:[…], typen:[…] }
 *   for (let i = 0; i < o.anzahl; i++) if (o.arten[o.art[i]] === 'baum') pflanze(o.typen[o.typ[i]], o.x[i], o.y[i]);
 * @tags     welt, worldgen, objekte, baeume, verteilung, poisson, blue-noise
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { hash2, hashSeed } from '../../core/rng.js';
import { createNoise2D } from '../../core/noise.js';
import { smoothstep } from '../../core/math.js';
import { FLAG, WASSER } from './worldgen-grid.js';

/**
 * Standard-Objektarten. radius = Mindestabstand (Zellen); dichte = Biom → Wahrscheinlichkeit (Schlüssel '_' = alle übrigen Biome);
 * typen = Biom → Liste von Typnamen; cluster = Lichtungen/Haine per Rauschen; hang/hoehe/wasserDist = erlaubte Bereiche.
 */
export const STANDARD_OBJEKTE = [
  { key: 'baum', radius: 2, platz: 1,
    dichte: { laubwald: 0.85, nadelwald: 0.9, birkenwald: 0.8, regenwald: 0.95, hartlaubwald: 0.5, wiese: 0.05, savanne: 0.07, sumpf: 0.25, heide: 0.04, tundra: 0.03, steppe: 0.01 },
    typen: { laubwald: ['eiche', 'buche'], nadelwald: ['tanne', 'kiefer'], birkenwald: ['birke'], regenwald: ['tropenbaum'], hartlaubwald: ['olive', 'pinie'],
      savanne: ['akazie'], steppe: ['akazie'], sumpf: ['weide', 'toterBaum'], heide: ['kiefer'], tundra: ['tanne'], _: ['eiche', 'birke'] },
    cluster: { frequenz: 14, schwelle: -0.3, weich: 0.35 }, hang: [0, 0.08], wasserDist: [1, 1e9] },
  { key: 'busch', radius: 1.4,
    dichte: { wiese: 0.12, heide: 0.3, laubwald: 0.15, birkenwald: 0.15, savanne: 0.15, steppe: 0.08, hartlaubwald: 0.25, tundra: 0.1, sumpf: 0.1, nadelwald: 0.08 },
    typen: { heide: ['ginster'], tundra: ['zwergstrauch'], _: ['busch'] }, hang: [0, 0.09], wasserDist: [1, 1e9] },
  { key: 'fels', radius: 2.6, platz: 1,
    dichte: { fels: 0.3, tundra: 0.1, schnee: 0.04, heide: 0.06, wueste: 0.04, steppe: 0.05, strand: 0.03, nadelwald: 0.04, wiese: 0.02 },
    typen: { _: ['fels', 'felsbrocken'] }, wasserDist: [0.5, 1e9] },
  { key: 'kaktus', radius: 2.2, dichte: { wueste: 0.12, savanne: 0.03 }, typen: { _: ['kaktus'] }, hang: [0, 0.06], wasserDist: [1, 1e9] },
  { key: 'schilf', radius: 0.9, dichte: { sumpf: 0.6, wueste: 0, schnee: 0, fels: 0, tundra: 0.1, _: 0.35 }, typen: { _: ['schilf'] }, wasserDist: [0.5, 2.6], hang: [0, 0.05] },
  { key: 'blume', radius: 1.2, dichte: { wiese: 0.22, birkenwald: 0.08, laubwald: 0.03, savanne: 0.04 }, typen: { _: ['blume'] },
    cluster: { frequenz: 22, schwelle: 0.0, weich: 0.3 }, hang: [0, 0.06], wasserDist: [1, 1e9] },
];

/**
 * Quelle für eine fertige Welt: punkt(x,y,aus) füllt aus = [biom, hang, hoehe, wasserDist, flags, belegt] (x,y in Zellen).
 */
export function weltQuelle(welt) {
  const { breite: b, tiefe: t } = welt;
  const belegt = new Uint8Array(b * t);
  return {
    belegt,
    punkt(x, y, aus) {
      let ix = Math.round(x), iy = Math.round(y);
      if (ix < 0) ix = 0; else if (ix >= b) ix = b - 1;
      if (iy < 0) iy = 0; else if (iy >= t) iy = t - 1;
      const i = iy * b + ix;
      aus[0] = welt.biom[i]; aus[1] = welt.hang[i]; aus[2] = welt.hoehe[i];
      aus[3] = welt.wasserDistanz[i]; aus[4] = welt.flags[i]; aus[5] = belegt[i];
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

/** Dichte-Tabelle einer Art in ein Array pro Biom-Id übersetzen. */
function dichteArray(art, biome) {
  const d = new Float32Array(256), basis = art.dichte?._ ?? 0;
  const typIdx = new Array(256);
  for (let i = 0; i < 256; i++) d[i] = 0;
  biome.forEach((bm, id) => {
    d[id] = art.dichte?.[bm.key] ?? basis;
    typIdx[id] = art.typen?.[bm.key] || art.typen?._ || [art.key];
  });
  return { d, typIdx };
}

/**
 * Verteilt Objekte im Bereich {x0,y0,x1,y1} (Zellen, x1/y1 exklusiv). Das Ergebnis hängt nur von Seed und Position ab
 * (nicht von der Reihenfolge) → Chunks passen nahtlos. opts: { seed, dichte (Faktor), massstab, biome, zelle }
 */
export function verteile(quelle, arten, opts, bereich) {
  const seed = opts.seed ?? 1, faktor = opts.dichte ?? 1, zelle = opts.zelle ?? 1;
  const s = 1 / (opts.massstab || 256);
  const biome = opts.biome;
  const typen = [], typNr = new Map();
  const ox = [], oy = [], oart = [], otyp = [], oskala = [], odreh = [];
  const info = new Float64Array(8);
  const nCl = createNoise2D(hashSeed(seed, 'lichtung'));
  for (let a = 0; a < arten.length; a++) {
    const art = arten[a];
    const r = art.radius ?? 2, c = r, r2 = r * r;
    const as = hashSeed(seed, 'objekt', art.key) | 0;
    const { d: dichte, typIdx } = dichteArray(art, biome);
    let maxD = 0;
    for (let i = 0; i < 256; i++) if (dichte[i] > maxD) maxD = dichte[i];
    maxD *= faktor;
    if (maxD <= 0) continue;
    const hang = art.hang || [0, 1e9], hoehe = art.hoehe || [-1e9, 1e9], wd = art.wasserDist || [0, 1e9];
    const cl = art.cluster;
    const gx0 = Math.floor(bereich.x0 / c) - 1, gy0 = Math.floor(bereich.y0 / c) - 1;
    const gx1 = Math.floor((bereich.x1 - 1e-6) / c) + 1, gy1 = Math.floor((bereich.y1 - 1e-6) / c) + 1;
    const GW = gx1 - gx0 + 1, GH = gy1 - gy0 + 1;
    const px = new Float32Array(GW * GH), py = new Float32Array(GW * GH), ok = new Uint8Array(GW * GH), bio = new Uint8Array(GW * GH);
    // 1) Kandidaten pro Gitterzelle + Dichteprüfung
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const k = gy * GW + gx, X = gx + gx0, Y = gy + gy0;
      const wurf = hash2(X, Y, as ^ 0x5bd1e995);
      if (wurf >= maxD) continue;
      const x = (X + hash2(X, Y, as)) * c, y = (Y + hash2(X, Y, as + 1)) * c;
      if (!quelle.punkt(x, y, info)) continue;
      const fl = info[4];
      if (fl & (WASSER | FLAG.FREI) || info[5]) continue;
      if (info[1] < hang[0] || info[1] > hang[1] || info[2] < hoehe[0] || info[2] > hoehe[1] || info[3] < wd[0] || info[3] > wd[1]) continue;
      let p = dichte[info[0]] * faktor;
      if (cl) p *= smoothstep(cl.schwelle, cl.schwelle + cl.weich, nCl(x * s * cl.frequenz + a * 31.7, y * s * cl.frequenz - a * 17.3));
      if (wurf >= p) continue;
      ok[k] = 1; px[k] = x; py[k] = y; bio[k] = info[0];
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
      const liste = typIdx[bio[k]];
      const name = liste[Math.floor(hash2(X, Y, as + 3) * liste.length)];
      let tn = typNr.get(name);
      if (tn === undefined) { tn = typen.length; typen.push(name); typNr.set(name, tn); }
      ox.push(x * zelle); oy.push(y * zelle); oart.push(a); otyp.push(tn);
      oskala.push(0.8 + 0.4 * hash2(X, Y, as + 4)); odreh.push(hash2(X, Y, as + 5) * Math.PI * 2);
      if (quelle.belege && art.platz) quelle.belege(x, y, art.platz);
    }
  }
  return {
    anzahl: ox.length, x: Float32Array.from(ox), y: Float32Array.from(oy), art: Uint8Array.from(oart), typ: Uint8Array.from(otyp),
    skala: Float32Array.from(oskala), drehung: Float32Array.from(odreh), arten: arten.map(a => a.key), typen,
  };
}

/** Pipeline-Stufe Objekte: welt.objekte. opts.objekte: { aktiv, dichte, arten (ersetzt), extra (anhängen), aus: [keys] } */
export function stufeObjekte(welt, opts) {
  const O = opts.objekte || {};
  if (O.aktiv === false) { welt.objekte = verteile(weltQuelle(welt), [], { biome: welt.biome }, { x0: 0, y0: 0, x1: 0, y1: 0 }); return; }
  const aus = new Set(O.aus || []);
  const arten = [...(O.arten || STANDARD_OBJEKTE), ...(O.extra || [])].filter(a => !aus.has(a.key));
  welt.objekte = verteile(weltQuelle(welt), arten,
    { seed: opts.seed, dichte: O.dichte ?? 1, massstab: opts.hoehe?.massstab || Math.max(welt.breite, welt.tiefe), biome: welt.biome, zelle: welt.zelle },
    { x0: 0, y0: 0, x1: welt.breite, y1: welt.tiefe });
}
