/**
 * @modul    character-motor
 * @zweck    Kinematischer Figuren-Controller ohne THREE: Beschleunigung, Coyote-Time, Jump-Buffer, variable Sprunghöhe, Doppelsprung, Rolle/Dash, Gleiten, Tauchen, Kantenschutz, Stufen, Hang-Rutschen, Hindernisse, Schwimmen, Stöße
 * @api      createMotor({welt,pos,yaw,radius,hoehe,tuning,kantenSchutz,kollisionsId}) -> {zustand,tuning,radius,hoehe,kollisionsId,update(dt,absicht),teleport(pos,yaw?),stoss(x,y,z,{betaeubung}?),setTuning(teil),springeJetzt(),rolleJetzt(richtung?),speichern(),laden(stand),dispose()} ; MOTOR_TUNING
 * @beispiel
 *   import { createMotor } from '../../engine/gameplay/character-motor.js';
 *   const motor = createMotor({ welt: { bodenHoehe: (x, z) => 0 }, pos: { x: 0, y: 0, z: 0 }, tuning: { doppelSprung: 1 } });
 *   motor.update(dt, { x: 0, z: 1, sprint: false, springen: false, ducken: false, rollen: false, gleiten: false });
 *   figur.position.set(motor.zustand.pos.x, motor.zustand.pos.y, motor.zustand.pos.z);
 * @tags     figur, bewegung, physik, controller, sprung, schwimmen, rolle, dash, gleiten, gameplay
 * @version  1.2.0
 * @status   entwurf
 * @three    nein
 *
 * Absicht (alle Felder optional): { x, z, sprint, springen (gehalten), ducken, blickYaw,
 *   rollen (gehalten; Flanke = Ausweichrolle am Boden / Dash in der Luft), gleiten (gehalten, langsames Fallen),
 *   tauchen (gehalten, im Wasser abtauchen), schleichen (= ducken), kantenSchutz (wie Tuning, nur diesen Frame) }
 * Zusätzliche Zustandsfelder (1.1.0): rollt, dash, rollAnteil (0…1 Fortschritt), abklingzeit (s bis Rolle/Dash wieder geht),
 *   gleitet, doppelSprung (true im Frame des Luftsprungs), sprungZahl (Sprünge seit Bodenkontakt), taucht, tauchTiefe (m),
 *   schleicht, anKante (Kantenschutz hat gebremst), betaeubt (Rest-s nach Stoß), getroffen (true im ersten Frame nach stoss()).
 * Seit 1.2.0: welt.bodenHoehe(x, z, fussY) und welt.hindernisse(x, z, radius, { y, hoehe, ausser: kollisionsId }) bekommen Hinweise
 *   (alte Adapter ignorieren sie) → mit engine/world/kollision.js auf Kisten steigen, über Niedriges springen, eigener Körper zählt nicht.
 *   Schnelle Bewegung (Dash, Stoß) wird feiner unterteilt, damit nichts durch dünne Stämme tunnelt. speichern()/laden() = ganzer Zustand.
 */
import { clamp, lerp, damp, dampAngle, angleDiff, numOr } from '../core/math.js';
import { MOTOR_TUNING } from './character-motor-tuning.js';

export { MOTOR_TUNING };

const SCHRITT = 0.05, MAX_DT = 0.25, NORMAL_E = 0.35, MAX_SCHRITTE = 12;

export function createMotor({ welt, pos = { x: 0, y: NaN, z: 0 }, yaw = 0, radius = 0.3, hoehe = 1.75, tuning, kantenSchutz, kollisionsId } = {}) {
  if (!welt || typeof welt.bodenHoehe !== 'function') throw new Error('createMotor: welt.bodenHoehe fehlt');
  const T = Object.assign({}, MOTOR_TUNING, tuning);
  if (kantenSchutz !== undefined) T.kantenSchutz = !!kantenSchutz;
  // Boden mit Fußhöhe als Hinweis: Kollisions-Welten (engine/world/kollision.js) liefern dann auch begehbare Oberseiten
  const boden = (x, zz) => numOr(welt.bodenHoehe(x, zz, z.pos.y), 0);
  const gelaende = (x, zz) => numOr(welt.bodenHoehe(x, zz), 0);          // nur Gelände (für die Hangnormale)
  const filter = { y: 0, hoehe, ausser: kollisionsId };                    // Hinweis für welt.hindernisse (4. Argument)
  const wasser = (x, z) => { if (!welt.wasserHoehe) return null; const w = welt.wasserHoehe(x, z); return Number.isFinite(w) ? w : null; };

  const z = {
    pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, drehRate: 0, tempo: 0, tempoAnteil: 0,
    amBoden: true, imWasser: false, duckt: false, sprintet: false, rutscht: false, sprung: false, landung: 0,
    luftZeit: 0, eintauchen: 0,
    rollt: false, dash: false, rollAnteil: 0, abklingzeit: 0, gleitet: false, doppelSprung: false, sprungZahl: 0,
    taucht: false, tauchTiefe: 0, schleicht: false, anKante: false, betaeubt: 0, getroffen: false,
  };
  // interner Zustand
  let coyote = 0, puffer = 0, gehaltenVorher = false, rollVorher = false, volleHoehe = false, erzwungen = false;
  let stossX = 0, stossZ = 0, stossNeu = false;
  let rollRest = 0, rollGesamt = 1, rollX = 0, rollZ = 1, dashVerbraucht = false, rollErzwungen = null;
  const n = { x: 0, y: 1, z: 0 }, sicher = { x: 0, y: 0, z: 0 }; // Scratch: Bodennormale, letzte gültige Position

  function normale(x, zz) {
    const hL = gelaende(x - NORMAL_E, zz), hR = gelaende(x + NORMAL_E, zz), hD = gelaende(x, zz - NORMAL_E), hU = gelaende(x, zz + NORMAL_E);
    const nx = hL - hR, ny = 2 * NORMAL_E, nz = hD - hU, l = Math.hypot(nx, ny, nz);
    n.x = nx / l; n.y = ny / l; n.z = nz / l;
    return n;
  }

  function rollEnde() { rollRest = 0; z.rollt = false; z.dash = false; z.rollAnteil = 0; }

  function teleport(p, neuYaw) {
    z.pos.x = numOr(p?.x, 0); z.pos.z = numOr(p?.z, 0);
    z.pos.y = Number.isFinite(+p?.y) ? +p.y : gelaende(z.pos.x, z.pos.z);
    const b = boden(z.pos.x, z.pos.z);
    z.pos.y = Math.max(z.pos.y, b);
    z.vel.x = z.vel.y = z.vel.z = 0; stossX = stossZ = 0;
    if (neuYaw !== undefined) z.yaw = numOr(neuYaw, z.yaw);
    z.amBoden = z.pos.y - b < 0.05; z.imWasser = false; z.rutscht = false; z.luftZeit = 0;
    coyote = puffer = 0; volleHoehe = false; rollEnde(); z.abklingzeit = 0; dashVerbraucht = false;
    z.sprungZahl = 0; z.tauchTiefe = 0; z.taucht = false; z.gleitet = false; z.betaeubt = 0;
  }

  const schwimmY = (w) => w - hoehe * T.schwimmLage;
  const blockiert = (x, zz) => boden(x, zz) > z.pos.y + T.stufenHoehe + 1e-4;

  /** Rolle (Boden) bzw. Dash (Luft) starten, falls möglich. */
  function rolleStarten(ax, az, mag, richtung) {
    if (z.abklingzeit > 0 || z.imWasser || rollRest > 0) return;
    const luft = !z.amBoden;
    if (luft && (!T.luftDash || dashVerbraucht)) return;
    let dx = numOr(richtung?.x, NaN), dz = numOr(richtung?.z, NaN);
    if (!Number.isFinite(dx + dz) || Math.hypot(dx, dz) < 1e-6) {
      if (mag > 0.1) { dx = ax; dz = az; } else { dx = Math.sin(z.yaw); dz = Math.cos(z.yaw); }
    }
    const l = Math.hypot(dx, dz); rollX = dx / l; rollZ = dz / l;
    rollGesamt = rollRest = Math.max(0.01, luft ? T.dashDauer : T.rollDauer);
    z.rollt = !luft; z.dash = luft; z.abklingzeit = T.rollAbklingzeit; z.duckt = false;
    if (luft) { dashVerbraucht = true; z.vel.y = 0; }
  }

  /** Ein Unterschritt der Simulation. */
  function schritt(h, ax, az, mag, ab, gedrueckt, rollGedrueckt) {
    const p = z.pos, v = z.vel;
    if (gedrueckt) puffer = T.sprungPuffer; else puffer = Math.max(0, puffer - h);
    coyote = z.amBoden ? T.coyoteZeit : Math.max(0, coyote - h);
    z.abklingzeit = Math.max(0, z.abklingzeit - h);
    z.betaeubt = Math.max(0, z.betaeubt - h);
    if (rollGedrueckt || rollErzwungen) { rolleStarten(ax, az, mag, rollErzwungen); rollErzwungen = null; }

    // --- Wunschtempo ---
    const sprint = !!ab.sprint && mag > 0.3;
    let tempo = mag <= 0.5 ? T.gehTempo * mag / 0.5 : lerp(T.gehTempo, sprint ? T.sprintTempo : T.laufTempo, (mag - 0.5) / 0.5);
    z.duckt = !!(ab.ducken || ab.schleichen) && z.amBoden && !z.imWasser && rollRest <= 0;
    if (z.duckt) tempo = Math.min(tempo, T.duckTempo * Math.min(1, mag * 2));
    if (z.imWasser) tempo = T.schwimmTempo * mag * (sprint ? 1.4 : 1);
    z.sprintet = sprint && !z.duckt;
    let wx = mag > 1e-4 ? ax / mag : 0, wz = mag > 1e-4 ? az / mag : 0;

    // --- Hang ---
    normale(p.x, p.z);
    const hangGrad = Math.acos(clamp(n.y, -1, 1)) * 180 / Math.PI;
    z.rutscht = z.amBoden && hangGrad > T.hangGrenzeGrad && rollRest <= 0;
    const hl = Math.hypot(n.x, n.z), hx = hl > 1e-6 ? n.x / hl : 0, hz = hl > 1e-6 ? n.z / hl : 0; // hangabwärts
    if (z.amBoden && mag > 0) {
      const bergauf = -(n.x * wx + n.z * wz);
      if (bergauf > 0) tempo *= 1 - clamp(bergauf * 1.1, 0, T.bergaufBremse);
      if (z.rutscht) { const d = wx * hx + wz * hz; if (d < 0) { wx -= hx * d; wz -= hz * d; } }
    }
    const zx = wx * tempo, zz = wz * tempo;

    // --- horizontale Beschleunigung (Vektor-Annäherung) bzw. Rolle/Dash ---
    if (rollRest > 0) {
      const t = 1 - rollRest / rollGesamt;
      const s = z.dash ? T.dashTempo : T.rollTempo * lerp(1, 0.55, t);
      v.x = rollX * s; v.z = rollZ * s;
      if (z.dash) v.y = 0;
      z.rollAnteil = t;
      rollRest -= h;
      if (rollRest <= 0) rollEnde();
    } else {
      let acc = z.imWasser ? T.wasserBeschleunigung : z.amBoden ? (mag > 0.01 ? T.beschleunigung : T.abbremsen) : T.luftBeschleunigung * T.luftKontrolle;
      if (z.gleitet) acc *= T.gleitLuftKontrolle;
      if (z.rutscht) acc *= T.rutschKontrolle;
      if (z.betaeubt > 0 && mag > 0.01) acc *= T.betaeubtKontrolle;
      const dx = zx - v.x, dz = zz - v.z, dl = Math.hypot(dx, dz), st = acc * h;
      if (dl <= st) { v.x = zx; v.z = zz; } else { v.x += dx / dl * st; v.z += dz / dl * st; }
    }
    if (z.rutscht) {
      v.x += hx * T.rutschBeschleunigung * h; v.z += hz * T.rutschBeschleunigung * h;
      const ins = v.x * hx + v.z * hz; if (ins < 0) { v.x -= hx * ins; v.z -= hz * ins; } // nicht hangauf
      const s = Math.hypot(v.x, v.z); if (s > T.sprintTempo) { v.x *= T.sprintTempo / s; v.z *= T.sprintTempo / s; }
    }

    // --- Sprung ---
    const w0 = wasser(p.x, p.z);
    if (erzwungen || (puffer > 0 && coyote > 0 && !z.imWasser)) {
      v.y = Math.sqrt(2 * T.schwerkraft * T.sprungHoehe);
      volleHoehe = erzwungen; erzwungen = false; if (z.rollt) rollEnde();
      z.amBoden = false; z.imWasser = false; z.sprung = true; puffer = coyote = 0; z.luftZeit = 0; z.sprungZahl = 1;
    } else if (puffer > 0 && z.imWasser && w0 !== null && p.y >= schwimmY(w0) - 0.3) {
      v.y = Math.sqrt(2 * T.schwerkraft * T.schwimmSprungHoehe);
      z.imWasser = false; z.amBoden = false; z.sprung = true; puffer = coyote = 0; z.luftZeit = 0; z.sprungZahl = 1;
    } else if (gedrueckt && !z.amBoden && !z.imWasser && T.doppelSprung > 0 && z.sprungZahl < 1 + T.doppelSprung) {
      if (z.sprungZahl === 0) z.sprungZahl = 1; // von Kante gefallen zählt wie erster Sprung
      if (z.sprungZahl < 1 + T.doppelSprung) {
        v.y = Math.sqrt(2 * T.schwerkraft * T.doppelSprungHoehe);
        z.sprungZahl++; z.doppelSprung = z.sprung = true; puffer = 0; volleHoehe = false; if (z.dash) rollEnde();
      }
    }

    // --- Drehung ---
    const yawVorher = z.yaw;
    const blick = ab.blickYaw;
    if (rollRest > 0) z.yaw = dampAngle(z.yaw, Math.atan2(rollX, rollZ), T.drehRate * 2, h);
    else if (blick !== undefined && blick !== null && Number.isFinite(+blick)) z.yaw = dampAngle(z.yaw, +blick, T.drehRate, h);
    else if (mag > 0.05) z.yaw = dampAngle(z.yaw, Math.atan2(ax, az), T.drehRate * (z.imWasser ? 0.6 : 1), h);
    z.yaw = angleDiff(0, z.yaw);
    z.drehRate = damp(z.drehRate, angleDiff(yawVorher, z.yaw) / h, 10, h);

    // --- horizontal bewegen + Kollision ---
    const k = Math.exp(-T.stossDaempfung * (z.imWasser ? 2 : 1) * h);
    let mx = (v.x + stossX) * h, mz = (v.z + stossZ) * h;
    stossX *= k; stossZ *= k;
    if (blockiert(p.x + mx, p.z + mz)) {
      // Wandnormale aus dem Gelände an der blockierten Stelle → Geschwindigkeit/Stoß entlang der Wand
      normale(p.x + mx, p.z + mz);
      const l = Math.hypot(n.x, n.z);
      if (l > 1e-6) {
        const nx = n.x / l, nz = n.z / l, vn = v.x * nx + v.z * nz, mn = mx * nx + mz * nz, sn = stossX * nx + stossZ * nz;
        if (vn < 0) { v.x -= nx * vn; v.z -= nz * vn; }
        if (mn < 0) { mx -= nx * mn; mz -= nz * mn; }
        if (sn < 0) { stossX -= nx * sn; stossZ -= nz * sn; }
      }
      if (blockiert(p.x + mx, p.z + mz)) {
        if (!blockiert(p.x + mx, p.z)) { mz = 0; v.z = 0; stossZ = 0; }
        else if (!blockiert(p.x, p.z + mz)) { mx = 0; v.x = 0; stossX = 0; }
        else { mx = mz = 0; v.x = v.z = 0; stossX = stossZ = 0; }
      }
    }
    // Kantenschutz: nicht über Klippen laufen (Tuning, Absicht oder geduckt); Rolle/Stoß dürfen hinunter
    if (z.amBoden && !z.imWasser && rollRest <= 0 && (T.kantenSchutz || ab.kantenSchutz || z.duckt) && (mx || mz)) {
      const ml = Math.hypot(mx, mz);
      const klippe = (qx, qz) => { const l = Math.hypot(qx, qz) || 1; return p.y - boden(p.x + qx + qx / l * radius, p.z + qz + qz / l * radius) > T.kantenHoehe; };
      if (ml > 1e-9 && klippe(mx, mz)) {
        z.anKante = true;
        if (mx && !klippe(mx, 0)) { mz = 0; v.z = 0; }
        else if (mz && !klippe(0, mz)) { mx = 0; v.x = 0; }
        else { mx = mz = 0; v.x = v.z = 0; }
      }
    }
    p.x += mx; p.z += mz;
    if (welt.hindernisse) {
      for (let i = 0; i < 3; i++) {
        filter.y = p.y; filter.hoehe = hoehe; filter.ausser = kollisionsId;
        const s = welt.hindernisse(p.x, p.z, radius, filter);
        if (!s) break;
        const sx = numOr(s.x, 0), sz = numOr(s.z, 0), sl = Math.hypot(sx, sz);
        if (sl < 1e-9) break;
        if (blockiert(p.x + sx, p.z + sz)) break;
        p.x += sx; p.z += sz;
        const nx = sx / sl, nz = sz / sl, vn = v.x * nx + v.z * nz, sn = stossX * nx + stossZ * nz;
        if (vn < 0) { v.x -= nx * vn; v.z -= nz * vn; }
        if (sn < 0) { stossX -= nx * sn; stossZ -= nz * sn; }
      }
    }

    // --- vertikal ---
    const b = boden(p.x, p.z), w = wasser(p.x, p.z);
    const tiefe = w === null ? 0 : w - b;
    z.gleitet = false; z.taucht = false;
    if (z.imWasser) {
      const maxTauch = Math.max(0, schwimmY(w ?? p.y) - b - 0.1);
      if (ab.tauchen && T.tauchTempo > 0) { z.tauchTiefe = Math.min(maxTauch, z.tauchTiefe + T.tauchTempo * h); z.taucht = z.tauchTiefe > 0.05; }
      else z.tauchTiefe = Math.max(0, z.tauchTiefe - T.tauchTempo * h);
      z.tauchTiefe = Math.min(z.tauchTiefe, maxTauch);
      const ziel = schwimmY(w ?? p.y) - z.tauchTiefe;
      v.y += ((ziel - p.y) * T.auftrieb - v.y * 2 * Math.sqrt(T.auftrieb)) * h;
      p.y += v.y * h;
      if (p.y < b) { p.y = b; if (v.y < 0) v.y = 0; }
      if (w === null || tiefe < (T.wasserTiefeSchwimmen - 0.1) * hoehe) {
        z.imWasser = false; z.tauchTiefe = 0;
        if (p.y - b < 0.3) { p.y = Math.max(p.y, b); z.amBoden = true; v.y = 0; } else z.amBoden = false;
      }
    } else if (z.amBoden) {
      const fall = p.y - b, hs = Math.hypot(v.x, v.z);
      if (fall <= T.stufenHoehe + hs * h * 1.5) p.y = b;                 // Stufe hoch / Ground-Snap bergab
      else { z.amBoden = false; z.luftZeit = 0; if (z.rollt) rollEnde(); } // Kante → fallen (Coyote läuft)
      v.y = 0;
    } else if (z.dash) {
      z.luftZeit += h;                                                   // Dash: keine Schwerkraft
      if (p.y < b) { p.y = b; z.amBoden = true; z.luftZeit = 0; }
    } else {
      const g = T.schwerkraft * (v.y < 0 ? T.fallFaktor : (!ab.springen && !volleHoehe ? T.tiefSprungFaktor : 1));
      const vy0 = v.y;
      v.y = Math.max(-T.maxFall, v.y - g * h);
      if (ab.gleiten && T.gleitFallTempo > 0 && v.y < -T.gleitFallTempo) { v.y = Math.max(v.y, damp(vy0, -T.gleitFallTempo, 12, h)); z.gleitet = true; }
      else if (ab.gleiten && T.gleitFallTempo > 0 && v.y < 0) z.gleitet = true;
      p.y += (vy0 + v.y) * 0.5 * h;                                      // exakt bei konstanter Schwerkraft
      z.luftZeit += h;
      if (v.y <= 0) volleHoehe = false;
      if (p.y <= b) {
        if (v.y <= 0) { z.landung = Math.max(z.landung, -v.y); z.amBoden = true; z.luftZeit = 0; v.y = 0; z.gleitet = false; }
        p.y = b;
      }
    }
    if (z.amBoden || z.imWasser) { z.sprungZahl = 0; dashVerbraucht = false; if (z.dash) rollEnde(); }
    // ins tiefe Wasser geraten → schwimmen
    if (!z.imWasser && w !== null && tiefe > T.wasserTiefeSchwimmen * hoehe && p.y <= schwimmY(w) + 0.02 && v.y <= 0) {
      z.imWasser = true; z.amBoden = false; z.luftZeit = 0; z.gleitet = false; z.sprungZahl = 0; if (rollRest > 0) rollEnde();
    }
    z.eintauchen = w === null ? 0 : clamp((w - p.y) / hoehe, 0, 1);
  }

  function update(dt, absicht) {
    dt = clamp(numOr(dt, 0), 0, MAX_DT);
    z.sprung = false; z.landung = 0; z.doppelSprung = false; z.anKante = false;
    z.getroffen = stossNeu; stossNeu = false;
    const ab = absicht || {};
    let ax = numOr(ab.x, 0), az = numOr(ab.z, 0);
    let mag = Math.hypot(ax, az);
    if (mag > 1) { ax /= mag; az /= mag; mag = 1; }
    const gehalten = !!ab.springen;
    let gedrueckt = gehalten && !gehaltenVorher;
    gehaltenVorher = gehalten;
    const rollGehalten = !!ab.rollen;
    let rollGedrueckt = rollGehalten && !rollVorher;
    rollVorher = rollGehalten;
    if (dt > 0) {
      // Unterschritte: höchstens SCHRITT lang und (gegen Durchtunneln dünner Hindernisse) höchstens ~1 Radius weit
      const schnell = Math.max(Math.hypot(z.vel.x + stossX, z.vel.z + stossZ), rollRest > 0 || rollGedrueckt || rollErzwungen ? Math.max(T.dashTempo, T.rollTempo) : 0);
      const anzahl = Math.min(MAX_SCHRITTE, Math.max(Math.ceil(dt / SCHRITT - 1e-9), Math.ceil(schnell * dt / Math.max(radius, 0.1) - 1e-9))), h = dt / anzahl;
      sicher.x = z.pos.x; sicher.y = z.pos.y; sicher.z = z.pos.z;
      for (let i = 0; i < anzahl; i++) { schritt(h, ax, az, mag, ab, gedrueckt, rollGedrueckt); gedrueckt = rollGedrueckt = false; }
      if (!Number.isFinite(z.pos.x + z.pos.y + z.pos.z + z.vel.x + z.vel.y + z.vel.z)) {
        teleport(sicher, z.yaw); // Notbremse bei kaputten Welt-Werten
      }
    } else if (gedrueckt) puffer = T.sprungPuffer;
    z.tempo = Math.hypot(z.vel.x, z.vel.z);
    z.tempoAnteil = clamp(z.tempo / T.laufTempo, 0, 1);
    z.schleicht = z.duckt && z.tempo > 0.05;
    return z;
  }

  /** Stoß (m/s). betaeubung = Sekunden mit stark verminderter Steuerung (Rückstoß-Treffer). */
  function stoss(x, y, zz, { betaeubung = 0 } = {}) {
    stossX += numOr(x, 0); stossZ += numOr(zz, 0); stossNeu = true;
    z.betaeubt = Math.max(z.betaeubt, Math.max(0, numOr(betaeubung, 0)));
    const vy = numOr(y, 0);
    if (vy !== 0) { z.vel.y += vy; if (vy > 0) { z.amBoden = false; z.imWasser = false; volleHoehe = true; if (z.rollt) rollEnde(); } }
  }

  /** Vollständiger Zustand als reine Daten (Spielstand, Netzwerk: Vorhersage zurückspulen). `laden` nimmt genau das zurück. */
  function speichern() {
    return { z: { ...z, pos: { ...z.pos }, vel: { ...z.vel } },
      i: [coyote, puffer, gehaltenVorher, rollVorher, volleHoehe, stossX, stossZ, rollRest, rollGesamt, rollX, rollZ, dashVerbraucht] };
  }
  function laden(s) {
    if (!s || !s.z || !Array.isArray(s.i)) return false;
    const { pos: sp, vel: sv, ...rest } = s.z;
    Object.assign(z, rest);
    z.pos.x = numOr(sp?.x, z.pos.x); z.pos.y = numOr(sp?.y, z.pos.y); z.pos.z = numOr(sp?.z, z.pos.z);
    z.vel.x = numOr(sv?.x, 0); z.vel.y = numOr(sv?.y, 0); z.vel.z = numOr(sv?.z, 0);
    [coyote, puffer, gehaltenVorher, rollVorher, volleHoehe, stossX, stossZ, rollRest, rollGesamt, rollX, rollZ, dashVerbraucht] = s.i;
    erzwungen = false; rollErzwungen = null; stossNeu = false;
    return true;
  }

  z.yaw = numOr(yaw, 0);
  teleport(pos, z.yaw);

  return {
    zustand: z, tuning: T, update, teleport, stoss, speichern, laden,
    get kollisionsId() { return kollisionsId; }, set kollisionsId(v) { kollisionsId = v; },
    get radius() { return radius; }, set radius(v) { radius = Math.max(0.01, numOr(v, radius)); },
    get hoehe() { return hoehe; }, set hoehe(v) { hoehe = Math.max(0.1, numOr(v, hoehe)); },
    setTuning(teil) { Object.assign(T, teil); },
    springeJetzt() { erzwungen = true; },
    /** Rolle/Dash beim nächsten Update erzwingen (beachtet Abklingzeit), optional in Richtung {x,z}. */
    rolleJetzt(richtung) { rollErzwungen = richtung || {}; },
    dispose() { welt = null; },
  };
}
