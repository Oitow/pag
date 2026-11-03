// Himmel, Sterne, Mond, Atmosphäre, Licht und Nebel – passend zu Tageszeit und Kamerahöhe.
export function createHimmel(ctx, R) {
  const { THREE, scene, camera } = ctx;
  const smooth = THREE.MathUtils.smoothstep;
  const gruppe = new THREE.Group(); gruppe.name = 'pl-himmel';
  scene.add(gruppe);

  // ---------- Himmelskuppel (folgt der Kamera) ----------
  const kuppelU = {
    uSun: { value: new THREE.Vector3(0, 1, 0) }, uUp: { value: new THREE.Vector3(0, 1, 0) },
    uZenit: { value: new THREE.Color() }, uHorizont: { value: new THREE.Color() }, uGlut: { value: new THREE.Color() },
    uSonne: { value: new THREE.Color() }, uOrbit: { value: 0 }, uDip: { value: 0 },
    uWasser: { value: 0 }, uWasserFarbe: { value: new THREE.Color() },
  };
  const kuppel = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.ShaderMaterial({
    uniforms: kuppelU, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: `varying vec3 vDir;
      void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 uSun, uUp, uZenit, uHorizont, uGlut, uSonne, uWasserFarbe; uniform float uOrbit, uDip, uWasser;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float e = dot(d, uUp) + uDip;           // Höhe über dem geometrischen Horizont
        float sd = dot(d, uSun);
        vec3 col = mix(uHorizont, uZenit, smoothstep(0.0, 0.55, e));
        col = mix(col, uHorizont * 0.75, smoothstep(0.0, -0.35, e));
        float g = pow(max(sd, 0.0), 5.0) * (1.0 - smoothstep(-0.05, 0.45, e));
        col += uGlut * g;
        col += uGlut * 0.25 * (1.0 - smoothstep(-0.1, 0.25, e)) * (0.5 + 0.5 * sd);
        col = mix(col, vec3(0.0), uOrbit);
        float disc = smoothstep(0.99955, 0.9998, sd);
        col += uSonne * (disc * 6.0 + pow(max(sd, 0.0), 900.0) * 0.6 + pow(max(sd, 0.0), 40.0) * 0.1 * (1.0 - uOrbit * 0.6));
        col = mix(col, uWasserFarbe * (0.6 + 0.6 * smoothstep(-0.5, 0.8, dot(d, uUp))), uWasser);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  kuppel.frustumCulled = false; kuppel.renderOrder = -100;
  gruppe.add(kuppel);

  // ---------- Sterne ----------
  const SN = 1800, sp = new Float32Array(SN * 3), sc = new Float32Array(SN * 3);
  const rnd = ctx.rng || Math.random;
  for (let i = 0; i < SN; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    sp[i * 3] = Math.cos(a) * r; sp[i * 3 + 1] = u; sp[i * 3 + 2] = Math.sin(a) * r;
    const b = 0.35 + Math.pow(rnd(), 3) * 0.9, t = rnd();
    sc[i * 3] = b * (t < 0.2 ? 1 : 0.85 + 0.15 * t); sc[i * 3 + 1] = b * 0.92; sc[i * 3 + 2] = b * (t > 0.8 ? 1.1 : 0.95);
  }
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  const sMat = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const sterne = new THREE.Points(sGeo, sMat);
  sterne.frustumCulled = false; sterne.renderOrder = -99;
  gruppe.add(sterne);

  // ---------- Mond ----------
  const mond = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.MeshBasicMaterial({ color: 0xdfe6f0, fog: false, transparent: true, depthWrite: false }));
  mond.renderOrder = -98; mond.frustumCulled = false;
  gruppe.add(mond);

  // ---------- Atmosphäre (Saum aus dem Orbit) ----------
  const AR = R + 140;
  const atmoU = { uSun: { value: new THREE.Vector3() }, uStaerke: { value: 0 }, uR: { value: R } };
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(AR, 96, 48), new THREE.ShaderMaterial({
    uniforms: atmoU, side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uSun; uniform float uStaerke, uR; varying vec3 vW;
      void main(){
        vec3 v = normalize(vW - cameraPosition);
        float t = -dot(cameraPosition, v);
        vec3 cp = cameraPosition + v * t;          // nächster Punkt des Strahls zur Mitte
        float dmin = length(cp);
        float licht, a;
        if (gl_FrontFacing && dmin < uR) {
          // Dunst über der Planetenscheibe, zum Rand hin stärker
          vec3 n = normalize(vW);
          float rim = 1.0 - max(dot(-v, n), 0.0);
          a = pow(rim, 3.0) * 0.55 + 0.03;
          licht = smoothstep(-0.25, 0.35, dot(n, uSun));
        } else {
          if (gl_FrontFacing) discard;
          float hgt = max(dmin - uR, 0.0);
          a = exp(-hgt / 16.0) * 0.9;
          licht = smoothstep(-0.3, 0.3, dot(normalize(cp), uSun));
        }
        vec3 blau = vec3(0.28, 0.55, 1.0);
        vec3 rot = vec3(1.0, 0.45, 0.2);
        float term = 1.0 - smoothstep(0.0, 0.5, licht) * smoothstep(1.0, 0.5, licht) * 0.0;
        vec3 col = mix(rot, blau, smoothstep(0.15, 0.6, licht)) * licht * a * uStaerke;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  atmo.renderOrder = 10; atmo.frustumCulled = false;
  scene.add(atmo);

  // ---------- Lichter ----------
  const sonne = new THREE.DirectionalLight(0xffffff, 2.6);
  const mondLicht = new THREE.DirectionalLight(0x9fb4e6, 0.35);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x4a4a3a, 1.0);
  scene.add(sonne, sonne.target, mondLicht, mondLicht.target, hemi);
  sonne.target.position.set(0, 0, 0); mondLicht.target.position.set(0, 0, 0);

  scene.fog = new THREE.Fog(0x9cc0e8, 80, 420);
  scene.background = new THREE.Color(0x000000);

  // Farben (linear)
  const C = (r, g, b) => new THREE.Color(r, g, b);
  const zenitTag = C(0.10, 0.30, 0.78), horiTag = C(0.55, 0.72, 0.95);
  const zenitNacht = C(0.004, 0.007, 0.022), horiNacht = C(0.012, 0.02, 0.045);
  const glutC = C(1.0, 0.36, 0.10), sonneC = C(1.0, 0.92, 0.75);
  const lichtAbend = C(1.0, 0.55, 0.3), lichtTag = C(1.0, 0.97, 0.9);
  const wasserTief = C(0.012, 0.07, 0.13);
  const tmpC = new THREE.Color(), v1 = new THREE.Vector3(), up = new THREE.Vector3();

  const info = { tag: 1, horizont: new THREE.Color(), zenit: new THREE.Color(), orbit: 0, sonnenFarbe: new THREE.Color(), unterWasser: false };

  // sunDir: Richtung zur Sonne; ort: Bezugspunkt fürs Licht (Spieler oder Kamera)
  function update(sunDir, ort, moonDir) {
    const camP = camera.position, camD = camP.length();
    up.copy(camP).normalize();
    const alt = camD - R;
    const orbit = smooth(alt, 140, 520);
    info.orbit = orbit;
    const ortUp = v1.copy(ort).normalize();
    // Sonnenhöhe am Ort (am Boden) bzw. an der Kamera
    const el = THREE.MathUtils.lerp(ortUp.dot(sunDir), up.dot(sunDir), orbit);
    const tag = smooth(el, -0.14, 0.22);
    info.tag = tag;
    const glutW = Math.exp(-Math.pow((el - 0.02) / 0.13, 2));

    info.zenit.copy(zenitNacht).lerp(zenitTag, tag);
    info.horizont.copy(horiNacht).lerp(horiTag, tag);
    info.horizont.lerp(tmpC.copy(glutC).multiplyScalar(0.9), glutW * 0.45);

    // Kuppel
    kuppel.position.copy(camP);
    kuppel.scale.setScalar(camera.far * 0.9);
    kuppelU.uSun.value.copy(sunDir); kuppelU.uUp.value.copy(up);
    kuppelU.uZenit.value.copy(info.zenit); kuppelU.uHorizont.value.copy(info.horizont);
    kuppelU.uGlut.value.copy(glutC).multiplyScalar(glutW * 0.9);
    kuppelU.uSonne.value.copy(sonneC).lerp(glutC, glutW * 0.5 * (1 - orbit));
    kuppelU.uOrbit.value = orbit;
    kuppelU.uDip.value = camD > R ? Math.sin(Math.acos(Math.min(1, R / camD))) * 0.9 : 0;

    // Sterne: drehen mit der Sonne, sichtbar nachts und im All
    sterne.position.copy(camP);
    sterne.scale.setScalar(camera.far * 0.85);
    sterne.rotation.y = Math.atan2(sunDir.x, sunDir.z);
    sMat.opacity = Math.max(orbit * 0.95, 1 - smooth(tag, 0.0, 0.45));
    sterne.visible = sMat.opacity > 0.01;

    // Mond
    const md = camera.far * 0.8;
    mond.position.copy(camP).addScaledVector(moonDir, md);
    mond.scale.setScalar(md * 0.016);
    mond.material.opacity = Math.max(orbit, 1 - tag * 0.75); mond.visible = true;

    // Atmosphäre aus dem All
    atmoU.uSun.value.copy(sunDir);
    atmoU.uStaerke.value = smooth(alt, 160, 420) * 1.0;
    atmo.visible = atmoU.uStaerke.value > 0.005;

    // Lichter
    sonne.position.copy(sunDir).multiplyScalar(1000);
    info.sonnenFarbe.copy(lichtAbend).lerp(lichtTag, smooth(el, 0.0, 0.35)).lerp(lichtTag, orbit);
    sonne.color.copy(info.sonnenFarbe);
    sonne.intensity = 2.7 * THREE.MathUtils.lerp(smooth(el, -0.12, 0.05), 1, orbit);
    mondLicht.position.copy(moonDir).multiplyScalar(1000);
    mondLicht.intensity = 0.4 * (1 - tag * 0.8);
    hemi.position.copy(ortUp).lerp(sunDir, orbit).normalize();
    hemi.color.copy(info.zenit).lerp(tmpC.setRGB(0.8, 0.88, 1), 0.45).multiplyScalar(1);
    hemi.groundColor.setRGB(0.28, 0.26, 0.2).multiplyScalar(0.2 + 0.8 * tag);
    hemi.intensity = THREE.MathUtils.lerp(0.5 + 1.5 * tag, 0.3 + 0.2 * tag, orbit);

    // Nebel: am Boden Dunst in Horizontfarbe, im All praktisch aus
    const fog = scene.fog;
    info.unterWasser = camD < R - 0.2 && (ctx.planet?.heightAt ? ctx.planet.heightAt(up) < -0.2 + (camD - R) : true);
    kuppelU.uWasser.value = info.unterWasser ? 1 : 0;
    if (info.unterWasser) {
      fog.color.copy(wasserTief).multiplyScalar(0.3 + 0.7 * tag);
      kuppelU.uWasserFarbe.value.copy(fog.color);
      sterne.visible = false; mond.visible = false;
      fog.near = 0; fog.far = 45;
    } else {
      fog.color.copy(info.horizont);
      const a = Math.max(0, alt);
      fog.near = 30 + a * 2.5;
      fog.far = 500 + a * 3 + 4000 * orbit;
    }
    return info;
  }
  return { update, info, sonne, hemi, mondLicht };
}
