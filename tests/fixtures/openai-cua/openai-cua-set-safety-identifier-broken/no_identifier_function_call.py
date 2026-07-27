def run_turn(client, input_items):
    return client.responses.create(model="computer-use-preview", input=input_items)
