// Enklave – Atmosphäre: EIN Points-Objekt (Rauch, Funken, Glühwürmchen, Blätter/Pollen), Beschriftung der Wegweiser (EIN Mesh)
// und Ambiente-Klang (engine/audio/klang: Betten + Einzelklänge, Lautstärke nach Abstand, erst nach der ersten Eingabe).
// Tag/Nacht, Licht, Nebel und Sterne macht world/himmel in main.js; Laternen/Fenster/PointLights stadt.js. Hier: alles, was zusätzlich lebt.
import * as THREE from 'three';
import { rng } from '../../../engine/core/rng.js';
import { createKlang } from '../../../engine/audio/klang.js';

const GRENZEN = { rauch: [0, 110], funken: [110, 170], fliegen: [170, 230], blatt: [230, 330] };
const N = 330, TAGLICHT = new THREE.Color(1, 1, 1);
const klemme = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const abstand = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

const VERT = `attribute float aGroesse; attribute float aAlpha; attribute vec3 aFarbe; uniform float uSkala; varying float vA; varying vec3 vF;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(aGroesse * uSkala / max(0.1, -mv.z), 0.0, 64.0); gl_Position = projectionMatrix * mv; vA = aAlpha; vF = aFarbe; }`;
const FRAG = `varying float vA; varying vec3 vF;
void main() { float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.25, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vF, a); }`;

/** Beschriftung der Wegweiser: Text-Atlas (Canvas) + ein Mesh mit zwei Flächen je Brett (vorn mit Pfeil, hinten ohne). schilder: [{ x, y, z, winkel, text }] */
function baueSchildTexte(schilder) {
  const texte = [...new Set(schilder.flatMap((s) => [s.text, s.text.replace(/\s*[→←]\s*/g, '')]))];
  const zeilen = Math.max(1, texte.length), cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64 * zeilen;
  const g = cv.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#2a1a08';
  texte.forEach((t, i) => { let px = 40; g.font = `bold ${px}px serif`; while (g.measureText(t).width > 236 && px > 14) { px -= 2; g.font = `bold ${px}px serif`; } g.fillText(t, 128, 64 * i + 34); });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const pos = [], uv = [], idx = [], HB = 0.37, HH = 0.085, TIEF = 0.03;
  const flaeche = (s, text, seite) => {
    const k = texte.indexOf(text), sx = Math.sin(s.winkel) * seite, cx = Math.cos(s.winkel) * seite;
    const nx = -Math.cos(s.winkel) * seite, nz = Math.sin(s.winkel) * seite;   // Flächennormale (vorn: (-cos w, sin w))
    const o = pos.length / 3, v0 = (zeilen - 1 - k) / zeilen, v1 = (zeilen - k) / zeilen;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      pos.push(s.x + sx * HB * a + nx * TIEF, s.y + HH * b, s.z + cx * HB * a + nz * TIEF);
      uv.push(a < 0 ? 0 : 1, b < 0 ? v0 : v1);
    }
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  for (const s of schilder) { flaeche(s, s.text, 1); flaeche(s, s.text.replace(/\s*[→←]\s*/g, ''), -1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'schildtexte'; mesh.userData.psx = false;
  return { mesh, dispose() { geo.dispose(); mat.dispose(); tex.dispose(); } };
}

/**
 * opts: { szene, w (baueWelt), stadt (baueStadt), klangAn = true, seed = 1 }
 * → { anteil (0…1 Partikel-Anteil), update(dt, { spieler, nacht, zeit }), setKlang(an), dispose() }   [+2 Draw-Calls: Partikel, Schildtexte]
 */
export function createAtmosphaere({ szene, w, stadt, klangAn = true, seed = 1 }) {
  const r = rng(seed), zuf = (a, b) => a + (b - a) * r();
  const { adapter, plan } = w;
  const feuer = stadt.lichter.filter((l) => l.art === 'lagerfeuer'), kamine = stadt.kamine;
  const markt = plan.platz('markt'), schmiede = plan.platz('schmiede'), tal = plan.platz('lagerfeuer');

  // ---- Partikel: ein Pool, feste Bereiche je Art ----
  const pos = new Float32Array(N * 3), farbe = new Float32Array(N * 3), alpha = new Float32Array(N), groesse = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aFarbe', new THREE.BufferAttribute(farbe, 3));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1)); geo.setAttribute('aGroesse', new THREE.BufferAttribute(groesse, 1));
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, uniforms: { uSkala: { value: 600 } } });
  const punkte = new THREE.Points(geo, mat); punkte.frustumCulled = false; punkte.name = 'atmosphaere'; punkte.userData.psx = false; punkte.renderOrder = 5;
  szene.add(punkte);
  const vx = new Float32Array(N), vy = new Float32Array(N), vz = new Float32Array(N), alter = new Float32Array(N).fill(1), leben = new Float32Array(N).fill(1), phase = new Float32Array(N), basisG = new Float32Array(N), art = new Uint8Array(N);
  const weiter = { rauch: 0, funken: 0, fliegen: 0, blatt: 0 };
  const frei = (k) => { const [a, b] = GRENZEN[k]; const i = a + (weiter[k] = (weiter[k] + 1) % (b - a)); return i; };
  const setze = (i, x, y, z, f, g, l) => { pos[3 * i] = x; pos[3 * i + 1] = y; pos[3 * i + 2] = z; farbe[3 * i] = f[0]; farbe[3 * i + 1] = f[1]; farbe[3 * i + 2] = f[2]; basisG[i] = g; leben[i] = l; alter[i] = 0; phase[i] = r() * 6.28; };

  const emitter = [];   // { x, y, z, art:'kamin'|'feuer', rest }
  let emitterUhr = 0;
  let anteil = 1, funkenRest = 0;
  const tmpFarbe = [0, 0, 0];

  // ---- Klang (erst nach der ersten Eingabe) ----
  let klang = null, klangAn_ = klangAn, klangUhr = 0, pegel = { feuer: 0, wasser: 0, stadt: 0, hammer: 0 };
  const nachsteEreignis = { knistern: 0, vogel: 2, grille: 1, hammer: 1 };
  const erwecke = () => { if (!klang) { klang = createKlang({ lautstaerke: 0.55, seed }); klang.stumm = !klangAn_; } klang.entsperren(); };
  const EREIGNISSE = ['pointerdown', 'keydown', 'touchend'];
  const beiGeste = () => { erwecke(); for (const e of EREIGNISSE) removeEventListener(e, beiGeste, true); };
  for (const e of EREIGNISSE) addEventListener(e, beiGeste, true);

  function wasserAbstand(p) {
    for (const rad of [2, 5, 9, 15, 22, 30]) for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      if (adapter.wasserHoehe(p.x + Math.cos(a) * rad, p.z + Math.sin(a) * rad) != null) return rad;
    }
    return 99;
  }

  function klangUpdate(dt, p, nacht, zeit) {
    if (!klang || !klang.bereit) return;
    klang.stumm = !klangAn_;
    if (!klangAn_) return;
    if ((klangUhr -= dt) <= 0) {
      klangUhr = 0.4;
      const dF = feuer.reduce((m, f) => Math.min(m, abstand(f, p)), 99), dM = abstand(markt, p), dS = abstand(schmiede, p);
      pegel.feuer = klemme(1 - dF / 22) ** 1.5;
      pegel.wasser = klemme(1 - (wasserAbstand(p) - 2) / 28) ** 1.3;
      pegel.stadt = klemme((85 - dM) / 55) * (0.5 + 0.5 * (1 - nacht));
      pegel.hammer = nacht < 0.6 ? klemme((45 - dS) / 40) : 0;
      klang.bett('feuer', pegel.feuer); klang.bett('wasser', pegel.wasser); klang.bett('stadt', pegel.stadt);
      klang.bett('wind', 0.35 + 0.15 * Math.sin(zeit * 0.2) + klemme((p.y ?? 0) / 40) * 0.2);
    }
    const einmal = (name, minS, maxS, opt) => { if ((nachsteEreignis[name] -= dt) <= 0) { nachsteEreignis[name] = zuf(minS, maxS); klang.spiele(name, opt()); } };
    if (pegel.feuer > 0.08) einmal('knistern', 0.12, 0.6, () => ({ staerke: pegel.feuer * 0.9, tonhoehe: zuf(0.8, 1.3) }));
    const draussen = 1 - klemme((85 - abstand(markt, p)) / 55) * 0.8;
    if (nacht < 0.4) einmal('vogel', 2, 7, () => ({ staerke: 0.35 * draussen * (1 - nacht), tonhoehe: zuf(0.8, 1.4) }));
    else if (nacht > 0.5) einmal('grille', 0.7, 2.0, () => ({ staerke: 0.25 * draussen, tonhoehe: zuf(0.9, 1.1) }));
    if (pegel.hammer > 0.05) einmal('hammer', 1.2, 2.4, () => { if (r() < 0.5) klang.spiele('hammer', { staerke: pegel.hammer * 0.7, tonhoehe: 1.1, verzug: 0.4 }); return { staerke: pegel.hammer * 0.9, tonhoehe: zuf(0.9, 1.05) }; });
  }

  function aktualisiereEmitter(p) {
    emitter.length = 0;
    for (const k of kamine) if (abstand(k, p) < 110) emitter.push({ ...k, art: 'kamin', rest: r() });
    for (const f of feuer) if (abstand(f, p) < 90) emitter.push({ x: f.x, y: f.y, z: f.z, art: 'feuer', rest: r() });
  }

  return {
    punkte, schildTexte: null,
    get anteil() { return anteil; }, set anteil(v) { anteil = klemme(v); },
    setKlang(an) { klangAn_ = !!an; if (klang) klang.stumm = !klangAn_; },
    update(dt, { spieler: p, nacht = 0, zeit = 0 }) {
      if (dt > 0.25) dt = 0.25;
      const tag = 1 - nacht, wind = 0.8 + 0.4 * Math.sin(zeit * 0.3), wx = 0.6 * wind, wz = 0.25 * wind;
      mat.uniforms.uSkala.value = (globalThis.window?.enklave?.renderer?.domElement.height ?? 600) * 0.866;

      // Erzeugen
      if ((emitterUhr -= dt) <= 0) { emitterUhr = 0.5; aktualisiereEmitter(p); }
      for (const e of emitter) {
        const rate = (e.art === 'feuer' ? 3.5 : 1.4) * anteil;
        e.rest += rate * dt;
        while (e.rest >= 1) {
          e.rest -= 1;
          const g = 0.2 + 0.25 * tag, i = frei('rauch');
          tmpFarbe[0] = g * 1.0 + (e.art === 'feuer' ? 0.05 : 0); tmpFarbe[1] = g; tmpFarbe[2] = g * 0.95;
          setze(i, e.x + zuf(-0.15, 0.15), e.y + (e.art === 'feuer' ? 0.9 : 0.2), e.z + zuf(-0.15, 0.15), tmpFarbe, zuf(0.5, 0.8), zuf(3.5, 5.5));
          vx[i] = 0; vy[i] = zuf(0.9, 1.3); vz[i] = 0; art[i] = 1;
        }
      }
      if (feuer.length && abstand(feuer[0], p) < 60) {
        const f = feuer[0];
        funkenRest += 14 * anteil * dt;
        while (funkenRest >= 1) {
          funkenRest -= 1;
          const i = frei('funken'); tmpFarbe[0] = 1; tmpFarbe[1] = zuf(0.35, 0.65); tmpFarbe[2] = 0.1;
          setze(i, f.x + zuf(-0.3, 0.3), f.y - 0.2, f.z + zuf(-0.3, 0.3), tmpFarbe, zuf(0.05, 0.1), zuf(0.8, 1.8));
          vx[i] = zuf(-0.5, 0.5); vy[i] = zuf(1.2, 2.8); vz[i] = zuf(-0.5, 0.5); art[i] = 2;
        }
      }
      const imTal = abstand(tal, p) < 115, nahStadt = abstand(markt, p) < 50;
      const zielFliegen = imTal ? Math.round(60 * klemme((nacht - 0.3) / 0.4) * anteil) : 0;
      const zielBlatt = nahStadt ? 0 : Math.round(100 * klemme((tag - 0.25) / 0.4) * anteil);
      for (const [k, ziel, rad] of [['fliegen', zielFliegen, 24], ['blatt', zielBlatt, 22]]) {
        const [a, b] = GRENZEN[k]; let lebend = 0;
        for (let i = a; i < b; i++) if (alter[i] < leben[i]) lebend++;
        for (let n = 0; lebend < ziel && n < 6; n++, lebend++) {
          const i = frei(k), ang = r() * 6.283, d = Math.sqrt(r()) * rad, x = p.x + Math.cos(ang) * d, z = p.z + Math.sin(ang) * d, y0 = adapter.bodenHoehe(x, z);
          if (k === 'fliegen') {
            tmpFarbe[0] = 0.75; tmpFarbe[1] = 1; tmpFarbe[2] = 0.3;
            setze(i, x, y0 + zuf(0.4, 2.2), z, tmpFarbe, 0.12, zuf(8, 20)); art[i] = 3;
          } else {
            const pollen = r() < 0.5;
            tmpFarbe[0] = pollen ? 1 : zuf(0.45, 0.8); tmpFarbe[1] = pollen ? 0.95 : zuf(0.6, 0.75); tmpFarbe[2] = pollen ? 0.6 : 0.15;
            setze(i, x, y0 + zuf(0.8, 6), z, tmpFarbe, pollen ? 0.06 : 0.1, zuf(7, 13)); art[i] = 4;
          }
          vx[i] = pos[3 * i]; vy[i] = pos[3 * i + 1]; vz[i] = pos[3 * i + 2];   // Fliegen: Ankerpunkt
        }
      }

      // Bewegen und einfärben
      for (let i = 0; i < N; i++) {
        if (alter[i] >= leben[i]) { alpha[i] = 0; continue; }
        alter[i] += dt;
        const t = alter[i] / leben[i], ein = Math.min(1, alter[i] * 3), aus = Math.min(1, (leben[i] - alter[i]) * 1.5);
        if (art[i] === 1) {            // Rauch
          pos[3 * i] += (vx[i] + wx * (0.4 + t)) * dt; pos[3 * i + 1] += vy[i] * dt; pos[3 * i + 2] += (vz[i] + wz * (0.4 + t)) * dt;
          groesse[i] = basisG[i] * (1 + 3.5 * t); alpha[i] = 0.32 * (1 - t) * Math.min(1, t * 8);
        } else if (art[i] === 2) {     // Funken
          vy[i] -= 1.2 * dt; pos[3 * i] += vx[i] * dt; pos[3 * i + 1] += vy[i] * dt; pos[3 * i + 2] += vz[i] * dt;
          groesse[i] = basisG[i]; alpha[i] = 1 - t; farbe[3 * i + 1] *= 1 - 0.8 * dt;
        } else if (art[i] === 3) {     // Glühwürmchen: wandern um ihren Ankerpunkt, blinken
          const s = alter[i] + phase[i];
          pos[3 * i] = vx[i] + Math.sin(s * 0.7) * 1.6; pos[3 * i + 1] = vy[i] + Math.sin(s * 1.1) * 0.5; pos[3 * i + 2] = vz[i] + Math.cos(s * 0.6) * 1.6;
          const blink = 0.5 + 0.5 * Math.sin(s * 2.6); groesse[i] = basisG[i]; alpha[i] = blink * blink * ein * aus * klemme((nacht - 0.2) / 0.4);
        } else {                       // Blätter/Pollen: sinken, schaukeln, treiben mit dem Wind
          const s = alter[i] * 1.3 + phase[i];
          pos[3 * i] += (wx * 0.8 + Math.sin(s) * 0.5) * dt; pos[3 * i + 1] += (-0.2 + Math.sin(s * 1.7) * 0.15) * dt; pos[3 * i + 2] += (wz * 0.8 + Math.cos(s * 0.9) * 0.5) * dt;
          groesse[i] = basisG[i]; alpha[i] = 0.85 * ein * aus * klemme((tag - 0.15) / 0.4);
        }
      }
      geo.attributes.position.needsUpdate = geo.attributes.aAlpha.needsUpdate = geo.attributes.aGroesse.needsUpdate = geo.attributes.aFarbe.needsUpdate = true;

      // Wegweiser-Beschriftung: erst jetzt (Canvas nur im Browser), einmalig; Helligkeit folgt dem Tag
      if (!this.schildTexte && stadt.schilder.length) { this.schildTexte = baueSchildTexte(stadt.schilder); szene.add(this.schildTexte.mesh); }
      if (this.schildTexte) this.schildTexte.mesh.material.color.copy(TAGLICHT).multiplyScalar(0.3 + 0.7 * tag);

      klangUpdate(dt, p, nacht, zeit);
    },
    dispose() {
      for (const e of EREIGNISSE) removeEventListener(e, beiGeste, true);
      klang?.dispose();
      szene.remove(punkte); geo.dispose(); mat.dispose();
      if (this.schildTexte) { szene.remove(this.schildTexte.mesh); this.schildTexte.dispose(); }
    },
  };
}
