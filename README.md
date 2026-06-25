# SpendSmart

Personal finance tracker — Flask backend + vanilla JS frontend, all in one repo.
Flask serves both the HTML frontend and the REST API from the same server.

## Repo Structure

```
SpendSmart/
├── app.py              ← Flask app (API + serves frontend)
├── init_db.py          ← Run once to create DB
├── requirements.txt
├── Procfile            ← For Render
├── render.yaml         ← One-click Render config
├── .gitignore
├── static/
│   ├── style.css
│   └── app.js
└── templates/
    └── index.html
```

## Run Locally

```bash
# 1. Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create the database (only needed once)
python init_db.py

# 4. Start the server
python app.py
```

Open `http://localhost:5000` in your browser. Register an account and start tracking.

## Deploy to Render (free)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New + → Web Service**
3. Connect your GitHub repo
4. Render auto-detects the settings from `render.yaml`
5. Click **Deploy**

Your app will be live at `https://spendsmart-xxxx.onrender.com` in about 2 minutes.

> **Note:** Render's free tier has an ephemeral filesystem — the SQLite database
> resets on every redeploy. Your data survives server restarts but not new deployments.
> For persistent data, add a free PostgreSQL database on Render and update the
> connection in `app.py` (swap `sqlite3` for `psycopg2`).

## API Endpoints

All `/api/*` routes require `Authorization: Bearer <token>` except register, login, and health.

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login → returns JWT |
| GET | `/api/expenses` | List expenses |
| POST | `/api/expenses` | Add expense |
| PUT | `/api/expenses/:id` | Update expense |
| DELETE | `/api/expenses/:id` | Delete expense |
| GET | `/api/income` | List income |
| POST | `/api/income` | Add income |
| PUT | `/api/income/:id` | Update income |
| DELETE | `/api/income/:id` | Delete income |
| GET | `/api/goals` | List goals |
| POST | `/api/goals` | Add goal |
| PUT | `/api/goals/:id` | Update goal |
| POST | `/api/goals/:id/add` | Add amount to goal |
| DELETE | `/api/goals/:id` | Delete goal |
| GET | `/api/summary?period=month` | Dashboard stats |

## Tech Stack

- **Backend:** Python 3, Flask, SQLite, PyJWT, bcrypt, gunicorn
- **Frontend:** Vanilla JS (ES6+), Chart.js 4.4, Font Awesome 6.5, Inter font
- **Auth:** JWT tokens (48h expiry), bcrypt password hashing
- **Deploy:** Render (one repo, one service, free tier)
