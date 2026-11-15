/* Persistance locale (localStorage) – remplacée par l'API Symfony dans la version cible. */
const STORAGE_KEY = 'homeoffice-poc';

const Store = {
  state: null,
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.version === SEED_VERSION) { this.state = s; return; }
      }
    } catch (e) { /* stockage indisponible : on repart des données de démo */ }
    this.state = buildSeed();
    this.save();
  },
  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch (e) { /* ignoré */ }
  },
  reset() {
    const current = this.state && this.state.currentUserId;
    this.state = buildSeed();
    this.state.currentUserId = current;
    this.save();
  },
};

const S = () => Store.state;
const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const userById = id => S().users.find(u => u.id === id);
const fullName = u => (u ? `${u.firstName} ${u.lastName}` : '—');
const shortName = u => (u ? `${u.firstName} ${u.lastName[0]}.` : '—');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
