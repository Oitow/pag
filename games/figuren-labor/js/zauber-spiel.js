// Figuren-Labor – Zauber im Spiel: verbindet engine/gameplay/zauber (Logik) mit Figur, Effekten, Klang, Kamera, NPCs und der Horde.
// Schweres Zaubern: Halten = Aufladen (Figur holt aus, wird langsam, Funken und Brummen wachsen), weiter halten = Überladen,
// Loslassen = Schlag mit Rückstoß, Kamera-Wackeln, kurzem Treffer-Stopp und Schadens-Zahlen.
import * as THREE from 'three';
import { createZauberbuch, zielImKegel, ZAUBER } from '../../../engine/gameplay/zauber.js';
import { createZauberEffekte } from '../../../engine/render/zauber-effekte.js';
import { createTrefferZahlen } from '../../../engine/ui/treffer-zahlen.js';
import { CLIPS } from '../../../engine/models/character/character-clips.js';
import { rng, hashSeed } from '../../../engine/core/rng.js';

const BEIDHAENDIG = new Set(['zauberStoss', 'zauberHimmel', 'zauberSelbst']);
const GROESSE = { feuerball: 0.34, eislanze: 0.17, arkan: 0.15 };
const GRUND = { mana: 'Zu wenig Mana', abklingzeit: 'Lädt noch …', wirkt: null, unbekannt: null };
const KLANG_START = { feuerball: 'zisch', eislanze: 'eis', arkan: 'zisch', blitz: 'blitz', windstoss: 'zisch', blinzeln: 'zisch', heilung: 'heilen', schild: 'heilen' };
const hex = (f) => '#' + f.toString(16).padStart(6, '0');

/**
 * opts: { spieler, npcs: [{ fig }], npcsAn(), horde (gameplay/horde, optional), szene, welt (Adapter), kamera, lockZiel() -> Figur|null,
 *   seed, klang (audio/klang, optional), onMeldung(text), onSchmerz(anteil) }
 */
export function createZauberSpiel({ spieler, npcs, npcsAn = () => true, horde = null, szene, welt, kamera, lockZiel = () => null, seed = 1,
  klang = null, onMeldung = () => {}, onSchmerz = () => {} }) {
  const buch = createZauberbuch({ welt });
  const fx = createZauberEffekte({ seed, maxPartikel: 1400 });
  const zahlen = createTrefferZahlen({ max: 32, seed });
  szene.add(fx.gruppe);
  const v = new THREE.Vector3(), v2 = new THREE.Vector3();
  const ziele = [];
  const st = { leben: 100, lebenMax: 100, schild: 0, drehYaw: null, drehRest: 0, stopp: 0, tot: 0, ladeKugel: -1 };
  const ton = (n, o) => klang?.spiele(n, o);
  const zr = rng(hashSeed('zauber-spiel', seed));
  for (const n of npcs) Object.assign(n, { leben: 100, liegt: 0, langsam: 0 });

  // Ziel-Kreis am Boden während des Aufladens (zeigt Ort und Radius, wächst beim Überladen)
  const kreis = new THREE.Group();
  const kreisMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const flaecheMat = kreisMat.clone(); flaecheMat.opacity = 0.12;
  const kreisRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), kreisMat);
  const kreisFlaeche = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), flaecheMat);
  kreis.add(kreisRing, kreisFlaeche); kreis.visible = false; szene.add(kreis);

  /** Punkt, an dem der Zauber entsteht: rechte Hand oder Mitte beider Hände. */
  function handPos(clip) {
    const s = spieler.model.rig.sockel;
    s.handR.getWorldPosition(v);
    if (BEIDHAENDIG.has(clip)) v.add(s.handL.getWorldPosition(v2)).multiplyScalar(0.5);
    return { x: v.x, y: v.y, z: v.z };
  }
  function zieleSammeln() {
    ziele.length = 0;
    if (horde) for (const w of horde.ziele) ziele.push(w);
    if (!npcsAn()) return;
    for (const n of npcs) {
      if (n.liegt > 0) continue;
      const p = n.fig.zustand.pos, m = n.fig.model.masse;
      const z = n.zielObj ??= { id: n.fig.name, npc: n };
      z.x = p.x; z.y = p.y; z.z = p.z; z.radius = m.radius; z.hoehe = m.augenHoehe + 0.15;
      ziele.push(z);
    }
  }

  // ---- Zielen: Lock-On, sonst dichtester Haufen (Flächenzauber) bzw. bestes Ziel im Blickkegel ----
  const blickYaw = () => (kamera.erstePerson ? kamera.yaw : kamera.blickYaw());
  function haufen(def, yaw, kegel = 0.75) {
    const p = spieler.zustand.pos, r = Math.max(1.5, def.radius || 2), reich = def.reichweite || 15;
    let best = null, bw = 0;
    for (const a of ziele) {
      const dx = a.x - p.x, dz = a.z - p.z, d = Math.hypot(dx, dz);
      if (d > reich || d < 1.2) continue;
      const w = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - yaw), Math.cos(Math.atan2(dx, dz) - yaw)));
      if (w > kegel) continue;
      let n = 0, sx = 0, sz = 0;
      for (const b of ziele) if (Math.hypot(b.x - a.x, b.z - a.z) < r) { n++; sx += b.x; sz += b.z; }
      const wert = n - d * 0.02 - w * 0.5;
      if (wert > bw) { bw = wert; best = { x: sx / n, z: sz / n }; }
    }
    return best;
  }
  function zielen(def) {
    const z = spieler.zustand, yaw = blickYaw();
    const fest = lockZiel(), lock = fest && ziele.find((q) => q.npc?.fig === fest);
    if (def.art === 'selbst' || def.art === 'nova' || def.art === 'kegel') return { yaw, ziel: null, punkt: null };
    if (def.art === 'teleport') return { yaw, ziel: null, punkt: null };
    const flaeche = def.radius > 0 && (def.art === 'ort' || def.fall);
    if (lock) return { yaw: Math.atan2(lock.x - z.pos.x, lock.z - z.pos.z), ziel: flaeche ? null : lock, punkt: flaeche ? { x: lock.x, z: lock.z } : null };
    if (flaeche) {
      const h = haufen(def, yaw) || haufen(def, yaw, Math.PI);   // vorn zuerst, sonst der größte Haufen ringsum
      const p = h || { x: z.pos.x + Math.sin(yaw) * def.reichweite * 0.5, z: z.pos.z + Math.cos(yaw) * def.reichweite * 0.5 };
      return { yaw: Math.atan2(p.x - z.pos.x, p.z - z.pos.z), ziel: null, punkt: p };
    }
    const a = zielImKegel(ziele, z.pos, yaw, def.reichweite || 20, 0.45) || zielImKegel(ziele, z.pos, yaw, (def.reichweite || 20) * 0.6, Math.PI);
    return { yaw: a ? Math.atan2(a.x - z.pos.x, a.z - z.pos.z) : yaw, ziel: a, punkt: a ? { x: a.x, z: a.z } : null };
  }

  /** Zauber beginnen. halten = Taste bleibt gedrückt (Aufladen bis loslassen()). */
  function wirke(name, { halten = false } = {}) {
    const z = spieler.zustand;
    if (z.imWasser || spieler.animator.liegt || st.tot > 0) return false;
    const k = buch.kann(name);
    if (!k.ok) { if (GRUND[k.grund]) { onMeldung(GRUND[k.grund]); ton('fehl'); } return false; }
    const def = k.def, clip = CLIPS[def.clip];
    spieler.spiele(def.clip, { halteBei: true });
    buch.wirke(name, {
      halten, vorlauf: Math.max(def.wirkzeit, clip.spannBei), schlag: clip.trefferBei - clip.spannBei,
      ziel: () => { const a = zielen(buch.zauber[name]); st.drehYaw = a.yaw; return { von: handPos(def.clip), fuss: spieler.zustand.pos, yaw: a.yaw, ziel: a.ziel, punkt: a.punkt }; },
    });
    st.drehRest = 0;
    ton('entladen', { staerke: 0.25, tonhoehe: 0.5 });
    return true;
  }

  // ---- Treffer ----
  let zahlenFrei = 8;
  function zahl(pos, schaden, farbe, tot) {
    if (schaden <= 0 || zahlenFrei-- <= 0) return;
    zahlen.zeige(pos, String(schaden), { farbe: tot ? '#ffe070' : hex(farbe), groesse: Math.min(2.2, 0.85 + schaden / 40) * (tot ? 1.2 : 1), dauer: tot ? 0.9 : 0.7 });
  }
  function schadeNpc(t, def) {
    const n = t.ziel.npc, fig = n.fig;
    n.leben -= t.schaden;
    fig.setLeben(Math.max(0, n.leben) / 100);
    if (t.verlangsamt) n.langsam = t.verlangsamt;
    if (t.zug) { fig.stoss?.(t.zug.x * 0.1, 0, t.zug.z * 0.1); return; }
    const richtung = { x: t.stoss.x, y: 0, z: t.stoss.z }, kraft = Math.hypot(t.stoss.x, t.stoss.z);
    if (n.leben <= 0 || t.umwerfen || kraft > 9) {
      fig.umfallen(richtung, { staerke: Math.min(2, 0.6 + kraft / 8), welt: true });
      n.liegt = n.leben <= 0 ? 6 : 2.6;
    } else if (t.schaden > 0) fig.treffer(richtung, Math.min(2.5, 0.6 + t.schaden / 18), { welt: true });
    fig.stoss?.(t.stoss.x, t.stoss.y, t.stoss.z);
    zahl({ x: t.ziel.x, y: t.ziel.y + 2, z: t.ziel.z }, t.schaden, def.farbe, n.leben <= 0);
    fx.funken({ x: t.ziel.x, y: t.ziel.y + 1.1, z: t.ziel.z }, { farbe: def.farbe, anzahl: 10, tempo: 3, dauer: 0.5, groesse: 0.4 });
  }
  let quiekt = 0, starben = 0;
  function schade(t, def) {
    if (t.ziel.npc) return schadeNpc(t, def);
    if (!horde) return;
    const w = t.ziel, r = horde.schade(w, t.schaden, t);
    if (!r.schaden && !t.zug) return;
    const p = { x: w.x, y: w.y + w.hoehe * 0.6, z: w.z };
    if (r.schaden) zahl({ x: w.x, y: w.y + w.hoehe + 0.3, z: w.z }, r.schaden, def.farbe, r.tot);
    if (r.tot) {
      starben++;
      fx.funken(p, { farbe: 0x8a1a14, anzahl: 7 + Math.round(w.skala * 4), tempo: 3.5, dauer: 0.7, groesse: 0.35 * w.skala, hoch: 2.5, schwerkraft: 10 });
      fx.funken(p, { farbe: 0x6e5c4d, anzahl: 4, tempo: 2.5, dauer: 0.9, groesse: 0.3, hoch: 2, schwerkraft: 8 });
    } else if (r.schaden) { quiekt++; fx.funken(p, { farbe: def.farbe, anzahl: 4, tempo: 2.5, dauer: 0.35, groesse: 0.3 }); }
  }
  /** Kurzer Treffer-Stopp (Welt läuft ganz langsam) – das Gewicht eines Einschlags. */
  const stopp = (s) => { st.stopp = Math.max(st.stopp, s); };

  function ereignis(e) {
    const def = e.def, f = def.farbe, g = def.gewicht || 0.3, kraft = e.kraft || 1;
    if (e.typ === 'schlag') {
      // Die Geste schlägt zu: Figur löst die Spannung, Rückstoß nach hinten, Staub an den Füßen
      spieler.loese({ tempo: 1 + 0.2 * (kraft - 1) });
      st.drehRest = 0.7;
      klang?.dauerton('laden', null);
      ton('entladen', { staerke: 0.6 + g * 0.8 * kraft, tonhoehe: 1.2 - g * 0.5 });
      if (kraft > 1.3) ton('wumms', { staerke: 0.5 * kraft, tonhoehe: 1.3 });
      kamera.schuetteln(0.1 + g * 0.25 * kraft, 0.15 + g * 0.1);
      const p = spieler.zustand.pos;
      if (g >= 0.5) fx.ring(p, { farbe: 0xd8c8a8, radius: 0.8 + g * kraft, dauer: 0.35 });
      fx.funken({ x: p.x, y: p.y + 0.1, z: p.z }, { farbe: 0xc8b898, anzahl: Math.round(6 + 14 * g * kraft), tempo: 2.5 + 2 * g, dauer: 0.5, groesse: 0.5, schwerkraft: 3, streuung: 0.4 });
    } else if (e.typ === 'start') {
      const d = { x: Math.sin(e.yaw), y: 0, z: Math.cos(e.yaw) };
      if (g >= 0.4 && def.art !== 'selbst' && def.art !== 'teleport') spieler.stoss(-d.x * g * 3.5 * kraft, 0, -d.z * g * 3.5 * kraft);
      fx.funken(e.von, { farbe: f, anzahl: Math.round(16 + 20 * g * kraft), tempo: 3 + 2 * g, dauer: 0.45, groesse: 0.5 + 0.3 * g });
      if (KLANG_START[e.zauber]) ton(KLANG_START[e.zauber], { staerke: 0.8 + 0.3 * kraft });
      if (def.art === 'kegel') {
        fx.funken(e.von, { farbe: f, anzahl: Math.round(110 * kraft), tempo: def.reichweite * 2.4, dauer: 0.7, groesse: 0.8, schwerkraft: -0.5, streuung: 0.4, richtung: { ...d, y: 0.05 } });
        fx.ring({ x: e.von.x + d.x * 2, y: spieler.zustand.pos.y, z: e.von.z + d.z * 2 }, { farbe: f, radius: def.reichweite * 0.6, dauer: 0.4 });
        kamera.schuetteln(0.35 * kraft, 0.25); ton('wumms', { staerke: 0.8, tonhoehe: 1.4 }); stopp(0.05);
      }
    } else if (e.typ === 'ankuendigung') {
      fx.ring(e.pos, { farbe: f, radius: e.radius, dauer: Math.max(0.15, e.verzug), wachsen: false });
      if (e.zauber === 'meteor') { fx.sturz(e.pos, { farbe: f, dauer: e.verzug, groesse: 0.9 * Math.sqrt(kraft) }); ton('zisch', { staerke: 1.2, tonhoehe: 0.4, verzug: e.verzug * 0.4 }); }
    } else if (e.typ === 'einschlag' || e.typ === 'nova') {
      if (e.geschossId) fx.entferneKugel(e.geschossId);
      const r = e.radius, gross = r > 0;
      if (e.zauber === 'erdstachel') fx.stacheln(e.pos, { farbe: f, radius: r, anzahl: Math.round(9 + 4 * kraft), hoehe: 1.5 * Math.sqrt(kraft) });
      if (e.typ === 'nova') {
        fx.ring(e.pos, { farbe: f, radius: r, dauer: 0.55 });
        fx.stacheln(e.pos, { farbe: 0xd8f4ff, radius: r * 0.9, anzahl: 14, dauer: 1.2, hoehe: 0.9 });
        fx.funken({ x: e.pos.x, y: e.pos.y + 0.5, z: e.pos.z }, { farbe: f, anzahl: 120, tempo: r * 2.2, dauer: 0.8, groesse: 0.6, schwerkraft: 1, streuung: 0.5 });
      } else fx.funken(e.pos, { farbe: f, anzahl: gross ? Math.round(40 + r * 30) : 14, tempo: gross ? 4 + r * 2 : 3.5, dauer: gross ? 1 : 0.45, groesse: gross ? 1 : 0.4, hoch: gross ? 2.5 : 0 });
      if (gross) {
        fx.ring(e.pos, { farbe: f, radius: r, dauer: 0.5 });
        fx.funken(e.pos, { farbe: 0x7a6a50, anzahl: Math.round(r * 10), tempo: r * 1.5, dauer: 1.1, groesse: 0.7, hoch: 3, schwerkraft: 7, streuung: r * 0.3 });
        kamera.schuetteln(Math.min(1.3, r / 4.5 * g * 1.4), 0.25 + r * 0.07);
        ton(r > 4 ? 'explosion' : 'wumms', { staerke: Math.min(2, 0.6 + r * 0.25) });
        stopp(0.03 + 0.06 * g * Math.min(1.5, r / 3));
      } else if (e.zauber === 'eislanze') ton('eis', { staerke: 0.5 });
    } else if (e.typ === 'durchschlag') {
      fx.funken(e.pos, { farbe: f, anzahl: 10, tempo: 3, dauer: 0.35, groesse: 0.4 });
      ton('eis', { staerke: 0.35, tonhoehe: 1.2 });
      stopp(0.015);
    } else if (e.typ === 'strahl') {
      fx.blitz(e.punkte, { farbe: f, dauer: 0.32 });
      kamera.schuetteln(0.3, 0.15); stopp(0.04);
    } else if (e.typ === 'feld') {
      fx.ring(e.pos, { farbe: f, radius: e.radius, dauer: e.dauer, wachsen: false });
      if (e.sog) { ton('zisch', { staerke: 1.2, tonhoehe: 0.3 }); ton('wumms', { staerke: 0.6, tonhoehe: 0.5 }); }
    } else if (e.typ === 'feldTakt') {
      const fd = def.feld, n = fd.sog ? 6 : 3;
      for (let i = 0; i < n; i++) {
        const a = zr() * 6.283, d = e.radius * (fd.sog ? 1 : Math.sqrt(zr()));
        const p = { x: e.pos.x + Math.sin(a) * d, y: e.pos.y + 0.2, z: e.pos.z + Math.cos(a) * d };
        if (fd.sog) fx.funken(p, { farbe: f, anzahl: 2, tempo: 1, dauer: 0.6, groesse: 0.6, schwerkraft: 0, richtung: { x: -Math.sin(a + 0.6) * 9, y: 0.3, z: -Math.cos(a + 0.6) * 9 } });
        else fx.funken(p, { farbe: i % 2 ? 0xffd040 : f, anzahl: 3, tempo: 0.8, dauer: 0.7, groesse: 0.6, schwerkraft: -3 });
      }
    } else if (e.typ === 'feldEnde' && e.schlag) {
      fx.ring(e.pos, { farbe: f, radius: e.radius * 1.4, dauer: 0.45 });
      fx.funken({ x: e.pos.x, y: e.pos.y + 0.6, z: e.pos.z }, { farbe: f, anzahl: 90, tempo: 9, dauer: 0.7, groesse: 0.7, hoch: 2 });
      ton('explosion', { staerke: 1.3, tonhoehe: 1.3 }); kamera.schuetteln(0.8, 0.35); stopp(0.08);
    } else if (e.typ === 'teleport') {
      fx.funken({ x: e.von.x, y: e.von.y + 1, z: e.von.z }, { farbe: f, anzahl: 40, tempo: 3, dauer: 0.6, groesse: 0.6, schwerkraft: -2, streuung: 0.5 });
      spieler.teleport(e.nach, e.yaw);
      const p = spieler.zustand.pos;
      fx.funken({ x: p.x, y: p.y + 1, z: p.z }, { farbe: f, anzahl: 40, tempo: 3, dauer: 0.6, groesse: 0.6, schwerkraft: -2, streuung: 0.5 });
      fx.ring(p, { farbe: f, radius: 1.4, dauer: 0.4 });
    } else if (e.typ === 'selbst') {
      const p = spieler.zustand.pos;
      if (def.heilt) {
        st.leben = Math.min(st.lebenMax, st.leben + def.heilt);
        fx.funken({ x: p.x, y: p.y + 0.4, z: p.z }, { farbe: f, anzahl: 50, tempo: 0.8, dauer: 1.2, groesse: 0.5, schwerkraft: -2.5, streuung: 0.7 });
        fx.ring(p, { farbe: f, radius: 1.5, dauer: 0.7 });
        spieler.setAusdruck('froh', { dauer: 2 });
      }
      if (def.schild) { st.schild = def.schild; st.schildRest = def.dauer; fx.aura('schild', () => spieler.zustand.pos, { farbe: f, dauer: def.dauer, radius: 1.15 }); }
    }
    zahlenFrei = 8;
    const vorher = starben;
    for (const t of e.treffer) schade(t, def);
    const n = starben - vorher;
    if (n >= 4) {                                     // Mehrfach-Kill: große Zahl über dem Einschlag
      const p = e.pos || e.treffer[0].ziel;
      zahlen.zeige({ x: p.x, y: (p.y || 0) + 2.2, z: p.z }, `☠ ×${n}`, { farbe: '#ffd870', groesse: Math.min(2.6, 1.3 + n / 15), dauer: 1.3, steigen: 1.6, streuung: 0 });
      if (n >= 10) kamera.schuetteln(0.4, 0.2);
    }
  }

  /** Aufladen sichtbar und hörbar machen: Funken an der Hand, wachsende Kugel, Ziel-Kreis, Brummen. */
  function ladenZeigen(dt) {
    const l = buch.ladung;
    if (!l || l.phase !== 'laden') {
      if (st.ladeKugel >= 0) { fx.entferneKugel('ladung'); st.ladeKugel = -1; }
      kreis.visible = false;
      if (!l) klang?.dauerton('laden', null);
      return;
    }
    const def = l.def, g = def.gewicht || 0.3, hand = handPos(def.clip), voll = l.anteil >= 1;
    const stufe = Math.round((0.3 + 0.7 * l.anteil + l.ueber) * 8);
    if (stufe !== st.ladeKugel) { fx.entferneKugel('ladung'); st.ladeKugel = stufe; }
    fx.kugel('ladung', hand, { farbe: def.farbe, groesse: 0.03 + stufe * 0.008 * (0.6 + g), schweif: false });
    // Funken werden von außen in die Hand gesaugt
    const n = Math.round((1 + 3 * l.anteil + 5 * l.ueber) * (0.6 + g));
    for (let i = 0; i < n; i++) {
      const a = zr() * 6.283, b = zr() * 3.14 - 1.57, r = 0.5 + 0.5 * g;
      const p = { x: hand.x + Math.cos(a) * Math.cos(b) * r, y: hand.y + Math.sin(b) * r, z: hand.z + Math.sin(a) * Math.cos(b) * r };
      fx.funken(p, { farbe: def.farbe, anzahl: 1, tempo: 0.1, dauer: 0.22, groesse: 0.35 + 0.3 * l.ueber, schwerkraft: 0,
        richtung: { x: (hand.x - p.x) * 4, y: (hand.y - p.y) * 4, z: (hand.z - p.z) * 4 } });
    }
    if (l.ueber > 0.98 && zr() < dt * 6) { fx.funken(hand, { farbe: 0xffffff, anzahl: 8, tempo: 2.5, dauer: 0.25, groesse: 0.35 }); kamera.schuetteln(0.06, 0.1); }
    if (voll && st.warVoll === false) { ton('wumms', { staerke: 0.4, tonhoehe: 1.8 }); fx.funken(hand, { farbe: def.farbe, anzahl: 18, tempo: 3, dauer: 0.3, groesse: 0.45 }); }
    st.warVoll = voll;
    klang?.dauerton('laden', { staerke: 0.12 + 0.25 * l.anteil + 0.3 * l.ueber, tonhoehe: 0.8 + 0.4 * l.anteil + 0.6 * l.ueber - g * 0.2 });
    // Ziel-Kreis
    const a = zielen(def), p = spieler.zustand.pos;
    st.drehYaw = a.yaw; st.drehRest = 0.2;
    let kp = null, kr = 0;
    const radius = (def.radius || 0) * (1 + (l.kraft - 1) * 0.6);
    if (def.art === 'nova') { kp = p; kr = radius; }
    else if (def.art === 'teleport') { kp = { x: p.x + Math.sin(a.yaw) * def.reichweite, z: p.z + Math.cos(a.yaw) * def.reichweite }; kr = 0.9; }
    else if (a.punkt && radius > 0) { kp = a.punkt; kr = radius; }
    else if (a.ziel) { kp = a.ziel; kr = (a.ziel.radius || 0.35) + 0.3; }
    kreis.visible = !!kp;
    if (kp) {
      const dx = kp.x - p.x, dz = kp.z - p.z, d = Math.hypot(dx, dz), max = def.reichweite || 99, f = def.art === 'nova' || d <= max ? 1 : max / d;
      const x = p.x + dx * f, z = p.z + dz * f;
      kreis.position.set(x, (welt.bodenHoehe(x, z) || 0) + 0.07, z);
      kreis.scale.setScalar(Math.max(0.3, kr) * (1 + 0.04 * Math.sin(performance.now() / 70)));
      kreisMat.color.set(def.farbe); flaecheMat.color.set(def.farbe);
      kreisMat.opacity = 0.35 + 0.5 * l.anteil; flaecheMat.opacity = 0.06 + 0.12 * l.ueber;
    }
  }

  function abbrechen() { if (buch.brichAb()) { spieler.stoppe(); klang?.dauerton('laden', null); return true; } return false; }

  return {
    buch, fx, zustand: st,
    wirke,
    /** Gehaltenen Zauber auslösen (Taste losgelassen). */
    loslassen() { buch.lasseLos(); },
    /** Aufladen abbrechen (z. B. Rolle): Mana zurück, Geste stoppen. */
    abbrechen,
    /** Faktor für die Laufgeschwindigkeit: Aufladen macht schwer. */
    get tempoFaktor() {
      const l = buch.ladung;
      if (!l) return 1;
      return l.phase === 'laden' ? Math.max(0.15, 1 - (0.35 + 0.45 * l.anteil) * (0.4 + (l.def.gewicht || 0.3))) : 0.25;
    },
    /** Zeitfaktor für die Welt (Treffer-Stopp). */
    zeitFaktor(dt) { if (st.stopp > 0) { st.stopp -= dt; return 0.06; } return 1; },
    /** Schaden am Spieler (Schild fängt zuerst ab). leise = keine Meldung (Horden-Bisse). → true, wenn der Spieler dabei gefallen ist. */
    spielerTreffen(schaden = 25, { leise = false, von = null, toedlich = false } = {}) {
      if (st.tot > 0) return false;
      const ab = Math.min(st.schild, schaden);
      st.schild -= ab;
      if (st.schild <= 0 && ab > 0) fx.entferneAura('schild');
      const rest = schaden - ab;
      st.leben = Math.max(toedlich ? 0 : 1, st.leben - rest);
      if (rest > 0) {
        const p = spieler.zustand.pos, d = von ? { x: p.x - von.x, y: 0, z: p.z - von.z } : { x: 0, y: 0, z: -1 };
        if (!leise || rest >= 8) spieler.treffer(d, Math.min(1.5, 0.4 + rest / 15), { welt: !!von });
        onSchmerz(Math.min(1, 0.25 + rest / 25));
        zahlen.zeige({ x: p.x, y: p.y + 2, z: p.z }, '−' + rest, { farbe: '#ff5040', groesse: 0.9, dauer: 0.6 });
      } else if (ab > 0) fx.funken({ x: spieler.zustand.pos.x, y: spieler.zustand.pos.y + 1, z: spieler.zustand.pos.z }, { farbe: 0x7ab8ff, anzahl: 6, tempo: 2, dauer: 0.3, groesse: 0.4 });
      if (!leise) onMeldung(ab ? `Schild fängt ${ab} ab` : `−${schaden} Leben`);
      if (st.leben <= 0) {
        abbrechen();
        st.tot = 3;
        spieler.umfallen({ x: 0, y: 0, z: -1 }, { staerke: 1.2 });
        kamera.schuetteln(0.6, 0.4);
        return true;
      }
      return false;
    },
    /** blickYaw für die Absicht, solange die Figur sich zum Zauber dreht (sonst undefined). */
    get drehYaw() { return st.drehRest > 0 ? st.drehYaw : undefined; },
    get tot() { return st.tot > 0; },
    alleHeilen() { for (const n of npcs) { n.leben = 100; n.fig.setLeben(null); if (n.liegt > 0) { n.liegt = 0; n.fig.aufstehen(); } } st.leben = st.lebenMax; },
    update(dt, hoehePx) {
      zieleSammeln();
      if (st.drehRest > 0) st.drehRest -= dt;
      if (st.schildRest > 0 && (st.schildRest -= dt) <= 0) st.schild = 0;
      if (st.tot > 0 && (st.tot -= dt) <= 0) { st.leben = st.lebenMax; spieler.aufstehen(); onMeldung('Wieder auf den Beinen!'); }
      ladenZeigen(dt);
      quiekt = 0; starben = 0;
      for (const e of buch.update(dt, ziele)) ereignis(e);
      if (quiekt) ton('quiek', { staerke: Math.min(1, 0.3 + quiekt * 0.1), tonhoehe: 0.9 + zr() * 0.3 });
      if (starben) ton('tod', { staerke: Math.min(1.6, 0.5 + starben * 0.12), tonhoehe: 0.9 + zr() * 0.25 });
      for (const g of buch.geschosse) fx.kugel(g.id, g, { farbe: g.def.farbe, groesse: (GROESSE[g.zauber] || 0.2) * Math.sqrt(g.kraft || 1) });
      for (const n of npcs) {
        if (n.langsam > 0) n.langsam -= dt;
        if (n.liegt > 0 && (n.liegt -= dt) <= 0) {
          if (n.leben <= 0) { n.leben = 100; n.fig.setLeben(null); }
          n.fig.aufstehen();
        }
      }
      fx.update(dt, { hoehePx });
      zahlen.update(kamera.kamera, dt);
    },
    dispose() { fx.dispose(); buch.dispose(); zahlen.dispose(); kreis.removeFromParent(); kreisMat.dispose(); flaecheMat.dispose(); },
  };
}
export { ZAUBER };
