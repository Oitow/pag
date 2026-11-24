// Ernte-Regeln (reine Logik, ohne THREE): was gibt ein Natur-Stück, welches Werkzeug braucht man?
// werkzeug: 0 = Hände, 'axt' = Axt, Zahl = Härte der Spitzhacke (wie boden.js STOFFE.haerte).
// Menge skaliert mit der Größe (skala) des Stücks.

const holz = (basis) => ({ werkzeug: 'axt', gibt: [['holz', basis]], baum: true });
export const ERNTE = {
  fichte: holz(8), tanne: holz(9), kiefer: holz(7), birke: { ...holz(5), gibt: [['holz', 5], ['rinde', 2]] }, buche: holz(8), eiche: holz(9),
  ahorn: holz(7), weide: { ...holz(4), gibt: [['holz', 4], ['ruten', 3]] }, olive: { ...holz(3), gibt: [['holz', 3], ['oliven', 4]] },
  pinie: { ...holz(5), gibt: [['holz', 5], ['zapfen', 2]] }, akazie: holz(5), palme: { ...holz(4), gibt: [['holz', 4], ['kokosnuss', 2]] },
  tropenbaum: holz(10), toterBaum: { ...holz(3), gibt: [['holz', 3]] },
  baumstumpf: { werkzeug: 'axt', gibt: [['holz', 2]] }, liegenderStamm: { werkzeug: 'axt', gibt: [['holz', 4]] },
  busch: { werkzeug: 0, gibt: [['stoecke', 2]] }, ginster: { werkzeug: 0, gibt: [['stoecke', 2]] }, busch_unterholz: { werkzeug: 0, gibt: [['stoecke', 2]] },
  beerenbusch: { werkzeug: 0, gibt: [['beeren', 3], ['stoecke', 1]] }, zwergstrauch: { werkzeug: 0, gibt: [['beeren', 1], ['stoecke', 1]] },
  grasbueschel: { werkzeug: 0, gibt: [['fasern', 1]] }, rohrkolben: { werkzeug: 0, gibt: [['fasern', 2], ['schilf', 1]] },
  farn: { werkzeug: 0, gibt: [['fasern', 1]] }, wedelfarn: { werkzeug: 0, gibt: [['fasern', 2]] }, agave: { werkzeug: 0, gibt: [['fasern', 3]] },
  moospolster: { werkzeug: 0, gibt: [['moos', 1]] }, laubstreu: { werkzeug: 0, gibt: [['laub', 2]] }, blume: { werkzeug: 0, gibt: [['blume', 1]] },
  pilz: { werkzeug: 0, gibt: [['pilz', 1]] }, steinpilz: { werkzeug: 0, gibt: [['steinpilz', 1]] }, seerose: { werkzeug: 0, gibt: [['seerose', 1]] },
  kaktus: { werkzeug: 'axt', gibt: [['kaktusfleisch', 2]] }, saeulenkaktus: { werkzeug: 'axt', gibt: [['kaktusfleisch', 2]] },
  forelle: { werkzeug: 0, gibt: [['fisch', 1]] }, barsch: { werkzeug: 0, gibt: [['fisch', 1]] },
  geroell: { werkzeug: 0, gibt: [['steine', 2]] },
  wollgras: { werkzeug: 0, gibt: [['fasern', 2], ['wolle', 1]] }, pilzholz: { werkzeug: 0, gibt: [['pilz', 3], ['holz', 1]] },
  flechtenbank: { werkzeug: 2, gibt: [['steine', 3], ['flechten', 2]] },
  granitblock: { werkzeug: 2, gibt: [['steine', 4]] }, schiefer: { werkzeug: 2, gibt: [['schieferplatten', 3]] }, felsnadel: { werkzeug: 2, gibt: [['steine', 6]] },
};

/** Ernte versuchen. hat = { axt: bool, hacke: Härte 0…3 }. → { ok, grund?, gibt: [[id, menge]…], baum? } */
export function ernte(art, skala, hat) {
  const e = ERNTE[art];
  if (!e) return { ok: false, grund: 'nichts zu holen', gibt: [] };
  if (e.werkzeug === 'axt' && !hat.axt) return { ok: false, grund: 'Axt nötig', gibt: [] };
  if (typeof e.werkzeug === 'number' && e.werkzeug > (hat.hacke || 0)) return { ok: false, grund: 'Spitzhacke nötig', gibt: [] };
  const f = Math.max(0.5, Math.min(2, skala));
  return { ok: true, baum: !!e.baum, gibt: e.gibt.map(([id, n]) => [id, Math.max(1, Math.round(n * f))]) };
}
