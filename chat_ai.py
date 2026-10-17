import os
from dotenv import load_dotenv
from google import genai

# Load API key dari .env
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("Error: GEMINI_API_KEY tidak ditemukan di file .env")
    exit(1)

client = genai.Client(api_key=api_key)

print("=" * 55)
print("🤖 AI Chatbot Siap Digunakan!")
print("Ketik pertanyaan Anda lalu tekan Enter.")
print("Ketik 'keluar' atau 'exit' untuk berhenti.")
print("=" * 55)

# Mulai sesi percakapan (mempertahankan konteks obrolan)
chat = client.chats.create(model="gemini-flash-lite-latest")

while True:
    try:
        user_input = input("\nAnda: ").strip()
        if not user_input:
            continue
        if user_input.lower() in ["keluar", "exit", "quit"]:
            print("Sampai jumpa!")
            break

        print("AI sedang berpikir...", end="\r")
        response = chat.send_message(user_input)
        print(f"AI: {response.text}")
    except KeyboardInterrupt:
        print("\nSelesai.")
        break
    except Exception as e:
        print(f"\nTerjadi kesalahan: {e}")

