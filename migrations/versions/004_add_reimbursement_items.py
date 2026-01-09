"""Add reimbursement_items table for REQ-028

Revision ID: 004_add_reimbursement_items
Revises: 13fe1c13ccd1_add_user_notes_and_admin_notes_to_
Create Date: 2026-01-08 21:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '004_add_reimbursement_items'
down_revision = '13fe1c13ccd1_add_user_notes_and_admin_notes_to_'
branch_labels = None
depends_on = None


def upgrade():
    """Create reimbursement_items table for multiple expense line items per timesheet."""
    op.create_table(
        'reimbursement_items',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('timesheet_id', sa.String(36), sa.ForeignKey('timesheets.id'), nullable=False, index=True),
        sa.Column('expense_type', sa.String(20), nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False, server_default='0.00'),
        sa.Column('expense_date', sa.Date, nullable=True),
        sa.Column('notes', sa.String(200), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )


def downgrade():
    """Remove reimbursement_items table."""
    op.drop_table('reimbursement_items')
