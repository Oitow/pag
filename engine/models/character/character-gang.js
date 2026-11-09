/**
 * @modul    character-gang
 * @zweck    Fortbewegungs-Posen einer Figur (rein): Fußziele aus Gangphase (gehen/laufen/sprinten ohne Fußrutschen), Bein-IK, Rumpf/Arme, Luft- und Schwimm-Pose
 * @api      schrittWeite(masse,tempo,opts) -> m ; stuetzAnteil(laufW,sprintW) -> 0…1 ; fussZiele(masse,g,ziele) -> ziele ; loeseBein(masse,pose,seite,ziel{x,y,z,neig,roll?}) ; naechsteRuhePhase(phase,laufW,sprintW) -> phase ; loeseBeine(masse,pose,ziele) -> pose ; gangPose(masse,g,ziele,out) -> pose ; luftPose(steigen,out) -> pose ; schwimmPose(masse,phase,zug,eintauchen,out) -> pose
 * @beispiel
 *   import { fussZiele, gangPose } from '../../engine/models/character/character-gang.js';
 *   const g = { phase, tempo: 1.8, laufW: 0, sprintW: 0, idleW: 0, duckW: 0, rutschW: 0 };
 *   gangPose(masse, g, fussZiele(masse, g, ziele), pose);   // meist über character-animator benutzt
 * @tags     figur, charakter, animation, gang, laufen, ik, fuesse, schwimmen
 * @version  1.1.0
 * @status   entwurf
 * @three    nein
 */
import { clamp, lerp, smoothstep, angleDiff } from '../../core/math.js';
import { leerePose, mischePose } from './character-pose.js';
import { clipPose } from './character-clips.js';

const skala = (m) => m.hoehe / 1.75;
const frac = (x) => x - Math.floor(x);
const PI_ = Math.PI;

/** Länge eines Schritts (ein Fuß) in m beim Tempo; Gangzyklus = 2 Schritte. Wächst mit dem Tempo (kurze Trippelschritte → lange Sprünge). */
export function schrittWeite(masse, tempo, opts = {}) {
  const g = opts.gehTempo ?? 1.8, l = opts.laufTempo ?? 5.5, s = opts.sprintTempo ?? 8;
  const v = Math.max(0, +tempo || 0);
  let k;
  if (v <= g) k = lerp(0.35, 1, v / g);
  else if (v <= l) k = lerp(1, 1.9, (v - g) / (l - g));
  else if (v <= s) k = lerp(1.9, 2.3, (v - l) / (s - l));
  else k = Math.min(2.6, 2.3 + (v - s) * 0.05);
  return masse.schrittLaenge * k;
}

/** Anteil der Standphase am Zyklus (gehen 0.6 → laufen 0.36, mit Flugphase). */
export const stuetzAnteil = (laufW, sprintW = 0) => lerp(0.6, 0.36, clamp(laufW, 0, 1)) - 0.04 * clamp(sprintW, 0, 1);

function ziel() { return { x: 0, y: 0, z: 0, neig: 0, stand: true, vor: 0 }; }

/**
 * Fußziele (Knöchel im Figur-Raum) + Becken-Versatz aus dem Gang-Zustand g:
 *   { phase (Zyklen), tempo, laufW, sprintW, idleW, duckW, rutschW, gewicht (−1…1 Standbein), senke (m), opts }
 * → ziele = { L, R: {x,y,z,neig,stand,vor}, basisX, basisY, beckenZ }. In der Standphase wandert der Fuß genau mit −tempo nach hinten.
 */
export function fussZiele(m, g, z = {}) {
  const s = skala(m), Ls = m.oberschenkel + m.unterschenkel, a0 = m.fussHoehe - 0.02 * s;   // Knöchelhöhe bei Bodenkontakt (wie Ruhepose)
  const laufW = g.laufW || 0, sprintW = g.sprintW || 0, idleW = g.idleW ?? 0, duckW = g.duckW || 0, rutschW = g.rutschW || 0;
  const tempo = Math.max(0, g.tempo || 0), phase = g.phase || 0, gewicht = g.gewicht || 0;
  const beta = stuetzAnteil(laufW, sprintW);
  const S = beta * 2 * schrittWeite(m, tempo, g.opts);
  const anlauf = clamp(tempo / 0.8, 0, 1);
  const lift = (lerp(0.07, 0.2, laufW) + 0.05 * sprintW) * s * anlauf * (1 - 0.5 * duckW);
  const ferse = lerp(0.04, 0.07, laufW) * s * anlauf;
  for (const [seite, sg, off] of [['L', 1, 0], ['R', -1, 0.5]]) {
    const f = z[seite] || (z[seite] = ziel());
    const p = frac(phase + off);
    let zz, yy = a0, neig, stand = p < beta;
    if (stand) {
      const u = p / beta, heb = ferse * smoothstep(0.6, 1, u);
      zz = S / 2 - u * S;
      yy += heb;
      neig = -Math.asin(clamp(heb / (0.6 * m.fussLaenge), 0, 1)) + 0.25 * anlauf * (1 - smoothstep(0, 0.2, u));
    } else {
      const u = (p - beta) / (1 - beta);
      zz = -S / 2 + S * smoothstep(0, 1, u);
      const kick = laufW * 0.14 * s * Math.sin(PI_ * Math.min(1, u * 1.6)) ** 2;
      zz -= kick * 0.4 * (1 - u);
      yy += ferse + lift * Math.sin(PI_ * u) + kick;
      neig = (-0.45 * (1 - smoothstep(0, 0.4, u)) + 0.3 * smoothstep(0.55, 1, u)) * anlauf;
    }
    // Ruhestand: Füße hüftbreit, Spielbein leicht vor; Rutschen: Surf-Stand
    const ix = sg * (m.beckenBreite + 0.02 * s), iz = (gewicht * sg < 0 ? 0.07 * s * Math.abs(gewicht) : 0) + sg * 0.01 * s;
    const rx = sg * (m.beckenBreite + 0.1 * s), rz = sg > 0 ? 0.32 * s : -0.26 * s;
    const gx = sg * m.beckenBreite * 0.85;
    f.x = lerp(lerp(gx, ix, idleW), rx, rutschW);
    f.y = lerp(lerp(yy, a0, idleW), a0, rutschW);
    f.z = lerp(lerp(zz, iz, idleW), rz, rutschW);
    f.neig = lerp(lerp(neig, 0, idleW), sg > 0 ? 0 : -0.1, rutschW);
    f.stand = stand || idleW > 0.5 || rutschW > 0.5;
    f.vor = S > 1e-4 ? clamp(zz / (S / 2), -1, 1) : 0;
  }
  // Becken: Seitwippen zum Standbein, Laufen federt in der Standphase ein
  const bewegt = (1 - idleW) * (1 - rutschW);
  const seit = Math.cos(2 * PI_ * (phase - beta / 2));
  z.basisX = bewegt * seit * lerp(0.025, 0.01, laufW) * s + idleW * gewicht * 0.035 * s;
  z.beckenZ = bewegt * seit * 0.05 * (1 - laufW) + idleW * gewicht * 0.07;
  const senke = (0.02 + 0.05 * laufW) * s * bewegt + duckW * 0.3 * Ls + rutschW * 0.22 * Ls + (g.senke || 0);
  const federn = laufW * bewegt * 0.035 * s * -Math.cos(4 * PI_ * (phase - beta / 2));
  const huefteRuhe = m.hueftHoehe - 0.02 * s;
  // Gehen: Hüfte sinkt weich zum Doppelstand (beide Füße bei ±S/2), Mindest-Abstand sichert die Reichweite
  const r = 0.995 * Ls, doppel = Math.max(0, 0.99 * Ls - Math.sqrt(Math.max(0.01, r * r - S * S / 4)));
  const wippen = doppel * (1 - laufW) * bewegt * (0.5 + 0.5 * Math.cos(4 * PI_ * phase)) ** 1.5;
  let hy = a0 + 0.99 * Ls - senke + federn - wippen;
  for (const seite of ['L', 'R']) {
    const f = z[seite];
    if (!f.stand) continue;
    const dx = f.x - (seite === 'L' ? 1 : -1) * m.beckenBreite - z.basisX, dz = f.z;
    hy = Math.min(hy, f.y + Math.sqrt(Math.max(0.01, r * r - dz * dz - dx * dx)));
  }
  z.basisY = hy - huefteRuhe;
  return z;
}

/** Analytische 2-Gelenk-IK eines Beins: setzt huefte/knie/fuss so, dass der Knöchel auf ziel {x,y,z,neig,roll?} liegt (roll = Seitkippung der Sohle, Hang). */
export function loeseBein(m, pose, seite, f) {
  const s = skala(m), sg = seite === 'L' ? 1 : -1, L1 = m.oberschenkel, L2 = m.unterschenkel;
  const bp = pose.basisPos, nick = pose.basis.x + pose.becken.x, roll = pose.becken.z;
  const hx = bp.x + sg * m.beckenBreite * Math.cos(roll);
  const hy = bp.y + m.hueftHoehe - 0.02 * s + sg * m.beckenBreite * Math.sin(roll);
  const dx = f.x - hx, dy0 = f.y - hy, dz0 = f.z - bp.z;
  const cn = Math.cos(nick), sn = Math.sin(nick);
  const dy = dy0 * cn + dz0 * sn, dz = -dy0 * sn + dz0 * cn;    // ins (gekippte) Becken drehen
  const D = clamp(Math.hypot(dx, dy, dz), 0.25 * (L1 + L2), 0.999 * (L1 + L2));
  const knie = PI_ - Math.acos(clamp((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2), -1, 1));
  const A = L1 + L2 * Math.cos(knie), B = L2 * Math.sin(knie);
  const c = Math.asin(clamp(dx / A, -0.9, 0.9));
  const a = angleDiff(Math.atan2(-B, -A * Math.cos(c)), Math.atan2(dz, dy));
  const h = pose['huefte' + seite], k = pose['knie' + seite], fu = pose['fuss' + seite];
  h.x = a; h.y = 0; h.z = c - roll;
  k.x = knie; k.y = 0; k.z = 0;
  fu.x = -(f.neig || 0) - nick - a - knie; fu.y = 0; fu.z = -c + (f.roll || 0);   // fuss.x + kippt die Zehen nach unten (neig + = Zehen hoch); roll + = Sohle links (+X) hoch
}

/**
 * Nächste Gangphase ≥ phase, in der beide Füße nahe der Körpermitte sind (Standfuß bei z ≈ 0, anderer in der Schwungmitte)
 * – dorthin läuft der Animator beim Anhalten den angefangenen Schritt zu Ende.
 */
export function naechsteRuhePhase(phase, laufW = 0, sprintW = 0) {
  const b = stuetzAnteil(laufW, sprintW) / 2;
  return b + Math.ceil((phase - b) * 2 - 1e-9) / 2;
}

/** Beide Beine auf ziele.L / ziele.R lösen (nutzt basisPos/basis/becken der Pose). */
export function loeseBeine(m, pose, z) {
  loeseBein(m, pose, 'L', z.L);
  loeseBein(m, pose, 'R', z.R);
  return pose;
}

/**
 * Bodenpose (Gang/Ruhe/Ducken/Rutschen) aus g (siehe fussZiele, zusätzlich: zeit, atem 0…1, kurve (rad Seitlehnen),
 * vorlage (rad, Beschleunigung), griff (bool, Waffe in der Hand)) und den Fußzielen.
 */
export function gangPose(m, g, z, out = leerePose()) {
  mischePose(null, null, 0, out);
  const laufW = g.laufW || 0, sprintW = g.sprintW || 0, idleW = g.idleW ?? 0, duckW = g.duckW || 0, rutschW = g.rutschW || 0;
  const bewegt = (1 - idleW) * (1 - rutschW), t = g.zeit || 0;
  const atem = Math.sin(t * 2.1) * (0.4 + 0.6 * idleW) * (g.atem ?? 1);
  const vorL = z.L.vor * bewegt, vorR = z.R.vor * bewegt;
  out.basisPos.x = z.basisX; out.basisPos.y = z.basisY;
  out.basis.z = g.kurve || 0;
  out.becken.z = z.beckenZ;
  out.becken.y = -0.08 * vorL * (1 - laufW * 0.5);
  out.becken.x = 0.06 * laufW * bewegt + 0.1 * duckW;
  const tx = 0.03 + 0.14 * laufW * bewegt + 0.12 * sprintW + (g.vorlage || 0) + 0.3 * duckW + 0.15 * rutschW + 0.015 * atem;
  out.torso.x = tx;
  out.torso.y = 0.16 * vorL * lerp(1, 1.5, laufW) - out.becken.y + rutschW * 0.55;
  out.torso.z = -(g.kurve || 0) * 0.4 - z.beckenZ * 0.6;
  out.hals.x = -tx * 0.45; out.kopf.x = -tx * 0.35 - 0.1 * duckW;
  out.hals.y = -out.torso.y * 0.5 - out.becken.y * 0.5; out.kopf.y = -out.torso.y * 0.3;
  out.hals.z = -out.torso.z * 0.6 - (g.kurve || 0) * 0.3;
  // Arme: Gegenschwung zum Bein der anderen Seite
  const armA = lerp(0.4, 0.95, laufW) + 0.3 * sprintW;
  const ell = lerp(-0.22, -1.5, laufW) - 0.15 * sprintW;
  const breit = 0.07 + 0.12 * (m.bauch || 0) + 0.04 * (m.breite - 1);
  for (const [seite, sg, vorAnders] of [['L', 1, vorR], ['R', -1, vorL]]) {
    const sh = out['schulter' + seite], el = out['ellbogen' + seite], ha = out['hand' + seite];
    sh.x = -armA * vorAnders + idleW * 0.04 - 0.35 * duckW - 0.3 * rutschW;
    sh.z = sg * (breit + 0.02 * atem + 1.1 * rutschW + 0.1 * laufW);
    el.x = ell * bewegt - 0.18 * idleW - 0.25 * Math.max(0, vorAnders) - 0.7 * duckW - 0.3 * rutschW;
    ha.x = seite === 'R' && g.griff ? 1.45 : 0.05;
    ha.z = -sg * 0.1;
  }
  return loeseBeine(m, out, z);
}

/** Luft-Pose: steigen (+1, Beine angezogen) … fallen (−1, Arme hoch/seitlich, Beine greifen nach unten). */
export function luftPose(steigen, out = leerePose()) {
  mischePose(null, null, 0, out);
  const tuck = smoothstep(-0.1, 0.8, steigen), reach = smoothstep(0.1, -0.9, steigen);
  for (const [seite, sg] of [['L', 1], ['R', -1]]) {
    const asym = seite === 'L' ? 1 : -0.6;
    out['huefte' + seite].x = -0.85 * tuck - 0.2 * reach - 0.18 * tuck * asym;
    out['huefte' + seite].z = sg * 0.06 * reach;
    out['knie' + seite].x = 1.4 * tuck + 0.25 * reach + 0.2 * tuck * asym;
    out['fuss' + seite].x = 0.3 * tuck - 0.1 * reach;
    out['schulter' + seite].x = -0.9 * tuck - 0.3 * reach;
    out['schulter' + seite].z = sg * (0.3 * tuck + 1.15 * reach);
    out['ellbogen' + seite].x = -0.8 * tuck - 0.25 * reach;
  }
  out.torso.x = 0.12 * tuck - 0.06 * reach;
  out.hals.x = -0.06 * tuck + 0.08 * reach;
  return out;
}

/**
 * Schwimm-Pose: phase (Zyklen) des Brustschwimm-Zugs, zug 0 (Wassertreten) … 1 (zügig schwimmen),
 * eintauchen 0…1 (Wasserlinie in Körperhöhen über den Füßen). Rumpf kippt nach vorn, basisPos hält den Kopf über Wasser.
 */
export function schwimmPose(m, phase, zug, eintauchen, out = leerePose(), _tmp = leerePose()) {
  clipPose('wassertreten', frac(phase * 0.6) * 1.6, out);
  clipPose('schwimmen', frac(phase), _tmp);
  mischePose(out, _tmp, clamp(zug, 0, 1), out);
  const kipp = lerp(0.3, 1.25, clamp(zug, 0, 1));
  out.basis.x = kipp;
  out.hals.x -= kipp * 0.45; out.kopf.x -= kipp * 0.4;
  const hk = m.hoehe - m.kopfRadius * 1.2;
  const wasser = clamp(eintauchen, 0, 1) * m.hoehe;
  out.basisPos.y = wasser + m.kopfRadius * 0.4 - hk * Math.cos(kipp) + 0.03 * Math.sin(phase * 2 * PI_);
  out.basisPos.z = -hk * Math.sin(kipp) * 0.45;
  return out;
}
