/**
 * @modul    grosszauber
 * @zweck    Großzauber, die die Welt verändern (Flutwelle, Erdwall, Zyklon, Erdriss …): Register für Zauber-Arten, laufende Wirkungen, gemeinsames Ereignis-Vokabular und ein Welt-Adapter, über den Wände/Gräben/Wasser für Figuren, Horden und Körper sofort gelten
 * @api      createGrosszauber({arten,seed,welt,max}) -> { registriere(name,fabrik), wirke(art,{von,punkt,yaw,kraft,def,quelle}) -> id|null, update(dt,ziele) -> ereignisse[], adapter(basis) -> {bodenHoehe,wasserHoehe,hindernisse,…basis}, aktive, entferne(id), leeren(), zustand(), dispose() }
 * @beispiel
 *   import { createGrosszauber } from '../../engine/gameplay/grosszauber.js';
 *   import { createWelle } from '../../engine/gameplay/grosszauber-welle.js';
 *   const gross = createGrosszauber({ arten: { welle: createWelle }, welt: adapter, seed: 7 });
 *   Object.assign(adapter, gross.adapter({ ...adapter }));          // ab jetzt kollidiert alles mit Wänden, schwimmt in Fluten
 *   gross.wirke('welle', { von: fuss, punkt, yaw, kraft: 1.4, def: ZAUBER.flutwelle.gross });
 *   for (const e of gross.update(dt, ziele)) if (e.typ === 'treffer') for (const t of e.treffer) schade(t);
 * @tags     zauber, magie, großzauber, episch, welle, wand, sturm, beben, kollision, welt, kampf, flächenschaden, mmo
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Eine Zauber-Art ist eine Fabrik  fabrik(opts, umgebung) -> instanz.
 *   opts      { von {x,y,z} (Füße des Zaubernden), punkt {x,y,z} (Zielpunkt am Boden, auf Reichweite begrenzt), yaw (Blick = sin/cos), kraft (1 … ~1.6), def (Daten, z. B. ZAUBER.x.gross), quelle }
 *   umgebung  { boden(x,z) (Gelände ohne Großzauber), wasser(x,z), zufall () -> [0,1) (geseedet) }
 *   instanz   { daten        reines Objekt für die Darstellung (Phase, Lage, Maße …) – render/grosszauber-mesh reicht es an die Ansicht
 *               update(dt, ziele, melde) -> bool   false = vorbei (Abbau-Phase gehört noch dazu)
 *               hindernis?(x, z, radius) -> {x,z}|null   Wegdrück-Vektor (Wand)
 *               boden?(x, z) -> delta|null                 Höhe über (+) / unter (−) dem Gelände (Podest, Graben)
 *               wasser?(x, z) -> hoehe|null                absolute Wasserhöhe (Flut: Figuren schwimmen)
 *               zustand?() , dispose?() }
 *   ziele     [{ id, x, y, z, radius, hoehe, … }] wie bei zauber.update
 * Ereignis-Vokabular (melde({ typ, … }); id + art ergänzt der Kern, treffer ist immer ein Array):
 *   'treffer'  treffer: [{ id, ziel, schaden, stoss {x,y,z}, umwerfen, verlangsamt, zug {x,z}|null }]  (wie zauber.js)
 *   'beben'    pos, staerke (0 … 2), dauer          → Kamera wackelt (nach Abstand abgeschwächt)
 *   'klang'    name, staerke, tonhoehe              → audio/klang
 *   'stopp'    dauer                                → Treffer-Stopp
 *   'funken'   pos, opts (wie zauber-effekte.funken) · 'ring' pos, opts (wie zauber-effekte.ring)
 *   'meldung'  text
 *   Der Kern meldet selbst 'start' (von, punkt, yaw, kraft) und 'ende'.
 */
import { rng, hashSeed } from '../core/rng.js';

const STUFE = 0.6;   // so hoch darf ein Podest über den Füßen liegen und gilt noch als Boden

export function createGrosszauber({ arten = {}, seed = 1, welt = null, max = 12 } = {}) {
  const fabriken = { ...arten }, aktive = [], ereignisse = [], zwischendurch = [];   // zwischendurch: Ereignisse aus wirke()/entferne() bis zum nächsten update
  let naechsteId = 1, imUpdate = false;
  const zufall = rng(hashSeed('grosszauber', seed));
  const umgebung = {
    boden: (x, z) => (typeof welt?.bodenHoehe === 'function' ? +welt.bodenHoehe(x, z) || 0 : 0),
    wasser: (x, z) => (typeof welt?.wasserHoehe === 'function' ? welt.wasserHoehe(x, z) : -Infinity),
    zufall,
  };
  const p3 = (p, y = 0) => ({ x: +p?.x || 0, y: Number.isFinite(+p?.y) ? +p.y : y, z: +p?.z || 0 });

  function beende(i) {
    const a = aktive[i];
    a.inst.dispose?.();
    aktive.splice(i, 1);
    (imUpdate ? ereignisse : zwischendurch).push({ typ: 'ende', id: a.id, art: a.art, treffer: [] });
  }

  function wirke(art, opts = {}) {
    const f = fabriken[art];
    if (typeof f !== 'function') return null;
    if (aktive.length >= max) beende(0);
    const von = p3(opts.von), punkt = opts.punkt ? p3(opts.punkt) : { ...von };
    const o = { ...opts, von, punkt, yaw: +opts.yaw || 0, kraft: +opts.kraft || 1, def: opts.def || {} };
    const inst = f(o, umgebung);
    if (!inst) return null;
    const id = naechsteId++;
    aktive.push({ id, art, inst });
    zwischendurch.push({ typ: 'start', id, art, von, punkt, yaw: o.yaw, kraft: o.kraft, treffer: [] });
    return id;
  }

  function update(dt, ziele = []) {
    ereignisse.length = 0;
    for (const e of zwischendurch) ereignisse.push(e);
    zwischendurch.length = 0;
    imUpdate = true;
    for (let i = 0; i < aktive.length; i++) {
      const a = aktive[i];
      const melde = (e) => { const x = { ...e, id: a.id, art: a.art, treffer: e.treffer || [] }; ereignisse.push(x); return x; };
      if (a.inst.update(dt, ziele, melde) === false) { beende(i); i--; }
    }
    imUpdate = false;
    return ereignisse;
  }

  /** Höhen-Änderung aller Wirkungen bei (x, z); mit Fuß-Höhe y zählt ein Podest nur, wenn man draufsteigen kann. */
  function bodenDelta(x, z, basis, y) {
    let d = 0, hat = false;
    for (const a of aktive) {
      const e = a.inst.boden?.(x, z);
      if (e == null || !Number.isFinite(e)) continue;
      if (e > 0 && Number.isFinite(y) && basis + e > y + STUFE) continue;   // zu hoch → ist Wand (hindernis), kein Boden
      if (!hat || Math.abs(e) > Math.abs(d)) { d = e; hat = true; }
    }
    return d;
  }

  function adapter(basis = {}) {
    const bh = typeof basis.bodenHoehe === 'function' ? basis.bodenHoehe : () => 0;
    return {
      ...basis,
      bodenHoehe(x, z, y) { const b = bh(x, z, y); return aktive.length ? b + bodenDelta(x, z, b, y) : b; },
      wasserHoehe(x, z) {
        let w = typeof basis.wasserHoehe === 'function' ? basis.wasserHoehe(x, z) : -Infinity;
        for (const a of aktive) { const h = a.inst.wasser?.(x, z); if (h != null && h > w) w = h; }
        return w;
      },
      hindernisse(x, z, radius, filter) {
        let s = typeof basis.hindernisse === 'function' ? basis.hindernisse(x, z, radius, filter) : null;
        for (const a of aktive) {
          const h = a.inst.hindernis?.(x, z, radius);
          if (h) s = s ? { x: s.x + h.x, z: s.z + h.z } : { x: h.x, z: h.z };
        }
        return s;
      },
    };
  }

  return {
    registriere(name, fabrik) { fabriken[name] = fabrik; },
    wirke, update, adapter,
    get aktive() { return aktive; },
    entferne(id) { const i = aktive.findIndex(a => a.id === id); if (i >= 0) beende(i); return i >= 0; },
    leeren() { while (aktive.length) beende(aktive.length - 1); },
    zustand() { return aktive.map(a => ({ id: a.id, art: a.art, daten: a.inst.zustand ? a.inst.zustand() : a.inst.daten })); },
    dispose() { while (aktive.length) beende(0); ereignisse.length = 0; zwischendurch.length = 0; },
  };
}
