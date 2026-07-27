from postgrest.exceptions import APIError

from lib.client import supabase


def get_project(project_id: str):
    try:
        response = supabase.table("projects").select("*").eq("id", project_id).single().execute()
    except APIError as exc:
        raise LookupError(f"project {project_id} not found") from exc
    return response.data
