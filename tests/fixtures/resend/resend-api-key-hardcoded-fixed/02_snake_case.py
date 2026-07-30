# False-positive regression: snake_case names starting with `re_` (the audit's
# dominant FP was the DB column re_activate_available_at) are not Resend keys.
import os

import resend

resend.api_key = os.environ["RESEND_API_KEY"]

REACTIVATION_SQL = "UPDATE users SET re_activate_available_at = NOW() WHERE id = %s"
FLAG_COLUMNS = ["re_engagement_score", "re_invite_count"]


def schedule_reactivation(cursor, user_id: str) -> None:
    cursor.execute(REACTIVATION_SQL, (user_id,))
