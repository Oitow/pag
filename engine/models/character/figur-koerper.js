/**
 * @modul    figur-koerper
 * @zweck    Anatomie der organischen Figur als SDF-Körper: Rumpf (Brustkorb, Taille, Bauch, Becken, Gesäß, Trapez, Schultermuskeln), Arme, Hände mit Daumen (Griff am Sockel umschlossen), Beine, Füße mit flacher Sohle; Hals + Kopf in figur-koerper-kopf
 * @api      baueKoerperForm(form, ctx) -> form
 * @beispiel
 *   // figur-haut ruft das auf: baueKoerperForm(form, formKontext(look, masse, rig)) – danach Kleidung und Haar
 * @tags     figur, charakter, organisch, sdf, anatomie, körper, hand, fuss
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Alle Punkte im Knochen-Raum über ctx.P (Bindungs-Pose = A-Pose): Gliedmaßen hängen nach −Y vom Gelenk, vorn +Z, links +X.
 * Reihenfolge: Rumpf → Kopf → Beine → Arme. Gliedmaßen verschmelzen nur an Hüfte/Schulter mit dem Rumpf (kleines glatt).
 * Kinder (L.koerper.groesse < 1) werden rundlicher und weicher, Muskeln (L.koerper.muskeln) formen Brust, Schultern, Arme, Waden.
 */
import { baueKopfForm } from './figur-koerper-kopf.js';

/** Farben mischen (0xrrggbb), ohne THREE. */
function mix(a, b, t) {
  const k = (c, s) => (c >> s) & 255, z = (s) => Math.round(k(a, s) + (k(b, s) - k(a, s)) * t);
  return (z(16) << 16) | (z(8) << 8) | z(0);
}

/** Baut die nackte Figur in form (figur-form) aus dem Kontext ctx (figur-haut: formKontext). */
export function baueKoerperForm(form, K) {
  const { P, m, g, L } = K, k = L.koerper, mu = k.muskeln;
  const kind = Math.min(1, Math.max(0, (1 - k.groesse) / 0.4));          // 0 = erwachsen, 1 = kleines Kind
  const rund = 1 + 0.1 * kind, def = (1 - 0.8 * kind);                    // Kinder: dicker im Verhältnis, weniger Definition
  const bauch = Math.max(m.bauch, 0.3 * kind);
  const haut = K.f.haut;
  const H = {
    mix, haut, kind, form,
    /** Ellipsoid im Raum des Knochens kn (Mitte p, Halbachsen entlang der Knochen-Achsen). */
    E(kn, p, radien, o = {}) { return form.ellipsoid(P(kn, p), radien, { ...o, dreh: K.dreh(kn, o.dreh || [0, 0, 0]) }); },
    /** Kapsel von Punkt a (Knochen knA) nach b (Knochen knB). */
    C(knA, a, knB, b, ra, rb, o) { return form.kapsel(P(knA, a), P(knB, b), ra, rb, o); },
    /** Rundbox im Raum des Knochens kn. */
    B(kn, p, halb, r, o = {}) { return form.rundbox(P(kn, p), halb, r, { ...o, dreh: K.dreh(kn, o.dreh || [0, 0, 0]) }); },
  };
  const o = (knochen, x = {}) => ({ knochen, farbe: haut, haut: true, ...x });

  rumpf(form, K, H, o, { mu, rund, def, bauch, kind });
  baueKopfForm(form, K, H);
  for (const s of ['L', 'R']) bein(K, H, o, s, { mu, rund, def });
  for (const s of ['L', 'R']) arm(K, H, o, s, { mu, rund, def });
  return form;
}

/** Rumpf im Raum von torso (y = 0 … torsoLaenge) und becken. */
function rumpf(form, K, H, o, { mu, rund, def, bauch, kind }) {
  const { m, g, w } = K, { E, C } = H, T = m.torsoLaenge, sX = m.schulterX, sY = m.schulterY;
  const brust = K.brust * rund, taille = K.taille * rund * (1.08 - 0.08 * kind), tiefe = K.tiefe;
  // Übergang Brust → Becken: oben torso, unten Mischung (Bauch biegt weich mit)
  const yT = K.P('torso')[1], yB = K.P('becken')[1];
  const bauchGewicht = (x, y) => {
    const t = Math.min(1, Math.max(0, (y - yB) / (yT + 0.2 * T - yB)));
    return { torso: 0.25 + 0.75 * t, becken: 0.75 - 0.75 * t };
  };

  // Becken + Gesäß
  E('becken', [0, -0.005 * g, -0.008 * g], [0.128 * g * w * rund, 0.1 * g, 0.095 * g * rund], o('becken', { glatt: 0.025 * g }));
  E('becken', [0, -0.05 * g, -0.05 * g], [0.12 * g * w * rund, 0.08 * g, 0.06 * g * rund], o('becken', { glatt: 0.032 * g }));
  // Taille / Bauch
  form.kapsel(K.P('torso', [0, -0.01 * g, 0]), K.P('torso', [0, 0.24 * g, -0.005 * g]), taille, taille * 1.04,
    o(bauchGewicht, { glatt: 0.036 * g, tief: tiefe * 0.95 }));
  if (bauch > 0.05) {
    E('torso', [0, 0.11 * g, taille * (0.16 + 0.14 * bauch)], [taille * (0.8 + 0.12 * bauch), 0.13 * g * (0.9 + 0.35 * bauch), taille * (0.44 + 0.22 * bauch)],
      o(bauchGewicht, { glatt: 0.05 * g }));
  }
  // Brustkorb (oben breiter, hinten flacher)
  E('torso', [0, 0.3 * g, -0.005 * g], [brust * 0.93, 0.17 * g, brust * tiefe * 0.98], o('torso', { glatt: 0.036 * g }));
  // Brustmuskeln (Muskeln): flache Platte, weich in den Brustkorb
  if (mu > 0.15 && kind < 0.5) {
    E('torso', [0, 0.35 * g, brust * tiefe * 0.55], [0.11 * g * w, 0.06 * g, 0.03 * g * mu + 0.01 * g], o('torso', { glatt: 0.032 * g }));
  }
  // Trapez: über den Nacken von Schulter zu Schulter, Hals-Kapsel formt die Schräge
  C('torso', [sX - 0.05 * g, sY - 0.005 * g, -0.03 * g], 'torso', [-(sX - 0.05 * g), sY - 0.005 * g, -0.03 * g],
    0.036 * g * (1 + 0.3 * mu * def), 0.036 * g * (1 + 0.3 * mu * def), o('torso', { glatt: 0.036 * g }));
  return form;
}

/** Arm s ('L' | 'R'): Schultermuskel, Oberarm mit Bizeps, Ellbogen, Unterarm, Hand. */
function arm(K, H, o, s, { mu, rund, def }) {
  const { m, g } = K, { E, C, B, mix } = H, r = K.armR * rund, O = m.oberarm, U = m.unterarm, h = m.hand;
  const S = 'schulter' + s, El = 'ellbogen' + s, Ha = 'hand' + s, innen = s === 'L' ? -1 : 1;   // Handfläche zeigt zum Körper
  // Schultermuskel (Deltoid): sitzt halb auf dem Rumpf
  E(S, [0, -0.045 * g, -0.004 * g], [r * (1.12 + 0.12 * mu), r * 1.75, r * (1.1 + 0.1 * mu)], o({ [S]: 0.75, torso: 0.25 }, { glatt: 0.028 * g }));
  // Oberarm + Bizeps/Trizeps
  C(S, [0, -0.03 * g, -r * 0.1], S, [0, -O, -r * 0.12], r * 1.05, r * 0.84, o(S, { glatt: 0.025 * g }));
  E(S, [0, -O * 0.5, r * 0.22], [r * 0.88, O * 0.28, r * (0.72 + 0.2 * mu * def)], o(S, { glatt: 0.025 * g }));
  // Unterarm: Ellbogen-Volumen oben, verjüngt zum schmalen Handgelenk
  C(El, [0, -0.01 * g, -r * 0.1], El, [0, -U + 0.012 * g, 0], r * 0.96, r * 0.55, o(El, { glatt: 0.028 * g }));
  // Hand: Fäustling um den Griff bei (0, −0.55h, 0) (Griffachse entlang Z), Finger gekrümmt zur Handfläche, Daumen vorn drüber
  const hg = h / 0.08;
  B(Ha, [-innen * 0.003 * hg, -h * 0.56, 0.003 * hg], [0.02 * hg, h * 0.5, 0.039 * hg], 0.017 * hg, o(Ha, { glatt: 0.02 * g }));
  C(Ha, [innen * 0.019 * hg, -h * 0.86, -0.03 * hg], Ha, [innen * 0.021 * hg, -h * 0.78, 0.03 * hg], 0.015 * hg, 0.014 * hg,
    o(Ha, { glatt: 0.012 * g, farbe: mix(H.haut, 0xc05050, 0.12) }));
  C(Ha, [innen * 0.012 * hg, -h * 0.2, 0.03 * hg], Ha, [innen * 0.026 * hg, -h * 0.55, 0.044 * hg], 0.0135 * hg, 0.011 * hg,
    o(Ha, { glatt: 0.014 * g }));
}

/** Bein s: Oberschenkel, Knie, Wade, Fuß mit Ferse, Ballen, Zehen und flacher Sohle. */
function bein(K, H, o, s, { mu, rund, def }) {
  const { m, g, w } = K, { E, C, mix } = H, r = K.beinR * rund, O = m.oberschenkel, U = m.unterschenkel;
  const Hu = 'huefte' + s, Kn = 'knie' + s, Fu = 'fuss' + s, innen = s === 'L' ? -1 : 1;
  // Oberschenkel (oben leicht nach außen, Muskelbauch vorn-außen)
  C(Hu, [-innen * 0.006 * g, 0.01 * g, -0.008 * g], Hu, [0, -O + 0.02 * g, 0.004 * g], r * 0.98, r * 0.66, o(Hu, { glatt: 0.025 * g }));
  E(Hu, [-innen * 0.006 * g, -O * 0.42, r * 0.12], [r * 0.9, O * 0.32, r * 0.84], o(Hu, { glatt: 0.028 * g }));
  // Unterschenkel (oben Knie-Volumen vorn) + Wade
  C(Kn, [0, 0.005 * g, r * 0.08], Kn, [0, -U + 0.035 * g, -0.004 * g], r * 0.74, r * 0.4, o({ [Kn]: 1 }, { glatt: 0.025 * g }));
  E(Kn, [-innen * 0.004 * g, -U * 0.3, -r * 0.26], [r * 0.7, U * 0.26, r * (0.58 + 0.08 * mu * def)], o(Kn, { glatt: 0.028 * g }));
  // Fuß im Raum von fuss (Ursprung Knöchel, Sohle flach bei −hF): Ferse, Mittelfuß mit flacher Sohle, Zehen
  const hF = m.fussHoehe - 0.02 * m.hoehe / 1.75, Lf = m.fussLaenge, fg = Lf / 0.24, br = 0.042 * fg * Math.sqrt(w), u = 0.001 * fg;
  E(Fu, [0, -hF + 0.032 * fg + u, -0.026 * fg], [br * 0.78, 0.032 * fg, 0.038 * fg], o(Fu, { glatt: 0.02 * g }));          // Ferse
  C(Fu, [0, -0.012 * fg, 0.0], Fu, [innen * 0.005 * fg, -hF + 0.022 * fg, 0.12 * fg], 0.033 * fg, 0.021 * fg,
    o(Fu, { glatt: 0.02 * g }));                                                                                            // Spann (schräg)
  H.B(Fu, [innen * 0.003 * fg, -hF + 0.014 * fg + u, 0.065 * fg], [br * 0.98, 0.014 * fg, 0.08 * fg], 0.013 * fg,
    o(Fu, { glatt: 0.02 * g }));                                                                                            // Sohle bis Ballen
  E(Fu, [innen * 0.006 * fg, -hF + 0.012 * fg + u, 0.158 * fg], [br * 0.9, 0.012 * fg, 0.03 * fg],
    o(Fu, { glatt: 0.012 * g, farbe: mix(H.haut, 0xc05050, 0.1) }));                                                       // Zehen
}
