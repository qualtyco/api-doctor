from lib.client import supabase


def handle_insert(payload):
    pass


def handle_delete(payload):
    pass


def subscribe_countries():
    return (
        supabase.channel("room1")
        .on_postgres_changes("INSERT", schema="public", table="countries", callback=handle_insert)
        .on_postgres_changes("DELETE", schema="public", table="countries", callback=handle_delete)
        .subscribe()
    )
