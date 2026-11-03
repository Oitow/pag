// Spieldaten aller Lebewesen des Planeten (Agent Kreaturen).
// Rein deklarativ, ohne three.js – wird auch vom Node-Test tests/planet-fortschritt.test.mjs geladen.
//
//   TIER_DATEN[id]  Kurzform pro Voxel-Tier (id = Datei in games/voxel-tiere/):
//     b   Biome (String oder Array; Standard: DATA.GRUPPE_BIOME[gruppe])
//     v   Verhalten: 'zahm' | 'scheu' | 'neutral' | 'aggressiv'
//     z   Aktivzeit: 'tag' | 'nacht' | 'immer'           (Standard 'immer')
//     s   Seltenheit 1 (häufig) … 3 (selten)              (Standard 1)
//     g   Größe in Metern (größte Ausdehnung des Modells)
//     h   Herdengröße [min, max]                           (Standard [1, 1])
//     f   Fähigkeiten als Begleiter { name: stufe 1..3 }
//     l   Beute beim Besiegen { item: max. Anzahl }        (Standard je Gruppe)
//     st  Stufe explizit (sonst kleinste Biomstufe, +1 für Raubtiere 'r')
//     r   Raubtier (aggressiver Jäger → Stufe +1, max. 6 außerhalb der Asche)
//     w   'wasser' (nur im Wasser, schwimmt knapp unter der Oberfläche) | 'amphib' (Land + Wasser)
//     fl  1 = Vogel (fliegt beim Laufen/Fliehen), 2 = Insekt (schwebt dauernd)
//     lt  leuchtet (Glühwürmchen, Qualle)
//
//   GLUT_VARIANTEN  glühende Alpha-Varianten starker Tiere für die Aschelande (Endgame, Stufe 7).
//   baueKreaturen(TIERE, DATA) → { [id]: Kreatur } vollständige Einträge (inkl. glut_*).

export const VERHALTEN = ['zahm', 'scheu', 'neutral', 'aggressiv'];
export const AKTIVZEIT = ['tag', 'nacht', 'immer'];

export const GRUPPEN_BEUTE = {
  bauernhof: { fleisch: 1, leder: 1 },
  insekt:    { faser: 1 },
  luft:      { feder: 2 },
  wasser:    { muschel: 1, schuppe: 1 },
  wald:      { fell: 1, fleisch: 1 },
  savanne:   { leder: 2, fleisch: 2 },
  dschungel: { leder: 1, beeren: 1 },
  wueste:    { schuppe: 1, leder: 1 },
  polar:     { fell: 2, fleisch: 1 },
};

export const TIER_DATEN = {
  // ---------- Bauernhof → Wiesen (Stufe 1) ----------
  alpaka:   { b: 'wiese', v: 'zahm', g: 1.4, h: [2, 4], f: { waerme: 1, tragen: 1 }, l: { fell: 2 } },
  esel:     { b: 'wiese', v: 'zahm', g: 1.4, f: { tragen: 2, reiten: 1 }, l: { leder: 1 } },
  gans:     { b: ['wiese', 'strand'], v: 'neutral', g: 0.75, h: [2, 4], w: 'amphib', f: { kampf: 1, schwimmen: 1 }, l: { feder: 2 } },
  hahn:     { b: 'wiese', v: 'neutral', g: 0.55, f: { kampf: 1 }, l: { feder: 2 } },
  hamster:  { b: 'wiese', v: 'scheu', g: 0.18, f: { sammeln: 1 }, l: { fell: 1 } },
  huhn:     { b: 'wiese', v: 'zahm', g: 0.5, h: [3, 5], f: { sammeln: 1 }, l: { feder: 2, fleisch: 1 } },
  hund:     { b: 'wiese', v: 'zahm', s: 2, g: 0.8, f: { spuernase: 1, kampf: 1 }, l: { fell: 1 } },
  kueken:   { b: 'wiese', v: 'zahm', g: 0.22, h: [2, 4], f: { heilung: 1 }, l: { feder: 1 } },
  kuh:      { b: 'wiese', v: 'zahm', g: 1.7, h: [2, 3], f: { heilung: 1, tragen: 1 }, l: { leder: 2, fleisch: 2 } },
  lama:     { b: 'berge', v: 'neutral', g: 1.5, h: [2, 3], f: { waerme: 1, klettern: 1, tragen: 2 }, l: { fell: 2 } },
  maus:     { b: ['wiese', 'wald'], v: 'scheu', g: 0.14, f: { sammeln: 1 }, l: { fell: 1 } },
  meerschweinchen: { b: 'wiese', v: 'zahm', g: 0.25, f: { heilung: 1 }, l: { fell: 1 } },
  pferd:    { b: ['wiese', 'ebene'], v: 'scheu', st: 2, s: 2, g: 1.9, h: [2, 3], f: { reiten: 2 }, l: { leder: 2 } },
  pony:     { b: 'wiese', v: 'zahm', g: 1.2, f: { reiten: 1 }, l: { leder: 1 } },
  schaf:    { b: 'wiese', v: 'zahm', g: 0.95, h: [3, 5], f: { waerme: 1 }, l: { fell: 2, fleisch: 1 } },
  schwein:  { b: 'wiese', v: 'zahm', g: 0.95, f: { sammeln: 1, spuernase: 1 }, l: { fleisch: 2 } },
  truthahn: { b: 'wiese', v: 'neutral', g: 0.8, f: { kampf: 1 }, l: { feder: 3, fleisch: 1 } },
  ziege:    { b: ['wiese', 'berge'], v: 'neutral', g: 0.9, h: [1, 3], f: { klettern: 1 }, l: { fell: 1, leder: 1 } },

  // ---------- Insekten → Wiesen / Dunkelwald ----------
  ameise:   { b: ['wiese', 'wald'], v: 'neutral', g: 0.16, h: [3, 6], f: { tragen: 1, sammeln: 1 } },
  biene:    { b: 'wiese', v: 'neutral', z: 'tag', g: 0.16, h: [2, 4], fl: 2, f: { heilung: 1, sammeln: 1 }, l: { harz: 1, beeren: 1 } },
  gluehwuermchen: { b: ['wiese', 'wald'], v: 'scheu', z: 'nacht', g: 0.16, h: [3, 6], fl: 2, lt: 1, f: { licht: 1 } },
  gottesanbeterin: { b: 'wald', v: 'aggressiv', r: 1, g: 0.3, f: { kampf: 1 } },
  heuschrecke: { b: ['wiese', 'ebene'], v: 'scheu', z: 'tag', g: 0.2, h: [2, 5], f: { fliegen: 1 } },
  hirschkaefer: { b: 'wald', v: 'neutral', g: 0.3, f: { abbau: 1, kampf: 1 }, l: { schuppe: 1 } },
  hummel:   { b: 'wiese', v: 'zahm', z: 'tag', g: 0.16, fl: 2, f: { sammeln: 1 } },
  libelle:  { b: ['sumpf', 'wiese'], v: 'scheu', z: 'tag', g: 0.22, fl: 2, f: { fliegen: 1 } },
  marienkaefer: { b: 'wiese', v: 'zahm', z: 'tag', g: 0.12, h: [2, 4], f: { heilung: 1 } },
  raupe:    { b: ['wiese', 'wald'], v: 'zahm', g: 0.16, f: { sammeln: 1 } },
  schmetterling: { b: 'wiese', v: 'scheu', z: 'tag', g: 0.22, h: [1, 3], fl: 2, f: { heilung: 1 } },
  schnecke: { b: ['wald', 'sumpf'], v: 'zahm', g: 0.2, f: { heilung: 1 }, l: { muschel: 1 } },
  spinne:   { b: 'wald', v: 'aggressiv', z: 'nacht', r: 1, g: 0.4, f: { klettern: 1, kampf: 1 }, l: { faser: 3 } },

  // ---------- Luft ----------
  adler:    { b: 'berge', v: 'neutral', s: 2, g: 1.2, fl: 1, f: { fliegen: 2, spuernase: 1 } },
  eule:     { b: ['wiese', 'wald'], v: 'scheu', z: 'nacht', g: 0.6, fl: 1, f: { licht: 1, spuernase: 1 } },
  falke:    { b: ['wiese', 'ebene'], v: 'scheu', st: 2, g: 0.7, fl: 1, f: { fliegen: 1, kampf: 1 } },
  fledermaus: { b: 'wald', v: 'neutral', z: 'nacht', g: 0.4, h: [2, 4], fl: 1, f: { spuernase: 1, fliegen: 1 }, l: { leder: 1 } },
  kolibri:  { b: 'wiese', v: 'scheu', z: 'tag', s: 2, g: 0.12, fl: 2, f: { heilung: 1 } },
  kookaburra: { b: 'ebene', v: 'scheu', g: 0.5, fl: 1, f: { fliegen: 1 } },
  kranich:  { b: 'sumpf', v: 'scheu', g: 1.3, fl: 1, f: { fliegen: 1 } },
  moewe:    { b: 'strand', v: 'scheu', g: 0.6, h: [2, 4], fl: 1, f: { fliegen: 1, spuernase: 1 } },
  rabe:     { b: 'wald', v: 'neutral', g: 0.6, fl: 1, f: { spuernase: 2 } },
  rotkehlchen: { b: 'wiese', v: 'scheu', z: 'tag', g: 0.2, fl: 1, f: { heilung: 1 } },
  spatz:    { b: 'wiese', v: 'scheu', z: 'tag', g: 0.2, h: [2, 4], fl: 1, f: { sammeln: 1 } },
  storch:   { b: ['wiese', 'sumpf'], v: 'scheu', g: 1.3, fl: 1, f: { fliegen: 1 } },
  taube:    { b: 'wiese', v: 'zahm', g: 0.4, h: [2, 3], fl: 1, f: { spuernase: 1 } },
  wellensittich: { b: 'ebene', v: 'scheu', g: 0.3, h: [2, 4], fl: 1, f: { fliegen: 1 } },

  // ---------- Wasser ----------
  axolotl:  { b: 'sumpf', v: 'zahm', s: 2, g: 0.35, w: 'amphib', f: { heilung: 2 }, l: { schuppe: 1 } },
  clownfisch: { b: 'ozean', v: 'scheu', g: 0.3, h: [2, 4], w: 'wasser', f: { tauchen: 1 } },
  delfin:   { b: 'ozean', v: 'zahm', g: 2.4, h: [2, 3], w: 'wasser', f: { tauchen: 2, schwimmen: 3 }, l: { fleisch: 2 } },
  ente:     { b: ['strand', 'wiese', 'sumpf'], v: 'zahm', g: 0.5, h: [2, 4], w: 'amphib', f: { schwimmen: 1 }, l: { feder: 2 } },
  flamingo: { b: ['strand', 'sumpf'], v: 'scheu', g: 1.3, h: [2, 4], f: { schwimmen: 1 }, l: { feder: 2 } },
  goldfisch: { b: 'ozean', v: 'scheu', g: 0.3, h: [2, 4], w: 'wasser', f: { schwimmen: 1 } },
  hai:      { b: 'ozean', v: 'aggressiv', r: 1, g: 3, w: 'wasser', f: { kampf: 2, schwimmen: 2 }, l: { schuppe: 2, fleisch: 2 } },
  hummer:   { b: 'strand', v: 'neutral', g: 0.45, f: { kampf: 1, abbau: 1 }, l: { muschel: 1, fleisch: 1 } },
  krabbe:   { b: 'strand', v: 'neutral', g: 0.35, h: [2, 4], f: { sammeln: 1 }, l: { muschel: 1 } },
  krokodil: { b: 'sumpf', v: 'aggressiv', r: 1, g: 2.6, w: 'amphib', f: { kampf: 2, schwimmen: 1 }, l: { schuppe: 2, leder: 1 } },
  kugelfisch: { b: 'ozean', v: 'scheu', g: 0.4, w: 'wasser', f: { giftschutz: 1 } },
  oktopus:  { b: 'ozean', v: 'scheu', g: 1, w: 'wasser', f: { tauchen: 1, klettern: 1 } },
  otter:    { b: ['strand', 'sumpf'], v: 'zahm', g: 0.8, w: 'amphib', f: { schwimmen: 2, tauchen: 1 }, l: { fell: 1 } },
  pelikan:  { b: 'strand', v: 'scheu', g: 1.1, fl: 1, f: { tragen: 1, fliegen: 1 }, l: { feder: 2 } },
  qualle:   { b: 'ozean', v: 'neutral', g: 0.7, h: [2, 5], w: 'wasser', lt: 1, f: { licht: 1 } },
  rochen:   { b: 'ozean', v: 'scheu', g: 1.6, w: 'wasser', f: { tauchen: 1 } },
  schnabeltier: { b: 'sumpf', v: 'scheu', s: 2, g: 0.5, w: 'amphib', f: { giftschutz: 1, schwimmen: 1 } },
  schwan:   { b: ['strand', 'wiese'], v: 'neutral', g: 1, w: 'amphib', f: { schwimmen: 1, fliegen: 1 }, l: { feder: 3 } },
  seepferdchen: { b: 'ozean', v: 'scheu', s: 2, g: 0.3, w: 'wasser', f: { heilung: 1 } },
  seestern: { b: 'strand', v: 'zahm', g: 0.3, f: { heilung: 1 }, l: { muschel: 2 } },
  wal:      { b: 'ozean', v: 'zahm', s: 3, g: 10, w: 'wasser', st: 4, f: { tauchen: 3, schwimmen: 3, tragen: 3 }, l: { fleisch: 4 } },

  // ---------- Dunkelwald (Stufe 2) ----------
  baer:     { b: 'wald', v: 'aggressiv', r: 1, g: 1.7, f: { waerme: 1, kampf: 2 }, l: { fell: 3, fleisch: 2 } },
  beutelteufel: { b: 'wald', v: 'aggressiv', z: 'nacht', r: 1, g: 0.6, f: { kampf: 1 } },
  biber:    { b: ['wald', 'sumpf'], v: 'scheu', g: 0.8, w: 'amphib', f: { sammeln: 2, schwimmen: 1 } },
  dachs:    { b: 'wald', v: 'neutral', st: 3, g: 0.7, f: { abbau: 2, kampf: 1 } },
  eichhoernchen: { b: 'wald', v: 'scheu', z: 'tag', g: 0.35, f: { klettern: 1, sammeln: 1 } },
  elch:     { b: 'wald', v: 'neutral', g: 2.3, f: { reiten: 2, tragen: 1 }, l: { leder: 2, fleisch: 2 } },
  hase:     { b: ['wiese', 'wald'], v: 'zahm', g: 0.45, h: [2, 3], f: { sammeln: 1 } },
  igel:     { b: ['wiese', 'wald'], v: 'zahm', z: 'nacht', g: 0.3, f: { giftschutz: 1 } },
  kiwi:     { b: 'wald', v: 'scheu', z: 'nacht', g: 0.4, f: { spuernase: 1 }, l: { feder: 1 } },
  koala:    { b: 'wald', v: 'zahm', g: 0.6, f: { heilung: 1 } },
  kroete:   { b: ['wald', 'sumpf'], v: 'zahm', g: 0.3, f: { giftschutz: 1 }, l: { leder: 1 } },
  luchs:    { b: 'wald', v: 'scheu', z: 'nacht', st: 3, s: 2, g: 0.9, f: { spuernase: 2, kampf: 1 } },
  maulwurf: { b: ['wiese', 'wald'], v: 'scheu', g: 0.3, f: { abbau: 1 } },
  panda:    { b: 'wald', v: 'zahm', s: 2, g: 1.4, f: { tragen: 1, heilung: 1 } },
  puma:     { b: 'berge', v: 'aggressiv', r: 1, g: 1.5, f: { klettern: 2, kampf: 2 } },
  reh:      { b: ['wiese', 'wald'], v: 'scheu', g: 1.2, h: [2, 3], f: { reiten: 1 }, l: { leder: 1, fleisch: 1 } },
  rotpanda: { b: 'wald', v: 'scheu', s: 2, g: 0.6, f: { klettern: 1 } },
  salamander: { b: ['wald', 'sumpf'], v: 'zahm', g: 0.35, f: { giftschutz: 1, waerme: 1 }, l: { schuppe: 1 } },
  specht:   { b: 'wald', v: 'scheu', z: 'tag', g: 0.35, fl: 1, f: { sammeln: 2 }, l: { feder: 1 } },
  waschbaer: { b: 'wald', v: 'neutral', z: 'nacht', g: 0.6, f: { sammeln: 1, spuernase: 1 } },
  wildschwein: { b: 'wald', v: 'aggressiv', r: 1, g: 1.1, h: [1, 3], f: { kampf: 1, spuernase: 1 }, l: { leder: 1, fleisch: 2 } },
  wolf:     { b: 'wald', v: 'aggressiv', r: 1, g: 1.2, h: [2, 4], f: { kampf: 2, spuernase: 1 }, l: { fell: 2 } },
  wombat:   { b: 'wald', v: 'zahm', g: 0.7, f: { abbau: 1, tragen: 1 } },

  // ---------- Savanne → Ebenen (Stufe 5) ----------
  bison:    { b: 'ebene', v: 'neutral', g: 2.2, h: [3, 5], f: { waerme: 1, tragen: 2 } },
  elefant:  { b: 'ebene', v: 'neutral', s: 2, g: 3.4, h: [1, 3], f: { kuehlung: 1, tragen: 3 }, l: { leder: 3, fleisch: 2 } },
  gepard:   { b: 'ebene', v: 'scheu', st: 6, s: 2, g: 1.4, f: { kampf: 2, spuernase: 1 } },
  giraffe:  { b: 'ebene', v: 'scheu', g: 4.5, f: { spuernase: 2, sammeln: 2 } },
  gnu:      { b: 'ebene', v: 'scheu', g: 1.9, h: [3, 6], f: { reiten: 2 } },
  hyaene:   { b: 'ebene', v: 'aggressiv', z: 'nacht', r: 1, g: 1.2, h: [2, 4], f: { kampf: 2 } },
  leopard:  { b: 'ebene', v: 'aggressiv', z: 'nacht', r: 1, g: 1.5, f: { klettern: 2, kampf: 2 } },
  loewe:    { b: 'ebene', v: 'aggressiv', r: 1, g: 1.9, h: [1, 3], f: { kampf: 3 } },
  nashorn:  { b: 'ebene', v: 'neutral', g: 2.6, f: { abbau: 3, kampf: 2 } },
  nilpferd: { b: ['sumpf', 'ebene'], v: 'aggressiv', r: 1, g: 2.6, w: 'amphib', f: { kuehlung: 1, schwimmen: 2 } },
  zebra:    { b: 'ebene', v: 'scheu', g: 1.9, h: [3, 6], f: { reiten: 2 } },

  // ---------- Dschungel → Sumpf (Stufe 3) ----------
  chamaeleon: { b: 'sumpf', v: 'scheu', g: 0.35, f: { spuernase: 2 }, l: { schuppe: 1 } },
  faultier: { b: 'sumpf', v: 'zahm', g: 0.8, f: { heilung: 2 } },
  gibbon:   { b: 'sumpf', v: 'scheu', g: 0.8, f: { klettern: 2 } },
  gorilla:  { b: 'sumpf', v: 'neutral', s: 2, st: 4, g: 1.8, f: { kampf: 2, tragen: 2 } },
  kakadu:   { b: 'sumpf', v: 'scheu', z: 'tag', g: 0.5, fl: 1, f: { fliegen: 1 }, l: { feder: 2 } },
  lemur:    { b: 'sumpf', v: 'zahm', g: 0.6, h: [2, 3], f: { klettern: 1, heilung: 1 } },
  mandrill: { b: 'sumpf', v: 'aggressiv', r: 1, g: 1, f: { kampf: 2 } },
  nasenbaer: { b: 'sumpf', v: 'scheu', g: 0.7, h: [2, 3], f: { spuernase: 1, sammeln: 1 } },
  orangutan: { b: 'sumpf', v: 'zahm', s: 2, g: 1.4, f: { klettern: 2, sammeln: 2 } },
  ozelot:   { b: 'sumpf', v: 'aggressiv', z: 'nacht', r: 1, g: 0.9, f: { kampf: 1, spuernase: 1 } },
  papagei:  { b: 'sumpf', v: 'scheu', z: 'tag', g: 0.5, fl: 1, f: { fliegen: 2 }, l: { feder: 2 } },
  pfau:     { b: 'sumpf', v: 'zahm', s: 2, g: 1.2, f: { heilung: 1 }, l: { feder: 3 } },
  pfeilgiftfrosch: { b: 'sumpf', v: 'neutral', g: 0.16, f: { giftschutz: 2 } },
  schimpanse: { b: 'sumpf', v: 'neutral', g: 1.1, h: [2, 3], f: { abbau: 1, klettern: 1, sammeln: 1 } },
  schlange: { b: 'sumpf', v: 'aggressiv', r: 1, g: 1.6, f: { giftschutz: 1, kampf: 1 }, l: { schuppe: 2 } },
  tapir:    { b: 'sumpf', v: 'zahm', g: 1.6, w: 'amphib', f: { reiten: 1, schwimmen: 1 } },
  tiger:    { b: 'sumpf', v: 'aggressiv', st: 5, s: 2, g: 2.1, f: { kampf: 3 }, l: { fell: 2, fleisch: 2 } },
  tukan:    { b: 'sumpf', v: 'scheu', z: 'tag', g: 0.5, fl: 1, f: { sammeln: 1 }, l: { feder: 2 } },
  wasserschwein: { b: 'sumpf', v: 'zahm', g: 1, h: [2, 4], w: 'amphib', f: { schwimmen: 1, heilung: 1 } },

  // ---------- Wüste → Glutwüste (Stufe 6) ----------
  dingo:    { b: 'wueste', v: 'aggressiv', r: 1, g: 1, h: [2, 4], f: { kampf: 2, spuernase: 1 } },
  emu:      { b: ['wueste', 'ebene'], v: 'scheu', g: 1.6, f: { reiten: 2 }, l: { feder: 3 } },
  erdmaennchen: { b: 'wueste', v: 'scheu', z: 'tag', g: 0.35, h: [3, 6], f: { kuehlung: 1, spuernase: 2, abbau: 1 } },
  gecko:    { b: 'wueste', v: 'scheu', z: 'nacht', g: 0.25, f: { klettern: 3 } },
  guerteltier: { b: 'wueste', v: 'scheu', z: 'nacht', g: 0.55, f: { abbau: 3, kuehlung: 1 } },
  kaenguru: { b: ['ebene', 'wueste'], v: 'neutral', g: 1.6, h: [2, 3], f: { fliegen: 2, tragen: 1 } },
  kamel:    { b: 'wueste', v: 'zahm', g: 2.3, f: { kuehlung: 2, reiten: 2, tragen: 2 }, l: { leder: 2, fell: 1 } },
  leguan:   { b: 'wueste', v: 'zahm', g: 0.8, f: { kuehlung: 1, heilung: 1 } },
  skorpion: { b: 'wueste', v: 'aggressiv', z: 'nacht', r: 1, g: 0.5, f: { giftschutz: 2, kampf: 2 }, l: { schuppe: 2 } },
  strauss:  { b: ['ebene', 'wueste'], v: 'scheu', s: 2, g: 2.2, f: { reiten: 3 }, l: { feder: 3 } },
  wallaby:  { b: ['ebene', 'wueste'], v: 'scheu', g: 1, f: { fliegen: 1 } },
  waran:    { b: 'wueste', v: 'aggressiv', r: 1, g: 2, f: { kampf: 2, giftschutz: 1 } },

  // ---------- Polar → Berge (Stufe 4) / Eiswüste (Stufe 6) ----------
  eisbaer:  { b: 'eis', v: 'aggressiv', r: 1, g: 2.2, w: 'amphib', f: { kampf: 3, kuehlung: 2, schwimmen: 2 }, l: { fell: 3, fleisch: 2 } },
  lemming:  { b: ['berge', 'eis'], v: 'scheu', g: 0.18, h: [3, 6], f: { sammeln: 1 } },
  moschusochse: { b: ['berge', 'eis'], v: 'neutral', g: 2, h: [2, 4], f: { waerme: 2, tragen: 2 } },
  narwal:   { b: 'ozean', v: 'scheu', s: 3, st: 4, g: 4, w: 'wasser', f: { tauchen: 2, abbau: 2 } },
  orca:     { b: 'ozean', v: 'aggressiv', s: 2, st: 5, g: 6, w: 'wasser', f: { tauchen: 3, kampf: 3 }, l: { fleisch: 3 } },
  polarfuchs: { b: ['eis', 'berge'], v: 'scheu', g: 0.7, f: { waerme: 1, spuernase: 2 } },
  rentier:  { b: ['berge', 'eis'], v: 'neutral', g: 1.8, h: [3, 5], f: { reiten: 2, waerme: 1 } },
  robbe:    { b: ['strand', 'eis'], v: 'zahm', g: 1.3, w: 'amphib', f: { schwimmen: 2, tauchen: 1 } },
  schneeeule: { b: ['eis', 'berge'], v: 'scheu', g: 0.7, fl: 1, f: { fliegen: 2, licht: 1 }, l: { feder: 2 } },
  schneehase: { b: ['berge', 'eis'], v: 'scheu', g: 0.5, f: { waerme: 1 } },
  schneeleopard: { b: 'berge', v: 'aggressiv', r: 1, s: 2, g: 1.6, f: { klettern: 3, waerme: 2, kampf: 2 } },
  seeloewe: { b: ['strand', 'eis'], v: 'zahm', st: 2, g: 1.6, w: 'amphib', f: { schwimmen: 2, tauchen: 1 } },
  walross:  { b: 'eis', v: 'neutral', g: 2.4, w: 'amphib', f: { waerme: 2, tauchen: 2, abbau: 2 }, l: { fell: 2, fleisch: 3 } },
  yak:      { b: 'berge', v: 'zahm', g: 1.9, h: [2, 4], f: { waerme: 2, tragen: 2, reiten: 1 }, l: { fell: 3 } },
};

// Glühende Alpha-Varianten für die Aschelande (Stufe 7). basis = Modell/Kampfwerte.
export const GLUT_VARIANTEN = {
  glut_wolf:      { basis: 'wolf',     name: 'Glutwolf',        v: 'aggressiv', h: [2, 3], f: { kampf: 3, spuernase: 2, kuehlung: 1 } },
  glut_loewe:     { basis: 'loewe',    name: 'Flammenlöwe',     v: 'aggressiv', f: { kampf: 3, reiten: 3 } },
  glut_baer:      { basis: 'baer',     name: 'Magmabär',        v: 'aggressiv', f: { kampf: 3, waerme: 3, tragen: 2 } },
  glut_nashorn:   { basis: 'nashorn',  name: 'Lavanashorn',     v: 'neutral',   f: { abbau: 3, kampf: 3, reiten: 2 } },
  glut_skorpion:  { basis: 'skorpion', name: 'Glutskorpion',    v: 'aggressiv', h: [1, 3], f: { giftschutz: 3, kampf: 3, kuehlung: 2 } },
  glut_waran:     { basis: 'waran',    name: 'Feuerwaran',      v: 'aggressiv', f: { kampf: 3, kuehlung: 3 } },
  glut_krokodil:  { basis: 'krokodil', name: 'Aschekrokodil',   v: 'aggressiv', f: { kampf: 3, schwimmen: 2 } },
  glut_spinne:    { basis: 'spinne',   name: 'Glutspinne',      v: 'aggressiv', z: 'nacht', f: { klettern: 3, kampf: 2, licht: 2 } },
  glut_gorilla:   { basis: 'gorilla',  name: 'Vulkangorilla',   v: 'neutral',   f: { kampf: 3, tragen: 3 } },
  glut_salamander:{ basis: 'salamander', name: 'Feuersalamander', v: 'scheu',   f: { kuehlung: 3, heilung: 2, licht: 2 } },
  glut_rabe:      { basis: 'rabe',     name: 'Ascherabe',       v: 'scheu', fl: 1, f: { fliegen: 3, spuernase: 3 } },
  glut_elefant:   { basis: 'elefant',  name: 'Obsidianelefant', v: 'neutral', s: 2, f: { tragen: 3, kuehlung: 3, abbau: 3 } },
};

const asArr = x => (Array.isArray(x) ? x : x ? [x] : []);

// Vollständige Kreatur-Einträge. TIERE = Autobattler-Daten (name, gruppe, rolle, hp, atk, def, spd).
export function baueKreaturen(TIERE, DATA) {
  const out = {};
  for (const id of Object.keys(TIERE)) {
    const t = TIERE[id], d = TIER_DATEN[id] || {};
    const biome = asArr(d.b).length ? asArr(d.b) : (DATA.GRUPPE_BIOME[t.gruppe] || ['wiese']).slice();
    const minStufe = Math.min(...biome.map(b => DATA.BIOME[b]?.stufe ?? 1));
    const stufe = d.st ?? Math.min(6, minStufe + (d.r ? 1 : 0));
    out[id] = {
      id, modell: id, name: t.name, gruppe: t.gruppe, rolle: t.rolle,
      biome, stufe,
      verhalten: d.v || ({ support: 'scheu', schuetze: 'scheu', tank: 'neutral', kaempfer: 'neutral' })[t.rolle] || 'neutral',
      aktiv: d.z || 'immer',
      seltenheit: d.s || 1,
      groesse: d.g || 1,
      herde: d.h || [1, 1],
      faehigkeiten: { ...(d.f || {}) },
      beute: { ...(d.l || GRUPPEN_BEUTE[t.gruppe] || { fleisch: 1 }) },
      wasser: d.w || null,
      flieger: d.fl || 0,
      leuchtet: !!d.lt,
      raubtier: !!d.r,
      glut: false,
      hp: t.hp, atk: t.atk, def: t.def, spd: t.spd,
    };
  }
  for (const [id, g] of Object.entries(GLUT_VARIANTEN)) {
    const b = out[g.basis]; if (!b) continue;
    out[id] = {
      ...b, id, modell: g.basis, name: g.name, biome: ['asche'], stufe: 7,
      verhalten: g.v || b.verhalten, aktiv: g.z || 'immer', seltenheit: g.s || 1,
      groesse: b.groesse * 1.35, herde: g.h || [1, 1],
      faehigkeiten: { ...g.f }, beute: { glut: 2, obsidian: 1 },
      wasser: null, flieger: g.fl || b.flieger, leuchtet: true, glut: true,
      hp: b.hp * 1.4, atk: b.atk * 1.3,
    };
  }
  return out;
}
