import sqlite3
import time
import json

db_path = r"C:\Users\PC\AppData\Roaming\OmniVoice\omnivoice.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

voices = [
    (
        "noan_female_cooking",
        "NOAN Bếp Việt Nữ (VoiceStudio Warm)",
        "",
        "",
        "female, young adult, moderate pitch",
        "Vietnamese",
        "",
        42,
        0,
        "casual",
        "Giọng nữ trẻ trung, ấm áp, nhịp điệu từ tốn, phát âm rõ ràng nguyên liệu và bước nấu ăn.",
        0,
        1,
        "",
        "",
        None,
        "design",
        json.dumps({"Gender": "female", "Age": "young adult", "Pitch": "moderate pitch"}),
        time.time(),
    ),
    (
        "noan_male_cooking",
        "NOAN Bếp Việt Nam (VoiceStudio Companion)",
        "",
        "",
        "male, young adult, moderate pitch",
        "Vietnamese",
        "",
        42,
        0,
        "casual",
        "Giọng nam ấm áp, vui tươi, trầm ấm tự nhiên, phù hợp bạn đồng hành vào bếp cùng NOAN.",
        0,
        1,
        "",
        "",
        None,
        "design",
        json.dumps({"Gender": "male", "Age": "young adult", "Pitch": "moderate pitch"}),
        time.time(),
    ),
    (
        "noan_mascot",
        "NOAN Mascot Vàng (VoiceStudio Friendly)",
        "",
        "",
        "young adult, moderate pitch",
        "Vietnamese",
        "",
        42,
        0,
        "casual",
        "Giọng mascot NOAN vui vẻ, nhẹ nhàng, năng động, hướng dẫn từng bước chi tiết.",
        0,
        1,
        "",
        "",
        None,
        "design",
        json.dumps({"Gender": "Auto", "Age": "young adult", "Pitch": "moderate pitch"}),
        time.time(),
    ),
]

for v in voices:
    cur.execute(
        """
        INSERT OR REPLACE INTO voice_profiles 
        (id, name, ref_audio_path, ref_text, instruct, language, locked_audio_path, seed, is_locked, personality, description, is_demo, verified_own_voice, consent_text, consent_audio_path, consent_recorded_at, kind, vd_states, created_at) 
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        v,
    )

conn.commit()
print("Successfully inserted 3 VoiceStudio cooking voice profiles!")
