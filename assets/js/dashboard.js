  const root = document.querySelector('.ia');
  const fromEl = root.querySelector('.ia-from');
  const toEl = root.querySelector('.ia-to');
  const showEl = root.querySelector('.ia-show');
  const qEl = root.querySelector('.ia-q');
  const tbody = root.querySelector('.ia-tbody');
  const emptyEl = root.querySelector('.ia-empty');
  const fmtCount = d3.format(',');
  const prioRank = { P1: 1, P2: 2, P3: 3, P4: 4, P5: 5 };

  const setDate = (el, name) => { if (!el.value || el.validity.valid) dash.setParams({ [name]: el.value || null }); };
  fromEl.addEventListener('change', () => setDate(fromEl, 'from'));
  toEl.addEventListener('change', () => setDate(toEl, 'to'));
  fromEl.addEventListener('blur', () => { fromEl.value = dash.params().from ?? ''; });
  toEl.addEventListener('blur', () => { toEl.value = dash.params().to ?? ''; });
  showEl.addEventListener('change', () => dash.setParams({ show: showEl.value || null }));
  qEl.addEventListener('input', () => dash.setParams({ q: qEl.value || null }));
  root.querySelector('.ia-reset').addEventListener('click', () => { dash.resetParams(); dash.setParams({ from: null, to: null, show: null, q: null }); });

  // Tabs
  const tabs = [...root.querySelectorAll('.ia-tab')];
  const showPage = (id) => {
    for (const t of tabs) {
      const on = t.dataset.page === id;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      document.getElementById(t.dataset.page).hidden = !on;
    }
    dash.setLink(id);
    if (id === 'status') window.iaDrawChart && window.iaDrawChart();
  };
  for (const t of tabs) t.addEventListener('click', () => showPage(t.dataset.page));

  const failLine = (el) => { const d = document.createElement('div'); d.className = 'ia-fail'; d.textContent = 'Failed to load'; el.replaceChildren(d); };
  const td = (text, cls) => { const c = document.createElement('td'); if (cls) c.className = cls; c.textContent = text ?? ''; return c; };
  const chip = (text, cls) => { const c = document.createElement('td'); c.className = 'nowrap'; if (text) { const s = document.createElement('span'); s.className = 'ia-chip ' + cls; s.textContent = text; c.append(s); } return c; };

  const numCell = (n) => { const c = td('', 'nowrap'); const b = document.createElement('button'); b.type = 'button'; b.className = 'ia-open'; b.textContent = n; b.title = 'Open ticket ' + n; c.append(b); return c; };

  // Clicking a ticket number opens its details; clicking a reference ticket jumps to it in the table
  tbody.addEventListener('click', (e) => {
    const open = e.target.closest('.ia-open');
    if (open) { window.iaOpenTicket(open.textContent); return; }
    const row0 = e.target.closest('tr[data-key]');
    if (row0 && !e.target.closest('button, a') && !getSelection().toString()) { window.iaOpenTicket(row0.dataset.key); return; }
    const b = e.target.closest('.ia-ref');
    if (!b) return;
    let row = tbody.querySelector(`tr[data-key="${CSS.escape(b.textContent)}"]`);
    if (!row) { dash.setParams({ from: null, to: null, show: null, q: null }); return; }
    row.scrollIntoView({ block: 'center' });
    row.classList.add('flash');
    setTimeout(() => row.classList.remove('flash'), 1600);
  });

  const statusGroup = (st) => (st === 'Resolved' || st === 'Closed' ? 'Resolved' : st === 'New' ? 'New' : st === 'In Progress' ? 'In Progress' : 'Pending');
  const inRange = (day, p) => (!p.from || day >= p.from) && (!p.to || day <= p.to);

  function drawTable() {
    const inc = dash.data('incidents');
    const sim = dash.data('similarity');
    const p = dash.params();
    if (fromEl !== document.activeElement) fromEl.value = p.from ?? '';
    if (toEl !== document.activeElement) toEl.value = p.to ?? '';
    showEl.value = p.show ?? '';
    if (qEl !== document.activeElement) qEl.value = p.q ?? '';
    tbody.replaceChildren();
    if (inc.status === 'error') { emptyEl.textContent = 'Failed to load'; emptyEl.hidden = false; return; }
    emptyEl.textContent = 'No tickets match these filters.';
    if (inc.status !== 'ok') { emptyEl.hidden = true; return; }
    const matchBy = new Map((sim.status === 'ok' ? sim.data : []).map((r) => [r.number, r]));
    const q = (p.q || '').toLowerCase();
    const rows = inc.data
      .filter((r) => inRange(String(r.opened_at).slice(0, 10), p))
      .filter((r) => !p.show || statusGroup(r.state) === p.show)
      .filter((r) => !q || [r.number, r.short_description, r.assignment_group, r.category, matchBy.get(r.number)?.reference_ticket].some((v) => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => (prioRank[a.priority] || 9) - (prioRank[b.priority] || 9) || String(b.opened_at).localeCompare(String(a.opened_at)));
    tbody.replaceChildren(...rows.map((r) => {
      const m = matchBy.get(r.number) || {};
      const tr = document.createElement('tr');
      tr.dataset.key = r.number;
      const refCell = td('', 'nowrap');
      if (m.reference_ticket) { const b = document.createElement('button'); b.type = 'button'; b.className = 'ia-ref'; b.textContent = m.reference_ticket; refCell.append(b); }
      const st = { Resolved: 'ok', New: 'new', 'In Progress': 'prog', Pending: 'pend' }[statusGroup(r.state)];
      tr.append(
        numCell(r.number),
        chip(r.priority, String(r.priority).toLowerCase()),
        td(r.short_description),
        chip(r.state, st),
        td(r.opened_at, 'nowrap'),
        chip(m.match_type || '', m.match_type === 'Duplicate' ? 'dup' : 'sim'),
        refCell,
        td(r.category, 'ia-hide-narrow'),
        td(r.assignment_group, 'ia-hide-narrow'),
      );
      return tr;
    }));
    emptyEl.hidden = rows.length > 0;
  }

  function drawSummary() {
    const s = dash.data('summary');
    root.querySelectorAll('[data-source="summary"]').forEach((el) => {
      if (s.status === 'ok' && s.data[0]) { el.classList.remove('dash-skeleton'); el.textContent = fmtCount(s.data[0][el.dataset.field]); }
      else if (s.status === 'error') { el.classList.remove('dash-skeleton'); el.textContent = '—'; }
      else el.textContent = '—';
    });
  }

  const chartEl = document.getElementById('status-chart');
  const legend = document.getElementById('status-legend');
  const series = [
    { key: 'resolved', name: 'Resolved', color: 'var(--ia-res)' },
    { key: 'pending', name: 'Pending', color: 'var(--ia-pend)' },
    { key: 'in_progress', name: 'In Progress', color: 'var(--ia-prog)' },
    { key: 'new', name: 'New', color: 'var(--ia-new)' },
  ];
  legend.querySelector('.sw-res').style.background = series[0].color;
  legend.querySelector('.sw-pend').style.background = series[1].color;
  legend.querySelector('.sw-prog').style.background = series[2].color;
  legend.querySelector('.sw-new').style.background = series[3].color;

  const yearEl = document.getElementById('ia-year');
  const monthEl = document.getElementById('ia-month');
  const wkEl = document.getElementById('ia-wk');
  const monthName = (m) => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(m) - 1];
  yearEl.addEventListener('change', () => dash.setParams({ year: yearEl.value || null, month: null }));
  monthEl.addEventListener('change', () => dash.setParams({ month: monthEl.value || null }));
  wkEl.addEventListener('change', () => dash.setParams({ wk: wkEl.value || null }));

  // Export buttons download the weeks the chart shows, so they follow Year, Month and Week:
  // tickets = one row per ticket opened in those weeks, weekly = one row per week with counts.
  const exportBtns = [...root.querySelectorAll('.ia-export')];
  let shownWeeks = null;
  const csvCell = (v) => (/[",\r\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
  const lastDayOf = (d) => (d.wk < 5 ? d.wk * 7 : new Date(Date.UTC(Number(d.year), Number(d.month), 0)).getUTCDate());
  const iso = (d, day) => `${d.year}-${d.month}-${String(day).padStart(2, '0')}`;
  const weekCols = (d) => [d.year, monthName(d.month), `Week ${d.wk}`, iso(d, d.wk * 7 - 6), iso(d, lastDayOf(d))];
  const download = (name, rows) => {
    const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  exportBtns.forEach((btn) => btn.addEventListener('click', () => {
    if (!shownWeeks || !shownWeeks.rows.length) return;
    const kind = btn.dataset.export;
    const name = [kind === 'tickets' ? 'tickets' : 'weekly-status', shownWeeks.year, shownWeeks.month && monthName(shownWeeks.month).toLowerCase(), shownWeeks.wk && 'week-' + shownWeeks.wk].filter(Boolean).join('-') + '.csv';
    if (kind === 'weekly') {
      download(name, [['Year', 'Month', 'Week', 'From', 'To', 'New', 'In Progress', 'Pending', 'Resolved', 'Total']]
        .concat(shownWeeks.rows.map((d) => [...weekCols(d), d.new, d.in_progress, d.pending, d.resolved, d.new + d.in_progress + d.pending + d.resolved])));
      return;
    }
    const weeks = new Map(shownWeeks.rows.map((d) => [d.week, d]));
    const weekOf = (r) => { const day = String(r.opened_at).slice(0, 10); return `${day.slice(0, 7)}-W${Math.min(5, Math.ceil(Number(day.slice(8, 10)) / 7))}`; };
    const tickets = (dash.data('incidents').data || [])
      .filter((r) => weeks.has(weekOf(r)))
      .sort((x, y) => String(x.opened_at).localeCompare(String(y.opened_at)));
    download(name, [['Year', 'Month', 'Week', 'Week from', 'Week to', 'Number', 'Short description', 'Priority', 'Status', 'State', 'Category', 'Assignment group', 'Opened']]
      .concat(tickets.map((r) => [...weekCols(weeks.get(weekOf(r))), r.number, String(r.short_description).trim(), r.priority, statusGroup(r.state), r.state, r.category, r.assignment_group, r.opened_at])));
  }));

  window.iaDrawChart = function drawChart() {
    if (document.getElementById('status').hidden) return;
    const w = dash.data('weekly');
    if (w.status === 'error') { failLine(chartEl); return; }
    if (w.status !== 'ok') { chartEl.replaceChildren(); return; }
    const p = dash.params();
    const years = [...new Set(w.data.map((r) => r.year))].sort().reverse();
    const year = years.includes(p.year) ? p.year : years[0];
    yearEl.replaceChildren(...years.map((y) => new Option(y, y)));
    yearEl.value = year || '';
    // every week from the year's first month with tickets to its last, empty weeks shown as zero
    const inYear = w.data.filter((r) => r.year === year);
    const byWeek = new Map(inYear.map((r) => [r.week, r]));
    const first = Number(d3.min(inYear, (r) => r.month) || 1), last = Number(d3.max(inYear, (r) => r.month) || 12);
    const months = d3.range(first, last + 1).map((m) => String(m).padStart(2, '0'));
    monthEl.replaceChildren(new Option('All months', ''), ...months.map((m) => new Option(monthName(m), m)));
    monthEl.value = months.includes(p.month) ? p.month : '';
    wkEl.value = p.wk ? String(p.wk) : '';
    const data = months.filter((m) => !monthEl.value || m === monthEl.value)
      .flatMap((m) => [1, 2, 3, 4, 5].map((wk) => byWeek.get(`${year}-${m}-W${wk}`) || { week: `${year}-${m}-W${wk}`, year, month: m, wk, new: 0, in_progress: 0, pending: 0, resolved: 0 }))
      .filter((r) => !wkEl.value || String(r.wk) === wkEl.value);
    shownWeeks = { year, month: monthEl.value, wk: wkEl.value, rows: data };
    exportBtns.forEach((b) => { b.disabled = !data.length; });
    chartEl.replaceChildren();
    if (!data.length) { const n = document.createElement('div'); n.className = 'ia-empty'; n.textContent = 'No tickets were opened in this week.'; chartEl.append(n); return; }
    const width = chartEl.clientWidth || 600, height = 320;
    const fmtWeek = (d) => `${monthName(d.month).slice(0, 3)} wk ${d.wk}`;
    const lastDay = (d) => (d.wk < 5 ? d.wk * 7 : new Date(Date.UTC(Number(d.year), Number(d.month), 0)).getUTCDate());
    const fmtSpan = (d) => `${monthName(d.month)} ${d.year}, week ${d.wk} (${monthName(d.month).slice(0, 3)} ${d.wk * 7 - 6} to ${lastDay(d)})`;
    const svg = d3.select(chartEl).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'New, in progress, pending and resolved tickets by week');
    const max = d3.max(data, (d) => d.new + d.in_progress + d.pending + d.resolved) || 1;
    const y = d3.scaleLinear([0, max], [height - 28, 12]).nice();
    const ticks = y.ticks(5).filter(Number.isInteger);
    const probe = svg.append('text').style('font-size', 'var(--cds-font-size-caption)').text(fmtCount(d3.max(ticks)));
    const left = Math.ceil(probe.node().getComputedTextLength()) + 10;
    probe.remove();
    const x = d3.scaleBand(data.map((d) => d.week), [left, width - 4]).padding(0.3);
    svg.append('g').selectAll('line').data(ticks).join('line')
      .attr('x1', left).attr('x2', width - 4).attr('y1', (d) => y(d)).attr('y2', (d) => y(d))
      .style('stroke', 'var(--cds-chart-grid)').attr('stroke-width', 1);
    svg.append('g').selectAll('text').data(ticks).join('text')
      .attr('x', left - 8).attr('y', (d) => y(d)).attr('dy', '0.32em').attr('text-anchor', 'end')
      .style('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)').text(fmtCount);
    const every = Math.max(1, Math.ceil(64 / x.step()));
    svg.append('g').selectAll('text').data(data.filter((d, i) => i % every === 0)).join('text')
      .attr('x', (d) => x(d.week) + x.bandwidth() / 2).attr('y', height - 8).attr('text-anchor', 'middle')
      .style('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)').text(fmtWeek);
    svg.append('line').attr('x1', left).attr('x2', width - 4).attr('y1', y(0)).attr('y2', y(0)).style('stroke', 'var(--cds-chart-axis)');
    const bw = Math.min(32, x.bandwidth());
    const off = (x.bandwidth() - bw) / 2;
    const g = svg.append('g').selectAll('g').data(data).join('g');
    series.forEach((sr, i) => {
      const below = (d) => series.slice(0, i).reduce((t, o) => t + d[o.key], 0);
      g.append('rect').attr('x', (d) => x(d.week) + off).attr('width', bw)
        .attr('y', (d) => y(below(d) + d[sr.key])).attr('height', (d) => y(below(d)) - y(below(d) + d[sr.key])).style('fill', sr.color);
    });
    const tip = document.createElement('div'); tip.className = 'ia-tip'; tip.hidden = true; chartEl.append(tip);
    g.append('rect').attr('x', (d) => x(d.week)).attr('width', x.bandwidth()).attr('y', 0).attr('height', height).attr('fill', 'transparent')
      .on('mousemove', (event, d) => {
        g.attr('opacity', (o) => (o === d ? 1 : 0.55));
        const line = (color, name, v) => { const r = document.createElement('div'); const sw = document.createElement('span'); sw.style.cssText = `display:inline-block;width:.6rem;height:.6rem;border-radius:2px;margin-right:.35rem;background:${color}`; r.append(sw, `${name}: ${fmtCount(v)}`); return r; };
        const head = document.createElement('div'); head.className = 'd'; head.textContent = fmtSpan(d);
        tip.replaceChildren(head, ...[...series].reverse().map((sr) => line(sr.color, sr.name, d[sr.key])));
        tip.hidden = false;
        const [mx] = d3.pointer(event, chartEl);
        const tw = tip.offsetWidth;
        tip.style.left = Math.max(0, Math.min(chartEl.clientWidth - tw, mx + 12)) + 'px';
        tip.style.top = '8px';
      })
      .on('mouseleave', () => { tip.hidden = true; g.attr('opacity', 1); });
  };

  dash.onData(() => {
    drawSummary();
    drawTable();
    window.iaDrawChart();
  });

  const named = location.hash.slice(1);
  if (named === 'status' || named === 'tickets') showPage(named);

  // Links from the Known issues page open the dashboard searched to one ticket (?q=INC…).
  const linkedQ = new URLSearchParams(location.search).get('q');
  if (linkedQ) dash.setParams({ q: linkedQ });
