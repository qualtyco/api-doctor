"""Backend validator plugin re-scanning the whole document on every transaction."""


def append_transaction(transactions, old_state, new_state):
    errors = []
    for node in new_state.doc.descendants():
        if node.type.name == "invalid":
            errors.append(node)
    return new_state.tr
