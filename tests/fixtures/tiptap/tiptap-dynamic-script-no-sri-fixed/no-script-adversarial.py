"""Adversarial: strings that mention scripts/src but never form a <script> tag."""


def describe_setup() -> str:
    return "Add the src attribute to your script config and set integrity separately."


CONFIG = {"note": "src=embed.js is configured via the build pipeline, not inline HTML"}
