from lib.client import supabase


def create_profile(bio: str, tagline):
    if isinstance(bio, str) and isinstance(tagline, str):
        if len(bio) > 2000:
            raise ValueError("bio too long")
        # `tagline or ""` — the left side (tagline) is what was validated;
        # resolve_dict_value_name must see through the fallback.
        supabase.table("profiles").insert({"bio": bio, "tagline": tagline or ""}).execute()
