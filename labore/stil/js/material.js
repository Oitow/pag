import * as T from 'three';
import { rng } from '../../../engine/core/rng.js';

// Vier 32er-Kacheln: Erde, Holz, Stein, Laub. Randpixel wiederholen die Innenkante.
function pixelAtlas() {
  const r = rng(321);
  const daten = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const u = Math.min(30, Math.max(1, x % 32)), v = Math.min(30, Math.max(1, y % 32));
    const art = (x >> 5) + 2 * (y >> 5);
    const muster = [Math.sin(u + Math.sin(v * .4)), Math.sin(u * 1.2 + Math.sin(v * .2)),
      Math.cos(v * .9 + Math.sin(u * .35)), Math.sin((u + v) * .7)][art];
    const i = (x + 64 * y) * 4;
    daten.fill(125 + 49 * muster + r() * 66, i, i + 3);
    daten[i + 3] = 255;
  }
  const atlas = new T.DataTexture(daten, 64, 64);
  atlas.magFilter = T.NearestFilter;
  atlas.minFilter = T.LinearFilter;
  atlas.needsUpdate = true;
  return atlas;
}

export function materialien() {
  const atlas = pixelAtlas();
  const make = () => new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
  function detail(look) {
    const mat = make();
    mat.customProgramCacheKey = () => look;
    mat.onBeforeCompile = shader => {
      shader.uniforms.atlas = {value:atlas};
      shader.vertexShader = 'varying vec3 ort; varying vec3 norm;\n' + shader.vertexShader.replace('#include <project_vertex>', `
        vec4 p = vec4(transformed,1.);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        ort = (modelMatrix * p).xyz;
        norm = inverseTransformDirection(transformedNormal, viewMatrix);
        #include <project_vertex>`);
      shader.fragmentShader = `varying vec3 ort; varying vec3 norm;
        uniform sampler2D atlas;
        float korn(vec2 p){
          vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          vec4 n=fract(sin(dot(i,vec2(17.13,63.75))+vec4(0.,17.13,63.75,80.88))*4375.13);
          return mix(mix(n.x,n.y,f.x),mix(n.z,n.w,f.x),f.y);
        }\n` + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + (look === 'b' ? `
        vec3 n=abs(normalize(norm)); vec2 uv=n.y>max(n.x,n.z)?ort.xz:(n.x>n.z?ort.zy:ort.xy);
        vec3 c=diffuseColor.rgb;
        vec2 tile=c.g>c.r*1.1?vec2(1,1):(n.y>.8?vec2(0,0):(c.r>c.b*1.4?vec2(1,0):vec2(0,1)));
        float texel=texture2D(atlas,(tile*32.+1.5+fract(uv*.65)*29.)/64.).r;
        float dist=length(cameraPosition-ort);
        diffuseColor.rgb *= mix(.50+texel*1.02,1.,smoothstep(14.,55.,dist));
        ` : `
        vec3 w=pow(abs(normalize(norm)),vec3(4.)); w/=max(dot(w,vec3(1)),.001);
        vec3 p=ort*3.; float grain=dot(w,vec3(korn(p.yz),korn(p.zx),korn(p.xy)));
        vec3 unitN=normalize(norm);
        float bend=dot(dFdx(unitN),dFdx(ort))/max(dot(dFdx(ort),dFdx(ort)),.0001)
                  +dot(dFdy(unitN),dFdy(ort))/max(dot(dFdy(ort),dFdy(ort)),.0001);
        float wear=clamp(bend,0.,1.); float cavity=clamp(-bend,0.,1.);
        diffuseColor.rgb *= mix(.70+grain*.58 + wear*.20 - cavity*.22,1.,smoothstep(18.,60.,length(cameraPosition-ort)));
        `));
      if (look === 'b') shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', `
        float d=fract(dot(mod(gl_FragCoord.xy,4.),vec2(.25,.6875)));
        gl_FragColor.rgb=floor(gl_FragColor.rgb*36.+d)/36.;`);
    };
    return mat;
  }
  return {a:make(), b:detail('b'), c:detail('c'), atlas};
}
