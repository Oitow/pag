/**
 * @modul    character-steering
 * @zweck    NPC-Bewegungs-Gehirn: liefert dieselbe Absicht wie die Eingabe – Ziel/Ankommen, Wandern, Folgen, Fliehen, Pfad, Ausweichen, Steckenbleiben erkennen
 * @api      createSteering({seed,ankunftsRadius,bremsRadius,wanderRadius,heimat,tempo,radius}) -> {modus,ziel,angekommen,setModus(name,daten),gehZu(x,z,{rennen}),folge(getPos,abstand),fliehe(getPos,sicherAbstand),wandere(heimat,radius),folgePfad(punkte,{schleife}),stehe(),update(dt,zustand,nachbarn?)->absicht,dispose()} ; richtungZu(von,nach,out?) -> {x,z,dist} ; ankunftsStaerke(dist,bremsRadius) -> 0…1
 * @beispiel
 *   import { createSteering } from '../../engine/gameplay/character-steering.js';
 *   const hirn = createSteering({ seed: 7, heimat: { x: 0, z: 0 } });
 *   hirn.wandere({ x: 0, z: 0 }, 6);
 *   motor.update(dt, hirn.update(dt, motor.zustand, nachbarn));
 * @tags     npc, ki, steering, bewegung, wandern, pfad, gameplay
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { clamp, numOr } from '../core/math.js';
import { rng, range } from '../core/rng.js';

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

export function createSteering({ seed = 1, ankunftsRadius = 0.4, bremsRadius = 2, wanderRadius = 8, heimat = null, tempo = 0.5, radius = 0.3 } = {}) {
  const zufall = rng(seed >>> 0);
  const absicht = { x: 0, z: 0, sprint: false, springen: false, ducken: false, blickYaw: undefined };
  const r = { x: 0, z: 0, dist: 0 }; // Scratch
  const ziel = { x: 0, z: 0 };
  const heim = { x: numOr(heimat?.x, NaN), z: numOr(heimat?.z, NaN) };
  const st = {
    modus: 'stehen', ziel: null, angekommen: true,
    rennen: false, wanderR: wanderRadius, pause: 0,
    getPos: null, abstand: 2, folgtGerade: false,
    punkte: null, index: 0, schleife: false,
    refX: NaN, refZ: NaN, refZeit: 0, ausweichen: 0, ausweichSeite: 1,
  };

  function setze(modus) { st.modus = modus; st.angekommen = false; st.refZeit = 0; st.refX = NaN; st.ausweichen = 0; }

  function gehZu(x, z, { rennen = false } = {}) {
    setze('ziel'); ziel.x = numOr(x, 0); ziel.z = numOr(z, 0); st.ziel = ziel; st.rennen = !!rennen;
  }
  function folge(getPos, abstand = 2) { setze('folgen'); st.getPos = getPos; st.abstand = Math.max(0, numOr(abstand, 2)); st.ziel = null; st.folgtGerade = true; }
  function fliehe(getPos, sicherAbstand = 8) { setze('fliehen'); st.getPos = getPos; st.abstand = Math.max(0, numOr(sicherAbstand, 8)); st.ziel = null; }
  function wandere(h, rad) {
    setze('wandern');
    if (h) { heim.x = numOr(h.x, 0); heim.z = numOr(h.z, 0); }
    st.wanderR = Math.max(0, numOr(rad, st.wanderR)); st.ziel = null; st.pause = 0; st.rennen = false;
  }
  function folgePfad(punkte, { schleife = false } = {}) {
    setze('pfad'); st.punkte = (punkte || []).map((p) => ({ x: numOr(p.x, 0), z: numOr(p.z, 0) }));
    st.index = 0; st.schleife = !!schleife; st.rennen = false;
    st.ziel = st.punkte[0] || null; if (!st.ziel) { st.modus = 'stehen'; st.angekommen = true; }
  }
  function stehe() { setze('stehen'); st.ziel = null; st.angekommen = true; }

  function setModus(name, d = {}) {
    if (name === 'ziel') gehZu(d.x, d.z, d);
    else if (name === 'folgen') folge(d.getPos, d.abstand);
    else if (name === 'fliehen') fliehe(d.getPos, d.sicherAbstand ?? d.abstand);
    else if (name === 'wandern') wandere(d.heimat, d.radius);
    else if (name === 'pfad') folgePfad(d.punkte, d);
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

  function update(dt, zustand, nachbarn) {
    dt = clamp(numOr(dt, 0), 0, 0.25);
    const pos = zustand?.pos || { x: 0, z: 0 };
    absicht.x = absicht.z = 0; absicht.sprint = false;
    switch (st.modus) {
      case 'ziel':
        st.angekommen = ansteuern(pos, ziel.x, ziel.z, ankunftsRadius, true);
        break;
      case 'wandern':
        if (st.pause > 0) { st.pause -= dt; if (st.pause <= 0) neuesWanderZiel(pos); break; }
        if (!st.ziel) neuesWanderZiel(pos);
        if (ansteuern(pos, ziel.x, ziel.z, ankunftsRadius, true)) { st.pause = range(zufall, 1, 4); st.ziel = null; }
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
      case 'pfad': {
        const pkt = st.punkte[st.index];
        const letzter = st.index === st.punkte.length - 1 && !st.schleife;
        const fertig = ansteuern(pos, pkt.x, pkt.z, letzter ? ankunftsRadius : Math.max(ankunftsRadius, 0.8), letzter);
        if (fertig) {
          if (letzter) st.angekommen = true;
          else { st.index = (st.index + 1) % st.punkte.length; st.ziel = st.punkte[st.index]; }
        }
        break;
      }
      default: st.angekommen = true;
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

  /** Kaum Fortschritt über PRUEF_ZEIT trotz Laufwunsch → kurz seitlich ausweichen bzw. neues Wanderziel. */
  function stecken(dt, pos) {
    const will = Math.hypot(absicht.x, absicht.z) > 0.2;
    if (st.ausweichen > 0) {
      st.ausweichen -= dt;
      const l = Math.hypot(absicht.x, absicht.z) || 1, fx = absicht.x / l, fz = absicht.z / l;
      absicht.x = (fx * 0.3 - fz * st.ausweichSeite) * 0.8; absicht.z = (fz * 0.3 + fx * st.ausweichSeite) * 0.8;
      return;
    }
    if (!will) { st.refX = NaN; st.refZeit = 0; return; }
    if (!Number.isFinite(st.refX)) { st.refX = pos.x; st.refZ = pos.z; st.refZeit = 0; return; }
    st.refZeit += dt;
    if (st.refZeit < PRUEF_ZEIT) return;
    if (Math.hypot(pos.x - st.refX, pos.z - st.refZ) < 0.3 * PRUEF_ZEIT) {
      if (st.modus === 'wandern') { neuesWanderZiel(pos); }
      else { st.ausweichen = AUSWEICH_ZEIT; st.ausweichSeite = zufall() < 0.5 ? -1 : 1; }
    }
    st.refX = pos.x; st.refZ = pos.z; st.refZeit = 0;
  }

  return {
    get modus() { return st.modus; },
    get ziel() { return st.ziel; },
    get angekommen() { return st.angekommen; },
    setModus, gehZu, folge, fliehe, wandere, folgePfad, stehe, update,
    dispose() { st.getPos = null; st.punkte = null; st.modus = 'stehen'; },
  };
}
