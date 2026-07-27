from lib.client import supabase


def save_avatar(user_id: str, file, avatar_url: str):
    path = f"{user_id}/avatar.png"
    try:
        supabase.storage.from_("avatars").upload(path=path, file=file)
    except Exception as exc:
        # Surfaced to the caller instead of silently continuing.
        return {"error": str(exc)}
    supabase.table("profiles").update({"avatar_url": avatar_url}).eq("user_id", user_id).execute()
    return {"ok": True}
