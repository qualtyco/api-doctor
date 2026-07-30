def run_step(client, input_items):
    response = client.responses.create(model="computer-use-preview", input=input_items)
    computer_calls = [item for item in response.output if item.type == "computer_call"]
    if not computer_calls:
        if response.status == "incomplete":
            return {"success": False, "reason": "truncated"}
        return {"success": True, "output": response.output_text}
    return {"success": False}
