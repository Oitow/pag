/**
 * @modul    character-model
 * @zweck    Look → fertige Figur: Rig (Gelenk-Gruppen) + Low-Poly-Meshes je Knochen; Look live wechseln, Gegenstände an Sockeln befestigen
 * @api      createCharacterModel({ look, seed, material, schatten, mimik }) -> { root, rig, look, masse, meshes, gesicht, ausdruck, setLook(teilOderLook), befestigen(sockel,obj), loesen(sockelOderObj), setSichtbar(bool), setAusdruck(name), setLider(zu), blinzeln(dauer), setBlick(x,y), updateGesicht(dt), dispose() }
 * @beispiel
 *   import { createCharacterModel } from '../../engine/models/character/character-model.js';
 *   const figur = createCharacterModel({ look: VORLAGEN.ritter, seed: 4 });
 *   szene.add(figur.root);
 *   figur.befestigen('handR', schwert);
 *   figur.setLook({ kopfbedeckung: { stil: 'krone' } });   // Rig-Gruppen & Befestigtes bleiben erhalten
 * @version  1.1.0
 * @status   entwurf
 * @three    ja
 *
 * Gesicht/Mimik (1.1, additiv; mit opts.mimik = false festes Gesicht wie 1.0, ohne die Funktionen zu brechen – sie tun dann nichts):
 *   setAusdruck(name)  name aus AUSDRUECKE: 'neutral' | 'froh' | 'wuetend' | 'traurig' | 'ueberrascht' | 'schlafend'
 *                      (Start: look.ausdruck; bleibt bei setLook erhalten, außer der Teil-Look setzt ausdruck)
 *   ausdruck           aktueller Ausdruck (nur lesen)
 *   setLider(zu)       0 = Lider wie Ausdruck … 1 = geschlossen (müde, zwinkern; additiv zum Blinzeln)
 *   blinzeln(dauer)    einmal blinzeln (Standard 0,16 s)
 *   setBlick(x, y)     Pupillen −1…1 (x + = zur linken Seite der Figur/+X, y + = hoch)
 *   updateGesicht(dt)  pro Frame aufrufen: Blinzel-Animation + automatisches Blinzeln alle 2–6 s (seed-deterministisch)
 *   gesicht            das Objekt aus createGesicht (oder null), z. B. gesicht.autoBlinzeln = false
 */
import { hashSeed } from '../../core/rng.js';
import { createMeshBuilder, standardMaterial } from '../../render/mesh-builder.js';
import { createLook, koerperMasse } from './character-look.js';
import { createRig } from './character-rig.js';
import {
  teilKontext, baueTorso, baueHals, baueBecken, baueOberarm, baueUnterarm, baueHand,
  baueOberschenkel, baueUnterschenkel, baueFuss, baueUmhang, baueRucksack,
} from './character-parts.js';
import { baueKopf, baueKopfbedeckung } from './character-parts-kopf.js';
import { baueZubehoer, hatZubehoer } from './character-parts-zubehoer.js';
import { createGesicht } from './character-parts-gesicht.js';

/** Bauplan: Mesh-Name → { an: Knochen (k) oder Sockel (s), bau, nur?(ctx) }. Paare L/R teilen sich die Bau-Funktion. */
const PLAN = [
  ['becken', { k: 'becken', bau: baueBecken }],
  ['torso', { k: 'torso', bau: baueTorso }],
  ['zubehoer', { k: 'torso', bau: baueZubehoer, nur: hatZubehoer }],
  ['hals', { k: 'hals', bau: baueHals }],
  ['kopf', { k: 'kopf', bau: baueKopf }],
  ['kopfbedeckung', { k: 'kopf', bau: baueKopfbedeckung, nur: (c) => c.stil.hut !== 'keine' }],
  ...['L', 'R'].flatMap((s) => [
    ['oberarm' + s, { k: 'schulter' + s, bau: baueOberarm }],
    ['unterarm' + s, { k: 'ellbogen' + s, bau: baueUnterarm }],
    ['hand' + s, { k: 'hand' + s, bau: baueHand }],
    ['oberschenkel' + s, { k: 'huefte' + s, bau: baueOberschenkel }],
    ['unterschenkel' + s, { k: 'knie' + s, bau: baueUnterschenkel }],
    ['fuss' + s, { k: 'fuss' + s, bau: baueFuss }],
  ]),
  ['umhang', { s: 'umhang', bau: baueUmhang, nur: (c) => c.stil.umhang !== 'kein' }],
  ['rucksack', { s: 'ruecken', bau: baueRucksack, nur: (c) => c.L.rucksack }],
];

function mischen(a, b) {
  const o = { ...a };
  for (const [k, v] of Object.entries(b || {})) o[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? { ...a[k], ...v } : v;
  return o;
}

/**
 * opts: { look (Teil-Look), seed = 1 (Farbvariation), material? (Standard: geteiltes standardMaterial()), schatten = true,
 *         mimik = true (bewegliches Gesicht: +3 kleine Meshes; false = festes Gesicht im Kopf-Mesh, spart Draw-Calls bei Massen-NPCs) }
 * → { root, rig, look, masse, meshes, gesicht, ausdruck, setLook(teil), befestigen(sockel, obj), loesen(sockel|obj), setSichtbar(b),
 *     setAusdruck(name), setLider(zu), blinzeln(dauer), setBlick(x, y), updateGesicht(dt), dispose() }
 */
export function createCharacterModel({ look = {}, seed = 1, material = null, schatten = true, mimik = true } = {}) {
  const mat = material || standardMaterial();
  const modell = { look: createLook(look), meshes: [], gesicht: null };
  let zustand = { ausdruck: modell.look.ausdruck, zu: 0, blick: [0, 0] };   // Gesichtszustand überlebt setLook
  modell.masse = koerperMasse(modell.look);
  const rig = createRig(modell.masse);
  modell.rig = rig;
  modell.root = rig.root;
  const befestigt = new Map();   // object3d → sockelName

  function bauen() {
    const ctx = teilKontext(modell.look, modell.masse, { mimik });
    for (const [name, p] of PLAN) {
      if (p.nur && !p.nur(ctx)) continue;
      const b = p.bau(createMeshBuilder({ seed: hashSeed(seed, name) }), ctx);
      if (!b || b.leer) continue;
      const mesh = b.mesh(mat);
      mesh.name = name;
      mesh.castShadow = schatten;
      mesh.receiveShadow = schatten;
      (p.k ? rig.knochen[p.k] : rig.sockel[p.s]).add(mesh);
      modell.meshes.push(mesh);
    }
    if (mimik) {
      const g = createGesicht(ctx, { seed, material: mat, schatten });
      g.setAusdruck(zustand.ausdruck).setLider(zustand.zu).setBlick(...zustand.blick);
      rig.knochen.kopf.add(g.gruppe);
      modell.gesicht = g;
      modell.meshes.push(...g.meshes);
    }
  }
  function abbauen() {
    for (const m of modell.meshes) { m.removeFromParent(); if (!m.userData.gesicht) m.geometry.dispose(); }
    modell.meshes.length = 0;
    modell.gesicht?.dispose();
    modell.gesicht = null;
  }

  /** Teil-Look (wird mit aktuellem Look gemischt) oder ganzer Look → Meshes neu, Rig-Maße anpassen. */
  modell.setLook = (teil) => {
    modell.look = createLook(mischen(modell.look, teil));
    if (teil && typeof teil === 'object' && 'ausdruck' in teil) zustand.ausdruck = modell.look.ausdruck;
    modell.masse = koerperMasse(modell.look);
    abbauen();
    rig.anpassen(modell.masse);
    bauen();
    return modell;
  };
  /** Objekt an Sockel hängen (handR, handL, kopf, ruecken, guertel, umhang). */
  modell.befestigen = (sockelName, obj) => {
    const s = rig.sockel[sockelName];
    if (!s) throw new Error(`Unbekannter Sockel: ${sockelName}`);
    s.add(obj);
    befestigt.set(obj, sockelName);
    return obj;
  };
  /** Sockelname → alle dort befestigten Objekte lösen; Objekt → nur dieses. Gibt die gelösten Objekte zurück. */
  modell.loesen = (wer) => {
    const weg = typeof wer === 'string' ? [...befestigt].filter(([, s]) => s === wer).map(([o]) => o) : befestigt.has(wer) ? [wer] : [];
    for (const o of weg) { o.removeFromParent(); befestigt.delete(o); }
    return weg;
  };
  modell.setSichtbar = (an) => { rig.root.visible = !!an; return modell; };
  // Gesicht (siehe Modulkopf). Ohne Mimik: Zustand wird nur gemerkt.
  modell.setAusdruck = (name) => { zustand.ausdruck = createLook({ ausdruck: name }).ausdruck; modell.gesicht?.setAusdruck(zustand.ausdruck); return modell; };
  modell.setLider = (zu) => { zustand.zu = zu; modell.gesicht?.setLider(zu); return modell; };
  modell.blinzeln = (dauer) => { modell.gesicht?.blinzeln(dauer); return modell; };
  modell.setBlick = (x = 0, y = 0) => { zustand.blick = [x, y]; modell.gesicht?.setBlick(x, y); return modell; };
  modell.updateGesicht = (dt) => { modell.gesicht?.update(dt); return modell; };
  Object.defineProperty(modell, 'ausdruck', { get: () => zustand.ausdruck, enumerable: true });
  /** Gibt Geometrien frei und hängt die Figur aus (geteiltes Material bleibt; eigenes material gehört dem Aufrufer). */
  modell.dispose = () => {
    abbauen();
    for (const o of befestigt.keys()) o.removeFromParent();
    befestigt.clear();
    rig.dispose();
  };

  bauen();
  return modell;
}
