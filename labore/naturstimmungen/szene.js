import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { rng } from '../../engine/core/rng.js';
import { baueNaturAsset } from '../../engine/models/natur/naturfundus.js';
import { baueGruppe } from '../../engine/models/natur/landschaftsgruppen.js';
import { baueAstbaum, baueAstbaumFern } from '../../engine/models/natur/astbaum.js';
import { bodentextur, detailArten, detailGeometrie } from './details.js';
import { createMond } from '../../engine/render/mond.js';

const canvas=document.querySelector('canvas'), renderer=new T.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(pointer: coarse)').matches?1.25:1.6));
renderer.shadowMap.enabled=true;
renderer.shadowMap.autoUpdate=false;
const mobil=matchMedia('(pointer: coarse)').matches;
const texturen=new Map();
const detailMaterial=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.93});
const holzMaterial=new T.MeshStandardMaterial({vertexColors:true,map:bodentextur(3),roughness:.94});
renderer.shadowMap.type=T.PCFSoftShadowMap;
const scene=new T.Scene(), camera=new T.PerspectiveCamera(52,1,.1,1500);
const orbit=new OrbitControls(camera,canvas);
orbit.enablePan=false; orbit.minDistance=4; orbit.maxDistance=32; orbit.maxPolarAngle=Math.PI*.49;
const sonne=new T.DirectionalLight(0xffdda3,2);
sonne.position.set(-12,15,-8); sonne.castShadow=true;
Object.assign(sonne.shadow.camera,{left:-20,right:20,top:20,bottom:-20,far:65});
sonne.shadow.mapSize.set(mobil?512:1024,mobil?512:1024); sonne.shadow.normalBias=.035;
const himmel=new T.HemisphereLight(0xcbdce7,0x72674c,1);
scene.add(sonne,himmel);
const mond=createMond(scene), oben=new T.Vector3(0,1,0), anker=new T.Vector3();
const richtung=new T.Vector3(-.27,.26,-1).normalize(), sonnenrichtung=new T.Vector3();
const wahl=document.querySelector('select'), zeit=document.querySelector('#zeit');
let gruppe, nacht=false, wasser;
const params=new URLSearchParams(location.search);
wahl.selectedIndex=Math.max(0,['ufer','wald','hang'].indexOf(params.get('ort')));
nacht=params.get('licht')==='mond';
const gruppen=new Set(['pilzholz','wollgras','flechtenbank']);
function laden(){
  if(gruppe){
    scene.remove(gruppe);
    gruppe.traverse(o=>{o.geometry?.dispose();if(o.material!==detailMaterial&&o.material!==holzMaterial)o.material?.dispose();if(o.isInstancedMesh)o.dispose();});
  }
  gruppe=new T.Group();scene.add(gruppe);wasser=null;
  const ort=wahl.selectedIndex,z=rng(899+ort);
  function boden(x,v){
    const wellen=.13*Math.sin(x*.64+v*.25)+.09*Math.cos(v*.53);
    if(ort===0)return .24*x+.32*Math.sin(v*.29)+wellen;
    if(ort===1)return .18*Math.sin(x*.4)+wellen;
    return .23*x+.13*v+wellen;
  }
  const geo=new T.PlaneGeometry(80,80,80,80).rotateX(-Math.PI/2);
  const p=geo.attributes.position,farben=[];
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),v=p.getZ(i),y=boden(x,v);p.setY(i,y);
    const farbe=new T.Color(ort===0?(y<.38?0x726956:0x656b42):ort===1?0x514635:0x66665c);
    farbe.multiplyScalar(.88+.12*Math.sin(x*.7+v*.8)+.09*z()).toArray(farben,i*3);
  }
  geo.setAttribute('color',new T.Float32BufferAttribute(farben,3));geo.computeVertexNormals();
  if(!texturen.has(ort)) texturen.set(ort,bodentextur(ort));
  const grund=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,map:texturen.get(ort),roughness:.94}));grund.receiveShadow=true;gruppe.add(grund);
  if(ort===0){
    wasser=new T.Mesh(new T.PlaneGeometry(80,80).rotateX(-Math.PI/2),new T.MeshPhongMaterial({color:0x476e6c,transparent:true,opacity:.76,shininess:84,depthWrite:false}));
    gruppe.add(wasser);
  }
  const lagen=new Map();
  const baumarten=new Set(['birke','eiche','weide','kiefer']);
  function setzen(art,x,v,s,y=boden(x,v)){
    const nah=baumarten.has(art)&&Math.hypot(x,v+2)<(mobil?8:12);
    const variante=Math.floor(z()*2);
    const key=art+'|'+(baumarten.has(art)?0:variante)+'|'+Number(nah);
    if(!lagen.has(key))lagen.set(key,[]);
    const o=new T.Object3D();o.position.set(x,y,v);o.rotation.y=z()*Math.PI*2;o.scale.setScalar(s);o.updateMatrix();
    lagen.get(key).push(o.matrix);
  }
  for(let i=0;i<720;i++){
    const x=z()*44-22,v=z()*42-28,y=boden(x,v),w=z(),s=.7+.65*z();
    if(ort===0){
      if(y<-.85)continue;
      if(y<-.15){if(w<.27)setzen('seerose',x,v,s,.014);}
      else if(y<.65)setzen(w<.55?'rohrkolben':'wollgras',x,v,s);
      else if(w<.1&&v<-3)setzen(y<1.6?'weide':'birke',x,v,s*.77);
      else if(w<.40)setzen('wollgras',x,v,s);
    }else if(ort===1){
      if(w<.19 && (v<-5||Math.abs(x)>6))setzen(w<.075?'fichte':w<.125?'birke':w<.162?'eiche':'kiefer',x,v,s*.92);
      else if(w<.25)setzen('pilzholz',x,v,s);
      else if(w<.44)setzen('steinpilz',x,v,s*1.5);
    }else if(w<.38)setzen(w<.23?'flechtenbank':'schiefer',x,v,s*(1+.5*Math.sin(v)));
    else if(w>.96&&v<-4)setzen('fichte',x,v,s);
  }
  const staffage=[
    ['schilf','sumpfdotter','geroell','bruchast'],
    ['farn','laub','totholz','bruchast','efeu'],
    ['steinrose','geroell','bruchast','efeu'],
  ][ort];
  for(let i=0;i<(mobil?105:155);i++){
    const x=z()*24-12,v=z()*24-15,y=boden(x,v);
    if(ort===0&&y<.05) continue;
    const art=staffage[Math.floor(z()*staffage.length)];
    setzen(art,x,v,.67+z()*.76,y);
  }
  for(const [key,liste] of lagen){
    const [art,variante,nah]=key.split('|');
    const seed=13+Number(variante)*877;
    let geometrie, material;
    if(baumarten.has(art)){
      geometrie=nah==='1'
        ? baueAstbaum(art,seed,{detail:mobil?1:2,dichte:mobil?.62:.83}).geometrie
        : baueAstbaumFern(art,seed);
      material=detailMaterial;
    }else if(detailArten.has(art)){
      geometrie=detailGeometrie(art,seed);
      material=art==='bruchast'||art==='totholz'?holzMaterial:detailMaterial;
    }else{
      const quelle=(gruppen.has(art)?baueGruppe:baueNaturAsset)(art,seed);
      geometrie=quelle.geometry;
      material=quelle.material;
    }
    const mesh=new T.InstancedMesh(geometrie,material,liste.length);
    liste.forEach((m,i)=>mesh.setMatrixAt(i,m));
    mesh.instanceMatrix.needsUpdate=true;
    mesh.castShadow=!detailArten.has(art)&&art!=='wollgras'&&art!=='rohrkolben'&&art!=='seerose';
    mesh.receiveShadow=true;
    gruppe.add(mesh);
  }
  renderer.shadowMap.needsUpdate=true;
  orbit.target.set(0,1.3,-2);camera.position.set(4.4,3.5,8.3);orbit.update();zeichnen();
}
function licht(){
  zeit.textContent=nacht?'Mondnacht':'Abendsonne';zeit.setAttribute('aria-label','Beleuchtung wechseln, aktuell '+zeit.textContent);
  const farbe=nacht?0x202e48:0xd4b999;
  scene.background=new T.Color(farbe);scene.fog=new T.FogExp2(farbe,nacht?.041:.027);
  sonne.intensity=nacht?0:2.3;sonne.castShadow=!nacht;himmel.intensity=nacht?.31:1.05;
  renderer.shadowMap.needsUpdate=true;
  zeichnen();
}
let frame=0;
wahl.onchange=laden;zeit.onclick=()=>{nacht=!nacht;licht();};
function groesse(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();zeichnen();}
addEventListener('resize',groesse);groesse();laden();licht();
orbit.addEventListener('change',zeichnen);
function zeichnen(){
  if(frame) return;
  frame=requestAnimationFrame(()=>{
    frame=0;
    sonnenrichtung.copy(sonne.position).normalize();
    mond.update({kamera:camera.position,richtung,sonne:sonnenrichtung,oben,nacht:nacht?1:0,anker});
    renderer.render(scene,camera);
  });
}
