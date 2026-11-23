// Gigant-Welt: neue Weltform + Biome (CPU und GLSL, gleiche Werte; Abweichung < 1 cm bei sp <= 2).
// VERTRAG (PLAN.md, D): hoeheAt/biomAt/waldAt (JS) <-> terrH/forestG (GLSL_GELAENDE). Wer die Form ändert, ändert BEIDE Seiten.
// Baut auf gn/fbm/ridged/ss aus rauschen.js auf. GLSL_GELAENDE braucht davor GLSL_NOISE (fbmG, rdgG).
// Welt (Meter): Gebirge bis ~2000 m (Domain-Warp + Grate), Flusstäler unter y=0, Seen, Terrassen-Plateaus mit Klippen,
// Wiesen-Hügelland, Dünen-Region, Küste (Ozean wo der Kontinent-Noise tief liegt).
import { fbm, ridged, ss, GLSL_NOISE } from './rauschen.js';

// Höhe in Metern. Warp zuerst, dann Kontinent + Hügel + Gebirge + Plateau + Fluss + See + Düne.
export function hoeheAt(x, z) {
  const px = x + fbm(x + 4100, z - 900, 2, 1 / 3200) * 450;
  const pz = z + fbm(x - 2300, z + 7700, 2, 1 / 3200) * 450;
  let h = fbm(px + 1000, pz - 300, 3, 1 / 9000) * 130 + 30;
  const mm = ss(.02, .38, fbm(px - 5000, pz + 2000, 2, 1 / 7500));
  h += fbm(x + 300, z + 700, 3, 1 / 800) * 36 * (1 - .5 * mm);
  if (mm > 0) { const r = ridged(px, pz, 5, 1 / 2300); h += mm * (150 + r * r * r * 2600); }
  const pm = ss(.15, .45, fbm(x + 9000, z + 9000, 2, 1 / 5000)) * (1 - mm);
  if (pm > 0) {
    const q = (fbm(px + 500, pz + 500, 2, 1 / 1400) + .7) * 3, f = q - Math.floor(q);
    h += pm * (25 + (Math.floor(q) + ss(.85, .95, f)) * 30);
  }
  const rv = Math.abs(fbm(px + 3000, pz - 6000, 3, 1 / 2600));
  const talM = 1 - mm;
  h *= 1 - .6 * (1 - ss(0, .14, rv)) * talM;
  h += ((-5) - h) * (1 - ss(0, .03, rv)) * talM;
  const b = ss(.25, .42, fbm(px + 7000, pz + 1500, 2, 1 / 1700));
  h += ((-10) - h) * b * talM;
  const dm = ss(.1, .4, fbm(x - 9000, z + 4000, 2, 1 / 6000)) * talM * (1 - b);
  if (dm > 0) h += (14 + ridged(x, z, 2, 1 / 160) * 16 - h) * dm;
  return h + fbm(x - 77, z + 33, 2, 1 / 70) * 2.5;
}

export const duneRaw = (x, z) => ss(.1, .4, fbm(x - 9000, z + 4000, 2, 1 / 6000));
const waldRoh = (x, z) => ss(-.05, .25, fbm(x + 2222, z - 1111, 3, 1 / 1300));
// Wald-Dichte 0..1 ohne Hangneigung (GPU: forestG): nicht über ~1400 m, nicht in Dünen, nicht im Wasser.
export function waldAt(x, z, h) { return waldRoh(x, z) * (1 - ss(1000, 1400, h)) * (1 - duneRaw(x, z)) * (h > 1.5 ? 1 : 0); }

// Biom-Gewichte (Summe = 1). Hang per Vorwärtsdifferenz (2 Extra-Höhen: ~3× Kosten von hoeheAt).
export function biomAt(x, z) {
  const h = hoeheAt(x, z), e = 6;
  const gx = (hoeheAt(x + e, z) - h) / e, gz = (hoeheAt(x, z + e) - h) / e;
  const slope = 1 - 1 / Math.sqrt(1 + gx * gx + gz * gz);
  const schnee = ss(950, 1250, h) * (1 - ss(.3, .55, slope));
  const fe = Math.max(ss(.25, .45, slope), ss(700, 1000, h));
  const fels = (1 - schnee) * fe;
  const sa = Math.max(1 - ss(1, 5, h), duneRaw(x, z) * (1 - ss(300, 600, h)));
  const sand = (1 - schnee - fels) * sa;
  const wald = (1 - schnee - fels - sand) * waldAt(x, z, h) * (1 - ss(.15, .3, slope));
  return { wald, wiese: 1 - schnee - fels - sand - wald, fels, sand, schnee };
}

// Deterministischer Startpunkt: spiralförmig um die Mitte, Wiese (>.6) mit Wald (>.3) im Umkreis 120 m.
export function findeStart(maxR = 4000) {
  for (let r = 0; r <= maxR; r += 100) {
    const n = Math.max(1, Math.round(r / 100) * 6);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (hoeheAt(x, z) < 3 || hoeheAt(x, z) > 300) continue;
      const w = biomAt(x, z); if (w.wiese < .6) continue;
      for (let k = 0; k < 8; k++) { const b = k * Math.PI / 4; if (biomAt(x + Math.cos(b) * 120, z + Math.sin(b) * 120).wald > .3) return { x, z, h: hoeheAt(x, z) }; }
    }
  }
  return null;
}

// GPU-Gegenstück. Nutzt fbmG/rdgG. GLSL_NOISE enthält noch das ALTE terrH/forestG -> Doppeldefinition!
// Darum GLSL_NOISE_BASIS (ohne altes terrH/forestG) voranstellen, oder gleich GLSL_GELAENDE_VOLL nehmen.
export const GLSL_NOISE_BASIS = GLSL_NOISE.slice(0, GLSL_NOISE.indexOf('float terrH'));
export const GLSL_GELAENDE = `
float terrH(vec2 p,float sp){
 vec2 w=p+vec2(fbmG(p+vec2(4100.,-900.),2,1./3200.,sp)*450.,fbmG(p+vec2(-2300.,7700.),2,1./3200.,sp)*450.);
 float px=w.x,pz=w.y;
 float h=fbmG(vec2(px+1000.,pz-300.),3,1./9000.,sp)*130.+30.;
 float mm=smoothstep(.02,.38,fbmG(vec2(px-5000.,pz+2000.),2,1./7500.,sp));
 h+=fbmG(p+vec2(300.,700.),3,1./800.,sp)*36.*(1.-.5*mm);
 if(mm>0.){float r=rdgG(vec2(px,pz),5,1./2300.,sp);h+=mm*(150.+r*r*r*2600.);}
 float pm=smoothstep(.15,.45,fbmG(p+vec2(9000.,9000.),2,1./5000.,sp))*(1.-mm);
 if(pm>0.){float q=(fbmG(vec2(px+500.,pz+500.),2,1./1400.,sp)+.7)*3.;float f=q-floor(q);
  h+=pm*(25.+(floor(q)+smoothstep(.85,.95,f))*30.);}
 float rv=abs(fbmG(vec2(px+3000.,pz-6000.),3,1./2600.,sp));
 float talM=1.-mm;
 h*=1.-.6*(1.-smoothstep(0.,.14,rv))*talM;
 h+=(-5.-h)*(1.-smoothstep(0.,.03,rv))*talM;
 float b=smoothstep(.25,.42,fbmG(vec2(px+7000.,pz+1500.),2,1./1700.,sp));
 h+=(-10.-h)*b*talM;
 float dm=smoothstep(.1,.4,fbmG(p+vec2(-9000.,4000.),2,1./6000.,sp))*talM*(1.-b);
 if(dm>0.)h+=(14.+rdgG(p,2,1./160.,sp)*16.-h)*dm;
 return h+fbmG(p+vec2(-77.,33.),2,1./70.,sp)*2.5;}
float forestG(vec2 p,float h,float sp){
 return smoothstep(-.05,.25,fbmG(p+vec2(2222.,-1111.),3,1./1300.,sp))*(1.-smoothstep(1000.,1400.,h))
  *(1.-smoothstep(.1,.4,fbmG(p+vec2(-9000.,4000.),2,1./6000.,sp)))*step(1.5,h);}
`;
export const GLSL_GELAENDE_VOLL = GLSL_NOISE_BASIS + GLSL_GELAENDE;
