// Gigant-Welt: Steuerung (Joystick/Maus/Tasten), Flug, Physik, Kollision mit Voxeln und Bäumen.
// createSpieler(K) -> { findSpawn(), move(dt), toggleFly() }. Setzt K.joy, K.look, K.keys.
// Nutzt K: renderer, pos, yaw, pitch, vy, fly, grounded, flySpeed, upIn, $, isTouch, vox.dens + veg.treeL (lazy).
import { heightAt, forestRaw, findeStart } from './welt.js';
import { key } from './vegetation.js';

export function createSpieler(K) {
  const { renderer, pos, $, isTouch } = K;
  const keys = {};
  const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 }, look = { id: null, lx: 0, ly: 0 };
  K.keys = keys; K.joy = joy; K.look = look;
  // Start über welt.js/findeStart (Wiese mit Wald in der Nähe); Blick zum dichtesten Wald im Umkreis.
  function findSpawn() {
    const st = findeStart() || { x: 0, z: 0 };
    let best = 0, bw = -1;
    for (let d = 0; d < 8; d++) {
      const b = d / 8 * Math.PI * 2, w = forestRaw(st.x + Math.cos(b) * 150, st.z + Math.sin(b) * 150);
      if (w > bw) { bw = w; best = b; }
    }
    return { x: st.x, z: st.z, yaw: Math.atan2(-Math.cos(best), -Math.sin(best)) };
  }
  const el = renderer.domElement;
  el.addEventListener('pointerdown', e => {
    el.setPointerCapture(e.pointerId);
    if (e.pointerType === 'touch' && e.clientX < innerWidth * .5 && joy.id === null) {
      joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0;
      const j = $('joy'); j.style.display = 'block'; j.style.left = e.clientX + 'px'; j.style.top = e.clientY + 'px'; $('knob').style.transform = '';
    } else if (look.id === null) { look.id = e.pointerId; look.lx = e.clientX; look.ly = e.clientY; }
  });
  el.addEventListener('pointermove', e => {
    if (e.pointerId === joy.id) {
      let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const l = Math.hypot(dx, dy), mx = 60;
      if (l > mx) { dx *= mx / l; dy *= mx / l; }
      joy.x = dx / mx; joy.y = dy / mx; $('knob').style.transform = `translate(${dx}px,${dy}px)`;
    } else if (e.pointerId === look.id) {
      const sens = e.pointerType === 'touch' ? .0055 : .0035;
      K.yaw -= (e.clientX - look.lx) * sens; K.pitch -= (e.clientY - look.ly) * sens;
      K.pitch = Math.max(-1.5, Math.min(1.45, K.pitch)); look.lx = e.clientX; look.ly = e.clientY;
    }
  });
  const endP = e => { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; $('joy').style.display = 'none'; } if (e.pointerId === look.id) look.id = null; };
  el.addEventListener('pointerup', endP); el.addEventListener('pointercancel', endP);
  addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'KeyF') toggleFly(); if (e.code === 'Space' && !K.fly && K.grounded) K.vy = 7.5; });
  addEventListener('keyup', e => { keys[e.code] = false; });

  function toggleFly() { K.fly = !K.fly; K.vy = 0; $('bFly').textContent = 'Flug: ' + (K.fly ? 'AN' : 'AUS'); $('bFly').classList.toggle('on', K.fly); $('updown').style.display = K.fly && isTouch ? 'flex' : 'none'; }
  $('bFly').onclick = toggleFly;
  $('bView').onclick = () => { if (!K.fly) toggleFly(); pos.y = Math.max(pos.y, heightAt(pos.x, pos.z) + 420); K.pitch = -.22; };
  const hold = (id, v) => { const b = $(id); b.onpointerdown = e => { e.preventDefault(); K.upIn = v; }; b.onpointerup = b.onpointerleave = b.onpointercancel = () => { K.upIn = 0; }; };
  hold('bUp', 1); hold('bDn', -1);

  function collide() {
    const cx = Math.floor(pos.x / 128), cz = Math.floor(pos.z / 128);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const c = K.veg.treeL.cache.get(key(cx + i, cz + j)); if (!c) continue;
      for (const t of c.trees) {
        const dx = pos.x - t.x, dz = pos.z - t.z, d = Math.hypot(dx, dz), rr = t.H * t.rs * t.wf * 1.45 + .5;
        if (d < rr && d > 1e-3) { pos.x = t.x + dx / d * rr; pos.z = t.z + dz / d * rr; }
      }
    }
  }

  function move(dt) {
    let mx = joy.x, mz = -joy.y;
    if (keys.KeyW || keys.ArrowUp) mz += 1; if (keys.KeyS || keys.ArrowDown) mz -= 1;
    if (keys.KeyD || keys.ArrowRight) mx += 1; if (keys.KeyA || keys.ArrowLeft) mx -= 1;
    const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    const sprint = keys.ShiftLeft || keys.ShiftRight || Math.hypot(joy.x, joy.y) > .93;
    const fx = -Math.sin(K.yaw), fz = -Math.cos(K.yaw), rx = Math.cos(K.yaw), rz = -Math.sin(K.yaw);
    if (K.fly) {
      const sp = K.flySpeed * (sprint ? 3 : 1), cp = Math.cos(K.pitch);
      pos.x += (fx * cp * mz + rx * mx) * sp * dt; pos.z += (fz * cp * mz + rz * mx) * sp * dt;
      pos.y += (Math.sin(K.pitch) * mz + K.upIn + (keys.Space ? 1 : 0) - (keys.KeyC ? 1 : 0)) * sp * dt;
      const g = Math.max(heightAt(pos.x, pos.z), 0) + 1.7; if (pos.y < g) pos.y = g;
    } else {
      const sp = sprint ? 19 : 5.5, EYE = 1.65;
      let foot = pos.y - EYE;
      const free = (x, z) => K.vox.dens(x, foot + .7, z) <= 0 && K.vox.dens(x, foot + 1.55, z) <= 0;
      const nx = pos.x + (fx * mz + rx * mx) * sp * dt, nz = pos.z + (fz * mz + rz * mx) * sp * dt;
      if (free(nx, pos.z)) pos.x = nx;
      if (free(pos.x, nz)) pos.z = nz;
      collide();
      K.vy -= 22 * dt; foot += K.vy * dt;
      if (K.vy > 0 && K.vox.dens(pos.x, foot + 1.8, pos.z) > 0) K.vy = 0;
      if (K.vox.dens(pos.x, foot, pos.z) > 0) {
        let k = 0; while (k < 30 && K.vox.dens(pos.x, foot + .04, pos.z) > 0) { foot += .04; k++; }
        K.vy = 0; K.grounded = true;
      } else K.grounded = K.vox.dens(pos.x, foot - .1, pos.z) > 0;
      if (foot < -.25 && K.vox.dens(pos.x, foot, pos.z) <= 0) { foot = -.25; K.vy = Math.max(0, K.vy); K.grounded = true; }
      pos.y = foot + EYE;
    }
  }

  return { findSpawn, move, toggleFly };
}
