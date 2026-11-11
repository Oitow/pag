/**
 * @modul    zauber
 * @zweck    Zauber-System ohne THREE: Zauberbuch mit Mana, Abklingzeiten und wuchtigem Aufladen (Wirkzeit, Halten = Überladen, Schlag), Geschosse (Bogen, Zielsuche, Durchschlag), Strahl, Kegel, Ort, Nova, Felder (Brandboden, Sog) und Treffer-Ereignisse
 * @api      createZauberbuch(opts) -> { wirke(name,{vorlauf,schlag,ziel,halten}) -> {ok,grund,def}, lasseLos(), brichAb() -> bool, kann(name) -> {ok,grund,def}, update(dt,ziele) -> ereignisse[], ladung -> {name,def,phase,anteil,ueber,kraft}|null, mana, manaMax, wirkt, abklingzeit(name), abklingAnteil(name), geschosse, felder, setFreiesMana(bool), namen, zauber, dispose() } ; ZAUBER ; ZAUBER_NAMEN ; zielImKegel(ziele,von,yaw,reichweite,winkel) -> ziel|null ; richtungAusYaw(yaw) -> {x,z}
 * @beispiel
 *   import { createZauberbuch, ZAUBER } from '../../engine/gameplay/zauber.js';
 *   const buch = createZauberbuch({ welt });                       // welt.bodenHoehe(x,z) für Einschläge am Boden
 *   buch.wirke('feuerball', { halten: true, schlag: 0.1,           // lädt mindestens def.wirkzeit, solange gehalten: überlädt
 *     ziel: () => ({ von: handPos, fuss: figur.zustand.pos, yaw, ziel: gegner, punkt: bodenPunkt }) });   // wird beim Loslassen gefragt
 *   if (!taste) buch.lasseLos();                                   // → Ereignis 'schlag' (Geste auslösen), nach `schlag` s 'start'
 *   for (const e of buch.update(dt, gegnerListe))                   // gegnerListe: [{ id, x, y, z, radius, hoehe }]
 *     for (const t of e.treffer) schade(t.ziel, t.schaden, t);      // t: { stoss, umwerfen, verlangsamt, zug }
 * @tags     zauber, magie, kampf, mana, abklingzeit, geschoss, flächenschaden, aufladen, horde, fähigkeit, spell
 * @version  2.0.0
 * @status   entwurf
 * @three    nein
 *
 * Ablauf eines Zaubers: wirke() → Phase 'laden' (mindestens vorlauf s; mit halten bis lasseLos(), dabei wächst die Kraft
 * von 1 auf def.ueberladen bzw. LADEN.kraft) → Ereignis 'schlag' (Abklingzeit beginnt) → nach `schlag` s verlässt er die Hand.
 * Kraft vergrößert Schaden, Radius und Stoß (und def.mehr: zusätzliche Geschosse/Kettenglieder).
 *
 * Ereignisse von update() (Array wird wiederverwendet – nicht aufheben): alle haben { typ, zauber (Name), def (mit Kraft verrechnet), kraft, treffer: [] }.
 *   'schlag'       Aufladen fertig, Geste schlägt zu (noch kein Effekt)
 *   'start'        Zauber verlässt die Hand: von, yaw
 *   'ankuendigung' Ort-Zauber angesagt: pos, radius, verzug (s bis zum Einschlag)
 *   'einschlag'    Geschoss/Ort trifft: pos, radius, geschossId?
 *   'durchschlag'  Geschoss durchbohrt ein Ziel und fliegt weiter: pos, geschossId
 *   'strahl'       Blitz: punkte [{x,y,z} …] (Hand → Ziel → Kettenziele)
 *   'kegel'        Druckwelle: von, yaw, reichweite, winkel
 *   'nova'         Ring um die Figur: pos, radius
 *   'feld' / 'feldTakt' / 'feldEnde'   liegendes Feld beginnt (pos, radius, dauer, sog) / trifft / endet (mit Schluss-Schlag, falls def.feldEnde)
 *   'selbst'       Heilung/Schild: def.heilt / def.schild / def.dauer wertet das Spiel aus
 *   'teleport'     von, nach (das Spiel versetzt die Figur)
 * treffer: [{ id, ziel, schaden, stoss {x,y,z}, umwerfen, verlangsamt (s), zug {x,z} | null (Sog: Geschwindigkeit zur Mitte) }]
 */
import { clamp } from '../core/math.js';
import { ZAUBER, ZAUBER_NAMEN, LADEN } from './zauber-daten.js';

export { ZAUBER, ZAUBER_NAMEN };

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

const mitte = (z) => ({ x: z.x, y: (z.y || 0) + (z.hoehe ?? 1.7) * 0.6, z: z.z });

/** def mit Kraft verrechnet (Schaden, Radius, Stoß, def.mehr, Heilung/Schild, Schluss-Schlag). kraft 1 → dasselbe Objekt. */
function mitKraft(def, kraft) {
  if (!(kraft > 1)) return def;
  const voll = clamp((kraft - 1) / Math.max(1e-3, (def.ueberladen ?? LADEN.kraft) - 1), 0, 1), r = 1 + (kraft - 1) * LADEN.radius;
  const d = { ...def, schaden: (def.schaden || 0) * kraft, radius: (def.radius || 0) * r, stoss: (def.stoss || 0) * (1 + (kraft - 1) * LADEN.stoss) };
  for (const k in def.mehr || {}) d[k] = (def[k] || 0) + Math.round(def.mehr[k] * voll);
  if (def.heilt) d.heilt = Math.round(def.heilt * kraft);
  if (def.schild) d.schild = Math.round(def.schild * kraft);
  if (def.feld) d.feld = { ...def.feld, schaden: (def.feld.schaden || 0) * kraft };
  if (def.feldEnde) d.feldEnde = { ...def.feldEnde, schaden: def.feldEnde.schaden * kraft, radius: def.feldEnde.radius * r };
  return d;
}

/**
 * opts: { zauber = ZAUBER (eigene Tabelle möglich), mana = 100, manaRegen = 6 (pro s), welt ({ bodenHoehe(x,z) }), freiesMana = false }
 * wirke(name, { vorlauf = def.wirkzeit (s Aufladen), schlag = 0 (s vom Schlag bis der Zauber die Hand verlässt), halten = false,
 *   ziel: { von, fuss?, yaw, ziel? (Gegner), punkt? (Bodenpunkt, wenn kein Gegner) } oder Funktion, die das beim Loslassen liefert })
 *   → { ok, grund: null | 'unbekannt' | 'wirkt' | 'abklingzeit' | 'mana', def }. Mana zählt sofort, die Abklingzeit ab dem Schlag.
 */
export function createZauberbuch({ zauber = ZAUBER, mana = 100, manaRegen = 6, welt = null, freiesMana = false } = {}) {
  const manaMax = mana;
  const abkling = {}, geschosse = [], wartend = [], felder = [], ereignisse = [], ladung = { name: null, def: null, phase: null, anteil: 0, ueber: 0, kraft: 1 };
  let wirkt = null, naechsteId = 1, frei = !!freiesMana;
  const boden = (x, z) => (typeof welt?.bodenHoehe === 'function' ? +welt.bodenHoehe(x, z) || 0 : 0);
  const melde = (typ, w, mehr) => { const e = { typ, zauber: w.zauber ?? w.name, def: w.def, kraft: w.kraft || 1, treffer: [], ...mehr }; ereignisse.push(e); return e; };

  function kann(name) {
    const def = zauber[name];
    if (!def) return { ok: false, grund: 'unbekannt', def: null };
    if (wirkt) return { ok: false, grund: 'wirkt', def };
    if ((abkling[name] || 0) > 0) return { ok: false, grund: 'abklingzeit', def };
    if (!frei && mana < def.mana) return { ok: false, grund: 'mana', def };
    return { ok: true, grund: null, def };
  }
  const ueberAnteil = (w) => clamp((w.t - w.vorlauf) / Math.max(1e-3, w.def.ladezeit ?? LADEN.zeit), 0, 1);

  /** Schaden an einem Ziel: Stoß weg von (ax, az), leicht nach oben. */
  function treffer(def, z, ax, az, faktor = 1) {
    let dx = z.x - ax, dz = z.z - az;
    const l = Math.hypot(dx, dz) || 1, s = def.stoss || 0;
    dx /= l; dz /= l;
    return { id: z.id, ziel: z, schaden: Math.round((def.schaden || 0) * faktor), stoss: { x: dx * s, y: s * 0.45, z: dz * s },
      umwerfen: !!def.umwerfen, verlangsamt: def.verlangsamt || 0, zug: null };
  }
  function flaeche(def, pos, ziele, direkt, vx = 0, vz = 0) {
    const out = [];
    if (!(def.radius > 0)) { if (direkt) out.push(treffer(def, direkt, direkt.x - vx, direkt.z - vz)); return out; }   // Stoß in Flugrichtung
    for (const z of ziele) {
      const a = Math.hypot(z.x - pos.x, z.z - pos.z) - (z.radius || 0);
      if (a > def.radius || Math.abs((z.y || 0) - pos.y) > def.radius + (z.hoehe ?? 1.7)) continue;
      out.push(treffer(def, z, pos.x, pos.z, z === direkt ? 1 : 1 - 0.5 * clamp(a / def.radius, 0, 1)));
    }
    return out;
  }
  /** Einschlag melden und – falls der Zauber eins hat – sein Feld auslegen. */
  function einschlag(w, pos, ziele, direkt, mehr, vx, vz) {
    const def = w.def;
    melde('einschlag', w, { pos, radius: def.radius || 0, ...mehr }).treffer = flaeche(def, pos, ziele, direkt, vx, vz);
    if (!def.feld) return;
    const f = { zauber: w.zauber, def, kraft: w.kraft, pos, radius: (def.radius || 1) * (def.feld.anteil ?? 1), rest: def.feld.dauer, takt: def.feld.takt };
    felder.push(f);
    melde('feld', f, { pos, radius: f.radius, dauer: f.rest, sog: def.feld.sog || 0 });
  }

  function loslassen(w, ziele) {
    const def = w.def, name = w.name;
    const a = (typeof w.ziel === 'function' ? w.ziel() : w.ziel) || {};
    const von = { x: +a.von?.x || 0, y: +a.von?.y || 0, z: +a.von?.z || 0 }, fuss = a.fuss || von;
    let yaw = +a.yaw || 0;
    const z = a.ziel && Number.isFinite(+a.ziel.x) ? a.ziel : null, p = z || (a.punkt && Number.isFinite(+a.punkt.x) ? a.punkt : null);
    if (p && Math.hypot(p.x - von.x, p.z - von.z) > 0.3) yaw = Math.atan2(p.x - von.x, p.z - von.z);
    const d = richtungAusYaw(yaw);
    melde('start', w, { von, yaw });
    // Zielpunkt am Boden für Ort-Zauber und Bogen-Geschosse: Gegner/Bodenpunkt (auf Reichweite begrenzt), sonst ein Stück voraus
    const ort = (anteil) => {
      let px = von.x + d.x * def.reichweite * anteil, pz = von.z + d.z * def.reichweite * anteil;
      if (p) { const f = Math.min(1, def.reichweite / Math.max(Math.hypot(p.x - von.x, p.z - von.z), 1e-3)); px = von.x + (p.x - von.x) * f; pz = von.z + (p.z - von.z) * f; }
      return { x: px, y: boden(px, pz), z: pz };
    };
    if (def.art === 'geschoss') {
      const n = def.anzahl || 1;
      for (let i = 0; i < n; i++) {
        const seite = n > 1 ? (i - (n - 1) / 2) * (1.6 / n) : 0, r = richtungAusYaw(yaw + seite);
        let vx = r.x * def.tempo, vy = n > 1 ? 0.35 * def.tempo : 0, vz = r.z * def.tempo;
        if (def.fall) {                             // Bogen: so werfen, dass er am Zielpunkt landet
          const o = ort(0.45), t = Math.max(0.15, Math.hypot(o.x - von.x, o.z - von.z) / def.tempo);
          vx = (o.x - von.x) / t; vz = (o.z - von.z) / t; vy = ((z ? mitte(z).y : o.y) - von.y) / t + 0.5 * def.fall * t;
        } else if (p && n === 1) {                  // gerade: auf die Mitte des Gegners bzw. knapp über den Bodenpunkt
          const zy = z ? mitte(z).y : (p.y ?? boden(p.x, p.z)) + 0.3, e = Math.max(Math.hypot(p.x - von.x, p.z - von.z), 0.5), l = Math.hypot(e, zy - von.y);
          vx = r.x * e / l * def.tempo; vz = r.z * e / l * def.tempo; vy = (zy - von.y) / l * def.tempo;
        }
        geschosse.push({ id: naechsteId++, zauber: name, def, kraft: w.kraft, x: von.x, y: von.y, z: von.z, vx, vy, vz,
          rest: def.reichweite / def.tempo * (def.fall ? 2 : 1), ziel: z, alter: 0, durch: [] });
      }
    } else if (def.art === 'strahl') {
      const punkte = [von], getroffen = [];
      let akt = z || zielImKegel(ziele, von, yaw, def.reichweite, def.winkel), faktor = 1;
      if (!akt) punkte.push({ x: von.x + d.x * def.reichweite, y: von.y, z: von.z + d.z * def.reichweite });
      let ax = von.x, az = von.z;
      while (akt && getroffen.length <= (def.kette || 0)) {
        punkte.push(mitte(akt));
        getroffen.push(treffer(def, akt, ax, az, faktor));
        ax = akt.x; az = akt.z; faktor = Math.max(0.4, faktor * 0.85);
        let naechst = null, na = def.kettenRadius || 0;
        for (const k of ziele) {
          if (getroffen.some((t) => t.ziel === k)) continue;
          const e = Math.hypot(k.x - ax, k.z - az);
          if (e < na) { na = e; naechst = k; }
        }
        akt = naechst;
      }
      melde('strahl', w, { punkte }).treffer = getroffen;
    } else if (def.art === 'kegel') {
      const getroffen = [];
      for (const k of ziele) {
        const dx = k.x - von.x, dz = k.z - von.z, e = Math.hypot(dx, dz);
        if (e > def.reichweite + (k.radius || 0)) continue;
        if (e > 0.6 && Math.acos(clamp((dx * d.x + dz * d.z) / e, -1, 1)) > def.winkel) continue;
        getroffen.push(treffer(def, k, von.x, von.z, 1 - 0.4 * clamp(e / def.reichweite, 0, 1)));
      }
      melde('kegel', w, { von, yaw, reichweite: def.reichweite, winkel: def.winkel }).treffer = getroffen;
    } else if (def.art === 'ort') {
      const pos = ort(0.6);
      wartend.push({ zauber: name, def, kraft: w.kraft, pos, rest: def.verzug || 0 });
      melde('ankuendigung', w, { pos, radius: def.radius, verzug: def.verzug || 0 });
    } else if (def.art === 'nova') {
      const pos = { x: fuss.x, y: boden(fuss.x, fuss.z), z: fuss.z };
      melde('nova', w, { pos, radius: def.radius }).treffer = flaeche(def, pos, ziele, null);
    } else if (def.art === 'teleport') {
      const nx = fuss.x + d.x * def.reichweite, nz = fuss.z + d.z * def.reichweite;
      melde('teleport', w, { von: { x: fuss.x, y: fuss.y, z: fuss.z }, nach: { x: nx, y: boden(nx, nz), z: nz }, yaw });
    } else melde('selbst', w, { von });
  }

  /** Bewegt ein Geschoss. Rückgabe: getroffenes Ziel, true (Boden/Reichweite) oder false (fliegt weiter). */
  function fliegen(g, dt, ziele) {
    const def = g.def;
    g.alter += dt; g.rest -= dt;
    if (def.fall) g.vy -= def.fall * dt;
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
      const b = boden(g.x, g.z);
      if (def.durchschlag && g.y < b + 0.25) { g.y = b + 0.25; g.vy = Math.max(0, g.vy); }   // Durchbohrer gleiten knapp über dem Boden weiter
      for (const z of ziele) {
        if (Math.hypot(z.x - g.x, z.z - g.z) > (z.radius || 0.35) + 0.25) continue;
        if (g.y < (z.y || 0) - 0.2 || g.y > (z.y || 0) + (z.hoehe ?? 1.7) + 0.2 || g.durch.includes(z)) continue;
        return z;
      }
      if (g.y <= b) return true;
    }
    return g.rest <= 0;
  }

  function feldUpdate(f, dt, ziele) {
    const fd = f.def.feld;
    f.rest -= dt;
    if ((f.takt -= dt) <= 0 && f.rest > 0) {
      f.takt += fd.takt;
      const getroffen = [];
      for (const z of ziele) {
        const dx = f.pos.x - z.x, dz = f.pos.z - z.z, e = Math.hypot(dx, dz);
        if (e - (z.radius || 0) > f.radius) continue;
        const s = (fd.sog || 0) * Math.min(1, e / 1.2) / (e || 1);
        getroffen.push({ id: z.id, ziel: z, schaden: Math.round(fd.schaden || 0), stoss: { x: 0, y: 0, z: 0 }, umwerfen: false,
          verlangsamt: fd.verlangsamt || 0, zug: s ? { x: dx * s, z: dz * s } : null });
      }
      if (getroffen.length) melde('feldTakt', f, { pos: f.pos, radius: f.radius }).treffer = getroffen;
    }
    if (f.rest > 0) return false;
    const ende = f.def.feldEnde;
    melde('feldEnde', f, { pos: f.pos, radius: ende ? ende.radius : f.radius, schlag: !!ende }).treffer = ende ? flaeche(ende, f.pos, ziele, null) : [];
    return true;
  }

  return {
    zauber, namen: Object.keys(zauber), manaMax, geschosse, felder,
    get mana() { return frei ? manaMax : mana; },
    get wirkt() { return wirkt ? wirkt.name : null; },
    /** Stand des Aufladens (Objekt wird wiederverwendet) oder null: phase 'laden' | 'schlag', anteil 0…1 (Wirkzeit), ueber 0…1 (Überladung), kraft. */
    get ladung() {
      if (!wirkt) return null;
      const ueber = wirkt.phase === 'laden' ? ueberAnteil(wirkt) : wirkt.ueber;
      ladung.name = wirkt.name; ladung.def = wirkt.def; ladung.phase = wirkt.phase; ladung.ueber = ueber;
      ladung.anteil = wirkt.vorlauf > 0 ? clamp(wirkt.t / wirkt.vorlauf, 0, 1) : 1;
      ladung.kraft = 1 + ((wirkt.def.ueberladen ?? LADEN.kraft) - 1) * ueber;
      return ladung;
    },
    kann,
    wirke(name, { vorlauf, schlag = 0, ziel = null, halten = false } = {}) {
      const k = kann(name);
      if (!k.ok) return k;
      if (!frei) mana -= k.def.mana;
      wirkt = { name, def: k.def, basis: k.def, t: 0, vorlauf: Math.max(0, +(vorlauf ?? k.def.wirkzeit) || 0), schlag: Math.max(0, +schlag || 0),
        ziel, halten: !!halten, phase: 'laden', kraft: 1, ueber: 0 };
      return k;
    },
    /** Gehaltenen Zauber freigeben: er schlägt zu, sobald die Wirkzeit um ist. */
    lasseLos() { if (wirkt) wirkt.halten = false; },
    /** Aufladen abbrechen (nur vor dem Schlag): Mana kommt zurück, keine Abklingzeit. */
    brichAb() {
      if (!wirkt || wirkt.phase !== 'laden') return false;
      if (!frei) mana = Math.min(manaMax, mana + wirkt.basis.mana);
      wirkt = null;
      return true;
    },
    abklingzeit: (name) => Math.max(0, abkling[name] || 0),
    abklingAnteil: (name) => (zauber[name] ? clamp((abkling[name] || 0) / zauber[name].abkling, 0, 1) : 0),
    setFreiesMana(an) { frei = !!an; },
    update(dt, ziele = []) {
      ereignisse.length = 0;
      mana = Math.min(manaMax, mana + manaRegen * dt);
      for (const n in abkling) if (abkling[n] > 0) abkling[n] -= dt;
      if (wirkt && wirkt.phase === 'laden') {
        wirkt.t += dt;
        if (wirkt.t >= wirkt.vorlauf && !wirkt.halten) {
          wirkt.ueber = ueberAnteil(wirkt);
          wirkt.kraft = 1 + ((wirkt.basis.ueberladen ?? LADEN.kraft) - 1) * wirkt.ueber;
          wirkt.def = mitKraft(wirkt.basis, wirkt.kraft);
          wirkt.phase = 'schlag'; wirkt.rest = wirkt.schlag;
          abkling[wirkt.name] = wirkt.basis.abkling;
          melde('schlag', wirkt);
        }
      } else if (wirkt) wirkt.rest -= dt;
      if (wirkt && wirkt.phase === 'schlag' && wirkt.rest <= 0) { const w = wirkt; wirkt = null; loslassen(w, ziele); }
      for (let i = geschosse.length - 1; i >= 0; i--) {
        const g = geschosse[i], r = fliegen(g, dt, ziele);
        if (!r) continue;
        const pos = { x: g.x, y: g.y, z: g.z };
        if (r !== true && g.durch.length < (g.def.durchschlag || 0)) {      // durchbohren und weiterfliegen
          g.durch.push(r);
          melde('durchschlag', g, { pos, geschossId: g.id }).treffer = [treffer(g.def, r, r.x - g.vx, r.z - g.vz)];
          continue;
        }
        geschosse.splice(i, 1);
        einschlag(g, pos, ziele, r === true ? null : r, { geschossId: g.id }, g.vx, g.vz);
      }
      for (let i = wartend.length - 1; i >= 0; i--) {
        const w = wartend[i];
        if ((w.rest -= dt) > 0) continue;
        wartend.splice(i, 1);
        einschlag(w, w.pos, ziele, null);
      }
      for (let i = felder.length - 1; i >= 0; i--) if (feldUpdate(felder[i], dt, ziele)) felder.splice(i, 1);
      return ereignisse;
    },
    dispose() { geschosse.length = 0; wartend.length = 0; felder.length = 0; ereignisse.length = 0; wirkt = null; },
  };
}
