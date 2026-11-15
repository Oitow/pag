/**
 * @modul    grosszauber-welle
 * @zweck    Großzauber 'welle' (Flutwelle): eine haushohe Wasserfront baut sich hinter dem Zaubernden auf, rollt in Blickrichtung übers Gelände, reißt Ziele mit, bricht zusammen und läuft als flache Flut aus (Figuren schwimmen)
 * @api      createWelle(opts, umgebung) -> { daten, update(dt,ziele,melde), wasser(x,z), zustand(), dispose() }
 * @beispiel
 *   import { createWelle } from '../../engine/gameplay/grosszauber-welle.js';
 *   const gross = createGrosszauber({ arten: { welle: createWelle }, welt: adapter });
 *   gross.wirke('welle', { von: fuss, punkt, yaw, kraft: 1.4, def: ZAUBER.flutwelle.gross });
 * @tags     großzauber, welle, wasser, flut, episch, zauber, magie, kampf, flächenschaden, mitreißen, beben, mmo
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Phasen: 'aufbau' (Front wächst hinter dem Zaubernden) → 'rollen' → 'brechen' (Kamm stürzt, Ziele werden hochgeworfen) → 'flut' (flaches Wasser blendet aus).
 * def (alle optional): { breite 24, laenge 45, tempo 14, hoehe 4 … 7, aufbau 1, brechen 1.2, flut 4, tiefe 1.4, schaden, stoss, umwerfen }
 * daten (für render/grosszauber-welle): { phase, alter, mitte {x,y,z}, richtung {x,z}, yaw, breite, hoehe, fortschritt 0…1, kruemmung 0…1, start {x,z}, strecke (m Flutweg), flut 0…1 (Deckkraft Flutfläche), tiefe, mitgerissen }
 * Ziele in der Front: treffer mit zug (Laufrichtung) jedes Bild, Schaden einmal + kleiner Folgeschaden; am Ende hochgeworfen (stoss, umwerfen).
 */
const kl = (v, a, b) => Math.max(a, Math.min(b, v));
const glatt = (t) => { t = kl(t, 0, 1); return t * t * (3 - 2 * t); };

export function createWelle(opts = {}, umgebung = {}) {
  const def = opts.def || {}, kraft = kl(+opts.kraft || 1, 0.5, 2), von = opts.von || { x: 0, y: 0, z: 0 };
  const boden = umgebung.boden || (() => 0), zufall = umgebung.zufall || Math.random;
  const yaw = +opts.yaw || 0, dx = Math.sin(yaw), dz = Math.cos(yaw);   // Blick
  const breite = Math.min(40, (def.breite || 24) * kraft), laenge = (def.laenge || 45) * kraft;
  const hoehe = kl(def.hoehe ?? 4 + (kraft - 1) * 5, 4, 7), tempo = (def.tempo || 14) * Math.sqrt(kraft);
  const tAuf = def.aufbau ?? 1, tBrech = def.brechen ?? 1.2, tFlut = def.flut ?? 4, tiefe0 = def.tiefe ?? 1.4;
  const dicke = Math.max(3, hoehe * 0.8), s0 = -7, schaden = (def.schaden ?? opts.def?.schaden ?? 30) * kraft;
  const stoss = def.stoss ?? 12, umwerfen = def.umwerfen !== false;
  const tRoll = laenge / tempo;
  const gefangen = new Map();   // ziel.id -> { z, folge }
  let alter = 0, phase = 'aufbau', s = s0, mitgerissen = 0, tPhase = 0, angekuendigt = false, gischt = 0, stoppGemeldet = false, aus = false;

  const daten = { phase, alter: 0, mitte: { x: von.x + dx * s0, y: 0, z: von.z + dz * s0 }, richtung: { x: dx, z: dz }, yaw, breite, hoehe: 0,
    fortschritt: 0, kruemmung: 0, start: { x: von.x + dx * s0, z: von.z + dz * s0 }, strecke: 0, flut: 0, tiefe: tiefe0, mitgerissen: 0 };
  const lokal = (x, z) => { const rx = x - von.x, rz = z - von.z; return { l: rx * dx + rz * dz, q: rx * dz - rz * dx }; };   // l: entlang Blick, q: seitlich
  const punkt = (l, q) => ({ x: von.x + dx * l + dz * q, z: von.z + dz * l - dx * q });

  function setzeDaten() {
    const m = punkt(s, 0);
    daten.phase = phase; daten.alter = alter; daten.mitte.x = m.x; daten.mitte.z = m.z; daten.mitte.y = boden(m.x, m.z);
    daten.hoehe = phase === 'aufbau' ? hoehe * glatt(tPhase / tAuf) * 0.9 : phase === 'rollen' ? hoehe : phase === 'brechen' ? hoehe * (1 - 0.75 * glatt(tPhase / tBrech)) : 0;
    daten.fortschritt = kl((s - s0) / laenge, 0, 1);
    daten.kruemmung = phase === 'aufbau' ? 0.15 : phase === 'rollen' ? 0.25 + 0.25 * daten.fortschritt : phase === 'brechen' ? 0.5 + 0.5 * glatt(tPhase / (tBrech * 0.7)) : 1;
    daten.strecke = s - s0; daten.mitgerissen = mitgerissen;
    daten.flut = phase === 'flut' ? 1 - glatt(tPhase / tFlut) : phase === 'brechen' ? 1 : phase === 'rollen' ? 0.85 : glatt(tPhase / tAuf) * 0.3;
    daten.tiefe = tiefe0 * (phase === 'flut' ? 1 - glatt(tPhase / tFlut) * 0.9 : 1);
  }

  function gischtAn(melde, n, staerke) {
    for (let i = 0; i < n; i++) {
      const p = punkt(s - zufall() * dicke * 0.5, (zufall() - 0.5) * breite);
      melde({ typ: 'funken', pos: { x: p.x, y: boden(p.x, p.z) + daten.hoehe * (0.55 + zufall() * 0.5), z: p.z },
        opts: { farbe: zufall() < 0.5 ? 0xffffff : 0xbfe8ff, anzahl: 6, tempo: 3 * staerke, dauer: 0.7, groesse: 0.6, schwerkraft: 6, hoch: 2, richtung: { x: dx, y: 0.3, z: dz } } });
    }
  }

  function fangen(ziele, melde, treffer) {
    const halb = breite / 2;
    for (const z of ziele) {
      if (!z || gefangen.has(z.id) || z.id == null) continue;
      const { l, q } = lokal(z.x, z.z), r = z.radius || 0.5;
      if (l > s + 1 + r || l < s - dicke - r || Math.abs(q) > halb + r) continue;
      if (z.y != null && z.y > boden(z.x, z.z) + hoehe + 3) continue;   // weit über der Front (fliegend)
      gefangen.set(z.id, { z, folge: 0.5 }); mitgerissen++;
      treffer.push({ id: z.id, ziel: z, schaden: Math.round(schaden), stoss: { x: 0, y: 0, z: 0 }, umwerfen: false, verlangsamt: 0, zug: { x: dx * tempo, z: dz * tempo } });
    }
    if (!stoppGemeldet && gefangen.size >= 3) { stoppGemeldet = true; melde({ typ: 'stopp', dauer: 0.12 }); melde({ typ: 'klang', name: 'wumms', staerke: 1, tonhoehe: 0.7 }); }
  }

  function update(dt, ziele = [], melde = () => {}) {
    alter += dt; tPhase += dt;
    const treffer = [];
    if (phase === 'aufbau') {
      if (!angekuendigt) { angekuendigt = true; melde({ typ: 'beben', pos: { ...von }, staerke: 0.9, dauer: tAuf + 0.5 }); melde({ typ: 'klang', name: 'grollen', staerke: 1, tonhoehe: 0.6 }); }
      if (tPhase >= tAuf) { phase = 'rollen'; tPhase = 0; melde({ typ: 'klang', name: 'rauschen', staerke: 1.2, tonhoehe: 0.8 }); }
    } else if (phase === 'rollen') {
      s += tempo * dt;
      gischt += dt; if (gischt > 0.12) { gischt = 0; gischtAn(melde, 3, 1); }
      melde({ typ: 'beben', pos: { ...daten.mitte }, staerke: 0.35, dauer: 0.2 });
      fangen(ziele, melde, treffer);
      if (s >= s0 + laenge) {
        s = s0 + laenge; phase = 'brechen'; tPhase = 0;
        melde({ typ: 'beben', pos: { ...daten.mitte }, staerke: 1.8, dauer: 1.2 });
        melde({ typ: 'klang', name: 'explosion', staerke: 1.3, tonhoehe: 0.5 }); melde({ typ: 'klang', name: 'grollen', staerke: 1.2, tonhoehe: 0.5 });
        gischtAn(melde, 14, 2);
        for (const [id, g] of gefangen) {   // absetzen: hochwerfen
          treffer.push({ id, ziel: g.z, schaden: 0, stoss: { x: dx * stoss * 0.6, y: stoss * 0.9, z: dz * stoss * 0.6 }, umwerfen, verlangsamt: 0, zug: null });
        }
        gefangen.clear();
        melde({ typ: 'ring', pos: { ...daten.mitte }, opts: { radius: breite * 0.4, farbe: 0xbfe8ff } });
        if (mitgerissen) melde({ typ: 'meldung', text: `🌊 ×${mitgerissen} mitgerissen` });
      }
    } else if (phase === 'brechen') {
      gischt += dt; if (gischt > 0.1) { gischt = 0; gischtAn(melde, 2, 1.5); }
      if (tPhase >= tBrech) { phase = 'flut'; tPhase = 0; }
    } else if (phase === 'flut' && tPhase >= tFlut) aus = true;

    for (const [id, g] of gefangen) {   // mitgerissen: Zug jedes Bild, kleiner Folgeschaden
      g.folge -= dt;
      const folge = g.folge <= 0; if (folge) g.folge += 0.5;
      treffer.push({ id, ziel: g.z, schaden: folge ? Math.max(1, Math.round(schaden * 0.08)) : 0, stoss: { x: 0, y: 0, z: 0 }, umwerfen: false, verlangsamt: 0, zug: { x: dx * tempo, z: dz * tempo } });
    }
    if (treffer.length) melde({ typ: 'treffer', treffer });
    setzeDaten();
    return !aus;
  }

  /** Flut hinter der Front (absolute Höhe); in der Front selbst tiefer. */
  function wasser(x, z) {
    if (phase === 'aufbau' || aus) return null;
    const { l, q } = lokal(x, z);
    if (Math.abs(q) > breite / 2 * 1.05 || l < s0 || l > s + 1) return null;
    const hinten = s - l, f = glatt(hinten / 2.5 + 0.2);
    const nah = hinten < dicke ? 1 + 0.8 * (1 - hinten / dicke) * (phase === 'rollen' ? 1 : daten.flut) : 1;
    return boden(x, z) + daten.tiefe * f * nah * (phase === 'flut' ? daten.flut : 1) + 0.01;
  }

  return { daten, update, wasser, zustand: () => ({ phase, s, mitgerissen, gefangen: gefangen.size }), dispose() { gefangen.clear(); } };
}
