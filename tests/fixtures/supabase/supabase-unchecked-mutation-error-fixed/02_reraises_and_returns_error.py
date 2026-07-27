from postgrest.exceptions import APIError

from lib.client import supabase


def send_reply(thread_id: str, body: str):
    try:
        return supabase.table("replies").update({"body": body}).eq("thread_id", thread_id).execute()
    except APIError as exc:
        # Re-raised as a domain error — the caller is still informed.
        raise RuntimeError("failed to send reply") from exc


def cancel_order(order_id: str):
    try:
        supabase.table("orders").update({"status": "cancelled"}).eq("id", order_id).execute()
    except APIError as exc:
        # Not re-raised, but the failure is surfaced by returning it.
        return {"error": str(exc)}
    return {"ok": True}
