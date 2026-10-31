const fs=require('fs');
const src=fs.readFileSync(process.argv[2],'utf8');
const s=src.indexOf('/*LOGIC_START*/'),e=src.indexOf('/*LOGIC_END*/');
const L=new Function(src.slice(s,e)+';return {createWorld,createPathfinder,N,HALF};')();
let nulls=0;const show=+(process.argv[3]||-1);
for(let k=0;k<20;k++){
  const seed=(k*7919+13)|0; let t=Date.now();
  let w=L.createWorld(seed,false); if(!w){nulls++;w=L.createWorld(seed,true);}
  const dt=Date.now()-t;let land=0,maxh=-9;const bc=[0,0,0,0,0,0,0,0];for(let i=0;i<w.tH.length;i++){if(!w.tWater[i]){land++;bc[w.tBiome[i]]++;}if(w.tH[i]>maxh)maxh=w.tH[i];}
  const pf=L.createPathfinder(w);let ok=0;for(let j=0;j<30;j++){const tr=w.trees[(j*37)%w.trees.length];if(pf.find(w.start[0],w.start[1],tr.tx,tr.tz))ok++;}
  console.log(seed,dt+'ms land',land,'maxh',maxh.toFixed(1),'biomes',bc.join('/'),'trees',w.trees.length,'rocks',w.rocks.length,'bush',w.bushes.length,'tuft',w.tufts.length,'fl',w.flowers.length,'reed',w.reeds.length,'lily',w.lilies.length,'log',w.logs.length,'peb',w.pebbles.length,'shr',w.shrooms.length,'river',w.riverPath.length,'paths',ok);
  if(k===show){let out='';const C='sm#bhxr*';for(let z=0;z<L.N;z+=2){for(let x=0;x<L.N;x++){const i=z*L.N+x;out+=(x===w.start[0]&&Math.abs(z-w.start[1])<2)?'S':w.tWater[i]?(w.tOcean[i]?' ':'~'):C[w.tBiome[i]];}out+='\n';}console.log(out);}
}
console.log('nulls',nulls);
