import json


class StepParser:
    def parse(self, text):
        idx = text.index("{")
        return json.loads(text[idx:])
