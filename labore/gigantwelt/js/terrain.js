// Gigant-Welt: GPU-Clipmap-Terrain (10 LOD-Ringe) + Wasserebene.
// createTerrain(K) -> { LEVELS, water, build(N), update(x, z), levels (Getter), markMaterials() }
// Nutzt K: scene, U (uCam, uTime, uMask …). Terrain-Shader blendet über U.uMask die Voxel-Zone aus.
import * as THREE from 'three';
import { GLSL_NOISE, FRAG_COMMON } from './welt.js';

// Schneegrenze für die neue Weltform (Gebirge bis ~2200 m): Schnee ab ~800-1050 m. voxel.js braucht dieselbe Ersetzung.
// Schneegrenze für das neue Gelände: angepasst zentral in welt.js (gilt auch für Voxel).

export function createTerrain(K) {
  const { scene, U } = K;
  const LEVELS = 10, BASE = 1;
  /* ================= TERRAIN: GPU-Clipmap mit 10 LOD-Ringen ================= */
  let levels = [];
  function makeTerrainMat(lv) {
    const m = new THREE.MeshLambertMaterial();
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, lv.u, U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
  uniform vec2 uCenter;uniform float uSpacing;uniform float uHalf;varying vec3 vW;varying vec3 vNw;varying float vF;
  ${GLSL_NOISE}`)
        .replace('#include <beginnormal_vertex>', `
  vec2 lp=position.xz;
  float gx=floor(lp.x/uSpacing+.5),gz=floor(lp.y/uSpacing+.5);
  float dd=max(abs(lp.x),abs(lp.y));
  float morph=smoothstep(uHalf*.62,uHalf*.94,dd);
  lp.x-=(gx-2.*floor(gx*.5))*uSpacing*morph;
  lp.y-=(gz-2.*floor(gz*.5))*uSpacing*morph;
  vec2 wp=lp+uCenter;
  float tSp=uSpacing*(1.+morph);
  float tH=terrH(wp,tSp);
  float tHx=terrH(wp+vec2(tSp,0.),tSp),tHz=terrH(wp+vec2(0.,tSp),tSp);
  vec3 objectNormal=normalize(vec3(tH-tHx,tSp,tH-tHz));
  vec3 tPos=vec3(lp.x,tH,lp.y);
  vW=vec3(wp.x,tH,wp.y);vNw=objectNormal;vF=forestG(wp,tH,tSp);`)
        .replace('#include <begin_vertex>', 'vec3 transformed=tPos;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
  uniform vec2 uInner;uniform float uInnerHalf;uniform sampler2D uMask;uniform vec2 uMaskO;varying vec3 vW;varying vec3 vNw;varying float vF;
  ${FRAG_COMMON}
  float mk(vec2 w){vec2 c=(w-uMaskO)/16.;if(c.x<0.||c.y<0.||c.x>=32.||c.y>=32.)return 0.;return texelFetch(uMask,ivec2(c),0).r;}`)
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
  if(uInnerHalf>0.){vec2 q=abs(vW.xz-uInner);if(max(q.x,q.y)<uInnerHalf)discard;}
  if(mk(vW.xz)>.5&&mk(vW.xz+vec2(.6,0.))>.5&&mk(vW.xz-vec2(.6,0.))>.5&&mk(vW.xz+vec2(0.,.6))>.5&&mk(vW.xz-vec2(0.,.6))>.5)discard;
  vec3 n=normalize(vNw);float tDist=length(vW.xz-uCam.xz);
  vec4 diffuseColor=vec4(pow(terrCol(vW,n,vF,tDist),vec3(2.2)),1.);`);
    };
    m.customProgramCacheKey = () => 'terrain-v4';
    return m;
  }
  function buildTerrain(N) {
    for (const l of levels) { scene.remove(l.mesh); l.mesh.geometry.dispose(); l.mesh.material.dispose(); }
    levels = [];
    for (let L = 0; L < LEVELS; L++) {
      const s = BASE * Math.pow(2, L), half = N * s / 2;
      const pos = new Float32Array((N + 1) * (N + 1) * 3), nor = new Float32Array(pos.length);
      for (let j = 0, k = 0; j <= N; j++) for (let i = 0; i <= N; i++, k += 3) { pos[k] = (i - N / 2) * s; pos[k + 2] = (j - N / 2) * s; nor[k + 1] = 1; }
      const idx = [], hh = L > 0 ? half / 2 - 2 * s : -1;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x0 = (i - N / 2) * s, z0 = (j - N / 2) * s;
        if (L > 0 && x0 >= -hh && x0 + s <= hh && z0 >= -hh && z0 + s <= hh) continue;
        const a = j * (N + 1) + i, b = a + N + 1, c = a + 1, d = b + 1;
        idx.push(a, b, c, c, b, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setIndex(idx);
      const lv = { L, s, half, cx: 0, cz: 0, u: { uCenter: { value: new THREE.Vector2() }, uSpacing: { value: s }, uHalf: { value: half }, uInner: { value: new THREE.Vector2() }, uInnerHalf: { value: 0 } } };
      const mesh = new THREE.Mesh(g, makeTerrainMat(lv));
      mesh.frustumCulled = false; mesh.receiveShadow = true;
      lv.mesh = mesh; levels.push(lv); scene.add(mesh);
    }
  }
  function updateTerrain(cx, cz) {
    for (const lv of levels) {
      const st = 2 * lv.s;
      lv.cx = Math.floor(cx / st) * st; lv.cz = Math.floor(cz / st) * st;
      lv.mesh.position.set(lv.cx, 0, lv.cz);
      lv.u.uCenter.value.set(lv.cx, lv.cz);
    }
    for (let i = 1; i < levels.length; i++) {
      const inn = levels[i - 1];
      levels[i].u.uInner.value.set(inn.cx, inn.cz);
      levels[i].u.uInnerHalf.value = inn.half - inn.s * .5;
    }
  }

  /* ================= WASSER ================= */
  const water = new THREE.Mesh(new THREE.PlaneGeometry(120000, 120000).rotateX(-Math.PI / 2),
    new THREE.MeshPhongMaterial({ color: 0x1b4552, specular: 0x9ab8c0, shininess: 140, transparent: true, opacity: .86 }));
  water.material.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWw;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWw=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWw;uniform float uTime;\n' + FRAG_COMMON)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {vec2 p=vWw.xz;float t=uTime;float amp=.55*(1.-smoothstep(250.,2200.,length(p-uCam.xz)));
  vec2 q1=p*.23+vec2(t*.35,t*.21),q2=p*.9+vec2(-t*.6,t*.5);
  float a=vn(q1)*.7+vn(q2)*.3;
  float dx=vn(q1+vec2(.06,0.))*.7+vn(q2+vec2(.06,0.))*.3-a,dz=vn(q1+vec2(0.,.06))*.7+vn(q2+vec2(0.,.06))*.3-a;
  vec3 nw=normalize(vec3(-dx*amp*9.,1.,-dz*amp*9.));
  normal=normalize((viewMatrix*vec4(nw,0.)).xyz);}`);
  };
  water.material.customProgramCacheKey = () => 'water-v2';
  water.frustumCulled = false;
  scene.add(water);

  function update(x, z) {
    updateTerrain(x, z);
    water.position.set(Math.round(x / 100) * 100, 0, Math.round(z / 100) * 100);
  }
  function markMaterials() {
    water.material.needsUpdate = true;
    for (const l of levels) l.mesh.material.needsUpdate = true;
  }
  return { LEVELS, water, build: buildTerrain, update, get levels() { return levels; }, markMaterials };
}
