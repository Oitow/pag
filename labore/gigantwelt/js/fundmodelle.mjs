import { rng } from '../../../engine/core/rng.js';

// Fundmodelle mit linearen RGB-Farben pro Eckpunkt.
export function baueFundmodell(art, seed = 1) {
  const positions = [], colors = [];
  const random = rng(seed);
  const tau = 2 * Math.PI;
  function triangle(a, b, c, rgb, light = 1) {
    positions.push(...a, ...b, ...c);
    const shade = rgb.map(v => Math.min(1, v * light));
    colors.push(...shade, ...shade, ...shade);
  }
  // Von oben gesehen verlaufen die Ringe im Uhrzeigersinn.
  function walls(lower, upper, rgb) {
    for (let i = 0; i < lower.length; i++) {
      const j = (i + 1) % lower.length, light = 0.82 + random() * 0.27;
      triangle(lower[i], upper[i], lower[j], rgb, light);
      triangle(lower[j], upper[i], upper[j], rgb, light);
    }
  }
  function stone(rx, ry, rz, rgb, ore = false) {
    const n = 9, low = [], high = [];
    for (let i = 0; i < n; i++) {
      const a = tau * (i + random() * 0.32) / n;
      const x = Math.cos(a) * rx, z = Math.sin(a) * rz;
      low.push([x, ry * (0.2 + random() * 0.15), z]);
      high.push([x * 0.74, ry * (0.68 + random() * 0.27), z * 0.74]);
    }
    walls(low, high, rgb);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      triangle([0, 0, 0], low[i], low[j], rgb);
      const top = [0.04, ry, 0], tone = 0.86 + random() * 0.25;
      if (ore && i % 3 !== 2) {
        // Geteilte Facetten bilden bündige Erzadern.
        const edge = t => high[i].map((v,k) => v + t * (high[j][k] - v));
        const a = edge(0.29), b = edge(0.44 + random() * 0.15);
        triangle(top, a, high[i], rgb, tone);
        triangle(top, b, a, [0.82, 0.49, 0.13], tone);
        triangle(top, high[j], b, rgb, tone);
      } else triangle(top, high[j], high[i], rgb, tone);
    }
  }
  switch (art) {
    case 'erzbrocken':
      stone(0.5, 0.54, 0.41, [0.22, 0.25, 0.27], true);
      break;
    case 'quarzdruse':
      stone(0.49, 0.22, 0.4, [0.3, 0.27, 0.32]);
      for (let i = 0; i < 8; i++) {
        const a = tau * i / 7 + random() * 0.23, d = i === 7 ? 0 : 0.23;
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        const h = i === 7 ? 0.59 : 0.27 + random() * 0.23;
        const r = 0.071 + random() * 0.048, low = [], high = [];
        const rgb = [0.48 + random() * 0.22, 0.48 + random() * 0.2, 0.88];
        for (let k = 0; k < 6; k++) {
          const angle = a + tau * k / 6;
          const bx = x + r * Math.cos(angle), bz = z + r * Math.sin(angle);
          low.push([bx, 0.12, bz]);
          high.push([bx + 0.28*x, h + 0.12, bz + 0.28*z]);
        }
        walls(low, high, rgb);
        for (let k = 0; k < 6; k++)
          triangle(high[k], [1.37*x, h + 0.12 + 1.4*r, 1.37*z], high[(k+1)%6], rgb, 1.08);
      }
      break;
    case 'ammonit': {
      // Eine gerippte Röhre bildet das Spiralgehäuse.
      const tint = random() * 0.12;
      const rgb = [0.69 + tint, 0.51 + tint, 0.32 + tint];
      const sides = 7, segments = 74, phase = tau * random();
      let prev;
      for (let i = 0; i <= segments; i++) {
        const t = i / segments, a = phase + 2.15*tau*t;
        const radius = 0.018 * Math.exp(3*t);
        const width = radius * (i % 2 ? 0.36 : 0.41);
        const ring = [];
        for (let k = 0; k < sides; k++) {
          const b = tau*k/sides, radial = radius + width*Math.cos(b);
          ring.push([radial*Math.cos(a), 0.145 + width*Math.sin(b), radial*Math.sin(a)]);
        }
        if (prev) {
          for (let k = 0; k < sides; k++) {
            const j = (k+1)%sides;
            triangle(prev[k], prev[j], ring[k], rgb);
            triangle(ring[k], prev[j], ring[j], rgb);
          }
        }
        if (i === 0 || i === segments) {
          const center = [radius*Math.cos(a), 0.145, radius*Math.sin(a)];
          for (let k = 0; k < sides; k++) {
            const j = (k+1)%sides;
            triangle(center, ring[i ? k : j], ring[i ? j : k], rgb, 0.68);
          }
        }
        prev = ring;
      }
      break;
    }
    default:
      throw new RangeError('Unbekannte Fundart: ' + art);
  }
  let floor = Infinity;
  for (let i = 1; i < positions.length; i += 3) floor = Math.min(floor, positions[i]);
  for (let i = 1; i < positions.length; i += 3) positions[i] -= floor;
  return {positions, colors};
}
