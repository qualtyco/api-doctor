from lib.client import supabase


def save_for_later(user_id: str, item_id: str):
    # No try/except at all — a failure raises postgrest.exceptions.APIError
    # and propagates to the caller/framework, which is the safe default in
    # Python (unlike the JS SDK, which resolves silently to { error }).
    supabase.table("saved_items").insert({"user_id": user_id, "item_id": item_id}).execute()
