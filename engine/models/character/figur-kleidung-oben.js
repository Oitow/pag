/**
 * @modul    figur-kleidung-oben
 * @zweck    Oberteil der organischen Figur als SDF-Körper: Rumpf-Hülle, Schulterpartie, Kragen/Ausschnitt, Ärmel, Säume, Knöpfe, Rüstungsplatten – je Oberteil-Stil
 * @api      baueOberteil(form, ctx, haut) -> form ; baueAermel(form, ctx, haut) -> form ; platte(form, a, b, breite, farbe, knochen)   (haut = messeHaut aus figur-kleidung-basis)
 * @beispiel
 *   import { baueOberteil, baueAermel } from './figur-kleidung-oben.js';
 *   const haut = messeHaut(form, ctx);  baueAermel(baueOberteil(form, ctx, haut), ctx, haut);
 * @tags     figur, charakter, organisch, sdf, kleidung, oberteil, ärmel, rüstung, robe, mantel
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { masse, rumpfGewichte, glocke, strahl, dunkler, heller, GOLD } from './figur-kleidung-basis.js';

/** Stile, bei denen Hals und oberste Brust Haut zeigen (wie die alten Teile: Nacken in Hautfarbe). */
const HAUT_KRAGEN = new Set(['kittel', 'kleid', 'weste', 'schuerze']);

/** Flache Stoff- oder Metallbahn (Wappenrock, Schürze) von Punkt a nach b (Figur-Koordinaten), Fläche zeigt nach ±Z. */
export function platte(form, a, b, breite, farbe, knochen, dicke = 0.009) {
  const dy = a[1] - b[1], dz = a[2] - b[2], l = Math.hypot(dy, dz);
  return form.rundbox([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [breite / 2, l / 2, dicke], 0.004, { knochen, farbe, glatt: 0.008, dreh: [Math.atan2(dz, dy), 0, 0] });
}

/** Rumpf-Hülle + stil-typische Teile. */
export function baueOberteil(form, K, H) {
  const { f, g, m, P } = K, st = K.stil.ober, { e, L, T } = masse(K), w = K.w;
  const kn = rumpfGewichte(K), ketten = st === 'kettenhemd';
  const rauh = ketten ? { rauh: 0.0028 * g, rauhSkala: 40 } : st === 'lederruestung' ? { rauh: 0.0012, rauhSkala: 30 } : {};
  const hinten = st === 'weste' ? e * 2.2 : 0;                       // Weste: Hülle nach hinten versetzt → vorn offen
  const vorn = (y, d = 0) => H.rumpf(y).vorn + e + d;                // z der Stoff-Vorderseite in Höhe y (Torso-Knochen)
  const stoff = { farbe: f.ober, glatt: 0.02 * g, ...rauh };

  // Rumpf: Kegel-Kapsel Taille → Brust nach gemessener Haut (+ Stoffdicke), Kuppe rundet die Schultern
  const y0 = 0.08 * L, y1 = st === 'kleid' ? 0.52 * L : 0.56 * L, a = H.rumpf(y0);
  // oberes Ende umschließt die ganze Brust (0.42…0.64 L): größte Breite, weiteste Vorder- und Rückseite
  const bs = [0.42, 0.5, 0.56, 0.64].map((t) => H.rumpf(t * L)), vM = Math.max(...bs.map((q) => q.vorn)), hM = Math.max(...bs.map((q) => q.hinten));
  const b = { x: Math.max(...bs.map((q) => q.x)), zc: (vM - hM) / 2, rz: (vM + hM) / 2 };
  const ra = a.x + e, rb = b.x + e, tief = Math.min(1, Math.max(0.5, (a.rz + e) / ra, (b.rz + e) / rb));
  // Weste: Kante der Öffnung suchen (wo die versetzte Hülle die Haut schneidet), solange der Rumpf noch nackt ist
  const kante = (y) => {
    const t = (y - y0) / (y1 - y0), rx = ra + (rb - ra) * t, zc = a.zc + (b.zc - a.zc) * t - hinten;
    for (let x = 0; x < rx; x += 0.003) {
      const p = T(y, x, 0), zs = p[2] + strahl(form, p, [0, 0, 1]);
      if (zc + rx * tief * Math.sqrt(1 - (x / rx) ** 2) >= zs + 0.001) return [x, zs];
    }
    return [rx * 0.5, a.zc];
  };
  const kanten = st === 'weste' ? [kante(0.1 * L), kante(0.5 * L)] : null;
  form.kapsel(T(y0, 0, a.zc - hinten), T(y1, 0, b.zc - hinten), ra, rb, { knochen: kn, tief, ...stoff });
  let schlimm = null;                                                // Bauch/Brust ragt aus dem Kegel → Polster-Ellipsoid
  for (const y of [0.25 * L, 0.4 * L, 0.63 * L]) {
    const t = Math.min(1, (y - y0) / (y1 - y0)), zc = a.zc + (b.zc - a.zc) * t, h = H.rumpf(y);
    const r = y > y1 ? Math.sqrt(Math.max(0, rb * rb - (y - y1) ** 2)) : ra + (rb - ra) * t;   // über dem Ende: Kuppe
    const fehl = Math.max(h.vorn + e - (zc + r * tief), h.x + e - r, h.hinten + e - (r * tief - zc));
    if (fehl > 0.002 && (!schlimm || fehl > schlimm.fehl)) schlimm = { y, fehl, h, r };
  }
  if (schlimm && st !== 'weste') form.ellipsoid(T(schlimm.y, 0, schlimm.h.zc - hinten * 0.8), [Math.max(schlimm.h.x + e * 1.3, schlimm.r), (st === 'kleid' && schlimm.y > 0.5 * L ? 0.1 : 0.2) * L, schlimm.h.rz + e * 1.4 + hinten * 0.8], { knochen: kn, ...stoff, glatt: 0.04 * g });
  const hk = HAUT_KRAGEN.has(st), s3 = H.rumpf(0.78 * L), s6 = H.rumpf(0.66 * L), rzJ = Math.max(s3.rz, s6.rz * 0.95);
  form.ellipsoid(T(hk ? 0.79 * L : 0.81 * L, 0, s3.zc - hinten * 0.7),
    [m.schulterX + K.armR * 0.45 + e, (hk ? 0.075 : 0.095) * g, (st === 'kleid' ? rzJ * 0.85 : rzJ) + e + hinten * 0.7],
    { knochen: 'torso', ...stoff, glatt: 0.035 * g });

  // Kittel-/Rüstungs-/Kettensaum über der Hose (Röcke und Roben baut figur-kleidung-unten)
  const saumR = H.becken.x + 2 * e + 0.014 * g, saumTief = Math.min(1, Math.max(0.75, (H.becken.rz + 2 * e + 0.014 * g) / saumR));
  if (!K.rock && ['kittel', 'ruestung', 'kettenhemd', 'lederruestung'].includes(st)) {
    const yB = P('becken')[1], h = (ketten ? 0.27 : st === 'lederruestung' ? 0.2 : 0.21) * g, a0 = H.rumpf(0.04 * L);
    glocke(form, K, { yOben: T(0.04 * L)[1], yUnten: yB + 0.06 * g - h, rOben: Math.max(a0.x, a0.rz / saumTief) + e, rUnten: saumR, tief: saumTief, z0: H.becken.zc,
      farbe: st === 'ruestung' ? dunkler(f.ober, 0.1) : f.ober, saum: ketten ? dunkler(f.ober, 0.2) : st === 'lederruestung' ? dunkler(f.ober, 0.25) : f.akzent,
      knochen: kn, rauh: rauh.rauh || 0 });
  }
  const zSaum = H.becken.zc + saumR * saumTief + 0.008 * g;
  const ring = (y, R, r, farbe, kipp = 0.25) => form.ring(T(y, 0, 0.004 * g), Math.max(R * 0.8, H.hals + 0.004 * g + r * 0.3), r, { knochen: { torso: 0.6, hals: 0.4 }, farbe, glatt: 0.01 * g, dreh: K.dreh('torso', [kipp, 0, 0]) });
  const knopf = (y, x, farbe, r = 0.009 * g, d = 0) => form.kugel(T(y, x, vorn(y, d) - 0.002), r, { knochen: 'torso', farbe, glatt: 0.004 });
  // Flaches Band vorn (Robenstreifen, Wappenrock, Latz): Rundbox, der Brustwölbung nach geneigt
  const bahn = (y0, y1, breite, farbe, d = 0.004 * g, x = 0) => {
    const za = vorn(y0, d), zb = vorn(y1, d), h = (y1 - y0) / 2;
    form.rundbox(T((y0 + y1) / 2, x, (za + zb) / 2), [breite / 2, h, 0.008 * g], 0.005, { knochen: kn, farbe, glatt: 0.006 * g, dreh: K.dreh('torso', [Math.atan2(zb - za, y1 - y0), 0, 0]) });
  };

  if (st === 'kittel') {
    ring(0.96 * L, 0.062 * g, 0.011 * g, f.akzent);
    form.kapsel(T(0.7 * L, 0, vorn(0.7 * L)), T(0.9 * L, 0, vorn(0.9 * L) - 0.01 * g), 0.006 * g, 0.006 * g, { knochen: 'torso', farbe: f.akzent, glatt: 0.004 });   // Schnürschlitz
  } else if (st === 'hemd' || st === 'schuerze') {
    for (const s of [-1, 1]) form.rundbox(T(0.95 * L, s * 0.035 * g, vorn(0.9 * L) - 0.012 * g), [0.03 * g, 0.022 * g, 0.006 * g], 0.005,      // Kragenecken
      { knochen: 'torso', farbe: heller(f.ober, 0.2), glatt: 0.006 * g, dreh: K.dreh('torso', [-0.5, 0, s * 0.6]) });
    if (st === 'hemd') for (let i = 0; i < 3; i++) knopf(L * (0.35 + i * 0.17), 0, f.akzent, 0.008 * g);
    else {                                                                                                 // Latz + Träger
      bahn(0.25 * L, 0.8 * L, 0.15 * g * w, f.akzent, 0.006 * g);
      for (const s of [-1, 1]) form.kapsel(T(0.8 * L, s * 0.06 * g * w, vorn(0.8 * L, 0.004 * g)), T(1.0 * L, s * 0.08 * g * w, 0), 0.01 * g, 0.01 * g, { knochen: 'torso', farbe: f.akzent, glatt: 0.006 * g, tief: 0.6 });
    }
  } else if (st === 'robe') {
    bahn(0.05 * L, 0.88 * L, 0.06 * g, f.akzent);
    ring(0.99 * L, 0.066 * g, 0.02 * g, f.akzent, 0.2);
  } else if (st === 'ruestung') {
    const b6 = H.rumpf(0.6 * L);
    form.ellipsoid(T(0.6 * L, 0, b6.zc + 0.014 * g), [b6.x * 0.95 + e, 0.25 * L, b6.rz * 0.9 + e + 0.006 * g], { knochen: 'torso', farbe: heller(f.ober, 0.12), glatt: 0.012 * g });   // Brustplatte
    for (let i = 0; i < 2; i++) { const y = (0.1 + i * 0.12) * L, h = H.rumpf(y); form.ellipsoid(T(y, 0, h.zc), [h.x + e + 0.012 * g, 0.03 * g, h.rz + e + 0.012 * g], { knochen: kn, farbe: dunkler(f.ober, 0.06 + 0.06 * i), glatt: 0.006 * g }); }
    const za = vorn(0.45 * L, 0.02 * g), yU = P('becken')[1] - 0.19 * g, zU = zSaum;
    platte(form, [0, T(0.52 * L)[1], za], [0, yU, zU], 0.13 * g * w, f.akzent, kn);                       // Wappenrock, folgt dem Saum
    form.kugel([0, T(0.56 * L)[1], za + 0.008 * g], 0.022 * g, { knochen: 'torso', farbe: GOLD, glatt: 0.004 });
    for (const s of ['L', 'R']) form.ellipsoid(P('schulter' + s, [0, 0.012 * g, 0]), [K.armR * 1.75, K.armR * 1.15, K.armR * 1.65], { knochen: { ['schulter' + s]: 0.6, torso: 0.4 }, farbe: f.ober, glatt: 0.01 * g, dreh: K.dreh('schulter' + s) });
  } else if (st === 'weste') {
    const [[x0, z0], [x1, z1]] = kanten;
    for (const s of [-1, 1]) form.kapsel(T(0.1 * L, s * (x0 + 0.004), z0 + 0.002), T(0.5 * L, s * (x1 + 0.004), z1 + 0.002),
      0.0085 * g, 0.0085 * g, { knochen: kn, farbe: f.akzent, glatt: 0.006 * g });                           // Saumkanten genau auf der Öffnung
  } else if (st === 'kleid') {
    form.kapsel(T(0.7 * L, -0.07 * g * w, vorn(0.68 * L) - 0.002), T(0.7 * L, 0.07 * g * w, vorn(0.68 * L) - 0.002), 0.009 * g, 0.009 * g, { knochen: 'torso', farbe: f.akzent, glatt: 0.006 * g });   // Ausschnitt-Borte
    for (let i = 0; i < 3; i++) knopf(L * (0.2 + i * 0.15), 0, f.akzent, 0.008 * g);                      // Schnürung
  } else if (st === 'mantel') {
    for (const s of [-1, 1]) form.rundbox(T(0.8 * L, s * 0.05 * g, vorn(0.8 * L, 0.004 * g)), [0.026 * g, 0.16 * L, 0.006 * g], 0.004,           // Revers
      { knochen: 'torso', farbe: f.akzent, glatt: 0.006 * g, dreh: K.dreh('torso', [-0.25, 0, s * 0.35]) });
    for (let i = 0; i < 3; i++) knopf(L * (0.2 + i * 0.16), 0.03 * g, GOLD);
    ring(1.0 * L, 0.066 * g, 0.022 * g, f.akzent, 0.3);
  } else if (ketten) {
    ring(0.98 * L, 0.066 * g, 0.022 * g, dunkler(f.ober, 0.2), 0.15);
    const yU = P('becken')[1] - 0.3 * g, yO = T(0.85 * L)[1];
    const h4 = H.rumpf(0.4 * L), zV = h4.vorn + e + 0.016 * g, zH = -(h4.hinten + e + 0.016 * g), zB = H.becken.zc;
    platte(form, [0, yO, zV], [0, yU, zB + saumR * saumTief + 0.01 * g], 0.16 * g * w, f.akzent, kn);
    platte(form, [0, yO, zH], [0, yU, zB - saumR * saumTief - 0.01 * g], 0.16 * g * w, f.akzent, kn);
    form.kugel([0, T(0.6 * L)[1], zV + 0.01 * g], 0.024 * g, { knochen: 'torso', farbe: heller(f.akzent, 0.35), glatt: 0.004 });
  } else if (st === 'lederruestung') {
    const b6 = H.rumpf(0.6 * L);
    form.ellipsoid(T(0.6 * L, 0, b6.zc + 0.012 * g), [b6.x * 0.9 + e, 0.24 * L, b6.rz * 0.9 + e + 0.005 * g], { knochen: 'torso', farbe: dunkler(f.ober, 0.12), glatt: 0.012 * g });
    const a = Math.atan2(0.24 * g * w, 0.75 * L);
    const h5 = H.rumpf(0.5 * L);
    for (const s of [1, -1]) form.rundbox(T(0.5 * L, 0, s > 0 ? h5.vorn + e + 0.012 * g : -(h5.hinten + e + 0.012 * g)), [0.016 * g, Math.hypot(0.24 * g * w, 0.75 * L) / 2, 0.005 * g], 0.004,   // Schrägriemen vorn/hinten
      { knochen: 'torso', farbe: f.akzent, glatt: 0.006 * g, dreh: K.dreh('torso', [0, 0, s * a]) });
    form.kugel(T(0.5 * L, 0, h5.vorn + e + 0.02 * g), 0.012 * g, { knochen: 'torso', farbe: GOLD, glatt: 0.003 });
  }
  return form;
}

/** Ärmel je Seite: Oberarm, Unterarm (kurz/lang/weit), Manschette, Schulterplatten, Handschuhe. */
export function baueAermel(form, K, H) {
  const { f, g, m, P } = K, st = K.stil.ober, { e } = masse(K), r = K.armR, O = m.oberarm, U = m.unterarm;
  const [cO, cU, cR] = K.aermel, ketten = st === 'kettenhemd', rauh = ketten ? { rauh: 0.0025 * g, rauhSkala: 40 } : {};
  if (st === 'weste') return form;
  for (const s of ['L', 'R']) {
    const S = 'schulter' + s, E = 'ellbogen' + s, Hd = 'hand' + s, dS = K.dreh(S), dE = K.dreh(E);
    const kurz = cU === f.haut;                                            // Unterarm frei (Hemd, Kleid, Schürze, Lederrüstung)
    const oEnde = kurz ? -O * 0.88 : -O;
    // gemessene Haut + Stoffdicke (etwas weit, damit der Ärmel nicht wie aufgemalt wirkt)
    const ro0 = Math.max(H.glied(S, -O * 0.3), r) * 1.05 + e, ro1 = Math.max(H.glied(S, -O * 0.88), r * 0.85) * 1.04 + e;
    const ru0 = Math.max(H.glied(E, -U * 0.15), r * 0.85) * 1.03 + e, ru1 = Math.max(H.glied(E, -U * 0.9), r * 0.7) * 1.03 + e;
    if (st === 'lederruestung') {
      form.kapsel(P(S), P(S, [0, -O * 0.55, 0]), ro0, ro0 * 0.96, { knochen: S, farbe: cO, glatt: 0.02 * g });
      form.ellipsoid(P(S, [0, 0.006 * g, 0]), [ro0 * 1.4, ro0 * 0.95, ro0 * 1.35], { knochen: { [S]: 0.7, torso: 0.3 }, farbe: f.ober, glatt: 0.012 * g, dreh: dS, rauh: 0.0012, rauhSkala: 30 });
      form.kapsel(P(E, [0, -U * 0.4, 0]), P(E, [0, -U * 0.92, 0]), Math.max(H.glied(E, -U * 0.6) + e, ru1) + 0.003 * g, ru1 + 0.002 * g, { knochen: E, farbe: cR, glatt: 0.008 * g });   // Armschiene
      continue;
    }
    form.kapsel(P(S), P(S, [0, oEnde, 0]), ro0, ro1, { knochen: S, farbe: cO, glatt: 0.02 * g, ...rauh });
    if (st === 'kleid') form.ellipsoid(P(S, [0, -0.03 * g, 0]), [ro0 * 1.25, ro0 * 1.45, ro0 * 1.25], { knochen: S, farbe: cO, glatt: 0.025 * g, dreh: dS });   // Puffärmel
    if (kurz) {                                                             // hochgekrempelt: Wulst am Ärmelende
      form.ellipsoid(P(S, [0, oEnde + 0.012 * g, 0]), [ro1 + 0.008 * g, 0.018 * g, ro1 + 0.008 * g], { knochen: S, farbe: dunkler(cO, 0.12), glatt: 0.008 * g, dreh: dS });
      continue;
    }
    if (st === 'robe') {                                                    // weiter Trichterärmel mit Saum
      form.kapsel(P(E, [0, 0.01 * g, 0]), P(E, [0, -U * 0.58, 0]), ru0 * 1.05, Math.max(ru1 * 1.8, r * 1.5), { knochen: E, farbe: cU, glatt: 0.02 * g });
      form.ellipsoid(P(E, [0, -U * 0.8, 0]), [Math.max(ru1 * 2.2, r * 1.9), 0.013 * g, Math.max(ru1 * 2.2, r * 1.9)], { knochen: E, farbe: cR, glatt: 0.03 * g, dreh: dE });
      continue;
    }
    const metall = st === 'ruestung';
    form.kapsel(P(E), P(E, [0, -U * 0.9, 0]), ru0, metall ? ru1 * 1.25 : ru1, { knochen: E, farbe: metall ? heller(cU, 0.12) : cU, glatt: 0.015 * g, ...rauh });
    if (st === 'mantel') form.kapsel(P(E, [0, -U * 0.66, 0]), P(E, [0, -U * 0.93, 0]), ru1 + 0.008 * g, ru1 * 1.3 + 0.008 * g, { knochen: E, farbe: cR, glatt: 0.006 * g });   // Aufschlag
    else if (cR != null && !metall) form.ellipsoid(P(E, [0, -U * 0.88, 0]), [ru1 + 0.007 * g, 0.015 * g, ru1 + 0.007 * g], { knochen: E, farbe: cR, glatt: 0.006 * g, dreh: dE });
    if (metall) form.ellipsoid(P(Hd, [0, -m.hand * 0.42, 0.004 * g]), [0.038 * g, m.hand * 0.64, 0.05 * g], { knochen: Hd, farbe: dunkler(f.ober, 0.3), glatt: 0.012 * g, dreh: K.dreh(Hd) });   // Handschuh
  }
  return form;
}
