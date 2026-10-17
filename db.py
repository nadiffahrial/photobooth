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
        cursor = conn.cursor()
        cursor.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                display_name TEXT,
                role TEXT NOT NULL DEFAULT 'user',
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

        # Migrasi kolom 'role' jika tabel users sudah ada sebelumnya tanpa kolom role
        cursor.execute("PRAGMA table_info(users)")
        columns = [row["name"] for row in cursor.fetchall()]
        if "role" not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")

        # Buat akun admin default jika belum ada admin sama sekali
        cursor.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
        if not cursor.fetchone():
            cursor.execute("SELECT id FROM users WHERE username = 'admin'")
            admin_row = cursor.fetchone()
            if admin_row:
                cursor.execute("UPDATE users SET role = 'admin' WHERE id = ?", (admin_row["id"],))
            else:
                cursor.execute(
                    """
                    INSERT INTO users (username, password_hash, display_name, role)
                    VALUES (?, ?, ?, ?)
                    """,
                    ("admin", generate_password_hash("admin123"), "Administrator", "admin"),
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
    db_path: Path | str, username: str, password: str, display_name: Optional[str] = None, role: str = "user"
) -> Dict[str, Any]:
    username = (username or "").strip()
    password = password or ""
    raw_name = (display_name or "").strip() or username
    clean_name = re.sub(r"[<>&\"']", "", raw_name)[:50].strip() or username
    role = "admin" if role == "admin" else "user"

    if not USERNAME_PATTERN.match(username):
        raise ValueError("Username harus terdiri dari 3-30 karakter alfanumerik atau underscore (_).")

    if len(password) < 6:
        raise ValueError("Password minimal 6 karakter.")

    if len(password) > 128:
        raise ValueError("Password maksimal 128 karakter.")

    password_hash = generate_password_hash(password)

    try:
        with db_session(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO users (username, password_hash, display_name, role)
                VALUES (?, ?, ?, ?)
                """,
                (username, password_hash, clean_name, role),
            )
            user_id = cursor.lastrowid
            cursor.execute("SELECT id, username, display_name, role, created_at FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            return dict(row)
    except sqlite3.IntegrityError:
        raise ValueError("Username sudah digunakan. Silakan pilih username lain.")


def change_password(db_path: Path | str, user_id: int, current_password: str, new_password: str) -> bool:
    if not current_password or not new_password:
        raise ValueError("Password saat ini dan password baru wajib diisi.")
    if len(new_password) < 6:
        raise ValueError("Password baru minimal 6 karakter.")
    if len(new_password) > 128:
        raise ValueError("Password baru maksimal 128 karakter.")

    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if not row or not check_password_hash(row["password_hash"], current_password):
            raise ValueError("Password saat ini tidak cocok.")

        new_hash = generate_password_hash(new_password)
        cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user_id))
        return cursor.rowcount > 0


def verify_user(db_path: Path | str, username: str, password: str) -> Optional[Dict[str, Any]]:
    username = (username or "").strip()
    password = password or ""

    if not username or not password:
        return None

    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, username, password_hash, display_name, role, created_at FROM users WHERE username = ?",
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
                "role": row["role"],
                "created_at": row["created_at"],
            }
        return None


def get_user_by_id(db_path: Path | str, user_id: int) -> Optional[Dict[str, Any]]:
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, username, display_name, role, created_at FROM users WHERE id = ?",
            (user_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def get_all_users(db_path: Path | str) -> List[Dict[str, Any]]:
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT u.id, u.username, u.display_name, u.role, u.created_at,
                   COUNT(p.id) as photo_count
            FROM users u
            LEFT JOIN photos p ON u.id = p.user_id
            GROUP BY u.id
            ORDER BY u.id ASC
            """
        )
        return [dict(row) for row in cursor.fetchall()]


def update_user_role(db_path: Path | str, user_id: int, new_role: str) -> bool:
    new_role = "admin" if new_role == "admin" else "user"
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET role = ? WHERE id = ?", (new_role, user_id))
        return cursor.rowcount > 0


def delete_user(db_path: Path | str, user_id: int) -> bool:
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        return cursor.rowcount > 0


def get_system_stats(db_path: Path | str) -> Dict[str, Any]:
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as total_users FROM users")
        total_users = cursor.fetchone()["total_users"]

        cursor.execute("SELECT COUNT(*) as total_photos FROM photos")
        total_photos = cursor.fetchone()["total_photos"]

        cursor.execute("SELECT COUNT(*) as total_admins FROM users WHERE role = 'admin'")
        total_admins = cursor.fetchone()["total_admins"]

        cursor.execute("SELECT COUNT(*) as guest_photos FROM photos WHERE user_id IS NULL")
        guest_photos = cursor.fetchone()["guest_photos"]

        return {
            "total_users": total_users,
            "total_photos": total_photos,
            "total_admins": total_admins,
            "guest_photos": guest_photos,
        }


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
            cursor.execute(
                """
                SELECT filename, created_at FROM photos
                WHERE user_id = ?
                ORDER BY id DESC
                """,
                (user_id,),
            )
        else:
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


def get_all_photos_admin(db_path: Path | str) -> List[Dict[str, Any]]:
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT p.id, p.filename, p.created_at, p.user_id,
                   COALESCE(u.display_name, u.username, 'Tamu') as owner_name,
                   u.username
            FROM photos p
            LEFT JOIN users u ON p.user_id = u.id
            ORDER BY p.id DESC
            """
        )
        rows = cursor.fetchall()
        return [
            {
                "id": row["id"],
                "name": row["filename"],
                "url": f"/photos/{row['filename']}",
                "created_at": row["created_at"],
                "user_id": row["user_id"],
                "owner_name": row["owner_name"],
                "username": row["username"],
            }
            for row in rows
        ]


def delete_photo(db_path: Path | str, filename: str, user_id: Optional[int] = None, is_admin: bool = False) -> bool:
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        if is_admin:
            cursor.execute("DELETE FROM photos WHERE filename = ?", (filename,))
        elif user_id is not None:
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
