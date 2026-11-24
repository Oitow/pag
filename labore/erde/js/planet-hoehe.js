// Höhe, Wasser und Farbe des Planeten an jedem Punkt (reine Logik, ohne THREE, läuft auch im Worker).
// Grobe Form aus der Geologie (Platten, Erosion, Flussnetz, Seen – siehe geologie.js), darauf feines Rauschen.
// Flüsse werden fein eingeschnitten: Bett, Ufer und Talsohle entlang der Abfluss-Strecken der Geologie.
// `feinste` = kleinste Wellenlänge in Metern, die noch berechnet wird (grobe Kacheln sparen Arbeit).
import { createNoise3D } from '../../../engine/core/noise.js';
import { createGeoGitter } from './geo-gitter.js';
import { GESTEIN_FARBE } from './geologie.js';
import { tempAm, bodenFarbe } from './klima.js';

const glatt = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Flussbreite (m) aus Einzugsfläche (km²). */
export const flussBreite = (aKm2) => Math.min(140, 3 + 2.4 * Math.sqrt(aKm2));

/** eingriffe (optional) = createEingriffe(): Graben/Aufschütten verändert die Höhe (siehe eingriffe.js). */
export function createPlanetHoehe({ seed = 1, radius = 100_000, geo, G: gitter, eingriffe = null }) {
  const n = createNoise3D(seed);
  const R = radius;
  const G = gitter || createGeoGitter(geo.N);
  const { hoehe: GH, spiegel: GF, ab: GA, flaeche: GA2, gebirge: GB, gestein: GS, temp0: GT, feuchte: GFe } = geo;
  const dir = G.dir, nb = G.nb;
  const ZK = geo.zellKante, AMIN = geo.amin;
  const gw = G.neueGewichte();
  // Flusssuche: zwei Ringe Nachbarzellen (Stempel statt Set), Täler reichen höchstens TAL_MAX weit – so weit reicht die Suche sicher
  const marke = new Int32Array(GH.length), kand = new Int32Array(32);
  let stempel = 0;
  const TAL_MAX = ZK * 1.2;
  const W_WARP = ZK * 2.6, WARP = (ZK * 0.32) / R;

  // pers < 0.5: feine Oktaven werden flacher (sonst ist jede Oktave gleich steil → überall Buckelpiste)
  function fbmBis(x, y, z, welle, feinste, maxOkt, versatz, pers = 0.5) {
    let sum = 0, amp = 1, norm = 0, w = welle;
    for (let o = 0; o < maxOkt; o++) {
      const g = glatt(feinste, feinste * 2, w);
      norm += amp;
      if (g > 0) sum += amp * g * n(x / w + versatz, y / w - versatz, z / w + o * 17.3);
      amp *= pers; w *= 0.5;
    }
    return sum / norm;
  }
  function gratBis(x, y, z, welle, feinste, maxOkt) {
    let sum = 0, amp = 0.5, prev = 1, w = welle;
    for (let o = 0; o < maxOkt; o++) {
      const g = glatt(feinste, feinste * 2, w);
      if (g <= 0) break;
      const f = 1 / w;
      let v = 1 - Math.abs(n(x * f + 91.7, y * f + 3.1, z * f - 47.9 + o * 5.1));
      v *= v;
      sum += v * amp * prev * g; prev = v; amp *= 0.5; w /= 2.1;
    }
    return Math.min(1, sum * 1.1);
  }

  const aus = { eingriff: 0, h: 0, wasser: -Infinity, ufer: 0, fluss: 0, gebirge: 0, meer: 0, temp: 0, feuchte: 0, fr: 0, fg: 0, fb: 0, gestein: 0 };

  /** Füllt `aus`: h = Boden (m über Meer), wasser = Wasserspiegel (−∞ = kein Wasser), ufer 0…1, fluss 0/1,
   *  temp (°C am Ort), feuchte 0…1, fr/fg/fb = Felsfarbe des Gesteins (weich gemischt), gestein = Index der nächsten Zelle. */
  function probe(dx, dy, dz, feinste = 1) {
    // leichte Verwirbelung: bricht das Gitter auf, lässt Flüsse mäandern (gleich für Form und Flüsse)
    const wf = R / W_WARP;
    let qx = dx + WARP * n(dx * wf, dy * wf, dz * wf);
    let qy = dy + WARP * n(dx * wf + 17.1, dy * wf, dz * wf - 4.4);
    let qz = dz + WARP * n(dx * wf - 9.3, dy * wf + 2.8, dz * wf);
    const ql = Math.hypot(qx, qy, qz); qx /= ql; qy /= ql; qz /= ql;
    G.gewichte(qx, qy, qz, gw);
    const Hm = G.lese(GH, gw), Fm = G.lese(GF, gw), gb = G.lese(GB, gw);
    const x = dx * R, y = dy * R, z = dz * R;

    // feines Gelände: Grate im Gebirge, Hügel und Bodenwellen sonst
    const land = glatt(-30, 15, Hm);
    // Hügeligkeit: großräumig wechseln Ebenen (Wiesen, Bauland) und Hügelland; Küstensaum und Talböden flacher
    const huegel = glatt(-0.25, 0.35, n(x / 9000 + 3.3, y / 9000 - 8.1, z / 9000 + 1.7));
    const tief = glatt(2, 140, Hm);
    let detail = 0;
    if (gb > 0.01) detail += (gratBis(x, y, z, 2600, feinste, 7) - 0.3) * 700 * gb;
    let welle = fbmBis(x, y, z, 900, feinste, 6, 13.7, 0.42) * (6 + 60 * huegel * tief + 25 * gb);
    if (welle < 0) welle *= 0.45;                                    // Mulden mit Sediment gefüllt: flache Böden, runde Kuppen
    detail += welle * land;
    detail += fbmBis(x, y, z, 60, feinste, 4, 41.1, 0.45) * (0.5 + 1.2 * huegel) * land;
    detail += fbmBis(x, y, z, 1800, feinste, 3, 5.5) * 120 * (1 - land); // Meeresgrund

    let wasser = -Infinity, ufer = 0, fluss = 0;
    // See: Spiegel flach aus den See-Zellen der Umgebung (nicht zwischen See und Land interpolieren –
    // sonst steigt das Wasser am Ufer den Hang hinauf). Ufer = wo das Gelände den Spiegel schneidet.
    let see = -Infinity;
    for (let i = 0; i < 4; i++) { const c = gw.z[i]; if (GF[c] > GH[c] + 1 && GF[c] > 0 && GF[c] > see) see = GF[c]; }
    if (see > -Infinity) { wasser = see; detail *= glatt(see, see - 25, Hm); }
    if (Fm < 0.5) wasser = 0;                                                         // Meer
    let h = Hm + detail;

    // Flüsse: Abfluss-Strecken (Zelle → Ziel) in zwei Ringen um die nächste Zelle.
    // Jede Strecke senkt ihr Tal ein – nacheinander in fester Reihenfolge (Zellnummer), damit die Höhe stetig bleibt,
    // auch wo Täler zusammenlaufen. Das Bett (Wasser) kommt vom nächsten Fluss.
    if (Hm > -5) {
      const c0 = gw.naechste;
      stempel++;
      let nk = 0;
      for (let r1 = -1; r1 < 8; r1++) {
        const a = r1 < 0 ? c0 : nb[c0 * 8 + r1];
        if (a < 0) continue;
        for (let r2 = -1; r2 < 8; r2++) {
          const c = r2 < 0 ? a : nb[a * 8 + r2];
          if (c < 0 || marke[c] === stempel) continue;
          marke[c] = stempel;
          if (GA2[c] < AMIN || GH[c] < -2 || GF[c] > GH[c] + 1 || GA[c] < 0) continue; // im See: kein eigenes Bett
          let j = nk++;
          while (j > 0 && kand[j - 1] > c) { kand[j] = kand[j - 1]; j--; }
          kand[j] = c;
        }
      }
      let best = Infinity, bLevel = 0, bBreite = 0;
      for (let i = 0; i < nk; i++) {
        const c = kand[i], d = GA[c];
        const ax = dir[c * 3], ay = dir[c * 3 + 1], az = dir[c * 3 + 2];
        const bx = dir[d * 3] - ax, by = dir[d * 3 + 1] - ay, bz = dir[d * 3 + 2] - az;
        const t = Math.max(0, Math.min(1, ((qx - ax) * bx + (qy - ay) * by + (qz - az) * bz) / (bx * bx + by * by + bz * bz)));
        const ex = qx - ax - bx * t, ey = qy - ay - by * t, ez = qz - az - bz * t;
        const dist = Math.hypot(ex, ey, ez) * R;
        const breite = flussBreite(GA2[c]), halb = breite / 2;
        const level = Math.max(0, GF[c] + (Math.max(0, GF[d]) - GF[c]) * t);
        if (dist - halb < best) { best = dist - halb; bBreite = breite; bLevel = level; }
        // Talbreite wächst mit der Höhe über dem Fluss: sanfte Talhänge statt Steilwände (höchstens ~25°)
        const tal = Math.max(30 + breite * 2.5, Math.min(TAL_MAX - halb, (h - level) * 3.2));
        if (dist >= halb + tal) continue;
        const k = glatt(halb, halb + tal, dist);
        const ufH = level + 0.4 + (dist - halb) * 0.06;
        h = ufH + (h - ufH) * k;
        // Ufer nie unter den Wasserspiegel (weich ausgeblendet, sonst Kante am Talrand)
        const boden = level + 0.3 - glatt(0.2, 1, k) * tal * 0.5;
        if (h < boden) h = boden;
      }
      if (best < Infinity) {
        const halb = bBreite / 2, dist = best + halb;
        ufer = 1 - glatt(halb, halb + 12 + bBreite * 0.3, dist);
        // Bett nur, wenn die Kachel fein genug ist, um es zu zeigen
        if (dist < halb && feinste < bBreite * 1.5) {
          const tiefe = 0.7 + bBreite * 0.05;
          h = bLevel - tiefe * (1 - (dist / halb) ** 2);
          if (bLevel > wasser) wasser = bLevel;
          fluss = 1;
        }
      }
    }
    // Eingriffe (Graben/Aufschütten): ändern den Boden, nicht den Wasserspiegel – wer am Ufer gräbt, gräbt ins Wasser
    const dE = eingriffe ? eingriffe.delta(dx, dy, dz) : 0;
    h += dE;
    if (wasser > 0 && !fluss && wasser < h - 0.01 && Fm >= 0.5) wasser = -Infinity;   // Ufer über dem Seespiegel: trocken
    // Unter Meereshöhe ohne Wasser (Rauschen drückt den Küstensaum unter 0) → Meer läuft hinein, keine trockene Mulde
    let meer = Fm < 0.5 ? 1 : 0;
    if (h < 0 && wasser < 0) { wasser = 0; meer = 1; }
    let fr = 0, fg = 0, fb = 0;
    for (let i = 0; i < 4; i++) { const fc = GESTEIN_FARBE[GS[gw.z[i]]], w = gw.w[i]; fr += fc[0] * w; fg += fc[1] * w; fb += fc[2] * w; }
    aus.eingriff = dE; aus.h = h; aus.wasser = wasser; aus.ufer = ufer; aus.fluss = fluss; aus.gebirge = gb; aus.meer = meer;
    aus.temp = tempAm(G.lese(GT, gw), h); aus.feuchte = Math.min(1, G.lese(GFe, gw) + 0.25 * ufer);
    aus.fr = fr; aus.fg = fg; aus.fb = fb; aus.gestein = GS[gw.naechste];
    return aus;
  }

  /** Begehbare Oberfläche (Boden oder Wasserspiegel). */
  const oberflaeche = (dx, dy, dz, feinste = 1) => { const p = probe(dx, dy, dz, feinste); return Math.max(p.h, p.wasser); };
  const hoehe = (dx, dy, dz, feinste = 1) => probe(dx, dy, dz, feinste).h;

  /** Farbe (0…1) nach out. p = Ergebnis von probe(), flach = 1 eben … 0 senkrecht. */
  function farbe(dx, dy, dz, p, flach, out) {
    const x = dx * R, y = dy * R, z = dz * R;
    const v = n(x / 700 + 5.5, y / 700, z / 700 - 3.3) * 0.5 + 0.5; // = flecken()
    const h = p.h;
    if (p.wasser > h + 0.02) {
      const t = glatt(0, p.meer ? 300 : 12, p.wasser - h);
      if (p.meer) { out[0] = 0.08 - 0.05 * t; out[1] = 0.36 - 0.24 * t; out[2] = 0.5 - 0.15 * t; }
      else { out[0] = 0.12 - 0.07 * t; out[1] = 0.33 - 0.12 * t; out[2] = 0.38 - 0.02 * t; } // Fluss/See: grünlicher
      return out;
    }
    bodenFarbe(p.temp, p.feuchte, v, out);
    let r = out[0], g = out[1], b = out[2];
    const sand = p.meer ? 1 - glatt(1.5, 6 + v * 5, h) : 0;            // Strand nur am Meer
    r += (0.78 - r) * sand; g += (0.71 - g) * sand; b += (0.52 - b) * sand;
    const kies = p.ufer * (1 - sand);                                  // Flussufer: Kies/Schlamm
    r += (0.47 - r) * kies; g += (0.43 - g) * kies; b += (0.34 - b) * kies;
    // Fels: steile Hänge, Hochgebirge über der Baumgrenze – Farbe nach Gestein
    const fels = Math.max(1 - glatt(0.7, 0.85, flach), glatt(1, -4, p.temp + (v - 0.5) * 3) * (0.4 + 0.6 * p.gebirge));
    const hell = 0.9 + 0.2 * v;
    r += (p.fr * hell - r) * fels; g += (p.fg * hell - g) * fels; b += (p.fb * hell - b) * fels;
    // Schnee, wo es kalt genug ist (Temperatur sinkt mit der Höhe), nicht an Steilwänden
    const schnee = glatt(-3, -7, p.temp + (v - 0.5) * 3) * glatt(0.6, 0.78, flach);
    r += (0.94 - r) * schnee; g += (0.95 - g) * schnee; b += (0.97 - b) * schnee;
    // Gegraben/aufgeschüttet: offener Boden – oben Erde, tiefer Lehm, ab ~2 m das Gestein
    const e = Math.abs(p.eingriff || 0);
    if (e > 0.05) {
      const k = glatt(0.05, 0.3, e), tief = -(p.eingriff || 0);
      let er = 0.3, eg = 0.22, eb = 0.14;
      if (tief > 0.4) { const t = glatt(0.4, 0.9, tief); er += (0.6 - er) * t; eg += (0.43 - eg) * t; eb += (0.28 - eb) * t; }
      if (tief > 1.8) { const t = glatt(1.8, 2.4, tief); er += (p.fr - er) * t; eg += (p.fg - eg) * t; eb += (p.fb - eb) * t; }
      r += (er - r) * k; g += (eg - g) * k; b += (eb - b) * k;
    }
    out[0] = r; out[1] = g; out[2] = b;
    return out;
  }

  /** Fleckenrauschen 0…1 (Waldflecken, Farbvariation) – gleich wie in farbe(). */
  const flecken = (dx, dy, dz) => n(dx * R / 700 + 5.5, dy * R / 700, dz * R / 700 - 3.3) * 0.5 + 0.5;

  return { radius: R, seed, probe, hoehe, oberflaeche, farbe, flecken, G, eingriffe };
}

/** Felder von probe(), die der Kachelbau je Punkt für die Farbe aufhebt. */
export const FELDER = ['h', 'wasser', 'ufer', 'gebirge', 'meer', 'temp', 'feuchte', 'fr', 'fg', 'fb', 'eingriff'];
