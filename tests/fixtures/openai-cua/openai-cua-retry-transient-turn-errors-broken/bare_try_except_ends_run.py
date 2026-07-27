def run_turn(client, input_items):
    try:
        response = client.responses.create(model="computer-use-preview", input=input_items)
    except Exception as exc:
        print(f"turn failed: {exc}")
        return None
    return response
