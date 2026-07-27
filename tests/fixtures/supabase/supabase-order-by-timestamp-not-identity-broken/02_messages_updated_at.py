from lib.client import supabase


def list_messages():
    return (
        supabase.table("messages")
        .select("id, body, updated_at")
        .order("id", desc=True)
        .execute()
    )
