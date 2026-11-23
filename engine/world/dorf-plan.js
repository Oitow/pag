/**
 * @modul    dorf-plan
 * @zweck    Plan des Startdorfes Erlenwacht (reine Logik, ohne THREE): Platz-Kern, Häuser an Wegen, Gärten, Kleinkram, Gassen, Laternen, Brücke, Felder, Palisade
 * @api      createDorfPlan({seed, mitte, radius=115, hoehe, wasser, wege, masse}) -> {teile:[{id,typ,variante,x,z,winkel,y,kern}], punkte, gassen, felder, sperren, lichter, platzRadius, pruefe()} ; STANDARD_MASSE
 * @beispiel
 *   import { createDorfPlan } from '../../engine/world/dorf-plan.js';
 *   const plan = createDorfPlan({ seed: 1207, mitte: { x: 0, z: 600 }, hoehe: karte.hoehe, wasser: (x, z) => karte.wasserHoehe(x, z) !== null, wege: karte.wege });
 *   plan.pruefe(); // -> [] wenn alles stimmt
 * @tags     dorf, plan, erlenwacht, siedlung, welt
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { rng, hashSeed, range, int, chance, pick, shuffle } from '../core/rng.js';
import { lokalZuWeltRoh, abstandStrecke, boxenSchneiden } from './welt-plan-formen.js';
import { STANDARD_MASSE, PLATZ_RADIUS, BRUECKE_DX, kernSpezifikation, ostGasse, westGasse } from './dorf-plan-kern.js';

export { STANDARD_MASSE };
const OHNE = new Set(['zaun-zaun', 'palisade-palisade']);
const KLEIN = ['fass', 'kiste', 'holzstapel'];
const blick = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
const norm = (w) => Math.atan2(Math.sin(w), Math.cos(w));

export function createDorfPlan(opt = {}) {
  const seed = opt.seed ?? 1, mitte = opt.mitte || { x: 0, z: 0 }, radius = opt.radius ?? 115;
  const hoehe = opt.hoehe || (() => 0), wasser = opt.wasser || (() => false), eingabe = opt.masse || {};
  const r = rng(hashSeed('dorf-plan', seed));
  const M = (typ, v = 0) => {
    const m = eingabe[typ + '#' + v] || (Array.isArray(eingabe[typ]) ? eingabe[typ][v % eingabe[typ].length] : eingabe[typ]);
    const s = STANDARD_MASSE[typ]; return m || (Array.isArray(s) ? s[v % s.length] : s) || { breite: 1, tiefe: 1 };
  };
  const rel = (dx, dz) => ({ x: mitte.x + dx, z: mitte.z + dz });
  const teile = [], felder = [], blocker = [], punkte = {}, lichter = [], sperren = [], gassen = [];

  // ---- Wege (Hauptweg, Moorweg … + Gassen) als Segmente
  const bahnen = [];   // {id, breite, pts:[{x,z}]}
  for (const w of opt.wege || []) bahnen.push({ id: w.id, breite: w.breite || 2, pts: [...w].map((p) => ({ x: p.x, z: p.z })) });
  const gasse = (id, roh, breite) => {
    const pts = roh.map(([dx, dz], i) => rel(dx + (i > 0 && i < roh.length - 1 ? range(r, -1.5, 1.5) : 0), dz + (i > 0 && i < roh.length - 1 ? range(r, -1.5, 1.5) : 0)));
    pts.breite = breite; pts.id = id; gassen.push(pts); bahnen.push({ id, breite, pts }); return pts;
  };
  gasse('ost-gasse', ostGasse(), 2.5); gasse('west-gasse', westGasse(), 2.5);
  const segmente = [];
  for (const b of bahnen) for (let i = 0; i + 1 < b.pts.length; i++) {
    const a = b.pts[i], c = b.pts[i + 1];
    if (abstandStrecke(mitte.x, mitte.z, a.x, a.z, c.x, c.z).d <= radius + 60) segmente.push({ a, c, breite: b.breite });
  }
  const wegAbstand = (x, z) => { let d = Infinity; for (const s of segmente) d = Math.min(d, abstandStrecke(x, z, s.a.x, s.a.z, s.c.x, s.c.z).d - s.breite / 2); return d; };
  const dichte = (pts, schritt = 1) => {
    const o = []; let s = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], c = pts[i + 1], L = Math.hypot(c.x - a.x, c.z - a.z), tx = (c.x - a.x) / (L || 1), tz = (c.z - a.z) / (L || 1);
      for (let d = 0; d < L; d += schritt) o.push({ x: a.x + tx * d, z: a.z + tz * d, tx, tz, s: s + d });
      s += L;
    }
    return o;
  };

  // ---- Prüfungen
  const fuss = (t) => { const m = M(t.typ, t.variante); return { x: t.x, z: t.z, winkel: t.winkel, bx: m.breite / 2, bz: m.tiefe / 2 }; };
  const ecken = (f) => [[1, 1], [1, -1], [-1, 1], [-1, -1], [0, 0]].map(([a, b]) => lokalZuWeltRoh(f.x, f.z, f.winkel, a * f.bx, b * f.bz));
  const proben = (f) => {
    const nx = Math.ceil(f.bx / 0.8), nz = Math.ceil(f.bz / 0.8), o = [];
    for (let i = -nx; i <= nx; i++) for (let j = -nz; j <= nz; j++) o.push(lokalZuWeltRoh(f.x, f.z, f.winkel, (i / nx) * f.bx, (j / nz) * f.bz));
    return o;
  };
  /** Fehlertext oder null. o: {kern, wasserOk, wegOk, luft, ausser(Liste), radius} */
  const fehler = (f, typ, o = {}) => {
    const luft = o.luft ?? 0.2;
    if (Math.hypot(f.x - mitte.x, f.z - mitte.z) > (o.radius ?? radius)) return 'ausserhalb Radius';
    if (!o.wasserOk && ecken(f).some((p) => wasser(p.x, p.z))) return 'im Wasser';
    if (!o.kern && !o.wegOk) {
      for (const p of proben(f)) {
        if (Math.hypot(p.x - mitte.x, p.z - mitte.z) < PLATZ_RADIUS + 1) return 'auf dem Platz';
        if (wegAbstand(p.x, p.z) < 0.3) return 'auf einem Weg';
      }
    }
    const a = { ...f, bx: f.bx + luft / 2, bz: f.bz + luft / 2 }, ra = Math.hypot(a.bx, a.bz);
    for (const b of o.liste || blocker) {
      if (b === o.selbst || OHNE.has(typ + '-' + b.typ) || (o.ausser && o.ausser.includes(b))) continue;
      if (Math.hypot(b.x - f.x, b.z - f.z) > ra + Math.hypot(b.bx, b.bz) + luft) continue;
      if (boxenSchneiden(a, { ...b, bx: b.bx + luft / 2, bz: b.bz + luft / 2 })) return 'Überlappung mit ' + b.id;
    }
    return null;
  };
  const setze = (typ, x, z, winkel, o = {}) => {
    const variante = o.variante ?? 0, t = { id: `${typ}-${teile.length}`, typ, variante, x, z, winkel: norm(winkel), y: 0, kern: !!o.kern };
    const f = fuss(t); if (!o.erzwinge && fehler(f, typ, o)) return null;
    t.y = Math.min(...ecken(f).map((p) => hoehe(p.x, p.z)));
    teile.push(t); blocker.push({ ...f, typ, id: t.id }); return t;
  };
  const punkt = (id, x, z, winkel) => { punkte[id] = { x, z, y: hoehe(x, z), winkel: norm(winkel) }; };
  const vorTuer = (t, abstand) => { const m = M(t.typ, t.variante); return lokalZuWeltRoh(t.x, t.z, t.winkel, 0, m.tiefe / 2 + abstand); };

  // ---- Kern
  for (const k of kernSpezifikation()) {
    const p = rel(k.dx, k.dz);
    setze(k.typ, p.x, p.z, k.blick ? blick(p.x, p.z, mitte.x + k.blick[0], mitte.z + k.blick[1]) : k.w, { kern: true, erzwinge: true });
  }
  const bruecke = setze('bruecke', mitte.x + BRUECKE_DX, gassen[0][gassen[0].length - 1].z, Math.PI / 2, { kern: true, wasserOk: true, erzwinge: true });
  // Wachtürme an den Ausgängen des Hauptwegs
  const haupt = bahnen.find((b) => b.id === 'hauptweg') || bahnen[0];
  if (haupt) {
    const d = dichte(haupt.pts), s0 = d.reduce((m, p) => (Math.hypot(p.x - mitte.x, p.z - mitte.z) < Math.hypot(m.x - mitte.x, m.z - mitte.z) ? p : m), d[0]).s;
    for (const [id, ds] of [['tor-sued', -84], ['tor-nord', 84]]) {
      const p = d.reduce((m, q) => (Math.abs(q.s - (s0 + ds)) < Math.abs(m.s - (s0 + ds)) ? q : m), d[0]);
      const nx = p.tz, nz = -p.tx, seite = (6 + haupt.breite / 2), tx = p.x + nx * seite, tz = p.z + nz * seite;
      punkt(id, p.x, p.z, Math.atan2(p.tx * Math.sign(ds), p.tz * Math.sign(ds)));
      setze('wachturm', tx, tz, blick(tx, tz, p.x, p.z), { kern: true, erzwinge: true });
    }
  }

  // ---- Häuser an Wegen
  const hausFuss = [];
  const tuerAbstand = (t) => { const p = vorTuer(t, 1); return Math.min(wegAbstand(p.x, p.z), Math.hypot(p.x - mitte.x, p.z - mitte.z) - PLATZ_RADIUS); };
  const kandidaten = (schritt) => {
    const liste = [];
    for (const b of bahnen) {
      const d = dichte(b.pts, schritt);
      for (const p of d) {
        const dm = Math.hypot(p.x - mitte.x, p.z - mitte.z);
        if (dm < 26 || dm > 70 || (b.id === 'ost-gasse' && p.x - mitte.x > 62)) continue;
        for (const seite of [-1, 1]) liste.push({ p, seite, breite: b.breite });
      }
    }
    return shuffle(r, liste);
  };
  const baueHaeuser = (ziel, schritt, luft) => {
    for (const c of kandidaten(schritt)) {
      if (hausFuss.length >= ziel) break;
      const v = int(r, 0, 1), m = M('haus', v), nx = c.p.tz * c.seite, nz = -c.p.tx * c.seite;
      const ab = c.breite / 2 + range(r, 3, 5) + m.tiefe / 2, along = range(r, -2, 2);
      const x = c.p.x + nx * ab + c.p.tx * along, z = c.p.z + nz * ab + c.p.tz * along;
      const w = blick(x, z, c.p.x, c.p.z) + range(r, -0.14, 0.14);
      if (Math.hypot(x - mitte.x, z - mitte.z) > 74) continue;
      const t = setze('haus', x, z, w, { variante: v, luft });
      if (t) hausFuss.push(t);
    }
  };
  baueHaeuser(int(r, 10, 12), 7, 2.5);
  if (hausFuss.length < 9) baueHaeuser(10, 3, 1.5);

  // ---- Gärten + Kleinkram
  const garten = [];
  const lw = (t, lx, lz) => lokalZuWeltRoh(t.x, t.z, t.winkel, lx, lz);
  for (const h of hausFuss) {
    const m = M('haus', h.variante);
    if (chance(r, 0.6)) {
      const gw = 8, gd = 6, cz = -(m.tiefe / 2 + 1 + gd / 2), c = lw(h, 0, cz), f = { x: c.x, z: c.z, winkel: h.winkel, bx: gw / 2, bz: gd / 2 };
      if (!fehler(f, 'garten', { luft: 0.3 })) {
        blocker.push({ ...f, typ: 'garten', id: 'garten-' + h.id }); garten.push({ x: c.x, z: c.z, haus: h.id });
        const lueckeX = pick(r, [-1, 1]), seg = (lx, lz, quer) => { const p = lw(h, lx, cz + lz); setze('zaun', p.x, p.z, h.winkel + (quer ? Math.PI / 2 : 0), { erzwinge: true }); };
        for (const x of [-3, -1, 1, 3]) { seg(x, -gd / 2); if (x !== lueckeX) seg(x, gd / 2); }
        for (const z of [-2, 0, 2]) { seg(-gw / 2, z, true); seg(gw / 2, z, true); }
        const nb = int(r, 1, 2), vb = int(r, 0, 2);
        for (let i = 0; i < nb; i++) { const p = lw(h, nb === 2 ? (i ? 2.1 : -2.1) : range(r, -1.5, 1.5), cz); setze('beet', p.x, p.z, h.winkel, { variante: vb, erzwinge: true }); }
        continue;
      }
    }
    if (chance(r, 0.7)) {
      const s = pick(r, [-1, 1]), typ = pick(r, ['heuhaufen', 'karren']), mm = M(typ), p = lw(h, range(r, -m.breite / 2, m.breite / 2), -(m.tiefe / 2 + mm.tiefe / 2 + 0.8));
      setze(typ, p.x, p.z, h.winkel + (typ === 'karren' ? range(r, -0.5, 0.5) : range(r, 0, 3)), { luft: 0.3 });
    }
  }
  const kleinkram = (t, n) => {
    const m = M(t.typ, t.variante);
    for (let i = 0; i < n; i++) {
      const s = pick(r, [-1, 1]), typ = pick(r, KLEIN), mm = M(typ);
      const p = lw(t, s * (m.breite / 2 + mm.breite / 2 + 0.4), range(r, -m.tiefe / 2 + 0.6, m.tiefe / 2 - 0.4));
      setze(typ, p.x, p.z, t.winkel + range(r, -0.2, 0.2), { luft: 0.1 });
    }
  };
  for (const h of hausFuss) if (chance(r, 0.8)) kleinkram(h, int(r, 1, 2));
  for (const t of teile.filter((q) => q.typ === 'taverne' || q.typ === 'schmiede')) kleinkram(t, 3);

  // ---- Laternen
  const laternen = [];
  const laterne = (x, z) => { const t = setze('laterne', x, z, 0, { luft: 0.4 }); if (t) laternen.push(t); };
  for (const b of bahnen) {
    let letzte = -Infinity, n = 0;
    for (const p of dichte(b.pts)) {
      const dm = Math.hypot(p.x - mitte.x, p.z - mitte.z);
      if (dm < 20 || dm > 80 || (b.id === 'moorweg' && dm > 55)) { letzte = -Infinity; continue; }
      if (p.s - letzte < 16) continue;
      const seite = (n++ % 2 ? 1 : -1) * (b.breite / 2 + 0.9);
      letzte = p.s; laterne(p.x + p.tz * seite, p.z - p.tx * seite);
    }
  }

  // ---- Felder (Osten), Palisade
  const feld = (dx, dz, bx, bz, w) => {
    const p = rel(dx, dz), f = { x: p.x, z: p.z, winkel: w, bx, bz };
    if (fehler(f, 'feld', { luft: 1, radius: radius + 60 })) return;
    felder.push({ x: p.x, z: p.z, bx, bz, winkel: norm(w) }); blocker.push({ ...f, typ: 'feld', id: 'feld-' + felder.length });
  };
  const oz = gassen[0][gassen[0].length - 1].z - mitte.z;
  for (const [dx, s] of [[78, 1], [78, -1], [96, 1], [96, -1]]) feld(dx, oz * 0.5 + s * 14, 9, 7, range(r, -0.1, 0.1));
  for (const s of [-1, 1]) for (const dx of [131, 150]) feld(dx, oz + s * 12, 8, 9, range(r, -0.1, 0.1));
  let an = 0, rest = int(r, 2, 5);
  const R = 84, n = Math.round((2 * Math.PI * R) / 3);
  for (let k = 0; k < n; k++) {
    if (rest-- <= 0) { an = 1 - an; rest = an ? int(r, 2, 5) : int(r, 3, 7); }
    if (!an) continue;
    const a = (k / n) * 2 * Math.PI, x = mitte.x + R * Math.cos(a), z = mitte.z + R * Math.sin(a);
    setze('palisade', x, z, Math.atan2(-Math.cos(a), -Math.sin(a)), { luft: 0.2 });
  }

  // ---- Punkte, Lichter, Sperren
  punkt('platz', mitte.x, mitte.z, 0);
  const aufPlatz = (id, typ, nr = 0) => { const t = teile.filter((q) => q.typ === typ)[nr]; if (t) punkt(id, t.x, t.z, t.winkel); return t; };
  aufPlatz('brunnen', 'brunnen'); aufPlatz('feuer', 'lagerfeuer'); aufPlatz('anschlagbrett', 'anschlagbrett'); aufPlatz('schrein', 'schrein');
  aufPlatz('markt', 'marktstand', 1); aufPlatz('uebung', 'trainingspuppe'); punkt('bruecke', bruecke.x, bruecke.z, bruecke.winkel);
  for (const [id, typ] of [['taverne', 'taverne'], ['schmiede', 'schmiede'], ['tempel', 'tempel']]) {
    const t = aufPlatz(id, typ), p = vorTuer(t, 1.8); punkt('npc-' + { taverne: 'wirt', schmiede: 'schmied', tempel: 'priester' }[typ], p.x, p.z, blick(p.x, p.z, mitte.x, mitte.z));
  }
  const ms = teile.filter((q) => q.typ === 'marktstand')[1], hp = lokalZuWeltRoh(ms.x, ms.z, ms.winkel, 1.2, M('marktstand').tiefe / 2 + 1.4);
  punkt('npc-haendler', hp.x, hp.z, blick(hp.x, hp.z, mitte.x, mitte.z));
  punkt('npc-wache', mitte.x + 2.5, mitte.z + 4.5, Math.PI);
  for (const t of teile) {
    if (t.typ === 'lagerfeuer') lichter.push({ x: t.x, y: t.y + 0.7, z: t.z, art: 'feuer' });
    if (t.typ === 'laterne') lichter.push({ x: t.x, y: t.y + 2.4, z: t.z, art: 'laterne' });
    if (['haus', 'taverne', 'schmiede', 'tempel', 'wachturm'].includes(t.typ)) { const m = M(t.typ, t.variante); sperren.push({ x: t.x, z: t.z, r: Math.hypot(m.breite, m.tiefe) / 2 + 2.5 }); }
  }
  sperren.push({ x: mitte.x, z: mitte.z, r: PLATZ_RADIUS + 2 });
  for (const g of garten) sperren.push({ x: g.x, z: g.z, r: 5.5 });
  for (const f of felder) sperren.push({ x: f.x, z: f.z, r: Math.hypot(f.bx, f.bz) });

  function pruefe() {
    const e = [], ids = new Set();
    for (const t of teile) {
      if (ids.has(t.id)) e.push('doppelte id ' + t.id); ids.add(t.id);
      const f = fuss(t), b = blocker.find((q) => q.id === t.id);
      const m = fehler(f, t.typ, { kern: t.kern, wasserOk: t.typ === 'bruecke', wegOk: t.typ === 'bruecke', selbst: b, liste: blocker.filter((q) => q.typ !== 'garten' && q.typ !== 'feld'), luft: 0 });
      if (m) e.push(`${t.id}: ${m}`);
      if (t.typ === 'haus' && tuerAbstand(t) > 12) e.push(`${t.id}: Tür zu weit vom Weg`);
    }
    for (const g of gassen) for (const p of g) if (wasser(p.x, p.z)) e.push(g.id + ' im Wasser');
    for (const f of felder) for (const t of teile) if (t.typ !== 'palisade' && boxenSchneiden(f, fuss(t), 0.05)) e.push(`feld bei ${f.x | 0},${f.z | 0} überlappt ${t.id}`);
    for (const a of laternen) for (const b of laternen) if (a < b && Math.hypot(a.x - b.x, a.z - b.z) < 5) e.push(`Laternen ${a.id}/${b.id} zu dicht`);
    if (hausFuss.length < 9) e.push('weniger als 9 Häuser');
    return e;
  }
  return { teile, punkte, gassen, felder, sperren, lichter, platzRadius: PLATZ_RADIUS, mitte, pruefe, dispose() {} };
}
