// Wetter & Jahreszeiten durchschalten: kein Absturz, keine NaN, Speichern/Laden des Wetters
await import('./run.mjs');
const T=globalThis.__T,X=globalThis.__siedlungWx;let now=0;
const fr=n=>{for(let i=0;i<n;i++){now+=33;const f=T.rafs.shift();if(f)f(now);}};
const chk=tag=>{for(const k in X.wv)if(!Number.isFinite(X.wv[k]))throw new Error(tag+' NaN '+k);if(!Number.isFinite(X.snow))throw new Error(tag+' snow NaN');};
const SL=360;
for(let s=0;s<4;s++)for(let w=0;w<5;w++){T.yearT=s*SL+5;X.set(w);fr(200);chk('s'+s+'w'+w);
  if(s<3&&X.wx.c===4)throw new Error('Schnee außerhalb Winter');if(s===3&&(X.wx.c===2||X.wx.c===3))throw new Error('Regen im Winter');}
T.yearT=3*SL+5;X.set(4);fr(30*40);console.log('winter snow cover',X.snow.toFixed(2));
for(const q of[1,2,3]){T.setQ(q);fr(60);}
T.yearT=0;X.set(3);fr(400);const sv=T.serialize();console.log('storm save',JSON.stringify(sv.wx));if(!sv.wx||sv.wx.c!==3)throw new Error('wx nicht gespeichert');
T.setSpeed(3);fr(30*60*3);chk('auto');console.log('auto weather',X.wx.c,'ok');
