# AI Incident Analyzer

A static website that lists ServiceNow incidents by priority, flags duplicate and similar tickets, charts ticket status by week, and holds known-issue resolution articles.

- **Dashboard** (`/`): summary tiles, the Tickets table with filters and Duplicate / Similar matching, and the Status of tickets weekly chart.
- **Known issues** (`/known-issues`): 16 resolution articles written from the export; every ticket is listed under one article.
- **How it works** (`/about`): data model, priority and status mapping, matching rules and how to refresh the data.

Data is a CSV export of 67 incidents from the ServiceNow developer instance dev460097 (Oct 29, 2026). Caller and assignee names are left out.

## Layout

```
index.html, known-issues.html, about.html
assets/css/   tokens.css (theme + site shell), dashboard.css, kb.css, about.css
assets/js/    d3.v7.9.0.min.js, dash-runtime.js (data API), calcs.js, dashboard.js, kb.js
data/         incidents.js (loaded by the pages), incidents.json, known_issues.json
docs/known-issues/   the articles as Markdown
vercel.json   clean URLs
```

## Run locally

No build step. Serve the folder with any static server, for example:

```
python3 -m http.server 8000
```

then open http://localhost:8000. (Clean URLs like `/about` work on Vercel; locally use `/about.html`.)

## Deploy

Vercel serves the repository root as a static site. Pushing to `main` redeploys.
