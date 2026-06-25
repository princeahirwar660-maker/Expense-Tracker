"""Run this once locally to create the database: python init_db.py"""
import sqlite3, os

DB_PATH = os.environ.get("DB_PATH", "spendsmart.db")

conn = sqlite3.connect(DB_PATH)
conn.execute("PRAGMA foreign_keys = ON")
conn.executescript("""
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
conn.commit()
conn.close()
print(f"Database initialised at: {DB_PATH}")
