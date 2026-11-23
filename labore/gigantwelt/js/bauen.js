// Gigant-Welt: Bau-Leiste (Modus/Form/Material/Größe), Ziel-Raycast + Vorschau, Fällen, Demo-Bauwerk.
// createBauen(K) -> { update(now) } (pro Frame: Ziel suchen, Vorschau setzen, bei gedrücktem Bauen ausführen).
// Nutzt K: renderer, camera, scene, pos, $, fly, yaw, look, vox (raycast/applyEdits/PAL/VS), veg (treeL/fellTree).
import * as THREE from 'three';
import { heightAt } from './welt.js';
import { key } from './vegetation.js';

export function createBauen(K) {
  const { renderer, camera, scene, pos, $ } = K;
  const el = renderer.domElement;
  const MATS = [[2, 'Erde'], [7, 'Gras'], [3, 'Stein'], [4, 'Sand'], [5, 'Lehm'], [6, 'Holz']];
  let bMode = 0, bShape = 0, bMat = 2, bSize = 1.6, acting = false, lastAct = 0, buildOn = true;
  $('mats').innerHTML = MATS.map(([id, n]) => `<div class="t${id === bMat ? ' on' : ''}" data-mat="${id}"><i style="background:rgb(${K.vox.PAL[id].map(v => v * 255 | 0)})"></i>${n}</div>`).join('');
  $('mats').onclick = e => { const t = e.target.closest('[data-mat]'); if (!t) return; bMat = +t.dataset.mat; for (const c of $('mats').children) c.classList.toggle('on', c === t); };
  for (const t of document.querySelectorAll('[data-m]')) t.onclick = () => setMode(+t.dataset.m);
  function setMode(m) { bMode = m; for (const t of document.querySelectorAll('[data-m]')) t.classList.toggle('on', +t.dataset.m === m); preview.material.color.set([0xff6050, 0x70ff70, 0xffd040, 0xff9030][m]); }
  $('tShape').onclick = () => { bShape ^= 1; $('tShape').textContent = bShape ? 'Würfel' : 'Kugel'; preview.geometry = bShape ? boxG : sphG; };
  $('sSize').oninput = () => { bSize = +$('sSize').value; $('sizeV').textContent = bSize.toFixed(1) + ' m'; };
  const act = $('bAct');
  act.onpointerdown = e => { e.preventDefault(); acting = true; act.classList.add('on'); };
  act.onpointerup = act.onpointerleave = act.onpointercancel = () => { acting = false; act.classList.remove('on'); };
  $('bBuild').onclick = () => { buildOn = !buildOn; for (const id of ['tools', 'cross', 'bAct']) $(id).style.display = buildOn ? '' : 'none'; $('bBuild').classList.toggle('on', buildOn); preview.visible = false; };
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 2) { acting = true; if (K.look.id === e.pointerId) K.look.id = null; } });
  el.addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && e.button === 2) acting = false; });
  el.addEventListener('wheel', e => { bSize = Math.max(.6, Math.min(4, bSize - Math.sign(e.deltaY) * .2)); $('sSize').value = bSize; $('sSize').oninput(); }, { passive: true });
  addEventListener('keydown', e => {
    if (e.code === 'KeyE') acting = true;
    if (e.code === 'KeyR') setMode((bMode + 1) % 4);
    if (e.code === 'KeyT') $('tShape').onclick();
    const n = +e.key; if (n >= 1 && n <= MATS.length) $('mats').children[n - 1].click();
  });
  addEventListener('keyup', e => { if (e.code === 'KeyE') acting = false; });
  const sphG = new THREE.IcosahedronGeometry(1, 2), boxG = new THREE.BoxGeometry(2, 2, 2);
  const preview = new THREE.Mesh(sphG, new THREE.MeshBasicMaterial({ color: 0xff6050, wireframe: true, transparent: true, opacity: .55, depthWrite: false, fog: false }));
  preview.visible = false; preview.renderOrder = 5; scene.add(preview);
  const camDir = new THREE.Vector3();
  function findTree(o, dir, maxD) {
    const cx = Math.floor(o.x / 128), cz = Math.floor(o.z / 128), cand = [];
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const c = K.veg.treeL.cache.get(key(cx + i, cz + j)); if (c) for (const t of c.trees) if (Math.hypot(t.x - o.x, t.z - o.z) < maxD + 3) cand.push(t); }
    const gh = K.vox.raycast(o, dir, maxD), lim = gh ? gh.t + 1.5 : maxD;
    for (let d = .5; d < lim; d += .4) {
      const px = o.x + dir.x * d, py = o.y + dir.y * d, pz = o.z + dir.z * d;
      for (const t of cand) {
        const rr = t.H * t.rs * t.wf * 1.1 + .6;
        if (py > t.y - 1 && py < t.y + t.H && Math.hypot(px - t.x, pz - t.z) < rr) return { x: t.x, y: Math.max(py, t.y), z: t.z, tree: t };
      }
    }
    return null;
  }
  function aimTarget() {
    camDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
    if (bMode === 3) return findTree(camera.position, camDir, 40);
    const hit = K.vox.raycast(camera.position, camDir, 30); if (!hit) return null;
    const r = bSize, c = { x: hit.x, y: hit.y, z: hit.z };
    if (bMode === 0) { c.x += camDir.x * r * .4; c.y += camDir.y * r * .4; c.z += camDir.z * r * .4; }
    if (bMode === 1) { c.x -= camDir.x * r * .45; c.y -= camDir.y * r * .45; c.z -= camDir.z * r * .45; }
    if (bShape) { c.x = Math.round(c.x / K.vox.VS) * K.vox.VS; c.y = Math.round(c.y / K.vox.VS) * K.vox.VS; c.z = Math.round(c.z / K.vox.VS) * K.vox.VS; }
    return c;
  }
  function doAction(c) {
    if (bMode === 3) { if (c.tree) K.veg.fellTree(c.tree); return; }
    if (bMode === 1 && !K.fly) { const dx = c.x - pos.x, dz = c.z - pos.z, dy = c.y - (pos.y - .8); if (Math.hypot(dx, dy * .6, dz) < bSize + .6) return; }
    K.vox.applyEdits([{ t: bMode, x: c.x, y: c.y, z: c.z, r: bSize, mat: bMat, shape: bMode === 2 ? 0 : bShape }]);
  }
  $('bDemo').onclick = () => {
    const fx = -Math.sin(K.yaw), fz = -Math.cos(K.yaw), cx = pos.x + fx * 20, cz = pos.z + fz * 20, gy = heightAt(cx, cz), ops = [];
    ops.push({ t: 1, x: cx, y: gy - 4, z: cz, r: 10, mat: 7, shape: 0 });
    ops.push({ t: 0, x: cx, y: gy + 1.7, z: cz, r: 3.4, mat: 2, shape: 0 });
    for (let t = 11; t >= 2.5; t -= .7) ops.push({ t: 0, x: cx - fx * t, y: gy + 1.25, z: cz - fz * t, r: 1.25, mat: 2, shape: 0 });
    ops.push({ t: 1, x: cx, y: gy - 3, z: cz, r: 3, mat: 6, shape: 1 });
    ops.push({ t: 0, x: cx + fz * 2.6, y: gy + 2.6, z: cz - fx * 2.6, r: .7, mat: 2, shape: 0 });
    for (let t = 2.6; t <= 9; t += .6) ops.push({ t: 0, x: cx + fz * t, y: gy + 2.6, z: cz - fx * t, r: .55, mat: 2, shape: 0 });
    K.vox.applyEdits(ops);
  };

  function update(now) {
    if (!buildOn) return;
    const tg = aimTarget();
    preview.visible = !!tg;
    if (tg) { preview.position.set(tg.x, tg.y, tg.z); const r = bSize; preview.scale.set(bMode === 3 ? 1.5 : r, bMode === 2 ? .15 : bMode === 3 ? 1.5 : r, bMode === 3 ? 1.5 : r); if (acting && now - lastAct > 140) { doAction(tg); lastAct = now; } }
  }
  return { update };
}
