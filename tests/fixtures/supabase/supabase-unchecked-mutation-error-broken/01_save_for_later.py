from lib.client import supabase


def save_for_later(user_id: str, item_id: str):
    try:
        supabase.table("saved_items").insert({"user_id": user_id, "item_id": item_id}).execute()
    except Exception:
        # Swallowed — the caller has no way to know the write failed, so
        # optimistic UI state silently diverges from the database.
        pass
