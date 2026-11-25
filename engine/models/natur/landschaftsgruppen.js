/**
 * @modul    landschaftsgruppen
 * @zweck    Verbundene Kleinformen als ein Mesh: Wollgras, Pilzholz, Flechtenbank (für Instancing)
 * @api      baueGruppe(art, seed) -> THREE.Mesh
 * @beispiel
 *   import { baueGruppe } from '../../engine/models/natur/landschaftsgruppen.js'; const m = baueGruppe('wollgras', 7);
 * @tags     natur, pflanze, gruppe, asset, ufer, moor
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
// Verbundene Kleinformen in Metern. Ein Mesh pro Gruppe, auch für Instancing.
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '../../core/rng.js';

export function baueGruppe(art, seed) {
  const z = rng(seed), teile = [];
  function teil(geo, farbe, x,y,h, sx,sy,sz, winkel=0, neigung=0) {
    geo.scale(sx,sy,sz).rotateZ(neigung).rotateY(winkel).translate(x,y,h);
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    g.deleteAttribute('uv');
    const rgb = new Float32Array(g.attributes.position.count*3), c = new T.Color(farbe);
    for(let i=0;i<rgb.length;i+=3) c.toArray(rgb,i);
    g.setAttribute('color',new T.BufferAttribute(rgb,3));
    teile.push(g);
  }
  const stein = () => new T.IcosahedronGeometry(1,0);
  if (art === 'wollgras') {
    for(let i=0;i<12;i++) {
      const a=z()*6.28, r=.45*z(), x=r*Math.cos(a), h=r*Math.sin(a), l=.35+.45*z();
      teil(new T.CylinderGeometry(.006,.012,l,4),0x566339,x,l/2,h,1,1,1);
      teil(stein(),0xe1daca,x,l,h,.042,.074,.044,a);
      teil(new T.ConeGeometry(1,1,3),0x78804a,x+.04,.14,h,.017,.31,.012,0,-.25);
    }
  } else if (art === 'pilzholz') {
    teil(new T.CylinderGeometry(.19,.24,1.85,9),0x594536,0,.18,0,1,1,1,0,Math.PI/2);
    for(let i=0;i<8;i++) {
      const x=(z()-.5)*1.55, seite=i%2?1:-1;
      teil(stein(),0x526044,x,.33,(z()-.5)*.16,.22,.09,.14);
      teil(new T.SphereGeometry(1,9,3,0,Math.PI*2,0,Math.PI/2),i%3?0xb08a62:0xd3b789,x,.17+.08*z(),seite*.18,.13,.06,.11);
    }
  } else if (art === 'flechtenbank') {
    for(let i=0;i<6;i++) {
      const x=(z()-.5)*1.5,h=(z()-.5)*.6,l=.18+.42*z();
      teil(stein(),i%2?0x626b72:0x767571,x,l*.35,h,l*1.5,l*.65,l,.32);
      teil(stein(),0x9c9c6c,x,l*.85,h,l*.65,l*.15,l*.55,.32);
    }
  } else throw new RangeError(art);
  const geo=mergeGeometries(teile);
  teile.forEach(g=>g.dispose());
  return new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:.97,flatShading:true}));
}
