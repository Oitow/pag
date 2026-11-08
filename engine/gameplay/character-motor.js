/**
 * @modul    character-motor
 * @zweck    Kinematischer Figuren-Controller ohne THREE: Beschleunigung, Coyote-Time, Jump-Buffer, variable Sprunghöhe, Stufen, Ground-Snap, Hang-Rutschen, Hindernisse, Schwimmen
 * @api      createMotor({welt,pos,yaw,radius,hoehe,tuning}) -> {zustand,tuning,radius,hoehe,update(dt,absicht),teleport(pos,yaw?),stoss(x,y,z),setTuning(teil),springeJetzt(),dispose()} ; MOTOR_TUNING
 * @beispiel
 *   import { createMotor } from '../../engine/gameplay/character-motor.js';
 *   const motor = createMotor({ welt: { bodenHoehe: (x, z) => 0 }, pos: { x: 0, y: 0, z: 0 } });
 *   motor.update(dt, { x: 0, z: 1, sprint: false, springen: false, ducken: false });
 *   figur.position.set(motor.zustand.pos.x, motor.zustand.pos.y, motor.zustand.pos.z);
 * @tags     figur, bewegung, physik, controller, sprung, schwimmen, gameplay
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { clamp, lerp, damp, dampAngle, angleDiff, numOr } from '../core/math.js';

/** Standardwerte (Meter, Sekunden). Jeder Motor hat eine eigene Kopie → `setTuning`. */
export const MOTOR_TUNING = {
  gehTempo: 1.8,              // m/s bei halbem Stick-Ausschlag
  laufTempo: 5.0,             // m/s bei vollem Ausschlag
  sprintTempo: 8.0,           // m/s mit Sprint
  duckTempo: 1.6,             // Höchsttempo geduckt
  schwimmTempo: 2.4,          // m/s schwimmend (Sprint ×1.4)
  beschleunigung: 40,         // m/s² am Boden mit Eingabe
  abbremsen: 32,              // m/s² am Boden ohne Eingabe
  luftBeschleunigung: 10,     // m/s² in der Luft (× luftKontrolle)
  wasserBeschleunigung: 12,   // m/s² schwimmend
  luftKontrolle: 1.0,         // 0 = keine Steuerung in der Luft
  drehRate: 12,               // Dämpfung der Drehung zur Laufrichtung (1/s)
  schwerkraft: 24,            // m/s²
  sprungHoehe: 1.3,           // m bei gehaltener Taste
  tiefSprungFaktor: 2.6,      // Schwerkraft-Faktor beim Steigen, wenn Taste losgelassen (variable Höhe)
  fallFaktor: 1.5,            // schwereres Fallen = knackiger
  maxFall: 40,                // m/s
  coyoteZeit: 0.13,           // s, Springen kurz nach Verlassen der Kante
  sprungPuffer: 0.15,         // s, Sprung-Druck kurz vor der Landung wird gemerkt
  stufenHoehe: 0.45,          // m, höhere Kanten blockieren wie eine Wand
  hangGrenzeGrad: 46,         // steiler → rutschen
  rutschBeschleunigung: 14,   // m/s² hangabwärts
  rutschKontrolle: 0.15,      // Anteil der Steuerung beim Rutschen
  bergaufBremse: 0.45,        // max. Tempoverlust bergauf
  wasserTiefeSchwimmen: 0.75, // schwimmen ab Wassertiefe = Anteil von hoehe
  schwimmLage: 0.68,          // Anteil von hoehe unter der Oberfläche beim Schwimmen (Kopf bleibt oben)
  auftrieb: 30,               // Federkonstante zur Schwimmlage (1/s²)
  schwimmSprungHoehe: 1.2,    // m, Sprung aus dem Wasser (Ufer erklimmen)
  stossDaempfung: 7,          // Abklingen horizontaler Stöße (1/s)
};

const SCHRITT = 0.05, MAX_DT = 0.25, NORMAL_E = 0.35;

export function createMotor({ welt, pos = { x: 0, y: NaN, z: 0 }, yaw = 0, radius = 0.3, hoehe = 1.75, tuning } = {}) {
  if (!welt || typeof welt.bodenHoehe !== 'function') throw new Error('createMotor: welt.bodenHoehe fehlt');
  const T = Object.assign({}, MOTOR_TUNING, tuning);
  const boden = (x, z) => numOr(welt.bodenHoehe(x, z), 0);
  const wasser = (x, z) => { if (!welt.wasserHoehe) return null; const w = welt.wasserHoehe(x, z); return Number.isFinite(w) ? w : null; };

  const z = {
    pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, drehRate: 0, tempo: 0, tempoAnteil: 0,
    amBoden: true, imWasser: false, duckt: false, sprintet: false, rutscht: false, sprung: false, landung: 0,
    luftZeit: 0, eintauchen: 0,
  };
  // interner Zustand
  let coyote = 0, puffer = 0, gehaltenVorher = false, volleHoehe = false, erzwungen = false;
  let stossX = 0, stossZ = 0;
  const n = { x: 0, y: 1, z: 0 }, sicher = { x: 0, y: 0, z: 0 }; // Scratch: Bodennormale, letzte gültige Position

  function normale(x, zz) {
    const hL = boden(x - NORMAL_E, zz), hR = boden(x + NORMAL_E, zz), hD = boden(x, zz - NORMAL_E), hU = boden(x, zz + NORMAL_E);
    const nx = hL - hR, ny = 2 * NORMAL_E, nz = hD - hU, l = Math.hypot(nx, ny, nz);
    n.x = nx / l; n.y = ny / l; n.z = nz / l;
    return n;
  }

  function teleport(p, neuYaw) {
    z.pos.x = numOr(p?.x, 0); z.pos.z = numOr(p?.z, 0);
    const b = boden(z.pos.x, z.pos.z);
    z.pos.y = Number.isFinite(+p?.y) ? Math.max(+p.y, b) : b;
    z.vel.x = z.vel.y = z.vel.z = 0; stossX = stossZ = 0;
    if (neuYaw !== undefined) z.yaw = numOr(neuYaw, z.yaw);
    z.amBoden = z.pos.y - b < 0.05; z.imWasser = false; z.rutscht = false; z.luftZeit = 0;
    coyote = puffer = 0; volleHoehe = false;
  }

  const schwimmY = (w) => w - hoehe * T.schwimmLage;
  const blockiert = (x, zz) => boden(x, zz) > z.pos.y + T.stufenHoehe + 1e-4;

  /** Ein Unterschritt der Simulation. */
  function schritt(h, ax, az, mag, ab, gedrueckt) {
    const p = z.pos, v = z.vel;
    if (gedrueckt) puffer = T.sprungPuffer; else puffer = Math.max(0, puffer - h);
    coyote = z.amBoden ? T.coyoteZeit : Math.max(0, coyote - h);

    // --- Wunschtempo ---
    const sprint = !!ab.sprint && mag > 0.3;
    let tempo = mag <= 0.5 ? T.gehTempo * mag / 0.5 : lerp(T.gehTempo, sprint ? T.sprintTempo : T.laufTempo, (mag - 0.5) / 0.5);
    z.duckt = !!ab.ducken && z.amBoden && !z.imWasser;
    if (z.duckt) tempo = Math.min(tempo, T.duckTempo * Math.min(1, mag * 2));
    if (z.imWasser) tempo = T.schwimmTempo * mag * (sprint ? 1.4 : 1);
    z.sprintet = sprint && !z.duckt;
    let wx = mag > 1e-4 ? ax / mag : 0, wz = mag > 1e-4 ? az / mag : 0;

    // --- Hang ---
    normale(p.x, p.z);
    const hangGrad = Math.acos(clamp(n.y, -1, 1)) * 180 / Math.PI;
    z.rutscht = z.amBoden && hangGrad > T.hangGrenzeGrad;
    const hl = Math.hypot(n.x, n.z), hx = hl > 1e-6 ? n.x / hl : 0, hz = hl > 1e-6 ? n.z / hl : 0; // hangabwärts
    if (z.amBoden && mag > 0) {
      const bergauf = -(n.x * wx + n.z * wz);
      if (bergauf > 0) tempo *= 1 - clamp(bergauf * 1.1, 0, T.bergaufBremse);
      if (z.rutscht) { const d = wx * hx + wz * hz; if (d < 0) { wx -= hx * d; wz -= hz * d; } }
    }
    const zx = wx * tempo, zz = wz * tempo;

    // --- horizontale Beschleunigung (Vektor-Annäherung) ---
    let acc = z.imWasser ? T.wasserBeschleunigung : z.amBoden ? (mag > 0.01 ? T.beschleunigung : T.abbremsen) : T.luftBeschleunigung * T.luftKontrolle;
    if (z.rutscht) acc *= T.rutschKontrolle;
    const dx = zx - v.x, dz = zz - v.z, dl = Math.hypot(dx, dz), st = acc * h;
    if (dl <= st) { v.x = zx; v.z = zz; } else { v.x += dx / dl * st; v.z += dz / dl * st; }
    if (z.rutscht) {
      v.x += hx * T.rutschBeschleunigung * h; v.z += hz * T.rutschBeschleunigung * h;
      const ins = v.x * hx + v.z * hz; if (ins < 0) { v.x -= hx * ins; v.z -= hz * ins; } // nicht hangauf
      const s = Math.hypot(v.x, v.z); if (s > T.sprintTempo) { v.x *= T.sprintTempo / s; v.z *= T.sprintTempo / s; }
    }

    // --- Sprung ---
    const w0 = wasser(p.x, p.z);
    if (erzwungen || (puffer > 0 && coyote > 0 && !z.imWasser)) {
      v.y = Math.sqrt(2 * T.schwerkraft * T.sprungHoehe);
      volleHoehe = erzwungen; erzwungen = false;
      z.amBoden = false; z.imWasser = false; z.sprung = true; puffer = coyote = 0; z.luftZeit = 0;
    } else if (puffer > 0 && z.imWasser && w0 !== null && p.y >= schwimmY(w0) - 0.3) {
      v.y = Math.sqrt(2 * T.schwerkraft * T.schwimmSprungHoehe);
      z.imWasser = false; z.amBoden = false; z.sprung = true; puffer = coyote = 0; z.luftZeit = 0;
    }

    // --- Drehung ---
    const yawVorher = z.yaw;
    const blick = ab.blickYaw;
    if (blick !== undefined && blick !== null && Number.isFinite(+blick)) z.yaw = dampAngle(z.yaw, +blick, T.drehRate, h);
    else if (mag > 0.05) z.yaw = dampAngle(z.yaw, Math.atan2(ax, az), T.drehRate * (z.imWasser ? 0.6 : 1), h);
    z.yaw = angleDiff(0, z.yaw);
    z.drehRate = damp(z.drehRate, angleDiff(yawVorher, z.yaw) / h, 10, h);

    // --- horizontal bewegen + Kollision ---
    const k = Math.exp(-T.stossDaempfung * h);
    let mx = (v.x + stossX) * h, mz = (v.z + stossZ) * h;
    stossX *= k; stossZ *= k;
    if (blockiert(p.x + mx, p.z + mz)) {
      // Wandnormale aus dem Gelände an der blockierten Stelle → Geschwindigkeit entlang der Wand
      normale(p.x + mx, p.z + mz);
      const l = Math.hypot(n.x, n.z);
      if (l > 1e-6) {
        const nx = n.x / l, nz = n.z / l, vn = v.x * nx + v.z * nz, mn = mx * nx + mz * nz;
        if (vn < 0) { v.x -= nx * vn; v.z -= nz * vn; }
        if (mn < 0) { mx -= nx * mn; mz -= nz * mn; }
      }
      if (blockiert(p.x + mx, p.z + mz)) {
        if (!blockiert(p.x + mx, p.z)) { mz = 0; v.z = 0; }
        else if (!blockiert(p.x, p.z + mz)) { mx = 0; v.x = 0; }
        else { mx = mz = 0; v.x = v.z = 0; }
      }
    }
    p.x += mx; p.z += mz;
    if (welt.hindernisse) {
      for (let i = 0; i < 3; i++) {
        const s = welt.hindernisse(p.x, p.z, radius);
        if (!s) break;
        const sx = numOr(s.x, 0), sz = numOr(s.z, 0), sl = Math.hypot(sx, sz);
        if (sl < 1e-9) break;
        if (blockiert(p.x + sx, p.z + sz)) break;
        p.x += sx; p.z += sz;
        const nx = sx / sl, nz = sz / sl, vn = v.x * nx + v.z * nz;
        if (vn < 0) { v.x -= nx * vn; v.z -= nz * vn; }
      }
    }

    // --- vertikal ---
    const b = boden(p.x, p.z), w = wasser(p.x, p.z);
    const tiefe = w === null ? 0 : w - b;
    if (z.imWasser) {
      const ziel = schwimmY(w ?? p.y);
      v.y += ((ziel - p.y) * T.auftrieb - v.y * 2 * Math.sqrt(T.auftrieb)) * h;
      p.y += v.y * h;
      if (p.y < b) { p.y = b; if (v.y < 0) v.y = 0; }
      if (w === null || tiefe < (T.wasserTiefeSchwimmen - 0.1) * hoehe) {
        z.imWasser = false;
        if (p.y - b < 0.3) { p.y = Math.max(p.y, b); z.amBoden = true; v.y = 0; } else z.amBoden = false;
      }
    } else if (z.amBoden) {
      const fall = p.y - b, hs = Math.hypot(v.x, v.z);
      if (fall <= T.stufenHoehe + hs * h * 1.5) p.y = b;                 // Stufe hoch / Ground-Snap bergab
      else { z.amBoden = false; z.luftZeit = 0; }                       // Kante → fallen (Coyote läuft)
      v.y = 0;
    } else {
      const g = T.schwerkraft * (v.y < 0 ? T.fallFaktor : (!ab.springen && !volleHoehe ? T.tiefSprungFaktor : 1));
      const vy0 = v.y;
      v.y = Math.max(-T.maxFall, v.y - g * h);
      p.y += (vy0 + v.y) * 0.5 * h;                                      // exakt bei konstanter Schwerkraft
      z.luftZeit += h;
      if (v.y <= 0) volleHoehe = false;
      if (p.y <= b) {
        if (v.y <= 0) { z.landung = Math.max(z.landung, -v.y); z.amBoden = true; z.luftZeit = 0; v.y = 0; }
        p.y = b;
      }
    }
    // ins tiefe Wasser geraten → schwimmen
    if (!z.imWasser && w !== null && tiefe > T.wasserTiefeSchwimmen * hoehe && p.y <= schwimmY(w) + 0.02 && v.y <= 0) {
      z.imWasser = true; z.amBoden = false; z.luftZeit = 0;
    }
    z.eintauchen = w === null ? 0 : clamp((w - p.y) / hoehe, 0, 1);
  }

  function update(dt, absicht) {
    dt = clamp(numOr(dt, 0), 0, MAX_DT);
    z.sprung = false; z.landung = 0;
    const ab = absicht || {};
    let ax = numOr(ab.x, 0), az = numOr(ab.z, 0);
    let mag = Math.hypot(ax, az);
    if (mag > 1) { ax /= mag; az /= mag; mag = 1; }
    const gehalten = !!ab.springen;
    let gedrueckt = gehalten && !gehaltenVorher;
    gehaltenVorher = gehalten;
    if (dt > 0) {
      const anzahl = Math.ceil(dt / SCHRITT - 1e-9), h = dt / anzahl;
      sicher.x = z.pos.x; sicher.y = z.pos.y; sicher.z = z.pos.z;
      for (let i = 0; i < anzahl; i++) { schritt(h, ax, az, mag, ab, gedrueckt); gedrueckt = false; }
      if (!Number.isFinite(z.pos.x + z.pos.y + z.pos.z + z.vel.x + z.vel.y + z.vel.z)) {
        teleport(sicher, z.yaw); // Notbremse bei kaputten Welt-Werten
      }
    } else if (gedrueckt) puffer = T.sprungPuffer;
    z.tempo = Math.hypot(z.vel.x, z.vel.z);
    z.tempoAnteil = clamp(z.tempo / T.laufTempo, 0, 1);
    return z;
  }

  function stoss(x, y, zz) {
    stossX += numOr(x, 0); stossZ += numOr(zz, 0);
    const vy = numOr(y, 0);
    if (vy !== 0) { z.vel.y += vy; if (vy > 0) { z.amBoden = false; z.imWasser = false; volleHoehe = true; } }
  }

  z.yaw = numOr(yaw, 0);
  teleport(pos, z.yaw);

  return {
    zustand: z, tuning: T, update, teleport, stoss,
    get radius() { return radius; }, set radius(v) { radius = Math.max(0.01, numOr(v, radius)); },
    get hoehe() { return hoehe; }, set hoehe(v) { hoehe = Math.max(0.1, numOr(v, hoehe)); },
    setTuning(teil) { Object.assign(T, teil); },
    springeJetzt() { erzwungen = true; },
    dispose() { welt = null; },
  };
}
