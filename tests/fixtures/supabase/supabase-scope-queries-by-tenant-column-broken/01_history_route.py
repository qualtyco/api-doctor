from lib.client import supabase


def get_history():
    return supabase.table("history").select("id, session_id, action").execute()
