from supabase import create_client

# Not sourced from os.environ at all — out of scope for this rule regardless
# of whether the literal is "valid".
supabase = create_client("https://example.supabase.co", "public-anon-key")


def make_test_client(url: str, key: str):
    # Plain function params, not env-derived — should not be flagged either.
    return create_client(url, key)
