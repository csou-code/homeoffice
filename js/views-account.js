/* Mon compte (régime, soldes, semaine type), documents et notifications. */

Views.profile = function () {
  const me = App.me(), t = D.today();
  let typical = '';
  if (Rules.hasTypicalWeek(me)) {
    const allowed = Rules.allowedWeekdays(me);
    typical = `<section class="card"><h2>Ma semaine type</h2>
      <p class="muted">Cochez les jours habituellement télétravaillés. Chaque jour reste modifiable au cas par cas depuis le calendrier.</p>
      <div class="week-toggles">${[1, 2, 3, 4, 5].map(w => `<label class="wk ${allowed.includes(w) ? '' : 'disabled'}">
        <input type="checkbox" data-change="tw" data-wd="${w}" ${me.typicalWeek.includes(w) ? 'checked' : ''} ${allowed.includes(w) ? '' : 'disabled'}>
        <span>${D.WD[w]}</span></label>`).join('')}</div>
      ${Rules.isFloating(me) ? `<label class="inline">Bureau volant préféré les jours au cabinet
        <select data-change="pref-desk"><option value="">Indifférent</option>${Rules.floatingDesks().map(d => `<option ${me.preferredDesk === d.id ? 'selected' : ''}>${d.id}</option>`).join('')}</select></label>` : ''}
      <div class="apply-row">
        <label class="inline">Appliquer sur <select id="tw-weeks"><option value="2">2 semaines</option><option value="4" selected>4 semaines</option><option value="8">8 semaines</option></select></label>
        <button class="btn primary" data-act="apply-week">Appliquer ma semaine type</button>
      </div>
      <p class="hint">Les jours déjà déclarés, bloqués ou hors délai sont ignorés.${Rules.isFloating(me) ? ' Un bureau volant est réservé automatiquement les autres jours.' : ''}</p>
    </section>`;
  }
  const mine = S().days.filter(d => d.userId === me.id).sort((a, b) => b.date.localeCompare(a.date));
  const future = mine.filter(d => d.date >= t).reverse(), past = mine.filter(d => d.date < t).slice(0, 15);
  const row = d => `<tr><td><button class="link" data-act="open-day" data-date="${d.date}">${D.fmtMed(d.date)}</button></td><td>${badge(d.status)}</td><td>${fmtDateTime(d.createdAt)}</td><td>${noticeTag(d)}</td>
    <td>${d.refusal ? `${esc(d.refusal.reason)}${d.refusal.detail ? ` – ${esc(d.refusal.detail)}` : ''}` : ''}</td></tr>`;
  const table = rows => rows.length ? `<div class="table-scroll"><table class="data"><thead><tr><th>Date</th><th>Statut</th><th>Posé le</th><th>Délai</th><th>Refus</th></tr></thead><tbody>${rows.map(row).join('')}</tbody></table></div>` : '<p class="muted">Aucun.</p>';

  return `<div class="page-head"><div><h1>Mon compte</h1><p class="muted">${esc(me.title)} · ${esc(me.email)}</p></div></div>
    <div class="cal-layout">
      <div class="main-col">${typical}
        ${Rules.isEligible(me) ? `<section class="card"><h2>Jours à venir</h2>${table(future)}</section>
        <section class="card"><h2>Derniers jours passés</h2>${table(past)}</section>` : '<section class="card"><h2>Télétravail</h2><p class="muted">Votre régime ne prévoit pas de télétravail. Vous pouvez néanmoins consulter les présences de vos collègues.</p></section>'}
      </div>
      <aside class="side">${Views.regimeCard(me)}</aside>
    </div>`;
};

Changes.tw = el => {
  const me = App.me(), w = +el.dataset.wd;
  me.typicalWeek = el.checked ? [...new Set([...me.typicalWeek, w])].sort() : me.typicalWeek.filter(x => x !== w);
  Store.save();
};
Changes['pref-desk'] = el => { App.me().preferredDesk = el.value || null; Store.save(); toast('Bureau préféré enregistré.', 'ok'); };

Actions['apply-week'] = () => {
  const me = App.me(), weeks = +document.getElementById('tw-weeks').value;
  const start = D.nextBusiness(D.today()), end = D.add(D.monday(start), weeks * 7 - 1);
  const done = [], skipped = [], booked = [];
  D.businessDays(start, end).forEach(d => {
    if (me.typicalWeek.includes(D.dow(d))) {
      if (Rules.dayRecord(me.id, d)) return;
      if (Rules.isLate(me, d)) { skipped.push([d, 'hors délai de prévenance']); return; }
      const res = Rules.declare(me, d, {});
      if (res.ok) done.push(d); else skipped.push([d, res.errors[0]]);
    } else if (Rules.isFloating(me) && !Rules.dayRecord(me.id, d) && !Rules.userBooking(me.id, d)) {
      const order = [me.preferredDesk, ...Rules.floatingDesks().map(x => x.id)].filter(Boolean);
      const desk = order.find(id => !Rules.deskBooking(id, d));
      if (desk && Rules.book(me, d, desk).ok) booked.push([d, desk]);
    }
  });
  commit();
  Modal.open('Semaine type appliquée', () => `
    <p><strong>${plural(done.length, 'jour')} de télétravail déclaré${done.length > 1 ? 's' : ''}</strong>${done.length ? ` : ${done.map(D.fmtMed).join(', ')}` : ''}</p>
    ${booked.length ? `<p><strong>${plural(booked.length, 'bureau')} réservé${booked.length > 1 ? 's' : ''}</strong> : ${booked.map(([d, k]) => `${D.fmtMed(d)} (${k})`).join(', ')}</p>` : ''}
    ${skipped.length ? `<h3>Jours non déclarés</h3><ul class="plain">${skipped.map(([d, r]) => `<li>${D.fmtMed(d)} – ${esc(r)}</li>`).join('')}</ul>` : ''}
    <div class="modal-actions"><button class="btn primary" data-act="modal-close">Fermer</button></div>`);
};

/* ---------- Documents ---------- */
const DOCUMENTS = [
  { id: 'sec', title: 'Politique de sécurité à distance', audience: 'Tous', for: () => true, desc: 'Règles de connexion, VPN, confidentialité des dossiers et matériel.' },
  { id: 'plan', title: 'Plan des locaux', audience: 'Tous', for: () => true, desc: 'Bureaux attitrés, bureaux volants et espaces communs.' },
  { id: 'charte', title: 'Charte télétravail', audience: 'Salariés', for: u => u.role === 'salarie', desc: 'Charte applicable aux salariés du cabinet.' },
  { id: 'poltt', title: 'Politique télétravail des avocats', audience: 'Avocats', for: u => u.role !== 'salarie', desc: 'Principes applicables aux avocats collaborateurs.' },
];

Views.documents = function () {
  const me = App.me(), isP = me.role === 'associe';
  const shared = DOCUMENTS.filter(d => isP || d.for(me));
  const personal = [];
  if (me.role === 'salarie' && Rules.isEligible(me)) personal.push({ id: 'bulletin', title: "Bulletin d'adhésion au télétravail", desc: `Signé le ${D.fmtShort(`${D.today().slice(0, 4)}-01-0${2 + (me.id.charCodeAt(1) % 7)}`)}` });
  if (Rules.isEligible(me) && me.role !== 'associe') personal.push({ id: 'justif', title: "Justificatif d'adhésion au télétravail", desc: Rules.regimeLabel(me) });
  const card = (d, aud) => `<button class="doc" data-act="open-doc" data-id="${d.id}">${ICONS.doc}<span><strong>${esc(d.title)}</strong><small>${esc(d.desc)}</small></span>${aud ? `<span class="tag">${aud}</span>` : ''}</button>`;
  return `<div class="page-head"><div><h1>Documents</h1><p class="muted">Documents partagés selon votre catégorie et documents individuels.</p></div></div>
    <section class="card"><h2>Documents partagés</h2><div class="doc-grid">${shared.map(d => card(d, d.audience)).join('')}</div></section>
    <section class="card"><h2>Mes documents</h2>${personal.length ? `<div class="doc-grid">${personal.map(d => card(d)).join('')}</div>` : '<p class="muted">Aucun document individuel.</p>'}</section>`;
};
Actions['open-doc'] = el => {
  const d = DOCUMENTS.find(x => x.id === el.dataset.id) || { title: el.querySelector('strong').textContent, desc: '' };
  Modal.open(esc(d.title), () => `<div class="doc-preview"><p class="muted">Document fictif – dans la version cible, le fichier PDF est stocké par l'application Symfony et servi selon les droits de l'utilisateur.</p>
    <h3>${esc(d.title)}</h3><p>${esc(d.desc)}</p><p class="lorem">Article 1 – Objet. Le présent document précise les modalités applicables au sein du cabinet…</p></div>
    <div class="modal-actions"><button class="btn primary" data-act="modal-close">Fermer</button></div>`);
};

/* ---------- Notifications ---------- */
Views.notifications = function () {
  const me = App.me();
  const list = S().notifications.filter(n => n.userId === me.id).sort((a, b) => b.at.localeCompare(a.at));
  return `<div class="page-head"><div><h1>Notifications</h1></div>
      ${list.some(n => !n.read) ? '<button class="btn ghost sm" data-act="read-all">Tout marquer comme lu</button>' : ''}</div>
    <section class="card">${list.length ? `<ul class="notifs">${list.map(n => `<li class="${n.read ? '' : 'unread'} ${n.kind}" data-act="read-notif" data-id="${n.id}">
      <span class="n-dot" aria-hidden="true"></span><span class="n-txt">${esc(n.text)}</span><time>${fmtDateTime(n.at)}</time></li>`).join('')}</ul>` : '<p class="muted">Aucune notification.</p>'}</section>`;
};
Actions['read-all'] = () => { S().notifications.forEach(n => { if (n.userId === App.me().id) n.read = true; }); commit(); };
Actions['read-notif'] = el => { const n = S().notifications.find(x => x.id === el.dataset.id); if (n && !n.read) { n.read = true; commit(); } };
