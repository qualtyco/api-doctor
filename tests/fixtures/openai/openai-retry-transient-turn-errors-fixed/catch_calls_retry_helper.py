def run_turn(client, input_items):
    try:
        return client.responses.create(model="computer-use-preview", input=input_items)
    except Exception as exc:
        return retry_turn(client, input_items, exc)


def retry_turn(client, input_items, original_error):
    return client.responses.create(model="computer-use-preview", input=input_items)
