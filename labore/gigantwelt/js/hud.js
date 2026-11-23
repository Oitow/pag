// Gigant-Welt: Einstellungs-Panel, Qualitätsstufen, Schatten, Auto-Auflösung, Kennzahlen-Anzeige.
// createHud(K) -> { update(now), applyQuality(key), setShadows(on), HINT }
// Nutzt K: renderer, sun, U, $, isTouch, DPR, PRESETS, Q, qKey, maxPR, curPR, shadowsOn, forceRebuild, flySpeed,
//   terrain, veg, vox, himmel (lazy; erst beim Aufruf gebraucht).
import { heightAt } from './rauschen.js';

export function createHud(K) {
  const { renderer, sun, U, $, isTouch, DPR, PRESETS, pos } = K;
  let fpsAcc = 0, fpsN = 0, fps = 60, hudT = 0, resT = 0, msAvg = 16, prev = 0;

  $('bSet').onclick = () => { const p = $('panel'); p.style.display = p.style.display === 'block' ? 'none' : 'block'; };
  $('sSun').oninput = $('sAz').oninput = () => K.himmel.setSun(+$('sSun').value, +$('sAz').value);
  $('sSp').oninput = () => { K.flySpeed = +$('sSp').value; $('spV').textContent = K.flySpeed + ' m/s'; };
  $('cPol').onchange = () => { K.himmel.pollen.visible = $('cPol').checked; };

  function setShadows(on) {
    K.shadowsOn = on; renderer.shadowMap.enabled = on; sun.castShadow = on;
    for (const m of K.veg.materials) m.needsUpdate = true;
    K.terrain.markMaterials();
    $('bSh').textContent = 'Schatten: ' + (on ? 'AN' : 'AUS'); $('bSh').classList.toggle('on', on);
  }
  $('bSh').onclick = () => setShadows(!K.shadowsOn);
  function applyQuality(k) {
    K.qKey = k; K.Q = PRESETS[k];
    const Q = K.Q;
    K.maxPR = Math.min(DPR, Q.pr); K.curPR = K.maxPR; renderer.setPixelRatio(K.curPR);
    U.uTreeR.value = Q.R2; U.uGR.value = Q.GR;
    K.terrain.build(Q.N);
    if (Q.shadow) { sun.shadow.mapSize.set(Q.shadow, Q.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    setShadows(Q.shadow > 0);
    K.veg.resetLayers();
    K.vox.reset();
    $('bQ').textContent = 'Qualität: ' + Q.name;
    K.forceRebuild = true;
  }
  const QORDER = ['low', 'med', 'high'];
  $('bQ').onclick = () => applyQuality(QORDER[(QORDER.indexOf(K.qKey) + 1) % 3]);
  const HINT = isTouch ? 'Links Joystick (ganz raus = Sprint) · rechts umsehen · „Bauen“ halten' : 'WASD · Maus ziehen · Shift · Space · F Flug · Rechtsklick/E bauen · R Modus · T Form · 1–6 Material · Rad Größe';

  // pro Frame nach dem Rendern: FPS, Auto-Auflösung, Text alle 400 ms
  function update(now) {
    const ms = now - (prev || now); prev = now; msAvg += (ms - msAvg) * .05;
    fpsAcc += ms; fpsN++;
    if (now - resT > 1500) {
      fps = fpsN ? 1000 / (fpsAcc / fpsN) : 60; fpsAcc = fpsN = 0; resT = now;
      if ($('cAuto').checked) {
        if (fps < 42 && K.curPR > .5) { K.curPR = Math.max(.5, K.curPR - .1); renderer.setPixelRatio(K.curPR); }
        else if (fps > 57 && K.curPR < K.maxPR) { K.curPR = Math.min(K.maxPR, K.curPR + .05); renderer.setPixelRatio(K.curPR); }
      }
    }
    if (now - hudT > 400) {
      hudT = now;
      const Q = K.Q, stats = K.veg.stats, vstat = K.vox.refreshStats(), LEVELS = K.terrain.LEVELS;
      const inf = renderer.info.render, gh = heightAt(pos.x, pos.z);
      const k = n => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : '' + n;
      const cells = K.veg.layers.reduce((a, L) => a + L.cache.size, 0);
      $('hud').textContent =
        `FPS ${fps.toFixed(0).padStart(3)}  ${msAvg.toFixed(1)} ms  Res ${K.curPR.toFixed(2)}x\n` +
        `Draws ${inf.calls}  Dreiecke ${(inf.triangles / 1e6).toFixed(2)} M\n` +
        `Terrain ${LEVELS} Ringe · Sicht ~${(Q.N * Math.pow(2, LEVELS - 1) / 2000).toFixed(0)} km\n` +
        `Bäume L0 ${k(stats.t[0])} · L1 ${k(stats.t[1])} · L2 ${k(stats.t[2])}\n` +
        `Büsche ${k(stats.b)} · Steine ${k(stats.r)} · Gras ${k(stats.g)}\n` +
        `Zellen ${cells} (+${K.veg.pending()} offen)\n` +
        `Voxel ${vstat.chunks} Chunks · ${k(vstat.tris)} Dr. · Mesh ${vstat.ms.toFixed(1)} ms · Edits ${K.vox.OPS.length}\n` +
        `Pos ${pos.x.toFixed(0)} / ${pos.z.toFixed(0)}  Höhe ${pos.y.toFixed(0)} m (${(pos.y - Math.max(gh, 0)).toFixed(1)} ü.G.)\n` + HINT;
    }
  }
  return { update, applyQuality, setShadows, HINT };
}
