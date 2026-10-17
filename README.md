# Snap Studio Photobooth (Dual-Stack: Node.js + React & Python + Flask)

Aplikasi photobooth modern dengan dua pilihan teknologi yang saling terintegrasi dan berbagi database SQLite (`photobooth.db`) serta folder foto (`photos/`):

1. **Stack Node.js & React (Vite + Express)**
2. **Stack Python & Flask (Jinja2 + SQLite)**

---

## Fitur Utama

- 📸 **Live Webcam Stream & Multi-Lens**: Pratinjau kamera waktu nyata dengan dukungan ultra-wide (0.5x), 1x, 2x, peralihan kamera depan/belakang, dan rasio adaptif (3:4 portrait untuk mobile iOS/Android & 4:3 widescreen untuk desktop).
- 🎞️ **Photobooth 3-Strip Vertical Builder**:
  - Alur otomatis: Pilih template border strip -> Sesi 3 pose burst dengan countdown modern bottom-docked -> Soft file strip beresolusi tinggi.
  - Opsi buat strip dari 3 foto galeri yang sudah ada.
  - **6 Tema Eksklusif**:
    1. *Film Noir (35mm Kodak Tri-X)*
    2. *Haru Pastel (Korean Life Four Cuts)*
    3. *Y2K Cyber (Neon Synthwave)*
    4. *Vintage Sepia (Antique Newspaper)*
    5. *Minimal Luxury (Vogue Atelier)*
    6. *Matcha Cute (Sage Green & Doodles)*
- 📲 **Soft File via QR Code Instan**: Setelah sesi foto berakhir, soft file strip dan foto langsung dapat diunduh ke smartphone pengguna via pemindaian kode QR otomatis.
- 🔐 **Sistem Autentikasi & Cyber Security Hardened**:
  - **Auth Gate**: Halaman Masuk/Daftar wajib sebelum memulai photobooth.
  - **Metode Login Tambahan**: Opsi masuk dengan Akun Google, Apple ID, serta Masuk Cepat sebagai Tamu Kios tanpa kata sandi.
  - Proteksi Helmet, Content Security Policy (CSP), HTTP Strict Rate Limiting, Validasi Magic Bytes, RBAC, dan Safe HttpOnly Cookie Session.
  - Dashboard panel admin untuk kelola pengguna dan role.
  - Akun admin bawaan: `admin` / `admin123`.

---

## Menjalankan dengan Node.js & React

### 1. Instalasi Dependensi
```bash
# Instal backend Node.js
npm install

# Instal frontend React (Vite)
cd frontend
npm install
cd ..
```

### 2. Jalankan Mode Pengembangan (React + Node.js)
```bash
npm run dev
```
- **React Frontend**: `http://localhost:5173`
- **Node.js Backend**: `http://localhost:3000`

### 3. Build & Jalankan Mode Produksi (Single Server)
```bash
npm run build
npm start
```
Aplikasi React + Node.js akan aktif penuh di `http://localhost:3000`.

---

## Menjalankan dengan Python & Flask

Jika ingin tetap menggunakan server Python:
```bash
.\.venv\Scripts\activate
python app.py
```
Akses di `http://localhost:5000`.

---

## Pengujian
```bash
.\.venv\Scripts\python.exe -m unittest discover tests
```
