def run_step(client, input_items):
    response = client.responses.create(model="computer-use-preview", input=input_items)
    if response.status == "incomplete":
        raise RuntimeError("response truncated by token budget")

    computer_calls = [item for item in response.output if item.type == "computer_call"]
    if not computer_calls:
        return {"success": True, "output": response.output_text}
    return {"success": False}
