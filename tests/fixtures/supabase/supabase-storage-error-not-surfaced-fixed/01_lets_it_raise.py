from lib.client import supabase


def save_avatar(user_id: str, file, avatar_url: str):
    path = f"{user_id}/avatar.png"
    # No try/except — a failed upload raises visibly, so the profile update
    # below never runs on a stale URL.
    supabase.storage.from_("avatars").upload(path=path, file=file)
    supabase.table("profiles").update({"avatar_url": avatar_url}).eq("user_id", user_id).execute()
