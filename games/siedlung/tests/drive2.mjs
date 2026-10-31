// Umfassender Smoke-Test: SEED, MIN (sim. Minuten), LSFILE (Spielstand), PHASE=save|load
import fs from 'fs';
await import('./run.mjs');const {els}=await import('./stub.mjs');
const T=globalThis.__T;let now=0;
const t0=Date.now();
function frames(n){for(let i=0;i<n;i++){now+=33;const f=T.rafs.shift();if(f)f(now);}}
const S=T.W.start;
function tryBuild(type){const s=T.DEF[type].size||1;for(let r=1;r<22;r++)for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;const tx=S[0]+dx,tz=S[1]+dz;
  const o=(s-1)>>1;if(T.canPlace(type,tx-o,tz-o)){T.setMode(type);T.showGhost(tx,tz);const n=T.buildings.length;T.confirmBuild();if(T.buildings.length>n){T.setMode(null);return T.buildings.at(-1);}}}T.setMode(null);return null;}
const rich=()=>{for(const k in T.res)T.res[k]=Math.max(T.res[k],200);};
console.log('seed',T.W.seed,'loaded',T.loadedSave,'npcs',T.npcs.length,'b',T.buildings.length);
frames(30);
if(process.env.PHASE!=='load'){
  const c=tryBuild('cutter'),g=tryBuild('gather');console.log('early',!!c,!!g,JSON.stringify(T.res));
  frames(30*120);console.log('after 2min wood',T.res.wood,'stone',T.res.stone);
  rich();T.level=2;
  const list=['quarry','house','fisher','well','hunter','farm','sawmill','mill','bakery','market','beet','lantern','house2','store'];
  const got={};for(const t of list){const b=tryBuild(t);got[t]=b?'ok':'--';}
  console.log('built',JSON.stringify(got));
  // Sheet / UI
  for(const c of ['wohnen','roh','nahrung','prod','deko'])T.toggleSheet(c);T.toggleSheet('deko');
  // Wege malen über direkte API + paintAt
  let pv=0;for(let k=0;k<12;k++)if(T.paveTile(S[0]-6+k,S[1]-4,true))pv++;
  T.setMode('path');T.painting=true;T.paintErase=null;T.lastPaint=-1;for(let i=0;i<20;i++)T.paintAt(100+i*10,400+i*5);T.setMode(null);
  console.log('paved',pv,'total',T.paveList.length);
  // schnelle Fertigstellung aller Baustellen
  for(const b of T.buildings)if(!b.done)T.finishBuilding(b,true);
  T.setSpeed(3);
  const mins=+(process.env.MIN||8);
  for(let m=0;m<mins;m++){frames(30*60/3);if(m%2==0)rich();}
  console.log('after',mins,'min x3: npcs',T.npcs.length,'hap',T.hap.toFixed(1),'lvl',T.level,'season',T.season(),'got',JSON.stringify(T.stats.got));
  {const f=T.buildings.find(b=>b.type==='fisher');console.log('fisher',f&&f.done,f&&f.spots&&f.spots.length,f&&f.workers.map(n=>n.name+':'+n.state+':'+n.wk));}
  console.log('deer alive',T.deer.filter(a=>!a.dead).length,'tasks',T.taskDone.filter(x=>x).length);
  const st={};for(const n of T.npcs){const k=n.state+(n.job?':'+n.job.type:'');st[k]=(st[k]||0)+1;}console.log('states',JSON.stringify(st));
  for(const n of T.npcs.slice(0,3))T.openNpc(n);T.openStock();T.openTasks();for(const b of T.buildings)T.openInfo(b);
  // Taps
  for(let i=0;i<60;i++)T.tap(Math.random()*400,Math.random()*800);
  // Abriss mehrerer Typen
  for(const t of ['farm','mill','hunter','sawmill']){const b=T.buildings.find(b=>b.type===t);if(b)T.demolish(b);}
  frames(30*30);
  for(let k=0;k<6;k++)T.paveTile(S[0]-6+k,S[1]-4,false);
  T.setPaused(true);frames(60);T.setPaused(false);T.setSpeed(1);frames(60);
  const json=JSON.stringify(T.serialize());console.log('save bytes',json.length);
  T.saveGame();
  els.bMenu._L.click();
  if(process.env.LSFILE)fs.writeFileSync(process.env.LSFILE,JSON.stringify(globalThis.__LS));
  globalThis.__snap={b:T.buildings.length,n:T.npcs.length,p:T.paveList.length};
  console.log('snapshot',JSON.stringify(globalThis.__snap),'res',JSON.stringify(T.res));
}else{
  console.log('after load: b',T.buildings.length,'n',T.npcs.length,'paved',T.paveList.length,'lvl',T.level,'res',JSON.stringify(T.res),'names',T.npcs.slice(0,4).map(n=>n.name).join(','));
  frames(30*90);console.log('ran 90s ok, npcs',T.npcs.length);
}
console.log('ms',Date.now()-t0);
