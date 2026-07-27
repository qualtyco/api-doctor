import time


def run_turn(client, input_items):
    for attempt in range(3):
        try:
            return client.responses.create(model="computer-use-preview", input=input_items)
        except Exception as exc:
            time.sleep(2**attempt)
    raise RuntimeError("turn failed after retries")
