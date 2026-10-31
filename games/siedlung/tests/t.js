const fs=require('fs');
const src=fs.readFileSync(process.argv[2],'utf8');
const s=src.indexOf('/*LOGIC_START*/'),e=src.indexOf('/*LOGIC_END*/');
const L=new Function(src.slice(s,e)+';return {createWorld,createPathfinder,N,HALF};')();
let fails=0,nulls=0;
for(let k=0;k<40;k++){
  const seed=(k*7919+13)|0; let t=Date.now();
  let w=L.createWorld(seed,false); if(!w){nulls++;w=L.createWorld(seed,true);}
  const dt=Date.now()-t;
  let land=0,water=0,hi=0,maxh=-9;for(let i=0;i<w.tH.length;i++){if(w.tWater[i])water++;else land++;if(w.tH[i]>maxh)maxh=w.tH[i];}
  const pf=L.createPathfinder(w);t=Date.now();let ok=0,tries=0;
  for(let j=0;j<50;j++){const tr=w.trees[(j*37)%w.trees.length];tries++;const p=pf.find(w.start[0],w.start[1],tr.tx,tr.tz);if(p)ok++;}
  const pt=Date.now()-t;
  for(let j=0;j<2000;j++)w.addWear(Math.random()*20-10,Math.random()*20-10,.1);
  if(k<40)console.log(seed,'gen',dt,'ms land',land,'water',water,'maxh',maxh.toFixed(1),'trees',w.trees.length,'rocks',w.rocks.length,'bush',w.bushes.length,'tufts',w.tufts.length,'flow',w.flowers.length,'start',w.start,'paths',ok+'/'+tries,pt+'ms');
  if(k===0||k===5){let out='';for(let z=0;z<L.N;z+=2){for(let x=0;x<L.N;x+=1){const i=z*L.N+x;const o=w.occ[i];out+=(x===w.start[0]&&Math.abs(z-w.start[1])<2)?'S':w.tWater[i]?(w.tH[i]<-0.6?' ':'~'):o===1?'T':o===2?'R':o===3?'b':w.tH[i]>4?'^':w.tH[i]>2?'n':'.';}out+='\n';}console.log(out);}
}
console.log('nulls',nulls);
