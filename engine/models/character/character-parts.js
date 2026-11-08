/**
 * @modul    character-parts
 * @zweck    Reine Bau-Funktionen für Figuren-Körperteile je Knochen (Torso, Becken/Rock, Arme, Beine, Füße, Umhang, Rucksack) aus Look + Körpermaßen
 * @api      teilKontext(look,masse) -> ctx ; baueTorso(b,ctx) ; baueHals(b,ctx) ; baueBecken(b,ctx) ; baueOberarm(b,ctx) ; baueUnterarm(b,ctx) ; baueHand(b,ctx) ; baueOberschenkel(b,ctx) ; baueUnterschenkel(b,ctx) ; baueFuss(b,ctx) ; baueUmhang(b,ctx) ; baueRucksack(b,ctx) ; farbeMisch(a,b,t) -> int
 * @beispiel
 *   import { teilKontext, baueTorso } from '../../engine/models/character/character-parts.js';
 *   const b = createMeshBuilder({ seed: 3 }), ctx = teilKontext(look, koerperMasse(look));
 *   rig.knochen.torso.add(baueTorso(b, ctx).mesh());
 * @tags     figur, charakter, kleidung, mesh, lowpoly, körper, umhang, rucksack
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { createLook, farbeZahl } from './character-look.js';

/** Farben (Zahlen) mischen: t = 0 → a, 1 → b. */
export function farbeMisch(a, b, t) {
  const k = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (k(16) << 16) | (k(8) << 8) | k(0);
}
const dunkler = (c, t) => farbeMisch(c, 0, t);
const heller = (c, t) => farbeMisch(c, 0xffffff, t);
const GOLD = 0xd8b048, LEDER = 0x5a4030;

/** Gemeinsame Werte für alle Bau-Funktionen: Look, Maße, Skala g, Breite w, Farben (Zahlen), Stile. */
export function teilKontext(look, m) {
  const L = createLook(look), Z = (f, e = 0x808080) => farbeZahl(f) ?? e;
  const g = m.torsoLaenge / 0.5, w = m.breite, haut = Z(L.haut), haar = Z(L.haar.farbe);
  const ober = L.oberteil.stil, hose = L.hose.stil;
  const f = {
    haut, haar, augen: Z(L.augen), bart: Z(L.bart.farbe, haar),
    ober: Z(L.oberteil.farbe), akzent: Z(L.oberteil.akzent), hose: Z(L.hose.farbe),
    schuh: L.schuhe.stil === 'barfuss' ? haut : Z(L.schuhe.farbe),
    hut: Z(L.kopfbedeckung.farbe), hutAkzent: Z(L.kopfbedeckung.akzent), umhang: Z(L.umhang.farbe),
    guertel: L.guertel == null ? null : Z(L.guertel),
  };
  const aermel = {
    kittel: [f.ober, f.ober, f.akzent], hemd: [f.ober, haut, f.ober], robe: [f.ober, f.ober, f.akzent],
    ruestung: [f.ober, dunkler(f.ober, 0.15), f.akzent], weste: [haut, haut, null], kleid: [f.ober, haut, f.akzent],
  }[ober];
  return {
    L, m, g, w, R: m.kopfRadius, f, aermel,
    stil: { haar: L.haar.stil, bart: L.bart.stil, ober, hose, schuhe: L.schuhe.stil, hut: L.kopfbedeckung.stil, umhang: L.umhang.stil },
    taille: (0.135 + 0.025 * m.bauch) * g * w, brust: 0.17 * g * w, tiefe: 0.68,
    armR: 0.047 * g * (0.8 + 0.2 * w), beinR: 0.074 * g * Math.sqrt(w),
    // Rock am Becken: Länge (ab Becken) und unterer Radius
    rock: ober === 'robe' || hose === 'rock' ? 'lang' : ober === 'kleid' ? 'knie' : null,
  };
}

/** Torso: von 0 (Taille) bis torsoLaenge (Halsansatz). */
export function baueTorso(b, K) {
  const { m, g, w, f, taille: rw, brust: rc, tiefe: sz } = K, L = m.torsoLaenge, st = K.stil.ober;
  const ruest = st === 'ruestung', zv = (y) => (y < 0.55 * L ? rw + (rc * 0.95 - rw) * y / (0.55 * L) : rc * 0.92) * sz;
  b.cyl(rc * 0.95, rw, L * 0.55, f.ober, { y: L * 0.275, sz }, 10);
  b.cyl(rc * 0.9, rc * 0.95, L * 0.3, f.ober, { y: L * 0.7, sz }, 10);
  b.sphere(rc * 0.9, f.ober, { y: L * 0.85, sx: (m.schulterX + K.armR * 0.6) / (rc * 0.9), sy: 0.42, sz }, 10, 6);
  if (m.bauch > 0) b.sphere(rw, f.ober, { y: L * 0.3, z: m.bauch * 0.04 * g, sz: sz + m.bauch * 0.3, sy: 1.1 }, 10, 7);
  for (const s of [-1, 1]) b.sphere(K.armR * 1.3, K.aermel[0], { x: s * m.schulterX, y: m.schulterY, sy: 0.9 }, 8, 6);
  const zt = zv(L * 0.9);
  if (st === 'kittel') {
    b.cone(0.05 * g, 0.16 * g, f.haut, { y: L * 0.9, z: zt - 0.004, rx: Math.PI, sz: 0.2 }, 3);           // V-Ausschnitt
    b.add(new THREE.TorusGeometry(rc * 0.62, 0.012 * g, 4, 12), f.akzent, { y: L * 0.97, rx: Math.PI / 2, sy: 0.75 });
    for (let i = 0; i < 3; i++) b.box(0.05 * g, 0.008 * g, 0.01 * g, f.akzent, { y: L * (0.72 + i * 0.06), z: zv(L * 0.75) + 0.004, rz: (i % 2 ? 0.5 : -0.5) });
  } else if (st === 'hemd') {
    for (const s of [-1, 1]) b.box(0.07 * g, 0.045 * g, 0.012 * g, heller(f.ober, 0.25), { x: s * 0.035 * g, y: L * 0.93, z: zt + 0.003, rz: s * 0.7 });
    for (let i = 0; i < 4; i++) b.sphere(0.008 * g, f.akzent, { y: L * (0.3 + i * 0.17), z: zv(L * (0.3 + i * 0.17)) + 0.002 }, 4, 3);
    b.box(0.06 * g, 0.06 * g, 0.01 * g, dunkler(f.ober, 0.12), { x: 0.07 * g * w, y: L * 0.68, z: zv(L * 0.68) - 0.004 });
  } else if (st === 'robe') {
    b.box(0.06 * g, L * 0.95, 0.012 * g, f.akzent, { y: L * 0.47, z: zv(L * 0.5) + 0.006, sz: 1 });
    b.add(new THREE.TorusGeometry(rc * 0.7, 0.025 * g, 5, 12), f.akzent, { y: L * 0.95, rx: Math.PI / 2, sy: 0.75 });
  } else if (st === 'ruestung') {
    b.sphere(rc * 0.85, heller(f.ober, 0.12), { y: L * 0.6, z: 0.03 * g, sy: 1.05, sz: sz * 0.85 }, 10, 7);  // Brustplatte
    for (let i = 0; i < 3; i++) b.cyl(rw + 0.012 * g + i * 0.008 * g, rw + 0.008 * g + i * 0.008 * g, 0.05 * g, dunkler(f.ober, 0.08 * i), { y: L * (0.08 + i * 0.1), sz }, 10);
    b.box(0.13 * g * w, L * 0.7, 0.012 * g, f.akzent, { y: L * 0.38, z: zv(L * 0.4) + 0.04 * g });             // Wappenrock
    b.sphere(0.03 * g, GOLD, { y: L * 0.55, z: zv(L * 0.55) + 0.05 * g, sz: 0.4 }, 6, 4);
    for (const s of [-1, 1]) {                                                                            // Schulterplatten
      b.sphere(K.armR * 2.1, f.ober, { x: s * m.schulterX * 1.02, y: m.schulterY + 0.02 * g, sy: 0.7 }, 10, 6);
      b.sphere(K.armR * 1.9, dunkler(f.ober, 0.1), { x: s * m.schulterX * 1.08, y: m.schulterY - 0.015 * g, sy: 0.55 }, 10, 6);
    }
  } else if (st === 'weste') {
    b.box(0.07 * g * w, L * 0.75, 0.02, f.haut, { y: L * 0.6, z: zv(L * 0.6) - 0.004, rx: -0.1 });           // offene Front
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++)
      b.sphere(0.009 * g, f.akzent, { x: s * 0.045 * g * w, y: L * (0.3 + i * 0.16), z: zv(L * (0.3 + i * 0.16)) + 0.003 }, 4, 3);
    b.cyl(rw * 1.03, rw * 1.03, 0.04 * g, f.akzent, { y: 0.02 * g, sz }, 10);
  } else if (st === 'kleid') {
    b.box(0.13 * g * w, 0.06 * g, 0.012 * g, f.haut, { y: L * 0.93, z: zt - 0.006 });                       // eckiger Ausschnitt
    b.box(0.15 * g * w, 0.02 * g, 0.014 * g, f.akzent, { y: L * 0.88, z: zt - 0.001 });
    for (let i = 0; i < 3; i++) b.box(0.07 * g, 0.008 * g, 0.012 * g, f.akzent, { y: L * (0.25 + i * 0.15), z: zv(L * (0.25 + i * 0.15)) + 0.003, rz: i % 2 ? 0.6 : -0.6 });
  }
  return b;
}

/** Hals (Knochen hals): kurzer Haut-Zylinder, reicht in Torso und Kopf hinein. */
export function baueHals(b, K) {
  const { g, m } = K;
  b.cyl(0.046 * g, 0.054 * g, m.halsLaenge + 0.06 * g, K.f.haut, { y: m.halsLaenge / 2 }, 8);
  return b;
}

/** Becken: Hüfte, Gürtel, Tasche, Kittelsaum oder Rock (leicht konisch, bleibt oberhalb der Waden). */
export function baueBecken(b, K) {
  const { g, w, f, taille: rw, tiefe: sz, m } = K, st = K.stil.ober;
  const unten = K.rock ? (st === 'kleid' || st === 'robe' ? f.ober : f.hose) : f.hose;
  b.cyl(rw * 1.02, rw * 1.08, 0.16 * g, unten, { y: -0.015 * g, sz: sz * 1.05 }, 10);
  b.sphere(rw * 1.05, unten, { y: -0.09 * g, sy: 0.45, sz: sz * 1.05 }, 10, 5);
  let saum = 0.06 * g;
  if (K.rock) {
    const lang = K.rock === 'lang', hRock = (lang ? 0.62 : 0.4) * m.oberschenkel * 2;
    const rUnten = (lang ? 0.27 : 0.22) * g * Math.sqrt(w), farbe = st === 'robe' || (st === 'kleid' && !lang) || K.stil.hose !== 'rock' ? f.ober : f.hose;
    b.cyl(rw * 1.08, rUnten, hRock, farbe, { y: 0.06 * g - hRock / 2, sz: 0.85 }, 12);
    b.cyl(rUnten * 1.02, rUnten * 1.02, 0.03 * g, st === 'robe' || st === 'kleid' ? f.akzent : dunkler(farbe, 0.2), { y: 0.06 * g - hRock + 0.015 * g, sz: 0.85 }, 12);
    if (st === 'kleid' && lang) {                                    // Überrock + Schürze über langem Rock
      const h2 = hRock * 0.62, r2 = rw * 1.1 + (rUnten - rw * 1.08) * 0.62 + 0.012 * g;
      b.cyl(rw * 1.12, r2, h2, f.ober, { y: 0.06 * g - h2 / 2, sz: 0.85 }, 12);
      b.box(0.17 * g * w, h2 * 0.9, 0.01 * g, f.akzent, { y: 0.04 * g - h2 * 0.45, z: (rw * 1.1 + r2) / 2 * 0.85 + 0.004, rx: -Math.atan((r2 - rw * 1.1) * 0.85 / h2) });
    }
    saum = 0.06 * g;
  } else if (st === 'kittel' || st === 'ruestung') {
    const farbe = st === 'kittel' ? f.ober : dunkler(f.ober, 0.1), h = 0.22 * g;
    b.cyl(rw * 1.06, rw * 1.38, h, farbe, { y: 0.06 * g - h / 2, sz }, 12);
    b.cyl(rw * 1.4, rw * 1.4, 0.025 * g, f.akzent, { y: 0.06 * g - h, sz }, 12);
    if (st === 'ruestung') b.box(0.13 * g * w, 0.3 * g, 0.012 * g, f.akzent, { y: -0.08 * g, z: rw * 1.25 * sz + 0.03 * g, rx: -0.12 });
  }
  if (f.guertel != null) {
    b.cyl(rw * 1.09, rw * 1.09, 0.04 * g, f.guertel, { y: saum - 0.005 * g, sz: sz * 1.05 }, 10);
    b.box(0.045 * g, 0.04 * g, 0.012 * g, GOLD, { y: saum - 0.005 * g, z: rw * 1.09 * sz * 1.05 });
  }
  if (K.L.tasche) {
    const x = rw * 1.05;
    b.box(0.09 * g, 0.1 * g, 0.045 * g, LEDER, { x, y: saum - 0.07 * g, z: 0.02 * g, ry: 0.25, jitter: 0.12 });
    b.box(0.095 * g, 0.04 * g, 0.05 * g, dunkler(LEDER, 0.25), { x, y: saum - 0.035 * g, z: 0.02 * g, ry: 0.25 });
    b.sphere(0.01 * g, GOLD, { x: x + 0.006, y: saum - 0.04 * g, z: 0.045 * g }, 4, 3);
  }
  return b;
}

/** Oberarm (Knochen schulter*): Schulterkugel + Ärmel nach −Y. */
export function baueOberarm(b, K) {
  const { m, f, armR: r } = K, [farbe] = K.aermel, st = K.stil.ober;
  b.sphere(r * 1.15, farbe, {}, 8, 6);
  b.cyl(r * 1.08, r * 0.95, m.oberarm, farbe, { y: -m.oberarm / 2 }, 8);
  if (st === 'kleid') b.sphere(r * 1.7, farbe, { y: -0.035 * K.g, sy: 1.1 }, 8, 6);                          // Puffärmel
  if (st === 'hemd') b.cyl(r * 1.1, r * 1.1, 0.035 * K.g, dunkler(farbe, 0.1), { y: -m.oberarm + 0.02 * K.g }, 8);
  if (st === 'weste') b.sphere(r * 1.25, f.ober, { y: 0.01, sy: 0.6 }, 8, 5);
  return b;
}

/** Unterarm (Knochen ellbogen*): Ellbogenkugel + Unterarm, Manschette/weiter Robenärmel. */
export function baueUnterarm(b, K) {
  const { m, g, armR: r } = K, [, farbe, rand] = K.aermel, st = K.stil.ober, U = m.unterarm;
  b.sphere(r * 1.0, farbe, {}, 8, 6);
  b.cyl(r * 0.95, r * 0.8, U, farbe, { y: -U / 2 }, 8);
  if (st === 'robe') {
    b.cyl(r * 1.1, r * 1.9, U * 0.85, farbe, { y: -U * 0.48 }, 9);
    b.cyl(r * 1.95, r * 1.95, 0.03 * g, rand, { y: -U * 0.9 }, 9);
  } else if (st === 'ruestung') {
    b.cyl(r * 1.05, r * 1.15, U * 0.55, heller(farbe, 0.15), { y: -U * 0.65 }, 8);
  } else if (rand != null && st !== 'hemd') b.cyl(r * 0.92, r * 0.92, 0.03 * g, rand, { y: -U + 0.02 * g }, 8);
  return b;
}

/** Hand (Knochen hand*): Fäustling mit Daumen nach vorn (+Z). */
export function baueHand(b, K) {
  const { g, m, f } = K, farbe = K.stil.ober === 'ruestung' ? dunkler(f.ober, 0.3) : f.haut, h = m.hand;
  b.sphere(K.armR * 0.85, farbe, { y: -0.005 }, 6, 5);
  b.sphere(0.036 * g, farbe, { y: -h * 0.5, sx: 0.75, sy: 1.3, sz: 1.05 }, 7, 6);
  b.sphere(0.016 * g, farbe, { y: -h * 0.35, z: 0.03 * g, sy: 1.4, rx: 0.4 }, 5, 4);
  return b;
}

const hoseFarbe = (K, unten) => (K.stil.hose === 'kurz' && unten ? K.f.haut : K.stil.hose === 'rock' ? dunkler(K.f.hose, 0.25) : K.f.hose);

/** Oberschenkel (Knochen huefte*). */
export function baueOberschenkel(b, K) {
  const { m, g, beinR: r } = K, O = m.oberschenkel, farbe = hoseFarbe(K, false);
  b.sphere(r * 1.08, farbe, {}, 8, 6);
  if (K.stil.hose === 'kurz') {
    b.cyl(r * 1.12, r * 1.02, O * 0.6, farbe, { y: -O * 0.3 }, 8);
    b.cyl(r * 0.95, r * 0.78, O * 0.45, K.f.haut, { y: -O * 0.75 }, 8);
  } else b.cyl(r, r * 0.8, O, farbe, { y: -O / 2 }, 8);
  return b;
}

/** Unterschenkel (Knochen knie*): Knie, Wade, Stiefelschaft. */
export function baueUnterschenkel(b, K) {
  const { m, g, f, beinR: r } = K, U = m.unterschenkel, farbe = hoseFarbe(K, true);
  b.sphere(r * 0.84, farbe, {}, 8, 6);
  b.cyl(r * 0.82, r * 0.6, U, farbe, { y: -U / 2 }, 8);
  b.sphere(r * 0.75, farbe, { y: -U * 0.3, z: -0.012 * g, sy: 1.6 }, 7, 5);                                // Wade
  if (K.stil.schuhe === 'stiefel') {
    b.cyl(r * 0.82, r * 0.72, U * 0.5, f.schuh, { y: -U * 0.75 }, 8);
    b.cyl(r * 0.92, r * 0.88, 0.05 * g, dunkler(f.schuh, 0.15), { y: -U * 0.5 }, 8);
  } else if (K.stil.hose === 'lang') b.cyl(r * 0.7, r * 0.7, 0.03 * g, dunkler(farbe, 0.15), { y: -U + 0.015 * g }, 8);
  return b;
}

/** Fuß (Knochen fuss*): vom Knöchel bis zum Boden, Zehen nach +Z. */
export function baueFuss(b, K) {
  const { m, g, f } = K, h = m.fussHoehe - 0.02 * m.hoehe / 1.75, Lf = m.fussLaenge, st = K.stil.schuhe;
  const breit = 0.085 * g * Math.sqrt(K.w), zMitte = Lf * 0.22;
  b.sphere(K.beinR * 0.65, f.schuh, { y: 0 }, 7, 5);
  b.box(breit, h * 0.9, Lf * 0.75, f.schuh, { y: -h * 0.5, z: zMitte - Lf * 0.1 });
  b.sphere(breit * 0.55, f.schuh, { y: -h * 0.55, z: zMitte + Lf * 0.3, sy: h / breit * 0.9, sz: 1.3 }, 8, 5);
  if (st === 'barfuss') {
    for (let i = 0; i < 4; i++) b.sphere(0.011 * g, f.haut, { x: (i - 1.5) * breit * 0.24, y: -h * 0.8, z: zMitte + Lf * 0.48 - Math.abs(i - 1.5) * 0.008 * g }, 4, 3);
  } else {
    b.box(breit * 1.08, 0.016 * g, Lf * 1.0, dunkler(f.schuh, 0.45), { y: -h + 0.008 * g, z: zMitte });          // Sohle
    if (st === 'stiefel') b.cyl(K.beinR * 0.7, K.beinR * 0.8, h * 1.2, f.schuh, { y: -h * 0.2 }, 8);
    else b.box(breit * 0.5, 0.008 * g, 0.03 * g, heller(f.schuh, 0.2), { y: -h * 0.05, z: zMitte + Lf * 0.12 });
  }
  return b;
}

/** Umhang (Sockel umhang, Nacken hinten): doppelseitige Schale, kurz bis Hüfte oder lang bis Wade. */
export function baueUmhang(b, K) {
  const { g, w, m, f } = K, lang = K.stil.umhang === 'lang';
  const sockY = m.hueftHoehe + m.torsoAbstand + m.torsoLaenge - 0.03;
  const len = lang ? sockY - 0.3 * m.hueftHoehe : 0.5 * g, rO = 0.17 * g * w, rU = (lang ? 0.36 : 0.24) * g * w;
  const bogen = Math.PI * 0.85, t0 = Math.PI - bogen / 2, sz = 0.7;
  const schale = (r1, r2, farbe, innen) => {
    const geo = new THREE.CylinderGeometry(r1, r2, len, 12, 2, true, t0, bogen);
    b.add(geo, farbe, { y: -len / 2, z: rO * sz, sz, innen, jitter: 0.1 });
    geo.dispose();
  };
  schale(rO, rU, f.umhang, false);
  schale(rO * 0.98, rU * 0.98, dunkler(f.umhang, 0.3), true);
  b.capsule(0.03 * g, rO * 1.3, dunkler(f.umhang, 0.1), { y: 0.005, z: 0.02 * g, rz: Math.PI / 2 }, 2, 6);    // Kragenrolle
  return b;
}

/** Rucksack (Sockel ruecken): Sack mit Klappe, Deckenrolle oben, Riemen. */
export function baueRucksack(b, K) {
  const { g, w } = K, sack = 0x7a6448, gurt = 0x4a3424;
  b.box(0.24 * g * w, 0.28 * g, 0.13 * g, sack, { z: -0.065 * g, jitter: 0.12 });
  b.cyl(0.12 * g * w, 0.12 * g * w, 0.13 * g, sack, { y: 0.14 * g, z: -0.065 * g, rx: Math.PI / 2, sx: 1, sz: 1, sy: 1 }, 10);
  b.box(0.2 * g * w, 0.14 * g, 0.02 * g, dunkler(sack, 0.25), { y: 0.1 * g, z: -0.135 * g, rx: 0.1 });
  b.box(0.12 * g * w, 0.07 * g, 0.04 * g, dunkler(sack, 0.1), { y: -0.06 * g, z: -0.14 * g });
  b.cyl(0.045 * g, 0.045 * g, 0.3 * g * w, 0xa8946a, { y: 0.22 * g, z: -0.07 * g, rz: Math.PI / 2 }, 8);
  for (const s of [-1, 1]) {
    b.box(0.03 * g, 0.03 * g, 0.03 * g, gurt, { x: s * 0.09 * g * w, y: 0.22 * g, z: -0.07 * g });
    b.box(0.03 * g, 0.24 * g, 0.012 * g, gurt, { x: s * 0.08 * g * w, y: 0.08 * g, z: 0.005, rx: 0.15 });
  }
  return b;
}
