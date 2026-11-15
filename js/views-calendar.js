/* Calendrier personnel et fiche d'une journée (pose, retrait, bureau volant, présents). */

Views.calendar = function () {
  const me = App.me(), t = D.today(), ym = App.calMonth;
  const first = `${ym}-01`, [y, m] = ym.split('-').map(Number);
  const last = D.iso(new Date(y, m, 0));
  const days = D.range(D.monday(first), D.add(D.monday(last), 6));
  const allowed = Rules.allowedWeekdays(me);

  const cells = days.map(d => {
    const out = d.slice(0, 7) !== ym, biz = D.isBusiness(d), hol = D.holiday(d);
    const rec = Rules.dayRecord(me.id, d) || Rules.refusedRecord(me.id, d);
    const blk = biz && Rules.isBlocked(me.id, d);
    const bk = Rules.userBooking(me.id, d);
    const others = biz ? Rules.remoteOn(d).filter(r => r.userId !== me.id).length : 0;
    const noTT = biz && Rules.isEligible(me) && me.role !== 'associe' && !allowed.includes(D.dow(d));
    const cls = ['cal-cell', out && 'out', !biz && 'off', d === t && 'today', d < t && 'past', blk && 'blocked'].filter(Boolean).join(' ');
    return `<button class="${cls}" data-act="open-day" data-date="${d}" aria-label="${D.fmtLong(d)}">
      <span class="num">${+d.slice(8)}</span>
      ${hol ? `<span class="hol">${hol}</span>` : ''}
      ${rec ? `<span class="pill ${STATUS[rec.status].cls}">${rec.status === 'refused' ? 'TT refusé' : 'Télétravail'}</span>` : ''}
      ${blk ? '<span class="pill blocked">Présence requise</span>' : ''}
      ${noTT && !blk ? '<span class="pill muted">Non télétravaillable</span>' : ''}
      ${bk ? `<span class="pill desk">Bureau ${bk.deskId}</span>` : ''}
      ${others ? `<span class="others">${others} en TT</span>` : ''}
    </button>`;
  }).join('');

  return `<div class="page-head">
      <div><h1>Mon calendrier</h1><p class="muted">Cliquez sur un jour pour déclarer un télétravail, réserver un bureau ou voir qui est présent.</p></div>
      <div class="month-nav">
        <button class="icon-btn" data-act="cal-month" data-n="-1" aria-label="Mois précédent">${ICONS.chevL}</button>
        <strong>${D.monthLabel(ym)}</strong>
        <button class="icon-btn" data-act="cal-month" data-n="1" aria-label="Mois suivant">${ICONS.chevR}</button>
        <button class="btn ghost sm" data-act="cal-today">Aujourd'hui</button>
      </div>
    </div>
    <div class="cal-layout">
      <section class="card cal-card">
        <div class="cal-grid head">${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(l => `<div>${l}</div>`).join('')}</div>
        <div class="cal-grid">${cells}</div>
        <div class="legend">
          <span><i class="pill pending">&nbsp;</i> En attente de confirmation</span>
          <span><i class="pill ok">&nbsp;</i> Confirmé</span>
          <span><i class="pill ko">&nbsp;</i> Refusé</span>
          <span><i class="pill blocked">&nbsp;</i> Présence requise</span>
          <span><i class="pill desk">&nbsp;</i> Bureau volant réservé</span>
        </div>
      </section>
      <aside class="side">${Views.regimeCard(me)}${Views.upcomingCard(me)}</aside>
    </div>`;
};

Views.regimeCard = function (u) {
  const partners = Rules.partnersOf(u);
  let body = `<dl class="kv">
    <dt>Catégorie</dt><dd>${CATEGORIES[u.role].label}</dd>
    <dt>Régime</dt><dd>${esc(Rules.regimeLabel(u))}</dd>
    ${u.role !== 'associe' ? `<dt>Associé(s)</dt><dd>${partners.map(p => esc(fullName(p))).join(', ') || '—'}</dd>` : ''}
    <dt>Bureau</dt><dd>${u.desk ? `Bureau attitré ${u.desk}` : Rules.isFloating(u) ? 'Bureaux volants (réservation)' : '—'}</dd>
    ${Rules.isEligible(u) && u.role !== 'associe' ? `<dt>Délai de prévenance</dt><dd>${Rules.noticeLabel(u)}</dd>` : ''}
  </dl>`;
  if (Rules.isDC(u)) body += Views.balances(u, D.today().slice(0, 4));
  if (Rules.isSpecific(u)) {
    const r = Rules.specRegime(u);
    if (r) body += `<p class="note">${r.days} jour(s) par ${r.period === 'week' ? 'semaine' : 'mois'} – ${r.weekdays.map(w => D.WD[w].toLowerCase()).join(', ')}.</p>`;
  }
  if (Rules.hasTypicalWeek(u)) body += `<p><a href="#profile" class="link">Gérer ma semaine type →</a></p>`;
  return `<section class="card"><h2>Mon régime</h2>${body}</section>`;
};

Views.balances = function (u, year) {
  const c = Rules.credit(u, year);
  const meter = (title, b) => {
    const pPast = Math.max(0, Math.min(100, (b.past / b.total) * 100)), pFut = Math.max(0, Math.min(100 - pPast, (b.future / b.total) * 100));
    return `<div class="meter-block">
      <div class="meter-head"><strong>${title}</strong><span><b>${b.left}</b> / ${b.total} restants</span></div>
      <div class="meter" role="img" aria-label="${title} : ${b.past} posés passés, ${b.future} à venir, ${b.left} restants">
        <span class="m-past" style="width:${pPast}%"></span><span class="m-fut" style="width:${pFut}%"></span>
      </div>
      <div class="meter-legend"><span><i class="m-past"></i>${b.past} passés</span><span><i class="m-fut"></i>${b.future} à venir</span></div>
    </div>`;
  };
  return `<div class="balances"><h3>Mes soldes ${year}</h3>${meter('Crédit annuel', c.base)}${meter('Crédit additionnel (circonstances particulières)', c.extra)}</div>`;
};

Views.upcomingCard = function (u) {
  const t = D.today();
  const list = S().days.filter(d => d.userId === u.id && d.date >= t).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  return `<section class="card"><h2>Mes prochains jours</h2>${list.length ? `<ul class="list">${list.map(d => `
    <li><button class="row-btn" data-act="open-day" data-date="${d.date}"><span>${D.fmtMed(d.date)}</span>${badge(d.status)}</button></li>`).join('')}</ul>` : '<p class="muted">Aucun jour de télétravail à venir.</p>'}</section>`;
};

Actions['cal-month'] = el => { App.calMonth = D.addMonths(App.calMonth, +el.dataset.n); App.render(); };
Actions['cal-today'] = () => { App.calMonth = D.today().slice(0, 7); App.render(); };

/* ---------- Fiche d'une journée ---------- */
Actions['open-day'] = el => {
  const date = el.dataset.date;
  App.dayForm = { special: false, reason: '', detail: '', lateReason: '' };
  Modal.open(D.fmtLong(date).replace(/^./, c => c.toUpperCase()), () => Views.dayPanel(date), { wide: true });
};

Views.dayOpts = () => {
  const f = App.dayForm;
  return { special: f.special ? { reason: f.reason, detail: f.detail } : null, lateReason: f.lateReason };
};

Views.dayCheck = function (date) {
  const me = App.me(), c = Rules.check(me, date, Views.dayOpts());
  const info = `<p class="hint">Délai de prévenance : ${Rules.noticeLabel(me).toLowerCase()} (dernier jour pour poser dans les délais : ${D.fmtMed(Rules.deadline(me, date))})</p>`;
  return (c.ok ? (c.late && !App.dayForm.special ? '<p class="alert warn">Pose hors délai : vos associés en seront informés avec le motif indiqué.</p>' : '') : `<ul class="alert ko">${c.errors.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`) + (me.role !== 'associe' ? info : '');
};

Views.dayPanel = function (date) {
  const me = App.me(), t = D.today(), f = App.dayForm;
  const biz = D.isBusiness(date);
  const rec = Rules.dayRecord(me.id, date), refused = Rules.refusedRecord(me.id, date);
  let mine = '';

  if (!biz) mine = `<p class="muted">${D.holiday(date) ? `Jour férié : ${D.holiday(date)}.` : 'Week-end.'}</p>`;
  else if (!Rules.isEligible(me)) mine = '<p class="muted">Votre régime ne prévoit pas de télétravail.</p>';
  else if (rec) {
    mine = `<div class="status-line">${badge(rec.status)} <span>Télétravail déclaré le ${fmtDateTime(rec.createdAt)}</span> ${noticeTag(rec)}</div>
      ${rec.status === 'confirmed' && rec.confirmedBy ? `<p class="hint">Confirmé par ${esc(fullName(userById(rec.confirmedBy)))}.</p>` : ''}
      ${rec.date >= t ? `<button class="btn danger-ghost" data-act="remove-day" data-id="${rec.id}">Retirer ce jour</button>` : ''}`;
  } else {
    const blocked = Rules.isBlocked(me.id, date);
    const isDC = Rules.isDC(me);
    const late = me.role !== 'associe' && Rules.isLate(me, date);
    const c = Rules.check(me, date, Views.dayOpts());
    const showForm = date >= t && !blocked;
    mine = `${refused ? `<div class="alert ko"><strong>Télétravail refusé</strong> par ${esc(fullName(userById(refused.refusal.by)))} : ${esc(refused.refusal.reason)}${refused.refusal.detail ? ` – ${esc(refused.refusal.detail)}` : ''}</div>` : ''}
      ${blocked ? `<div class="alert blocked">Présence requise au cabinet${blocked.reason ? ` : ${esc(blocked.reason)}` : ''}.</div>` : ''}
      ${date < t ? '<p class="muted">Pas de télétravail déclaré ce jour.</p>' : ''}
      ${showForm ? `<div class="form-stack">
        ${isDC ? `<label class="check"><input type="checkbox" data-change="df-special" ${f.special ? 'checked' : ''}> Circonstances particulières (crédit additionnel)</label>
          ${f.special ? `<div class="grid-2">
            <label>Motif<select data-change="df-reason"><option value="">— Choisir —</option>${SPECIAL_REASONS.map(r => `<option ${f.reason === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
            <label>Précisions ${f.reason === 'Autre' ? '<em>(obligatoire)</em>' : '<em>(facultatif)</em>'}<input type="text" data-input="df-detail" value="${esc(f.detail)}" maxlength="200"></label>
          </div>` : ''}` : ''}
        ${!isDC && late ? `<label>Motif du non-respect du délai de prévenance<input type="text" data-input="df-late" value="${esc(f.lateReason)}" maxlength="200" placeholder="Ex. : rendez-vous médical"></label>` : ''}
        <div id="day-check">${Views.dayCheck(date)}</div>
        <div><button class="btn primary" id="declare-btn" data-act="declare" data-date="${date}" ${c.ok ? '' : 'disabled'}>Déclarer en télétravail</button></div>
      </div>` : ''}`;
  }

  /* Bureau volant */
  let desk = '';
  if (Rules.isFloating(me) && biz) {
    const myBk = Rules.userBooking(me.id, date);
    if (rec) desk = '<p class="muted">Vous télétravaillez ce jour : aucune réservation nécessaire.</p>';
    else desk = `<p class="hint">${myBk ? `Vous occupez le bureau <strong>${myBk.deskId}</strong>.` : 'Choisissez un bureau volant, ici ou sur le plan interactif.'}</p>
      <div class="desk-list">${Rules.floatingDesks().map(dk => {
        const b = Rules.deskBooking(dk.id, date), mineBk = b && b.userId === me.id;
        const canAct = date >= t && (!b || mineBk);
        return `<button class="desk-chip ${b ? (mineBk ? 'mine' : 'taken') : 'free'}" ${canAct ? `data-act="desk" data-desk="${dk.id}" data-date="${date}"` : 'disabled'}>
          <strong>${dk.label}</strong><small>${mineBk ? 'Mon bureau – annuler' : b ? esc(shortName(userById(b.userId))) : 'Libre'}</small></button>`;
      }).join('')}</div>
      <p><a class="link" href="#plan" data-act="goto-plan" data-date="${date}">Ouvrir le plan des locaux →</a></p>`;
  }

  /* Vue d'ensemble de la journée */
  let overview = '';
  if (biz) {
    const remote = Rules.remoteOn(date).map(r => ({ r, u: userById(r.userId) })).sort((a, b) => a.u.lastName.localeCompare(b.u.lastName));
    overview = `<div class="grid-2 top">
      <div><h3>En télétravail (${remote.length})</h3>${remote.length ? `<ul class="people">${remote.map(({ r, u }) => `<li>${avatar(u)}<span>${esc(fullName(u))}</span>${badge(r.status)}</li>`).join('')}</ul>` : '<p class="muted">Personne.</p>'}</div>
      <div><h3>Bureaux volants</h3><ul class="people">${Rules.floatingDesks().map(dk => { const b = Rules.deskBooking(dk.id, date); return `<li><span class="desk-code">${dk.label}</span><span>${b ? esc(fullName(userById(b.userId))) : '<span class="free-txt">Libre</span>'}</span></li>`; }).join('')}</ul></div>
    </div>`;
  }

  return `<section class="panel-sec"><h3>Ma journée</h3>${mine}</section>
    ${desk ? `<section class="panel-sec"><h3>Mon bureau volant</h3>${desk}</section>` : ''}
    ${overview ? `<section class="panel-sec">${overview}</section>` : ''}`;
};

Changes['df-special'] = el => { App.dayForm.special = el.checked; Modal.draw(); };
Changes['df-reason'] = el => { App.dayForm.reason = el.value; Modal.draw(); };
const refreshDayCheck = () => {
  const btn = document.getElementById('declare-btn'); if (!btn) return;
  const date = btn.dataset.date;
  document.getElementById('day-check').innerHTML = Views.dayCheck(date);
  btn.disabled = !Rules.check(App.me(), date, Views.dayOpts()).ok;
};
Inputs['df-detail'] = el => { App.dayForm.detail = el.value; refreshDayCheck(); };
Inputs['df-late'] = el => { App.dayForm.lateReason = el.value; refreshDayCheck(); };

Actions.declare = el => {
  const res = Rules.declare(App.me(), el.dataset.date, Views.dayOpts());
  if (!res.ok) { toast(res.errors[0], 'ko'); return; }
  App.dayForm = { special: false, reason: '', detail: '', lateReason: '' };
  commit();
  toast(App.me().role === 'associe' ? 'Jour de télétravail enregistré.' : 'Jour de télétravail déclaré : vos associés sont notifiés.', 'ok');
};
Actions['remove-day'] = el => {
  const rec = S().days.find(d => d.id === el.dataset.id);
  if (!rec || !confirm('Retirer ce jour de télétravail ?')) return;
  const res = Rules.remove(rec);
  if (!res.ok) { toast(res.errors[0], 'ko'); return; }
  commit(); toast('Jour retiré.', 'ok');
};
Actions.desk = el => {
  const me = App.me(), date = el.dataset.date, deskId = el.dataset.desk;
  if (!Rules.isFloating(me)) { const b = Rules.deskBooking(deskId, date); toast(b ? `${deskId} : ${fullName(userById(b.userId))}` : `${deskId} : libre`); return; }
  const b = Rules.deskBooking(deskId, date);
  if (b && b.userId === me.id) { Rules.cancelBooking(me, date); commit(); toast(`Réservation du bureau ${deskId} annulée.`); return; }
  const res = Rules.book(me, date, deskId);
  if (!res.ok) { toast(res.errors[0], 'ko'); return; }
  commit(); toast(`Bureau ${deskId} réservé pour le ${D.fmtMed(date)}.`, 'ok');
};
Actions['goto-plan'] = el => { App.planDate = el.dataset.date; Modal.close(); App.render(); };
