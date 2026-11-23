/**
 * @modul    figur-kleidung
 * @zweck    Kleidung der organischen Figur als SDF-Körper über der Anatomie: Oberteil mit Ärmeln, Hose/Rock/Robe, Gürtel + Tasche, Schuhe – je Stil aus character-look
 * @api      baueKleidungForm(form, ctx) -> form
 * @beispiel
 *   import { baueKleidungForm } from './figur-kleidung.js';
 *   baueKleidungForm(form, formKontext(look, masse, rig));   // ruft figur-haut nach baueKoerperForm auf
 * @tags     figur, charakter, organisch, sdf, kleidung, oberteil, hose, rock, robe, gürtel, schuhe
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Aufteilung: figur-kleidung-oben (Rumpf, Kragen, Ärmel, Rüstung), figur-kleidung-unten (Hose, Rock, Schürze, Gürtel, Schuhe),
 * figur-kleidung-basis (Haut vermessen, Gewichte, Glocke mit Saum). Stoff liegt ≈ 9 mm über der GEMESSENEN Haut
 * (Strahlen ins Abstandsfeld der fertigen Anatomie) – passt so zu jedem Körperbau.
 * Reihenfolge: Hose/Rock vor dem Oberteil, damit Kittelsäume und Gürtel darüber liegen; Schuhe zuletzt.
 * Nicht hier (bleiben starre Teile): Kopfbedeckung, Umhang, Rucksack, Schal/Halsschmuck, Brille, Ohrringe, Augen.
 */
import { baueOberteil, baueAermel } from './figur-kleidung-oben.js';
import { baueUnterteil, baueGuertel, baueSchuhe } from './figur-kleidung-unten.js';
import { messeHaut } from './figur-kleidung-basis.js';

export function baueKleidungForm(form, ctx) {
  const haut = messeHaut(form, ctx);                // Anatomie vermessen, bevor der erste Stoff dazukommt
  baueUnterteil(form, ctx, haut);
  baueOberteil(form, ctx, haut);
  baueAermel(form, ctx, haut);
  baueGuertel(form, ctx, haut);
  baueSchuhe(form, ctx, haut);
  return form;
}
