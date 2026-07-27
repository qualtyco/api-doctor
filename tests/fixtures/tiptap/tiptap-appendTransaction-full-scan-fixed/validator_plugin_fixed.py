"""Fixed: full document scan is guarded behind a docChanged check."""


def append_transaction(transactions, old_state, new_state):
    doc_changed = any(t.docChanged for t in transactions)
    if not doc_changed:
        return None

    errors = []
    for node in new_state.doc.descendants():
        if node.type.name == "invalid":
            errors.append(node)
    return new_state.tr
