// Ackerbau im Erde-Labor – reine Regeln (ohne THREE): Feldfrüchte, Boden-Eignung, Wachstum in Spielstunden, Frost, Ernte.
// Klimaansprüche kommen aus wachstum.js (PFLANZEN, feld: true), Fruchtbarkeit aus boden.js. felder.js holt Ort/Wetter aus der Welt.
// Ein Beet: { f: Frucht-ID | null, p: Fortschritt 0…1 (1 = reif), g: Gesundheit 0…1 (0 = erfroren), w: Bodenwasser 0…1,
//             T: Jahresmittel °C am Ort, F: Feuchte 0…1 am Ort, fb: Fruchtbarkeit 0…1 des Oberbodens }
import { eignung, PFLANZEN } from './wachstum.js';
import { fruchtbarkeit } from './boden.js';

/**
 * Feldfrüchte: tage = Spieltage bis reif bei bester Eignung, ertrag = Stück je Beet (bei voller Gesundheit),
 * frost = wie empfindlich (1 = normal), durst = Wasserbedarf (2 = Reis will nassen Boden).
 */
export const FRUECHTE = {
  weizen:    { name: 'Weizen',    tage: 3,   ertrag: 4, frost: 0.6,  durst: 1 },
  roggen:    { name: 'Roggen',    tage: 3.5, ertrag: 4, frost: 0.25, durst: 0.8 },
  kartoffel: { name: 'Kartoffel', tage: 2.5, ertrag: 6, frost: 1.5,  durst: 1 },
  mais:      { name: 'Mais',      tage: 3.5, ertrag: 3, frost: 1.2,  durst: 1.2 },
  reis:      { name: 'Reis',      tage: 4,   ertrag: 5, frost: 1.3,  durst: 2 },
  hirse:     { name: 'Hirse',     tage: 2,   ertrag: 4, frost: 1.2,  durst: 0.6 },
};
export const saatVon = (f) => 'saat_' + f;
export const fruchtVonSaat = (id) => (id?.startsWith('saat_') && FRUECHTE[id.slice(5)] ? id.slice(5) : null);

/** Anzeigenamen der neuen Gegenstände (Saat + Ertrag). */
export const FELD_NAMEN = Object.fromEntries(Object.entries(FRUECHTE).flatMap(([f, d]) => [
  [f, d.name], [saatVon(f), f === 'kartoffel' ? 'Saatkartoffel' : d.name + '-Saat']]));

/** Stufe aus dem Fortschritt. */
export const STUFEN = ['saat', 'keimling', 'wachsend', 'reif'];
export const stufe = (p) => (p >= 1 ? 'reif' : p >= 0.4 ? 'wachsend' : p >= 0.12 ? 'keimling' : 'saat');

const ERDE = new Set(['humus', 'torf', 'lehm', 'roterLehm', 'sand']);
const klemme = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

/**
 * Kann man hier ein Beet umgraben? stoff = Oberboden (boden.js), wasser = steht Wasser drauf, steil = tan(Hang), schaufel = bool.
 * → { ok, grund?, fb (Fruchtbarkeit 0…1), warnung? }
 */
export function bodenPruefen({ stoff, wasser = false, steil = 0, schaufel = true }) {
  if (wasser) return { ok: false, grund: 'Im Wasser kann man kein Beet anlegen', fb: 0 };
  if (!schaufel) return { ok: false, grund: 'Schaufel nötig zum Umgraben', fb: 0 };
  if (stoff === 'schnee' || stoff === 'eis') return { ok: false, grund: 'Gefrorener Boden – hier wächst nichts', fb: 0 };
  if (stoff === 'kies') return { ok: false, grund: 'Zu steinig (Kies) – Erde oder Lehm suchen', fb: 0 };
  if (!ERDE.has(stoff)) return { ok: false, grund: 'Fels – hier lässt sich kein Beet anlegen', fb: 0 };
  if (steil > 0.6) return { ok: false, grund: 'Zu steil für ein Beet', fb: 0 };
  const fb = fruchtbarkeit([{ stoff }]);
  return { ok: true, fb, warnung: stoff === 'sand' ? 'Sandboden – hier wächst es schlecht' : '' };
}

/** Neues leeres Beet am Ort (T, F) mit Fruchtbarkeit fb. */
export const neuesBeet = (T, F, fb) => ({ f: null, p: 0, g: 1, w: klemme(F), T, F, fb });

/** Wachstum je Spielstunde (Anteil bis reif) – 0, wenn das Klima nicht passt. */
export function rate(b) {
  const d = FRUECHTE[b.f];
  if (!d || b.g <= 0) return 0;
  const e = eignung(b.f, b.T, b.F);
  if (e <= 0) return 0;
  const wasserF = 0.3 + 0.7 * Math.min(1, b.w / (0.35 * d.durst));
  return (0.4 + 0.6 * e) * (0.45 + 0.55 * b.fb) * wasserF / (d.tage * 24);
}

/**
 * Ein Zeitschritt für ein Beet (wird verändert). dh = Spielstunden, u = { tJetzt °C (Luft jetzt), regen 0…1 }.
 * → 'reif' | 'erfroren' | null (was ist in diesem Schritt passiert?)
 */
export function schrittBeet(b, dh, u = {}) {
  if (!(dh > 0)) return null;
  // Bodenwasser: Regen gießt (starker Regen füllt in ~2 h), trocknet in gut einem Tag – in feuchten Gegenden nie ganz
  const t = u.tJetzt ?? 15;
  b.w = klemme(b.w + (u.regen || 0) * dh * 0.5 - dh / 30 * (t > 25 ? 1.6 : 1), b.F * 0.7, 1);
  if (!b.f || b.g <= 0) return null;
  // Frost: Saat im Boden übersteht ihn, Pflanzen leiden (−5 °C: empfindliche nach ~6 h tot)
  if (t < 0 && b.p >= 0.12) {
    b.g = klemme(b.g - dh * FRUECHTE[b.f].frost * Math.min(1, (1 - t) / 6) / 8);
    if (b.g <= 0) return 'erfroren';
  }
  if (b.p >= 1) return null;
  const kalt = t < 4 ? 0.25 : 1;   // in kalten Stunden kaum Wachstum
  b.p = Math.min(1, b.p + rate(b) * kalt * dh);
  return b.p >= 1 ? 'reif' : null;
}

/** Ertrag eines reifen Beets (zufall 0…1). → [[id, anzahl]…] – Frucht + 2–3 Saat zurück. */
export function ernteMenge(b, zufall = Math.random()) {
  const d = FRUECHTE[b.f];
  if (!d || b.p < 1 || b.g <= 0) return [];
  return [[b.f, Math.max(1, Math.round(d.ertrag * (0.4 + 0.6 * b.g)))], [saatVon(b.f), 2 + (zufall < 0.5 ? 1 : 0)]];
}

/** Feldfrucht mit der besten Eignung am Ort (für die Startsaat; nie null). */
export function startFrucht(T, F) {
  let best = 'roggen', be = -1;
  for (const f of Object.keys(FRUECHTE)) { const e = PFLANZEN[f] ? eignung(f, T, F) : 0; if (e > be) { be = e; best = f; } }
  return best;
}

/** Welche Saat aus der Tasche säen? Beste Eignung am Ort, bei Gleichstand die häufigste. zaehle(id) → Anzahl. → Frucht | null */
export function besteSaat(T, F, zaehle) {
  let best = null, bw = -1;
  for (const f of Object.keys(FRUECHTE)) {
    const n = zaehle(saatVon(f));
    if (!(n > 0)) continue;
    const w = eignung(f, T, F) * 1000 + Math.min(n, 999);
    if (w > bw) { bw = w; best = f; }
  }
  return best;
}

/** Kurzer Zustandstext eines Beets fürs Melden. */
export function beetText(b) {
  if (!b.f) return 'Leeres Beet – mit 🌱 Säen einsäen';
  const d = FRUECHTE[b.f];
  if (b.g <= 0) return `${d.name} erfroren – mit Nehmen ausreißen`;
  if (b.p >= 1) return `${d.name} ist reif – Nehmen zum Ernten`;
  const r = rate(b);
  const rest = r > 0 ? ` · noch ~${Math.max(1, Math.round((1 - b.p) / r / 24 * 10) / 10)} Tage` : ' · wächst hier nicht (Klima)';
  const wort = { saat: 'gesät', keimling: 'keimt', wachsend: 'wächst' }[stufe(b.p)];
  return `${d.name} ${wort} ${Math.round(b.p * 100)} %${rest}${b.w < 0.2 ? ' · trocken' : ''}${b.g < 0.7 ? ' · Frostschaden' : ''}`;
}
