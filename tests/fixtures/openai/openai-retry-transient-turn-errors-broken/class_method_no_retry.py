class Agent:
    def take_turn(self, input_items):
        try:
            return self.client.responses.create(model="computer-use-preview", input=input_items)
        except Exception as exc:
            self.logger.error("turn failed: %s", exc)
            raise
