"""Fixed: the auto-correction transaction is excluded from undo history."""


def append_transaction(transactions, old_state, new_state):
    tr = new_state.tr
    for transaction in transactions:
        if transaction.doc_changed:
            tr.insert_text(0, " ")
    tr.set_meta("addToHistory", False)
    return tr
