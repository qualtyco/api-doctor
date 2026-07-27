import uuid

from lib.client import supabase


def log_history_event(user_id: str, action: str):
    supabase.table("history").insert(
        {"id": str(uuid.uuid4()), "user_id": user_id, "action": action}
    ).execute()
