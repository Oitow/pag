/**
 * @modul    koerper
 * @zweck    Leichte Physik für lose Dinge (Gegenstände, Beute, Bälle, Kisten-Trümmer) ohne THREE: Kugeln mit Schwerkraft, Abprallen, Reibung, Haften am flachen Hang, Rutschen am steilen, Schwimmen/Sinken, Hindernisse, Einschlafen – fester Zeitschritt, deterministisch
 * @api      createKoerperWelt({welt,schwerkraft,schritt,maxSchritte,ruheTempo,ruheZeit,onAufprall}) -> {neu(opts)->koerper,entferne(koerper|id),hole(id),impuls(koerper,x,y,z),wecke(koerper),weckeUmkreis(x,z,radius),schiebe(x,z,radius,vx,vz,y?,hoehe?),update(dt)->wach,alle(),anzahl,dispose()}
 * @beispiel
 *   import { createKoerperWelt } from '../../engine/gameplay/koerper.js';
 *   const physik = createKoerperWelt({ welt });                       // welt: Adapter oder Kollisions-Welt
 *   const apfel = physik.neu({ pos: { x: 0, y: 2, z: 0 }, vel: { x: 2, y: 3, z: 0 }, radius: 0.12 });
 *   // je Bild: physik.update(dt); mesh.position.copy(apfel.pos);
 *   physik.schiebe(held.x, held.z, 0.3, held.vx, held.vz, held.y, 1.75);   // Figur kickt lose Dinge weg
 * @tags     physik, koerper, gegenstand, schwerkraft, abprallen, schwimmen, rollen, gameplay
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * neu(opts): { pos {x,y,z} (Mittelpunkt), vel, radius = 0.15, sprung = 0.35 (0 = bleibt liegen … 1 = Flummi),
 *   reibung = 8 (1/s Bremsen am Boden; klein = rollt weit), haftung = 0.8 (Boden-Normale.y ab der das Ding am Hang liegen bleibt;
 *   1 = rollt jeden Hang hinab), auftrieb = 1.4 (>1 schwimmt, <1 sinkt), id, daten }
 * Körper (lebendes Objekt): { id, pos, vel, radius, amBoden, imWasser, ruht, daten } – pos/vel dürfen gelesen und gesetzt werden
 *   (nach dem Setzen wecke(k) rufen). Körper stoßen nicht untereinander zusammen (billig, reicht für Beute und Kleinkram).
 * onAufprall(koerper, tempo, 'boden' | 'wand' | 'wasser') ab ~1 m/s – für Klang und Staub.
 */
import { numOr } from '../core/math.js';

const NORMAL_E = 0.2, WASSER_BREMSE = 3.5, AUFPRALL_AB = 1, ABPRALL_AB = 1.2;

export function createKoerperWelt({ welt, schwerkraft = 24, schritt = 1 / 60, maxSchritte = 6, ruheTempo = 0.12, ruheZeit = 0.4, onAufprall = null } = {}) {
  if (!welt || typeof welt.bodenHoehe !== 'function') throw new Error('createKoerperWelt: welt.bodenHoehe fehlt');
  const liste = [], nachId = new Map();
  let naechsteId = 1, akku = 0;
  const filter = { y: 0, hoehe: 0 };
  const boden = (x, z, y) => numOr(welt.bodenHoehe(x, z, y), 0);

  function neu(o = {}) {
    const k = {
      id: o.id ?? naechsteId++,
      pos: { x: numOr(o.pos?.x, 0), y: numOr(o.pos?.y, NaN), z: numOr(o.pos?.z, 0) },
      vel: { x: numOr(o.vel?.x, 0), y: numOr(o.vel?.y, 0), z: numOr(o.vel?.z, 0) },
      radius: Math.max(0.01, numOr(o.radius, 0.15)), sprung: Math.min(1, Math.max(0, numOr(o.sprung, 0.35))),
      reibung: Math.max(0, numOr(o.reibung, 8)), haftung: numOr(o.haftung, 0.8), auftrieb: Math.max(0, numOr(o.auftrieb, 1.4)),
      amBoden: false, imWasser: false, ruht: false, still: 0, daten: o.daten,
    };
    if (!Number.isFinite(k.pos.y)) k.pos.y = boden(k.pos.x, k.pos.z) + k.radius;
    if (nachId.has(k.id)) entferne(k.id);
    liste.push(k); nachId.set(k.id, k);
    return k;
  }

  function entferne(wen) {
    const k = typeof wen === 'object' && wen ? wen : nachId.get(wen);
    const i = liste.indexOf(k);
    if (i < 0) return false;
    liste.splice(i, 1); nachId.delete(k.id);
    return true;
  }

  function wecke(k) { if (k) { k.ruht = false; k.still = 0; } }

  function einSchritt(k, h) {
    const p = k.pos, v = k.vel, r = k.radius;
    const warImWasser = k.imWasser;
    v.y -= schwerkraft * h;
    // Wasser: Auftrieb nach eingetauchtem Anteil + kräftige Bremse
    const w = welt.wasserHoehe ? welt.wasserHoehe(p.x, p.z) : null;
    k.imWasser = false;
    if (w !== null && w !== undefined && Number.isFinite(w) && p.y - r < w) {
      const tief = Math.min(1, (w - (p.y - r)) / (2 * r));
      v.y += schwerkraft * k.auftrieb * tief * h;
      const b = Math.exp(-WASSER_BREMSE * tief * h);
      v.x *= b; v.y *= b; v.z *= b;
      k.imWasser = tief > 0.3;
      if (k.imWasser && !warImWasser && onAufprall && v.y < -AUFPRALL_AB) onAufprall(k, -v.y, 'wasser');
    }
    p.x += v.x * h; p.y += v.y * h; p.z += v.z * h;

    // Hindernisse (Stämme, Kisten, Wände): ausschieben + abprallen
    if (welt.hindernisse) {
      filter.y = p.y - r; filter.hoehe = 2 * r;
      const s = welt.hindernisse(p.x, p.z, r, filter);
      if (s) {
        const sx = numOr(s.x, 0), sz = numOr(s.z, 0), sl = Math.hypot(sx, sz);
        if (sl > 1e-9) {
          p.x += sx; p.z += sz;
          const nx = sx / sl, nz = sz / sl, vn = v.x * nx + v.z * nz;
          if (vn < 0) {
            const e = -vn > ABPRALL_AB ? k.sprung : 0;
            v.x -= (1 + e) * vn * nx; v.z -= (1 + e) * vn * nz;
            if (onAufprall && -vn > AUFPRALL_AB) onAufprall(k, -vn, 'wand');
          }
        }
      }
    }

    // Boden (Gelände + begehbare Oberseiten)
    const fuss = p.y - r, b = boden(p.x, p.z, fuss + 0.05);
    k.amBoden = false;
    let haftet = false;                                         // liegt auf (fast) ebenem Grund → darf zur Ruhe kommen
    if (fuss <= b) {
      p.y = b + r;
      let nx = boden(p.x - NORMAL_E, p.z, b) - boden(p.x + NORMAL_E, p.z, b), ny = 2 * NORMAL_E, nz = boden(p.x, p.z - NORMAL_E, b) - boden(p.x, p.z + NORMAL_E, b);
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      if (ny >= k.haftung) { nx = 0; ny = 1; nz = 0; haftet = true; }   // flacher Hang: liegt wie auf ebenem Boden
      const vn = v.x * nx + v.y * ny + v.z * nz;
      if (vn < 0) {
        const e = -vn > ABPRALL_AB ? k.sprung : 0;
        v.x -= (1 + e) * vn * nx; v.y -= (1 + e) * vn * ny; v.z -= (1 + e) * vn * nz;
        if (onAufprall && -vn > AUFPRALL_AB) onAufprall(k, -vn, 'boden');
      }
      const f = Math.exp(-k.reibung * h);
      v.x *= f; v.z *= f; if (v.y < 0) v.y *= f;
      k.amBoden = true;
    }

    // Einschlafen: liegt (oder schwimmt) still
    const tempo = Math.hypot(v.x, v.y, v.z);
    if ((haftet || (k.imWasser && !k.amBoden)) && tempo < (haftet ? ruheTempo + schwerkraft * h : ruheTempo * 0.5)) {
      k.still += h;
      if (haftet) { v.x = v.z = 0; if (v.y < 0) v.y = 0; }
      if (k.still >= ruheZeit) { k.ruht = true; v.x = v.y = v.z = 0; }
    } else k.still = 0;

    if (!Number.isFinite(p.x + p.y + p.z + v.x + v.y + v.z) || p.y < -1000) {   // Notbremse
      p.x = numOr(p.x, 0); p.z = numOr(p.z, 0); p.y = boden(p.x, p.z) + r; v.x = v.y = v.z = 0;
    }
  }

  /** Simulation um dt weiterführen (intern feste Schritte). Liefert die Zahl wacher Körper. */
  function update(dt) {
    akku += Math.min(Math.max(numOr(dt, 0), 0), schritt * maxSchritte);
    let wach = 0;
    while (akku >= schritt - 1e-9) {
      akku -= schritt; wach = 0;
      for (let i = 0; i < liste.length; i++) { const k = liste[i]; if (!k.ruht) { einSchritt(k, schritt); wach++; } }
    }
    return wach;
  }

  /** Stoß in m/s (weckt auf). */
  function impuls(k, x, y, z) {
    if (!k) return;
    k.vel.x += numOr(x, 0); k.vel.y += numOr(y, 0); k.vel.z += numOr(z, 0);
    wecke(k);
  }

  function weckeUmkreis(x, z, radius) {
    for (const k of liste) if (Math.hypot(k.pos.x - x, k.pos.z - z) <= radius + k.radius) wecke(k);
  }

  /**
   * Ein bewegter Kreis (Figur: Fußhöhe y, Körpergröße hoehe) schiebt lose Dinge vor sich her: ausschieben + Geschwindigkeit mitgeben.
   * Liefert die Zahl der berührten Körper.
   */
  function schiebe(x, z, radius, vx = 0, vz = 0, y, hoehe = 1.75) {
    let n = 0;
    const tempo = Math.hypot(vx, vz);
    for (const k of liste) {
      const dx = k.pos.x - x, dz = k.pos.z - z, min = radius + k.radius, d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      if (y !== undefined && (k.pos.y + k.radius < y || k.pos.y - k.radius > y + hoehe)) continue;
      const d = Math.sqrt(d2), nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
      k.pos.x += nx * (min - d); k.pos.z += nz * (min - d);
      const rel = (vx - k.vel.x) * nx + (vz - k.vel.z) * nz;      // Annäherung entlang der Stoßrichtung
      if (rel > 0) { k.vel.x += nx * rel * 1.1; k.vel.z += nz * rel * 1.1; k.vel.y += Math.min(2, tempo * 0.15); }
      wecke(k); n++;
    }
    return n;
  }

  return {
    neu, entferne, impuls, wecke, weckeUmkreis, schiebe, update,
    hole: (id) => nachId.get(id),
    alle: () => liste,
    get anzahl() { return liste.length; },
    dispose() { liste.length = 0; nachId.clear(); },
  };
}
