from lib.client import supabase


def sign_up_as_admin(email: str, password: str):
    return supabase.auth.sign_up(
        {
            "email": email,
            "password": password,
            "options": {"data": {"role": "admin"}},
        }
    )


def promote_current_user():
    return supabase.auth.update_user({"data": {"is_admin": True}})
