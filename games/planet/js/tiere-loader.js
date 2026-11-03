// Lädt die bestehenden Voxel-Tiere aus games/voxel-tiere/<id>.html als Three.js-Gruppen.
// Jede Tier-Datei ist ein eigenständiges Modul-Script; wir führen es mit einer
// Fake-Umgebung aus und greifen die erzeugte Szene ab (wie sammelspiel/autobattler).
//
//   await ladeModell(id)   → THREE.Group, normiert: Füße bei y=0, mittig, Höhe/Größe ≈ 1.
//                            Ist ein gecachter Prototyp: für jede Instanz .clone() verwenden!
//   await ladeLebendig(id) → { gruppe, tick } eigene Instanz MIT Idle-Animation
//                            (tick() pro Frame aufrufen). Teurer – nur für Begleiter.
//   ladeTierDaten()        → Promise<TIERE> (Kampfwerte/Gruppen aus dem Autobattler)
//
// Blickrichtung der Modelle: die Tiere schauen ungefähr nach +Z.
import * as THREE from 'three';

const BASIS = '../voxel-tiere/';

class FakeRenderer {
  constructor() { this.domElement = new EventTarget(); this.domElement.style = {}; this.shadowMap = {}; }
  setPixelRatio() {} setSize() {} render() {}
  setAnimationLoop(f) { FakeRenderer.loop = f; }
}
class FakeControls { constructor() { this.target = new THREE.Vector3(); } update() {} addEventListener() {} }
const fakeEl = () => ({ style: {}, textContent: '', innerHTML: '', classList: { add() {}, remove() {} }, appendChild() {}, addEventListener() {} });
const fakeDoc = { body: { appendChild() {} }, getElementById: fakeEl, createElement: fakeEl, addEventListener() {} };
const erzeugt = [];
const FT = { ...THREE, WebGLRenderer: FakeRenderer, Scene: class extends THREE.Group { constructor() { super(); erzeugt.push(this); } } };
const fakeWin = { addEventListener() {}, innerWidth: 400, innerHeight: 400, devicePixelRatio: 1 };

const fnCache = {}, protoCache = {};

function ladeFunktion(id) {
  if (!fnCache[id]) {
    fnCache[id] = fetch(BASIS + id + '.html')
      .then(r => { if (!r.ok) throw new Error('404 ' + id); return r.text(); })
      .then(html => {
        let code = html.split('<script type="module">')[1].split('</' + 'script>')[0];
        code = code.replace(/^import[^;]*;/gm, '');
        return new Function('THREE', 'OrbitControls', 'MapControls', 'document', 'addEventListener', 'window', 'requestAnimationFrame', code);
      })
      .catch(e => { console.warn('Tier-Datei fehlt', id, e); return null; });
  }
  return fnCache[id];
}

function ausfuehren(f) {
  erzeugt.length = 0; FakeRenderer.loop = null;
  f(FT, FakeControls, FakeControls, fakeDoc, () => {}, fakeWin, () => 0);
  const sg = erzeugt[0];
  const g = new THREE.Group();
  sg.children.slice().forEach(o => { if (o.isGroup || o.isMesh) g.add(o); });
  const weg = []; g.traverse(o => { if (o.isLight || (o.isMesh && o.geometry?.type === 'PlaneGeometry')) weg.push(o); });
  weg.forEach(o => o.parent && o.parent.remove(o));
  const b = new THREE.Box3().setFromObject(g), sz = b.getSize(new THREE.Vector3());
  const s = 1 / Math.max(sz.x, sz.y, sz.z, 0.01);
  g.scale.setScalar(s);
  g.position.set(-(b.min.x + b.max.x) / 2 * s, -b.min.y * s, -(b.min.z + b.max.z) / 2 * s);
  const w = new THREE.Group(); w.add(g);
  w.userData.tierId = true;
  return { gruppe: w, tick: FakeRenderer.loop };
}

function ersatz() {
  const w = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.8), new THREE.MeshLambertMaterial({ color: 0xaa88cc }));
  m.position.y = 0.3; w.add(m); return w;
}

export function ladeModell(id) {
  if (!protoCache[id]) {
    protoCache[id] = ladeFunktion(id).then(f => {
      if (f) { try { const r = ausfuehren(f); if (r.gruppe.children[0].children.length) return r.gruppe; } catch (e) { console.warn('Modell', id, e); } }
      return ersatz();
    });
  }
  return protoCache[id];
}

export async function ladeLebendig(id) {
  const f = await ladeFunktion(id);
  if (f) { try { const r = ausfuehren(f); return { gruppe: r.gruppe, tick: r.tick || (() => {}) }; } catch (e) { console.warn('Modell', id, e); } }
  return { gruppe: ersatz(), tick: () => {} };
}

let datenPromise = null;
export function ladeTierDaten() {
  if (!datenPromise) {
    datenPromise = (window.TIERE ? Promise.resolve() : new Promise((ok, fehler) => {
      const s = document.createElement('script');
      s.src = '../autobattler/tiere-daten.js'; s.onload = ok; s.onerror = fehler;
      document.head.appendChild(s);
    })).then(() => window.TIERE);
  }
  return datenPromise;
}
