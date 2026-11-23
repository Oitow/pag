// Dämmerwald – Kronen der Riesen als dichtes Laub: Blatt-Karten-Klumpen (engine/models/natur/laub-klumpen.js) entlang der Kronen-Büschel,
// alle Riesen in EINEM Draw-Call (engine/render/laub-karten.js). Die Gauß-Splats (splats.js) sind nur noch der weiche Rand.
// Kronen-Skelett: dieselbe Form wie wald.js (riesenbaum-form, gleiche Optionen + detail je LOD-Stufe) → Laub sitzt an den sichtbaren Ästen.
import * as THREE from 'three';
import { baueForm } from '../../../engine/models/natur/riesenbaum-form.js';
import { laubKarten, sammleKarten } from '../../../engine/models/natur/laub-klumpen.js';
import { createLaubKarten } from '../../../engine/render/laub-karten.js';
import { RIESEN_VARIANTEN, pfadAbstand, nebenPfad, LICHTUNG } from './plan-daten.js';
import { SONNE } from './licht.js';
import { tageslicht } from './tageslicht.js';

// Kronen-Lücken: hier fehlt das Laub – schräge Säulen entlang der Mittagssonne (12:30) über Pfad-Punkten, damit mittags Licht bis auf den Pfad fällt
// (Kronen-Lichtkarte in licht.js). Morgens/abends kommt das Licht flach von der Seite durch die Stammreihen. [z am Pfad, seitlich m, Radius m] + Lichtung.
const MITTAG = tageslicht(12.5).richtung;
export const KRONEN_LUECKEN = [[34, -3, 10], [84, 4, 9], [118, -3, 11], [171, 3, 9], [204, -4, 11], [262, 3, 10], [318, -3, 10], [362, 4, 9]]
  .map(([z, seite, r]) => ({ ...nebenPfad(z, seite), r })).concat([{ x: LICHTUNG.x, z: LICHTUNG.z, r: LICHTUNG.radius * 0.8 }]);

/** Entfernt Karten in den Lücken-Säulen (Achse = Mittagssonne, weicher gezackter Rand über die Saat der Karte). Ändert `k` an Ort und Stelle. */
function schneideLuecken(k, luecken, achse = MITTAG) {
  const [ax, ay, az] = achse, l2 = Math.hypot(ax, ay, az), A = [ax / l2, ay / l2, az / l2];
  let n = 0;
  for (let i = 0; i < k.anzahl; i++) {
    const x = k.mitte[i * 3], y = k.mitte[i * 3 + 1], z = k.mitte[i * 3 + 2], g = k.daten[i * 3], rand = k.daten[i * 3 + 2];
    const frei = luecken.some((l) => {
      const dx = x - l.x, dz = z - l.z, t = dx * A[0] + y * A[1] + dz * A[2];   // Fuß der Säule auf y = 0 (Pfadhöhe ≈ 0 … 12 m, genügt)
      return Math.hypot(dx - t * A[0], y - t * A[1], dz - t * A[2]) < l.r * (0.75 + 0.5 * rand) + g * 0.5;
    });
    if (frei) continue;
    if (n !== i) for (const f of [k.mitte, k.normale, k.farbe, k.daten]) f.copyWithin(n * 3, i * 3, i * 3 + 3);
    n++;
  }
  k.anzahl = n;
  return k;
}

/** Höhendunst der Äste (wald.js-Material) an den der Kronen angleichen – ohne wald.js zu ändern. Vor dem ersten Rendern aufrufen. */
export function astDunst(material, { ab = 48, bis = 165, max = 0.55 } = {}) {
  const vorher = material.onBeforeCompile;
  material.onBeforeCompile = (s, r) => { vorher?.(s, r); s.uniforms.uDwDunst?.value.set(ab, bis, max); };
  const alt = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => 'dw-astdunst|' + (alt ? alt() : '');
  material.needsUpdate = true;
  return material;
}

/**
 * opts: { szene, wald (createWald), licht (createLicht), detail (Q.detail), dichte (0..1, Qualität) }
 * → { laub, anzahl, setzeLicht({ sonne, farbe, umgebung, boden }), update(zeit), dispose() }
 */
export function createKronen({ szene, wald, licht, detail = 1, dichte = 1 }) {
  if (!wald.echt) return { anzahl: 0, setzeLicht() {}, update() {}, dispose() {} };
  const d = Math.max(0.45, detail), lager = new Map();
  // Kartensatz je Variante + Kronen-Detail (wald.js: Stufe 0 = detail d, sonst 0.45 → gleiche Äste wie das Netz)
  const karten = (nr, det) => {
    const key = nr + ':' + det;
    if (!lager.has(key)) {
      const v = RIESEN_VARIANTEN[nr], form = baueForm({ ...v, detail: det });
      lager.set(key, laubKarten(form.krone, { seed: v.seed, H: v.hoehe, kronenAb: form.masse.kronenAb, dichte }));
    }
    return lager.get(key);
  };
  const eintraege = [], m4 = new THREE.Matrix4(), pos = new THREE.Vector3();
  for (const mesh of wald.meshes) {
    const treffer = /^riesen-(\d+)-s(\d)$/.exec(mesh.name);
    if (!treffer) continue;
    const nr = +treffer[1], st = +treffer[2];
    for (let k = 0; k < mesh.count; k++) {
      mesh.getMatrixAt(k, m4); pos.setFromMatrixPosition(m4);
      // LOD nach Pfad-Nähe (der Spieler bleibt auf dem Pfad): nah voll, fern bis 30 % (größere Karten)
      const a = pfadAbstand(pos.x, pos.z), anteil = st === 0 || a < 36 ? 1 : Math.max(0.3, 1.1 - a / 120);
      eintraege.push({ karten: karten(nr, st === 0 ? d : 0.45), matrix: m4.elements.slice(), anteil, seed: 7 + nr * 13 + k });
    }
  }
  const welt = schneideLuecken(sammleKarten(eintraege), KRONEN_LUECKEN);
  // Startlicht aus den Szenen-Lichtern (three: Lambert-Anteil = Farbe · Stärke / π)
  const s = licht.sonne, h = licht.himmelslicht;
  const laub = createLaubKarten({
    karten: welt, sonne: SONNE.clone(),
    sonnenFarbe: s.color.clone().multiplyScalar(s.intensity / Math.PI),
    umgebung: h.color.clone().multiplyScalar(h.intensity / Math.PI * 1.15),
    boden: h.groundColor.clone().multiplyScalar(h.intensity / Math.PI),
    blatt: 0.55, hoehenDunst: { ab: 80, bis: 175, max: 0.32 },
  });
  szene.add(laub.mesh);
  astDunst(wald.material);
  return {
    laub, anzahl: laub.anzahl,
    /** Für einen späteren Tag-Nacht-Zyklus: je Bild aufrufen (sonne = Richtung ZUR Sonne). */
    setzeLicht: laub.setzeLicht,
    update(zeit) { laub.update(zeit); },
    dispose() { laub.dispose(); },
  };
}
