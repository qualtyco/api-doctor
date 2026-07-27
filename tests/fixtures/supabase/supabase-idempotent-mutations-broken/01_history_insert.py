from lib.client import supabase


def log_history_event(user_id: str, action: str):
    supabase.table("history").insert({"user_id": user_id, "action": action}).execute()
