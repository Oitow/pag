/**
 * @modul    weather
 * @zweck    Einfaches Wetter: Regen als Linien-Partikel in einer Box um die Kamera (seedbar, wenig CPU) plus dichterer Nebel und Bewölkungswert für daynight; weiche Übergänge zwischen klar/regen/sturm
 * @api      createWeather(opts) -> {gruppe,staerke,ziel,bewoelkung,setWetter,setNebelBasis,update,dispose} ; nebelFuerWetter(nah,fern,staerke) -> {nah,fern} ; WETTER
 * @beispiel
 *   import { createWeather } from '../../engine/world/weather.js';
 *   const wetter = createWeather({ nebel: szene.fog, seed: 7 });
 *   szene.add(wetter.gruppe); wetter.setWetter('regen');
 *   wetter.update(dt, kamera); tagNacht.bewoelkung = wetter.bewoelkung;
 * @tags     welt, wetter, regen, nebel, partikel, atmosphaere
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */

import * as THREE from 'three';
import { rng } from '../core/rng.js';
import { clamp, damp } from '../core/math.js';

/** Benannte Wetterlagen: staerke 0..1 (Regenmenge, Nebel, Bewölkung). */
export const WETTER = { klar: 0, regen: 0.6, sturm: 1 };

/** Reine Rechnung: Linearnebel bei Wetterstärke 0..1 (Sturm ≈ ein Viertel der Sichtweite). */
export function nebelFuerWetter(nah, fern, staerke) {
  const s = clamp(staerke, 0, 1);
  return { nah: nah * (1 - 0.85 * s), fern: fern * (1 - 0.72 * s) };
}

/**
 * opts: anzahl (1200 Tropfen – Handy-tauglich), breite (40 m Box um die Kamera), hoehe (30 m), tempo (22 m/s),
 *       laenge (0.9 m), wind ([x,z] m/s, [2,1]), farbe (0xaabbd0), seed (1), nebel (THREE.Fog – Basiswerte werden
 *       beim Start gelesen), wechsel (Übergangsrate, 0.6/s), wetter ('klar').
 */
export function createWeather(opts = {}) {
  const N = opts.anzahl ?? 1200, B = opts.breite ?? 40, H = opts.hoehe ?? 30;
  const tempo = opts.tempo ?? 22, laenge = opts.laenge ?? 0.9, wechsel = opts.wechsel ?? 0.6;
  const wind = opts.wind ?? [2, 1];
  const zufall = rng(opts.seed ?? 1);
  const nebel = opts.nebel || null;
  const basis = { nah: nebel?.near ?? 0, fern: nebel?.far ?? 1000 };

  // Tropfen relativ zur Kamera: Position in der Box, eigener Tempo-Faktor
  const lage = new Float32Array(N * 3), faktor = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    lage[i * 3] = (zufall() - 0.5) * B; lage[i * 3 + 1] = zufall() * H; lage[i * 3 + 2] = (zufall() - 0.5) * B;
    faktor[i] = 0.8 + zufall() * 0.4;
  }
  const pos = new Float32Array(N * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setDrawRange(0, 0);
  const mat = new THREE.LineBasicMaterial({ color: opts.farbe ?? 0xaabbd0, transparent: true, opacity: 0.55, depthWrite: false, fog: true });
  const linien = new THREE.LineSegments(geo, mat);
  linien.frustumCulled = false;
  linien.name = 'regen';
  const gruppe = new THREE.Group();
  gruppe.add(linien);

  const w = {
    gruppe,
    staerke: 0, ziel: WETTER[opts.wetter] ?? 0,
    get bewoelkung() { return clamp(w.staerke * 1.2, 0, 1); },
    /** Wetterlage per Name ('klar' | 'regen' | 'sturm') oder Zahl 0..1; sofort = ohne Übergang. */
    setWetter(art, sofort = false) {
      w.ziel = typeof art === 'number' ? clamp(art, 0, 1) : (WETTER[art] ?? 0);
      if (sofort) w.staerke = w.ziel;
    },
    /** Neue Nebel-Grundwerte (z. B. nach Weltwechsel), auf die das Wetter aufschlägt. */
    setNebelBasis(nah, fern) { basis.nah = nah; basis.fern = fern; },
    update(dt, kamera) {
      w.staerke = damp(w.staerke, w.ziel, wechsel * 3, dt);
      if (Math.abs(w.staerke - w.ziel) < 1e-3) w.staerke = w.ziel;
      if (nebel) { const n = nebelFuerWetter(basis.nah, basis.fern, w.staerke); nebel.near = n.nah; nebel.far = n.fern; }
      const sichtbar = Math.floor(N * clamp(w.staerke / 0.6, 0, 1));
      linien.visible = sichtbar > 0;
      if (!sichtbar) return;
      mat.opacity = 0.35 + 0.3 * w.staerke;
      const k = kamera?.position ?? { x: 0, y: 0, z: 0 };
      const vy = tempo * (0.8 + 0.4 * w.staerke), wx = wind[0] * (0.5 + w.staerke), wz = wind[1] * (0.5 + w.staerke);
      const lx = (wx / vy) * laenge, lz = (wz / vy) * laenge;
      for (let i = 0; i < sichtbar; i++) {
        const j = i * 3;
        lage[j + 1] -= vy * faktor[i] * dt;
        lage[j] += wx * dt; lage[j + 2] += wz * dt;
        if (lage[j + 1] < 0) lage[j + 1] += H;
        // in der Box halten (Kamera wandert mit, Tropfen wickeln sich um)
        if (lage[j] > B / 2) lage[j] -= B; else if (lage[j] < -B / 2) lage[j] += B;
        if (lage[j + 2] > B / 2) lage[j + 2] -= B; else if (lage[j + 2] < -B / 2) lage[j + 2] += B;
        const x = k.x + lage[j], y = k.y - H * 0.4 + lage[j + 1], z = k.z + lage[j + 2], o = i * 6;
        pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
        pos[o + 3] = x - lx; pos[o + 4] = y + laenge; pos[o + 5] = z - lz;
      }
      geo.setDrawRange(0, sichtbar * 2);
      geo.attributes.position.needsUpdate = true;
    },
    dispose() {
      if (nebel) { nebel.near = basis.nah; nebel.far = basis.fern; }
      gruppe.removeFromParent();
      geo.dispose(); mat.dispose();
    },
  };
  w.staerke = w.ziel;
  return w;
}
