class ComputerAgent:
    ALLOWED_DOMAIN_LIST = ("example.com",)

    def run_step(self, action):
        if action.get("type") == "fill":
            if self.page.url_origin not in self.ALLOWED_DOMAIN_LIST:
                return
            self.page.fill(action["selector"], action["value"])
