import resend
resend.api_key = "re_python_hardcoded_key_yyyyyyyy"
resend.Emails.send({"from": "a@b.com", "to": "c@d.com", "subject": "x", "html": "<p>x</p>"})
