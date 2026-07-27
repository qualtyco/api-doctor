from lib.client import supabase


def is_admin(user) -> bool:
    # app_metadata is server-writable only — safe to gate authorization on.
    return user.app_metadata.get("role") == "admin"


def sign_up_with_profile_data(email: str, password: str, display_name: str):
    return supabase.auth.sign_up(
        {
            "email": email,
            "password": password,
            "options": {"data": {"display_name": display_name}},
        }
    )
