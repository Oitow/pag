/**
 * @modul    figur-kleidung-unten
 * @zweck    Unterteil der organischen Figur als SDF-Körper: Hose (lang, kurz, Pluder), Röcke/Roben/Mantelschöße mit Saum, Schürze, Gürtel mit Schnalle und Tasche, Schuhe je Stil
 * @api      baueUnterteil(form, ctx, haut) -> form ; baueGuertel(form, ctx, haut) -> form ; baueSchuhe(form, ctx, haut) -> form   (haut = messeHaut)
 * @beispiel
 *   import { baueUnterteil, baueGuertel, baueSchuhe } from './figur-kleidung-unten.js';
 *   const haut = messeHaut(form, ctx);  baueUnterteil(form, ctx, haut); baueGuertel(form, ctx, haut); baueSchuhe(form, ctx, haut);
 * @tags     figur, charakter, organisch, sdf, kleidung, hose, rock, robe, gürtel, tasche, schuhe, stiefel
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { masse, rumpfGewichte, rockGewichte, glocke, kegel, dunkler, heller, GOLD, LEDER } from './figur-kleidung-basis.js';

/** Hosenbein-Teile je Seite nach gemessener Haut: ab = 'oben' (ganzes Bein), 'unten' (nur Unterschenkel, unter Knie-Röcken). */
function beine(form, K, H, farbe, ab = 'oben') {
  const { g, m, P } = K, st = K.stil.hose, { e } = masse(K), O = m.oberschenkel, U = m.unterschenkel;
  const stiefel = K.stil.schuhe === 'stiefel';
  for (const s of ['L', 'R']) {
    const Hu = 'huefte' + s, Kn = 'knie' + s, F = 'fuss' + s, w = 1.04;
    const [o0, o1] = kegel(H.glied(Hu, -0.06 * g) * w + e, H.glied(Hu, -O * 0.45) * w + e, H.glied(Hu, -O) * w + e, 0.45);
    const [u0, u1] = kegel(H.glied(Kn, 0) * w + e, H.glied(Kn, -U * 0.3) * w + e, H.glied(F, 0.03 * g) * w + e, 0.3);
    if (ab === 'oben') {
      if (st === 'pluder') form.ellipsoid(P(Hu, [0, -O * 0.48, 0]), [o0 * 1.3, O * 0.56, o0 * 1.25], { knochen: Hu, farbe, glatt: 0.025 * g, dreh: K.dreh(Hu), rauh: 0.0025 * g, rauhSkala: 24 });
      else form.kapsel(P(Hu, [0, 0.02 * g, 0]), P(Hu, [0, st === 'kurz' ? -O * 0.6 : -O, 0]), o0, st === 'kurz' ? H.glied(Hu, -O * 0.6) * w + e + 0.006 * g : o1, { knochen: Hu, farbe, glatt: 0.02 * g });
    }
    if (st === 'kurz') continue;
    if (st === 'pluder') form.ellipsoid(P(Kn, [0, -U * 0.1, 0]), [u0 * 1.15, U * 0.17, u0 * 1.15], { knochen: Kn, farbe, glatt: 0.02 * g, dreh: K.dreh(Kn), rauh: 0.002 * g, rauhSkala: 24 });
    if (!stiefel || st === 'pluder' || ab === 'unten') form.kapsel(P(Kn, [0, 0.01 * g, 0]), P(F, [0, stiefel ? 0.15 * g : 0.04 * g, 0]), u0, u1, { knochen: Kn, farbe, glatt: 0.015 * g });
    else form.kapsel(P(Kn, [0, 0.01 * g, 0]), P(Kn, [0, -U * 0.55, 0]), u0, Math.max(u1, H.glied(Kn, -U * 0.55) * w + e), { knochen: Kn, farbe, glatt: 0.015 * g });
  }
  return form;
}

/** Unterschenkel ab Anteil ab (0 = Knie) bis Knöchel neu (unter abgeschnittenen Rocksäumen); farbe null = Haut. Barfuß/Sandalen auch den Fuß. */
function unterschenkel(form, K, H, farbe, ab) {
  const { g, m, P, f } = K, U = m.unterschenkel, haut = farbe == null, e = haut ? 0 : masse(K).e;
  const o = haut ? { farbe: f.haut, haut: true } : { farbe };
  for (const s of ['L', 'R']) {
    const Kn = 'knie' + s, F = 'fuss' + s;
    form.kapsel(P(Kn, [0, -U * ab, 0]), P(F, [0, 0.03 * g, 0]), H.glied(Kn, -U * Math.min(ab, 0.5)) + e, H.glied(F, 0.03 * g) + e, { knochen: Kn, glatt: 0.015 * g, ...o });
    if (K.stil.schuhe === 'barfuss' || K.stil.schuhe === 'sandalen') {
      const fu = H.fuss(s), hb = Math.max(0.025 * g, fu.halb * 0.9);
      form.kapsel([fu.x, hb * 0.8, fu.ferse + hb], [fu.x, hb * 0.7, fu.spitze - hb * 0.8], hb, hb * 0.85, { knochen: F, farbe: f.haut, haut: true, glatt: 0.02 * g, tief: 0.75 });
    }
  }
}

/** Hose bzw. Rock/Robe/Schöße (ctx.rock: 'lang' → bis zu den Knöcheln, 'knie' → bis zum Knie). */
export function baueUnterteil(form, K, H) {
  const { f, g, m, P, w } = K, st = K.stil.ober, { e, L, T } = masse(K), B = H.becken;
  const yB = P('becken')[1], yTop = T(0.04 * L)[1], r04 = H.rumpf(0.04 * L), rTop = Math.max(r04.x, r04.rz / 0.85) + e;
  const rBeine = B.x;                                                    // äußere Hüftbreite inkl. Oberschenkel (gemessen)
  if (!K.rock) {
    if (st === 'mantel') {                                               // Mantelschöße bis zum Knie, vorn offen (Saum nach hinten versetzt); vor der Hose, weil der Schnitt die Beine kürzt
      const rU = Math.max(0.25 * g * Math.sqrt(w), rBeine + 0.06 * g);
      glocke(form, K, { yOben: yTop + 0.02 * g, yUnten: P('knieL')[1] + 0.02 * g, rOben: rTop + 0.004 * g, rUnten: rU, tief: 0.72, hinten: rU * 0.72 - 0.06 * g, z0: B.zc,
        farbe: f.ober, saum: f.akzent, knochen: rockGewichte(K, 0.4), schnitt: true });
      if (K.stil.hose === 'kurz') unterschenkel(form, K, H, null, 0);
    }
    const r0 = H.rumpf(0);
    const B0 = H.becken0, k = 1 / 0.92;
    form.ellipsoid(P('becken', [0, -0.03 * g, (B.zc + B0.zc) / 2]), [(Math.max(B0.x, B.x * 0.85) + e) * k, 0.125 * g, (Math.max(B0.rz, B.rz) + e) * k], { knochen: 'becken', farbe: f.hose, glatt: 0.02 * g });   // Gesäß
    form.ellipsoid(T(-0.01 * g, 0, r0.zc), [r0.x + e + 0.007 * g, 0.065 * g, r0.rz + e + 0.007 * g], { knochen: rumpfGewichte(K), farbe: f.hose, glatt: 0.012 * g });               // Bund (deckt auch einen Bauch)
    beine(form, K, H, f.hose);
  } else {
    const lang = K.rock === 'lang', yFuss = P('fussL')[1];
    const yS = lang ? yFuss + 0.075 * g : P('knieL')[1] - 0.03 * g;
    const rU = Math.max((lang ? 0.26 : 0.225) * g * Math.sqrt(w), rBeine + 0.05 * g), robe = st === 'robe' || st === 'kleid';
    const farbe = st === 'robe' || (st === 'kleid' && !lang) || K.stil.hose !== 'rock' ? f.ober : f.hose, kn = rockGewichte(K, 0.5);
    form.ellipsoid(P('becken', [0, -0.08 * g, B.zc]), [rBeine + e + 0.02 * g, 0.17 * g, B.rz + e + 0.015 * g], { knochen: kn, farbe, glatt: 0.03 * g });   // Hüfte (Beine stoßen sonst seitlich durch)
    if (st === 'kleid' && lang) {                                          // Überrock in Kleidfarbe bis übers Knie (vor dem langen Rock, damit dessen Kegel ihn nicht abschneidet)
      glocke(form, K, { yOben: yTop + 0.01 * g, yUnten: P('knieL')[1] + 0.06 * g, rOben: rTop + 0.006 * g, rUnten: rU * 0.86 + 0.03 * g, tief: 0.85,
        farbe: f.ober, saum: dunkler(f.ober, 0.2), knochen: rockGewichte(K, 0.45), schnitt: true, glatt: 0.04 * g });
    }
    glocke(form, K, { yOben: yTop, yUnten: yS, rOben: rTop, rUnten: rU, tief: 0.85, farbe, saum: robe ? f.akzent : dunkler(farbe, 0.25), knochen: kn, schnitt: true, glatt: 0.04 * g });
    if (lang) for (const a of [-0.6, 0.6, Math.PI]) {                     // Fallfalten: weiche Rillen vom Knie zum Saum
      const rr = (y) => rTop + (rU - rTop) * (yTop - y) / (yTop - yS);
      const y0 = P('knieL')[1] + 0.1 * g, y1 = yS + 0.04 * g;
      form.kapsel([Math.sin(a) * rr(y0), y0, Math.cos(a) * rr(y0) * 0.85], [Math.sin(a) * rr(y1) * 0.99, y1, Math.cos(a) * rr(y1) * 0.85 * 0.99], 0.004 * g, 0.014 * g,
        { abzug: true, knochen: kn, farbe: dunkler(farbe, 0.15), glatt: 0.02 * g });
    }
    // Unter dem Saum abgeschnittene Unterschenkel neu: Hose bzw. Haut
    const bein = K.stil.hose === 'kurz' || K.stil.hose === 'rock' ? null : f.hose;
    if (!lang && bein) beine(form, K, H, bein, 'unten');
    else unterschenkel(form, K, H, bein, lang ? 0.55 : 0.05);
  }
  // Schürze: Vorderbahn über Rock bzw. Hose
  if (st === 'schuerze') {
    const lang = K.rock === 'lang', y1 = yB + 0.04 * g, y0 = lang ? P('knieL')[1] - 0.12 * g : P('knieL')[1] + 0.08 * g;
    const yS = P('fussL')[1] + 0.075 * g, rU = Math.max(0.26 * g * Math.sqrt(w), rBeine + 0.05 * g);
    const rockZ = (y) => 0.85 * (rTop + (rU - rTop) * (yTop - y) / (yTop - yS)) + 0.014 * g;
    const z1 = Math.max(B.zc + B.rz + e + 0.02 * g, lang ? rockZ(y1) : 0), z0 = lang ? rockZ(y0) : z1 + 0.03 * g;
    form.rundbox([0, (y0 + y1) / 2, (z0 + z1) / 2], [0.1 * g * w, (y1 - y0) / 2, 0.009 * g], 0.006, { knochen: rockGewichte(K, 0.35), farbe: f.akzent, glatt: 0.008 * g, dreh: [Math.atan2(z1 - z0, y1 - y0), 0, 0] });
    form.ellipsoid(P('becken', [0, 0.06 * g, -(H.rumpf(0).hinten + e + 0.012 * g)]), [0.045 * g, 0.025 * g, 0.014 * g], { knochen: 'becken', farbe: f.akzent, glatt: 0.008 * g });   // Schleife
  }
  return form;
}

/** Gürtel (f.guertel, null = keiner) als flaches Band mit Schnalle; Tasche (L.tasche) an der linken Hüfte. */
export function baueGuertel(form, K, H) {
  const { f, g } = K, { e, L, T } = masse(K), kn = rumpfGewichte(K);
  const y = 0.03 * L, h = H.rumpf(y), ueber = K.rock || ['kittel', 'ruestung', 'kettenhemd', 'lederruestung', 'mantel'].includes(K.stil.ober) ? 0.006 * g : 0;
  const dicke = 0.012 * g + ueber, ax = h.x + e + dicke, az = Math.max(h.rz, h.x * 0.6) + e + dicke, zc = h.zc;
  if (f.guertel != null) {
    form.ellipsoid(T(y, 0, zc), [ax, 0.032 * g, az], { knochen: kn, farbe: f.guertel, glatt: 0.006 * g });
    form.rundbox(T(y, 0, zc + az + 0.002), [0.022 * g, 0.02 * g, 0.006 * g], 0.004, { knochen: 'becken', farbe: GOLD, glatt: 0.004 });
  }
  if (K.L.tasche) {
    const x = ax * 0.92, ty = T(y)[1] - 0.055 * g;
    form.rundbox([x, ty, 0.03 * g], [0.02 * g, 0.045 * g, 0.04 * g], 0.014 * g, { knochen: 'becken', farbe: LEDER, glatt: 0.01 * g, dreh: [0, 0.3, 0.06], rauh: 0.0015, rauhSkala: 30 });
    form.rundbox([x + 0.006 * g, ty + 0.028 * g, 0.03 * g], [0.022 * g, 0.018 * g, 0.042 * g], 0.008 * g, { knochen: 'becken', farbe: dunkler(LEDER, 0.25), glatt: 0.004, dreh: [0, 0.3, 0.06] });
  }
  return form;
}

/** Schuhe je Stil (barfuss = nichts). Sohle flach bei y = 0, Zehen nach +Z. */
export function baueSchuhe(form, K, H) {
  const { f, g, m, P } = K, st = K.stil.schuhe, { e } = masse(K);
  if (st === 'barfuss') return form;
  const sohle = 0.009 * g, c = f.schuh;
  for (const s of ['L', 'R']) {
    const F = 'fuss' + s, Kn = 'knie' + s, fu = H.fuss(s), x = fu.x, halb = Math.max(fu.halb, 0.03 * g) + e;
    const zH = fu.ferse - e, zT = fu.spitze + e, zm = (zH + zT) / 2, lang = zT - zH;
    form.rundbox([x, sohle, zm], [halb * 1.04, sohle, lang / 2 + 0.004 * g], 0.006 * g, { knochen: F, farbe: dunkler(c, 0.45), glatt: 0.004 });   // Sohle
    if (st === 'sandalen') {
      form.ring([x, 2 * sohle, zm + lang * 0.18], halb, 0.006 * g, { knochen: F, farbe: c, glatt: 0.004, dreh: [Math.PI / 2 - 0.3, 0, 0] });
      form.ring(P(F, [0, 0.004 * g, -0.004 * g]), H.glied(F, 0.03 * g) + 0.004 * g, 0.006 * g, { knochen: { [F]: 0.5, [Kn]: 0.5 }, farbe: c, glatt: 0.004 });
      continue;
    }
    // Oberschuh: Kapsel Ferse → Zehen, flach gedrückt (tief wirkt bei Achse +Z senkrecht), oben über den Rist
    const hoch = Math.max(fu.oben + e - 2 * sohle, 0.05 * g), ra = halb, tief = Math.min(1, hoch / (2 * ra) + 0.08), yk = 2 * sohle + ra * tief * 0.95;
    const rb = ra * 0.88;
    form.kapsel([x, yk, zH + ra], [x, yk - 0.004 * g, zT - rb], ra, rb, { knochen: F, farbe: c, glatt: 0.014 * g, tief });
    if (st !== 'stiefel') form.kugel(P(F, [0, 0.004 * g, -0.008 * g]), H.glied(F, 0.03 * g) + e + 0.002 * g, { knochen: { [F]: 0.6, [Kn]: 0.4 }, farbe: c, glatt: 0.02 * g });   // Knöchel umschließen
    if (st === 'schnabelschuhe') {
      form.kapsel([x, yk - 0.004 * g, zT - rb], [x, yk + 0.035 * g, zT + m.fussLaenge * 0.28], rb * 0.85, 0.005 * g, { knochen: F, farbe: c, glatt: 0.012 * g });
      form.kugel([x, yk + 0.037 * g, zT + m.fussLaenge * 0.29], 0.009 * g, { knochen: F, farbe: heller(c, 0.3), glatt: 0.003 });
    } else if (st === 'stiefel') {
      const U = m.unterschenkel, r0 = H.glied(F, 0.03 * g) + e + 0.004 * g, r1 = Math.max(H.glied(Kn, -U * 0.5), H.glied(Kn, -U * 0.3) * 0.95) + e + 0.008 * g;
      form.kapsel(P(F, [0, 0.005 * g, -0.005 * g]), P(Kn, [0, -U * 0.48, 0]), r0, r1, { knochen: Kn, farbe: c, glatt: 0.014 * g });   // Schaft
      form.ellipsoid(P(Kn, [0, -U * 0.47, 0]), [r1 + 0.008 * g, 0.026 * g, r1 + 0.008 * g], { knochen: Kn, farbe: dunkler(c, 0.18), glatt: 0.008 * g, dreh: K.dreh(Kn) });   // Stulpe
    }
  }
  return form;
}
