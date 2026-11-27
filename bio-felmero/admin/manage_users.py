#!/usr/bin/env python3
"""Admin-only, local provisioner. Never commit credentials or passwords."""
import argparse
import getpass
import re
import secrets
import string
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import auth, credentials, firestore

PROJECT_ID = "deeptutor-bio"
VALID = re.compile(r"^[a-z][a-z0-9._-]{2,31}$")
DOMAIN = "deeptutor-bio.firebaseapp.com"

def normalize(value):
    username = value.strip().lower()
    if not VALID.fullmatch(username):
        raise SystemExit("3–32 karakter, betűvel kezdődjön; kisbetű, szám, pont, kötőjel, aláhúzás.")
    return username

def email_for(name):
    return "student-" + normalize(name) + "@" + DOMAIN

def initialize():
    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.ApplicationDefault(), {"projectId": PROJECT_ID})
    return firestore.client()

def password():
    chars = string.ascii_letters + string.digits + "-_!@#$%"
    return "".join(secrets.choice(chars) for _ in range(20))

def selected_password(manual=False):
    if not manual:
        return password()
    selected = getpass.getpass("Választott jelszó (nem jelenik meg): ")
    check = getpass.getpass("Jelszó még egyszer: ")
    if selected != check:
        raise SystemExit("A jelszavak nem egyeznek.")
    if len(selected) < 12 or len(selected) > 128:
        raise SystemExit("A jelszó legalább 12 és legfeljebb 128 karakter legyen.")
    if not (any(c.islower() for c in selected) and any(c.isupper() for c in selected)
            and any(c.isdigit() for c in selected)
            and any(not c.isalnum() for c in selected)):
        raise SystemExit("Kisbetű, nagybetű, szám és speciális karakter is szükséges.")
    return selected

def add(db, name, manual=False):
    name = normalize(name)
    email = email_for(name)
    try:
        auth.get_user_by_email(email)
        raise SystemExit("Ilyen felhasználónév már létezik.")
    except auth.UserNotFoundError:
        pass
    pwd = selected_password(manual)
    user = auth.create_user(email=email, password=pwd, display_name=name, disabled=False)
    try:
        db.collection("users").document(user.uid).set({
            "username": name, "role": "student", "active": True,
            "createdAt": datetime.now(timezone.utc),
        })
    except Exception:
        auth.update_user(user.uid, disabled=True)
        raise
    print("Fiók létrehozva. Felhasználónév:", name, "UID:", user.uid)
    print("EGYSZERI kezdeti jelszó:", pwd)
    print("A jelszót kizárólag biztonságos csatornán add át. Nem kerül fájlba vagy GitHubra.")

def disable(db, name):
    user = auth.get_user_by_email(email_for(name))
    auth.update_user(user.uid, disabled=True)
    db.collection("users").document(user.uid).update({"active": False})
    print("Fiók letiltva:", name)

def reset(db, name, manual=False):
    user = auth.get_user_by_email(email_for(name))
    new_pass = selected_password(manual)
    auth.update_user(user.uid, password=new_pass)
    print("Jelszó visszaállítva:", name)
    print("ÚJ EGYSZERI jelszó:", new_pass)

def main():
    parser = argparse.ArgumentParser(description="DeepTutor admin user management")
    parser.add_argument("command", choices=["add", "disable", "reset"])
    parser.add_argument("username")
    parser.add_argument("--choose-password", action="store_true", help="Jelszó kézi megadása biztonságos getpass promptban")
    args = parser.parse_args()
    db = initialize()
    if args.command == "add": add(db, args.username, args.choose_password)
    elif args.command == "disable": disable(db, args.username)
    else: reset(db, args.username, args.choose_password)

if __name__ == "__main__":
    main()
