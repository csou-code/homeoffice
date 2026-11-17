/* Données fictives de démonstration (générées de façon déterministe par rapport à la date du jour). */
const SEED_VERSION = 6;

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

  /* Plan des locaux réel (js/floorplan.js) : 7 bureaux individuels, 31 postes en bureaux partagés, 5 postes volants */
  const desks = FLOOR_DESKS.map(d => ({ ...d, label: d.type === 'floating' ? `${d.id} · ${d.room}` : d.type === 'individual' ? d.room : `${d.room} – poste ${d.id.split('-')[1]}` }));
  const byRoom = r => desks.filter(d => d.type === 'office' && d.room === r).map(d => d.id);
  const partnerDesks = ['B01', 'B09', 'B10', 'B11', 'B12', 'B13', 'A11'].map(r => `${r}-1`);
  const a08 = byRoom('A08');
  const staffDesks = [...byRoom('A03'), ...byRoom('A05'), ...byRoom('A09'), a08[4]];
  const lawyerDesks = [...byRoom('A01'), ...byRoom('A02'), ...byRoom('A12'), ...a08.slice(0, 4), ...byRoom('B02'), ...byRoom('B03'), ...byRoom('B04')];

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

  /* Effectif fictif : 7 associés, 23 avocats collaborateurs, 9 salariés */
  const PARTNERS = [['Hélène', 'Marchand', 'F'], ['Pierre', 'Lambert', 'M'], ['Sophie', 'Delorme', 'F'], ['Antoine', 'Rivière', 'M'],
    ['Catherine', 'Vasseur', 'F'], ['Laurent', 'Brunet', 'M'], ['Florence', 'Aubert', 'F']];
  const LAWYERS = [
    ['Julien', 'Faure', 'M', 'bureau'], ['Camille', 'Roux', 'F', 'bureau'], ['Mathieu', 'Girard', 'M', 'bureau'], ['Léa', 'Bonnet', 'F', 'bureau'],
    ['Thomas', 'Mercier', 'M', 'bureau'], ['Inès', 'Lefort', 'F', 'bureau'], ['Hugo', 'Perrin', 'M', 'bureau'], ['Manon', 'Lemoine', 'F', 'bureau'],
    ['Nicolas', 'Gauthier', 'M', 'bureau'], ['Pauline', 'Masson', 'F', 'bureau'], ['Alexandre', 'Renaud', 'M', 'bureau'], ['Charlotte', 'Arnaud', 'F', 'bureau'],
    ['Romain', 'Picard', 'M', 'bureau'], ['Juliette', 'Collin', 'F', 'bureau'], ['Guillaume', 'Barbier', 'M', 'bureau'], ['Marion', 'Roche', 'F', 'bureau'],
    ['Quentin', 'Leclerc', 'M', 'bureau'], ['Anaïs', 'Meunier', 'F', 'bureau'], ['Benoît', 'Carpentier', 'M', 'bureau'],
    ['Chloé', 'Garnier', 'F', 'sans_bureau'], ['Maxime', 'Fontaine', 'M', 'sans_bureau'], ['Sarah', 'Benali', 'F', 'sans_bureau'],
    ['Paul', 'Chevalier', 'M', 'non_eligible'],
  ];
  const STAFF = [
    ['Nathalie', 'Robin', 'droit_commun', 'Office manager', ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'], [3]],
    ['Karim', 'Haddad', 'droit_commun', 'Juriste', ['p2', 'p5'], [1]],
    ['Martine', 'Leroy', 'specifique', 'Assistante juridique', ['p1', 'p3'], [2, 4]],
    ['Isabelle', 'Morel', 'non_eligible', 'Assistante juridique', ['p1', 'p4'], []],
    ['Émilie', 'Dupuis', 'non_eligible', 'Comptable', ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'], []],
    ['Lucas', 'Vidal', 'non_eligible', 'Assistant juridique', ['p2', 'p6'], []],
    ['Valérie', 'Caron', 'non_eligible', "Chargée d'accueil", ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'], []],
    ['Olivier', 'Blanc', 'non_eligible', 'Documentaliste', ['p3', 'p7'], []],
    ['Agnès', 'Muller', 'non_eligible', 'Assistante juridique', ['p5', 'p7'], []],
  ];
  const WEEKS = [[3], [1, 5], [5], [2, 5], [3], [1], [4], [1, 3], [2, 4], [5], [3, 5], [2], [1, 4]];
  const U = [];
  PARTNERS.forEach(([f, l, g], i) => U.push([`p${i + 1}`, f, l, 'associe', '', [], partnerDesks[i], g === 'F' ? 'Associée' : 'Associé', []]));
  LAWYERS.forEach(([f, l, g, regime], i) => {
    const partners = [`p${(i % 7) + 1}`]; if (i % 4 === 1) partners.push(`p${((i + 3) % 7) + 1}`);
    const senior = i % 5 === 0 && regime === 'bureau';
    const title = regime === 'non_eligible' ? (g === 'F' ? 'Élève-avocate' : 'Élève-avocat') : (g === 'F' ? 'Avocate' : 'Avocat') + (senior ? ' senior' : '');
    U.push([`a${i + 1}`, f, l, 'avocat', regime, partners, regime === 'sans_bureau' ? null : lawyerDesks.shift(), title, regime === 'non_eligible' ? [] : WEEKS[i % WEEKS.length]]);
  });
  STAFF.forEach(([f, l, regime, title, partners, week], i) => U.push([`s${i + 1}`, f, l, 'salarie', regime, partners, staffDesks[i], title, week]));

  s.users = U.map(([id, firstName, lastName, role, regime, partners, desk, title, typicalWeek]) => ({
    id, firstName, lastName, role, regime, partners, desk, title, typicalWeek,
    email: `${firstName}.${lastName}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '@cabinet-demo.fr',
    specificRegimeId: regime === 'specifique' ? 'rs1' : null,
    creditAdjustment: id === 's2' ? 2 : 0,
    preferredDesk: { a20: 'V1', a21: 'V2', a22: 'V4' }[id] || null,
  }));
  /* Trigrammes (initiale du prénom + deux premières lettres du nom), dédoublonnés */
  const used = new Set();
  const plain = x => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
  s.users.forEach(u => {
    const f = plain(u.firstName), l = plain(u.lastName);
    const cands = [f[0] + l.slice(0, 2), f[0] + l[0] + l[2], f[0] + l[0] + l[l.length - 1], f.slice(0, 2) + l[0]];
    u.trigram = cands.find(c => !used.has(c)) || `${f[0]}${l[0]}${used.size}`;
    used.add(u.trigram);
  });
  s.users.filter(u => u.role === 'associe').forEach((p, i) => { s.partnerPrefs[p.id] = { emailDigest: i % 3 !== 2 }; });

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
