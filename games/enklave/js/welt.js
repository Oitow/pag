// Enklave – Welt: fester Seed + Plan (engine/world/welt-plan) → worldgen → Adapter → Gelände, Natur, Brücken, Kollisions-Welt.
// Nur Verdrahtung von Engine-Bausteinen. Der Plan (plan-daten.js) ist auf Seed hashSeed('enklave', 1) und diese Optionen abgestimmt.
import { createWorld } from '../../../engine/world/worldgen/worldgen.js';
import { createWeltAdapter } from '../../../engine/world/worldgen/worldgen-adapter.js';
import { createWeltPlan } from '../../../engine/world/welt-plan.js';
import { createTerrainMesh } from '../../../engine/world/terrain-mesh.js';
import { createScatterMesh } from '../../../engine/world/scatter-mesh.js';
import { createWegeMesh } from '../../../engine/world/wege-mesh.js';
import { mitBruecken } from '../../../engine/world/wege-lage.js';
import { createKollisionsWelt } from '../../../engine/world/kollision.js';
import { createAssetCache } from '../../../engine/models/natur/natur-assets.js';
import { hashSeed } from '../../../engine/core/rng.js';
import { ENKLAVE_PLAN } from './plan-daten.js';

export const HOEHEN_SKALA = 60, METER_PRO_ZELLE = 2.5;
export const WELT_SEED = hashSeed('enklave', 1);

/** opts: { szene, pruefen = false } → { welt, adapter, plan (welt-plan), gelaende, objekte, wege, kollision (begehbar), msWelt, pruefung, update(zeit, {kamera}), dispose() } */
export function baueWelt({ szene, pruefen = false }) {
  const t0 = performance.now();
  const plan = createWeltPlan(ENKLAVE_PLAN, { meterProZelle: METER_PRO_ZELLE, hoehenSkala: HOEHEN_SKALA });
  const welt = createWorld({ preset: 'insel', seed: WELT_SEED, breite: 256, tiefe: 256, qualitaet: 'normal', form: { radius: 0.95 },
    wasser: { flussMenge: 0.45 }, orte: { doerfer: 0 }, objekte: { dichte: 0.45, artDichte: { bodendecker: 0.5 } }, stufen: plan.stufen });
  const adapter = createWeltAdapter(welt, { hoehenSkala: HOEHEN_SKALA, meterProZelle: METER_PRO_ZELLE });
  const msWelt = performance.now() - t0;
  const pruefung = pruefen ? plan.pruefe(adapter) : null;
  const gelaende = createTerrainMesh(adapter, { schatten: true });
  const objekte = createScatterMesh(adapter, { schatten: false, unterWasser: false, assets: createAssetCache, bodendeckerWeite: 60, kachel: 0, varianten: 2, variantenBoden: 1, detail: 0, fernWeite: 0,
    typSkala: { fels: 1.4, felsbrocken: 1.8 } });
  const wege = createWegeMesh(adapter, { schatten: true });
  const kollision = createKollisionsWelt({ welt: mitBruecken(adapter, wege.lagen) });
  szene.add(gelaende.gruppe, objekte.gruppe, wege.gruppe);
  return {
    welt, adapter, plan, gelaende, objekte, wege, kollision, msWelt, pruefung,
    update(zeit, opts) { objekte.update(zeit, opts); },
    dispose() {
      gelaende.dispose(); objekte.dispose(); wege.dispose(); kollision.dispose(); adapter.dispose(); plan.dispose();
      szene.remove(gelaende.gruppe, objekte.gruppe, wege.gruppe);
    },
  };
}
