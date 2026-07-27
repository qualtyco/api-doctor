from lib.client import supabase


def get_history(session_id: str):
    return (
        supabase.table("history")
        .select("id, session_id, action")
        .eq("session_id", session_id)
        .execute()
    )
