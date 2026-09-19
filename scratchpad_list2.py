import sys
sys.path.insert(0, ".")
from app.db.database import db

for p in db.patients.find({}, {"name": 1}):
    count = db.sessions.count_documents({"patient_id": p["_id"]})
    if count > 0:
        print(f"patient {p['_id']} ({p.get('name')}): {count} sessions")

print()
sessions = list(db.sessions.find({"patient_id": 1}).sort("captured_at", 1))
print(f"Patient 1 sessions in captured_at ASC order (what ProgressPage uses for Before/After):")
for s in sessions:
    print(" ", s["_id"], "|", s.get("image_path"), "|", s.get("captured_at"))
if sessions:
    print("\n-> 'Before' (sessions[0]):", sessions[0]["_id"], sessions[0].get("image_path"))
    print("-> 'After'  (sessions[-1]):", sessions[-1]["_id"], sessions[-1].get("image_path"))
