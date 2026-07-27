"""Definition-lookup plugin scanning every node on every keystroke."""


def appendTransaction(transactions, old_state, new_state):
    definitions = []
    for node in new_state.doc.descendants():
        if node.type.name == "definition":
            definitions.append(node)
    return None
