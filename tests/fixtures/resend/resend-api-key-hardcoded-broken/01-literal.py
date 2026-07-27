import resend
resend.api_key = "re_1234567890abcdef_hardcoded"
resend.Emails.send({"from": "Acme <a@acme.com>", "to": "u@x.com", "subject": "Hi", "html": "<p>x</p>"})
