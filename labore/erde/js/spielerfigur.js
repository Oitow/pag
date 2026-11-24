// Spielerfigur (3. Person): Engine-Figur (character-model + character-animator) an den Füßen des Spielers,
// aufrecht zur Ortsnormale, Blick in Laufrichtung. Sichtbar nur in der 3.-Person-Ansicht (welt.ansicht() === 3) und zu Fuß.
// Figur-Aussehen: ?figur=wanderer|ritter|baeuerin|… (engine character-look VORLAGEN), ?koerper=organisch (glatter SDF-Körper).
import * as THREE from 'three';
import { createCharacterModel } from '../../../engine/models/character/character-model.js';
import { createAnimator } from '../../../engine/models/character/character-animator.js';
import { VORLAGEN } from '../../../engine/models/character/character-look.js';

const AUGE = 1.7;

export function createSpielerfigur(welt) {
  const P = new URLSearchParams(globalThis.location?.search || '');
  const look = VORLAGEN[P.get('figur')] || VORLAGEN.wanderer;
  const modell = createCharacterModel({ look, seed: 7, schatten: true, mimik: true, koerper: P.get('koerper') === 'organisch' ? 'organisch' : undefined });
  const anim = createAnimator(modell, { seed: 7, hang: false });
  const huelle = new THREE.Group();          // trägt Lage + Drehung auf der Kugel; modell.root bleibt lokal (y = oben, +z = vorn)
  huelle.add(modell.root);
  welt.anker.add(huelle);

  const fuss = new THREE.Vector3(), vorher = new THREE.Vector3(), quer = new THREE.Vector3(), m = new THREE.Matrix4();
  const richtung = new THREE.Vector3(0, 0, 1);
  let erstes = true;
  const zustand = { tempo: 0, amBoden: true, vel: { y: 0 }, imWasser: false, eintauchen: 0, gleitet: false };

  function update(dt) {
    const sp = welt.spieler();
    const zeigen = sp.gehen && welt.ansicht?.() === 3;
    huelle.visible = zeigen;
    if (!zeigen) { erstes = true; return; }
    // Füße: unter dem Auge entlang der Ortsnormale
    fuss.copy(welt.cam).addScaledVector(welt.oben, -AUGE);
    const fliegt = !!welt.dienste.gleiter?.fliegt?.();
    if (fliegt) fuss.addScaledVector(welt.oben, 0.4);
    // Tempo aus der Bewegung (waagerecht), Blick in Laufrichtung – steht er, schaut er wie die Kamera
    if (!erstes && dt > 0) {
      quer.subVectors(fuss, vorher).projectOnPlane(welt.oben);
      const v = quer.length() / dt;
      zustand.tempo = Math.min(12, v);
      if (v > 0.4) richtung.copy(quer).normalize();
      else richtung.lerp(welt.vorn, Math.min(1, dt * 3)).projectOnPlane(welt.oben).normalize();
    } else richtung.copy(welt.vorn);
    erstes = false;
    vorher.copy(fuss);
    zustand.amBoden = sp.amBoden || sp.schwimmt;
    zustand.vel.y = sp.fallV;
    zustand.imWasser = sp.schwimmt; zustand.eintauchen = sp.schwimmt ? 0.8 : 0;
    zustand.gleitet = fliegt;
    // Lage: Basis x = oben × vorn, y = oben, z = vorn
    quer.crossVectors(welt.oben, richtung).normalize();
    m.makeBasis(quer, welt.oben, richtung);
    huelle.quaternion.setFromRotationMatrix(m);
    huelle.position.copy(fuss);
    anim.update(dt, zustand);
    modell.updateGesicht?.(dt);
  }

  return {
    name: 'spielerfigur',
    update,
    dispose() { welt.anker.remove(huelle); anim.dispose?.(); modell.dispose(); },
  };
}
