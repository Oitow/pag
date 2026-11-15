/**
 * @modul    faehigkeiten
 * @zweck    Klassische MMO-Fähigkeitsleiste ohne THREE: globale Abklingzeit (GCD), Ressourcen (Mana, Wut, Energie), Wirkzeit mit Abbruch bei Bewegung und Pushback, Kanalisieren mit Takten, Ladungen, Reichweite/Ziel-Prüfung, Sperren
 * @api      createLeiste(opts) -> { nutze(name,{ziel,abstand,bewegt,sperren}) -> {ok,grund}, kann(name,kontext) -> {ok,grund,def}, update(dt,{bewegt,getroffen,sperren}) -> ereignisse[], gib(ressource,menge), ressource(name) -> {wert,max}, wirkt -> {name,anteil}|null, gcdAnteil, abkling(name), ladungen(name), unterbrich(), zustand(), laden(z), dispose() } ; FAEHIGKEITEN ; FAEHIGKEITEN_NAMEN
 * @beispiel
 *   import { createLeiste } from '../../engine/gameplay/faehigkeiten.js';
 *   const leiste = createLeiste();
 *   const r = leiste.nutze('feuerball', { ziel: { id: 'g1', feind: true }, abstand: 12 });   // r = { ok, grund }
 *   for (const e of leiste.update(dt, { bewegt, getroffen, sperren: zustaende.faktoren() }))
 *     if (e.typ === 'fertig' || e.typ === 'kanalTakt') wende(e.def.wirkung, e.ziel);         // Spiel ruft kampf.schade/heile/…
 * @tags     kampf, fähigkeit, gcd, mmo, abklingzeit, ressource, wirkzeit, kanal, ladungen, reichweite, leiste
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Ereignisse: { typ:'wirkStart'|'fertig'|'kanalTakt'|'unterbrochen', name, def, ziel, grund? } (fertig auch bei Sofort-Fähigkeiten).
 * Kosten werden beim Start bezahlt und bei Unterbrechung erstattet. Ziel = { id, feind?: bool } (feind:false = Verbündeter).
 * sperren = { kannHandeln, kannZaubern } (false = gesperrt; wie zustaende.faktoren()). Zauber-Fähigkeiten: wirkung.typ 'zauber' oder ressource 'mana'.
 * Wirkzeit/Kanal bricht bei Bewegung ab (außer beiBewegung:'erlaubt'). Treffer in der Wirkzeit: +0.2 s, höchstens 2x.
 */
import { clamp } from '../core/math.js';
import { FAEHIGKEITEN, FAEHIGKEITEN_NAMEN } from './faehigkeiten-daten.js';

export { FAEHIGKEITEN, FAEHIGKEITEN_NAMEN };

const PUSHBACK = 0.2, PUSHBACK_MAX = 2;
const RESSOURCEN = { mana: { max: 100, regen: 5 }, wut: { max: 100, regen: -2, start: 0 }, energie: { max: 100, regen: 10 } };

export function createLeiste(opts = {}) {
  const defs = opts.faehigkeiten || FAEHIGKEITEN;
  const gcdDauer = opts.gcd ?? 1.2;
  const res = {};
  for (const [n, r] of Object.entries(opts.ressourcen || RESSOURCEN)) res[n] = { max: r.max ?? 100, regen: r.regen ?? 0, wert: clamp(r.start ?? r.max ?? 100, 0, r.max ?? 100) };
  const lad = {};   // name -> { n, rest }
  for (const [n, d] of Object.entries(defs)) lad[n] = { n: d.ladungen ?? 1, rest: 0 };
  let gcdRest = 0, sperren = {}, wirk = null, queue = [];

  const ev = (typ, w, extra) => ({ typ, name: w.name, def: defs[w.name], ziel: w.ziel, ...extra });
  const istZauber = (d) => d.wirkung?.typ === 'zauber' || d.ressource === 'mana';
  const kosten = (d) => d.kosten || 0;

  function kann(name, k = {}) {
    const d = defs[name];
    if (!d) return { ok: false, grund: 'unbekannt' };
    const sp = k.sperren || sperren;
    const nein = (grund) => ({ ok: false, grund, def: d });
    if (sp.kannHandeln === false || (istZauber(d) && sp.kannZaubern === false)) return nein('gesperrt');
    if (wirk && !(d.gcd === false && !d.wirkzeit && !d.kanal)) return nein('wirkt');
    const art = d.zielArt || 'feind';
    if (art !== 'selbst') {
      const z = k.ziel;
      if (art === 'feind' && (!z || z.feind === false)) return nein('ziel');
      if (art === 'freund' && z && z.feind === true) return nein('ziel');   // ohne Ziel: Selbstwirkung
      if (d.reichweite && z && k.abstand != null && k.abstand > d.reichweite) return nein('reichweite');
    }
    if (lad[name].n < 1) return nein('abklingzeit');
    if (d.gcd !== false && gcdRest > 0) return nein('gcd');
    if (kosten(d) > 0 && (res[d.ressource]?.wert ?? 0) < kosten(d)) return nein('ressource');
    return { ok: true, grund: null, def: d };
  }

  function starteAbkling(name) {
    const d = defs[name], l = lad[name], max = d.ladungen ?? 1;
    l.n -= 1;
    if (l.rest <= 0 && l.n < max) l.rest = d.abkling || 0;
    if (!(d.abkling > 0)) l.n = max;
  }

  function nutze(name, k = {}) {
    const r = kann(name, k);
    if (!r.ok) return { ok: false, grund: r.grund };
    const d = r.def;
    if (kosten(d) > 0) res[d.ressource].wert -= kosten(d);
    if (d.gcd !== false) gcdRest = gcdDauer;
    starteAbkling(name);
    const art = d.zielArt || 'feind';
    const ziel = art === 'selbst' || !k.ziel ? null : k.ziel;
    const w = { name, ziel, phase: 'wirkzeit', t: 0, dauer: d.wirkzeit || 0, pushs: 0, takte: 0 };
    if (w.dauer > 0) { wirk = w; queue.push(ev('wirkStart', w)); }
    else if (d.kanal > 0) { wirk = w; w.phase = 'kanal'; w.dauer = d.kanal; queue.push(ev('wirkStart', w)); }
    else queue.push(ev('fertig', w));
    return { ok: true, grund: null };
  }

  function brich(grund) {
    if (!wirk) return false;
    const d = defs[wirk.name];
    if (kosten(d) > 0) res[d.ressource].wert = Math.min(res[d.ressource].max, res[d.ressource].wert + kosten(d));
    const l = lad[wirk.name]; l.n = Math.min(d.ladungen ?? 1, l.n + 1); if (l.n >= (d.ladungen ?? 1)) l.rest = 0;
    queue.push(ev('unterbrochen', wirk, { grund }));
    wirk = null;
    return true;
  }

  function update(dt, s = {}) {
    if (s.sperren) sperren = s.sperren;
    const out = queue; queue = [];
    gcdRest = Math.max(0, gcdRest - dt);
    for (const [n, r] of Object.entries(res)) r.wert = clamp(r.wert + r.regen * dt, 0, r.max);
    for (const [n, l] of Object.entries(lad)) {
      const d = defs[n], max = d.ladungen ?? 1;
      if (l.n >= max) { l.rest = 0; continue; }
      l.rest -= dt;
      while (l.rest <= 0 && l.n < max) { l.n++; l.rest = l.n < max ? l.rest + d.abkling : 0; }
    }
    if (wirk) {
      const d = defs[wirk.name];
      if (sperren.kannHandeln === false || (istZauber(d) && sperren.kannZaubern === false)) brich('gesperrt');
      else if (s.bewegt && d.beiBewegung !== 'erlaubt') brich('bewegt');
      else {
        if (s.getroffen && wirk.phase === 'wirkzeit' && wirk.pushs < PUSHBACK_MAX) { wirk.pushs++; wirk.dauer += PUSHBACK; }
        wirk.t += dt;
        if (wirk.phase === 'wirkzeit' && wirk.t >= wirk.dauer) {
          if (d.kanal > 0) { wirk.phase = 'kanal'; wirk.t -= wirk.dauer; wirk.dauer = d.kanal; wirk.takte = 0; }
          else { out.push(ev('fertig', wirk)); wirk = null; }
        }
        if (wirk && wirk.phase === 'kanal') {
          const n = d.takte || Math.max(1, Math.floor(d.kanal));
          const faellig = Math.min(n, Math.floor((wirk.t / wirk.dauer) * n + 1e-9));
          while (wirk.takte < faellig) { wirk.takte++; out.push(ev('kanalTakt', wirk, { takt: wirk.takte })); }
          if (wirk.t >= wirk.dauer) { out.push(ev('fertig', wirk)); wirk = null; }
        }
      }
    }
    for (const e of queue) out.push(e);   // durch brich() neu entstandene
    queue = [];
    return out;
  }

  return {
    nutze, kann, update,
    gib(name, menge) { const r = res[name]; if (r) r.wert = clamp(r.wert + menge, 0, r.max); },
    ressource: (name) => (res[name] ? { wert: res[name].wert, max: res[name].max } : null),
    get wirkt() { return wirk ? { name: wirk.name, anteil: clamp(wirk.t / (wirk.dauer || 1), 0, 1), phase: wirk.phase } : null; },
    get gcdAnteil() { return gcdDauer > 0 ? clamp(gcdRest / gcdDauer, 0, 1) : 0; },
    abkling: (name) => (lad[name] && lad[name].n < 1 ? Math.max(0, lad[name].rest) : 0),
    ladungen: (name) => lad[name]?.n ?? 0,
    unterbrich() { return brich('unterbrochen'); },
    zustand() {
      return { gcdRest, res: Object.fromEntries(Object.entries(res).map(([n, r]) => [n, r.wert])),
        lad: Object.fromEntries(Object.entries(lad).map(([n, l]) => [n, { n: l.n, rest: l.rest }])),
        wirk: wirk ? { ...wirk, ziel: wirk.ziel ? { ...wirk.ziel } : null } : null };
    },
    laden(z) {
      gcdRest = z.gcdRest || 0;
      for (const [n, v] of Object.entries(z.res || {})) if (res[n]) res[n].wert = clamp(v, 0, res[n].max);
      for (const [n, l] of Object.entries(z.lad || {})) if (lad[n]) lad[n] = { n: l.n, rest: l.rest };
      wirk = z.wirk && defs[z.wirk.name] ? { ...z.wirk } : null;
      queue = [];
    },
    dispose() { wirk = null; queue = []; },
  };
}
