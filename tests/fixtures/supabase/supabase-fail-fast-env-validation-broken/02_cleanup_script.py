import os

from supabase import create_client

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# A cleanup/backfill script — same missing-var risk applies to one-off scripts.
supabase = create_client(url, key)
supabase.table("stale_sessions").delete().eq("expired", True).execute()
