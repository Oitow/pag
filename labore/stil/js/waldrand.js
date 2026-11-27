import * as T from 'three';
import { rng } from '../../../engine/core/rng.js';
import { createHaus } from '../../../engine/models/bau/haus.js';
import { createLagerfeuer } from '../../../engine/models/bau/licht.js';
import { erzeuge } from '../../../engine/models/natur/fels.js';
import { baueAstbaum, baueAstbaumFern } from '../../../engine/models/natur/astbaum.js';
import { createRiesenbaum } from '../../../engine/models/natur/riesenbaum.js';
import { createSplatDaten, saatAufNetz } from '../../../engine/render/gauss-saat.js';
import { createGaussWolke } from '../../../engine/render/gauss-wolke.js';
import { createCharacterModel } from '../../../engine/models/character/character-model.js';
import { VORLAGEN } from '../../../engine/models/character/character-look.js';

export function waldrand(szene, material) {
  const r = rng(710), flaechen = [];
  const leuchten = new T.MeshBasicMaterial({vertexColors:true});
  const lage = new T.Object3D();
  function setzen(obj, x, y, z, winkel = 0) {
    obj.position.set(x,y,z);
    obj.rotation.y = winkel;
    szene.add(obj);
    return obj;
  }
  function mesh(geo, x, y, z, winkel = 0, mat = material) {
    const obj = setzen(new T.Mesh(geo,mat), x,y,z,winkel);
    if (mat === material) flaechen.push(obj);
    obj.receiveShadow = obj.castShadow = true;
    return obj;
  }
  function instanzen(geo, anzahl, platzieren) {
    const gruppe = new T.InstancedMesh(geo,material,anzahl);
    for (let i=0;i<anzahl;i++) {
      platzieren(i,lage);
      lage.updateMatrix();
      gruppe.setMatrixAt(i,lage.matrix);
    }
    szene.add(gruppe);
    flaechen.push(gruppe);
    return gruppe;
  }
  function hoehe(x,z) {
    const rand = T.MathUtils.smoothstep(Math.hypot(x,z),12,57);
    return rand*(1.8 + 2.1*Math.sin(x*.085)+2*Math.cos(z*.11)+1.2*Math.sin(x*.13+z*.18));
  }
  const boden = new T.PlaneGeometry(510,510,200,200);
  boden.rotateX(-Math.PI/2);
  const pos = boden.attributes.position, farben = [], farbe = new T.Color();
  const pfad = z => Math.sin(z*.14)*1.6;
  for (let i=0;i<pos.count;i++) {
    const x=pos.getX(i), z=pos.getZ(i);
    pos.setY(i,hoehe(x,z));
    const abstand=Math.abs(x-pfad(z));
    farbe.set(abstand<2.3?'#857256':'#59603e').multiplyScalar(.78+.25*r()+.12*Math.sin(x*.36)*Math.cos(z*.45));
    farben.push(farbe.r,farbe.g,farbe.b);
  }
  boden.setAttribute('color',new T.Float32BufferAttribute(farben,3));
  boden.computeVertexNormals();
  mesh(boden,0,-.02,0).castShadow=false;

  const haus = createHaus({seed:13});
  mesh(haus.geometrie,3.5,0,-4,-.26);
  mesh(haus.leucht,3.5,0,-4,-.26,leuchten);
  const feuer = createLagerfeuer({seed:5});
  mesh(feuer.geometrie,.8,0,3);
  mesh(feuer.leucht,.8,0,3,0,leuchten);
  const glut = new T.PointLight(0xff9a42,16,8);
  setzen(glut,.8,.8,3);
  const figur = createCharacterModel({look:VORLAGEN.wanderer,seed:2,mimik:false});
  const box = new T.Box3().setFromObject(figur.root);
  const skala = 1.8/(box.max.y-box.min.y);
  figur.root.scale.setScalar(skala);
  setzen(figur.root,-.8,-box.min.y*skala,3.5,1.3);

  const riese = createRiesenbaum({seed:44,hoehe:48,stammRadius:2.6,wurzelWeite:8,detail:0});
  const stamm = mesh(riese.geometrie,-6,0,-8);
  stamm.updateMatrixWorld();
  const krone = createGaussWolke({max:riese.splats.anzahl});
  krone.fuege(riese.splats,{matrix:stamm.matrixWorld});
  szene.add(krone.mesh);

  const moos = createGaussWolke({max:1200});
  for (const [x,z,s] of [[-3,2,1.55],[5,4,.95],[-4,6,.55]]) {
    const g = erzeuge('findling',Math.floor(80*s),{gestein:'granit',detail:2,moos:.25}).geometrie;
    const fels=mesh(g,x,0,z);
    fels.scale.setScalar(s);
    fels.updateMatrixWorld();
    const saat = createSplatDaten();
    saatAufNetz(saat,{position:g.attributes.position.array,normal:g.attributes.normal.array,index:g.index?.array},{
      seed:42,anzahl:390,groesse:[.035,.13],farbe:(_x,_y,_z,_nx,ny,_nz,u)=>ny>.28?[.06+u*.04,.13+u*.06,.04]:null});
    moos.fuege(saat.fertig(),{matrix:fels.matrixWorld});
  }
  szene.add(moos.mesh);
  for (const wolke of [krone,moos]) wolke.setze({nebelFarbe:szene.fog.color,nebelDichte:szene.fog.density,wind:0});

  for (let art=0;art<4;art++) {
    const typ = art%2?'kiefer':'eiche';
    const nah = art<2;
    const g = nah?baueAstbaum(typ,19+art,{detail:1}).geometrie:baueAstbaumFern(typ,31+art);
    g.computeBoundingBox();
    const h=g.boundingBox.max.y;
    instanzen(g,nah?26:160,(i,o)=>{
      const a=r()*Math.PI*2, d=nah?23+r()*36:66+r()*139;
      const x=Math.cos(a)*d,z=Math.sin(a)*d;
      o.position.set(x,hoehe(x,z)-.2,z);
      o.scale.setScalar((9+r()*13)/h);
      o.rotation.y=r()*6.28;
    });
  }
  const halm = new T.BufferGeometry();
  const p=[], c=[];
  for(let i=0;i<9;i++){
    const x=(r()-.5)*.35,z=(r()-.5)*.35,a=r()*6.28,w=.025+r()*.025,h=.14+r()*.34;
    p.push(x-w*Math.cos(a),0,z-w*Math.sin(a),x+w*Math.cos(a),0,z+w*Math.sin(a),x+.11*Math.sin(a),h,z+.11*Math.cos(a));
    c.push(.042,.065,.022,.055,.075,.025,.23,.26,.085);
  }
  halm.setAttribute('position',new T.Float32BufferAttribute(p,3));
  halm.setAttribute('color',new T.Float32BufferAttribute(c,3));
  halm.computeVertexNormals();
  instanzen(halm,8000,(_i,o)=>{
    let x,z;
    do {x=r()*50-25;z=r()*50-25;} while(Math.abs(x-pfad(z))<1.25);
    o.position.set(x,hoehe(x,z),z);
    o.rotation.y=r()*6.28;
    o.scale.setScalar(.65+r()*.95);
  }).receiveShadow=true;
  return {flaechen,krone,moos};
}
