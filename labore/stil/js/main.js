import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { materialien } from './material.js';
import { waldrand } from './waldrand.js';

function starten() {
  const canvas = document.querySelector('canvas');
  const renderer = new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  const szene = new T.Scene();
  szene.fog = new T.FogExp2(0xa9afa1,.009);
  const kamera = new T.PerspectiveCamera(50,1,.12,1550);
  const kontrolle = new OrbitControls(kamera,canvas);
  kontrolle.enablePan=false;
  kontrolle.minDistance=5;
  kontrolle.maxDistance=65;
  kontrolle.maxPolarAngle=Math.PI*.496;
  const sky = new T.Mesh(new T.SphereGeometry(700,32,14),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,
    vertexShader:'varying vec3 dir; void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 dir;void main(){vec3 d=normalize(dir);
      float sun=max(dot(d,normalize(vec3(-.54,.24,-.8))),0.);
      vec3 col=mix(vec3(.49,.52,.44),vec3(.09,.19,.23),smoothstep(-.02,.85,d.y));
      col+=vec3(.6,.32,.11)*pow(sun,15.)+vec3(1.,.74,.45)*smoothstep(.9993,.9998,sun);
      gl_FragColor=vec4(col,1.);
      #include <colorspace_fragment>
    }`}));
  szene.add(sky,new T.HemisphereLight(0xe3ebe4,0x756248,1.45));
  const sonne = new T.DirectionalLight(0xffda9c,2.3);
  sonne.position.set(-25,27,12);
  sonne.castShadow=true;
  Object.assign(sonne.shadow.camera,{left:-20,right:20,top:22,bottom:-20,near:.5,far:90});
  sonne.shadow.mapSize.set(1024,1024);
  sonne.shadow.normalBias=.035;
  szene.add(sonne);
  const mat=materialien(), wald=waldrand(szene,mat);
  const params=new URLSearchParams(location.search);
  function ansicht() {
    const nah=params.get('ort')==='feuer';
    kontrolle.target.set(0,nah?1:2.3,nah?2.8:0);
    kamera.position.set(nah?3:7,nah?2.4:4.6,nah?8:innerWidth<innerHeight?23:15);
    kontrolle.update();
  }
  function groesse() {
    renderer.setSize(innerWidth,innerHeight,false);
    kamera.aspect=innerWidth/innerHeight;
    kamera.updateProjectionMatrix();
  }
  groesse();
  ansicht();
  window.addEventListener('resize',groesse);
  document.querySelector('#ansicht').onclick=ansicht;
  const werte=document.querySelector('#werte');
  const zahlen=new Intl.NumberFormat('de-DE');
  let start=0,bilder=0,aktuell;
  function look(wert,adresse) {
    aktuell=['a','b','c'].includes(wert)?wert:'a';
    for(const obj of wald.flaechen) obj.material=mat[aktuell];
    wald.moos.mesh.visible=aktuell==='c';
    for(const button of document.querySelectorAll('[data-look]'))
      button.setAttribute('aria-pressed',String(button.dataset.look===aktuell));
    if(adresse && location.protocol!=='file:') {
      const url=new URL(location.href);
      url.searchParams.set('look',aktuell);
      history.replaceState(null,'',url);
    }
    bilder=0; start=0;
    werte.textContent='Messung läuft …';
  }
  for(const button of document.querySelectorAll('[data-look]')) button.onclick=()=>look(button.dataset.look,true);
  look(params.get('look'),false);
  renderer.shadowMap.needsUpdate=true;
  document.addEventListener('visibilitychange',()=>{start=0;bilder=0;});
  renderer.setAnimationLoop(t=>{
    kamera.updateMatrixWorld();
    wald.krone.update(kamera,0,canvas.width,canvas.height);
    if(wald.moos.mesh.visible) wald.moos.update(kamera,0,canvas.width,canvas.height);
    renderer.render(szene,kamera);
    if(!start){start=t;return;}
    bilder++;
    if(t-start<950) return;
    const {render,memory}=renderer.info;
    const fps=Math.round(1000*bilder/(t-start));
    werte.textContent=fps+' FPS · '+render.calls+' Draw-Calls · '+zahlen.format(render.triangles)+' △ · '+memory.geometries+' Geometrien · '+memory.textures+' Texturen';
    bilder=0; start=t;
  });
  document.querySelector('#meldung').textContent='';
}
try { starten(); } catch(e) {
  console.error(e);
  document.querySelector('#meldung').textContent='Das Stil-Labor konnte nicht starten. '+e.message;
}
