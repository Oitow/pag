/**
 * @modul    naturfundus
 * @zweck    Kleiner Naturfundus: Fichte, Birke, Felsblöcke, Uferpflanzen, Steinpilz, Fische – je ein Mesh mit Vertexfarben, Fußpunkt im Ursprung, Meter
 * @api      arten ; baueNaturAsset(art, seed=1) -> THREE.Mesh (Aufrufer gibt Geometrie + Material frei)
 * @beispiel
 *   import { baueNaturAsset } from '../../engine/models/natur/naturfundus.js'; const m = baueNaturAsset('fichte', 3);
 * @tags     natur, baum, fels, pflanze, fisch, asset
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
// Lokales +Y zeigt vom Boden weg. Fische schauen nach +X. Maße in Metern.
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const arten = Object.freeze(['forelle', 'barsch', 'fichte', 'birke',
  'rohrkolben', 'seerose', 'granitblock', 'schiefer', 'steinpilz']);

// Eine Geometrie und ein Material pro Mesh. Für Gruppen gleicher Art lassen
// sich beide direkt mit THREE.InstancedMesh teilen. Aufrufer gibt beide frei.
export function baueNaturAsset(art, seed = 1, { fern = false } = {}) {
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
    const hoehe = 5.6, ansatz = 0.95 + zufall() * 0.85;
    const breite = 1.35 + zufall() * 0.55, phase = dreh();
    teil(new T.CylinderGeometry(.018, .19, hoehe, fern ? 5 : 8), 0x645343,
      0, hoehe / 2, 0, 1, 1, 1);
    const positionen = [], farben = [];
    const dunkel = new T.Color(0x294239), hell = new T.Color(0x688064);
    function dreieck(a, b, c, ton) {
      const farbe = dunkel.clone().lerp(hell, ton);
      positionen.push(...a, ...b, ...c);
      for (let e = 0; e < 3; e++) farben.push(farbe.r, farbe.g, farbe.b);
    }
    // Jeder Wedel verzweigt sich seitlich und hängt in der Mitte durch.
    // Die grobe Stufe behält dieselben Astachsen und Kronenlücken.
    for (let etage = 0; etage < 10; etage++) {
      const t = etage / 10, y = ansatz + (hoehe - ansatz) * t;
      const anzahl = 5 + (etage % 3);
      for (let ast = 0; ast < anzahl; ast++) {
        const winkel = phase + etage * 2.4 + (ast + zufall() * .45) * 2 * Math.PI / anzahl;
        const laenge = breite * (1 - t) ** .72 * (.75 + zufall() * .4);
        const ton = .15 + .35 * t + .25 * zufall(), versatz = (zufall() - .5) * .25;
        const punkt = (u, quer, hoch) => {
          const r = u * laenge, q = quer * laenge;
          return [Math.cos(winkel) * r - Math.sin(winkel) * q,
            y + versatz + laenge * (.16 * u - .31 * Math.sin(Math.PI * u) + hoch),
            Math.sin(winkel) * r + Math.cos(winkel) * q];
        };
        const segmente = fern ? 2 : 5;
        for (let k = 0; k < segmente; k++) {
          const u = k / segmente, v = (k + 1) / segmente;
          const f = (.12 + .23 * Math.sin(Math.PI * v)) * (1 - u);
          const innen = punkt(u, 0, .04), spitze = punkt(v, 0, .015);
          for (const seite of [-1, 1]) {
            const rand = punkt(v + .06, seite * f, -.12 * (1 - u));
            const unten = punkt(u, 0, -.065);
            const links = seite < 0;
            dreieck(innen, links ? spitze : rand, links ? rand : spitze, ton + .08 * u);
            dreieck(unten, links ? rand : spitze, links ? spitze : rand, ton * .45);
          }
        }
      }
    }
    const wedel = new T.BufferGeometry();
    wedel.setAttribute('position', new T.Float32BufferAttribute(positionen, 3));
    wedel.setAttribute('color', new T.Float32BufferAttribute(farben, 3));
    wedel.computeVertexNormals();
    teile.push(wedel);
  } else if (art === 'birke') {
    teil(stamm(),0xd5d0bb,0,2.05,0,.14,4.1,.14);
    for (let i=0;i<7;i++) {
      const a=dreh();
      teil(kugel(),0x574f47,.1*Math.cos(a),.4+i*.48,.1*Math.sin(a),.05,.02,.05); // Rindenfleck, liegt am Stamm an
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
