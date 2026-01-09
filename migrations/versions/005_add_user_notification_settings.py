"""Add user notification settings fields

Revision ID: 005_notify_settings
Revises: 004_reimb_items
Create Date: 2026-01-10
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "005_notify_settings"
down_revision = "004_reimb_items"
branch_labels = None
depends_on = None


def upgrade():
    """Add notification preferences and contact lists to users table."""
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("email_opt_in", sa.Boolean(), nullable=False, server_default=sa.text("true"))
        )
        batch_op.add_column(
            sa.Column("teams_opt_in", sa.Boolean(), nullable=False, server_default=sa.text("true"))
        )
        batch_op.add_column(sa.Column("notification_emails", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("notification_phones", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("teams_account", sa.String(length=255), nullable=True))


def downgrade():
    """Remove notification preferences and contact lists from users table."""
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("teams_account")
        batch_op.drop_column("notification_phones")
        batch_op.drop_column("notification_emails")
        batch_op.drop_column("teams_opt_in")
        batch_op.drop_column("email_opt_in")
