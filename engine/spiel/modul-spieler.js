/**
 * @modul    modul-spieler
 * @zweck    Spiel-Modul 'spieler': Spielfigur (character) mit Eingabe, tiefer Verfolger-Kamera (Riesen wirken groß), Lock-On auf Entitäten, Ausdauer (Sprint, Rolle, Schwimmen, Klettern, Springen), Klettern an Fels/Stämmen, eigene Entität mit Treffer-Reaktion + Wiederbeleben, Notlicht ohne Himmel
 * @api      SPIELER_MODUL
 * @beispiel
 *   import { SPIELER_MODUL } from '../../engine/spiel/modul-spieler.js';
 *   const spiel = await createSpiel({ canvas, module: [WELT_MODUL, SPIELER_MODUL], optionen: { spieler: { fov: 66 } } });
 *   spiel.api('spieler').teleport(10, 20, Math.PI);
 * @tags     spiel, modul, spieler, figur, kamera, lock-on, ausdauer, klettern, sprint
 * @version  1.1.0
 * @status   entwurf
 * @three    ja
 *
 * Modul-API: { figur, position, kamera, eingabe, id, teleport(x,z,yaw?), blickYaw, ziel, ausdauer, klettern, tot }; setzt Dienst fokus;
 *   sendet spieler:aktion {name: springen|rollen|sprint|klettern|ziel|tod|wiederbelebt}.
 * Optionen 1.1: name (Figur + Entität), aktionen (zusätzliche move-input-Aktionen, Standard ⚔ aktion1 + 💬 interagieren).
 * Steuerung: WASD/Stick laufen · Shift/🏃 Sprint (halten) · Leertaste/⤒ springen (an der Wand: abspringen) · Q/🌀 Rolle/Dash ·
 *   C ducken (an der Wand: loslassen) · T/Tab/🎯 Ziel erfassen/wechseln · Maus ziehen/Mausrad bzw. rechte Bildschirmhälfte: Kamera.
 *   Klettern: gegen steilen Fels (> 55°) oder hohe Stämme laufen – kostet Ausdauer, leer = abrutschen.
 */
import * as THREE from 'three';
import { createCharacter } from '../gameplay/character.js';
import { createAusdauer } from '../gameplay/ausdauer.js';
import { createKlettern } from '../gameplay/klettern.js';
import { createMoveInput, zuAbsicht } from '../input/move-input.js';
import { createFollowCamera } from '../camera/follow-camera.js';
import { waehleZiel, zielPos } from '../camera/ziel-wahl.js';
import { randomLook } from '../models/character/character-look.js';

const STANDARD = {
  // Kamera: tief und weit (Shadow of the Colossus) – Blick leicht nach oben, Riesenbäume füllen das Bild
  distanz: 6.5, pitch: 0.1, hoehe: 1.55, fov: 64, sprintFov: 72, minPitch: -0.65, maxDistanz: 16,
  zielReichweite: 25, wiederbeleben: 3, leben: 100, look: null, name: 'Du',
  // 1.1: weitere Knöpfe (Erlenwacht: ⚔ Angriff = aktion1, 💬 Sprechen = interagieren); Modul kampf/tutorial lesen sie über eingabe.gedrueckt()
  aktionen: [{ name: 'aktion1', knopf: '⚔', titel: 'Angriff (F)' }, 'interagieren'],
};

let laufend = null;   // innere Takt-Funktionen der laufenden Instanz (Kern ruft dispose/zustand ohne ctx)

export const SPIELER_MODUL = {
  name: 'spieler', braucht: ['render', 'welt'], optional: ['entitaeten', 'himmel'], standard: STANDARD,
  start(ctx) {
    const o = { ...STANDARD, ...ctx.optionen };
    const render = ctx.braucht('render'), welt = ctx.braucht('welt');
    const ent = ctx.optional('entitaeten'), himmel = ctx.optional('himmel');
    const entDa = typeof ent?.neu === 'function';
    const { szene } = render;
    const bus = ctx.ereignisse;
    const melde = (name) => bus.sende('spieler:aktion', { name });
    const boden = welt.kollision || welt;                           // Figur läuft gegen die Kollisions-Welt
    const startOrt = welt.ort?.('start');
    const start = { x: startOrt?.x ?? welt.startPunkt?.x ?? 0, z: startOrt?.z ?? welt.startPunkt?.z ?? 0, yaw: startOrt?.blick ?? 0 };
    const hoeheBei = (x, z) => welt.bodenHoehe(x, z);

    const seed = (ctx.seed >>> 0) || 1;
    const figur = createCharacter({ look: o.look || randomLook(seed), seed, welt: boden, name: o.name || 'Du',
      pos: { x: start.x, y: hoeheBei(start.x, start.z), z: start.z }, yaw: start.yaw });
    szene.add(figur.root);
    const motor = figur.motor;
    const OHNE_MICH = { ausser: motor.kollisionsId };

    const eingabe = createMoveInput({
      element: render.canvas, vibration: true,
      aktionen: [{ name: 'sprint', knopf: '🏃', titel: 'Sprint (halten)' }, 'rollen', 'ziel', ...(o.aktionen || [])],
    });
    const cam = createFollowCamera({
      kamera: render.kamera, erstePerson: true,
      distanz: o.distanz, pitch: o.pitch, hoehe: o.hoehe, fov: o.fov, sprintFov: o.sprintFov, minPitch: o.minPitch, maxDistanz: o.maxDistanz,
      bodenHoehe: (x, z) => Math.max(welt.bodenHoehe(x, z), welt.wasserHoehe?.(x, z) ?? -1e9),
      hindernisse: (x, z, r) => boden.hindernisse?.(x, z, r, OHNE_MICH) ?? null,
    });
    cam.yaw = start.yaw;
    cam.springeZu(figur.zustand.pos);
    const ausdauer = createAusdauer();
    const klettern = createKlettern({ welt: { bodenHoehe: hoeheBei, hindernisse: boden.hindernisse ? (x, z, r, f) => boden.hindernisse(x, z, r, f) : null }, motor, ausdauer });

    // --- Notlicht, falls kein Himmel-Modul da ist (?aus=himmel) ---
    let licht = null;
    if (!himmel?.sonne) {
      const hemi = new THREE.HemisphereLight(0xd6e6ff, 0x46523a, 1.1);
      const sonne = new THREE.DirectionalLight(0xfff0d8, 2.4);
      sonne.castShadow = true;
      const sm = render.stufe?.schatten || 1024;
      sonne.shadow.mapSize.set(sm, sm);
      Object.assign(sonne.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
      sonne.shadow.bias = -0.0005; sonne.shadow.normalBias = 0.04;
      szene.add(hemi, sonne, sonne.target);
      licht = { hemi, sonne, richtung: new THREE.Vector3(0.5, 0.8, 0.35).normalize() };
    }

    // --- Ausdauer-Balken (Handy-tauglich: groß genug, ohne Klicks; nur sichtbar, wenn nicht voll) ---
    const doc = globalThis.document;
    const balken = doc?.createElement('div'), fuell = doc?.createElement('div');
    if (balken) {
      balken.style.cssText = 'position:absolute;left:0;top:0;width:12px;height:64px;border-radius:7px;background:rgba(0,0,0,.45);'
        + 'border:2px solid rgba(255,255,255,.55);overflow:hidden;opacity:0;transition:opacity .35s;pointer-events:none;will-change:transform';
      fuell.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:100%;background:#8fd96b;border-radius:4px';
      balken.appendChild(fuell); render.ui?.appendChild(balken);
    }
    const proj = new THREE.Vector3();

    // --- Entität ---
    let id = null, tot = false, totUhr = 0;
    const neueEntitaet = () => {
      if (!entDa) return null;
      const p = figur.zustand.pos;
      return ent.neu({ art: 'spieler', team: 'spieler', pos: { x: p.x, y: p.y, z: p.z }, radius: motor.radius, leben: o.leben, name: o.name || 'Du', daten: { figur } });
    };
    id = neueEntitaet();
    const ab = [];
    if (entDa) {
      ab.push(bus.an('ent:treffer', (d) => {
        if (d?.id !== id || tot) return;
        const q = d.quelle != null ? ent.hole?.(d.quelle)?.pos : null, von = q || d.pos;
        const p = figur.zustand.pos;
        let rx = von ? p.x - von.x : -Math.sin(motor.zustand.yaw), rz = von ? p.z - von.z : -Math.cos(motor.zustand.yaw);
        const l = Math.hypot(rx, rz) || 1; rx /= l; rz /= l;
        const st = Math.min(1.3, Math.max(0.3, (+d.menge || 10) / 25));
        figur.treffer({ x: rx, z: rz }, st, { welt: true });
        cam.schuetteln(Math.min(1, st * 0.6), 0.25);
      }));
      ab.push(bus.an('ent:tod', (d) => {
        if (d?.id !== id || tot) return;
        tot = true; totUhr = o.wiederbeleben; ziel = null; cam.lockOn(null); klettern.loslassen();
        figur.umfallen({ x: -Math.sin(motor.zustand.yaw), z: -Math.cos(motor.zustand.yaw) }, { welt: true });
        melde('tod');
      }));
    }

    // --- Lock-On ---
    let ziel = null;
    function kandidaten() {
      if (!entDa || typeof ent.imUmkreis !== 'function') return [];
      const p = figur.zustand.pos, r = o.zielReichweite;
      return [...ent.imUmkreis(p.x, p.z, r, { team: 'feind', ausser: id }), ...ent.imUmkreis(p.x, p.z, r, { team: 'freund', ausser: id })]
        .filter((e) => e && e.lebt !== false);
    }
    function zielWaehlen() {
      const k = kandidaten(), von = figur.zustand.pos;
      if (!ziel) ziel = waehleZiel(k, { von, blickYaw: cam.yaw, maxDistanz: o.zielReichweite });
      else { const neu = waehleZiel(k, { von, blickYaw: cam.yaw, aktuell: ziel, richtung: 1, maxDistanz: o.zielReichweite }); ziel = neu === ziel ? null : neu; }
      cam.lockOn(ziel ? () => { const p = zielPos(ziel); return p && { x: p.x, y: p.y + 1.2, z: p.z }; } : null);
      melde('ziel');
    }

    function teleport(x, z, yaw) {
      klettern.loslassen();
      figur.teleport({ x, y: hoeheBei(x, z), z }, Number.isFinite(+yaw) ? +yaw : undefined);
      if (Number.isFinite(+yaw)) cam.yaw = +yaw;
      cam.springeZu(figur.zustand.pos);
      ziel = null; cam.lockOn(null);
      if (entDa && id != null) ent.bewege?.(id, x, figur.zustand.pos.y, z);
    }

    ctx.dienst('fokus', () => figur.zustand.pos);

    const absicht = {};
    let rollGesperrt = false, rollVorher = false, sprintete = false;
    const api = {
      figur, kamera: cam, eingabe, ausdauer, klettern, teleport,
      get position() { return figur.zustand.pos; },
      get id() { return id; },
      get blickYaw() { return cam.blickYaw(); },
      get ziel() { return ziel; },
      get tot() { return tot; },
    };
    const intern = {
        update(dt) {
          const e = eingabe.lesen(dt);
          cam.drehen(e.kameraX, e.kameraY);
          if (e.zoom) cam.zoomen(e.zoom);
          const z = figur.zustand;
          if (tot) {
            for (const k in absicht) absicht[k] = typeof absicht[k] === 'boolean' ? false : 0;
            delete absicht.klettern; absicht.blickYaw = undefined;
            figur.update(dt, absicht);
            if ((totUhr -= dt) <= 0) {                       // nach 3 s am Start wiederbeleben
              tot = false; ausdauer.reset();
              if (entDa && id != null) ent.entferne?.(id);
              teleport(start.x, start.z, start.yaw);
              figur.aufstehen(0.8);
              id = neueEntitaet();
              melde('wiederbelebt');
            }
            return;
          }
          if (eingabe.gedrueckt('ziel')) zielWaehlen();
          if (ziel && (ziel.lebt === false || figur.abstandZu(zielPos(ziel)) > o.zielReichweite + 5)) { ziel = null; cam.lockOn(null); }
          zuAbsicht(e, cam.blickYaw(), absicht);
          const tf = ctx.optional('zauber')?.tempoFaktor ?? 1;   // beim Aufladen eines Zaubers bremsen
          if (tf < 1) { absicht.x *= tf; absicht.z *= tf; absicht.sprint = false; }

          // Klettern zuerst (übernimmt Sprung/Ducken an der Wand)
          const kletterteVorher = klettern.klettert;
          klettern.update(dt, absicht);
          // Die Figur leitet die Kletterpose aus dem Motor und der vertikalen Bewegung ab.
          if (klettern.klettert && !kletterteVorher) melde('klettern');
          if (!klettern.klettert) {
            const bewegt = Math.hypot(absicht.x, absicht.z) > 0.3;
            // Sprint (gehalten) kostet; erschöpft → kein Sprint bis 30 %
            if (absicht.sprint && bewegt && (z.amBoden || z.imWasser)) absicht.sprint = ausdauer.verbrauche(z.imWasser ? 'schwimmSprint' : 'sprint', dt);
            else if (absicht.sprint && !bewegt) absicht.sprint = false;
            else if (absicht.sprint) absicht.sprint = ausdauer.kann('sprint');
            if (absicht.sprint && !sprintete) melde('sprint');
            sprintete = !!absicht.sprint;
            if (z.imWasser && bewegt && !absicht.sprint) ausdauer.verbrauche('schwimmen', dt);
            // Rolle/Dash: Flanke zahlt, sonst gesperrt bis zum Loslassen
            const rollen = !!absicht.rollen, flanke = rollen && !rollVorher;
            rollVorher = rollen;
            if (flanke) rollGesperrt = z.abklingzeit > 0 || !ausdauer.zahle(z.amBoden ? 'rollen' : 'dash');
            if (!rollen) rollGesperrt = false;
            if (rollGesperrt) absicht.rollen = false;
            else if (flanke) melde('rollen');
          } else if (!kletterteVorher) rollVorher = !!absicht.rollen;

          const zp = ziel && zielPos(ziel);
          absicht.blickYaw = klettern.klettert ? undefined : cam.erstePerson ? cam.yaw : zp ? Math.atan2(zp.x - z.pos.x, zp.z - z.pos.z) : undefined;
          figur.update(dt, absicht);
          if (z.sprung) { ausdauer.zahle('springen'); melde('springen'); }
          ausdauer.update(dt);
          if (entDa && id != null) ent.bewege?.(id, z.pos.x, z.pos.y, z.pos.z);
        },
        spaet(dt) {
          const z = figur.zustand;
          if (z.landung > 9) cam.schuetteln(Math.min(1, z.landung / 20), 0.3);
          cam.update(dt, z.pos, { tempo: z.tempo, sprintet: z.sprintet, yaw: z.yaw, amBoden: z.amBoden || z.klettert, augenHoehe: figur.model.masse.augenHoehe });
          figur.setSichtbar(!cam.figurAusblenden);
          if (licht) {
            licht.sonne.position.set(z.pos.x + licht.richtung.x * 120, z.pos.y + licht.richtung.y * 120, z.pos.z + licht.richtung.z * 120);
            licht.sonne.target.position.set(z.pos.x, z.pos.y, z.pos.z);
          }
          if (balken) {
            const a = ausdauer.anteil, zeigen = !ausdauer.voll && !cam.erstePerson;
            balken.style.opacity = zeigen ? '1' : '0';
            if (zeigen) {
              fuell.style.height = (a * 100).toFixed(1) + '%';
              fuell.style.background = ausdauer.erschoepft ? '#e0603a' : a < 0.3 ? '#e8b23c' : '#8fd96b';
              proj.set(z.pos.x, z.pos.y + 1.1, z.pos.z).project(render.kamera);
              const w = globalThis.innerWidth || 800, h = globalThis.innerHeight || 600;
              const sx = (proj.x * 0.5 + 0.5) * w + Math.max(34, w * 0.05), sy = (-proj.y * 0.5 + 0.5) * h - 32;
              balken.style.transform = `translate(${Math.min(w - 20, Math.max(4, sx)).toFixed(0)}px,${Math.min(h - 70, Math.max(4, sy)).toFixed(0)}px)`;
            }
          }
        },
        dispose() {
          for (const f of ab) f?.();
          if (entDa && id != null) ent.entferne?.(id);
          balken?.remove();
          if (licht) { szene.remove(licht.hemi, licht.sonne, licht.sonne.target); licht.sonne.dispose?.(); licht.sonne.shadow?.map?.dispose?.(); }
          klettern.dispose(); eingabe.dispose(); cam.dispose(); figur.dispose();
          if (ctx.dienst('fokus')) ctx.dienst('fokus', null);
        },
      zustand() { const p = figur.zustand.pos; return { x: p.x, z: p.z, yaw: figur.zustand.yaw, ausdauer: ausdauer.zustand() }; },
      lade(s) { if (s && Number.isFinite(+s.x)) { teleport(+s.x, +s.z, s.yaw); ausdauer.lade(s.ausdauer); } },
    };
    laufend = intern;
    return api;
  },
  update(dt) { laufend?.update(dt); },
  spaet(dt) { laufend?.spaet(dt); },
  zustand() { return laufend?.zustand(); },
  lade(z) { laufend?.lade(z); },
  dispose() { laufend?.dispose(); laufend = null; },
};
