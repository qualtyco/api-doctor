from lib.client import supabase


def list_plain_ids():
    # No timestamp column selected — ordering by "id" is not a smell here.
    return supabase.table("tags").select("id, name").order("id").execute()


def list_history_two_calls():
    query = supabase.table("history").select("id, created_at")
    # Chained onto a variable, not a literal CallExpression — chain-state
    # tracking can't link back to the `.select()` here (same limitation as
    # the JS rule's chainObjectCall), so this is a known blind spot rather
    # than a validated safe case.
    return query.order("id").execute()
