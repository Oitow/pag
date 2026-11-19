// Dämmerwald – Gelände: Höhenfunktion h(x, z) (Wasser z < 0 → Kiesstrand → ansteigender, welliger Waldboden mit Hohlweg), Netz mit Vertexfarben, stille Wasserfläche.
// Um jeden Riesen wird der Boden eingeebnet und wölbt sich dann weich an die Wurzeln (engine/world/boden-anpassung: Erdwulst + Verdeckung).
// Der Pfad ist heller eingefärbt und leicht eingeebnet.
import * as THREE from 'three';
import { createNoise2D, fbm2 } from '../../../engine/core/noise.js';
import { createBodenAnpassung } from '../../../engine/world/boden-anpassung.js';
import { HIMMEL_GLSL, himmelUniforms, DUNST_DICHTE } from './licht.js';
import { WELT, PFAD_BREITE, LICHTUNG, STAMM, RIESEN_VARIANTEN, pfadX, pfadAbstand, stammAbstand } from './plan-daten.js';

const glatt = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const misch = (a, b, t) => a + (b - a) * t;

/** So tief steht der Fuß eines Riesen unter der eingeebneten Fläche (die Wurzelunterseite steckt im Boden). */
export const RIESEN_EINSINKEN = 0.3;

/**
 * Reine Höhenfunktion. riesen: [{x, z, variante, skala, drehung}] (Einebnung um die Stämme); varianten (optional, aus wald.baueVarianten):
 * mit kollision.hoehenkarte wölbt sich der Boden an die Wurzeln. → { hoehe(x,z), grund(x,z), verdeckung(x,z), fussY[], roh(x,z), uferVersatz(x), flecken, rausch }
 */
export function createHoehe({ seed = WELT.seed, riesen = [], varianten = null } = {}) {
  const n = createNoise2D(seed), n2 = createNoise2D(seed + 77);
  const uferVersatz = (x) => 5 * n(x * 0.007, 3.3) + 0.00035 * x * x;   // Bucht: an den Seiten greift das Wasser etwas weiter ins Land
  function roh(x, z) {
    const zz = z - uferVersatz(x);
    if (zz < 0) return Math.max(-7, zz * 0.11) + 0.15 * n(x * 0.05, z * 0.05);
    const strand = 0.075 * zz;                                            // Kies: flach ansteigend
    const wald = 1.2 + (zz - 16) * 0.027;
    const amp = glatt(12, 70, zz);
    const wellen = amp * (3.4 * fbm2(n, x * 0.011, z * 0.011, 3) + 0.9 * fbm2(n2, x * 0.045, z * 0.045, 2) + 0.18 * n2(x * 0.21, z * 0.21));
    return misch(strand, wald, glatt(8, 30, zz)) + wellen;
  }
  const flecken = riesen.map((b) => { const w = RIESEN_VARIANTEN[b.variante].wurzelWeite * b.skala; return { x: b.x, z: b.z, innen: w * 0.75, aussen: w * 1.6, h: 0 }; });
  function ohneRiesen(x, z) {
    let h = roh(x, z);
    const d = pfadAbstand(x, z);
    if (d < 24 && z > 4) {
      const zp = Math.min(Math.max(z, 0), 430), amp = glatt(18, 70, z);
      const hp = roh(pfadX(zp), zp) - 0.35 * amp;                         // Pfad liegt leicht eingetieft
      h = misch(hp, h, glatt(PFAD_BREITE * 0.45, 9, d));
      h += 1.5 * amp * glatt(2.5, 8, d) * (1 - glatt(10, 24, d)) * (0.55 + 0.45 * n(z * 0.021, 9.1));   // Hohlweg-Böschung
    }
    const dl = Math.hypot(x - LICHTUNG.x, z - LICHTUNG.z);
    if (dl < LICHTUNG.radius + 14) h = misch(roh(LICHTUNG.x, LICHTUNG.z) - 0.2 + 0.25 * n(x * 0.06, z * 0.06), h, glatt(LICHTUNG.radius - 8, LICHTUNG.radius + 14, dl));
    const sa = stammAbstand(x, z);                                        // unter dem gestürzten Riesen liegt der Boden eben
    if (sa.aussen < 12 && Math.abs(sa.quer) < STAMM.radius + 12) h = misch(roh(STAMM.x, STAMM.z) - 0.35, h, Math.max(glatt(STAMM.radius * 0.5, STAMM.radius + 12, Math.abs(sa.quer)), glatt(0, 12, sa.aussen)));
    return h;
  }
  for (const f of flecken) f.h = ohneRiesen(f.x, f.z);
  function grund(x, z) {
    let h = ohneRiesen(x, z);
    for (const f of flecken) {
      const dx = x - f.x, dz = z - f.z;
      if (Math.abs(dx) > f.aussen || Math.abs(dz) > f.aussen) continue;
      const d = Math.hypot(dx, dz);
      if (d < f.aussen) h = misch(f.h, h, glatt(f.innen, f.aussen, d));
    }
    return h;
  }
  // Fuß jedes Riesen: eingeebnete Höhe − Einsinken; mit Höhenkarte zusätzlich ein Erdwulst an den Wurzeln (kein Luftspalt am Wurzelrand)
  const fussY = flecken.map((f) => f.h - RIESEN_EINSINKEN);
  const boden = createBodenAnpassung({ grundHoehe: grund });
  riesen.forEach((b, i) => {
    const karte = varianten?.[b.variante]?.kollision?.hoehenkarte;
    if (!karte) return;
    boden.fuegeFussabdruck({ x: b.x, z: b.z, y: fussY[i], drehung: b.drehung ?? 0, skala: b.skala, hoeheBei: karte.hoeheBei, radius: RIESEN_VARIANTEN[b.variante].wurzelWeite * b.skala * 1.7, ueberdeckung: 0.22 });
  });
  return { hoehe: boden.hoehe, grund, verdeckung: boden.verdeckung, fussY, roh, uferVersatz, flecken, rausch: n2 };
}

// Ungleichmäßiges Raster: fein im Spielbereich, nach außen immer gröber (ein nahtloses Netz bis in den Dunst)
function achse(von, bis, fein, aussenVon, aussenBis) {
  const a = [];
  for (let v = von; v <= bis + 1e-6; v += fein) a.push(v);
  let s = fein, v = von; const links = [];
  while (v > aussenVon) { s *= 1.35; v -= s; links.push(Math.max(v, aussenVon)); }
  s = fein; v = bis; const rechts = [];
  while (v < aussenBis) { s *= 1.35; v += s; rechts.push(Math.min(v, aussenBis)); }
  return [...links.reverse(), ...a, ...rechts];
}

const F = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const FARBE = { kies: F(0x7d7b74), kiesNass: F(0x55554f), grund: F(0x2c3531), erde: F(0x453c32), wald: F(0x2d3024), moos: F(0x3e4a27), laub: F(0x4a3b28), pfad: F(0x5c574e), pfadHell: F(0x6e685c) };
const mix3 = (a, b, t, out) => { out[0] = misch(a[0], b[0], t); out[1] = misch(a[1], b[1], t); out[2] = misch(a[2], b[2], t); return out; };

/** Bodenfarbe (linear) an einer Stelle – auch für Splat-Teppiche nutzbar. */
export function bodenFarbe(hf, x, z, h, out = [0, 0, 0]) {
  const zz = z - hf.uferVersatz(x), r = hf.rausch;
  const k = 0.5 + 0.5 * r(x * 0.09, z * 0.09), k2 = 0.5 + 0.5 * r(x * 0.33 + 5, z * 0.33);
  if (h < -0.05) return mix3(FARBE.kiesNass, FARBE.grund, glatt(0, -2.5, h), out);
  mix3(FARBE.kiesNass, FARBE.kies, glatt(0.0, 0.5, h), out);
  for (let i = 0; i < 3; i++) out[i] *= 0.82 + 0.3 * k2;
  const waldAnteil = glatt(9 + 5 * k, 24 + 8 * k, zz);
  if (waldAnteil > 0) {
    const w = mix3(FARBE.wald, FARBE.moos, glatt(0.45, 0.8, k) * 0.9, [0, 0, 0]);
    mix3(w, FARBE.laub, glatt(0.55, 0.9, k2) * 0.55, w);
    const e = mix3(FARBE.erde, w, glatt(0.25, 0.75, waldAnteil), [0, 0, 0]);
    mix3(out, e, glatt(0, 0.5, waldAnteil), out);
  }
  const d = pfadAbstand(x, z);
  if (z > 5 && z < 436 && d < PFAD_BREITE) {
    const p = mix3(FARBE.pfad, FARBE.pfadHell, k2, [0, 0, 0]);
    mix3(out, p, (1 - glatt(PFAD_BREITE * 0.3, PFAD_BREITE * (0.75 + 0.25 * k), d)) * glatt(5, 22, z) * 0.9, out);
  }
  return out;
}

/** varianten: optional (Wurzel-Höhenkarten). → { hf, mesh, wasser, bodenHoehe(x,z), fussHoehe(b,i), wasserHoehe(x,z), netzStreifen(), update(zeit), dispose() } */
export function createGelaende({ szene, riesen = [], varianten = null, seed = WELT.seed } = {}) {
  const hf = createHoehe({ seed, riesen, varianten });
  const xs = achse(-170, 170, 2.5, -900, 900), zs = achse(-30, 480, 2.5, -500, 1300);
  const nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), tmp = [0, 0, 0];
  for (let j = 0, p = 0; j < nz; j++) for (let i = 0; i < nx; i++, p += 3) {
    const x = xs[i], z = zs[j], h = hf.hoehe(x, z);
    pos[p] = x; pos[p + 1] = h; pos[p + 2] = z;
    bodenFarbe(hf, x, z, h, tmp);
    const ao = 1 - 0.62 * hf.verdeckung(x, z);                            // Verdeckung: dunkler am Wurzelansatz und Stammfuß
    col[p] = tmp[0] * ao; col[p + 1] = tmp[1] * ao; col[p + 2] = tmp[2] * ao;
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  for (let j = 0, q = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  // feine Körnung im Fragment-Shader (zwei Maßstäbe), damit der Boden nicht nach glattem Plastik aussieht
  mat.onBeforeCompile = (s) => {
    s.vertexShader = 'varying vec3 vBodenPos;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vBodenPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = `varying vec3 vBodenPos;
float bodenHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bodenRausch(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(bodenHash(i), bodenHash(i + vec2(1, 0)), f.x), mix(bodenHash(i + vec2(0, 1)), bodenHash(i + vec2(1, 1)), f.x), f.y); }
` + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  { vec2 q = vBodenPos.xz;
    float abst = length(vBodenPos - cameraPosition), fern = 1.0 - smoothstep(25.0, 90.0, abst), nah = 1.0 - smoothstep(8.0, 34.0, abst);
    float kb = bodenRausch(q * 1.7) * 0.55 + bodenRausch(q * 7.3) * 0.45;
    float gb = bodenRausch(q * 0.23);
    vec3 c = diffuseColor.rgb;
    float wald = smoothstep(0.02, 0.05, c.g - c.b * 0.6) * smoothstep(0.3, 0.12, c.r);   // nur Waldboden (nicht Kies/Pfad-Mitte)
    // Moos-Flecken (weich, ~2 m), Laub-Tupfer (~0.4 m), dunkle Erde dazwischen – alles prozedural, nach Abstand ausgeblendet
    float moos = smoothstep(0.55, 0.78, bodenRausch(q * 0.45 + 3.1) * 0.7 + bodenRausch(q * 1.9) * 0.3);
    float laub = smoothstep(0.62, 0.8, bodenRausch(q * 2.6 + 7.7)) * (1.0 - moos);
    float erde = smoothstep(0.6, 0.85, bodenRausch(q * 0.9 + 11.3)) * (1.0 - moos);
    vec3 d = mix(c, c * vec3(0.95, 1.32, 0.62), moos * 0.8);
    d = mix(d, c * vec3(1.45, 1.05, 0.62), laub * 0.55 * smoothstep(0.35, 0.75, bodenRausch(q * 9.0)));
    d = mix(d, c * vec3(0.78, 0.7, 0.62), erde * 0.6);
    c = mix(c, d, wald * fern);
    float korn = bodenRausch(q * 23.0);                                    // feinste Körnung nur ganz nah
    diffuseColor.rgb = c * mix(1.0, 0.62 + 0.7 * kb, fern) * mix(1.0, 0.85 + 0.3 * korn, nah) * (0.86 + 0.28 * gb); }`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true; mesh.name = 'gelaende';
  szene.add(mesh);

  // Stilles Wasser: dunkel, spiegelt den Dämmerhimmel (Fresnel), läuft im Dunst zum Horizont aus.
  // (engine/world/wasser-glanz ist ein Wellen-/Schaum-Hook für Gelände-Wasser – hier braucht es Spiegelung und Horizont-Dunst, daher ein kleiner eigener Shader.)
  const wasserMat = new THREE.ShaderMaterial({
    transparent: true, fog: false, toneMapped: false,
    uniforms: { ...himmelUniforms(), uZeit: { value: 0 }, uDichte: { value: DUNST_DICHTE } },   // uTief kommt mit den Himmels-Uniformen (folgt der Tageszeit)
    vertexShader: 'varying vec3 vW;\nvoid main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'varying vec3 vW;\nuniform float uZeit, uDichte;\nuniform vec3 uTief;\n' + HIMMEL_GLSL + `void main() {
  vec3 zu = vW - cameraPosition; float d = length(zu); vec3 v = zu / d;
  float nah = 1.0 - smoothstep(20.0, 140.0, d);
  vec3 n = normalize(vec3((sin(vW.x * 0.9 + uZeit * 0.5) + sin(vW.z * 1.7 - uZeit * 0.4 + vW.x * 0.6)) * 0.012 * nah, 1.0, (sin(vW.z * 1.1 + uZeit * 0.45) + sin(vW.x * 1.5 + uZeit * 0.3)) * 0.012 * nah));
  vec3 r = reflect(v, n); r.y = abs(r.y);
  float fresnel = 0.22 + 0.78 * pow(1.0 - max(-v.y, 0.0), 4.0);
  vec3 spiegel = dwHimmel(r) * 0.82;
  spiegel = mix(spiegel, vec3(0.13, 0.16, 0.15), smoothstep(0.42, 0.06, r.y) * smoothstep(-0.1, 0.35, r.z) * 0.8);   // die Baumwand spiegelt sich dunkel im stillen Wasser
  vec3 c = mix(uTief, spiegel, fresnel);
  c = mix(c, dwHimmel(normalize(vec3(v.x, 0.0, v.z))), 1.0 - exp(-uDichte * uDichte * d * d));
  gl_FragColor = vec4(c, 0.93);
}`,
  });
  const wasser = new THREE.Mesh(new THREE.PlaneGeometry(3800, 3800).rotateX(-Math.PI / 2), wasserMat);
  wasser.position.set(0, 0, -400); wasser.name = 'wasser';
  szene.add(wasser);

  return {
    hf, mesh, wasser,
    bodenHoehe: hf.hoehe,
    /** Fußhöhe des Riesen Nr. i (für wald.js – dieselbe, mit der der Wulst gebaut wurde). */
    fussHoehe: (b, i) => hf.fussY[i],
    wasserHoehe: (x, z) => (z - hf.uferVersatz(x) < 6 ? 0 : null),
    /** Schmales Netz entlang des Pfads (für Splat-Teppiche): { position, normal, index }. */
    netzStreifen({ breite = 13, schritt = 2, zVon = 8, zBis = 436 } = {}) {
      const p = [], nrm = [], ind = [], spalten = Math.round((2 * breite) / schritt) + 1;
      let zeilen = 0;
      for (let z = zVon; z <= zBis; z += schritt, zeilen++) for (let i = 0; i < spalten; i++) {
        const x = pfadX(z) - breite + i * schritt, h = hf.hoehe(x, z);
        const ex = hf.hoehe(x + 0.5, z) - hf.hoehe(x - 0.5, z), ez = hf.hoehe(x, z + 0.5) - hf.hoehe(x, z - 0.5), l = Math.hypot(ex, 1, ez);
        p.push(x, h, z); nrm.push(-ex / l, 1 / l, -ez / l);
      }
      for (let j = 0; j < zeilen - 1; j++) for (let i = 0; i < spalten - 1; i++) { const a = j * spalten + i; ind.push(a, a + spalten, a + 1, a + 1, a + spalten, a + spalten + 1); }
      return { position: new Float32Array(p), normal: new Float32Array(nrm), index: new Uint32Array(ind) };
    },
    update(zeit) { wasserMat.uniforms.uZeit.value = zeit; },
    dispose() { geo.dispose(); mat.dispose(); wasser.geometry.dispose(); wasserMat.dispose(); szene.remove(mesh, wasser); },
  };
}
