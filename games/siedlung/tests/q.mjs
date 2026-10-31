await import('./run.mjs');const T=globalThis.__T;let now=0;
const fr=n=>{for(let i=0;i<n;i++){now+=40;const f=T.rafs.shift();if(f)f(now);}};
fr(400);T.setQ(1);T.setQ(2);T.setQ(3);fr(30*200);
const {els}=await import('./stub.mjs');els.bMenu._L.click();console.log('panel',els.ptitle.textContent);els.bSpeed._L.click();els.bPause._L.click();els.bTasks._L.click();els.resRow._L.click();
// slow frames -> auto quality
for(let i=0;i<300;i++){now+=60;const f=T.rafs.shift();if(f)f(now);}console.log('ok');
