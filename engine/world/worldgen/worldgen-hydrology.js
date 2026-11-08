/**
 * @modul    worldgen-hydrology
 * @zweck    Wasserhaushalt: Ozean vom Rand fluten, Senken per Priority-Flood füllen, Seen erkennen, Abflussrichtung (D8) und Abflussmenge berechnen
 * @api      fuelleSenken(H,b,t,saat,eps?) -> {F,reihenfolge} ; abflussRichtung(F,b,t,istSaat) -> Int32Array ; abflussMenge(ziel,reihenfolge,regen?) -> Float32Array ; stufeHydrologie(welt, opts) -> void
 * @beispiel
 *   import { stufeHydrologie } from '../../engine/world/worldgen/worldgen-hydrology.js';
 *   stufeHydrologie(welt, opts);   // setzt welt.flags (OZEAN/SEE/KUESTE), welt.wasserstand, welt.ziel, welt.abfluss, welt.seen
 * @tags     welt, worldgen, wasser, seen, abfluss, priority-flood
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { createMinHeap, markiereRegionen, DX8, DY8, DL8, FLAG } from './worldgen-grid.js';

/**
 * Priority-Flood mit Epsilon (Barnes 2014): füllt alle Senken, sodass jede Zelle ein Gefälle zu einer Saatzelle hat.
 * saat: Uint8Array (1 = Abfluss, z. B. Meer oder Kartenrand). Ergebnis: gefüllte Höhen F (Float64) und Bearbeitungsreihenfolge (aufsteigend).
 */
export function fuelleSenken(H, b, t, saat, eps = 1e-6) {
  const n = b * t;
  const F = new Float64Array(n), zu = new Uint8Array(n), reihenfolge = new Int32Array(n);
  const heap = createMinHeap(n >> 2);
  for (let i = 0; i < n; i++) if (saat[i]) { F[i] = H[i]; zu[i] = 1; heap.push(i, H[i]); }
  let k = 0;
  while (heap.size > 0) {
    const c = heap.pop();
    reihenfolge[k++] = c;
    const cx = c % b, cy = (c - cx) / b, fc = F[c] + eps;
    for (let d = 0; d < 8; d++) {
      const nx = cx + DX8[d], ny = cy + DY8[d];
      if (nx < 0 || ny < 0 || nx >= b || ny >= t) continue;
      const j = ny * b + nx;
      if (zu[j]) continue;
      zu[j] = 1;
      const h = H[j];
      F[j] = h > fc ? h : fc;
      heap.push(j, F[j]);
    }
  }
  // Zellen ohne Verbindung zu einer Saat (nur wenn saat leer) – sollte nicht vorkommen
  if (k < n) for (let i = 0; i < n; i++) if (!zu[i]) { F[i] = H[i]; reihenfolge[k++] = i; }
  return { F, reihenfolge };
}

/** D8-Abflussrichtung auf gefüllter Oberfläche: Index der steilsten tieferen Nachbarzelle, -1 für Saat-/Abflusszellen. */
export function abflussRichtung(F, b, t, istSaat) {
  const n = b * t, ziel = new Int32Array(n);
  for (let y = 0; y < t; y++) {
    for (let x = 0; x < b; x++) {
      const i = y * b + x;
      if (istSaat[i]) { ziel[i] = -1; continue; }
      const f = F[i];
      let best = -1, bestG = 0;
      for (let d = 0; d < 8; d++) {
        const nx = x + DX8[d], ny = y + DY8[d];
        if (nx < 0 || ny < 0 || nx >= b || ny >= t) continue;
        const j = ny * b + nx, g = (f - F[j]) / DL8[d];
        if (g > bestG) { bestG = g; best = j; }
      }
      ziel[i] = best;
    }
  }
  return ziel;
}

/** Abflussmenge: jede Zelle gibt ihr Wasser (regen[i] oder 1) an ihr Ziel weiter; Verarbeitung von oben nach unten. */
export function abflussMenge(ziel, reihenfolge, regen) {
  const n = ziel.length, A = new Float32Array(n);
  if (regen) A.set(regen); else A.fill(1);
  for (let k = n - 1; k >= 0; k--) {
    const i = reihenfolge[k], z = ziel[i];
    if (z >= 0) A[z] += A[i];
  }
  return A;
}

/**
 * Pipeline-Stufe Hydrologie. Ergebnis in welt:
 *  flags (OZEAN, SEE, KUESTE), wasserstand (Meer = 0, See = Spiegel), ziel (D8), abfluss, seen [{id,x,y,flaeche,spiegel,tiefe}]
 */
export function stufeHydrologie(welt, opts) {
  const W = opts.wasser || {};
  const { breite: b, tiefe: t, hoehe: H, flags: FL, wasserstand: WS } = welt;
  const n = b * t, endlich = (opts.form?.typ || 'insel') !== 'unendlich';
  const meer = 0;

  // 1) Ozean: unter Meeresspiegel und mit dem Rand verbunden (bei 'unendlich' jede Zelle unter 0)
  const unter = new Uint8Array(n);
  for (let i = 0; i < n; i++) unter[i] = H[i] < meer ? 1 : 0;
  const lab = new Int32Array(n);
  const anz = markiereRegionen(unter, b, t, lab);
  const randRegion = new Uint8Array(anz + 1);
  for (let x = 0; x < b; x++) { randRegion[lab[x]] = 1; randRegion[lab[(t - 1) * b + x]] = 1; }
  for (let y = 0; y < t; y++) { randRegion[lab[y * b]] = 1; randRegion[lab[y * b + b - 1]] = 1; }
  randRegion[0] = 0;
  const saat = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (lab[i] && (randRegion[lab[i]] || !endlich || W.binnenMeer)) { FL[i] |= FLAG.OZEAN; saat[i] = 1; WS[i] = meer; }
  }
  for (let x = 0; x < b; x++) { saat[x] = 1; saat[(t - 1) * b + x] = 1; }
  for (let y = 0; y < t; y++) { saat[y * b] = 1; saat[y * b + b - 1] = 1; }

  // 2) Senken füllen
  const { F, reihenfolge } = fuelleSenken(H, b, t, saat);

  // 3) Seen: ausreichend tiefe und große gefüllte Senken; kleine/flache Mulden werden eingeebnet, riesige Senken (oder seen:false) bleiben trockene Becken
  const flaecheF = (b * t) / 65536;
  const minTiefe = W.seeMinTiefe ?? 0.006, minFlaeche = Math.max(3, Math.round((W.seeMinFlaeche ?? 14) * flaecheF));
  const seenAn = W.seen !== false;
  const kand = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (!saat[i] && F[i] - H[i] > 1e-5) kand[i] = 1;
  const anzS = markiereRegionen(kand, b, t, lab);
  const fl = new Int32Array(anzS + 1), maxT = new Float32Array(anzS + 1), spiegel = new Float64Array(anzS + 1);
  const sx = new Float64Array(anzS + 1), sy = new Float64Array(anzS + 1);
  for (let i = 0; i < n; i++) {
    const l = lab[i]; if (!l) continue;
    fl[l]++; const d = F[i] - H[i]; if (d > maxT[l]) maxT[l] = d;
    if (F[i] > spiegel[l]) spiegel[l] = F[i];
    sx[l] += i % b; sy[l] += (i / b) | 0;
  }
  const maxFlaeche = Math.round((W.seeMaxAnteil ?? 0.03) * n);
  const istSee = new Uint8Array(anzS + 1), becken = new Uint8Array(anzS + 1), seen = [];
  for (let l = 1; l <= anzS; l++) {
    if (maxT[l] < minTiefe || fl[l] < minFlaeche) continue; // flache oder kleine Mulde → wird aufgefüllt
    if (!seenAn || fl[l] > maxFlaeche) { becken[l] = 1; continue; } // trockenes Becken
    {
      istSee[l] = 1;
      seen.push({ id: seen.length, x: (sx[l] / fl[l]) * welt.zelle, y: (sy[l] / fl[l]) * welt.zelle, flaeche: fl[l], spiegel: spiegel[l], tiefe: maxT[l] });
    }
  }
  const seeNr = new Int32Array(anzS + 1).fill(-1);
  for (let k = 0, s = 0; k <= anzS; k++) if (istSee[k]) seeNr[k] = s++;
  welt.seeId = new Int16Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const l = lab[i];
    if (l && istSee[l]) { FL[i] |= FLAG.SEE; WS[i] = spiegel[l]; welt.seeId[i] = seeNr[l]; }
    else if (!becken[l] && F[i] > H[i]) H[i] = F[i];
  }

  // 4) Abflussrichtung + Menge
  const ziel = abflussRichtung(F, b, t, saat);
  welt.ziel = ziel;
  welt.abfluss = abflussMenge(ziel, reihenfolge, null);
  welt.reihenfolge = reihenfolge;
  welt.seen = seen;

  // 5) Küstenzellen: Land neben Ozean
  for (let y = 0; y < t; y++) for (let x = 0; x < b; x++) {
    const i = y * b + x;
    if (FL[i] & FLAG.OZEAN) continue;
    if ((x > 0 && FL[i - 1] & FLAG.OZEAN) || (x < b - 1 && FL[i + 1] & FLAG.OZEAN) ||
        (y > 0 && FL[i - b] & FLAG.OZEAN) || (y < t - 1 && FL[i + b] & FLAG.OZEAN)) FL[i] |= FLAG.KUESTE;
  }
}
