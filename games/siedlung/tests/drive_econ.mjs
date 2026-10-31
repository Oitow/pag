// Kurztest Wirtschaftsketten: Lehm→Ziegel, Erz→Werkzeug, Wolle→Kleidung
await import('./run.mjs');
const T=globalThis.__T,E=globalThis.__TE;let now=0;
function frames(n){for(let i=0;i<n;i++){now+=33;const f=T.rafs.shift();if(f)f(now);}}
function place(type){const s=T.DEF[type].size||1;let best=null,bd=1e9;const S=T.W.start,N=128;
  for(let tz=2;tz<N-2-s;tz++)for(let tx=2;tx<N-2-s;tx++){const d=(tx-S[0])**2+(tz-S[1])**2;if(d<bd&&T.canPlace(type,tx,tz)){bd=d;best=[tx,tz];}}
  return best?T.placeBuilding(type,best[0],best[1],true):null;}
frames(10);T.level=2;for(const k in T.res)T.res[k]=60;
const got={};for(const t of ['store','house','house','house3','claypit','brickworks','mine','smithy','sheepfarm','weaver','granary'])got[t]=place(t)?'ok':'--';
console.log('placed',JSON.stringify(got),'cap',E.storeCap());
for(const t of ['ore','clay','wool','bricks','tools','cloth'])T.res[t]=0;
T.setSpeed(3);for(let m=0;m<6;m++)frames(30*60/3);
console.log('sheep',E.sheep.length,'got',JSON.stringify(T.stats.got),'res',JSON.stringify({ore:T.res.ore,tools:T.res.tools,clay:T.res.clay,bricks:T.res.bricks,wool:T.res.wool,cloth:T.res.cloth}));
for(const b of T.buildings)T.openInfo(b);T.openStock();T.toggleSheet('handwerk');
const s=T.serialize();if(!('bricks' in s.res))throw new Error('save missing');
const ok=['ore','tools','clay','bricks','wool','cloth'].every(k=>(T.stats.got[k]||0)>0);
console.log(ok?'ECON_OK':'ECON_FAIL');if(!ok)process.exitCode=1;
