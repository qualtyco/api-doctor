from lib.client import supabase


def link_account(user_id, provider):
    if not isinstance(user_id, str):
        raise ValueError("user_id must be a string")
    supabase.table("accounts").upsert({"user_id": user_id, "provider": provider}).execute()
