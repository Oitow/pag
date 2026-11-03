export async function init(ctx) {
  const inv = {};
  const inventar = { add(id, n = 1) { inv[id] = (inv[id] || 0) + n; return n; }, remove(id, n = 1) { if ((inv[id] || 0) < n) return false; inv[id] -= n; return true; }, has(id, n = 1) { return (inv[id] || 0) >= n; }, count(id) { return inv[id] || 0; }, alle: () => inv };
  ctx.on('item:erhalten', e => inventar.add(e.id, e.n));
  return { inventar, faehigkeit: name => ctx.kreaturen?.faehigkeit?.(name) || 0, aktiveKugel: () => 'kugel_holz', toast: t => console.log('TOAST', t), leben: 100, update() {} };
}
