/**
 * @modul    zauber
 * @zweck    Zauber-System ohne THREE: 10 Zauber als Daten (Geschoss, Strahl, Kegel, Ort, Selbst, Teleport), Zauberbuch mit Mana, Abklingzeiten, Wirkzeit, Geschoss-Simulation und Treffer-Ereignissen
 * @api      createZauberbuch(opts) -> { wirke(name,{vorlauf,ziel}) -> {ok,grund,def}, kann(name) -> {ok,grund}, update(dt,ziele) -> ereignisse[], mana, manaMax, wirkt, abklingzeit(name), abklingAnteil(name), geschosse, setFreiesMana(bool), namen, zauber, dispose() } ; ZAUBER ; ZAUBER_NAMEN ; zielImKegel(ziele,von,yaw,reichweite,winkel) -> ziel|null ; richtungAusYaw(yaw) -> {x,z}
 * @beispiel
 *   import { createZauberbuch, ZAUBER } from '../../engine/gameplay/zauber.js';
 *   const buch = createZauberbuch({ welt });                       // welt.bodenHoehe(x,z) für Einschläge am Boden
 *   const r = buch.wirke('feuerball', { vorlauf: figur.spiele(ZAUBER.feuerball.clip).trefferBei,
 *     ziel: () => ({ von: handPos, yaw: figur.zustand.yaw, ziel: gegner }) });   // ziel-Funktion wird beim Loslassen gefragt
 *   for (const e of buch.update(dt, gegnerListe))                   // gegnerListe: [{ id, x, y, z, radius, hoehe }]
 *     if (e.typ === 'einschlag') for (const t of e.treffer) schade(t.id, t.schaden, t.stoss);
 * @tags     zauber, magie, kampf, mana, abklingzeit, geschoss, flächenschaden, fähigkeit, spell
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Ereignisse von update() (Array wird wiederverwendet – nicht aufheben): alle haben { typ, zauber (Name), def, treffer: [] }.
 *   'start'        Zauber verlässt die Hand: von, yaw
 *   'ankuendigung' Ort-Zauber angesagt: pos, radius, verzug (s bis zum Einschlag)
 *   'einschlag'    Geschoss/Ort trifft: pos, radius, geschossId?
 *   'strahl'       Blitz: punkte [{x,y,z} …] (Hand → Ziel → Kettenziele)
 *   'kegel'        Windstoß: von, yaw, reichweite, winkel
 *   'selbst'       Heilung/Schild: def.heilt / def.schild / def.dauer wertet das Spiel aus
 *   'teleport'     von, nach (das Spiel versetzt die Figur)
 * treffer: [{ id, ziel, schaden, stoss {x,y,z}, umwerfen, verlangsamt (s) }]
 */
import { clamp } from '../core/math.js';

/** Die 10 Zauber. art: 'geschoss' | 'strahl' | 'kegel' | 'ort' | 'selbst' | 'teleport'. clip = Geste aus character-clips-zauber. */
export const ZAUBER = Object.freeze({
  feuerball: { name: 'Feuerball', symbol: '🔥', farbe: 0xff7a2a, art: 'geschoss', clip: 'zauberWurf', mana: 18, abkling: 1.2,
    schaden: 30, radius: 2.6, tempo: 17, reichweite: 32, stoss: 6, text: 'Explodiert beim Aufprall und trifft alle im Umkreis.' },
  eislanze: { name: 'Eislanze', symbol: '❄️', farbe: 0x8fd8ff, art: 'geschoss', clip: 'zauberStoss', mana: 10, abkling: 0.5,
    schaden: 16, radius: 0, tempo: 30, reichweite: 36, stoss: 2, verlangsamt: 3, text: 'Schnell und genau. Verlangsamt das Ziel.' },
  arkan: { name: 'Arkane Geschosse', symbol: '🔮', farbe: 0xc77dff, art: 'geschoss', clip: 'zauberWurf', mana: 14, abkling: 1.6,
    schaden: 9, radius: 0, tempo: 12, reichweite: 30, stoss: 1.5, anzahl: 3, suchend: 5, text: 'Drei Geschosse, die ihr Ziel selbst suchen.' },
  blitz: { name: 'Kettenblitz', symbol: '⚡', farbe: 0xfff27a, art: 'strahl', clip: 'zauberFinger', mana: 20, abkling: 2,
    schaden: 22, reichweite: 20, winkel: 0.5, kette: 3, kettenRadius: 7, stoss: 2, text: 'Trifft sofort und springt auf bis zu drei weitere Ziele.' },
  windstoss: { name: 'Windstoß', symbol: '🌪️', farbe: 0xd8f4ff, art: 'kegel', clip: 'zauberStoss', mana: 12, abkling: 2.5,
    schaden: 6, reichweite: 8, winkel: 0.75, stoss: 12, text: 'Schleudert alles vor dir weg.' },
  erdstachel: { name: 'Erdstachel', symbol: '🪨', farbe: 0xb08a5a, art: 'ort', clip: 'zauberBoden', mana: 22, abkling: 4,
    schaden: 26, radius: 2.4, reichweite: 12, verzug: 0.25, stoss: 7, umwerfen: true, text: 'Stacheln brechen aus dem Boden und werfen Ziele um.' },
  meteor: { name: 'Meteor', symbol: '☄️', farbe: 0xff4a1a, art: 'ort', clip: 'zauberHimmel', mana: 45, abkling: 9,
    schaden: 60, radius: 4.5, reichweite: 16, verzug: 1.3, stoss: 10, umwerfen: true, text: 'Fällt nach kurzer Zeit vom Himmel. Riesiger Einschlag.' },
  heilung: { name: 'Heilung', symbol: '💚', farbe: 0x6dff8a, art: 'selbst', clip: 'zauberSelbst', mana: 25, abkling: 6,
    heilt: 35, text: 'Stellt Leben wieder her.' },
  schild: { name: 'Schutzschild', symbol: '🛡️', farbe: 0x7ab8ff, art: 'selbst', clip: 'zauberSelbst', mana: 20, abkling: 10,
    schild: 40, dauer: 8, text: 'Fängt eine Weile Schaden ab.' },
  blinzeln: { name: 'Blinzeln', symbol: '✨', farbe: 0xffe0ff, art: 'teleport', clip: 'zauberSelbst', mana: 15, abkling: 3,
    reichweite: 8, text: 'Versetzt dich ein Stück in Blickrichtung.' },
});
export const ZAUBER_NAMEN = Object.freeze(Object.keys(ZAUBER));

/** Blickrichtung in x/z aus yaw (0 = +Z, wie character-motor). */
export const richtungAusYaw = (yaw) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });

/** Nächstes Ziel im Kegel vor (von, yaw): winkel = halber Öffnungswinkel (rad). Näher und mittiger gewinnt. */
export function zielImKegel(ziele, von, yaw, reichweite = 20, winkel = 0.5) {
  const d = richtungAusYaw(yaw);
  let best = null, bw = Infinity;
  for (const z of ziele || []) {
    const dx = z.x - von.x, dz = z.z - von.z, a = Math.hypot(dx, dz);
    if (a > reichweite + (z.radius || 0) || a < 1e-4) continue;
    const w = Math.acos(clamp((dx * d.x + dz * d.z) / a, -1, 1));
    if (w > winkel) continue;
    const wert = a * (1 + w * 2);
    if (wert < bw) { bw = wert; best = z; }
  }
  return best;
}

const mitte = (z) => ({ x: z.x, y: (z.y || 0) + (z.hoehe || 1.7) * 0.6, z: z.z });

/**
 * opts: { zauber = ZAUBER (eigene Tabelle möglich), mana = 100, manaRegen = 6 (pro s), welt ({ bodenHoehe(x,z) }), freiesMana = false }
 * wirke(name, { vorlauf = 0 (s bis zum Loslassen, z. B. trefferBei der Geste), ziel: {von,yaw,ziel?} oder Funktion, die das liefert })
 *   → { ok, grund: null | 'unbekannt' | 'wirkt' | 'abklingzeit' | 'mana', def }. Mana und Abklingzeit zählen sofort.
 */
export function createZauberbuch({ zauber = ZAUBER, mana = 100, manaRegen = 6, welt = null, freiesMana = false } = {}) {
  const manaMax = mana;
  const abkling = {}, geschosse = [], wartend = [], ereignisse = [];
  let wirkt = null, naechsteId = 1, frei = !!freiesMana;
  const boden = (x, z) => (typeof welt?.bodenHoehe === 'function' ? +welt.bodenHoehe(x, z) || 0 : 0);

  function kann(name) {
    const def = zauber[name];
    if (!def) return { ok: false, grund: 'unbekannt', def: null };
    if (wirkt) return { ok: false, grund: 'wirkt', def };
    if ((abkling[name] || 0) > 0) return { ok: false, grund: 'abklingzeit', def };
    if (!frei && mana < def.mana) return { ok: false, grund: 'mana', def };
    return { ok: true, grund: null, def };
  }

  /** Schaden an einem Ziel: Stoß weg von (ax, az), leicht nach oben. */
  function treffer(def, z, ax, az, faktor = 1) {
    let dx = z.x - ax, dz = z.z - az;
    const l = Math.hypot(dx, dz) || 1, s = def.stoss || 0;
    dx /= l; dz /= l;
    return { id: z.id, ziel: z, schaden: Math.round((def.schaden || 0) * faktor), stoss: { x: dx * s, y: s * 0.45, z: dz * s },
      umwerfen: !!def.umwerfen, verlangsamt: def.verlangsamt || 0 };
  }
  function flaeche(def, pos, ziele, direkt, vx = 0, vz = 0) {
    const out = [];
    if (!(def.radius > 0)) { if (direkt) out.push(treffer(def, direkt, direkt.x - vx, direkt.z - vz)); return out; }   // Stoß in Flugrichtung
    for (const z of ziele) {
      const a = Math.hypot(z.x - pos.x, z.z - pos.z) - (z.radius || 0);
      if (a > def.radius || Math.abs((z.y || 0) - pos.y) > def.radius + (z.hoehe || 1.7)) continue;
      out.push(treffer(def, z, pos.x, pos.z, z === direkt ? 1 : 1 - 0.5 * clamp(a / def.radius, 0, 1)));
    }
    return out;
  }

  function loslassen(name, def, zielAngabe, ziele) {
    const a = (typeof zielAngabe === 'function' ? zielAngabe() : zielAngabe) || {};
    const von = { x: +a.von?.x || 0, y: +a.von?.y || 0, z: +a.von?.z || 0 };
    let yaw = +a.yaw || 0;
    const z = a.ziel && Number.isFinite(+a.ziel.x) ? a.ziel : null;
    if (z) yaw = Math.atan2(z.x - von.x, z.z - von.z);
    const d = richtungAusYaw(yaw);
    ereignisse.push({ typ: 'start', zauber: name, def, von, yaw, treffer: [] });
    if (def.art === 'geschoss') {
      const n = def.anzahl || 1;
      for (let i = 0; i < n; i++) {
        const seite = n > 1 ? (i - (n - 1) / 2) * 0.55 : 0, r = richtungAusYaw(yaw + seite);
        let vy = n > 1 ? 0.35 : 0;
        if (z && n === 1) vy = (mitte(z).y - von.y) / Math.max(Math.hypot(z.x - von.x, z.z - von.z), 0.5);
        const l = Math.hypot(1, vy);
        geschosse.push({ id: naechsteId++, zauber: name, def, x: von.x, y: von.y, z: von.z, vx: r.x / l * def.tempo, vy: vy / l * def.tempo,
          vz: r.z / l * def.tempo, rest: def.reichweite / def.tempo, ziel: z, alter: 0 });
      }
    } else if (def.art === 'strahl') {
      const punkte = [von], getroffen = [];
      let akt = z || zielImKegel(ziele, von, yaw, def.reichweite, def.winkel), faktor = 1;
      if (!akt) punkte.push({ x: von.x + d.x * def.reichweite, y: von.y, z: von.z + d.z * def.reichweite });
      let ax = von.x, az = von.z;
      while (akt && getroffen.length <= (def.kette || 0)) {
        punkte.push(mitte(akt));
        getroffen.push(treffer(def, akt, ax, az, faktor));
        ax = akt.x; az = akt.z; faktor *= 0.7;
        let naechst = null, na = def.kettenRadius || 0;
        for (const k of ziele) {
          if (getroffen.some((t) => t.ziel === k)) continue;
          const e = Math.hypot(k.x - ax, k.z - az);
          if (e < na) { na = e; naechst = k; }
        }
        akt = naechst;
      }
      ereignisse.push({ typ: 'strahl', zauber: name, def, punkte, treffer: getroffen });
    } else if (def.art === 'kegel') {
      const getroffen = [];
      for (const k of ziele) {
        const dx = k.x - von.x, dz = k.z - von.z, e = Math.hypot(dx, dz);
        if (e > def.reichweite + (k.radius || 0)) continue;
        if (e > 0.6 && Math.acos(clamp((dx * d.x + dz * d.z) / e, -1, 1)) > def.winkel) continue;
        getroffen.push(treffer(def, k, von.x, von.z, 1 - 0.4 * clamp(e / def.reichweite, 0, 1)));
      }
      ereignisse.push({ typ: 'kegel', zauber: name, def, von, yaw, reichweite: def.reichweite, winkel: def.winkel, treffer: getroffen });
    } else if (def.art === 'ort') {
      let px = von.x + d.x * def.reichweite * 0.6, pz = von.z + d.z * def.reichweite * 0.6;
      if (z) {
        const e = Math.hypot(z.x - von.x, z.z - von.z), f = Math.min(1, def.reichweite / Math.max(e, 1e-3));
        px = von.x + (z.x - von.x) * f; pz = von.z + (z.z - von.z) * f;
      }
      const pos = { x: px, y: boden(px, pz), z: pz };
      wartend.push({ zauber: name, def, pos, rest: def.verzug || 0 });
      ereignisse.push({ typ: 'ankuendigung', zauber: name, def, pos, radius: def.radius, verzug: def.verzug || 0, treffer: [] });
    } else if (def.art === 'teleport') {
      const fuss = a.fuss || von;
      const nx = fuss.x + d.x * def.reichweite, nz = fuss.z + d.z * def.reichweite;
      ereignisse.push({ typ: 'teleport', zauber: name, def, von: { x: fuss.x, y: fuss.y, z: fuss.z }, nach: { x: nx, y: boden(nx, nz), z: nz }, yaw, treffer: [] });
    } else ereignisse.push({ typ: 'selbst', zauber: name, def, von, treffer: [] });
  }

  function fliegen(g, dt, ziele) {
    const def = g.def;
    g.alter += dt; g.rest -= dt;
    if (def.suchend && g.alter > 0.18) {     // Zielsuche: Geschwindigkeit zum Ziel drehen (begrenzte Wendigkeit)
      if (!g.ziel || !ziele.includes(g.ziel)) g.ziel = zielImKegel(ziele, g, Math.atan2(g.vx, g.vz), def.reichweite, Math.PI);
      if (g.ziel) {
        const m = mitte(g.ziel);
        let dx = m.x - g.x, dy = m.y - g.y, dz = m.z - g.z;
        const l = Math.hypot(dx, dy, dz) || 1, k = Math.min(1, def.suchend * dt);
        g.vx += (dx / l * def.tempo - g.vx) * k; g.vy += (dy / l * def.tempo - g.vy) * k; g.vz += (dz / l * def.tempo - g.vz) * k;
        const v = Math.hypot(g.vx, g.vy, g.vz) || 1;
        g.vx *= def.tempo / v; g.vy *= def.tempo / v; g.vz *= def.tempo / v;
      }
    }
    // In Teilschritten bewegen, damit schnelle Geschosse nichts überspringen
    const n = Math.max(1, Math.ceil(Math.hypot(g.vx, g.vy, g.vz) * dt / 0.4));
    for (let i = 0; i < n; i++) {
      g.x += g.vx * dt / n; g.y += g.vy * dt / n; g.z += g.vz * dt / n;
      for (const z of ziele) {
        if (Math.hypot(z.x - g.x, z.z - g.z) > (z.radius || 0.35) + 0.25) continue;
        if (g.y < (z.y || 0) - 0.2 || g.y > (z.y || 0) + (z.hoehe || 1.7) + 0.2) continue;
        return z;
      }
      if (g.y <= boden(g.x, g.z)) return true;
    }
    return g.rest <= 0;
  }

  return {
    zauber, namen: Object.keys(zauber), manaMax, geschosse,
    get mana() { return frei ? manaMax : mana; },
    get wirkt() { return wirkt ? wirkt.name : null; },
    kann,
    wirke(name, { vorlauf = 0, ziel = null } = {}) {
      const k = kann(name);
      if (!k.ok) return k;
      if (!frei) mana -= k.def.mana;
      abkling[name] = k.def.abkling;
      wirkt = { name, def: k.def, rest: Math.max(0, +vorlauf || 0), ziel };
      return k;
    },
    abklingzeit: (name) => Math.max(0, abkling[name] || 0),
    abklingAnteil: (name) => (zauber[name] ? clamp((abkling[name] || 0) / zauber[name].abkling, 0, 1) : 0),
    setFreiesMana(an) { frei = !!an; },
    update(dt, ziele = []) {
      ereignisse.length = 0;
      mana = Math.min(manaMax, mana + manaRegen * dt);
      for (const n in abkling) if (abkling[n] > 0) abkling[n] -= dt;
      if (wirkt && (wirkt.rest -= dt) <= 0) { const w = wirkt; wirkt = null; loslassen(w.name, w.def, w.ziel, ziele); }
      for (let i = geschosse.length - 1; i >= 0; i--) {
        const g = geschosse[i], r = fliegen(g, dt, ziele);
        if (!r) continue;
        geschosse.splice(i, 1);
        const pos = { x: g.x, y: g.y, z: g.z }, direkt = r === true ? null : r;
        ereignisse.push({ typ: 'einschlag', zauber: g.zauber, def: g.def, pos, radius: g.def.radius || 0, geschossId: g.id, treffer: flaeche(g.def, pos, ziele, direkt, g.vx, g.vz) });
      }
      for (let i = wartend.length - 1; i >= 0; i--) {
        const w = wartend[i];
        if ((w.rest -= dt) > 0) continue;
        wartend.splice(i, 1);
        ereignisse.push({ typ: 'einschlag', zauber: w.zauber, def: w.def, pos: w.pos, radius: w.def.radius, treffer: flaeche(w.def, w.pos, ziele, null) });
      }
      return ereignisse;
    },
    dispose() { geschosse.length = 0; wartend.length = 0; ereignisse.length = 0; wirkt = null; },
  };
}
