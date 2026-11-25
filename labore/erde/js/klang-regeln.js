// Klang-Regeln (rein, ohne WebAudio): welche Geräusche mit welcher Stärke (0…1) – testbar ohne Ohren.
// eingabe: { wind 0…1, regen 0…1, hoehe m über Boden, tempo m/s, meer 0…1 (Anteil Wasserpunkte ringsum),
//            stunde (Ortszeit), warm (bool), wald 0…1 (Pflanzenreichtum), amBoden, schwimmt, gehen, innen? }
const klemme = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export function klangPegel(e) {
  const nacht = e.stunde < 5.5 || e.stunde > 20.5;
  const daemmerung = !nacht && (e.stunde < 7 || e.stunde > 19) ? 0.5 : 1;
  const hoch = klemme(e.hoehe / 400);
  const flug = e.gehen ? 0 : klemme(e.tempo / 40);          // schnell im Gleiter = Fahrtwind
  const wind = klemme(0.12 + 0.55 * e.wind + 0.3 * hoch + 0.5 * flug);
  const meer = klemme(e.meer * (0.35 + 0.65 * e.wind + 0.0)) * (e.hoehe < 60 ? 1 : 0.3);
  const regen = klemme(e.regen * 1.2);
  // Vögel: Chance je Sekunde für einen Ruf
  const voegel = nacht ? 0 : klemme(e.wald, 0, 1) * 0.6 * daemmerung * (1 - 0.85 * klemme(e.regen * 1.5));
  const grillen = nacht && e.warm && e.regen < 0.3 ? 0.2 + 0.6 * klemme(e.wald + 0.3) : 0;
  const schritt = e.schwimmt ? 0 : (e.gehen && e.amBoden && e.tempo > 0.4 ? 1 : 0);
  const platsch = e.schwimmt && e.tempo > 0.3 ? 1 : 0;
  // Schrittabstand in s aus dem Tempo (schnell = kürzer)
  const schrittAbstand = klemme(1.6 / Math.max(e.tempo, 0.1), 0.28, 0.8);
  return { wind, meer, regen, voegel, grillen, schritt, platsch, schrittAbstand };
}
