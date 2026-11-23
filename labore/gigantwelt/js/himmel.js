// Gigant-Welt: Himmel, Sonne, Höhennebel, Licht, Pollen.
// createHimmel(K) -> { setSun(elGrad, azGrad), placeShadowCam(), follow(pos), updatePollen(now, dt), pollen, sunDir }
// Setzt K.hemi, K.sun, K.SH. Nutzt K: scene, camera, $, Q, shadowsOn, pos.
import * as THREE from 'three';
import { ss } from './rauschen.js';

export function createHimmel(K) {
  const { scene, camera, $, pos } = K;
  // Höhennebel + Luftperspektive: Fog-Chunks global ersetzen (Welt-Höhe aus View-Matrix, auch für Instanzen)
  THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\nvarying float vFogDepth;varying float vFogH;\n#endif';
  THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\nvFogDepth=-mvPosition.z;vFogH=cameraPosition.y+dot(vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]),mvPosition.xyz);\n#endif';
  THREE.ShaderChunk.fog_pars_fragment = '#ifdef USE_FOG\nuniform vec3 fogColor;varying float vFogDepth;varying float vFogH;uniform float fogDensity;\n#endif';
  THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
  float fdn=fogDensity*(.55+.9*exp(-max(vFogH,0.)/320.));
  float fogFactor=1.-exp(-fdn*fdn*vFogDepth*vFogDepth);
  vec3 fogC=mix(fogColor,fogColor*vec3(.78,.9,1.15)+vec3(0.,.01,.04),fogFactor*.65);
  gl_FragColor.rgb=mix(gl_FragColor.rgb,fogC,fogFactor);
  #endif`;

  const hemi = new THREE.HemisphereLight(0xbcd8ff, 0x46553a, 1.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 3.0);
  sun.castShadow = K.shadowsOn;
  const SH = 115;
  Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 1600 });
  sun.shadow.mapSize.set(K.Q.shadow || 1024, K.Q.shadow || 1024);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.4;
  sun.shadow.camera.layers.enable(1);
  scene.add(sun, sun.target);
  K.hemi = hemi; K.sun = sun; K.SH = SH;

  /* ================= HIMMEL ================= */
  const skyU = { uSun: { value: new THREE.Vector3(0, 1, 0) }, uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: `varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform vec3 uSun,uZen,uHor,uSunCol;varying vec3 vD;
    void main(){vec3 d=normalize(vD);float y=max(d.y,0.);vec3 c=mix(uHor,uZen,pow(y,.45));
    if(d.y<0.)c=uHor*mix(1.,.8,min(1.,-d.y*3.));
    float s=max(dot(d,uSun),0.);c+=uSunCol*(pow(s,6.)*.18+pow(s,80.)*.7)+uSunCol*smoothstep(.9995,.9998,s)*12.;
    gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`
  }));
  sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);

  const sunDir = new THREE.Vector3();
  function setSun(elDeg, azDeg) {
    const el = elDeg * Math.PI / 180, az = azDeg * Math.PI / 180;
    sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
    skyU.uSun.value.copy(sunDir);
    const t = ss(2, 40, elDeg);
    const lerp3 = (a, b) => a.map((v, i) => v + (b[i] - v) * t);
    const sc = lerp3([1.0, .55, .32], [1.0, .95, .86]);
    sun.color.setRGB(sc[0], sc[1], sc[2], THREE.SRGBColorSpace);
    sun.intensity = 3.2 * ss(-1, 8, elDeg);
    skyU.uSunCol.value.copy(sun.color);
    const hor = lerp3([.86, .64, .50], [.66, .77, .87]);
    const zen = lerp3([.28, .36, .58], [.24, .44, .78]);
    skyU.uHor.value.setRGB(hor[0], hor[1], hor[2], THREE.SRGBColorSpace);
    skyU.uZen.value.setRGB(zen[0], zen[1], zen[2], THREE.SRGBColorSpace);
    scene.fog.color.copy(skyU.uHor.value);
    const hs = lerp3([.75, .62, .58], [.74, .85, 1.0]);
    hemi.color.setRGB(hs[0], hs[1], hs[2], THREE.SRGBColorSpace);
    hemi.intensity = .55 + .55 * t;
    $('sunV').textContent = elDeg + '°';
  }

  function placeShadowCam() {
    const c = camera.position, d = sunDir;
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), d).normalize();
    const up = new THREE.Vector3().crossVectors(d, right).normalize();
    const tex = 2 * SH / sun.shadow.mapSize.x;
    const a = Math.round(c.dot(right) / tex) * tex, b = Math.round(c.dot(up) / tex) * tex, w = c.dot(d);
    const ctr = right.multiplyScalar(a).add(up.multiplyScalar(b)).add(d.clone().multiplyScalar(w));
    sun.target.position.copy(ctr); sun.position.copy(ctr).addScaledVector(d, 800);
  }

  /* ================= POLLEN ================= */
  const PN = 500, pp = new Float32Array(PN * 3), pv = new Float32Array(PN * 3);
  for (let i = 0; i < PN * 3; i++) { pp[i] = (Math.random() - .5) * 60; pv[i] = (Math.random() - .5) * .4; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const pcv = document.createElement('canvas'); pcv.width = pcv.height = 32;
  { const c = pcv.getContext('2d'), gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32); }
  const pollen = new THREE.Points(pg, new THREE.PointsMaterial({ size: .12, map: new THREE.CanvasTexture(pcv), color: 0xfff0c0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }));
  pollen.frustumCulled = false; scene.add(pollen);

  function follow(p) { sky.position.copy(p); }
  function updatePollen(now, dt) {
    if (!pollen.visible) return;
    for (let i = 0; i < PN; i++) {
      const o = i * 3;
      for (let a = 0; a < 3; a++) {
        pp[o + a] += (pv[o + a] + Math.sin(now * .0004 + i + a) * .15) * dt;
        const c = [pos.x, pos.y, pos.z][a], hw = a === 1 ? 15 : 30;
        if (pp[o + a] < c - hw) pp[o + a] += 2 * hw; else if (pp[o + a] > c + hw) pp[o + a] -= 2 * hw;
      }
    }
    pg.attributes.position.needsUpdate = true;
  }
  return { setSun, placeShadowCam, follow, updatePollen, pollen, sunDir };
}
