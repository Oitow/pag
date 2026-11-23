/**
 * @modul    figur-haar
 * @zweck    Frisuren und Bärte der organischen Figur als weiche SDF-Körper (Haarkappe, Pony, Strähnen-Bündel, Zöpfe aus Kugelketten, Locken mit Rauschen) – Gesicht frei, Hut-tauglich
 * @api      baueHaarForm(form, ctx) -> form
 * @beispiel
 *   import { baueHaarForm } from './figur-haar.js';
 *   baueHaarForm(form, formKontext(look, masse, rig));   // ruft figur-haut nach der Kleidung auf
 * @tags     figur, charakter, organisch, sdf, haar, bart, frisur, zopf, locken
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Knochen kopf: Kopfkugel-Mitte (0, R, 0), Gesicht +Z, links +X. Frei bleiben: Augen R·(±0.34, 1.02, 0.86),
 * Brauen y ≈ 1.27R, Mund y ≈ 0.52R (z ≈ 0.9R). Hüte (starr) erwarten etwa eine Kugel R um (0, R, 0):
 * Kappe bleibt darum flach (≤ 1.08R), unter deckenden Hüten nur Haar am Rand (Regel wie character-parts-haar).
 */
import { misch, dunkler } from './figur-kleidung-basis.js';

/** Wie deckendeKopfbedeckung (character-parts-hut), hier ohne THREE-Abhängigkeit. */
const deckt = (hut) => !['keine', 'krone', 'reif'].includes(hut);

/** Frisur. */
function frisur(form, K) {
  const { R, f, P, g } = K, st = K.stil.haar, h = f.haar, hut = K.stil.hut, d = deckt(hut), helm = hut === 'helm' || hut === 'topfhelm';
  if (st === 'glatze') return;
  const p = (x, y, z) => P('kopf', [x * R, y * R, z * R]);
  const yK = P('kopf')[1];
  const nacken = (x, y) => { const t = Math.min(1, Math.max(0, (yK + 0.02 - y) / 0.25)); return { kopf: 1 - 0.75 * t, hals: 0.25 * t, torso: 0.5 * t }; };
  const haar = (o = {}) => ({ knochen: 'kopf', farbe: h, glatt: 0.012 * g, rauh: 0.0016, rauhSkala: 70, ...o });
  const pony = () => form.ellipsoid(p(0, 1.66, 0.56), [R * 0.72, R * 0.2, R * 0.34], haar({ dreh: [-0.55, 0, 0], glatt: 0.015 * g }));
  const band = f.guertel ?? 0xa83a2a;
  // Haarkappe: gekipptes Ellipsoid (vorn höher) – deckt Oberkopf, Seiten und Hinterkopf, lässt Stirn unter dem Haaransatz,
  // Schläfen und Augen frei (Form numerisch gegen eine Einheitskugel bestimmt). Unter deckenden Hüten kleiner: nur der Rand schaut vor.
  const KAPPE = { m: [0, 1.37, -0.1], r: [1.08, 0.73, 1.02], kipp: -0.215 };
  const kappeS = (r) => (d ? 0.93 : r / 1.07);
  const kappe = (r = 1.07, farbe = h) => {
    const k = kappeS(r), m = [KAPPE.m[0], KAPPE.m[1] - (d ? 0.04 : 0), KAPPE.m[2]];
    form.ellipsoid(p(...m), KAPPE.r.map((v) => v * k * R), haar({ farbe, glatt: 0.01 * g, dreh: K.dreh('kopf', [KAPPE.kipp, 0, 0]) }));
  };
  /** Höhe (in R) der Kappen-Oberfläche über (x, z) – für die Scheitel-Rille. */
  const kappeOben = (x, z, r) => {
    const k = kappeS(r), c = Math.cos(KAPPE.kipp), s = Math.sin(KAPPE.kipp);
    for (let y = 2.4; y > 1; y -= 0.005) {
      const py = y - KAPPE.m[1], pz = z - KAPPE.m[2], y2 = c * py + s * pz, z2 = -s * py + c * pz;
      if (Math.hypot(x / (KAPPE.r[0] * k), y2 / (KAPPE.r[1] * k), z2 / (KAPPE.r[2] * k)) <= 1) return y;
    }
    return 1;
  };

  if (st === 'irokese') {
    form.ellipsoid(p(...KAPPE.m), KAPPE.r.map((v) => v * 0.95 * R), { knochen: 'kopf', farbe: misch(f.haut, h, 0.3), glatt: 0.008 * g, dreh: K.dreh('kopf', [KAPPE.kipp, 0, 0]) });   // rasierte Seiten
    if (!d || hut === 'bandana') for (let i = 0; i < 5; i++) {               // Stachelkamm von der Stirn bis zum Hinterkopf
      const a = 0.75 - i * 0.48, fuss = [0, 1.1 + Math.cos(a) * 1.0, -0.12 + Math.sin(a) * 1.0], l = 0.72 - Math.abs(i - 1.5) * 0.08;
      form.kapsel(p(...fuss), p(0, fuss[1] + Math.cos(a) * l, fuss[2] + Math.sin(a) * l), R * 0.2, R * 0.03, haar({ glatt: 0.02 * g, rauh: 0 }));
    }
    return;
  }
  if (st === 'kranz') {                                                         // Haarkranz: Seiten und Hinterkopf, Oberkopf frei
    form.ellipsoid(p(0, 0.98, -0.2), [R * 1.1, R * 0.36, R * 1.0], haar({ rauh: 0.002 }));
    return;
  }
  if (!helm) kappe(st === 'dutt' || st === 'scheitel' ? 1.05 : st === 'wuschel' || st === 'locken' ? 1.1 : 1.07);
  // Scheitel als weiche Rille (nur ohne deckenden Hut sichtbar): seitlich beim Seitenscheitel, sonst mittig
  if (!d && ['scheitel', 'lang', 'zopf', 'zoepfe', 'kurz'].includes(st)) {
    const x = st === 'scheitel' ? -0.32 : 0, r = st === 'scheitel' ? 1.05 : 1.07;
    form.kapsel(p(x, kappeOben(x, 0.45, r) + 0.01, 0.45), p(x, kappeOben(x, -0.7, r) + 0.01, -0.7), R * 0.03, R * 0.04, { abzug: true, knochen: 'kopf', farbe: dunkler(h, 0.3), glatt: 0.01 * g });
  }
  if (st === 'locken') form.ellipsoid(p(0, 0.78, -0.3), [R * 1.12, R * 0.42, R * 0.95], haar({ rauh: 0.006 * g, rauhSkala: 42, glatt: 0.03 * g }));   // Lockenkranz bis in den Nacken (auch unter Hüten)
  if (helm) return;
  if (['kurz', 'zopf', 'dutt', 'lang', 'pferdeschwanz', 'zoepfe'].includes(st)) pony();
  if (st === 'scheitel') {
    form.ellipsoid(p(0.22, 1.7, 0.3), [R * 0.75, R * 0.26, R * 0.62], haar({ dreh: [-0.35, 0, -0.25], glatt: 0.03 * g }));
    form.ellipsoid(p(-0.55, 1.55, 0.3), [R * 0.4, R * 0.22, R * 0.45], haar({ farbe: dunkler(h, 0.1), dreh: [0, 0, 0.5], glatt: 0.02 * g }));
  }
  if ((st === 'wuschel' || st === 'locken') && !d) for (let i = 0; i < (st === 'locken' ? 6 : 5); i++) {   // Büschel über dem Oberkopf
    const a = i * 2.39996 + 0.6, yy = 0.85 - i * 0.12, rr = Math.sqrt(1 - yy * yy);
    form.kugel(p(Math.cos(a) * rr * 0.95, 1.12 + yy * 0.95, -0.12 + Math.sin(a) * rr * 0.95), R * (st === 'locken' ? 0.34 : 0.4),
      haar({ rauh: (st === 'locken' ? 0.006 : 0.004) * g, rauhSkala: st === 'locken' ? 42 : 30, glatt: 0.03 * g }));
  }
  if (st === 'lang') {                                                          // Haarvorhang hinten bis über die Schulterblätter + Strähnen vor den Ohren
    form.kapsel(p(0, 1.15, -0.55), p(0, -0.55, -0.72), R * 0.95, R * 0.82, haar({ knochen: nacken, tief: 0.45, glatt: 0.04 * g, rauh: 0.0022, rauhSkala: 45 }));
    for (const s of [-1, 1]) form.kapsel(p(s * 0.88, 1.15, 0.05), p(s * 0.95, 0.1, 0.0), R * 0.22, R * 0.17, haar({ glatt: 0.03 * g }));
  }
  if (st === 'zopf') {
    for (let i = 0; i < 5; i++) form.ellipsoid(p((i % 2 ? 0.04 : -0.04), 0.55 - i * 0.38, -1.06 - i * 0.03), [R * (0.26 - i * 0.025), R * 0.3, R * (0.24 - i * 0.022)],
      haar({ knochen: nacken, glatt: 0.012 * g, rauh: 0 }));
    form.ring(p(0, 0.55 - 4.6 * 0.38, -1.2), R * 0.1, R * 0.05, { knochen: nacken, farbe: band, glatt: 0.004 });
    form.kapsel(p(0, 0.55 - 4.75 * 0.38, -1.2), p(0, 0.55 - 5.6 * 0.38, -1.22), R * 0.13, R * 0.04, haar({ knochen: nacken, rauh: 0 }));
  }
  if (st === 'zoepfe') for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) form.ellipsoid(p(s * (0.92 + (i % 2) * 0.04), 0.62 - i * 0.36, -0.16), [R * (0.22 - i * 0.02), R * 0.27, R * (0.21 - i * 0.02)], haar({ knochen: nacken, rauh: 0 }));
    form.kapsel(p(s * 0.94, 0.62 - 2.6 * 0.36, -0.16), p(s * 0.94, 0.62 - 3.4 * 0.36, -0.16), R * 0.12, R * 0.04, haar({ knochen: nacken, farbe: band, rauh: 0, glatt: 0.004 }));
  }
  if (st === 'pferdeschwanz') {
    form.ring(p(0, 1.45, -1.02), R * 0.12, R * 0.07, { knochen: 'kopf', farbe: band, glatt: 0.004, dreh: [-0.9, 0, 0] });
    form.kapsel(p(0, 1.38, -1.12), p(0, 0.55, -1.3), R * 0.26, R * 0.2, haar({ knochen: nacken, glatt: 0.02 * g, rauh: 0.002, rauhSkala: 50 }));
    form.kapsel(p(0, 0.55, -1.3), p(0, -0.35, -1.22), R * 0.2, R * 0.05, haar({ knochen: nacken, glatt: 0.02 * g, rauh: 0.002, rauhSkala: 50 }));
  }
  if (st === 'dutt' && !d) {
    form.kugel(p(0, 1.78, -0.72), R * 0.42, haar({ rauh: 0.002, glatt: 0.025 * g }));
    form.ring(p(0, 1.56, -0.62), R * 0.28, R * 0.06, { knochen: 'kopf', farbe: dunkler(h, 0.3), glatt: 0.004, dreh: [-0.9, 0, 0] });
  }
}

/** Bart: um den Mund herum, Schnurrbart über dem Mund (Mund y ≈ 0.52R bleibt frei). */
function bart(form, K) {
  const { R, f, P, g } = K, st = K.stil.bart, c = f.bart;
  if (st === 'keiner') return;
  const p = (x, y, z) => P('kopf', [x * R, y * R, z * R]);
  const b = (o = {}) => ({ knochen: 'kopf', farbe: c, glatt: 0.012 * g, rauh: 0.0018, rauhSkala: 70, ...o });
  const kiefer = (o) => form.ellipsoid(p(0, 0.18, 0.24), [R * 0.9, R * 0.42, R * 0.8], b(o));        // Vollbart um Kinn und Kiefer, vorn unter dem Mund
  const schnurr = (spitz = 0) => { for (const s of [-1, 1]) form.kapsel(p(s * 0.04, 0.66, 0.97), p(s * (0.3 + spitz), 0.58 - spitz * 0.3, 0.86), R * 0.085, R * 0.04, b({ glatt: 0.006 * g })); };
  if (st === 'stoppel') form.ellipsoid(p(0, 0.24, 0.02), [R * 1.0, R * 0.44, R * 0.93], b({ farbe: misch(f.haut, c, 0.4), rauh: 0, glatt: 0.004, haut: true }));
  else if (st === 'voll' || st === 'lang') {
    kiefer();
    schnurr();
    if (st === 'lang') form.kapsel(p(0, 0.15, 0.62), p(0, -1.0, 0.78), R * 0.48, R * 0.1, b({ tief: 0.6, glatt: 0.03 * g, rauh: 0.0025, rauhSkala: 50 }));
  } else if (st === 'schnurrbart') schnurr();
  else if (st === 'zwirbel') {
    schnurr(0.05);
    for (const s of [-1, 1]) form.kapsel(p(s * 0.34, 0.56, 0.82), p(s * 0.48, 0.76, 0.76), R * 0.04, R * 0.018, b({ glatt: 0.004, rauh: 0 }));
  } else if (st === 'ziege') {
    form.kapsel(p(0, 0.3, 0.9), p(0, -0.12, 0.86), R * 0.16, R * 0.04, b({ glatt: 0.015 * g }));
    form.ellipsoid(p(0, 0.38, 0.95), [R * 0.07, R * 0.06, R * 0.05], b({ glatt: 0.006 * g }));
  } else if (st === 'koteletten') {
    for (const s of [-1, 1]) form.ellipsoid(p(s * 0.9, 0.82, 0.24), [R * 0.14, R * 0.3, R * 0.2], b({ dreh: [0, 0, s * 0.08] }));
  } else if (st === 'kinnbart') {
    form.ellipsoid(p(0, 0.24, 0.5), [R * 0.4, R * 0.24, R * 0.55], b({ glatt: 0.015 * g }));
    form.ellipsoid(p(0, 0.38, 0.95), [R * 0.06, R * 0.07, R * 0.05], b({ glatt: 0.006 * g }));
  }
}

export function baueHaarForm(form, ctx) {
  frisur(form, ctx);
  bart(form, ctx);
  return form;
}
