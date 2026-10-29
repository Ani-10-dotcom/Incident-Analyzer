// Stand-in for the hosted dashboard's data API, so the same page code runs from this one file.
// Data: ServiceNow incident export (dev460097), Oct 29, 2026.
(function () {
  const datasets = { incidents: window.IA_INCIDENTS || [] };
  const calcs = {};
  const cache = {};
  const listeners = [];
  let params = {};
  const columnsOf = (rows) => (rows.length ? Object.keys(rows[0]) : []);
  const data = (id) => {
    if (id in datasets) return { status: 'ok', data: datasets[id], rows: datasets[id], columns: columnsOf(datasets[id]), refreshing: false, meta: [] };
    if (id in calcs) {
      if (!(id in cache)) {
        try { cache[id] = { ok: true, v: calcs[id].fn(...calcs[id].inputs.map((i) => data(i).data)) }; }
        catch (e) { console.error(e); cache[id] = { ok: false }; }
      }
      const c = cache[id];
      return c.ok ? { status: 'ok', data: c.v, rows: c.v, columns: Array.isArray(c.v) ? columnsOf(c.v) : [], refreshing: false, meta: [] } : { status: 'error', data: [], message: 'Calculation failed' };
    }
    return { status: 'missing', data: [] };
  };
  const run = () => listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  let lastWidth = 0;
  window.addEventListener('resize', () => { const w = document.documentElement.clientWidth; if (w !== lastWidth) { lastWidth = w; run(); } });
  window.dash = {
    data,
    calc: (id, spec) => { calcs[id] = spec; },
    loader: () => {},
    onData: (fn) => { listeners.push(fn); fn(); },
    params: () => ({ ...params }),
    setParams: (o) => { for (const [k, v] of Object.entries(o)) { if (v === null || v === undefined) delete params[k]; else params[k] = v; } run(); },
    resetParams: () => { params = {}; run(); },
    setLink: (name) => { history.replaceState(null, '', '#' + name); },
    refresh: () => {},
    colors: ['#6b5bd6', '#2f7fd8', '#b0459a', '#e08a1e', '#23a06b', '#c8423a', '#3a9fa6', '#8a7a5c'],
  };
})();
