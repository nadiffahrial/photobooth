# Snap Studio Photobooth (Dual-Stack: Node.js + React & Python + Flask)

Aplikasi photobooth modern dengan dua pilihan teknologi yang saling terintegrasi dan berbagi database SQLite (`photobooth.db`) serta folder foto (`photos/`):

1. **Stack Node.js & React (Vite + Express)**
2. **Stack Python & Flask (Jinja2 + SQLite)**

---

## Fitur Utama

- 📸 **Live Webcam Stream**: Pratinjau kamera waktu nyata dengan rotasi mirror dan peralihan kamera depan/belakang (*environment/user*).
- 🎞️ **Photobooth 3-Strip Vertical Builder**:
  - Mode burst otomatis dengan hitung mundur 3 detik per pose (Pose 1/3, 2/3, 3/3) & efek flash lampu.
  - Opsi buat strip dari 3 foto galeri yang sudah ada.
  - **6 Tema Eksklusif**:
    1. *Film Noir (35mm Kodak Tri-X)*
    2. *Haru Pastel (Korean Life Four Cuts)*
    3. *Y2K Cyber (Neon Synthwave)*
    4. *Vintage Sepia (Antique Newspaper)*
    5. *Minimal Luxury (Vogue Atelier)*
    6. *Matcha Cute (Sage Green & Doodles)*
  - Unduh strip kualitas tinggi (800 × 1980 px) atau simpan langsung ke galeri cloud.
- ✨ **AI Smart Assistant (Google Gemini)**:
  - Ide Pose Photobooth otomatis (`/api/ai/pose`).
  - Pembuat Caption Instagram estetik otomatis (`/api/photos/:filename/caption`).
- 🔐 **Sistem Autentikasi & Role**:
  - Role **Admin** dan **User**.
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
