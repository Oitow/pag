// Testwelt – einfache Eingabe für die Platzhalter-Figur: Tastatur, Touch-Stick (linke Hälfte),
// Kamera ziehen (rechte Hälfte / Maus), Mausrad/Pinch zoomt. Wird mit dem Platzhalter ersetzt (engine/input/move-input).

export function createSteuerung(element) {
  const tasten = new Set();
  const stickEl = document.getElementById('stick'), knauf = stickEl?.querySelector('i');
  const st = { id: null, x0: 0, y0: 0, x: 0, y: 0 };
  const zieh = new Map();           // pointerId → {x,y}
  let dreheX = 0, dreheY = 0, zoom = 1, pinchAlt = 0;
  let sprungKnopf = false, sprintKnopf = false, sprungVorher = false;

  const runter = (e) => { if (e.target.tagName === 'INPUT') return; tasten.add(e.code); if (e.code === 'Space') e.preventDefault(); };
  const hoch = (e) => tasten.delete(e.code);
  const weg = () => tasten.clear();
  addEventListener('keydown', runter); addEventListener('keyup', hoch); addEventListener('blur', weg);

  function pDown(e) {
    if (e.pointerType === 'touch') document.body.classList.add('touch');
    element.setPointerCapture?.(e.pointerId);
    if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.45 && st.id === null) {
      st.id = e.pointerId; st.x0 = e.clientX; st.y0 = e.clientY; st.x = st.y = 0;
      if (stickEl) { stickEl.hidden = false; stickEl.style.left = (e.clientX - 56) + 'px'; stickEl.style.top = (e.clientY - 56) + 'px'; }
      return;
    }
    zieh.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
  function pMove(e) {
    if (e.pointerId === st.id) {
      let dx = (e.clientX - st.x0) / 56, dy = (e.clientY - st.y0) / 56;
      const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
      st.x = dx; st.y = -dy;
      if (knauf) knauf.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
      return;
    }
    const p = zieh.get(e.pointerId); if (!p) return;
    if (zieh.size === 2) {
      const [a, b] = [...zieh.values()];
      p.x = e.clientX; p.y = e.clientY;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchAlt) zoom *= pinchAlt / d;
      pinchAlt = d;
      return;
    }
    dreheX += e.clientX - p.x; dreheY += e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
  }
  function pUp(e) {
    if (e.pointerId === st.id) { st.id = null; st.x = st.y = 0; if (stickEl) stickEl.hidden = true; if (knauf) knauf.style.transform = ''; }
    zieh.delete(e.pointerId); if (zieh.size < 2) pinchAlt = 0;
  }
  const rad = (e) => { e.preventDefault(); zoom *= Math.exp(e.deltaY * 0.001); };
  element.addEventListener('pointerdown', pDown);
  element.addEventListener('pointermove', pMove);
  element.addEventListener('pointerup', pUp);
  element.addEventListener('pointercancel', pUp);
  element.addEventListener('wheel', rad, { passive: false });

  const knopf = (id, setze) => {
    const el = document.getElementById(id); if (!el) return () => {};
    const an = (e) => { e.preventDefault(); setze(true); }, aus = () => setze(false);
    el.addEventListener('pointerdown', an); el.addEventListener('pointerup', aus); el.addEventListener('pointerleave', aus);
    return () => { el.removeEventListener('pointerdown', an); el.removeEventListener('pointerup', aus); el.removeEventListener('pointerleave', aus); };
  };
  const loes1 = knopf('springen', v => { sprungKnopf = v; });
  const loes2 = knopf('sprint', v => { sprintKnopf = v; });

  function lesen() {
    const t = (...c) => c.some(k => tasten.has(k));
    let x = st.x, y = st.y;
    if (t('KeyA', 'ArrowLeft')) x -= 1;
    if (t('KeyD', 'ArrowRight')) x += 1;
    if (t('KeyW', 'ArrowUp')) y += 1;
    if (t('KeyS', 'ArrowDown')) y -= 1;
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    const springen = t('Space') || sprungKnopf;
    const r = {
      x, y, springen, springenNeu: springen && !sprungVorher,
      sprint: t('ShiftLeft', 'ShiftRight') || sprintKnopf || Math.hypot(st.x, st.y) > 0.97,
      dreheX, dreheY, zoom,
    };
    sprungVorher = springen; dreheX = dreheY = 0; zoom = 1;
    return r;
  }

  return {
    lesen,
    dispose() {
      removeEventListener('keydown', runter); removeEventListener('keyup', hoch); removeEventListener('blur', weg);
      element.removeEventListener('pointerdown', pDown); element.removeEventListener('pointermove', pMove);
      element.removeEventListener('pointerup', pUp); element.removeEventListener('pointercancel', pUp);
      element.removeEventListener('wheel', rad); loes1(); loes2();
    },
  };
}
