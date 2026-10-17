# Snap Studio Photobooth

Aplikasi photobooth berbasis Python dan Flask yang menggunakan kamera perangkat melalui browser. Foto hasil capture disimpan sebagai PNG di folder `photos` dan dapat dilihat melalui galeri.

## Persyaratan

- Python 3.10 atau lebih baru
- Browser modern yang mendukung `getUserMedia`, seperti Chrome, Edge, atau Firefox
- Akses kamera diizinkan oleh browser

## Instalasi

```bash
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
```

## Menjalankan

```bash
python app.py
```

Buka `http://localhost:5000` di browser. Pada perangkat yang belum memiliki akses kamera, klik tombol "Aktifkan kamera" dan izinkan permintaan.

## Fitur

- Pratinjau kamera live
- Ambil foto dengan kualitas PNG
- Ganti kamera depan/m Belakang
- Galeri foto terbaru
- Unduh dan hapus foto
- Penyimpanan lokal tanpa upload ke layanan eksternal

## Pengujian

```bash
python -m unittest discover -s tests -v
```

Semua foto disimpan di folder `photos`. Folder tersebut dibuat otomatis saat aplikasi pertama kali dijalankan.
