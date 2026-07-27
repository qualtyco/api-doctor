from lib.client import supabase


def upload_resume(user_id: str, file):
    path = f"resumes/{user_id}.pdf"
    try:
        response = supabase.storage.from_("documents").upload(path=path, file=file)
    except Exception:
        ...
    return path
