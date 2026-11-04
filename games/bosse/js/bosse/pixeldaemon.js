// 8 – Pixel-Dämon: 2D-Pixelart, jedes Frame prozedural auf ein 64×64-Raster gemalt (Formen → Auto-Outline → Auto-Schattierung),
// als Billboard in 3D gestellt. Bewusst ruckelige 10-fps-Animation wie im Retro-Spiel.
import * as THREE from 'three';
import { kf } from '../helfer.js';

const W = 64, H = 64;
// Palette: je Farbe [hell, mittel, dunkel]
const PAL = {
  haut: ['#ff6a5a', '#d8302a', '#8a1420'], bauch: ['#ffb070', '#e08040', '#a04a20'],
  horn: ['#fff2d0', '#d8c8a0', '#8a7a5a'], fluegel: ['#8a50c0', '#5a2a90', '#2a1050'],
  auge: ['#ffffa0', '#ffe040', '#ffe040'], feuer: ['#ffffc0', '#ffb020', '#ff5010'],
  kralle: ['#ffffff', '#d0d0e0', '#8080a0'], schwarz: ['#2a0a10', '#2a0a10', '#2a0a10'],
};
const NAMEN = Object.keys(PAL);
export default {
  id: 'pixel', name: 'Pixel-Dämon', emoji: '👾',
  stil: 'Retro-Pixelart', technik: 'Prozedurales 2D-Sprite als Billboard',
  himmel: [0x200a30, 0x8a3060], boden: 0x5a4060, staub: 0xff5030, ring: 0xff4020,
  groesse: 5, tempo: 1.4, schritt: 0.9, angriffDauer: 1.2, trefferZeit: 0.5, wucht: 1,
  erzeuge({ kamera }) {
    const g = new THREE.Group();
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d');
    const img = cx.createImageData(W, H);
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6), new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }));
    plane.position.y = 2.38; g.add(plane);
    const schatten = new THREE.Mesh(new THREE.CircleGeometry(1.4, 8), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    schatten.rotation.x = -Math.PI / 2; schatten.scale.y = 0.5; schatten.position.y = 0.02; g.add(schatten);
    const RGB = {};
    for (const n of NAMEN) RGB[n] = PAL[n].map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
    const OUT = [26, 6, 18];

    let buf = new Uint8Array(W * H); // 0 = leer, sonst Farb-Index+1
    const setz = (x, y, f) => { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = f; };
    const F = n => NAMEN.indexOf(n) + 1;
    const ellipse = (mx, my, rx, ry, f) => { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx + 0.3) + (y * y) / (ry * ry + 0.3) <= 1) setz(mx + x, my + y, F(f)); };
    const linie = (x0, y0, x1, y1, d, f) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2; for (let i = 0; i <= n; i++) { const t = i / n; ellipse(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), d, d, f); } };
    const dreieck = (p, f) => {
      const [a, b, c] = p; const minX = Math.min(a[0], b[0], c[0]) | 0, maxX = Math.max(a[0], b[0], c[0]) | 0, minY = Math.min(a[1], b[1], c[1]) | 0, maxY = Math.max(a[1], b[1], c[1]) | 0;
      const s = (p1, p2, p3) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const q = [x + 0.5, y + 0.5], d1 = s(q, a, b), d2 = s(q, b, c), d3 = s(q, c, a);
        if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) setz(x, y, F(f));
      }
    };
    function male(pose) {
      buf.fill(0);
      const { bob, schritt, armL, armR, fl, maul, schlag, feuer } = pose;
      const by = 36 + bob;
      // Flügel (hinten)
      for (const s of [-1, 1]) {
        const sx = 32 + s * 6, sy = by - 10;
        const tipY = sy - 14 - fl * 6, tipX = sx + s * (22 - fl * 3);
        dreieck([[sx, sy], [tipX, tipY], [sx + s * 18, sy + 10 + fl * 2]], 'fluegel');
        dreieck([[sx, sy], [sx + s * 18, sy + 10 + fl * 2], [sx + s * 8, sy + 14]], 'fluegel');
        linie(sx, sy, tipX, tipY, 0, 'schwarz');
      }
      // Schwanz
      const sw = Math.round(Math.sin(pose.t * 2) * 3);
      linie(38, by + 8, 50 + sw, by + 14, 1, 'haut'); dreieck([[49 + sw, by + 11], [55 + sw, by + 14], [49 + sw, by + 17]], 'haut');
      // Beine
      for (const s of [-1, 1]) {
        const lift = s > 0 ? Math.max(0, schritt) : Math.max(0, -schritt);
        const fx = 32 + s * 7, fy = 58 - lift * 3;
        linie(32 + s * 5, by + 8, fx, fy - 2, 2, 'haut');
        ellipse(fx, fy, 3, 1, 'schwarz');
      }
      // Körper + Bauch
      ellipse(32, by, 11, 12, 'haut');
      ellipse(32, by + 3, 6, 7, 'bauch');
      for (let i = 0; i < 3; i++) linie(28, by + i * 3, 36, by + i * 3, 0, 'haut');
      // Arme
      const arm = (s, w) => {
        const shx = 32 + s * 10, shy = by - 7;
        const hx = shx + s * (6 + w * 2), hy = shy + 12 - w * 18;
        linie(shx, shy, hx, hy, 2, 'haut');
        for (let k = -1; k <= 1; k++) linie(hx, hy, hx + s * 2 + k * 2, hy + 4 - w * 7, 0, 'kralle');
        return [hx, hy];
      };
      const hL = arm(-1, armL), hR = arm(1, armR);
      // Kopf
      const kx = 32, ky = by - 15;
      ellipse(kx, ky, 8, 7, 'haut');
      for (const s of [-1, 1]) { linie(kx + s * 5, ky - 5, kx + s * 10, ky - 13, 1, 'horn'); setz(kx + s * 11, ky - 15, F('horn')); setz(kx + s * 11, ky - 14, F('horn')); }
      for (const s of [-1, 1]) { ellipse(kx + s * 3, ky - 1, 1, 1, 'auge'); setz(kx + s * 3, ky - 1, F('schwarz')); }
      // Augenbrauen (böse)
      for (const s of [-1, 1]) linie(kx + s * 1, ky - 3, kx + s * 5, ky - 4, 0, 'schwarz');
      // Maul mit Zähnen
      const mh = 1 + Math.round(maul * 3);
      for (let y = 0; y < mh; y++) linie(kx - 4, ky + 3 + y, kx + 4, ky + 3 + y, 0, 'schwarz');
      for (let x = -3; x <= 3; x += 2) setz(kx + x, ky + 3, F('horn'));
      if (maul > 0.5) for (let x = -2; x <= 2; x += 2) setz(kx + x, ky + 2 + mh, F('horn'));
      // Feuerball über der Hand / Klauen-Hieb
      if (feuer > 0) { const r = Math.round(1 + feuer * 4); ellipse(hR[0], hR[1] - r - 1, r, r, 'feuer'); }
      if (schlag > 0) for (let i = 0; i < 18; i++) {
        const t = i / 17, a = -1.6 + t * 2.6 * schlag;
        setz(32 + Math.cos(a) * 24, by - 4 + Math.sin(a) * 18, F('kralle'));
        setz(32 + Math.cos(a) * 22, by - 4 + Math.sin(a) * 16, F('feuer'));
      }
      // Auto-Outline + Auto-Schattierung (Licht von oben links)
      const d = img.data;
      const leer = (x, y) => x < 0 || y < 0 || x >= W || y >= H || buf[y * W + x] === 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, f = buf[y * W + x];
        if (f) {
          const pal = RGB[NAMEN[f - 1]];
          const nachbar = (dx, dy) => leer(x + dx, y + dy) || buf[(y + dy) * W + x + dx] !== f;
          const shade = (nachbar(-1, 0) || nachbar(0, -1)) ? 0 : (nachbar(1, 0) || nachbar(0, 1) || nachbar(1, 1)) ? 2 : 1;
          const c = pal[shade];
          d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
        } else if (!leer(x - 1, y) || !leer(x + 1, y) || !leer(x, y - 1) || !leer(x, y + 1)) {
          d[i] = OUT[0]; d[i + 1] = OUT[1]; d[i + 2] = OUT[2]; d[i + 3] = 255;
        } else d[i + 3] = 0;
      }
      cx.putImageData(img, 0, 0); tex.needsUpdate = true;
    }
    const KEYS = [
      [0, {}],
      [0.4, { armR: 1.2, armL: -0.3, feuer: 1, maul: 0.6, fl: 0.8 }],
      [0.5, { armR: -0.6, armL: 0.3, schlag: 1, maul: 1, fl: -0.5, bob: 2 }],
      [0.7, { armR: -0.6, armL: 0.3, schlag: 1, maul: 0.8, fl: -0.5, bob: 2 }],
      [1, {}],
    ];
    let letzt = -1;
    return {
      gruppe: g, trefferPunkt: new THREE.Vector3(0, 0, 2),
      update(st) {
        const { w, zeit } = st;
        // Kamera-Billboard (nur um Y drehen)
        g.updateMatrixWorld();
        const lp = g.worldToLocal(kamera.position.clone());
        plane.rotation.y = Math.atan2(lp.x, lp.z);
        // Auf 10 fps quantisieren
        const frame = Math.floor(zeit * 10);
        if (frame === letzt) return; letzt = frame;
        const t = frame / 10, ph = Math.floor(st.phase * 4) / 4 * Math.PI * 2;
        const a = kf(st.p, KEYS);
        const sch = Math.sin(ph);
        male({
          t, bob: Math.round(w.idle * Math.sin(t * 2.5) * 1 + w.walk * Math.abs(sch) * -2 + a.bob),
          schritt: sch * w.walk,
          armL: w.idle * Math.sin(t * 2.5) * 0.1 + w.walk * -sch * 0.3 + a.armL,
          armR: w.idle * Math.sin(t * 2.5 + 1) * 0.1 + w.walk * sch * 0.3 + a.armR,
          fl: Math.round(Math.sin(t * (3 + w.walk * 3)) * 2) / 2 + a.fl,
          maul: w.idle * (Math.sin(t) > 0.8 ? 0.6 : 0) + a.maul, schlag: a.schlag, feuer: a.feuer,
        });
      },
    };
  },
};
