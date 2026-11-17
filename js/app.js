/* Point d'entrée : état de navigation et routage par ancre (#calendar, #admin/users…). */
const App = {
  route: 'calendar', sub: null,
  calMonth: null, planDate: null, teamWeek: null, teamFilter: 'all', reqScope: 'team', report: null, planFind: null,
  calView: 'month', calWeekends: false, calWeek: null, selMode: false, selDays: [],
  dayForm: { special: false, reason: '', detail: '', lateReason: '' },

  me() { return S() && S().currentUserId ? userById(S().currentUserId) : null; },

  init() {
    Store.load();
    const t = D.today();
    this.calMonth = t.slice(0, 7);
    this.calWeek = D.monday(t);
    CalPrefs.load();
    this.planDate = D.isBusiness(t) ? t : D.nextBusiness(t);
    this.teamWeek = D.monday(this.planDate);
    window.addEventListener('hashchange', () => this.onHash());
    this.onHash();
  },

  onHash() {
    const [r, sub] = (location.hash.slice(1) || 'calendar').split('/');
    if (r !== this.route) { this.selMode = false; this.selDays = []; }
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
