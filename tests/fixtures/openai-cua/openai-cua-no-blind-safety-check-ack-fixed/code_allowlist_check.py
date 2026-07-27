ALLOWED_CODES = {"malicious_instructions", "irrelevant_domain"}


def acknowledge_safety_checks(pending_safety_checks):
    return [c for c in pending_safety_checks if c.code in ALLOWED_CODES]
