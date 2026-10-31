// Bevölkerung: mehrere Spieljahre (Geburten, Altern, Brennholz im Winter, Ereignisse, kein NaN)
await import('./run.mjs');const T=globalThis.__T;let now=0;
function frames(n){for(let i=0;i<n;i++){now+=33;const f=T.rafs.shift();if(f)f(now);}}
const S=T.W.start;
function tryBuild(type){const s=T.DEF[type].size||1;for(let r=1;r<22;r++)for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;const tx=S[0]+dx,tz=S[1]+dz,o=(s-1)>>1;
  if(T.canPlace(type,tx-o,tz-o)){T.setMode(type);T.showGhost(tx,tz);const n=T.buildings.length;T.confirmBuild();T.setMode(null);if(T.buildings.length>n)return T.buildings.at(-1);}}return null;}
const rich=()=>{for(const k of['wood','stone','planks','berry','fish'])T.res[k]=Math.max(T.res[k],150);};
rich();T.level=1;for(const t of['cutter','gather','fisher','well','house','house','house','chopper','herbal','quarry','farm'])tryBuild(t);
for(const b of T.buildings)if(!b.done)T.finishBuilding(b,true);
T.setSpeed(3);let fwWinter=0,ages0=T.npcs.map(n=>n.age);
for(let m=0;m<80;m++){const fw=T.res.firewood,w=T.res.wood;frames(600);
  if(T.season()===3)fwWinter+=Math.max(0,fw-T.res.firewood);
  if(m%3==0)rich();
  if(m===10){T.pop.popEvent('wander');if(T.pop.lastJoin)T.pop.lastJoin();T.pop.popEvent('fire');}
  if(m%10==0){const bad=T.npcs.filter(n=>!Number.isFinite(n.age)||!Number.isFinite(n.hp)||!Number.isFinite(n.x));
    console.log('min',m,'year',(T.yearT/1440+1).toFixed(2),'season',T.season(),'pop',T.npcs.length,'kids',T.npcs.filter(n=>n.age<14).length,'hap',T.hap.toFixed(0),'fw',T.res.firewood,'stats',JSON.stringify(T.pop.popS),'nan',bad.length);
    if(bad.length||!Number.isFinite(T.hap))throw new Error('NaN');}}
for(const n of T.npcs.slice(0,3))T.openNpc(n);T.openStock();for(const b of T.buildings)T.openInfo(b);
const js=JSON.stringify(T.serialize());
console.log('firewood burnt in winter',fwWinter,'born',T.pop.popS.born,'aged',T.npcs[0]&&(T.npcs[0].age).toFixed(1),'save',js.length);
if(!(T.pop.popS.born>0))throw new Error('keine Geburten');if(!(fwWinter>0))throw new Error('kein Brennholzverbrauch');
console.log('POP_OK');
