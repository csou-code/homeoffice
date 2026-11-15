/* Reporting associés : indicateurs sur une période et une population choisies. */

Views.admin_reporting = function () {
  const me = App.me(), t = D.today();
  const r = App.report || (App.report = { from: `${t.slice(0, 4)}-01-01`, to: t, pop: 'all' });
  const eligible = S().users.filter(u => u.role !== 'associe' && Rules.isEligible(u));
  let users = eligible;
  if (r.pop === 'avocat' || r.pop === 'salarie') users = eligible.filter(u => u.role === r.pop);
  else if (r.pop === 'team') users = eligible.filter(u => (u.partners || []).includes(me.id));
  else if (r.pop.startsWith('u:')) users = eligible.filter(u => u.id === r.pop.slice(2));
  const ids = new Set(users.map(u => u.id));

  const days = S().days.filter(d => ids.has(d.userId) && d.date >= r.from && d.date <= r.to);
  const active = days.filter(d => d.status !== 'refused'), refused = days.filter(d => d.status === 'refused');
  const biz = D.businessDays(r.from, r.to);
  const perUser = users.map(u => {
    const workable = biz.filter(d => !Rules.isBlocked(u.id, d)).length;
    const mine = active.filter(d => d.userId === u.id).length;
    return { u, workable, declared: mine, refused: refused.filter(d => d.userId === u.id).length, late: days.filter(d => d.userId === u.id && d.late).length };
  });
  const workable = perUser.reduce((s, x) => s + x.workable, 0);
  const notDeclared = Math.max(0, workable - active.length);
  const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  const avgNotice = avg(days.map(d => D.diff(d.createdDay, d.date)));
  const late = days.filter(d => d.late);
  const avgRefusal = avg(refused.map(d => D.diff(d.refusal.at, d.date)));
  const fmt1 = v => v === null ? '–' : v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

  const byWd = [1, 2, 3, 4, 5].map(w => [D.WD[w], active.filter(d => D.dow(d.date) === w).length]);
  const countBy = (arr, key) => { const m = {}; arr.forEach(x => { const k = key(x); m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const lateReasons = countBy(late, d => d.special ? `Circonstances particulières – ${d.special.reason}` : (d.lateReason || 'Sans motif'));
  const specials = countBy(days.filter(d => d.special), d => d.special.reason);
  const refusalReasons = countBy(refused, d => d.refusal.reason);

  const popOpts = [['all', 'Tous les collaborateurs et salariés éligibles'], ['avocat', 'Avocats collaborateurs'], ['salarie', 'Salariés'], ['team', 'Mes rattachés']];
  const tile = (label, value, sub) => `<div class="tile"><span class="tile-label">${label}</span><span class="tile-value">${value}</span>${sub ? `<span class="tile-sub">${sub}</span>` : ''}</div>`;

  return `<form class="filters" data-submit="report">
      <label>Du<input type="date" name="from" value="${r.from}" data-change="report"></label>
      <label>Au<input type="date" name="to" value="${r.to}" data-change="report"></label>
      <label>Population<select name="pop" data-change="report">${popOpts.map(([k, l]) => `<option value="${k}" ${r.pop === k ? 'selected' : ''}>${l}</option>`).join('')}
        <optgroup label="Une personne">${eligible.slice().sort((a, b) => a.lastName.localeCompare(b.lastName)).map(u => `<option value="u:${u.id}" ${r.pop === `u:${u.id}` ? 'selected' : ''}>${esc(fullName(u))}</option>`).join('')}</optgroup></select></label>
      <div class="preset"><button type="button" class="btn ghost sm" data-act="report-preset" data-p="month">Mois en cours</button><button type="button" class="btn ghost sm" data-act="report-preset" data-p="quarter">3 derniers mois</button><button type="button" class="btn ghost sm" data-act="report-preset" data-p="year">Année</button></div>
    </form>
    <div class="tiles">
      ${tile('Jours de télétravail déclarés', active.length, `${plural(users.length, 'personne')} · ${plural(biz.length, 'jour')} ouvrés`)}
      ${tile('Jours non télétravaillés', notDeclared, workable ? `${Math.round((active.length / workable) * 100)} % de taux de télétravail` : '')}
      ${tile('Délai de prévenance moyen', `${fmt1(avgNotice)} j`, 'entre la pose et le jour télétravaillé')}
      ${tile('Poses hors délai', late.length, days.length ? `${Math.round((late.length / days.length) * 100)} % des poses` : '')}
      ${tile('Oppositions', refused.length, days.length ? `${Math.round((refused.length / days.length) * 100)} % des poses` : '')}
      ${tile('Délai moyen des oppositions', `${fmt1(avgRefusal)} j`, 'avant le jour concerné')}
    </div>
    <div class="charts">
      <section class="card"><h2>Jours de la semaine les plus choisis</h2>${Views.vbars(byWd, 'jours')}</section>
      <section class="card"><h2>Motifs des oppositions</h2>${Views.hbars(refusalReasons, 'opposition')}</section>
      <section class="card"><h2>Motifs des poses hors délai</h2>${Views.hbars(lateReasons, 'pose')}</section>
      <section class="card"><h2>Circonstances particulières (salariés)</h2>${Views.hbars(specials, 'jour')}</section>
    </div>
    <section class="card table-card"><h2>Détail par personne</h2><div class="table-scroll"><table class="data">
      <thead><tr><th>Personne</th><th class="num">Jours ouvrés</th><th class="num">Télétravail</th><th>Taux</th><th class="num">Hors délai</th><th class="num">Oppositions</th></tr></thead>
      <tbody>${perUser.sort((a, b) => b.declared - a.declared).map(x => { const rate = x.workable ? x.declared / x.workable : 0; return `<tr>
        <td><span class="who">${avatar(x.u)}<span><strong>${esc(fullName(x.u))}</strong><small>${esc(Rules.regimeLabel(x.u))}</small></span></span></td>
        <td class="num">${x.workable}</td><td class="num">${x.declared}</td>
        <td><span class="rate" data-tip="${esc(`${fullName(x.u)} : ${Math.round(rate * 100)} %`)}"><span class="rate-bar" style="width:${rate * 100}%"></span></span> ${Math.round(rate * 100)} %</td>
        <td class="num">${x.late}</td><td class="num">${x.refused}</td></tr>`; }).join('')}</tbody></table></div></section>`;
};

Views.vbars = function (entries, unit) {
  const max = Math.max(1, ...entries.map(e => e[1]));
  if (!entries.some(e => e[1])) return '<p class="muted">Aucune donnée sur la période.</p>';
  return `<div class="vbars" role="img" aria-label="${esc(entries.map(([l, v]) => `${l} : ${v}`).join(', '))}">${entries.map(([l, v]) => `
    <div class="vcol" data-tip="${esc(`${l} : ${v} ${unit}`)}"><span class="vval">${v}</span><span class="vtrack"><span class="vbar" style="height:${(v / max) * 100}%"></span></span><span class="vlbl">${esc(l.slice(0, 3))}.</span></div>`).join('')}</div>`;
};
Views.hbars = function (entries, unit) {
  if (!entries.length) return '<p class="muted">Aucune donnée sur la période.</p>';
  const max = Math.max(1, ...entries.map(e => e[1]));
  return `<div class="hbars">${entries.slice(0, 8).map(([l, v]) => `
    <div class="hrow" data-tip="${esc(`${l} : ${plural(v, unit)}`)}"><span class="hlbl">${esc(l)}</span><span class="htrack"><span class="hbar" style="width:${(v / max) * 100}%"></span></span><span class="hval">${v}</span></div>`).join('')}</div>`;
};

Changes.report = el => {
  const f = el.form, r = App.report;
  r.from = f.from.value || r.from; r.to = f.to.value || r.to; r.pop = f.pop.value;
  if (r.to < r.from) [r.from, r.to] = [r.to, r.from];
  App.render();
};
Submits.report = () => {};
Actions['report-preset'] = el => {
  const t = D.today(), r = App.report;
  if (el.dataset.p === 'month') { r.from = `${t.slice(0, 7)}-01`; r.to = t; }
  if (el.dataset.p === 'quarter') { r.from = `${D.addMonths(t.slice(0, 7), -2)}-01`; r.to = t; }
  if (el.dataset.p === 'year') { r.from = `${t.slice(0, 4)}-01-01`; r.to = `${t.slice(0, 4)}-12-31`; }
  App.render();
};
