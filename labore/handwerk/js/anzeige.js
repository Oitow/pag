// Testwelt – Anzeige für „Dinge & Handeln“. Nur Verdrahtung der Engine-Oberfläche:
//   ui/hud (Hinweis „E – …“ mit Fortschritt, Kurzmeldungen) · ui/inventar-ansicht (Schnellleiste, Truhe, Rucksack)
//   ui/menue als Fenster (🔨 Herstellen – an der Werkbank gibt es mehr Rezepte; Truhe: antippen = umlagern)
import { createHud } from '../../../engine/ui/hud.js';
import { createInventarAnsicht } from '../../../engine/ui/inventar-ansicht.js';
import { createMenue } from '../../../engine/ui/menue.js';

/**
 * opts: { inventar, register, hand, rezepte, ereignisse, wer, lager ({ behaelter, stationen } | null), onWurf(platz) }
 * Liefert { hud, fenster, hinweis(text, anteil), update(dt), dispose() }.
 */
export function createAnzeige({ inventar, register, hand, rezepte, ereignisse, wer, lager = null, onWurf = () => {} }) {
  // auf dem Handy über den Touch-Knöpfen (💬 🎯) bleiben, sonst knapp über der Info-Zeile
  const hud = createHud({ unten: globalThis.matchMedia?.('(pointer: coarse)').matches ? 186 : 124 });
  const name = (id) => { const g = register.hole(id); return `${g?.zeichen ?? ''} ${g?.name ?? id}`.trim(); };

  // ---- Schnellleiste: antippen = in die Hand, nochmal antippen = ablegen ----
  const leiste = createInventarAnsicht({
    inventar, register, eltern: hud.bereich('leiste'), breite: 'calc(94vw - 50px)', gewaehlt: () => hand.platz,
    onTipp: (platz, inhalt) => { if (hand.platz === platz && inhalt) onWurf(platz); else hand.waehle(platz); },
  });
  for (const f of leiste.felder) f.title = 'Antippen = in die Hand, nochmal antippen = ablegen';
  const bauKnopf = document.createElement('button');
  bauKnopf.style.cssText = 'width:min(44px,calc((94vw - 50px) / 9));aspect-ratio:1;min-width:0;min-height:0;padding:0;margin:0;border-radius:8px;background:rgba(18,22,28,.82);border:1px solid rgba(255,255,255,.14);font-size:18px;line-height:1;cursor:pointer';
  bauKnopf.textContent = '🔨'; bauKnopf.title = 'Herstellen';
  hud.bereich('leiste').append(bauKnopf);

  // ---- Fenster: Herstellen und Truhe (pausiert das Spiel nicht) ----
  const fenster = createMenue({ taste: null, onZu: () => lager?.behaelter.schliesse(wer) });
  const stationenNah = () => lager?.stationen.beiWem(wer) ?? [];
  fenster.seite('bauen', {
    titel: 'Herstellen',
    eintraege: () => {
      const stationen = stationenNah();
      const zeilen = rezepte.alle().map((rz) => {
        const p = rezepte.pruefe(rz.id, inventar, { stationen });
        const zutaten = Object.entries(rz.zutaten).map(([id, n]) => `${n}× ${name(id)}`).join(' · ');
        return { text: name(rz.ergebnis.id), hinweis: zutaten + (p.grund === 'station' ? ' · nur an der Werkbank' : ''), aktiv: p.ok,
          aktion: () => { rezepte.stelleHer(rz.id, inventar, { stationen: stationenNah(), wer }); } };   // frisch prüfen: Fenster pausiert nicht
      });
      return [{ art: 'text', text: stationen.includes('werkbank') ? 'An der Werkbank – alle Rezepte.' : 'Von Hand. An der Werkbank beim Schuppen geht mehr.' }, ...zeilen];
    },
  });
  bauKnopf.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); fenster.schalte('bauen'); });
  const abBenutzt = ereignisse.an('station:benutzt', () => fenster.zeige('bauen'));

  let truhenSicht = null;
  const rucksack = createInventarAnsicht({ inventar, register, spalten: 4, breite: 'min(80vw, 330px)', titel: 'Rucksack – antippen = in die Truhe',
    onTipp: (platz, inhalt) => { if (inhalt) lager?.behaelter.lege(wer, platz); } });
  fenster.seite('truhe', {
    titel: 'Truhe',
    eintraege: () => [
      ...(truhenSicht ? [{ art: 'element', element: truhenSicht.element }] : []),
      { text: 'Alles nehmen', zeichen: '⤵', aktion: () => { lager.behaelter.nimmAlles(wer); } },
      { art: 'trenner' },
      { art: 'element', element: rucksack.element },
    ],
  });
  const abHoerer = [
    abBenutzt,
    ereignisse.an('behaelter:offen', ({ behaelter }) => {
      truhenSicht?.dispose();
      truhenSicht = createInventarAnsicht({ inventar: behaelter.inventar, register, spalten: 4, breite: 'min(80vw, 330px)', titel: behaelter.name + ' – antippen = nehmen',
        onTipp: (platz, inhalt) => { if (inhalt) lager.behaelter.nimm(wer, platz); } });
      fenster.zeige('truhe');
    }),
    ereignisse.an('behaelter:zu', () => { if (fenster.aktuell === 'truhe') fenster.schliesse(); truhenSicht?.dispose(); truhenSicht = null; }),
    // ---- Kurzmeldungen ----
    ereignisse.an('ding:aufgehoben', (e) => { if (e.anzahl > 0) hud.melde(`+{n} ${name(e.id)}`, { schluessel: 'auf:' + e.id, anzahl: e.anzahl }); }),
    ereignisse.an('hergestellt', (e) => hud.melde(`${name(e.id)} hergestellt`, { art: 'gut' })),
    ereignisse.an('werkzeug:kaputt', (e) => hud.melde(`${name(e.id)} ist zerbrochen`, { art: 'warnung' })),
    ereignisse.an('tuer:verschlossen', () => hud.melde('Verschlossen', { art: 'warnung' })),
    ereignisse.an('behaelter:verschlossen', () => hud.melde('Verschlossen', { art: 'warnung' })),
  ];

  return {
    hud, fenster,
    hinweis: (text, anteil = null) => hud.hinweis(text, anteil),
    update(dt) { hud.update(dt); leiste.update(dt); },
    dispose() {
      for (const ab of abHoerer) ab();
      truhenSicht?.dispose(); rucksack.dispose(); leiste.dispose(); fenster.dispose(); hud.dispose();
    },
  };
}
