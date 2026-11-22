// Platzhalter: steht am Spawn, Kamera schaut über die Landschaft.
export async function init(ctx) {
  const { THREE, camera, planet } = ctx;
  const pos = planet.surfacePoint(planet.spawnDir.clone());
  const up = pos.clone().normalize();
  camera.position.copy(pos).addScaledVector(up, 12);
  camera.up.copy(up);
  camera.lookAt(pos.clone().add(new THREE.Vector3(1, 0, 0).multiplyScalar(30)));
  return { pos, up, forward: new THREE.Vector3(1, 0, 0), inWasser: false, reitet: false, update() {}, teleport() {}, save() { return null; }, load() {} };
}
