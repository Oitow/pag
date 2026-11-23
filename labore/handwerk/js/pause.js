// Testwelt – Pause-Menü (☰ / Esc): Weiter, Spielstände (3 Plätze), Optionen, Gelände zurücknehmen. Nur Verdrahtung von engine/ui/menue.
import { createMenue, spielstandEintraege } from '../../../engine/ui/menue.js';

const ZEIT = [{ wert: 1, text: 'normal' }, { wert: 5, text: '5× schnell' }, { wert: 20, text: '20× schnell' }, { wert: 0, text: 'angehalten' }];

/**
 * opts: { speicher, holeStand () -> Daten, ladeStand (daten), aend () -> welt-aenderung, uhr, renderer, szene, psx (engine/render/psx), anpassen (pixelRatio) (Größe neu setzen), onPause (bool) }
 * Liefert das Menü ({ schalte(), offen, dispose() … }). Optionen landen im Speicher-Platz 'optionen'.
 */
export function createPause({ speicher, holeStand, ladeStand, aend, uhr, renderer, szene, psx, anpassen, onPause = () => {} }) {
  const opt = { pixel: Math.min(globalThis.devicePixelRatio || 1, 2), schatten: true, psx: true, psxZeilen: 300, psxWackeln: true, ...(speicher.lade('optionen') || {}) };
  function wendeAn() {
    psx.setze({ an: opt.psx, zeilen: opt.psxZeilen, raster: opt.psxWackeln ? 240 : 0 });
    if (renderer.shadowMap.enabled !== opt.schatten) {
      renderer.shadowMap.enabled = opt.schatten;
      szene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
    }
    anpassen(opt.pixel);
  }
  const setze = (name, wert) => { opt[name] = wert; wendeAn(); speicher.speichere('optionen', opt); };
  wendeAn();

  const menue = createMenue({ onAuf: () => onPause(true), onZu: () => onPause(false) });
  menue.seite('start', { titel: 'Pause', eintraege: () => [
    { text: 'Weiter', zeichen: '▶', schliesst: true },
    { text: 'Spielstände', zeichen: '💾', nach: 'staende' },
    { text: 'Optionen', zeichen: '⚙', nach: 'optionen' },
    { art: 'trenner' },
    { text: 'Letzte Gelände-Änderung zurücknehmen', zeichen: '↩', aktiv: () => aend().kannRueckgaengig, aktion: () => { aend().rueckgaengig(); } },
    { text: 'Gelände zurücksetzen', zeichen: '🌱', hinweis: 'alle Löcher und Hügel weg', aktiv: () => aend().zustand().i.length > 0, aktion: () => { aend().zuruecksetzen(); } },
    { art: 'text', text: 'Laufen: WASD / Stick · Springen: Leertaste · Benutzen: E / 💬 · Leiste antippen = in die Hand, nochmal = ablegen · Schaufel in der Hand: graben, Erde: aufschütten' },
  ] });
  menue.seite('optionen', { titel: 'Optionen', zurueck: 'start', eintraege: [
    { art: 'schalter', text: 'PS1-Look', wert: () => opt.psx, setze: (v) => setze('psx', v) },
    { art: 'regler', text: 'PS1: Pixel-Zeilen', min: 180, max: 480, schritt: 20, wert: () => opt.psxZeilen, setze: (v) => setze('psxZeilen', v), format: (v) => v + ' Zeilen' },
    { art: 'schalter', text: 'PS1: Wackeln', wert: () => opt.psxWackeln, setze: (v) => setze('psxWackeln', v) },
    { art: 'regler', text: 'Auflösung (ohne PS1)', min: 0.5, max: Math.max(1, Math.min(globalThis.devicePixelRatio || 1, 2)), schritt: 0.25, wert: () => opt.pixel, setze: (v) => setze('pixel', v), format: (v) => Math.round(v * 100) + ' %' },
    { art: 'schalter', text: 'Schatten', wert: () => opt.schatten, setze: (v) => setze('schatten', v) },
    { art: 'auswahl', text: 'Zeit', optionen: ZEIT, wert: () => (ZEIT.some((z) => z.wert === uhr.tempo) ? uhr.tempo : 1), setze: (v) => { uhr.tempo = v; } },
  ] });
  menue.seite('staende', { titel: 'Spielstände', zurueck: 'start', eintraege: spielstandEintraege(speicher, {
    slots: ['platz1', 'platz2', 'platz3'], namen: (s) => 'Platz ' + s.slice(-1), holeDaten: holeStand, onLade: ladeStand,
    beschreibe: (d) => `${String(d?.welt ?? '?').split('|').slice(0, 2).join(' #')} · Tag ${d?.uhr?.tag ?? '?'}`,
  }) });
  return menue;
}
