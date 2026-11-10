/**
 * @modul    zauber-effekte
 * @zweck    Leichte Zauber-Effekte fürs Handy: ein Partikel-Points-Objekt (Funken, Schweife), leuchtende Geschoss-Kugeln, Schockwellen-Ringe, Blitze, Erdstacheln, Schutz-Aura, Meteor-Sturz – alles aus Pools
 * @api      createZauberEffekte(opts) -> { gruppe, update(dt,{hoehePx}?), funken(pos,opts), kugel(id,pos,opts), entferneKugel(id), ring(pos,opts), blitz(punkte,opts), stacheln(pos,opts), aura(id,posFn,opts), entferneAura(id), sturz(pos,opts), aktiv, dispose() }
 * @beispiel
 *   import { createZauberEffekte } from '../../engine/render/zauber-effekte.js';
 *   const fx = createZauberEffekte({ seed: 3 }); szene.add(fx.gruppe);
 *   fx.kugel(g.id, g, { farbe: 0xff7a2a });                       // pro Frame: Geschoss mitführen (zieht einen Schweif)
 *   fx.entferneKugel(g.id); fx.funken(pos, { farbe: 0xff7a2a, anzahl: 40, tempo: 6 }); fx.ring(pos, { radius: 2.6 });
 *   fx.blitz([hand, ziel1, ziel2]); fx.aura('schild', () => figur.zustand.pos, { dauer: 8 });
 *   fx.update(dt, { hoehePx: renderer.domElement.height });
 * @tags     zauber, magie, effekt, partikel, funken, blitz, schockwelle, shader, vfx
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { rng } from '../core/rng.js';

const VERT = `
attribute vec3 aFarbe; attribute float aGroesse; attribute float aLeben;
uniform float uSkala; varying vec3 vFarbe; varying float vLeben;
void main() {
  vFarbe = aFarbe; vLeben = aLeben;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aGroesse * (0.35 + 0.65 * aLeben) * uSkala / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
varying vec3 vFarbe; varying float vLeben;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, d);
  gl_FragColor = vec4(vFarbe * (0.6 + 0.9 * a * a), a * a * min(1.0, vLeben * 2.5));
  if (gl_FragColor.a < 0.01) discard;
}`;

/** opts: { maxPartikel = 700, seed = 1 }. Positionen sind {x,y,z} in Weltkoordinaten. */
export function createZauberEffekte({ maxPartikel = 700, seed = 1 } = {}) {
  const r = rng(seed), zuf = (a, b) => a + (b - a) * r();
  const gruppe = new THREE.Group();
  gruppe.name = 'zauber-effekte';
  const N = maxPartikel, farbe = new THREE.Color();

  // ---- Partikel (CPU-Simulation, ein Draw-Call) ----
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), gr = new Float32Array(N), leb = new Float32Array(N);
  const vel = new Float32Array(N * 3), dauer = new Float32Array(N), rest = new Float32Array(N), zug = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aFarbe', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aGroesse', new THREE.BufferAttribute(gr, 1));
  geo.setAttribute('aLeben', new THREE.BufferAttribute(leb, 1));
  const pMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uSkala: { value: 600 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const punkte = new THREE.Points(geo, pMat);
  punkte.frustumCulled = false;
  gruppe.add(punkte);
  let zeiger = 0, lebendig = 0;

  /** Funken-Stoß. opts: { farbe, anzahl = 12, tempo = 3, dauer = 0.6, groesse = 0.5, schwerkraft = 4 (+ = fällt, − = steigt), streuung = 0.1 (Startradius), richtung {x,y,z} (optional, Hauptrichtung), hoch = 0 (zusätzliches Tempo nach oben) } */
  function funken(p, { farbe: f = 0xffffff, anzahl = 12, tempo = 3, dauer: d = 0.6, groesse = 0.5, schwerkraft = 4, streuung = 0.1, richtung = null, hoch = 0 } = {}) {
    farbe.set(f);
    for (let n = 0; n < anzahl; n++) {
      const i = zeiger; zeiger = (zeiger + 1) % N;
      // Zufallsrichtung auf der Kugel
      const u = zuf(-1, 1), w = zuf(0, Math.PI * 2), s = Math.sqrt(1 - u * u), t = tempo * zuf(0.35, 1);
      let dx = s * Math.cos(w), dy = u, dz = s * Math.sin(w);
      pos[i * 3] = p.x + dx * streuung; pos[i * 3 + 1] = p.y + dy * streuung; pos[i * 3 + 2] = p.z + dz * streuung;
      if (richtung) { dx = dx * 0.35 + richtung.x; dy = dy * 0.35 + (richtung.y || 0); dz = dz * 0.35 + richtung.z; }
      vel[i * 3] = dx * t; vel[i * 3 + 1] = dy * t + hoch; vel[i * 3 + 2] = dz * t;
      const h = zuf(0.75, 1.15);
      col[i * 3] = farbe.r * h; col[i * 3 + 1] = farbe.g * h; col[i * 3 + 2] = farbe.b * h;
      gr[i] = groesse * zuf(0.6, 1.3); dauer[i] = rest[i] = d * zuf(0.6, 1.2); zug[i] = schwerkraft; leb[i] = 1;
    }
  }
  function partikelUpdate(dt) {
    lebendig = 0;
    for (let i = 0; i < N; i++) {
      if (rest[i] <= 0) continue;
      rest[i] -= dt;
      if (rest[i] <= 0) { leb[i] = 0; gr[i] = 0; continue; }
      lebendig++;
      const b = Math.max(0, 1 - 1.6 * dt);
      vel[i * 3] *= b; vel[i * 3 + 2] *= b; vel[i * 3 + 1] = vel[i * 3 + 1] * b - zug[i] * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      leb[i] = rest[i] / dauer[i];
    }
    for (const n of ['position', 'aFarbe', 'aGroesse', 'aLeben']) geo.attributes[n].needsUpdate = true;
  }

  // ---- Mesh-Effekte: gemeinsame Geometrien, Material je Effekt (Farbe/Deckkraft) ----
  const G = {
    kugel: new THREE.IcosahedronGeometry(1, 1), ring: new THREE.RingGeometry(0.82, 1, 40), scheibe: new THREE.CircleGeometry(1, 32),
    stachel: new THREE.ConeGeometry(0.5, 1, 5), aura: new THREE.IcosahedronGeometry(1, 2),
  };
  G.stachel.translate(0, 0.5, 0);
  G.ring.rotateX(-Math.PI / 2); G.scheibe.rotateX(-Math.PI / 2);
  const glueh = (f, deck = 1) => new THREE.MeshBasicMaterial({ color: f, transparent: true, opacity: deck, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const kugeln = new Map(), auren = new Map(), zeitlich = [];   // zeitlich: { obj, t, dauer, tick(u, dt), ende? }
  const weg = (obj) => { obj.removeFromParent(); obj.traverse?.((o) => o.material?.dispose?.()); };
  const dazu = (obj, d, tick, ende) => { gruppe.add(obj); zeitlich.push({ obj, t: 0, dauer: d, tick, ende }); tick(0, 0); return obj; };

  /** Geschoss mitführen (pro Frame aufrufen): opts { farbe, groesse = 0.22, schweif = true }. */
  function kugel(id, p, { farbe: f = 0xffffff, groesse = 0.22, schweif = true } = {}) {
    let k = kugeln.get(id);
    if (!k) {
      const m = new THREE.Mesh(G.kugel, glueh(f, 0.9));
      const kern = new THREE.Mesh(G.kugel, glueh(0xffffff, 0.95));
      kern.scale.setScalar(0.55); m.add(kern);
      gruppe.add(m);
      k = { m, f, groesse, schweif, t: 0 };
      kugeln.set(id, k);
    }
    k.m.position.set(p.x, p.y, p.z);
    k.letzte = 0;
    return k.m;
  }
  function entferneKugel(id) { const k = kugeln.get(id); if (k) { weg(k.m); kugeln.delete(id); } }

  /** Schockwelle am Boden: opts { farbe, radius = 2, dauer = 0.5, wachsen = true (false = steht als Ansage-Kreis und pulsiert) }. */
  function ring(p, { farbe: f = 0xffffff, radius = 2, dauer: d = 0.5, wachsen = true } = {}) {
    const g = new THREE.Group(), rm = new THREE.Mesh(G.ring, glueh(f, 0.9)), sm = new THREE.Mesh(G.scheibe, glueh(f, 0.25));
    g.add(rm, sm);
    g.position.set(p.x, p.y + 0.06, p.z);
    return dazu(g, d, (u) => {
      g.scale.setScalar(Math.max(0.01, wachsen ? radius * (1 - (1 - u) ** 3) : radius * (0.92 + 0.08 * Math.sin(u * d * 14))));
      rm.material.opacity = wachsen ? 0.9 * (1 - u) : 0.5 + 0.4 * u;
      sm.material.opacity = wachsen ? 0.3 * (1 - u) ** 2 : 0.08 + 0.2 * u;
    });
  }

  /** Blitz durch die Punkte: opts { farbe, dauer = 0.28, zacken = 0.35 (m) }. Zuckt alle 0.05 s neu. */
  function blitz(pkt, { farbe: f = 0xfff27a, dauer: d = 0.28, zacken = 0.35 } = {}) {
    if (!pkt || pkt.length < 2) return null;
    const STR = 3, TEILE = 7, n = (pkt.length - 1) * TEILE * STR * 2;
    const lp = new Float32Array(n * 3), lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    const linie = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: f, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    linie.frustumCulled = false;
    const neu = () => {
      let o = 0;
      for (let s = 0; s < STR; s++) for (let i = 0; i < pkt.length - 1; i++) {
        const a = pkt[i], b = pkt[i + 1];
        let px = a.x, py = a.y, pz = a.z;
        for (let k = 1; k <= TEILE; k++) {
          const u = k / TEILE, j = k === TEILE ? 0 : zacken;
          const qx = a.x + (b.x - a.x) * u + zuf(-j, j), qy = a.y + (b.y - a.y) * u + zuf(-j, j), qz = a.z + (b.z - a.z) * u + zuf(-j, j);
          lp[o++] = px; lp[o++] = py; lp[o++] = pz; lp[o++] = qx; lp[o++] = qy; lp[o++] = qz;
          px = qx; py = qy; pz = qz;
        }
      }
      lg.attributes.position.needsUpdate = true;
    };
    neu();
    let takt = 0;
    for (let i = 1; i < pkt.length; i++) funken(pkt[i], { farbe: f, anzahl: 14, tempo: 4, dauer: 0.4, groesse: 0.45 });
    return dazu(linie, d, (u, dt) => { if ((takt += dt) > 0.05) { takt = 0; neu(); } linie.material.opacity = 1 - u * u; }, () => lg.dispose());
  }

  /** Erdstacheln im Kreis: opts { farbe, radius = 2, anzahl = 9, dauer = 1.6, hoehe = 1.5 }. */
  function stacheln(p, { farbe: f = 0xb08a5a, radius = 2, anzahl = 9, dauer: d = 1.6, hoehe = 1.5 } = {}) {
    const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: f, flatShading: true, roughness: 0.9 });
    for (let i = 0; i < anzahl; i++) {
      const m = new THREE.Mesh(G.stachel, mat), a = (i / anzahl) * Math.PI * 2 + zuf(-0.3, 0.3), e = i === 0 ? 0 : radius * zuf(0.3, 0.9);
      m.position.set(Math.cos(a) * e, -0.05, Math.sin(a) * e);
      m.rotation.set(zuf(-0.3, 0.3) + Math.sin(a) * 0.25, zuf(0, 6), zuf(-0.3, 0.3) - Math.cos(a) * 0.25);
      const s = zuf(0.5, 1) * (i === 0 ? 1.3 : 1);
      m.scale.set(s * 0.55, hoehe * s, s * 0.55);
      m.castShadow = true;
      g.add(m);
    }
    g.position.set(p.x, p.y, p.z);
    funken(p, { farbe: f, anzahl: 26, tempo: 4, dauer: 0.7, groesse: 0.5, hoch: 3, streuung: radius * 0.5 });
    return dazu(g, d, (u) => { g.scale.y = Math.max(0.001, Math.min(1, u * d / 0.12, (1 - u) * d / 0.35)); });
  }

  /** Schutz-Aura, die posFn() folgt: opts { farbe, radius = 1.1, dauer = 8, hoehe = 0.9 }. Gleiches id ersetzt. */
  function aura(id, posFn, { farbe: f = 0x7ab8ff, radius = 1.1, dauer: d = 8, hoehe = 0.9 } = {}) {
    entferneAura(id);
    const m = new THREE.Mesh(G.aura, glueh(f, 0.22));
    m.material.side = THREE.FrontSide;
    gruppe.add(m);
    auren.set(id, { m, posFn, radius, hoehe, t: 0, dauer: d, f });
    return m;
  }
  function entferneAura(id) { const a = auren.get(id); if (a) { weg(a.m); auren.delete(id); } }

  /** Meteor: Kugel stürzt in dauer s schräg von oben auf pos. opts { farbe, hoehe = 22, dauer = 1.3, groesse = 0.9 }. */
  function sturz(p, { farbe: f = 0xff4a1a, hoehe = 22, dauer: d = 1.3, groesse = 0.9 } = {}) {
    const m = new THREE.Mesh(G.kugel, glueh(f, 0.95)), kern = new THREE.Mesh(G.kugel, glueh(0xffe8a0, 1));
    kern.scale.setScalar(0.6); m.add(kern); m.scale.setScalar(groesse);
    return dazu(m, d, (u) => {
      const k = 1 - u * u;
      m.position.set(p.x + hoehe * 0.35 * k, p.y + hoehe * k, p.z + hoehe * 0.2 * k);
      funken(m.position, { farbe: f, anzahl: 3, tempo: 1.2, dauer: 0.7, groesse: groesse * 1.6, schwerkraft: -1, streuung: groesse * 0.4 });
    });
  }

  return {
    gruppe, funken, kugel, entferneKugel, ring, blitz, stacheln, aura, entferneAura, sturz,
    /** Anzahl lebender Partikel + laufender Mesh-Effekte (für Tests/Debug). */
    get aktiv() { return lebendig + zeitlich.length + kugeln.size + auren.size; },
    update(dt, { hoehePx } = {}) {
      if (hoehePx > 0) pMat.uniforms.uSkala.value = hoehePx;
      for (const k of kugeln.values()) {
        k.t += dt;
        k.m.scale.setScalar(k.groesse * (1 + 0.15 * Math.sin(k.t * 30)));
        if (k.schweif) funken(k.m.position, { farbe: k.f, anzahl: 2, tempo: 0.8, dauer: 0.45, groesse: k.groesse * 2.2, schwerkraft: -0.5, streuung: k.groesse * 0.5 });
      }
      for (const [id, a] of auren) {
        a.t += dt;
        if (a.t >= a.dauer) { entferneAura(id); continue; }
        const p = a.posFn?.();
        if (p) a.m.position.set(p.x, p.y + a.hoehe, p.z);
        const ein = Math.min(1, a.t / 0.25, (a.dauer - a.t) / 0.5);
        a.m.scale.setScalar(a.radius * (0.9 + 0.1 * ein) * (1 + 0.03 * Math.sin(a.t * 6)));
        a.m.rotation.y = a.t * 0.8;
        a.m.material.opacity = 0.2 * ein * (a.dauer - a.t < 1.5 ? 0.6 + 0.4 * Math.sin(a.t * 18) : 1);
      }
      for (let i = zeitlich.length - 1; i >= 0; i--) {
        const z = zeitlich[i];
        z.t += dt;
        if (z.t >= z.dauer) { weg(z.obj); z.ende?.(); zeitlich.splice(i, 1); continue; }
        z.tick(z.t / z.dauer, dt);
      }
      partikelUpdate(dt);
    },
    dispose() {
      for (const id of [...kugeln.keys()]) entferneKugel(id);
      for (const id of [...auren.keys()]) entferneAura(id);
      for (const z of zeitlich) { weg(z.obj); z.ende?.(); }
      zeitlich.length = 0;
      for (const g of Object.values(G)) g.dispose();
      geo.dispose(); pMat.dispose(); gruppe.removeFromParent();
    },
  };
}
