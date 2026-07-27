from lib.client import supabase


def log_history_event(session_id, action):
    if isinstance(session_id, str) and isinstance(action, str):
        supabase.table("history").insert({"session_id": session_id, "action": action}).execute()
