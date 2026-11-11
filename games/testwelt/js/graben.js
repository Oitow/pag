// Testwelt – Graben und Aufschütten: Schaufel in der Hand = Loch graben (gibt Erde), Erde in der Hand = aufschütten.
// Nur Verdrahtung: world/welt-aenderung (Gelände ändern, nur Unterschiede speichern) · gameplay/interaktion (E halten) · gameplay/hand
const RADIUS = 3, TIEFE = 0.5, VOR = 1.6;                    // Pinsel in Metern (Gelände-Raster: 2 m), Abstand vor der Figur
const KLEIN = new Set(['bodendecker', 'blume', 'unterholz', 'busch', 'schilf', 'totholz', 'geroell']);   // wird mit ausgegraben

/**
 * opts: { aend (welt-aenderung), interaktion, hand, inventar, dinge (welt-dinge), welt (bodenHoehe), melde(text, opts) }
 * Liefert { update(wer) -> Hinweistext ('' oder „hier geht das nicht“), dispose() } – update je Bild nach hand/inventar, vor interaktion.halte().
 */
export function createGraben({ aend, interaktion, hand, inventar, dinge, welt, melde = () => {} }) {
  const punkt = { x: 0, y: 0, z: 0 };
  let art = null;   // 'graben' | 'schuetten' | null – was gerade als Ziel gemeldet ist

  function aktion(wer) {
    if (art === 'graben') {
      aend.beginne();                                         // Loch + ausgegrabene Pflänzchen = ein Rückgängig-Schritt
      const ber = aend.pinsel('senken', punkt.x, punkt.z, { radius: RADIUS, staerke: TIEFE });
      if (ber) for (const i of aend.objekteImUmkreis(punkt.x, punkt.z, RADIUS * 0.6, (k, typ, a) => KLEIN.has(a))) aend.entferneObjekt(i);
      aend.beende();
      if (!ber) return melde('Tiefer geht es hier nicht', { art: 'warnung' });
      dinge.wirf('erde', 1, { x: punkt.x, y: welt.bodenHoehe(punkt.x, punkt.z) + 0.3, z: punkt.z }, wer.yaw + Math.PI, { tempo: 1.5, hoch: 3, streuung: 1 });
      hand.nutzeAb(1);
    } else if (art === 'schuetten') {
      if (hand.gegenstand()?.id !== 'erde') return;
      const ber = aend.pinsel('heben', punkt.x, punkt.z, { radius: RADIUS, staerke: TIEFE });
      if (!ber) return melde('Höher geht es hier nicht', { art: 'warnung' });
      inventar.nimmVon(hand.platz, 1);
    }
  }

  return {
    /** Ziel „Graben“/„Aufschütten“ vor der Figur nachführen (oder abmelden, wenn nichts Passendes in der Hand ist). */
    update(wer) {
      const neu = hand.hatTag('schaufel') ? 'graben' : hand.gegenstand()?.id === 'erde' ? 'schuetten' : null;
      punkt.x = wer.x + Math.sin(wer.yaw) * VOR; punkt.z = wer.z + Math.cos(wer.yaw) * VOR; punkt.y = wer.y;
      const geht = neu && aend.kannAendern(punkt.x, punkt.z);
      if (!geht) { if (art) { interaktion.entferne('graben'); art = null; } return neu ? 'Hier geht das nicht (Weg, Wasser oder Schuppen)' : ''; }
      if (neu === art) return '';
      art = neu;
      interaktion.entferne('graben');
      interaktion.melde('graben', { pos: () => punkt, radius: 0.3, reichweite: VOR + 0.5, art: 'graben', prio: -1.5,
        text: art === 'graben' ? 'Graben' : 'Aufschütten', dauer: art === 'graben' ? 0.7 : 0.4, aktion });
      return '';
    },
    dispose() { interaktion.entferne('graben'); },
  };
}
