import re

from lib.client import supabase

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)


def link_account(user_id, provider):
    if isinstance(user_id, str) and UUID_RE.match(user_id):
        supabase.table("accounts").upsert({"user_id": user_id, "provider": provider}).execute()


def log_non_uuid_named_field(order_ref, note):
    # order_ref does not look like a uuid-typed tenant column name
    # (no `_id` suffix) — out of scope regardless of validation depth.
    if isinstance(order_ref, str) and isinstance(note, str):
        supabase.table("logs").insert({"order_ref": order_ref, "note": note}).execute()
