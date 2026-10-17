from __future__ import annotations

import re
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional
from werkzeug.security import check_password_hash, generate_password_hash

USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_]{3,30}$")


@contextmanager
def db_session(db_path: Path | str) -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(db_path: Path | str, upload_dir: Optional[Path | str] = None) -> None:
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with db_session(path) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                display_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS photos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                filename TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_photos_user ON photos(user_id);
            """
        )

        # Sinkronkan file lama yang sudah ada di disk jika ada
        if upload_dir:
            upload_path = Path(upload_dir)
            if upload_path.is_dir():
                for p in upload_path.glob("*.png"):
                    mtime = datetime.fromtimestamp(p.stat().st_mtime, timezone.utc).isoformat()
                    conn.execute(
                        """
                        INSERT OR IGNORE INTO photos (user_id, filename, created_at)
                        VALUES (NULL, ?, ?)
                        """,
                        (p.name, mtime),
                    )


def create_user(
    db_path: Path | str, username: str, password: str, display_name: Optional[str] = None
) -> Dict[str, Any]:
    username = (username or "").strip()
    password = password or ""
    display_name = (display_name or "").strip() or username

    if not USERNAME_PATTERN.match(username):
        raise ValueError("Username harus terdiri dari 3-30 karakter alfanumerik atau underscore (_).")

    if len(password) < 6:
        raise ValueError("Password minimal 6 karakter.")

    password_hash = generate_password_hash(password)

    try:
        with db_session(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO users (username, password_hash, display_name)
                VALUES (?, ?, ?)
                """,
                (username, password_hash, display_name),
            )
            user_id = cursor.lastrowid
            cursor.execute("SELECT id, username, display_name, created_at FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            return dict(row)
    except sqlite3.IntegrityError:
        raise ValueError("Username sudah digunakan. Silakan pilih username lain.")


def verify_user(db_path: Path | str, username: str, password: str) -> Optional[Dict[str, Any]]:
    username = (username or "").strip()
    password = password or ""

    if not username or not password:
        return None

    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, username, password_hash, display_name, created_at FROM users WHERE username = ?",
            (username,),
        )
        row = cursor.fetchone()
        if not row:
            return None

        if check_password_hash(row["password_hash"], password):
            return {
                "id": row["id"],
                "username": row["username"],
                "display_name": row["display_name"],
                "created_at": row["created_at"],
            }
        return None


def get_user_by_id(db_path: Path | str, user_id: int) -> Optional[Dict[str, Any]]:
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, username, display_name, created_at FROM users WHERE id = ?",
            (user_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def add_photo(db_path: Path | str, filename: str, user_id: Optional[int] = None) -> None:
    with db_session(db_path) as conn:
        conn.execute(
            """
            INSERT INTO photos (user_id, filename, created_at)
            VALUES (?, ?, ?)
            """,
            (user_id, filename, datetime.now(timezone.utc).isoformat()),
        )


def get_photos(db_path: Path | str, user_id: Optional[int] = None) -> List[Dict[str, Any]]:
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        if user_id is not None:
            # Foto milik user tertentu
            cursor.execute(
                """
                SELECT filename, created_at FROM photos
                WHERE user_id = ?
                ORDER BY id DESC
                """,
                (user_id,),
            )
        else:
            # Tamu / publik (foto tanpa user)
            cursor.execute(
                """
                SELECT filename, created_at FROM photos
                WHERE user_id IS NULL
                ORDER BY id DESC
                """
            )

        rows = cursor.fetchall()
        return [
            {
                "name": row["filename"],
                "url": f"/photos/{row['filename']}",
                "created_at": row["created_at"],
            }
            for row in rows
        ]


def delete_photo(db_path: Path | str, filename: str, user_id: Optional[int] = None) -> bool:
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        if user_id is not None:
            cursor.execute(
                "DELETE FROM photos WHERE filename = ? AND user_id = ?",
                (filename, user_id),
            )
        else:
            cursor.execute(
                "DELETE FROM photos WHERE filename = ? AND user_id IS NULL",
                (filename,),
            )
        return cursor.rowcount > 0

