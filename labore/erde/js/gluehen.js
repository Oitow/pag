// Glühen: Glühwürmchen (Dämmerung/Nacht, Wald und Wiese) und Funken über Lagerfeuern. Sehr billig: zwei Points-Objekte.
// Glühwürmchen: 32 weiche Punkte driften im Umkreis von 25 m, 0,5–3 m über dem Boden, jeder pulsiert für sich; aus bei Regen.
// Funken: je Lagerfeuer in 40 m ein paar aufsteigende Punkte, vom Wind getrieben. Das Licht samt Flackern liefert bauen.js
// (Dienst welt.dienste.bau.feuerPunkte) – hier kommt kein eigenes Licht dazu. Testschalter: ?gluehen=aus
// Floating Origin: Die Points-Objekte sitzen an einem absoluten Mittelpunkt C, die Punkte darin sind klein (float32-sicher).
import * as THREE from 'three';
import { biom, BIOM } from './klima.js';

const N = 32, RADIUS = 25, FEUER_MAX = 3, FUNKEN = 10, FEUER_R = 40;
const BIOME = new Set([BIOM.NADELWALD, BIOM.MISCHWALD, BIOM.LAUBWALD, BIOM.GRASLAND, BIOM.REGENWALD, BIOM.SAVANNE]);

function weicherPunkt() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), v = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  v.addColorStop(0, 'rgba(255,255,255,1)'); v.addColorStop(0.3, 'rgba(255,255,255,0.45)'); v.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = v; g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createGluehen(welt) {
  const { anker, cam, oben, zw } = welt;
  const aus = new URLSearchParams(globalThis.location?.search || '').get('gluehen') === 'aus';
  const tex = aus ? null : weicherPunkt();
  const mk = (n, size, color) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const mat = new THREE.PointsMaterial({ map: tex, size, sizeAttenuation: true, vertexColors: true, color, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });
    const pk = new THREE.Points(geo, mat); pk.frustumCulled = false; pk.visible = false; anker.add(pk); return pk;
  };
  if (aus) return { name: 'gluehen', update() {}, dispose() {} };
  const fliegen = mk(N, 0.45, 0xd8ff7a), funken = mk(FEUER_MAX * FUNKEN, 0.12, 0xffa040);

  const C = new THREE.Vector3(), ost = new THREE.Vector3(), sued = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3();
  // je Glühwürmchen: Ort rel. zu C (x, z in der Ortsebene am Start), Bodenhöhe (m über R), Höhe über Boden, Phasen
  const w = Array.from({ length: N }, (_, i) => ({ p: new THREE.Vector3(), g: 0, h: 1.5, ph: i * 1.9, fr: 0.25 + (i % 7) * 0.07, a: 0 }));
  let zeit = 0, tBiom = 0, imBiom = false, helle = 0, neuC = true, bodenI = 0;

  const boden = (p) => { t1.copy(p).normalize(); welt.bodenPunkt(t1, t2); return t2.length() - welt.R; };
  function mitteSetzen() {
    C.copy(cam); fliegen.position.copy(C); funken.position.copy(C);
    ost.crossVectors(new THREE.Vector3(0, 1, 0), oben); if (ost.lengthSq() < 1e-8) ost.set(1, 0, 0); ost.normalize();
    sued.crossVectors(ost, oben).normalize();
    for (const f of w) setzeNeu(f);
    neuC = false;
  }
  function setzeNeu(f) {
    const r = RADIUS * Math.sqrt(Math.random()), a = Math.random() * 6.2832;   // Optik, kein Spielstand: Math.random genügt
    f.p.copy(cam).addScaledVector(ost, Math.cos(a) * r).addScaledVector(sued, Math.sin(a) * r).sub(C);
    f.h = 0.5 + Math.random() * 2.5; f.ph = Math.random() * 40; f.g = NaN;
  }
  const abs = (f, out) => out.copy(f.p).add(C);

  function update(dt) {
    zeit += dt;
    const hs = zw.sonne ? zw.sonne.dot(oben) : 1;
    const nacht = THREE.MathUtils.smoothstep(-hs, -0.02, 0.14);   // ab Sonnenstand ~ −1° sichtbar, ab −8° voll (≈ 19–5 Uhr)
    const regen = Math.max(zw.wetter?.regen ?? 0, zw.wetter?.schnee ?? 0);
    tBiom -= dt;
    if (tBiom <= 0) {   // Biom nur ab und zu prüfen
      tBiom = 1.5; t1.copy(cam).normalize();
      const pr = welt.planet.probe(t1.x, t1.y, t1.z, 0.5);
      imBiom = BIOME.has(biom(pr.temp, pr.feuchte)) && !(pr.wasser > pr.h + 0.15);
    }
    const ziel = imBiom && regen < 0.1 ? nacht : 0;
    helle += (ziel - helle) * Math.min(1, dt * 0.8);
    const aktiv = helle > 0.01;
    fliegen.visible = aktiv;
    if (aktiv) {
      if (neuC || C.distanceTo(cam) > 40) mitteSetzen();
      const pos = fliegen.geometry.attributes.position, col = fliegen.geometry.attributes.color;
      for (let k = 0; k < 4; k++) { const f = w[bodenI++ % N]; if (!Number.isNaN(f.g)) f.g = boden(abs(f, t1)); }   // Bodenhöhe nachführen
      w.forEach((f, i) => {
        if (Number.isNaN(f.g)) f.g = boden(abs(f, t1));
        f.p.addScaledVector(ost, Math.sin(zeit * f.fr + f.ph) * 0.35 * dt).addScaledVector(sued, Math.cos(zeit * f.fr * 0.8 + f.ph * 1.3) * 0.35 * dt);
        abs(f, t1);
        if (t1.distanceTo(cam) > RADIUS) { setzeNeu(f); abs(f, t1); f.g = boden(t1); }
        // radial auf Boden + Höhe legen
        t1.normalize().multiplyScalar(welt.R + f.g + f.h + Math.sin(zeit * 0.5 + f.ph) * 0.3);
        f.p.copy(t1).sub(C);
        pos.setXYZ(i, f.p.x, f.p.y, f.p.z);
        // An/Aus-Pulsieren (~4–7 s), Fade am Rand des Radius
        const puls = Math.pow(Math.max(0, Math.sin(zeit * (0.6 + f.fr) + f.ph * 2.1)), 2);
        const rand = 1 - THREE.MathUtils.smoothstep(t1.distanceTo(cam), RADIUS - 6, RADIUS);
        const b = puls * rand * helle * 1.4;
        col.setXYZ(i, b, b, b);
      });
      pos.needsUpdate = col.needsUpdate = true;
    }
    // Funken über Lagerfeuern
    const feuer = welt.dienste.bau?.feuerPunkte?.(cam, FEUER_R) ?? [];
    feuer.sort((a, b) => a.distanceToSquared(cam) - b.distanceToSquared(cam));
    funken.visible = feuer.length > 0;
    if (feuer.length) {
      if (neuC || C.distanceTo(cam) > 40) mitteSetzen();
      const pos = funken.geometry.attributes.position, col = funken.geometry.attributes.color;
      const wind = (zw.wetter?.wind ?? 0) * 1.5 + 0.2, wv = zw.windWelt;
      for (let j = 0; j < FEUER_MAX * FUNKEN; j++) {
        const fp = feuer[Math.floor(j / FUNKEN)];
        if (!fp) { col.setXYZ(j, 0, 0, 0); continue; }
        const u = (zeit * (0.3 + (j % 4) * 0.07) + j * 0.618) % 1;   // Lebenslauf 0…1
        t2.copy(fp).sub(C).addScaledVector(oben, 0.5 + u * 3.2).addScaledVector(wv, u * u * wind * 2.5);
        t2.addScaledVector(ost, Math.sin(j * 2.4 + zeit * 2) * 0.25 * u).addScaledVector(sued, Math.cos(j * 1.7 + zeit * 2.3) * 0.25 * u);
        pos.setXYZ(j, t2.x, t2.y, t2.z);
        const b = (1 - u) * (0.6 + 0.4 * Math.sin(zeit * 20 + j * 3));
        col.setXYZ(j, b, b * 0.7, b * 0.35);
      }
      pos.needsUpdate = col.needsUpdate = true;
    }
  }

  return {
    name: 'gluehen', update,
    dispose() { for (const o of [fliegen, funken]) { anker.remove(o); o.geometry.dispose(); o.material.dispose(); } tex.dispose(); },
  };
}
