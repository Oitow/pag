// Gigant-Welt: Rauschen + Höhenfunktion (CPU und GLSL, bit-gleich).
// VERTRAG: heightAt/forestRaw (JS) und terrH/forestG (GLSL_NOISE) müssen exakt dieselben Werte liefern.
// Wer die Form ändert, ändert BEIDE Seiten. FRAG_COMMON = gemeinsame Terrain-Farbe (terrCol) für Clipmap + Voxel.
/* ================= NOISE (CPU) – bit-identisch zur GPU-Version ================= */
export const COS = new Float64Array(256), SIN = new Float64Array(256);
for (let i = 0; i < 256; i++) { const a = i * (Math.PI * 2 / 256); COS[i] = Math.cos(a); SIN[i] = Math.sin(a); }
export function hidx(x, y) { let h = Math.imul(x, 0x8da6b343) ^ Math.imul(y, 0xd8163841); h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return h & 255; }
export function gn(x, y) {
  const X = Math.floor(x), Y = Math.floor(y), fx = x - X, fy = y - Y, ix = X + 65536, iy = Y + 65536;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  let h = hidx(ix, iy); const a = COS[h] * fx + SIN[h] * fy;
  h = hidx(ix + 1, iy); const b = COS[h] * (fx - 1) + SIN[h] * fy;
  h = hidx(ix, iy + 1); const c = COS[h] * fx + SIN[h] * (fy - 1);
  h = hidx(ix + 1, iy + 1); const d = COS[h] * (fx - 1) + SIN[h] * (fy - 1);
  return 1.414 * (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v);
}
export const LAC = 1.97;
export function fbm(x, y, oct, fr) { let a = .5, s = 0, n = 0; for (let i = 0; i < oct; i++) { n += a; s += a * gn(x * fr, y * fr); fr *= LAC; a *= .5; } return s / n; }
export function ridged(x, y, oct, fr) { let a = .5, s = 0, n = 0, pr = 1; for (let i = 0; i < oct; i++) { n += a; let r = 1 - Math.abs(gn(x * fr, y * fr)); r *= r; s += a * r * pr; pr = Math.min(1, r * 1.5); fr *= LAC; a *= .5; } return s / n; }
export const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function heightAt(x, z) {
  const cont = fbm(x + 1000, z - 300, 4, 1 / 9000);
  const mm = ss(.05, .4, fbm(x - 5000, z + 2000, 3, 1 / 7000));
  const r = ridged(x, z, 6, 1 / 2600);
  const hills = fbm(x + 300, z + 700, 4, 1 / 800);
  const det = fbm(x - 77, z + 33, 3, 1 / 70);
  return cont * 160 + 15 + mm * (120 + r * r * r * 1300) + hills * 40 * (1 - .5 * mm) + det * 2.5;
}
export const forestRaw = (x, z) => ss(-.02, .22, fbm(x + 2222, z - 1111, 3, 1 / 1300));
export function forestAt(x, z, h) { return forestRaw(x, z) * (1 - ss(380, 520, h)) * (h > 1.5 ? 1 : 0); }

export function rngFrom(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const cellSeed = (cx, cz, k) => (Math.imul(cx + 77777, 0x27d4eb2d) ^ Math.imul(cz + 99991, 0x165667b1) ^ Math.imul(k, 0x9e3779b9)) >>> 0;

/* ================= NOISE (GPU) ================= */
export const GLSL_NOISE = `
uint hsh(int x,int y){uint h=(uint(x+65536)*0x8da6b343u)^(uint(y+65536)*0xd8163841u);h^=h>>13u;h*=0x5bd1e995u;h^=h>>15u;return h&255u;}
float gd(uint h,vec2 f){float a=float(h)*0.02454369260617026;return cos(a)*f.x+sin(a)*f.y;}
float gn(vec2 p){vec2 i=floor(p);vec2 f=p-i;int x=int(i.x),y=int(i.y);vec2 u=f*f*f*(f*(f*6.-15.)+10.);
 float a=gd(hsh(x,y),f),b=gd(hsh(x+1,y),f-vec2(1.,0.)),c=gd(hsh(x,y+1),f-vec2(0.,1.)),d=gd(hsh(x+1,y+1),f-vec2(1.,1.));
 return 1.414*(a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y);}
float ow(float fr,float sp){return clamp(1./(fr*sp*2.)-1.,0.,1.);}
float fbmG(vec2 p,int oct,float fr,float sp){float a=.5,s=0.,n=0.;for(int i=0;i<8;i++){if(i>=oct)break;n+=a;float w=ow(fr,sp);if(w>0.)s+=a*w*gn(p*fr);fr*=1.97;a*=.5;}return s/n;}
float rdgG(vec2 p,int oct,float fr,float sp){float a=.5,s=0.,n=0.,pr=1.;for(int i=0;i<8;i++){if(i>=oct)break;n+=a;float w=ow(fr,sp);if(w>0.){float r=1.-abs(gn(p*fr));r*=r;s+=a*w*r*pr;pr=min(1.,r*1.5);}fr*=1.97;a*=.5;}return s/n;}
float terrH(vec2 p,float sp){
 float cont=fbmG(p+vec2(1000.,-300.),4,1./9000.,sp);
 float mm=smoothstep(.05,.4,fbmG(p+vec2(-5000.,2000.),3,1./7000.,sp));
 float r=rdgG(p,6,1./2600.,sp);
 float hills=fbmG(p+vec2(300.,700.),4,1./800.,sp);
 float det=fbmG(p+vec2(-77.,33.),3,1./70.,sp);
 return cont*160.+15.+mm*(120.+r*r*r*1300.)+hills*40.*(1.-.5*mm)+det*2.5;}
float forestG(vec2 p,float h,float sp){return smoothstep(-.02,.22,fbmG(p+vec2(2222.,-1111.),3,1./1300.,sp))*(1.-smoothstep(380.,520.,h))*step(1.5,h);}
`;

export const FRAG_COMMON = `
uniform vec3 uCam;uniform float uTreeR;
float h12(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h12(i),h12(i+vec2(1,0)),f.x),mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x),f.y);}
vec3 terrCol(vec3 w,vec3 n,float F,float tDist){
 float slope=1.-n.y;float hh=w.y;
 float v1=vn(w.xz*.09)*.55+vn(w.xz*.012)*.45;
 float nearF=1.-smoothstep(25.,140.,tDist);
 float v2=vn(w.xz*.9);
 vec3 col=mix(vec3(.30,.42,.12),vec3(.43,.49,.17),v1);
 col=mix(col,vec3(.56,.51,.29),smoothstep(.62,.9,v1)*.45);
 col*=mix(1.,.82+.36*v2,nearF);
 col=mix(col,vec3(.21,.22,.10)*(.85+.3*v1),F*.85);
 vec3 rock=mix(vec3(.45,.42,.38),vec3(.31,.29,.27),v1);
 col=mix(col,rock,smoothstep(.27,.44,slope+(v1-.5)*.12));
 col=mix(vec3(.74,.68,.50),col,smoothstep(.8,3.2,hh+v1*1.5));
 float snow=smoothstep(640.,740.,hh+v1*70.)*(1.-smoothstep(.38,.62,slope));
 col=mix(col,vec3(.92,.94,.98),snow);
 float farF=F*smoothstep(uTreeR*.55,uTreeR*.95,tDist)*(1.-snow);
 return mix(col,vec3(.12,.21,.07)*(.8+.4*v1),farF*.92);}
`;

