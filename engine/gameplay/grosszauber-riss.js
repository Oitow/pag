/**
 * @modul    grosszauber-riss
 * @zweck    Großzauber Erdriss: ein gezackter Riss rast in Blickrichtung über den Boden, wirft Ziele hoch, speit Lava-Säulen, steht ~8 s als Graben und schließt sich abgekühlt wieder
 * @api      createRiss({von,punkt,yaw,kraft,def}, {boden,wasser,zufall}) -> { daten, update(dt,ziele,melde)->bool, boden(x,z)->delta|null, zustand(), dispose() }
 * @beispiel
 *   import { createRiss } from '../../engine/gameplay/grosszauber-riss.js';
 *   const gross = createGrosszauber({ arten: { riss: createRiss }, welt: adapter, seed: 3 });
 *   gross.wirke('riss', { von: fuss, punkt, yaw, kraft: 1.4, def: ZAUBER.erdriss });
 * @tags     zauber, magie, großzauber, riss, lava, beben, episch, erdbeben, graben, feuer, flächenschaden, kampf
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * daten (für render/grosszauber-riss):
 *   phase 'aufreissen' | 'lava' | 'abkuehlen' | 'ende', alter (s), glut (0 … 1), zu (0 offen … 1 geschlossen), tempo, kraft
 *   risse     [{ pkt: [{x,z,t}] (t = Sekunde, in der die Spitze den Punkt erreicht), breite (halbe Breite, m), ast (bool) }]
 *   ausbrueche [{x,z,t,dauer,hoehe,radius}] nur aktive; t = Alter des Ausbruchs in s
 * Boden-Delta: Graben −1 … −2.5 m, Ränder +0.4 m (öffnet sich hinter der Spitze, schließt sich beim Abkühlen).
 */
import { rng } from '../core/rng.js';
const TEMPO = 25, SCHRITT = 1.6, STEHT = 8, KUEHLT = 4, ABSTAND_HOCH = 2.5, ERUPT_DAUER = 1.5;
const klemme = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

export function createRiss(opts = {}, umgebung = {}) {
  const zufall = umgebung.zufall || rng(1);
  const def = opts.def || {}, kraft = klemme(+opts.kraft || 1, 0.5, 1.6);
  const von = opts.von || { x: 0, z: 0 }, ziel = opts.punkt || von;
  let dx = ziel.x - von.x, dz = ziel.z - von.z;
  if (Math.hypot(dx, dz) < 1) { dx = Math.sin(+opts.yaw || 0); dz = Math.cos(+opts.yaw || 0); }
  const l0 = Math.hypot(dx, dz) || 1; dx /= l0; dz /= l0;
  const laenge = Math.min(48, (def.reichweite || 30) * kraft);
  const schaden = def.schaden ?? 40, stossK = def.stoss ?? 14;

  /** Gezackte Linie: Richtung pendelt um die Grundrichtung. */
  function linie(x, z, wx, wz, len, t0, breite, ast) {
    const pkt = [{ x, z, t: t0 }], basis = Math.atan2(wx, wz);
    let w = basis;
    for (let s = SCHRITT; s <= len + 1e-6; s += SCHRITT) {
      w += (zufall() - 0.5) * 1.1 - (w - basis) * 0.55;
      x += Math.sin(w) * SCHRITT; z += Math.cos(w) * SCHRITT;
      pkt.push({ x, z, t: t0 + s / TEMPO });
    }
    return { pkt, breite, ast };
  }
  const haupt = linie(von.x + dx * 1.2, von.z + dz * 1.2, dx, dz, laenge, 0.05, 1.5, false);
  const risse = [haupt];
  const nAeste = 1 + Math.min(2, Math.floor(zufall() * 3));
  for (let i = 0; i < nAeste; i++) {
    const k = Math.floor(haupt.pkt.length * (0.3 + 0.5 * zufall())), p = haupt.pkt[k];
    const a = (zufall() < 0.5 ? -1 : 1) * (0.5 + zufall() * 0.4), b = Math.atan2(dx, dz) + a;
    risse.push(linie(p.x, p.z, Math.sin(b), Math.cos(b), (8 + zufall() * 7) * Math.min(kraft, 1.3), p.t, 0.85, true));
  }
  const tAuf = Math.max(...risse.map(r => r.pkt[r.pkt.length - 1].t));
  const tStehtBis = tAuf + STEHT, tEnde = tStehtBis + KUEHLT;

  const ausbrueche = [], aktiv = [];
  const neuerAusbruch = (x, z, t, gross) => ausbrueche.push({ x, z, t0: t, dauer: ERUPT_DAUER * (0.8 + zufall() * 0.5), hoehe: (gross ? 9 : 5.5) * (0.8 + zufall() * 0.5) * (0.8 + kraft * 0.25), radius: gross ? 1.6 : 1.1, tick: 0, gemeldet: false });
  for (const r of risse) for (let i = 2; i < r.pkt.length; i += 2 + Math.floor(zufall() * 2)) {
    const p = r.pkt[i]; neuerAusbruch(p.x, p.z, p.t + 0.3 + zufall() * 0.6, !r.ast && zufall() < 0.4);
  }
  ausbrueche.sort((a, b) => a.t0 - b.t0);

  const daten = { phase: 'aufreissen', alter: 0, glut: 1, zu: 0, tempo: TEMPO, kraft, risse, ausbrueche: aktiv };
  let alter = 0, gestartet = false, naechsterSpritzer = 0.7, nachbeben = 1.4, abgekuehlt = false;
  const getroffen = new Set(), schon = risse.map(() => 1);   // schon[i]: nächster Punkt für Schollen-Effekte
  const zu = () => klemme((alter - tStehtBis) / KUEHLT);

  /** Nächster Punkt auf der sichtbaren Linie: { d, br, tp, px, pz, ast } oder null. */
  function naechster(x, z, grenze) {
    let best = null;
    for (const r of risse) {
      const P = r.pkt;
      for (let i = 0; i < P.length - 1; i++) {
        const a = P[i], b = P[i + 1];
        if (a.t > alter) break;
        const ex = b.x - a.x, ez = b.z - a.z, q = ex * ex + ez * ez;
        const u = klemme(((x - a.x) * ex + (z - a.z) * ez) / q);
        const px = a.x + ex * u, pz = a.z + ez * u, d = Math.hypot(x - px, z - pz);
        if (d > grenze + r.breite || (best && d >= best.d)) continue;
        best = { d, br: r.breite, tp: a.t + u * (b.t - a.t), px, pz, ast: r.ast };
      }
    }
    return best;
  }

  function boden(x, z) {
    const n = naechster(x, z, 1.2);
    if (!n) return null;
    const auf = klemme((alter - n.tp) / 0.45) * (1 - zu() * zu()), rand = n.br + 1.0;
    if (n.d >= rand || auf <= 0) return null;
    if (n.d < n.br) return -(1 + (n.ast ? 0.7 : 1.5) * Math.pow(1 - n.d / n.br, 0.6)) * auf;
    return 0.4 * Math.sin(Math.PI * (n.d - n.br)) * auf;
  }

  function treffer(z, n, stossHoch, faktor, brennen) {
    let ox = z.x - n.px, oz = z.z - n.pz; const l = Math.hypot(ox, oz) || 1; ox /= l; oz /= l;
    const t = { id: z.id, ziel: z, schaden: Math.round(schaden * faktor), stoss: { x: ox * stossK * 0.25, y: stossHoch, z: oz * stossK * 0.25 }, umwerfen: true, verlangsamt: 0, zug: null };
    if (brennen) t.zustand = 'brennen';
    return t;
  }

  return {
    daten,
    boden,
    zustand: () => ({ phase: daten.phase, alter }),
    update(dt, ziele = [], melde = () => {}) {
      alter += dt; daten.alter = alter;
      const z0 = zu(); daten.zu = z0;
      if (!gestartet) {
        gestartet = true;
        melde({ typ: 'beben', pos: { x: von.x, y: 0, z: von.z }, staerke: 2, dauer: 1.6 });
        melde({ typ: 'klang', name: 'bersten', staerke: 1, tonhoehe: 0.7 });
        melde({ typ: 'klang', name: 'grollen', staerke: 1, tonhoehe: 0.6 });
        melde({ typ: 'stopp', dauer: 0.08 });
        melde({ typ: 'meldung', text: 'Die Erde reißt auf!' });
      }
      daten.phase = alter < tAuf ? 'aufreissen' : alter < tStehtBis ? 'lava' : 'abkuehlen';
      daten.glut = daten.phase === 'abkuehlen' ? 1 - z0 : 1;
      if (daten.phase === 'abkuehlen' && !abgekuehlt) {
        abgekuehlt = true;
        melde({ typ: 'klang', name: 'zisch', staerke: 0.8, tonhoehe: 1 });
        melde({ typ: 'beben', pos: { x: ziel.x, y: 0, z: ziel.z }, staerke: 0.5, dauer: 0.8 });
      }
      // Spitze: Schollen kippen, Steine fliegen
      risse.forEach((r, i) => {
        while (schon[i] < r.pkt.length && r.pkt[schon[i]].t <= alter) {
          const p = r.pkt[schon[i]++];
          melde({ typ: 'funken', pos: { x: p.x, y: 0.3, z: p.z }, opts: { farbe: 0x4a3a2c, anzahl: 6, tempo: 6, dauer: 1, groesse: 0.6, schwerkraft: 12, hoch: 5, streuung: 0.8 } });
          melde({ typ: 'funken', pos: { x: p.x, y: 0.3, z: p.z }, opts: { farbe: 0xff6a1a, anzahl: 8, tempo: 5, dauer: 0.9, groesse: 0.45, schwerkraft: 9, hoch: 6, streuung: 0.5 } });
        }
      });
      // Ziele an der Spitze hochwerfen
      const th = [];
      for (const z of ziele) {
        if (getroffen.has(z.id) || alter > tAuf + 0.8) continue;
        const n = naechster(z.x, z.z, ABSTAND_HOCH);
        if (n && n.d <= ABSTAND_HOCH + (z.radius || 0) * 0.5) { getroffen.add(z.id); th.push(treffer(z, n, stossK * 1.1, 0.6, false)); }
      }
      // Lava-Ausbrüche
      if (alter < tStehtBis - 1.5 && alter >= naechsterSpritzer) {
        naechsterSpritzer = alter + 0.45 + zufall() * 0.5;
        const r = risse[Math.floor(zufall() * risse.length)], p = r.pkt[Math.floor(zufall() * r.pkt.length)];
        if (p.t < alter) neuerAusbruch(p.x + (zufall() - 0.5), p.z + (zufall() - 0.5), alter, zufall() < 0.3);
      }
      while (ausbrueche.length && ausbrueche[0].t0 <= alter) { ausbrueche.sort((a, b) => a.t0 - b.t0); aktiv.push(ausbrueche.shift()); }
      for (let i = aktiv.length - 1; i >= 0; i--) {
        const e = aktiv[i]; e.t = alter - e.t0;
        if (e.t >= e.dauer) { aktiv.splice(i, 1); continue; }
        if (!e.gemeldet) {
          e.gemeldet = true;
          const pos = { x: e.x, y: 0.2, z: e.z };
          melde({ typ: 'ring', pos, opts: { radius: e.radius * 2.2, farbe: 0xff7a2a } });
          melde({ typ: 'funken', pos, opts: { farbe: 0xff8a2a, anzahl: 22, tempo: 7, dauer: 1.3, groesse: 0.55, schwerkraft: 14, hoch: 9, streuung: 0.4 } });
          melde({ typ: 'klang', name: 'explosion', staerke: 0.5, tonhoehe: 0.8 + zufall() * 0.4 });
        }
        e.tick -= dt;
        if (e.tick <= 0) {
          e.tick = 0.4;
          for (const z of ziele) {
            if (Math.hypot(z.x - e.x, z.z - e.z) > e.radius + (z.radius || 0.4)) continue;
            th.push(treffer(z, { px: e.x, pz: e.z }, stossK * 0.45, 0.15, true));
          }
        }
      }
      if (th.length) melde({ typ: 'treffer', treffer: th });
      // Nachbeben
      if (alter > tAuf && alter < tStehtBis && (nachbeben -= dt) <= 0) {
        nachbeben = 1.2 + zufall() * 1.2;
        melde({ typ: 'beben', pos: { x: ziel.x, y: 0, z: ziel.z }, staerke: 0.6, dauer: 0.5 });
        melde({ typ: 'klang', name: 'grollen', staerke: 0.5, tonhoehe: 0.7 });
      }
      if (alter >= tEnde) { daten.phase = 'ende'; return false; }
      return true;
    },
    dispose() { aktiv.length = 0; ausbrueche.length = 0; },
  };
}
