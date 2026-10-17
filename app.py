from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path

from flask import (
    Flask,
    current_app,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
)
from PIL import Image, UnidentifiedImageError

import db

import re

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "photos"
DATABASE_PATH = BASE_DIR / "photobooth.db"
MAX_IMAGE_SIZE = 8 * 1024 * 1024
FILENAME_PATTERN = re.compile(r"^photo_[a-zA-Z0-9_.-]+\.png$")

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "snap-studio-secret-key-2026-secure")
app.config["UPLOAD_DIR"] = UPLOAD_DIR
app.config["DATABASE_PATH"] = DATABASE_PATH
app.config["MAX_CONTENT_LENGTH"] = MAX_IMAGE_SIZE
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["PERMANENT_SESSION_LIFETIME"] = 86400

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
db.init_db(DATABASE_PATH, UPLOAD_DIR)

# Security Hardening: Anti-Brute Force In-Memory Limiter
_auth_rate_limit: dict[str, list[float]] = {}


def is_auth_rate_limited(ip: str, max_attempts: int = 15, window_sec: int = 60) -> bool:
    if current_app.config.get("TESTING"):
        return False
    now = datetime.now().timestamp()
    history = _auth_rate_limit.setdefault(ip, [])
    _auth_rate_limit[ip] = [t for t in history if now - t < window_sec]
    if len(_auth_rate_limit[ip]) >= max_attempts:
        return True
    _auth_rate_limit[ip].append(now)
    return False


@app.after_request
def apply_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(self), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: blob:; "
        "media-src 'self' blob:; "
        "connect-src 'self';"
    )
    return response


def get_current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    return db.get_user_by_id(current_app.config["DATABASE_PATH"], user_id)


def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user or user.get("role") != "admin":
            flash("Akses ditolak. Halaman ini hanya untuk Administrator.", "error")
            return redirect(url_for("index"))
        return f(*args, **kwargs)
    return decorated_function


@app.get("/")
def index():
    user = get_current_user()
    if not user and not session.get("is_guest"):
        return redirect(url_for("login"))
    return render_template("index.html", user=user)


@app.route("/login", methods=["GET", "POST"])
def login():
    if get_current_user():
        return redirect(url_for("index"))

    if request.method == "POST":
        ip = request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1").split(",")[0].strip()
        if is_auth_rate_limited(ip):
            error_message = "Terlalu banyak percobaan masuk dari IP Anda. Harap tunggu 1 menit."
            if request.is_json:
                return jsonify({"error": error_message}), 429
            flash(error_message, "error")
            return render_template("login.html"), 429

        data = request.get_json(silent=True) or request.form
        username = data.get("username", "").strip()
        password = data.get("password", "")

        user = db.verify_user(current_app.config["DATABASE_PATH"], username, password)
        if user:
            session.clear()
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            session["display_name"] = user["display_name"]
            session["role"] = user["role"]

            if request.is_json:
                return jsonify({"success": True, "user": user}), 200

            flash(f"Selamat datang kembali, {user['display_name']}!", "success")
            return redirect(url_for("index"))

        error_message = "Username atau password salah."
        if request.is_json:
            return jsonify({"error": error_message}), 401

        flash(error_message, "error")

    return render_template("login.html")


@app.route("/register", methods=["GET", "POST"])
def register():
    if get_current_user():
        return redirect(url_for("index"))

    if request.method == "POST":
        ip = request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1").split(",")[0].strip()
        if is_auth_rate_limited(ip):
            error_message = "Terlalu banyak percobaan pendaftaran dari IP Anda. Harap tunggu 1 menit."
            if request.is_json:
                return jsonify({"error": error_message}), 429
            flash(error_message, "error")
            return render_template("register.html"), 429

        data = request.get_json(silent=True) or request.form
        username = data.get("username", "").strip()
        password = data.get("password", "")
        password_confirm = data.get("password_confirm", "")
        display_name = data.get("display_name", "").strip()

        if password != password_confirm:
            error_message = "Konfirmasi password tidak cocok."
            if request.is_json:
                return jsonify({"error": error_message}), 400
            flash(error_message, "error")
            return render_template("register.html")

        try:
            user = db.create_user(
                current_app.config["DATABASE_PATH"],
                username=username,
                password=password,
                display_name=display_name,
            )
            session.clear()
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            session["display_name"] = user["display_name"]
            session["role"] = user["role"]

            if request.is_json:
                return jsonify({"success": True, "user": user}), 201

            flash("Akun berhasil dibuat! Selamat datang di Snap Studio.", "success")
            return redirect(url_for("index"))
        except ValueError as err:
            error_message = str(err)
            if request.is_json:
                return jsonify({"error": error_message}), 400
            flash(error_message, "error")

    return render_template("register.html")


@app.get("/guest")
def guest():
    session["is_guest"] = True
    flash("Anda masuk sebagai Tamu. Foto tidak akan tersimpan di akun pribadi.", "success")
    return redirect(url_for("index"))


@app.route("/logout", methods=["GET", "POST"])
def logout():
    session.clear()
    if request.is_json:
        return jsonify({"success": True, "message": "Berhasil keluar."}), 200
    flash("Anda telah keluar dari akun.", "success")
    return redirect(url_for("login"))


@app.get("/api/me")
def api_me():
    user = get_current_user()
    if user:
        return jsonify({"authenticated": True, "user": user})
    return jsonify({"authenticated": False, "is_guest": bool(session.get("is_guest"))})


@app.post("/api/auth/google")
def api_auth_google():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip()
    name = data.get("name", "").strip() or "Pengguna Google"
    identifier = re.sub(r'[^a-zA-Z0-9_]', '_', email.split("@")[0]) if email else secrets.token_hex(3)
    username = f"g_{identifier}"[:30]

    with db.get_connection(current_app.config["DATABASE_PATH"]) as conn:
        user = conn.execute("SELECT id, username, display_name, role FROM users WHERE username = ?", (username,)).fetchone()
        if not user:
            user = db.create_user(current_app.config["DATABASE_PATH"], username=username, password=secrets.token_hex(16), display_name=name)

    session.clear()
    session["user_id"] = user["id"]
    session["username"] = user["username"]
    session["display_name"] = user["display_name"]
    session["role"] = user["role"]
    return jsonify({"success": True, "user": dict(user)}), 200


@app.post("/api/auth/apple")
def api_auth_apple():
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip() or "Pengguna Apple"
    username = f"apple_{secrets.token_hex(3)}"

    user = db.create_user(current_app.config["DATABASE_PATH"], username=username, password=secrets.token_hex(16), display_name=name)
    session.clear()
    session["user_id"] = user["id"]
    session["username"] = user["username"]
    session["display_name"] = user["display_name"]
    session["role"] = user["role"]
    return jsonify({"success": True, "user": dict(user)}), 200


@app.post("/api/auth/guest-pass")
def api_auth_guest_pass():
    data = request.get_json(silent=True) or {}
    nickname = data.get("nickname", "").strip() or "Tamu Studio"
    username = f"guest_{secrets.token_hex(3)}"

    user = db.create_user(current_app.config["DATABASE_PATH"], username=username, password=secrets.token_hex(16), display_name=nickname)
    session.clear()
    session["user_id"] = user["id"]
    session["username"] = user["username"]
    session["display_name"] = user["display_name"]
    session["role"] = user["role"]
    return jsonify({"success": True, "user": dict(user)}), 200



# ==============================================================================
# Rute Panel Administrator
# ==============================================================================
@app.get("/admin")
@admin_required
def admin_dashboard():
    user = get_current_user()
    stats = db.get_system_stats(current_app.config["DATABASE_PATH"])
    users = db.get_all_users(current_app.config["DATABASE_PATH"])
    photos = db.get_all_photos_admin(current_app.config["DATABASE_PATH"])
    return render_template("admin.html", user=user, stats=stats, users=users, photos=photos)


@app.post("/admin/users/<int:user_id>/role")
@admin_required
def admin_change_role(user_id: int):
    current = get_current_user()
    if current["id"] == user_id:
        flash("Anda tidak dapat mengubah role akun Anda sendiri.", "error")
        return redirect(url_for("admin_dashboard"))

    new_role = request.form.get("role", "user")
    db.update_user_role(current_app.config["DATABASE_PATH"], user_id, new_role)
    flash(f"Role pengguna #{user_id} berhasil diubah menjadi {new_role}.", "success")
    return redirect(url_for("admin_dashboard"))


@app.post("/admin/users/<int:user_id>/delete")
@admin_required
def admin_delete_user(user_id: int):
    current = get_current_user()
    if current["id"] == user_id:
        flash("Anda tidak dapat menghapus akun Anda sendiri.", "error")
        return redirect(url_for("admin_dashboard"))

    user_photos = db.get_photos(current_app.config["DATABASE_PATH"], user_id=user_id)
    for p in user_photos:
        p_file = current_app.config["UPLOAD_DIR"] / p["name"]
        if p_file.is_file():
            p_file.unlink()

    db.delete_user(current_app.config["DATABASE_PATH"], user_id)
    flash("Pengguna dan seluruh fotonya berhasil dihapus.", "success")
    return redirect(url_for("admin_dashboard"))


@app.post("/admin/photos/<path:filename>/delete")
@admin_required
def admin_delete_photo(filename: str):
    p_file = current_app.config["UPLOAD_DIR"] / filename
    if p_file.is_file():
        p_file.unlink()
    db.delete_photo(current_app.config["DATABASE_PATH"], filename, is_admin=True)
    flash(f"Foto {filename} berhasil dihapus oleh admin.", "success")
    return redirect(url_for("admin_dashboard"))


@app.get("/api/photos")
def list_photos():
    user = get_current_user()
    user_id = user["id"] if user else None
    photos = db.get_photos(current_app.config["DATABASE_PATH"], user_id=user_id)
    return jsonify({"photos": photos})


@app.post("/api/photos")
def save_photo():
    image_file = request.files.get("photo")
    if image_file is None or not image_file.filename:
        return jsonify({"error": "Foto belum dikirim."}), 400

    if image_file.mimetype not in {"image/jpeg", "image/png", "image/webp"}:
        return jsonify({"error": "Hanya gambar JPEG, PNG, atau WebP yang didukung."}), 400

    try:
        with Image.open(image_file.stream) as source:
            source.verify()
        image_file.seek(0)
        with Image.open(image_file.stream) as source:
            source.load()
            if source.width < 1 or source.height < 1:
                raise ValueError("Gambar tidak memiliki ukuran yang valid.")
            destination = source.convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError):
        return jsonify({"error": "Gambar tidak dapat diproses."}), 400

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"photo_{timestamp}_{secrets.token_hex(3)}.png"
    destination_path = current_app.config["UPLOAD_DIR"] / filename
    destination.save(destination_path, format="PNG", optimize=True)

    user = get_current_user()
    user_id = user["id"] if user else None
    db.add_photo(current_app.config["DATABASE_PATH"], filename=filename, user_id=user_id)

    return jsonify(
        {
            "success": True,
            "name": filename,
            "url": f"/photos/{filename}",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    ), 201


@app.delete("/api/photos/<path:filename>")
def delete_photo(filename: str):
    if not FILENAME_PATTERN.match(filename) or filename in {".", ".."} or Path(filename).name != filename:
        return jsonify({"error": "Gambar tidak ditemukan."}), 404

    target = current_app.config["UPLOAD_DIR"] / filename
    if not target.is_file() or target.suffix.lower() != ".png":
        return jsonify({"error": "Gambar tidak ditemukan."}), 404

    user = get_current_user()
    user_id = user["id"] if user else None
    is_admin = bool(user and user.get("role") == "admin")
    deleted = db.delete_photo(current_app.config["DATABASE_PATH"], filename=filename, user_id=user_id, is_admin=is_admin)

    if deleted or user_id is None or is_admin:
        if target.is_file():
            target.unlink()
        return jsonify({"success": True, "name": filename})

    return jsonify({"error": "Anda tidak memiliki izin untuk menghapus gambar ini."}), 403


@app.post("/api/auth/change-password")
def api_change_password():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Harap masuk terlebih dahulu."}), 401

    data = request.get_json(silent=True) or request.form
    cur_pass = data.get("current_password", "")
    new_pass = data.get("new_password", "")

    try:
        db.change_password(current_app.config["DATABASE_PATH"], user["id"], cur_pass, new_pass)
        return jsonify({"success": True, "message": "Password berhasil diperbarui."}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@app.get("/photos/<path:filename>")
def photo(filename: str):
    return send_from_directory(current_app.config["UPLOAD_DIR"], filename)


@app.get("/download/<path:filename>")
def download_landing(filename: str):
    if not FILENAME_PATTERN.match(filename) or filename in {".", ".."} or Path(filename).name != filename:
        return "Format nama file tidak valid", 400

    target = current_app.config["UPLOAD_DIR"] / filename
    if not target.is_file():
        return "Foto tidak ditemukan atau telah dihapus", 404

    if request.args.get("raw") == "1" or "image/" in request.headers.get("Accept", ""):
        return send_from_directory(current_app.config["UPLOAD_DIR"], filename)

    photo_url = f"/photos/{filename}"
    html = f"""<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Snap Studio - Unduh Soft File</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Playfair+Display:ital,wght@0,600;1,600&display=swap" rel="stylesheet">
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
            background: linear-gradient(135deg, #100d17 0%, #220e36 50%, #0d0a14 100%);
            color: #fffdf9;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 24px 16px;
            text-align: center;
        }}
        .card {{
            background: rgba(255, 255, 255, 0.07);
            backdrop-filter: blur(18px);
            border: 1px solid rgba(255, 255, 255, 0.16);
            border-radius: 28px;
            padding: 26px 20px;
            max-width: 440px;
            width: 100%;
            box-shadow: 0 24px 50px rgba(0, 0, 0, 0.55);
        }}
        .badge {{
            display: inline-block;
            background: rgba(123, 60, 255, 0.25);
            color: #c084fc;
            border: 1px solid rgba(192, 132, 252, 0.4);
            padding: 5px 14px;
            border-radius: 100px;
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            margin-bottom: 12px;
        }}
        h1 {{
            font-family: 'Playfair Display', serif;
            font-size: 1.65rem;
            margin-bottom: 6px;
        }}
        p {{
            color: #b7b0c2;
            font-size: 0.88rem;
            line-height: 1.45;
            margin-bottom: 18px;
        }}
        .img-box {{
            background: #09080c;
            border-radius: 18px;
            padding: 12px;
            margin-bottom: 22px;
            box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.7);
        }}
        img {{
            max-width: 100%;
            max-height: 52vh;
            border-radius: 10px;
            display: block;
            margin: 0 auto;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }}
        .btn-download {{
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            padding: 15px;
            background: linear-gradient(135deg, #7b3cff, #5616dc);
            color: white;
            text-decoration: none;
            border-radius: 100px;
            font-weight: 700;
            font-size: 1rem;
            margin-bottom: 12px;
            box-shadow: 0 6px 20px rgba(123, 60, 255, 0.4);
        }}
        .btn-app {{
            display: block;
            width: 100%;
            padding: 11px;
            background: rgba(255, 255, 255, 0.08);
            color: #fff;
            text-decoration: none;
            border-radius: 100px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            font-weight: 600;
            font-size: 0.85rem;
        }}
        .hint {{
            margin-top: 14px;
            font-size: 0.75rem;
            color: #8c8498;
        }}
    </style>
</head>
<body>
    <div class="card">
        <span class="badge">✦ Soft File Photobooth ✦</span>
        <h1>Snap Studio</h1>
        <p>Soft file foto strip resolusi tinggi kamu siap diunduh ke galeri HP!</p>
        <div class="img-box">
            <img src="{photo_url}" alt="Soft file strip photobooth">
        </div>
        <a href="{photo_url}" download="snap-studio-{filename}" class="btn-download">
            <span>📥 Unduh ke Galeri Ponsel</span>
        </a>
        <a href="/" class="btn-app">📸 Buka Studio Photobooth</a>
        <p class="hint">Tip: Anda juga dapat menekan dan menahan foto di atas lalu pilih <em>"Simpan Gambar"</em>.</p>
    </div>
</body>
</html>"""
    return html


@app.get("/health")
def health():
    return jsonify({"status": "ok", "upload_dir": str(UPLOAD_DIR)})


DEFAULT_POSES = [
    "Pose 'Heart-Cheek' 🫰: Tempelkan jari telunjuk dan jempol membentuk setengah hati di pipi sambil tersenyum!",
    "Pose 'Peace & Wink' ✌️: Tunjukkan tanda V di dekat mata kanan lalu kedipkan mata kiri dengan ceria!",
    "Pose 'The Candid Laugh' 😄: Toleh sedikit ke samping sambil tertawa lepas seolah ada hal lucu!",
    "Pose 'Finger Frame' 📸: Buat bingkai foto mini dengan kedua tanganmu tepat di depan wajah!",
    "Pose 'Cat Paws' 🐾: Kepalkan kedua tangan seperti cakar kucing yang lucu di samping pipi!",
    "Pose 'Thinking Cute' 🤔: Topang dagumu dengan satu tangan sambil memandang kamera dengan tatapan ramah!",
]


@app.get("/api/ai/pose")
def get_ai_pose():
    import random
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return jsonify({"pose": random.choice(DEFAULT_POSES)})

    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-flash-lite-latest",
            contents="Berikan 1 ide pose photobooth yang seru, ekspresif, dan estetik dalam 1-2 kalimat singkat beserta emoji."
        )
        return jsonify({"pose": response.text.strip()})
    except Exception:
        return jsonify({"pose": random.choice(DEFAULT_POSES)})


def get_local_ip():
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


@app.get("/api/network-info")
def get_network_info():
    local_ip = get_local_ip()
    port = int(os.getenv("PORT", 5000))
    return jsonify({
        "localIp": local_ip,
        "port": port,
        "wifiUrl": f"http://{local_ip}:{port}"
    })


if __name__ == "__main__":
    import sys
    os.environ.setdefault("FLASK_ENV", "development")
    use_https = "--https" in sys.argv or os.environ.get("USE_HTTPS", "").lower() in ("1", "true")
    ssl_context = "adhoc" if use_https else None
    if use_https:
        print("\n[INFO] Menjalankan server dalam mode HTTPS (Wajib untuk akses kamera di HP/Mobile).")
        print("Buka di HP Anda: https://192.168.110.88:5000\n")
    app.run(host="0.0.0.0", port=5000, debug=True, ssl_context=ssl_context)
