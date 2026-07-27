from lib.client import supabase


def upsert_user_settings(user_id: str, theme: str):
    # .upsert() is exempt regardless of payload shape — on_conflict is the
    # documented retry-safety mechanism for this call.
    supabase.table("settings").upsert(
        {"user_id": user_id, "theme": theme}, on_conflict="user_id"
    ).execute()
