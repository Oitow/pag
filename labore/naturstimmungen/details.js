import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '../../engine/core/rng.js';

export const detailArten = new Set([
  'bruchast', 'totholz', 'farn', 'laub', 'efeu', 'schilf', 'sumpfdotter', 'steinrose', 'geroell'
]);

// Each prop is a single vertex-colored geometry. The caller can instance it.
export function detailGeometrie(art, seed) {
  const r = rng(seed), teile = [];
  const holz=art==='bruchast'||art==='totholz';
  const farbe = new T.Color();
  function teil(form, ton) {
    const g = form.index ? form.toNonIndexed() : form;
    if (g !== form) form.dispose();
    if(!holz) g.deleteAttribute('uv');
    const p = g.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const variation = Math.sin(p.getX(i) * 65 + p.getZ(i) * 93 + p.getY(i) * 24);
      farbe.setHex(ton).multiplyScalar(.91 + .09 * variation + .13 * Math.min(1, p.getY(i)));
      farbe.toArray(c, i * 3);
    }
    g.setAttribute('color', new T.BufferAttribute(c, 3));
    teile.push(g);
  }
  const v = (x, y, z) => new T.Vector3(x, y, z);
  function ast(a, b, dicke, spitze, ton, seiten = 6) {
    const d = b.clone().sub(a);
    const g = new T.CylinderGeometry(spitze, dicke, d.length(), seiten);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(v(0, 1, 0), d.normalize()));
    teil(g.translate(...a.clone().lerp(b, .5).toArray()), ton);
  }
  function blatt(a, b, breite, ton, falz = .045) {
    const d = b.clone().sub(a);
    const s = v(d.z, 0, -d.x).normalize().multiplyScalar(breite);
    const m = a.clone().lerp(b, .44);
    const l = m.clone().add(s), rechts = m.clone().sub(s);
    const rippe = m.clone().add(v(0, falz, 0));
    const g = new T.BufferGeometry();
    const punkte = [a,l,rippe, l,b,rippe, a,rippe,rechts, rippe,b,rechts];
    g.setAttribute('position', new T.Float32BufferAttribute(punkte.flatMap(p => p.toArray()), 3));
    g.computeVertexNormals();
    teil(g, ton);
  }
  const ring = () => r() * Math.PI * 2;
  const radial = (winkel, radius, y) => v(Math.cos(winkel) * radius, y, Math.sin(winkel) * radius);
  if (art === 'bruchast' || art === 'totholz') {
    const dicke = art === 'totholz' ? .16 : .055;
    const start = v(-.78,dicke,0), mitte = v(-.08,dicke+.08,.04), ende = v(.78,dicke+.015,.23);
    ast(start, mitte, dicke, dicke*.92, 0x51382b, 8);
    ast(mitte, ende, dicke*.92, dicke*.5, 0x614532, 8);
    for (let i=0; i<6; i++) {
      const basis = start.clone().lerp(ende,.19+i*.12);
      const az = i%2 ? 1 : -1;
      const knick = basis.clone().add(v(.12,.08,r()*.22*az));
      ast(basis,knick,dicke*.44,dicke*.26,0x604331,5);
      ast(knick,knick.clone().add(v(.12+r()*.19,.04,az*(.16+r()*.18))),dicke*.26,.004,0x725138,4);
    }
    if (art === 'totholz') {
      const richtung = start.clone().sub(mitte).normalize();
      const kern = start.clone().addScaledVector(richtung, .009);
      ast(start,kern,dicke*.84,dicke*.84,0xc39a60,8);
      ast(kern,kern.clone().addScaledVector(richtung, .006),dicke*.42,dicke*.42,0x9b7147,8);
      for(let i=0;i<7;i++) {
        teil(new T.IcosahedronGeometry(.11,0).scale(1.35,.27,.7)
          .translate(-.6+i*.15,dicke*1.9+i*.016,.015+i*.013),i%2 ? 0x667842 : 0x475a35);
      }
    }
  } else if (art === 'farn') {
    for (let i=0; i<6; i++) {
      const a = i*Math.PI/3 + r()*.35;
      const mid = radial(a,.28,.33+r()*.09), peak = radial(a,.66,.24);
      ast(v(0,0,0),mid,.007,.005,0x80954d,3);
      ast(mid,peak,.005,.002,0x80954d,3);
      for(let j=1;j<=6;j++) {
        const t=j/7;
        const pos=t<.5 ? mid.clone().multiplyScalar(t*2) : mid.clone().lerp(peak,t*2-1);
        for(const dir of [-1,1]) {
          const tip=pos.clone().add(radial(a+dir*.99,.16*(1-t)+.017,.036));
          blatt(pos,tip,.024*(1-t)+.007,dir===1 ? 0x668947 : 0x4c713d,.009);
        }
      }
    }
  } else if (art === 'geroell') {
    for(let i=0;i<12;i++) {
      const p=radial(ring(),r()*.56,.026);
      const s=.026+r()*.10;
      teil(new T.IcosahedronGeometry(s,0).scale(1.35,.45,1).rotateY(ring()).translate(...p.toArray()),
        [0x6d7169,0x8a8175,0x596063,0xa39d81][i%4]);
    }
  } else {
    const palette = {
      laub: [0x9e6238,0xc28b46,0x67452c], efeu: [0x365e39,0x4d7747,0x62864b],
      schilf: [0x77814a,0x9aa45b,0x536b3e], sumpfdotter: [0x3e713c,0x658447,0x527443],
      steinrose: [0x547d70,0x7f9e88,0x486c60],
    }[art];
    const anzahl = art==='schilf' ? 22 : art==='laub' ? 14 : 12;
    for(let i=0;i<anzahl;i++) {
      const a=ring(), s=r(), ton=palette[i%3];
      if(art==='laub') {
        const p=radial(a,s*.55,.017+r()*.025);
        blatt(p,p.clone().add(radial(ring(),.07+r()*.11,.017)),.025+s*.018,ton,.008);
      } else if(art==='schilf') {
        const p=radial(a,s*.29,0), m=p.clone().add(radial(a,.12,.37+s*.54));
        const tip=m.clone().add(radial(a,.12,.16+s*.31));
        blatt(p,m,.029,ton,.016);
        blatt(m,tip,.019,ton,.01);
      } else {
        const p=radial(a,s*(art==='efeu' ? .48 : .13),.02);
        const tip=p.clone().add(radial(a,.12+s*.13,.045+s*.10));
        blatt(p,tip,.044+s*.035,ton,.024);
        if(art==='sumpfdotter' && i%3===0) {
          const halo=radial(a,.11+s*.08,.18+s*.11);
          ast(p,halo,.008,.005,0x51713d,4);
          for(let j=0;j<5;j++) blatt(halo,halo.clone().add(radial(j*Math.PI*.4,.065,.015)),.024,0xf4b825,.008);
          teil(new T.IcosahedronGeometry(.023,0).scale(1,.45,1).translate(...halo.toArray()),0xe68b20);
        }
      }
    }
  }
  const geometrie = mergeGeometries(teile);
  teile.forEach(g => g.dispose());
  return geometrie;
}

// Small tileable albedo textures for terrain and deadwood.
export function bodentextur(ort) {
  const size=128, farben=new Uint8Array(size*size*4), r=rng(328+ort);
  const tau=Math.PI*2;
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const u=x/size*tau, v=y/size*tau;
    const form=ort===3 ? Math.sin(24*u+1.8*Math.sin(2*v)+.8*Math.sin(5*u+2*v))
      : ort===2 ? Math.sin(4*u+15*v+Math.sin(3*u)*.8)
      : Math.sin(4*u+Math.sin(3*v))*Math.cos(5*v+2*u);
    const koernung=r();
    const licht=.82+form*.09+(koernung-.5)*.23+(koernung>.975 ? .14 : 0);
    const i=4*(y*size+x);
    farben[i]=Math.round(248*licht);
    farben[i+1]=Math.round((ort===1 ? 240 : 248)*licht);
    farben[i+2]=Math.round((ort===1 ? 229 : 246)*licht);
    farben[i+3]=255;
  }
  const textur=new T.DataTexture(farben,size,size);
  textur.wrapS=textur.wrapT=T.RepeatWrapping;
  textur.repeat.set(ort===3?1:28,ort===3?2:28);
  textur.colorSpace=T.SRGBColorSpace;
  textur.generateMipmaps=true;
  textur.minFilter=T.LinearMipmapLinearFilter;
  textur.magFilter=T.LinearFilter;
  textur.needsUpdate=true;
  return textur;
}
