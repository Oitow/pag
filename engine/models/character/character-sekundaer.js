/**
 * @modul    character-sekundaer
 * @zweck    Sekundäre Bewegung (rein): Feder-Dämpfer für Kopf-Nachschwingen, Gewichtsverlagerung beim Anhalten/Anfahren, Umhang- und Haar-Winkel – additiv auf eine Pose
 * @api      createFeder({steif,daempf,wert}) -> { wert, v, schritt(dt,ziel,kraft), stoss(dv), setze(w) } ; createSekundaer(opts) -> { update(dt,info) -> werte, anwenden(pose,gewicht) -> pose, werte, stoss(vor,seit,hoch), reset(), dispose() }
 * @beispiel
 *   import { createSekundaer } from '../../engine/models/character/character-sekundaer.js';
 *   const sek = createSekundaer({ staerke: 1 });
 *   sek.update(dt, { tempo, beschl, quer: tempo * drehRate, vy, amBoden });
 *   sek.anwenden(pose);                         // Torso/Hals/Kopf schwingen nach (Beine bleiben unberührt)
 *   umhang.rotation.x = sek.werte.umhangX;      // Umhang/Haar-Teile selbst drehen
 * @tags     figur, charakter, animation, feder, sekundaer, nachschwingen, umhang, haar, gewicht
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { clamp, numOr } from '../../core/math.js';

/**
 * Feder-Dämpfer 2. Ordnung: a = steif·(ziel − wert) − daempf·v + kraft. Semi-implizit, große dt in Teilschritte zerlegt.
 * daempf = 2·√steif → kritisch gedämpft; kleiner → Nachschwingen.
 */
export function createFeder({ steif = 80, daempf = 10, wert = 0 } = {}) {
  const f = {
    wert: numOr(wert, 0), v: 0, steif, daempf,
    schritt(dt, ziel = 0, kraft = 0) {
      dt = clamp(numOr(dt, 0), 0, 0.25);
      ziel = numOr(ziel, 0); kraft = numOr(kraft, 0);
      const n = Math.max(1, Math.ceil(dt / (1 / 120)));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        f.v += (f.steif * (ziel - f.wert) - f.daempf * f.v + kraft) * h;
        f.wert += f.v * h;
      }
      if (!Number.isFinite(f.wert) || !Number.isFinite(f.v)) { f.wert = 0; f.v = 0; }
      return f.wert;
    },
    stoss(dv) { f.v += numOr(dv, 0); return f; },
    setze(w = 0) { f.wert = numOr(w, 0); f.v = 0; return f; },
  };
  return f;
}

/**
 * opts = { staerke = 1 (alles skalieren), kopf = 1, gewicht = 1, umhang = 1, haar = 1 (Anteile), grenze = 0.5 (rad je Kanal) }.
 * info je Frame (alles optional): { tempo (m/s), beschl (m/s² vorwärts, + = anfahren), quer (m/s² seitlich, + = Fliehkraft nach links/+X),
 *   vy (m/s), amBoden (bool) }.
 * werte: { kopfX, kopfZ, torsoX, torsoZ, umhangX, umhangZ, haarX, haarZ } in rad (umhang/haar absolut, Rest additiv).
 *   umhangX/haarX + = Saum nach hinten (−Z) schwingen, umhangZ/haarZ + = Saum nach links (+X) – passend für Teile, die nach −Y hängen.
 */
export function createSekundaer(opts = {}) {
  const o = { staerke: 1, kopf: 1, gewicht: 1, umhang: 1, haar: 1, grenze: 0.5, ...opts };
  const F = {
    kopfX: createFeder({ steif: 90, daempf: 9 }), kopfZ: createFeder({ steif: 90, daempf: 9 }),
    torsoX: createFeder({ steif: 45, daempf: 7 }), torsoZ: createFeder({ steif: 45, daempf: 8 }),
    umhangX: createFeder({ steif: 18, daempf: 3.5 }), umhangZ: createFeder({ steif: 18, daempf: 3.5 }),
    haarX: createFeder({ steif: 40, daempf: 5 }), haarZ: createFeder({ steif: 40, daempf: 5 }),
  };
  const werte = { kopfX: 0, kopfZ: 0, torsoX: 0, torsoZ: 0, umhangX: 0, umhangZ: 0, haarX: 0, haarZ: 0 };
  let letzteVy = 0;

  function update(dt, info = {}) {
    dt = clamp(numOr(dt, 0), 0, 0.1);
    const s = o.staerke;
    const tempo = Math.max(0, numOr(info.tempo, 0));
    const beschl = clamp(numOr(info.beschl, 0), -40, 40);
    const quer = clamp(numOr(info.quer, 0), -40, 40);
    const vy = numOr(info.vy, 0);
    const ay = dt > 0 ? clamp((vy - letzteVy) / dt, -200, 200) : 0;
    letzteVy = vy;
    // Trägheit: beim Anfahren bleibt der Oberkörper zurück, beim Bremsen kippt er vor und schwingt zurück
    werte.torsoX = F.torsoX.schritt(dt, 0, -beschl * 0.9 * o.gewicht * s);
    werte.torsoZ = F.torsoZ.schritt(dt, 0, -quer * 0.5 * o.gewicht * s);
    werte.kopfX = F.kopfX.schritt(dt, 0, (-beschl * 1.2 + ay * 0.04) * o.kopf * s);
    werte.kopfZ = F.kopfZ.schritt(dt, 0, -quer * 1.0 * o.kopf * s);
    // Umhang/Haar: Fahrtwind hebt nach hinten, Steigen/Fallen und Kurven lenken aus
    const wind = clamp(tempo * 0.09 + Math.max(0, -vy) * 0.05, 0, 1.2);
    werte.umhangX = F.umhangX.schritt(dt, wind * o.umhang * s, beschl * 0.8 * o.umhang * s);
    werte.umhangZ = F.umhangZ.schritt(dt, 0, quer * 0.7 * o.umhang * s);
    werte.haarX = F.haarX.schritt(dt, wind * 0.6 * o.haar * s, beschl * 1.0 * o.haar * s);
    werte.haarZ = F.haarZ.schritt(dt, 0, quer * 0.8 * o.haar * s);
    const g = o.grenze;
    for (const k of ['kopfX', 'kopfZ', 'torsoX', 'torsoZ']) werte[k] = clamp(werte[k], -g, g);
    werte.umhangX = clamp(werte.umhangX, -0.6, 1.4); werte.haarX = clamp(werte.haarX, -0.6, 1.2);
    werte.umhangZ = clamp(werte.umhangZ, -0.8, 0.8); werte.haarZ = clamp(werte.haarZ, -0.8, 0.8);
    return werte;
  }

  /** Addiert die Rumpf-Werte auf pose (torso/hals/kopf); Beine und basisPos bleiben unberührt (Fuß-IK bleibt gültig). */
  function anwenden(pose, gewicht = 1) {
    if (!pose) return pose;
    const w = clamp(numOr(gewicht, 1), 0, 1);
    if (pose.torso) { pose.torso.x += werte.torsoX * w; pose.torso.z += werte.torsoZ * w; }
    if (pose.hals) { pose.hals.x += (werte.kopfX * 0.4 - werte.torsoX * 0.5) * w; pose.hals.z += (werte.kopfZ * 0.4 - werte.torsoZ * 0.4) * w; }
    if (pose.kopf) { pose.kopf.x += werte.kopfX * 0.6 * w; pose.kopf.z += werte.kopfZ * 0.6 * w; }
    return pose;
  }

  return {
    werte, update, anwenden,
    /** Direkter Impuls (rad/s) z. B. bei Treffer/Landung: vor + = nach vorn, seit + = nach links (−Z-Drehung), hoch = Kopf nickt. */
    stoss(vor = 0, seit = 0, hoch = 0) {
      F.torsoX.stoss(vor); F.kopfX.stoss(vor * 1.5 + hoch); F.torsoZ.stoss(-seit); F.kopfZ.stoss(-seit * 1.5);
      F.umhangX.stoss(vor * 2 + hoch); F.haarX.stoss(vor * 2 + hoch);
    },
    reset() { for (const f of Object.values(F)) f.setze(0); for (const k of Object.keys(werte)) werte[k] = 0; letzteVy = 0; },
    dispose() { this.reset(); },
  };
}
