from lib.client import supabase


def handle_broadcast(payload):
    print(payload)


def subscribe_broadcast():
    channel = supabase.channel("room1")
    # on_broadcast is a different event type entirely — should not be
    # confused with the postgres_changes filter requirement.
    return channel.on_broadcast(event="cursor-pos", callback=handle_broadcast).subscribe()
