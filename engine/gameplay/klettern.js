/**
 * @modul    klettern
 * @zweck    Klettern an sehr steilen Hängen (Gelände steiler als hangGrad) und hohen Hindernissen (Stämme, Felsen, Mauern): erkennt die Wand vor der Figur, steuert den Motor über absicht.klettern (hoch/runter/seitlich, Hochziehen oben, Absprung), kostet Ausdauer – leer = abrutschen
 * @api      createKlettern({welt,motor,ausdauer,hangGrad,tempo,seitTempo,anlauf,minHoehe,abSprung}) -> {klettert,wand,hochziehen,update(dt,absicht)->absicht,loslassen(),suche(pos,richtung)->wand|null,dispose()}
 * @beispiel
 *   import { createKlettern } from '../../engine/gameplay/klettern.js';
 *   const klettern = createKlettern({ welt: { bodenHoehe, normale, hindernisse: kollision.hindernisse }, motor: figur.motor, ausdauer });
 *   zuAbsicht(eingabe.lesen(), cam.blickYaw(), absicht);
 *   klettern.update(dt, absicht);     // setzt absicht.klettern (Motor ≥ 1.3.0) oder löscht es
 *   figur.update(dt, absicht);
 * @tags     klettern, wand, hang, fels, baum, ausdauer, motor, bewegung, gameplay
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Wand: { art: 'gelaende'|'hindernis', nx, nz (waagerechte Normale, zeigt von der Wand weg), n:{x,y,z} (Gelände-Normale) }.
 * Start: Stick ≥ 60 % in die Wand, anlauf Sekunden lang, Ausdauer nicht erschöpft. Hindernisse zählen nur, wenn sie
 * auch auf Kopfhöhe + minHoehe noch da sind (keine Figuren/Kisten). Springen = Absprung von der Wand, Ducken = loslassen.
 */
import { clamp, numOr } from '../core/math.js';

const GRAD = Math.PI / 180;

export function createKlettern({
  welt, motor, ausdauer = null, hangGrad = 55, tempo = 1.7, seitTempo = 1.2, anlauf = 0.18, minHoehe = 0.6,
  abSprung = { weg: 4.5, hoch: 6 }, hochZiehZeit = 0.45,
} = {}) {
  if (!welt || typeof welt.bodenHoehe !== 'function') throw new Error('createKlettern: welt.bodenHoehe fehlt');
  if (!motor?.zustand) throw new Error('createKlettern: motor fehlt');
  const cosGrenze = Math.cos(hangGrad * GRAD), cosEnde = Math.cos((hangGrad - 10) * GRAD);
  const filter = { y: 0, hoehe: 1, ausser: undefined };
  const n = { x: 0, y: 1, z: 0 };
  let klettert = false, wand = null, anlaufZeit = 0, hoch = 0, springVorher = false;
  const k = { x: 0, y: 0, z: 0, haften: false, blickYaw: 0 };

  const gelaende = (x, z) => numOr(welt.bodenHoehe(x, z), 0);
  function normale(x, z) {
    const w = welt.normale?.(x, z);
    if (w && Number.isFinite(+w.y)) { const l = Math.hypot(w.x, w.y, w.z) || 1; n.x = w.x / l; n.y = w.y / l; n.z = w.z / l; return n; }
    const e = 0.35, nx = gelaende(x - e, z) - gelaende(x + e, z), nz = gelaende(x, z - e) - gelaende(x, z + e), l = Math.hypot(nx, 2 * e, nz);
    n.x = nx / l; n.y = 2 * e / l; n.z = nz / l; return n;
  }
  function hindernisBei(x, z, y, h) {
    if (typeof welt.hindernisse !== 'function') return null;
    filter.y = y; filter.hoehe = h; filter.ausser = motor.kollisionsId;
    return welt.hindernisse(x, z, 0.25, filter);
  }

  /** Wand vor pos in Richtung {x,z} (normiert) suchen. start: strengere Prüfung (Höhe). */
  function suche(pos, dir, start = false) {
    const r = numOr(motor.radius, 0.3), hoehe = numOr(motor.hoehe, 1.75);
    // 1) Hindernis mit Höhe
    const hx = pos.x + dir.x * (r + 0.2), hz = pos.z + dir.z * (r + 0.2);
    const s = hindernisBei(hx, hz, pos.y + 0.5, hoehe - 0.5);
    if (s && (!start || hindernisBei(hx, hz, pos.y + hoehe + minHoehe - 0.4, 0.4))) {
      const l = Math.hypot(s.x, s.z);
      if (l > 1e-6) {
        const nx = s.x / l, nz = s.z / l;
        if (nx * dir.x + nz * dir.z < -0.3) return { art: 'hindernis', nx, nz, n: { x: nx, y: 0, z: nz } };
      }
    }
    // 2) steiles Gelände: voraus höher und steiler als die Grenze
    const qx = pos.x + dir.x * (r + 0.35), qz = pos.z + dir.z * (r + 0.35);
    if (gelaende(qx, qz) - pos.y < (start ? 0.25 : -0.3)) return null;
    const g = normale(qx, qz);
    if (g.y > (start ? cosGrenze : cosEnde)) return null;
    const hl = Math.hypot(g.x, g.z);
    if (hl < 1e-6) return null;
    const nx = g.x / hl, nz = g.z / hl;
    if (nx * dir.x + nz * dir.z > -0.2) return null;        // Hang fällt nicht zu uns hin ab
    return { art: 'gelaende', nx, nz, n: { x: g.x, y: g.y, z: g.z } };
  }

  function ende() { klettert = false; wand = null; anlaufZeit = 0; hoch = 0; }

  function update(dt, ab) {
    dt = Math.max(0, numOr(dt, 0));
    const z = motor.zustand, p = z.pos;
    const ax = numOr(ab.x, 0), az = numOr(ab.z, 0), mag = Math.min(1, Math.hypot(ax, az));
    const springen = !!ab.springen, sprungFlanke = springen && !springVorher;
    springVorher = springen;

    // Hochziehen über die Oberkante: kurz vorwärts + hoch, dann normal weiter
    if (hoch > 0) {
      hoch -= dt;
      k.x = -wand.nx * 2.2; k.z = -wand.nz * 2.2; k.y = 2.6; k.haften = false;
      ab.klettern = k;
      if (hoch <= 0) { ende(); delete ab.klettern; }
      return ab;
    }

    if (!klettert) {
      delete ab.klettern;
      const darf = mag > 0.5 && !z.rollt && !z.dash && (z.amBoden || z.imWasser || z.vel.y > -7) && (!ausdauer || ausdauer.kann('klettern'));
      const w = darf ? suche(p, { x: ax / mag, z: az / mag }, true) : null;
      const hinein = w ? -(ax * w.nx + az * w.nz) / mag : 0;
      if (w && hinein > 0.6) {
        anlaufZeit += dt;
        if (anlaufZeit >= anlauf || !z.amBoden) { klettert = true; wand = w; anlaufZeit = 0; }
      } else anlaufZeit = 0;
      if (!klettert) return ab;
    }

    // --- klettert ---
    if (sprungFlanke) {                                        // Absprung von der Wand
      const w = wand; ende(); delete ab.klettern; ab.springen = false;
      if (!ausdauer || ausdauer.zahle('kletterSprung')) motor.stoss(w.nx * abSprung.weg, abSprung.hoch, w.nz * abSprung.weg);
      return ab;
    }
    if (ab.ducken) { ende(); delete ab.klettern; ab.ducken = false; return ab; }

    const neu = suche(p, { x: -wand.nx, z: -wand.nz }, false);
    if (!neu) {
      if (wand.art === 'hindernis' && mag > 0.3 && -(ax * wand.nx + az * wand.nz) > 0) { hoch = hochZiehZeit; return update(0, ab); }
      ende(); delete ab.klettern; return ab;
    }
    wand = neu;
    // Eingabe zerlegen: in die Wand = hoch, Rest (Wand-Ebene) = seitlich
    const hinein = -(ax * wand.nx + az * wand.nz);
    const sx = ax + wand.nx * hinein, sz = az + wand.nz * hinein;
    const hoch1 = clamp(hinein, -1, 1) * tempo;
    const bewegt = Math.abs(hinein) > 0.15 || Math.hypot(sx, sz) > 0.15;
    if (ausdauer && !ausdauer.verbrauche(bewegt ? 'klettern' : 'kletternHalten', dt)) { ende(); delete ab.klettern; return ab; } // leer → abrutschen
    if (wand.art === 'gelaende') {
      const g = wand.n, tx = -g.x * g.y, ty = 1 - g.y * g.y, tz = -g.z * g.y, tl = Math.hypot(tx, ty, tz) || 1;
      k.x = tx / tl * hoch1 + sx * seitTempo; k.y = ty / tl * hoch1; k.z = tz / tl * hoch1 + sz * seitTempo; k.haften = true;
      if (hoch1 < 0 && normale(p.x, p.z).y > cosEnde) { ende(); delete ab.klettern; return ab; }   // unten flach → laufen
    } else {
      k.x = sx * seitTempo - wand.nx * 0.6; k.z = sz * seitTempo - wand.nz * 0.6; k.y = hoch1; k.haften = false;
      if (hoch1 < 0 && p.y - gelaende(p.x, p.z) < 0.05) { ende(); delete ab.klettern; return ab; }   // unten angekommen
    }
    k.blickYaw = Math.atan2(-wand.nx, -wand.nz);
    ab.klettern = k;
    return ab;
  }

  return {
    get klettert() { return klettert || hoch > 0; },
    get hochziehen() { return hoch > 0; },
    get wand() { return wand; },
    update, suche,
    loslassen() { ende(); },
    dispose() { ende(); },
  };
}
