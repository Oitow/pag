/**
 * @modul    modul-riesenwald
 * @zweck    Spiel-Modul 'riesenwald': Urwald-Riesen in echter Größe (Stamm 6–12 m dick, 60–90 m hoch) entlang der Wege in Region 'daemmerwald' – Weg frei, Tor-Paar mit Astbogen, dichte Blatt-Karten-Kronen mit Kronen-Schatten, Unterwuchs am Weg; Stämme als Hindernisse; Detailstufen nach Entfernung zum Fokus
 * @api      RIESENWALD_MODUL -> api { riesen [{x,y,z,variante,skala,radius,reihe,…}], tor, imGebiet(x,z), zahlen() -> { riesen, stufen [voll,mittel,grob,fern], laubSichtbar, unterwuchs } }
 * @beispiel
 *   import { RIESENWALD_MODUL } from '../../engine/spiel/modul-riesenwald.js';
 *   const spiel = await createSpiel({ canvas, module: [WELT_MODUL, HIMMEL_MODUL, RIESENWALD_MODUL] });
 *   spiel.api('riesenwald').zahlen();
 * @tags     spiel, modul, wald, riesenbaum, urwald, laub, lod, kollision, daemmerwald
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { rng, hashSeed } from '../core/rng.js';
import { createRiesenbaum } from '../models/natur/riesenbaum.js';
import { baueForm } from '../models/natur/riesenbaum-form.js';
import { laubKarten, sammleKarten } from '../models/natur/laub-klumpen.js';
import { createLaubKarten } from '../render/laub-karten.js';
import { createNaturMaterial } from '../render/natur-material.js';
import { erzeuge as erzeugeUnterwuchs } from '../models/natur/pflanze-unterwuchs.js';
import { planeRiesenwald, wegAbstand } from '../world/riesenwald-plan.js';
import { fernRiese, astBogen, lochMaske } from './riesenwald-teile.js';

// Varianten (m): Stamm-Ø 6.4–12, Höhe 64–90; Wurzeln reichen ~3.8 Stammradien weit
const VARIANTEN = [
  { seed: 11, hoehe: 72, stammRadius: 4.2, wurzeln: 7 }, { seed: 23, hoehe: 86, stammRadius: 5.6, wurzeln: 8 },
  { seed: 37, hoehe: 64, stammRadius: 3.2, wurzeln: 6 }, { seed: 41, hoehe: 90, stammRadius: 6.0, wurzeln: 9 },
].map((v) => ({ ...v, wurzelWeite: v.stammRadius * 3.8 }));
const pause = () => new Promise((r) => setTimeout(r, 0));
let aktiv = null;

export const RIESENWALD_MODUL = {
  name: 'riesenwald', braucht: ['render', 'welt'], optional: ['himmel'],
  standard: { region: 'daemmerwald', wegBreite: 3, tiefe: 150, max: 200, unterwuchs: 1 },

  async start(ctx) {
    const render = ctx.braucht('render'), welt = ctx.braucht('welt'), himmel = ctx.optional('himmel');
    const { szene, kamera, stufe } = render, o = ctx.optionen, niedrig = stufe.name === 'niedrig';
    const seed = hashSeed('riesenwald', ctx.seed), zufall = rng(seed), t0 = globalThis.performance?.now() ?? 0;
    const boden = (x, z) => welt.bodenHoehe?.(x, z) ?? 0;

    // ---- Gebiet + Wege: Region aus der Welt, sonst Ersatz um die Lichtung (bzw. 150 m nördlich des Starts) ----
    const region = welt.regionen?.find((r) => r.id === o.region);
    let wege = (welt.wege || []).filter((w) => w?.length > 1), imGebiet, tor = welt.ort?.('tor'), lichtung = welt.ort?.('lichtung');
    if (region && wege.length) imGebiet = (x, z) => welt.region?.(x, z)?.id === o.region;
    else {
      const s = welt.startPunkt || { x: 0, z: 0 }, l = lichtung || { x: s.x, z: s.z - 150 };
      lichtung = { radius: 22, ...l };
      const lx = l.x - s.x, lz = l.z - s.z, ll = Math.hypot(lx, lz) || 1;
      tor = tor || { x: s.x + (lx / ll) * 40, z: s.z + (lz / ll) * 40 };
      if (!wege.length) wege = [[{ x: tor.x, z: tor.z }, { x: l.x, z: l.z }, { x: l.x + (lx / ll) * 140, z: l.z + (lz / ll) * 140 }]];
      imGebiet = (x, z) => Math.hypot(x - l.x, z - l.z) < 260 && ((x - s.x) * lx + (z - s.z) * lz) / ll > 30;
    }
    const frei = welt.wasserHoehe ? (x, z) => { const w = welt.wasserHoehe(x, z); return !(Number.isFinite(w) && w > boden(x, z) - 0.5); } : null;
    const planOpts = { wege, imGebiet, varianten: VARIANTEN.map((v) => ({ radius: v.stammRadius, weite: v.wurzelWeite })), seed,
      wegBreite: o.wegBreite, tor, lichtung: lichtung ? { radius: 22, ...lichtung } : null, tiefe: niedrig ? o.tiefe * 0.75 : o.tiefe, max: niedrig ? Math.round(o.max * 0.7) : o.max, frei };
    const plan = planeRiesenwald(planOpts);
    const riesen = plan.riesen, hindernisIds = [];
    await pause();

    // ---- Varianten: voll / mittel / grob (SDF-Netze) + gemeinsame Fern-Silhouette ----
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, color: 0xc6cccc, side: THREE.DoubleSide });
    const details = niedrig ? [0.45, 0.2] : [0.8, 0.45, 0.2];
    const weiten = niedrig ? [50, 120] : [55, 125, 230];       // bis hierhin gilt die Stufe, danach Fern-Silhouette bis zur Sichtweite
    const sicht = Math.min(stufe.sicht, niedrig ? 380 : 650);
    const bauten = [], meshes = [];
    for (const [nr, v] of VARIANTEN.entries()) {
      const anzahl = riesen.filter((b) => b.variante === nr).length;
      const stufen = details.map((d) => createRiesenbaum({ ...v, detail: d }));
      bauten.push(stufen);
      meshes.push(stufen.map((b, st) => {
        const m = new THREE.InstancedMesh(b.geometrie, material, Math.max(1, anzahl));
        m.castShadow = st === 0 || (!niedrig && st === 1); m.receiveShadow = true; m.frustumCulled = false; m.count = 0; m.name = `riese-${nr}-s${st}`;
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        szene.add(m);
        return m;
      }));
      await pause();
    }
    // Wurzeln dürfen nicht über den Weg wachsen: drehen (Weg in eine Wurzel-Lücke), sonst nach außen rücken
    const halbW = o.wegBreite / 2 + 0.4;
    for (const b of riesen) {
      let y = boden(b.x, b.z);
      for (let k = 0; k < 6; k++) y = Math.min(y, boden(b.x + Math.cos(k) * b.radius * 1.4, b.z + Math.sin(k) * b.radius * 1.4));
      b.y = y - 0.45;
      const hk = bauten[b.variante][0].kollision.hoehenkarte;
      if (hk && wegAbstand(wege, b.x, b.z).d < b.weite * 1.1 + halbW) {
        const pr = wegAbstand(wege, b.x, b.z), nx = b.x - pr.x, nz = b.z - pr.z, nl = Math.hypot(nx, nz) || 1;
        let bestes = null;
        for (let schub = 0; schub <= 12 && !(bestes && bestes.wert === 0); schub += 1.5) {
          const x = b.x + (nx / nl) * schub, z = b.z + (nz / nl) * schub;
          for (let k = 0; k < 16; k++) {
            const w = b.drehung + (k / 16) * Math.PI * 2, wert = wurzelUeberWeg(x, b.y, z, w, b.skala, hk);
            if (!bestes || wert < bestes.wert - 1e-6) bestes = { x, z, w, wert };
            if (wert === 0) break;
          }
        }
        b.x = bestes.x; b.z = bestes.z; b.drehung = bestes.w; b.wurzelRest = +bestes.wert.toFixed(2);
      }
      b.matrix = new THREE.Matrix4().compose(new THREE.Vector3(b.x, b.y, b.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.drehung), new THREE.Vector3(b.skala, b.skala, b.skala));
      b.hell = 0.86 + 0.26 * zufall();
      hindernisIds.push(welt.kollision?.fuege?.({ form: 'kreis', x: b.x, z: b.z, radius: b.radius * 0.96, y0: b.y - 3, hoehe: 400, daten: 'riese' }));
      welt.sperreObjekte?.(b.x, b.z, b.radius + b.weite * 0.6);
    }
    /** Summe, wie weit Wurzeln (m) über dem Boden auf dem Weg liegen – 0 = Weg frei. Weg in 0.8-m-Schritten nahe dem Baum abgetastet. */
    function wurzelUeberWeg(x, y, z, drehung, skala, hk) {
      const c = Math.cos(drehung), sn = Math.sin(drehung), reich = 30 * skala;
      let summe = 0;
      for (const weg of wege) for (let i = 1; i < weg.length; i++) {
        const a = weg[i - 1], e = weg[i], l = Math.hypot(e.x - a.x, e.z - a.z);
        if (l < 1e-6) continue;
        const rx = (e.x - a.x) / l, rz = (e.z - a.z) / l, proj = (x - a.x) * rx + (z - a.z) * rz;
        if (proj < -reich || proj > l + reich || Math.abs((x - a.x) * rz - (z - a.z) * rx) > reich) continue;
        const t0 = Math.max(0, proj - reich), t1 = Math.min(l, proj + reich);
        for (let t = t0; t <= t1; t += 0.8) for (const q of [-halbW, 0, halbW]) {
          const px = a.x + rx * t - rz * q, pz = a.z + rz * t + rx * q, dx = px - x, dz = pz - z;
          if (Math.abs(dx) > reich || Math.abs(dz) > reich) continue;
          const h = hk.hoeheBei((dx * c - dz * sn) / skala, (dx * sn + dz * c) / skala);
          if (Number.isFinite(h)) summe += Math.max(0, y + h * skala - boden(px, pz) - 0.2);
        }
      }
      return summe;
    }
    const vm = bauten[1][0].masse;
    const fernGeo = fernRiese({ hoehe: vm.hoehe, stammRadius: vm.stammRadius, kronenAb: vm.kronenAb, kronenRadius: vm.kronenRadius * 0.85 });
    const fernMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const fernMesh = new THREE.InstancedMesh(fernGeo, fernMat, Math.max(1, riesen.length));
    fernMesh.frustumCulled = false; fernMesh.count = 0; fernMesh.name = 'riese-fern';
    szene.add(fernMesh);
    const fernMatrix = riesen.map((b) => {
      const V = VARIANTEN[b.variante], sr = (V.stammRadius / vm.stammRadius) * b.skala, sh = (V.hoehe / vm.hoehe) * b.skala;
      return new THREE.Matrix4().compose(new THREE.Vector3(b.x, b.y, b.z), new THREE.Quaternion(), new THREE.Vector3(sr * 1.15, sh, sr * 1.15));
    });

    // ---- Kronen: Blatt-Karten je Zelle (150 m) → nur Zellen in Sichtweite werden gezeichnet ----
    const kronen = VARIANTEN.map((v) => baueForm({ ...v, detail: 0.45 }));
    const kartenJe = VARIANTEN.map((v, nr) => laubKarten(kronen[nr].krone, { seed: v.seed, H: v.hoehe, kronenAb: kronen[nr].masse.kronenAb, dichte: niedrig ? 0.6 : 1 }));
    const zellen = new Map(), ZELLE = 150;
    const zelleVon = (x, z) => { const k = Math.floor(x / ZELLE) + ':' + Math.floor(z / ZELLE); if (!zellen.has(k)) zellen.set(k, { x: 0, z: 0, n: 0, eintraege: [], r: 0 }); return zellen.get(k); };
    riesen.forEach((b, i) => {
      const z = zelleVon(b.x, b.z), anteil = b.reihe <= 1 ? 1 : niedrig ? 0.35 : 0.55;
      z.eintraege.push({ karten: kartenJe[b.variante], matrix: b.matrix.elements.slice(), anteil, seed: 7 + i });
      z.x += b.x; z.z += b.z; z.n++;
    });
    // Astbogen am Tor (zwei Riesen links/rechts des Wegs)
    let bogen = null;
    if (plan.tor?.links && plan.tor?.rechts) {
      const L = plan.tor.links, R = plan.tor.rechts;
      bogen = astBogen({ a: { x: L.x, y: L.y, z: L.z, r: L.radius }, b: { x: R.x, y: R.y, z: R.z, r: R.radius }, scheitel: 25, dicke: 1.7, seed });
      bogen.mesh = new THREE.Mesh(bogen.geometrie, material);
      bogen.mesh.castShadow = bogen.mesh.receiveShadow = true; bogen.mesh.name = 'riese-astbogen';
      szene.add(bogen.mesh);
      const buschel = [0.3, 0.45, 0.58, 0.72].map((t) => { const p = bogen.punkte[Math.round(t * (bogen.punkte.length - 1))]; return { m: [p[0], p[1] + 1.5, p[2]], r: 4.5 }; });
      zelleVon(L.x, L.z).eintraege.push({ karten: laubKarten({ buschel }, { seed: seed + 5, H: 30, kronenAb: L.y + 20, dichte: niedrig ? 0.5 : 0.8 }), matrix: new THREE.Matrix4().elements.slice(), anteil: 1, seed: 3 });
    }
    const lichtStart = { sonne: himmel?.lichtRichtung?.clone?.() || new THREE.Vector3(0.5, 0.35, -0.8).normalize() };
    const laubTeile = [];
    for (const z of zellen.values()) {
      if (z.n) { z.x /= z.n; z.z /= z.n; }
      for (const e of z.eintraege) { const ex = e.matrix[12], ez = e.matrix[14]; z.r = Math.max(z.r, Math.hypot(ex - z.x, ez - z.z) + 45); }
      const laub = createLaubKarten({ karten: sammleKarten(z.eintraege), sonne: lichtStart.sonne, blatt: 0.55, hoehenDunst: { ab: 45, bis: 95, max: 0.4 } });
      laub.mesh.name = 'riese-laub'; laub.mesh.visible = false;
      szene.add(laub.mesh);
      laubTeile.push({ laub, x: z.x, z: z.z, r: z.r });
      z.eintraege = null;
    }
    await pause();

    // ---- Kronen-Schatten: Laub-Klumpen als gelöcherte Ellipsoide – unsichtbar (colorWrite aus), werfen nur Schatten (Tiefen-Material mit Loch-Maske) ----
    const blobGeo = new THREE.IcosahedronGeometry(1, 1), maske = lochMaske({ seed, dicht: 0.5 });
    maske.repeat.set(3, 2);
    const blobMat = new THREE.MeshBasicMaterial({ alphaMap: maske, alphaTest: 0.5, side: THREE.BackSide, shadowSide: THREE.DoubleSide, colorWrite: false, depthWrite: false });
    const blobLokal = kronen.map((f) => [...f.krone.buschel].sort((a, b) => b.r - a.r).slice(0, 8)
      .map((b) => new THREE.Matrix4().compose(new THREE.Vector3(...b.m), new THREE.Quaternion(), new THREE.Vector3(b.r * 0.95, b.r * 0.55, b.r * 0.95))));
    const blobs = new THREE.InstancedMesh(blobGeo, blobMat, Math.max(1, riesen.length * 8));
    blobs.castShadow = true; blobs.frustumCulled = false; blobs.count = 0; blobs.renderOrder = -10; blobs.name = 'riese-kronenschatten';
    szene.add(blobs);

    // ---- Unterwuchs nah am Weg (Farn, Unterholz, Moos) ----
    const uwMat = createNaturMaterial({ wind: true, weite: niedrig ? 55 : 80 });
    uwMat.roughness = 1;
    {   // Dämmerung statt Spielzeug-Grün: entsättigen + kühl abdunkeln (Wind-Hook des Natur-Materials bleibt)
      const vorher = uwMat.onBeforeCompile, key = uwMat.customProgramCacheKey?.bind(uwMat);
      uwMat.onBeforeCompile = (sh, r) => {
        vorher?.call(uwMat, sh, r);
        sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.3, 0.6, 0.1))), diffuseColor.rgb, 0.5) * vec3(0.58, 0.64, 0.58);');
      };
      uwMat.customProgramCacheKey = () => 'rw-uw|' + (key ? key() : '');
    }
    const uwTypen = [['wedelfarn', 0.55], ['busch_unterholz', 0.2], ['moospolster', 0.25]];
    const uw = uwTypen.map(([typ]) => ({ typ, liste: [], geo: erzeugeUnterwuchs(typ, seed % 97, { detail: niedrig ? 0.5 : 1 }).geometrie }));
    const halb = o.wegBreite / 2, uwR = rng(seed + 11), schritt = niedrig ? 1.1 : 0.7;
    const imStamm = (x, z) => riesen.some((b) => Math.abs(b.x - x) < b.radius + 1 && Math.abs(b.z - z) < b.radius + 1 && Math.hypot(b.x - x, b.z - z) < b.radius + 0.6);
    for (const weg of wege) for (let i = 1; i < weg.length; i++) {
      const a = weg[i - 1], b = weg[i], l = Math.hypot(b.x - a.x, b.z - a.z), rx = (b.x - a.x) / l, rz = (b.z - a.z) / l;
      for (let s = 0; s < l; s += schritt) for (const seite of [1, -1]) {
        if (uwR() > 0.8 * o.unterwuchs) continue;
        const off = halb + 0.5 + Math.abs(uwR() + uwR() - 1) * 9, x = a.x + rx * s - rz * off * seite, z = a.z + rz * s + rx * off * seite;
        if (!imGebiet(x, z) || imStamm(x, z) || wegAbstand(wege, x, z).d < halb + 0.3) continue;
        let w = uwR(), t = 0;
        while (t < uwTypen.length - 1 && w > uwTypen[t][1]) w -= uwTypen[t++][1];
        const k = 0.7 + 0.6 * uwR();
        uw[t].liste.push({ x, z, m: new THREE.Matrix4().compose(new THREE.Vector3(x, boden(x, z) - 0.05, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), uwR() * 6.28), new THREE.Vector3(k, k, k)) });
      }
    }
    const uwMax = niedrig ? [260, 70, 110] : [700, 200, 300];
    for (const [i, u] of uw.entries()) {
      u.mesh = new THREE.InstancedMesh(u.geo, uwMat, Math.max(1, Math.min(u.liste.length, uwMax[i])));
      u.mesh.receiveShadow = true; u.mesh.castShadow = false; u.mesh.frustumCulled = false; u.mesh.count = 0; u.mesh.name = 'riese-' + u.typ;
      szene.add(u.mesh);
    }

    // ---- Auswahl nach Entfernung (nur wenn der Fokus > 5 m gewandert ist) ----
    const farbe = new THREE.Color(), stufenZahl = [0, 0, 0, 0], fx = { x: NaN, z: NaN }, mB = new THREE.Matrix4();
    let laubSichtbar = 0, uwZahl = 0, zeit = 0;
    function fokus() {
      const f = ctx.dienst('fokus'), p = typeof f === 'function' ? f() : null;
      return p && Number.isFinite(p.x) ? p : kamera.position;
    }
    // Sichtkegel (nur Gier-Winkel): Riesen/Kronen-Zellen klar hinter der Kamera fallen weg; Schatten-Körper bleiben (Schatten von hinten)
    const blick = new THREE.Vector3();
    let gier = 0, halbFov = 1;
    const imBlick = (x, z, r) => {
      const dx = x - kamera.position.x, dz = z - kamera.position.z, d = Math.hypot(dx, dz);
      if (d < r + 20) return true;
      let w = Math.atan2(dx, dz) - gier;
      w = Math.abs(Math.atan2(Math.sin(w), Math.cos(w)));
      return w < halbFov + Math.asin(Math.min(1, (r + 8) / d)) + 0.12;
    };
    function waehle(p) {
      kamera.getWorldDirection(blick); gier = Math.atan2(blick.x, blick.z);
      halbFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(kamera.fov || 60) / 2) * (kamera.aspect || 1));
      for (const st of meshes) for (const m of st) m.count = 0;
      fernMesh.count = 0; blobs.count = 0; stufenZahl.fill(0);
      for (const [i, b] of riesen.entries()) {
        const d = Math.hypot(b.x - p.x, b.z - p.z) - b.radius;
        if (d < 320 && blobs.count + 8 <= blobs.instanceMatrix.count) for (const l of blobLokal[b.variante]) blobs.setMatrixAt(blobs.count++, mB.multiplyMatrices(b.matrix, l));
        if (!imBlick(b.x, b.z, b.weite + 30)) continue;
        let st = weiten.findIndex((w) => d < w);
        if (st < 0) { if (d > sicht) continue; fernMesh.setMatrixAt(fernMesh.count, fernMatrix[i]); fernMesh.setColorAt(fernMesh.count++, farbe.setScalar(b.hell)); stufenZahl[3]++; continue; }
        const m = meshes[b.variante][st];
        m.setMatrixAt(m.count, b.matrix); m.setColorAt(m.count++, farbe.setRGB(b.hell, b.hell * 0.99, b.hell * 0.97));
        stufenZahl[st]++;
      }
      for (const m of [...meshes.flat(), fernMesh, blobs]) { m.visible = m.count > 0; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
      laubSichtbar = 0;
      for (const t of laubTeile) { t.laub.mesh.visible = Math.hypot(t.x - p.x, t.z - p.z) - t.r < (niedrig ? 230 : 320) && imBlick(t.x, t.z, t.r); laubSichtbar += t.laub.mesh.visible; }
      uwZahl = 0;
      const uwWeite = niedrig ? 55 : 80;
      for (const u of uw) {
        u.mesh.count = 0;
        for (const e of u.liste) if (Math.abs(e.x - p.x) < uwWeite && Math.abs(e.z - p.z) < uwWeite && u.mesh.count < u.mesh.instanceMatrix.count) u.mesh.setMatrixAt(u.mesh.count++, e.m);
        u.mesh.visible = u.mesh.count > 0; u.mesh.instanceMatrix.needsUpdate = true; uwZahl += u.mesh.count;
      }
    }

    const sFarbe = new THREE.Color(), uFarbe = new THREE.Color(), bFarbe = new THREE.Color();
    const api = {
      riesen, tor: plan.tor, imGebiet, wege,
      zahlen: () => ({ bauMs: api.bauMs, riesen: riesen.length, stufen: [...stufenZahl], laubSichtbar, laubZellen: laubTeile.length, unterwuchs: uwZahl, karten: laubTeile.reduce((s, t) => s + t.laub.anzahl, 0) }),
      update(dt) {
        zeit += dt;
        const p = fokus();
        kamera.getWorldDirection(blick);
        const dg = Math.atan2(blick.x, blick.z) - gier;
        if (!(Math.hypot(p.x - fx.x, p.z - fx.z) < 5) || Math.abs(Math.atan2(Math.sin(dg), Math.cos(dg))) > 0.15) { fx.x = p.x; fx.z = p.z; waehle(p); }
        // Walddunst: unter den Kronen dichter (nächster Riese)
        if (himmel) {
          let dn = Infinity;
          for (const b of riesen) { const d = Math.abs(b.x - p.x) + Math.abs(b.z - p.z); if (d < dn) dn = d; }
          himmel.dunst = THREE.MathUtils.clamp((110 - dn) / 60, 0, 1);
          const s = himmel.sonne, u = himmel.umgebung;
          sFarbe.copy(s.color).multiplyScalar(s.intensity / Math.PI);
          uFarbe.copy(u.color).multiplyScalar((u.intensity / Math.PI) * 1.15); bFarbe.copy(u.groundColor).multiplyScalar(u.intensity / Math.PI);
          for (const t of laubTeile) if (t.laub.mesh.visible) t.laub.setzeLicht({ sonne: himmel.lichtRichtung, farbe: sFarbe, umgebung: uFarbe, boden: bFarbe });
        }
        for (const t of laubTeile) if (t.laub.mesh.visible) t.laub.update(zeit);
        uwMat.update?.(zeit);
      },
      dispose() {
        for (const m of [...meshes.flat(), fernMesh, blobs, ...uw.map((u) => u.mesh)]) { szene.remove(m); m.dispose(); }
        for (const st of bauten) for (const b of st) b.dispose();
        for (const t of laubTeile) { szene.remove(t.laub.mesh); t.laub.dispose(); }
        if (bogen) { szene.remove(bogen.mesh); bogen.geometrie.dispose(); }
        for (const u of uw) u.geo.dispose();
        fernGeo.dispose(); fernMat.dispose(); material.dispose(); blobGeo.dispose(); blobMat.dispose(); maske.dispose(); uwMat.dispose();
        for (const id of hindernisIds) welt.kollision?.entferne?.(id);
      },
    };
    api.bauMs = Math.round((globalThis.performance?.now() ?? 0) - t0);
    api.update(0);
    aktiv = api;
    return api;
  },
  update(dt) { aktiv?.update(dt); },
  dispose() { aktiv?.dispose(); aktiv = null; },
};
