from lib.client import supabase


def is_admin(user) -> bool:
    return user.user_metadata.get("role") == "admin"


def get_user_role(user):
    return user.user_metadata["role"]
