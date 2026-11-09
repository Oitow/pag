/**
 * @modul    character-anim-zustand
 * @zweck    Posen für Sonder-Zustände des Motors (rein): Rolle (rollAnteil), Luft-Dash, Salto beim Doppelsprung, Gleiten, Arme rudern an der Kante, Betäubt-Taumeln
 * @api      createZustandsSchicht() -> { update(dt,zustand,skal), anwenden(pose) -> pose, ausdruck, rolleW, saltoW, dispose() }
 * @beispiel
 *   import { createZustandsSchicht } from '../../engine/models/character/character-anim-zustand.js';
 *   const zs = createZustandsSchicht();
 *   zs.update(dt, motor.zustand, masse.hueftHoehe / 0.89); zs.anwenden(pose);   // nach allen anderen Schichten
 * @tags     figur, charakter, animation, rolle, dash, salto, gleiten, kante, betaeubt, motor
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { clamp, damp, smoothstep, numOr } from '../../core/math.js';
import { leerePose, mischePose, maskeVon } from './character-pose.js';
import { clipPose, CLIPS } from './character-clips.js';
import { luftPose } from './character-gang.js';

const TAU = Math.PI * 2;
const GLEIT = { schulterL: [-0.2, 0, 1.45], schulterR: [-0.2, 0, -1.45], ellbogenL: [-0.1], ellbogenR: [-0.1], torso: [0.25], hals: [-0.2],
  huefteL: [0.15], huefteR: [0.25], knieL: [0.3], knieR: [0.4], fussL: [0.4], fussR: [0.4] };
const DASH = { torso: [0.45], hals: [-0.35], kopf: [-0.15], schulterL: [0.6, 0, 0.35], schulterR: [0.6, 0, -0.35], ellbogenL: [-0.2], ellbogenR: [-0.2],
  huefteL: [0.35], huefteR: [0.1], knieL: [0.9], knieR: [0.5], fussL: [0.5], fussR: [0.5] };
function pose(roh) {
  const p = leerePose();
  for (const [k, v] of Object.entries(roh)) { p[k].x = v[0] || 0; p[k].y = v[1] || 0; p[k].z = v[2] || 0; }
  return p;
}

/** Feldnamen wie character-motor 1.1.0: rollt, rollAnteil, dash, doppelSprung, gleitet, anKante, betaeubt (alle optional). */
export function createZustandsSchicht() {
  const P = { rolle: leerePose(), salto: leerePose(), gleit: pose(GLEIT), dash: pose(DASH) };
  const st = { rolleW: 0, dashW: 0, gleitW: 0, salto: -1, saltoW: 0, kante: 0, betW: 0, zeit: 0, hc: 0.9 };

  function update(dt, z = {}, skal = 1) {
    dt = clamp(numOr(dt, 0), 0, 0.1);
    st.zeit += dt;
    st.hc = 0.95 * skal;
    st.rolleW = damp(st.rolleW, z.rollt ? 1 : 0, z.rollt ? 30 : 12, dt);
    if (st.rolleW > 1e-3 && CLIPS.ausweichrolle) {
      clipPose('ausweichrolle', clamp(numOr(z.rollAnteil, 0), 0, 1) * CLIPS.ausweichrolle.dauer, P.rolle);
      P.rolle.basisPos.x *= skal; P.rolle.basisPos.y *= skal; P.rolle.basisPos.z *= skal;
    }
    st.dashW = damp(st.dashW, z.dash ? 1 : 0, 14, dt);
    st.gleitW = damp(st.gleitW, z.gleitet ? 1 : 0, 6, dt);
    if (z.doppelSprung) st.salto = 0;
    if (z.amBoden !== false || z.imWasser) st.salto = -1;   // Landung bricht ab
    if (st.salto >= 0) {
      st.salto += dt / 0.5;
      if (st.salto >= 1) st.salto = -1;
    }
    st.saltoW = st.salto >= 0 ? 1 : 0;
    if (st.saltoW) {
      const u = smoothstep(0, 1, st.salto), th = TAU * u, tuck = Math.sin(Math.PI * st.salto);
      luftPose(tuck * 1.2, P.salto);
      P.salto.basis.x = th > Math.PI ? th - TAU : th;      // Drehung um die Körpermitte (Sprung über ±π unsichtbar)
      P.salto.basisPos.y = st.hc - st.hc * Math.cos(th);
      P.salto.basisPos.z = -st.hc * Math.sin(th);
    }
    if (z.anKante) st.kante = 0.7;
    st.kante = Math.max(0, st.kante - dt);
    st.betW = damp(st.betW, numOr(z.betaeubt, 0) > 0 ? 1 : 0, 4, dt);
  }

  function anwenden(p) {
    if (st.gleitW > 1e-3) mischePose(p, P.gleit, st.gleitW, p, maskeVon('oben').concat(['huefteL', 'huefteR', 'knieL', 'knieR', 'fussL', 'fussR']));
    if (st.dashW > 1e-3) mischePose(p, P.dash, st.dashW, p);
    if (st.saltoW) mischePose(p, P.salto, 1, p);
    if (st.rolleW > 1e-3) mischePose(p, P.rolle, st.rolleW, p);
    if (st.kante > 0) {                                     // Arme rudern, Oberkörper lehnt zurück
      const k = smoothstep(0, 0.2, st.kante), w = st.zeit * 14;
      p.schulterL.x += (-1.6 + Math.sin(w) * 1.2) * k; p.schulterR.x += (-1.6 + Math.sin(w + Math.PI) * 1.2) * k;
      p.schulterL.z += 0.5 * k; p.schulterR.z -= 0.5 * k;
      p.torso.x -= 0.25 * k; p.hals.x += 0.15 * k;
    }
    if (st.betW > 1e-3) {                                   // benommen taumeln
      const b = st.betW, t = st.zeit;
      p.torso.z += Math.sin(t * 2.3) * 0.12 * b; p.torso.x += 0.12 * b + Math.sin(t * 1.7) * 0.05 * b;
      p.hals.x += 0.25 * b; p.kopf.z += Math.sin(t * 2.3 + 1) * 0.2 * b; p.kopf.x += 0.15 * b;
      p.schulterL.z -= 0.05 * b; p.schulterR.z += 0.05 * b; p.ellbogenL.x -= 0.1 * b; p.ellbogenR.x -= 0.1 * b;
    }
    return p;
  }

  const api = { update, anwenden, dispose() { st.salto = -1; st.rolleW = st.dashW = st.gleitW = st.betW = st.kante = 0; } };
  Object.defineProperties(api, {
    rolleW: { get: () => st.rolleW, enumerable: true },
    saltoW: { get: () => st.saltoW, enumerable: true },
    /** Vorschlag für die Mimik oder null. */
    ausdruck: { get: () => (st.betW > 0.5 ? 'benommen' : st.kante > 0 ? 'erschrocken' : null), enumerable: true },
    /** Gesamtgewicht der Ganzkörper-Übersteuerungen (Rolle/Dash/Salto) – Blick/Sekundär dämpfen. */
    uebersteuert: { get: () => Math.max(st.rolleW, st.dashW, st.saltoW), enumerable: true },
  });
  return api;
}
