import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { rng } from '../../engine/core/rng.js';
import { baueNaturAsset } from '../erde/naturfundus/naturfundus.mjs';
import { baueGruppe } from './gruppen.js';
import { createMond } from './mond.js';

const canvas=document.querySelector('canvas'), renderer=new T.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFSoftShadowMap;
const scene=new T.Scene(), camera=new T.PerspectiveCamera(52,1,.1,1500);
const orbit=new OrbitControls(camera,canvas);
orbit.enablePan=false; orbit.minDistance=4; orbit.maxDistance=32; orbit.maxPolarAngle=Math.PI*.49;
const sonne=new T.DirectionalLight(0xffdda3,2);
sonne.position.set(-12,15,-8); sonne.castShadow=true;
Object.assign(sonne.shadow.camera,{left:-20,right:20,top:20,bottom:-20,far:65});
sonne.shadow.mapSize.set(1024,1024); sonne.shadow.normalBias=.035;
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
    gruppe.traverse(o=>{o.geometry?.dispose();o.material?.dispose();if(o.isInstancedMesh)o.dispose();});
  }
  gruppe=new T.Group();scene.add(gruppe);wasser=null;
  const ort=wahl.selectedIndex,z=rng(899+ort);
  function boden(x,v){
    const wellen=.13*Math.sin(x*.64+v*.25)+.09*Math.cos(v*.53);
    if(ort===0)return .24*x+.32*Math.sin(v*.29)+wellen;
    if(ort===1)return .18*Math.sin(x*.4)+wellen;
    return .23*x+.13*v+wellen;
  }
  const geo=new T.PlaneGeometry(80,80,100,100).rotateX(-Math.PI/2);
  const p=geo.attributes.position,farben=[];
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),v=p.getZ(i),y=boden(x,v);p.setY(i,y);
    const farbe=new T.Color(ort===0?(y<.38?0x726956:0x656b42):ort===1?0x514635:0x66665c);
    farbe.multiplyScalar(.88+.12*Math.sin(x*.7+v*.8)+.09*z()).toArray(farben,i*3);
  }
  geo.setAttribute('color',new T.Float32BufferAttribute(farben,3));geo.computeVertexNormals();
  const grund=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true}));grund.receiveShadow=true;gruppe.add(grund);
  if(ort===0){
    wasser=new T.Mesh(new T.PlaneGeometry(80,80).rotateX(-Math.PI/2),new T.MeshPhongMaterial({color:0x476e6c,transparent:true,opacity:.76,shininess:84,depthWrite:false}));
    gruppe.add(wasser);
  }
  const lagen=new Map();
  function setzen(art,x,v,s,y=boden(x,v)){
    const key=art+'|'+Math.floor(z()*2);
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
      else if(w<.1&&v<-3)setzen('birke',x,v,s);
      else if(w<.40)setzen('wollgras',x,v,s);
    }else if(ort===1){
      if(w<.19 && (v<-5||Math.abs(x)>6))setzen(w<.14?'fichte':'birke',x,v,s*1.4);
      else if(w<.25)setzen('pilzholz',x,v,s);
      else if(w<.44)setzen('steinpilz',x,v,s*1.5);
    }else if(w<.38)setzen(w<.23?'flechtenbank':'schiefer',x,v,s*(1+.5*Math.sin(v)));
    else if(w>.96&&v<-4)setzen('fichte',x,v,s);
  }
  for(const [key,liste] of lagen){
    const [art,seed]=key.split('|');
    const quelle=(gruppen.has(art)?baueGruppe:baueNaturAsset)(art,13+Number(seed)*877);
    const mesh=new T.InstancedMesh(quelle.geometry,quelle.material,liste.length);
    liste.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=true;mesh.receiveShadow=true;gruppe.add(mesh);
  }
  orbit.target.set(0,1.3,-2);camera.position.set(4.4,3.5,8.3);orbit.update();zeichnen();
}
function licht(){
  zeit.textContent=nacht?'Mondnacht':'Abendsonne';zeit.setAttribute('aria-label','Beleuchtung wechseln, aktuell '+zeit.textContent);
  const farbe=nacht?0x202e48:0xd4b999;
  scene.background=new T.Color(farbe);scene.fog=new T.FogExp2(farbe,nacht?.041:.027);
  sonne.intensity=nacht?0:2.3;sonne.castShadow=!nacht;himmel.intensity=nacht?.31:1.05;zeichnen();
}
wahl.onchange=laden;zeit.onclick=()=>{nacht=!nacht;licht();};
function groesse(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();zeichnen();}
addEventListener('resize',groesse);groesse();laden();licht();
orbit.addEventListener('change',zeichnen);
function zeichnen(){
  sonnenrichtung.copy(sonne.position).normalize();
  mond.update({kamera:camera.position,richtung,sonne:sonnenrichtung,oben,nacht:nacht?1:0,anker});
  renderer.render(scene,camera);
}
