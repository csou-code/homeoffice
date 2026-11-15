/* Utilitaires de dates – toutes les dates métier sont des chaînes 'YYYY-MM-DD' en heure locale. */
const D = (() => {
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => iso(new Date());
  const add = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const diff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5); // b - a, en jours
  const dow = s => parse(s).getDay(); // 0 = dimanche

  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return iso(new Date(y, month - 1, day));
  }
  const cache = {};
  function holidays(y) {
    if (cache[y]) return cache[y];
    const e = easter(y);
    return (cache[y] = {
      [`${y}-01-01`]: "Jour de l'an", [add(e, 1)]: 'Lundi de Pâques', [`${y}-05-01`]: 'Fête du travail',
      [`${y}-05-08`]: 'Victoire 1945', [add(e, 39)]: 'Ascension', [add(e, 50)]: 'Lundi de Pentecôte',
      [`${y}-07-14`]: 'Fête nationale', [`${y}-08-15`]: 'Assomption', [`${y}-11-01`]: 'Toussaint',
      [`${y}-11-11`]: 'Armistice 1918', [`${y}-12-25`]: 'Noël',
    });
  }
  const holiday = s => holidays(+s.slice(0, 4))[s] || null;
  const isWeekend = s => { const w = dow(s); return w === 0 || w === 6; };
  const isBusiness = s => !isWeekend(s) && !holiday(s);
  function addBusiness(s, n) {
    const step = n < 0 ? -1 : 1; let c = Math.abs(n); let d = s;
    while (c > 0) { d = add(d, step); if (isBusiness(d)) c--; }
    return d;
  }
  const nextBusiness = s => addBusiness(s, 1);
  const prevBusiness = s => addBusiness(s, -1);
  const monday = s => add(s, -((dow(s) + 6) % 7));
  const range = (a, b) => { const r = []; for (let d = a; d <= b; d = add(d, 1)) r.push(d); return r; };
  const businessDays = (a, b) => range(a, b).filter(isBusiness);
  const fmtLong = s => parse(s).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtMed = s => parse(s).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtShort = s => parse(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const monthLabel = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); };
  const addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return iso(d).slice(0, 7); };
  const WD = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const WD_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  return { pad, iso, parse, today, add, diff, dow, holiday, isWeekend, isBusiness, addBusiness, nextBusiness,
    prevBusiness, monday, range, businessDays, fmtLong, fmtMed, fmtShort, monthLabel, addMonths, WD, WD_SHORT };
})();
