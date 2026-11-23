/**
 * @modul    modul-dorf
 * @zweck    Spiel-Modul 'dorf': Startdorf Erlenwacht am Ort 'siedlung' – Plan (world/dorf-plan) + Gebäude/Kleinkram (models/bau) als Instanzen mit Kollision (render/bau-instanzen), Licht in der Nacht (render/licht-pool), Platz + Gassen als Boden, Felder voller Beete, Brücke über den Erlbach, Treffpunkt-Stationen (Brunnen, Schrein, Anschlagbrett, Amboss, Lagerfeuer) für Tutorial und Spieler
 * @api      DORF_MODUL -> api { punkt(id), punkte, ziele:[{id,pos,radius,text,art}], benutze(id, wer) -> {ok,text}, onBenutzt(fn), gebunden, plan, statistik }
 * @beispiel
 *   import { DORF_MODUL } from '../../engine/spiel/modul-dorf.js';
 *   const dorf = spiel.api('dorf'); dorf.punkt('brunnen');   // {x,z,y,winkel}
 *   // URL: ?weltblick=brunnen springt mit der Debug-Kamera auf den Platz (über welt.orte)
 * @tags     spiel, modul, dorf, siedlung, treffpunkt, gebaeude, licht, nacht, bruecke, felder, erlenwacht, mmo
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 *
 * Ereignisse: sendet dorf:benutzt {id, art} (brunnen|anschlagbrett|schrein|amboss|feuer), dorf:gebunden {x,z}, chat:sende {kanal:'welt'}.
 * Schrein: nach spieler:aktion 'wiederbelebt' teleportiert das Dorf die Figur zum gebundenen Schrein (Spieler-Modul bleibt unverändert).
 */
import * as THREE from 'three';
import { createDorfPlan } from '../world/dorf-plan.js';
import { createBauInstanzen, dreheLokal } from '../render/bau-instanzen.js';
import { createLichtPool } from '../render/licht-pool.js';
import { createHaus } from '../models/bau/haus.js';
import { createTaverne } from '../models/bau/taverne.js';
import { createSchmiede } from '../models/bau/schmiede.js';
import { createTempel } from '../models/bau/tempel.js';
import { createWachturm } from '../models/bau/wachturm.js';
import { createMarktstand, createBrunnen, createBank } from '../models/bau/markt.js';
import { createFass, createKiste, createBanner } from '../models/bau/vorrat.js';
import { createLaterne, createLagerfeuer } from '../models/bau/licht.js';
import { createWegweiser, createZaun } from '../models/bau/wegbau.js';
import { createTrainingspuppe } from '../models/bau/uebung.js';
import { createBruecke, createHolzstapel, createKarren, createBeet, createAnschlagbrett, createSchrein, createPalisade, createHeuhaufen } from '../models/bau/dorf-teile.js';

const FABRIKEN = {
  haus: createHaus, taverne: createTaverne, schmiede: createSchmiede, tempel: createTempel, wachturm: createWachturm,
  marktstand: createMarktstand, brunnen: createBrunnen, bank: createBank, fass: createFass, kiste: createKiste, banner: createBanner,
  laterne: createLaterne, lagerfeuer: createLagerfeuer, zaun: createZaun, trainingspuppe: createTrainingspuppe,
  wegweiser: (o) => createWegweiser({ ...o, schilder: [{ winkel: 0, text: 'Hochland' }, { winkel: Math.PI / 2, text: 'Nebelmoor' }, { winkel: Math.PI, text: 'Dämmerwald' }] }),
  bruecke: (o) => createBruecke({ ...o, laenge: 12, breite: 3 }), holzstapel: createHolzstapel, karren: createKarren, beet: createBeet,
  anschlagbrett: createAnschlagbrett, schrein: createSchrein, palisade: createPalisade, heuhaufen: createHeuhaufen,
};
const ZIEL_TEXT = { brunnen: 'Wasser schöpfen', schrein: 'Am Schrein binden', anschlagbrett: 'Anschlagbrett lesen', amboss: 'Amboss ansehen', feuer: 'Am Feuer rasten' };
const AUSHANG = ['Gesucht: Wolfsfelle aus dem Hochland – Hauptmann Brandt zahlt gut.', 'Warnung: Im Nebelmoor treiben Irrlichter ihr Spiel. Nicht allein gehen!',
  'Grauzahn, der Leitwolf vom Wolfsfels, ist wieder gesichtet worden.', 'Die Schmiede kauft Erz aus den Grauzinnen.'];

/** Erlbach-Stelle nächst (x,z): Lage + Richtung quer zum Wasser. */
function bachStelle(fluesse, x, z) {
  let best = null;
  for (const f of fluesse || []) {
    if (f.id === 'fluss') continue;
    const P = f.proben;
    for (let i = 1; i < P.length - 1; i++) {
      const d = (P[i].x - x) ** 2 + (P[i].z - z) ** 2;
      if (!best || d < best.d) best = { d, q: P[i], dx: P[i + 1].x - P[i - 1].x, dz: P[i + 1].z - P[i - 1].z };
    }
  }
  if (!best || best.d > 60 * 60) return null;
  const l = Math.hypot(best.dx, best.dz) || 1;
  return { x: best.q.x, z: best.q.z, y: best.q.y, b: best.q.b, quer: Math.atan2(-best.dz / l, best.dx / l) };   // winkel: lokale +z zeigt quer übers Wasser
}

/** Bodenstreifen (Gasse) bzw. Platz-Scheibe dicht über dem Gelände. */
function bodenMesh(punkteListen, hoehe, farbe) {
  const pos = [], col = [], idx = [], c = new THREE.Color(farbe);
  for (const ring of punkteListen) {
    const o = pos.length / 3;
    for (const p of ring) { pos.push(p.x, hoehe(p.x, p.z) + 0.06, p.z); const v = 0.82 + (Math.sin(p.x * 1.7 + p.z * 0.9) * Math.sin(p.z * 1.3 - p.x * 0.6) * 0.5 + 0.5) * 0.3; col.push(c.r * v, c.g * v, c.b * v); }
    for (let i = 0; i < ring.idx.length; i++) idx.push(ring.idx[i] + o);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  const nor = new Float32Array(pos.length); for (let i = 1; i < nor.length; i += 3) nor[i] = 1;   // flach nach oben: keine Schattierungs-Sterne
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.receiveShadow = true; m.name = 'dorf-boden';
  return m;
}
function scheibe(mx, mz, r) {
  const pts = [{ x: mx, z: mz }], idx = [], N = 36, R = 6;
  for (let j = 1; j <= R; j++) for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, rr = r * j / R * (j === R ? 1 + 0.06 * Math.sin(a * 5) : 1); pts.push({ x: mx + Math.cos(a) * rr, z: mz + Math.sin(a) * rr }); }
  for (let i = 0; i < N; i++) idx.push(0, 1 + (i + 1) % N, 1 + i);
  for (let j = 1; j < R; j++) for (let i = 0; i < N; i++) {
    const a = 1 + (j - 1) * N + i, b = 1 + (j - 1) * N + (i + 1) % N, c = a + N, d = b + N;
    idx.push(a, b, c, b, d, c);
  }
  return Object.assign(pts, { idx });
}
function streifen(linie, breite) {
  const pts = [], idx = [], dicht = [];
  for (let i = 0; i < linie.length - 1; i++) {
    const a = linie[i], b = linie[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 2));
    for (let k = 0; k < n; k++) dicht.push({ x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n });
  }
  dicht.push(linie[linie.length - 1]);
  dicht.forEach((q, i) => {
    const a = dicht[Math.max(0, i - 1)], b = dicht[Math.min(dicht.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = -(b.z - a.z) / l * breite / 2, nz = (b.x - a.x) / l * breite / 2;
    pts.push({ x: q.x + nx, z: q.z + nz }, { x: q.x - nx, z: q.z - nz });
    if (i < dicht.length - 1) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  });
  return Object.assign(pts, { idx });
}

let aktiv = null;

export const DORF_MODUL = {
  name: 'dorf', braucht: ['render', 'welt'], optional: ['himmel', 'spieler', 'entitaeten'],
  standard: { seed: null, lichter: null },
  start(ctx) {
    const render = ctx.braucht('render'), welt = ctx.braucht('welt'), himmel = ctx.optional('himmel');
    const opt = ctx.optionen || {}, bus = ctx.ereignisse;
    const ort = welt.ort('siedlung');
    if (!ort) throw new Error('dorf: Welt hat keinen Ort „siedlung“');
    const karte = welt.karte, hoehe = (x, z) => karte.hoehe(x, z);
    const plan = createDorfPlan({ seed: opt.seed ?? ctx.seed, mitte: { x: ort.x, z: ort.z }, radius: Math.min(ort.radius, 115), hoehe,
      wasser: (x, z) => karte.wasserHoehe(x, z) !== null, wege: karte.wege });
    const teile = plan.teile.slice();

    // Brücke genau über den Erlbach legen (der Plan kennt nur eine grobe Stelle) und die Ost-Gasse bis ans Ufer verlängern
    const br = teile.find((t) => t.typ === 'bruecke'), stelle = br && bachStelle(karte.fluesse, br.x, br.z);
    const gassen = plan.gassen.map((g) => g.slice());
    if (br && stelle) {
      Object.assign(br, { x: stelle.x, z: stelle.z, winkel: stelle.quer });
      const ende = dreheLokal(stelle.quer, 0, -6.5), weit = dreheLokal(stelle.quer, 0, 6.5);
      const yE = Math.max(hoehe(stelle.x + ende.x, stelle.z + ende.z), hoehe(stelle.x + weit.x, stelle.z + weit.z));
      br.y = Math.max(stelle.y + 0.35, yE - 0.06);
      const ost = gassen.find((g) => plan.gassen[gassen.indexOf(g)]?.id === 'ost-gasse') || gassen[0];
      if (ost) ost.push({ x: stelle.x + ende.x, z: stelle.z + ende.z });
      plan.punkte.bruecke = { x: stelle.x, z: stelle.z, y: br.y, winkel: stelle.quer };
    } else if (br) teile.splice(teile.indexOf(br), 1);
    // Felder: Beete in Reihen
    plan.felder.forEach((f, fi) => {
      for (let r = -f.bz + 1.2; r <= f.bz - 1.2; r += 2.3) for (let c = -f.bx + 1.8; c <= f.bx - 1.8; c += 3.4) {
        const q = dreheLokal(f.winkel, c, r), x = f.x + q.x, z = f.z + q.z;
        if (karte.wasserHoehe(x, z) !== null) continue;
        teile.push({ id: `feld${fi}-${r.toFixed(1)}-${c.toFixed(1)}`, typ: 'beet', variante: fi % 3, x, z, winkel: f.winkel, y: hoehe(x, z) });
      }
    });

    // Welt: keine Bäume/Felsen/Gras im Dorf
    const frei = plan.sperren.slice();
    for (const g of gassen) for (let i = 0; i < g.length - 1; i++) {   // Gassen frei von Gras/Büschen
      const a = g[i], b = g[i + 1], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 3);
      for (let k = 0; k <= n; k++) frei.push({ x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n, r: 2 });
    }
    welt.sperreObjekte(frei);
    const gruppe = new THREE.Group(); gruppe.name = 'dorf'; render.szene.add(gruppe);
    const bau = createBauInstanzen({ teile, fabriken: FABRIKEN, kollision: welt.kollision, schatten: render.stufe.name !== 'niedrig' });
    gruppe.add(bau.gruppe);
    const boden = [
      bodenMesh([scheibe(plan.mitte.x, plan.mitte.z, plan.platzRadius + 1.5)], hoehe, 0x857660),
      bodenMesh(gassen.map((g) => streifen(g, 2.6)), hoehe, 0x7d6a4f),
      bodenMesh(plan.felder.map((f) => { const r = [], b = [[-1, -1], [1, -1], [1, 1], [-1, 1]]; for (const [sx, sz] of b) { const q = dreheLokal(f.winkel, sx * f.bx, sz * f.bz); r.push({ x: f.x + q.x, z: f.z + q.z }); } return Object.assign(r, { idx: [0, 2, 1, 0, 3, 2] }); }), hoehe, 0x5e4a33),
    ];
    for (const m of boden) gruppe.add(m);
    const pool = createLichtPool({ szene: render.szene, lichter: bau.lichter, anzahl: opt.lichter ?? (render.stufe.name === 'niedrig' ? 2 : 4), seed: ctx.seed });

    // Ziele (Interaktion macht das Tutorial-Modul): aus den Asset-Ankern bzw. Plan-Punkten
    const ziele = [], hatZiel = new Set();
    const ziel = (id, art, p) => { if (!p || hatZiel.has(id)) return; hatZiel.add(id); ziele.push({ id, art, pos: { x: p.x, z: p.z, y: p.y ?? hoehe(p.x, p.z) }, radius: 1.2, text: ZIEL_TEXT[art] || id }); };
    ziel('brunnen', 'brunnen', plan.punkte.brunnen);
    for (const a of bau.anker) {
      if (a.typ === 'schrein' && a.art === 'interaktion') ziel('schrein', 'schrein', a);
      if (a.typ === 'anschlagbrett' && a.art === 'interaktion') ziel('anschlagbrett', 'anschlagbrett', a);
      if (a.art === 'amboss') ziel('amboss', 'amboss', a);
      if (a.typ === 'lagerfeuer' && a.art === 'feuer') ziel('feuer', 'feuer', a);
    }
    for (const id of ['schrein', 'anschlagbrett', 'feuer']) ziel(id, id, plan.punkte[id]);
    // Sprungmarken für ?weltblick=/?ort=: Platz-Punkte als Orte der Welt (additiv)
    for (const id of ['brunnen', 'bruecke', 'tor-sued', 'tor-nord']) {
      const p = plan.punkte[id];
      if (p && !welt.orte.some((o) => o.id === id)) welt.orte.push({ id, name: id, art: 'dorf', x: p.x, z: p.z, radius: 0, blick: (p.winkel ?? 0) + Math.PI });
    }

    const zuhoerer = new Set();
    let gebunden = null, aushang = 0;
    const chat = (text) => bus?.sende?.('chat:sende', { kanal: 'welt', text });
    const spieler = () => ctx.optional('spieler');
    const heile = (menge) => { const ents = ctx.optional('entitaeten'), sp = spieler(); if (ents?.heile && sp?.id != null) ents.heile(sp.id, menge); };
    function benutze(id, wer) {
      const z = ziele.find((q) => q.id === id);
      if (!z) return { ok: false, text: '' };
      let text = '';
      if (z.art === 'brunnen') { heile(15); text = 'Das Wasser ist eiskalt und klar. Hier treffen sich alle in Erlenwacht.'; }
      else if (z.art === 'schrein') {
        gebunden = { x: z.pos.x + Math.sin(plan.punkte.schrein?.winkel ?? 0) * 2, z: z.pos.z + Math.cos(plan.punkte.schrein?.winkel ?? 0) * 2 };
        text = 'Die Runen glimmen auf. Fällst du, erwachst du hier.'; bus?.sende?.('dorf:gebunden', { ...gebunden });
      } else if (z.art === 'anschlagbrett') { text = 'Aushang: ' + AUSHANG[aushang++ % AUSHANG.length]; }
      else if (z.art === 'amboss') text = 'Der Amboss ist noch warm. Oskar schmiedet hier Waffen und Rüstungen.';
      else if (z.art === 'feuer') { heile(40); text = 'Du wärmst dich am Feuer und kommst wieder zu Kräften.'; }
      bus?.sende?.('dorf:benutzt', { id, art: z.art, wer: wer ?? null });
      for (const f of zuhoerer) f({ id, art: z.art });
      if (text) chat(text);
      return { ok: true, text };
    }
    const ab = [];
    if (bus?.an) ab.push(bus.an('spieler:aktion', (d) => { if (d?.name === 'wiederbelebt' && gebunden) spieler()?.teleport?.(gebunden.x, gebunden.z); }));

    const fokus = () => { const f = ctx.dienst('fokus'); const p = typeof f === 'function' ? f() : null; return p && Number.isFinite(p.x) ? p : render.kamera.position; };
    let nacht = 0;
    aktiv = {
      update(dt) {
        const tag = himmel?.stand?.()?.tag;
        nacht = Number.isFinite(tag) ? 1 - tag : 0;
        bau.setzeNacht(nacht);
        pool.update(dt, fokus(), nacht);
      },
      dispose() {
        for (const f of ab) f?.(); zuhoerer.clear();
        pool.dispose(); bau.dispose();
        for (const m of boden) { m.geometry.dispose(); m.material.dispose(); }
        render.szene.remove(gruppe);
      },
    };
    if (render.debug) console.info(`[dorf] ${teile.length} Teile, ${bau.dreiecke | 0} △, ${bau.lichter.length} Lichter, Prüfung: ${plan.pruefe().length} Fehler`);
    return {
      plan, punkte: plan.punkte, ziele, benutze,
      punkt: (id) => plan.punkte[id] || null,
      onBenutzt(fn) { zuhoerer.add(fn); return () => zuhoerer.delete(fn); },
      get gebunden() { return gebunden; },
      get statistik() { return { teile: teile.length, dreiecke: bau.dreiecke, lichter: bau.lichter.length, koerper: bau.koerperIds.length, nacht }; },
    };
  },
  update(dt) { aktiv?.update(dt); },
  dispose() { aktiv?.dispose(); aktiv = null; },
};
