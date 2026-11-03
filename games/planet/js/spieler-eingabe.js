// Eingabe für die Spielfigur: Tastatur, Maus, Touch (Joystick + Knöpfe in #steuerung).
// Liefert einen Zustand (bewegung, sprint, sprungGehalten) und ruft Callbacks für Aktionen auf.

export function erstelleEingabe(ctx, cb) {
  const root = document.getElementById('steuerung') || document.body;
  const canvas = ctx.renderer.domElement;
  const zustand = { x: 0, y: 0, sprint: false, sprungGehalten: false, touch: false };
  const tasten = new Set();
  let karteOffen = false;

  const istTouchGeraet = matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
  const el = (tag, cls, html) => { const e = document.createElement(tag); e.className = cls; if (html != null) e.innerHTML = html; return e; };

  // ---------- DOM ----------
  const wrap = el('div', 'sp-ui');
  wrap.style.pointerEvents = 'none'; // #steuerung > * setzt sonst auto
  const stick = el('div', 'sp-stick'); const knauf = el('div', 'sp-knauf'); stick.appendChild(knauf);
  const knopf = (cls, icon, titel, taste) => {
    const b = el('button', 'sp-knopf ' + cls, `<span class="sp-icon">${icon}</span>` + (taste ? `<span class="sp-taste">${taste}</span>` : ''));
    b.title = titel; b.setAttribute('aria-label', titel); b.type = 'button';
    return b;
  };
  const bAngriff = knopf('sp-angriff', '⚔️', 'Angriff', 'F');
  const bWurf = knopf('sp-wurf', '🟢', 'Fangkugel werfen', 'Q');
  const bSprung = knopf('sp-sprung', '⤴️', 'Springen', '␣');
  const bReiten = knopf('sp-reiten', '🐎', 'Reiten', 'R');
  const bKarte = knopf('sp-karte', '🌍', 'Planetenkarte', 'M');
  const bInter = el('button', 'sp-inter', '<span class="sp-icon">✋</span><span class="sp-label"></span><span class="sp-taste">E</span>');
  bInter.type = 'button';
  const bZurueck = el('button', 'sp-zurueck', '⬇️ Zurück');
  bZurueck.type = 'button';
  const kartenHinweis = el('div', 'sp-kartenhinweis', istTouchGeraet ? 'Ziehen: drehen · Zwei Finger: zoomen' : 'Ziehen: drehen · Mausrad: zoomen · M/Esc: zurück');
  const fadenkreuz = el('div', 'sp-fadenkreuz');
  wrap.append(stick, bAngriff, bWurf, bSprung, bReiten, bKarte, bInter, bZurueck, kartenHinweis, fadenkreuz);
  root.appendChild(wrap);
  bReiten.hidden = true; bInter.hidden = true;
  if (istTouchGeraet) wrap.classList.add('sp-touch');

  const sperre = e => { e.preventDefault(); e.stopPropagation(); };
  const halte = (b, down, up) => {
    b.addEventListener('pointerdown', e => { sperre(e); b.classList.add('sp-aktiv'); try { b.setPointerCapture(e.pointerId); } catch (_) {} down(); });
    const los = e => { b.classList.remove('sp-aktiv'); up?.(); };
    b.addEventListener('pointerup', los); b.addEventListener('pointercancel', los); b.addEventListener('lostpointercapture', los);
    b.addEventListener('contextmenu', sperre);
    b.addEventListener('click', sperre);
  };
  halte(bAngriff, () => cb.angriff());
  halte(bWurf, () => cb.werfen());
  halte(bSprung, () => { zustand.sprungGehalten = true; cb.sprung(); }, () => { zustand.sprungGehalten = false; });
  halte(bReiten, () => cb.reiten());
  halte(bKarte, () => cb.karte());
  halte(bInter, () => cb.interagieren());
  halte(bZurueck, () => cb.karte());

  // ---------- Tastatur ----------
  const imEingabefeld = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable;
  addEventListener('keydown', e => {
    if (imEingabefeld(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    if (e.repeat) return;
    tasten.add(k);
    if (k === 'Space') { zustand.sprungGehalten = true; cb.sprung(); }
    else if (k === 'KeyF') cb.angriff();
    else if (k === 'KeyQ') cb.werfen();
    else if (k === 'KeyE') cb.interagieren();
    else if (k === 'KeyM') cb.karte();
    else if (k === 'KeyR') cb.reiten();
    else if (k === 'Escape' && karteOffen) cb.karte();
  });
  addEventListener('keyup', e => { tasten.delete(e.code); if (e.code === 'Space') zustand.sprungGehalten = false; });
  addEventListener('blur', () => { tasten.clear(); zustand.sprungGehalten = false; });

  // ---------- Pointer (Maus + Touch) auf der Zeichenfläche ----------
  let stickId = null, stickStart = null;
  const kamZeiger = new Map(); // pointerId → {x, y}
  let pinchAbstand = 0;
  let maus = null; // {id, x0, y0, t0, bewegt, knopf}
  const STICK_R = 52;

  function stickZeigen(x, y) {
    stick.classList.add('sp-frei');
    stick.style.left = (x - 65) + 'px'; stick.style.top = (y - 65) + 'px';
    stick.style.bottom = 'auto';
  }
  let stickSprint = false, stickLos = 0;
  function stickReset() {
    if (stickId !== null) stickLos = performance.now();
    stickSprint = false; stick.classList.remove('sp-sprint');
    stickId = null; zustand.x = zustand.y = 0;
    stick.classList.remove('sp-frei'); stick.style.left = stick.style.top = stick.style.bottom = '';
    knauf.style.transform = '';
  }

  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      if (!zustand.touch) { zustand.touch = true; wrap.classList.add('sp-touch'); }
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      if (!karteOffen && stickId === null && e.clientX < innerWidth * 0.45 && e.clientY > 70) {
        stickId = e.pointerId; stickStart = { x: e.clientX, y: e.clientY }; stickZeigen(e.clientX, e.clientY);
        // Doppeltippen + halten = Sprint
        stickSprint = performance.now() - stickLos < 320; stick.classList.toggle('sp-sprint', stickSprint);
      } else {
        kamZeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (kamZeiger.size === 2) pinchAbstand = abstand();
      }
    } else {
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      if (e.button === 2) { e.preventDefault(); if (!karteOffen) cb.werfen(); return; }
      maus = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), bewegt: false };
    }
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  function abstand() {
    const p = [...kamZeiger.values()];
    return p.length < 2 ? 0 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  }

  addEventListener('pointermove', e => {
    if (e.pointerId === stickId) {
      let dx = e.clientX - stickStart.x, dy = e.clientY - stickStart.y;
      const l = Math.hypot(dx, dy);
      if (l > STICK_R) {
        // Basis wandert mit, wenn man weit zieht
        const ue = l - STICK_R; stickStart.x += dx / l * ue; stickStart.y += dy / l * ue;
        stickZeigen(stickStart.x, stickStart.y); dx = dx / l * STICK_R; dy = dy / l * STICK_R;
      }
      knauf.style.transform = `translate(${dx}px, ${dy}px)`;
      const tot = 0.12, nx = dx / STICK_R, ny = dy / STICK_R, m = Math.hypot(nx, ny);
      const f = m < tot ? 0 : (m - tot) / (1 - tot) / m;
      zustand.x = nx * f; zustand.y = -ny * f;
      return;
    }
    const k = kamZeiger.get(e.pointerId);
    if (k) {
      const dx = e.clientX - k.x, dy = e.clientY - k.y;
      k.x = e.clientX; k.y = e.clientY;
      if (kamZeiger.size >= 2) {
        const d = abstand();
        if (pinchAbstand > 0 && d > 0) cb.zoom(pinchAbstand / d);
        pinchAbstand = d;
      } else cb.drehen(dx, dy, 'touch');
      return;
    }
    if (maus && e.pointerId === maus.id) {
      const dx = e.clientX - maus.x, dy = e.clientY - maus.y;
      maus.x = e.clientX; maus.y = e.clientY;
      if (Math.hypot(e.clientX - maus.x0, e.clientY - maus.y0) > 5) maus.bewegt = true;
      if (maus.bewegt) cb.drehen(dx, dy, 'maus');
    }
  });
  const ende = e => {
    if (e.pointerId === stickId) stickReset();
    if (kamZeiger.delete(e.pointerId)) pinchAbstand = abstand();
    if (maus && e.pointerId === maus.id) {
      if (e.type === 'pointerup' && !maus.bewegt && performance.now() - maus.t0 < 400 && !karteOffen) cb.angriff();
      maus = null;
    }
  };
  addEventListener('pointerup', ende);
  addEventListener('pointercancel', ende);
  canvas.addEventListener('wheel', e => { e.preventDefault(); cb.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });

  // ---------- Zustand pro Frame ----------
  function lies() {
    let x = zustand.touch && stickId !== null ? zustand.x : 0, y = zustand.touch && stickId !== null ? zustand.y : 0;
    if (tasten.has('KeyW') || tasten.has('ArrowUp')) y += 1;
    if (tasten.has('KeyS') || tasten.has('ArrowDown')) y -= 1;
    if (tasten.has('KeyD') || tasten.has('ArrowRight')) x += 1;
    if (tasten.has('KeyA') || tasten.has('ArrowLeft')) x -= 1;
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    zustand.sprintTaste = tasten.has('ShiftLeft') || tasten.has('ShiftRight');
    return { x, y, sprint: zustand.sprintTaste || (stickId !== null && stickSprint), sprungGehalten: zustand.sprungGehalten };
  }

  let letztesLabel = null;
  return {
    lies,
    setInteraktion(label) {
      if (label === letztesLabel) return; letztesLabel = label;
      bInter.hidden = !label;
      if (label) bInter.querySelector('.sp-label').textContent = label;
    },
    setReiten(sichtbar, aktiv) { bReiten.hidden = !sichtbar; bReiten.classList.toggle('sp-an', !!aktiv); },
    setKarte(offen) {
      karteOffen = offen; wrap.classList.toggle('sp-kartenmodus', offen);
      if (offen) { stickReset(); kamZeiger.clear(); }
    },
    setKugel(farbe) { bWurf.querySelector('.sp-icon').style.filter = farbe ? '' : 'grayscale(1) opacity(.5)'; },
    setCooldown(name, anteil) {
      const b = name === 'angriff' ? bAngriff : bWurf;
      b.style.setProperty('--cd', String(Math.max(0, Math.min(1, anteil))));
    },
    fadenkreuzPuls() { fadenkreuz.classList.remove('sp-puls'); void fadenkreuz.offsetWidth; fadenkreuz.classList.add('sp-puls'); },
  };
}
