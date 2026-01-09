"""Add pay_periods table for REQ-006

Revision ID: 006_pay_periods
Revises: 005_notify_settings
Create Date: 2026-01-10
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "006_pay_periods"
down_revision = "005_notify_settings"
branch_labels = None
depends_on = None


def upgrade():
    """Create pay_periods table for confirmed pay periods."""
    op.create_table(
        "pay_periods",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("confirmed_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
    )
    op.create_index("ix_pay_periods_start_date", "pay_periods", ["start_date"], unique=True)
    op.create_index("ix_pay_periods_end_date", "pay_periods", ["end_date"], unique=False)


def downgrade():
    """Drop pay_periods table."""
    op.drop_index("ix_pay_periods_end_date", table_name="pay_periods")
    op.drop_index("ix_pay_periods_start_date", table_name="pay_periods")
    op.drop_table("pay_periods")
