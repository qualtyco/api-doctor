from lib.client import supabase


def replace_experiences(user_id: str, rows: list[dict]):
    try:
        supabase.table("experiences").delete().eq("user_id", user_id).execute()
    except Exception:
        pass

    for row in rows:
        try:
            supabase.table("experiences").insert({"user_id": user_id, **row}).execute()
        except Exception:
            pass
