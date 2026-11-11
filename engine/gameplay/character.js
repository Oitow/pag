/**
 * @modul    character
 * @zweck    Fertige Spielfigur in einem Objekt: Modell (Look) + Animator + Bewegungs-Motor, für Spieler und NPCs gleich
 * @api      createCharacter(opts) -> { root, model, animator, motor, zustand, look, name, schild, brain, update(dt,absicht?,brainKontext?), setBrain(brain|opts|null), spiele(name,opts), loese(opts), stoppe(name?), aktion(name,opts), sage(text,{dauer,geste,ausdruck}), setName(t), setLeben(anteil|null), ausruesten(sockel,obj), ablegen(sockel|obj), ausruestung, setAusdruck(name|null,opts), treffer(richtung,staerke,opts), umfallen(richtung,opts), aufstehen(dauer), blickZu(punkt|figur|fn|null), setSichtbar(bool), abstandZu(punkt|figur), setLook(teil), teleport(pos,yaw?), stoss(x,y,z,opts?), dispose() }
 * @beispiel
 *   import { createCharacter } from '../../engine/gameplay/character.js';
 *   const held = createCharacter({ look: VORLAGEN.wanderer, welt, pos: { x: 0, y: 0, z: 0 } });
 *   szene.add(held.root);
 *   held.update(dt, absicht);   // absicht aus move-input (zuAbsicht) oder character-steering; Zusatz-Flags (rollen …) gehen durch
 *   // Mit Namensschild/Sprechblase (engine/ui/figur-schild.js):
 *   const bauer = createCharacter({ look, welt, name: 'Jupp', schilder });
 *   bauer.sage('Moin!', { geste: 'winken' }); bauer.blickZu(held); bauer.ausruesten('handR', mistgabel);
 * @tags     figur, charakter, spieler, npc, bewegung, animation, controller, avatar
 * @version  1.3.0
 * @status   entwurf
 * @three    nein
 */
import { createCharacterModel } from '../models/character/character-model.js';
import { createAnimator } from '../models/character/character-animator.js';
import { CLIPS } from '../models/character/character-clips.js';
import { createMotor } from './character-motor.js';
import { createBrain } from './character-brain.js';

/** Weltposition aus {x,y,z}, Funktion, Figur (zustand.pos) oder Object3D. */
function punktVon(p) {
  const q = typeof p === 'function' ? p() : p?.zustand?.pos || (p?.isObject3D ? p.getWorldPosition?.(p.position.clone()) : p);
  return q && Number.isFinite(+q.x) && Number.isFinite(+q.z) ? q : null;
}
// Motor-Kurzbefehle für aktion(name), falls der Motor sie kennt
const MOTOR_AKTIONEN = { springen: 'springeJetzt', rollen: 'rolleJetzt' };

/**
 * opts: { look, seed = 1, welt (Adapter: bodenHoehe …), pos {x,y,z}, yaw = 0, tuning (Motor), animation (Animator-Optionen),
 *         koerper = true (meldet sich in einer Kollisions-Welt als weicher Zylinder an, falls welt.fuege existiert), koerperWeich = 0.5,
 *         schatten = true, onSchritt(fuss, staerke, figur), name, schilder (engine/ui/figur-schild), schild: { leben, versatz, farbe },
 *         brain: fertiges Brain (character-brain) oder Optionen dafür (welt/heimat/seed werden ergänzt) }
 * update(dt, absicht): absicht = null/undefined und Brain vorhanden → Brain entscheidet (3. Argument = Kontext
 *   {ziele, nachbarn, stunde, npcs}); Brain-Aktionen (aktionNeu) spielen als Clip, aktion null beendet Schleifen-Clips.
 * Aktionen mit Maske 'ganz' (z. B. tod, ausweichrolle, sitzen) sperren die Lauf-Absicht, solange sie laufen.
 */
export function createCharacter(opts = {}) {
  const model = createCharacterModel({ look: opts.look, seed: opts.seed ?? 1, schatten: opts.schatten ?? true });
  const m = model.masse;
  const motor = createMotor({
    welt: opts.welt, pos: opts.pos || { x: 0, y: 0, z: 0 }, yaw: opts.yaw || 0,
    radius: m.radius, hoehe: m.hoehe, tuning: opts.tuning,
  });
  const figur = {};
  // Kollisions-Welt (engine/world/kollision.js): eigenen Körper anmelden → Figuren schieben sich weich aneinander vorbei
  const koerperId = opts.koerper !== false && typeof opts.welt?.fuege === 'function' && typeof opts.welt.bewege === 'function'
    ? opts.welt.fuege({ x: motor.zustand.pos.x, z: motor.zustand.pos.z, y0: motor.zustand.pos.y, radius: m.radius, hoehe: m.hoehe,
      weich: opts.koerperWeich ?? 0.5, daten: { figur } }) : null;
  if (koerperId !== null) motor.kollisionsId = koerperId;
  const animator = createAnimator(model, {
    seed: opts.seed ?? 1,
    gehTempo: motor.tuning.gehTempo, laufTempo: motor.tuning.laufTempo, sprintTempo: motor.tuning.sprintTempo,
    bodenHoehe: opts.welt?.bodenHoehe ? (x, z) => opts.welt.bodenHoehe(x, z) : undefined,   // Hang-Anpassung der Füße
    ...opts.animation,
    onSchritt: (fuss, staerke) => opts.onSchritt?.(fuss, staerke, figur),
  });
  const root = model.root;
  const STOP = { x: 0, z: 0, sprint: false, springen: false, ducken: false };
  let name = opts.name ? String(opts.name) : '';
  const schild = opts.schilder ? opts.schilder.neu(model.rig.sockel.kopf, { name, ...opts.schild }) : null;
  const ausruestung = new Map();    // sockel → obj
  let blickPunkt = null, weg = false, brain = null, brainEigen = false, brainClip = null;
  function setBrain(b) {
    if (brainEigen) brain?.dispose?.();
    brainEigen = !!b && typeof b.update !== 'function';
    brain = !b ? null : brainEigen
      ? createBrain({ seed: opts.seed ?? 1, welt: opts.welt, heimat: { x: motor.zustand.pos.x, z: motor.zustand.pos.z }, ...b }) : b;
    brainClip = null;
    return brain;
  }
  const LEER = {};
  let ausdruckRest = 0;
  const blickAus = () => { animator.blickZuPunkt ? animator.blickZuPunkt(null) : animator.blickZu(null); };
  const blickDir = { x: 0, y: 0, z: 1 };

  const weltBlick = { x: 0, y: 0, z: 0 };
  function blickAktualisieren() {
    const p = blickPunkt ? punktVon(blickPunkt) : null;
    if (!p) { if (blickPunkt) blickAus(); return; }
    const z = motor.zustand, c = Math.cos(z.yaw), s = Math.sin(z.yaw);
    // Figur als Ziel: in die Augen schauen; sonst genau auf den Punkt
    const zielY = (+p.y || 0) + (blickPunkt.zustand ? blickPunkt.model?.masse?.augenHoehe ?? m.augenHoehe : 0);
    if (typeof animator.blickZuPunkt === 'function') {   // neuer Animator: Kopf + Augen folgen einem Weltpunkt
      weltBlick.x = +p.x; weltBlick.y = zielY; weltBlick.z = +p.z;
      animator.blickZuPunkt(weltBlick); return;
    }
    const dx = p.x - z.pos.x, dz = p.z - z.pos.z, dy = zielY - (z.pos.y + m.augenHoehe);
    blickDir.x = dx * c - dz * s; blickDir.z = dx * s + dz * c; blickDir.y = dy;
    animator.blickZu(blickDir);
  }

  function sync() {
    const z = motor.zustand;
    root.position.set(z.pos.x, z.pos.y, z.pos.z);
    root.rotation.y = z.yaw;
    if (koerperId !== null) opts.welt.bewege(koerperId, z.pos.x, z.pos.z, z.pos.y);
  }

  Object.defineProperties(figur, Object.getOwnPropertyDescriptors({
    root, model, animator, motor,
    get zustand() { return motor.zustand; },
    get look() { return model.look; },
    update(dt, absicht, kontext) {
      if (absicht == null && brain) {
        const r = brain.update(dt, motor.zustand, kontext || LEER);
        absicht = r.absicht;
        if (r.aktionNeu && r.aktion && CLIPS[r.aktion]) { animator.spiele(r.aktion); brainClip = r.aktion; }
        else if (!r.aktion && brainClip) { if (CLIPS[brainClip]?.schleife) animator.stoppe(brainClip); brainClip = null; }
      }
      const a = animator.aktion;
      const gesperrt = a && CLIPS[a]?.maske === 'ganz';
      motor.update(dt, gesperrt ? STOP : absicht);
      sync();
      if (blickPunkt) blickAktualisieren();
      if (ausdruckRest > 0 && (ausdruckRest -= dt) <= 0) animator.ausdruck = null;
      animator.update(dt, motor.zustand);
      model.updateGesicht?.(dt);                         // Blinzeln/Mimik des Modells (falls vorhanden)
    },
    spiele: (clip, o) => animator.spiele(clip, o),
    /** Gehaltenen Clip (spiele mit halteBei) auslösen → Sekunden bis zum Treffer-Moment. */
    loese: (o) => animator.loese(o),
    stoppe: (clip) => animator.stoppe(clip),
    get name() { return name; },
    get brain() { return brain; },
    setBrain,
    get schild() { return schild; },
    get ausruestung() { return new Map(ausruestung); },
    /** Sicher: Clip abspielen (→ {dauer, trefferBei}) oder Motor-Befehl (springen, rollen); unbekannt → null. */
    aktion(clip, o) {
      if (CLIPS[clip]) return animator.spiele(clip, o);
      const f = MOTOR_AKTIONEN[clip];
      if (f && typeof motor[f] === 'function') { motor[f](o?.richtung); return { dauer: 0, trefferBei: 0 }; }
      return null;
    },
    /** Sprechblase (braucht opts.schilder); geste = Clip-Name, ausdruck = Gesichtsausdruck (falls das Modell es kann). */
    sage(text, { dauer, geste, ausdruck } = {}) {
      if (geste && CLIPS[geste]) animator.spiele(geste);
      if (!schild) { if (ausdruck) figur.setAusdruck(ausdruck); return false; }
      schild.sage(text, { dauer });
      if (ausdruck && figur.setAusdruck(ausdruck)) ausdruckRest = Number.isFinite(dauer) ? dauer : Math.min(8, 1.5 + String(text).length * 0.06);
      return true;
    },
    setName(t) { name = t ? String(t) : ''; schild?.setName(name); },
    setLeben(anteil) { schild?.setLeben(anteil); },
    /** Gegenstand an Sockel (handR, handL, kopf, ruecken, guertel, umhang); ersetzt Vorhandenes dort. */
    ausruesten(sockel, obj) {
      if (ausruestung.has(sockel)) figur.ablegen(sockel);
      const r = typeof model.ausruesten === 'function' ? model.ausruesten(sockel, obj) : model.befestigen(sockel, obj);
      if (obj) ausruestung.set(sockel, obj);
      return r;
    },
    ablegen(wer) {
      let sockel = wer;
      if (typeof wer !== 'string') for (const [s, o] of ausruestung) if (o === wer) sockel = s;
      const obj = ausruestung.get(sockel);
      ausruestung.delete(sockel);
      if (typeof model.ablegen === 'function') return model.ablegen(typeof wer === 'string' ? wer : obj || wer);
      return model.loesen(typeof wer === 'string' ? wer : obj || wer);
    },
    /** Gesichtsausdruck setzen (null = automatisch aus Clips/Zustand), falls das Modell es kann (→ true), sonst false. */
    setAusdruck(ausdruck, o) {
      if (typeof model.setAusdruck !== 'function') return false;
      ausdruckRest = 0;
      if ('ausdruck' in animator) animator.ausdruck = ausdruck || null;   // Animator reicht ihn jedes Bild ans Modell
      else model.setAusdruck(ausdruck, o);
      if (ausdruck && o && Number.isFinite(o.dauer)) ausdruckRest = o.dauer;   // danach wieder automatisch
      return true;
    },
    /** Reaktionen des Animators (falls vorhanden): Stoß/Treffer, Umfallen (Ragdoll-artig), Aufstehen. */
    treffer(richtung, staerke = 1, o) { if (typeof animator.treffer !== 'function') return false; animator.treffer(richtung, staerke, o); return true; },
    umfallen(richtung, o) { if (typeof animator.umfallen !== 'function') return false; animator.umfallen(richtung, o); return true; },
    aufstehen(dauer) { if (typeof animator.aufstehen !== 'function') return false; animator.aufstehen(dauer); return true; },
    /** Kopf schaut zu einem Punkt / einer Figur / Object3D / Funktion (wird jedes Bild neu gelesen); null = geradeaus. */
    blickZu(punkt) { blickPunkt = punkt || null; if (!blickPunkt) blickAus(); else blickAktualisieren(); },
    setSichtbar(an) { model.setSichtbar(an); if (schild) schild.zeige(an); },
    abstandZu(ziel) {
      const p = punktVon(ziel); if (!p) return Infinity;
      const z = motor.zustand.pos;
      return Math.hypot(p.x - z.x, p.z - z.z);
    },
    setLook(teil) {
      model.setLook(teil);
      if ('radius' in motor) motor.radius = model.masse.radius;
      if ('hoehe' in motor) motor.hoehe = model.masse.hoehe;
      return model.look;
    },
    teleport(pos, yaw) { motor.teleport(pos, yaw); sync(); },
    stoss: (x, y, z, o) => motor.stoss(x, y, z, o),
    dispose() {
      if (weg) return; weg = true;
      blickPunkt = null; ausruestung.clear(); setBrain(null);
      schild?.entfernen();
      if (koerperId !== null) opts.welt.entferne?.(koerperId);
      root.removeFromParent?.();
      animator.dispose(); motor.dispose(); model.dispose();
    },
  }));
  sync();
  if (opts.brain) setBrain(opts.brain);
  return figur;
}
