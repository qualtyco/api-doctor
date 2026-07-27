from lib.client import supabase


def log_history_event(action: str, note: str):
    if isinstance(action, str) and isinstance(note, str):
        if len(action) > 200:
            raise ValueError("action too long")
        if len(note) > 500:
            raise ValueError("note too long")
        supabase.table("history").insert({"action": action, "note": note}).execute()
