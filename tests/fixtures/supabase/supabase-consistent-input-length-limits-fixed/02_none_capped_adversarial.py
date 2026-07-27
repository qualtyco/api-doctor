from lib.client import supabase


def create_profile(bio: str, tagline: str):
    # Neither sibling has a length cap — out of scope: this rule only fires
    # on an *inconsistency* between siblings, not on a missing cap alone.
    if isinstance(bio, str) and isinstance(tagline, str):
        supabase.table("profiles").insert({"bio": bio, "tagline": tagline}).execute()
