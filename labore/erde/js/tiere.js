// Tiere: Wild je Biom um den Spieler (Reh, Hase, Keiler, Wolf). Rudel je Gebiets-Zelle (deterministisch per Seed),
// nur im Umkreis AKTIV aktiv, Bewegung tangential auf der Kugel, Jagd per „Nehmen“/„Graben“ auf ein Tier.
// Regeln ohne THREE: tiere-regeln.js (Test tests/erde-tiere.test.mjs). Vertrag: erweiterungen.js.
// Testschalter: ?tiere=test (je Art ein Tier 7–15 m vor den Spieler, zahm bis getroffen), ?tiere=aus
import * as THREE from 'three';
import { createReh } from '../../../engine/models/kreaturen/reh.js';
import { createHase } from '../../../engine/models/kreaturen/hase.js';
import { createWolf } from '../../../engine/models/kreaturen/wolf.js';
import { createKeiler } from '../../../engine/models/kreaturen/keiler.js';
import { rng, hashSeed, range } from '../../../engine/core/rng.js';
import { biom } from './klima.js';
import { ARTEN, AKTIV, zellenUm, zellPunkt, wildWahl, entscheide, waffe, strahlTreffer, schlag, wiederDa, hudZeile } from './tiere-regeln.js';

const MAX = 24;            // Tiere je Modell gleichzeitig
const NEU_PROBE = 0.6;     // m Weg, bis die Bodenhöhe neu gelesen wird (stehende Tiere: nie)
const LEICHE = 25;         // s liegt ein erlegtes Tier, dann verschwindet es
const HEIM = 28;           // m – so weit wandert ein Rudel in Ruhe von seinem Platz weg
// Modelle je Art (Varianten = eigene InstancedMesh-Paare): Rehbock + Ricke
const MODELLE = {
  reh: [() => createReh({ seed: 4, bock: true }), () => createReh({ seed: 9, bock: false })],
  hase: [() => createHase({ seed: 2 })],
  keiler: [() => createKeiler({ seed: 3, fell: '#7a6551', borsten: '#4a3d31' })],
  wolf: [() => createWolf({ seed: 5 })],
};

export function createTiere(welt) {
  const schalter = new URLSearchParams(globalThis.location?.search || '').get('tiere');
  if (schalter === 'aus') {
    welt.dienste.tiere = { nahe: () => [] };
    return { name: 'tiere', update() {}, dispose() {} };
  }
  const { R, cam, planet } = welt;
  const zr = rng(hashSeed(welt.seed, 'tiere-verhalten'));   // Zufall fürs Wandern (nur über Seed)

  // ---------- Darstellung: je Modell zwei InstancedMesh (Lauf-Bild 0/1), Instanzen relativ zur Kamera ----------
  const gruppe = new THREE.Group();
  welt.anker.add(gruppe);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92 });
  const modelle = {};   // key → { meshes:[m0,m1], n:[0,0], modell }
  for (const [art, liste] of Object.entries(MODELLE)) liste.forEach((bau, v) => {
    const modell = bau();
    const meshes = modell.frames.map((geo) => {
      const m = new THREE.InstancedMesh(geo, mat, MAX);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.setColorAt(0, new THREE.Color(1, 1, 1));
      m.instanceColor.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false; m.castShadow = true; m.receiveShadow = false;   // kein Eigenschatten (Schattenkarte zu grob, Tiere würden schwarz)
      m.count = 0; m.visible = false;
      gruppe.add(m);
      return m;
    });
    modelle[art + v] = { meshes, n: [0, 0], modell };
  });

  // ---------- Zustand ----------
  const rudel = new Map();   // Zellschlüssel → { dir (Vector3), tiere: [] }
  const plaene = new Map();  // Zellschlüssel → Plan | null (Cache: Boden nur einmal je Zelle lesen)
  let tot = {};              // Tier-id → Spielstunde des Todes
  let scanT = 0, testAb = schalter === 'test' ? performance.now() + 3000 : Infinity, hudText = '', warnT = 0, zeit = 0;
  const spielStunde = () => (welt.zw?.uhr ? welt.zw.uhr.tag * 24 + welt.zw.uhr.stunde : zeit / 30);

  /** Boden an Richtung d (wird normalisiert) → Radius (m) oder null im Wasser. */
  function bodenR(d) {
    const l = d.length(), pr = planet.probe(d.x / l, d.y / l, d.z / l, 0.5);
    return pr.wasser > pr.h + 0.15 ? null : R + pr.h;
  }

  function neuesTier(art, v, id, dir, r, test = false) {
    const br = bodenR(dir);
    if (br == null) return null;
    const pos = dir.clone().setLength(br), u = dir.clone().normalize();
    const vorn = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).projectOnPlane(u).normalize();
    const a = ARTEN[art];
    return { id, art, v, a, pos, vorn, heim: pos.clone(), probeP: pos.clone(), bodenR: br, leben: a.leben, modus: 'ruhe', steig: 0,
      ruhe: 'grasen', timer: range(r, 1, 6), dreh: 0, phase: r() * 2, tempo: 0, blitz: 0, gereizt: 0, biss: 0, tot: -1,
      ton: 0.85 + r() * 0.3, skala: 0.9 + r() * 0.2, test };
  }

  function plan(ix, iy, iz) {
    const zp = zellPunkt(ix, iy, iz, R, welt.seed);
    if (!zp) return null;
    const [x, y, z] = zp.dir, pr = planet.probe(x, y, z, 0.5);
    const wahl = wildWahl(biom(pr.temp, pr.feuchte), zp.r, pr.wasser > pr.h + 0.15);
    return wahl && { dir: new THREE.Vector3(x, y, z), ...wahl, seed: hashSeed(welt.seed, 'rudel', zp.schluessel) };
  }

  const t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), tmp = new THREE.Vector3(), c = new THREE.Vector3();
  function spawne(key, p) {
    const r = rng(p.seed), jetzt = spielStunde(), tiere = [];
    t1.set(0.3, 1, 0.2).cross(p.dir).normalize(); t2.crossVectors(p.dir, t1);
    for (let i = 0; i < p.anzahl; i++) {
      const id = `${key}:${i}`, w = r() * Math.PI * 2, d = i ? range(r, 2, 9) : 0;
      const v = r() * MODELLE[p.art].length | 0;
      if (!wiederDa(tot[id], jetzt)) continue;
      const dir = p.dir.clone().addScaledVector(t1, Math.cos(w) * d / R).addScaledVector(t2, Math.sin(w) * d / R);
      const t = neuesTier(p.art, v, id, dir, r);
      if (t) tiere.push(t);
    }
    rudel.set(key, { dir: p.dir, tiere });
  }

  /** Zellen um den Spieler prüfen: neue Rudel holen, ferne entfernen (zweimal je Sekunde). */
  function scan() {
    const camH = cam.length() - R - welt.bodenHoehe(cam);
    const radius = camH < AKTIV ? Math.sqrt(AKTIV * AKTIV - Math.max(0, camH) ** 2) : -1;
    c.copy(cam).setLength(R);
    for (const [key, rd] of rudel) {
      if (key === 'test') continue;
      if (radius < 0 || tmp.copy(rd.dir).multiplyScalar(R).distanceTo(c) > radius + 30) rudel.delete(key);
    }
    if (radius < 0) return;
    for (const [ix, iy, iz] of zellenUm(c, radius)) {
      const key = `${ix},${iy},${iz}`;
      if (rudel.has(key)) continue;
      if (!plaene.has(key)) { if (plaene.size > 4000) plaene.clear(); plaene.set(key, plan(ix, iy, iz)); }
      const p = plaene.get(key);
      if (p && tmp.copy(p.dir).multiplyScalar(R).distanceTo(c) < radius) spawne(key, p);
    }
  }

  function testTiere() {
    const r = rng(hashSeed(welt.seed, 'test')), rechts = new THREE.Vector3().crossVectors(welt.vorn, welt.oben).normalize();
    const tiere = [];
    for (const [art, v, vor, seit, blick] of [['hase', 0, 6, -1, 1], ['reh', 0, 9, -4, 1], ['keiler', 0, 8, 2.5, -1], ['wolf', 0, 11, 5.5, -1], ['reh', 1, 13, 0.5, 1]]) {
      const dir = cam.clone().addScaledVector(welt.vorn, vor).addScaledVector(rechts, seit);
      const t = neuesTier(art, v, `test:${art}${v}`, dir, r, true);
      if (t) { t.vorn.copy(rechts).multiplyScalar(blick).projectOnPlane(dir.normalize()).normalize(); t.timer = 1e9; tiere.push(t); }
    }
    rudel.set('test', { dir: cam.clone().normalize(), tiere });
  }

  // ---------- Verhalten & Bewegung ----------
  const u = new THREE.Vector3(), rel = new THREE.Vector3(), wunsch = new THREE.Vector3(), seite = new THREE.Vector3();
  function bewege(t, dt, nacht, hindernisse) {
    const a = t.a;
    u.copy(t.pos).normalize();
    rel.subVectors(cam, t.pos);
    rel.addScaledVector(u, -rel.dot(u));
    const abstand = rel.length(), abstand3 = cam.distanceTo(t.pos);   // 3D: wer hoch fliegt, stört nicht
    t.gereizt = Math.max(0, t.gereizt - dt);
    t.blitz = Math.max(0, t.blitz - dt);
    const neu = t.test ? 'ruhe' : entscheide(t.art, { abstand: abstand3, nacht, gereizt: t.gereizt > 0, leben: t.leben / a.leben, modus: t.modus });
    if (neu === 'angriff' && t.modus !== 'angriff' && warnT <= 0) { welt.melde(`${a.name === 'Wolf' ? 'Wölfe greifen' : 'Ein ' + a.name + ' greift'} an!`, false); warnT = 6; }
    t.modus = neu;
    let v = 0;
    if (neu === 'fliehen' || neu === 'angriff') {
      wunsch.copy(rel).multiplyScalar(neu === 'fliehen' ? -1 : 1).normalize();
      v = a.rennen;
      if (neu === 'fliehen' && t.art === 'hase') wunsch.addScaledVector(seite.crossVectors(u, wunsch), Math.sin(zeit * 4 + t.phase) * 0.7).normalize();
      if (neu === 'angriff' && abstand < a.radius * t.skala + 1.1) {   // dran: stehen bleiben und beißen/stoßen
        v = 0; t.biss -= dt;
        if (t.biss <= 0) { t.biss = a.takt; welt.dienste.ueberleben?.schaden?.(a.schaden, a.name); }
      } else t.biss = Math.min(t.biss, 0.4);
    } else {
      t.timer -= dt;
      if (t.timer <= 0) {
        t.ruhe = t.ruhe === 'grasen' && zr() < 0.7 ? 'wandern' : 'grasen';
        t.timer = t.ruhe === 'wandern' ? 2 + zr() * 5 : 3 + zr() * 8;
        t.dreh = (zr() - 0.5) * 1.2;
      }
      if (t.ruhe === 'wandern') {
        v = a.gehen;
        wunsch.copy(t.vorn).applyAxisAngle(u, t.dreh * dt * 2);
        if (t.pos.distanceTo(t.heim) > HEIM) wunsch.subVectors(t.heim, t.pos).projectOnPlane(u).normalize();
      } else wunsch.copy(t.vorn);
    }
    // weich drehen (schnelle Tiere drehen schneller)
    t.vorn.lerp(wunsch, Math.min(1, dt * (v > 3 ? 6 : 2))).projectOnPlane(u);
    if (t.vorn.lengthSq() < 1e-6) t.vorn.copy(wunsch);
    t.vorn.normalize();
    if (v > 0) {
      t.pos.addScaledVector(t.vorn, v * dt);
      t.phase += v * dt / (a.schritt * (1 + v / 8));
    }
    // Stämmen und Felsen ausweichen (Liste gilt nur nahe beim Spieler)
    if (abstand < 60) for (const h of hindernisse) {
      tmp.set(t.pos.x - h.x, t.pos.y - h.y, t.pos.z - h.z);
      const hoch = tmp.dot(u);
      if (hoch > 6 || hoch < -3) continue;
      tmp.addScaledVector(u, -hoch);
      const d = tmp.length(), rr = h.r + a.radius * t.skala;
      if (d < rr && d > 1e-4) { t.pos.addScaledVector(tmp, (rr - d) / d); if (v > 0) t.vorn.addScaledVector(tmp, 0.5 / d).projectOnPlane(u).normalize(); }
    }
    // Boden neu lesen, wenn genug Weg zurückgelegt ist; Wasser = umkehren
    if (t.pos.distanceToSquared(t.probeP) > NEU_PROBE * NEU_PROBE) {
      const br = bodenR(t.pos);
      if (br == null) { t.pos.copy(t.probeP); t.vorn.negate(); t.timer = 0; t.steig = 0; }
      else { t.steig = THREE.MathUtils.clamp((br - t.bodenR) / NEU_PROBE, -1.5, 1.5); t.bodenR = br; t.probeP.copy(t.pos); }
    }
    // dazwischen Hang fortschreiben (Steigung der letzten Strecke), damit niemand schwebt oder einsinkt
    t.pos.setLength(t.bodenR + t.steig * t.pos.distanceTo(t.probeP));
    t.tempo = v;
    return abstand3;
  }

  // ---------- Zeichnen ----------
  const mBasis = new THREE.Matrix4(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), qSeite = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const sk = new THREE.Vector3(), px = new THREE.Vector3(), farbe = new THREE.Color();
  function zeichne(t) {
    const mo = modelle[t.art + t.v];
    const bild = t.tempo > 0.05 ? Math.floor(t.phase) & 1 : 0, mesh = mo.meshes[bild], i = mo.n[bild]++;
    if (i >= MAX) return;
    u.copy(t.pos).normalize();
    px.crossVectors(u, t.vorn);
    mBasis.makeBasis(px, u, t.vorn);
    q.setFromRotationMatrix(mBasis);
    tmp.subVectors(t.pos, cam);
    if (t.tot >= 0) {   // auf der Seite liegen, langsam einsinken
      q.multiply(qSeite);
      tmp.addScaledVector(u, mo.modell.breite * 0.45 * t.skala - Math.max(0, t.tot - LEICHE + 4) * 0.15);
    } else if (t.tempo > 0.05) {   // Hüpfen: Hase springt, andere wippen
      const f = t.phase - Math.floor(t.phase);
      tmp.addScaledVector(u, Math.sin(f * Math.PI) * (t.art === 'hase' ? 0.12 : 0.03) * Math.min(1, t.tempo / 3));
    }
    sk.setScalar(t.skala);
    m.compose(tmp, q, sk);
    mesh.setMatrixAt(i, m);
    const b = t.blitz > 0 ? t.blitz / 0.3 : 0, k = t.tot >= 0 ? 0.6 : t.ton;
    farbe.setRGB(k + b * 1.6, k + b * 0.2, k + b * 0.1);
    mesh.setColorAt(i, farbe);
  }

  // ---------- Dienst & Jagd ----------
  const alle = () => { const l = []; for (const rd of rudel.values()) for (const t of rd.tiere) l.push(t); return l; };
  welt.dienste.tiere = {
    nahe(p, r = 20) { return alle().filter((t) => t.tot < 0 && t.pos.distanceTo(p) <= r).map((t) => ({ art: t.art, pos: t.pos.clone(), leben: t.leben })); },
  };

  if (schalter === 'test') globalThis.erdeTiere = { alle, welt };   // nur zum Nachsehen im Testmodus

  function aktion(was, ziel) {
    if ((was !== 'nehmen' && was !== 'graben') || !welt.spieler().gehen) return null;
    const lebend = alle().filter((t) => t.tot < 0);
    if (!lebend.length) return null;
    const w = waffe((id) => welt.inventar.hat(id));
    const ziele = lebend.map((t) => {
      tmp.copy(t.pos).normalize().multiplyScalar(t.a.hoehe * t.skala).add(t.pos);
      return { x: tmp.x, y: tmp.y, z: tmp.z, r: t.a.radius * t.skala * 1.15 };
    });
    const hit = strahlTreffer(cam, welt.blick, ziele, w.reichweite);
    if (!hit) return null;
    if (ziel?.art === 'natur' && ziel.p && cam.distanceTo(ziel.p) < hit.t - 0.4) return null;   // Baum steht davor
    const t = lebend[hit.i], s = schlag(t.art, t.leben, w.schaden);
    t.leben = s.leben; t.blitz = 0.3; t.gereizt = 12; t.test = false;
    if (!s.tot) {
      const reaktion = t.art === 'keiler' || t.art === 'wolf' ? `${t.a.name} greift an!` : `${t.a.name} flieht`;
      return { ok: true, text: `Treffer (${w.name}) – ${reaktion}` };
    }
    t.tot = 0; t.tempo = 0; tot[t.id] = spielStunde();
    const teile = [];
    for (const [id, n] of s.beute) { const rest = welt.inventar.gib(id, n) || 0; if (n - rest > 0) teile.push(`+${n - rest} ${id[0].toUpperCase() + id.slice(1)}`); }
    return { ok: true, text: `${t.a.name} erlegt${teile.length ? ': ' + teile.join(', ') : ' – Tasche voll'}` };
  }

  function update(dt) {
    zeit += dt; warnT -= dt;
    gruppe.position.copy(cam);   // anker steht auf −cam → Instanzen relativ zur Kamera (genau auch weit weg vom Ursprung)
    // Testschalter: nach 3 s echter Zeit (Bildrate egal) und wieder, wenn der Spieler woandershin springt
    if (performance.now() > testAb && welt.spieler().gehen) {
      const rd = rudel.get('test');
      if (!rd || (rd.tiere.every((t) => t.test) && rd.tiere.every((t) => t.pos.distanceTo(cam) > 40))) testTiere();
    }
    if ((scanT -= dt) <= 0) {
      scanT = 0.5; scan();
      const zaehl = {};
      for (const t of alle()) if (t.tot < 0 && t.pos.distanceTo(cam) < 80) zaehl[t.art] = (zaehl[t.art] || 0) + 1;
      hudText = hudZeile(zaehl);
    }
    const nacht = welt.zw ? welt.zw.sonne.dot(welt.oben) < 0 : false;
    const hindernisse = welt.natur?.naheHindernisse?.() || [];
    for (const mo of Object.values(modelle)) mo.n[0] = mo.n[1] = 0;
    for (const [key, rd] of rudel) {
      for (let i = rd.tiere.length - 1; i >= 0; i--) {
        const t = rd.tiere[i];
        if (t.tot >= 0) { t.tot += dt; t.blitz = Math.max(0, t.blitz - dt); if (t.tot > LEICHE) { rd.tiere.splice(i, 1); continue; } }
        else if (bewege(t, dt, nacht, hindernisse) > AKTIV + 50) { rd.tiere.splice(i, 1); continue; }   // davongelaufen
        zeichne(t);
      }
      if (key === 'test' && !rd.tiere.length) rudel.delete(key);
    }
    for (const mo of Object.values(modelle)) mo.meshes.forEach((mesh, b) => {
      mesh.count = Math.min(MAX, mo.n[b]); mesh.visible = mesh.count > 0;
      if (mesh.visible) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
    });
  }

  return {
    name: 'tiere',
    update,
    aktion,
    hud: () => hudText,
    zustand() { const jetzt = spielStunde(), z = {}; for (const [id, s] of Object.entries(tot)) if (!wiederDa(s, jetzt) && !id.startsWith('test:')) z[id] = s; return { tot: z }; },
    lade(z) { tot = { ...(z?.tot || {}) }; },
    dispose() {
      welt.anker.remove(gruppe);
      for (const mo of Object.values(modelle)) { mo.meshes.forEach((x) => x.dispose()); mo.modell.dispose(); }
      mat.dispose(); rudel.clear(); plaene.clear();
      if (welt.dienste.tiere) delete welt.dienste.tiere;
    },
  };
}
