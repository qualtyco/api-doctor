from lib.client import supabase


def log_history_event(action: str, note: str):
    if isinstance(action, str) and isinstance(note, str):
        if len(action) > 200:
            raise ValueError("action too long")
        # `note` gets the same typeof-style validation but no length cap —
        # likely an oversight given `action`'s cap right above it.
        supabase.table("history").insert({"action": action, "note": note}).execute()
