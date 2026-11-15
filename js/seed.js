/* Données fictives de démonstration (générées de façon déterministe par rapport à la date du jour). */
const SEED_VERSION = 4;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSeed() {
  const rnd = mulberry32(20261114);
  const pick = a => a[Math.floor(rnd() * a.length)];
  const t = D.today();

  /* Plan des locaux : 20 bureaux attitrés + 5 bureaux volants */
  const desks = [];
  for (let i = 0; i < 10; i++) desks.push({ id: `B${D.pad(i + 1)}`, label: `B${D.pad(i + 1)}`, type: 'office', x: 13 + i * 98, y: 16, w: 92, h: 120 });
  for (let i = 0; i < 10; i++) desks.push({ id: `B${D.pad(i + 11)}`, label: `B${D.pad(i + 11)}`, type: 'office', x: 13 + i * 98, y: 424, w: 92, h: 120 });
  for (let i = 0; i < 5; i++) desks.push({ id: `V${i + 1}`, label: `V${i + 1}`, type: 'floating', x: 262 + i * 92, y: 250, w: 72, h: 66 });

  const s = {
    version: SEED_VERSION,
    currentUserId: null,
    settings: { noticeAvocat: 1, noticeSalarie: 2, baseCredit: 20, extraCredit: 10, maxPerWeek: 5, weekdays: [1, 2, 3, 4, 5] },
    specificRegimes: [
      { id: 'rs1', name: 'Préconisation médecine du travail', days: 2, period: 'week', weekdays: [2, 4], notice: 2 },
      { id: 'rs2', name: 'Aménagement – situation de handicap', days: 6, period: 'month', weekdays: [1, 2, 3, 4, 5], notice: 1 },
    ],
    users: [], days: [], blocked: [], bookings: [], notifications: [], desks,
    partnerPrefs: {},
  };
  Store.state = s; // les règles lisent l'état courant pendant la génération

  // [id, prénom, nom, rôle, régime, associés, bureau, fonction, semaine type]
  const U = [
    ['p1', 'Hélène', 'Marchand', 'associe', '', [], 'B01', 'Associée', []],
    ['p2', 'Philippe', 'Lambert', 'associe', '', [], 'B02', 'Associé', []],
    ['p3', 'Sophie', 'Delorme', 'associe', '', [], 'B03', 'Associée', []],
    ['p4', 'Antoine', 'Rivière', 'associe', '', [], 'B04', 'Associé', []],
    ['a1', 'Julien', 'Faure', 'avocat', 'bureau', ['p1'], 'B05', 'Avocat senior', [3]],
    ['a2', 'Camille', 'Roux', 'avocat', 'bureau', ['p1', 'p2'], 'B06', 'Avocate', [1, 5]],
    ['a3', 'Mathieu', 'Girard', 'avocat', 'bureau', ['p2'], 'B07', 'Avocat', [5]],
    ['a4', 'Léa', 'Bonnet', 'avocat', 'bureau', ['p2'], 'B08', 'Avocate', [2, 5]],
    ['a5', 'Thomas', 'Mercier', 'avocat', 'bureau', ['p3'], 'B09', 'Avocat senior', [3]],
    ['a6', 'Inès', 'Lefort', 'avocat', 'bureau', ['p3', 'p4'], 'B10', 'Avocate', [1]],
    ['a7', 'Hugo', 'Perrin', 'avocat', 'bureau', ['p4'], 'B11', 'Avocat', [4]],
    ['a8', 'Chloé', 'Garnier', 'avocat', 'sans_bureau', ['p1'], null, 'Avocate', [1, 3]],
    ['a9', 'Maxime', 'Fontaine', 'avocat', 'sans_bureau', ['p2', 'p3'], null, 'Avocat', [2, 5]],
    ['a10', 'Sarah', 'Benali', 'avocat', 'sans_bureau', ['p4'], null, 'Avocate', [4]],
    ['a11', 'Paul', 'Chevalier', 'avocat', 'non_eligible', ['p3'], 'B12', 'Avocat (élève-avocat)', []],
    ['s1', 'Nathalie', 'Robin', 'salarie', 'droit_commun', ['p1', 'p2', 'p3', 'p4'], 'B13', 'Office manager', [3]],
    ['s2', 'Isabelle', 'Morel', 'salarie', 'droit_commun', ['p1'], 'B14', 'Assistante juridique', [5]],
    ['s3', 'Karim', 'Haddad', 'salarie', 'droit_commun', ['p2'], 'B15', 'Juriste', [1]],
    ['s4', 'Émilie', 'Dupuis', 'salarie', 'droit_commun', ['p3', 'p4'], 'B16', 'Comptable', [2]],
    ['s5', 'Lucas', 'Vidal', 'salarie', 'droit_commun', ['p4'], 'B17', 'Assistant juridique', [4]],
    ['s6', 'Martine', 'Leroy', 'salarie', 'specifique', ['p1'], 'B18', 'Assistante juridique', [2, 4]],
    ['s7', 'Olivier', 'Blanc', 'salarie', 'specifique', ['p2', 'p3'], 'B19', 'Documentaliste', [1, 3]],
    ['s8', 'Valérie', 'Caron', 'salarie', 'non_eligible', ['p1', 'p2'], 'B20', "Chargée d'accueil", []],
  ];
  s.users = U.map(([id, firstName, lastName, role, regime, partners, desk, title, typicalWeek]) => ({
    id, firstName, lastName, role, regime, partners, desk, title, typicalWeek,
    email: `${firstName}.${lastName}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '@cabinet-demo.fr',
    specificRegimeId: id === 's6' ? 'rs1' : id === 's7' ? 'rs2' : null,
    creditAdjustment: id === 's3' ? 2 : id === 's5' ? -3 : 0,
    preferredDesk: { a8: 'V1', a9: 'V3', a10: 'V5' }[id] || null,
  }));
  ['p1', 'p2', 'p3', 'p4'].forEach((p, i) => { s.partnerPrefs[p] = { emailDigest: i !== 2 }; });

  const nonPartners = s.users.filter(u => u.role !== 'associe').map(u => u.id);

  /* Jours de présence requise */
  let sem = D.addBusiness(t, 8); while (D.dow(sem) !== 4 || !D.isBusiness(sem)) sem = D.add(sem, 1);
  s.blocked.push({ id: 'bl1', date: sem, userIds: nonPartners, reason: 'Séminaire annuel du cabinet', by: 'p1', at: D.add(t, -12) });
  s.blocked.push({ id: 'bl2', date: D.addBusiness(t, 4), userIds: Rules.teamOf({ id: 'p2' }).map(u => u.id), reason: '', by: 'p2', at: D.add(t, -3) });
  s.blocked.push({ id: 'bl3', date: D.addBusiness(t, -25), userIds: s.users.filter(u => u.role === 'salarie').map(u => u.id), reason: 'Archivage annuel', by: 'p1', at: D.add(t, -40) });

  /* Historique de jours de télétravail : du 1er janvier à J+15 ouvrés */
  const LATE_REASONS = ['Rendez-vous médical en fin de journée', 'Livraison à domicile', 'Enfant malade', 'Travaux au domicile', 'Dossier urgent à finaliser au calme'];
  const SPECIAL_DETAILS = { 'Grève des transports': 'RER B interrompu', 'Intempéries': 'Alerte orange neige', 'Épisode de pollution': 'Circulation différenciée', 'Autre': 'Panne de véhicule' };
  const time = () => `T${D.pad(8 + Math.floor(rnd() * 11))}:${D.pad(Math.floor(rnd() * 60))}:00`;

  function make(u, d, special) {
    const dl = Rules.deadline(u, d);
    let created, late = false, lateReason = '';
    const wantsLate = d <= t && (u.role === 'avocat' ? rnd() < 0.08 : Rules.isSpecific(u) ? rnd() < 0.08 : special ? rnd() < 0.5 : false);
    if (wantsLate) {
      created = d; late = true;
      if (!special) lateReason = pick(LATE_REASONS);
    } else {
      created = D.add(dl, -Math.floor(rnd() * 12));
      if (created > t) created = D.add(t, -Math.floor(rnd() * 3));
      if (created > dl) created = dl;
    }
    let status = 'pending', refusal = null, confirmedBy = null;
    const r = rnd();
    const partner = (u.partners || [])[0];
    if (u.role === 'associe') status = 'confirmed';
    else if (d < t) {
      if (r < 0.04 && !late) {
        status = 'refused';
        const at = D.add(d, -1 - Math.floor(rnd() * 3));
        refusal = { reason: pick(REFUSAL_REASONS), detail: rnd() < 0.5 ? pick(['Audience à préparer', 'Client reçu au cabinet', 'Formation interne', '']) : '', by: partner, at: at < created ? created : at };
      } else if (r < 0.8) { status = 'confirmed'; confirmedBy = partner; }
    } else if (d > t) {
      if (r < 0.05) {
        status = 'refused';
        refusal = { reason: pick(REFUSAL_REASONS), detail: '', by: partner, at: created > D.add(t, -1) ? created : D.add(t, -1) };
      } else if (r < 0.3) { status = 'confirmed'; confirmedBy = partner; }
    }
    const rec = { id: `d${s.days.length + 1}`, userId: u.id, date: d, status, createdAt: created + time(), createdDay: created, late, lateReason, special, refusal, confirmedBy };
    s.days.push(rec);
    return rec;
  }

  const start = `${t.slice(0, 4)}-01-01`, end = D.addBusiness(t, 15);
  const weekUsed = {};
  const monthCount = {};
  D.businessDays(start, end).forEach(d => {
    const wd = D.dow(d);
    s.users.forEach(u => {
      if (!Rules.isEligible(u) || Rules.isBlocked(u.id, d)) return;
      if (u.role === 'associe') { if (rnd() < 0.06) make(u, d, null); return; }
      if (u.role === 'avocat') {
        const p = u.typicalWeek.includes(wd) ? 0.85 : 0.05;
        if (rnd() < p) make(u, d, null);
        return;
      }
      if (Rules.isSpecific(u)) {
        const r = Rules.specRegime(u);
        if (!r.weekdays.includes(wd)) return;
        if (r.period === 'month') {
          const k = `${u.id}${d.slice(0, 7)}`; monthCount[k] = monthCount[k] || 0;
          if (monthCount[k] < r.days && rnd() < 0.32) { monthCount[k]++; make(u, d, null); }
        } else if (u.typicalWeek.includes(wd) && rnd() < 0.85) make(u, d, null);
        return;
      }
      if (Rules.isDC(u)) {
        const wk = `${u.id}${D.monday(d)}`;
        const c = Rules.credit(u, d.slice(0, 4));
        if (!weekUsed[wk] && c.base.past + c.base.future < c.base.total - 4 && u.typicalWeek.includes(wd) && rnd() < 0.36) {
          weekUsed[wk] = true; make(u, d, null);
        } else if (!weekUsed[wk] && d <= t && rnd() < 0.012 && c.extra.past < 6) {
          weekUsed[wk] = true;
          const reason = pick(SPECIAL_REASONS);
          make(u, d, { reason, detail: reason === 'Autre' || rnd() < 0.5 ? SPECIAL_DETAILS[reason] : '' });
        }
      }
    });
  });

  /* Réservations de bureaux volants */
  D.businessDays(D.add(t, -30), D.addBusiness(t, 10)).forEach(d => {
    s.users.filter(Rules.isFloating).forEach(u => {
      if (Rules.dayRecord(u.id, d) || rnd() > 0.88) return;
      const order = [u.preferredDesk, ...Rules.floatingDesks().map(x => x.id)];
      const desk = order.find(id => id && !Rules.deskBooking(id, d));
      if (desk) s.bookings.push({ id: `b${s.bookings.length + 1}`, deskId: desk, date: d, userId: u.id });
    });
  });

  /* Notifications récentes */
  const at = (day) => `${day}${time()}`;
  s.days.filter(d => d.createdDay >= D.add(t, -6) && d.createdDay <= t).forEach(d => {
    const u = userById(d.userId);
    let extra = d.special ? ` – circonstances particulières : ${d.special.reason}` : '';
    if (d.late) extra += ` – hors délai de prévenance${d.lateReason ? ` : ${d.lateReason}` : ''}`;
    Rules.partnersOf(u).forEach(p => s.notifications.push({ id: `n${s.notifications.length + 1}`, userId: p.id, text: `${fullName(u)} a posé un jour de télétravail le ${D.fmtLong(d.date)}${extra}.`, kind: d.late ? 'warn' : 'info', at: at(d.createdDay), read: rnd() < 0.4 }));
  });
  s.days.filter(d => d.refusal && d.refusal.at >= D.add(t, -14)).forEach(d => {
    const p = userById(d.refusal.by);
    s.notifications.push({ id: `n${s.notifications.length + 1}`, userId: d.userId, text: `${fullName(p)} s'oppose à votre jour de télétravail du ${D.fmtLong(d.date)} – ${d.refusal.reason}.`, kind: 'ko', at: at(d.refusal.at), read: false });
  });
  s.users.filter(u => nonPartners.includes(u.id)).forEach(u => {
    s.notifications.push({ id: `n${s.notifications.length + 1}`, userId: u.id, text: `Présence requise le ${D.fmtLong(sem)} : séminaire annuel du cabinet.`, kind: 'info', at: at(D.add(t, -12)), read: rnd() < 0.5 });
  });
  s.notifications.sort((a, b) => b.at.localeCompare(a.at));
  return s;
}
