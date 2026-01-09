"""Add SharePoint sync fields to attachments (REQ-010)

Revision ID: 008_add_sharepoint_sync_fields
Revises: 007_add_attachment_reimbursement_type
Create Date: 2026-01-09
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "008_add_sharepoint_sync_fields"
down_revision = "007_add_attachment_reimbursement_type"
branch_labels = None
depends_on = None


def upgrade():
    """Add SharePoint sync columns to attachments."""
    with op.batch_alter_table("attachments", schema=None) as batch_op:
        batch_op.add_column(sa.Column("sharepoint_item_id", sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column("sharepoint_site_id", sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column("sharepoint_drive_id", sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column("sharepoint_web_url", sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column("sharepoint_sync_status", sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column("sharepoint_synced_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("sharepoint_last_attempt_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("sharepoint_last_error", sa.Text(), nullable=True))
        batch_op.add_column(
            sa.Column(
                "sharepoint_retry_count",
                sa.Integer(),
                nullable=False,
                server_default="0",
            )
        )
        batch_op.create_index(
            "ix_attachments_sharepoint_sync_status",
            ["sharepoint_sync_status"],
            unique=False,
        )


def downgrade():
    """Remove SharePoint sync columns from attachments."""
    with op.batch_alter_table("attachments", schema=None) as batch_op:
        batch_op.drop_index("ix_attachments_sharepoint_sync_status")
        batch_op.drop_column("sharepoint_retry_count")
        batch_op.drop_column("sharepoint_last_error")
        batch_op.drop_column("sharepoint_last_attempt_at")
        batch_op.drop_column("sharepoint_synced_at")
        batch_op.drop_column("sharepoint_sync_status")
        batch_op.drop_column("sharepoint_web_url")
        batch_op.drop_column("sharepoint_drive_id")
        batch_op.drop_column("sharepoint_site_id")
        batch_op.drop_column("sharepoint_item_id")
