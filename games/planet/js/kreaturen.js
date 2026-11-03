// Agent Kreaturen: wilde Tiere spawnen (pro Biom/Tageszeit), KI (grasen, fliehen, jagen),
// Kampf (HP, Rückstoß, Beute), Fangen (Fangkugel als Projektil, Wackeln, Erfolg/Fehlschlag),
// Begleiter (folgen, kämpfen, Fähigkeiten, Reittier), Sammelbuch, Speichern.
// Schnittstelle siehe API.md (ctx.kreaturen).
import { ladeTierDaten } from './tiere-loader.js';
import { baueKreaturen } from './kreaturen-daten.js';
import { backe, instanz, blitz, lebendig, kugelModell, KUGEL_RADIUS, Partikel, Schild } from './kreaturen-modell.js';

const MAX_AKTIV = 3;
const SPAWN_MIN = 40, SPAWN_MAX = 105, DESPAWN = 125;
const GRAV = 9.81;
const WURF = { tempo: 18, g: GRAV, hoch: 1.2 };  // hoch = zusätzliche Aufwärts-Geschwindigkeit (m/s)
const REIT_HOEHE = 1.55;   // Modellhöhe des Reittiers (Rücken ≈ 1,25 m = Hüfte des Spieler-Modells beim Reiten)

export async function init(ctx) {
  const { THREE, scene, camera, DATA } = ctx;
  const P = () => ctx.planet;
  const R = ctx.R || DATA.R;
  const rnd = () => Math.random();
  const zwischen = (a, b) => a + (b - a) * rnd();
  const ganz = ([a, b]) => a + Math.floor(rnd() * (b - a + 1));
  const toast = (t, ms) => ctx.spiel?.toast?.(t, ms);
  const mobil = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const MAX_WILD = mobil ? 18 : 26;

  const TIERE = await ladeTierDaten();
  const K = baueKreaturen(TIERE, DATA);
  const nachBiom = {};
  for (const k of Object.values(K)) for (const b of k.biome) (nachBiom[b] ||= []).push(k);

  // ---------- Vektor-Hilfen ----------
  const V3 = () => new THREE.Vector3();
  const _a = V3(), _b = V3(), _c = V3(), _d = V3(), _e = V3();
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m4 = new THREE.Matrix4(), _eul = new THREE.Euler();
  const hoeheAt = d => P().heightAt ? P().heightAt(d) : 0;
  const tangential = (v, up) => v.addScaledVector(up, -v.dot(up));
  function zufallsTangente(up, out) {
    out.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5); tangential(out, up);
    if (out.lengthSq() < 1e-6) out.set(1, 0, 0), tangential(out, up);
    return out.normalize();
  }
  // Richtung dir um Strecke s (m) entlang Tangente t verschieben
  function versetze(dir, t, s, out) { return out.copy(dir).multiplyScalar(R).addScaledVector(t, s).normalize(); }
  function spielerPos(out) {
    const s = ctx.spieler;
    if (s?.pos) return out.copy(s.pos);
    return out.copy(camera.position);
  }
  const istNacht = d => { try { return !!P().istNacht?.(d); } catch (e) { return false; } };

  // ---------- Modelle ----------
  const modelle = new Map();
  function modell(id) {
    let e = modelle.get(id);
    if (!e) {
      e = { fertig: null };
      e.p = backe(id).then(m => (e.fertig = m)).catch(err => { console.warn('Kreatur-Modell', id, err); e.fehler = true; });
      modelle.set(id, e);
    }
    return e;
  }
  const STARTER = [['huhn', 3], ['schaf', 3], ['hase', 2], ['kueken', 2], ['schwein', 1]];
  await Promise.race([Promise.all(STARTER.map(([id]) => modell(id).p)), new Promise(r => setTimeout(r, 6000))]);
  for (const b of ['wiese', 'strand']) for (const k of nachBiom[b] || []) modell(k.modell);

  const partikel = new Partikel(scene);
  const licht = new THREE.PointLight(0xffe2a0, 0, 26, 1.4);
  scene.add(licht);

  // ---------- Zustand ----------
  const wild = [];
  const gefangen = [];
  const gesehen = new Set();
  const kugeln = [];        // fliegende / liegende Fangkugeln
  const begleiter = new Map();
  let zaehler = 0, spawnTimer = 0, langsamTimer = 0, kampfZiel = null, kampfZielZeit = 0;
  let spuernase = 0, besteKugel = 7, startGespawnt = false, laufzeit = 0;

  const kugelDef = id => DATA.KUGELN.find(q => q.id === id);
  const kugelFuerStufe = s => DATA.KUGELN.find(q => q.stufe >= s) || DATA.KUGELN[DATA.KUGELN.length - 1];
  const neueUid = () => 'k' + Date.now().toString(36) + (zaehler++).toString(36);

  function werte(k, stufe, alpha) {
    const f = 1 + 0.6 * (stufe - 1);
    const hp = Math.round(k.hp / 10 * f * (alpha ? 2 : 1));
    const spdF = Math.min(1.4, Math.max(0.55, Math.sqrt(k.groesse)));
    const lauf = (0.7 + k.spd * 0.16) * spdF;
    const renn = Math.min(10.5, (2.2 + k.spd * 0.6) * spdF);
    return { hp, lauf, renn, schaden: Math.max(1, Math.round(k.atk / 4 * (1 + 0.25 * (stufe - 1)) * (alpha ? 1.5 : 1))) };
  }

  // ---------- Wildtier erzeugen ----------
  function spawne(id, dir, o = {}) {
    const k = K[id]; if (!k) return null;
    const m = modell(k.modell);
    if (!m.fertig) return null;
    const alpha = o.alpha ?? (k.glut ? false : rnd() < 0.04);
    const stufe = Math.min(7, k.stufe + (alpha ? 1 : 0));
    const groesse = k.groesse * (alpha ? 1.35 : 1) * zwischen(0.9, 1.1);
    const vari = instanz(m.fertig, { alpha: alpha ? Math.floor(rnd() * 3) : -1, glut: k.glut, leuchtet: k.leuchtet });
    vari.inner.scale.setScalar(groesse);
    const w = werte(k, stufe, alpha);
    const t = {
      uid: neueUid(), k, alpha, stufe, groesse, ...vari, m: m.fertig,
      hoehe: m.fertig.hoehe * groesse, radius: Math.max(0.3, groesse * 0.42),
      dir: dir.clone().normalize(), pos: V3(), fwd: V3(), up: V3(), nrm: dir.clone().normalize(),
      speed: 0, zielSpeed: 0, zustand: 'grasen', timer: zwischen(0.5, 4), phase: rnd() * 10,
      hp: w.hp, maxHp: w.hp, lauf: w.lauf, renn: w.renn, schaden: w.schaden,
      flug: 0, wut: 0, scheu: 0, angriffCd: 0, flash: 0, stoss: V3(), getroffen: -99, nrmTimer: 0,
      schild: null, start: !!o.start, tot: -1, fang: null, lunge: 0,
    };
    zufallsTangente(t.dir, t.fwd);
    if (k.wasser === 'wasser') t.tiefe = Math.min(-hoeheAt(t.dir) - 0.3, t.hoehe + 0.3);
    platziere(t, 0);
    scene.add(t.obj);
    wild.push(t);
    return t;
  }

  function entferne(t) {
    scene.remove(t.obj);
    if (t.schild) { scene.remove(t.schild.sprite); t.schild.dispose(); }
    const i = wild.indexOf(t); if (i >= 0) wild.splice(i, 1);
    if (kampfZiel === t) kampfZiel = null;
  }

  // Ort prüfen: passt das Gelände für Kreatur k?
  function gelaendeOk(k, dir, h = hoeheAt(dir), groesse = k.groesse) {
    if (k.wasser === 'wasser') return h < -Math.max(1.6, Math.min(groesse * 0.45, 5));
    if (k.wasser === 'amphib') return h > -3;
    return h > 0.25;
  }

  // ---------- Platzieren / Bewegen auf der Kugel ----------
  function platziere(t, dt) {
    const k = t.k, h = hoeheAt(t.dir);
    let r;
    if (k.wasser === 'wasser') {
      const tief = Math.max(0.25, Math.min(t.tiefe ?? t.hoehe + 0.3, -h - 0.2));
      r = R - tief + (t.groesse > 3 ? t.hoehe * 0.12 : 0);
    } else if (h < 0) {
      r = R - t.hoehe * 0.55;                         // schwimmt an der Oberfläche
    } else {
      r = R + h;
    }
    // Flughöhe (Vögel beim Laufen/Fliehen, Insekten immer)
    let zielFlug = 0;
    if (k.flieger === 2) zielFlug = 0.6 + Math.sin(t.phase * 0.7) * 0.3 + t.groesse;
    else if (k.flieger === 1 && (t.zustand === 'flucht' || (t.zustand === 'wandern' && t.speed > 0.2))) zielFlug = t.zustand === 'flucht' ? 5 : 2.2;
    t.flug += (zielFlug - t.flug) * Math.min(1, dt * 2);
    t.pos.copy(t.dir).multiplyScalar(r + t.flug);
    // Ausrichtung: Normale gemischt aus Kugel-Radial und Gelände
    t.nrmTimer -= dt;
    if (t.nrmTimer <= 0 && P().normalAt && h >= 0 && t.flug < 0.3) {
      t.nrmTimer = 0.35 + rnd() * 0.2;
      P().normalAt(t.dir, t.nrm);
    }
    t.up.copy(t.dir);
    if (h >= 0 && t.flug < 0.3) t.up.lerp(t.nrm, 0.45).normalize();
    tangential(t.fwd, t.dir).normalize();
    _a.copy(t.fwd); tangential(_a, t.up).normalize();
    _b.crossVectors(t.up, _a);
    _m4.makeBasis(_b, t.up, _a);
    t.obj.quaternion.setFromRotationMatrix(_m4);
    t.obj.position.copy(t.pos);
  }

  // um s Meter entlang (tangentialer) Richtung v bewegen; false = blockiert
  function bewege(t, v, s) {
    if (Math.abs(s) < 1e-5) return true;
    versetze(t.dir, v, s, _c);
    const h = hoeheAt(_c);
    if (!gelaendeOk(t.k, _c, h, t.groesse)) return false;
    if (t.k.wasser !== 'wasser' && !t.k.flieger && h > 0) {
      const h0 = hoeheAt(t.dir);
      if (h - h0 > Math.abs(s) * 1.6 + 0.05 && !(t.k.faehigkeiten.klettern)) return false;   // zu steil
    }
    t.dir.copy(_c);
    return true;
  }

  function dreheZu(t, ziel, dt, rate = 5, weg = false) {
    _a.copy(ziel).sub(t.pos); if (weg) _a.negate();
    tangential(_a, t.dir); if (_a.lengthSq() < 1e-6) return;
    _a.normalize();
    t.fwd.lerp(_a, Math.min(1, dt * rate)).normalize();
  }

  // ---------- Spawning ----------
  const SELTEN_GEWICHT = { 1: 10, 2: 3.5, 3: 1 };
  function waehle(liste) {
    let summe = 0; for (const k of liste) summe += SELTEN_GEWICHT[k.seltenheit] || 1;
    let r = rnd() * summe;
    for (const k of liste) { r -= SELTEN_GEWICHT[k.seltenheit] || 1; if (r <= 0) return k; }
    return liste[liste.length - 1];
  }
  function spawnVersuch(zentrum, minD, maxD) {
    const up = _d.copy(zentrum).normalize();
    const t = zufallsTangente(up, _e);
    const dist = zwischen(minD, maxD);
    const dir = versetze(up, t, dist, V3());
    const biom = P().biomeAt?.(dir) || 'wiese';
    const h = hoeheAt(dir);
    const nacht = istNacht(dir);
    let liste = (nachBiom[biom] || []).filter(k => (k.aktiv === 'immer' || (k.aktiv === 'nacht') === nacht));
    // Strand/Küste: Wassertiere im Ozean, Landtiere an Land
    liste = liste.filter(k => gelaendeOk(k, dir, h));
    if (biom === 'ozean' && h > -3) liste = liste.concat((nachBiom.strand || []).filter(k => k.wasser === 'amphib'));
    if (!liste.length) return 0;
    const k = waehle(liste);
    const m = modell(k.modell);
    if (!m.fertig) return 0;
    const n = ganz(k.herde);
    let erzeugt = 0, leit = null;
    const tt = V3();
    for (let i = 0; i < n && wild.length < MAX_WILD + 4; i++) {
      const d = i === 0 ? dir : versetze(dir, zufallsTangente(dir, tt), zwischen(1.5, 3 + k.groesse * 2), V3());
      if (!gelaendeOk(k, d)) continue;
      const x = spawne(k.id, d, { alpha: i === 0 ? undefined : false });
      if (x) { erzeugt++; if (leit) { x.fwd.copy(leit.fwd); tangential(x.fwd, x.dir).normalize(); } else leit = x; }
    }
    return erzeugt;
  }

  function spawnStart() {
    if (startGespawnt) return;
    const sd = P().spawnDir; if (!sd) return;
    startGespawnt = true;
    const up = sd.clone().normalize(), t = V3();
    for (const [id, n] of STARTER) {
      if (!modell(id).fertig) continue;
      // Gruppe an einem gemeinsamen Platz 9–26 m vom Spawn
      for (let versuch = 0; versuch < 12; versuch++) {
        const zentrum = versetze(up, zufallsTangente(up, t), zwischen(9, 26), V3());
        if (hoeheAt(zentrum) < 0.4) continue;
        let ok = 0;
        for (let i = 0; i < n * 3 && ok < n; i++) {
          const d = i === 0 ? zentrum : versetze(zentrum, zufallsTangente(zentrum, t), zwischen(1, 4), V3());
          if (hoeheAt(d) < 0.3) continue;
          if (spawne(id, d, { start: true, alpha: false })) ok++;
        }
        if (ok) break;
      }
    }
  }

  // ---------- Kampf ----------
  function zentrum(t, out) { return out.copy(t.pos).addScaledVector(t.up, t.hoehe * 0.5); }

  function reagiere(t, quelle) {
    const v = t.k.verhalten;
    if (v === 'aggressiv' || (v === 'neutral' && t.k.rolle !== 'support' && t.k.rolle !== 'schuetze')) {
      t.wut = 18; t.zustand = 'jagd'; t.timer = 18;
    } else {
      t.scheu = 8; t.zustand = 'flucht'; t.timer = zwischen(4, 7);
    }
  }

  function schadeTier(t, n, vonPos, vomSpieler = true) {
    if (t.tot >= 0 || t.fang) return;
    t.hp = Math.max(0, t.hp - n);
    t.flash = 0.14; t.getroffen = laufzeit;
    _a.copy(t.pos).sub(vonPos); tangential(_a, t.dir);
    if (_a.lengthSq() > 1e-6) t.stoss.copy(_a.normalize()).multiplyScalar(Math.min(9, 3 + n * 0.25) / Math.max(0.7, Math.sqrt(t.groesse)));
    partikel.emit(zentrum(t, _b), 6, 0xffffff, 2.5, t.up, 0.35, 2);
    if (vomSpieler) { kampfZiel = t; kampfZielZeit = 14; }
    if (t.hp <= 0) return besiegt(t);
    reagiere(t);
  }

  function besiegt(t) {
    t.tot = 0; t.zustand = 'tot';
    if (t.schild) t.schild.sprite.visible = false;
    partikel.emit(zentrum(t, _b), 18, t.k.glut ? 0xff7a30 : 0xfff0c0, 3, t.up, 0.8, 3);
    const teile = [];
    for (const [id, max] of Object.entries(t.k.beute)) {
      const n = Math.max(1, Math.ceil(rnd() * max)) * (t.alpha ? 2 : 1);
      ctx.emit('item:erhalten', { id, n });
      teile.push('+' + n + ' ' + (DATA.ITEMS[id]?.icon || id));
    }
    if (!ctx.spiel?.inventar) toast(`${name(t)} besiegt  ${teile.join('  ')}`);
    else toast(`${name(t)} besiegt!`);
    if (kampfZiel === t) kampfZiel = null;
  }

  const name = t => (t.alpha ? 'Alpha-' : '') + t.k.name;

  ctx.on('angriff', e => {
    if (!e?.pos) return;
    const dir = _e.copy(e.dir || ctx.spieler?.forward || _e.set(0, 0, 1)).normalize();
    const reich = e.reichweite ?? 2.5;
    const kandidaten = [];
    for (const t of wild) {
      if (t.tot >= 0 || t.fang) continue;
      const c = zentrum(t, _a), v = _b.copy(c).sub(e.pos), d = v.length();
      if (d - t.radius > reich) continue;
      const cos = d > 1e-3 ? v.dot(dir) / d : 1;
      if (cos > 0.45 || d < t.radius + 0.7) kandidaten.push([d, t]);
    }
    kandidaten.sort((a, b) => a[0] - b[0]);
    for (const [, t] of kandidaten.slice(0, 3)) schadeTier(t, e.schaden ?? 10, e.pos);
  });

  ctx.on('spieler:tod', () => { for (const t of wild) if (t.zustand === 'jagd') { t.zustand = 'wandern'; t.wut = 0; t.timer = 3; } kampfZiel = null; });

  // ---------- Fangen ----------
  function fangChance(t, q) {
    const basis = { zahm: 0.85, neutral: 0.62, scheu: 0.56, aggressiv: 0.42 }[t.k.verhalten] ?? 0.55;
    const selten = { 1: 1, 2: 0.85, 3: 0.7 }[t.k.seltenheit] ?? 1;
    const anteil = t.hp / t.maxHp;
    const hpF = 1 - anteil * (t.k.verhalten === 'zahm' ? 0.35 : 0.7);
    const ahnungslos = (t.zustand === 'grasen' || t.zustand === 'wandern') && t.wut <= 0 ? 0.08 : 0;
    const c = basis * selten * (t.alpha ? 0.6 : 1) * hpF + q.bonus + 0.06 * (q.stufe - t.stufe) + ahnungslos;
    return Math.max(0.03, Math.min(0.97, c));
  }

  ctx.on('werfen', e => {
    if (!e?.pos) return;
    const kid = e.kugel;
    const inv = ctx.spiel?.inventar;
    if (!kid || (inv && !inv.remove(kid, 1))) { toast('Keine Fangkugel'); return; }
    const q = kugelDef(kid) || DATA.KUGELN[0];
    const mesh = kugelModell(q.farbe);
    const up = _a.copy(e.pos).normalize();
    const dir = V3().copy(e.dir || ctx.spieler?.forward || camera.getWorldDirection(V3())).normalize();
    const pos = V3().copy(e.pos);
    if (ctx.spieler?.pos && pos.distanceTo(ctx.spieler.pos) < 0.5) pos.addScaledVector(up, 1.4);
    // Zielhilfe: Tier nahe der Wurfrichtung (≈8°, ≤ 30 m) wird leicht angesteuert
    let ziel = null, best = 0.99;
    for (const t of wild) {
      if (t.tot >= 0 || t.fang) continue;
      const v = zentrum(t, _b).sub(pos), d = v.length();
      if (d > 30 || d < 0.3) continue;
      const cos = v.dot(dir) / d;
      if (cos > best) { best = cos; ziel = t; }
    }
    const vel = dir.multiplyScalar(WURF.tempo).addScaledVector(up, WURF.hoch);
    mesh.position.copy(pos);
    scene.add(mesh);
    kugeln.push({ mesh, pos, vel, q, zustand: 'flug', zeit: 0, spin: V3().randomDirection(), fangbar: true, ziel });
  });

  function kugelUpdate(b, dt) {
    b.zeit += dt;
    if (b.zustand === 'flug') {
      const schritte = 3, h = dt / schritte;
      for (let s = 0; s < schritte && b.zustand === 'flug'; s++) {
        const up = _a.copy(b.pos).normalize();
        b.vel.addScaledVector(up, -GRAV * h);
        const z = b.ziel;
        if (z && b.fangbar && z.tot < 0 && !z.fang) {
          const w = zentrum(z, _b).sub(b.pos), d = w.length();
          if (d > 0.2) b.vel.lerp(w.multiplyScalar(Math.max(b.vel.length(), 8) / d), Math.min(1, h * 4));
        }
        b.pos.addScaledVector(b.vel, h);
        if (b.fangbar) {
          for (const t of wild) {
            if (t.tot >= 0 || t.fang) continue;
            if (zentrum(t, _b).distanceTo(b.pos) < t.radius + KUGEL_RADIUS + 0.25) { treffer(b, t); break; }
          }
          if (b.zustand !== 'flug') break;
        }
        const gh = hoeheAt(_c.copy(b.pos).normalize());
        const r = b.pos.length();
        if (gh < 0 && r < R) {
          partikel.emit(b.pos, 10, 0xbfe6ff, 2, up, 0.5, 3);
          toast('Die Kugel ist im Wasser versunken'); b.weg = true; return;
        }
        if (r < R + gh + KUGEL_RADIUS) {
          b.pos.copy(_c).multiplyScalar(R + gh + KUGEL_RADIUS);
          if (b.vel.length() > 4) { // abprallen
            const n = _c; b.vel.addScaledVector(n, -1.6 * b.vel.dot(n)).multiplyScalar(0.35);
            b.fangbar = false;
          } else {
            b.zustand = 'liegt'; b.zeit = 0;
            if (!b.abgeprallt) toast('Daneben! (Kugel liegt am Boden – E zum Aufheben)');
          }
        }
      }
      b.mesh.position.copy(b.pos);
      b.mesh.rotateOnAxis(b.spin, dt * 14);
      if (rnd() < 0.5) partikel.emit(b.pos, 1, b.q.farbe, 0.3, null, 0.35, 0);
      if (b.zeit > 6) b.weg = true;
    } else if (b.zustand === 'liegt') {
      if (b.zeit > 90) b.weg = true;
    } else if (b.zustand === 'fang') fangAblauf(b, dt);
  }

  function treffer(b, t) {
    const q = b.q;
    if (q.stufe < t.stufe) {
      // prallt ab
      const n = zentrum(t, _b).sub(b.pos).normalize();
      b.vel.addScaledVector(n, -1.8 * b.vel.dot(n)).multiplyScalar(0.4);
      b.fangbar = false; b.abgeprallt = true;
      partikel.emit(b.pos, 8, 0xffffff, 2, null, 0.3, 0);
      const noetig = kugelFuerStufe(t.stufe);
      toast(`Zu stark – du brauchst mindestens ${DATA.ITEMS[noetig.id]?.name || noetig.id} (Stufe ${t.stufe})`, 3500);
      reagiere(t);
      return;
    }
    const chance = fangChance(t, q);
    const r = rnd(), erfolg = r < chance, diff = r - chance;
    b.zustand = 'fang'; b.zeit = 0; b.t = t; b.chance = chance; b.erfolg = erfolg;
    b.wackler = erfolg ? 3 : diff < 0.12 ? 2 : diff < 0.3 ? 1 : 0;
    b.start = b.pos.clone();
    // Ruheplatz am Boden zwischen Tier und Spieler
    const sp = spielerPos(_c);
    _d.copy(sp).sub(t.pos); tangential(_d, t.dir);
    const dSp = _d.length(); _d.normalize();
    b.ruheDir = versetze(t.dir, _d, Math.min(dSp * 0.5, t.radius + 0.4), V3());
    const gh = Math.max(hoeheAt(b.ruheDir), t.k.wasser === 'wasser' ? -0.3 : -99);
    b.ruhe = b.ruheDir.clone().multiplyScalar(R + Math.max(gh, -0.2) + KUGEL_RADIUS);
    if (gh < 0) b.ruhe.copy(b.ruheDir).multiplyScalar(R + 0.05);    // schwimmt auf dem Wasser
    b.blick = _d.clone();
    t.fang = b; t.zustand = 'fang';
    partikel.emit(zentrum(t, _b), 16, q.farbe, 2.5, t.up, 0.5, 0);
  }

  // Ablauf: 0–0.35 s Einsaugen, –0.75 s Fallen, dann bis zu 3× Wackeln, dann Ergebnis
  function fangAblauf(b, dt) {
    const t = b.t, z = b.zeit;
    const up = _a.copy(b.ruhe).normalize();
    // Ausrichtung: Knopf zum Spieler
    _b.copy(b.blick).negate(); tangential(_b, up).normalize();
    _c.crossVectors(up, _b);
    _m4.makeBasis(_c, up, _b); b.mesh.quaternion.setFromRotationMatrix(_m4);
    if (z < 0.35) {
      const f = z / 0.35;
      t.inner.scale.setScalar(t.groesse * (1 - f));
      blitz(t.meshes, true);
      t.obj.position.lerpVectors(t.pos, b.start, f);
      b.mesh.position.copy(b.start);
      b.mesh.scale.setScalar(1 + Math.sin(f * Math.PI) * 0.3);
      return;
    }
    t.obj.visible = false;
    if (z < 0.75) {
      const f = (z - 0.35) / 0.4;
      b.mesh.position.lerpVectors(b.start, b.ruhe, f * f);
      b.mesh.position.addScaledVector(up, Math.sin(f * Math.PI) * 0.5);
      return;
    }
    b.mesh.position.copy(b.ruhe);
    const W = 0.65, w0 = 0.75 + 0.25;  // erstes Wackeln nach kurzer Pause
    const nW = b.wackler;
    const ende = w0 + nW * W + 0.25;
    if (z < ende) {
      const tw = z - w0;
      if (tw > 0) {
        const i = Math.floor(tw / W), f = (tw - i * W) / W;
        if (i < nW && f < 0.6) {
          const a = Math.sin(f / 0.6 * Math.PI * 2) * 0.45 * (1 - f * 0.5);
          b.mesh.rotateOnAxis(_e.set(0, 0, 1), a);
          b.mesh.position.addScaledVector(up, Math.abs(Math.sin(f / 0.6 * Math.PI * 2)) * 0.03);
          b.mesh.userData.knopf.color.setHex(f < 0.3 ? 0xff5040 : 0xffffff);
        } else b.mesh.userData.knopf.color.setHex(0xffffff);
      }
      return;
    }
    if (!b.ergebnis) {
      b.ergebnis = true; b.zeit = z;
      if (b.erfolg) {
        b.mesh.userData.knopf.color.setHex(0x8fff8a);
        _b.copy(b.ruhe).addScaledVector(up, 0.3);
        partikel.emit(_b, 26, 0xffe27a, 3.2, up, 1.0, 1.5);
        partikel.emit(_b, 10, b.q.farbe, 2, up, 0.8, 1);
        fangErfolg(t);
      } else {
        partikel.emit(b.mesh.position, 22, b.q.farbe, 4, up, 0.6, 3);
        partikel.emit(b.mesh.position, 10, 0xffffff, 3, up, 0.4, 3);
        b.mesh.visible = false;
        blitz(t.meshes, false); t.flash = 0;
        t.obj.visible = true; t.fang = null; t.ausbruch = 0.3;
        t.zustand = 'grasen'; t.timer = 0;
        reagiere(t);
        const pz = Math.round(b.chance * 100);
        toast(['Ausgebrochen!', 'Oh nein, fast!', 'Argh – beinahe gehabt!'][Math.min(2, b.wackler)] + ` (Chance ${pz} %)`);
        b.weg = true;
      }
    }
    if (b.erfolg) {
      const f = (z - ende) / 0.8;
      b.mesh.scale.setScalar(Math.max(0.001, 1 - f));
      if (f >= 1) b.weg = true;
    }
  }

  function fangErfolg(t) {
    const k = t.k;
    const faehigkeiten = {};
    for (const [n, s] of Object.entries(k.faehigkeiten)) faehigkeiten[n] = Math.min(3, s + (t.alpha ? 1 : 0));
    const e = { uid: t.uid, id: k.id, name: name(t), stufe: t.stufe, faehigkeiten, aktiv: false, alpha: t.alpha, modell: k.modell, groesse: t.groesse, zeit: Date.now() };
    gefangen.push(e);
    gesehen.add(k.id);
    entferne(t);
    const aktiv = gefangen.filter(x => x.aktiv).length;
    let text = `✨ ${e.name} gefangen!`;
    if (aktiv < MAX_AKTIV) { e.aktiv = true; text += ' Es folgt dir jetzt.'; }
    const fs = Object.entries(faehigkeiten).map(([n, s]) => (DATA.FAEHIGKEITEN[n]?.icon || '') + ' ' + (DATA.FAEHIGKEITEN[n]?.name || n) + ' ' + s);
    if (fs.length) text += '  ' + fs.join(', ');
    toast(text, 4500);
    ctx.emit('gefangen', { id: k.id, uid: e.uid });
    sync();
  }

  // liegende Kugeln aufheben
  ctx.ziele.push(pos => {
    const out = [];
    for (const b of kugeln) {
      if (b.zustand !== 'liegt' || b.weg) continue;
      const d = b.pos.distanceTo(pos);
      if (d < 3) out.push({ dist: d, label: (DATA.ITEMS[b.q.id]?.name || 'Fangkugel') + ' aufheben', act: () => {
        if (b.weg) return; b.weg = true; ctx.emit('item:erhalten', { id: b.q.id, n: 1 });
      } });
    }
    return out;
  });

  // ---------- KI ----------
  function kiUpdate(t, dt, sp, dSp) {
    const k = t.k;
    if (t.tot >= 0) {
      t.tot += dt;
      const f = Math.min(1, t.tot / 0.7);
      t.inner.rotation.z = f * Math.PI / 2;
      t.inner.scale.setScalar(t.groesse * (1 - Math.max(0, f - 0.5) * 2 + 0.001));
      if (t.tot > 0.75) entferne(t);
      return;
    }
    if (t.fang) return;
    if (t.ausbruch > 0) { t.ausbruch -= dt; t.inner.scale.setScalar(t.groesse * (1 - Math.max(0, t.ausbruch) / 0.3)); }
    t.timer -= dt; t.wut -= dt; t.scheu -= dt; t.angriffCd -= dt;
    const spielerImWasser = !!ctx.spieler?.inWasser;
    const kannJagen = k.wasser === 'wasser' ? spielerImWasser : (!spielerImWasser || k.wasser === 'amphib');
    const nacht = laufzeit % 2 < dt ? (t.nachtCache = istNacht(t.dir)) : t.nachtCache;

    // Wahrnehmung
    if (t.zustand !== 'jagd' && t.zustand !== 'flucht') {
      if (k.verhalten === 'aggressiv' && kannJagen && dSp < (12 + t.stufe) * (nacht ? 1.4 : 1)) { t.zustand = 'jagd'; t.timer = 20; }
      else if (k.verhalten === 'scheu' && dSp < 6 + t.groesse * 2.5) { t.zustand = 'flucht'; t.timer = zwischen(3, 6); }
      else if (t.scheu > 0 && dSp < 14) { t.zustand = 'flucht'; t.timer = zwischen(3, 5); }
      else if (t.wut > 0 && kannJagen) { t.zustand = 'jagd'; t.timer = t.wut; }
      else if (k.verhalten === 'zahm' && dSp < 4 && t.zustand === 'grasen') { t.zustand = 'staunen'; t.timer = zwischen(2, 4); }
    }

    switch (t.zustand) {
      case 'grasen':
        t.zielSpeed = 0;
        if (t.timer <= 0) { t.zustand = 'wandern'; t.timer = zwischen(3, 8); t.drehung = zwischen(-1, 1); }
        break;
      case 'staunen':
        t.zielSpeed = 0; dreheZu(t, sp, dt, 3);
        if (t.timer <= 0 || dSp > 6) { t.zustand = 'grasen'; t.timer = zwischen(2, 5); }
        break;
      case 'wandern':
        t.zielSpeed = t.lauf;
        t.fwd.applyAxisAngle(t.dir, (t.drehung || 0) * dt * 0.6);
        if (rnd() < dt * 0.3) t.drehung = zwischen(-1, 1);
        if (t.timer <= 0) { t.zustand = 'grasen'; t.timer = zwischen(2, 7); }
        break;
      case 'flucht':
        t.zielSpeed = t.renn;
        dreheZu(t, sp, dt, 4, true);
        if (t.timer <= 0 && dSp > 12) { t.zustand = 'wandern'; t.timer = zwischen(2, 4); }
        break;
      case 'jagd': {
        const reich = 0.9 + t.radius + (ctx.spieler?.reitet ? 0.6 : 0);
        dreheZu(t, sp, dt, 6);
        t.zielSpeed = dSp > reich * 0.8 ? t.renn : 0;
        if (dSp < reich && t.angriffCd <= 0) {
          t.angriffCd = 1.4; t.lunge = 0.3;
          ctx.emit('spieler:schaden', { n: t.schaden, quelle: name(t) });
        }
        if (dSp > 45 || t.timer <= 0 || !kannJagen) { t.zustand = 'wandern'; t.timer = zwischen(3, 6); t.wut = 0; }
        break;
      }
    }

    // Bewegung
    t.speed += (t.zielSpeed - t.speed) * Math.min(1, dt * 4);
    if (t.speed > 0.02 && !bewege(t, t.fwd, t.speed * dt)) {
      t.fwd.applyAxisAngle(t.dir, Math.PI * zwischen(0.6, 1.2));
      if (t.zustand === 'wandern') t.timer = Math.min(t.timer, 1.5);
    }
    if (t.stoss.lengthSq() > 0.01) {
      bewege(t, _a.copy(t.stoss).normalize(), t.stoss.length() * dt);
      t.stoss.multiplyScalar(Math.pow(0.02, dt));
    }
    platziere(t, dt);

    // Animation (Hüpfen/Wackeln)
    const lauf = Math.min(1, t.speed / Math.max(0.5, t.lauf));
    t.phase += dt * (3 + t.speed * 5 / Math.max(0.4, Math.sqrt(t.groesse)));
    const hopf = k.wasser === 'wasser' ? 0.04 : (k.rolle === 'support' && t.groesse < 0.7 ? 0.22 : 0.09);
    const hop = Math.abs(Math.sin(t.phase)) * hopf * lauf * t.groesse;
    t.inner.position.y = hop + (k.flieger === 2 ? Math.sin(t.phase * 0.8) * 0.08 : 0);
    let neigung = 0, roll = Math.sin(t.phase) * 0.09 * lauf;
    if (k.wasser === 'wasser') { roll = 0; neigung = 0; t.inner.rotation.y = Math.sin(t.phase * 0.6) * 0.15; }
    if (t.zustand === 'grasen' && !k.flieger && k.wasser !== 'wasser') neigung = Math.max(0, Math.sin(t.phase * 0.35)) * 0.18;
    if (t.lunge > 0) { t.lunge -= dt; neigung = -Math.sin(t.lunge / 0.3 * Math.PI) * 0.35; t.inner.position.z = Math.sin(t.lunge / 0.3 * Math.PI) * 0.4 * t.radius; } else t.inner.position.z = 0;
    t.inner.rotation.x = neigung; t.inner.rotation.z = roll;

    // Treffer-Blinken
    if (t.flash > 0) { t.flash -= dt; blitz(t.meshes, t.flash > 0); }
    // Regeneration außerhalb des Kampfes
    if (laufzeit - t.getroffen > 12 && t.hp < t.maxHp) t.hp = Math.min(t.maxHp, t.hp + t.maxHp * 0.03 * dt);
  }

  function schildUpdate(t, dSp) {
    // Spürnase: seltene Tiere und Alphas schon von Weitem markieren
    const selten = spuernase > 0 && (t.alpha || t.k.seltenheit >= 2) && dSp < 35 + 25 * spuernase;
    const zeigen = !ctx.spieler?.karteOffen && t.tot < 0 && !t.fang && (selten || ((dSp < 14 || laufzeit - t.getroffen < 8 || kampfZiel === t) && dSp < 40));
    if (!zeigen) { if (t.schild) t.schild.sprite.visible = false; return; }
    if (!t.schild) { t.schild = new Schild(); scene.add(t.schild.sprite); }
    const s = t.schild;
    s.sprite.visible = true;
    s.zeichne(`${name(t)} · St. ${t.stufe}`, besteKugel >= t.stufe, t.hp / t.maxHp, t.alpha, t.k.glut);
    s.sprite.position.copy(t.pos).addScaledVector(t.up, t.hoehe + 0.35 + t.inner.position.y);
    const sk = Math.max(0.8, s.sprite.position.distanceTo(camera.position) / 7);
    s.sprite.scale.set(1.6 * sk, 0.4 * sk, 1);
  }

  // ---------- Begleiter ----------
  function sync() {
    for (const e of gefangen) if (e.aktiv && !begleiter.has(e.uid)) erzeugeBegleiter(e);
    for (const [uid, b] of begleiter) if (!gefangen.some(e => e.uid === uid && e.aktiv)) entferneBegleiter(uid, b);
    ctx.emit('kreaturen:begleiter', { aktive: gefangen.filter(e => e.aktiv) });
  }

  function erzeugeBegleiter(e) {
    const k = K[e.id]; if (!k) return;
    const sp = spielerPos(V3());
    const b = { e, k, obj: new THREE.Group(), inner: null, tick: null, dir: sp.clone().normalize(), pos: sp.clone(), fwd: V3(), up: V3(),
      speed: 0, phase: 0, angriffCd: 0, lunge: 0, flug: 0, groesse: e.groesse || k.groesse, hoehe: 1, bereit: false };
    zufallsTangente(b.dir, b.fwd);
    begleiter.set(e.uid, b);
    scene.add(b.obj);
    lebendig(k.modell).then(r => {
      if (begleiter.get(e.uid) !== b) return;
      b.inner = r.gruppe; b.tick = r.tick;
      if (k.wasser === 'wasser') b.groesse = Math.min(b.groesse, 0.9);   // schwebt in einer Wasserblase
      b.inner.scale.setScalar(b.groesse);
      const box = new THREE.Box3().setFromObject(r.gruppe);
      b.hoehe = Math.max(0.1, box.max.y - box.min.y);
      if (k.glut || e.alpha) r.gruppe.traverse(o => {
        if (o.isMesh && o.material?.emissive) { o.material = o.material.clone(); o.material.emissive.setHex(k.glut ? 0xff4a10 : 0x4a3000); o.material.emissiveIntensity = k.glut ? 0.5 : 1; }
      });
      r.gruppe.traverse(o => { if (o.isMesh) o.castShadow = true; });
      b.obj.add(b.inner);
      if (k.wasser === 'wasser') {
        b.blase = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14), new THREE.MeshLambertMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.28, depthWrite: false }));
        b.obj.add(b.blase);
      }
      b.bereit = true;
    }).catch(err => console.warn('Begleiter', e.id, err));
  }

  function entferneBegleiter(uid, b) {
    scene.remove(b.obj);
    b.obj.traverse(o => { if (o.isMesh) { o.geometry?.dispose?.(); } });
    begleiter.delete(uid);
  }

  function begleiterUpdate(dt, sp) {
    const s = ctx.spieler;
    const up = _d.copy(sp).normalize();
    const fwd = _e.copy(s?.forward || camera.getWorldDirection(_e)); tangential(fwd, up);
    if (fwd.lengthSq() < 1e-6) zufallsTangente(up, fwd); fwd.normalize();
    const rechts = V3().crossVectors(fwd, up).normalize();
    const reit = s?.reitet ? reittier() : null;
    let slot = 0;
    for (const b of begleiter.values()) {
      if (!b.bereit) continue;
      const k = b.k;
      try { b.tick?.(performance.now()); } catch (err) { b.tick = null; }
      b.angriffCd -= dt;
      // Reittier: unter dem Spieler
      if (reit && reit.uid === b.e.uid) {
        // Reittier so skalieren, dass der Rücken auf Hüfthöhe des reitenden Spielers liegt (≈1,25 m)
        const hNorm = b.hoehe / b.groesse;
        const sk = Math.min(4, Math.max(0.5, REIT_HOEHE / hNorm));
        b.inner.scale.setScalar(sk);
        b.dir.copy(up);
        const gh = Math.max(0, hoeheAt(up));
        b.pos.copy(up).multiplyScalar(Math.max(R + gh, sp.length()));
        b.fwd.copy(fwd);
        const tempo = s.vel ? s.vel.length() : 0;
        b.phase += dt * (2 + tempo * 1.4);
        b.inner.position.y = Math.abs(Math.sin(b.phase)) * Math.min(0.2, tempo * 0.02);
        b.inner.rotation.x = Math.sin(b.phase * 2) * 0.04 * Math.min(1, tempo / 4);
        b.reitet = true;
        setzeBegleiter(b, up);
        continue;
      }
      if (b.reitet) { b.reitet = false; b.inner.scale.setScalar(b.groesse); b.inner.position.set(0, 0, 0); b.inner.rotation.set(0, 0, 0); }
      // Zielpunkt
      let ziel = null, kampf = false;
      if ((k.faehigkeiten.kampf || b.e.faehigkeiten.kampf) && kampfZiel && kampfZiel.tot < 0 && !kampfZiel.fang && kampfZiel.pos.distanceTo(sp) < 30) {
        ziel = kampfZiel.pos; kampf = true;
      }
      if (!ziel) {
        const seite = [-1, 1, 0][slot % 3], hinten = 0.6 + b.groesse * 0.4 + Math.floor(slot / 3) * 1.5 + (seite === 0 ? 1.6 : 0);
        ziel = _a.copy(sp).addScaledVector(fwd, -hinten).addScaledVector(rechts, seite * (1.6 + b.groesse * 0.5));
      }
      slot++;
      const zielV = _b.copy(ziel).sub(b.pos); tangential(zielV, b.dir);
      const dist = zielV.length();
      if (b.pos.distanceTo(sp) > 40) { b.dir.copy(ziel).normalize(); b.pos.copy(ziel); }
      const halt = kampf ? 0.6 + b.groesse * 0.5 + kampfZiel.radius : 0.5;
      let ziel_v = 0;
      if (dist > halt) { ziel_v = Math.min(14, Math.max(1.5, dist * 2)); b.fwd.lerp(zielV.normalize(), Math.min(1, dt * 8)); }
      else if (!kampf) b.fwd.lerp(fwd, Math.min(1, dt * 2));
      else { b.fwd.lerp(zielV.normalize(), Math.min(1, dt * 8)); }
      tangential(b.fwd, b.dir).normalize();
      b.speed += (ziel_v - b.speed) * Math.min(1, dt * 5);
      versetze(b.dir, b.fwd, b.speed * dt, b.dir);
      // Angriff
      if (kampf && dist <= halt + 0.3 && b.angriffCd <= 0) {
        b.angriffCd = 1.2; b.lunge = 0.3;
        const st = Math.max(k.faehigkeiten.kampf || 0, b.e.faehigkeiten.kampf || 0);
        schadeTier(kampfZiel, Math.max(2, Math.round(k.atk / 3 * (0.6 + 0.4 * st))), b.pos, false);
      }
      // Höhe
      const gh = hoeheAt(b.dir);
      let r = R + gh, flug = 0;
      if (k.wasser === 'wasser') {
        if (gh < -1.2) r = R - Math.min(b.hoehe + 0.3, -gh - 0.3);
        else { r = R + Math.max(gh, 0); flug = 1.1; }        // in der Blase neben dem Spieler
      } else if (gh < 0) r = R - b.hoehe * 0.55;
      if (k.flieger === 2) flug = 0.9 + Math.sin(b.phase * 0.7) * 0.2;
      else if (k.flieger === 1 && b.speed > 1.5) flug = 1.8;
      b.flug += (flug - b.flug) * Math.min(1, dt * 3);
      b.pos.copy(b.dir).multiplyScalar(r + b.flug);
      if (b.blase) b.blase.visible = gh >= -1.2;
      if (b.blase) b.blase.position.y = b.hoehe * 0.5;
      // Animation
      const lauf = Math.min(1, b.speed / 3);
      b.phase += dt * (3 + b.speed * 3);
      b.inner.position.y = Math.abs(Math.sin(b.phase)) * 0.1 * lauf * Math.min(1.5, b.groesse);
      b.inner.rotation.z = Math.sin(b.phase) * 0.08 * lauf;
      if (b.lunge > 0) { b.lunge -= dt; b.inner.position.z = Math.sin(b.lunge / 0.3 * Math.PI) * 0.4; } else b.inner.position.z = 0;
      setzeBegleiter(b, b.dir);
    }
  }
  function setzeBegleiter(b, up) {
    _a.copy(b.fwd); tangential(_a, up);
    if (_a.lengthSq() < 1e-6) return;
    _a.normalize(); _c.crossVectors(up, _a);
    _m4.makeBasis(_c, up, _a);
    b.obj.quaternion.setFromRotationMatrix(_m4);
    b.obj.position.copy(b.pos);
  }

  // ---------- öffentliche API ----------
  function faehigkeit(n) {
    let m = 0;
    for (const e of gefangen) if (e.aktiv) m = Math.max(m, e.faehigkeiten?.[n] || 0);
    return m;
  }
  function setAktiv(uid, an) {
    const e = gefangen.find(x => x.uid === uid); if (!e) return false;
    if (an && !e.aktiv && gefangen.filter(x => x.aktiv).length >= MAX_AKTIV) { toast(`Höchstens ${MAX_AKTIV} Begleiter gleichzeitig`); return false; }
    e.aktiv = !!an; sync(); return true;
  }
  function reittier() {
    let best = null;
    for (const e of gefangen) if (e.aktiv && (e.faehigkeiten?.reiten || 0) > (best?.faehigkeiten.reiten || 0)) best = e;
    if (!best) return null;
    return { ...best, tempo: best.faehigkeiten.reiten, sattelHoehe: 1.25 };
  }
  function lexikon() {
    const fang = new Set(gefangen.map(e => e.id));
    return Object.values(K).map(k => ({
      id: k.id, name: k.name, modell: k.modell, biome: k.biome.slice(), stufe: k.stufe, faehigkeiten: { ...k.faehigkeiten },
      verhalten: k.verhalten, aktivzeit: k.aktiv, seltenheit: k.seltenheit, glut: k.glut,
      gesehen: gesehen.has(k.id) || fang.has(k.id), gefangen: fang.has(k.id),
    })).sort((a, b) => a.stufe - b.stufe || a.name.localeCompare(b.name, 'de'));
  }
  function freilassen(uid) {
    const i = gefangen.findIndex(e => e.uid === uid); if (i < 0) return false;
    const [e] = gefangen.splice(i, 1);
    const b = begleiter.get(uid);
    const dir = b ? b.dir.clone() : spielerPos(V3()).normalize();
    sync();
    const t = spawne(e.id, dir, { alpha: e.alpha });
    if (t) { t.zustand = 'flucht'; t.timer = 3; }
    toast(`${e.name} wurde freigelassen`);
    return true;
  }
  function save() {
    return { v: 1, gefangen: gefangen.map(e => ({ ...e })), gesehen: [...gesehen] };
  }
  function load(d) {
    if (!d) return;
    for (const [uid, b] of [...begleiter]) entferneBegleiter(uid, b);
    gefangen.length = 0;
    for (const e of d.gefangen || []) if (K[e.id]) gefangen.push({ ...e, faehigkeiten: { ...(e.faehigkeiten || K[e.id].faehigkeiten) } });
    gesehen.clear(); for (const id of d.gesehen || []) gesehen.add(id);
    sync();
  }

  // ---------- Frame ----------
  const _sp = V3();
  function update(dt) {
    laufzeit += dt;
    if (!startGespawnt && laufzeit > 0.2) spawnStart();
    const sp = spielerPos(_sp);
    spuernase = faehigkeit('spuernase');
    // seltener: beste Kugel, gesehen, Despawn
    langsamTimer -= dt;
    const langsam = langsamTimer <= 0;
    if (langsam) {
      langsamTimer = 0.5;
      const inv = ctx.spiel?.inventar;
      if (inv?.count) { besteKugel = 0; for (const q of DATA.KUGELN) if (inv.count(q.id) > 0) besteKugel = Math.max(besteKugel, q.stufe); }
    }
    // Spawnen
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = laufzeit < 8 ? 0.1 : 0.45;
      if (wild.length < MAX_WILD) spawnVersuch(sp, laufzeit < 8 ? 22 : SPAWN_MIN, SPAWN_MAX);
    }
    for (let i = wild.length - 1; i >= 0; i--) {
      const t = wild[i];
      const dSp = t.pos.distanceTo(sp);
      if (langsam) {
        if (dSp > DESPAWN && !t.fang) { entferne(t); continue; }
        if (dSp < 30) gesehen.add(t.k.id);
        if (t.k.aktiv !== 'immer' && dSp > 60 && ((t.k.aktiv === 'nacht') !== istNacht(t.dir))) { entferne(t); continue; }
      }
      // weit entfernte Tiere seltener simulieren
      if (dSp > 70 && t.zustand !== 'jagd' && ((i + Math.floor(laufzeit * 10)) % 3)) continue;
      kiUpdate(t, dSp > 70 ? dt * (t.zustand === 'jagd' ? 1 : 3) : dt, sp, dSp);
      if (t.tot < 0) schildUpdate(t, dSp);
    }
    kampfZielZeit -= dt; if (kampfZielZeit <= 0) kampfZiel = null;
    for (let i = kugeln.length - 1; i >= 0; i--) {
      const b = kugeln[i];
      kugelUpdate(b, dt);
      if (b.weg) { scene.remove(b.mesh); b.mesh.userData.knopf?.dispose?.(); kugeln.splice(i, 1); }
    }
    begleiterUpdate(dt, sp);
    // Licht-Begleiter
    const L = faehigkeit('licht');
    if (L > 0) {
      licht.position.copy(sp).addScaledVector(_a.copy(sp).normalize(), 2.6);
      const ziel = (istNacht(_a) ? 1 : 0.35) * (25 + 20 * L);
      licht.intensity += (ziel - licht.intensity) * Math.min(1, dt * 2);
      licht.distance = 18 + 8 * L;
    } else licht.intensity = 0;
    partikel.update(dt);
  }

  const api = {
    update, save, load, faehigkeit, setAktiv, reittier, lexikon, freilassen,
    gefangen, maxAktiv: MAX_AKTIV, wurf: WURF,
    get begleiter() { return gefangen.filter(e => e.aktiv); },
    kreaturen: K, info: id => K[id] || null,
    // Debug/Tests
    wild, spawne: (id, dir, o) => { modell(K[id]?.modell); return spawne(id, dir, o); }, ladeModell: id => modell(K[id]?.modell || id).p,
  };
  return api;
}
