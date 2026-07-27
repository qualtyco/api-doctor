from lib.client import supabase


def handle_record_updated(payload):
    print("update", payload)


def subscribe_messages(user_id: str):
    return (
        supabase.channel("room1")
        .on_postgres_changes(
            "UPDATE",
            schema="public",
            table="messages",
            filter=f"receiver_id=eq.{user_id}",
            callback=handle_record_updated,
        )
        .subscribe()
    )
