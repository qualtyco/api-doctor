class Agent:
    def take_turn(self, input_items):
        return self.client.responses.create(
            model="computer-use-preview",
            input=input_items,
            truncation="auto",
        )
