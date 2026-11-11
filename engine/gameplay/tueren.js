/**
 * @modul    tueren
 * @zweck    Türen und Tore als reine Logik: auf/zu mit weicher Animation, Kollisions-Körper nur solange zu, Schlüssel/Sperre, Selbstschließen, Interaktions-Ziel
 * @api      createTueren({welt,interaktion,ereignisse,dauer,autoZu,maxWinkel}) -> {neu(id,{x,z,y,winkel,breite,dicke,hoehe,offen,angel,schluessel,verbraucht,name,autoZu,daten})->tuer,entferne(id),hole(id),alle(),anzahl,schalte(id,wer?)->{ok,grund,offen},oeffne(id,wer?),schliesse(id,wer?),sperre(id,an?),update(dt)->Anzahl bewegter,zustand(),lade(stand),dispose()}
 * @beispiel
 *   import { createTueren } from '../../engine/gameplay/tueren.js';
 *   const tueren = createTueren({ welt: kollision, interaktion, autoZu: 5 });
 *   const t = tueren.neu('haus', { x: 4, z: 2, winkel: 0, breite: 1.2, angel: 'links', schluessel: 'schluessel' });
 *   // je Bild: tueren.update(dt);  Mesh: pivot.position.set(t.angelPos.x, t.y, t.angelPos.z); pivot.rotation.y = t.winkel + t.drehung;
 * @tags     tuer, tor, oeffnen, schluessel, kollision, interaktion, gameplay
 * @version  1.0.1
 * @status   entwurf
 * @three    nein
 *
 * Winkel wie beim Kasten in world/kollision: Blatt liegt lokal entlang x (Breite), Dicke entlang z; rotation.y = winkel.
 * Blatt-Achse in der Welt = (cos w, -sin w) in (x, z), Normale = (sin w, cos w). angel 'links' = Angel bei Mitte - halbe Breite
 * entlang der Achse, 'rechts' = bei Mitte + halbe Breite. Mesh: Pivot an angelPos, rotation.y = winkel + drehung, das Blatt
 * im Pivot um ∓breite/2 in lokal x versetzt (links: +breite/2, rechts: -breite/2).
 * seite = Vorzeichen von drehung (rotation.y-Änderung); wird beim Öffnen mit `wer` so gewählt, dass das Blatt von der Figur wegschwingt.
 * grund: null | 'unbekannt' | 'verschlossen' | 'blockiert'. Ein Schlüssel-Inventar ist wer.inventar ({hat(id,n), nimm(id,n)}).
 * Ereignisse (ereignisse.sende): 'tuer:auf' / 'tuer:zu' / 'tuer:verschlossen' { tuer, wer }.
 * Interaktions-Ziel 'tuer:<id>' mit Text "<name> öffnen" | "<name> schließen" | "<name> (verschlossen)".
 */

const weich = (a) => a * a * (3 - 2 * a);

export function createTueren({ welt = null, interaktion = null, ereignisse = null, dauer = 0.35, autoZu = 0, maxWinkel = 1.75 } = {}) {
  const tueren = new Map();
  const wartezeit = new Map();   // id -> Sekunden seit vollständig offen

  const koerperId = (id) => 'tuer:' + id;

  function koerperSetzen(t) {
    if (!welt) return;
    welt.entferne(koerperId(t.id));
    if (!t.offen) {
      welt.fuege({ form: 'kasten', x: t.x, z: t.z, bx: t.breite / 2, bz: t.dicke / 2, winkel: t.winkel, y0: t.y, hoehe: t.hoehe,
        id: koerperId(t.id), daten: { art: 'tuer', id: t.id } });
    }
  }

  function textAktualisieren(t) {
    const ziel = interaktion?.hole('tuer:' + t.id);
    if (ziel) ziel.text = t.verschlossen ? `${t.name} (verschlossen)` : t.offen ? `${t.name} schließen` : `${t.name} öffnen`;
  }

  function neu(id, o = {}) {
    if (typeof id !== 'string' || !id) throw new Error(`tueren: ungültige id (${String(id)})`);
    if (tueren.has(id)) throw new Error(`tür '${id}' existiert bereits`);
    const x = +o.x || 0, z = +o.z || 0, winkel = +o.winkel || 0, breite = o.breite ?? 1, hoehe = o.hoehe ?? 2;
    const t = {
      id, name: o.name ?? 'Tür', x, z, y: Number.isFinite(o.y) ? o.y : (welt ? welt.bodenHoehe(x, z) : 0),
      winkel, breite, dicke: o.dicke ?? 0.12, hoehe, angel: o.angel === 'rechts' ? 'rechts' : 'links',
      offen: !!o.offen, anteil: o.offen ? 1 : 0, seite: 1, verschlossen: o.schluessel != null && !o.offen,
      schluessel: o.schluessel ?? null, verbraucht: !!o.verbraucht, autoZu: o.autoZu ?? autoZu, daten: o.daten ?? null,
      get drehung() { return this.seite * maxWinkel * weich(this.anteil); },
      get angelPos() {
        const h = (this.angel === 'links' ? -1 : 1) * this.breite / 2;
        return { x: this.x + Math.cos(this.winkel) * h, z: this.z - Math.sin(this.winkel) * h };
      },
    };
    tueren.set(id, t);
    koerperSetzen(t);
    interaktion?.melde('tuer:' + id, {
      pos: { x, y: t.y + hoehe / 2, z }, radius: breite / 2, art: 'tuer', daten: { id },
      aktion: (wer) => schalte(id, wer),
    });
    textAktualisieren(t);
    return t;
  }

  function entferne(id) {
    const t = tueren.get(id);
    if (!t) return false;
    welt?.entferne(koerperId(id));
    interaktion?.entferne('tuer:' + id);
    wartezeit.delete(id);
    return tueren.delete(id);
  }

  function blockiert(t) {
    if (!welt) return false;
    let da = false;
    welt.imUmkreis(t.x, t.z, t.breite / 2, (d) => {
      if (d && d.art === 'tuer' && d.id === t.id) return false;
      da = true;
      return true;
    });
    return da;
  }

  function oeffne(id, wer) {
    const t = tueren.get(id);
    if (!t) return { ok: false, grund: 'unbekannt', offen: false };
    if (t.offen) return { ok: true, grund: null, offen: true };
    if (t.verschlossen) {
      if (t.schluessel != null && wer?.inventar?.hat?.(t.schluessel, 1)) {
        t.verschlossen = false;
        if (t.verbraucht) wer.inventar.nimm(t.schluessel, 1);
      } else {
        ereignisse?.sende('tuer:verschlossen', { tuer: t, wer: wer ?? null });
        return { ok: false, grund: 'verschlossen', offen: false };
      }
    }
    if (wer && Number.isFinite(wer.x) && Number.isFinite(wer.z)) {
      const nx = Math.sin(t.winkel), nz = Math.cos(t.winkel);
      const s = (wer.x - t.x) * nx + (wer.z - t.z) * nz >= 0 ? 1 : -1;   // Figur auf +Normalen-Seite?
      const weg = -s;                                                    // Blatt schwingt auf die andere Seite
      t.seite = weg * (t.angel === 'links' ? -1 : 1);
    }
    t.offen = true;
    wartezeit.set(id, 0);
    koerperSetzen(t);
    textAktualisieren(t);
    ereignisse?.sende('tuer:auf', { tuer: t, wer: wer ?? null });
    return { ok: true, grund: null, offen: true };
  }

  function schliesse(id, wer) {
    const t = tueren.get(id);
    if (!t) return { ok: false, grund: 'unbekannt', offen: false };
    if (!t.offen) return { ok: true, grund: null, offen: false };
    if (blockiert(t)) return { ok: false, grund: 'blockiert', offen: true };
    t.offen = false;
    wartezeit.delete(id);
    koerperSetzen(t);
    textAktualisieren(t);
    ereignisse?.sende('tuer:zu', { tuer: t, wer: wer ?? null });
    return { ok: true, grund: null, offen: false };
  }

  function schalte(id, wer) {
    const t = tueren.get(id);
    if (!t) return { ok: false, grund: 'unbekannt', offen: false };
    return t.offen ? schliesse(id, wer) : oeffne(id, wer);
  }

  function sperre(id, an = true) {
    const t = tueren.get(id);
    if (!t) return false;
    t.verschlossen = !!an;
    textAktualisieren(t);
    return true;
  }

  function update(dt) {
    let bewegt = 0;
    for (const t of tueren.values()) {
      const ziel = t.offen ? 1 : 0;
      if (t.anteil !== ziel) {
        const schritt = dauer > 0 ? dt / dauer : 1;
        t.anteil = ziel > t.anteil ? Math.min(1, t.anteil + schritt) : Math.max(0, t.anteil - schritt);
        bewegt++;
      }
      if (t.offen && t.anteil >= 1 && t.autoZu > 0) {
        const w = (wartezeit.get(t.id) ?? 0) + dt;
        wartezeit.set(t.id, w);
        if (w >= t.autoZu) {
          if (!schliesse(t.id).ok) wartezeit.set(t.id, t.autoZu - 1);
        }
      }
    }
    return bewegt;
  }

  function zustand() {
    const s = {};
    for (const t of tueren.values()) s[t.id] = { o: t.offen ? 1 : 0, v: t.verschlossen ? 1 : 0, s: t.seite };
    return s;
  }

  function lade(stand = {}) {
    for (const [id, e] of Object.entries(stand || {})) {
      const t = tueren.get(id);
      if (!t || !e) continue;
      t.offen = !!e.o;
      t.verschlossen = !!e.v;
      if (e.s === 1 || e.s === -1) t.seite = e.s;       // offene Tür schwingt nach dem Laden zur selben Seite
      t.anteil = t.offen ? 1 : 0;
      wartezeit.set(id, 0);
      koerperSetzen(t);
      textAktualisieren(t);
    }
  }

  function dispose() {
    for (const id of [...tueren.keys()]) entferne(id);
    wartezeit.clear();
  }

  return {
    neu, entferne, schalte, oeffne, schliesse, sperre, update, zustand, lade, dispose,
    hole: (id) => tueren.get(id),
    alle: () => [...tueren.values()],
    get anzahl() { return tueren.size; },
  };
}
