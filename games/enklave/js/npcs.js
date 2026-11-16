// Enklave – NPCs: Mentorin Alwine (folgt dir), Späher Bo, Torwachen, Händler, Schmied, Wirt, Priesterin, Bürger. Tagesablauf über gameplay/character-brain,
// Namensschilder + Sprechblasen über ui/figur-schild. Budget fürs Handy: nur die 6 nächsten NPCs (< 45 m) werden gerechnet und gezeichnet, der Rest ist aus.
import { createCharacter } from '../../../engine/gameplay/character.js';
import { createLook, randomLook, VORLAGEN } from '../../../engine/models/character/character-look.js';
import { rng, hashSeed, pick } from '../../../engine/core/rng.js';
import { TAL } from './tutorial-daten.js';

const MAX_SICHTBAR = 4, SICHT = 45, BLICK = 6;
const SAETZE = {
  mentor: ['Na, wie läuft es?', 'Bleib dicht bei mir, dann passiert nichts.'],
  bo: ['Ratten, überall Ratten …', 'Schön, dass du hier bist!'],
  wache: ['Halt die Augen offen, Fremder.', 'Willkommen in der Enklave!', 'Hier ist alles ruhig.'],
  haendler: ['Frische Ware! Nur heute!', 'Schau dich ruhig um.', 'Brot, Äpfel, Kräuter – alles da!'],
  schmied: ['Gutes Eisen braucht Geduld.', 'Der Amboss wartet auf dich – später.'],
  wirt: ['Ein Krug für den Reisenden?', 'Die Taverne ist abends voll.'],
  priesterin: ['Das Licht schütze dich.', 'Der Kristall wacht über die Enklave.'],
  buerger: ['Schönes Wetter heute.', 'Hast du schon den Markt gesehen?', 'Grüß dich!'],
};

/** opts: { szene, w (baueWelt), kollision, schilder, interaktion, spieler: () => figur, onAnsprechen(npc) -> [text] | null, seed } */
export function createNpcs({ szene, w, kollision, schilder, interaktion, spieler, onAnsprechen = () => null, seed = 1 }) {
  const { plan } = w, r = rng(hashSeed('npcs', seed));
  const npcs = [], welt = kollision;
  const boden = (x, z) => welt.bodenHoehe(x, z);
  const lok = (id, lx, lz) => plan.lokalZuWelt(plan.platz(id), lx, lz);
  const tal = (dx, dz) => ({ x: TAL.x + dx, z: TAL.z + dz });

  function neu(id, name, art, look, pos, yaw, brain) {
    const figur = createCharacter({ look, mimik: false, seed: hashSeed('npc', seed, id), welt, name, schilder, pos: { x: pos.x, y: boden(pos.x, pos.z), z: pos.z }, yaw,
      brain: { heimat: { x: pos.x, z: pos.z }, grund: { zustand: 'idle' }, verhalten: { plauderChance: 0.02, idleClips: ['umschauen', 'kratzen', 'strecken'] }, ...brain } });
    szene.add(figur.root); figur.root.visible = false; figur.schild?.zeige(false);
    const n = { id, name, art, figur, aktiv: false, schaut: false, folgt: false, rede: [], redeZeit: 0, d: 1e9 };
    interaktion.melde('npc:' + id, { pos: () => figur.zustand.pos, radius: 0.3, art: 'npc', text: name + ' ansprechen', prio: 0.4,
      aktion: (wer) => { figur.blickZu(wer.figur); wer.figur.blickZu(figur); n.ansprechen(); } });
    n.ansprechen = () => sprich(n, onAnsprechen(n) || [pick(r, SAETZE[art])]);
    npcs.push(n);
    return n;
  }
  function sprich(n, zeilen) { n.rede.push(...zeilen); }

  // ---- Tal ----
  neu('mentor', 'Alwine', 'mentor', createLook({ ...VORLAGEN.magierin, name: 'Alwine' }), tal(2, 1.5), 3, { grund: { zustand: 'wandern', radius: 2.5 } });
  neu('bo', 'Späher Bo', 'bo', createLook({ ...VORLAGEN.jaegerin, name: 'Bo' }), tal(32, 2), -1.5, {});
  // ---- Tor und Stadt ----
  const th = plan.platz('mauer-torhaus');
  [[-3.2, 3.7], [3.2, 3.7]].forEach(([lx, lz], i) => {
    const q = plan.lokalZuWelt(th, lx, lz);
    const brain = i ? { grund: { zustand: 'patrouille', punkte: [lok('strasse', 0, 14), lok('strasse', 0, -10), lok('markt', 0, 6)], art: 'pingpong', warten: 3 } } : {};
    neu('wache' + i, 'Wache', 'wache', createLook({ ...VORLAGEN.wache }), q, th.winkel, brain);
  });
  const stand = (id, lz = 1.9) => lok(id, 0, lz), taverneTuer = lok('taverne', 0, 6.5);
  [['haendler0', 'Händlerin Gerda', 'stand-1'], ['haendler1', 'Händler Anton', 'stand-4']].forEach(([id, name, st], i) => {
    const s = stand(st), abend = { x: taverneTuer.x + i * 1.5, z: taverneTuer.z };
    neu(id, name, 'haendler', createLook({ ...VORLAGEN.haendler }), s, plan.platz(st).winkel, { grund: { zustand: 'idle' }, plan: [
      { von: 7, bis: 19, zustand: 'arbeiten', ort: s, clip: 'winken' }, { von: 19, bis: 7, zustand: 'wandern', heimat: abend, radius: 2 }] });
  });
  const amb = plan.lokalZuWelt(plan.platz('schmiede'), 2.3, 1.7);
  neu('schmied', 'Schmied Konrad', 'schmied', createLook({ ...VORLAGEN.schmied }), amb, 0, { plan: [
    { von: 6, bis: 20, zustand: 'arbeiten', ort: amb, clip: 'haemmern' }, { von: 20, bis: 6, zustand: 'wandern', heimat: taverneTuer, radius: 3 }] });
  neu('wirt', 'Wirt Korbinian', 'wirt', createLook({ ...VORLAGEN.alter }), taverneTuer, plan.platz('taverne').winkel, { plan: [
    { von: 8, bis: 24, zustand: 'arbeiten', ort: taverneTuer, clip: 'fegen' }, { von: 0, bis: 8, zustand: 'idle' }] });
  const tt = lok('tempel', 0, 7.5);
  neu('priesterin', 'Priesterin Mara', 'priesterin', createLook({ ...VORLAGEN.koenigin, name: 'Mara' }), tt, plan.platz('tempel').winkel, { grund: { zustand: 'wandern', radius: 2.5 } });
  const markt = lok('markt', 0, 7);
  neu('buerger0', 'Hannes', 'buerger', randomLook(hashSeed('b', seed, 0)), { x: markt.x + 3, z: markt.z }, 0, { grund: { zustand: 'wandern', radius: 8 } });
  neu('kind0', 'Mia', 'buerger', randomLook(hashSeed('b', seed, 1), { kind: true }), { x: markt.x - 3, z: markt.z + 1 }, 0, { grund: { zustand: 'wandern', radius: 8 } });

  const nachbarn = [], kontext = { nachbarn, npcs: [], stunde: 9, ziele: [] };
  const byId = (id) => npcs.find((n) => n.id === id);
  const mentor = byId('mentor');
  const nah = [];
  return {
    npcs, byId, mentor,
    /** Alwine folgt dem Spieler (oder bleibt wieder bei ihrem Platz). */
    mentorFolgt(an) {
      mentor.folgt = !!an;
      if (an) mentor.figur.brain.setze('folgen', { ziel: () => spieler().zustand.pos, abstand: 3.2 });
      else mentor.figur.brain.zurueck();
    },
    /** Zeilen nacheinander als Sprechblase (jeweils ~3,4 s). */
    sprich(id, zeilen) { const n = byId(id); if (n) sprich(n, zeilen); },
    update(dt, stunde) {
      const sp = spieler().zustand.pos;
      kontext.stunde = stunde;
      for (const n of npcs) { const p = n.figur.zustand.pos; n.d = Math.hypot(p.x - sp.x, p.z - sp.z); }
      if (mentor.folgt && mentor.d > 30) {   // Alwine hat sich verlaufen: neben dem Spieler wieder auftauchen
        const a = spieler().zustand.yaw + Math.PI;
        mentor.figur.teleport({ x: sp.x + Math.sin(a) * 4, y: boden(sp.x, sp.z) + 0.3, z: sp.z + Math.cos(a) * 4 }, 0);
      }
      nah.length = 0;
      for (const n of npcs) if (n.d < SICHT) nah.push(n);
      nah.sort((a, b) => (a.folgt ? -1 : b.folgt ? 1 : a.d - b.d));
      nah.length = Math.min(nah.length, MAX_SICHTBAR);
      for (const n of npcs) {
        const an = nah.includes(n);
        if (an !== n.aktiv) { n.aktiv = an; n.figur.root.visible = an; n.figur.schild?.zeige(an); if (!an) n.figur.blickZu(null); }
        if (!an) continue;
        const nahe = n.d < BLICK;
        if (nahe !== n.schaut) { n.schaut = nahe; n.figur.blickZu(nahe ? spieler() : null); }
        nachbarn.length = 0; nachbarn.push({ x: sp.x, z: sp.z, radius: 0.3 });
        n.figur.update(dt, null, kontext);
        if (n.rede.length && (n.redeZeit -= dt) <= 0) { n.figur.sage(n.rede.shift(), { dauer: 3.2, geste: n.art === 'mentor' || n.art === 'bo' ? 'nicken' : undefined }); n.redeZeit = 3.4; }
      }
    },
    dispose() { for (const n of npcs) { interaktion.entferne('npc:' + n.id); n.figur.dispose(); } npcs.length = 0; },
  };
}
