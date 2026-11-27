#!/usr/bin/env python3
"""Privát, adminisztrátori Firestore-export. Titkos service accountot NE commitolj!"""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

def main():
    if len(sys.argv) != 2:
        sys.exit("Használat: python export_firestore.py output.json")
    if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        sys.exit("Állítsd be a GOOGLE_APPLICATION_CREDENTIALS változót a privát service-account JSON útvonalára.")
    import firebase_admin
    from firebase_admin import credentials, firestore
    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.ApplicationDefault())
    db = firestore.client()
    results = []
    for doc in db.collection("attempts").stream():
        d = doc.to_dict() or {}
        for key in ("startedAt","submittedAt"):
            if isinstance(d.get(key), datetime):
                d[key] = d[key].astimezone(timezone.utc).isoformat()
        results.append(d)
    out = Path(sys.argv[1])
    out.write_text(json.dumps(results, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    print(f"{len(results)} rekord exportálva: {out.resolve()}")
if __name__ == "__main__":
    main()
