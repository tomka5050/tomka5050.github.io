#!/usr/bin/env python3
"""Kérdésbank és biztonsági ellenőrzés; python validate_questions.py"""
import json
from pathlib import Path
f=Path(__file__).resolve().parents[1]/"questions.json"
v=json.loads(f.read_text(encoding="utf-8"))
qs=v["questions"]
assert len(qs)==40
assert [x["id"] for x in qs]==["BIO-"+str(i).zfill(3) for i in range(1,41)]
assert len(set(x["id"] for x in qs))==40
assert len([x for x in qs if x["kind"]=="text"])==6
assert len([x for x in qs if x["kind"]=="single"])==34
assert all(x["topic"] in {t["id"] for t in v["topics"]} for x in qs)
assert all(x["kind"]=="text" or [o["id"] for o in x["options"]]==list("ABCD") for x in qs)
assert not any("correct" in x or "solution" in x or "answer" in x for x in qs)
print("OK: 40 egyedi kérdés, hat témakör, nincs nyilvános javítókulcs.")
