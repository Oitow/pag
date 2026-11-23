/**
 * @modul    licht-pool
 * @zweck    Wenige echte PointLights, die sich die nächsten Lichtquellen zum Fokus greifen (Lagerfeuer bevorzugt), weich ein-/ausblenden, Feuer flackert, Laternen tags aus
 * @api      createLichtPool({szene,lichter,anzahl?,reichweite?,schatten?,seed?}) -> {update(dt,fokus,nacht),anzahl,dispose()} ; waehleLichter(lichter,fokus,n,reichweite?) -> lichter[]
 * @beispiel
 *   import { createLichtPool } from '../../engine/render/licht-pool.js';
 *   const pool = createLichtPool({ szene, lichter: bau.lichter, anzahl: 4 });
 *   pool.update(dt, { x: spieler.x, z: spieler.z }, 1 - himmel.stand().tag);
 * @tags     licht, pointlight, pool, laterne, lagerfeuer, flackern, nacht
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 *
 * lichter: [{ x, y, z, farbe, staerke, art }]; art 'lagerfeuer' (immer an, bevorzugt, flackert), 'fackel' (flackert, nachts stärker), sonst Laterne/Fenster (tags aus).
 * Flackern: Sinus-Summe mit Phase aus Seed + Lichtposition, kein Math.random.
 */
import * as THREE from 'three';

const BONUS_LAGERFEUER = 400;   // m² Abzug bei der Entfernungswertung

/** Reine Auswahl: die n nächsten Lichter zum Fokus (Lagerfeuer zählen ~20 m näher); reichweite begrenzt die Entfernung. */
export function waehleLichter(lichter, fokus, n, reichweite = Infinity) {
  const r2 = reichweite * reichweite, fx = fokus?.x || 0, fz = fokus?.z || 0;
  const liste = [];
  for (const l of lichter || []) {
    const d2 = (l.x - fx) ** 2 + (l.z - fz) ** 2;
    if (d2 > r2) continue;
    liste.push({ l, wert: d2 - (l.art === 'lagerfeuer' ? BONUS_LAGERFEUER : 0) });
  }
  liste.sort((a, b) => a.wert - b.wert);
  return liste.slice(0, Math.max(0, n)).map((e) => e.l);
}

const phaseVon = (l, seed) => { const s = Math.sin(l.x * 12.9898 + l.z * 78.233 + l.y * 37.719 + seed * 4.1) * 43758.5453; return (s - Math.floor(s)) * Math.PI * 2; };
const FLACKERT = (art) => art === 'lagerfeuer' || art === 'fackel';

export function createLichtPool({ szene, lichter = [], anzahl = 4, reichweite = 16, schatten = false, seed = 1 } = {}) {
  const slots = [];
  for (let i = 0; i < anzahl; i++) {
    const pl = new THREE.PointLight(0xffc060, 0, reichweite, 1.6);
    pl.visible = false; pl.castShadow = !!schatten && i === 0;
    szene?.add(pl);
    slots.push({ pl, ziel: null, phase: 0 });
  }
  let uhr = 0, zeit = 0, erster = true;

  function verteile(fokus) {
    const nah = waehleLichter(lichter, fokus, slots.length, reichweite + 8);
    // Slots behalten ihr Licht, wenn es weiter gewählt bleibt (kein Springen); freie Slots nehmen neue
    const frei = nah.filter((l) => !slots.some((s) => s.ziel === l));
    for (const s of slots) if (s.ziel && !nah.includes(s.ziel)) s.ziel = null;
    for (const s of slots) {
      if (s.ziel || !frei.length) continue;
      const l = frei.shift(); s.ziel = l; s.phase = phaseVon(l, seed);
      s.pl.position.set(l.x, l.y, l.z); s.pl.color.set(l.farbe || '#ffc060');
    }
  }

  return {
    anzahl,
    update(dt, fokus, nacht = 0) {
      zeit += dt; uhr -= dt;
      if (uhr <= 0 || erster) { uhr = 0.4; erster = false; verteile(fokus); }
      const k = Math.min(1, dt * 3);
      for (const s of slots) {
        const l = s.ziel, art = l?.art;
        let ziel = 0;
        if (l) {
          const grund = Math.min(36, (l.staerke || 1) * 14);
          const tag = art === 'lagerfeuer' ? 1 : art === 'fackel' ? 0.4 + 0.6 * nacht : nacht;
          ziel = grund * tag;
          if (FLACKERT(art)) ziel *= 1 + 0.1 * Math.sin(zeit * 9 + s.phase) + 0.06 * Math.sin(zeit * 17.3 + s.phase * 2.1) + 0.04 * Math.sin(zeit * 31 + s.phase * 0.7);
        }
        s.pl.intensity += (ziel - s.pl.intensity) * k;
        if (!l && s.pl.intensity < 0.02) s.pl.intensity = 0;
        s.pl.visible = s.pl.intensity > 0.01 || ziel > 0.01;
      }
    },
    dispose() { for (const s of slots) { szene?.remove(s.pl); s.pl.dispose?.(); } slots.length = 0; },
  };
}
