// Ein kompakter Übungshof. Geländeabfrage und sichtbares Gitter nutzen dieselbe Hügelform.
import * as THREE from 'three';

export function createParcours() {
  const gruppe = new THREE.Group();
  const halb = 14, deck = 2.8;
  function huegel(x, z) {
    const t = Math.max(0, 1 - ((x + 6) / 4.8) ** 2 - ((z + 4) / 5.5) ** 2);
    return 2.2 * t * t;
  }
  function bodenHoehe(x, z) {
    return x >= 2 && x <= 6 && z >= -7 && z <= -4 ? deck : huegel(x, z);
  }
  const geometrie = new THREE.PlaneGeometry(halb * 2, halb * 2, 56, 56);
  geometrie.rotateX(-Math.PI / 2);
  const p = geometrie.attributes.position;
  const farben = [], farbe = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = huegel(x,z);
    p.setY(i,y);
    farbe.set(y > 0.04 ? '#798655' : Math.abs(x) < 1.6 ? '#b59f78' : '#879475');
    farben.push(farbe.r, farbe.g, farbe.b);
  }
  geometrie.setAttribute('color', new THREE.Float32BufferAttribute(farben,3));
  geometrie.computeVertexNormals();
  const boden = new THREE.Mesh(geometrie, new THREE.MeshStandardMaterial({vertexColors:true}));
  boden.receiveShadow = true;
  gruppe.add(boden);
  // Ein Zeichenaufruf für Podest, Holme, Sprossen und Einfassung.
  const teile = [[4,deck/2,-5.5,4,deck,3,'#716959']];
  for (const x of [3.48,4.52]) teile.push([x,1.55,-3.89,.12,3.1,.14,'#614c38']);
  for (let i=1;i<=8;i++) teile.push([4,i*.34,-3.83,1.04,.09,.13,'#c4a879']);
  for (const s of [-halb,halb]) {
    teile.push([s,.12,0,.18,.24,28,'#60594d'],[0,.12,s,28,.24,.18,'#60594d']);
  }
  const holz = new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial(),teile.length);
  const objekt = new THREE.Object3D();
  teile.forEach(([x,y,z,b,h,t,c],i) => {
    objekt.position.set(x,y,z); objekt.scale.set(b,h,t); objekt.updateMatrix();
    holz.setMatrixAt(i,objekt.matrix); holz.setColorAt(i,farbe.set(c));
  });
  holz.castShadow = holz.receiveShadow = true;
  gruppe.add(holz);
  function hindernisse(x,z,r,filter) {
    const limit = halb-r;
    let dx = THREE.MathUtils.clamp(x,-limit,limit)-x, dz = THREE.MathUtils.clamp(z,-limit,limit)-z;
    if ((filter?.y ?? 0) < deck && x > 2-r && x < 6+r && z > -7-r && z < -4+r) {
      const abstand = [x-(2-r),6+r-x,z-(-7-r),-4+r-z];
      const seite = abstand.indexOf(Math.min(...abstand));
      if (seite < 2) dx += seite === 0 ? -abstand[0] : abstand[1];
      else dz += seite === 2 ? -abstand[2] : abstand[3];
    }
    return dx || dz ? {x:dx,z:dz} : null;
  }
  return { gruppe, kletterWelt: { bodenHoehe: huegel, hindernisse }, adapter:{bodenHoehe,hindernisse,wasserHoehe:()=>null}, schlachtfeld:{x:0,z:0,halb},
    dispose() { gruppe.traverse(o=>{o.geometry?.dispose();o.material?.dispose();}); holz.dispose(); gruppe.removeFromParent(); } };
}
