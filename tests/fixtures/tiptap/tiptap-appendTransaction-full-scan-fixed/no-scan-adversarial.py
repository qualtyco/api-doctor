"""Adversarial: appendTransaction that never scans the document at all."""


def append_transaction(transactions, old_state, new_state):
    if not transactions:
        return None
    return new_state.tr
