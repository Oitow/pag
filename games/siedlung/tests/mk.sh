#!/bin/sh
# Erzeugt run.mjs aus index.html (THREE-Import -> Stub) und prüft Syntax
cd "$(dirname "$0")/.."
python3 - <<'P'
s=open('index.html').read()
a=s.index('<script type="module">')+len('<script type="module">');b=s.index('</script>',a)
js=s[a:b]
i=js.index('let THREE=null;');j=js.index("if(!THREE)throw");j=js.index('\n',j)+1
js=js[:i]+"import {THREE,rafs,els} from './stub.mjs';\n"+js[j:]
js+="\nglobalThis.__T={step,res,npcs,buildings,W,deer,rabbits,paveList,TASKS,taskDone,stats,DEF,setMode:(m)=>setMode(m),showGhost:(a,b)=>showGhost(a,b),confirmBuild:()=>confirmBuild(),demolish:b=>demolish(b),openInfo:b=>openInfo(b),openNpc:n=>openNpc(n),openStock,openTasks,tap:(x,y)=>tap(x,y),paveTile,placeBuilding,finishBuilding,saveGame,serialize,canPlace,fishSpots,renderSheet,toggleSheet,loop,rafs,applyQuality,setQ:q=>{qLevel=q;applyQuality();},setSpeed:v=>{speed=v},setPaused:v=>{paused=v},get loadedSave(){return loadedSave},get tod(){return tod},get mode(){return mode},get level(){return level},set level(v){level=v},get hap(){return hap},get yearT(){return yearT},set yearT(v){yearT=v},season,npcText,infoText,paintAt,get painting(){return painting},set painting(v){painting=v},set paintErase(v){paintErase=v},set lastPaint(v){lastPaint=v}};\n"
js+="Object.defineProperties(globalThis.__T,Object.getOwnPropertyDescriptors({doUpgrade,upgOf,setWant,wantOf,slotsOf,openStats,statsText,openSettings,setQuality,checkLevel,lvlReady,lvlReqs,LEVELS,spawnNpc,tutTick,get tutI(){return tutI},set hap(v){hap=v},get hap(){return hap}}));\n"
open('tests/run.mjs','w').write(js)
P
node --check tests/run.mjs && echo SYNTAX_OK
