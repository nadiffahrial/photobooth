from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone
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

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "photos"
DATABASE_PATH = BASE_DIR / "photobooth.db"
MAX_IMAGE_SIZE = 8 * 1024 * 1024

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "snap-studio-secret-key-2026-secure")
app.config["UPLOAD_DIR"] = UPLOAD_DIR
app.config["DATABASE_PATH"] = DATABASE_PATH
app.config["MAX_CONTENT_LENGTH"] = MAX_IMAGE_SIZE

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
db.init_db(DATABASE_PATH, UPLOAD_DIR)


def get_current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    return db.get_user_by_id(current_app.config["DATABASE_PATH"], user_id)


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
        data = request.get_json(silent=True) or request.form
        username = data.get("username", "").strip()
        password = data.get("password", "")

        user = db.verify_user(current_app.config["DATABASE_PATH"], username, password)
        if user:
            session.clear()
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            session["display_name"] = user["display_name"]

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
    if filename in {".", ".."} or Path(filename).name != filename:
        return jsonify({"error": "Gambar tidak ditemukan."}), 404

    target = current_app.config["UPLOAD_DIR"] / filename
    if not target.is_file() or target.suffix.lower() != ".png":
        return jsonify({"error": "Gambar tidak ditemukan."}), 404

    user = get_current_user()
    user_id = user["id"] if user else None
    deleted = db.delete_photo(current_app.config["DATABASE_PATH"], filename=filename, user_id=user_id)

    if deleted or user_id is None:
        if target.is_file():
            target.unlink()
        return jsonify({"success": True, "name": filename})

    return jsonify({"error": "Anda tidak memiliki izin untuk menghapus gambar ini."}), 403


@app.get("/photos/<path:filename>")
def photo(filename: str):
    return send_from_directory(current_app.config["UPLOAD_DIR"], filename)


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


@app.post("/api/photos/<path:filename>/caption")
def get_photo_caption(filename: str):
    user = get_current_user()
    user_name = user["display_name"] if user else "Kawan"

    photo_path = current_app.config["UPLOAD_DIR"] / filename
    if not photo_path.is_file():
        return jsonify({"error": "Foto tidak ditemukan."}), 404

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return jsonify({"caption": f"Momen terbaik bersama {user_name} di Snap Studio! ✨📸 #SnapStudio #GoodVibes"})

    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        prompt = (
            f"Kamu adalah AI asisten photobooth Snap Studio. Buatkan 1 caption Instagram singkat (maks 2 kalimat) "
            f"yang aesthetic, ceria, dan seru untuk foto photobooth milik {user_name}. Berikan 2 hashtag keren."
        )
        response = client.models.generate_content(
            model="gemini-flash-lite-latest",
            contents=prompt,
        )
        return jsonify({"caption": response.text.strip()})
    except Exception:
        return jsonify({"caption": f"Momen berkesan di Snap Studio bersama {user_name}! 📸✨ #Photobooth #SnapMoment"})


if __name__ == "__main__":
    import sys
    os.environ.setdefault("FLASK_ENV", "development")
    use_https = "--https" in sys.argv or os.environ.get("USE_HTTPS", "").lower() in ("1", "true")
    ssl_context = "adhoc" if use_https else None
    if use_https:
        print("\n[INFO] Menjalankan server dalam mode HTTPS (Wajib untuk akses kamera di HP/Mobile).")
        print("Buka di HP Anda: https://192.168.110.88:5000\n")
    app.run(host="0.0.0.0", port=5000, debug=True, ssl_context=ssl_context)
