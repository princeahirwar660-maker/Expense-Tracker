# SpendSmart – Static Finance Tracker

A fully client-side personal finance tracker. No server, no backend, no database — runs entirely in your browser using `localStorage`.

## Live Demo
Deploy on GitHub Pages and share the link.

## Features
- **Dashboard** — Income vs expenses, spending trend chart, category donut chart, recent transactions
- **Expenses** — Add, edit, delete, search, filter by category, sort, paginate
- **Income** — Add, edit, delete, search, sort, paginate
- **Goals** — Set savings targets, track progress, add funds
- **Analytics** — Pie chart, 6-month bar chart, category breakdown table
- **Report** — Date-range income/expense report with print/export

## How to Deploy on GitHub Pages

1. Create a new GitHub repo
2. Upload `index.html`, `style.css`, `app.js`
3. Go to repo **Settings → Pages → Source → main branch → / (root)**
4. Click Save — your app is live at `https://<username>.github.io/<repo-name>`

## Local Development

Just open `index.html` in any browser. No build step, no npm, no Python needed.

## Data Storage

All data is saved in your browser's `localStorage`. It does **not** sync across devices or browsers. Clearing site data in your browser will erase it.

Demo data is automatically seeded when you register a new account.

## Tech Stack
- Vanilla HTML, CSS, JavaScript (ES6+)
- Chart.js 4.4 (CDN)
- Font Awesome 6.5 (CDN)
- Inter font (Google Fonts CDN)
