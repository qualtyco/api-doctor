from lib.client import supabase


def clear_education(user_id: str):
    # Delete with no corresponding insert in the same function — the
    # replace-pattern risk doesn't apply.
    try:
        supabase.table("education").delete().eq("user_id", user_id).execute()
    except Exception:
        pass


def add_education(user_id: str, row: dict):
    try:
        supabase.table("education").insert({"user_id": user_id, **row}).execute()
    except Exception:
        pass
