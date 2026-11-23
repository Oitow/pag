/**
 * @modul    figur-koerper
 * @zweck    Anatomie der organischen Figur als SDF-Körper (Rumpf, Kopf, Gliedmaßen, Hände, Füße) – PLATZHALTER
 * @api      baueKoerperForm(form, ctx) -> form
 * @tags     figur, charakter, organisch, sdf, anatomie
 * @version  0.1.0
 * @status   entwurf
 * @three    nein
 */
/** Platzhalter: einfache Kapseln je Knochen. */
export function baueKoerperForm(form, K) {
  const { P, m, R, f } = K, haut = { farbe: f.haut, haut: true };
  form.kapsel(P('becken', [0, 0.02, 0]), P('torso', [0, m.torsoLaenge * 0.9, 0]), K.taille, K.brust, { knochen: 'torso', ...haut, tief: K.tiefe });
  form.kugel(P('kopf', [0, R, 0]), R, { knochen: 'kopf', ...haut });
  for (const s of ['L', 'R']) {
    form.kapsel(P('schulter' + s), P('ellbogen' + s), K.armR, K.armR * 0.9, { knochen: 'schulter' + s, ...haut });
    form.kapsel(P('ellbogen' + s), P('hand' + s), K.armR * 0.9, K.armR * 0.7, { knochen: 'ellbogen' + s, ...haut });
    form.kugel(P('hand' + s, [0, -m.hand * 0.5, 0]), K.armR * 0.9, { knochen: 'hand' + s, ...haut });
    form.kapsel(P('huefte' + s), P('knie' + s), K.beinR, K.beinR * 0.8, { knochen: 'huefte' + s, ...haut });
    form.kapsel(P('knie' + s), P('fuss' + s), K.beinR * 0.8, K.beinR * 0.6, { knochen: 'knie' + s, ...haut });
    form.kapsel(P('fuss' + s, [0, -m.fussHoehe * 0.6, -0.02]), P('fuss' + s, [0, -m.fussHoehe * 0.6, m.fussLaenge * 0.7]), K.beinR * 0.5, K.beinR * 0.45, { knochen: 'fuss' + s, ...haut });
  }
  return form;
}
