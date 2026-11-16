/**
 * @modul    grosszauber-wand
 * @zweck    Großzauber 'Erdwall': eine Felswand (bei voller Überladung ein Ring „Festung“) bricht in einer Steinwelle aus dem Boden, schleudert Ziele hoch, steht als echtes Hindernis und bröckelt dann weg
 * @api      createWand(opts, umgebung) -> { daten:{phase,alter,ring,segmente[{x,z,breite,dicke,hoeheZiel,hoehe,yaw,seed,zerfall}]}, update(dt,ziele,melde)->bool, hindernis(x,z,r), boden(x,z), dispose() }
 * @beispiel
 *   import { createWand } from '../../engine/gameplay/grosszauber-wand.js';
 *   const gross = createGrosszauber({ arten: { wand: createWand }, welt: adapter });
 *   gross.wirke('wand', { von: fuss, punkt, yaw, kraft: 1.3, def: ZAUBER.erdwall });
 * @tags     zauber, großzauber, wand, fels, hindernis, episch, boden, ring, festung, beben, kampf, mmo
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Blick = (sin yaw, cos yaw) in (x,z). Segment-yaw = Blickrichtung seiner Flächennormalen; die Breite liegt quer dazu.
 * Phasen: 'steigt' (Welle von der Mitte nach außen, ~0.7 s) → 'steht' (~12 s × kraft) → 'zerfaellt' (~3.5 s).
 * Meldet: beben, klang (grollen, bersten, wumms, explosion), funken, stopp, meldung, treffer.
 */
import { rng } from '../core/rng.js';
const SCHRITT = 1.7, ANSTIEG = 0.3, ZERFALL = 3.5, ZERFALL_SINK = 1.5, MIN_HOCH = 0.5;
const ease = (t) => { t = Math.max(0, Math.min(1, t)); return 1 - (1 - t) * (1 - t) * (1 - t); };

export function createWand(opts = {}, umgebung = {}) {
  const zufall = umgebung.zufall || rng(1);
  const kraft = Math.max(0.5, Math.min(1.8, +opts.kraft || 1));
  const def = opts.def || {};
  const von = opts.von || { x: 0, y: 0, z: 0 }, punkt = opts.punkt || von, yaw = +opts.yaw || 0;
  const ring = kraft >= 1.5;
  const stehzeit = 12 * kraft;
  const hoehe = Math.min(9, 5 * (0.85 + 0.55 * (kraft - 1) + 0.15)) * (ring ? 0.9 : 1);
  const laenge = Math.min(28, 16 * (1 + (kraft - 1) * 1.2));
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  const bodenAt = (x, z) => (typeof umgebung.boden === 'function' ? +umgebung.boden(x, z) || 0 : 0);
  // Mindestens 7 m vor dem Zaubernden (Auto-Ziel kann direkt neben ihm liegen – sonst bricht die Wand unter ihm aus)
  const MIN = 7, ab = Math.hypot(punkt.x - von.x, punkt.z - von.z);
  const vorn = ab >= MIN ? punkt : ab > 0.5 ? { x: von.x + (punkt.x - von.x) / ab * MIN, z: von.z + (punkt.z - von.z) / ab * MIN } : { x: von.x + sy * MIN, z: von.z + cy * MIN };
  const mitte = ring ? { x: von.x, z: von.z } : { x: vorn.x, z: vorn.z };

  const segmente = [];
  if (ring) {
    const R = 8 + 2 * (kraft - 1.5), n = Math.round((2 * Math.PI * R) / SCHRITT);
    for (let i = 0; i < n; i++) {
      const w = (i / n) * 2 * Math.PI, ang = yaw + w, d = Math.min(w, 2 * Math.PI - w) / Math.PI;   // d: 0 vorn … 1 hinten
      segmente.push(neu(von.x + R * Math.sin(ang), von.z + R * Math.cos(ang), ang, d));
    }
  } else {
    const n = Math.max(3, Math.round(laenge / SCHRITT)), biegung = laenge * 1.1;   // Krümmungsradius: Enden zeigen zum Zaubernden
    for (let i = 0; i < n; i++) {
      const s = (i - (n - 1) / 2) * SCHRITT, d = Math.abs(s) / (laenge / 2);
      segmente.push(neu(mitte.x + s * cy - (s * s / (2 * biegung)) * sy, mitte.z - s * sy - (s * s / (2 * biegung)) * cy, yaw + s / biegung, d));
    }
  }
  function neu(x, z, y, d) {
    const seed = Math.floor(zufall() * 1e6), mitteFaktor = 1 - 0.35 * d * d;   // Mitte höher
    return {
      x, z, breite: SCHRITT * (1.15 + zufall() * 0.35), dicke: 2 + zufall() * 1.2,
      hoeheZiel: hoehe * mitteFaktor * (0.8 + zufall() * 0.4), hoehe: 0, yaw: y, seed,
      zerfall: 0, _verzug: d * 0.4 + zufall() * 0.08, _start: zerfallStart(), _aus: false, _y0: bodenAt(x, z),
    };
  }
  function zerfallStart() { return zufall() * (ZERFALL - ZERFALL_SINK); }

  const daten = { phase: 'steigt', alter: 0, ring, segmente, pos: { x: mitte.x, y: bodenAt(mitte.x, mitte.z), z: mitte.z }, yaw, kraft, hoeheMax: hoehe, laenge: ring ? 0 : laenge };
  let gestartet = false, schlag = false, berstZeit = 0, getroffen = new Set(), zerbebt = false;

  function treffe(s, ziele, melde) {
    const c = Math.cos(s.yaw), si = Math.sin(s.yaw), hb = s.breite / 2 + 0.2, hd = s.dicke / 2;
    const liste = [];
    for (const z of ziele) {
      if (!z || getroffen.has(z.id) || z.id === 'spieler' || z.spieler) continue;
      if (Math.hypot(z.x - von.x, z.z - von.z) < 1.2) continue;
      const dx = z.x - s.x, dz = z.z - s.z, u = dx * c - dz * si, v = dx * si + dz * c, r = z.radius || 0.4;
      const drunter = Math.abs(u) < hb + r && Math.abs(v) < hd + r;
      const daneben = !drunter && Math.abs(u) < hb + r + 0.5 && Math.abs(v) < hd + r + 2.2;
      if (!drunter && !daneben) continue;
      getroffen.add(z.id);
      const st = (def.stoss || 10) * (0.8 + 0.3 * kraft);
      let stoss;
      if (drunter) stoss = { x: (z.x - von.x) * 0.05 + si * 0.2 * st * 0.3, y: st * 1.3, z: (z.z - von.z) * 0.05 + c * 0.2 * st * 0.3 };
      else { const seite = v >= 0 ? 1 : -1; stoss = { x: si * seite * st * 0.8, y: st * 0.35, z: c * seite * st * 0.8 }; }
      liste.push({ id: z.id, ziel: z, schaden: (def.schaden || 25) * (drunter ? 1 : 0.4) * (0.8 + 0.2 * kraft), stoss, umwerfen: def.umwerfen !== false, verlangsamt: 0, zug: null });
    }
    if (liste.length) { melde({ typ: 'treffer', treffer: liste }); melde({ typ: 'stopp', dauer: 0.07 }); }
  }

  function bruch(s, melde, stark) {
    const h = s._y0 + s.hoeheZiel * 0.6;
    melde({ typ: 'funken', pos: { x: s.x, y: h, z: s.z }, opts: { farbe: 0xb89a70, anzahl: stark ? 10 : 6, tempo: 4, dauer: 0.9, groesse: 0.7, schwerkraft: 6, streuung: 0.8 } });
  }

  function update(dt, ziele = [], melde = () => {}) {
    daten.alter += dt;
    const t = daten.alter;
    if (!gestartet) {
      gestartet = true;
      melde({ typ: 'beben', pos: daten.pos, staerke: Math.min(2, 1.1 + 0.4 * kraft), dauer: 1.2 });
      melde({ typ: 'klang', name: 'grollen', staerke: 1, tonhoehe: 0.7 });
      if (ring) melde({ typ: 'meldung', text: 'Festung! Ein Ring aus Fels bricht auf.' });
    }
    if (daten.phase === 'steigt') {
      let fertig = true;
      for (const s of segmente) {
        const k = (t - s._verzug) / ANSTIEG;
        if (k > 0 && !s._aus) {
          s._aus = true; treffe(s, ziele, melde); bruch(s, melde, true);
          if (t - berstZeit > 0.12) { berstZeit = t; melde({ typ: 'klang', name: 'bersten', staerke: 0.9, tonhoehe: 0.8 + zufall() * 0.4 }); }
        }
        s.hoehe = s.hoeheZiel * ease(k);
        if (k < 1) fertig = false;
      }
      if (fertig && !schlag) { schlag = true; melde({ typ: 'klang', name: 'wumms', staerke: 1, tonhoehe: 0.6 }); melde({ typ: 'beben', pos: daten.pos, staerke: 0.8, dauer: 0.5 }); daten.phase = 'steht'; daten.stehAb = t; }
    } else if (daten.phase === 'steht') {
      if (t - daten.stehAb > stehzeit) { daten.phase = 'zerfaellt'; daten.zerfallAb = t; }
    } else {
      const k = t - daten.zerfallAb;
      if (!zerbebt) { zerbebt = true; melde({ typ: 'beben', pos: daten.pos, staerke: 1.2, dauer: 1.6 }); melde({ typ: 'klang', name: 'explosion', staerke: 0.8, tonhoehe: 0.6 }); }
      let alle = true;
      for (const s of segmente) {
        s.zerfall = Math.max(0, Math.min(1, (k - s._start) / ZERFALL_SINK));
        s.hoehe = s.hoeheZiel * (1 - s.zerfall * s.zerfall);
        if (s.zerfall > 0 && s.zerfall < 0.15 && !s._gebrochen) { s._gebrochen = true; bruch(s, melde, false); if (t - berstZeit > 0.3) { berstZeit = t; melde({ typ: 'klang', name: 'bersten', staerke: 0.6, tonhoehe: 0.7 }); } }
        if (s.zerfall < 1) alle = false;
      }
      if (alle) { melde({ typ: 'beben', pos: daten.pos, staerke: 0.4, dauer: 0.4 }); return false; }
    }
    return true;
  }

  /** Nächstes Rechteck-Segment: lokale Koordinaten u (Breite) / v (Normale); gibt {u,v,c,si,s} oder null. */
  function hindernis(x, z, radius = 0.4) {
    let best = null, bl = 0;
    for (const s of segmente) {
      if (s.hoehe < MIN_HOCH) continue;
      const sk = daten.phase === 'zerfaellt' ? Math.max(0.2, s.hoehe / s.hoeheZiel) : 1;
      const hb = (s.breite / 2) * sk, hd = (s.dicke / 2) * sk, c = Math.cos(s.yaw), si = Math.sin(s.yaw);
      const dx = x - s.x, dz = z - s.z;
      if (dx * dx + dz * dz > (hb + hd + radius) * (hb + hd + radius)) continue;
      const u = dx * c - dz * si, v = dx * si + dz * c;
      const cu = Math.max(-hb, Math.min(hb, u)), cv = Math.max(-hd, Math.min(hd, v));
      let pu = u - cu, pv = v - cv, d = Math.hypot(pu, pv), len;
      if (d < 1e-6) {   // mitten drin: kürzester Weg hinaus
        const ou = hb - Math.abs(u), ov = hd - Math.abs(v);
        if (ou < ov) { pu = Math.sign(u || 1); pv = 0; len = ou + radius; } else { pu = 0; pv = Math.sign(v || 1); len = ov + radius; }
      } else { if (d >= radius) continue; pu /= d; pv /= d; len = radius - d; }
      if (len > bl) { bl = len; best = { x: (pu * c + pv * si) * len, z: (-pu * si + pv * c) * len }; }
    }
    return best;
  }

  /** Höhe des höchsten Segments im Grundriss (relativ zum Gelände). */
  function boden(x, z) {
    let h = null;
    for (const s of segmente) {
      if (s.hoehe <= 0.05) continue;
      const dx = x - s.x, dz = z - s.z, c = Math.cos(s.yaw), si = Math.sin(s.yaw);
      if (Math.abs(dx * c - dz * si) <= s.breite / 2 && Math.abs(dx * si + dz * c) <= s.dicke / 2 && (h == null || s.hoehe > h)) h = s.hoehe;
    }
    return h;
  }

  return { daten, update, hindernis, boden, zustand: () => ({ phase: daten.phase, alter: daten.alter, ring }), dispose() { getroffen = null; } };
}
