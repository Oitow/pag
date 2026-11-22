// Testwelt – Dorfbewohner: leben nach Tagesplan um ihr Dorf (gameplay/character-brain: wandern, arbeiten, plaudern), tragen Namensschilder (ui/figur-schild),
// schauen den Spieler an, wenn er nahe kommt, und reden, wenn man sie anspricht. Nur NPCs in der Nähe werden gerechnet.
import { createCharacter } from '../../../engine/gameplay/character.js';
import { randomLook } from '../../../engine/models/character/character-look.js';
import { rng, hashSeed, pick, range, int } from '../../../engine/core/rng.js';

const NAMEN = ['Jupp', 'Hilde', 'Korbinian', 'Gerda', 'Anton', 'Liesel', 'Hannes', 'Frieda', 'Ottokar', 'Resi', 'Bertram', 'Wilma', 'Sepp', 'Mia', 'Konrad', 'Trude'];
const SAETZE = [
  'Moin!', 'Schönes Wetter heute.', 'Hast du den Gipfel schon gesehen?', 'Pass auf am Wasser!', 'Ich such meine Ziege …',
  'Im Wald gibt es Pilze.', 'Na, auch unterwegs?', 'Hier ist es ruhig.', 'Grüß dich!', 'Weiter oben wird es kalt.',
];
const GESTEN = ['winken', 'nicken', 'zeigen', 'kratzen', 'umschauen'];
const AKTIV_RADIUS = 90, BLICK_RADIUS = 6;

/** opts: { szene, adapter, welt (worldgen), schilder, spieler: () => figur, seed } → { bewohner [{figur, ansprechen}], update(dt, stunde), dispose() } */
export function createDorf({ szene, adapter, welt, schilder, spieler, seed = 1 }) {
  const r = rng(hashSeed('dorf', seed));
  const bewohner = [];
  const orte = [welt.orte.start, ...(welt.orte.doerfer || []).slice(0, 4)].filter(Boolean);
  let nr = 0;
  for (const [i, ort] of orte.entries()) {
    const mitte = adapter.zuWelt(ort.x, ort.y);
    const anzahl = i === 0 ? 3 : int(r, 2, 4);
    for (let k = 0; k < anzahl; k++) {
      // Platz an Land suchen
      let x = mitte.x, z = mitte.z;
      for (let v = 0; v < 12; v++) {
        x = mitte.x + range(r, -9, 9); z = mitte.z + range(r, -9, 9);
        const w = adapter.wasserHoehe(x, z);
        if ((w == null || w < adapter.bodenHoehe(x, z)) && !adapter.hindernisse(x, z, 0.5)) break;
      }
      const s = hashSeed('bewohner', seed, nr++);
      const name = pick(r, NAMEN);
      const figur = createCharacter({
        look: randomLook(s, { kind: r() < 0.2 }), seed: s, welt: adapter, name, schilder,
        pos: { x, y: adapter.bodenHoehe(x, z), z }, yaw: range(r, -Math.PI, Math.PI),
        brain: {
          heimat: { x: mitte.x, z: mitte.z },
          grund: { zustand: 'wandern', radius: 10 },
          // Tagesablauf (Stunde aus dem Spiel): vormittags arbeiten, sonst wandern/plaudern
          plan: r() < 0.5 ? [{ von: 8, bis: 12, zustand: 'arbeiten', ort: { x: x + range(r, -3, 3), z: z + range(r, -3, 3) }, clip: pick(r, ['hacken', 'fegen', 'graben', 'haemmern']) }] : null,
          verhalten: { plauderChance: 0.04, idleClips: ['umschauen', 'kratzen', 'strecken'] },
        },
      });
      szene.add(figur.root);
      const b = {
        figur, schaut: false,
        ansprechen(wer) {
          figur.blickZu(wer);
          figur.sage(pick(r, SAETZE), { geste: pick(r, GESTEN), ausdruck: 'froh' });
          figur.brain?.setze?.('plaudern', { partner: () => wer.zustand.pos, dauer: 4 });   // kurz stehen bleiben
        },
      };
      bewohner.push(b);
    }
  }
  const nachbarn = [], brains = [];
  const kontext = { nachbarn, npcs: brains, stunde: 10, ziele: [] };

  return {
    get bewohner() { return bewohner; },
    update(dt, stunde = 10) {
      const sp = spieler()?.zustand?.pos;
      kontext.stunde = stunde;
      brains.length = 0;
      for (const b of bewohner) if (b.figur.brain) brains.push(b.figur.brain);
      for (const b of bewohner) {
        const p = b.figur.zustand.pos;
        const d = sp ? Math.hypot(p.x - sp.x, p.z - sp.z) : 0;
        b.figur.root.visible = d < AKTIV_RADIUS * 1.5;
        if (d > AKTIV_RADIUS) continue;        // weit weg: einfrieren
        // Spieler nah → hinschauen (und einmal grüßen)
        const nah = d < BLICK_RADIUS;
        if (nah !== b.schaut) {
          b.schaut = nah;
          b.figur.blickZu(nah ? spieler() : null);
          if (nah && r() < 0.5) b.figur.sage(pick(r, ['Hallo!', 'Moin!', 'Na?']), { dauer: 1.6 });
        }
        // Nachbarn zum Ausweichen: Spieler + andere Bewohner in der Nähe
        nachbarn.length = 0;
        if (sp) nachbarn.push({ x: sp.x, z: sp.z, radius: 0.3 });
        for (const o of bewohner) {
          const q = o.figur.zustand.pos;
          if (o !== b && Math.abs(q.x - p.x) < 4 && Math.abs(q.z - p.z) < 4) nachbarn.push({ x: q.x, z: q.z, radius: 0.3 });
        }
        b.figur.update(dt, null, kontext);     // null = das Brain entscheidet
      }
    },
    dispose() {
      for (const b of bewohner) b.figur.dispose();
      bewohner.length = 0;
    },
  };
}
