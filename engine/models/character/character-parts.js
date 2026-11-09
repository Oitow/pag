/**
 * @modul    character-parts
 * @zweck    Bau-Funktionen für Figuren-Körperteile je Knochen aus Look + Körpermaßen: Kontext, Hals, Arme, Hände, Beine, Füße; bündelt Torso, Becken, Umhang, Rucksack, Zubehör
 * @api      teilKontext(look,masse,opts?) -> ctx ; baueTorso(b,ctx) ; baueHals(b,ctx) ; baueBecken(b,ctx) ; baueOberarm(b,ctx) ; baueUnterarm(b,ctx) ; baueHand(b,ctx) ; baueOberschenkel(b,ctx) ; baueUnterschenkel(b,ctx) ; baueFuss(b,ctx) ; baueUmhang(b,ctx) ; baueRucksack(b,ctx) ; baueZubehoer(b,ctx) ; farbeMisch(a,b,t) -> int
 * @beispiel
 *   import { teilKontext, baueTorso } from '../../engine/models/character/character-parts.js';
 *   const b = createMeshBuilder({ seed: 3 }), ctx = teilKontext(look, koerperMasse(look));
 *   rig.knochen.torso.add(baueTorso(b, ctx).mesh());
 * @tags     figur, charakter, kleidung, mesh, lowpoly, körper, umhang, rucksack, schuhe
 * @version  1.1.0
 * @status   entwurf
 * @three    ja
 *
 * 1.1: neue Stile (Mantel, Schürze, Kettenhemd, Lederrüstung, Pluderhose, Sandalen, Schnabelschuhe, Kragen-Umhang),
 *      Körper schultern/muskeln, Zubehör (Schal, Halsschmuck), ctx.mimik (Kopf ohne festes Gesicht für character-parts-gesicht).
 *      Torso/Becken/Umhang/Rucksack liegen jetzt in eigenen Dateien und werden hier weiter exportiert.
 */
import { createLook, farbeZahl } from './character-look.js';
import { farbeMisch, dunkler, heller } from './character-parts-basis.js';

export { farbeMisch } from './character-parts-basis.js';
export { baueTorso } from './character-parts-torso.js';
export { baueBecken } from './character-parts-becken.js';
export { baueUmhang, baueRucksack } from './character-parts-ruecken.js';
export { baueZubehoer } from './character-parts-zubehoer.js';

/**
 * Gemeinsame Werte für alle Bau-Funktionen: Look, Maße, Skala g, Breite w, Farben (Zahlen), Stile.
 * opts: { mimik = false } – true: Kopf ohne Iris/Lider/Brauen/Mund (die baut character-parts-gesicht beweglich).
 */
export function teilKontext(look, m, { mimik = false } = {}) {
  const L = createLook(look), Z = (f, e = 0x808080) => farbeZahl(f) ?? e;
  const g = m.torsoLaenge / 0.5, w = m.breite, haut = Z(L.haut), haar = Z(L.haar.farbe), mu = L.koerper.muskeln;
  const ober = L.oberteil.stil, hose = L.hose.stil;
  const f = {
    haut, haar, augen: Z(L.augen), bart: Z(L.bart.farbe, haar),
    ober: Z(L.oberteil.farbe), akzent: Z(L.oberteil.akzent), hose: Z(L.hose.farbe),
    schuh: L.schuhe.stil === 'barfuss' ? haut : Z(L.schuhe.farbe),
    hut: Z(L.kopfbedeckung.farbe), hutAkzent: Z(L.kopfbedeckung.akzent), umhang: Z(L.umhang.farbe),
    guertel: L.guertel == null ? null : Z(L.guertel),
    brille: Z(L.brille.farbe), schal: Z(L.schal.farbe), schalAkzent: Z(L.schal.akzent),
    schmuck: Z(L.schmuck.farbe), stein: Z(L.schmuck.akzent),
  };
  const aermel = {
    kittel: [f.ober, f.ober, f.akzent], hemd: [f.ober, haut, f.ober], robe: [f.ober, f.ober, f.akzent],
    ruestung: [f.ober, dunkler(f.ober, 0.15), f.akzent], weste: [haut, haut, null], kleid: [f.ober, haut, f.akzent],
    mantel: [f.ober, f.ober, f.akzent], schuerze: [f.ober, haut, f.ober], kettenhemd: [f.ober, dunkler(f.ober, 0.1), null],
    lederruestung: [f.akzent, haut, f.ober],
  }[ober];
  return {
    L, m, g, w, R: m.kopfRadius, f, aermel, mimik: !!mimik,
    stil: {
      haar: L.haar.stil, bart: L.bart.stil, ober, hose, schuhe: L.schuhe.stil, hut: L.kopfbedeckung.stil, umhang: L.umhang.stil,
      brille: L.brille.stil, schal: L.schal.stil, schmuck: L.schmuck.stil,
    },
    taille: (0.125 + 0.03 * m.bauch) * g * w, brust: 0.148 * g * w * (1 + 0.06 * mu), tiefe: 0.68 + 0.04 * mu,
    armR: 0.051 * g ** 0.75 * (0.8 + 0.2 * w) * (1 + 0.22 * mu), beinR: 0.08 * g ** 0.75 * Math.sqrt(w) * (1 + 0.12 * mu),
    // Rock am Becken: Länge (ab Becken) und unterer Radius
    rock: ober === 'robe' || hose === 'rock' ? 'lang' : ober === 'kleid' ? 'knie' : null,
  };
}

/** Hals (Knochen hals): kurzer Haut-Zylinder, reicht in Torso und Kopf hinein. */
export function baueHals(b, K) {
  const { g, m } = K, mu = K.L.koerper.muskeln;
  b.cyl(0.046 * g * (1 + 0.15 * mu), 0.054 * g * (1 + 0.25 * mu), m.halsLaenge + 0.06 * g, K.f.haut, { y: m.halsLaenge / 2 }, 8);
  return b;
}

/** Oberarm (Knochen schulter*): Schulterkugel + Ärmel nach −Y. */
export function baueOberarm(b, K) {
  const { m, armR: r } = K, [farbe] = K.aermel, st = K.stil.ober;
  b.sphere(r * 1.15, farbe, {}, 7, 5);
  b.cyl(r * 1.08, r * 0.95, m.oberarm, farbe, { y: -m.oberarm / 2, jitter: st === 'kettenhemd' ? 0.25 : undefined }, 8);
  if (st === 'kleid') b.sphere(r * 1.7, farbe, { y: -0.035 * K.g, sy: 1.1 }, 8, 6);                          // Puffärmel
  if (st === 'hemd' || st === 'schuerze') b.cyl(r * 1.1, r * 1.1, 0.035 * K.g, dunkler(farbe, 0.1), { y: -m.oberarm + 0.02 * K.g }, 8);
  if (st === 'mantel') b.cyl(r * 1.12, r * 1.12, 0.03 * K.g, K.aermel[2], { y: -m.oberarm * 0.15 }, 8);
  if (st === 'lederruestung') b.sphere(r * 1.5, K.f.ober, { y: 0.005 * K.g, sy: 0.7 }, 7, 4);                // Schulterpolster
  return b;
}

/** Unterarm (Knochen ellbogen*): Ellbogenkugel + Unterarm, Manschette/weiter Robenärmel/Armschiene. */
export function baueUnterarm(b, K) {
  const { m, g, armR: r } = K, [, farbe, rand] = K.aermel, st = K.stil.ober, U = m.unterarm;
  b.sphere(r * 1.0, farbe, {}, 7, 5);
  b.cyl(r * 0.95, r * 0.8, U, farbe, { y: -U / 2 }, 8);
  if (st === 'robe') {
    b.cyl(r * 1.1, r * 1.9, U * 0.85, farbe, { y: -U * 0.48 }, 9);
    b.cyl(r * 1.95, r * 1.95, 0.03 * g, rand, { y: -U * 0.9 }, 9);
  } else if (st === 'ruestung') {
    b.cyl(r * 1.05, r * 1.15, U * 0.55, heller(farbe, 0.15), { y: -U * 0.65 }, 8);
  } else if (st === 'lederruestung') {
    b.cyl(r * 1.0, r * 0.95, U * 0.5, rand, { y: -U * 0.68 }, 8);                                            // Armschiene
    for (const y of [0.55, 0.8]) b.cyl(r * 1.04, r * 1.04, 0.012 * g, dunkler(rand, 0.3), { y: -U * y }, 8);
  } else if (st === 'mantel') {
    b.cyl(r * 1.0, r * 1.25, U * 0.3, rand, { y: -U * 0.85 }, 8);                                            // Aufschlag
  } else if (rand != null && st !== 'hemd') b.cyl(r * 0.92, r * 0.92, 0.03 * g, rand, { y: -U + 0.02 * g }, 8);
  return b;
}

/** Hand (Knochen hand*): Fäustling mit Daumen nach vorn (+Z). */
export function baueHand(b, K) {
  const { g, m, f } = K, farbe = K.stil.ober === 'ruestung' ? dunkler(f.ober, 0.3) : f.haut, h = m.hand;
  b.sphere(K.armR * 0.85, farbe, { y: -0.005 }, 6, 4);
  b.sphere(0.042 * g, farbe, { y: -h * 0.5, sx: 0.75, sy: 1.25, sz: 1.05 }, 6, 5);
  b.sphere(0.018 * g, farbe, { y: -h * 0.35, z: 0.035 * g, sy: 1.4, rx: 0.4 }, 4, 3);
  return b;
}

const hoseFarbe = (K, unten) => (K.stil.hose === 'kurz' && unten ? K.f.haut : K.stil.hose === 'rock' ? dunkler(K.f.hose, 0.25) : K.f.hose);

/** Oberschenkel (Knochen huefte*). */
export function baueOberschenkel(b, K) {
  const { m, g, beinR: r } = K, O = m.oberschenkel, farbe = hoseFarbe(K, false), st = K.stil.hose;
  b.sphere(r * 1.08, farbe, {}, 7, 5);
  if (st === 'kurz') {
    b.cyl(r * 1.12, r * 1.02, O * 0.6, farbe, { y: -O * 0.3 }, 8);
    b.cyl(r * 0.95, r * 0.78, O * 0.45, K.f.haut, { y: -O * 0.75 }, 8);
  } else if (st === 'pluder') {
    b.sphere(r * 1.35, farbe, { y: -O * 0.45, sy: O / r * 0.42, jitter: 0.1 }, 8, 6);                      // bauschig
    b.cyl(r * 0.85, r * 0.8, O * 0.3, farbe, { y: -O * 0.85 }, 8);
  } else b.cyl(r, r * 0.8, O, farbe, { y: -O / 2 }, 8);
  return b;
}

/** Unterschenkel (Knochen knie*): Knie, Wade, Stiefelschaft. */
export function baueUnterschenkel(b, K) {
  const { m, g, f, beinR: r } = K, U = m.unterschenkel, farbe = hoseFarbe(K, true), sch = K.stil.schuhe;
  b.sphere(r * 0.84, farbe, {}, 7, 5);
  b.cyl(r * 0.82, r * 0.6, U, farbe, { y: -U / 2 }, 8);
  b.sphere(r * 0.75, farbe, { y: -U * 0.3, z: -0.012 * g, sy: 1.6 }, 6, 4);                                // Wade
  if (K.stil.hose === 'pluder') b.sphere(r * 1.05, farbe, { y: -U * 0.08, sy: 0.9, jitter: 0.1 }, 7, 5);   // Bausch unterm Knie
  if (sch === 'stiefel') {
    b.cyl(r * 0.82, r * 0.72, U * 0.5, f.schuh, { y: -U * 0.75 }, 8);
    b.cyl(r * 0.92, r * 0.88, 0.05 * g, dunkler(f.schuh, 0.15), { y: -U * 0.5 }, 8);
  } else if (sch === 'sandalen') {
    for (const y of [0.78, 0.9]) b.cyl(r * 0.66, r * 0.66, 0.012 * g, f.schuh, { y: -U * y, rx: 0.15 }, 7);    // Riemen
  } else if (K.stil.hose === 'lang' || K.stil.hose === 'pluder') b.cyl(r * 0.7, r * 0.7, 0.03 * g, dunkler(farbe, 0.15), { y: -U + 0.015 * g }, 8);
  return b;
}

/** Fuß (Knochen fuss*): vom Knöchel bis zum Boden, Zehen nach +Z. */
export function baueFuss(b, K) {
  const { m, g, f } = K, h = m.fussHoehe - 0.02 * m.hoehe / 1.75, Lf = m.fussLaenge, st = K.stil.schuhe;
  const breit = 0.085 * g * Math.sqrt(K.w), zMitte = Lf * 0.22, nackt = st === 'barfuss' || st === 'sandalen';
  const fuss = nackt ? f.haut : f.schuh;
  b.sphere(K.beinR * 0.65, fuss, { y: 0 }, 6, 4);
  b.box(breit, h * 0.9, Lf * 0.75, fuss, { y: -h * 0.5, z: zMitte - Lf * 0.1 });
  b.sphere(breit * 0.55, fuss, { y: -h * 0.55, z: zMitte + Lf * 0.3, sy: h / breit * 0.9, sz: 1.3 }, 7, 4);
  if (nackt) for (let i = 0; i < 4; i++) b.sphere(0.011 * g, f.haut, { x: (i - 1.5) * breit * 0.24, y: -h * 0.8, z: zMitte + Lf * 0.48 - Math.abs(i - 1.5) * 0.008 * g }, 4, 3);
  if (st === 'barfuss') return b;
  b.box(breit * 1.08, 0.016 * g, Lf * 1.0, dunkler(f.schuh, 0.45), { y: -h + 0.008 * g, z: zMitte });          // Sohle
  if (st === 'sandalen') {
    for (const [z, rx] of [[zMitte + Lf * 0.18, 0], [zMitte - Lf * 0.12, 0]]) b.box(breit * 1.1, 0.014 * g, 0.022 * g, f.schuh, { y: -h * 0.45, z, rx });
    b.box(breit * 0.25, h * 0.8, 0.014 * g, f.schuh, { y: -h * 0.5, z: zMitte + Lf * 0.04, rx: 0.5 });
  } else if (st === 'stiefel') b.cyl(K.beinR * 0.7, K.beinR * 0.8, h * 1.2, f.schuh, { y: -h * 0.2 }, 8);
  else if (st === 'schnabelschuhe') {
    b.cone(breit * 0.45, Lf * 0.45, f.schuh, { y: -h * 0.6, z: zMitte + Lf * 0.62, rx: Math.PI / 2 - 0.25, sx: 1, sz: 0.6 }, 6);   // Spitze
    b.sphere(0.012 * g, heller(f.schuh, 0.3), { y: -h * 0.6 + Lf * 0.056, z: zMitte + Lf * 0.84 }, 4, 3);
  } else b.box(breit * 0.5, 0.008 * g, 0.03 * g, heller(f.schuh, 0.2), { y: -h * 0.05, z: zMitte + Lf * 0.12 });
  return b;
}
