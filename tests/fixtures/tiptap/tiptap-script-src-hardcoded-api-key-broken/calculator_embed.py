"""Flask view that server-renders the Tiptap desmos/calculator node-view embed."""
from flask import Response


def render_calculator_embed():
    script_tag = {}
    script_tag["src"] = "https://www.api.example.com/v1.11/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6"
    html = f'<script src="{script_tag["src"]}"></script>'
    return Response(html, mimetype="text/html")
