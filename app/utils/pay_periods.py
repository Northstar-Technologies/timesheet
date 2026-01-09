"""
Pay Period Utilities

Helpers for checking confirmed pay periods (REQ-006).
"""

from ..models import PayPeriod


def get_confirmed_pay_period(target_date):
    """
    Return confirmed pay period containing the given date, if any.

    Args:
        target_date: datetime.date to check

    Returns:
        PayPeriod or None
    """
    if not target_date:
        return None
    return (
        PayPeriod.query.filter(PayPeriod.start_date <= target_date)
        .filter(PayPeriod.end_date >= target_date)
        .first()
    )


def is_pay_period_confirmed(target_date):
    """Check if a date falls within a confirmed pay period."""
    return get_confirmed_pay_period(target_date) is not None
