from lib.client import supabase


def replace_education(user_id: str, rows: list[dict]):
    # No try/except — a failed insert after a successful delete raises
    # visibly instead of disappearing silently.
    supabase.table("education").delete().eq("user_id", user_id).execute()
    for row in rows:
        supabase.table("education").insert({"user_id": user_id, **row}).execute()
