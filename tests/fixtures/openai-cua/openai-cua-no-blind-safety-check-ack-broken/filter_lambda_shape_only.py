def acknowledge(safety_checks):
    return list(filter(lambda check: isinstance(check, dict), safety_checks))
