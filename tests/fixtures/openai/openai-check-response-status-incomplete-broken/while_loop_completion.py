def run_loop(client, input_items):
    while True:
        response = client.responses.create(model="computer-use-preview", input=input_items)
        if not response.output:
            return {"completed": True}
        input_items = advance(input_items, response)
