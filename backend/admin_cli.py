#!/usr/bin/env python3
"""
Divine Yoga Studio - Admin Management CLI
Use this tool to create, reset passwords, and inspect admin accounts in production.
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from core.database import client, ensure_connection, get_db
from core.security import hash_password, now_iso, record_id if hasattr(sys.modules.get('core.security'), 'record_id') else None
import uuid

def gen_id():
    return str(uuid.uuid4())

async def list_admins():
    await ensure_connection()
    db = get_db()
    admins = await db.admin_users.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    print(f"\n--- Admin Users ({len(admins)}) ---")
    for admin in admins:
        print(f"ID: {admin.get('id')} | Email: {admin.get('email')} | Display Name: {admin.get('display_name', 'N/A')} | MFA: {admin.get('mfa_enabled', False)}")
    print("---------------------------------\n")

async def reset_password(email: str, new_password: str):
    await ensure_connection()
    db = get_db()
    email_clean = email.strip().lower()
    admin = await db.admin_users.find_one({"email": email_clean})
    if not admin:
        print(f"Error: Admin account with email '{email_clean}' not found.")
        sys.exit(1)
    
    new_hash = hash_password(new_password)
    await db.admin_users.update_one(
        {"email": email_clean},
        {"$set": {"password_hash": new_hash, "failed_login_attempts": 0, "locked_until": None, "updated_at": now_iso()}}
    )
    print(f"Success: Password for '{email_clean}' updated successfully.")

async def create_admin(email: str, password: str, display_name: str):
    await ensure_connection()
    db = get_db()
    email_clean = email.strip().lower()
    existing = await db.admin_users.find_one({"email": email_clean})
    if existing:
        print(f"Error: Admin account '{email_clean}' already exists.")
        sys.exit(1)
    
    new_admin = {
        "id": gen_id(),
        "email": email_clean,
        "display_name": display_name,
        "password_hash": hash_password(password),
        "mfa_enabled": False,
        "failed_login_attempts": 0,
        "locked_until": None,
        "refresh_version": 0,
        "created_at": now_iso(),
        "updated_at": now_iso()
    }
    await db.admin_users.insert_one(new_admin)
    print(f"Success: Created new admin user '{email_clean}'.")

def main():
    parser = argparse.ArgumentParser(description="Divine Yoga Studio Admin Management CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # list-admins
    subparsers.add_parser("list-admins", help="List all admin accounts")

    # reset-password
    reset_parser = subparsers.add_parser("reset-password", help="Reset password for an admin user")
    reset_parser.add_argument("--email", required=True, help="Admin email address")
    reset_parser.add_argument("--password", required=True, help="New password (min 10 chars)")

    # create-admin
    create_parser = subparsers.add_parser("create-admin", help="Create a new admin user")
    create_parser.add_argument("--email", required=True, help="Admin email address")
    create_parser.add_argument("--password", required=True, help="Password for new admin")
    create_parser.add_argument("--name", default="Studio Admin", help="Display name for admin")

    args = parser.parse_args()

    try:
        if args.command == "list-admins":
            asyncio.run(list_admins())
        elif args.command == "reset-password":
            if len(args.password) < 10:
                print("Error: Password must be at least 10 characters long.")
                sys.exit(1)
            asyncio.run(reset_password(args.email, args.password))
        elif args.command == "create-admin":
            if len(args.password) < 10:
                print("Error: Password must be at least 10 characters long.")
                sys.exit(1)
            asyncio.run(create_admin(args.email, args.password, args.name))
    finally:
        client.close()

if __name__ == "__main__":
    main()
