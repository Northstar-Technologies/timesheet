"""Initial schema baseline

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-01-06 15:00:00.000000

This is a baseline migration documenting the initial schema.
The schema was created using db.create_all() before Alembic was set up.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """
    Create initial schema.
    
    Note: These tables already exist if the app ran with db.create_all().
    This migration documents the baseline schema.
    """
    # Users table
    op.create_table('users',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('azure_id', sa.String(255), unique=True, nullable=False),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('display_name', sa.String(255), nullable=False),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('is_admin', sa.Boolean(), default=False, nullable=False),
        sa.Column('sms_opt_in', sa.Boolean(), default=True, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # Timesheets table
    op.create_table('timesheets',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('week_start', sa.Date(), nullable=False, index=True),
        sa.Column('status', sa.String(20), default='NEW', nullable=False, index=True),
        sa.Column('traveled', sa.Boolean(), default=False, nullable=False),
        sa.Column('has_expenses', sa.Boolean(), default=False, nullable=False),
        sa.Column('reimbursement_needed', sa.Boolean(), default=False, nullable=False),
        sa.Column('reimbursement_type', sa.String(20), nullable=True),
        sa.Column('reimbursement_amount', sa.Numeric(10, 2), nullable=True),
        sa.Column('stipend_date', sa.Date(), nullable=True),
        sa.Column('submitted_at', sa.DateTime(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('approved_by', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('user_id', 'week_start', name='uq_user_week'),
    )

    # Timesheet entries table
    op.create_table('timesheet_entries',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('timesheet_id', sa.String(36), sa.ForeignKey('timesheets.id'), nullable=False, index=True),
        sa.Column('entry_date', sa.Date(), nullable=False),
        sa.Column('hour_type', sa.String(20), nullable=False),
        sa.Column('hours', sa.Numeric(4, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # Attachments table
    op.create_table('attachments',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('timesheet_id', sa.String(36), sa.ForeignKey('timesheets.id'), nullable=False, index=True),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('original_filename', sa.String(255), nullable=False),
        sa.Column('content_type', sa.String(100), nullable=False),
        sa.Column('size', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # Notes table
    op.create_table('notes',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('timesheet_id', sa.String(36), sa.ForeignKey('timesheets.id'), nullable=False, index=True),
        sa.Column('author_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('is_admin_note', sa.Boolean(), default=False, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # Notifications table
    op.create_table('notifications',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('timesheet_id', sa.String(36), sa.ForeignKey('timesheets.id'), nullable=True, index=True),
        sa.Column('type', sa.String(20), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('sent', sa.Boolean(), default=False, nullable=False),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )


def downgrade():
    """Drop all tables."""
    op.drop_table('notifications')
    op.drop_table('notes')
    op.drop_table('attachments')
    op.drop_table('timesheet_entries')
    op.drop_table('timesheets')
    op.drop_table('users')
