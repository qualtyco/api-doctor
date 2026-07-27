from lib.client import supabase


def list_orders(user_id: str):
    return (
        supabase.table("orders")
        .select("id, user_id, total")
        .match({"user_id": user_id})
        .execute()
    )


def get_star_select(user_id: str):
    # select("*") has no named tenant column to flag in the first place.
    return supabase.table("orders").select("*").execute()
