// Kurztest Fortschritt/UI: Ausbau, Arbeiter ±, Statistik, Stufenaufstieg, Optionen, Speichern
await import('./run.mjs');const {els}=await import('./stub.mjs');
const T=globalThis.__T;let now=0;
function frames(n){for(let i=0;i<n;i++){now+=33;const f=T.rafs.shift();if(f)f(now);}}
const S=T.W.start;const rich=()=>{for(const k in T.res)T.res[k]=Math.max(T.res[k],500);};
function tryBuild(type){const s=T.DEF[type].size||1;for(let r=1;r<26;r++)for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;const o=(s-1)>>1,tx=S[0]+dx-o,tz=S[1]+dz-o;
  if(T.canPlace(type,tx,tz)){const b=T.placeBuilding(type,tx,tz,true);if(b)return b;}}return null;}
const ok=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1;}else console.log('ok',m);};
frames(30);rich();T.level=2;
const house=T.buildings.find(b=>b.type==='house');ok(T.doUpgrade(house)&&house.type==='house_fw','Haus → Fachwerkhaus');
const cut=tryBuild('cutter');frames(40);ok(T.slotsOf(cut)===2,'Holzfäller 2 Plätze');
T.setWant(cut,0);frames(40);ok(cut.workers.length===0,'Arbeiter auf 0');T.setWant(cut,2);
ok(T.doUpgrade(cut)&&T.slotsOf(cut)===3&&cut.upMesh,'Werkstatt-Ausbau +1');
for(const t of['market','bakery','house','house','well'])tryBuild(t);
for(const b of T.buildings)if(T.DEF[b.type].cap&&T.upgOf(b))T.doUpgrade(b);
const store=T.buildings.find(b=>b.type==='store');while(T.npcs.length<34)T.spawnNpc(store);
frames(30*20);T.hap=90;T.checkLevel();ok(T.level===3,'Stufe Marktflecken (lvl '+T.level+') '+JSON.stringify(T.lvlReqs(T.LEVELS[3]).map(q=>q.t)));
T.openStats();frames(30*12);const st=T.statsText();ok(st.includes('Zufriedenheit')&&st.includes('<svg'),'Statistik mit Sparkline');
T.openSettings();T.setQuality(2);T.setQuality(-1);for(const b of T.buildings)T.openInfo(b);T.toggleSheet('deko');T.toggleSheet('deko');
const js=T.serialize();ok(js.pg&&js.pg.b.length>=1,'Speichern pg '+JSON.stringify(js.pg));
console.log('tasks',T.taskDone.filter(x=>x).length+'/'+T.TASKS.length,'tut',T.tutI);
