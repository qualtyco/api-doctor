import json


def extract_step_metadata(response):
    for item in response.output:
        if item.type == "function_call" and item.name == "report_step":
            return json.loads(item.arguments)
    return None
