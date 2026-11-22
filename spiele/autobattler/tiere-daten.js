// Kampfdaten für den Autobattler (generiert). Budget: hp/10 + atk + def + spd*2 ≈ 60
window.TIERE = {
  adler: {name:"Adler",gruppe:"luft",rolle:"schuetze",hp:115,atk:27,def:7,spd:7,range:3,passiv:"erstschlag",aktiv:"sturzflug"},
  alpaka: {name:"Alpaka",gruppe:"bauernhof",rolle:"support",hp:170,atk:26,def:9,spd:4,range:2,passiv:"regeneration",aktiv:"spucken"},
  ameise: {name:"Ameise",gruppe:"insekt",rolle:"kaempfer",hp:170,atk:22,def:9,spd:6,range:1,passiv:"schwarm",aktiv:"ruf"},
  axolotl: {name:"Axolotl",gruppe:"wasser",rolle:"support",hp:230,atk:16,def:15,spd:3,range:2,passiv:"regeneration",aktiv:"heilung"},
  baer: {name:"Bär",gruppe:"wald",rolle:"tank",hp:200,atk:20,def:14,spd:3,range:1,passiv:"dornen",aktiv:"heilung"},
  beutelteufel: {name:"Beutelteufel",gruppe:"wald",rolle:"kaempfer",hp:160,atk:25,def:7,spd:6,range:1,passiv:"wut",aktiv:"biss"},
  biber: {name:"Biber",gruppe:"wald",rolle:"tank",hp:250,atk:14,def:15,spd:3,range:1,passiv:"panzer",aktiv:"schild"},
  biene: {name:"Biene",gruppe:"insekt",rolle:"kaempfer",hp:165,atk:17,def:8,spd:9,range:1,passiv:"giftbiss",aktiv:"ruf"},
  bison: {name:"Bison",gruppe:"savanne",rolle:"tank",hp:220,atk:16,def:14,spd:4,range:1,passiv:"dornen",aktiv:"stampfen"},
  chamaeleon: {name:"Chamäleon",gruppe:"dschungel",rolle:"schuetze",hp:165,atk:24,def:9,spd:5,range:3,passiv:"ausweichen",aktiv:"tarnung"},
  clownfisch: {name:"Clownfisch",gruppe:"wasser",rolle:"support",hp:170,atk:20,def:9,spd:7,range:2,passiv:"ausweichen",aktiv:"heilung"},
  dachs: {name:"Dachs",gruppe:"wald",rolle:"kaempfer",hp:170,atk:26,def:9,spd:4,range:1,passiv:"wut",aktiv:"biss"},
  delfin: {name:"Delfin",gruppe:"wasser",rolle:"support",hp:165,atk:18,def:9,spd:8,range:2,passiv:"rudel",aktiv:"heulen"},
  dingo: {name:"Dingo",gruppe:"wueste",rolle:"kaempfer",hp:170,atk:21,def:8,spd:7,range:1,passiv:"rudel",aktiv:"biss"},
  eichhoernchen: {name:"Eichhörnchen",gruppe:"wald",rolle:"schuetze",hp:140,atk:21,def:9,spd:8,range:3,passiv:"ausweichen",aktiv:"spucken"},
  eisbaer: {name:"Eisbär",gruppe:"polar",rolle:"tank",hp:200,atk:21,def:13,spd:3,range:1,passiv:"wut",aktiv:"stampfen"},
  elch: {name:"Elch",gruppe:"wald",rolle:"tank",hp:220,atk:17,def:13,spd:4,range:1,passiv:"dornen",aktiv:"stampfen"},
  elefant: {name:"Elefant",gruppe:"savanne",rolle:"tank",hp:240,atk:19,def:15,spd:1,range:1,passiv:"panzer",aktiv:"stampfen"},
  emu: {name:"Emu",gruppe:"wueste",rolle:"kaempfer",hp:145,atk:20,def:9,spd:8,range:1,passiv:"erstschlag",aktiv:"stampfen"},
  ente: {name:"Ente",gruppe:"wasser",rolle:"support",hp:170,atk:24,def:9,spd:5,range:2,passiv:"schwarm",aktiv:"ruf"},
  erdmaennchen: {name:"Erdmännchen",gruppe:"wueste",rolle:"support",hp:170,atk:20,def:9,spd:7,range:2,passiv:"rudel",aktiv:"ruf"},
  esel: {name:"Esel",gruppe:"bauernhof",rolle:"tank",hp:250,atk:14,def:15,spd:3,range:1,passiv:"panzer",aktiv:"schild"},
  eule: {name:"Eule",gruppe:"luft",rolle:"schuetze",hp:145,atk:26,def:9,spd:5,range:3,passiv:"erstschlag",aktiv:"sturzflug"},
  falke: {name:"Falke",gruppe:"luft",rolle:"schuetze",hp:120,atk:22,def:6,spd:10,range:3,passiv:"ausweichen",aktiv:"sturzflug"},
  faultier: {name:"Faultier",gruppe:"dschungel",rolle:"tank",hp:250,atk:18,def:15,spd:1,range:1,passiv:"regeneration",aktiv:"schild"},
  flamingo: {name:"Flamingo",gruppe:"wasser",rolle:"support",hp:170,atk:24,def:9,spd:5,range:2,passiv:"schwarm",aktiv:"heilung"},
  fledermaus: {name:"Fledermaus",gruppe:"luft",rolle:"kaempfer",hp:155,atk:19,def:7,spd:9,range:1,passiv:"lebensraub",aktiv:"sturzflug"},
  gans: {name:"Gans",gruppe:"bauernhof",rolle:"kaempfer",hp:170,atk:24,def:9,spd:5,range:1,passiv:"wut",aktiv:"ruf"},
  gecko: {name:"Gecko",gruppe:"wueste",rolle:"schuetze",hp:150,atk:20,def:9,spd:8,range:3,passiv:"ausweichen",aktiv:"tarnung"},
  gepard: {name:"Gepard",gruppe:"savanne",rolle:"kaempfer",hp:125,atk:23,def:4,spd:10,range:1,passiv:"erstschlag",aktiv:"biss"},
  gibbon: {name:"Gibbon",gruppe:"dschungel",rolle:"schuetze",hp:140,atk:21,def:9,spd:8,range:3,passiv:"ausweichen",aktiv:"ruf"},
  giraffe: {name:"Giraffe",gruppe:"savanne",rolle:"schuetze",hp:145,atk:26,def:13,spd:3,range:3,passiv:"panzer",aktiv:"stampfen"},
  gluehwuermchen: {name:"Glühwürmchen",gruppe:"insekt",rolle:"support",hp:170,atk:20,def:9,spd:7,range:2,passiv:"schwarm",aktiv:"heilung"},
  gnu: {name:"Gnu",gruppe:"savanne",rolle:"tank",hp:220,atk:15,def:15,spd:4,range:1,passiv:"schwarm",aktiv:"stampfen"},
  goldfisch: {name:"Goldfisch",gruppe:"wasser",rolle:"support",hp:170,atk:22,def:9,spd:6,range:2,passiv:"regeneration",aktiv:"spucken"},
  gorilla: {name:"Gorilla",gruppe:"dschungel",rolle:"tank",hp:220,atk:20,def:12,spd:3,range:1,passiv:"wut",aktiv:"stampfen"},
  gottesanbeterin: {name:"Gottesanbeterin",gruppe:"insekt",rolle:"kaempfer",hp:160,atk:26,def:6,spd:6,range:1,passiv:"erstschlag",aktiv:"tarnung"},
  guerteltier: {name:"Gürteltier",gruppe:"wueste",rolle:"tank",hp:250,atk:14,def:15,spd:3,range:1,passiv:"panzer",aktiv:"schild"},
  hahn: {name:"Hahn",gruppe:"bauernhof",rolle:"kaempfer",hp:170,atk:22,def:9,spd:6,range:1,passiv:"erstschlag",aktiv:"ruf"},
  hai: {name:"Hai",gruppe:"wasser",rolle:"kaempfer",hp:140,atk:26,def:6,spd:7,range:1,passiv:"lebensraub",aktiv:"biss"},
  hamster: {name:"Hamster",gruppe:"bauernhof",rolle:"support",hp:170,atk:20,def:9,spd:7,range:2,passiv:"regeneration",aktiv:"tarnung"},
  hase: {name:"Hase",gruppe:"wald",rolle:"support",hp:165,atk:16,def:9,spd:9,range:2,passiv:"ausweichen",aktiv:"heilung"},
  heuschrecke: {name:"Heuschrecke",gruppe:"insekt",rolle:"kaempfer",hp:165,atk:18,def:9,spd:8,range:1,passiv:"schwarm",aktiv:"sturzflug"},
  hirschkaefer: {name:"Hirschkäfer",gruppe:"insekt",rolle:"tank",hp:240,atk:15,def:15,spd:3,range:1,passiv:"panzer",aktiv:"betaeubung"},
  huhn: {name:"Huhn",gruppe:"bauernhof",rolle:"support",hp:170,atk:24,def:9,spd:5,range:2,passiv:"schwarm",aktiv:"heilung"},
  hummel: {name:"Hummel",gruppe:"insekt",rolle:"support",hp:170,atk:22,def:9,spd:6,range:2,passiv:"schwarm",aktiv:"heilung"},
  hummer: {name:"Hummer",gruppe:"wasser",rolle:"tank",hp:230,atk:16,def:15,spd:3,range:1,passiv:"panzer",aktiv:"betaeubung"},
  hund: {name:"Hund",gruppe:"bauernhof",rolle:"kaempfer",hp:170,atk:20,def:9,spd:7,range:1,passiv:"rudel",aktiv:"heulen"},
  hyaene: {name:"Hyäne",gruppe:"savanne",rolle:"kaempfer",hp:160,atk:22,def:8,spd:7,range:1,passiv:"rudel",aktiv:"heulen"},
  igel: {name:"Igel",gruppe:"wald",rolle:"tank",hp:250,atk:14,def:15,spd:3,range:1,passiv:"dornen",aktiv:"schild"},
  kaenguru: {name:"Känguru",gruppe:"wueste",rolle:"kaempfer",hp:160,atk:22,def:8,spd:7,range:1,passiv:"erstschlag",aktiv:"betaeubung"},
  kakadu: {name:"Kakadu",gruppe:"dschungel",rolle:"schuetze",hp:145,atk:22,def:9,spd:7,range:3,passiv:"schwarm",aktiv:"ruf"},
  kamel: {name:"Kamel",gruppe:"wueste",rolle:"tank",hp:250,atk:14,def:15,spd:3,range:1,passiv:"regeneration",aktiv:"spucken"},
  kiwi: {name:"Kiwi",gruppe:"wald",rolle:"support",hp:170,atk:24,def:9,spd:5,range:2,passiv:"ausweichen",aktiv:"tarnung"},
  koala: {name:"Koala",gruppe:"wald",rolle:"support",hp:250,atk:16,def:15,spd:2,range:2,passiv:"regeneration",aktiv:"heilung"},
  kolibri: {name:"Kolibri",gruppe:"luft",rolle:"support",hp:165,atk:14,def:9,spd:10,range:2,passiv:"ausweichen",aktiv:"heilung"},
  kookaburra: {name:"Kookaburra",gruppe:"luft",rolle:"schuetze",hp:155,atk:23,def:9,spd:6,range:3,passiv:"erstschlag",aktiv:"ruf"},
  krabbe: {name:"Krabbe",gruppe:"wasser",rolle:"tank",hp:240,atk:13,def:15,spd:4,range:1,passiv:"dornen",aktiv:"betaeubung"},
  kranich: {name:"Kranich",gruppe:"luft",rolle:"schuetze",hp:155,atk:23,def:9,spd:6,range:3,passiv:"ausweichen",aktiv:"sturzflug"},
  kroete: {name:"Kröte",gruppe:"wald",rolle:"support",hp:230,atk:16,def:15,spd:3,range:2,passiv:"giftbiss",aktiv:"gaswolke"},
  krokodil: {name:"Krokodil",gruppe:"wasser",rolle:"tank",hp:210,atk:22,def:11,spd:3,range:1,passiv:"panzer",aktiv:"biss"},
  kueken: {name:"Küken",gruppe:"bauernhof",rolle:"support",hp:170,atk:22,def:9,spd:6,range:2,passiv:"schwarm",aktiv:"heilung"},
  kugelfisch: {name:"Kugelfisch",gruppe:"wasser",rolle:"tank",hp:250,atk:14,def:15,spd:3,range:1,passiv:"dornen",aktiv:"gaswolke"},
  kuh: {name:"Kuh",gruppe:"bauernhof",rolle:"tank",hp:250,atk:16,def:15,spd:2,range:1,passiv:"regeneration",aktiv:"gaswolke"},
  lama: {name:"Lama",gruppe:"bauernhof",rolle:"schuetze",hp:165,atk:24,def:9,spd:5,range:3,passiv:"dornen",aktiv:"spucken"},
  leguan: {name:"Leguan",gruppe:"wueste",rolle:"tank",hp:250,atk:14,def:15,spd:3,range:1,passiv:"regeneration",aktiv:"schild"},
  lemming: {name:"Lemming",gruppe:"polar",rolle:"kaempfer",hp:165,atk:18,def:9,spd:8,range:1,passiv:"schwarm",aktiv:"ruf"},
  lemur: {name:"Lemur",gruppe:"dschungel",rolle:"support",hp:170,atk:20,def:9,spd:7,range:2,passiv:"rudel",aktiv:"heulen"},
  leopard: {name:"Leopard",gruppe:"savanne",rolle:"kaempfer",hp:125,atk:24,def:7,spd:8,range:1,passiv:"ausweichen",aktiv:"tarnung"},
  libelle: {name:"Libelle",gruppe:"insekt",rolle:"schuetze",hp:130,atk:21,def:6,spd:10,range:3,passiv:"ausweichen",aktiv:"sturzflug"},
  loewe: {name:"Löwe",gruppe:"savanne",rolle:"kaempfer",hp:150,atk:26,def:9,spd:5,range:1,passiv:"rudel",aktiv:"heulen"},
  luchs: {name:"Luchs",gruppe:"wald",rolle:"kaempfer",hp:160,atk:23,def:7,spd:7,range:1,passiv:"erstschlag",aktiv:"tarnung"},
  mandrill: {name:"Mandrill",gruppe:"dschungel",rolle:"kaempfer",hp:160,atk:23,def:9,spd:6,range:1,passiv:"wut",aktiv:"ruf"},
  marienkaefer: {name:"Marienkäfer",gruppe:"insekt",rolle:"support",hp:170,atk:24,def:9,spd:5,range:2,passiv:"panzer",aktiv:"heilung"},
  maulwurf: {name:"Maulwurf",gruppe:"wald",rolle:"kaempfer",hp:170,atk:26,def:9,spd:4,range:1,passiv:"panzer",aktiv:"betaeubung"},
  maus: {name:"Maus",gruppe:"bauernhof",rolle:"kaempfer",hp:165,atk:16,def:9,spd:9,range:1,passiv:"schwarm",aktiv:"tarnung"},
  meerschweinchen: {name:"Meerschweinchen",gruppe:"bauernhof",rolle:"support",hp:170,atk:24,def:9,spd:5,range:2,passiv:"regeneration",aktiv:"spucken"},
  moewe: {name:"Möwe",gruppe:"luft",rolle:"schuetze",hp:145,atk:22,def:9,spd:7,range:3,passiv:"schwarm",aktiv:"sturzflug"},
  moschusochse: {name:"Moschusochse",gruppe:"polar",rolle:"tank",hp:240,atk:15,def:15,spd:3,range:1,passiv:"panzer",aktiv:"stampfen"},
  narwal: {name:"Narwal",gruppe:"polar",rolle:"kaempfer",hp:170,atk:24,def:9,spd:5,range:1,passiv:"erstschlag",aktiv:"biss"},
  nasenbaer: {name:"Nasenbär",gruppe:"dschungel",rolle:"kaempfer",hp:170,atk:22,def:9,spd:6,range:1,passiv:"rudel",aktiv:"ruf"},
  nashorn: {name:"Nashorn",gruppe:"savanne",rolle:"tank",hp:200,atk:22,def:14,spd:2,range:1,passiv:"dornen",aktiv:"stampfen"},
  nilpferd: {name:"Nilpferd",gruppe:"savanne",rolle:"tank",hp:220,atk:19,def:15,spd:2,range:1,passiv:"wut",aktiv:"stampfen"},
  oktopus: {name:"Oktopus",gruppe:"wasser",rolle:"support",hp:170,atk:22,def:9,spd:6,range:2,passiv:"ausweichen",aktiv:"giftwolke"},
  orangutan: {name:"Orang-Utan",gruppe:"dschungel",rolle:"tank",hp:220,atk:17,def:15,spd:3,range:1,passiv:"regeneration",aktiv:"schild"},
  orca: {name:"Orca",gruppe:"polar",rolle:"kaempfer",hp:140,atk:26,def:8,spd:6,range:1,passiv:"rudel",aktiv:"biss"},
  otter: {name:"Otter",gruppe:"wasser",rolle:"kaempfer",hp:170,atk:20,def:9,spd:7,range:1,passiv:"rudel",aktiv:"heilung"},
  ozelot: {name:"Ozelot",gruppe:"dschungel",rolle:"kaempfer",hp:145,atk:22,def:7,spd:8,range:1,passiv:"erstschlag",aktiv:"tarnung"},
  panda: {name:"Panda",gruppe:"wald",rolle:"tank",hp:250,atk:16,def:15,spd:2,range:1,passiv:"regeneration",aktiv:"schild"},
  papagei: {name:"Papagei",gruppe:"dschungel",rolle:"schuetze",hp:155,atk:21,def:9,spd:7,range:3,passiv:"schwarm",aktiv:"ruf"},
  pelikan: {name:"Pelikan",gruppe:"wasser",rolle:"schuetze",hp:165,atk:26,def:9,spd:4,range:3,passiv:"regeneration",aktiv:"sturzflug"},
  pfau: {name:"Pfau",gruppe:"dschungel",rolle:"support",hp:170,atk:26,def:9,spd:4,range:2,passiv:"dornen",aktiv:"betaeubung"},
  pfeilgiftfrosch: {name:"Pfeilgiftfrosch",gruppe:"dschungel",rolle:"schuetze",hp:155,atk:21,def:9,spd:7,range:3,passiv:"giftbiss",aktiv:"giftwolke"},
  pferd: {name:"Pferd",gruppe:"bauernhof",rolle:"kaempfer",hp:145,atk:20,def:9,spd:8,range:1,passiv:"erstschlag",aktiv:"stampfen"},
  polarfuchs: {name:"Polarfuchs",gruppe:"polar",rolle:"kaempfer",hp:145,atk:19,def:8,spd:9,range:1,passiv:"ausweichen",aktiv:"biss"},
  pony: {name:"Pony",gruppe:"bauernhof",rolle:"tank",hp:220,atk:13,def:15,spd:5,range:1,passiv:"dornen",aktiv:"stampfen"},
  puma: {name:"Puma",gruppe:"wald",rolle:"kaempfer",hp:135,atk:23,def:7,spd:8,range:1,passiv:"wut",aktiv:"sturzflug"},
  qualle: {name:"Qualle",gruppe:"wasser",rolle:"support",hp:250,atk:16,def:13,spd:3,range:2,passiv:"giftbiss",aktiv:"giftwolke"},
  rabe: {name:"Rabe",gruppe:"luft",rolle:"schuetze",hp:145,atk:22,def:9,spd:7,range:3,passiv:"schwarm",aktiv:"ruf"},
  raupe: {name:"Raupe",gruppe:"insekt",rolle:"support",hp:250,atk:16,def:15,spd:2,range:2,passiv:"regeneration",aktiv:"giftwolke"},
  reh: {name:"Reh",gruppe:"wald",rolle:"support",hp:165,atk:16,def:9,spd:9,range:2,passiv:"ausweichen",aktiv:"heilung"},
  rentier: {name:"Rentier",gruppe:"polar",rolle:"tank",hp:210,atk:14,def:15,spd:5,range:1,passiv:"rudel",aktiv:"stampfen"},
  robbe: {name:"Robbe",gruppe:"polar",rolle:"tank",hp:240,atk:13,def:15,spd:4,range:1,passiv:"regeneration",aktiv:"schild"},
  rochen: {name:"Rochen",gruppe:"wasser",rolle:"schuetze",hp:165,atk:24,def:9,spd:5,range:3,passiv:"giftbiss",aktiv:"betaeubung"},
  rotkehlchen: {name:"Rotkehlchen",gruppe:"luft",rolle:"support",hp:165,atk:18,def:9,spd:8,range:2,passiv:"regeneration",aktiv:"heilung"},
  rotpanda: {name:"Roter Panda",gruppe:"wald",rolle:"support",hp:170,atk:22,def:9,spd:6,range:2,passiv:"ausweichen",aktiv:"heulen"},
  salamander: {name:"Salamander",gruppe:"wald",rolle:"support",hp:170,atk:26,def:9,spd:4,range:2,passiv:"giftbiss",aktiv:"giftwolke"},
  schaf: {name:"Schaf",gruppe:"bauernhof",rolle:"tank",hp:250,atk:14,def:15,spd:3,range:1,passiv:"panzer",aktiv:"schild"},
  schimpanse: {name:"Schimpanse",gruppe:"dschungel",rolle:"kaempfer",hp:170,atk:22,def:9,spd:6,range:1,passiv:"rudel",aktiv:"heulen"},
  schlange: {name:"Schlange",gruppe:"dschungel",rolle:"kaempfer",hp:170,atk:21,def:8,spd:7,range:1,passiv:"giftbiss",aktiv:"biss"},
  schmetterling: {name:"Schmetterling",gruppe:"insekt",rolle:"support",hp:165,atk:18,def:9,spd:8,range:2,passiv:"ausweichen",aktiv:"heilung"},
  schnabeltier: {name:"Schnabeltier",gruppe:"wasser",rolle:"kaempfer",hp:170,atk:24,def:9,spd:5,range:1,passiv:"giftbiss",aktiv:"tarnung"},
  schnecke: {name:"Schnecke",gruppe:"insekt",rolle:"tank",hp:250,atk:18,def:15,spd:1,range:1,passiv:"panzer",aktiv:"giftwolke"},
  schneeeule: {name:"Schneeeule",gruppe:"polar",rolle:"schuetze",hp:145,atk:24,def:9,spd:6,range:3,passiv:"erstschlag",aktiv:"sturzflug"},
  schneehase: {name:"Schneehase",gruppe:"polar",rolle:"support",hp:165,atk:16,def:9,spd:9,range:2,passiv:"ausweichen",aktiv:"tarnung"},
  schneeleopard: {name:"Schneeleopard",gruppe:"polar",rolle:"kaempfer",hp:125,atk:24,def:7,spd:8,range:1,passiv:"erstschlag",aktiv:"sturzflug"},
  schwan: {name:"Schwan",gruppe:"wasser",rolle:"tank",hp:230,atk:14,def:15,spd:4,range:1,passiv:"wut",aktiv:"schild"},
  schwein: {name:"Schwein",gruppe:"bauernhof",rolle:"tank",hp:250,atk:14,def:15,spd:3,range:1,passiv:"regeneration",aktiv:"gaswolke"},
  seeloewe: {name:"Seelöwe",gruppe:"polar",rolle:"support",hp:170,atk:24,def:9,spd:5,range:2,passiv:"rudel",aktiv:"heulen"},
  seepferdchen: {name:"Seepferdchen",gruppe:"wasser",rolle:"support",hp:170,atk:26,def:9,spd:4,range:2,passiv:"panzer",aktiv:"heilung"},
  seestern: {name:"Seestern",gruppe:"wasser",rolle:"tank",hp:250,atk:18,def:15,spd:1,range:1,passiv:"regeneration",aktiv:"schild"},
  skorpion: {name:"Skorpion",gruppe:"wueste",rolle:"kaempfer",hp:170,atk:24,def:9,spd:5,range:1,passiv:"giftbiss",aktiv:"betaeubung"},
  spatz: {name:"Spatz",gruppe:"luft",rolle:"schuetze",hp:150,atk:18,def:9,spd:9,range:3,passiv:"schwarm",aktiv:"ruf"},
  specht: {name:"Specht",gruppe:"wald",rolle:"schuetze",hp:145,atk:22,def:9,spd:7,range:3,passiv:"erstschlag",aktiv:"betaeubung"},
  spinne: {name:"Spinne",gruppe:"insekt",rolle:"schuetze",hp:165,atk:22,def:9,spd:6,range:3,passiv:"giftbiss",aktiv:"betaeubung"},
  storch: {name:"Storch",gruppe:"luft",rolle:"schuetze",hp:165,atk:24,def:9,spd:5,range:3,passiv:"lebensraub",aktiv:"sturzflug"},
  strauss: {name:"Strauß",gruppe:"wueste",rolle:"kaempfer",hp:135,atk:20,def:8,spd:9,range:1,passiv:"erstschlag",aktiv:"stampfen"},
  taube: {name:"Taube",gruppe:"luft",rolle:"support",hp:165,atk:18,def:9,spd:8,range:2,passiv:"schwarm",aktiv:"heilung"},
  tapir: {name:"Tapir",gruppe:"dschungel",rolle:"tank",hp:250,atk:14,def:15,spd:3,range:1,passiv:"dornen",aktiv:"schild"},
  tiger: {name:"Tiger",gruppe:"dschungel",rolle:"kaempfer",hp:140,atk:26,def:6,spd:7,range:1,passiv:"lebensraub",aktiv:"biss"},
  truthahn: {name:"Truthahn",gruppe:"bauernhof",rolle:"kaempfer",hp:170,atk:26,def:9,spd:4,range:1,passiv:"wut",aktiv:"ruf"},
  tukan: {name:"Tukan",gruppe:"dschungel",rolle:"schuetze",hp:155,atk:23,def:9,spd:6,range:3,passiv:"lebensraub",aktiv:"spucken"},
  wal: {name:"Wal",gruppe:"wasser",rolle:"tank",hp:250,atk:18,def:15,spd:1,range:1,passiv:"lebensraub",aktiv:"stampfen"},
  wallaby: {name:"Wallaby",gruppe:"wueste",rolle:"kaempfer",hp:155,atk:19,def:9,spd:8,range:1,passiv:"ausweichen",aktiv:"heulen"},
  walross: {name:"Walross",gruppe:"polar",rolle:"tank",hp:240,atk:17,def:15,spd:2,range:1,passiv:"dornen",aktiv:"stampfen"},
  waran: {name:"Waran",gruppe:"wueste",rolle:"kaempfer",hp:170,atk:24,def:9,spd:5,range:1,passiv:"giftbiss",aktiv:"biss"},
  waschbaer: {name:"Waschbär",gruppe:"wald",rolle:"kaempfer",hp:170,atk:22,def:9,spd:6,range:1,passiv:"lebensraub",aktiv:"tarnung"},
  wasserschwein: {name:"Wasserschwein",gruppe:"dschungel",rolle:"support",hp:230,atk:16,def:15,spd:3,range:2,passiv:"regeneration",aktiv:"schild"},
  wellensittich: {name:"Wellensittich",gruppe:"luft",rolle:"schuetze",hp:150,atk:20,def:9,spd:8,range:3,passiv:"schwarm",aktiv:"spucken"},
  wildschwein: {name:"Wildschwein",gruppe:"wald",rolle:"kaempfer",hp:170,atk:24,def:9,spd:5,range:1,passiv:"wut",aktiv:"stampfen"},
  wolf: {name:"Wolf",gruppe:"wald",rolle:"kaempfer",hp:160,atk:23,def:7,spd:7,range:1,passiv:"rudel",aktiv:"heulen"},
  wombat: {name:"Wombat",gruppe:"wald",rolle:"tank",hp:250,atk:14,def:15,spd:3,range:1,passiv:"panzer",aktiv:"betaeubung"},
  yak: {name:"Yak",gruppe:"polar",rolle:"tank",hp:250,atk:16,def:15,spd:2,range:1,passiv:"dornen",aktiv:"schild"},
  zebra: {name:"Zebra",gruppe:"savanne",rolle:"kaempfer",hp:145,atk:20,def:9,spd:8,range:1,passiv:"schwarm",aktiv:"heulen"},
  ziege: {name:"Ziege",gruppe:"bauernhof",rolle:"kaempfer",hp:170,atk:22,def:9,spd:6,range:1,passiv:"wut",aktiv:"betaeubung"}
};

window.FAEHIGKEITEN = {
  "passiv": {
    "dornen": {
      "name": "Dornen",
      "text": "Reflektiert 25% des erlittenen Nahkampfschadens."
    },
    "ausweichen": {
      "name": "Ausweichen",
      "text": "20% Chance, einem Angriff auszuweichen."
    },
    "regeneration": {
      "name": "Regeneration",
      "text": "Heilt jede Sekunde 2% der max. HP."
    },
    "rudel": {
      "name": "Rudel",
      "text": "+6% atk je weiterem Verbündeten derselben Gruppe."
    },
    "panzer": {
      "name": "Panzer",
      "text": "Der erste erlittene Treffer wird um 70% reduziert."
    },
    "giftbiss": {
      "name": "Giftbiss",
      "text": "Angriffe vergiften: 3 Schaden/s für 4 s (nicht stapelbar)."
    },
    "erstschlag": {
      "name": "Erstschlag",
      "text": "Der erste Angriff des Kampfes verursacht doppelten Schaden."
    },
    "wut": {
      "name": "Wut",
      "text": "Unter 40% HP: +35% atk."
    },
    "schwarm": {
      "name": "Schwarm",
      "text": "+3% atk und +3% spd je Verbündetem im Team mit Schwarm."
    },
    "lebensraub": {
      "name": "Lebensraub",
      "text": "Heilt sich um 15% des verursachten Schadens."
    }
  },
  "aktiv": {
    "heulen": {
      "name": "Heulen",
      "text": "Alle Verbündeten erhalten +20% atk für 4 s.",
      "ladung": 7
    },
    "heilung": {
      "name": "Heilung",
      "text": "Heilt den schwächsten Verbündeten um 25% seiner max. HP.",
      "ladung": 6
    },
    "gaswolke": {
      "name": "Gaswolke",
      "text": "Fügt allen Gegnern 60% atk Schaden zu und senkt ihre atk 3 s um 15% (Konter gegen Rudel).",
      "ladung": 8
    },
    "betaeubung": {
      "name": "Betäubung",
      "text": "Betäubt das Ziel für 1,5 s.",
      "ladung": 7
    },
    "sturzflug": {
      "name": "Sturzflug",
      "text": "Springt auf einen Gegner der Hinterreihe und trifft ihn mit 150% atk.",
      "ladung": 6
    },
    "schild": {
      "name": "Schild",
      "text": "Gibt sich und dem Nachbarn einen Schild von 20% der max. HP.",
      "ladung": 7
    },
    "spucken": {
      "name": "Spucken",
      "text": "Fernschuss auf den entferntesten Gegner: 120% atk, -2 def für 4 s.",
      "ladung": 5
    },
    "stampfen": {
      "name": "Stampfen",
      "text": "Trifft alle Gegner der Vorderreihe mit 80% atk.",
      "ladung": 8
    },
    "tarnung": {
      "name": "Tarnung",
      "text": "Unanvisierbar für 2 s, nächster Angriff +50% Schaden.",
      "ladung": 6
    },
    "giftwolke": {
      "name": "Giftwolke",
      "text": "Vergiftet alle Gegner: 4 Schaden/s für 4 s.",
      "ladung": 9
    },
    "ruf": {
      "name": "Ruf",
      "text": "Senkt die def aller Gegner um 3 für 4 s.",
      "ladung": 5
    },
    "biss": {
      "name": "Biss",
      "text": "Kräftiger Biss: 200% atk auf das aktuelle Ziel.",
      "ladung": 4
    }
  }
};

window.SYNERGIEN = {
  "wald": {
    "2": {
      "atk": 0.05
    },
    "4": {
      "atk": 0.12
    }
  },
  "savanne": {
    "2": {
      "spd": 0.05
    },
    "4": {
      "spd": 0.1
    }
  },
  "bauernhof": {
    "2": {
      "hp": 0.06
    },
    "4": {
      "hp": 0.14
    }
  },
  "wasser": {
    "2": {
      "heal": 0.03
    },
    "4": {
      "heal": 0.07
    }
  },
  "luft": {
    "2": {
      "ausweichen": 0.04
    },
    "4": {
      "ausweichen": 0.09
    }
  },
  "insekt": {
    "2": {
      "spd": 0.06
    },
    "4": {
      "atk": 0.06,
      "spd": 0.08
    }
  },
  "polar": {
    "2": {
      "def": 1
    },
    "4": {
      "def": 3
    }
  },
  "dschungel": {
    "2": {
      "ladung": -0.05
    },
    "4": {
      "ladung": -0.12
    }
  },
  "wueste": {
    "2": {
      "def": 0.05
    },
    "4": {
      "hp": 0.06,
      "def": 0.08
    }
  }
};
