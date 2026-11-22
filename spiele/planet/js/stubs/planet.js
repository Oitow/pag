// Platzhalter, falls planet.js fehlt/abstürzt: glatte Kugel mit etwas Noise.
import { createNoise3D, fbm } from '../noise.js';
export async function init(ctx) {
  const { THREE, R, scene } = ctx;
  const n = createNoise3D(ctx.seed);
  const heightAt = d => fbm(n, d.x * 3, d.y * 3, d.z * 3, 4) * 40 + 5;
  const geo = new THREE.SphereGeometry(R, 128, 64);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); v.multiplyScalar(R + Math.max(heightAt(v), -60)); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x6a9a4a })));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.2));
  const sunDir = new THREE.Vector3(0.4, 0.8, 0.5).normalize();
  const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.copy(sunDir).multiplyScalar(2000); scene.add(sun);
  scene.background = new THREE.Color(0x87b5e0);
  const spawnDir = new THREE.Vector3(0, 0, 1);
  return {
    R, heightAt, spawnDir, sunDir, tageszeit: 0.3,
    istNacht: () => false,
    biomeAt: d => heightAt(d) < 0 ? 'ozean' : 'wiese',
    ringAt: d => THREE.MathUtils.radToDeg(d.angleTo(spawnDir)),
    surfacePoint(d, out = new THREE.Vector3()) { return out.copy(d).normalize().multiplyScalar(R + heightAt(d)); },
    normalAt(d, out = new THREE.Vector3()) { return out.copy(d).normalize(); },
    update() {},
  };
}
