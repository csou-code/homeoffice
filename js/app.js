/* Point d'entrée : état de navigation et routage par ancre (#calendar, #admin/users…). */
const App = {
  route: 'calendar', sub: null,
  calMonth: null, planDate: null, teamWeek: null, teamFilter: 'all', reqScope: 'team', report: null,
  dayForm: { special: false, reason: '', detail: '', lateReason: '' },

  me() { return S() && S().currentUserId ? userById(S().currentUserId) : null; },

  init() {
    Store.load();
    const t = D.today();
    this.calMonth = t.slice(0, 7);
    this.planDate = D.isBusiness(t) ? t : D.nextBusiness(t);
    this.teamWeek = D.monday(this.planDate);
    window.addEventListener('hashchange', () => this.onHash());
    this.onHash();
  },

  onHash() {
    const [r, sub] = (location.hash.slice(1) || 'calendar').split('/');
    this.route = r; this.sub = sub || null;
    if (Modal.current) Modal.close();
    this.render();
    window.scrollTo(0, 0);
  },

  render() {
    const root = document.getElementById('app');
    const me = this.me();
    if (!me) { root.innerHTML = Views.login(); document.title = 'Connexion – Télétravail'; return; }
    if (this.route === 'admin' && me.role !== 'associe') this.route = 'calendar';
    const views = ['calendar', 'plan', 'team', 'profile', 'documents', 'notifications', 'admin'];
    if (!views.includes(this.route)) this.route = 'calendar';
    root.innerHTML = Views.shell(Views[this.route]());
    document.title = 'Télétravail – LUSIS AVOCATS';
  },
};

App.init();
