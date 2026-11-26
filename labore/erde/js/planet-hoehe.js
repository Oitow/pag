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
  const W_WARP = ZK * 2.6, WARP = (ZK * 0.32) / R;
  // Vulkane: Gipfel und Krater sind kleiner als eine Geologie-Zelle (~800 m) und würden weggeglättet → hier fein nachformen.
  // rad = Kegelradius (Bogenmaß); Krater ≈ 0,16·rad (~500 m), Kraterrand als Grat, Lava am Kraterboden.
  const VULK = (geo.vulkane || []).filter((v) => v.rad).map((v) => ({ ...v, cosMax: Math.cos(v.rad * 1.4) }));

  function fbmBis(x, y, z, welle, feinste, maxOkt, versatz) {
    let sum = 0, amp = 1, norm = 0, w = welle;
    for (let o = 0; o < maxOkt; o++) {
      const g = glatt(feinste, feinste * 2, w);
      if (g <= 0) break;
      const f = 1 / w;
      sum += amp * g * n(x * f + versatz, y * f - versatz, z * f + o * 17.3);
      norm += amp; amp *= 0.5; w *= 0.5;
    }
    return norm ? sum / norm : 0;
  }
  function gratBis(x, y, z, welle, feinste, maxOkt, scharf = 0) {
    let sum = 0, amp = 0.5, prev = 1, w = welle;
    for (let o = 0; o < maxOkt; o++) {
      const g = glatt(feinste, feinste * 2, w);
      if (g <= 0) break;
      const f = 1 / w;
      let v = 1 - Math.abs(n(x * f + 91.7, y * f + 3.1, z * f - 47.9 + o * 5.1));
      v *= v;
      if (scharf > 0) v *= 1 - scharf + scharf * v;                               // Hochgebirge: spitzere Gipfel, schmalere Grate
      sum += v * amp * prev * g; prev = v; amp *= 0.5; w /= 2.1;
    }
    return Math.min(1, sum * (1.1 + 0.3 * scharf));
  }

  const aus = { vulkan: 0, lava: 0, eingriff: 0, h: 0, wasser: -Infinity, ufer: 0, fluss: 0, gebirge: 0, meer: 0, temp: 0, feuchte: 0, fr: 0, fg: 0, fb: 0, gestein: 0 };

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
    let detail = 0;
    if (gb > 0.01) {
      // Hochgebirge: Domain-Warp bricht die Grate auf, höhenabhängige Schärfe macht Gipfel markanter, Kare höhlen Talmulden aus
      const sch = glatt(500, 2400, Hm) * gb;
      let gx = x, gz = z;
      if (sch > 0.05 && feinste < 1500) { gx += 420 * n(x / 4300 + 7.7, y / 4300, z / 4300); gz += 420 * n(x / 4300, y / 4300 - 5.2, z / 4300 + 1.3); }
      detail += (gratBis(gx, y, gz, 2600, feinste, 7, sch) - 0.3) * 700 * gb;
      if (feinste < 1500) {
        const kar = glatt(0.3, 0.62, 0.5 + 0.5 * n(x / 1500 + 63, y / 1500, z / 1500 - 21)) * glatt(600, 1400, Hm) * (1 - glatt(2600, 3600, Hm));
        detail -= kar * 120 * gb;                                                  // Mulde mit flachem Boden und steilen Wänden
      }
    }
    detail += fbmBis(x, y, z, 700, feinste, 6, 13.7) * (14 + 45 * (1 - gb)) * land;
    detail += fbmBis(x, y, z, 55, feinste, 4, 41.1) * 1.3 * land;
    detail += fbmBis(x, y, z, 1800, feinste, 3, 5.5) * 120 * (1 - land); // Meeresgrund

    let wasser = -Infinity, ufer = 0, fluss = 0;
    // See: Spiegel flach aus den See-Zellen der Umgebung (nicht zwischen See und Land interpolieren –
    // sonst steigt das Wasser am Ufer den Hang hinauf). Ufer = wo das Gelände den Spiegel schneidet.
    let see = -Infinity;
    for (let i = 0; i < 4; i++) { const c = gw.z[i]; if (GF[c] > GH[c] + 1 && GF[c] > 0 && GF[c] > see) see = GF[c]; }
    if (see > -Infinity) { wasser = see; detail *= glatt(see, see - 25, Hm); }
    if (Fm < 0.5) wasser = 0;                                                         // Meer
    // Küstenklippen: grenzt hohes Land (Nachbarzellen) ans Meer, springt das Ufer steil hoch statt flach auszulaufen
    let klippe = 0;
    if (Hm > -8 && Hm < 90 && see === -Infinity) {
      let hmax = Hm;
      for (let i = 0; i < 4; i++) { const hc = GH[gw.z[i]]; if (hc > hmax) hmax = hc; }
      if (hmax > 70) klippe = Math.min(60, hmax * 0.3) * glatt(70, 380, hmax) * glatt(-0.35, 0.25, n(x / 2600 + 12.5, y / 2600, z / 2600 + 3.7));
    }
    // Dünen in heißen, trockenen Ebenen: scharfe Kämme (gestreckt, Wellenlänge ~250 m), dazu Sandriffeln
    const fe0 = G.lese(GFe, gw), t0 = G.lese(GT, gw);
    // Tafelberge/Terrassen in trockenen, warmen Gegenden (Steppe/Halbwüste, v. a. Sandstein/Kalk): Höhe in Stufen, Schluchten
    const klima = glatt(0.4, 0.2, fe0) * glatt(7, 14, t0);
    let mesa = 0;
    if (klima > 0.01) {
      let kalk = 0;
      for (let i = 0; i < 4; i++) if (GS[gw.z[i]] <= 1) kalk += gw.w[i];
      mesa = klima * glatt(10, 90, Hm) * (1 - glatt(0.15, 0.5, gb)) * (1 - glatt(1900, 2600, Hm)) * (0.3 + 0.7 * Math.min(1, kalk));
    }
    const wueste = glatt(0.24, 0.1, fe0) * glatt(10, 18, t0) * glatt(0, 60, Hm) * (1 - gb) * (1 - mesa);
    if (wueste > 0.01 && feinste < 120) {
      const kamm = 1 - Math.abs(n(x / 300 + 31.7, y / 110 - 8.2, z / 300 + 2.9));
      const duene = kamm * kamm * (0.6 + 0.4 * n(x / 1500, y / 1500 + 9.1, z / 1500)) * 22;
      const riffel = feinste < 6 ? (1 - Math.abs(n(x / 9, y / 4, z / 9))) * 0.25 : 0;
      detail = detail * (1 - 0.7 * wueste) + (duene + riffel) * wueste;
    }
    let h = Hm + detail + klippe * glatt(1, 14, Hm + detail) - klippe * 0.4 * glatt(0, -10, Hm);
    const mfein = mesa * (1 - glatt(120, 500, feinste));                            // Stufenkanten nur, wo die Kachel sie auflöst
    if (mfein > 0.01) {
      // Höhenlinien-Relief, dann in Stufen (~26 m) gequantelt: flacher Absatz, schmale steile Felskante (Härte je Schicht verschieden)
      let hr = h + mesa * (n(x / 2200 + 2.2, y / 2200, z / 2200 + 8.1) * 46 + (feinste < 350 ? n(x / 700, y / 700 + 4.4, z / 700) * 14 : 0));
      const s = hr / 26, f = Math.floor(s), fr = s - f;
      const hart = 0.62 + 0.28 * (Math.sin(f * 12.9898) * 0.5 + 0.5);
      hr = (f + glatt(hart, 1, fr)) * 26;
      h += (hr - h) * mfein;
    }
    let vulkan = 0, lava = 0;
    for (const v of VULK) {
      const cs = dx * v.d[0] + dy * v.d[1] + dz * v.d[2];
      if (cs < v.cosMax) continue;
      const w = Math.acos(Math.min(1, cs)) / v.rad, kr = 0.16;
      const spitze = v.hoch * 0.3 * Math.max(0, 1 - w / 0.55) ** 2;              // Gipfel nachschärfen
      const rand = v.hoch * 0.05 * Math.exp(-(((w - kr) / 0.06) ** 2));            // Kraterrand
      const krater = w < kr ? v.hoch * 0.2 * (1 - (w / kr) ** 2) ** 0.6 : 0;        // Schüssel
      h += spitze + rand - krater - detail * glatt(0.6, 0.2, w) * 0.7;             // oben kaum Hügel-Rauschen
      vulkan = Math.max(vulkan, glatt(0.95, 0.35, w));
      lava = Math.max(lava, glatt(kr * 0.6, kr * 0.35, w));
    }

    // Flüsse: nächste Abfluss-Strecke (Zelle → Ziel) in der Nachbarschaft
    if (Hm > -5) {
      let best = Infinity, bLevel = 0, bBreite = 0;
      const canyon = 24 * klima * (1 - glatt(0.2, 0.5, gb));                       // nur aus Klima (langsam veränderlich) → Fluss läuft weiter bergab
      const c0 = gw.naechste;
      for (let k = -1; k < 8; k++) {
        const c = k < 0 ? c0 : nb[c0 * 8 + k];
        if (c < 0 || GA2[c] < AMIN || GH[c] < -2 || GF[c] > GH[c] + 1) continue; // im See: kein eigenes Bett
        const d = GA[c];
        if (d < 0) continue;
        const ax = dir[c * 3], ay = dir[c * 3 + 1], az = dir[c * 3 + 2];
        const bx = dir[d * 3] - ax, by = dir[d * 3 + 1] - ay, bz = dir[d * 3 + 2] - az;
        const t = Math.max(0, Math.min(1, ((qx - ax) * bx + (qy - ay) * by + (qz - az) * bz) / (bx * bx + by * by + bz * bz)));
        const ex = qx - ax - bx * t, ey = qy - ay - by * t, ez = qz - az - bz * t;
        const dist = Math.hypot(ex, ey, ez) * R;
        const breite = flussBreite(GA2[c]);
        if (dist - breite / 2 < best) {
          best = dist - breite / 2;
          bBreite = breite;
          bLevel = Math.max(0, GF[c] + (Math.max(0, GF[d]) - GF[c]) * t - canyon);
        }
      }
      if (best < Infinity) {
        const halb = bBreite / 2, tal = (30 + bBreite * 2.5) * (1 - 0.5 * canyon / 24);
        const dist = best + halb;
        if (dist < halb + tal) {
          // Talsohle/Ufer: Gelände senkt sich sanft zum Fluss, nie unter den Wasserspiegel
          let k = glatt(halb, halb + tal, dist);
          if (canyon > 3) k = k ** (1 - 0.6 * canyon / 24);                          // Canyon: steile Wände statt sanftem Tal
          const ufH = bLevel + 0.4 + (dist - halb) * 0.06;
          h = ufH + (h - ufH) * k;
          if (h < bLevel + 0.3) h = bLevel + 0.3;
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
    aus.vulkan = vulkan; aus.lava = lava; aus.eingriff = dE; aus.h = h; aus.wasser = wasser; aus.ufer = ufer; aus.fluss = fluss; aus.gebirge = gb; aus.meer = meer; // Klippen/Terrassen stecken schon in h
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
    const trocken = glatt(0.4, 0.18, p.feuchte - 0.25 * p.ufer) * glatt(6, 14, p.temp);   // Steppe/Halbwüste: Canyon-Ufer in Gesteinsfarbe
    const kr = 0.47 + (p.fr * 0.85 - 0.47) * trocken, kg = 0.43 + (p.fg * 0.8 - 0.43) * trocken, kb = 0.34 + (p.fb * 0.75 - 0.34) * trocken;
    r += (kr - r) * kies; g += (kg - g) * kies; b += (kb - b) * kies;
    // Fels: steile Hänge, Hochgebirge über der Baumgrenze – Farbe nach Gestein
    const fels = Math.max(1 - glatt(0.7, 0.85, flach), glatt(1, -4, p.temp + (v - 0.5) * 3) * (0.4 + 0.6 * p.gebirge));
    let hell = 0.9 + 0.2 * v;
    // Schichtung der Felswände: waagrechte Streifen (stark in Terrassen-Gegenden), feine Maserung nur nah genug
    if (fels > 0.25) {
      const st = Math.sin(h * 0.55 + 2.2 * n(x / 90, y / 90, z / 90)) * 0.5 + Math.sin(h * 0.13 + 1.7) * 0.5;
      hell *= 1 + st * (0.04 + 0.1 * trocken) * fels;
    }
    r += (p.fr * hell - r) * fels; g += (p.fg * hell - g) * fels; b += (p.fb * hell - b) * fels;
    // Geröll/Schutthalden: helleres, graues Gestein an mittelsteilen Hängen unter den Felswänden (Gebirge, Klippen)
    const schutt = glatt(0.5, 0.64, flach) * (1 - glatt(0.76, 0.9, flach)) * Math.max(p.gebirge * 1.3, glatt(15, 60, h) * (p.meer ? 0.5 : 0.3)) * glatt(0.2, 0.55, n(x / 40 + 3.1, y / 40, z / 40 - 8.8) * 0.5 + 0.5 + 0.3 * (v - 0.5)) * (1 - glatt(-2, -6, p.temp));
    if (schutt > 0.01) {
      const gr = (p.fr + p.fg + p.fb) / 3 * 0.55 + 0.4;
      r += (gr * 1.02 - r) * schutt * 0.8; g += (gr - g) * schutt * 0.8; b += (gr * 0.97 - b) * schutt * 0.8;
    }
    // Vulkan: dunkles Lavagestein und Asche zum Gipfel hin, Lava (glüht im Shader) am Kraterboden
    if (p.vulkan > 0) {
      const a = p.vulkan * 0.85 * (0.8 + 0.2 * v);
      r += (0.25 - r) * a; g += (0.22 - g) * a; b += (0.2 - b) * a;
    }
    if (p.lava > 0) { // glühende Lava mit erstarrten Krustenschollen (dunkel, glühen nicht)
      const kr = glatt(0.05, 0.3, n(x / 45 + 7.7, y / 45, z / 45 - 1.9) + 0.4 * n(x / 12, y / 12 + 3.3, z / 12));
      const lr = 1 - 0.78 * kr, lg = 0.32 - 0.12 * kr, lb = 0.04 + 0.12 * kr;
      r += (lr - r) * p.lava; g += (lg - g) * p.lava; b += (lb - b) * p.lava; out[0] = r; out[1] = g; out[2] = b; return out;
    }
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
export const FELDER = ['vulkan', 'lava', 'h', 'wasser', 'ufer', 'gebirge', 'meer', 'temp', 'feuchte', 'fr', 'fg', 'fb', 'eingriff'];
