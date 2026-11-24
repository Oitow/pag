// Lokales +Y zeigt vom Boden weg. Fische schauen nach +X. Maße in Metern.
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const arten = Object.freeze(['forelle', 'barsch', 'fichte', 'birke',
  'rohrkolben', 'seerose', 'granitblock', 'schiefer', 'steinpilz']);

// Eine Geometrie und ein Material pro Mesh. Für Gruppen gleicher Art lassen
// sich beide direkt mit THREE.InstancedMesh teilen. Aufrufer gibt beide frei.
export function baueNaturAsset(art, seed = 1) {
  if (!arten.includes(art)) throw new RangeError('Unbekannte Art: ' + art);
  let state = seed >>> 0;
  function zufall() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  }
  const teile = [];
  function teil(form, farbe, x,y,z, sx,sy,sz, rx=0,ry=0,rz=0) {
    const g = form.index ? form.toNonIndexed() : form;
    if (g !== form) form.dispose();
    g.deleteAttribute('uv');
    g.scale(sx,sy,sz).rotateX(rx).rotateY(ry).rotateZ(rz).translate(x,y,z);
    g.computeVertexNormals();
    const c = new T.Color(farbe);
    const rgb = new Float32Array(g.attributes.position.count * 3);
    for (let i=0; i<rgb.length; i+=3) c.toArray(rgb,i);
    g.setAttribute('color', new T.BufferAttribute(rgb,3));
    teile.push(g);
  }
  const kugel = () => new T.IcosahedronGeometry(1,1);
  const kegel = () => new T.ConeGeometry(1,1,8);
  const stamm = () => new T.CylinderGeometry(.8,1,1,8);
  const dreh = () => zufall()*Math.PI*2;
  if (art === 'forelle' || art === 'barsch') {
    const barsch = art === 'barsch';
    const h = barsch ? .095 : .065;
    teil(kugel(), barsch ? 0x84994c : 0x93a697,0,0,0,.23,h,.055);
    for (const s of [-1,1]) {
      teil(kegel(),0xab7350,-.236,s*.035,0,.038,.115,.012,0,0,s*.84);
      teil(kugel(),0x202722,.157,.016,s*.037,.014,.014,.009);
      for (let n=0;n<5;n++) {
        const x = (n-2)*.049;
        const z = .055*Math.sqrt(1-(x/.23)**2-.22**2);
        teil(kugel(),barsch ? 0x475736 : 0xad6250,x,.22*h,s*z,.009,barsch ? .033 : .008,.005);
      }
    }
    teil(kegel(),0x616849,-.015,h*.92,0,.067,.075,.012,0,0,.35);
  } else if (art === 'fichte') {
    teil(stamm(),0x624939,0,2,0,.19,4,.19);
    for (let i=0;i<4;i++) {
      const r = 1.45-i*.29;
      teil(kegel(),[0x254c40,0x305b46,0x39684c,0x447957][i],0,2+i*.88,0,r,2.4-i*.21,r,0,dreh());
    }
  } else if (art === 'birke') {
    teil(stamm(),0xd5d0bb,0,2.05,0,.14,4.1,.14);
    for (let i=0;i<7;i++) {
      const a=dreh();
      teil(kugel(),0x574f47,.12*Math.cos(a),.4+i*.48,.12*Math.sin(a),.067,.023,.065);
    }
    for (let i=0;i<5;i++) {
      const a=i*2.4+zufall()*.35;
      const r=i===4 ? 0 : .65;
      teil(kugel(),i%2 ? 0x719744 : 0x8eae50,r*Math.cos(a),3.75+i*.28,r*Math.sin(a),.96,1.18,.9,0,a);
    }
  } else if (art === 'rohrkolben') {
    for (let i=0;i<7;i++) {
      const a=dreh(), r=.28*zufall(), h=.8+.65*zufall();
      const x=r*Math.cos(a), z=r*Math.sin(a);
      teil(stamm(),0x78944c,x,h/2,z,.012,h,.012);
      teil(kugel(),0x74472e,x,h-.08,z,.032,.14,.032);
      teil(kegel(),0x567c41,x+.09,.35,z,.027,.73,.016,0,a,-.24);
    }
  } else if (art === 'seerose') {
    teil(new T.CylinderGeometry(1,1,1,16,1,false,.2,5.88),0x487c53,0,.009,0,.22,.018,.2);
    for (let i=0;i<8;i++) {
      const a=i*Math.PI/4;
      teil(kugel(),0xffe6ee,.047*Math.cos(a),.041,.047*Math.sin(a),.065,.022,.027,0,-a);
    }
    teil(kugel(),0xf5bb45,0,.055,0,.035,.024,.035);
  } else if (art === 'steinpilz') {
    teil(stamm(),0xdfcaa2,0,.075,0,.037,.15,.037);
    teil(new T.SphereGeometry(1,12,5,0,Math.PI*2,0,Math.PI/2),0x966039,0,.13,0,.1,.066,.092);
    teil(kugel(),0xcdba88,0,.13,0,.1,.012,.092);
  } else {
    const schiefer = art === 'schiefer';
    const g = new T.IcosahedronGeometry(1,schiefer ? 0 : 1);
    const p = g.attributes.position, phase=dreh();
    let tief=Infinity;
    for (let i=0;i<p.count;i++) {
      const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
      const r=1+.14*Math.sin(x*4+phase)*Math.cos(z*5-y);
      const hoehe=y*r*(schiefer ? .22 : .73)+x*.09;
      p.setXYZ(i,x*r,hoehe,z*r*.78);
      tief=Math.min(tief,hoehe);
    }
    teil(g,schiefer ? 0x536273 : 0x928b82,0,-tief,0,1,1,1,0,dreh());
  }
  const geometrie=mergeGeometries(teile);
  teile.forEach(g=>g.dispose());
  const mesh=new T.Mesh(geometrie,new T.MeshStandardMaterial({vertexColors:true,roughness:.94}));
  mesh.name=art;
  return mesh;
}
