"""Auto-spacing correction plugin, ported from the JS appendTransaction hook."""


def appendTransaction(transactions, old_state, new_state):
    tr = new_state.tr
    tr.replace_range(0, 1, None)
    return tr
