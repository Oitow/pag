// Vögel & Schmetterlinge: reine Stimmung, sehr billig (2 Zeichenaufrufe, < 1 k Dreiecke, keine Schatten, keine Allokation je Bild).
// - Schwärme (2–4 × 6–15 Vögel) kreisen 30–120 m über dem Boden um den Spieler; Möwen (weiß) am Meer, sonst dunkle Vögel.
//   Wenig/keine bei Nacht, Regen, Schnee, Sturm. Ein Vogel = 2 Dreiecke (Flügel), Schlag mit sin().
// - Schmetterlinge (8) flattern am Tag über Wiesen/Lichtungen 0.3–2 m über dem Boden.
// Die Netze hängen in der Szene (nicht im Anker): Eckpunkte werden relativ zur Kamera in Doppelgenauigkeit gerechnet.
// Abschalten: ?voegel=aus
import { rng, hashSeed, range } from '../../../engine/core/rng.js';
import { biom, BIOM } from './klima.js';

const SCHWAERME = 4, MAX_VOGEL = 15, FALTER = 8;
const WIESE = new Set([BIOM.GRASLAND, BIOM.STEPPE, BIOM.SAVANNE, BIOM.LAUBWALD, BIOM.MISCHWALD]);
const FALTER_FARBEN = [[1, 0.75, 0.15], [0.95, 0.35, 0.2], [0.4, 0.7, 1], [0.95, 0.95, 0.5], [0.9, 0.5, 0.9]];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function createVoegel(welt) {
  const { THREE } = welt;
  if (new URLSearchParams(globalThis.location?.search || '').get('voegel') === 'aus') {
    return { name: 'voegel', update() {}, dispose() {} };
  }
  const r = rng(hashSeed(welt.seed ?? 1, 'voegel'));
  const R = welt.R;
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true });
  function baueNetz(anzahl) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(anzahl * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(anzahl * 3), 3));
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false;
    welt.scene.add(m);
    return { m, g, pos: g.attributes.position.array, farbe: g.attributes.color.array, attr: g.attributes.position, fAttr: g.attributes.color };
  }
  const VV = 6, FV = 12; // Eckpunkte je Vogel / je Falter
  const vN = baueNetz(SCHWAERME * MAX_VOGEL * VV), fN = baueNetz(FALTER * FV);

  // Wiederverwendete Hilfsvektoren (Doppelgenauigkeit, keine Allokation im Bild)
  const T = { u: new THREE.Vector3(), e1: new THREE.Vector3(), e2: new THREE.Vector3(), f: new THREE.Vector3(), s: new THREE.Vector3(),
    p: new THREE.Vector3(), q: new THREE.Vector3(), d: new THREE.Vector3() };
  const cam = welt.cam;

  function boden(d) { // m über R an Einheitsrichtung d (Wasser zählt als Boden), wasser?
    const pr = welt.planet.probe(d.x, d.y, d.z, 2);
    return { h: Math.max(pr.h, pr.wasser), nass: pr.wasser > pr.h + 0.15, pr };
  }
  function tangente(u, out) { // zufällige Tangente zu u
    out.set(r() - 0.5, r() - 0.5, r() - 0.5).projectOnPlane(u);
    if (out.lengthSq() < 1e-6) out.set(1, 0, 0).projectOnPlane(u);
    return out.normalize();
  }
  // Punkt in Einheitsrichtung ±Versatz um die Kamera: u + tangente * (dist / R)
  function nahe(out, dist) {
    tangente(welt.oben, T.d);
    return out.copy(welt.oben).addScaledVector(T.d, dist / R).normalize();
  }

  // ---------- Schwärme ----------
  const schwaerme = [];
  for (let i = 0; i < SCHWAERME; i++) {
    const n = 6 + Math.floor(r() * (MAX_VOGEL - 5));
    schwaerme.push({
      n, sicht: 0, move: 1 - 2 * (i % 2),
      c: new THREE.Vector3(), e1: new THREE.Vector3(), e2: new THREE.Vector3(), u: new THREE.Vector3(), // Mitte (Boden), Achsen
      hBasis: 70, rad: 60, mowe: false,
      a: new Float32Array(n), rb: new Float32Array(n), hb: new Float32Array(n), ph: new Float32Array(n), sk: new Float32Array(n),
    });
  }
  function setzeSchwarm(s, i) {
    nahe(T.u, range(r, 40, 200)); // Richtung der Schwarm-Mitte
    const b = boden(T.u);
    s.u.copy(T.u);
    s.c.copy(T.u).multiplyScalar(R + b.h);
    tangente(s.u, s.e1); s.e2.crossVectors(s.u, s.e1);
    // Möwen, wenn Wasser in der Nähe (Mitte oder 150 m daneben)
    T.q.copy(s.u).addScaledVector(s.e1, 150 / R).normalize();
    s.mowe = b.nass || boden(T.q).nass;
    s.hBasis = range(r, 35, 110); s.rad = range(r, 35, 85); s.move = r() < 0.5 ? 1 : -1;
    for (let k = 0; k < s.n; k++) {
      s.a[k] = r() * 6.283; s.rb[k] = s.rad + range(r, -12, 12); s.hb[k] = range(r, -8, 8);
      s.ph[k] = r() * 6.283; s.sk[k] = range(r, 0.85, 1.25);
      const g = s.mowe ? 0.92 + r() * 0.08 : 0.05 + r() * 0.08, o = (i * MAX_VOGEL + k) * VV * 3;
      for (let v = 0; v < VV; v++) { vN.farbe[o + v * 3] = g; vN.farbe[o + v * 3 + 1] = g; vN.farbe[o + v * 3 + 2] = s.mowe ? g : g * 1.1; }
    }
    vN.fAttr.needsUpdate = true;
  }
  let erst = true;

  function updateSchwarm(s, i, dt, t, akt) {
    s.sicht += clamp(akt - s.sicht, -dt * 0.3, dt * 0.3); // weich ein-/ausblenden (Größe)
    // Flügel-Dreiecke der Vögel nach Sichtbarkeit; ganz weg → Schwarm neu setzen, wenn weit
    T.p.copy(s.c).sub(cam);
    if (T.p.length() > 380 || erst) setzeSchwarm(s, i);
    const o0 = i * MAX_VOGEL * VV * 3, sk = s.sicht * (s.mowe ? 1.5 : 1.3);
    for (let k = 0; k < MAX_VOGEL; k++) {
      const o = o0 + k * VV * 3;
      if (k >= s.n || sk < 0.02) { for (let j = 0; j < VV * 3; j++) vN.pos[o + j] = 0; continue; }
      const v = s.move * 9 / s.rb[k]; // 9 m/s Bahngeschwindigkeit (langsam, groß wirkend)
      s.a[k] += v * dt;
      const c = Math.cos(s.a[k]), sn = Math.sin(s.a[k]);
      T.p.copy(s.c).addScaledVector(s.e1, c * s.rb[k]).addScaledVector(s.e2, sn * s.rb[k])
        .addScaledVector(s.u, s.hBasis + s.hb[k] + Math.sin(t * 0.3 + s.ph[k]) * 4).sub(cam);
      T.f.copy(s.e2).multiplyScalar(c * s.move).addScaledVector(s.e1, -sn * s.move); // Flugrichtung
      T.s.crossVectors(s.u, T.f);
      const gleit = Math.sin(t * 0.25 + s.ph[k] * 2) > 0.2 ? 0.15 : 1; // Gleitphasen
      const fl = Math.sin(t * (s.mowe ? 3.2 : 5) + s.ph[k]) * 0.55 * gleit, k2 = sk * s.sk[k];
      const w = Math.cos(fl) * 0.95 * k2, hoch = Math.sin(fl) * 0.95 * k2;
      // A (vorn), B (hinten), Spitze links, Spitze rechts: zwei Dreiecke (A,B,L) (A,B,R)
      const P = vN.pos;
      for (let j = 0; j < 3; j++) {
        const pj = j === 0 ? T.p.x : j === 1 ? T.p.y : T.p.z, fj = j === 0 ? T.f.x : j === 1 ? T.f.y : T.f.z;
        const sj = j === 0 ? T.s.x : j === 1 ? T.s.y : T.s.z, uj = j === 0 ? s.u.x : j === 1 ? s.u.y : s.u.z;
        const A = pj + fj * 0.35 * k2, B = pj - fj * 0.3 * k2, tipF = -0.2 * k2 * fj + uj * hoch;
        P[o + j] = A; P[o + 3 + j] = B; P[o + 6 + j] = pj + sj * w + tipF;
        P[o + 9 + j] = A; P[o + 12 + j] = B; P[o + 15 + j] = pj - sj * w + tipF;
      }
    }
  }

  // ---------- Schmetterlinge ----------
  const fa = [];
  for (let i = 0; i < FALTER; i++) {
    fa.push({ d: new THREE.Vector3(), h: 1, gr: R, kopf: r() * 6.283, ph: r() * 6.283, an: 0, f: FALTER_FARBEN[i % FALTER_FARBEN.length], ok: false, hz: 1 });
  }
  function setzeFalter(F, i) {
    for (let versuch = 0; versuch < 4; versuch++) {
      nahe(F.d, range(r, 3, 28));
      const b = boden(F.d);
      if (!b.nass && WIESE.has(biom(b.pr.temp, b.pr.feuchte))) { F.gr = R + b.h; F.ok = true; F.hz = range(r, 0.5, 1.8); return; }
    }
    F.ok = false;
  }
  fa.forEach(setzeFalter);
  fa.forEach((F, i) => { for (let v = 0; v < FV; v++) { const o = (i * FV + v) * 3; fN.farbe[o] = F.f[0]; fN.farbe[o + 1] = F.f[1]; fN.farbe[o + 2] = F.f[2]; } });
  fN.fAttr.needsUpdate = true;
  let fIdx = 0;

  function updateFalter(F, i, dt, t, akt) {
    const o = i * FV * 3, P = fN.pos;
    if (!F.ok || akt < 0.05) { P.fill(0, o, o + FV * 3); if (akt >= 0.05 && r() < dt) setzeFalter(F, i); return; }
    F.kopf += (Math.sin(t * 1.7 + F.ph * 3) + Math.sin(t * 2.9 + F.ph)) * 2.2 * dt; // erratisch
    T.u.copy(F.d);
    tangente(T.u, T.e1); // nur als Platzhalter-Normalen, siehe unten (stabile Achsen aus Kopfwinkel)
    T.e1.crossVectors(T.u, welt.vorn).normalize(); T.e2.crossVectors(T.e1, T.u);
    T.f.copy(T.e2).multiplyScalar(Math.cos(F.kopf)).addScaledVector(T.e1, Math.sin(F.kopf));
    F.d.addScaledVector(T.f, 1.1 * dt / R).normalize();
    F.hz = clamp(F.hz + (Math.sin(t * 1.3 + F.ph * 5) * 0.8) * dt, 0.35, 2); // Höhe schwankt
    if (i === fIdx) { const b = boden(F.d); F.gr = R + b.h; if (b.nass) F.ok = false; } // ein Falter je Bild bekommt den Boden neu
    // zu weit vom Spieler → neu setzen
    T.p.copy(F.d).multiplyScalar(R).sub(cam);
    if (T.p.length() > 40) { setzeFalter(F, i); return; }
    T.p.copy(F.d).multiplyScalar(F.gr + F.hz + Math.sin(t * 6 + F.ph) * 0.15).sub(cam);
    T.s.crossVectors(F.d, T.f).normalize();
    F.an = Math.sin(t * 22 + F.ph); // Flügelschlag
    const w = 0.13 * Math.abs(F.an) + 0.03, hoch = 0.1 * F.an;
    for (let j = 0; j < 3; j++) {
      const pj = j === 0 ? T.p.x : j === 1 ? T.p.y : T.p.z, fj = j === 0 ? T.f.x : j === 1 ? T.f.y : T.f.z;
      const sj = j === 0 ? T.s.x : j === 1 ? T.s.y : T.s.z, uj = j === 0 ? F.d.x : j === 1 ? F.d.y : F.d.z;
      for (let seite = 0; seite < 2; seite++) {
        const sg = seite ? -1 : 1, b = o + seite * 18; // je Flügel: Viereck = 2 Dreiecke (6 Punkte)
        const a0 = pj - fj * 0.05, a1 = pj + fj * 0.05;
        const t0 = pj + sj * sg * w - fj * 0.1 + uj * hoch, t1 = pj + sj * sg * w + fj * 0.1 + uj * hoch;
        P[b + j] = a0; P[b + 3 + j] = a1; P[b + 6 + j] = t1;
        P[b + 9 + j] = a0; P[b + 12 + j] = t1; P[b + 15 + j] = t0;
      }
    }
  }

  let zeit = 0;
  return {
    name: 'voegel',
    update(dt) {
      dt = Math.min(dt, 0.1); zeit += dt;
      const zw = welt.zw, W = zw?.wetter || {};
      const sonne = zw?.sonne ? zw.sonne.dot(welt.oben) : 0.5;
      const tag = clamp((sonne + 0.05) * 6, 0, 1);
      const schlecht = clamp((W.regen || 0) * 2.5 + (W.schnee || 0) * 2 + Math.max(0, (W.wind || 0) - 0.7) * 3 + (W.nebel || 0) * 0.5, 0, 1);
      const akt = tag * (1 - schlecht);
      const anzahl = Math.round(SCHWAERME * (0.35 + 0.65 * akt)) * (akt > 0.1 ? 1 : 0);
      for (let i = 0; i < SCHWAERME; i++) updateSchwarm(schwaerme[i], i, dt, zeit, i < anzahl ? 1 : 0);
      erst = false;
      const faAkt = clamp((sonne - 0.15) * 4, 0, 1) * (1 - clamp(schlecht * 2, 0, 1));
      for (let i = 0; i < FALTER; i++) updateFalter(fa[i], i, dt, zeit, faAkt);
      fIdx = (fIdx + 1) % FALTER;
      vN.attr.needsUpdate = true; fN.attr.needsUpdate = true;
    },
    dispose() {
      for (const n of [vN, fN]) { welt.scene.remove(n.m); n.g.dispose(); }
      mat.dispose();
    },
  };
}
