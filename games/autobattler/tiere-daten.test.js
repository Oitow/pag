// Dummy-Testdaten (nur für eigene Tests)
window.TIERE={baer:{name:"Bär",gruppe:"wald",rolle:"tank",hp:200,atk:20,def:14,spd:3,range:1,passiv:"dornen",aktiv:"heulen"},
wolf:{name:"Wolf",gruppe:"wald",rolle:"kaempfer",hp:160,atk:24,def:8,spd:6,range:1,passiv:"rudel",aktiv:"biss"},
adler:{name:"Adler",gruppe:"luft",rolle:"schuetze",hp:115,atk:27,def:7,spd:7,range:3,passiv:"erstschlag",aktiv:"sturzflug"},
eule:{name:"Eule",gruppe:"luft",rolle:"support",hp:150,atk:18,def:8,spd:5,range:2,passiv:"regeneration",aktiv:"heilung"},
biber:{name:"Biber",gruppe:"wald",rolle:"tank",hp:250,atk:14,def:15,spd:3,range:1,passiv:"panzer",aktiv:"schild"},
biene:{name:"Biene",gruppe:"insekt",rolle:"kaempfer",hp:165,atk:17,def:8,spd:9,range:1,passiv:"giftbiss",aktiv:"xyz"},
ameise:{name:"Ameise",gruppe:"insekt",rolle:"kaempfer",hp:170,atk:22,def:9,spd:6,range:1,passiv:"schwarm",aktiv:"ruf"},
skorpion:{name:"Skorpion",gruppe:"wueste",rolle:"schuetze",hp:150,atk:22,def:10,spd:5,range:4,passiv:"unbekannt",aktiv:"giftwolke"}};
window.FAEHIGKEITEN={passiv:{dornen:{name:"Dornen",text:"Reflektiert"}},aktiv:{heulen:{name:"Heulen",text:"+atk",ladung:7},biss:{name:"Biss",text:"200%",ladung:4}}};
window.SYNERGIEN={wald:{2:{atk:0.05},4:{atk:0.12}},polar:{2:{def:1}}};
