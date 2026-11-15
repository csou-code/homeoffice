/* Socle d'interface : modale, toasts, info-bulles, délégation d'événements, coquille de l'application. */

const Actions = {}, Changes = {}, Inputs = {}, Submits = {};
const Views = {};

const ICONS = {
  bell: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z"/></svg>',
  chevL: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z"/></svg>',
  chevR: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6z"/></svg>',
  doc: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V9h5.5L13 3.5ZM8 13h8v1.5H8V13Zm0 3.5h8V18H8v-1.5Z"/></svg>',
};

const avatar = u => `<span class="avatar" aria-hidden="true">${esc(u.firstName[0] + u.lastName[0])}</span>`;
const badge = st => `<span class="badge ${STATUS[st].cls}">${STATUS[st].label}</span>`;
const plural = (n, w) => `${n} ${n > 1 ? (/(au|eu)$/.test(w) ? w + 'x' : w + 's') : w}`;
const fmtDateTime = s => new Date(s).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function noticeTag(rec) {
  if (rec.special) return `<span class="tag special" title="${esc(rec.special.detail)}">Circonstances particulières : ${esc(rec.special.reason)}</span>`;
  if (rec.late) return `<span class="tag late" title="${esc(rec.lateReason)}">Hors délai${rec.lateReason ? ` : ${esc(rec.lateReason)}` : ''}</span>`;
  return '<span class="tag">Dans les délais</span>';
}

const Modal = {
  current: null,
  open(title, render, opts = {}) { this.current = { title, render, wide: opts.wide }; this.draw(); },
  draw() {
    const c = this.current, root = document.getElementById('modal-root');
    if (!c) { root.innerHTML = ''; document.body.classList.remove('modal-open'); return; }
    root.innerHTML = `<div class="modal-backdrop" data-act="modal-bg"><div class="modal ${c.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(c.title)}">
      <header class="modal-head"><h2>${c.title}</h2><button class="icon-btn" data-act="modal-close" aria-label="Fermer">×</button></header>
      <div class="modal-body">${c.render()}</div></div></div>`;
    document.body.classList.add('modal-open');
  },
  close() { this.current = null; this.draw(); },
};

function toast(msg, type = 'info') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast ${type}`; el.textContent = msg; el.setAttribute('role', 'status');
  root.appendChild(el);
  setTimeout(() => el.classList.add('out'), 3800);
  setTimeout(() => el.remove(), 4300);
}

/* Enregistre puis redessine la vue et la modale ouverte */
function commit() { Store.save(); App.render(); if (Modal.current) Modal.draw(); }

Actions['modal-close'] = () => Modal.close();
Actions['modal-bg'] = (el, e) => { if (e.target === el) Modal.close(); };
Actions.login = el => { S().currentUserId = el.dataset.id; Store.save(); location.hash = '#calendar'; App.render(); };
Actions.logout = () => { S().currentUserId = null; Store.save(); Modal.close(); App.render(); };
Actions.reset = () => {
  if (!confirm('Réinitialiser toutes les données de démonstration ?')) return;
  Store.reset(); Modal.close(); App.render(); toast('Données de démonstration réinitialisées.', 'ok');
};

document.addEventListener('keydown', e => { if (e.key === 'Escape' && Modal.current) Modal.close(); });
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && Actions[el.dataset.act]) Actions[el.dataset.act](el, e);
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (el && Changes[el.dataset.change]) Changes[el.dataset.change](el, e);
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-input]');
  if (el && Inputs[el.dataset.input]) Inputs[el.dataset.input](el, e);
});
document.addEventListener('submit', e => {
  const f = e.target;
  if (f.dataset.submit && Submits[f.dataset.submit]) { e.preventDefault(); Submits[f.dataset.submit](f, new FormData(f)); }
});

/* Info-bulles des graphiques et du plan */
document.addEventListener('mousemove', e => {
  const tip = document.getElementById('tip');
  const el = e.target.closest && e.target.closest('[data-tip]');
  if (!el) { tip.hidden = true; return; }
  tip.textContent = el.dataset.tip; tip.hidden = false;
  const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
  tip.style.left = `${x}px`; tip.style.top = `${e.clientY + 16}px`;
});

/* ---------- Connexion (simulée) ---------- */
Views.login = function () {
  const groups = [
    ['Associés', u => u.role === 'associe'],
    ['Avocats collaborateurs', u => u.role === 'avocat'],
    ['Salariés', u => u.role === 'salarie'],
  ];
  return `<div class="login">
    <div class="login-card">
      <div class="brand big"><span class="logo">L</span><div><strong>LUSIS AVOCATS</strong><small>Télétravail &amp; bureaux</small></div></div>
      <h1>Connexion</h1>
      <div class="ms-btn" aria-hidden="true"><span class="ms-logo"><i></i><i></i><i></i><i></i></span>Se connecter avec Microsoft</div>
      <p class="muted">Preuve de concept : la connexion Microsoft (Entra ID) est simulée. Choisissez un compte de démonstration pour découvrir l'application selon chaque profil.</p>
      ${groups.map(([label, f]) => `<h3>${label}</h3><div class="account-grid">${S().users.filter(f).map(u => `
        <button class="account" data-act="login" data-id="${u.id}">${avatar(u)}<span><strong>${esc(fullName(u))}</strong><small>${esc(Rules.regimeLabel(u))}</small></span></button>`).join('')}</div>`).join('')}
    </div></div>`;
};

/* ---------- Coquille ---------- */
Views.shell = function (content) {
  const me = App.me();
  const unread = S().notifications.filter(n => n.userId === me.id && !n.read).length;
  const tabs = [['calendar', 'Mon calendrier'], ['plan', 'Plan & bureaux'], ['team', 'Équipe'], ['profile', 'Mon compte'], ['documents', 'Documents']];
  if (me.role === 'associe') tabs.push(['admin', 'Administration']);
  return `<header class="topbar">
    <div class="topbar-row">
      <a class="brand" href="#calendar"><span class="logo">L</span><div><strong>LUSIS AVOCATS</strong><small>Télétravail &amp; bureaux</small></div></a>
      <div class="top-actions">
        <a href="#notifications" class="icon-btn bell ${App.route === 'notifications' ? 'active' : ''}" aria-label="Notifications (${unread} non lues)">${ICONS.bell}${unread ? `<span class="dot">${unread > 99 ? '99+' : unread}</span>` : ''}</a>
        <div class="me">${avatar(me)}<div class="me-txt"><strong>${esc(fullName(me))}</strong><small>${esc(Rules.regimeLabel(me))}</small></div></div>
        <button class="btn ghost sm" data-act="logout">Changer de compte</button>
      </div>
    </div>
    <nav class="tabs" aria-label="Navigation principale">${tabs.map(([k, l]) => `<a href="#${k}" class="${App.route === k ? 'active' : ''}">${l}</a>`).join('')}</nav>
  </header>
  <div class="poc-banner">Preuve de concept – données fictives, enregistrées uniquement dans ce navigateur. <button class="link" data-act="reset">Réinitialiser la démo</button></div>
  <main class="container">${content}</main>`;
};
