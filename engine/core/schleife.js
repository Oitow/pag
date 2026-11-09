/**
 * @modul    schleife
 * @zweck    Spielschleife mit variablem oder festem Zeitschritt, dt-Begrenzung, FPS-Anzeige und Tab-Pause
 * @api      createSchleife({update(dt,zeit),render(alpha,dt),fest,maxDt,maxSchritte,pausiereVersteckt,raf,caf,jetzt,fehler}) -> {start(),stop(),tick(jetztMs),laeuft,fps,zeit,dispose()}
 * @beispiel
 *   import { createSchleife } from '../../engine/core/schleife.js';
 *   const loop = createSchleife({ update: (dt) => welt.step(dt), render: () => renderer.render(szene, kamera), fest: 1 / 60 });
 *   loop.start();
 * @tags     schleife, loop, zeitschritt, raf, fps
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

/** Erzeugt eine Spielschleife. Das erste tick() nach start()/Tab-Rückkehr setzt nur die Zeitbasis. */
export function createSchleife(opts = {}) {
  const {
    update = () => {}, render = () => {}, fest = 0, maxDt = 0.05, maxSchritte = 5,
    pausiereVersteckt = true, fehler = null,
  } = opts;
  const raf = opts.raf ?? ((fn) => globalThis.requestAnimationFrame(fn));
  const caf = opts.caf ?? ((id) => globalThis.cancelAnimationFrame(id));

  let laeuft = false, id = null, letzte = null, akku = 0, zeit = 0;
  let fps = 0, fpsZeit = 0, fpsBilder = 0;

  function sicher(fn, ...args) {
    try { fn(...args); } catch (e) {
      if (fehler) fehler(e); else throw e;
    }
  }

  function tick(jetztMs) {
    if (letzte === null) { letzte = jetztMs; return; }
    const echt = Math.max(0, (jetztMs - letzte) / 1000);
    letzte = jetztMs;
    const dt = Math.min(echt, maxDt);

    fpsZeit += echt; fpsBilder++;
    if (fpsZeit >= 0.5) {
      const neu = fpsBilder / fpsZeit;
      fps = fps ? fps * 0.5 + neu * 0.5 : neu;
      fpsZeit = 0; fpsBilder = 0;
    }

    if (fest > 0) {
      akku += echt;
      let n = 0;
      while (akku + 1e-9 >= fest && n < maxSchritte) {
        zeit += fest;
        sicher(update, fest, zeit);
        akku -= fest; n++;
      }
      if (akku + 1e-9 >= fest) akku = 0; // Rest verwerfen
      if (akku < 0) akku = 0;
      sicher(render, akku / fest, dt);
    } else {
      zeit += dt;
      sicher(update, dt, zeit);
      sicher(render, 1, dt);
    }
  }

  function bild(ts) {
    if (!laeuft) return;
    id = raf(bild);
    tick(ts ?? (opts.jetzt ? opts.jetzt() : globalThis.performance.now()));
  }

  function sichtbarkeit() {
    if (globalThis.document.hidden) return;
    letzte = null; akku = 0;
  }
  const doc = pausiereVersteckt ? globalThis.document : undefined;
  if (doc) doc.addEventListener('visibilitychange', sichtbarkeit);

  return {
    start() {
      if (laeuft) return;
      laeuft = true; letzte = null; akku = 0;
      id = raf(bild);
    },
    stop() {
      laeuft = false;
      if (id !== null) { caf(id); id = null; }
    },
    tick,
    get laeuft() { return laeuft; },
    get fps() { return fps; },
    get zeit() { return zeit; },
    dispose() {
      this.stop();
      if (doc) doc.removeEventListener('visibilitychange', sichtbarkeit);
    },
  };
}
