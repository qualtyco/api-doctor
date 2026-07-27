"""Adversarial: node registry with no markdown spec, but the file never
imports anything markdown-related — the export pipeline doesn't apply here."""
import tiptap_bridge

CALLOUT_NODE = {"name": "callout", "group": "block"}
WIDGET_NODE = {"name": "widget", "atom": True}
