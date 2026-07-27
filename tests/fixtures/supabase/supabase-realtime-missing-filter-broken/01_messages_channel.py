from lib.client import supabase


def handle_record_updated(payload):
    print("update", payload)


def subscribe_messages():
    return (
        supabase.channel("room1")
        .on_postgres_changes("*", schema="public", table="messages", callback=handle_record_updated)
        .subscribe()
    )
