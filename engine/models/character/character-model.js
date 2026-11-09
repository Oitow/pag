/**
 * @modul    character-model
 * @zweck    Look → fertige Figur: Rig (Gelenk-Gruppen) + Low-Poly-Meshes je Knochen; Look live wechseln, Gegenstände an Sockeln befestigen
 * @api      createCharacterModel({ look, seed, material, schatten }) -> { root, rig, look, masse, meshes, setLook(teilOderLook), befestigen(sockel,obj), loesen(sockelOderObj), setSichtbar(bool), dispose() }
 * @beispiel
 *   import { createCharacterModel } from '../../engine/models/character/character-model.js';
 *   const figur = createCharacterModel({ look: VORLAGEN.ritter, seed: 4 });
 *   szene.add(figur.root);
 *   figur.befestigen('handR', schwert);
 *   figur.setLook({ kopfbedeckung: { stil: 'krone' } });   // Rig-Gruppen & Befestigtes bleiben erhalten
 * @tags     figur, charakter, modell, mesh, spieler, npc, avatar, editor, ausrüstung
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
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

/** Bauplan: Mesh-Name → { an: Knochen (k) oder Sockel (s), bau, nur?(ctx) }. Paare L/R teilen sich die Bau-Funktion. */
const PLAN = [
  ['becken', { k: 'becken', bau: baueBecken }],
  ['torso', { k: 'torso', bau: baueTorso }],
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
 * opts: { look (Teil-Look), seed = 1 (Farbvariation), material? (Standard: geteiltes standardMaterial()), schatten = true }
 * → { root, rig, look, masse, meshes, setLook(teil), befestigen(sockel, obj), loesen(sockel|obj), setSichtbar(b), dispose() }
 */
export function createCharacterModel({ look = {}, seed = 1, material = null, schatten = true } = {}) {
  const mat = material || standardMaterial();
  const modell = { look: createLook(look), meshes: [] };
  modell.masse = koerperMasse(modell.look);
  const rig = createRig(modell.masse);
  modell.rig = rig;
  modell.root = rig.root;
  const befestigt = new Map();   // object3d → sockelName

  function bauen() {
    const ctx = teilKontext(modell.look, modell.masse);
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
  }
  function abbauen() {
    for (const m of modell.meshes) { m.removeFromParent(); m.geometry.dispose(); }
    modell.meshes.length = 0;
  }

  /** Teil-Look (wird mit aktuellem Look gemischt) oder ganzer Look → Meshes neu, Rig-Maße anpassen. */
  modell.setLook = (teil) => {
    modell.look = createLook(mischen(modell.look, teil));
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
