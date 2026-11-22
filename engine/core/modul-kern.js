/**
 * @modul    modul-kern
 * @zweck    Modul-System für Spiele: Module (Welt, Figur, Zauber …) mit Abhängigkeiten anmelden, in richtiger Reihenfolge starten, je Bild/festem Schritt takten, Dienste teilen, Zustand speichern und rückwärts aufräumen – an/abschaltbar per Name
 * @api      createModulKern({ereignisse,optionen,seed,fehler}) -> {registriere(modul),starte(namen?)->Promise,api(name),hat(name),dienst(name,wert?),update(dt),fest(dt),spaet(dt),zustand(),lade(z),aktiv,reihenfolge,ereignisse,dispose()} ; ordneModule(module,{aus}) -> {reihenfolge,uebersprungen}
 * @beispiel
 *   import { createModulKern } from '../../engine/core/modul-kern.js';
 *   const kern = createModulKern({ optionen: { gegner: { anzahl: 20 } } });
 *   kern.registriere({ name: 'welt', start: () => ({ bodenHoehe: () => 0 }) });
 *   kern.registriere({ name: 'gegner', braucht: ['welt'], start: (ctx) => { const w = ctx.braucht('welt'); return { anzahl: ctx.optionen.anzahl }; }, update(dt) {} });
 *   await kern.starte();               // welt → gegner
 *   kern.update(1 / 60);
 * @tags     modul, plugin, system, abhaengigkeit, lebenszyklus, spiel, baukasten
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { createEreignisse } from './ereignisse.js';
import { hashSeed, rng } from './rng.js';

/**
 * Modul-Form (alles außer name optional):
 * { name, braucht: [namen], optional: [namen], start(ctx) -> api | Promise<api>,
 *   update(dt, ctx)  – jedes Bild,  fest(dt, ctx) – fester Schritt (Simulation),  spaet(dt, ctx) – nach update (Kamera, Anzeige),
 *   zustand() -> daten,  lade(daten),  dispose() }
 * ctx = { name, kern, ereignisse, optionen (je Modul), seed, zufall() (eigener Seed je Modul), braucht(name) -> api, optional(name) -> api|null, dienst(name, wert?) }
 */
export function ordneModule(module, { aus = [] } = {}) {
  const nachName = new Map(module.map((m) => [m.name, m]));
  const uebersprungen = new Map();                       // name → Grund
  for (const n of aus) if (nachName.has(n)) uebersprungen.set(n, 'abgeschaltet');
  // Fehlt eine Pflicht-Abhängigkeit (auch transitiv), wird das Modul übersprungen statt das Spiel zu sprengen
  let geaendert = true;
  while (geaendert) {
    geaendert = false;
    for (const m of module) {
      if (uebersprungen.has(m.name)) continue;
      const fehlt = (m.braucht || []).find((b) => !nachName.has(b) || uebersprungen.has(b));
      if (fehlt) { uebersprungen.set(m.name, `braucht „${fehlt}“`); geaendert = true; }
    }
  }
  const reihenfolge = [], status = new Map();
  const besuche = (m, pfad) => {
    if (status.get(m.name) === 2) return;
    if (status.get(m.name) === 1) throw new Error(`modul-kern: Kreis in Abhängigkeiten: ${[...pfad, m.name].join(' → ')}`);
    status.set(m.name, 1);
    for (const b of [...(m.braucht || []), ...(m.optional || [])]) {
      const d = nachName.get(b);
      if (d && !uebersprungen.has(b)) besuche(d, [...pfad, m.name]);
    }
    status.set(m.name, 2);
    reihenfolge.push(m);
  };
  for (const m of module) if (!uebersprungen.has(m.name)) besuche(m, []);
  return { reihenfolge, uebersprungen };
}

export function createModulKern({ ereignisse = null, optionen = {}, seed = 1, fehler = null, aus = [] } = {}) {
  const bus = ereignisse || createEreignisse({ fehler });
  const eigenerBus = !ereignisse;
  const module = [];
  const apis = new Map(), dienste = new Map(), ctxe = new Map();
  let laufend = [], gestartet = false, beendet = false;
  const melde = (e, wo) => { if (fehler) fehler(e, wo); else throw e; };

  function registriere(modul) {
    if (!modul || typeof modul.name !== 'string' || !modul.name) throw new Error('modul-kern: Modul braucht einen Namen');
    if (gestartet) throw new Error(`modul-kern: „${modul.name}“ kommt zu spät – erst registrieren, dann starten`);
    if (module.some((m) => m.name === modul.name)) throw new Error(`modul-kern: „${modul.name}“ ist doppelt`);
    module.push(modul);
    return kern;
  }

  function dienst(name, wert) {
    if (arguments.length > 1) { dienste.set(name, wert); bus.sende('dienst:' + name, wert); return wert; }
    return dienste.get(name) ?? null;
  }

  async function starte(namen = null) {
    if (gestartet) throw new Error('modul-kern: schon gestartet');
    gestartet = true;
    const auswahl = namen ? module.filter((m) => namen.includes(m.name)) : module;
    const { reihenfolge, uebersprungen } = ordneModule(auswahl, { aus });
    kern.uebersprungen = Object.fromEntries(uebersprungen);
    for (const m of reihenfolge) {
      const ctx = {
        name: m.name, kern, ereignisse: bus, seed,
        optionen: { ...(m.standard || {}), ...(optionen[m.name] || {}) },
        zufall: rng(hashSeed('modul', m.name, seed)),
        braucht: (n) => { if (!apis.has(n)) throw new Error(`modul-kern: „${m.name}“ braucht „${n}“ (nicht gestartet)`); return apis.get(n); },
        optional: (n) => apis.get(n) ?? null,
        dienst,
      };
      ctxe.set(m.name, ctx);
      try {
        const api = m.start ? await m.start(ctx) : null;
        apis.set(m.name, api ?? {});
        laufend.push(m);
        bus.sende('modul:gestartet', { name: m.name });
      } catch (e) {
        kern.uebersprungen[m.name] = 'Fehler beim Start: ' + (e?.message || e);
        melde(e, m.name);
      }
    }
    bus.sende('module:bereit', { namen: laufend.map((m) => m.name) });
    return kern;
  }

  const takt = (art) => (dt) => {
    for (const m of laufend) {
      if (!m[art]) continue;
      try { m[art](dt, ctxe.get(m.name)); } catch (e) { melde(e, `${m.name}.${art}`); }
    }
  };

  function zustand() {
    const z = {};
    for (const m of laufend) if (m.zustand) z[m.name] = m.zustand();
    return z;
  }
  function lade(z = {}) {
    for (const m of laufend) if (m.lade && z[m.name] !== undefined) m.lade(z[m.name]);
  }

  function dispose() {
    if (beendet) return;
    beendet = true;
    for (const m of [...laufend].reverse()) { try { m.dispose?.(); } catch (e) { melde(e, `${m.name}.dispose`); } }
    laufend = []; apis.clear(); dienste.clear(); ctxe.clear();
    if (eigenerBus) bus.dispose?.();
  }

  const kern = {
    registriere, starte, dienst, zustand, lade, dispose,
    api: (n) => apis.get(n) ?? null,
    hat: (n) => apis.has(n),
    update: takt('update'), fest: takt('fest'), spaet: takt('spaet'),
    get aktiv() { return laufend.map((m) => m.name); },
    get reihenfolge() { return laufend.map((m) => m.name); },
    get module() { return module.map((m) => m.name); },
    ereignisse: bus,
    uebersprungen: {},
  };
  return kern;
}
