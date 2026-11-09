/**
 * @modul    character-steering
 * @zweck    NPC-Bewegungs-Gehirn: liefert dieselbe Absicht wie die Eingabe – Ziel/Ankommen, Wandern, Folgen, Fliehen, Pfad, Patrouille, Umkreisen, Abstand halten, Verstecken, Schwarm, Ausweichen, Steckenbleiben auflösen
 * @api      createSteering({seed,ankunftsRadius,bremsRadius,wanderRadius,heimat,tempo,radius,gruppe}) -> {modus,ziel,angekommen,steckt,wartet,punktIndex,setModus(name,daten),gehZu(x,z,{rennen}),folge(getPos,abstand),fliehe(getPos,sicherAbstand),wandere(heimat,radius),folgePfad(punkte,{schleife}),patrouille(punkte,{art,warten,rennen}),umkreise(getPos,radius,{drehsinn,wechsel}),halteAbstand(getPos,min,max),verstecke(getPos,verstecke,{abstand}),schwarm(heimat,radius),setGruppe(gruppe),stehe(),update(dt,zustand,nachbarn?)->absicht,dispose()} ; richtungZu(von,nach,out?) -> {x,z,dist} ; ankunftsStaerke(dist,bremsRadius) -> 0…1
 * @beispiel
 *   import { createSteering } from '../../engine/gameplay/character-steering.js';
 *   const hirn = createSteering({ seed: 7, heimat: { x: 0, z: 0 } });
 *   hirn.patrouille([{ x: 0, z: 0, warten: 2 }, { x: 8, z: 0 }], { art: 'pingpong' });
 *   motor.update(dt, hirn.update(dt, motor.zustand, nachbarn)); // nachbarn: [{x,z,radius?,vx?,vz?}]
 * @tags     npc, ki, steering, bewegung, wandern, pfad, patrouille, kampf, schwarm, gameplay
 * @version  1.1.0
 * @status   entwurf
 * @three    nein
 *
 * Absicht: { x, z, sprint, springen (Puls beim Steckenbleiben), ducken, blickYaw (beim Umkreisen/Abstand/Wartepunkt) }.
 * Steckenbleiben eskaliert: seitlich ausweichen → andere Seite + Hüpfer → Wanderziel/Wegpunkt überspringen bzw. `steckt = true`.
 */
import { clamp, numOr } from '../core/math.js';
import { rng, range } from '../core/rng.js';
import { patrouilleWeiter, umkreisRichtung, abstandRichtung, versteckPunkt, yawZu } from './character-steering-extra.js';
import { createGruppe } from './character-gruppe.js';

/** Normierte Richtung von → nach (nur x/z) plus Abstand. */
export function richtungZu(von, nach, out = { x: 0, z: 0, dist: 0 }) {
  const dx = nach.x - von.x, dz = nach.z - von.z, d = Math.hypot(dx, dz);
  out.dist = d;
  if (d > 1e-9) { out.x = dx / d; out.z = dz / d; } else { out.x = 0; out.z = 0; }
  return out;
}

/** Stärke 0…1 beim Ankommen: voll außerhalb von bremsRadius, linear abnehmend darin. */
export function ankunftsStaerke(dist, bremsRadius) {
  if (!(bremsRadius > 0)) return dist > 0 ? 1 : 0;
  return clamp(dist / bremsRadius, 0, 1);
}

const MIN_STICK = 0.15, PRUEF_ZEIT = 1.5, AUSWEICH_ZEIT = 0.8;
const GRUPPEN_MODI = new Set(['schwarm', 'wandern', 'folgen']);
const pt = (p) => ({ x: numOr(p?.x, 0), z: numOr(p?.z, 0), warten: Math.max(0, numOr(p?.warten, NaN)), blickYaw: p?.blickYaw });

export function createSteering({ seed = 1, ankunftsRadius = 0.4, bremsRadius = 2, wanderRadius = 8, heimat = null, tempo = 0.5, radius = 0.3, gruppe = null } = {}) {
  const zufall = rng(seed >>> 0);
  const absicht = { x: 0, z: 0, sprint: false, springen: false, ducken: false, blickYaw: undefined };
  const r = { x: 0, z: 0, dist: 0, stark: 0 }, kr = { x: 0, z: 0 }, vp = { x: 0, z: 0 }; // Scratch
  const ziel = { x: 0, z: 0 };
  const heim = { x: numOr(heimat?.x, NaN), z: numOr(heimat?.z, NaN) };
  let schwarmGruppe = gruppe && typeof gruppe.kraft === 'function' ? gruppe : gruppe ? createGruppe(gruppe) : null;
  const st = {
    modus: 'stehen', ziel: null, angekommen: true,
    rennen: false, wanderR: wanderRadius, pause: 0,
    getPos: null, abstand: 2, abstandMax: 4, folgtGerade: false,
    punkte: null, index: 0, schleife: false, art: 'schleife', richtung: 1, warten: 0, wartet: 0,
    drehsinn: 1, wechsel: 0, wechselZeit: 0, verstecke: null,
    refX: NaN, refZ: NaN, refZeit: 0, ausweichen: 0, ausweichSeite: 1, steckZahl: 0, steckt: false, hopp: false,
  };

  function setze(modus) {
    st.modus = modus; st.angekommen = false; st.refZeit = 0; st.refX = NaN; st.ausweichen = 0;
    st.steckZahl = 0; st.steckt = false; st.wartet = 0;
  }

  function gehZu(x, z, { rennen = false } = {}) {
    setze('ziel'); ziel.x = numOr(x, 0); ziel.z = numOr(z, 0); st.ziel = ziel; st.rennen = !!rennen;
  }
  function folge(getPos, abstand = 2) { setze('folgen'); st.getPos = getPos; st.abstand = Math.max(0, numOr(abstand, 2)); st.ziel = null; st.folgtGerade = true; }
  function fliehe(getPos, sicherAbstand = 8) { setze('fliehen'); st.getPos = getPos; st.abstand = Math.max(0, numOr(sicherAbstand, 8)); st.ziel = null; }
  function wandere(h, rad, modus = 'wandern') {
    setze(modus);
    if (h) { heim.x = numOr(h.x, 0); heim.z = numOr(h.z, 0); }
    st.wanderR = Math.max(0, numOr(rad, st.wanderR)); st.ziel = null; st.pause = 0; st.rennen = false;
  }
  function schwarm(h, rad) { wandere(h, rad, 'schwarm'); }
  function folgePfad(punkte, { schleife = false } = {}) {
    patrouille(punkte, { art: schleife ? 'schleife' : 'einmal', warten: 0 }); if (st.modus !== 'stehen') st.modus = 'pfad';
  }
  function patrouille(punkte, { art = 'schleife', warten = 0, rennen = false } = {}) {
    setze('patrouille'); st.punkte = (punkte || []).map(pt);
    st.index = 0; st.richtung = 1; st.art = art; st.schleife = art !== 'einmal'; st.warten = Math.max(0, numOr(warten, 0)); st.rennen = !!rennen;
    st.ziel = st.punkte[0] || null; if (!st.ziel) { st.modus = 'stehen'; st.angekommen = true; }
  }
  function umkreise(getPos, rad = 3, { drehsinn = 1, wechsel = 0 } = {}) {
    setze('umkreisen'); st.getPos = getPos; st.abstand = Math.max(0.5, numOr(rad, 3)); st.ziel = null;
    st.drehsinn = drehsinn >= 0 ? 1 : -1; st.wechsel = Math.max(0, numOr(wechsel, 0)); st.wechselZeit = st.wechsel;
  }
  function halteAbstand(getPos, min = 3, max = 6) {
    setze('abstand'); st.getPos = getPos; st.abstand = Math.max(0, numOr(min, 3)); st.abstandMax = Math.max(st.abstand, numOr(max, 6)); st.ziel = null;
  }
  function verstecke(getPos, liste, { abstand = 1 } = {}) {
    setze('verstecken'); st.getPos = getPos; st.verstecke = liste || []; st.abstand = Math.max(0, numOr(abstand, 1)); st.ziel = null;
  }
  function stehe() { setze('stehen'); st.ziel = null; st.angekommen = true; }

  function setModus(name, d = {}) {
    if (name === 'ziel') gehZu(d.x, d.z, d);
    else if (name === 'folgen') folge(d.getPos, d.abstand);
    else if (name === 'fliehen') fliehe(d.getPos, d.sicherAbstand ?? d.abstand);
    else if (name === 'wandern') wandere(d.heimat, d.radius);
    else if (name === 'schwarm') schwarm(d.heimat, d.radius);
    else if (name === 'pfad') folgePfad(d.punkte, d);
    else if (name === 'patrouille') patrouille(d.punkte, d);
    else if (name === 'umkreisen') umkreise(d.getPos, d.radius, d);
    else if (name === 'abstand') halteAbstand(d.getPos, d.min, d.max);
    else if (name === 'verstecken') verstecke(d.getPos, d.verstecke, d);
    else stehe();
  }

  function neuesWanderZiel(pos) {
    if (!Number.isFinite(heim.x)) { heim.x = pos.x; heim.z = pos.z; }
    const w = range(zufall, 0, Math.PI * 2), d = Math.sqrt(zufall()) * st.wanderR;
    ziel.x = heim.x + Math.sin(w) * d; ziel.z = heim.z + Math.cos(w) * d; st.ziel = ziel;
  }

  /** Suchen + Ankommen zum Punkt p; setzt absicht.x/z, gibt true zurück, wenn angekommen. */
  function ansteuern(pos, px, pz, radiusAnkunft, abbremsen) {
    const dx = px - pos.x, dz = pz - pos.z; r.dist = Math.hypot(dx, dz);
    r.x = r.dist > 1e-9 ? dx / r.dist : 0; r.z = r.dist > 1e-9 ? dz / r.dist : 0;
    if (r.dist <= radiusAnkunft) { absicht.x = absicht.z = 0; return true; }
    const basis = st.rennen ? 1 : tempo;
    const s = abbremsen ? Math.max(MIN_STICK, ankunftsStaerke(r.dist - radiusAnkunft * 0.5, bremsRadius) * basis) : basis;
    absicht.x = r.x * s; absicht.z = r.z * s;
    absicht.sprint = st.rennen && r.dist > bremsRadius;
    return false;
  }

  function naechsterPunkt() {
    const w = patrouilleWeiter(st.punkte.length, st.index, st.richtung, st.art);
    st.richtung = w.richtung;
    if (w.fertig) { st.angekommen = true; return; }
    st.index = w.index; st.ziel = st.punkte[st.index];
  }

  function patrouilleSchritt(dt, pos) {
    const pkt = st.punkte[st.index];
    if (st.wartet > 0) {
      st.wartet -= dt;
      if (pkt.blickYaw !== undefined && Number.isFinite(+pkt.blickYaw)) absicht.blickYaw = +pkt.blickYaw;
      if (st.wartet <= 0) { st.wartet = 0; naechsterPunkt(); }
      return;
    }
    if (st.angekommen) return;
    const warten = Number.isFinite(pkt.warten) ? pkt.warten : st.warten;
    const letzter = st.art === 'einmal' && st.index === st.punkte.length - 1;
    const halt = letzter || warten > 0;
    if (ansteuern(pos, pkt.x, pkt.z, halt ? ankunftsRadius : Math.max(ankunftsRadius, 0.8), halt)) {
      if (warten > 0) st.wartet = warten; else naechsterPunkt();
    }
  }

  function update(dt, zustand, nachbarn) {
    dt = clamp(numOr(dt, 0), 0, 0.25);
    const pos = zustand?.pos || { x: 0, z: 0 };
    absicht.x = absicht.z = 0; absicht.sprint = false; absicht.blickYaw = undefined;
    absicht.springen = st.hopp; st.hopp = false;
    switch (st.modus) {
      case 'ziel':
        st.angekommen = ansteuern(pos, ziel.x, ziel.z, ankunftsRadius, true);
        break;
      case 'wandern': case 'schwarm':
        if (st.pause > 0) { st.pause -= dt; if (st.pause <= 0) neuesWanderZiel(pos); break; }
        if (!st.ziel) neuesWanderZiel(pos);
        if (ansteuern(pos, ziel.x, ziel.z, st.modus === 'schwarm' ? 1.5 : ankunftsRadius, st.modus !== 'schwarm')) {
          if (st.modus === 'schwarm') neuesWanderZiel(pos); else { st.pause = range(zufall, 1, 4); st.ziel = null; }
        }
        st.angekommen = false;
        break;
      case 'folgen': {
        const p = st.getPos?.(); if (!p) { st.angekommen = true; break; }
        richtungZu(pos, p, r);
        const rest = r.dist - st.abstand;
        if (st.folgtGerade ? rest <= 0.1 : rest <= 0.6) { st.folgtGerade = false; st.angekommen = true; break; }
        st.folgtGerade = true; st.angekommen = false;
        st.rennen = rest > 5;
        const s = Math.max(MIN_STICK, ankunftsStaerke(rest, bremsRadius) * (st.rennen ? 1 : Math.max(tempo, 0.8)));
        absicht.x = r.x * s; absicht.z = r.z * s; absicht.sprint = st.rennen;
        break;
      }
      case 'fliehen': {
        const p = st.getPos?.(); if (!p) { st.angekommen = true; break; }
        richtungZu(p, pos, r);
        if (r.dist >= st.abstand) { st.angekommen = true; break; }
        st.angekommen = false;
        if (r.dist < 1e-6) { r.x = st.ausweichSeite; r.z = 0; }
        absicht.x = r.x; absicht.z = r.z; absicht.sprint = true;
        break;
      }
      case 'pfad': case 'patrouille':
        patrouilleSchritt(dt, pos);
        break;
      case 'umkreisen': {
        const p = st.getPos?.(); if (!p) { st.angekommen = true; break; }
        if (st.wechsel > 0) { st.wechselZeit -= dt; if (st.wechselZeit <= 0) { st.drehsinn = -st.drehsinn; st.wechselZeit = st.wechsel * range(zufall, 0.6, 1.4); } }
        umkreisRichtung(pos, p, st.abstand, st.drehsinn, r);
        const s = Math.max(tempo, 0.5);
        absicht.x = r.x * s; absicht.z = r.z * s; absicht.blickYaw = yawZu(pos, p);
        st.angekommen = Math.abs(r.dist - st.abstand) < 0.5;
        break;
      }
      case 'abstand': {
        const p = st.getPos?.(); if (!p) { st.angekommen = true; break; }
        abstandRichtung(pos, p, st.abstand, st.abstandMax, r);
        absicht.x = r.x * r.stark; absicht.z = r.z * r.stark; absicht.blickYaw = yawZu(pos, p);
        st.angekommen = r.stark === 0;
        break;
      }
      case 'verstecken': {
        const p = st.getPos?.(); if (!p) { st.angekommen = true; break; }
        const v = versteckPunkt(pos, p, st.verstecke, st.abstand, vp);
        if (!v) { richtungZu(p, pos, r); absicht.x = r.x; absicht.z = r.z; absicht.sprint = true; st.angekommen = false; break; }
        ziel.x = v.x; ziel.z = v.z; st.ziel = ziel; st.rennen = true;
        st.angekommen = ansteuern(pos, v.x, v.z, ankunftsRadius, true);
        if (st.angekommen) absicht.ducken = true; else absicht.ducken = false;
        break;
      }
      default: st.angekommen = true;
    }
    if (st.modus !== 'verstecken') absicht.ducken = false;
    if (schwarmGruppe && nachbarn && nachbarn.length && GRUPPEN_MODI.has(st.modus)) {
      const k = schwarmGruppe.kraft({ x: pos.x, z: pos.z, vx: zustand?.vel?.x, vz: zustand?.vel?.z, radius }, nachbarn, kr);
      const gew = st.modus === 'schwarm' ? 1 : 0.5;
      absicht.x += k.x * gew; absicht.z += k.z * gew;
    }
    trennen(pos, nachbarn);
    stecken(dt, pos);
    const l = Math.hypot(absicht.x, absicht.z);
    if (l > 1) { absicht.x /= l; absicht.z /= l; }
    return absicht;
  }

  /** Separation + seitliches Ausweichen vor Nachbarn vor einem. */
  function trennen(pos, nachbarn) {
    if (!nachbarn || !nachbarn.length) return;
    const lauf = Math.hypot(absicht.x, absicht.z);
    const fx = lauf > 1e-6 ? absicht.x / lauf : 0, fz = lauf > 1e-6 ? absicht.z / lauf : 0;
    let sx = 0, sz = 0;
    for (let i = 0; i < nachbarn.length; i++) {
      const nb = nachbarn[i];
      const dx = pos.x - nb.x, dz = pos.z - nb.z, d = Math.hypot(dx, dz);
      if (!(d > 1e-6)) continue; // man selbst / kaputte Werte
      const min = radius + numOr(nb.radius, 0.3);
      const reichweite = min + (lauf > 0 ? 1.2 : 0.15);
      if (!(d < reichweite)) continue;
      const k = (reichweite - d) / reichweite, ux = dx / d, uz = dz / d;
      sx += ux * k * 1.5; sz += uz * k * 1.5;
      if (lauf > 0 && -(ux * fx + uz * fz) > 0.3) { sx += -fz * k; sz += fx * k; } // Nachbar voraus → rechts vorbei
    }
    if (sx === 0 && sz === 0) return;
    const basis = Math.max(lauf, 0.4);
    absicht.x += sx * basis; absicht.z += sz * basis;
  }

  /** Kaum Fortschritt über PRUEF_ZEIT trotz Laufwunsch → eskalierend ausweichen (Seite, andere Seite + Hüpfer, Ziel wechseln). */
  function stecken(dt, pos) {
    const will = Math.hypot(absicht.x, absicht.z) > 0.2;
    if (st.ausweichen > 0) {
      st.ausweichen -= dt;
      if (st.ausweichen <= 0) st.refX = NaN; // Ausweichweg zählt nicht als Fortschritt
      const l = Math.hypot(absicht.x, absicht.z) || 1, fx = absicht.x / l, fz = absicht.z / l;
      absicht.x = (fx * 0.3 - fz * st.ausweichSeite) * 0.8; absicht.z = (fz * 0.3 + fx * st.ausweichSeite) * 0.8;
      return;
    }
    if (!will) { st.refX = NaN; st.refZeit = 0; return; }
    if (!Number.isFinite(st.refX)) { st.refX = pos.x; st.refZ = pos.z; st.refZeit = 0; return; }
    st.refZeit += dt;
    if (st.refZeit < PRUEF_ZEIT) return;
    const weg = Math.hypot(pos.x - st.refX, pos.z - st.refZ);
    if (weg < 0.3 * PRUEF_ZEIT) {
      st.steckZahl++;
      if (st.modus === 'wandern' || st.modus === 'schwarm') neuesWanderZiel(pos);
      else if (st.steckZahl === 1) { st.ausweichen = AUSWEICH_ZEIT; st.ausweichSeite = zufall() < 0.5 ? -1 : 1; }
      else if (st.steckZahl === 2) { st.ausweichen = AUSWEICH_ZEIT * 1.6; st.ausweichSeite = -st.ausweichSeite; st.hopp = true; }
      else if ((st.modus === 'pfad' || st.modus === 'patrouille') && !st.angekommen) { naechsterPunkt(); st.steckZahl = 0; }
      else { st.steckt = true; st.ausweichen = AUSWEICH_ZEIT; st.ausweichSeite = zufall() < 0.5 ? -1 : 1; st.hopp = true; }
    } else if (weg > 0.6 * PRUEF_ZEIT) { st.steckZahl = 0; st.steckt = false; }
    st.refX = pos.x; st.refZ = pos.z; st.refZeit = 0;
  }

  return {
    get modus() { return st.modus; },
    get ziel() { return st.ziel; },
    get angekommen() { return st.angekommen; },
    get steckt() { return st.steckt; },
    get wartet() { return st.wartet > 0; },
    get punktIndex() { return st.index; },
    setModus, gehZu, folge, fliehe, wandere, schwarm, folgePfad, patrouille, umkreise, halteAbstand, verstecke, stehe, update,
    setGruppe(g) { schwarmGruppe = g && typeof g.kraft === 'function' ? g : g ? createGruppe(g) : null; },
    dispose() { st.getPos = null; st.punkte = null; st.verstecke = null; st.modus = 'stehen'; schwarmGruppe = null; },
  };
}
