/* Plan interactif des locaux et vue d'équipe hebdomadaire. */

Views.plan = function () {
  const d = App.planDate, me = App.me(), biz = D.isBusiness(d);
  const remote = biz ? Rules.remoteOn(d).map(r => userById(r.userId)).sort((a, b) => a.lastName.localeCompare(b.lastName)) : [];
  const floating = Rules.floatingDesks();
  const freeFloat = biz ? floating.filter(dk => !Rules.deskBooking(dk.id, d)).length : 0;
  const withDesk = S().users.filter(u => u.desk);
  const present = biz ? withDesk.filter(u => !Rules.dayRecord(u.id, d)).length + S().bookings.filter(b => b.date === d).length : 0;
  const vacant = S().desks.filter(dk => dk.type !== 'floating' && !S().users.some(u => u.desk === dk.id));
  const myBk = biz && Rules.userBooking(me.id, d);
  const people = S().users.slice().sort((a, b) => a.lastName.localeCompare(b.lastName));
  const hint = Rules.isFloating(me)
    ? (Rules.dayRecord(me.id, d) ? 'Vous êtes en télétravail ce jour : aucune réservation nécessaire.' : myBk ? `Vous occupez le poste volant <strong>${esc(Rules.deskLabel(myBk.deskId))}</strong>. Cliquez dessus pour annuler, ou sur un autre poste libre pour changer.` : 'Cliquez sur un poste volant libre (contour vert pointillé) pour le réserver.')
    : me.desk ? `Votre poste : <strong>${esc(Rules.deskLabel(me.desk))}</strong> (entouré en or sur le plan).` : '';
  return `<div class="page-head">
      <div><h1>Plan &amp; bureaux</h1><p class="muted">Occupation des locaux et réservation des postes volants, d'après le plan du cabinet.</p></div>
      <div class="month-nav">
        <button class="icon-btn" data-act="plan-day" data-n="-1" aria-label="Jour ouvré précédent">${ICONS.chevL}</button>
        <input type="date" value="${d}" data-change="plan-date" aria-label="Date">
        <button class="icon-btn" data-act="plan-day" data-n="1" aria-label="Jour ouvré suivant">${ICONS.chevR}</button>
      </div>
    </div>
    <h2 class="date-title">${D.fmtLong(d)}${!biz ? ` – ${D.holiday(d) || 'week-end'}, cabinet fermé` : ''}</h2>
    ${biz ? `<div class="tiles plan-tiles">
      <div class="tile"><span class="tile-label">Au cabinet</span><span class="tile-value">${present}</span></div>
      <div class="tile"><span class="tile-label">En télétravail</span><span class="tile-value">${remote.length}</span></div>
      <div class="tile"><span class="tile-label">Postes volants libres</span><span class="tile-value">${freeFloat} / ${floating.length}</span></div>
    </div>` : ''}
    <section class="card plan-card">
      <div class="plan-tools">
        ${hint ? `<p class="plan-hint">${hint}</p>` : '<span></span>'}
        <label class="inline">Trouver une personne <select data-change="plan-find"><option value="">—</option>${people.map(u => `<option value="${u.id}" ${App.planFind === u.id ? 'selected' : ''}>${esc(fullName(u))} (${esc(u.trigram)})</option>`).join('')}</select></label>
      </div>
      ${Views.floorPlan(d)}
      <div class="legend">
        <span><i class="sw present"></i> Présent</span><span><i class="sw remote"></i> Télétravail</span><span><i class="sw vacant"></i> Poste inoccupé</span>
        <span><i class="sw free"></i> Poste volant libre</span><span><i class="sw booked"></i> Poste volant réservé</span><span><i class="sw mine"></i> Mon poste</span>
      </div>
      ${App.planFind ? Views.findResult(App.planFind, d) : ''}
    </section>
    <div class="plan-lists">
      <section class="card"><h2>En télétravail (${remote.length})</h2>${remote.length ? `<ul class="people cols">${remote.map(u => `<li>${avatar(u)}<span>${esc(fullName(u))}</span></li>`).join('')}</ul>` : '<p class="muted">Personne.</p>'}</section>
      <section class="card"><h2>Postes volants</h2><ul class="people">${floating.map(dk => { const b = biz && Rules.deskBooking(dk.id, d); return `<li><span class="desk-code">${dk.id}</span><span>${b ? esc(fullName(userById(b.userId))) : biz ? '<span class="free-txt">Libre</span>' : '—'}</span><small class="muted">${dk.room}</small></li>`; }).join('')}</ul></section>
      <section class="card"><h2>Postes inoccupés (${vacant.length})</h2>${vacant.length ? `<ul class="people">${vacant.map(dk => `<li><span class="desk-code">${dk.room}</span><span>${esc(dk.label)}</span></li>`).join('')}</ul>` : '<p class="muted">Aucun.</p>'}<p class="hint">Postes attribuables depuis Administration → Utilisateurs.</p></section>
    </div>`;
};

Views.findResult = function (id, d) {
  const u = userById(id); if (!u) return '';
  const biz = D.isBusiness(d), r = biz && Rules.dayRecord(u.id, d), bk = biz && Rules.userBooking(u.id, d);
  let txt;
  if (!biz) txt = 'cabinet fermé ce jour';
  else if (r) txt = 'en télétravail ce jour';
  else if (u.desk) txt = `au cabinet, poste ${Rules.deskLabel(u.desk)}`;
  else if (bk) txt = `au cabinet, poste volant ${Rules.deskLabel(bk.deskId)}`;
  else txt = Rules.isFloating(u) ? 'aucun poste volant réservé ce jour' : 'pas de poste attribué';
  return `<p class="find-result"><strong>${esc(fullName(u))}</strong> : ${esc(txt)}.</p>`;
};

Views.floorPlan = function (d) {
  const me = App.me(), biz = D.isBusiness(d), t = D.today();
  const find = App.planFind, findBk = find && Rules.userBooking(find, d);
  const label = (dk, txt, cls = 'tri') => {
    const cx = dk.x + dk.w / 2, cy = dk.y + dk.h / 2;
    return `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" class="${cls}"${dk.v ? ` transform="rotate(-90 ${cx} ${cy})"` : ''}>${esc(txt)}</text>`;
  };
  const shapes = S().desks.map(dk => {
    let st, txt, tip, attrs = '', mine = false, found = false;
    if (dk.type !== 'floating') {
      const u = S().users.find(x => x.desk === dk.id);
      mine = u && u.id === me.id; found = u && u.id === find;
      if (!u) { st = 'vacant'; txt = ''; tip = `${dk.label} – poste inoccupé`; }
      else {
        const r = biz && Rules.dayRecord(u.id, d);
        st = !biz ? 'closed' : r ? 'remote' : 'present';
        txt = u.trigram;
        tip = `${dk.label} – ${fullName(u)}${biz ? ` : ${r ? 'télétravail' : 'au cabinet'}` : ''}`;
      }
    } else {
      const b = biz && Rules.deskBooking(dk.id, d);
      mine = b && b.userId === me.id; found = findBk && findBk.deskId === dk.id;
      const who = b ? userById(b.userId) : null;
      st = !biz ? 'closed' : b ? 'booked' : 'free';
      txt = who ? who.trigram : biz ? 'Libre' : '';
      tip = `Poste volant ${dk.label} – ${who ? fullName(who) : biz ? 'libre' : 'cabinet fermé'}`;
      const clickable = biz && Rules.isFloating(me) && d >= t && (!b || mine) && !Rules.dayRecord(me.id, d);
      if (clickable) attrs = ` data-act="desk" data-desk="${dk.id}" data-date="${d}" role="button" tabindex="0" aria-label="${esc(`${mine ? 'Annuler la réservation du' : 'Réserver le'} poste ${dk.label}`)}"`;
      if (clickable) st += ' clickable';
    }
    return `<g class="desk ${dk.type} ${st}${mine ? ' me' : ''}${found ? ' found' : ''}"${attrs} data-tip="${esc(tip)}">
      <rect x="${dk.x}" y="${dk.y}" width="${dk.w}" height="${dk.h}" rx="3"/>${txt ? label(dk, txt, txt === 'Libre' ? 'tri free-lbl' : 'tri') : ''}</g>`;
  }).join('');
  return `<div class="plan-wrap"><svg viewBox="0 0 ${FLOOR_PLAN.width} ${FLOOR_PLAN.height}" class="plan" role="img" aria-label="Plan des locaux">
    <image href="${FLOOR_PLAN.image}" x="0" y="0" width="${FLOOR_PLAN.width}" height="${FLOOR_PLAN.height}" class="plan-bg"/>
    ${shapes}</svg></div>`;
};
Changes['plan-find'] = el => { App.planFind = el.value || null; App.render(); };

Actions['plan-day'] = el => {
  const n = +el.dataset.n;
  App.planDate = n > 0 ? D.nextBusiness(App.planDate) : D.prevBusiness(App.planDate);
  App.render();
};
Changes['plan-date'] = el => { if (el.value) { App.planDate = el.value; App.render(); } };
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('g.clickable')) { e.preventDefault(); Actions.desk(e.target); }
});

/* ---------- Équipe ---------- */
Views.team = function () {
  const me = App.me(), mon = App.teamWeek, week = D.range(mon, D.add(mon, 4)), t = D.today();
  const filters = [['all', 'Tout le cabinet'], ['associe', 'Associés'], ['avocat', 'Avocats'], ['salarie', 'Salariés']];
  if (me.role === 'associe') filters.push(['team', 'Mes rattachés']);
  else filters.push(['mine', 'Mes associés et leurs équipes']);
  let users = S().users.slice();
  const f = App.teamFilter;
  if (['associe', 'avocat', 'salarie'].includes(f)) users = users.filter(u => u.role === f);
  if (f === 'team') users = Rules.teamOf(me);
  if (f === 'mine') { const ps = me.partners || []; users = users.filter(u => ps.includes(u.id) || (u.partners || []).some(p => ps.includes(p))); }
  const order = { associe: 0, avocat: 1, salarie: 2 };
  users.sort((a, b) => order[a.role] - order[b.role] || a.lastName.localeCompare(b.lastName));

  const cell = (u, d) => {
    if (!D.isBusiness(d)) return `<td class="c-off">${D.holiday(d) ? 'Férié' : ''}</td>`;
    const r = Rules.dayRecord(u.id, d) || Rules.refusedRecord(u.id, d);
    const blk = Rules.isBlocked(u.id, d);
    const bk = Rules.userBooking(u.id, d);
    if (r) return `<td><span class="pill ${STATUS[r.status].cls}" data-tip="${esc(`${fullName(u)} – ${STATUS[r.status].label}`)}">TT</span></td>`;
    if (!Rules.isEligible(u)) return '<td class="c-na">—</td>';
    if (blk) return '<td><span class="pill blocked" data-tip="Présence requise">Cabinet</span></td>';
    if (bk) return `<td><span class="pill desk">${bk.deskId}</span></td>`;
    return '<td></td>';
  };
  const counts = week.map(d => D.isBusiness(d) ? users.filter(u => Rules.dayRecord(u.id, d)).length : '–');

  return `<div class="page-head">
      <div><h1>Équipe</h1><p class="muted">Jours de télétravail déclarés par chacun, semaine par semaine.</p></div>
      <div class="month-nav">
        <select data-change="team-filter" aria-label="Population">${filters.map(([k, l]) => `<option value="${k}" ${f === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <button class="icon-btn" data-act="team-week" data-n="-7" aria-label="Semaine précédente">${ICONS.chevL}</button>
        <strong>Semaine du ${D.fmtShort(mon)}</strong>
        <button class="icon-btn" data-act="team-week" data-n="7" aria-label="Semaine suivante">${ICONS.chevR}</button>
      </div>
    </div>
    <section class="card table-card"><div class="table-scroll"><table class="team-table">
      <thead><tr><th>Personne</th>${week.map(d => `<th class="${d === t ? 'today' : ''}"><button class="link" data-act="open-day" data-date="${d}">${D.fmtMed(d)}</button></th>`).join('')}</tr></thead>
      <tbody>${users.map(u => `<tr class="${u.id === me.id ? 'me-row' : ''}"><th>${avatar(u)}<span><strong>${esc(fullName(u))}</strong><small>${esc(Rules.regimeLabel(u))}</small></span></th>${week.map(d => cell(u, d)).join('')}</tr>`).join('')}</tbody>
      <tfoot><tr><th>En télétravail</th>${counts.map(c => `<td><strong>${c}</strong></td>`).join('')}</tr></tfoot>
    </table></div></section>`;
};
Changes['team-filter'] = el => { App.teamFilter = el.value; App.render(); };
Actions['team-week'] = el => { App.teamWeek = D.add(App.teamWeek, +el.dataset.n); App.render(); };
