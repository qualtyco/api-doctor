from lib.client import supabase


def load_for_edit(record_id: str):
    try:
        record = supabase.table("records").select("*").eq("id", record_id).single().execute()
        return record.data
    except Exception:
        ...
