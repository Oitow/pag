// Felder (Ackerbau) im Erde-Labor: mit der Schaufel 2×2-m-Beete umgraben, Saat aus der Tasche säen, wachsen lassen, ernten.
// Knopf „🌱 Säen“ (Blick auf den Boden, bis 5 m): kein Beet → umgraben · leeres Beet → säen · sonst Zustand.
// „Nehmen“ auf ein eigenes Beet = ernten (reif) bzw. Zustand · „Graben“ auf ein Beet = einebnen.
// Regeln ohne THREE: felder-regeln.js · Modelle: felder-modelle.js · Vertrag: erweiterungen.js.
// Wachstum in Spielstunden (welt.zw.uhr, läuft mit dem Zeitraffer), Regen gießt, Frost (welt.zw.tJetzt) schadet.
// Hof = lokaler Tangentenrahmen (Mitte C absolut, Achsen E/U/N) mit 2-m-Raster: Beete eines Hofs liegen Kante an Kante,
// die Meshes hängen lokal in hof.gruppe (keine großen Float32-Koordinaten). Dienst welt.dienste.felder = { beete(), reif() }.
// Testschalter: ?feldtest=1 → nach ~5 s 4 Beete (Saat, Keimling, wachsend, reif) 8 m vor dem Spieler (näher liegen sie unter den Knöpfen) · ?feldtest=reif → alle 6 Früchte reif.
import {
  FRUECHTE, FELD_NAMEN, saatVon, stufe, bodenPruefen, neuesBeet, schrittBeet, ernteMenge, startFrucht, besteSaat, beetText,
} from './felder-regeln.js';
import { pflanzenGeo, pflanzOrte, disposeFelderModelle } from './felder-modelle.js';
import { schichten, stoffInTiefe, STOFFE } from './boden.js';
import { biom } from './klima.js';
import { eignung } from './wachstum.js';
import { NAMEN } from './herstellen-daten.js';
import { standardMaterial } from '../../../engine/render/mesh-builder.js';
import { rng, hashSeed } from '../../../engine/core/rng.js';

const ABSTAND_TEST = 8, HOF_R = 120, BLICK = 5, MAX_DH = 6, NX = 17, NZ = 9, HEBUNG = 0.03, DAMM = 0.06;

export function createFelder(welt) {
  const { THREE, anker, cam, blick, inventar, planet, R } = welt;
  const P = new URLSearchParams(globalThis.location?.search || '');
  // Anzeigenamen für Saat und Ertrag (fehlen in herstellen-daten NAMEN – nur ergänzen, nie überschreiben)
  for (const [id, n] of Object.entries(FELD_NAMEN)) if (!(id in NAMEN)) NAMEN[id] = n;
  const name = (id) => FELD_NAMEN[id] || id;

  const V = () => new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const t1 = V(), t2 = V(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sk = V();
  const zufall = rng(hashSeed(welt.seed ?? 1, 'felder'));
  const erdMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const totMat = standardMaterial({ color: 0x8a6a48 });
  const hoefe = [];
  let startGegeben = false, uhrVorher = null, zeit = 0, schrittT = 0, blickT = 0, blickText = '', testAb = P.get('feldtest') ? performance.now() + 6000 : Infinity;

  // ---------- Höfe und Beete ----------
  function neuerHof(C, U, N) {
    const h = { C: V().copy(C), U: V().copy(U).normalize(), N: V(), E: V(), beete: [], meshes: [], sig: '', gruppe: new THREE.Group() };
    h.N.copy(N).projectOnPlane(h.U).normalize(); h.E.crossVectors(h.U, h.N);
    h.gruppe.position.copy(h.C);
    h.gruppe.quaternion.setFromRotationMatrix(m4.makeBasis(h.E, h.U, h.N));
    anker.add(h.gruppe); hoefe.push(h);
    return h;
  }
  const lokal = (h, p) => { t2.subVectors(p, h.C); return { x: t2.dot(h.E), y: t2.dot(h.U), z: t2.dot(h.N) }; };
  const absolut = (h, x, y, z, out = V()) => out.copy(h.C).addScaledVector(h.E, x).addScaledVector(h.U, y).addScaledVector(h.N, z);
  /** Geländehöhe im Hofrahmen (lokales y) bei (x, z). */
  const bodenY = (h, x, z) => { absolut(h, x, 0, z, t1).normalize(); t1.multiplyScalar(R + welt.bodenHoehe(t1)); return t1.sub(h.C).dot(h.U); };
  const hofBei = (p) => hoefe.find((h) => h.C.distanceTo(p) < HOF_R) || null;
  function beetBei(p) {
    for (const h of hoefe) {
      if (h.C.distanceTo(p) > HOF_R + 3) continue;
      const l = lokal(h, p), x = Math.round(l.x / 2) * 2, z = Math.round(l.z / 2) * 2;
      const b = h.beete.find((b) => b.x === x && b.z === z);
      if (b && Math.abs(l.y - bodenY(h, l.x, l.z)) < 3) return { h, b };
    }
    return null;
  }
  const alleBeete = () => hoefe.flatMap((h) => h.beete);

  /** Oberboden, Wasser, Hang und Klima unter einem Beet → { pr, stoff, wasser, steil } */
  function untergrund(h, x, z) {
    absolut(h, x, 0, z, t1).normalize();
    const pr = planet.probe(t1.x, t1.y, t1.z, 0.5), ein = pr.eingriff || 0;
    const ys = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, c]) => bodenY(h, x + a, z + c));
    const steil = (Math.max(...ys) - Math.min(...ys)) / 2;
    const sch = schichten({ ...pr, h: pr.h - ein }, biom(pr.temp, pr.feuchte), steil);
    return { pr, stoff: stoffInTiefe(sch, Math.max(0, -ein) + 0.05), wasser: pr.wasser > pr.h + 0.05, steil };
  }
  function klimaSetzen(h, b) {
    const u = untergrund(h, b.x, b.z);
    Object.assign(b, { T: u.pr.temp, F: u.pr.feuchte, fb: bodenPruefen({ stoff: u.stoff }).fb || 0.15 });
  }

  /** Kleine Natur (Gras, Blumen) im Beet entfernen; Bäume/Felsen → Name, dann geht es nicht. */
  function naturRaeumen(h, x, z, nurPruefen) {
    const weg = [];
    for (const [a, c] of [[0, 0], [-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6], [0, 0.7], [0, -0.7], [0.7, 0], [-0.7, 0]]) {
      const o = welt.natur?.finde?.(absolut(h, x + a, bodenY(h, x + a, z + c) + 0.2, z + c, t2), 0.25);
      if (!o) continue;
      if (o.r > 0.5 || o.art === 'granitblock') return o.art;
      weg.push(o.id);
    }
    if (!nurPruefen && weg.length) { for (const id of new Set(weg)) welt.eingriffe?.entferne?.(id); welt.natur?.neu?.(); }
    return null;
  }

  function umgraben(p, test = false) {
    let h = hofBei(p);
    if (!h) h = neuerHof(p, t1.copy(p).normalize(), welt.vorn);
    const l = lokal(h, p), x = Math.round(l.x / 2) * 2, z = Math.round(l.z / 2) * 2;
    const u = untergrund(h, x, z);
    const pr = bodenPruefen({ stoff: u.stoff, wasser: u.wasser, steil: u.steil, schaufel: inventar.hat('schaufel', 1) });
    const leer = () => { if (!h.beete.length) entferneHof(h); };
    if (!pr.ok && !test) { leer(); return { ok: false, text: pr.grund }; }
    const im = naturRaeumen(h, x, z, true);
    if (im && !test) { leer(); return { ok: false, text: `Erst ${im.replace(/_/g, ' ')} wegräumen` }; }
    const auge = absolut(h, x, bodenY(h, x, z) + 1.7, z);
    if (!test && (welt.dienste.bau?.hindernisse?.(auge, 2) || []).some((o) => t2.set(o.x, o.y, o.z).distanceTo(auge) < 1.6 + o.r)) { leer(); return { ok: false, text: 'Da steht etwas Gebautes' }; }
    naturRaeumen(h, x, z, false);
    const b = { x, z, ...neuesBeet(u.pr.temp, u.pr.feuchte, pr.fb || 1) };
    h.beete.push(b);
    zeichne(h, true);
    return { ok: true, text: `Beet umgegraben (2 × 2 m, ${STOFFE[u.stoff]?.name || u.stoff}) – jetzt 🌱 Säen${pr.warnung ? ' · ' + pr.warnung : ''}`, b };
  }
  function entferneHof(h) {
    for (const m of h.meshes) { h.gruppe.remove(m); if (m.userData.eigen) m.geometry.dispose(); m.dispose?.(); }
    anker.remove(h.gruppe); hoefe.splice(hoefe.indexOf(h), 1);
  }

  function saeen(b) {
    const f = besteSaat(b.T, b.F, (id) => inventar.zaehle(id));
    if (!f) return { ok: false, text: 'Keine Saat in der Tasche – reife Beete geben 2–3 Saat zurück' };
    const e = eignung(f, b.T, b.F);
    if (e <= 0) return { ok: false, text: `${FRUECHTE[f].name} wächst hier nicht (${b.T < 10 ? 'zu kalt' : 'zu heiß/trocken'}) – Saat bleibt in der Tasche` };
    inventar.nimm(saatVon(f), 1);
    Object.assign(b, { f, p: 0, g: 1 });
    const wie = e >= 0.7 ? 'wächst hier gut' : e >= 0.3 ? 'wächst hier mäßig' : 'wächst hier schlecht';
    return { ok: true, text: `${FRUECHTE[f].name} gesät – ${wie}${b.fb < 0.3 ? ' · magerer Boden' : ''}` };
  }
  function ernten(b) {
    if (b.f && b.g <= 0) { Object.assign(b, { f: null, p: 0, g: 1 }); return { ok: true, text: 'Erfrorene Pflanzen ausgerissen – Beet ist wieder frei' }; }
    if (!b.f || b.p < 1) return { ok: false, text: beetText(b) };
    const gibt = ernteMenge(b, zufall());
    for (const [id, n] of gibt) inventar.gib(id, n);
    Object.assign(b, { f: null, p: 0, g: 1 });
    return { ok: true, text: 'Geerntet: ' + gibt.map(([id, n]) => `+${n} ${name(id)}`).join(' · ') };
  }

  // ---------- Darstellung ----------
  const glatt = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  const damm = (x) => DAMM * (0.5 + 0.5 * Math.cos(2 * Math.PI * (x - 0.25) / 0.5));
  const farbe = new THREE.Color();
  function beetGeometrie(h) {
    const n = h.beete.length, pos = new Float32Array(n * NX * NZ * 3), col = new Float32Array(n * NX * NZ * 3), idx = [];
    let v = 0;
    for (const b of h.beete) {
      const v0 = v, nass = Math.min(1, b.w / 0.6);
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
        const lx = -1 + (2 * i) / (NX - 1), lz = -1 + (2 * j) / (NZ - 1);
        const k = glatt(Math.min(1 - Math.abs(lx), 1 - Math.abs(lz)) / 0.25), d = damm(lx) * k;   // Rand läuft weich in den Boden aus
        pos.set([b.x + lx, bodenY(h, b.x + lx, b.z + lz) - 0.03 + k * (0.03 + HEBUNG) + d, b.z + lz], v * 3);
        farbe.setRGB(0.2 + d * 2.2, 0.14 + d * 1.5, 0.09 + d * 0.9).multiplyScalar(1 - 0.3 * nass);
        col.set([farbe.r, farbe.g, farbe.b], v * 3); v++;
      }
      for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
        const a = v0 + j * NX + i, c = a + NX;
        idx.push(a, c, a + 1, a + 1, c, c + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }
  /** Was wird gezeigt? Stufe + grobe Größe (Wachstum sichtbar) + tot. */
  function ansicht(b) {
    if (!b.f) return null;
    const st = stufe(b.p), tot = b.g <= 0;
    const anteil = st === 'keimling' ? (b.p - 0.12) / 0.28 : st === 'wachsend' ? (b.p - 0.4) / 0.6 : 1;
    return { st, tot, gr: st === 'saat' || st === 'reif' ? 1 : 0.6 + 0.4 * Math.round(anteil * 4) / 4 };
  }
  function zeichne(h, beetNeu = false) {
    const sig = h.beete.map((b) => { const a = ansicht(b); return `${b.x},${b.z},${b.f},${a?.st},${a?.tot},${a?.gr},${Math.round(b.w * 2)}`; }).join('|');
    if (sig === h.sig && !beetNeu) return;
    h.sig = sig;
    for (const m of h.meshes) { h.gruppe.remove(m); if (m.userData.eigen) m.geometry.dispose(); m.dispose?.(); }
    h.meshes = [];
    if (!h.beete.length) return;
    const erde = new THREE.Mesh(beetGeometrie(h), erdMat);
    erde.receiveShadow = true; erde.userData.eigen = true;
    h.meshes.push(erde);
    const gruppen = new Map();   // frucht:stufe:tot → [[x, y, z, dreh, sx, sy]…]
    for (const b of h.beete) {
      const a = ansicht(b);
      if (!a) continue;
      const key = `${b.f}:${a.st}:${a.tot ? 1 : 0}`;
      if (!gruppen.has(key)) gruppen.set(key, []);
      for (const [px, pz, dreh, s] of pflanzOrte(b.f, hashSeed(welt.seed ?? 1, 'beet', b.x, b.z))) {
        const x = b.x + px, z = b.z + pz;
        gruppen.get(key).push([x, bodenY(h, x, z) + HEBUNG + damm(px) - 0.015, z, dreh, s, s * a.gr * (a.tot ? 0.55 : 1)]);
      }
    }
    for (const [key, liste] of gruppen) {
      const [f, st, tot] = key.split(':');
      const mesh = new THREE.InstancedMesh(pflanzenGeo(f, st), tot === '1' ? totMat : standardMaterial(), liste.length);
      liste.forEach(([x, y, z, dreh, s, sy], i) => { q.setFromAxisAngle(Y, dreh); mesh.setMatrixAt(i, m4.compose(t1.set(x, y, z), q, sk.set(s, sy, s))); });
      mesh.castShadow = st !== 'saat'; mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      h.meshes.push(mesh);
    }
    for (const m of h.meshes) h.gruppe.add(m);
  }

  // ---------- Blick auf den Boden (eigener Knopf) ----------
  function blickBoden() {
    for (let t = 0.4; t <= BLICK; t += 0.1) {
      t1.copy(cam).addScaledVector(blick, t);
      const l = t1.length(); t2.copy(t1).divideScalar(l);
      const pr = planet.probe(t2.x, t2.y, t2.z, 0.5);
      if (l - R <= Math.max(pr.h, pr.wasser)) return t2.clone().multiplyScalar(R + pr.h);
    }
    return null;
  }
  function knopfDruck() {
    if (!welt.spieler().gehen) { welt.melde('Erst „Gehen“ – dann säen', false); return; }
    const p = blickBoden();
    if (!p) { welt.melde('Schau auf den Boden vor dir (bis 5 m)', false); return; }
    const t = beetBei(p);
    let r;
    if (!t) r = umgraben(p);
    else if (!t.b.f) { r = saeen(t.b); zeichne(t.h); }
    else if (t.b.p >= 1 || t.b.g <= 0) { r = ernten(t.b); zeichne(t.h); }
    else r = { ok: true, text: beetText(t.b) };
    welt.melde(r.text, r.ok);
    welt.speichern?.();
  }
  const knopf = welt.knopf('aSaeen', '🌱 Säen', knopfDruck);
  if (knopf?.style) {
    knopf.style.minWidth = '0'; knopf.style.padding = '6px 9px';
    if ((globalThis.innerWidth ?? 1000) < 480) { knopf.textContent = '🌱'; knopf.title = 'Säen / Beet umgraben'; }
  }

  // ---------- Start: Saat in die Tasche, Testbeete ----------
  function startSaat() {
    startGegeben = true;
    t1.copy(cam).normalize();
    const pr = planet.probe(t1.x, t1.y, t1.z, 2), f = startFrucht(pr.temp, pr.feuchte);
    inventar.gib(saatVon(f), 4);
    welt.melde(`🌱 4× ${name(saatVon(f))} in der Tasche – ${FRUECHTE[f].name} wächst hier am besten. Mit Schaufel: 🌱 Säen auf Erde`, true);
  }
  function testBeete() {
    const reif = P.get('feldtest') === 'reif';
    const liste = reif ? Object.keys(FRUECHTE).map((f) => [f, 1]) : [['roggen', 0.05], ['kartoffel', 0.25], ['mais', 0.7], ['weizen', 1]];
    const vorn = welt.vorn, rechts = V().crossVectors(t1.copy(cam).normalize(), vorn).normalize();
    const C = welt.bodenPunkt(V().copy(cam).addScaledVector(vorn, ABSTAND_TEST).addScaledVector(rechts, liste.length % 2 ? 0 : 1));
    const h = neuerHof(C, V().copy(C).normalize(), vorn);
    liste.forEach(([f, p], i) => {
      const x = (i - Math.floor(liste.length / 2)) * 2;
      const r = umgraben(absolut(h, x, bodenY(h, x, 0), 0), true);
      if (r.b) Object.assign(r.b, { f, p, w: 0.6 });
    });
    zeichne(h);
    welt.melde(`Feldtest: ${liste.length} Beete  m voraus`, true);
  }

  // ---------- Zeit ----------
  function wachsen(dh) {
    const u = { tJetzt: welt.zw.tJetzt, regen: welt.zw.wetter?.regen || 0 };
    for (const h of hoefe) {
      const nah = h.C.distanceTo(cam) < 300;
      for (const b of h.beete) {
        for (let rest = dh; rest > 1e-6; rest -= 1) {
          const ev = schrittBeet(b, Math.min(1, rest), u);
          if (ev && nah) welt.melde(ev === 'reif' ? `🌾 ${FRUECHTE[b.f].name} ist reif` : `❄ Frost: ${FRUECHTE[b.f].name} erfroren`, ev === 'reif');
        }
      }
      zeichne(h);
    }
  }
  function update(dt) {
    zeit += dt;
    if (!startGegeben && zeit > 2) startSaat();
    if (performance.now() > testAb) { testAb = Infinity; testBeete(); }
    const uhr = welt.zw.uhr, jetzt = uhr.tag * 24 + uhr.stunde;
    const dh = uhrVorher == null ? 0 : jetzt - uhrVorher;
    uhrVorher = jetzt;
    if (dh > 0 && dh <= MAX_DH) schrittT += dh;
    if (schrittT > 0 && (zeit % 0.5 < dt || schrittT > 1)) { wachsen(schrittT); schrittT = 0; }
    if ((blickT += dt) > 0.4) {
      blickT = 0; blickText = '';
      if (hoefe.length && welt.spieler().gehen) { const p = blickBoden(), t = p && beetBei(p); if (t) blickText = beetText(t.b); }
    }
  }

  welt.dienste.felder = { beete: () => alleBeete().length, reif: () => alleBeete().filter((b) => b.f && b.p >= 1 && b.g > 0).length };

  return {
    name: 'felder',
    update,
    aktion(was, ziel) {
      if (!ziel?.p || !['nehmen', 'graben', 'bauen'].includes(was)) return null;
      const t = beetBei(ziel.p);
      if (!t) return null;
      let r;
      if (was === 'nehmen') r = t.b.f ? ernten(t.b) : { ok: false, text: beetText(t.b) };
      else if (was === 'bauen') r = { ok: false, text: 'Nicht aufs Beet schütten – erst mit Graben einebnen' };
      else {
        t.h.beete.splice(t.h.beete.indexOf(t.b), 1);
        r = { ok: true, text: t.b.f ? `Beet eingeebnet – ${FRUECHTE[t.b.f].name} ist weg` : 'Beet eingeebnet' };
        if (!t.h.beete.length) { entferneHof(t.h); return r; }
      }
      zeichne(t.h, true);
      return r;
    },
    hud() {
      const alle = alleBeete();
      if (!alle.length) return '';
      const reif = alle.filter((b) => b.f && b.p >= 1 && b.g > 0).length, trocken = alle.filter((b) => b.f && b.p < 1 && b.w < 0.2).length;
      return `Felder: ${alle.length} ${alle.length === 1 ? 'Beet' : 'Beete'}, ${reif} reif${trocken ? `, ${trocken} trocken` : ''}${blickText ? ' · ' + blickText : ''}`;
    },
    zustand: () => ({
      start: startGegeben,
      hoefe: hoefe.map((h) => ({ C: h.C.toArray(), U: h.U.toArray(), N: h.N.toArray(),
        b: h.beete.map((b) => [b.x, b.z, b.f, +b.p.toFixed(4), +b.g.toFixed(3), +b.w.toFixed(3)]) })),
    }),
    lade(z) {
      startGegeben = !!z?.start;
      for (const h of [...hoefe]) entferneHof(h);
      for (const s of z?.hoefe || []) {
        const h = neuerHof(V().fromArray(s.C), V().fromArray(s.U), V().fromArray(s.N));
        for (const [x, zz, f, p, g, w] of s.b || []) {
          const b = { x, z: zz, f: FRUECHTE[f] ? f : null, p: p || 0, g: g ?? 1, w: w ?? 0.5, T: 10, F: 0.5, fb: 1 };
          klimaSetzen(h, b); h.beete.push(b);
        }
        if (h.beete.length) zeichne(h, true); else entferneHof(h);
      }
    },
    dispose() {
      for (const h of [...hoefe]) entferneHof(h);
      erdMat.dispose(); disposeFelderModelle(); knopf?.remove?.();
      if (welt.dienste.felder) delete welt.dienste.felder;
    },
  };
}
