  dash.calc('similarity', {
    title: 'Duplicate and similar tickets',
    description: 'For each ticket, the earlier ticket whose short description shares the most words; Duplicate when 70%+ alike and opened within 3 days, Similar when 30%+ alike.',
    inputs: ['incidents'],
    fn: (incidents) => {
      const stop = new Set(['a', 'an', 'the', 'to', 'on', 'in', 'for', 'of', 'is', 'not', 'with', 'from', 'when', 'since', 'after', 'all', 'every', 'few', 'my', 'and', 'at', 'by']);
      const words = (s) => new Set(String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !stop.has(w)).map((w) => w.replace(/(ing|s)$/, '')));
      const t = incidents.map((r) => ({ number: r.number, w: words(r.short_description), at: Date.parse(String(r.opened_at).replace(' ', 'T') + 'Z') })).sort((a, b) => a.at - b.at);
      return t.map((r, i) => {
        let best = null, score = 0;
        for (let j = i - 1; j >= 0; j--) {
          const shared = [...r.w].filter((w) => t[j].w.has(w)).length;
          const s = shared / (r.w.size + t[j].w.size - shared || 1);
          if (s > score) { best = t[j]; score = s; }
        }
        const days = best ? (r.at - best.at) / 864e5 : Infinity;
        const match = score >= 0.7 && days <= 3 ? 'Duplicate' : score >= 0.3 ? 'Similar' : '';
        return { number: r.number, match_type: match, reference_ticket: match ? best.number : '', similarity: match ? Math.round(score * 100) / 100 : null };
      });
    },
  });

  dash.calc('summary', {
    title: 'Ticket counts by status',
    description: 'All tickets, then New (state New), In Progress, Pending (On Hold) and Resolved (Resolved or Closed).',
    inputs: ['incidents'],
    fn: (incidents) => {
      const n = (states) => incidents.filter((r) => states.includes(r.state)).length;
      return [{ total: incidents.length, new: n(['New']), in_progress: n(['In Progress']), pending: n(['On Hold']), resolved: n(['Resolved', 'Closed']) }];
    },
  });

  dash.calc('weekly', {
    title: 'Tickets by status and week',
    description: 'Tickets grouped by week of the month they were opened (week 1 is days 1-7, week 2 days 8-14, and so on), counted as New (state New), In Progress, Pending (On Hold) or Resolved (Resolved or Closed).',
    inputs: ['incidents'],
    fn: (incidents) => {
      const weeks = {};
      for (const r of incidents) {
        const day = String(r.opened_at).slice(0, 10);
        const wk = Math.min(5, Math.ceil(Number(day.slice(8, 10)) / 7));
        const week = `${day.slice(0, 7)}-W${wk}`;
        const w = weeks[week] || (weeks[week] = { week, year: day.slice(0, 4), month: day.slice(5, 7), wk, new: 0, in_progress: 0, pending: 0, resolved: 0 });
        if (r.state === 'Resolved' || r.state === 'Closed') w.resolved++;
        else if (r.state === 'New') w.new++;
        else if (r.state === 'In Progress') w.in_progress++;
        else w.pending++;
      }
      return Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week));
    },
  });
