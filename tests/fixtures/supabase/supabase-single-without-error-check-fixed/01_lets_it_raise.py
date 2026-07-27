from lib.client import supabase


def get_project(project_id: str):
    # No try/except — a missing/denied row raises visibly instead of
    # returning a silently undefined result.
    response = supabase.table("projects").select("*").eq("id", project_id).single().execute()
    return response.data
