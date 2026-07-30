class Agent:
    def take_turn(self, input_items, user_id):
        return self.client.responses.create(
            model="computer-use-preview",
            input=input_items,
            user=user_id,
        )
