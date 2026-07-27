from lib.client import supabase


def send_reply(thread_id: str, body: str):
    try:
        response = supabase.table("replies").update({"body": body}).eq("thread_id", thread_id).execute()
    except Exception:
        ...
    return response
