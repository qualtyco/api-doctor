from lib.client import supabase


def get_project(project_id: str):
    try:
        response = (
            supabase.table("projects")
            .select("*")
            .eq("id", project_id)
            .single()
            .execute()
        )
    except Exception:
        pass
    return response
