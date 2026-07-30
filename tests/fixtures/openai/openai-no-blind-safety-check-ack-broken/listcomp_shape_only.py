def acknowledge_safety_checks(pending_safety_checks):
    return [c for c in pending_safety_checks if c is not None]
