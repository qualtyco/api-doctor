"""Custom collaboration backend reimplementing a ProseMirror-style
appendTransaction hook for auto-correcting incoming edits."""


def append_transaction(transactions, old_state, new_state):
    tr = new_state.tr
    for transaction in transactions:
        if transaction.doc_changed:
            tr.insert_text(0, " ")
    return tr
