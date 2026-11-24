// Eingriffe in die Welt (reine Logik, ohne THREE): Graben und Aufschütten als weiche Höhenänderung,
// dazu entfernte Natur (gefällte Bäume, abgebaute Felsen, ausgegrabene Pflanzen). Serialisierbar (Speichern, später Mehrspieler).
// Gelände bleibt ein Höhenfeld (keine Höhlen): ein Eingriff = Mitte (Richtung), Radius r (m), Höhe dh (m, < 0 = graben).
// Schnell: Eingriffe liegen in Eimern (grobe Richtungs-Zellen), probe() fragt nur den eigenen Eimer + Nachbarn.

const EIMER = 64; // Gitter je Würfelseite für die Eimer (bei R = 100 km ~ 2,5 km je Eimer)

function eimerVon(x, y, z) {
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  let f, u, v;
  if (ax >= ay && ax >= az) { f = x > 0 ? 0 : 1; u = z / ax; v = y / ax; }
  else if (ay >= az) { f = y > 0 ? 2 : 3; u = x / ay; v = z / ay; }
  else { f = z > 0 ? 4 : 5; u = x / az; v = y / az; }
  const i = Math.min(EIMER - 1, Math.floor((u + 1) / 2 * EIMER)), j = Math.min(EIMER - 1, Math.floor((v + 1) / 2 * EIMER));
  return f * EIMER * EIMER + j * EIMER + i;
}

export function createEingriffe({ radius = 100_000, zustand = null } = {}) {
  const R = radius;
  let liste = [];                 // { d:[x,y,z], r, dh }
  const eimer = new Map();        // eimer → [index…]
  const weg = new Map();          // entfernte Natur: kachelKey → Set(index)
  let version = 0;

  function einordnen(i) {
    const e = liste[i];
    // in alle Eimer, die der Eingriff berührt (Mitte ± Radius in Tangentialrichtung reicht über Eimer-Grenzen)
    const schon = new Set();
    for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = (e.r * 1.2) / R;
      const t1 = Math.abs(e.d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const ux = e.d[1] * t1[2] - e.d[2] * t1[1], uy = e.d[2] * t1[0] - e.d[0] * t1[2], uz = e.d[0] * t1[1] - e.d[1] * t1[0];
      const vx = e.d[1] * uz - e.d[2] * uy, vy = e.d[2] * ux - e.d[0] * uz, vz = e.d[0] * uy - e.d[1] * ux;
      const id = eimerVon(e.d[0] + k * (a * ux + b * vx), e.d[1] + k * (a * uy + b * vy), e.d[2] + k * (a * uz + b * vz));
      if (schon.has(id)) continue;
      schon.add(id);
      if (!eimer.has(id)) eimer.set(id, []);
      eimer.get(id).push(i);
    }
  }

  /** Höhenänderung (m) an Richtung (x,y,z) – Summe aller Eingriffe in der Nähe, weiche Glocke (cos²). */
  function delta(x, y, z) {
    if (!liste.length) return 0;
    const b = eimer.get(eimerVon(x, y, z));
    if (!b) return 0;
    let s = 0;
    for (const i of b) {
      const e = liste[i];
      const dx = x - e.d[0], dy = y - e.d[1], dz = z - e.d[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) * R;
      if (dist >= e.r) continue;
      const c = Math.cos((dist / e.r) * Math.PI / 2);
      s += e.dh * c * c;
    }
    return s;
  }

  /** Neuer Eingriff. d = Richtung (wird normiert), r Radius (m), dh Höhe (m). → Eingriff */
  function setze(d, r, dh) {
    const l = Math.hypot(d[0], d[1], d[2]);
    const e = { d: [d[0] / l, d[1] / l, d[2] / l], r, dh };
    liste.push(e);
    einordnen(liste.length - 1);
    version++;
    return e;
  }
  /** Eingriff übernehmen (z. B. vom Hauptthread in den Worker). */
  const uebernimm = (e) => { liste.push(e); einordnen(liste.length - 1); version++; };

  /** Natur-Stück entfernen: id = "kachelKey#index". */
  function entferne(id) {
    const i = id.lastIndexOf('#'), key = id.slice(0, i);
    if (!weg.has(key)) weg.set(key, new Set());
    weg.get(key).add(+id.slice(i + 1));
    version++;
  }
  /** Wurde Stück `index` der Streu-Kachel `key` entfernt? (schnell: erst die Kachel) */
  const istWeg = (key, index) => { const w = weg.get(key); return !!w && w.has(index); };

  const zustandAus = () => ({ e: liste.map((e) => [...e.d, e.r, e.dh]), weg: [...weg].flatMap(([k, s]) => [...s].map((i) => k + '#' + i)) });
  function lade(z) {
    liste = []; eimer.clear(); weg.clear();
    for (const a of z?.e || []) uebernimm({ d: [a[0], a[1], a[2]], r: a[3], dh: a[4] });
    version++;
    for (const id of z?.weg || []) entferne(id);
  }
  if (zustand) lade(zustand);

  return { delta, setze, uebernimm, entferne, istWeg, zustand: zustandAus, lade, get anzahl() { return liste.length; }, get version() { return version; }, get liste() { return liste; } };
}
