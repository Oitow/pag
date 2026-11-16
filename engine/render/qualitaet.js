/**
 * @modul    qualitaet
 * @zweck    Automatische Qualitätsstufe nach Bildzeit (Handy-Schutz): wird es langsam, sinken Pixelverhältnis, Schattenkarte, Partikel und Schadens-Zahlen; wird es lange schnell, steigen sie wieder – mit Hysterese, reine Logik (das Spiel wendet die Werte an)
 * @api      createQualitaet({ ziel = 1/50, stufen, schlechtNach = 1.5, besserNach = 4 }) -> { update(dtEcht) -> stufe|null (nur bei Wechsel), stufe, nr, fps, setze(n), fest(bool), stufen, dispose() } ; QUALITAETS_STUFEN
 * @beispiel
 *   import { createQualitaet } from '../../engine/render/qualitaet.js';
 *   const q = createQualitaet({ ziel: 1 / 50 });
 *   const s = q.update(echtDt);                       // jedes Bild; s = neue Stufe oder null
 *   if (s) { renderer.setPixelRatio(Math.min(devicePixelRatio, s.pixel)); sonne.castShadow = s.schatten > 0; fx.anteil = s.partikel; }
 * @tags     qualität, leistung, fps, bildzeit, adaptiv, auflösung, schatten, handy, performance
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Stufe 0 = beste. Jede Stufe: { pixel (max. Pixelverhältnis), schatten (Kartengröße, 0 = aus), partikel (Anteil 0…1), zahlen (max. Schadens-Zahlen) }.
 * Schlechter: geglättete Bildzeit > ziel × 1.15 für `schlechtNach` s. Besser: < ziel × 0.85 für `besserNach` s (verdoppelt sich, wenn eine
 * Verbesserung binnen 20 s wieder zurückgenommen werden musste – verhindert Hin-und-her). Pausen (Bildzeit > 0.5 s) zählen nicht.
 */

export const QUALITAETS_STUFEN = Object.freeze([
  Object.freeze({ pixel: 1.5, schatten: 2048, partikel: 1, zahlen: 32 }),
  Object.freeze({ pixel: 1.25, schatten: 1024, partikel: 0.75, zahlen: 20 }),
  Object.freeze({ pixel: 1, schatten: 512, partikel: 0.5, zahlen: 12 }),
  Object.freeze({ pixel: 0.8, schatten: 0, partikel: 0.3, zahlen: 6 }),
]);

export function createQualitaet({ ziel = 1 / 50, stufen = QUALITAETS_STUFEN, schlechtNach = 1.5, besserNach = 4, start = 0 } = {}) {
  if (!Array.isArray(stufen) || !stufen.length) throw new Error('createQualitaet: stufen fehlt');
  let nr = Math.min(stufen.length - 1, Math.max(0, start | 0)), glatt = ziel, schlecht = 0, gut = 0, fester = false, uhr = 0;
  let letzteBesserung = -Infinity, besserWarte = besserNach;
  const mitNr = stufen.map((s, i) => ({ ...s, nr: i }));

  function wechsle(n) {
    n = Math.min(stufen.length - 1, Math.max(0, n | 0));
    if (n === nr) return null;
    nr = n; schlecht = gut = 0; glatt = ziel;   // nach dem Wechsel neu einpendeln
    return mitNr[nr];
  }

  return {
    stufen: mitNr,
    get stufe() { return mitNr[nr]; },
    get nr() { return nr; },
    /** Geglättete Bilder pro Sekunde. */
    get fps() { return glatt > 0 ? 1 / glatt : 0; },
    /** Feste Stufe erzwingen (schaltet die Automatik aus); gibt die neue Stufe bei Wechsel zurück. */
    setze(n) { fester = true; return wechsle(n); },
    /** true = Automatik pausiert (aktuelle Stufe bleibt), false = Automatik an. */
    fest(an) { fester = !!an; schlecht = gut = 0; },
    /** dtEcht = echte Bildzeit in s (ohne Zeitlupe). Gibt bei Wechsel die neue Stufe zurück, sonst null. */
    update(dtEcht) {
      if (!(dtEcht > 0) || dtEcht > 0.5) return null;          // Pause/Tab-Wechsel nicht werten
      uhr += dtEcht;
      glatt += (dtEcht - glatt) * Math.min(1, dtEcht * 3);
      if (fester) return null;
      if (glatt > ziel * 1.15) { schlecht += dtEcht; gut = 0; } else if (glatt < ziel * 0.85) { gut += dtEcht; schlecht = 0; } else { schlecht = gut = 0; }
      if (schlecht >= schlechtNach && nr < stufen.length - 1) {
        if (uhr - letzteBesserung < 20) besserWarte = Math.min(besserNach * 8, besserWarte * 2);   // gerade erst besser gemacht → länger warten
        return wechsle(nr + 1);
      }
      if (schlecht >= schlechtNach) schlecht = 0;
      if (gut >= besserWarte && nr > 0) { letzteBesserung = uhr; return wechsle(nr - 1); }
      return null;
    },
    dispose() { fester = true; },
  };
}
