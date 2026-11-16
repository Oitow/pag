/**
 * @modul    welt-plan
 * @zweck    Deterministischer Welt-Plan als worldgen-Stufen: Zonen (Plateau, Mulde, Kuppe), Gewässer-Rinnen, ebene Plätze, Orte, geschwungene Pfade mit begrenztem Gefälle und Brücken, Mauer-Ring; dazu Prüfung (Plateau eben, Gefälle, Objekte im Weg, Tor erreichbar)
 * @api      createWeltPlan(plan, {meterProZelle = 2, hoehenSkala = 60}) -> {plan, stufen, zone(id), zoneBei(x,z), platz(id), plaetze(art?), pfad(id), lokalZuWelt(platz,lx,lz), koerperZuWelt(koerper,platz,y), pruefe(adapter) -> {ok,fehler,werte}, dispose()} ; ringPlaetze ; profil
 * @beispiel
 *   import { createWeltPlan } from '../../engine/world/welt-plan.js';
 *   import { createWorld } from '../../engine/world/worldgen/worldgen.js';
 *   const plan = createWeltPlan({ zonen: [{ id: 'tal', art: 'mulde', x: -175, z: 150, radius: 55 }], spawn: { x: -175, z: 150, yaw: 0 } }, { meterProZelle: 2.5 });
 *   const welt = createWorld({ preset: 'insel', seed: 1, stufen: plan.stufen });   // danach: Adapter, plan.pruefe(adapter), plan.pfad('hauptweg')
 * @tags     welt, plan, worldgen, zonen, pfad, bruecke, plateau, tutorial
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { smoothstep, lerp } from '../core/math.js';
import { FLAG, WASSER, bilinear } from './worldgen/worldgen-grid.js';
import { berechneHang } from './worldgen/worldgen-biomes.js';
import { ringPlaetze, profil, kurve, lokalZuWeltRoh, weltZuLokalRoh, naechstePunkte, inBox, boxenSchneiden, abstandStrecke } from './welt-plan-formen.js';

export { ringPlaetze, profil };

const tief = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) tief(v); } return o; };
const ZONEN_ART = ['plateau', 'mulde', 'kuppe', 'eben', 'frei'];

/** Plan auflösen: Defaults, Zonen-Mitte/-Radius, Plätze in Welt-Koordinaten, Ring-Plätze. */
function loese(plan) {
  const zonen = new Map(), ids = new Set();
  const einmalig = (id, was) => { if (!id || ids.has(was + id)) throw new Error(`welt-plan: ${was}-ID „${id}“ fehlt oder doppelt`); ids.add(was + id); };
  for (const z of plan.zonen || []) {
    einmalig(z.id, 'Zone');
    if (!ZONEN_ART.includes(z.art)) throw new Error(`welt-plan: Zone „${z.id}“ hat unbekannte Art „${z.art}“`);
    const o = { drehung: 0, anheben: 0, rand: 15, frei: 1, minLand: 2, ...z };
    if (z.streifen) { const [a, b] = z.streifen; o.x = (a[0] + b[0]) / 2; o.z = (a[1] + b[1]) / 2; o.radius = (z.breite ?? 10) / 2; }
    if (!(o.radius > 0)) throw new Error(`welt-plan: Zone „${z.id}“ braucht radius oder streifen+breite`);
    zonen.set(o.id, o);
  }
  const plaetze = [];
  for (const p of plan.plaetze || []) {
    einmalig(p.id, 'Platz');
    const zo = p.zone ? zonen.get(p.zone) : null;
    if (p.zone && !zo) throw new Error(`welt-plan: Platz „${p.id}“ nennt unbekannte Zone „${p.zone}“`);
    const pos = zo ? lokalZuWeltRoh(zo.x, zo.z, zo.drehung, p.lx ?? 0, p.lz ?? 0) : { x: p.x, z: p.z };
    const rund = p.radius != null, bx = rund ? p.radius : (p.bx ?? 0.5), bz = rund ? p.radius : (p.bz ?? bx);
    plaetze.push({ id: p.id, art: p.art, variante: p.variante ?? 0, x: pos.x, z: pos.z, winkel: (p.winkel ?? 0) + (zo?.drehung ?? 0), bx, bz, rund,
      ebnen: p.ebnen ?? bx >= 1.5, boden: p.boden ?? null, zone: p.zone ?? null, daten: p.daten ?? null });
  }
  for (const r of plan.ringe || []) {
    const zo = zonen.get(r.zone);
    if (!zo) throw new Error(`welt-plan: Ring „${r.id}“ nennt unbekannte Zone „${r.zone}“`);
    plaetze.push(...ringPlaetze({ ecken: 8, tor: 0, ...r }, zo));
  }
  const pfade = (plan.pfade || []).map(p => ({ breite: 3, maxGefaelle: 0.14, rand: 4, frei: 3, ...p }));
  const gewaesser = (plan.gewaesser || []).map(g => ({ rinne: 3 * g.breite, ...g }));
  return { zonen, plaetze, pfade, gewaesser, ringe: plan.ringe || [], spawn: plan.spawn || null };
}

export function createWeltPlan(plan, { meterProZelle = 2, hoehenSkala = 60 } = {}) {
  const mpz = meterProZelle, hs = hoehenSkala;
  const R = loese(plan);
  const S = { zH: null, zK: null, rinnen: [], pfade: new Map(), geschuetzt: null };
  const zonenListe = [...R.zonen.values()];
  const aufgeloest = tief({ ...plan, zonen: zonenListe, plaetze: R.plaetze, pfade: R.pfade, gewaesser: R.gewaesser });
  const gitter = w => { const b = w.breite, t = w.tiefe, cm = mpz * w.zelle; return { b, t, cm, zl: w.zelle, cx: x => x / cm + b / 2, cy: z => z / cm + t / 2, wx: c => (c - b / 2) * cm, wz: c => (c - t / 2) * cm }; };
  const zoneDist = (z, x, y) => (z.streifen ? abstandStrecke(x, y, z.streifen[0][0], z.streifen[0][1], z.streifen[1][0], z.streifen[1][1]).d : Math.hypot(x - z.x, y - z.z));
  /** Zellen im Umkreis r (m) um (x,z): fn(i, wx, wz). */
  const zellen = (g, x, z, r, fn) => {
    for (let y = Math.max(0, Math.floor(g.cy(z - r))); y <= Math.min(g.t - 1, Math.ceil(g.cy(z + r))); y++)
      for (let c = Math.max(0, Math.floor(g.cx(x - r))); c <= Math.min(g.b - 1, Math.ceil(g.cx(x + r))); c++) fn(y * g.b + c, g.wx(c), g.wz(y));
  };
  const reichweite = z => (z.streifen ? Math.hypot(z.streifen[1][0] - z.streifen[0][0], z.streifen[1][1] - z.streifen[0][1]) / 2 : 0) + z.radius;

  // ---------- Stufe 1: Gelände ----------
  function formeZone(welt, g, z) {
    const H = welt.hoehe, Rg = reichweite(z) + z.rand, werte = [];
    zellen(g, z.x, z.z, Rg, (i, x, y) => { if (zoneDist(z, x, y) <= z.radius) werte.push(H[i]); });
    if (!werte.length) return;
    werte.sort((a, b) => a - b);
    const med = werte[werte.length >> 1];
    const ziel = Math.max(z.hoehe != null ? z.hoehe / hs : med + (z.art === 'mulde' ? -(z.tiefe ?? 4) : z.anheben) / hs, z.minLand / hs);
    const behalte = z.art === 'mulde' ? 0.25 : 0;
    zellen(g, z.x, z.z, Rg, (i, x, y) => {
      const k = 1 - smoothstep(z.radius, z.radius + z.rand, zoneDist(z, x, y));
      if (k <= 0) return;
      H[i] = lerp(H[i], ziel + behalte * (H[i] - med), k);
      if (k > S.zK[i]) S.zK[i] = k;
      S.zH[i] = H[i];
    });
  }
  /** Rinne graben (Stufe 1) bzw. Wasser setzen (Stufe 2, setzeFlags). */
  function grabe(welt, g, r, setzeFlags) {
    const H = welt.hoehe, FL = welt.flags, n = r.B.length, best = naechstePunkte(r.C, r.aussen / g.cm, g.b, g.t);
    for (const i of best.liste) {
      if ((FL[i] & FLAG.OZEAN) || H[i] <= 0.0015) continue;
      const d = best.d[i] * g.cm, k = Math.min(Math.floor(best.s[i]), n - 2), B = lerp(r.B[k], r.B[k + 1], best.s[i] - k);
      if (d <= r.halfW) {
        const q = d / r.halfW;
        H[i] = B + 0.35 * r.T * q * q;
        if (setzeFlags) { FL[i] |= FLAG.FLUSS; welt.flussBreite[i] = (r.halfW * 2) / g.cm; welt.wasserstand[i] = B + 0.7 * r.T; S.geschuetzt[i] = 1; }
      } else H[i] = lerp(B + r.T + (0.25 * (d - r.halfW)) / hs, H[i], smoothstep(r.halfW, r.aussen, d));
    }
  }
  function ebneFlaeche(welt, g, p) {
    const H = welt.hoehe, flach = g.cm, rand = 4, ext = Math.hypot(p.bx, p.bz) + flach + rand, aussen = [];
    let summe = 0, anz = 0;
    zellen(g, p.x, p.z, ext, (i, x, z) => {
      const l = weltZuLokalRoh(p.x, p.z, p.winkel, x, z);
      const o = p.rund ? Math.max(0, Math.hypot(l.x, l.z) - p.bx) : Math.hypot(Math.max(0, Math.abs(l.x) - p.bx), Math.max(0, Math.abs(l.z) - p.bz));
      aussen.push(i, o);
      if (o <= flach) { summe += H[i]; anz++; }
    });
    if (!anz) return;
    for (let j = 0; j < aussen.length; j += 2) { const k = 1 - smoothstep(flach, flach + rand, aussen[j + 1]); if (k > 0) H[aussen[j]] = lerp(H[aussen[j]], summe / anz, k); }
  }
  function gelaende(welt) {
    const g = gitter(welt), H = welt.hoehe, n = g.b * g.t;
    S.zH = new Float32Array(n); S.zK = new Float32Array(n); S.rinnen = []; S.pfade.clear();
    for (const z of zonenListe) if (z.art !== 'frei') formeZone(welt, g, z);
    for (const gw of R.gewaesser) {
      const K = kurve(gw.punkte, g.cm * 0.8), m = K.punkte.length / 2, C = new Float64Array(m * 2), U = new Float64Array(m), bett = new Float64Array(m);
      for (let i = 0; i < m; i++) { C[2 * i] = g.cx(K.punkte[2 * i]); C[2 * i + 1] = g.cy(K.punkte[2 * i + 1]); U[i] = bilinear(H, g.b, g.t, C[2 * i], C[2 * i + 1]) * hs; }
      for (let r = 0; r < 3; r++) { let v = U[0]; for (let i = 1; i < m - 1; i++) { const u = U[i]; U[i] = (v + 2 * u + U[i + 1]) / 4; v = u; } }
      const T = gw.tiefe ?? 1;
      for (let i = 0; i < m; i++) bett[i] = Math.max(i ? Math.min(U[i] - T, bett[i - 1] - 0.003) : U[0] - T, 0.25);   // Bett nie unter Meeresspiegel (sonst Meeresarm)
      const B = profil(bett, K.laenge / (m - 1), 0.1, []), halfW = Math.max(gw.breite / 2, 0.75 * g.cm);
      const r = { gw, C, B: B.map(v => v / hs), halfW, T: T / hs, aussen: Math.max(gw.rinne / 2, halfW + 2 * g.cm), punkte: K.punkte };
      S.rinnen.push(r);
      grabe(welt, g, r, false);
    }
    for (const p of R.plaetze) if (p.ebnen) ebneFlaeche(welt, g, p);
  }

  // ---------- Stufe 2: Wasser ----------
  function wasser(welt) {
    const g = gitter(welt), FL = welt.flags, n = g.b * g.t;
    S.geschuetzt = new Uint8Array(n);
    for (const r of S.rinnen) grabe(welt, g, r, true);
    for (let i = 0; i < n; i++) {                       // natürliches Wasser in Plan-Zonen entfernen (Plateau, Tal-Boden)
      if (S.zK[i] < 0.5 || S.geschuetzt[i] || !(FL[i] & (FLAG.FLUSS | FLAG.SEE))) continue;
      FL[i] &= ~(FLAG.FLUSS | FLAG.SEE); welt.flussBreite[i] = 0; welt.wasserstand[i] = 0; if (welt.seeId) welt.seeId[i] = -1;
      welt.hoehe[i] = S.zH[i];
    }
    welt.seen = (welt.seen || []).filter(s => { const i = Math.round(s.y / g.zl) * g.b + Math.round(s.x / g.zl); return !(S.zK[i] >= 0.5); });
    for (const r of S.rinnen) {
      const m = r.punkte.length / 2, P = new Float32Array(m * 2), B = new Float32Array(m);
      for (let i = 0; i < m; i++) { P[2 * i] = r.C[2 * i] * g.zl; P[2 * i + 1] = r.C[2 * i + 1] * g.zl; B[i] = (r.gw.breite / g.cm) * g.zl; }
      const e = Math.round(r.C[2 * m - 1]) * g.b + Math.round(r.C[2 * m - 2]);
      welt.fluesse.push({ punkte: P, breite: B, muendung: FL[e] & FLAG.OZEAN ? 'meer' : 'rand', laenge: m, plan: r.gw.id });
    }
  }

  // ---------- Stufe 3: Orte ----------
  function orte(welt) {
    const g = gitter(welt), FL = welt.flags, o = { start: null, doerfer: [], poi: [] };
    for (const z of zonenListe) zellen(g, z.x, z.z, reichweite(z) + 2 * g.cm, (i, x, y) => {
      const d = zoneDist(z, x, y);
      if (z.art !== 'frei' && d <= z.radius) FL[i] |= FLAG.ORT;
      if (d <= z.radius * z.frei + 0.75 * g.cm) FL[i] |= FLAG.FREI;
    });
    const gen = (x, z) => ({ x: g.cx(x) * g.zl, y: g.cy(z) * g.zl });
    if (R.spawn) o.start = { ...gen(R.spawn.x, R.spawn.z), radius: (3 / g.cm) * g.zl, wert: 1, yaw: R.spawn.yaw ?? 0 };
    for (const r of R.ringe) { const z = R.zonen.get(r.zone); o.doerfer.push({ ...gen(z.x, z.z), radius: (r.radius / g.cm) * g.zl, wert: 1, zone: z.id }); }
    for (const z of zonenListe) if (z.art === 'kuppe') o.poi.push({ art: 'aussicht', ...gen(z.x, z.z), wert: welt.hoehe[Math.round(g.cy(z.z)) * g.b + Math.round(g.cx(z.x))] * hs, zone: z.id });
    welt.orte = o;
  }

  // ---------- Stufe 4: Wege ----------
  function wege(welt) {
    const g = gitter(welt), H = welt.hoehe, FL = welt.flags, WS = welt.wasserstand, { b, t, cm, zl } = g;
    const knoten = welt.wegKnoten = [];
    welt.wege = [];
    if (R.spawn) knoten.push({ ...welt.orte.start, art: 'start', zone: zoneBei(R.spawn.x, R.spawn.z) });
    for (const d of welt.orte.doerfer) knoten.push({ x: d.x, y: d.y, art: 'dorf', zone: d.zone });
    for (const p of welt.orte.poi) knoten.push({ x: p.x, y: p.y, art: p.art, zone: p.zone });
    for (const pf of R.pfade) {
      const K = kurve(pf.punkte, cm), n = K.punkte.length / 2, ds = K.laenge / (n - 1);
      const C = new Float64Array(n * 2), nass = new Uint8Array(n), hm = new Float64Array(n), ws = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        C[2 * i] = g.cx(K.punkte[2 * i]); C[2 * i + 1] = g.cy(K.punkte[2 * i + 1]);
        const idx = Math.min(t - 1, Math.max(0, Math.round(C[2 * i + 1]))) * b + Math.min(b - 1, Math.max(0, Math.round(C[2 * i])));
        nass[i] = FL[idx] & WASSER ? 1 : 0; ws[i] = nass[i] && !(FL[idx] & FLAG.OZEAN) ? WS[idx] * hs : 0;
        hm[i] = bilinear(H, b, t, C[2 * i], C[2 * i + 1]) * hs;
      }
      const fest = [0, n - 1], bruecken = [], bruckenM = [];
      for (let i = 0; i < n;) {                         // Wasserläufe → Brücken; Ufer mindestens Wasser + 0.6 m
        if (!nass[i]) { i++; continue; }
        let e = i; while (e + 1 < n && nass[e + 1]) e++;
        const a = Math.max(0, i - 1), z2 = Math.min(n - 1, e + 1);
        let wmax = -Infinity; for (let k = i; k <= e; k++) wmax = Math.max(wmax, ws[k]);
        for (const k of [a, z2]) if (!nass[k]) { hm[k] = Math.max(hm[k], wmax + 0.6); fest.push(k); }
        for (let k = i; k <= e; k++) hm[k] = lerp(hm[a], hm[z2], z2 > a ? (k - a) / (z2 - a) : 0);
        const dx = C[2 * z2] - C[2 * a], dy = C[2 * z2 + 1] - C[2 * a + 1], l = Math.hypot(dx, dy) || 1;
        const mx = (C[2 * a] + C[2 * z2]) / 2, my = (C[2 * a + 1] + C[2 * z2 + 1]) / 2;
        bruecken.push({ x: mx * zl, y: my * zl, laenge: l * zl, dx: dx / l, dy: dy / l });
        bruckenM.push({ x: g.wx(mx), z: g.wz(my), laenge: l * cm, winkel: Math.atan2(dx, dy) });
        i = e + 1;
      }
      const h2 = profil(hm, ds, pf.maxGefaelle * 0.85, fest);
      const halbe = Math.max(pf.breite / 2, 1.1 * cm), aussen = halbe + pf.rand, rWeg = Math.max(pf.breite / 2, 0.75 * cm);
      const rFrei = Math.max(pf.frei, pf.breite / 2 + 0.75 * cm + 0.3);
      const best = naechstePunkte(C, aussen / cm + 0.01, b, t);
      for (const i of best.liste) {
        const d = best.d[i] * cm, wet = FL[i] & WASSER;
        if (d <= rWeg) FL[i] |= wet ? FLAG.WEG : FLAG.WEG | FLAG.FREI;
        else if (d <= rFrei && !wet) FL[i] |= FLAG.FREI;
        if (wet || d > aussen) continue;
        const k = Math.min(Math.floor(best.s[i]), n - 2), hp = lerp(h2[k], h2[k + 1], best.s[i] - k) / hs;
        H[i] = lerp(H[i], hp, 1 - smoothstep(halbe, aussen, d));
      }
      const P = new Float32Array(n * 2);
      for (let i = 0; i < n * 2; i++) P[i] = C[i] * zl;
      const idKn = z => knoten.findIndex(k => k.zone === z);
      welt.wege.push({ von: idKn(pf.von), nach: idKn(pf.nach), punkte: P, laenge: (K.laenge / cm) * zl, bruecken });
      S.pfade.set(pf.id, { punkte: Float32Array.from(K.punkte), laenge: K.laenge, bruecken: bruckenM });
    }
    for (const p of R.plaetze) zellen(g, p.x, p.z, Math.hypot(p.bx, p.bz) + 2 * cm, (i, x, z) => {
      if (inBox(x, z, p, 0.75 * cm + 0.5)) FL[i] |= FLAG.FREI;
      if (p.boden === 'weg' && inBox(x, z, p, 0) && !(FL[i] & WASSER)) FL[i] |= FLAG.WEG | FLAG.FREI;
    });
    welt.hang = berechneHang(H, b, t, welt.hang);
  }

  // ---------- Abfragen ----------
  function zoneBei(x, z) {
    let best = null;
    for (const zo of zonenListe) if (zoneDist(zo, x, z) <= zo.radius && (!best || zo.radius < best.radius)) best = zo;
    return best ? best.id : null;
  }
  const lokalZuWelt = (p, lx, lz) => lokalZuWeltRoh(p.x, p.z, p.winkel || 0, lx, lz);
  const koerperZuWelt = (k, p, y = 0) => { const q = lokalZuWelt(p, k.x || 0, k.z || 0); return { ...k, x: q.x, z: q.z, winkel: (k.winkel || 0) + (p.winkel || 0), y0: (k.y0 ?? 0) + y }; };

  function pruefe(adapter) {
    const fehler = [], w = adapter.welt, bh = (x, z) => adapter.bodenHoehe(x, z);
    const werte = { pfadLaenge: 0, maxGefaelle: 0, maxUnebenheit: 0, objekteImWeg: 0, ueberlappungen: 0 };
    const pfade = R.pfade.map(p => ({ pf: p, ...S.pfade.get(p.id) }));
    if (!pfade.length || pfade.some(p => !p.punkte)) { fehler.push('Pfad fehlt: Welt wurde nicht mit plan.stufen erzeugt'); return { ok: false, fehler, werte }; }
    werte.pfadLaenge = pfade[0].laenge;
    for (const { pf, punkte: P } of pfade) {
      let max = 0;
      for (let i = 2; i < P.length; i += 2) {
        const x0 = P[i - 2], z0 = P[i - 1], x1 = P[i], z1 = P[i + 1];
        if (adapter.wasserHoehe(x0, z0) != null || adapter.wasserHoehe(x1, z1) != null || adapter.wasserHoehe((x0 + x1) / 2, (z0 + z1) / 2) != null) continue;
        max = Math.max(max, Math.abs(bh(x1, z1) - bh(x0, z0)) / Math.hypot(x1 - x0, z1 - z0));
      }
      werte.maxGefaelle = Math.max(werte.maxGefaelle, max);
      if (max > pf.maxGefaelle * 1.15) fehler.push(`Pfad „${pf.id}“: Gefälle ${max.toFixed(3)} > ${pf.maxGefaelle}`);
    }
    const spanne = (pts) => { let lo = Infinity, hi = -Infinity; for (const [x, z] of pts) { const v = bh(x, z); lo = Math.min(lo, v); hi = Math.max(hi, v); } return hi - lo; };
    for (const p of R.plaetze) if (p.ebnen) {
      const pts = [];
      for (let u = -p.bx; u <= p.bx + 1e-6; u += 0.75) for (let v = -p.bz; v <= p.bz + 1e-6; v += 0.75) if (!p.rund || Math.hypot(u, v) <= p.bx) { const q = lokalZuWelt(p, u, v); pts.push([q.x, q.z]); }
      const s = spanne(pts); werte.maxUnebenheit = Math.max(werte.maxUnebenheit, s);
      if (s > 0.3) fehler.push(`Platz „${p.id}“ uneben (${s.toFixed(2)} m)`);
    }
    for (const z of zonenListe) if (z.art === 'plateau') {
      const pts = [[z.x, z.z]];
      for (let r = 3; r <= z.radius * 0.9; r += 3) for (let k = 0, m = Math.ceil((2 * Math.PI * r) / 3); k < m; k++) pts.push([z.x + r * Math.cos((k / m) * 6.2832), z.z + r * Math.sin((k / m) * 6.2832)]);
      const s = spanne(pts); werte.maxUnebenheit = Math.max(werte.maxUnebenheit, s);
      if (s > 0.3) fehler.push(`Plateau „${z.id}“ uneben (${s.toFixed(2)} m)`);
    }
    const o = w.objekte;
    if (o) for (let i = 0; i < o.anzahl; i++) {
      const q = adapter.zuWelt(o.x[i], o.y[i]);
      const drin = R.plaetze.some(p => inBox(q.x, q.z, p, 0)) || zonenListe.some(z => zoneDist(z, q.x, q.z) <= z.radius * z.frei)
        || pfade.some(({ pf, punkte: P }) => { for (let k = 2; k < P.length; k += 2) if (abstandStrecke(q.x, q.z, P[k - 2], P[k - 1], P[k], P[k + 1]).d < pf.breite / 2) return true; return false; });
      if (drin) werte.objekteImWeg++;
    }
    if (werte.objekteImWeg) fehler.push(`${werte.objekteImWeg} Objekte in Plätzen, freien Zonen oder auf dem Pfad`);
    const fest = R.plaetze.filter(p => p.boden !== 'weg' && p.art !== 'strasse' && p.art !== 'eben');
    for (let i = 0; i < fest.length; i++) for (let j = i + 1; j < fest.length; j++)
      if ((!fest[i].ring || fest[i].ring !== fest[j].ring) && boxenSchneiden(fest[i], fest[j], 0.1)) { werte.ueberlappungen++; fehler.push(`Plätze „${fest[i].id}“ und „${fest[j].id}“ überlappen`); }
    const tor = R.plaetze.find(p => p.art === 'torhaus'), ende = pfade[pfade.length - 1].punkte;
    if (tor) {
      const f = lokalZuWelt(tor, 0, tor.bz + 2), ex = ende[ende.length - 2], ez = ende[ende.length - 1], l = Math.hypot(f.x - ex, f.z - ez);
      let schlecht = l > 15;
      for (let s = 0, m = Math.ceil(l); s <= m && !schlecht; s++) {
        const x = ex + ((f.x - ex) * s) / m, z = ez + ((f.z - ez) * s) / m, x2 = ex + ((f.x - ex) * (s + 1)) / m, z2 = ez + ((f.z - ez) * (s + 1)) / m;
        if (adapter.wasserHoehe(x, z) != null || (s < m && Math.abs(bh(x2, z2) - bh(x, z)) / (l / m) > 0.25)) schlecht = true;
      }
      if (schlecht) fehler.push('Tor nicht erreichbar (Pfad-Ende zu weit, Wasser oder zu steil)');
    } else if (R.ringe.length) fehler.push('Torhaus fehlt');
    if (R.spawn && adapter.wasserHoehe(R.spawn.x, R.spawn.z) != null) fehler.push('Spawn liegt im Wasser');
    return { ok: !fehler.length, fehler, werte };
  }

  const stufen = [
    { name: 'plan-gelaende', nach: 'erosion', run: gelaende },
    { name: 'plan-wasser', nach: 'fluesse', run: wasser },
    { name: 'orte', run: orte },
    { name: 'wege', run: wege },
  ];
  return {
    plan: aufgeloest, stufen, zone: id => R.zonen.get(id) ?? null, zoneBei, platz: id => R.plaetze.find(p => p.id === id) ?? null,
    plaetze: art => (art ? R.plaetze.filter(p => p.art === art) : R.plaetze.slice()), pfad: id => S.pfade.get(id) ?? null,
    lokalZuWelt, koerperZuWelt, pruefe, dispose() { S.pfade.clear(); S.rinnen = []; S.zH = S.zK = S.geschuetzt = null; },
  };
}
