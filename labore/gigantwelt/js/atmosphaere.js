/* Atmosphäre – Himmel, Wolken, Tag/Nacht, Höhennebel (Gigant-Welt, Agent C)
   Himmel = 1 Draw Call (Kugel um die Kamera, Tiefe = Far-Plane, wird nach dem Opaken gezeichnet -> kein Overdraw).
   Analytische Rayleigh/Mie-Näherung (JS rechnet Zenit-/Horizont-/Sonnenfarbe, Shader zeichnet Verlauf, Halo, Wolken, Sterne, Mond).
   Nebel: THREE.ShaderChunk fog_* global ersetzt (Höhennebel + Luftperspektive + Horizontfarbe in Blickrichtung).
   Trick: scene.fog ist ein THREE.Fog; near/far tragen Sonnen-Elevation/Azimut (Bogenmaß) in jedes Material, fogColor = Horizontfarbe.
   Vertrag: createAtmosphaere({scene,renderer,sonne,hemi}) -> { setSonne(elGrad,azGrad), setZeit(stunde), update(dt,camPos),
   sonnenRichtung, mondRichtung, dispose() }.  Muss VOR dem ersten Material-Kompilieren aufgerufen werden.
   Hinweis: wer scene.fog (FogExp2) selbst setzt, wird überschrieben; Nebeldichte per opts.nebel (Standard 9e-5). */
import * as THREE from 'three';

const R = Math.PI / 180;
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const BR = [5.8, 13.5, 33.1]; // Rayleigh-Streukoeffizienten (R,G,B), relativ
const luftmasse = y => Math.min(20, 1 / (Math.max(y, 0) + 0.05));

/* Horizontfarbe in Blickrichtung d (Sonnenseite wärmer) – identisch im Himmel und im Nebel */
export const GLSL_HORIZONT = `
vec3 atmHor(vec3 d,vec3 base,vec3 sd){
  vec2 h=d.xz,s=sd.xz;float hl=length(h),sl=length(s);
  float t=(hl>1e-3&&sl>1e-3)?max(dot(h/hl,s/sl),0.):0.;
  float y=sd.y;
  float low=smoothstep(-.14,-.02,y)*(1.-smoothstep(.0,.42,y));
  vec3 c=base+vec3(1.,.40,.13)*low*(pow(t,4.)*.85+.16*t);
  c+=vec3(.9,.78,.55)*pow(t,6.)*.10*smoothstep(0.,.3,y);
  return c;
}`;

const FOG_VERT_PARS = '#ifdef USE_FOG\nvarying float vFogDepth;varying float vFogH;varying vec3 vFogV;\n#endif';
const FOG_VERT = '#ifdef USE_FOG\nvFogDepth=-mvPosition.z;vFogV=(vec4(mvPosition.xyz,0.)*viewMatrix).xyz;' +
  'vFogH=cameraPosition.y+vFogV.y;\n#endif';
const FOG_FRAG_PARS = `#ifdef USE_FOG
uniform vec3 fogColor;uniform float fogNear;uniform float fogFar;varying float vFogDepth;varying float vFogH;varying vec3 vFogV;
${GLSL_HORIZONT}
#endif`;
const fogFrag = dichte => `#ifdef USE_FOG
vec3 fSd=vec3(cos(fogNear)*sin(fogFar),sin(fogNear),cos(fogNear)*cos(fogFar));
vec3 fVd=normalize(vFogV);
float fDn=${dichte.toFixed(8)}*(.55+1.0*exp(-max(vFogH,0.)/900.));
float fF=1.-exp(-fDn*fDn*vFogDepth*vFogDepth);
vec3 fHc=atmHor(vec3(fVd.x,0.,fVd.z),fogColor,fSd);
vec3 fC=mix(fHc,fHc*vec3(.80,.91,1.08)+fogColor*vec3(0.,.02,.07),smoothstep(.1,.8,fF));
gl_FragColor.rgb=mix(gl_FragColor.rgb*mix(vec3(1.),vec3(.86,.93,1.),fF*.6),fC,fF);
#endif`;

const SKY_VERT = `varying vec3 vD;void main(){vD=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`;
const SKY_FRAG = `precision highp float;
uniform vec3 uSun,uMoon,uZen,uHor,uSunCol,uAmb,uCam;uniform float uTime,uNight,uCover;varying vec3 vD;
${GLSL_HORIZONT}
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float h31(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
const mat2 M=mat2(1.6,1.2,-1.2,1.6);
float fbm5(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vn(p);p=M*p;a*=.5;}return s;}
float fbm3(vec2 p){float a=.5,s=0.;for(int i=0;i<3;i++){s+=a*vn(p);p=M*p;a*=.5;}return s;}
void main(){
  vec3 d=normalize(vD);float y=max(d.y,0.);
  float s=max(dot(d,uSun),0.);
  vec3 hor=atmHor(vec3(d.x,0.,d.z),uHor,uSun);
  vec3 c=mix(hor,uZen,pow(y,.42));
  if(d.y<0.)c=hor*mix(1.,.82,min(1.,-d.y*3.));
  // Sonne: Scheibe, Halo (Mie, vorwärts), Dunst
  c+=uSunCol*(pow(s,3.)*.05*(1.-y*.6)+pow(s,18.)*.30+pow(s,260.)*2.2)*(1.-uNight);
  float disk=smoothstep(.99955,.99985,s);
  vec3 cl=vec3(0.);float ca=0.;
  // Wolken (nur über dem Horizont)
  if(d.y>.004){
    float fade=smoothstep(.0,.16,d.y);
    vec2 wind=vec2(1.,.35)*uTime*.004;
    // Schicht 1: Haufenwolken, Ebene in ~1,5 km Höhe, mit Sonnenlicht
    vec2 uv=d.xz/(d.y+.11)*.55+wind+uCam.xz*.00009;
    float n=fbm5(uv*1.5),n2=fbm5((uv+uSun.xz*.09/(1.+uSun.y*2.))*1.5);
    float lo=.62-uCover*.32;
    float a=smoothstep(lo,lo+.2,n)*fade;
    float thick=smoothstep(lo,lo+.5,n);
    float lit=clamp(.62+(n-n2)*5.,0.,1.);
    vec3 lc=uSunCol*.75*vec3(1.,.9,.8)+uAmb*.45;
    vec3 sc=uAmb*.85+uSunCol*.10+uZen*.2;
    vec3 col=mix(sc,lc,lit)*(1.-.28*thick);
    col+=uSunCol*pow(s,9.)*(1.-thick)*.9;
    cl=col;ca=a*.97;
    // Schicht 2: hohe, dünne Schleierwolken (stark gestreckt), eher goldgelb vom Sonnenlicht
    vec2 uv2=d.xz/(d.y+.28)*vec2(.30,.85)+wind*1.6+vec2(7.3,2.1);
    float m=fbm3(uv2*2.2);
    float a2=smoothstep(.50,.86,m)*.55*fade*(.5+uCover);
    vec3 c2=uSunCol*.85+uAmb*.8;
    cl=mix(cl,c2,a2*(1.-ca)/(ca+a2*(1.-ca)+1e-4));ca=ca+a2*(1.-ca);
  }
  // Nacht: Sterne, Milchstraße, Mond (unter den Wolken)
  if(uNight>.01&&d.y>-.05){
    vec3 p=d*190.;vec3 cell=floor(p);float hh=h31(cell);
    vec3 f=fract(p)-.5-(vec3(h31(cell+7.1),h31(cell+3.3),h31(cell+9.9))-.5)*.5;
    float st=step(.986,hh)*smoothstep(.42,0.,length(f))*(.4+hh*hh*3.*(hh-.98)*50.);
    vec3 sc=mix(vec3(.75,.85,1.),vec3(1.,.88,.7),h31(cell+1.7));
    vec3 bn=normalize(vec3(.35,.8,.5));
    float band=exp(-pow(dot(d,bn)*3.4,2.));
    float mw=band*(.35+.65*fbm3(d.xz*9.+d.y*5.))*.05;
    float hz=smoothstep(.0,.3,d.y);
    c+=(sc*st*1.8+vec3(.55,.65,1.)*mw)*uNight*hz*(1.-ca*.9);
    float mc=dot(d,uMoon);
    if(mc>.985){
      vec3 q=d-uMoon*mc;float rr=length(q)/.032;
      c+=vec3(.45,.55,.9)*pow(max(mc,0.),400.)*.35*uNight;
      if(rr<1.){
        vec3 nn=normalize(q/.032+uMoon*sqrt(1.-rr*rr));
        float l=smoothstep(-.05,.5,dot(nn,uSun)*-.35+.7);
        float alb=.9-.28*smoothstep(.45,.7,fbm3((q.xz+q.y*.7)*60.+3.))-.07*vn((q.xz+q.y*.7)*220.);
        c=mix(c,vec3(1.,.95,.84)*alb*l*1.5,smoothstep(1.,.93,rr)*(1.-ca*.85));
      }
    }
  }
  c=mix(c,cl,ca);
  c+=uSunCol*disk*30.*(1.-ca*.92)*(1.-uNight);
  gl_FragColor=vec4(c,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createAtmosphaere({ scene, renderer, sonne, hemi, nebel = 9e-5, bewoelkung = 0.5 }) {
  const orig = ['fog_pars_vertex', 'fog_vertex', 'fog_pars_fragment', 'fog_fragment'].map(k => [k, THREE.ShaderChunk[k]]);
  THREE.ShaderChunk.fog_pars_vertex = FOG_VERT_PARS;
  THREE.ShaderChunk.fog_vertex = FOG_VERT;
  THREE.ShaderChunk.fog_pars_fragment = FOG_FRAG_PARS;
  THREE.ShaderChunk.fog_fragment = fogFrag(nebel);
  scene.fog = new THREE.Fog(0x9fb8c8, 0, 0);

  const U = {
    uSun: { value: new THREE.Vector3(0, 1, 0) }, uMoon: { value: new THREE.Vector3(0, -1, 0) },
    uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() },
    uAmb: { value: new THREE.Color() }, uCam: { value: new THREE.Vector3() },
    uTime: { value: 0 }, uNight: { value: 0 }, uCover: { value: bewoelkung },
  };
  const geo = new THREE.SphereGeometry(1000, 24, 12);
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
    side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false });
  const sky = new THREE.Mesh(geo, mat);
  sky.renderOrder = 1000; sky.frustumCulled = false; sky.name = 'himmel';
  scene.add(sky);

  const sonnenRichtung = new THREE.Vector3(0, 1, 0), mondRichtung = new THREE.Vector3(0, -1, 0);
  const tmp = new THREE.Color();

  function setSonne(elGrad, azGrad) {
    const el = elGrad * R, az = azGrad * R;
    sonnenRichtung.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
    const y = sonnenRichtung.y;
    mondRichtung.set(-sonnenRichtung.x + .35, -y + .05, -sonnenRichtung.z + .25).normalize();
    U.uSun.value.copy(sonnenRichtung); U.uMoon.value.copy(mondRichtung);
    const am = luftmasse(y), irr = ss(-.10, .03, y);
    const trans = k => BR.map(b => Math.exp(-b * .011 * am * k));
    const tSun = trans(1), tZ = trans(.14), tH = trans(.40);
    const stream = (t, dichte, s) => BR.map((b, i) => t[i] * (1 - Math.exp(-b * .0165 * dichte)) * s * irr);
    const zen = stream(tZ, 1, 1), hor = stream(tH, 7, .72);
    const nacht = 1 - ss(-.2, .0, y), daemm = ss(-.3, -.02, y) * (1 - ss(-.02, .1, y));
    const zc = [zen[0] + .0015 * nacht + .01 * daemm, zen[1] + .004 * nacht + .026 * daemm, zen[2] + .016 * nacht + .09 * daemm];
    const hc = [hor[0] + .01 * nacht + .05 * daemm, hor[1] + .02 * nacht + .06 * daemm, hor[2] + .045 * nacht + .12 * daemm];
    U.uZen.value.setRGB(zc[0], zc[1], zc[2], THREE.LinearSRGBColorSpace);
    U.uHor.value.setRGB(hc[0], hc[1], hc[2], THREE.LinearSRGBColorSpace);
    U.uSunCol.value.setRGB(tSun[0] * irr, tSun[1] * irr, tSun[2] * irr, THREE.LinearSRGBColorSpace);
    U.uAmb.value.setRGB((zc[0] + hc[0]) * .5 + .004, (zc[1] + hc[1]) * .5 + .008, (zc[2] + hc[2]) * .5 + .02, THREE.LinearSRGBColorSpace);
    U.uNight.value = ss(-.04, -.2, y);
    scene.fog.color.copy(U.uHor.value);
    scene.fog.near = el; scene.fog.far = az;
    if (sonne) {
      const m = Math.max(tSun[0], tSun[1], tSun[2]);
      sonne.color.setRGB(tSun[0] / m, tSun[1] / m, tSun[2] / m, THREE.LinearSRGBColorSpace);
      sonne.intensity = 3.2 * ss(-1, 8, elGrad);
    }
    if (hemi) {
      const t = ss(2, 40, elGrad);
      tmp.setRGB(.75 + (.74 - .75) * t, .62 + (.85 - .62) * t, .58 + (1 - .58) * t, THREE.SRGBColorSpace);
      hemi.color.copy(tmp).lerp(new THREE.Color().setRGB(.42,.55,1, THREE.SRGBColorSpace), U.uNight.value);
      hemi.intensity = (.55 + .55 * t) * (1 - U.uNight.value) + 1.6 * U.uNight.value;
    }
  }

  /* Stunde 0..24: Tag 5:30–19:30 (Höhe bis 58°), Nacht darunter bis -40° */
  function setZeit(stunde) {
    const h = ((stunde % 24) + 24) % 24, t = h < 5.5 ? h + 24 : h;
    let el, az;
    if (t <= 19.5) { el = 58 * Math.sin((t - 5.5) / 14 * Math.PI); az = 90 + (t - 5.5) / 14 * 180; }
    else { el = -40 * Math.sin((t - 19.5) / 10 * Math.PI); az = 270 + (t - 19.5) / 10 * 180; }
    setSonne(el, az % 360);
  }

  function update(dt, camPos) {
    U.uTime.value += dt;
    if (camPos) { sky.position.copy(camPos); U.uCam.value.copy(camPos); }
  }

  function dispose() {
    scene.remove(sky); geo.dispose(); mat.dispose();
    orig.forEach(([k, v]) => { THREE.ShaderChunk[k] = v; });
    scene.fog = null;
  }

  setSonne(24, 210);
  return { setSonne, setZeit, update, sonnenRichtung, mondRichtung, dispose, uniforms: U };
}
