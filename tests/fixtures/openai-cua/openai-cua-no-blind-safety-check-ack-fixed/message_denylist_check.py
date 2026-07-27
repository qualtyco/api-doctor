def acknowledge(safety_checks):
    return list(filter(lambda check: "captcha" not in check.get("message", "").lower(), safety_checks))
