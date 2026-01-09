"""Add reimbursement_type to attachments (REQ-021)

Revision ID: 007_add_attachment_reimbursement_type
Revises: 006_add_pay_periods
Create Date: 2026-01-09
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "007_add_attachment_reimbursement_type"
down_revision = "006_add_pay_periods"
branch_labels = None
depends_on = None


def upgrade():
    """Add reimbursement_type column to attachments."""
    with op.batch_alter_table("attachments", schema=None) as batch_op:
        batch_op.add_column(sa.Column("reimbursement_type", sa.String(length=20), nullable=True))


def downgrade():
    """Remove reimbursement_type column from attachments."""
    with op.batch_alter_table("attachments", schema=None) as batch_op:
        batch_op.drop_column("reimbursement_type")
