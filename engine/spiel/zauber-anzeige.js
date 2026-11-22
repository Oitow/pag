/**
 * @modul    zauber-anzeige
 * @zweck    Sichtbares zu Element-Reaktionen fürs Zauber-Modul: Boden-Flecken (nass, brennend, gefroren, schlamm, geladen) als weiche Scheiben in einem Draw-Call, Dampfwolken (Sprites), Eis-Glanz (Eis-Hülle), Funken/Feuersturm über zauber-effekte und der Ziel-Kreis beim Aufladen – alles aus Pools, fürs Handy sparsam
 * @api      createZauberAnzeige({szene,welt,fx,anteil}) -> { flecken(liste), reaktion(folge|reaktion,pos), wolke(x,z,radius,dauer), glanz(pos,radius,dauer), kreis(pos|null,radius,farbe,anteil), update(dt), dispose() }
 * @beispiel
 *   import { createZauberAnzeige } from '../../engine/spiel/zauber-anzeige.js';
 *   const an = createZauberAnzeige({ szene, welt, fx });
 *   an.flecken(reaktionen.flecken); an.wolke(10, 4, 3, 4); an.update(dt);
 * @tags     spiel, zauber, effekt, element, reaktion, dampf, eis, boden, fleck, vfx
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { ZUSTAENDE } from '../gameplay/element-reaktionen.js';

const MAX_FLECKEN = 48, MAX_WOLKEN = 24, MAX_GLANZ = 8;

function weicheTextur(innen = 1) {
  const c = globalThis.document?.createElement('canvas');
  if (!c) return null;
  c.width = c.height = 64;
  const g = c.getContext('2d'), v = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  v.addColorStop(0, `rgba(255,255,255,${innen})`); v.addColorStop(0.55, 'rgba(255,255,255,.55)'); v.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = v; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createZauberAnzeige({ szene, welt, fx, anteil = 1 } = {}) {
  const gruppe = new THREE.Group(); gruppe.name = 'zauber-anzeige';
  szene.add(gruppe);
  const tex = weicheTextur(0.9);
  const boden = (x, z) => +welt?.bodenHoehe?.(x, z) || 0;

  // ---- Boden-Flecken: InstancedMesh, Farbe je Zustand ----
  const fleckGeo = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
  const fleckMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: true });
  const fleckMesh = new THREE.InstancedMesh(fleckGeo, fleckMat, MAX_FLECKEN);
  fleckMesh.count = 0; fleckMesh.frustumCulled = false; fleckMesh.renderOrder = 2;
  fleckMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_FLECKEN * 3), 3);
  gruppe.add(fleckMesh);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), oben = new THREE.Vector3(0, 1, 0), nv = new THREE.Vector3(), sv = new THREE.Vector3(), pv = new THREE.Vector3(), col = new THREE.Color();
  let liste = [], zeit = 0;

  function fleckenZeichnen() {
    let n = 0;
    for (const f of liste) {
      if (n >= MAX_FLECKEN) break;
      const nr = welt?.normale?.(f.x, f.z);
      if (nr) q.setFromUnitVectors(oben, nv.set(nr.x, nr.y, nr.z).normalize()); else q.identity();
      const aus = Math.min(1, f.rest / 1.2), r = f.radius * (0.6 + 0.4 * aus);
      m4.compose(pv.set(f.x, boden(f.x, f.z) + 0.06, f.z), q, sv.set(r, 1, r));
      fleckMesh.setMatrixAt(n, m4);
      col.setHex(ZUSTAENDE[f.zustand]?.farbe ?? 0xffffff);
      if (f.zustand === 'brennend') col.multiplyScalar(1.1 + 0.35 * Math.sin(zeit * 13 + f.x));
      else if (f.zustand === 'geladen') col.multiplyScalar(0.8 + 0.6 * (Math.sin(zeit * 31 + f.z) > 0.6 ? 1 : 0));
      fleckMesh.setColorAt(n, col.multiplyScalar(aus));
      n++;
    }
    fleckMesh.count = n;
    fleckMesh.instanceMatrix.needsUpdate = true;
    fleckMesh.instanceColor.needsUpdate = true;
  }

  // ---- Dampfwolken: Sprites mit normaler Mischung (Sicht wird wirklich weiß-grau) ----
  const wolken = [];
  for (let i = 0; i < MAX_WOLKEN; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xeef2f4, transparent: true, opacity: 0, depthWrite: false }));
    s.visible = false; gruppe.add(s);
    wolken.push({ s, rest: 0, dauer: 1, r: 1, vx: 0, vz: 0 });
  }
  let wZeiger = 0;
  const letzte = [];   // { x, z, t } – mehrere Reaktionen am selben Fleck = eine Wolke
  function wolke(x, z, radius = 3, dauer = 3) {
    for (const l of letzte) if (zeit - l.t < 0.4 && Math.hypot(l.x - x, l.z - z) < radius) return;
    letzte.push({ x, z, t: zeit }); if (letzte.length > 6) letzte.shift();
    const n = Math.max(2, Math.round(6 * anteil));
    const y = boden(x, z);
    for (let i = 0; i < n; i++) {
      const w = wolken[wZeiger = (wZeiger + 1) % MAX_WOLKEN];
      const a = (i / n) * 6.283 + zeit, d = radius * 0.45 * ((i % 3) / 2);
      w.s.position.set(x + Math.sin(a) * d, y + 0.8 + (i % 2) * 0.9, z + Math.cos(a) * d);
      w.r = radius * (0.7 + 0.15 * (i % 3)); w.rest = w.dauer = dauer * (0.8 + 0.1 * (i % 3));
      w.vx = Math.sin(a) * 0.4; w.vz = Math.cos(a) * 0.4;
      w.s.visible = true;
    }
  }

  // ---- Eis-Glanz: halb durchsichtige Eis-Hülle um eingefrorene Ziele ----
  const glanzGeo = new THREE.IcosahedronGeometry(1, 0);
  const glanzMat = new THREE.MeshStandardMaterial({ color: 0xcff0ff, emissive: 0x2a6a8a, emissiveIntensity: 0.6, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.55, flatShading: true, depthWrite: false });
  const glanz = [];
  for (let i = 0; i < MAX_GLANZ; i++) { const m = new THREE.Mesh(glanzGeo, glanzMat); m.visible = false; gruppe.add(m); glanz.push({ m, rest: 0 }); }
  let gZeiger = 0;
  function glanzAn(pos, radius = 1, dauer = 2.5) {
    const g = glanz[gZeiger = (gZeiger + 1) % MAX_GLANZ];
    g.m.position.set(pos.x, (pos.y ?? boden(pos.x, pos.z)) + radius * 0.8, pos.z);
    g.m.scale.set(radius, radius * 1.3, radius); g.m.rotation.y = zeit * 3; g.rest = dauer; g.m.visible = true;
    fx?.funken({ x: pos.x, y: g.m.position.y, z: pos.z }, { farbe: 0xffffff, anzahl: 10, tempo: 2, dauer: 0.5, groesse: 0.3, schwerkraft: 0 });
  }

  // ---- Ziel-Kreis beim Aufladen ----
  const kreisMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const kreis = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 40).rotateX(-Math.PI / 2), kreisMat);
  kreis.visible = false; gruppe.add(kreis);

  /** Sichtbare Folge einer Reaktion (Folge-Objekt aus element-reaktionen oder nur Reaktion + Ort). */
  function reaktion(f, pos) {
    const p = { x: pos?.x ?? f.x, y: pos?.y ?? boden(pos?.x ?? f.x, pos?.z ?? f.z), z: pos?.z ?? f.z };
    const farbe = f.farbe ?? 0xffffff, art = f.art;
    if (art === 'wolke') wolke(p.x, p.z, f.radius || 3, f.dauer || 3);
    else if (art === 'glanz') glanzAn(p, f.radius || 1, f.dauer || 2.5);
    else if (art === 'splitter') fx?.funken({ x: p.x, y: p.y + 1, z: p.z }, { farbe: 0xd8f4ff, anzahl: 24, tempo: 6, dauer: 0.7, groesse: 0.45, schwerkraft: 9, hoch: 2 });
    else if (art === 'flaeche' && f.sturm) {   // Feuersturm: wachsender Ring + aufsteigende Glut im Wirbel
      fx?.ring(p, { farbe, radius: f.radius, dauer: 0.7 });
      for (let i = 0; i < 6; i++) {
        const a = i * 1.047;
        fx?.funken({ x: p.x + Math.sin(a) * f.radius * 0.5, y: p.y + 0.3, z: p.z + Math.cos(a) * f.radius * 0.5 },
          { farbe: i % 2 ? 0xffd040 : farbe, anzahl: 8, tempo: 1.5, dauer: 1.2, groesse: 0.8, schwerkraft: -5, richtung: { x: Math.cos(a) * 4, y: 3, z: -Math.sin(a) * 4 } });
      }
    } else if (art === 'flaeche') {
      fx?.ring(p, { farbe, radius: f.radius, dauer: 0.4 });
      fx?.funken({ x: p.x, y: p.y + 0.6, z: p.z }, { farbe, anzahl: 18, tempo: 5, dauer: 0.4, groesse: 0.35, schwerkraft: 2 });
    } else fx?.funken({ x: p.x, y: p.y + 1, z: p.z }, { farbe, anzahl: 12, tempo: 3, dauer: 0.5, groesse: 0.4 });
  }

  return {
    gruppe,
    flecken(l) { liste = l || []; },
    reaktion, wolke, glanz: glanzAn,
    kreis(pos, radius = 1, farbe = 0xffffff, a = 1) {
      kreis.visible = !!pos;
      if (!pos) return;
      kreis.position.set(pos.x, boden(pos.x, pos.z) + 0.08, pos.z);
      kreis.scale.setScalar(Math.max(0.3, radius) * (1 + 0.04 * Math.sin(zeit * 14)));
      kreisMat.color.setHex(farbe); kreisMat.opacity = 0.3 + 0.55 * a;
    },
    update(dt) {
      zeit += dt;
      fleckenZeichnen();
      for (const w of wolken) {
        if (!w.s.visible) continue;
        w.rest -= dt;
        if (w.rest <= 0) { w.s.visible = false; continue; }
        const t = 1 - w.rest / w.dauer;
        w.s.position.x += w.vx * dt; w.s.position.z += w.vz * dt; w.s.position.y += dt * 0.5;
        w.s.scale.setScalar(w.r * (0.6 + 0.8 * t) * 2);
        w.s.material.opacity = 0.75 * Math.min(1, t * 6) * Math.min(1, w.rest / (w.dauer * 0.5));
      }
      for (const g of glanz) {
        if (!g.m.visible) continue;
        if ((g.rest -= dt) <= 0) { g.m.visible = false; continue; }
        if (g.rest < 0.4) g.m.scale.multiplyScalar(1 + dt * 2);   // zerspringt
      }
    },
    dispose() {
      szene.remove(gruppe);
      fleckGeo.dispose(); fleckMat.dispose(); fleckMesh.dispose?.();
      for (const w of wolken) w.s.material.dispose();
      glanzGeo.dispose(); glanzMat.dispose(); kreis.geometry.dispose(); kreisMat.dispose(); tex?.dispose();
    },
  };
}
