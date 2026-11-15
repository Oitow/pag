/**
 * @modul    grosszauber-sturm
 * @zweck    Großzauber 'sturm' (Zyklon): ein Wirbelsturm formt sich, zieht schlängelnd übers Feld, saugt Ziele an, hebt sie spiralförmig hoch, schleudert sie am Rand weg und schlägt Blitze ein
 * @api      createSturm(opts, umgebung) -> { daten, update(dt,ziele,melde)->bool, zustand(), dispose() }
 * @beispiel
 *   import { createSturm } from '../../engine/gameplay/grosszauber-sturm.js';
 *   const gross = createGrosszauber({ arten: { sturm: createSturm }, welt });
 *   gross.wirke('sturm', { von, punkt, yaw, kraft: 1.4, def: { schaden: 12, stoss: 8 } });
 * @tags     zauber, magie, großzauber, sturm, tornado, wind, blitz, wirbel, sog, episch, flächenschaden, kampf
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Phasen: 'formen' (~1 s, Wolken senken sich, Trichter wächst) → 'ziehen' (~10 s × kraft) → 'aufloesen' (~1.5 s, alles fällt).
 * daten: { phase, pos {x,y,z}, fuss, oben (Radien), hoehe, drehung (rad), alter, dauer, wachs (0…1 Größe), blitze [{ punkte, alter }] (letzte, ≤ 4) }
 * Ereignisse: 'treffer' (Sog: zug; Kern: stoss hoch + tangential, umwerfen; Rand: stoss nach außen), 'beben' (dauernd schwach),
 *   'klang' ('heulen' | 'blitz' | 'wumms'), 'funken' (Trümmer, Einschlag), 'ring' (Einschlag), 'meldung',
 *   'blitz'  punkte [{x,y,z}…] von der Wolke zum Ziel (dann Einschlag), treffer (Blitzschaden) – Ansichten zeichnen daraus eine Zickzack-Linie.
 *   Das Labor kennt 'blitz' noch nicht; deshalb kommen am Einschlag zusätzlich 'funken' + 'ring'.
 */
import { rng } from '../core/rng.js';
const FORMEN = 1, AUFLOESEN = 1.5, TAKT = 0.2, BLITZ = 0.7, SOG = 14, KERN = 5, RAND = 9;

export function createSturm(opts = {}, umgebung = {}) {
  const k = Math.max(0.5, +opts.kraft || 1), def = opts.def || {};
  const zufall = umgebung.zufall || rng(1), boden = umgebung.boden || (() => 0);
  const yaw = +opts.yaw || 0, richt = { x: Math.sin(yaw), z: Math.cos(yaw) };
  const dauer = 10 * k, hoehe = 28 * k, schaden = def.schaden ?? 12, stoss = def.stoss ?? 8;
  const p0 = opts.punkt || { x: 0, y: 0, z: 0 }, phase0 = zufall() * 6.28;
  const daten = {
    phase: 'formen', pos: { x: p0.x, y: boden(p0.x, p0.z), z: p0.z }, fuss: 4 * Math.sqrt(k), oben: 14 * Math.sqrt(k), hoehe: 0,
    drehung: 0, alter: 0, dauer, wachs: 0, blitze: [],
  };
  const tempo = 2.2, schlaengel = 3 * k;
  let takt = 0, blitzUhr = 0.4, heul = 0, nachbeben = 0;

  function ziehe(z) { return z && z.x != null && z.z != null; }

  function update(dt, ziele = [], melde = () => {}) {
    daten.alter += dt; daten.drehung += dt * 2.4;
    const a = daten.alter;
    if (a < FORMEN) daten.phase = 'formen';
    else if (a < FORMEN + dauer) daten.phase = 'ziehen';
    else daten.phase = 'aufloesen';
    const ende = FORMEN + dauer + AUFLOESEN;
    daten.wachs = a < FORMEN ? a / FORMEN : a > FORMEN + dauer ? Math.max(0, 1 - (a - FORMEN - dauer) / AUFLOESEN) : 1;
    daten.hoehe = hoehe * daten.wachs;
    if (a === dt) melde({ typ: 'meldung', text: 'Der Himmel verfinstert sich …' });
    if (daten.phase === 'ziehen') {
      // langsam in Blickrichtung, dazu eine Schlängelbewegung quer
      const quer = Math.cos(a * 0.9 + phase0) * schlaengel;
      const l = { x: richt.x * tempo * dt - richt.z * quer * dt * 0.5, z: richt.z * tempo * dt + richt.x * quer * dt * 0.5 };
      daten.pos.x += l.x; daten.pos.z += l.z;
    }
    daten.pos.y = boden(daten.pos.x, daten.pos.z);
    if (a >= ende) { melde({ typ: 'klang', name: 'wumms', staerke: 0.8 }); melde({ typ: 'ring', pos: { ...daten.pos }, opts: { radius: 10 * k, dauer: 0.9, farbe: 0xbfe0ff } }); return false; }

    const w = daten.wachs, px = daten.pos.x, pz = daten.pos.z;
    nachbeben -= dt; heul -= dt;
    if (nachbeben <= 0) { nachbeben = 0.35; melde({ typ: 'beben', pos: { ...daten.pos }, staerke: 0.35 * w + 0.05, dauer: 0.45 }); }
    if (heul <= 0 && daten.phase !== 'aufloesen') { heul = 2.4; melde({ typ: 'klang', name: 'heulen', staerke: 0.9, tonhoehe: 1 / Math.sqrt(k) }); }

    // Takt: Sog, Kern, Rand
    takt -= dt;
    if (takt <= 0 && w > 0.3 && daten.phase !== 'aufloesen') {
      takt = TAKT;
      const sog = SOG * Math.sqrt(k), kern = KERN * Math.sqrt(k), rand = RAND * Math.sqrt(k), t = [];
      for (const z of ziele) {
        if (!ziehe(z)) continue;
        const dx = z.x - px, dz = z.z - pz, d = Math.hypot(dx, dz);
        if (d > sog) continue;
        const nx = dx / (d || 1), nz = dz / (d || 1), tx = -nz, tz = nx;
        if (d < kern) {            // Kern: spiralförmig hoch
          t.push({ id: z.id, ziel: z, schaden: Math.round(schaden * 0.35 * k), stoss: { x: tx * 5 - nx * 2, y: stoss * 0.9 + 2, z: tz * 5 - nz * 2 }, umwerfen: true, verlangsamt: 0, zug: null });
        } else if (d < rand && d > rand - 2.5) {   // Rand: weggeschleudert
          t.push({ id: z.id, ziel: z, schaden: Math.round(schaden * 0.25), stoss: { x: nx * stoss * 0.9 + tx * 4, y: stoss * 0.4, z: nz * stoss * 0.9 + tz * 4 }, umwerfen: true, verlangsamt: 0, zug: null });
        } else {                   // Sog: schwach zur Mitte
          t.push({ id: z.id, ziel: z, schaden: 0, stoss: { x: 0, y: 0, z: 0 }, umwerfen: false, verlangsamt: 0.4, zug: { x: -nx * 3.5 + tx * 1.2, z: -nz * 3.5 + tz * 1.2 } });
        }
      }
      if (t.length) melde({ typ: 'treffer', treffer: t });
      if (zufall() < 0.6) {       // Trümmer
        const r = daten.fuss * (0.5 + zufall()), wi = zufall() * 6.28;
        melde({ typ: 'funken', pos: { x: px + Math.cos(wi) * r, y: daten.pos.y + 0.5, z: pz + Math.sin(wi) * r }, opts: { farbe: 0x8a7a66, anzahl: 6, tempo: 5 } });
      }
    }

    // Blitze aus der Wolke
    blitzUhr -= dt;
    for (const b of daten.blitze) b.alter += dt;
    daten.blitze = daten.blitze.filter(b => b.alter < 0.5);
    if (blitzUhr <= 0 && daten.phase === 'ziehen') {
      blitzUhr = BLITZ * (0.7 + zufall() * 0.6);
      const nah = ziele.filter(z => ziehe(z) && Math.hypot(z.x - px, z.z - pz) < SOG * Math.sqrt(k) * 1.3);
      const z = nah.length ? nah[Math.floor(zufall() * nah.length)] : null;
      const wi = zufall() * 6.28, r = zufall() * daten.oben * 1.2;
      const ex = z ? z.x : px + Math.cos(wi) * r * 1.6, ez = z ? z.z : pz + Math.sin(wi) * r * 1.6;
      const ey = z ? (z.y || 0) : boden(ex, ez), oy = daten.pos.y + hoehe * 0.95;
      const punkte = [{ x: px + (zufall() - 0.5) * daten.oben, y: oy, z: pz + (zufall() - 0.5) * daten.oben }];
      for (let i = 1; i < 6; i++) { const f = i / 6; punkte.push({ x: punkte[0].x + (ex - punkte[0].x) * f + (zufall() - 0.5) * 3, y: oy + (ey - oy) * f, z: punkte[0].z + (ez - punkte[0].z) * f + (zufall() - 0.5) * 3 }); }
      punkte.push({ x: ex, y: ey, z: ez });
      const treffer = z ? [{ id: z.id, ziel: z, schaden: Math.round(schaden * 1.5 * k), stoss: { x: 0, y: 3, z: 0 }, umwerfen: true, verlangsamt: 0, zug: null }] : [];
      daten.blitze.push({ punkte, alter: 0 });
      melde({ typ: 'blitz', punkte, treffer });
      melde({ typ: 'klang', name: 'blitz', staerke: 1 });
      melde({ typ: 'funken', pos: { x: ex, y: ey + 0.3, z: ez }, opts: { farbe: 0xdff0ff, anzahl: 14, tempo: 7 } });
      melde({ typ: 'ring', pos: { x: ex, y: ey, z: ez }, opts: { radius: 2.2, dauer: 0.35, farbe: 0xbfe0ff } });
      melde({ typ: 'stopp', dauer: 0.04 });
    }
    return true;
  }

  return { daten, update, zustand: () => ({ ...daten, pos: { ...daten.pos } }), dispose() { daten.blitze.length = 0; } };
}
