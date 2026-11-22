// Flora-Typen und Biom-Tabellen.
// art: 'baum' | 'fels' | 'erz' (Angriff), 'sammeln' (E), null = Deko.
// beute: [[item, min, max, chance=1], …]   hp: Treffer bis gefällt/abgebaut
// gr: [min,max] Skalierung   kol: Kollisionsradius (bei gr=1), kolH: Kollisionshöhe
// neig: minimale Normale·Oben (1 = flach)   ort: 'land' | 'ufer' (flaches Wasser) | 'wasser' (schwimmt)
// aus: 'radial' (wächst senkrecht) | 'normal' (liegt am Hang) | 'mix'
// abst: Mindestabstand zu anderen großen Objekten   nw: Nachwachsen in s   leer: Modell nach dem Sammeln
// fall: fällt beim Fällen um   splitter: Partikelfarben
const HOLZ = [0x7a5434, 0x9a7048], STEIN = [0x8f8f96, 0x6f6f76];
export const TYPEN = {
  // Wiese
  laubbaum_a: { art: 'baum', hp: 5, beute: [['holz', 3, 5]], gr: [0.85, 1.3], kol: 0.35, kolH: 4, neig: 0.82, aus: 'radial', abst: 3.5, nw: 420, fall: 1, splitter: [0x6fb043, ...HOLZ] },
  laubbaum_b: { art: 'baum', hp: 5, beute: [['holz', 3, 5]], gr: [0.9, 1.35], kol: 0.35, kolH: 4, neig: 0.82, aus: 'radial', abst: 3.5, nw: 420, fall: 1, splitter: [0x5f9e3a, ...HOLZ] },
  birke: { art: 'baum', hp: 4, beute: [['holz', 2, 4]], gr: [0.85, 1.25], kol: 0.22, kolH: 4, neig: 0.82, aus: 'radial', abst: 2.5, nw: 400, fall: 1, splitter: [0x9bd157, 0xeae6dc] },
  busch: { art: null, gr: [0.8, 1.4], neig: 0.7, aus: 'mix', abst: 1.2 },
  beerenbusch: { art: 'sammeln', label: 'Blaubeeren pflücken', beute: [['beeren', 2, 4]], gr: [0.9, 1.3], neig: 0.7, aus: 'mix', abst: 1.5, nw: 240, leer: 'busch', splitter: [0x3a4fd8, 0x6fb043] },
  beerenbusch_rot: { art: 'sammeln', label: 'Beeren pflücken', beute: [['beeren', 2, 3]], gr: [0.9, 1.3], neig: 0.7, aus: 'mix', abst: 1.5, nw: 240, leer: 'busch', splitter: [0xe23a4a, 0x6fb043] },
  faserpflanze: { art: 'sammeln', label: 'Flachs ernten', beute: [['faser', 1, 3]], gr: [0.9, 1.2], neig: 0.75, aus: 'radial', abst: 1, nw: 200, splitter: [0x7fae4a, 0x8fb6ff] },
  kiesel: { art: 'sammeln', label: 'Steine aufheben', beute: [['stein', 1, 2]], gr: [0.9, 1.3], neig: 0.6, aus: 'normal', abst: 0.6, nw: 300, splitter: STEIN },
  ast: { art: 'sammeln', label: 'Ast aufheben', beute: [['holz', 1, 1]], gr: [0.9, 1.2], neig: 0.7, aus: 'normal', abst: 0.6, nw: 300, splitter: HOLZ },
  fels_klein: { art: 'fels', hp: 2, beute: [['stein', 1, 2]], gr: [0.8, 1.5], neig: 0.5, aus: 'normal', abst: 1, nw: 400, splitter: STEIN },
  felsbrocken: { art: 'fels', hp: 6, beute: [['stein', 3, 6]], gr: [0.8, 1.6], kol: 1.3, kolH: 1.6, neig: 0.5, aus: 'mix', abst: 3.5, nw: 600, splitter: STEIN },
  // Dunkelwald
  tanne: { art: 'baum', hp: 5, beute: [['holz', 3, 5], ['harz', 1, 1, 0.5]], gr: [0.85, 1.3], kol: 0.3, kolH: 5, neig: 0.78, aus: 'radial', abst: 2.6, nw: 420, fall: 1, splitter: [0x2f5f38, ...HOLZ] },
  fichte: { art: 'baum', hp: 6, beute: [['holz', 4, 6], ['harz', 1, 2, 0.6]], gr: [0.9, 1.4], kol: 0.3, kolH: 6, neig: 0.78, aus: 'radial', abst: 3.2, nw: 480, fall: 1, splitter: [0x24503a, ...HOLZ] },
  pilz: { art: 'sammeln', label: 'Pilze sammeln', beute: [['pilz', 1, 2]], gr: [0.9, 1.4], neig: 0.7, aus: 'normal', abst: 0.8, nw: 240, splitter: [0xe0352f, 0xf2ead8] },
  pilz_braun: { art: 'sammeln', label: 'Pilze sammeln', beute: [['pilz', 1, 2]], gr: [0.9, 1.4], neig: 0.7, aus: 'normal', abst: 0.8, nw: 240, splitter: [0xa0663a, 0xf2ead8] },
  gluehpilz: { art: 'sammeln', label: 'Leuchtpilze sammeln', beute: [['pilz', 1, 2]], gr: [1.0, 1.8], neig: 0.7, aus: 'normal', abst: 0.8, nw: 300, splitter: [0x5ae0ff, 0xf2ead8] },
  farn: { art: null, gr: [0.8, 1.5], neig: 0.65, aus: 'normal', abst: 0.8 },
  moosfels: { art: 'fels', hp: 6, beute: [['stein', 3, 5]], gr: [0.8, 1.5], kol: 1.3, kolH: 1.6, neig: 0.5, aus: 'mix', abst: 3.5, nw: 600, splitter: [0x7a7f78, 0x4f8a3a] },
  // Sumpf
  totbaum: { art: 'baum', hp: 4, beute: [['holz', 2, 4]], gr: [0.9, 1.5], kol: 0.35, kolH: 4, neig: 0.75, aus: 'radial', abst: 3, nw: 420, fall: 1, splitter: [0x5a5046, 0x7a8a4a] },
  schilf: { art: 'sammeln', label: 'Schilf schneiden', beute: [['faser', 2, 3]], gr: [0.8, 1.3], neig: 0.6, ort: 'ufer', aus: 'radial', abst: 0.8, nw: 220, splitter: [0x6f8f3a, 0x6b4426] },
  seerose: { art: null, gr: [0.7, 1.4], neig: 0, ort: 'wasser', aus: 'radial', abst: 1.2 },
  sumpffels: { art: 'fels', hp: 5, beute: [['stein', 2, 4]], gr: [0.7, 1.3], kol: 1.2, kolH: 1.4, neig: 0.5, aus: 'mix', abst: 3, nw: 600, splitter: [0x5f6152, 0x5a6a34] },
  // Berge
  kiefer: { art: 'baum', hp: 5, beute: [['holz', 3, 4], ['harz', 1, 2, 0.7]], gr: [0.85, 1.25], kol: 0.28, kolH: 5, neig: 0.62, aus: 'radial', abst: 3, nw: 450, fall: 1, splitter: [0x3d6b45, 0x8a5a36] },
  kiefer_schnee: { art: 'baum', hp: 5, beute: [['holz', 3, 4], ['harz', 1, 2, 0.7]], gr: [0.85, 1.25], kol: 0.28, kolH: 5, neig: 0.62, aus: 'radial', abst: 3, nw: 450, fall: 1, splitter: [0xf4f8fb, 0x3d6b45, 0x8a5a36] },
  bergfels: { art: 'fels', hp: 7, beute: [['stein', 4, 6]], gr: [0.9, 2.0], kol: 1.3, kolH: 1.8, neig: 0.2, aus: 'mix', abst: 4, nw: 600, splitter: [0x9a9aa4, 0xf2f6fa] },
  geroell: { art: 'fels', hp: 2, beute: [['stein', 1, 2]], gr: [0.8, 1.6], neig: 0.0, aus: 'normal', abst: 1.2, nw: 400, modell: 'fels_klein', splitter: [0x9a9aa4, 0x7c7a78] },
  schnee: { art: null, gr: [0.8, 2.2], neig: 0.55, aus: 'normal', abst: 1 },
  // Ebenen
  akazie: { art: 'baum', hp: 5, beute: [['holz', 3, 5]], gr: [0.9, 1.3], kol: 0.3, kolH: 3.5, neig: 0.82, aus: 'radial', abst: 7, nw: 450, fall: 1, splitter: [0x7f9a3a, 0x6a4a30] },
  getreide: { art: 'sammeln', label: 'Wildgetreide ernten', beute: [['faser', 2, 3]], gr: [0.8, 1.2], neig: 0.75, aus: 'radial', abst: 0.9, nw: 200, splitter: [0xe6c457, 0xc7a743] },
  trockenbusch: { art: null, gr: [0.8, 1.4], neig: 0.6, aus: 'mix', abst: 1 },
  ebenenfels: { art: 'fels', hp: 6, beute: [['stein', 3, 5]], gr: [0.8, 1.7], kol: 1.3, kolH: 1.6, neig: 0.5, aus: 'mix', abst: 4, nw: 600, splitter: [0xa89a80, 0x8a7c66] },
  // Glutwüste
  kaktus: { art: 'baum', hp: 3, beute: [['faser', 1, 3], ['holz', 1, 1, 0.5]], gr: [0.8, 1.3], kol: 0.35, kolH: 3, neig: 0.78, aus: 'radial', abst: 3, nw: 400, fall: 1, splitter: [0x4f9a50, 0xf3ecc4] },
  kaktus_2: { art: 'baum', hp: 3, beute: [['faser', 2, 3], ['holz', 1, 1, 0.5]], gr: [0.8, 1.3], kol: 0.35, kolH: 3, neig: 0.78, aus: 'radial', abst: 3, nw: 400, fall: 1, splitter: [0x4f9a50, 0xff7aa8] },
  bogen: { art: null, gr: [0.9, 1.3], kolMulti: [[-3.4, 0.9], [3.4, 0.9]], kolH: 7, neig: 0.85, aus: 'radial', abst: 12 },
  sandfels: { art: 'fels', hp: 6, beute: [['stein', 3, 5]], gr: [0.8, 1.6], kol: 1.3, kolH: 1.6, neig: 0.45, aus: 'mix', abst: 4, nw: 600, splitter: [0xd08a50, 0xb8653a] },
  duerrbusch: { art: 'sammeln', label: 'Dürre Zweige sammeln', beute: [['holz', 1, 1], ['faser', 1, 1]], gr: [0.8, 1.4], neig: 0.6, aus: 'mix', abst: 1, nw: 260, splitter: HOLZ },
  // Eis
  eisblock: { art: 'fels', hp: 5, beute: [['stein', 2, 3]], gr: [0.8, 1.6], kol: 1.1, kolH: 1.6, neig: 0.5, aus: 'mix', abst: 3.5, nw: 600, splitter: [0xbfe6f5, 0xf4fafd] },
  eiszapfen: { art: null, gr: [0.7, 1.6], kol: 0.6, kolH: 2.5, neig: 0.5, aus: 'radial', abst: 2.5 },
  schneehaufen: { art: null, gr: [0.8, 2.0], neig: 0.4, aus: 'normal', abst: 1 },
  // Asche
  verkohlt: { art: 'baum', hp: 3, beute: [['holz', 1, 3], ['glut', 1, 1, 0.15]], gr: [0.9, 1.4], kol: 0.3, kolH: 3, neig: 0.75, aus: 'radial', abst: 3, nw: 450, fall: 1, splitter: [0x2a2422, 0xff6a1a] },
  lavafels: { art: 'fels', hp: 6, beute: [['stein', 2, 4], ['glut', 1, 1, 0.4]], gr: [0.8, 1.6], kol: 1.3, kolH: 1.4, neig: 0.45, aus: 'mix', abst: 4, nw: 600, splitter: [0x3a3030, 0xff7a20] },
  lavafels_klein: { art: 'fels', hp: 3, beute: [['stein', 1, 2], ['glut', 1, 1, 0.2]], gr: [0.8, 1.4], neig: 0.45, aus: 'normal', abst: 1.5, nw: 500, splitter: [0x3a3030, 0xffb030] },
  glutspalte: { art: null, gr: [0.8, 1.5], neig: 0.6, aus: 'normal', abst: 2 },
  aschefels: { art: 'fels', hp: 6, beute: [['stein', 3, 5]], gr: [0.8, 1.6], kol: 1.3, kolH: 1.6, neig: 0.45, aus: 'mix', abst: 4, nw: 600, splitter: [0x4a4040, 0x2a2422] },
  // Strand
  palme: { art: 'baum', hp: 4, beute: [['holz', 2, 4], ['faser', 1, 1, 0.5]], gr: [0.85, 1.25], kol: 0.3, kolH: 4, neig: 0.75, aus: 'radial', abst: 4, nw: 420, fall: 1, splitter: [0x5cb04a, 0x9a7448] },
  muschel: { art: 'sammeln', label: 'Muschel aufheben', beute: [['muschel', 1, 1]], gr: [0.9, 1.6], neig: 0.6, aus: 'normal', abst: 0.8, nw: 300, splitter: [0xf7d6c8, 0xffffff] },
  treibholz: { art: 'sammeln', label: 'Treibholz aufheben', beute: [['holz', 1, 2]], gr: [0.8, 1.3], neig: 0.6, aus: 'normal', abst: 1.5, nw: 300, splitter: [0xb09a80, 0xa89078] },
  strandfels: { art: 'fels', hp: 2, beute: [['stein', 1, 2]], gr: [0.8, 1.6], neig: 0.5, aus: 'normal', abst: 1, nw: 400, splitter: [0xb0a890, 0x908870] },
};

// Bodendeko (nur nah, ohne Interaktion): Modell, Gewicht, Tönung (instanceColor)
// n = Büschel pro Zelle (≈ 20×20 m)
export const STREU = {
  wiese: { n: 110, liste: [['gras', 10, [0x7fc24a, 0x8fd055, 0x6fb03f]], ['gras_hoch', 2, [0x7fc24a]], ['blume_gelb', 1.2], ['blume_weiss', 1.2], ['blume_lila', 0.8], ['blume_rot', 0.6]] },
  wald: { n: 60, liste: [['gras', 6, [0x3f7f3a, 0x4a8a3a]], ['farn', 2]] },
  sumpf: { n: 70, liste: [['gras_hoch', 6, [0x7a8a44, 0x6a7a3a]], ['gras', 4, [0x7f8f4a]]] },
  berge: { n: 25, liste: [['gras', 6, [0x8aa070, 0x9aa88a]]] },
  ebene: { n: 90, liste: [['gras_hoch', 8, [0xd6c068, 0xc8b45a, 0xe0cc78]], ['gras', 4, [0xbfae55]], ['blume_gelb', 0.3]] },
  strand: { n: 18, liste: [['gras', 6, [0xb8c070, 0xa8b060]]] },
  wueste: { n: 6, liste: [['gras', 6, [0xc0a060]]] },
  asche: { n: 8, liste: [['gras', 5, [0x3a3434]]] },
  eis: { n: 0, liste: [] },
};

// Objekte pro Zelle: n = Kandidaten pro Zelle, liste = [typ, gewicht]
// Bäume (art 'baum') werden durch Feuchte & Lichtungs-Rauschen moduliert.
export const BIOM_FLORA = {
  wiese: { n: 22, lichtung: 0.15, erz: 0, liste: [['laubbaum_a', 3], ['laubbaum_b', 3], ['birke', 2], ['busch', 4], ['beerenbusch', 1.2], ['beerenbusch_rot', 1.2], ['faserpflanze', 1.5], ['kiesel', 1], ['ast', 1.2], ['fels_klein', 1], ['felsbrocken', 0.8], ['pilz_braun', 0.4]] },
  wald: { n: 30, lichtung: -0.25, erz: 0.16, liste: [['tanne', 7], ['fichte', 6], ['pilz', 1.3], ['pilz_braun', 1], ['gluehpilz', 0.8], ['farn', 3], ['moosfels', 1.2], ['beerenbusch', 0.6], ['ast', 1], ['kiesel', 0.6], ['busch', 1]] },
  sumpf: { n: 30, lichtung: -0.1, erz: 0.08, liste: [['totbaum', 4], ['schilf', 4], ['sumpffels', 1], ['pilz_braun', 1.2], ['busch', 1.5], ['farn', 2], ['ast', 1], ['gluehpilz', 0.5]] },
  berge: { n: 22, lichtung: -0.1, erz: 0.12, liste: [['kiefer', 5], ['kiefer_schnee', 3], ['bergfels', 3], ['geroell', 3], ['fels_klein', 1.5], ['kiesel', 1], ['schnee', 2.5]] },
  ebene: { n: 18, lichtung: 0.35, erz: 0.06, liste: [['akazie', 1.5], ['getreide', 4], ['trockenbusch', 2], ['ebenenfels', 1], ['fels_klein', 1], ['busch', 0.8], ['kiesel', 0.5]] },
  wueste: { n: 14, lichtung: 0.2, erz: 0.07, liste: [['kaktus', 2], ['kaktus_2', 1.5], ['sandfels', 1.5], ['duerrbusch', 2], ['bogen', 0.12], ['fels_klein', 0.5]] },
  eis: { n: 10, lichtung: 0, erz: 0.08, liste: [['eisblock', 3], ['eiszapfen', 2], ['schneehaufen', 3]] },
  asche: { n: 13, lichtung: 0.1, erz: 0.08, liste: [['verkohlt', 3], ['lavafels', 2.5], ['lavafels_klein', 2], ['glutspalte', 2], ['aschefels', 1]] },
  strand: { n: 10, lichtung: 0.2, erz: 0, liste: [['palme', 2], ['muschel', 2.5], ['treibholz', 1.2], ['strandfels', 1], ['kiesel', 0.5]] },
  ozean: { n: 0, liste: [] },
};
// Ufer (flaches Wasser neben Land): Biom des Zellen-Lands → Liste
export const UFER = {
  sumpf: [['seerose', 4], ['schilf', 3]],
  wiese: [['schilf', 2], ['seerose', 0.6]],
  wald: [['schilf', 1]],
  ebene: [['schilf', 1]],
};
