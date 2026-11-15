/* Espace associés : demandes, utilisateurs, jours bloqués, paramètres, régimes spécifiques, reporting. */

const ADMIN_TABS = [['requests', 'Demandes'], ['users', 'Utilisateurs'], ['blocked', 'Présence requise'], ['settings', 'Paramètres'], ['regimes', 'Régimes spécifiques'], ['reporting', 'Reporting']];

Views.admin = function () {
  const sub = ADMIN_TABS.some(([k]) => k === App.sub) ? App.sub : 'requests';
  const pendingCount = Views.reqList('team').filter(d => d.status === 'pending').length;
  return `<div class="page-head"><div><h1>Administration</h1><p class="muted">Espace réservé aux associés.</p></div></div>
    <nav class="subtabs" aria-label="Administration">${ADMIN_TABS.map(([k, l]) => `<a href="#admin/${k}" class="${sub === k ? 'active' : ''}">${l}${k === 'requests' && pendingCount ? ` <span class="count">${pendingCount}</span>` : ''}</a>`).join('')}</nav>
    ${Views['admin_' + sub]()}`;
};

/* ---------- Demandes ---------- */
Views.reqList = function (scope) {
  const me = App.me(), t = D.today();
  const ids = scope === 'team' ? Rules.teamOf(me).map(u => u.id) : S().users.filter(u => u.role !== 'associe').map(u => u.id);
  return S().days.filter(d => ids.includes(d.userId) && d.date >= t && d.status !== 'refused').sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
};

Views.admin_requests = function () {
  const me = App.me(), list = Views.reqList(App.reqScope), digestDay = D.addBusiness(D.today(), 2);
  const pending = list.filter(d => d.status === 'pending'), confirmed = list.filter(d => d.status === 'confirmed');
  const row = d => {
    const u = userById(d.userId);
    return `<tr class="${d.date === digestDay && d.status === 'pending' ? 'hl' : ''}">
      <td><button class="link" data-act="open-day" data-date="${d.date}">${D.fmtMed(d.date)}</button>${d.date === digestDay && d.status === 'pending' ? '<span class="tag warn">J+2 ouvrés</span>' : ''}</td>
      <td><span class="who">${avatar(u)}<span><strong>${esc(fullName(u))}</strong><small>${esc(Rules.regimeLabel(u))}</small></span></span></td>
      <td>${fmtDateTime(d.createdAt)}</td><td>${noticeTag(d)}</td>
      <td class="actions">${d.status === 'pending' ? `<button class="btn sm primary" data-act="confirm-day" data-id="${d.id}">Confirmer</button>
        <button class="btn sm ghost" data-act="confirm-day" data-id="${d.id}" data-inform="1">Confirmer et informer</button>` : `${badge('confirmed')}`}
        ${Rules.canOppose(d) ? `<button class="btn sm danger-ghost" data-act="oppose-day" data-id="${d.id}">S'opposer</button>` : ''}</td></tr>`;
  };
  const table = rows => rows.length ? `<div class="table-scroll"><table class="data"><thead><tr><th>Jour</th><th>Personne</th><th>Posé le</th><th>Délai</th><th>Actions</th></tr></thead><tbody>${rows.map(row).join('')}</tbody></table></div>` : '<p class="muted">Rien à afficher.</p>';
  const prefs = S().partnerPrefs[me.id] || (S().partnerPrefs[me.id] = { emailDigest: true });
  const dg = Rules.digestFor(me);
  return `<div class="cal-layout">
    <div class="main-col">
      <div class="toolbar"><label class="inline">Afficher <select data-change="req-scope"><option value="team" ${App.reqScope === 'team' ? 'selected' : ''}>Mes collaborateurs et salariés rattachés</option><option value="all" ${App.reqScope === 'all' ? 'selected' : ''}>Tout le cabinet</option></select></label></div>
      <section class="card"><h2>À confirmer (${pending.length})</h2>${table(pending)}</section>
      <section class="card"><h2>Déjà confirmés (${confirmed.length})</h2><p class="hint">L'opposition reste possible jusqu'à la veille du jour télétravaillé.</p>${table(confirmed)}</section>
    </div>
    <aside class="side"><section class="card"><h2>E-mail du soir</h2>
      <label class="check"><input type="checkbox" data-change="digest" ${prefs.emailDigest ? 'checked' : ''}> Recevoir chaque soir un e-mail lorsque des poses non confirmées sont prévues dans deux jours ouvrés</label>
      <div class="email-preview ${prefs.emailDigest ? '' : 'dim'}">
        <div class="email-head"><span>À : ${esc(me.email)}</span><span>Objet : ${dg.items.length} télétravail(s) à confirmer pour le ${D.fmtMed(dg.target)}</span></div>
        ${dg.items.length ? `<ul class="plain">${dg.items.map(d => `<li>${esc(fullName(userById(d.userId)))}</li>`).join('')}</ul>` : '<p class="muted">Aucune pose en attente pour ce jour : aucun e-mail ne serait envoyé ce soir.</p>'}
      </div>
      <p class="hint">Aperçu simulé. L'envoi réel sera assuré par une tâche planifiée Symfony (Messenger / cron).</p>
    </section></aside></div>`;
};
Changes['req-scope'] = el => { App.reqScope = el.value; App.render(); };
Changes.digest = el => { S().partnerPrefs[App.me().id].emailDigest = el.checked; commit(); };
Actions['confirm-day'] = el => {
  const rec = S().days.find(d => d.id === el.dataset.id);
  Rules.confirm(rec, App.me(), !!el.dataset.inform);
  commit(); toast(el.dataset.inform ? 'Jour confirmé, collaborateur informé.' : 'Jour confirmé.', 'ok');
};
Actions['oppose-day'] = el => {
  const rec = S().days.find(d => d.id === el.dataset.id), u = userById(rec.userId);
  Modal.open("S'opposer au télétravail", () => `<form data-submit="oppose" data-id="${rec.id}" class="form-stack">
    <p><strong>${esc(fullName(u))}</strong> – ${D.fmtLong(rec.date)}</p>
    <label>Motif <em>(obligatoire)</em><select name="reason" required><option value="">— Choisir —</option>${REFUSAL_REASONS.map(r => `<option>${esc(r)}</option>`).join('')}</select></label>
    <label>Précisions <em>(facultatif)</em><input type="text" name="detail" maxlength="200"></label>
    <p class="hint">Le collaborateur est notifié de l'opposition et du motif.</p>
    <div class="modal-actions"><button type="button" class="btn ghost" data-act="modal-close">Annuler</button><button class="btn danger">Confirmer l'opposition</button></div></form>`);
};
Submits.oppose = (f, fd) => {
  const rec = S().days.find(d => d.id === f.dataset.id);
  const res = Rules.oppose(rec, App.me(), fd.get('reason'), fd.get('detail'));
  if (!res.ok) { toast(res.errors[0], 'ko'); return; }
  Modal.close(); commit(); toast('Opposition enregistrée et notifiée.', 'ok');
};

/* ---------- Utilisateurs ---------- */
Views.admin_users = function () {
  const year = D.today().slice(0, 4);
  const order = { associe: 0, avocat: 1, salarie: 2 };
  const users = S().users.slice().sort((a, b) => order[a.role] - order[b.role] || a.lastName.localeCompare(b.lastName));
  return `<div class="toolbar"><p class="muted">Catégorie, régime, rattachements et crédits de chaque membre du cabinet.</p>
      <div><button class="btn ghost sm" data-act="export-users">Exporter le récapitulatif (Excel/CSV)</button> <button class="btn ghost sm" data-act="export-days">Exporter les jours posés (CSV)</button></div></div>
    <section class="card table-card"><div class="table-scroll"><table class="data">
      <thead><tr><th>Nom</th><th>Catégorie / régime</th><th>Associé(s)</th><th>Bureau</th><th>Crédit ${year}</th><th></th></tr></thead>
      <tbody>${users.map(u => {
        let credit = '—';
        if (Rules.isDC(u)) { const c = Rules.credit(u, year); credit = `${c.base.left}/${c.base.total}${u.creditAdjustment ? ` <span class="tag">${u.creditAdjustment > 0 ? '+' : ''}${u.creditAdjustment}</span>` : ''} · add. ${c.extra.left}/${c.extra.total}`; }
        return `<tr><td><span class="who">${avatar(u)}<span><strong>${esc(fullName(u))}</strong><small>${esc(u.title)}</small></span></span></td>
          <td>${CATEGORIES[u.role].label}<br><small class="muted">${esc(Rules.regimeLabel(u))}</small></td>
          <td>${Rules.partnersOf(u).map(p => esc(shortName(p))).join(', ') || '—'}</td>
          <td>${u.desk || (Rules.isFloating(u) ? 'Volant' : '—')}</td><td>${credit}</td>
          <td><button class="btn sm ghost" data-act="edit-user" data-id="${u.id}">Modifier</button></td></tr>`;
      }).join('')}</tbody></table></div></section>`;
};
Actions['edit-user'] = el => {
  const u = userById(el.dataset.id);
  const offices = S().desks.filter(d => d.type === 'office');
  Modal.open(`Modifier – ${esc(fullName(u))}`, () => `<form data-submit="user" data-id="${u.id}" class="form-stack">
    <label>Catégorie et régime<select name="profile">${PROFILE_OPTIONS.map(([v, l]) => `<option value="${v}" ${v === `${u.role}:${u.role === 'associe' ? '' : u.regime}` ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label>Régime spécifique <em>(salariés en régime spécifique)</em><select name="spec"><option value="">—</option>${S().specificRegimes.map(r => `<option value="${r.id}" ${u.specificRegimeId === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
    <fieldset><legend>Associé(s) de rattachement</legend><div class="check-grid">${S().users.filter(p => p.role === 'associe' && p.id !== u.id).map(p => `<label class="check"><input type="checkbox" name="partners" value="${p.id}" ${(u.partners || []).includes(p.id) ? 'checked' : ''}> ${esc(fullName(p))}</label>`).join('')}</div></fieldset>
    <div class="grid-2">
      <label>Ajustement du crédit annuel <em>(salariés de droit commun)</em><input type="number" name="adj" value="${u.creditAdjustment || 0}" min="-50" max="50" step="1"></label>
      <label>Bureau attitré<select name="desk"><option value="">Aucun</option>${offices.map(d => { const occ = S().users.find(x => x.desk === d.id && x.id !== u.id); return `<option value="${d.id}" ${u.desk === d.id ? 'selected' : ''} ${occ ? 'disabled' : ''}>${d.id}${occ ? ` – ${esc(shortName(occ))}` : ''}</option>`; }).join('')}</select></label>
    </div>
    <div class="modal-actions"><button type="button" class="btn ghost" data-act="modal-close">Annuler</button><button class="btn primary">Enregistrer</button></div></form>`);
};
Submits.user = (f, fd) => {
  const u = userById(f.dataset.id);
  const [role, regime] = fd.get('profile').split(':');
  if (regime === 'specifique' && !fd.get('spec')) { toast('Choisissez le régime spécifique applicable.', 'ko'); return; }
  u.role = role; u.regime = regime;
  u.specificRegimeId = regime === 'specifique' ? fd.get('spec') : null;
  u.partners = role === 'associe' ? [] : fd.getAll('partners');
  u.creditAdjustment = parseInt(fd.get('adj'), 10) || 0;
  u.desk = regime === 'sans_bureau' ? null : (fd.get('desk') || null);
  if (!u.typicalWeek) u.typicalWeek = [];
  Modal.close(); commit(); toast('Utilisateur mis à jour.', 'ok');
};

function downloadCSV(name, rows) {
  const csv = '﻿' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
Actions['export-users'] = () => {
  const year = D.today().slice(0, 4);
  const rows = [['Nom', 'Prénom', 'E-mail', 'Fonction', 'Catégorie', 'Régime', 'Associés de rattachement', 'Bureau', `Crédit annuel ${year}`, 'Ajustement', 'Posés (passés)', 'Posés (à venir)', 'Solde', 'Crédit additionnel restant']];
  S().users.forEach(u => {
    const c = Rules.isDC(u) ? Rules.credit(u, year) : null;
    rows.push([u.lastName, u.firstName, u.email, u.title, CATEGORIES[u.role].label, Rules.regimeLabel(u), Rules.partnersOf(u).map(fullName).join(', '), u.desk || (Rules.isFloating(u) ? 'Volant' : ''),
      c ? c.base.total : '', c ? u.creditAdjustment : '', c ? c.base.past : '', c ? c.base.future : '', c ? c.base.left : '', c ? c.extra.left : '']);
  });
  downloadCSV(`recapitulatif-teletravail-${D.today()}.csv`, rows);
};
Actions['export-days'] = () => {
  const rows = [['Date', 'Nom', 'Statut', 'Posé le', 'Hors délai', 'Motif hors délai', 'Circonstances particulières', 'Précisions', 'Motif de refus', 'Refus par']];
  S().days.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(d => {
    rows.push([d.date, fullName(userById(d.userId)), STATUS[d.status].label, d.createdAt.replace('T', ' ').slice(0, 16), d.late ? 'Oui' : 'Non', d.lateReason, d.special ? d.special.reason : '', d.special ? d.special.detail : '',
      d.refusal ? `${d.refusal.reason}${d.refusal.detail ? ` – ${d.refusal.detail}` : ''}` : '', d.refusal ? fullName(userById(d.refusal.by)) : '']);
  });
  downloadCSV(`jours-teletravail-${D.today()}.csv`, rows);
};

/* ---------- Jours de présence requise ---------- */
Views.admin_blocked = function () {
  const me = App.me(), t = D.today();
  const pool = S().users.filter(u => u.role !== 'associe' && Rules.isEligible(u)).sort((a, b) => a.lastName.localeCompare(b.lastName));
  const list = S().blocked.slice().sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="cal-layout">
    <section class="card"><h2>Nouveau jour de présence requise</h2>
      <form data-submit="blocked" class="form-stack" id="blocked-form">
        <div class="grid-2"><label>Du<input type="date" name="from" required min="${t}"></label><label>Au <em>(facultatif)</em><input type="date" name="to" min="${t}"></label></div>
        <fieldset><legend>Personnes concernées</legend>
          <div class="quick">Sélection rapide : <button type="button" class="link" data-act="bl-sel" data-k="team">mes rattachés</button> · <button type="button" class="link" data-act="bl-sel" data-k="avocat">avocats</button> · <button type="button" class="link" data-act="bl-sel" data-k="salarie">salariés</button> · <button type="button" class="link" data-act="bl-sel" data-k="all">tous</button> · <button type="button" class="link" data-act="bl-sel" data-k="none">aucun</button></div>
          <div class="check-grid">${pool.map(u => `<label class="check"><input type="checkbox" name="users" value="${u.id}" data-role="${u.role}" data-team="${(u.partners || []).includes(me.id) ? 1 : 0}"> ${esc(fullName(u))}</label>`).join('')}</div>
        </fieldset>
        <label>Motif <em>(facultatif)</em><input type="text" name="reason" maxlength="200" placeholder="Ex. : séminaire, audit, formation collective"></label>
        <div><button class="btn primary">Enregistrer</button></div>
      </form></section>
    <section class="card"><h2>Jours enregistrés</h2>${list.length ? `<ul class="list">${list.map(b => `<li class="bl-item ${b.date < t ? 'past' : ''}">
      <div><strong>${D.fmtMed(b.date)}</strong> – ${plural(b.userIds.length, 'personne')}${b.reason ? ` – ${esc(b.reason)}` : ' <span class="muted">(sans motif)</span>'}
      <small class="muted" data-tip="${esc(b.userIds.map(id => fullName(userById(id))).join(', '))}">Par ${esc(shortName(userById(b.by)))} · survoler pour voir les personnes</small></div>
      ${b.date >= t ? `<button class="btn sm danger-ghost" data-act="del-blocked" data-id="${b.id}">Supprimer</button>` : ''}</li>`).join('')}</ul>` : '<p class="muted">Aucun.</p>'}</section>
  </div>`;
};
Actions['bl-sel'] = el => {
  const k = el.dataset.k;
  document.querySelectorAll('#blocked-form input[name=users]').forEach(c => {
    c.checked = k === 'all' || (k === 'team' && c.dataset.team === '1') || c.dataset.role === k;
  });
};
Submits.blocked = (f, fd) => {
  const from = fd.get('from'), to = fd.get('to') || from, users = fd.getAll('users');
  if (!users.length) { toast('Sélectionnez au moins une personne.', 'ko'); return; }
  if (to < from) { toast('La date de fin précède la date de début.', 'ko'); return; }
  const dates = D.businessDays(from, to);
  if (!dates.length) { toast('Aucun jour ouvré dans cette période.', 'ko'); return; }
  const reason = (fd.get('reason') || '').trim();
  let conflicts = 0;
  dates.forEach(date => {
    S().blocked.push({ id: uid('bl'), date, userIds: users, reason, by: App.me().id, at: D.today() });
    users.forEach(id => {
      if (Rules.dayRecord(id, date)) conflicts++;
      Rules.notify(id, `Présence requise au cabinet le ${D.fmtLong(date)}${reason ? ` : ${reason}` : ''}.`);
    });
  });
  commit();
  toast(`${plural(dates.length, 'jour')} enregistré${dates.length > 1 ? 's' : ''}.${conflicts ? ` ${conflicts} télétravail(s) déjà posé(s) à traiter dans « Demandes ».` : ''}`, conflicts ? 'warn' : 'ok');
};
Actions['del-blocked'] = el => { S().blocked = S().blocked.filter(b => b.id !== el.dataset.id); commit(); toast('Jour supprimé.'); };

/* ---------- Paramètres ---------- */
Views.admin_settings = function () {
  const st = S().settings;
  return `<form data-submit="settings" class="settings-grid">
    <section class="card"><h2>Avocats collaborateurs éligibles</h2>
      <label>Délai de prévenance (jours calendaires avant le jour posé)<input type="number" name="noticeAvocat" min="0" max="30" value="${st.noticeAvocat}"></label>
      <p class="hint">1 = au plus tard la veille (valeur par défaut).</p></section>
    <section class="card"><h2>Salariés – régime de droit commun</h2>
      <div class="grid-2">
        <label>Délai de prévenance (jours ouvrés)<input type="number" name="noticeSalarie" min="0" max="30" value="${st.noticeSalarie}"></label>
        <label>Maximum de jours par semaine civile<input type="number" name="maxPerWeek" min="1" max="5" value="${st.maxPerWeek}"></label>
        <label>Crédit annuel de base (jours)<input type="number" name="baseCredit" min="0" max="250" value="${st.baseCredit}"></label>
        <label>Crédit additionnel – circonstances particulières<input type="number" name="extraCredit" min="0" max="250" value="${st.extraCredit}"></label>
      </div>
      <fieldset><legend>Jours de la semaine télétravaillables</legend><div class="week-toggles">${[1, 2, 3, 4, 5].map(w => `<label class="wk"><input type="checkbox" name="weekdays" value="${w}" ${st.weekdays.includes(w) ? 'checked' : ''}><span>${D.WD[w]}</span></label>`).join('')}</div></fieldset>
    </section>
    <div><button class="btn primary">Enregistrer les paramètres</button></div>
  </form>`;
};
Submits.settings = (f, fd) => {
  const st = S().settings, n = k => Math.max(0, parseInt(fd.get(k), 10) || 0);
  Object.assign(st, { noticeAvocat: n('noticeAvocat'), noticeSalarie: n('noticeSalarie'), maxPerWeek: Math.max(1, n('maxPerWeek')), baseCredit: n('baseCredit'), extraCredit: n('extraCredit'), weekdays: fd.getAll('weekdays').map(Number) });
  commit(); toast('Paramètres enregistrés.', 'ok');
};

/* ---------- Régimes spécifiques ---------- */
Views.admin_regimes = function () {
  return `<div class="toolbar"><p class="muted">Régimes individualisés (handicap, préconisations de la médecine du travail…).</p><button class="btn primary sm" data-act="edit-regime">Nouveau régime</button></div>
    <div class="doc-grid">${S().specificRegimes.map(r => {
      const users = S().users.filter(u => u.specificRegimeId === r.id && Rules.isSpecific(u));
      return `<section class="card regime"><h2>${esc(r.name)}</h2>
        <p><strong>${r.days} jour(s) par ${r.period === 'week' ? 'semaine' : 'mois'}</strong></p>
        <p class="muted">Jours possibles : ${r.weekdays.map(w => D.WD[w]).join(', ') || 'aucun'} · Prévenance : ${r.notice} jour(s) ouvré(s)</p>
        <p class="muted">Bénéficiaires : ${users.map(u => esc(fullName(u))).join(', ') || 'aucun'}</p>
        <div><button class="btn sm ghost" data-act="edit-regime" data-id="${r.id}">Modifier</button>
        ${users.length ? '' : `<button class="btn sm danger-ghost" data-act="del-regime" data-id="${r.id}">Supprimer</button>`}</div></section>`;
    }).join('')}</div>`;
};
Actions['edit-regime'] = el => {
  const r = S().specificRegimes.find(x => x.id === el.dataset.id) || { name: '', days: 1, period: 'week', weekdays: [1, 2, 3, 4, 5], notice: 2 };
  Modal.open(r.id ? 'Modifier le régime' : 'Nouveau régime spécifique', () => `<form data-submit="regime" data-id="${r.id || ''}" class="form-stack">
    <label>Intitulé<input type="text" name="name" required maxlength="80" value="${esc(r.name)}"></label>
    <div class="grid-2"><label>Nombre de jours<input type="number" name="days" min="1" max="31" value="${r.days}"></label>
    <label>Par<select name="period"><option value="week" ${r.period === 'week' ? 'selected' : ''}>semaine</option><option value="month" ${r.period === 'month' ? 'selected' : ''}>mois</option></select></label></div>
    <fieldset><legend>Jours télétravaillables</legend><div class="week-toggles">${[1, 2, 3, 4, 5].map(w => `<label class="wk"><input type="checkbox" name="weekdays" value="${w}" ${r.weekdays.includes(w) ? 'checked' : ''}><span>${D.WD[w]}</span></label>`).join('')}</div></fieldset>
    <label>Délai de prévenance (jours ouvrés)<input type="number" name="notice" min="0" max="30" value="${r.notice}"></label>
    <div class="modal-actions"><button type="button" class="btn ghost" data-act="modal-close">Annuler</button><button class="btn primary">Enregistrer</button></div></form>`);
};
Submits.regime = (f, fd) => {
  const data = { name: fd.get('name').trim(), days: Math.max(1, parseInt(fd.get('days'), 10) || 1), period: fd.get('period'), weekdays: fd.getAll('weekdays').map(Number), notice: Math.max(0, parseInt(fd.get('notice'), 10) || 0) };
  const ex = S().specificRegimes.find(x => x.id === f.dataset.id);
  if (ex) Object.assign(ex, data); else S().specificRegimes.push({ id: uid('rs'), ...data });
  Modal.close(); commit(); toast('Régime enregistré.', 'ok');
};
Actions['del-regime'] = el => { if (!confirm('Supprimer ce régime ?')) return; S().specificRegimes = S().specificRegimes.filter(r => r.id !== el.dataset.id); commit(); };
