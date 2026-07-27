"""Adversarial: appendTransaction that reads state but never mutates the transaction."""


def append_transaction(transactions, old_state, new_state):
    tr = new_state.tr
    changed = any(t.doc_changed for t in transactions)
    if changed:
        log_change(new_state)
    return tr


def log_change(state):
    print("state changed")
