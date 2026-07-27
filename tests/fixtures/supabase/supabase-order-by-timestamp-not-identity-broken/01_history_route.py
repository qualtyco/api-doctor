from lib.client import supabase


def get_history():
    return (
        supabase.table("history")
        .select("id, action, created_at")
        .order("id")
        .execute()
    )
