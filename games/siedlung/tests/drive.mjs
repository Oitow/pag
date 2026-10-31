await import('./run.mjs');
const T=globalThis.__T;let now=0;
const t0=Date.now();
function frames(n){for(let i=0;i<n;i++){now+=33;const f=T.rafs.shift();if(f)f(now);}}
frames(60);
const S=T.W.start;
function tryBuild(type){for(let r=2;r<14;r++)for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){const tx=S[0]+dx,tz=S[1]+dz;if(T.W.buildable(tx,tz)){T.setMode(type);T.showGhost(tx,tz);const n=T.buildings.length;T.confirmBuild();if(T.buildings.length>n){T.setMode(null);return T.buildings.at(-1);}}}return null;}
console.log('start',S,'npcs',T.npcs.length,'res',JSON.stringify(T.res));
const c=tryBuild('cutter'),g=tryBuild('gather');
console.log('built',!!c,!!g,JSON.stringify(T.res));
frames(30*60);
const q=tryBuild('quarry');const h=tryBuild('house');
frames(30*400);
console.log('after ~7min: npcs',T.npcs.length,'res',JSON.stringify(T.res),'buildings',T.buildings.map(b=>b.type+(b.done?'':'*')).join(','),'tod',T.tod.toFixed(2));
console.log('states',T.npcs.map(n=>n.state+(n.job?':'+n.job.type:'')).join(' '));
let wsum=0,wmax=0,cnt=0;for(const w of T.W.wear){wsum+=w;if(w>wmax)wmax=w;if(w>.5)cnt++;}console.log('wear sum',wsum.toFixed(1),'max',wmax.toFixed(2),'verts>0.5',cnt);
T.openInfo(T.buildings[1]);T.demolish(T.buildings[1]);T.demolish(T.buildings[0]);
frames(30*120);
for(let i=0;i<50;i++)T.tap(Math.random()*400,Math.random()*800);
T.setMode('house');for(let i=0;i<20;i++)T.tap(Math.random()*400,Math.random()*800);T.confirmBuild();
frames(300);
console.log('final npcs',T.npcs.length,JSON.stringify(T.res),'ms',Date.now()-t0);
