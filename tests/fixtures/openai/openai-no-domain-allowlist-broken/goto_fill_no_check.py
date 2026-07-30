class ComputerAgent:
    def run_step(self, action):
        if action.get("type") == "goto":
            self.page.goto(action["url"])
        elif action.get("type") == "fill":
            self.page.fill(action["selector"], action["value"])
