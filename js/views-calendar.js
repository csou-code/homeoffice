/* Calendrier personnel et fiche d'une journée (pose, retrait, bureau volant, présents). */

/* Préférences d'affichage du calendrier (propres à ce navigateur) */
const CalPrefs = {
  load() {
    try { const p = JSON.parse(localStorage.getItem('homeoffice-ui') || '{}'); App.calView = p.view === 'week' ? 'week' : 'month'; App.calWeekends = !!p.weekends; } catch (e) { /* ignoré */ }
  },
  save() { try { localStorage.setItem('homeoffice-ui', JSON.stringify({ view: App.calView, weekends: App.calWeekends })); } catch (e) { /* ignoré */ } },
};

/* Pastilles des personnes en télétravail un jour donné (mon équipe d'abord) */
Views.remotePeople = function (d, excludeId) {
  return Rules.remoteOn(d).filter(r => r.userId !== excludeId).map(r => ({ r, u: userById(r.userId) }))
    .sort((a, b) => (inMyTeam(b.u) - inMyTeam(a.u)) || a.u.lastName.localeCompare(b.u.lastName));
};
Views.avatarStack = function (list, max = 4) {
  if (!list.length) return '';
  const more = list.length - max;
  return `<span class="stack" title="${esc(`En télétravail : ${list.map(x => fullName(x.u)).join(', ')}`)}">${list.slice(0, max).map(x => avatar(x.u, 'xs')).join('')}${more > 0 ? `<span class="avatar xs more">+${more}</span>` : ''}</span>`;
};

/* Restrictions visibles dans une case : celles qui me concernent, ou toutes pour un associé */
Views.cellRestrictions = function (me, d) {
  if (me.role === 'associe') {
    const list = S().blocked.filter(b => b.date === d);
    if (!list.length) return '';
    const n = new Set(list.flatMap(b => b.userIds)).size;
    return `<span class="pill blocked" title="${esc(list.map(b => b.reason || 'Sans motif').join(' · '))}">Restriction · ${n} pers.</span>`;
  }
  const b = Rules.isBlocked(me.id, d);
  return b ? `<span class="pill blocked" title="${esc(b.reason || '')}">Présence requise</span>` : '';
};

Views.calendar = function () {
  const me = App.me(), t = D.today(), isP = me.role === 'associe';
  const week = App.calView === 'week', we = App.calWeekends;
  let days, title;
  if (week) {
    days = D.range(App.calWeek, D.add(App.calWeek, 6));
    title = `Semaine du ${D.fmtShort(days[0]).slice(0, 5)} au ${D.fmtShort(days[6])}`;
  } else {
    const ym = App.calMonth, [y, m] = ym.split('-').map(Number);
    days = D.range(D.monday(`${ym}-01`), D.add(D.monday(D.iso(new Date(y, m, 0))), 6));
    title = D.monthLabel(ym);
  }
  if (!we) days = days.filter(d => !D.isWeekend(d));
  const allowed = Rules.allowedWeekdays(me);
  const sel = new Set(App.selDays);

  const cell = d => {
    const out = !week && d.slice(0, 7) !== App.calMonth, biz = D.isBusiness(d), hol = D.holiday(d);
    const rec = Rules.dayRecord(me.id, d) || Rules.refusedRecord(me.id, d);
    const bk = Rules.userBooking(me.id, d);
    const others = biz ? Views.remotePeople(d, me.id) : [];
    const restr = biz ? Views.cellRestrictions(me, d) : '';
    const noTT = biz && Rules.isEligible(me) && !isP && !allowed.includes(D.dow(d));
    const selectable = App.selMode && biz && d >= t;
    const cls = ['cal-cell', week && 'wk-cell', out && 'out', !biz && 'off', d === t && 'today', d < t && 'past', sel.has(d) && 'selected', selectable && 'selectable'].filter(Boolean).join(' ');
    const act = App.selMode ? (selectable ? `data-act="sel-day" data-date="${d}"` : 'disabled') : `data-act="open-day" data-date="${d}"`;
    const mine = rec ? `<span class="pill ${STATUS[rec.status].cls}">${rec.status === 'refused' ? 'TT refusé' : 'Mon télétravail'}</span>` : '';
    const head = `<span class="cell-head"><span class="num">${week ? `${D.WD_SHORT[D.dow(d)]} ` : ''}${+d.slice(8)}</span>${sel.has(d) ? '<span class="sel-mark" aria-hidden="true">✓</span>' : ''}</span>`;
    if (week) {
      const free = biz ? Rules.floatingDesks().filter(x => !Rules.deskBooking(x.id, d)).length : 0;
      return `<button class="${cls}" ${act} aria-label="${D.fmtLong(d)}">${head}
        ${hol ? `<span class="hol">${hol}</span>` : ''}${mine}${restr}
        ${noTT && !restr ? '<span class="pill muted">Non télétravaillable</span>' : ''}
        ${bk ? `<span class="pill desk">Poste ${bk.deskId}</span>` : ''}
        ${biz ? `<span class="wk-sub">En télétravail (${others.length})</span>
        <span class="wk-people">${others.map(({ r, u }) => `<span class="wk-person ${r.status}">${avatar(u, 'xs')}<span>${esc(shortName(u))}</span></span>`).join('') || '<span class="muted">Personne</span>'}</span>
        <span class="wk-foot">${free}/${Rules.floatingDesks().length} postes volants libres</span>` : ''}
      </button>`;
    }
    return `<button class="${cls}" ${act} aria-label="${D.fmtLong(d)}">${head}
      ${hol ? `<span class="hol">${hol}</span>` : ''}${mine}${restr}
      ${noTT && !restr ? '<span class="pill muted">Non télétravaillable</span>' : ''}
      ${bk ? `<span class="pill desk">Poste ${bk.deskId}</span>` : ''}
      ${others.length ? `<span class="others">${Views.avatarStack(others)}</span>` : ''}
    </button>`;
  };
  const labels = (we ? [1, 2, 3, 4, 5, 6, 0] : [1, 2, 3, 4, 5]).map(w => D.WD_SHORT[w]);
  const gridCls = `cal-grid ${we ? 'g7' : 'g5'}${week ? ' week' : ''}`;

  return `<div class="page-head">
      <div><h1>Mon calendrier</h1><p class="muted">${App.selMode ? 'Mode sélection : cliquez sur les jours à restreindre.' : 'Cliquez sur un jour pour déclarer un télétravail, réserver un poste ou voir qui est présent.'}</p></div>
      <div class="cal-toolbar">
        <div class="seg" role="group" aria-label="Affichage">
          <button class="${!week ? 'on' : ''}" data-act="cal-view" data-v="month" aria-pressed="${!week}">Mois</button>
          <button class="${week ? 'on' : ''}" data-act="cal-view" data-v="week" aria-pressed="${week}">Semaine</button>
        </div>
        <label class="switch"><input type="checkbox" data-change="cal-weekends" ${we ? 'checked' : ''}><span>Week-ends</span></label>
        <div class="month-nav">
          <button class="icon-btn" data-act="cal-nav" data-n="-1" aria-label="${week ? 'Semaine' : 'Mois'} précédent${week ? 'e' : ''}">${ICONS.chevL}</button>
          <strong class="${week ? '' : 'cap'}">${title}</strong>
          <button class="icon-btn" data-act="cal-nav" data-n="1" aria-label="${week ? 'Semaine' : 'Mois'} suivant${week ? 'e' : ''}">${ICONS.chevR}</button>
          <button class="btn ghost sm" data-act="cal-today">Aujourd'hui</button>
        </div>
      </div>
    </div>
    ${isP ? `<div class="restrict-bar ${App.selMode ? 'active' : ''}">
      ${App.selMode
        ? `<span><strong>${plural(App.selDays.length, 'jour')} sélectionné${App.selDays.length > 1 ? 's' : ''}</strong>${App.selDays.length ? ` : ${App.selDays.slice().sort().map(D.fmtMed).join(', ')}` : ''}</span>
           <span class="rb-actions"><button class="btn primary sm" data-act="restrict-open" ${App.selDays.length ? '' : 'disabled'}>Restreindre ces jours</button><button class="btn ghost sm" data-act="sel-mode" data-on="0">Annuler</button></span>`
        : `<span>Restreindre le télétravail de votre équipe ou du cabinet :</span>
           <span class="rb-actions"><button class="btn ghost sm" data-act="sel-mode" data-on="1">Sélectionner des jours</button><button class="btn ghost sm" data-act="restrict-open" data-period="1">Saisir une période</button></span>`}
    </div>` : ''}
    <div class="cal-layout">
      <section class="card cal-card">
        <div class="${gridCls} head">${labels.map(l => `<div>${l}</div>`).join('')}</div>
        <div class="${gridCls}">${days.map(cell).join('')}</div>
        <div class="legend">
          <span><i class="pill pending">&nbsp;</i> En attente</span>
          <span><i class="pill ok">&nbsp;</i> Confirmé</span>
          <span><i class="pill ko">&nbsp;</i> Refusé</span>
          <span><i class="pill blocked">&nbsp;</i> ${isP ? 'Restriction de télétravail' : 'Présence requise'}</span>
          <span><i class="pill desk">&nbsp;</i> Poste volant réservé</span>
          ${week ? '<span><b class="q">?</b> Télétravail en attente de confirmation</span>' : ''}
        </div>
        ${peopleLegend()}
      </section>
      <aside class="side">${Views.regimeCard(me)}${Views.upcomingCard(me)}</aside>
    </div>`;
};

Actions['cal-view'] = el => {
  App.calView = el.dataset.v;
  if (App.calView === 'week') {
    const t = D.today();
    App.calWeek = D.monday(App.calMonth === t.slice(0, 7) ? t : `${App.calMonth}-01`);
  } else App.calMonth = D.add(App.calWeek, 3).slice(0, 7);
  CalPrefs.save(); App.render();
};
Changes['cal-weekends'] = el => { App.calWeekends = el.checked; CalPrefs.save(); App.render(); };
Actions['cal-nav'] = el => {
  const n = +el.dataset.n;
  if (App.calView === 'week') { App.calWeek = D.add(App.calWeek, 7 * n); App.calMonth = D.add(App.calWeek, 3).slice(0, 7); }
  else App.calMonth = D.addMonths(App.calMonth, n);
  App.render();
};
Actions['cal-today'] = () => { const t = D.today(); App.calMonth = t.slice(0, 7); App.calWeek = D.monday(t); App.render(); };

/* ---------- Restrictions de télétravail depuis le calendrier (associés) ---------- */
Actions['sel-mode'] = el => { App.selMode = el.dataset.on === '1'; App.selDays = []; App.render(); };
Actions['sel-day'] = el => {
  const d = el.dataset.date, i = App.selDays.indexOf(d);
  if (i >= 0) App.selDays.splice(i, 1); else App.selDays.push(d);
  App.render();
};
Actions['restrict-open'] = el => {
  const opts = el.dataset.date ? { dates: [el.dataset.date] } : el.dataset.period ? { period: true } : { dates: App.selDays.slice().sort() };
  Modal.open('Restreindre le télétravail', () => Views.blockedForm(opts), { wide: true });
};
Views.regimeCard = function (u) {
  const partners = Rules.partnersOf(u);
  let body = `<dl class="kv">
    <dt>Catégorie</dt><dd>${CATEGORIES[u.role].label}</dd>
    <dt>Régime</dt><dd>${esc(Rules.regimeLabel(u))}</dd>
    ${u.role !== 'associe' ? `<dt>Associé(s)</dt><dd>${partners.map(p => esc(fullName(p))).join(', ') || '—'}</dd>` : ''}
    <dt>Poste</dt><dd>${u.desk ? esc(Rules.deskLabel(u.desk)) : Rules.isFloating(u) ? 'Postes volants (réservation)' : '—'}</dd>
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
    else desk = `<p class="hint">${myBk ? `Vous occupez le poste volant <strong>${esc(Rules.deskLabel(myBk.deskId))}</strong>.` : 'Choisissez un poste volant, ici ou sur le plan des locaux.'}</p>
      <div class="desk-list">${Rules.floatingDesks().map(dk => {
        const b = Rules.deskBooking(dk.id, date), mineBk = b && b.userId === me.id;
        const canAct = date >= t && (!b || mineBk);
        return `<button class="desk-chip ${b ? (mineBk ? 'mine' : 'taken') : 'free'}" ${canAct ? `data-act="desk" data-desk="${dk.id}" data-date="${date}"` : 'disabled'}>
          <strong>${dk.label}</strong><small>${mineBk ? 'Mon poste – annuler' : b ? esc(shortName(userById(b.userId))) : 'Libre'}</small></button>`;
      }).join('')}</div>
      <p><a class="link" href="#plan" data-act="goto-plan" data-date="${date}">Réserver sur le plan des locaux →</a></p>`;
  }

  /* Vue d'ensemble de la journée */
  let overview = '';
  if (biz) {
    const remote = Rules.remoteOn(date).map(r => ({ r, u: userById(r.userId) })).sort((a, b) => a.u.lastName.localeCompare(b.u.lastName));
    overview = `<div class="grid-2 top">
      <div><h3>En télétravail (${remote.length})</h3>${remote.length ? `<ul class="people">${remote.map(({ r, u }) => `<li>${avatar(u)}<span>${esc(fullName(u))}</span>${badge(r.status)}</li>`).join('')}</ul>` : '<p class="muted">Personne.</p>'}</div>
      <div><h3>Postes volants</h3><ul class="people">${Rules.floatingDesks().map(dk => { const b = Rules.deskBooking(dk.id, date); return `<li><span class="desk-code">${dk.label}</span><span>${b ? esc(fullName(userById(b.userId))) : '<span class="free-txt">Libre</span>'}</span></li>`; }).join('')}</ul></div>
    </div>`;
  }

  /* Restrictions du jour (associés) */
  let restr = '';
  if (me.role === 'associe' && biz) {
    const list = S().blocked.filter(b => b.date === date);
    restr = `<section class="panel-sec"><h3>Restrictions de télétravail</h3>
      ${list.length ? `<ul class="list">${list.map(b => `<li class="bl-item"><div><strong>${b.reason ? esc(b.reason) : '<span class="muted">Sans motif</span>'}</strong>
        <small class="muted">${plural(b.userIds.length, 'personne')} · par ${esc(shortName(userById(b.by)))}</small>
        <span class="mini-people">${b.userIds.map(id => avatar(userById(id), 'xs')).join('')}</span></div>
        ${b.date >= t ? `<button class="btn sm danger-ghost" data-act="del-blocked" data-id="${b.id}">Supprimer</button>` : ''}</li>`).join('')}</ul>` : '<p class="muted">Aucune restriction ce jour.</p>'}
      ${date >= t ? `<button class="btn ghost sm" data-act="restrict-open" data-date="${date}">+ Restreindre le télétravail ce jour</button>` : ''}
    </section>`;
  }

  return `<section class="panel-sec"><h3>Ma journée</h3>${mine}</section>
    ${desk ? `<section class="panel-sec"><h3>Mon poste volant</h3>${desk}</section>` : ''}
    ${restr}
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
  if (b && b.userId === me.id) { Rules.cancelBooking(me, date); commit(); toast(`Réservation du poste ${Rules.deskLabel(deskId)} annulée.`); return; }
  const res = Rules.book(me, date, deskId);
  if (!res.ok) { toast(res.errors[0], 'ko'); return; }
  commit(); toast(`Poste ${Rules.deskLabel(deskId)} réservé pour le ${D.fmtMed(date)}.`, 'ok');
};
Actions['goto-plan'] = el => { App.planDate = el.dataset.date; Modal.close(); App.render(); };
