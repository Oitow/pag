// Figuren-Labor – Zauber im Spiel: verbindet engine/gameplay/zauber (Logik) mit Figuren, Effekten, Kamera und NPC-Leben.
import * as THREE from 'three';
import { createZauberbuch, zielImKegel, ZAUBER } from '../../../engine/gameplay/zauber.js';
import { createZauberEffekte } from '../../../engine/render/zauber-effekte.js';

const BEIDHAENDIG = new Set(['zauberStoss', 'zauberHimmel', 'zauberSelbst']);
const GROESSE = { feuerball: 0.3, eislanze: 0.16, arkan: 0.15 };
const GRUND = { mana: 'Zu wenig Mana', abklingzeit: 'Lädt noch …', wirkt: null, unbekannt: null };

/** opts: { spieler, npcs: [{ fig }], npcsAn(), szene, welt (Adapter), kamera, lockZiel() -> Figur|null, seed, onMeldung(text) } */
export function createZauberSpiel({ spieler, npcs, npcsAn = () => true, szene, welt, kamera, lockZiel = () => null, seed = 1, onMeldung = () => {} }) {
  const buch = createZauberbuch({ welt });
  const fx = createZauberEffekte({ seed });
  szene.add(fx.gruppe);
  const v = new THREE.Vector3(), v2 = new THREE.Vector3();
  const ziele = [];
  const st = { leben: 100, lebenMax: 100, schild: 0, drehYaw: null, drehRest: 0 };
  for (const n of npcs) Object.assign(n, { leben: 100, liegt: 0, langsam: 0 });

  /** Punkt, an dem der Zauber entsteht: rechte Hand oder Mitte beider Hände. */
  function handPos(clip) {
    const s = spieler.model.rig.sockel;
    s.handR.getWorldPosition(v);
    if (BEIDHAENDIG.has(clip)) v.add(s.handL.getWorldPosition(v2)).multiplyScalar(0.5);
    return { x: v.x, y: v.y, z: v.z };
  }
  function zieleSammeln() {
    ziele.length = 0;
    if (!npcsAn()) return;
    for (const n of npcs) {
      if (n.liegt > 0) continue;
      const p = n.fig.zustand.pos, m = n.fig.model.masse;
      const z = n.zielObj ??= { id: n.fig.name, npc: n };
      z.x = p.x; z.y = p.y; z.z = p.z; z.radius = m.radius; z.hoehe = m.augenHoehe + 0.15;
      ziele.push(z);
    }
  }

  function wirke(name) {
    const z = spieler.zustand;
    if (z.imWasser || spieler.animator.liegt) return false;
    const k = buch.kann(name);
    if (!k.ok) { if (GRUND[k.grund]) onMeldung(GRUND[k.grund]); return false; }
    const def = k.def;
    // Zielen: Lock-On-Ziel, sonst das beste Ziel in Kamera-Blickrichtung, sonst geradeaus dorthin, wohin die Kamera schaut
    const blick = kamera.erstePerson ? kamera.yaw : kamera.blickYaw();
    const fest = lockZiel();
    const aim = (fest && ziele.find((q) => q.npc.fig === fest)) || (def.art === 'teleport' || def.art === 'selbst' ? null
      : zielImKegel(ziele, z.pos, blick, def.reichweite || 20, 0.4));
    st.drehYaw = aim ? Math.atan2(aim.x - z.pos.x, aim.z - z.pos.z) : blick;
    st.drehRest = def.art === 'selbst' ? 0 : 0.75;
    const clip = spieler.spiele(def.clip);
    buch.wirke(name, { vorlauf: clip.trefferBei, ziel: () => ({ von: handPos(def.clip), fuss: spieler.zustand.pos, yaw: st.drehYaw, ziel: aim && ziele.includes(aim) ? aim : null }) });
    return true;
  }

  function schade(t, def) {
    const n = t.ziel.npc, fig = n.fig;
    n.leben -= t.schaden;
    fig.setLeben(Math.max(0, n.leben) / 100);
    fig.sage('−' + t.schaden, { dauer: 0.9 });
    if (t.verlangsamt) n.langsam = t.verlangsamt;
    const richtung = { x: t.stoss.x, y: 0, z: t.stoss.z }, kraft = Math.hypot(t.stoss.x, t.stoss.z);
    if (n.leben <= 0 || t.umwerfen || kraft > 9) {
      fig.umfallen(richtung, { staerke: Math.min(2, 0.6 + kraft / 8), welt: true });
      n.liegt = n.leben <= 0 ? 6 : 2.6;
    } else fig.treffer(richtung, Math.min(2.5, 0.6 + t.schaden / 18), { welt: true });
    fig.stoss?.(t.stoss.x, t.stoss.y, t.stoss.z);
    fx.funken({ x: t.ziel.x, y: t.ziel.y + 1.1, z: t.ziel.z }, { farbe: def.farbe, anzahl: 10, tempo: 3, dauer: 0.5, groesse: 0.4 });
  }

  function ereignis(e) {
    const def = e.def, f = def.farbe;
    if (e.typ === 'start') {
      fx.funken(e.von, { farbe: f, anzahl: 16, tempo: 2.5, dauer: 0.4, groesse: 0.45 });
      if (def.art === 'kegel') {
        const d = { x: Math.sin(e.yaw), y: 0.05, z: Math.cos(e.yaw) };
        fx.funken(e.von, { farbe: f, anzahl: 90, tempo: def.reichweite * 2.2, dauer: 0.7, groesse: 0.7, schwerkraft: -0.5, streuung: 0.4, richtung: d });
        kamera.schuetteln(0.3, 0.2);
      }
    } else if (e.typ === 'ankuendigung') {
      fx.ring(e.pos, { farbe: f, radius: e.radius, dauer: Math.max(0.15, e.verzug), wachsen: false });
      if (e.zauber === 'meteor') fx.sturz(e.pos, { farbe: f, dauer: e.verzug });
    } else if (e.typ === 'einschlag') {
      if (e.geschossId) fx.entferneKugel(e.geschossId);
      const gross = e.radius > 0;
      if (e.zauber === 'erdstachel') fx.stacheln(e.pos, { farbe: f, radius: e.radius });
      else fx.funken(e.pos, { farbe: f, anzahl: gross ? 30 + e.radius * 22 : 16, tempo: gross ? 3 + e.radius * 2 : 3.5, dauer: gross ? 0.9 : 0.45, groesse: gross ? 0.9 : 0.4, hoch: gross ? 2 : 0 });
      if (gross) { fx.ring(e.pos, { farbe: f, radius: e.radius, dauer: 0.5 }); kamera.schuetteln(Math.min(1, e.radius / 4.5), 0.25 + e.radius * 0.06); }
    } else if (e.typ === 'strahl') {
      fx.blitz(e.punkte, { farbe: f });
      kamera.schuetteln(0.25, 0.15);
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
    for (const t of e.treffer) schade(t, def);
  }

  return {
    buch, fx, zustand: st,
    wirke,
    /** Schaden am Spieler (Schild fängt zuerst ab) – im Labor per Knopf zum Ausprobieren von Heilung/Schild. */
    spielerTreffen(schaden = 25) {
      const ab = Math.min(st.schild, schaden);
      st.schild -= ab;
      if (st.schild <= 0 && ab > 0) fx.entferneAura('schild');
      st.leben = Math.max(1, st.leben - (schaden - ab));
      if (schaden > ab) spieler.treffer({ x: 0, y: 0, z: -1 }, 1.2);
      onMeldung(ab ? `Schild fängt ${ab} ab` : `−${schaden} Leben`);
    },
    /** blickYaw für die Absicht, solange die Figur sich zum Zauber dreht (sonst undefined). */
    get drehYaw() { return st.drehRest > 0 ? st.drehYaw : undefined; },
    alleHeilen() { for (const n of npcs) { n.leben = 100; n.fig.setLeben(null); if (n.liegt > 0) { n.liegt = 0; n.fig.aufstehen(); } } st.leben = st.lebenMax; },
    update(dt, hoehePx) {
      zieleSammeln();
      if (st.drehRest > 0) st.drehRest -= dt;
      if (st.schildRest > 0 && (st.schildRest -= dt) <= 0) st.schild = 0;
      // Aufladen: Funken sammeln sich an der Hand, solange die Geste läuft
      if (buch.wirkt) {
        const def = buch.zauber[buch.wirkt];
        fx.funken(handPos(def.clip), { farbe: def.farbe, anzahl: 2, tempo: 0.6, dauer: 0.35, groesse: 0.55, schwerkraft: -1.5, streuung: 0.12 });
      }
      for (const e of buch.update(dt, ziele)) ereignis(e);
      for (const g of buch.geschosse) fx.kugel(g.id, g, { farbe: g.def.farbe, groesse: GROESSE[g.zauber] || 0.2 });
      for (const n of npcs) {
        if (n.langsam > 0) n.langsam -= dt;
        if (n.liegt > 0 && (n.liegt -= dt) <= 0) {
          if (n.leben <= 0) { n.leben = 100; n.fig.setLeben(null); }
          n.fig.aufstehen();
        }
      }
      fx.update(dt, { hoehePx });
    },
    dispose() { fx.dispose(); buch.dispose(); },
  };
}
export { ZAUBER };
