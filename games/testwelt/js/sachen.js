// Testwelt – Dinge & Handeln: alles, womit die Figur die Welt anfasst. Nur Verdrahtung von Engine-Bausteinen:
//   world/kollision (Kisten zum Draufspringen, Figuren-Körper) · gameplay/koerper (lose Dinge fallen, rollen, schwimmen)
//   gameplay/welt-dinge + inventar + core/register (Gegenstände aufheben/ablegen) · gameplay/interaktion (E: aufheben, ansprechen, fällen)
//   Bäume/Felsen abbauen: Adapter-Hindernis abschalten + Instanz im scatter-mesh verstecken → Holz/Steine fallen heraus.
import * as THREE from 'three';
import { createKoerperWelt } from '../../../engine/gameplay/koerper.js';
import { createWeltDinge } from '../../../engine/gameplay/welt-dinge.js';
import { createInteraktion } from '../../../engine/gameplay/interaktion.js';
import { createInventar } from '../../../engine/gameplay/inventar.js';
import { createRegister } from '../../../engine/core/register.js';
import { createEreignisse } from '../../../engine/core/ereignisse.js';
import { rng, hashSeed, range, int } from '../../../engine/core/rng.js';

const GEGENSTAENDE = {
  holz: { name: 'Holz', zeichen: '🪵', farbe: 0x8a5a2b, form: 'zyl', radius: 0.16, reibung: 6, auftrieb: 1.5 },
  stein: { name: 'Stein', zeichen: '🪨', farbe: 0x8d8a84, form: 'ico', radius: 0.14, sprung: 0.2, reibung: 10, auftrieb: 0.3 },
  apfel: { name: 'Apfel', zeichen: '🍎', farbe: 0xd0312d, form: 'kugel', radius: 0.09, sprung: 0.45, reibung: 3, haftung: 0.9, auftrieb: 1.2 },
  pilz: { name: 'Pilz', zeichen: '🍄', farbe: 0xe8d8b8, form: 'kegel', radius: 0.08, sprung: 0.1, auftrieb: 1.3 },
};
const ABBAU = { baum: { text: 'Fällen', gibt: 'holz', dauer: 1.6 }, fels: { text: 'Abbauen', gibt: 'stein', dauer: 2.2 }, kaktus: { text: 'Fällen', gibt: 'holz', dauer: 1.2 } };
const PLAETZE = 8;

/**
 * opts: { szene, welt (Kollisions-Welt über dem Adapter), objekte (scatter-mesh), bewohner [{figur, ansprechen}], start {x,z}, seed, stand (aus zustand()) }
 * Liefert { interaktion, inventar, ereignisse, update(dt, figur, gehalten) -> Ziel|null, zustand(), dispose() }.
 */
export function createSachen({ szene, welt, objekte, bewohner = [], start, seed = 1, stand = null }) {
  const r = rng(hashSeed('sachen', seed));
  const ereignisse = createEreignisse();
  const register = createRegister({ art: 'gegenstand', standard: { stapel: 20 } });
  register.definiereAlle(GEGENSTAENDE);
  const inventar = createInventar({ plaetze: PLAETZE, register, ereignisse });
  const physik = createKoerperWelt({ welt });
  const interaktion = createInteraktion({ ereignisse });
  const gruppe = new THREE.Group(); gruppe.name = 'sachen';
  szene.add(gruppe);

  // ---- Aussehen der Gegenstände (eine Geometrie + ein Material je Sorte) ----
  const geos = { zyl: new THREE.CylinderGeometry(0.5, 0.5, 2.4, 7).rotateZ(Math.PI / 2), ico: new THREE.IcosahedronGeometry(1, 0), kugel: new THREE.SphereGeometry(1, 10, 8), kegel: new THREE.ConeGeometry(1, 1.6, 8) };
  const mats = {};
  const meshes = new Map();   // ding → Mesh
  const dinge = createWeltDinge({
    physik, interaktion, register, ereignisse,
    onNeu(d) {
      const g = register.hole(d.id);
      const mesh = new THREE.Mesh(geos[g.form], mats[d.id] ??= new THREE.MeshStandardMaterial({ color: g.farbe, flatShading: true, roughness: 0.9 }));
      mesh.scale.setScalar(g.radius); mesh.rotation.y = d.nr * 2.4; mesh.castShadow = true;
      gruppe.add(mesh); meshes.set(d, mesh);
    },
    onWeg(d) { meshes.get(d)?.removeFromParent(); meshes.delete(d); },
  });

  // ---- Kisten: begehbare Kästen als Treppe neben dem Start ----
  const kistenGeo = new THREE.BoxGeometry(1, 1, 1), kistenMat = new THREE.MeshStandardMaterial({ color: 0x9a6b3a, flatShading: true, roughness: 0.85 });
  const trocken = (x, z) => { const w = welt.wasserHoehe(x, z); return w === null || w < welt.bodenHoehe(x, z); };
  const winkel = range(r, 0, Math.PI * 2), rx = Math.sin(winkel), rz = Math.cos(winkel);
  for (const [k, h] of [0.45, 0.9, 1.35, 0.9].entries()) {
    const x = start.x + rx * (4 + k * 1.3), z = start.z + rz * (4 + k * 1.3);
    if (!trocken(x, z)) continue;
    const y0 = welt.bodenHoehe(x, z) - 0.3;
    welt.fuege({ form: 'kasten', x, z, bx: 0.65, bz: 0.65, winkel, y0, hoehe: h + 0.3, begehbar: true, daten: { art: 'kiste' } });
    const mesh = new THREE.Mesh(kistenGeo, kistenMat);
    mesh.scale.set(1.3, h + 0.3, 1.3); mesh.position.set(x, y0 + (h + 0.3) / 2, z); mesh.rotation.y = winkel;
    mesh.castShadow = mesh.receiveShadow = true;
    gruppe.add(mesh);
  }

  // ---- Bewohner ansprechen ----
  bewohner.forEach((b, i) => interaktion.melde('npc:' + i, {
    pos: () => b.figur.zustand.pos, radius: 0.3, art: 'npc', text: (b.figur.name || 'Bewohner') + ' ansprechen', prio: 0.4,
    aktion: (wer) => { b.ansprechen(wer.figur); wer.figur.blickZu(b.figur); },
  }));

  // ---- Bäume und Felsen abbauen ----
  const abgebaut = [];
  function baueAb(h, still = false) {
    if (!welt.setHindernis?.(h.index, false)) return;
    objekte?.verstecke(h.index);
    abgebaut.push(h.index);
    if (still) return;
    const a = ABBAU[h.art], n = int(r, 2, 4);
    for (let k = 0; k < n; k++) dinge.wirf(a.gibt, 1, { x: h.x, y: welt.bodenHoehe(h.x, h.z) + (h.art === 'baum' ? 0.8 : 0), z: h.z }, range(r, 0, Math.PI * 2), { tempo: 2.2, hoch: 4, streuung: 1 });
    ereignisse.sende('abgebaut', { art: h.art, typ: h.typ });
  }
  let abbauZiel = null, abbauZeit = 0, hackZeit = 0;
  function abbauSuchen(p) {
    const h = welt.hindernisNah?.(p.x, p.z, 1.3, (k) => !!ABBAU[k.art]) || null;
    if (h?.index === abbauZiel?.index) return;
    abbauZiel = h;
    interaktion.entferne('abbau');
    if (!h) return;
    const a = ABBAU[h.art];
    interaktion.melde('abbau', { pos: { x: h.x, z: h.z }, radius: h.radius, reichweite: 1.3, art: 'abbau', text: a.text, dauer: a.dauer, prio: -0.5,
      aktion: () => { baueAb(h); abbauZiel = null; interaktion.entferne('abbau'); } });
  }

  // ---- Spielstand oder frische Streu-Gegenstände ----
  if (stand) {
    inventar.lade(stand.inv);
    dinge.lade(stand.dinge);
    const weg = new Set(Array.isArray(stand.weg) ? stand.weg : []);
    welt.alleHindernisse?.((h) => { if (weg.has(h.index)) baueAb(h, true); });
  } else {
    for (let k = 0; k < 14; k++) {
      const x = start.x + range(r, -9, 9), z = start.z + range(r, -9, 9);
      if (trocken(x, z)) dinge.lege(k % 3 ? 'apfel' : 'pilz', 1, { x, y: welt.bodenHoehe(x, z) + 0.5, z });
    }
  }

  // ---- Anzeige: Hinweis + Inventarleiste (antippen = ablegen) ----
  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:max(88px,calc(env(safe-area-inset-bottom) + 88px));display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;z-index:3';
  const hinweis = document.createElement('div');
  hinweis.style.cssText = 'padding:5px 12px;border-radius:999px;background:rgba(18,22,28,.82);border:1px solid rgba(255,255,255,.14);font-size:13px;white-space:nowrap;visibility:hidden';
  const leiste = document.createElement('div');
  leiste.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:4px;max-width:94vw;pointer-events:auto';
  const felder = [];
  let wurfWunsch = -1;
  for (let i = 0; i < PLAETZE; i++) {
    const f = document.createElement('button');
    f.style.cssText = 'width:44px;height:44px;min-height:0;padding:0;border-radius:8px;background:rgba(18,22,28,.82);border:1px solid rgba(255,255,255,.14);font-size:18px;position:relative;line-height:1';
    f.title = 'Antippen = ablegen';
    f.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); wurfWunsch = i; });
    leiste.append(f); felder.push(f);
  }
  hud.append(hinweis, leiste); document.body.append(hud);
  function zeichneLeiste() {
    inventar.plaetze.forEach((p, i) => {
      felder[i].innerHTML = p ? `${register.hole(p.id).zeichen}<span style="position:absolute;right:3px;bottom:1px;font-size:10px;color:#eef1f4">${p.anzahl > 1 ? p.anzahl : ''}</span>` : '';
    });
  }
  const ab = inventar.onAenderung(zeichneLeiste);
  zeichneLeiste();
  let hinweisText = '';

  const wer = { x: 0, y: 0, z: 0, yaw: 0, inventar, figur: null };
  ereignisse.an('ding:aufgehoben', (e) => e.wer?.figur?.spiele('aufheben'));   // nur wenn wirklich etwas ins Inventar ging
  return {
    interaktion, inventar, ereignisse, dinge, physik,
    /** Je Bild: Physik, Aufheben/Ansprechen/Abbauen. `gehalten` = Interaktions-Taste. Liefert das aktuelle Ziel (für den Touch-Knopf). */
    update(dt, figur, gehalten) {
      const z = figur.zustand, p = z.pos;
      wer.x = p.x; wer.y = p.y; wer.z = p.z; wer.yaw = z.yaw; wer.figur = figur;
      if (wurfWunsch >= 0) {                             // Platz angetippt → Stapel vor die Füße werfen
        const s = inventar.nimmVon(wurfWunsch); wurfWunsch = -1;
        if (s) { dinge.wirf(s.id, s.anzahl, p, z.yaw); figur.spiele('werfen'); }
      }
      physik.schiebe(p.x, p.z, figur.motor.radius, z.vel.x, z.vel.z, p.y, figur.motor.hoehe);
      physik.update(dt);
      dinge.update(dt);
      if ((abbauZeit -= dt) <= 0) { abbauZeit = 0.15; abbauSuchen(p); }
      interaktion.aktualisiere();
      const res = interaktion.halte(wer, dt, gehalten);
      const ziel = res.ziel;
      hackZeit -= dt;
      if (ziel?.art === 'abbau' && res.anteil > 0 && hackZeit <= 0) { figur.spiele('hacken'); hackZeit = 0.8; figur.blickZu({ x: ziel.x, y: p.y + 1, z: ziel.z }); }
      if (ziel?.art !== 'npc' && !(ziel?.art === 'abbau' && res.anteil > 0)) figur.blickZu(null);
      for (const [d, mesh] of meshes) { const k = d.koerper; if (!k.ruht || mesh.position.y !== k.pos.y) mesh.position.set(k.pos.x, k.pos.y, k.pos.z); }
      const text = ziel ? (ziel.dauer > 0 ? `E halten – ${ziel.text}${res.anteil > 0 ? ' ' + Math.round(res.anteil * 100) + ' %' : ''}` : `E – ${ziel.text}`) : '';
      if (text !== hinweisText) { hinweisText = text; hinweis.textContent = text; hinweis.style.visibility = text ? 'visible' : 'hidden'; }
      return ziel;
    },
    zustand: () => ({ inv: inventar.zustand(), dinge: dinge.zustand(), weg: abgebaut.slice() }),
    dispose() {
      ab(); hud.remove(); dinge.dispose(); physik.dispose(); interaktion.dispose(); inventar.dispose(); ereignisse.dispose();
      for (const g of Object.values(geos)) g.dispose();
      for (const m of Object.values(mats)) m.dispose();
      kistenGeo.dispose(); kistenMat.dispose(); gruppe.removeFromParent();
    },
  };
}
