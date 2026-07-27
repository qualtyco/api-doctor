from lib.client import supabase


def create_orders(rows: list[dict]):
    payload = [{"user_id": row["user_id"], "total": row["total"]} for row in rows]
    supabase.table("orders").insert(payload).execute()
