// Bauen im Erde-Labor: Bau-Modus („🔨 Bauen“), Vorschau grün/rot, Einrasten im 2-m-Raster, Kosten aus der Tasche,
// Abreißen (halbe Rückgabe), Lagerfeuer (Flammen, Funken, Licht, Wärme), Dienste für die anderen Module (welt.dienste.bau).
// Regeln ohne THREE: bauen-regeln.js · Geometrien: bauteile.js · Vertrag: erweiterungen.js.
//
// Bauplatz = lokaler Tangentenrahmen auf der Kugel (Mitte C, Achsen E/U/N = x/y/z): alle Teile im Umkreis PLATZ_R teilen
// sein Raster. Gespeichert wird C/U/N absolut (Planetenkoordinaten) + die Teile lokal. Je Bauplatz und Teil-Art ein InstancedMesh.
import { TEILE, ARTEN, einrasten, pruefe, abriss, oberflaeche, dachUeber, fehlt, ausrichtung, huelle } from './bauen-regeln.js';
import { bauteilGeometrie, disposeBauteile } from './bauteile.js';
import { standardMaterial } from '../../../engine/render/mesh-builder.js';
import { gegenstandName } from './aktionen.js';
import { createBauLeiste } from './bauen-leiste.js';
import { zwischenprodukte } from './herstellen-daten.js';

const PLATZ_R = 60, AUGE = 1.7, VOR = 3.2, NAH = 14, MAX_LICHT = 3, FUNKEN = 18;
// Feuerstellen (Teile mit leucht-Geometrie): Licht (Teil-Rahmen x, y, z), Flammen flackern?, Funken ab Höhe, Lichtstärke
const GLUT = { lagerfeuer: { licht: [0, 0.8, 0], flackern: true, funken: 0, staerke: 1 },
  schmelzofen: { licht: [0, 0.55, 1.0], flackern: false, funken: 1.5, staerke: 0.75 } };
const GLUT_STD = GLUT.lagerfeuer;

export function createBauen(welt) {
  const { THREE, anker, cam, oben, vorn, blick, inventar } = welt;
  const V = () => new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const t1 = V(), t2 = V(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1);
  const plaetze = [];
  let modus = false, wahl = 'fundament', drehung = 0, naechsteId = 1, zeit = 0;
  let vor = null;   // aktuelle Vorschau { pl (oder Rahmen), teil, ok, grund }

  // ---------- Bauplätze ----------
  function rahme(pl, C, U, N) {   // Tangentenrahmen: U = oben, N = „vorn“ (z), E = U × N (x)
    pl.C.copy(C); pl.U.copy(U).normalize(); pl.N.copy(N).projectOnPlane(pl.U).normalize(); pl.E.crossVectors(pl.U, pl.N);
    pl.gruppe.position.copy(pl.C);
    pl.gruppe.quaternion.setFromRotationMatrix(m4.makeBasis(pl.E, pl.U, pl.N));
    pl.memo.clear();
    return pl;
  }
  function neuerPlatz(C, U, N) {
    const pl = { C: V(), U: V(), N: V(), E: V(), teile: [], meshes: [], feuer: [], memo: new Map(), gruppe: new THREE.Group() };
    pl.boden = (x, z) => {   // Geländehöhe im lokalen Rahmen (gemerkt, das Gelände ändert sich selten)
      const k = x.toFixed(1) + ',' + z.toFixed(1);
      let h = pl.memo.get(k);
      if (h === undefined) {
        t1.copy(pl.C).addScaledVector(pl.E, x).addScaledVector(pl.N, z).normalize();
        t1.multiplyScalar(welt.R + welt.bodenHoehe(t1));
        h = t1.sub(pl.C).dot(pl.U); pl.memo.set(k, h);
      }
      return h;
    };
    return rahme(pl, C, U, N);
  }
  const lokal = (pl, p) => { t2.set(p.x - pl.C.x, p.y - pl.C.y, p.z - pl.C.z); return { x: t2.dot(pl.E), y: t2.dot(pl.U), z: t2.dot(pl.N) }; };
  const absolut = (pl, x, y, z, out = V()) => out.copy(pl.C).addScaledVector(pl.E, x).addScaledVector(pl.U, y).addScaledVector(pl.N, z);
  const platzBei = (p, r = PLATZ_R) => {
    let best = null, bd = r * r;
    for (const pl of plaetze) { const d = pl.C.distanceToSquared(p); if (d < bd) { bd = d; best = pl; } }
    return best;
  };
  const naheTeile = (pl, x, z, r = NAH) => pl.teile.filter((t) => Math.abs(t.x - x) < r && Math.abs(t.z - z) < r);

  // ---------- Darstellung ----------
  const flammenMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const matrix = (t, sy = 1) => { q.setFromAxisAngle(Y, t.rot * Math.PI / 2); s1.set(1, sy, 1); return m4.compose(t2.set(t.x, t.y, t.z), q, s1); };
  function neuZeichnen(pl) {
    for (const m of pl.meshes) { pl.gruppe.remove(m); m.dispose(); }
    pl.meshes = []; pl.feuer = []; pl.memo.clear();
    for (const art of ARTEN) {
      const liste = pl.teile.filter((t) => t.art === art);
      if (!liste.length) continue;
      const g = bauteilGeometrie(art), mesh = new THREE.InstancedMesh(g.geo, standardMaterial(), liste.length);
      liste.forEach((t, i) => mesh.setMatrixAt(i, matrix(t)));
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      pl.meshes.push(mesh); pl.gruppe.add(mesh);
      if (g.leucht) {
        const fl = new THREE.InstancedMesh(g.leucht, flammenMat, liste.length), k = GLUT[art] || GLUT_STD;
        liste.forEach((t, i) => {
          fl.setMatrixAt(i, matrix(t));
          const c = Math.cos(t.rot * Math.PI / 2), s = Math.sin(t.rot * Math.PI / 2), [u, h, v] = k.licht;
          pl.feuer.push({ t, i, fl, k, w: absolut(pl, t.x, t.y, t.z), l: absolut(pl, t.x + u * c + v * s, t.y + h, t.z - u * s + v * c) });
        });
        fl.computeBoundingSphere();
        pl.meshes.push(fl); pl.gruppe.add(fl);
      }
    }
    if (pl.teile.length && !pl.gruppe.parent) anker.add(pl.gruppe);
    if (!pl.teile.length) { anker.remove(pl.gruppe); if (plaetze.includes(pl)) plaetze.splice(plaetze.indexOf(pl), 1); }
  }
  const alleFeuer = () => plaetze.flatMap((pl) => pl.feuer.map((f) => ({ ...f, pl })));

  // Vorschau (halbdurchsichtig grün/rot)
  const vorMat = new THREE.MeshBasicMaterial({ color: 0x55ff77, transparent: true, opacity: 0.42, depthWrite: false });
  const vorschau = new THREE.Mesh(bauteilGeometrie(wahl).geo, vorMat);
  vorschau.visible = false; vorschau.renderOrder = 5;
  anker.add(vorschau);

  // Lagerfeuer: wenige echte Lichter (erst beim ersten Feuer anlegen – jedes neue Licht übersetzt die Shader neu) + Funken
  const lichter = [], funken = [];
  const funkenMat = new THREE.PointsMaterial({ color: 0xffa040, size: 0.045, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  function feuerSlots(n) {
    while (lichter.length < Math.min(n, MAX_LICHT)) {
      const l = new THREE.PointLight(0xffa850, 0, 16, 1.5); anker.add(l); lichter.push(l);
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FUNKEN * 3), 3));
      const pk = new THREE.Points(geo, funkenMat); pk.frustumCulled = false; anker.add(pk); funken.push(pk);
    }
  }
  function feuerBild(dt) {
    const fs = alleFeuer();
    if (fs.length) feuerSlots(MAX_LICHT);   // alle Lichter auf einmal anlegen: nur EIN Shader-Neuübersetzen statt eines je Feuer
    for (const f of fs) f.d = f.w.distanceToSquared(cam);
    fs.sort((a, b) => a.d - b.d);
    for (const pl of plaetze) for (const f of pl.feuer) if (f.k.flackern) {   // Flammen flackern (Höhe je Feuer eigene Phase)
      const ph = f.i * 2.3 + f.t.x;
      f.fl.setMatrixAt(f.i, matrix(f.t, 0.85 + 0.2 * Math.sin(zeit * 11 + ph) + 0.1 * Math.sin(zeit * 23.7 + ph * 1.7)));
      f.fl.instanceMatrix.needsUpdate = true;
    }
    // tags nur ein Hauch (sonst gelber Fleck in der Sonne), nachts voll
    const hs = welt.zw?.sonne ? welt.zw.sonne.dot(oben) : -1, nacht = THREE.MathUtils.smoothstep(-hs, -0.25, 0.05);
    lichter.forEach((l, k) => {
      const f = fs[k], pk = funken[k];
      l.intensity = f ? (3 + 19 * nacht) * f.k.staerke * (1 + 0.12 * Math.sin(zeit * 9 + k) + 0.07 * Math.sin(zeit * 17.3 + k * 2)) : 0;
      pk.visible = !!f && f.d < 60 * 60;
      if (!f) return;
      l.position.copy(f.l);
      pk.position.copy(f.w).addScaledVector(f.pl.U, f.k.funken); pk.quaternion.copy(f.pl.gruppe.quaternion);
      const a = pk.geometry.attributes.position;
      for (let i = 0; i < FUNKEN; i++) {   // Funken steigen 1,8 m auf, schlingern, beginnen von vorn (deterministisch, kein Zufall)
        const u = (zeit * (0.45 + (i % 5) * 0.08) + i * 0.618) % 1, w = i * 2.4 + zeit * 1.3;
        a.setXYZ(i, Math.sin(w) * 0.25 * u + Math.sin(i) * 0.12, 0.3 + u * 1.8, Math.cos(w * 1.3) * 0.25 * u + Math.cos(i * 1.7) * 0.12);
      }
      a.needsUpdate = true;
    });
  }

  // ---------- Vorschau berechnen ----------
  let vorlaeufig = null;   // Rahmen für den ersten Teil eines neuen Bauplatzes (Raster folgt der Blickrichtung)
  function rahmenHier(ziel) {
    const pl = platzBei(ziel);
    if (pl) return pl;
    const p = welt.bodenPunkt(ziel, V());
    if (!vorlaeufig) vorlaeufig = neuerPlatz(p, p.clone().normalize(), vorn);
    else if (vorlaeufig.C.distanceToSquared(p) > 0.01 || vorlaeufig.N.dot(vorn) < 0.9999) rahme(vorlaeufig, p, t2.copy(p).normalize(), vorn);
    return vorlaeufig;
  }
  function vorschauRechnen() {
    const zielW = V().copy(cam).addScaledVector(vorn, VOR), pl = rahmenHier(zielW);
    const ziel = lokal(pl, zielW), auge = lokal(pl, cam);
    const rot = (ausrichtung(vorn.dot(pl.E), vorn.dot(pl.N)) + drehung) % 4;
    const neigung = Math.asin(THREE.MathUtils.clamp(blick.dot(oben), -1, 1));
    const teile = naheTeile(pl, ziel.x, ziel.z);
    const teil = einrasten(wahl, ziel.x, ziel.z, rot, teile, { boden: pl.boden, wunschY: auge.y + Math.tan(neigung) * VOR - 0.8 });
    let r = pruefe(teil, teile, pl.boden);
    if (r.ok && baumImWeg(pl, teil)) r = { ok: false, grund: 'Baum/Fels im Weg' };
    const fehl = fehlt(wahl, (id) => inventar.zaehle(id));
    if (r.ok && fehl.length) r = { ok: false, grund: 'fehlt: ' + fehl.map((f) => `${f.fehlt} ${gegenstandName(f.id)}`).join(', ') };
    vor = { pl, teil, ...r };
    absolut(pl, teil.x, teil.y, teil.z, vorschau.position);
    vorschau.quaternion.copy(pl.gruppe.quaternion).multiply(q.setFromAxisAngle(Y, teil.rot * Math.PI / 2));
    vorMat.color.set(r.ok ? 0x55ff77 : 0xff4a3a);
    vorschau.visible = true;
  }
  function baumImWeg(pl, teil) {
    const h = huelle(teil);
    for (const n of welt.natur?.naheHindernisse?.() || []) {
      const p = lokal(pl, n);
      if (p.y > h[3] || p.y < h[2] - 4) continue;
      const dx = Math.max(h[0] - p.x, 0, p.x - h[1]), dz = Math.max(h[4] - p.z, 0, p.z - h[5]);
      if (dx * dx + dz * dz < n.r * n.r) return true;
    }
    return false;
  }

  // ---------- Setzen / Abreißen ----------
  function setzeTeil(pl, teil) {
    if (pl === vorlaeufig) vorlaeufig = null;
    if (!plaetze.includes(pl)) plaetze.push(pl);
    pl.teile.push({ id: naechsteId++, art: teil.art, x: +teil.x.toFixed(3), y: +teil.y.toFixed(3), z: +teil.z.toFixed(3), rot: teil.rot });
    neuZeichnen(pl);
  }
  function setzen() {
    if (!welt.spieler().gehen) return { ok: false, text: 'Erst „Gehen“' };
    vorschauRechnen();
    if (!vor.ok) return { ok: false, text: `${TEILE[wahl].name}: ${vor.grund}` };
    for (const [id, n] of Object.entries(TEILE[wahl].kosten)) inventar.nimm(id, n);
    setzeTeil(vor.pl, vor.teil);
    return { ok: true, text: `${TEILE[wahl].name} gebaut` };
  }
  function anvisiert() {   // erstes Teil auf dem Blickstrahl (bis 6 m)
    for (let s = 0.3; s <= 6; s += 0.1) {
      t1.copy(cam).addScaledVector(blick, s);
      const pl = platzBei(t1);
      if (!pl) continue;
      const p = lokal(pl, t1);
      for (const t of naheTeile(pl, p.x, p.z, 4)) {
        const h = huelle(t);
        if (p.x > h[0] - 0.08 && p.x < h[1] + 0.08 && p.y > h[2] - 0.08 && p.y < h[3] + 0.08 && p.z > h[4] - 0.08 && p.z < h[5] + 0.08) return { pl, t };
      }
    }
    return null;
  }
  function abreissen() {
    const z = anvisiert();
    if (!z) return { ok: false, text: 'Kein Bauteil im Blick' };
    const r = abriss(z.pl.teile, z.t.id, z.pl.boden);
    z.pl.teile = r.rest;
    for (const [id, n] of Object.entries(r.zurueck)) if (n > 0) inventar.gib(id, n);
    neuZeichnen(z.pl);
    const mit = r.weg.length > 1 ? ` (+${r.weg.length - 1} eingestürzt)` : '';
    const zur = Object.entries(r.zurueck).filter(([, n]) => n > 0).map(([id, n]) => `${n} ${gegenstandName(id)}`).join(', ');
    return { ok: true, text: `${TEILE[z.t.art].name} abgerissen${mit}${zur ? ' · zurück: ' + zur : ''}` };
  }

  // ---------- Bedienung ----------
  const leiste = createBauLeiste({
    teile: ARTEN.map((a) => ({ art: a, name: TEILE[a].name })),
    waehle(a) { wahl = a; vorschau.geometry = bauteilGeometrie(a).geo; },
    setzen: () => melde(setzen()), abreissen: () => melde(abreissen()), drehen() { drehung = (drehung + 1) % 4; },
  });
  function melde(r) { welt.melde(r.text, r.ok); if (r.ok) welt.speichern(); }
  function schalte(an) {
    modus = an; vor = null;
    knopf.textContent = an ? '🔨 Fertig' : '🔨 Bauen'; knopf.classList.toggle('on', an);
    if (!an) vorschau.visible = false;
  }
  const knopf = welt.knopf('kBauen', '🔨 Bauen', () => schalte(!modus));

  // ---------- Dienste ----------
  const dienste = {
    /** Lagerfeuer (absolute Punkte, Kopien) im Umkreis r um p – für Zierrat wie glühen.js. */
    feuerPunkte(p, r = 40) { return alleFeuer().filter((f) => f.w.distanceTo(p) <= r).map((f) => f.w.clone()); },
    waermeBei(p) {
      let w = 0;
      for (const f of alleFeuer()) { const d = f.w.distanceTo(p); w = Math.max(w, d <= 4 ? 25 : d < 8 ? 25 * (8 - d) / 4 : 0); }
      return w;
    },
    unterDach(p) {
      const pl = platzBei(p); if (!pl) return false;
      const l = lokal(pl, p), h = dachUeber(naheTeile(pl, l.x, l.z, 3), l.x, l.z);
      return h !== null && h - l.y > -0.3 && h - l.y <= 4;
    },
    naheStationen(p, r = 4) {
      const out = new Set();
      for (const pl of plaetze) for (const t of pl.teile) if (TEILE[t.art].station && absolut(pl, t.x, t.y, t.z, t1).distanceTo(p) <= r) out.add(t.art);
      return [...out];
    },
    /** Kollisionskreise {x,y,z,r} (absolut) der Teile um p (p = Augenpunkt; nur, was auf dessen Höhe im Weg steht). */
    hindernisse(p, r = 12) {
      const out = [];
      for (const pl of plaetze) {
        if (pl.C.distanceTo(p) > PLATZ_R + r) continue;
        const l = lokal(pl, p), fuss = l.y - AUGE;
        for (const t of naheTeile(pl, l.x, l.z, r)) {
          const T = TEILE[t.art], h = huelle(t);
          if (T.dach || T.rampe || l.y < h[2] + 0.1 || fuss > h[3] - (T.begehbar ? 0.55 : 0.05)) continue;
          for (const [u, v, rad] of kreise(t.art)) {
            const c = Math.cos(t.rot * Math.PI / 2), s = Math.sin(t.rot * Math.PI / 2);
            absolut(pl, t.x + u * c + v * s, Math.max(h[2], fuss), t.z - u * s + v * c, t1);
            out.push({ x: t1.x, y: t1.y, z: t1.z, r: rad });
          }
        }
      }
      return out;
    },
    /** Höhe über R der begehbaren Oberseite unter p (p = Augenpunkt; Stufen bis 0,55 m werden erstiegen) oder null. */
    bodenUnter(p) {
      const pl = platzBei(p); if (!pl) return null;
      const l = lokal(pl, p), y = oberflaeche(naheTeile(pl, l.x, l.z, 3), l.x, l.z, l.y - AUGE + 0.55);
      return y === null ? null : absolut(pl, l.x, y, l.z, t1).length() - welt.R;
    },
  };
  welt.dienste.bau = dienste;

  // ?bautest=1 (2 = ohne Bau-Modus, 3 = schräg mit Treppe): kleine Hütte ~10 m vor dem Spieler (Fundament 2×2, Wände mit Tür, Dach, Lagerfeuer davor) – fürs Bild
  const testArt = +(/[?&]bautest=(\d)/.exec(location.search)?.[1] || 0);
  // ?schmiedetest=1|2: Schmelzofen, Amboss, Werkbank, Lagerfeuer vor den Spieler (siehe testSchmiede);
  // mit ?test=1&tasche=voll kommen Zwischenprodukte (Holzkohle, Barren …) und Baustoffe in die Tasche (Rohstoffe gibt herstellen.js)
  const schmiedeTest = /[?&]schmiedetest=[12]/.test(location.search);
  if (schmiedeTest && /[?&]test=1/.test(location.search) && /[?&]tasche=voll/.test(location.search)) {
    const bau = Object.values(TEILE).flatMap((t) => Object.keys(t.kosten));
    for (const id of new Set([...zwischenprodukte(), ...bau])) inventar.gib(id, 20);
  }
  let testT = testArt || schmiedeTest ? performance.now() + 6000 : 0;   // Boden lädt asynchron
  function testHuette() {
    const p = welt.bodenPunkt(t1.copy(cam).addScaledVector(vorn, 11), V());
    const pl = neuerPlatz(p, p.clone().normalize(), vorn);
    const n = V().copy(vorn).applyAxisAngle(pl.U, testArt === 3 ? 0.75 : 0);   // 3 = schräg (Giebel sichtbar)
    rahme(pl, t2.copy(pl.C).addScaledVector(pl.E, -1).addScaledVector(pl.N, -1), pl.U, n);
    const setz = (art, x, z, rot, wy) => setzeTeil(pl, einrasten(art, x, z, rot, pl.teile, { boden: pl.boden, wunschY: wy }));
    setz('fundament', 0, 0, 0);
    const L = pl.teile[0].y;
    for (const [x, z] of [[2, 0], [0, 2], [2, 2]]) setz('fundament', x, z, 0, L);
    setz('tuerwand', 0, -1, 0, L); setz('wand', 2, -1, 0, L); setz('wand', 0, 3, 0, L); setz('wand', 2, 3, 0, L);
    for (const z of [0, 2]) { setz('wand', -1, z, 1, L); setz('wand', 3, z, 1, L); }
    for (const x of [0, 2]) { setz('dach', x, 0, 0, L + 2.4); setz('dach', x, 2, 2, L + 2.4); }
    setz('werkbank', 3.4, -2.2, 0);
    if (testArt === 3) setz('treppe', 5, 2, 2);
    setz('lagerfeuer', -0.8, -2.8, 0);
    if (testArt === 1) { schalte(true); leiste.waehle('wand'); }   // bautest=2: nur die Hütte, ohne Bau-Modus
  }
  // schmiedetest=1: Schmiede-Ecke 6 m vor dem Spieler (zum Ansehen); =2 oder mit ?herstellen=offen: im Halbkreis ≤ 4 m um den Spieler
  // (alle Stationen in Reichweite fürs Herstellen-Fenster). Platz-Rahmen: +z = Blickrichtung, +x = LINKS vom Spieler; rot 2 = Vorderseite zum Spieler.
  function testSchmiede() {
    const nah = /[?&](schmiedetest=2|herstellen=offen)/.test(location.search), ab = nah ? 3 : 6;
    const p = welt.bodenPunkt(t1.copy(cam).addScaledVector(vorn, ab), V());
    const pl = neuerPlatz(p, p.clone().normalize(), vorn);
    const lage = nah ? [['schmelzofen', 2.05, -0.4, 2], ['amboss', 0.55, 0.2, 2], ['werkbank', -1.0, 0.1, 2], ['lagerfeuer', -2.3, -0.6, 0]]
      : [['schmelzofen', 1.9, 0.5, 2], ['amboss', 0.2, -0.4, 2], ['werkbank', -1.6, 0.3, 2], ['lagerfeuer', -2.4, -2.1, 0]];
    for (const [art, x, z, rot] of lage) setzeTeil(pl, einrasten(art, x, z, rot, pl.teile, { boden: pl.boden }));
  }

  return {
    name: 'bauen',
    update(dt) {
      zeit += dt;
      if (testT && performance.now() > testT && welt.spieler().gehen) { testT = 0; if (testArt) testHuette(); if (schmiedeTest) testSchmiede(); }
      const gehen = welt.spieler().gehen;
      leiste.zeige(modus && gehen);
      if (modus && gehen) vorschauRechnen(); else vorschau.visible = false;
      if (plaetze.length) feuerBild(dt);
    },
    aktion(was) {
      if (!modus) return null;
      if (was === 'bauen') return setzen();
      if (was === 'graben') return abreissen();
      return null;
    },
    hud() {
      if (!modus) return '';
      const k = Object.entries(TEILE[wahl].kosten).map(([id, n]) => `${n} ${gegenstandName(id)}`).join(' + ');
      return `Bauen       ${TEILE[wahl].name} (${k}) · ${vor ? (vor.ok ? '✓ passt' : vor.grund) : ''}`;
    },
    zustand() {
      return { id: naechsteId, plaetze: plaetze.map((pl) => ({ C: pl.C.toArray(), U: pl.U.toArray(), N: pl.N.toArray(), teile: pl.teile })) };
    },
    lade(z) {
      naechsteId = z?.id || 1;
      for (const d of z?.plaetze || []) {
        if (!d.teile?.length) continue;
        const pl = neuerPlatz(V().fromArray(d.C), V().fromArray(d.U), V().fromArray(d.N));
        pl.teile = d.teile.filter((t) => TEILE[t.art]);
        plaetze.push(pl); neuZeichnen(pl);
      }
    },
    dispose() {
      for (const pl of [...plaetze]) { pl.teile = []; neuZeichnen(pl); }
      for (const l of lichter) { anker.remove(l); l.dispose(); }
      for (const pk of funken) { anker.remove(pk); pk.geometry.dispose(); }
      anker.remove(vorschau); vorMat.dispose(); flammenMat.dispose(); funkenMat.dispose();
      leiste.dispose(); knopf.remove(); disposeBauteile();
      if (welt.dienste.bau === dienste) delete welt.dienste.bau;
    },
  };
}

// Kollisionskreise je Art im Teil-Rahmen: [u (x), v (z), Radius]
function kreise(art) {
  if (art === 'wand') return [-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9].map((u) => [u, 0, 0.17]);
  if (art === 'tuerwand') return [-0.95, -0.8, 0.8, 0.95].map((u) => [u, 0, 0.12]);
  if (art === 'fundament' || art === 'boden') return [[-0.5, -0.5, 0.72], [0.5, -0.5, 0.72], [-0.5, 0.5, 0.72], [0.5, 0.5, 0.72]];
  if (art === 'lagerfeuer') return [[0, 0, 0.6]];
  if (art === 'werkbank') return [[-0.4, 0, 0.42], [0.4, 0, 0.42]];
  if (art === 'eisentuer') return [-0.95, -0.8, 0.8, 0.95].map((u) => [u, 0, 0.12]);
  if (art === 'schmelzofen') return [[0, 0, 0.62]];
  if (art === 'amboss') return [[0, 0, 0.38]];
  return [];
}
