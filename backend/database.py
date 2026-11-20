"""SQLite access layer. All queries are parameterized."""
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from config import Config

ANALYSIS_FIELDS = [
    "sentiment",
    "confidence",
    "emotion",
    "intent",
    "topic",
    "urgency",
    "customer_risk",
    "key_issue",
    "reason",
    "recommended_action",
    "suggested_response",
]

SCHEMA = """
CREATE TABLE IF NOT EXISTS feedback_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feedback TEXT NOT NULL,
    sentiment TEXT NOT NULL,
    confidence REAL NOT NULL,
    emotion TEXT NOT NULL,
    intent TEXT NOT NULL,
    topic TEXT NOT NULL,
    urgency TEXT NOT NULL,
    customer_risk TEXT NOT NULL,
    key_issue TEXT NOT NULL,
    reason TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    suggested_response TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback_analysis (created_at DESC);
"""


class DatabaseError(Exception):
    """Raised for any storage failure; details are logged, not exposed."""


@contextmanager
def get_connection(db_path: Optional[str] = None):
    path = db_path or Config.DATABASE_PATH
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except sqlite3.Error as exc:
        conn.rollback()
        raise DatabaseError(str(exc)) from exc
    finally:
        conn.close()


def init_db(db_path: Optional[str] = None) -> None:
    with get_connection(db_path) as conn:
        conn.executescript(SCHEMA)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def insert_analysis(
    feedback: str,
    analysis: Dict[str, Any],
    created_at: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    columns = ["feedback", *ANALYSIS_FIELDS, "created_at"]
    values = [feedback, *(analysis[f] for f in ANALYSIS_FIELDS), created_at or _now()]
    placeholders = ", ".join("?" for _ in columns)
    with get_connection(db_path) as conn:
        cur = conn.execute(
            f"INSERT INTO feedback_analysis ({', '.join(columns)}) VALUES ({placeholders})",
            values,
        )
        row = conn.execute(
            "SELECT * FROM feedback_analysis WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
    return dict(row)


def list_feedback(
    search: Optional[str] = None,
    sentiment: Optional[str] = None,
    urgency: Optional[str] = None,
    risk: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
    db_path: Optional[str] = None,
) -> List[Dict[str, Any]]:
    clauses: List[str] = []
    params: List[Any] = []
    if search:
        like = f"%{search}%"
        clauses.append("(feedback LIKE ? OR topic LIKE ? OR key_issue LIKE ?)")
        params.extend([like, like, like])
    if sentiment:
        clauses.append("sentiment = ?")
        params.append(sentiment)
    if urgency:
        clauses.append("urgency = ?")
        params.append(urgency)
    if risk:
        clauses.append("customer_risk = ?")
        params.append(risk)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    with get_connection(db_path) as conn:
        rows = conn.execute(
            f"SELECT * FROM feedback_analysis {where} "
            "ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
            [*params, limit, offset],
        ).fetchall()
    return [dict(r) for r in rows]


def get_feedback(feedback_id: int, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with get_connection(db_path) as conn:
        row = conn.execute(
            "SELECT * FROM feedback_analysis WHERE id = ?", (feedback_id,)
        ).fetchone()
    return dict(row) if row else None


def delete_feedback(feedback_id: int, db_path: Optional[str] = None) -> bool:
    with get_connection(db_path) as conn:
        cur = conn.execute(
            "DELETE FROM feedback_analysis WHERE id = ?", (feedback_id,)
        )
        return cur.rowcount > 0


def _count_by(conn: sqlite3.Connection, column: str, limit: int) -> List[Dict[str, Any]]:
    # `column` is chosen from a fixed internal allow-list below, never user input.
    rows = conn.execute(
        f"SELECT {column} AS name, COUNT(*) AS count FROM feedback_analysis "
        f"GROUP BY {column} ORDER BY count DESC, name ASC LIMIT ?",
        (limit,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_summary(db_path: Optional[str] = None) -> Dict[str, Any]:
    with get_connection(db_path) as conn:
        total = conn.execute("SELECT COUNT(*) FROM feedback_analysis").fetchone()[0]
        sentiment_rows = conn.execute(
            "SELECT sentiment, COUNT(*) AS c FROM feedback_analysis GROUP BY sentiment"
        ).fetchall()
        counts = {r["sentiment"]: r["c"] for r in sentiment_rows}
        high_urgency = conn.execute(
            "SELECT COUNT(*) FROM feedback_analysis WHERE urgency = ?", ("High",)
        ).fetchone()[0]
        high_risk = conn.execute(
            "SELECT COUNT(*) FROM feedback_analysis WHERE customer_risk = ?", ("High",)
        ).fetchone()[0]

        def pct(n: int) -> float:
            return round(n * 100.0 / total, 1) if total else 0.0

        positive = counts.get("Positive", 0)
        neutral = counts.get("Neutral", 0)
        negative = counts.get("Negative", 0)

        return {
            "total": total,
            "positive": positive,
            "neutral": neutral,
            "negative": negative,
            "positive_pct": pct(positive),
            "neutral_pct": pct(neutral),
            "negative_pct": pct(negative),
            "high_urgency": high_urgency,
            "high_risk": high_risk,
            "top_topics": _count_by(conn, "topic", 8),
            "top_emotions": _count_by(conn, "emotion", 8),
            "top_intents": _count_by(conn, "intent", 8),
        }


def get_priority_issues(limit: int = 5, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """High urgency or high risk feedback, most severe first."""
    with get_connection(db_path) as conn:
        rows = conn.execute(
            "SELECT * FROM feedback_analysis WHERE urgency = ? OR customer_risk = ? "
            "ORDER BY (CASE WHEN urgency = 'High' AND customer_risk = 'High' THEN 0 ELSE 1 END), "
            "created_at DESC, id DESC LIMIT ?",
            ("High", "High", limit),
        ).fetchall()
    return [dict(r) for r in rows]


def get_negative_samples(limit: int = 15, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Compact negative-feedback records used to ground the AI business insight."""
    with get_connection(db_path) as conn:
        rows = conn.execute(
            "SELECT topic, key_issue, urgency, customer_risk FROM feedback_analysis "
            "WHERE sentiment = ? ORDER BY created_at DESC, id DESC LIMIT ?",
            ("Negative", limit),
        ).fetchall()
    return [dict(r) for r in rows]
