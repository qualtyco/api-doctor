from lib.client import supabase


def get_role_from_profiles(user_id: str):
    response = (
        supabase.table("profiles")
        .select("role")
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    return response.data["role"]


def get_display_name(user):
    # A non-authz key read from user_metadata is fine — only the authz
    # keyset (role/roles/admin/is_admin/permission/permissions) is flagged.
    return user.user_metadata.get("display_name")
