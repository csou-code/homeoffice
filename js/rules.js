/* Règles métier : catégories, régimes, délais de prévenance, crédits, oppositions, réservations. */

const CATEGORIES = {
  associe: { label: 'Associé' },
  avocat: { label: 'Avocat collaborateur', regimes: {
    bureau: 'Éligible – bureau attitré',
    sans_bureau: 'Éligible – sans bureau attitré',
    non_eligible: 'Non éligible au télétravail',
  } },
  salarie: { label: 'Salarié', regimes: {
    droit_commun: 'Régime de droit commun',
    specifique: 'Régime spécifique',
    non_eligible: 'Non éligible au télétravail',
  } },
};

const PROFILE_OPTIONS = [
  ['associe:', 'Associé'],
  ['avocat:bureau', 'Avocat – éligible, bureau attitré'],
  ['avocat:sans_bureau', 'Avocat – éligible, sans bureau attitré'],
  ['avocat:non_eligible', 'Avocat – non éligible'],
  ['salarie:droit_commun', 'Salarié – droit commun'],
  ['salarie:specifique', 'Salarié – régime spécifique'],
  ['salarie:non_eligible', 'Salarié – non éligible'],
];

const REFUSAL_REASONS = [
  "Présence demandée en raison de l'absence d'un salarié",
  "Présence demandée en raison d'une formation, réunion ou d'un rendez-vous spécifique",
  "Présence demandée en raison d'une forte activité",
  'Présence demandée',
];
const SPECIAL_REASONS = ['Grève des transports', 'Intempéries', 'Épisode de pollution', 'Autre'];

const STATUS = {
  pending: { label: 'En attente', cls: 'pending' },
  confirmed: { label: 'Confirmé', cls: 'ok' },
  refused: { label: 'Refusé', cls: 'ko' },
};

const Rules = {
  isDC: u => u.role === 'salarie' && u.regime === 'droit_commun',
  isSpecific: u => u.role === 'salarie' && u.regime === 'specifique',
  isEligible: u => u.role === 'associe' || (!!u.regime && u.regime !== 'non_eligible'),
  isFloating: u => u.role === 'avocat' && u.regime === 'sans_bureau',
  hasTypicalWeek: u => (u.role === 'avocat' && Rules.isEligible(u)) || Rules.isSpecific(u),

  specRegime: u => S().specificRegimes.find(r => r.id === u.specificRegimeId) || null,
  regimeLabel(u) {
    if (u.role === 'associe') return 'Associé';
    let l = CATEGORIES[u.role].regimes[u.regime] || '—';
    if (Rules.isSpecific(u)) { const r = Rules.specRegime(u); if (r) l += ` – ${r.name}`; }
    return l;
  },
  partnersOf: u => (u.partners || []).map(userById).filter(Boolean),
  teamOf: p => S().users.filter(u => (u.partners || []).includes(p.id)),

  /* Jour actif (non refusé) d'un utilisateur */
  dayRecord: (userId, date) => S().days.find(d => d.userId === userId && d.date === date && d.status !== 'refused'),
  refusedRecord: (userId, date) => S().days.find(d => d.userId === userId && d.date === date && d.status === 'refused'),
  remoteOn: date => S().days.filter(d => d.date === date && d.status !== 'refused'),
  isBlocked: (userId, date) => S().blocked.find(b => b.date === date && b.userIds.includes(userId)),

  allowedWeekdays(u) {
    if (Rules.isDC(u)) return S().settings.weekdays;
    if (Rules.isSpecific(u)) { const r = Rules.specRegime(u); return r ? r.weekdays : []; }
    return [1, 2, 3, 4, 5];
  },

  /* Délai de prévenance : date limite (incluse) à laquelle le jour doit être posé */
  deadline(u, date) {
    const st = S().settings;
    if (u.role === 'associe') return date;
    if (u.role === 'avocat') return D.add(date, -st.noticeAvocat);
    if (Rules.isSpecific(u)) { const r = Rules.specRegime(u); return D.addBusiness(date, -(r ? r.notice : st.noticeSalarie)); }
    return D.addBusiness(date, -st.noticeSalarie);
  },
  noticeLabel(u) {
    const st = S().settings;
    if (u.role === 'associe') return 'Aucun';
    if (u.role === 'avocat') return st.noticeAvocat === 1 ? 'Au plus tard la veille' : `${st.noticeAvocat} jours calendaires avant`;
    const n = Rules.isSpecific(u) ? (Rules.specRegime(u)?.notice ?? st.noticeSalarie) : st.noticeSalarie;
    return `${n} jour${n > 1 ? 's' : ''} ouvré${n > 1 ? 's' : ''} avant`;
  },
  isLate: (u, date, createdDay = D.today()) => createdDay > Rules.deadline(u, date),

  countWeek(userId, date) {
    const mon = D.monday(date), sun = D.add(mon, 6);
    return S().days.filter(d => d.userId === userId && d.status !== 'refused' && d.date >= mon && d.date <= sun).length;
  },
  countMonth: (userId, date) => S().days.filter(d => d.userId === userId && d.status !== 'refused' && d.date.slice(0, 7) === date.slice(0, 7)).length,

  /* Soldes du régime de droit commun pour une année civile */
  credit(u, year) {
    const st = S().settings, t = D.today();
    const c = {
      base: { total: st.baseCredit + (u.creditAdjustment || 0), past: 0, future: 0 },
      extra: { total: st.extraCredit, past: 0, future: 0 },
    };
    S().days.filter(d => d.userId === u.id && d.status !== 'refused' && d.date.startsWith(String(year))).forEach(d => {
      const k = d.special ? 'extra' : 'base';
      if (d.date < t) c[k].past++; else c[k].future++;
    });
    c.base.left = c.base.total - c.base.past - c.base.future;
    c.extra.left = c.extra.total - c.extra.past - c.extra.future;
    return c;
  },

  /* Contrôle d'une pose. opts = { special: {reason, detail} | null, lateReason } */
  check(u, date, opts = {}) {
    const e = [], st = S().settings, t = D.today();
    if (!Rules.isEligible(u)) e.push('Votre régime ne permet pas le télétravail.');
    if (!D.isBusiness(date)) e.push(D.holiday(date) ? `Jour férié (${D.holiday(date)}).` : 'Jour non ouvré.');
    if (date < t) e.push('Ce jour est passé.');
    if (Rules.dayRecord(u.id, date)) e.push('Ce jour est déjà déclaré.');
    const b = Rules.isBlocked(u.id, date);
    if (b) e.push(`Présence requise ce jour${b.reason ? ` : ${b.reason}` : ''}.`);
    const wd = D.dow(date);
    if (u.role !== 'associe' && D.isBusiness(date) && !Rules.allowedWeekdays(u).includes(wd)) e.push(`Le ${D.WD[wd].toLowerCase()} n'est pas télétravaillable dans votre régime.`);
    const late = u.role !== 'associe' && Rules.isLate(u, date);

    if (Rules.isDC(u)) {
      if (Rules.countWeek(u.id, date) >= st.maxPerWeek) e.push(`Maximum de ${st.maxPerWeek} jour(s) par semaine civile atteint.`);
      const c = Rules.credit(u, date.slice(0, 4));
      if (opts.special) {
        if (c.extra.left <= 0) e.push('Crédit additionnel (circonstances particulières) épuisé.');
        if (!opts.special.reason) e.push('Sélectionnez le motif des circonstances particulières.');
        if (opts.special.reason === 'Autre' && !(opts.special.detail || '').trim()) e.push('Précisez le motif « Autre ».');
      } else {
        if (c.base.left <= 0) e.push('Crédit annuel épuisé.');
        if (late) e.push(`Délai de prévenance non respecté (dernier jour pour poser : ${D.fmtMed(Rules.deadline(u, date))}). Seules des circonstances particulières permettent d'y déroger.`);
      }
    } else if (Rules.isSpecific(u)) {
      const r = Rules.specRegime(u);
      if (r) {
        const n = r.period === 'week' ? Rules.countWeek(u.id, date) : Rules.countMonth(u.id, date);
        if (n >= r.days) e.push(`Limite du régime atteinte (${r.days} jour(s) par ${r.period === 'week' ? 'semaine' : 'mois'}).`);
      }
      if (late && !(opts.lateReason || '').trim()) e.push('Délai de prévenance non respecté : précisez le motif.');
    } else if (late && !(opts.lateReason || '').trim()) {
      e.push('Délai de prévenance non respecté : précisez le motif.');
    }
    return { ok: e.length === 0, errors: e, late };
  },

  notify(userId, text, kind = 'info') {
    S().notifications.unshift({ id: uid('n'), userId, text, kind, at: new Date().toISOString(), read: false });
  },

  declare(u, date, opts = {}) {
    const c = Rules.check(u, date, opts);
    if (!c.ok) return c;
    const rec = {
      id: uid('d'), userId: u.id, date, status: u.role === 'associe' ? 'confirmed' : 'pending',
      createdAt: new Date().toISOString(), createdDay: D.today(), late: c.late,
      lateReason: c.late && !opts.special ? (opts.lateReason || '').trim() : '',
      special: opts.special ? { reason: opts.special.reason, detail: (opts.special.detail || '').trim() } : null,
    };
    S().days.push(rec);
    // Un collaborateur sans bureau attitré libère son bureau volant s'il télétravaille
    S().bookings = S().bookings.filter(b => !(b.userId === u.id && b.date === date));
    let extra = '';
    if (rec.special) extra = ` – circonstances particulières : ${rec.special.reason}${rec.special.detail ? ` (${rec.special.detail})` : ''}`;
    if (rec.late) extra += ` – hors délai de prévenance${rec.lateReason ? ` : ${rec.lateReason}` : ''}`;
    Rules.partnersOf(u).forEach(p => Rules.notify(p.id, `${fullName(u)} a posé un jour de télétravail le ${D.fmtLong(date)}${extra}.`, rec.late ? 'warn' : 'info'));
    return { ok: true, rec };
  },

  remove(rec) {
    const u = userById(rec.userId);
    if (rec.date < D.today()) return { ok: false, errors: ['Impossible de retirer un jour passé.'] };
    S().days = S().days.filter(d => d.id !== rec.id);
    if (rec.status !== 'refused') Rules.partnersOf(u).forEach(p => Rules.notify(p.id, `${fullName(u)} a retiré son jour de télétravail du ${D.fmtLong(rec.date)}.`));
    return { ok: true };
  },

  confirm(rec, partner, inform) {
    rec.status = 'confirmed'; rec.confirmedBy = partner.id; rec.confirmedAt = new Date().toISOString();
    if (inform) Rules.notify(rec.userId, `${fullName(partner)} a confirmé votre jour de télétravail du ${D.fmtLong(rec.date)}.`, 'ok');
  },

  /* Opposition possible jusqu'à la veille du jour télétravaillé */
  canOppose: rec => rec.date > D.today(),
  oppose(rec, partner, reason, detail) {
    if (!Rules.canOppose(rec)) return { ok: false, errors: ["L'opposition n'est possible que jusqu'à la veille."] };
    rec.status = 'refused';
    rec.refusal = { reason, detail: (detail || '').trim(), by: partner.id, at: D.today() };
    const u = userById(rec.userId);
    Rules.notify(u.id, `${fullName(partner)} s'oppose à votre jour de télétravail du ${D.fmtLong(rec.date)} – ${reason}${rec.refusal.detail ? ` (${rec.refusal.detail})` : ''}.${Rules.isFloating(u) ? ' Pensez à réserver un bureau volant.' : ''}`, 'ko');
    return { ok: true };
  },

  /* Bureaux volants */
  deskBooking: (deskId, date) => S().bookings.find(b => b.deskId === deskId && b.date === date),
  userBooking: (userId, date) => S().bookings.find(b => b.userId === userId && b.date === date),
  floatingDesks: () => S().desks.filter(d => d.type === 'floating'),
  book(u, date, deskId) {
    if (!Rules.isFloating(u)) return { ok: false, errors: ['Seuls les collaborateurs sans bureau attitré réservent un bureau volant.'] };
    if (!D.isBusiness(date)) return { ok: false, errors: ['Jour non ouvré.'] };
    if (date < D.today()) return { ok: false, errors: ['Ce jour est passé.'] };
    if (Rules.dayRecord(u.id, date)) return { ok: false, errors: ['Vous êtes déclaré(e) en télétravail ce jour.'] };
    const taken = Rules.deskBooking(deskId, date);
    if (taken && taken.userId !== u.id) return { ok: false, errors: [`Bureau déjà réservé par ${fullName(userById(taken.userId))}.`] };
    S().bookings = S().bookings.filter(b => !(b.userId === u.id && b.date === date));
    S().bookings.push({ id: uid('b'), deskId, date, userId: u.id });
    return { ok: true };
  },
  cancelBooking(u, date) { S().bookings = S().bookings.filter(b => !(b.userId === u.id && b.date === date)); },

  /* E-mail du soir : poses non confirmées prévues dans deux jours ouvrés */
  digestFor(p) {
    const target = D.addBusiness(D.today(), 2);
    const ids = Rules.teamOf(p).map(u => u.id);
    return { target, items: S().days.filter(d => ids.includes(d.userId) && d.date === target && d.status === 'pending') };
  },
};
