import os
from pathlib import Path
from dotenv import load_dotenv

# Membaca API key dari file .env
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key or api_key == "masukkan_api_key_anda_di_sini":
    print("=" * 60)
    print("PERINGATAN: GEMINI_API_KEY belum disetel!")
    print("1. Buka https://aistudio.google.com/ untuk mendapatkan API key gratis.")
    print("2. Buat file .env di folder ini dan isi dengan:")
    print("   GEMINI_API_KEY=AIzaSy...")
    print("=" * 60)
    exit(1)

from google import genai

# Inisialisasi client Google GenAI
client = genai.Client(api_key=api_key)

print("Menghubungkan ke Gemini AI...")

# Coba panggil model dengan fallback otomatis jika server sedang sibuk
models_to_try = ["gemini-flash-lite-latest", "gemini-flash-latest"]
response = None

for model_name in models_to_try:
    try:
        response = client.models.generate_content(
            model=model_name,
            contents="Halo Gemini! Jelaskan peranmu sebagai AI Agent dalam 2 kalimat singkat."
        )
        print(f"Berhasil menggunakan model: {model_name}")
        break
    except Exception as e:
        print(f"Model {model_name} sedang sibuk, mencoba model alternatif...")

if response:
    print("\nRespon dari Gemini AI:")
    print("-" * 40)
    print(response.text)
    print("-" * 40)
    print("Selamat! AI gratis Anda sudah aktif dan siap digunakan.")
else:
    print("Gagal menghubungi server Gemini. Silakan coba beberapa saat lagi.")

