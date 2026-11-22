/**
 * @modul    modul-kampf
 * @zweck    Spiel-Modul 'kampf': Grundangriff ⚔ (Kombo über gameplay/nahkampf, Bogen = Pfeil), Klassen-Fähigkeiten für Krieger (Wut) und Waldläufer (Energie) mit eigener Leiste, Magier über das Zauber-Modul; Freischaltung nach Stufe
 * @api      KAMPF_MODUL -> api { klasse, angriff() -> bool, nutze(name) -> bool, leiste (gameplay/faehigkeiten), ressource {name,wert,max}, faehigkeiten (freigeschaltete Namen), stufe, waffe, pfeile (Zahl lebender Pfeile) }
 * @beispiel
 *   import { KAMPF_MODUL } from '../../engine/spiel/modul-kampf.js';
 *   // in module-liste.js anstecken (braucht spieler + entitaeten); Taste F / Knopf ⚔ = Grundangriff, 1–5 = Fähigkeiten; ?stufe=12 schaltet im Test alles frei
 *   kern.api('kampf').nutze('wuchtschlag');
 * @tags     spiel, modul, kampf, nahkampf, bogen, klasse, fähigkeit, wut, energie, leiste, handy, erlenwacht
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 *
 * Optionen: { klasse: 'krieger'|'waldlaeufer'|'magier' (sonst fortschritt.held.klasse), stufe, leisteUnten (px; Handy 228) }.
 * Schaden: entitaeten.schade(id, { menge, element:'koerper', quelle: spieler.id, stoss, krit }) gegen Team 'feind'; Werte aus fortschritt.werte() (schaden, krit, staerke/geschick/intellekt).
 * Rückstoß geht im Feld `stoss` mit – das Gegner-Modul wendet ihn bei ent:treffer an (kein zweiter gegner.stoss-Aufruf, sonst doppelt).
 * Ereignisse: sendet kampf:angriff {waffe, treffer}, kampf:faehigkeit {name, klasse}, chat:sende {kanal:'system'}; hört fort:stufe, fort:ausgeruestet, ent:treffer (Schild).
 * Läuft auch ohne fortschritt / zauber / gegner. Leistung: 1 InstancedMesh (Pfeile), keine Allokation pro Bild, DOM höchstens 10×/s.
 */
import { createNahkampf, WAFFEN, WAFFEN_NAMEN } from '../gameplay/nahkampf.js';
import { createLeiste } from '../gameplay/faehigkeiten.js';
import { KLASSEN, KLASSEN_FAEHIGKEITEN, freigeschaltet, neuFreigeschaltet, ressourcenVon } from '../gameplay/klassen-daten.js';
import { CLIPS } from '../models/character/character-clips.js';
import { createKampfLeiste } from '../ui/kampf-leiste.js';
import { createTrefferZahlen } from '../ui/treffer-zahlen.js';

const MAX_PFEILE = 24, DAEMPFUNG = 7, DOM_TAKT = 0.1;
const PRIMAER = { krieger: 'staerke', waldlaeufer: 'geschick', magier: 'intellekt' };
const GRUND = { ressource: (r) => `Zu wenig ${r === 'wut' ? 'Wut' : 'Energie'}`, abklingzeit: 'Lädt noch …', ziel: 'Kein Ziel', reichweite: 'Zu weit weg' };
const klemme = (x, a, b) => (x < a ? a : x > b ? b : x);
let lauf = null;

function starte(ctx) {
  const o = ctx.optionen || {}, render = ctx.optional('render');
  const spieler = ctx.braucht('spieler'), ent = ctx.braucht('entitaeten');
  const fort = ctx.optional('fortschritt'), zauber = ctx.optional('zauber'), welt = ctx.optional('welt'), bus = ctx.ereignisse;
  const THREE = render?.THREE;
  const wert = fort?.held?.klasse || o.klasse;
  const klasse = KLASSEN[wert] ? wert : 'krieger', K = KLASSEN[klasse], magier = klasse === 'magier';
  const urlStufe = +render?.url?.werte?.stufe;
  const aktuelleStufe = () => Math.max(1, Math.floor(urlStufe || +fort?.stufe || +o.stufe || 1));
  let stufe = aktuelleStufe();

  // ---- Zustand ----
  const defs = magier ? {} : Object.fromEntries(K.faehigkeiten.map((n) => [n, KLASSEN_FAEHIGKEITEN[n]]));
  const leiste = createLeiste({ faehigkeiten: defs, ressourcen: magier ? {} : ressourcenVon(klasse), gcd: 0.8 });
  let frei = freigeschaltet(klasse, stufe);
  const nk = createNahkampf({ waffe: K.waffe === 'bogen' ? 'faust' : K.waffe });
  const st = { waffe: K.waffe, bogenCd: 0, dom: 0, zahlenDt: 0, schild: 0, schildRest: 0, buffRest: 0, buffKrit: 0, buffSchaden: 0 };
  const pos = { x: 0, y: 0, z: 0, yaw: 0 }, zielPool = new Map(), ziele = [], zeit = [], dots = [];
  const figur = () => spieler.figur;
  const fz = () => figur()?.zustand;
  const blick = () => (typeof spieler.blickYaw === 'function' ? spieler.blickYaw() : Number.isFinite(spieler.blickYaw) ? spieler.blickYaw : fz()?.yaw ?? 0);
  const quelle = () => spieler.id ?? 'spieler';
  const spaeter = (t, fn) => zeit.push({ t, fn });
  const sende = (n, d) => bus.sende?.(n, d);

  // ---- Anzeige: Leiste + eigene Zahlen ----
  const zahlen = render?.ui ? createTrefferZahlen({ eltern: render.ui, max: 16, seed: ctx.seed }) : null;
  const melde = (text, farbe = '#ffe9a8') => { const p = fz()?.pos; if (p && zahlen) zahlen.zeige({ x: p.x, y: p.y + 2.5, z: p.z }, text, { farbe, groesse: 0.9, dauer: 0.9, streuung: 0 }); };
  const plaetze = () => frei.map((n, i) => ({ name: n, symbol: defs[n].symbol, taste: String(i + 1) }));
  const kl = !magier && render?.ui ? createKampfLeiste({ eltern: render.ui, plaetze: plaetze(), unten: o.leisteUnten ?? (render.handy ? 228 : 12), zIndex: 3, onNutze: (n) => nutze(n) }) : null;
  function leisteSetzen() {
    if (magier) zauber?.setzeLeiste?.(frei); else { zauber?.setzeLeiste?.([]); kl?.setPlaetze(plaetze()); }
  }
  leisteSetzen();

  // ---- Waffe ----
  function waffeErmitteln() {
    const w = fort?.ausruestung?.hole?.('waffe');
    const s = String(w && typeof w === 'object' ? (w.daten?.waffe ?? w.waffe ?? w.id ?? w.gegenstand ?? '') : w ?? '').toLowerCase();
    let n = s.includes('bogen') ? 'bogen' : WAFFEN_NAMEN.find((x) => s.includes(x)) || K.waffe;
    st.waffe = n;
    if (n !== 'bogen') nk.setWaffe(n);
  }
  waffeErmitteln();

  // ---- Werte / Schaden ----
  const grundSchaden = () => (st.waffe === 'bogen' ? 10 : WAFFEN[st.waffe]?.leicht?.[0]?.schaden ?? 8);
  function wuerfle(basis) {
    const w = fort?.werte?.() || {}, kr = (w.krit > 1 ? w.krit / 100 : w.krit || 0) + 0.05 + (st.buffRest > 0 ? st.buffKrit : 0);
    const krit = ctx.zufall() < kr;
    const roh = (basis + (w.schaden || 0)) * (1 + (w[PRIMAER[klasse]] || 0) * 0.01) * (st.buffRest > 0 ? 1 + st.buffSchaden : 1);
    return { menge: Math.max(1, Math.round(roh * (krit ? 1.6 : 1))), krit };
  }
  /** Ein Treffer auf Entität e; dx,dz = Richtung vom Spieler. Liefert true, wenn Schaden ging. */
  function triff(e, basis, dx, dz, kraft, ohneWut) {
    const r = wuerfle(basis), l = Math.hypot(dx, dz) || 1;
    ent.schade(e.id, { menge: r.menge, element: 'koerper', quelle: quelle(), krit: r.krit, stoss: kraft > 0 ? { x: dx / l, z: dz / l, kraft } : null });
    if (!ohneWut && K.wutProTreffer) leiste.gib('wut', K.wutProTreffer);
    return true;
  }
  /** Gegner im Kegel (halbwinkel rad; ≥ π = rundum) – Rückgabe: Zahl der Treffer, fn(e, dx, dz). */
  function imKegel(reichweite, halbwinkel, fn, mitte) {
    const p = mitte || fz()?.pos, yaw = fz()?.yaw ?? 0, fx = Math.sin(yaw), fzz = Math.cos(yaw);
    if (!p || !ent.imUmkreis) return 0;
    let n = 0;
    for (const e of ent.imUmkreis(p.x, p.z, reichweite + 1.5, { team: 'feind' }) || []) {
      if (e.lebt === false) continue;
      const dx = e.pos.x - p.x, dz = e.pos.z - p.z, d = Math.hypot(dx, dz), r = e.radius || 0.4;
      if (d > reichweite + r) continue;
      if (halbwinkel < Math.PI && d > r && Math.acos(klemme((dx * fx + dz * fzz) / d, -1, 1)) - Math.asin(klemme(r / d, 0, 1)) > halbwinkel) continue;
      fn(e, dx, dz); n++;
    }
    return n;
  }
  function naechster(reichweite, halbwinkel) {
    let best = null, bd = 1e9;
    imKegel(reichweite, halbwinkel, (e, dx, dz) => { const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = e; } });
    const z = spieler.ziel;
    return z && z.lebt !== false && z.pos && Math.hypot(z.pos.x - (fz()?.pos.x || 0), z.pos.z - (fz()?.pos.z || 0)) <= reichweite ? z : best;
  }
  const dreheZu = (e) => { const s = fz(); if (s && e?.pos) s.yaw = Math.atan2(e.pos.x - s.pos.x, e.pos.z - s.pos.z); };
  const ring = (p, farbe, radius, dauer = 0.4) => zauber?.fx?.ring?.({ x: p.x, y: p.y, z: p.z }, { farbe, radius, dauer });

  // ---- Pfeile: EIN InstancedMesh ----
  const pf = { n: 0, x: new Float32Array(MAX_PFEILE), y: new Float32Array(MAX_PFEILE), z: new Float32Array(MAX_PFEILE), vx: new Float32Array(MAX_PFEILE), vy: new Float32Array(MAX_PFEILE),
    vz: new Float32Array(MAX_PFEILE), t: new Float32Array(MAX_PFEILE), m: new Float32Array(MAX_PFEILE), basis: new Float32Array(MAX_PFEILE), stoss: new Float32Array(MAX_PFEILE) };
  let mesh = null, geo = null, mat = null;
  const hilf = THREE && { m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), d: new THREE.Vector3(), z: new THREE.Vector3(0, 0, 1) };
  if (THREE && render.szene) {
    geo = new THREE.BoxGeometry(0.05, 0.05, 0.9); mat = new THREE.MeshBasicMaterial({ color: 0xf0e2b0 });
    mesh = new THREE.InstancedMesh(geo, mat, MAX_PFEILE); mesh.count = 0; mesh.frustumCulled = false; render.szene.add(mesh);
  }
  /** basis 0 = nur Optik (Hagel). */
  function pfeil(x, y, z, vx, vy, vz, basis, kraft, leben = 1.2) {
    if (!mesh) return;
    const i = pf.n < MAX_PFEILE ? pf.n++ : 0;
    pf.x[i] = x; pf.y[i] = y; pf.z[i] = z; pf.vx[i] = vx; pf.vy[i] = vy; pf.vz[i] = vz; pf.t[i] = leben; pf.basis[i] = basis; pf.stoss[i] = kraft;
  }
  function pfeileUpdate(dt) {
    if (!mesh) return;
    for (let i = pf.n - 1; i >= 0; i--) {
      pf.t[i] -= dt; pf.vy[i] -= (pf.basis[i] > 0 ? 6 : 20) * dt;
      pf.x[i] += pf.vx[i] * dt; pf.y[i] += pf.vy[i] * dt; pf.z[i] += pf.vz[i] * dt;
      let aus = pf.t[i] <= 0 || (welt?.bodenHoehe && pf.y[i] < welt.bodenHoehe(pf.x[i], pf.z[i]));
      if (!aus && pf.basis[i] > 0 && ent.imUmkreis) {
        for (const e of ent.imUmkreis(pf.x[i], pf.z[i], 1.1, { team: 'feind' }) || []) {
          if (e.lebt === false || Math.abs(pf.y[i] - e.pos.y - 1) > 1.8) continue;
          triff(e, pf.basis[i], pf.vx[i], pf.vz[i], pf.stoss[i]); aus = true; break;
        }
      }
      if (aus) { const l = --pf.n; for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz', 't', 'basis', 'stoss']) pf[k][i] = pf[k][l]; }
    }
    mesh.count = pf.n;
    for (let i = 0; i < pf.n; i++) {
      hilf.d.set(pf.vx[i], pf.vy[i], pf.vz[i]).normalize();
      hilf.q.setFromUnitVectors(hilf.z, hilf.d); hilf.p.set(pf.x[i], pf.y[i], pf.z[i]);
      mesh.setMatrixAt(i, hilf.m.compose(hilf.p, hilf.q, hilf.s));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  /** Pfeil von der Hand Richtung Ziel (oder Blick). */
  function schiesse(basis, tempo, kraft) {
    const s = fz(); if (!s) return;
    const z = naechster(32, 0.5);
    if (z) dreheZu(z);
    const yaw = s.yaw, ox = s.pos.x + Math.sin(yaw) * 0.6, oy = s.pos.y + 1.4, oz = s.pos.z + Math.cos(yaw) * 0.6;
    let dx = Math.sin(yaw), dy = 0.03, dz = Math.cos(yaw);
    if (z) { const ex = z.pos.x - ox, ey = z.pos.y + 1 - oy, ez = z.pos.z - oz, l = Math.hypot(ex, ey, ez) || 1; dx = ex / l; dy = ey / l + 0.02; dz = ez / l; }
    pfeil(ox, oy, oz, dx * tempo, dy * tempo, dz * tempo, basis, kraft);
  }

  // ---- Grundangriff ----
  function angriff() {
    if (spieler.tot) return false;
    if (st.waffe === 'bogen') {
      if (st.bogenCd > 0 || zeit.length > 6) return false;
      st.bogenCd = 0.6;
      const c = figur()?.spiele?.('werfen', { tempo: 1.4 }), tb = c?.trefferBei ?? 0.2;
      spaeter(tb, () => { const b = wuerfle(grundSchaden()); schiesse(b.menge, 40, 3); sende('kampf:angriff', { waffe: 'bogen', treffer: 0 }); });
      return true;
    }
    return nk.angriff('leicht').ok;
  }
  function nahkampfEreignisse(es) {
    for (const e of es) {
      if (e.typ === 'schwung') {
        const W = WAFFEN[nk.waffe], sc = W.leicht[e.kombo] || W.leicht[0], clip = CLIPS[sc.clip];
        dreheZu(naechster(sc.reichweite + 1.5, 0.9));
        figur()?.spiele?.(sc.clip, { tempo: clip ? klemme(clip.trefferBei / (sc.vorlauf / (W.tempo || 1)), 0.6, 3) : 1 });
      } else if (e.typ === 'treffer') {
        for (const t of e.treffer) {
          const ziel = ent.hole?.(t.ziel);
          if (ziel && ziel.lebt !== false) triff(ziel, t.menge, t.richtung.x, t.richtung.z, Math.hypot(t.stoss.x, t.stoss.z));
        }
        sende('kampf:angriff', { waffe: nk.waffe, treffer: e.treffer.length });
      }
    }
  }
  function zieleFuerNahkampf() {
    ziele.length = 0;
    const p = pos;
    if (!ent.imUmkreis) return;
    for (const e of ent.imUmkreis(p.x, p.z, 6, { team: 'feind' }) || []) {
      if (e.lebt === false) continue;
      let z = zielPool.get(e.id); if (!z) zielPool.set(e.id, (z = { id: e.id }));
      z.x = e.pos.x; z.y = e.pos.y; z.z = e.pos.z; z.radius = e.radius || 0.4; ziele.push(z);
    }
  }

  // ---- Fähigkeiten ----
  function nutze(name) {
    if (!frei.includes(name)) return false;
    if (magier) return !!zauber?.wirke?.(name);
    const s = fz();
    const r = leiste.nutze(name, { bewegt: (s?.tempo || 0) > 0.5 });
    if (!r.ok) { const g = GRUND[r.grund]; if (g) melde(typeof g === 'function' ? g(defs[name].ressource) : g, '#9fc8ff'); return false; }
    return true;
  }
  function wirke(def) {
    const w = def.wirkung, basis = grundSchaden() * (w.faktor || 1), p = fz()?.pos;
    sende('kampf:faehigkeit', { name: def.name, klasse });
    if (!p) return;
    const clip = w.clip ? CLIPS[w.clip] : null;
    const anim = w.clip ? figur()?.spiele?.(w.clip, { tempo: 1.3 }) : null, tb = anim?.trefferBei ?? clip?.trefferBei ?? 0.15;
    if (w.typ === 'nahkampf') {
      dreheZu(naechster(w.reichweite + 1, 0.9));
      spaeter(tb / 1.3, () => { let n = imKegel(w.reichweite, w.winkel, (e, dx, dz) => triff(e, basis, dx, dz, w.stoss, true)); if (n && K.wutProTreffer) leiste.gib('wut', w.wutGewinn || 0); });
    } else if (w.typ === 'wirbel') {
      ring(p, 0xe8c070, w.radius, 0.5);
    } else if (w.typ === 'ansturm') {
      const z = naechster(def.reichweite, 0.7); if (z) dreheZu(z);
      const s = fz(), d = z ? Math.hypot(z.pos.x - s.pos.x, z.pos.z - s.pos.z) - 1.4 : w.strecke, v = klemme(d, 2, w.strecke) * DAEMPFUNG;
      figur()?.stoss?.(Math.sin(s.yaw) * v, 0, Math.cos(s.yaw) * v);
      spaeter(0.3, () => { const n = imKegel(2.8, 1.2, (e, dx, dz) => triff(e, basis, dx, dz, w.stoss, true)); if (n) leiste.gib('wut', w.wutGewinn || 0); });
    } else if (w.typ === 'schild') { st.schild = w.menge; st.schildRest = w.dauer; ring(p, 0xffd070, 1.6, 0.6); melde('Schild!', '#ffd070'); }
    else if (w.typ === 'beben') {
      spaeter(0.2 + tb / 1.3, () => { const q = fz()?.pos; if (!q) return; ring(q, 0xc8a070, w.radius, 0.6); spieler.kamera?.schuetteln?.(0.7, 0.35);
        imKegel(w.radius, 4, (e, dx, dz) => triff(e, basis, dx, dz, w.stoss, true)); });
    } else if (w.typ === 'schuss') {
      const z = naechster(w.reichweite, 0.5); if (z) dreheZu(z);
      spaeter(tb / 1.3, () => { const b = wuerfle(basis); schiesse(b.menge, w.tempo, w.stoss); });
    } else if (w.typ === 'gift') {
      dreheZu(naechster(w.reichweite + 1, 0.8));
      spaeter(tb / 1.3, () => imKegel(w.reichweite, w.winkel, (e, dx, dz) => {
        triff(e, basis, dx, dz, w.stoss);
        const d = dots.find((x) => x.rest <= 0) || (dots.length < 12 ? dots[dots.push({ rest: 0 }) - 1] : null);
        if (d) Object.assign(d, { id: e.id, rest: w.dotDauer, tick: w.dotDauer / w.dotTakte, naechst: w.dotDauer / w.dotTakte, menge: grundSchaden() * w.dotFaktor });
      }));
    } else if (w.typ === 'salto') {
      const s = fz(), v = w.strecke * DAEMPFUNG; figur()?.stoss?.(-Math.sin(s.yaw) * v, 5, -Math.cos(s.yaw) * v);
    } else if (w.typ === 'hagel') {
      const z = naechster(def.reichweite, 0.6), s = fz(), y = z ? Math.atan2(z.pos.x - s.pos.x, z.pos.z - s.pos.z) : s.yaw;
      const px = z ? z.pos.x : s.pos.x + Math.sin(y) * def.reichweite * 0.6, pz = z ? z.pos.z : s.pos.z + Math.cos(y) * def.reichweite * 0.6;
      const py = welt?.bodenHoehe ? welt.bodenHoehe(px, pz) : s.pos.y, mitte = { x: px, y: py, z: pz };
      ring(mitte, 0x9fd070, w.radius, 1.2);
      for (let k = 0; k < w.takte; k++) spaeter(0.1 + k * 0.4, () => {
        for (let j = 0; j < 6; j++) pfeil(px + (ctx.zufall() - 0.5) * w.radius * 1.6, py + 14, pz + (ctx.zufall() - 0.5) * w.radius * 1.6, 0, -26, 0, 0, 0, 1);
        imKegel(w.radius, 4, (e, dx, dz) => triff(e, basis, dx, dz, w.stoss), mitte);
      });
    } else if (w.typ === 'fokus') { st.buffRest = w.dauer; st.buffKrit = w.krit; st.buffSchaden = w.schaden; melde('Falkenauge!', '#9fe070'); }
  }
  function leisteEreignisse(es) {
    for (const e of es) {
      if (e.typ === 'fertig' && e.def?.kanal > 0) continue;   // Kanal: Takte wirken
      if (e.typ === 'wirkStart' && e.def?.wirkung?.typ === 'wirbel') { wirke(e.def); continue; }
      if (e.typ === 'fertig') wirke(e.def);
      else if (e.typ === 'kanalTakt') {
        const w = e.def.wirkung, p = fz()?.pos, basis = grundSchaden() * w.faktor;
        figur()?.spiele?.(w.clip, { tempo: 2 });
        if (p) imKegel(w.radius, 4, (t, dx, dz) => triff(t, basis, dx, dz, w.stoss, true)) && K.wutProTreffer && leiste.gib('wut', 3);
      }
    }
  }

  // ---- Freischaltung ----
  const abm = [
    bus.an?.('fort:stufe', (d) => {
      const neu = Math.floor(+d?.stufe || stufe), alt = stufe; stufe = neu;
      const n = neuFreigeschaltet(klasse, neu, alt);
      if (!n.length) return;
      frei = freigeschaltet(klasse, neu); leisteSetzen();
      for (const x of n) sende('chat:sende', { kanal: 'system', text: `Neue Fähigkeit: ${KLASSEN_FAEHIGKEITEN[x].name}` });
    }),
    bus.an?.('fort:ausgeruestet', (d) => { if (!d || d.sockel === 'waffe') waffeErmitteln(); }),
    bus.an?.('ent:treffer', (d) => {   // Schild (Kriegsschrei) gibt absorbierten Schaden zurück
      if (st.schild <= 0 || d?.id !== spieler.id) return;
      const a = Math.min(st.schild, +d.menge || 0); st.schild -= a;
      if (a > 0 && ent.hole?.(d.id)?.lebt !== false) ent.heile?.(d.id, a);
    }),
  ];
  const taste = (ev) => {
    const t = ev.target, i = ev.key >= '1' && ev.key <= '5' ? +ev.key - 1 : -1;
    if (i < 0 || magier || ev.repeat || /^(INPUT|TEXTAREA)$/.test(t?.tagName || '') || t?.isContentEditable) return;
    if (frei[i]) nutze(frei[i]);
  };
  globalThis.addEventListener?.('keydown', taste);

  return {
    klasse, leiste, nutze, angriff,
    get stufe() { return stufe; }, get waffe() { return st.waffe; }, get faehigkeiten() { return frei; }, get pfeile() { return pf.n; },
    get ressource() {
      if (magier) return { name: 'mana', wert: zauber?.buch?.mana ?? 0, max: zauber?.buch?.manaMax ?? 100 };
      const r = leiste.ressource(K.ressource); return { name: K.ressource, wert: r?.wert ?? 0, max: r?.max ?? 100 };
    },
    _update(dt) {
      const s = fz(); if (!s) return;
      pos.x = s.pos.x; pos.y = s.pos.y; pos.z = s.pos.z; pos.yaw = s.yaw;
      st.bogenCd -= dt; st.buffRest -= dt;
      if (st.schildRest > 0 && (st.schildRest -= dt) <= 0) st.schild = 0;
      const e = spieler.eingabe;
      if (!spieler.tot && e && (e.gedrueckt?.('aktion1') || (e.gehalten?.('aktion1') && (st.waffe === 'bogen' || nk.phase === 'bereit')))) angriff();
      if (nk.phase === 'vorlauf' || nk.phase === 'aktiv') zieleFuerNahkampf(); else ziele.length = 0;
      nahkampfEreignisse(nk.update(dt, pos, ziele));
      if (!magier) leisteEreignisse(leiste.update(dt, { bewegt: (s.tempo || 0) > 0.5 && !leiste.wirkt?.kanal }));
      for (let i = zeit.length - 1; i >= 0; i--) if ((zeit[i].t -= dt) <= 0) { const f = zeit[i].fn; zeit.splice(i, 1); f(); }
      for (const d of dots) if (d.rest > 0 && ((d.rest -= dt), (d.naechst -= dt) <= 0)) {
        d.naechst += d.tick; const z = ent.hole?.(d.id);
        if (z && z.lebt !== false) ent.schade(d.id, { menge: Math.max(1, Math.round(d.menge)), element: 'gift', quelle: quelle() }); else d.rest = 0;
      }
      pfeileUpdate(dt);
    },
    _spaet(dt) {
      st.dom += dt; st.zahlenDt += dt;
      if (st.dom < DOM_TAKT) return;
      kl?.update(st.dom, leiste); zahlen?.update(render.kamera, st.zahlenDt); st.dom = 0; st.zahlenDt = 0;
    },
    _dispose() {
      for (const f of abm) f?.();
      globalThis.removeEventListener?.('keydown', taste);
      kl?.dispose(); zahlen?.dispose(); nk.dispose(); leiste.dispose();
      if (mesh) { render.szene.remove(mesh); mesh.dispose?.(); geo.dispose(); mat.dispose(); }
    },
    _zustand() { return { stufe, leiste: leiste.zustand() }; },
    _lade(z) { if (z?.leiste && !magier) leiste.laden(z.leiste); },
  };
}

export const KAMPF_MODUL = {
  name: 'kampf', braucht: ['spieler', 'entitaeten'], optional: ['fortschritt', 'zauber', 'gegner', 'render', 'welt'],
  standard: { klasse: null },
  start(ctx) { lauf = starte(ctx); return lauf; },
  update(dt) { lauf?._update(dt); },
  spaet(dt) { lauf?._spaet(dt); },
  zustand() { return lauf?._zustand() ?? null; },
  lade(z) { lauf?._lade(z); },
  dispose() { lauf?._dispose(); lauf = null; },
};
