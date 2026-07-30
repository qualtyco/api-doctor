def handle_action(page, action):
    if action["type"] == "click":
        page.click(action["x"], action["y"])
    elif action["type"] == "type":
        page.type(action["text"])
