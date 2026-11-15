/* Plan interactif des locaux et vue d'équipe hebdomadaire. */

Views.plan = function () {
  const d = App.planDate, me = App.me(), biz = D.isBusiness(d);
  const remote = biz ? Rules.remoteOn(d).map(r => userById(r.userId)) : [];
  return `<div class="page-head">
      <div><h1>Plan &amp; bureaux</h1><p class="muted">${Rules.isFloating(me) ? 'Cliquez sur un bureau volant libre pour le réserver.' : 'Occupation des bureaux et bureaux volants pour la journée choisie.'}</p></div>
      <div class="month-nav">
        <button class="icon-btn" data-act="plan-day" data-n="-1" aria-label="Jour ouvré précédent">${ICONS.chevL}</button>
        <input type="date" value="${d}" data-change="plan-date" aria-label="Date">
        <button class="icon-btn" data-act="plan-day" data-n="1" aria-label="Jour ouvré suivant">${ICONS.chevR}</button>
      </div>
    </div>
    <h2 class="date-title">${D.fmtLong(d)}${!biz ? ` – ${D.holiday(d) || 'week-end'}` : ''}</h2>
    <div class="cal-layout">
      <section class="card plan-card">${Views.floorPlan(d)}
        <div class="legend">
          <span><i class="sw present"></i> Présent</span><span><i class="sw remote"></i> Télétravail</span>
          <span><i class="sw free"></i> Bureau volant libre</span><span><i class="sw booked"></i> Bureau volant réservé</span><span><i class="sw mine"></i> Ma réservation</span>
        </div>
      </section>
      <aside class="side">
        <section class="card"><h2>En télétravail (${remote.length})</h2>${remote.length ? `<ul class="people">${remote.sort((a, b) => a.lastName.localeCompare(b.lastName)).map(u => `<li>${avatar(u)}<span>${esc(fullName(u))}</span></li>`).join('')}</ul>` : '<p class="muted">Personne.</p>'}</section>
        <section class="card"><h2>Bureaux volants</h2><ul class="people">${Rules.floatingDesks().map(dk => { const b = biz && Rules.deskBooking(dk.id, d); return `<li><span class="desk-code">${dk.label}</span><span>${b ? esc(fullName(userById(b.userId))) : '<span class="free-txt">Libre</span>'}</span></li>`; }).join('')}</ul></section>
      </aside>
    </div>`;
};

Views.floorPlan = function (d) {
  const me = App.me(), biz = D.isBusiness(d), t = D.today();
  const shapes = S().desks.map(dk => {
    if (dk.type === 'office') {
      const u = S().users.find(x => x.desk === dk.id);
      let st = 'vacant', tip = `${dk.label} – inoccupé`;
      if (u && biz) {
        const r = Rules.dayRecord(u.id, d);
        st = r ? 'remote' : 'present';
        tip = `${dk.label} – ${fullName(u)} : ${r ? 'télétravail' : 'au cabinet'}`;
      } else if (u) { st = 'closed'; tip = `${dk.label} – ${fullName(u)}`; }
      return `<g class="office ${st}" data-tip="${esc(tip)}"><rect x="${dk.x}" y="${dk.y}" width="${dk.w}" height="${dk.h}" rx="6"/>
        <text x="${dk.x + 8}" y="${dk.y + 20}" class="lbl">${dk.label}</text>
        ${u ? `<text x="${dk.x + dk.w / 2}" y="${dk.y + 70}" text-anchor="middle" class="nm">${esc(shortName(u))}</text>` : ''}
        ${u && biz ? `<text x="${dk.x + dk.w / 2}" y="${dk.y + 90}" text-anchor="middle" class="st">${st === 'remote' ? 'Télétravail' : 'Présent'}</text>` : ''}</g>`;
    }
    const b = biz && Rules.deskBooking(dk.id, d);
    const mine = b && b.userId === me.id;
    const st = b ? (mine ? 'mine' : 'booked') : 'free';
    const clickable = biz && Rules.isFloating(me) && d >= t && (!b || mine) && !Rules.dayRecord(me.id, d);
    const who = b ? userById(b.userId) : null;
    return `<g class="floating ${st} ${clickable ? 'clickable' : ''}" ${clickable ? `data-act="desk" data-desk="${dk.id}" data-date="${d}" role="button" tabindex="0" aria-label="Bureau ${dk.label} ${b ? 'réservé' : 'libre'}"` : ''} data-tip="${esc(`${dk.label} – ${who ? fullName(who) : biz ? 'libre' : 'fermé'}`)}">
      <rect x="${dk.x}" y="${dk.y}" width="${dk.w}" height="${dk.h}" rx="8"/>
      <text x="${dk.x + dk.w / 2}" y="${dk.y + 26}" text-anchor="middle" class="lbl">${dk.label}</text>
      <text x="${dk.x + dk.w / 2}" y="${dk.y + 48}" text-anchor="middle" class="nm">${who ? esc(shortName(who)) : biz ? 'Libre' : ''}</text></g>`;
  }).join('');
  return `<div class="plan-wrap"><svg viewBox="0 0 1000 560" class="plan" role="img" aria-label="Plan des locaux">
    <rect x="2" y="2" width="996" height="556" rx="12" class="floor"/>
    <rect x="13" y="160" width="210" height="240" rx="8" class="room"/><text x="118" y="285" text-anchor="middle" class="room-lbl">Accueil</text>
    <rect x="240" y="160" width="500" height="240" rx="8" class="room open"/><text x="490" y="190" text-anchor="middle" class="room-lbl">Espace partagé – bureaux volants</text>
    <rect x="757" y="160" width="230" height="240" rx="8" class="room"/><text x="872" y="285" text-anchor="middle" class="room-lbl">Salle de réunion</text>
    ${shapes}</svg></div>`;
};

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
