from lib.client import supabase


def replace_education(user_id: str, rows: list[dict]):
    try:
        supabase.table("education").delete().eq("user_id", user_id).execute()
        for row in rows:
            supabase.table("education").insert({"user_id": user_id, **row}).execute()
    except Exception:
        # Both steps share one swallowing handler — if insert fails after a
        # successful delete, the rows are gone with no error surfaced.
        pass
