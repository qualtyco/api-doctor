import os

from supabase import Client, create_client

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        # No presence check on either env var — a missing one surfaces later
        # as an opaque error deep in a query call instead of a clear message
        # at startup.
        _client = create_client(os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))
    return _client
