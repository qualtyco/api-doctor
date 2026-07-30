def run_turn(client, input_items, customer_id):
    return client.responses.create(
        model="computer-use-preview",
        input=input_items,
        safety_identifier=hash_customer_id(customer_id),
    )
