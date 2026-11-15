/**
 * @modul    aufgaben-anzeige
 * @zweck    Ziel-Zeile oben links (Titel, Schritt-Text, Fortschritt), Ziel-Marker (Raute + Meter) bzw. Randpfeil, Blitz-Meldung/Banner; DOM, THREE nur für project()
 * @api      createAufgabenAnzeige({eltern,oben,links,zIndex,rand}) -> { element, setze(info|null), ziel({x,y,z}|null), update(kamera, dt, spielerPos?), blitz(text,{dauer,gross}), zeige(an), sichtbar, dispose() } ; randLage({x,y,z}, breite, hoehe, rand) -> { x, y, winkel, imBild }
 * @beispiel
 *   import { createAufgabenAnzeige } from '../../engine/ui/aufgaben-anzeige.js';
 *   const anzeige = createAufgabenAnzeige({ oben: 12 });
 *   anzeige.setze(aufgaben.aktuell());               // null blendet aus
 *   anzeige.ziel({ x: 12, y: 1.5, z: -8 });          // Weltpunkt des Ziels
 *   anzeige.update(kamera, dt, { x: spieler.x, z: spieler.z });   // jedes Bild
 *   anzeige.blitz('Willkommen in der Enklave', { gross: true, dauer: 5 });
 * @tags     ui, aufgabe, ziel, marker, pfeil, banner, tutorial, overlay
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';

const SCHRIFT = 'system-ui,-apple-system,"Segoe UI",sans-serif';
const AKZENT = '#ffd45a';
const FADE = 0.4;

/**
 * Projektion (NDC aus Vector3.project) -> Bildschirmlage. Im Bild: Punkt selbst. Sonst auf den Rand (Abstand `rand`) geklemmt,
 * winkel = Richtung vom Bildmittel (Bogenmaß, 0 = rechts, y nach unten). Hinter der Kamera (z > 1) ist NDC gespiegelt und wird zurückgespiegelt.
 */
export function randLage({ x, y, z }, breite, hoehe, rand = 28) {
  const hinten = z > 1;
  const nx = hinten ? -x : x, ny = hinten ? -y : y;
  const cx = breite / 2, cy = hoehe / 2;
  let dx = nx * cx, dy = -ny * cy;
  const imBild = !hinten && Math.abs(dx) <= cx - rand && Math.abs(dy) <= cy - rand;
  const winkel = Math.atan2(dy, dx);
  if (imBild) return { x: cx + dx, y: cy + dy, winkel, imBild };
  if (!dx && !dy) dy = 1;
  const s = Math.min(dx ? (cx - rand) / Math.abs(dx) : Infinity, dy ? (cy - rand) / Math.abs(dy) : Infinity);
  return { x: cx + dx * s, y: cy + dy * s, winkel: Math.atan2(dy, dx), imBild: false };
}

/** opts: eltern (document.body), oben = 12, links = 12 (px), zIndex = 20, rand = 28 (px Randabstand des Pfeils) */
export function createAufgabenAnzeige({ eltern = globalThis.document?.body, oben = 12, links = 12, zIndex = 20, rand = 28 } = {}) {
  const neu = (css, text) => { const e = document.createElement('div'); e.style.cssText = css; if (text != null) e.textContent = text; return e; };
  const wurzel = neu(`position:fixed;inset:0;pointer-events:none;z-index:${zIndex};font:600 14px/1.3 ${SCHRIFT};color:#eef1f4;`);
  const karte = neu(`position:absolute;left:max(${links}px,env(safe-area-inset-left));top:max(${oben}px,env(safe-area-inset-top));max-width:min(320px,70vw);` +
    'padding:8px 12px;border-radius:10px;background:rgba(18,22,28,.82);border:1px solid rgba(255,255,255,.14);display:none;pointer-events:none;');
  const titel = neu('font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#a6b0ba;');
  const text = neu('font-size:15px;margin-top:2px;');
  const hinweis = neu('font-size:12px;font-weight:500;color:#a6b0ba;margin-top:2px;display:none;');
  const zeile = neu('display:none;align-items:center;gap:8px;margin-top:6px;');
  const zahl = neu('font-size:13px;min-width:44px;');
  const bahn = neu('flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.18);overflow:hidden;');
  const fuell = neu(`height:100%;width:0%;background:${AKZENT};`);
  bahn.append(fuell); zeile.append(zahl, bahn); karte.append(titel, text, hinweis, zeile);

  const marker = neu('position:absolute;left:0;top:0;display:none;text-align:center;text-shadow:0 1px 3px #000;transform:translate(-50%,-50%);');
  const raute = neu(`font-size:26px;color:${AKZENT};line-height:1;`, '◆');
  const meter = neu('font-size:13px;');
  marker.append(raute, meter);
  const pfeil = neu(`position:absolute;left:0;top:0;display:none;font-size:30px;line-height:1;color:${AKZENT};text-shadow:0 1px 3px #000;`, '➤');
  const pfeilMeter = neu('position:absolute;left:0;top:0;display:none;font-size:12px;text-shadow:0 1px 3px #000;transform:translate(-50%,-50%);');
  const banner = neu('position:absolute;left:50%;top:34%;transform:translate(-50%,-50%);max-width:92vw;text-align:center;padding:10px 20px;border-radius:14px;' +
    `background:rgba(18,22,28,.86);border:2px solid ${AKZENT};color:${AKZENT};opacity:0;visibility:hidden;text-shadow:0 2px 4px #000;`);
  wurzel.append(karte, marker, pfeil, pfeilMeter, banner);
  eltern.append(wurzel);

  let zielPunkt = null, an = true, blitzRest = 0, blitzDauer = 0;
  const v = new THREE.Vector3();

  function setze(info) {
    if (!info) { karte.style.display = 'none'; return; }
    karte.style.display = 'block';
    titel.textContent = info.aufgabe?.name ?? '';
    text.textContent = info.text ?? '';
    hinweis.textContent = info.hinweis ?? '';
    hinweis.style.display = info.hinweis ? 'block' : 'none';
    const mehr = info.ziel > 1;
    zeile.style.display = mehr ? 'flex' : 'none';
    if (mehr) {
      const gerundet = info.wert >= info.ziel || Number.isInteger(info.ziel) && info.ziel <= 99;
      zahl.textContent = `${gerundet ? Math.floor(info.wert) : info.wert.toFixed(1)} / ${info.ziel}`;
      fuell.style.width = Math.round((info.anteil ?? 0) * 100) + '%';
    }
  }

  function blitz(t, { dauer = 2.5, gross = false } = {}) {
    banner.textContent = t;
    banner.style.fontSize = gross ? '34px' : '22px';
    banner.style.fontWeight = gross ? '800' : '700';
    banner.style.visibility = 'visible'; banner.style.opacity = '1';
    blitzRest = blitzDauer = dauer;
  }

  function versteckeZiel() { marker.style.display = 'none'; pfeil.style.display = 'none'; pfeilMeter.style.display = 'none'; }

  function update(kamera, dt = 0, spielerPos = null) {
    if (blitzRest > 0) {
      blitzRest -= dt;
      if (blitzRest <= 0) { banner.style.opacity = '0'; banner.style.visibility = 'hidden'; blitzRest = 0; }
      else banner.style.opacity = String(Math.min(1, blitzRest / FADE, (blitzDauer - blitzRest) / 0.15 + 0.01));
    }
    if (!zielPunkt || !kamera || !an) { versteckeZiel(); return; }
    kamera.updateMatrixWorld?.();
    v.set(zielPunkt.x, zielPunkt.y ?? 0, zielPunkt.z).project(kamera);
    const b = globalThis.innerWidth || 400, h = globalThis.innerHeight || 800;
    const l = randLage(v, b, h, rand);
    const m = spielerPos ? Math.round(Math.hypot(zielPunkt.x - spielerPos.x, zielPunkt.z - spielerPos.z)) + ' m' : '';
    if (l.imBild) {
      pfeil.style.display = 'none'; pfeilMeter.style.display = 'none';
      marker.style.display = 'block'; meter.textContent = m;
      marker.style.left = l.x + 'px'; marker.style.top = l.y + 'px';
    } else {
      marker.style.display = 'none';
      pfeil.style.display = 'block'; pfeil.style.left = (l.x - 15) + 'px'; pfeil.style.top = (l.y - 15) + 'px';
      pfeil.style.transform = `rotate(${l.winkel}rad)`;
      pfeilMeter.style.display = m ? 'block' : 'none'; pfeilMeter.textContent = m;
      const nach = rand + 12;   // Meter-Text zur Bildmitte hin versetzt
      pfeilMeter.style.left = (l.x + (b / 2 - l.x) * Math.min(1, nach / Math.max(1, Math.abs(b / 2 - l.x) + 1)) * 0.8) + 'px';
      pfeilMeter.style.top = (l.y + (h / 2 - l.y) * 0.08 + 22) + 'px';
    }
  }

  return {
    element: wurzel, setze, blitz, update,
    ziel(p) { zielPunkt = p ?? null; if (!zielPunkt) versteckeZiel(); },
    zeige(a) { an = !!a; wurzel.style.display = an ? '' : 'none'; },
    get sichtbar() { return an; },
    dispose() { wurzel.remove(); },
  };
}
