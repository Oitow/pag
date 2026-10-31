// Natürlicher Spielverlauf ohne Cheats (Balance)
await import('./run.mjs');const T=globalThis.__T;let now=0;
function frames(n){for(let i=0;i<n;i++){now+=33;const f=T.rafs.shift();if(f)f(now);}}
const S=T.W.start;
function tryBuild(type){if(!T.canPlace)return;const s=T.DEF[type].size||1;for(let r=2;r<20;r++)for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;const tx=S[0]+dx,tz=S[1]+dz,o=(s-1)>>1;
  if(T.canPlace(type,tx-o,tz-o)){T.setMode(type);T.showGhost(tx,tz);const n=T.buildings.length;T.confirmBuild();T.setMode(null);if(T.buildings.length>n)return true;return false;}}return false;}
const plan=['cutter','gather','quarry','house','fisher','well','house','house','gather','house','cutter','farm','mill','house','sawmill','market','house','hunter','house','house','beet','house','bakery','house2','house2'];
T.setSpeed(3);let pi=0;
for(let m=1;m<=40;m++){
  for(let k=0;k<4;k++){const t=plan[pi];if(!t)break;const d=T.DEF[t];if((d.lvl||0)>T.level)break;let ok=true;for(const r in d.c)if(T.res[r]<d.c[r])ok=false;if(!ok)break;if(tryBuild(t))pi++;else{pi++;}}
  frames(600);
  if(m%4==0)console.log('min',m,'pop',T.npcs.length,'hap',T.hap.toFixed(0),'lvl',T.level,'season',T.season(),'next',plan[pi],'res',JSON.stringify(T.res),'tasks',T.taskDone.filter(x=>x).length);
}
