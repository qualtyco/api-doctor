"""Flask view that reads the calculator embed API key from the environment."""
import os

from flask import Response


def render_calculator_embed():
    script_tag = {}
    script_tag["src"] = f"https://www.api.example.com/v1.11/calculator.js?apiKey={os.environ['CALCULATOR_API_KEY']}"
    html = f'<script src="{script_tag["src"]}"></script>'
    return Response(html, mimetype="text/html")
