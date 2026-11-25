// Gleiter im Erde-Labor: Hängegleiter/Paraglider als Spielmechanik (Flugphysik: gleiter-physik.js, ohne THREE).
// Öffnen: Knopf „🪂 Gleiter“ (nur mit Gleiter in der Tasche) oder in der Luft beim Fallen (> 6 m/s) mit ▲.
// Im Flug: Blickrichtung = Kurs, Stick vor = schneller (Nase runter), zurück = bremsen/hochziehen, seitlich = Kurve, ▼ schließt.
// Aufwind: Thermik über sonnigen, steilen, dunklen Hängen am Tag, Vulkane/Krater, Hangwind, Gewitter-Böen.
// Landung: weich oder Schaden (dienste.ueberleben.schaden). Ohne Gleiter: Fallschaden bei harten Landungen.
// Testschalter (nur mit ?test=1): ?gleiter=1 (Gleiter in die Tasche), ?flug=1 (nach dem Laden 300 m hoch im offenen Gleiter).
import {
  neuerFlug, schritt, messe, aufwind, thermikMuster, rauschen, landeSchaden, fallSchaden,
} from './gleiter-physik.js';

const AUGE = 1.7;             // wie planet.js
const WIND_MS = 14;           // wetter.wind 1 = Sturm ≈ 14 m/s
const AUF_T = 0.2;            // Aufwind alle 0,2 s neu messen
const KANTE = 60;             // m: Abstand für den Höhengradienten
const KURVE = 0.9;            // rad: so weit lenkt der Stick seitlich vom Blick weg

const komma = (x, n = 1) => x.toFixed(n).replace('.', ',');

export function createGleiter(welt) {
  const { THREE, R } = welt;
  const P = new URLSearchParams(globalThis.location?.search || '');
  const test = P.get('test') === '1';
  let flugStart = test && +P.get('flug') > 0 ? (+P.get('flug') === 1 ? 300 : Math.max(20, +P.get('flug'))) : 0; // ?flug=1 → 300 m, ?flug=800 → 800 m
  if (test && (P.get('gleiter') === '1' || flugStart) && !welt.inventar.hat('gleiter', 1)) welt.inventar.gib('gleiter', 1);
  let wartet = 0;

  let offen = false, f = null, auf = 0, aufT = 0, zeit = 0, steigGlatt = 0, ruhe = 0, fallVorher = 0, warInLuft = false;
  let agl = 0, letzterText = '';
  const hat = () => welt.inventar.hat('gleiter', 1);
  const arr = (v) => [v.x, v.y, v.z];

  // ---------- Aufwind am Ort messen (Gelände rund um den Spieler) ----------
  const o = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), q = new THREE.Vector3(), farbe = [0, 0, 0];
  function hoeheBei(v) { const p = welt.planet.probe(v.x, v.y, v.z, 8); return p.h; }
  function misseAufwind() {
    o.copy(welt.cam).normalize();
    e1.set(0, 1, 0).cross(o); if (e1.lengthSq() < 1e-6) e1.set(1, 0, 0).cross(o);
    e1.normalize(); e2.crossVectors(o, e1);
    const d = KANTE / R;
    const h1 = hoeheBei(q.copy(o).addScaledVector(e1, d).normalize());
    const h2 = hoeheBei(q.copy(o).addScaledVector(e2, d).normalize());
    const p = welt.planet.probe(o.x, o.y, o.z, 8);
    const h0 = p.h, wasser = p.wasser, vulkan = p.vulkan, lava = p.lava;
    const gx = (h1 - h0) / KANTE, gy = (h2 - h0) / KANTE, steil = Math.hypot(gx, gy);
    let dunkel = 0.5;
    if (welt.planet.farbe) { welt.planet.farbe(o.x, o.y, o.z, p, 1 / Math.sqrt(1 + steil * steil), farbe); dunkel = 1 - Math.min(1, (farbe[0] + farbe[1] + farbe[2]) / 1.6); }
    let kraterNah = 0;                                                               // Krater in der Nähe: warme Luft steigt weit herum
    if (vulkan > 0.05) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const pk = q.copy(o).addScaledVector(e1, a * 700 / R).addScaledVector(e2, b * 700 / R).normalize();
      kraterNah = Math.max(kraterNah, welt.planet.probe(pk.x, pk.y, pk.z, 50).lava);
    }
    const grad = q.copy(e1).multiplyScalar(gx).addScaledVector(e2, gy);           // waagerecht, m pro m
    const n = o.clone().sub(grad).normalize();                                       // Hangnormale
    const zw = welt.zw, sonne = zw.sonne, W = zw.wetter;
    const windV = zw.windWelt.clone().projectOnPlane(o).multiplyScalar(WIND_MS * (W.wind ?? 0));
    const boden = Math.max(h0, wasser);
    agl = welt.cam.length() - R - boden;
    const gp = arr(o.clone().multiplyScalar(R + h0));
    auf = aufwind({
      sonneHoch: sonne.dot(o), hangSonne: n.dot(sonne), steil, dunkel, wolken: W.wolken ?? 0, agl,
      ueberWasser: wasser > h0, vulkan, lava, kraterNah, hangwind: windV.dot(grad), muster: thermikMuster(gp),
      gewitter: W.art === 'gewitter', turb: rauschen(zeit * 0.6, gp[0] / 250, gp[2] / 250) * 2 - 1,
    });
    if (test) vario.dataset.mess = `v ${vulkan.toFixed(2)} l ${lava.toFixed(2)} kn ${kraterNah.toFixed(2)} hang ${n.dot(sonne).toFixed(2)} wind ${windV.length().toFixed(1)}`;
    return windV;
  }
  let windV = new THREE.Vector3();

  // ---------- Öffnen / Schließen ----------
  function oeffne(v) {
    if (offen || !hat()) return false;
    offen = true; steigGlatt = 0; aufT = 0;
    f = neuerFlug(arr(welt.cam), v ? arr(v) : arr(welt.oben.clone().multiplyScalar(welt.spieler().fallV).addScaledVector(welt.vorn, 6)));
    knopf && knopf.classList.add('on');
    return true;
  }
  function schliesse(fallV) {
    if (!offen) return;
    offen = false; ruhe = 0.3;
    if (fallV != null) welt.setzeFall?.(fallV);
    knopf && knopf.classList.remove('on');
  }
  function bodenUnter() {
    o.copy(welt.cam).normalize();
    const p = welt.planet.probe(o.x, o.y, o.z, 0.5);
    return welt.cam.length() - R - Math.max(p.h, p.wasser);
  }
  const knopf = welt.knopf?.('aGleiter', '🪂 Gleiter', () => {
    if (offen) { schliesse(messe(f).steig); return; }
    if (!welt.spieler().gehen) return;
    if (bodenUnter() < AUGE + 3) { welt.melde('🪂 Erst in die Luft: von einer Kante springen, dann ▲ (oder hier tippen)', false); return; }
    oeffne();
  });
  const zeigeKnopf = () => { if (knopf) knopf.style.display = hat() ? '' : 'none'; };
  zeigeKnopf();
  const abmelden = welt.inventar.onAenderung?.(zeigeKnopf);

  // ---------- Vario (Steigen grün / Sinken rot) ----------
  const vario = document.createElement('div');
  vario.id = 'gleiterVario';
  vario.style.cssText = 'position:fixed;left:calc(50% - 84px);top:calc(50% - 60px);width:12px;height:120px;border-radius:6px;background:rgba(6,10,20,.45);' +
    'z-index:5;pointer-events:none;display:none;box-shadow:0 0 0 1px rgba(255,255,255,.12)';
  vario.innerHTML = '<div style="position:absolute;left:-3px;right:-3px;top:59px;height:2px;background:rgba(255,255,255,.55)"></div>' +
    '<div class="balken" style="position:absolute;left:2px;right:2px;border-radius:3px"></div>' +
    '<div class="zahl" style="position:absolute;left:-8px;top:126px;font:600 11px ui-monospace,monospace;color:#fff;text-shadow:0 1px 2px #000;white-space:nowrap"></div>';
  document.body.appendChild(vario);
  const balken = vario.querySelector('.balken'), zahl = vario.querySelector('.zahl');
  function zeigeVario(s) {
    s = Math.round(s * 10) / 10 || 0;
    if (!offen) { if (vario.style.display !== 'none') vario.style.display = 'none'; return; }
    vario.style.display = '';
    const px = Math.min(58, Math.abs(s) / 5 * 58);
    balken.style.top = (s >= 0 ? 60 - px : 61) + 'px';
    balken.style.height = px + 'px';
    balken.style.background = s >= 0 ? '#4fdc6a' : '#ff5a4a';
    zahl.textContent = (s >= 0 ? '+' : '−') + komma(Math.abs(s));
    vario.dataset.auf = auf.toFixed(2);
  }

  welt.dienste.gleiter = { fliegt: () => offen };   // für Kamera (3. Person), Figur, Tagebuch

  // ---------- Kappe über dem Kopf (Low-Poly, 9 m Spannweite) ----------
  const kappe = baueKappe(THREE);
  kappe.visible = false;
  welt.anker.add(kappe);
  const kx = new THREE.Vector3(), ky = new THREE.Vector3(), kz = new THREE.Vector3(), km = new THREE.Matrix4();
  function stelleKappe() {
    kappe.visible = offen;
    if (!offen) return;
    const ob = welt.oben, vor = new THREE.Vector3(f.v[0], f.v[1], f.v[2]).projectOnPlane(ob);
    if (vor.lengthSq() < 0.01) vor.copy(welt.vorn);
    vor.normalize();
    const re = new THREE.Vector3().crossVectors(vor, ob);
    ky.copy(ob).multiplyScalar(Math.cos(f.bank)).addScaledVector(re, Math.sin(f.bank));
    kx.crossVectors(vor, ky).normalize(); kz.crossVectors(kx, ky);
    km.makeBasis(kx, ky, kz);
    kappe.quaternion.setFromRotationMatrix(km);
    kappe.position.copy(welt.cam).addScaledVector(ky, 4).addScaledVector(vor, 0.8);
  }

  // ---------- Bewegung (übernimmt im offenen Gleiter) ----------
  const kurs = new THREE.Vector3(), rechts = new THREE.Vector3();
  function bewegung(dt, e) {
    const sp = welt.spieler();
    if (!sp.gehen) return false;
    if (flugStart && (wartet > 10 || !document.getElementById('load'))) { // Testschalter ?flug=1
      const d = welt.cam.clone().normalize();
      if (P.get('ort') === 'krater') sucheKrater(d);                                 // mit &ort=krater: direkt über dem Lavasee
      welt.cam.copy(d).multiplyScalar(R + welt.bodenHoehe(d) + flugStart);
      flugStart = 0;
      oeffne(welt.vorn.clone().multiplyScalar(10.5).addScaledVector(d, -1.2));
    }
    if (!offen) {
      if (e.hoch > 0 && !sp.amBoden && !sp.schwimmt && sp.fallV < -6 && hat() && bodenUnter() > AUGE + 2) oeffne();
      if (!offen) return false;
    }
    if (e.hoch < 0) { schliesse(messe(f).steig); return false; }
    if (Math.hypot(welt.cam.x - f.p[0], welt.cam.y - f.p[1], welt.cam.z - f.p[2]) > 30) { schliesse(0); return false; } // versetzt (Ort, Aufwachen)
    zeit += dt; aufT -= dt;
    if (aufT <= 0) { aufT = AUF_T; windV = misseAufwind(); }
    // Kurs: Blickrichtung, Stick seitlich lenkt davon weg in die Kurve
    rechts.crossVectors(welt.vorn, welt.oben).normalize();
    const a = Math.max(-1, Math.min(1, e.seit || 0)) * KURVE;
    welt.drehe?.(-a * 1.1 * dt);   // Blick dreht in die Kurve mit (sonst lenkt nur der Blick)
    kurs.copy(welt.vorn).multiplyScalar(Math.cos(a)).addScaledVector(rechts, Math.sin(a));
    schritt(f, dt, { R, vor: e.vor || 0, kurs: arr(kurs), wind: arr(windV), auf });
    welt.cam.set(f.p[0], f.p[1], f.p[2]);
    stoesse();
    const m = messe(f);
    steigGlatt += (m.steig - steigGlatt) * Math.min(1, dt * 2.5);
    welt.setzeFall?.(m.steig);
    // Boden / Wasser
    o.copy(welt.cam).normalize();
    const p = welt.planet.probe(o.x, o.y, o.z, 0.5);
    const boden = Math.max(p.h, p.wasser), nass = p.wasser > p.h;
    agl = welt.cam.length() - R - boden;
    if (agl < AUGE + 0.3) lande(-m.steig, m.grund, nass, boden);
    return true;
  }
  function sucheKrater(d) {
    const re = new THREE.Vector3().crossVectors(welt.vorn, d), best = d.clone(), pk = new THREE.Vector3();
    let bl = welt.planet.probe(d.x, d.y, d.z, 50).lava;
    for (let a = 0; a <= 3000; a += 50) for (let b = -600; b <= 600; b += 100) {
      pk.copy(d).addScaledVector(welt.vorn, a / R).addScaledVector(re, b / R).normalize();
      const l = welt.planet.probe(pk.x, pk.y, pk.z, 50).lava;
      if (l > bl) { bl = l; best.copy(pk); }
    }
    d.copy(best);
  }
  function lande(sinkt, fahrt, nass, boden) {
    welt.cam.copy(o).multiplyScalar(R + boden + AUGE);
    const n = landeSchaden(sinkt, fahrt, nass);
    schliesse(0); ruhe = 0.6;
    if (n > 0) { welt.dienste.ueberleben?.schaden?.(n, 'Absturz'); welt.melde(`🪂 Harte Landung! (${Math.round(sinkt * 3.6)} km/h Sinken, ${Math.round(fahrt * 3.6)} km/h Fahrt)`, false); }
    else welt.melde(nass ? '🪂 Im Wasser gelandet' : '🪂 Sanft gelandet');
  }
  // Stämme, Felsen, gebaute Teile: hinausschieben, Fahrt in die Wand nehmen, bei Tempo tut es weh
  const tmp = new THREE.Vector3();
  function stoesse() {
    const c = welt.cam, ob = welt.oben;
    const liste = [...(welt.natur?.naheHindernisse?.() || []), ...(welt.dienste.bau?.hindernisse?.(c, 6) || [])];
    for (const h of liste) {
      tmp.set(c.x - h.x, c.y - h.y, c.z - h.z);
      const hoehe = tmp.dot(ob);
      if (hoehe > 12 || hoehe < -2) continue;
      tmp.addScaledVector(ob, -hoehe);
      const d = tmp.length(), r = h.r + 0.4;
      if (d >= r || d < 1e-4) continue;
      tmp.multiplyScalar(1 / d);
      c.addScaledVector(tmp, r - d);
      const rein = -(f.v[0] * tmp.x + f.v[1] * tmp.y + f.v[2] * tmp.z);
      if (rein > 0) {
        for (let i = 0; i < 3; i++) f.v[i] += rein * [tmp.x, tmp.y, tmp.z][i];
        if (rein > 8) welt.dienste.ueberleben?.schaden?.(Math.round((rein - 8) * 4), 'Absturz');
      }
      f.p = [c.x, c.y, c.z];
    }
  }

  function update(dt) {
    const sp = welt.spieler();
    if (flugStart && !sp.gehen) document.getElementById('bGehen')?.click();       // ?flug=1 an Orten ohne „Gehen“
    if (flugStart) wartet += dt;
    if (offen && (!sp.gehen || welt.dienste.ueberleben?.tot || !hat())) schliesse(0);
    ruhe = Math.max(0, ruhe - dt);
    // Fallschaden ohne Gleiter: war in der Luft, jetzt am Boden
    if (sp.gehen && !offen) {
      if (warInLuft && sp.amBoden && !sp.schwimmt && ruhe <= 0) {
        const n = fallSchaden(fallVorher);
        if (n > 0) { welt.dienste.ueberleben?.schaden?.(n, 'Sturz'); welt.melde(`Autsch – harter Sturz (${Math.round(-fallVorher * 3.6)} km/h)`, false); }
      }
      warInLuft = !sp.amBoden && !sp.schwimmt;
      fallVorher = sp.fallV;
    } else { warInLuft = false; fallVorher = 0; }
    stelleKappe();
    zeigeVario(steigGlatt);
  }

  function hud() {
    if (offen) {
      const m = messe(f), s = Math.round(steigGlatt * 10) / 10 || 0;
      letzterText = `🪂 ${Math.round(m.grund * 3.6)} km/h · ${s >= 0 ? 'Steigen +' : 'Sinken −'}${komma(Math.abs(s))} m/s · Höhe ${Math.round(Math.max(0, agl - AUGE))} m` +
        (f.abriss ? ' · ⚠ Abriss!' : '');
      return letzterText;
    }
    const sp = welt.spieler();
    if (sp.gehen && !sp.amBoden && !sp.schwimmt && sp.fallV < -6 && hat()) return '🪂 ▲ öffnet den Gleiter';
    return '';
  }

  return {
    name: 'gleiter', update, bewegung, hud,
    get offen() { return offen; },
    dispose() {
      abmelden?.(); knopf?.remove(); vario.remove();
      delete welt.dienste.gleiter; welt.anker.remove(kappe); kappe.traverse((k) => { k.geometry?.dispose(); k.material?.dispose(); });
    },
  };
}

// Kappe: Bogen aus 9 Zellen (Spannweite ~9 m), Profil mit Nase vorn; hängt 4 m über dem Auge (sichtbar beim Blick nach oben).
// Leinen zum Gurt sehen aus der Ich-Sicht wie Fäden aus dem Nichts aus – darum weggelassen.
function baueKappe(THREE) {
  const g = new THREE.Group();
  const RB = 5, N = 9, A = 1.05, pos = [], col = [];
  const farben = [[0.95, 0.45, 0.15], [0.96, 0.88, 0.66]];
  // Profil (z vorn negativ): Nase, Oberseite, Hinterkante, Unterseite – Dicke nach außen
  const profil = [[-1.15, 0], [-0.75, 0.22], [-0.1, 0.28], [1.25, 0], [-0.1, -0.06], [-0.75, -0.08]];
  const rippe = (i) => {
    const a = -A + (2 * A * i) / N, dick = 1 - 0.5 * Math.abs(a / A), tief = 1 - 0.25 * Math.abs(a / A);
    const nx = Math.sin(a), ny = Math.cos(a);
    return profil.map(([z, d]) => [nx * (RB + d * dick), ny * (RB + d * dick) - RB, z * tief]);
  };
  for (let i = 0; i < N; i++) {
    const r0 = rippe(i), r1 = rippe(i + 1), c = farben[i % 2];
    for (let k = 0; k < profil.length; k++) {
      const k2 = (k + 1) % profil.length;
      const licht = [0.95, 1, 0.9, 0.82, 0.78, 0.86][k], cc = c.map((x) => x * licht); // durchscheinender Stoff: unlit, Schattierung eingebacken
      pos.push(...r0[k], ...r1[k], ...r1[k2], ...r0[k], ...r1[k2], ...r0[k2]);
      for (let j = 0; j < 6; j++) col.push(...cc);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  return g;
}
