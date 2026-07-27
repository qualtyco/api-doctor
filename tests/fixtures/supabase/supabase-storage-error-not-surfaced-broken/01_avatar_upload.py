from lib.client import supabase


def save_avatar(user_id: str, file, avatar_url: str):
    path = f"{user_id}/avatar.png"
    try:
        supabase.storage.from_("avatars").upload(path=path, file=file)
    except Exception:
        # Swallowed — execution falls through to the profile update below
        # even though the file never actually uploaded.
        pass
    supabase.table("profiles").update({"avatar_url": avatar_url}).eq("user_id", user_id).execute()
