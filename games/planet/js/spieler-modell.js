// Spielfigur: kleiner Voxel-Entdecker (Toon-Look wie games/voxel-tiere) mit Speer.
// Prozedurale Animation: laufen, springen, gleiten, schwimmen, reiten, Angriff, Wurf, Tod.
// Modell schaut nach +Z, Füße bei y=0, ca. 1,8 m groß.
import * as THREE from 'three';

const V = 0.1;
const boxGeo = new THREE.BoxGeometry(V, V, V);
const grad = new THREE.DataTexture(new Uint8Array([140, 200, 255]), 3, 1, THREE.RedFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
const mat = new THREE.MeshToonMaterial({ gradientMap: grad });

const F = {
  haut: '#ffd3ae', tunika: '#4fae6c', tunikaD: '#3c8f56', hose: '#6b4f3a', stiefel: '#4a3326',
  hut: '#e0b96a', hutband: '#8a5a2b', haar: '#7a4a2a', rucksack: '#b07a42', rucksackD: '#8c5d30',
  auge: '#2a2238', glanz: '#ffffff', wange: '#ff9fb8', mund: '#c4605a', schal: '#e2574c', gold: '#f2c94c',
};

function voxels(list, scale = 1) {
  const m = new THREE.InstancedMesh(boxGeo, mat, Math.max(list.length, 1));
  const o = new THREE.Object3D(), c = new THREE.Color();
  list.forEach(([x, y, z, col], i) => {
    o.position.set(x * V, y * V, z * V); o.scale.setScalar(scale); o.updateMatrix();
    m.setMatrixAt(i, o.matrix); m.setColorAt(i, c.set(col));
  });
  m.count = list.length;
  m.castShadow = true; m.receiveShadow = true;
  m.frustumCulled = false;
  return m;
}
// Füllt ganzzahlige Voxel-Koordinaten; Mittelpunkte bei (x+0.5)·V usw.
function fill(out, x0, x1, y0, y1, z0, z1, col, test) {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++)
    if (!test || test(x, y, z)) out.push([x + 0.5, y + 0.5, z + 0.5, typeof col === 'function' ? col(x, y, z) : col]);
}
function teil(list, px, py, pz) {
  const g = new THREE.Group(); g.add(voxels(list)); g.position.set(px, py, pz); return g;
}

export function erstelleModell() {
  const wurzel = new THREE.Group();       // wird von spieler.js in die Welt gesetzt
  const koerper = new THREE.Group();      // Wippen, Neigen, Reiten-Versatz
  wurzel.add(koerper);

  // Beine (Pivot an der Hüfte)
  const bein = () => {
    const l = [];
    fill(l, -1, 0, -5, -1, -1, 0, (x, y) => y <= -4 ? F.stiefel : F.hose);
    fill(l, -1, 0, -5, -5, 1, 1, F.stiefel); // Stiefelspitze
    return l;
  };
  const beinL = teil(bein(), -0.13, 0.5, 0), beinR = teil(bein(), 0.13, 0.5, 0);

  // Rumpf
  const rumpfL = [];
  fill(rumpfL, -3, 2, 0, 4, -2, 1, (x, y, z) => {
    if (y === 0) return (z === 1 && (x === -1 || x === 0)) ? F.gold : F.hutband;
    if (y === 4) return F.schal;
    return (x === -3 || x === 2) ? F.tunikaD : F.tunika;
  });
  fill(rumpfL, -2, 1, 1, 4, -3, -3, F.rucksack);              // Rucksack
  fill(rumpfL, -1, 0, 1, 2, -4, -4, F.rucksackD);
  fill(rumpfL, -3, -3, 2, 3, 2, 2, F.schal);                   // Schalzipfel
  const rumpf = teil(rumpfL, 0, 0.5, 0);

  // Kopf (Pivot am Hals) – groß und rund für den Chibi-Look
  const kopfL = [];
  fill(kopfL, -4, 3, 0, 6, -3, 3, (x, y, z) => {
    if (y === 6 || z === -3) return F.haar;
    if ((x === -4 || x === 3) && y >= 3 && z <= 1) return F.haar;
    if (z === 3) {
      if (y === 1 && (x === -3 || x === 2)) return F.wange;
      if (y === 1 && (x === -1 || x === 0)) return F.mund;
      if (y === 5 && (x === -4 || x === 3 || x === -3)) return F.haar; // Pony
    }
    return F.haut;
  }, (x, y, z) => !((x === -4 || x === 3) && (z === -3 || z === 3) && (y === 0 || y === 6))); // Ecken abrunden
  // Hut
  fill(kopfL, -5, 4, 7, 7, -5, 4, F.hut, (x, y, z) => !((x === -5 || x === 4) && (z === -5 || z === 4)));
  fill(kopfL, -3, 2, 8, 9, -3, 2, (x, y) => y === 8 ? F.hutband : F.hut);
  const kopf = teil(kopfL, 0, 1.0, 0);
  // Augen als dünne Plättchen vor dem Gesicht (zum Blinzeln skalierbar)
  const augenL = [];
  for (const x0 of [-3, 1]) {
    fill(augenL, x0, x0 + 1, -1, 0, 0, 0, (x, y) => (y === 0 && x === x0 + 1) ? F.glanz : F.auge);
  }
  const augen = new THREE.Group();
  const augenMesh = voxels(augenL.map(([x, y, z, c]) => [x, y, 0, c]));
  augen.add(augenMesh); augen.scale.z = 0.3; augen.position.set(0, 0.3, 0.4 + 0.012);
  kopf.add(augen);

  // Arme (Pivot an der Schulter)
  const arm = () => { const l = []; fill(l, -1, 0, -5, -1, -1, 0, (x, y) => y >= -2 ? F.tunika : F.haut); return l; };
  const armL = teil(arm(), -0.4, 0.95, 0), armR = teil(arm(), 0.4, 0.95, 0);

  // Speer in der rechten Hand
  const speer = new THREE.Group();
  const holz = new THREE.MeshToonMaterial({ gradientMap: grad, color: 0x9a6a3a });
  const schaft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.5), holz);
  schaft.position.z = 0.25; schaft.castShadow = true;
  const spitze = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.24, 4), new THREE.MeshToonMaterial({ gradientMap: grad, color: 0xb8bcc4 }));
  spitze.rotation.x = Math.PI / 2; spitze.position.z = 1.1; spitze.castShadow = true;
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshToonMaterial({ gradientMap: grad, color: 0xe2574c }));
  band.position.z = 0.95;
  speer.add(schaft, spitze, band);
  speer.position.set(0, -0.45, 0.02); speer.rotation.x = -0.45;
  armR.add(speer);

  // Fangkugel in der linken Hand (nur beim Wurf sichtbar)
  const kugel = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), new THREE.MeshToonMaterial({ gradientMap: grad, color: 0x6fbf4f }));
  kugel.position.set(0, -0.52, 0); kugel.visible = false;
  armL.add(kugel);
  const hand = new THREE.Object3D(); hand.position.set(0, -0.5, 0); armL.add(hand);

  koerper.add(beinL, beinR, rumpf, kopf, armL, armR);
  wurzel.traverse(o => { o.userData.spieler = true; });

  // ---------- Animation ----------
  const st = { phase: 0, blinzel: 2, angriff: 0, wurf: 0, tot: 0, schwimmNeig: 0, luft: 0, ritt: 0, gleit: 0 };
  const lerp = THREE.MathUtils.lerp;
  const glatt = (cur, ziel, k, dt) => cur + (ziel - cur) * (1 - Math.exp(-k * dt));

  function animiere(dt, z) {
    // z: { tempo (m/s), amBoden, schwimmt, reitet, gleitet, tot, vr }
    const amt = Math.min(1, z.tempo / 5);
    st.phase += dt * (z.schwimmt ? 5 : 3 + z.tempo * 1.6);
    st.luft = glatt(st.luft, (!z.amBoden && !z.schwimmt && !z.reitet) ? 1 : 0, 12, dt);
    st.ritt = glatt(st.ritt, z.reitet ? 1 : 0, 8, dt);
    st.gleit = glatt(st.gleit, z.gleitet ? 1 : 0, 8, dt);
    st.schwimmNeig = glatt(st.schwimmNeig, z.schwimmt ? (0.35 + 0.9 * amt) : 0, 5, dt);
    st.tot = glatt(st.tot, z.tot ? 1 : 0, 5, dt);
    const s = Math.sin(st.phase), c = Math.cos(st.phase);
    const lauf = amt * (1 - st.luft) * (1 - st.ritt) * (z.schwimmt ? 0 : 1);

    // Beine
    let bl = s * 0.85 * lauf, br = -s * 0.85 * lauf;
    bl = lerp(bl, -0.7, st.luft); br = lerp(br, 0.35, st.luft);
    if (z.schwimmt) { bl = Math.sin(st.phase * 2) * 0.45; br = -bl; }
    bl = lerp(bl, -1.45, st.ritt); br = lerp(br, -1.45, st.ritt);
    beinL.rotation.set(bl, 0, -0.35 * st.ritt);
    beinR.rotation.set(br, 0, 0.35 * st.ritt);

    // Arme
    let al = -s * 0.7 * lauf, ar = s * 0.5 * lauf, alz = 0, arz = 0;
    al = lerp(al, -0.5, st.luft); ar = lerp(ar, -0.3, st.luft); alz = -0.5 * st.luft; arz = 0.4 * st.luft;
    alz = lerp(alz, -1.45, st.gleit); arz = lerp(arz, 1.45, st.gleit); al = lerp(al, 0, st.gleit); ar = lerp(ar, 0, st.gleit);
    if (z.schwimmt) { al = st.phase % (Math.PI * 2) - Math.PI; ar = ((st.phase + Math.PI) % (Math.PI * 2)) - Math.PI; alz = -0.25; arz = 0.25; }
    al = lerp(al, -0.6, st.ritt); ar = lerp(ar, -0.6, st.ritt);
    // Angriff (rechter Arm stößt den Speer nach vorn)
    if (st.angriff > 0) {
      const t = 1 - st.angriff / 0.38;
      ar = t < 0.3 ? lerp(0, 0.9, t / 0.3) : t < 0.55 ? lerp(0.9, -1.7, (t - 0.3) / 0.25) : lerp(-1.7, 0, (t - 0.55) / 0.45);
      arz = 0.1;
      rumpf.rotation.y = Math.sin(t * Math.PI) * 0.35;
      st.angriff -= dt;
    } else rumpf.rotation.y = glatt(rumpf.rotation.y, 0, 10, dt);
    // Wurf (linker Arm überkopf)
    if (st.wurf > 0) {
      const t = 1 - st.wurf / 0.5;
      al = t < 0.4 ? lerp(0, 2.6, t / 0.4) : t < 0.6 ? lerp(2.6, -1.3, (t - 0.4) / 0.2) : lerp(-1.3, 0, (t - 0.6) / 0.4);
      alz = -0.15;
      kugel.visible = t < 0.5;
      rumpf.rotation.y = -Math.sin(t * Math.PI) * 0.3;
      st.wurf -= dt;
    } else kugel.visible = false;
    armL.rotation.set(al, 0, alz);
    armR.rotation.set(ar, 0, arz);

    // Kopf / Körper
    kopf.rotation.x = -0.15 * st.schwimmNeig * 0.6 - 0.35 * st.schwimmNeig;
    kopf.rotation.z = Math.sin(st.phase * 0.5) * 0.04 * lauf;
    koerper.position.y = Math.abs(s) * 0.06 * lauf + 0.75 * st.ritt;
    koerper.rotation.x = st.schwimmNeig * 1.1 + st.gleit * 0.6 + amt * 0.08 * lauf;
    if (z.schwimmt) koerper.position.y += Math.sin(st.phase * 0.7) * 0.04;
    // Tod: umkippen
    if (st.tot > 0.01) { koerper.rotation.x = lerp(koerper.rotation.x, -Math.PI / 2, st.tot); koerper.position.y += 0.15 * st.tot; }

    // Blinzeln
    st.blinzel -= dt;
    if (st.blinzel < 0) { augen.scale.y = 0.15; if (st.blinzel < -0.12) { st.blinzel = 2 + Math.random() * 3; } }
    else augen.scale.y = z.tot ? 0.15 : 1;
  }

  return {
    gruppe: wurzel,
    hand, kugel,
    animiere,
    angriff() { st.angriff = 0.38; },
    wurf(farbe) { st.wurf = 0.5; if (farbe != null) kugel.material.color.set(farbe); },
  };
}
