/**
 * @modul    terrain-lod
 * @zweck    Reine Logik für gekacheltes Gelände: LOD-Wahl nach Abstand (mit Hysterese), Index-Puffer je LOD inkl. Skirts gegen Risse, Kachel-Planung um die Kamera und eine Arbeits-Warteschlange mit Zeitbudget pro Frame
 * @api      kachelIndizes(seg) -> Uint16Array|Uint32Array ; vertexAnzahl(seg) -> int ; dreieckAnzahl(seg) -> int ; waehleLod(abstand,stufen,alt,hysterese) -> int ; abstandZuRechteck(px,pz,x0,z0,x1,z1) -> number ; kachelSchluessel(kx,ky) -> int ; planeKacheln(p) -> {soll,auftraege,entfernen} ; abarbeiten(auftraege,ausfuehren,opts) -> int
 * @beispiel
 *   import { planeKacheln, abarbeiten, kachelIndizes } from '../../engine/world/terrain-lod.js';
 *   const plan = planeKacheln({ kamX: 0, kamZ: 0, kachelMeter: 64, sichtweite: 600, stufen: [96, 192, 384], vorhanden });
 *   abarbeiten(plan.auftraege, (a) => baueKachel(a), { budgetMs: 4 });
 * @tags     welt, terrain, gelaende, lod, chunks, streaming, culling
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

/** Vertices einer Kachel mit seg Segmenten: Gitter (seg+1)² + 4 Skirt-Reihen à (seg+1). */
export const vertexAnzahl = (seg) => (seg + 1) * (seg + 1) + 4 * (seg + 1);
/** Dreiecke einer Kachel inkl. Skirts. */
export const dreieckAnzahl = (seg) => 2 * seg * seg + 8 * seg;

/**
 * Index-Puffer für eine Kachel mit seg Segmenten (gleich für alle Kacheln derselben LOD → teilbar).
 * Vertex-Reihenfolge: Gitter zeilenweise (i = x, j = z), danach Skirts oben (j=0), unten (j=seg), links (i=0), rechts (i=seg).
 * Dreiecke sind gegen den Uhrzeigersinn von außen gesehen (Boden nach oben, Skirts nach außen).
 */
export function kachelIndizes(seg) {
  const n = seg + 1, S = n * n, idx = vertexAnzahl(seg) > 65535 ? new Uint32Array(dreieckAnzahl(seg) * 3) : new Uint16Array(dreieckAnzahl(seg) * 3);
  let k = 0;
  const tri = (a, b, c) => { idx[k++] = a; idx[k++] = b; idx[k++] = c; };
  for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    tri(a, c, b); tri(b, c, d);
  }
  const oben = S, unten = S + n, links = S + 2 * n, rechts = S + 3 * n;
  for (let q = 0; q < seg; q++) {
    // oben (j = 0), außen = -z
    let t0 = q, t1 = q + 1, s0 = oben + q, s1 = oben + q + 1;
    tri(t0, t1, s0); tri(t1, s1, s0);
    // unten (j = seg), außen = +z
    t0 = seg * n + q; t1 = t0 + 1; s0 = unten + q; s1 = s0 + 1;
    tri(t0, s0, t1); tri(t1, s0, s1);
    // links (i = 0), außen = -x
    t0 = q * n; t1 = t0 + n; s0 = links + q; s1 = s0 + 1;
    tri(t0, s0, t1); tri(t1, s0, s1);
    // rechts (i = seg), außen = +x
    t0 = q * n + seg; t1 = t0 + n; s0 = rechts + q; s1 = s0 + 1;
    tri(t0, t1, s0); tri(t1, s1, s0);
  }
  return idx;
}

/**
 * LOD aus Abstand: 0 = voll, stufen = aufsteigende Grenzen in Metern (Länge = Stufen-1).
 * Mit alt (bisherige LOD) und hysterese (Anteil) springt die Stufe nicht an der Grenze hin und her.
 */
export function waehleLod(abstand, stufen, alt = -1, hysterese = 0.1) {
  let roh = 0, hoch = 0, runter = 0;
  for (const s of stufen) {
    if (abstand >= s) roh++;
    if (abstand >= s * (1 + hysterese)) hoch++;
    if (abstand >= s * (1 - hysterese)) runter++;
  }
  if (alt < 0) return roh;
  return Math.min(Math.max(alt, hoch), runter);
}

/** Waagrechter Abstand eines Punkts zu einem Rechteck (0 innen). */
export function abstandZuRechteck(px, pz, x0, z0, x1, z1) {
  const dx = px < x0 ? x0 - px : px > x1 ? px - x1 : 0;
  const dz = pz < z0 ? z0 - pz : pz > z1 ? pz - z1 : 0;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Eindeutiger Zahlenschlüssel für Kachel (kx, ky) im Bereich ±32767. */
export const kachelSchluessel = (kx, ky) => (kx + 32768) * 65536 + (ky + 32768);

/**
 * Welche Kacheln mit welcher LOD gebraucht werden und was zu tun ist.
 * p: kamX, kamZ (Meter), kachelMeter, ursprungX/Z (Weltecke von Kachel 0,0; Standard 0), sichtweite, stufen,
 *    hysterese, bereich {kx0,ky0,kx1,ky1} (inklusive; fehlt = unendlich), vorhanden: Map schluessel → {lod},
 *    sichtbar(kx,ky) → bool (Frustum; optional), objektWeite (Meter, Kacheln darin bekommen objekte=true).
 * Ergebnis: soll Map schluessel → {kx,ky,lod,abstand,sichtbar,objekte}; auftraege [{schluessel,kx,ky,lod,prio,neu}]
 *    nach prio aufsteigend (sichtbare und neue zuerst); entfernen [schluessel] (außerhalb sichtweite × 1.15).
 */
export function planeKacheln(p) {
  const K = p.kachelMeter, ux = p.ursprungX ?? 0, uz = p.ursprungZ ?? 0, sw = p.sichtweite;
  const stufen = p.stufen, hyst = p.hysterese ?? 0.1, vorh = p.vorhanden ?? new Map(), b = p.bereich;
  const r = Math.ceil(sw / K) + 1;
  const ckx = Math.floor((p.kamX - ux) / K), cky = Math.floor((p.kamZ - uz) / K);
  let kx0 = ckx - r, kx1 = ckx + r, ky0 = cky - r, ky1 = cky + r;
  if (b) { kx0 = Math.max(kx0, b.kx0); kx1 = Math.min(kx1, b.kx1); ky0 = Math.max(ky0, b.ky0); ky1 = Math.min(ky1, b.ky1); }
  const soll = new Map(), auftraege = [], entfernen = [];
  for (let ky = ky0; ky <= ky1; ky++) for (let kx = kx0; kx <= kx1; kx++) {
    const x0 = ux + kx * K, z0 = uz + ky * K;
    const d = abstandZuRechteck(p.kamX, p.kamZ, x0, z0, x0 + K, z0 + K);
    const key = kachelSchluessel(kx, ky), alt = vorh.get(key);
    if (d > sw && !(alt && d <= sw * 1.15)) continue;
    const lod = waehleLod(d, stufen, alt ? alt.lod : -1, hyst);
    const sicht = p.sichtbar ? !!p.sichtbar(kx, ky) : true;
    soll.set(key, { kx, ky, lod, abstand: d, sichtbar: sicht, objekte: d <= (p.objektWeite ?? 0) });
    if (!alt || alt.lod !== lod) {
      // fehlende Kacheln vor Verfeinerungen, sichtbare vor unsichtbaren, nahe vor fernen
      const prio = d * (sicht ? 1 : 4) + (alt ? K * 2 : 0);
      auftraege.push({ schluessel: key, kx, ky, lod, prio, neu: !alt });
    }
  }
  for (const key of vorh.keys()) if (!soll.has(key)) entfernen.push(key);
  auftraege.sort((a, c) => a.prio - c.prio);
  return { soll, auftraege, entfernen };
}

/**
 * Arbeitet Aufträge der Reihe nach ab, bis das Zeitbudget verbraucht ist (mindestens opts.min, Standard 1).
 * Aufträge mit teuer=true zählen gegen opts.maxTeuer (Standard 1 pro Aufruf) und werden sonst übersprungen.
 * ausfuehren(auftrag) wird aufgerufen; erledigte Aufträge werden aus dem Array entfernt. Ergebnis: Anzahl erledigt.
 * opts.uhr: Zeitquelle in ms (Standard performance.now / Date.now).
 */
export function abarbeiten(auftraege, ausfuehren, opts = {}) {
  const uhr = opts.uhr ?? (globalThis.performance ? () => performance.now() : () => Date.now());
  const budget = opts.budgetMs ?? 4, min = opts.min ?? 1, maxTeuer = opts.maxTeuer ?? 1, maxAnzahl = opts.max ?? Infinity;
  const t0 = uhr();
  let erledigt = 0, teuer = 0, i = 0;
  while (i < auftraege.length && erledigt < maxAnzahl) {
    if (erledigt >= min && uhr() - t0 >= budget) break;
    const a = auftraege[i];
    if (a.teuer && teuer >= maxTeuer) { i++; continue; }
    ausfuehren(a);
    if (a.teuer) teuer++;
    auftraege.splice(i, 1);
    erledigt++;
  }
  return erledigt;
}
