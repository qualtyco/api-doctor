from lib.client import supabase


def list_orders():
    return (
        supabase.table("orders")
        .select("id, user_id, total")
        .order("created_at", desc=True)
        .execute()
    )
