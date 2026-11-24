// Zeit und Wetter auf dem Planeten: Spieluhr (engine/core/zeit), Wetterwechsel nach dem Klima am Ort (engine/world/wetter),
// Regen/Schnee (engine/render/niederschlag). Die Engine-Bausteine denken in flacher Welt (y = oben) – deshalb läuft der
// Niederschlag in einer kleinen „Ortsszene“ mit eigener Kamera, deren y die Senkrechte am Ort ist.
// Sonnenstand, Temperatur jetzt: klima.js (Drehachse y, Jahreszeiten durch die Achsneigung).
import * as THREE from 'three';
import { createSpielzeit } from '../../../engine/core/zeit.js';
import { createWetter } from '../../../engine/world/wetter.js';
import { createNiederschlag } from '../../../engine/render/niederschlag.js';
import { sonnenRichtung, tempJetzt, uhrFuer, ortszeit } from './klima.js';

const WETTER_NAME = { klar: 'klar', heiter: 'heiter', bewoelkt: 'bewölkt', regen: 'Regen', gewitter: 'Gewitter', schnee: 'Schnee', nebel: 'Nebel', sturm: 'Sturm' };

export function createZeitWetter({ seed = 1, sekundenProStunde = 60, zustand = null } = {}) {
  const uhr = createSpielzeit({ stunde: 9, sekundenProStunde });
  const wetter = createWetter({ seed: seed * 31 + 5 });
  if (zustand?.uhr) uhr.lade(zustand.uhr);
  if (zustand?.wetter) wetter.lade(zustand.wetter);

  // Ortsszene für den Niederschlag
  const ortSzene = new THREE.Scene();
  const ortKamera = new THREE.PerspectiveCamera();
  const nieder = createNiederschlag({ seed });
  nieder.objekt.material.depthTest = false;   // Hauptszene nutzt logarithmische Tiefe – Regen liegt eh nah vor der Kamera
  ortSzene.add(nieder.objekt);
  const basis = new THREE.Matrix4(), qBasis = new THREE.Quaternion(), ost = new THREE.Vector3(), sued = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0);

  const sonne = new THREE.Vector3(), windWelt = new THREE.Vector3(1, 0, 0);
  const s3 = [0, 0, 0];
  let tJetzt = 0, tempo = 1;

  /** Uhr so stellen, dass am Ort d (Einheitsvektor [x,y,z]) die Ortszeit `stunde` ist. */
  const stelleOrtszeit = (d, stunde = 9) => uhr.setze({ stunde: uhrFuer(stunde, d) });

  /**
   * Je Bild: dt (echte s), oben (Einheitsvektor am Ort), klima = { tMittel (°C Jahresmittel am Ort), feuchte } (vom Planeten).
   */
  function update(dt, oben, klima) {
    uhr.tempo = tempo;
    const vorher = uhr.stunde + uhr.tag * 24;
    uhr.update(dt);
    const dStunden = Math.max(0, uhr.stunde + uhr.tag * 24 - vorher);
    const d = [oben.x, oben.y, oben.z];
    tJetzt = tempJetzt(klima.tMittel, d, uhr.stunde, uhr.jahresAnteil, klima.feuchte, wetter);
    // Wetter-Klima: Temperatur 0 (≤ −10 °C) … 1 (≥ 35 °C), Feuchte direkt
    wetter.update(dStunden, { temperatur: (tJetzt + 10) / 45, feuchte: klima.feuchte });
    wetter.blitzUpdate(dt);
    sonnenRichtung(uhr.stunde, uhr.jahresAnteil, s3);
    sonne.set(s3[0], s3[1], s3[2]);

    // Ortsrahmen: x = Ost, y = oben, z = Süd
    ost.crossVectors(Y, oben); if (ost.lengthSq() < 1e-8) ost.set(1, 0, 0); ost.normalize();
    sued.crossVectors(ost, oben).normalize();
    basis.makeBasis(ost, oben, sued);
    qBasis.setFromRotationMatrix(basis);
    // Wind (Winkel in der Ortsebene) als Weltvektor für die Pflanzen
    const w = wetter.windRichtung ?? 0;
    windWelt.copy(ost).multiplyScalar(Math.cos(w)).addScaledVector(sued, Math.sin(w)).normalize();
    const kalt = tJetzt < 0.5;   // Regen fällt bei Frost als Schnee
    nieder.update(dt, { mitte: new THREE.Vector3(), regen: kalt ? 0 : wetter.regen, schnee: kalt ? Math.max(wetter.schnee, wetter.regen) : wetter.schnee, wind: wetter.wind, windRichtung: w });
  }

  /** Nach der Hauptszene zeichnen (gleiche Projektion; Kamera in Ortskoordinaten gedreht). */
  function zeichne(renderer, kamera) {
    if (!nieder.objekt.visible) return;
    ortKamera.projectionMatrix.copy(kamera.projectionMatrix);
    ortKamera.projectionMatrixInverse.copy(kamera.projectionMatrixInverse);
    ortKamera.quaternion.copy(qBasis).invert().multiply(kamera.quaternion);
    ortKamera.position.set(0, 0, 0);
    ortKamera.updateMatrixWorld(true);
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(ortSzene, ortKamera);
    renderer.autoClear = ac;
  }

  function text(oben) {
    const h = ortszeit(uhr.stunde, [oben.x, oben.y, oben.z]);
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    return `Tag ${uhr.tag} · ${uhr.jahreszeitName} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${WETTER_NAME[wetter.art] || wetter.art} · ${tJetzt.toFixed(0)} °C`;
  }

  return {
    update, zeichne, text, stelleOrtszeit, uhr, wetter, sonne, windWelt,
    get tJetzt() { return tJetzt; },
    get tempo() { return tempo; }, set tempo(t) { tempo = t; },
    zustand: () => ({ uhr: uhr.zustand(), wetter: wetter.zustand() }),
    dispose() { nieder.dispose(); uhr.dispose(); wetter.dispose(); },
  };
}
