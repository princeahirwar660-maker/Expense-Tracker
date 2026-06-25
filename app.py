"""
SpendSmart – Flask + SQLite
Single repo: Flask serves the frontend AND the REST API.
"""
from flask import Flask, request, jsonify, g, render_template, send_from_directory
from flask_cors import CORS
import sqlite3, os, jwt, bcrypt, uuid
from datetime import datetime, timedelta
from functools import wraps

# ── CONFIG ───────────────────────────────────────
app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)   # allow requests from any origin (needed for local dev)

DB_PATH    = os.environ.get("DB_PATH", "spendsmart.db")
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")
JWT_EXPIRY = int(os.environ.get("JWT_EXPIRY_HOURS", 48))

# ── DATABASE ─────────────────────────────────────
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH, detect_types=sqlite3.PARSE_DECLTYPES)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db = g.pop("db", None)
    if db:
        db.close()

def init_db():
    db = sqlite3.connect(DB_PATH)
    db.execute("PRAGMA foreign_keys = ON")
    db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT    UNIQUE NOT NULL,
            password TEXT    NOT NULL,
            created  TEXT    DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS expenses (
            id          TEXT    PRIMARY KEY,
            user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            amount      REAL    NOT NULL,
            description TEXT    NOT NULL,
            category    TEXT    NOT NULL DEFAULT 'Other',
            date        TEXT    NOT NULL,
            created     TEXT    DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS income (
            id          TEXT    PRIMARY KEY,
            user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            amount      REAL    NOT NULL,
            description TEXT    NOT NULL,
            source      TEXT    NOT NULL DEFAULT 'Other',
            date        TEXT    NOT NULL,
            created     TEXT    DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS goals (
            id          TEXT    PRIMARY KEY,
            user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name        TEXT    NOT NULL,
            target      REAL    NOT NULL,
            saved       REAL    NOT NULL DEFAULT 0,
            start_date  TEXT,
            end_date    TEXT,
            created     TEXT    DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
        CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
        CREATE INDEX IF NOT EXISTS idx_income_user   ON income(user_id);
        CREATE INDEX IF NOT EXISTS idx_goals_user    ON goals(user_id);
    """)
    db.commit()
    db.close()

# ── AUTH HELPERS ─────────────────────────────────
def make_token(user_id, username):
    return jwt.encode(
        {"sub": user_id, "username": username,
         "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRY)},
        SECRET_KEY, algorithm="HS256"
    )

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "Missing token"}), 401
        try:
            payload = jwt.decode(auth.split(" ", 1)[1], SECRET_KEY, algorithms=["HS256"])
            g.user_id  = payload["sub"]
            g.username = payload["username"]
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired, please log in again"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated

def uid():           return str(uuid.uuid4())
def row_dict(row):   return dict(row) if row else None
def rows_list(rows): return [dict(r) for r in rows]

def valid_amount(val):
    try:
        v = float(val)
        if v <= 0: raise ValueError
        return v
    except (ValueError, TypeError):
        return None

# ── ERROR HANDLERS ────────────────────────────────
@app.errorhandler(404)
def not_found(e):   return jsonify({"error": "Not found"}), 404
@app.errorhandler(405)
def bad_method(e):  return jsonify({"error": "Method not allowed"}), 405
@app.errorhandler(500)
def server_err(e):  return jsonify({"error": "Internal server error"}), 500

# ════════════════════════════════════════════════
# FRONTEND – serve index.html for all non-API routes
# ════════════════════════════════════════════════
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "time": datetime.utcnow().isoformat()})

# ════════════════════════════════════════════════
# AUTH
# ════════════════════════════════════════════════
@app.route("/api/auth/register", methods=["POST"])
def register():
    data     = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters"}), 400
    if len(password) < 4:
        return jsonify({"error": "Password must be at least 4 characters"}), 400
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    db = get_db()
    try:
        cur = db.execute("INSERT INTO users (username, password) VALUES (?,?)", (username, hashed))
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already taken"}), 409
    token = make_token(cur.lastrowid, username)
    return jsonify({"token": token, "username": username}), 201

@app.route("/api/auth/login", methods=["POST"])
def login():
    data     = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
    row = get_db().execute(
        "SELECT id, username, password FROM users WHERE username=?", (username,)
    ).fetchone()
    if not row or not bcrypt.checkpw(password.encode(), row["password"].encode()):
        return jsonify({"error": "Incorrect username or password"}), 401
    return jsonify({"token": make_token(row["id"], row["username"]), "username": row["username"]})

@app.route("/api/auth/me")
@require_auth
def me():
    return jsonify({"user_id": g.user_id, "username": g.username})

# ════════════════════════════════════════════════
# EXPENSES
# ════════════════════════════════════════════════
@app.route("/api/expenses", methods=["GET"])
@require_auth
def get_expenses():
    rows = get_db().execute(
        "SELECT * FROM expenses WHERE user_id=? ORDER BY date DESC, created DESC",
        (g.user_id,)
    ).fetchall()
    return jsonify(rows_list(rows))

@app.route("/api/expenses", methods=["POST"])
@require_auth
def add_expense():
    data        = request.get_json() or {}
    amount      = valid_amount(data.get("amount"))
    description = (data.get("description") or "").strip()
    category    = (data.get("category") or "Other").strip()
    date        = (data.get("date") or "").strip()
    if not amount:      return jsonify({"error": "amount must be a positive number"}), 400
    if not description: return jsonify({"error": "description is required"}), 400
    if not date:        return jsonify({"error": "date is required"}), 400
    eid = uid()
    db  = get_db()
    db.execute("INSERT INTO expenses (id,user_id,amount,description,category,date) VALUES (?,?,?,?,?,?)",
               (eid, g.user_id, amount, description, category, date))
    db.commit()
    return jsonify(row_dict(db.execute("SELECT * FROM expenses WHERE id=?", (eid,)).fetchone())), 201

@app.route("/api/expenses/<eid>", methods=["PUT"])
@require_auth
def update_expense(eid):
    db = get_db()
    if not db.execute("SELECT id FROM expenses WHERE id=? AND user_id=?", (eid, g.user_id)).fetchone():
        return jsonify({"error": "Expense not found"}), 404
    data        = request.get_json() or {}
    amount      = valid_amount(data.get("amount"))
    description = (data.get("description") or "").strip()
    category    = (data.get("category") or "Other").strip()
    date        = (data.get("date") or "").strip()
    if not amount or not description or not date:
        return jsonify({"error": "amount, description and date are required"}), 400
    db.execute("UPDATE expenses SET amount=?,description=?,category=?,date=? WHERE id=? AND user_id=?",
               (amount, description, category, date, eid, g.user_id))
    db.commit()
    return jsonify(row_dict(db.execute("SELECT * FROM expenses WHERE id=?", (eid,)).fetchone()))

@app.route("/api/expenses/<eid>", methods=["DELETE"])
@require_auth
def delete_expense(eid):
    db  = get_db()
    cur = db.execute("DELETE FROM expenses WHERE id=? AND user_id=?", (eid, g.user_id))
    db.commit()
    if cur.rowcount == 0: return jsonify({"error": "Expense not found"}), 404
    return jsonify({"deleted": eid})

# ════════════════════════════════════════════════
# INCOME
# ════════════════════════════════════════════════
@app.route("/api/income", methods=["GET"])
@require_auth
def get_income():
    rows = get_db().execute(
        "SELECT * FROM income WHERE user_id=? ORDER BY date DESC, created DESC",
        (g.user_id,)
    ).fetchall()
    return jsonify(rows_list(rows))

@app.route("/api/income", methods=["POST"])
@require_auth
def add_income():
    data        = request.get_json() or {}
    amount      = valid_amount(data.get("amount"))
    description = (data.get("description") or "").strip()
    source      = (data.get("source") or "Other").strip()
    date        = (data.get("date") or "").strip()
    if not amount or not description or not date:
        return jsonify({"error": "amount, description and date are required"}), 400
    iid = uid()
    db  = get_db()
    db.execute("INSERT INTO income (id,user_id,amount,description,source,date) VALUES (?,?,?,?,?,?)",
               (iid, g.user_id, amount, description, source, date))
    db.commit()
    return jsonify(row_dict(db.execute("SELECT * FROM income WHERE id=?", (iid,)).fetchone())), 201

@app.route("/api/income/<iid>", methods=["PUT"])
@require_auth
def update_income(iid):
    db = get_db()
    if not db.execute("SELECT id FROM income WHERE id=? AND user_id=?", (iid, g.user_id)).fetchone():
        return jsonify({"error": "Income not found"}), 404
    data        = request.get_json() or {}
    amount      = valid_amount(data.get("amount"))
    description = (data.get("description") or "").strip()
    source      = (data.get("source") or "Other").strip()
    date        = (data.get("date") or "").strip()
    if not amount or not description or not date:
        return jsonify({"error": "amount, description and date are required"}), 400
    db.execute("UPDATE income SET amount=?,description=?,source=?,date=? WHERE id=? AND user_id=?",
               (amount, description, source, date, iid, g.user_id))
    db.commit()
    return jsonify(row_dict(db.execute("SELECT * FROM income WHERE id=?", (iid,)).fetchone()))

@app.route("/api/income/<iid>", methods=["DELETE"])
@require_auth
def delete_income(iid):
    db  = get_db()
    cur = db.execute("DELETE FROM income WHERE id=? AND user_id=?", (iid, g.user_id))
    db.commit()
    if cur.rowcount == 0: return jsonify({"error": "Income not found"}), 404
    return jsonify({"deleted": iid})

# ════════════════════════════════════════════════
# GOALS
# ════════════════════════════════════════════════
@app.route("/api/goals", methods=["GET"])
@require_auth
def get_goals():
    rows = get_db().execute(
        "SELECT * FROM goals WHERE user_id=? ORDER BY created DESC", (g.user_id,)
    ).fetchall()
    return jsonify(rows_list(rows))

@app.route("/api/goals", methods=["POST"])
@require_auth
def add_goal():
    data       = request.get_json() or {}
    name       = (data.get("name") or "").strip()
    target     = valid_amount(data.get("target"))
    saved      = max(0, float(data.get("saved", 0) or 0))
    start_date = data.get("start_date") or None
    end_date   = data.get("end_date")   or None
    if not name or not target:
        return jsonify({"error": "name and target are required"}), 400
    gid = uid()
    db  = get_db()
    db.execute("INSERT INTO goals (id,user_id,name,target,saved,start_date,end_date) VALUES (?,?,?,?,?,?,?)",
               (gid, g.user_id, name, target, saved, start_date, end_date))
    db.commit()
    return jsonify(row_dict(db.execute("SELECT * FROM goals WHERE id=?", (gid,)).fetchone())), 201

@app.route("/api/goals/<gid>", methods=["PUT"])
@require_auth
def update_goal(gid):
    db = get_db()
    if not db.execute("SELECT id FROM goals WHERE id=? AND user_id=?", (gid, g.user_id)).fetchone():
        return jsonify({"error": "Goal not found"}), 404
    data       = request.get_json() or {}
    name       = (data.get("name") or "").strip()
    target     = valid_amount(data.get("target"))
    saved      = max(0, float(data.get("saved", 0) or 0))
    start_date = data.get("start_date") or None
    end_date   = data.get("end_date")   or None
    if not name or not target:
        return jsonify({"error": "name and target are required"}), 400
    db.execute("UPDATE goals SET name=?,target=?,saved=?,start_date=?,end_date=? WHERE id=? AND user_id=?",
               (name, target, saved, start_date, end_date, gid, g.user_id))
    db.commit()
    return jsonify(row_dict(db.execute("SELECT * FROM goals WHERE id=?", (gid,)).fetchone()))

@app.route("/api/goals/<gid>/add", methods=["POST"])
@require_auth
def add_to_goal(gid):
    db  = get_db()
    row = db.execute("SELECT saved FROM goals WHERE id=? AND user_id=?", (gid, g.user_id)).fetchone()
    if not row: return jsonify({"error": "Goal not found"}), 404
    amount = valid_amount((request.get_json() or {}).get("amount"))
    if not amount: return jsonify({"error": "amount must be a positive number"}), 400
    new_saved = row["saved"] + amount
    db.execute("UPDATE goals SET saved=? WHERE id=? AND user_id=?", (new_saved, gid, g.user_id))
    db.commit()
    return jsonify(row_dict(db.execute("SELECT * FROM goals WHERE id=?", (gid,)).fetchone()))

@app.route("/api/goals/<gid>", methods=["DELETE"])
@require_auth
def delete_goal(gid):
    db  = get_db()
    cur = db.execute("DELETE FROM goals WHERE id=? AND user_id=?", (gid, g.user_id))
    db.commit()
    if cur.rowcount == 0: return jsonify({"error": "Goal not found"}), 404
    return jsonify({"deleted": gid})

# ════════════════════════════════════════════════
# SUMMARY
# ════════════════════════════════════════════════
@app.route("/api/summary")
@require_auth
def summary():
    period = request.args.get("period", "month")
    now    = datetime.utcnow()
    start  = {"week":  (now - timedelta(days=7)).strftime("%Y-%m-%d"),
               "month": now.strftime("%Y-%m-01"),
               "year":  now.strftime("%Y-01-01")}.get(period, "0000-01-01")
    db = get_db()
    total_inc = db.execute(
        "SELECT COALESCE(SUM(amount),0) FROM income WHERE user_id=? AND date>=?",
        (g.user_id, start)).fetchone()[0]
    total_exp = db.execute(
        "SELECT COALESCE(SUM(amount),0) FROM expenses WHERE user_id=? AND date>=?",
        (g.user_id, start)).fetchone()[0]
    tx_count  = db.execute(
        "SELECT COUNT(*) FROM expenses WHERE user_id=? AND date>=?",
        (g.user_id, start)).fetchone()[0]
    return jsonify({
        "total_income":   round(total_inc, 2),
        "total_expenses": round(total_exp, 2),
        "net_balance":    round(total_inc - total_exp, 2),
        "tx_count":       tx_count,
        "period":         period
    })

# ── ENTRY POINT ───────────────────────────────────
if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
