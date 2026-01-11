"""
Attachment Tests

API tests for timesheet attachment operations.
"""

import pytest
import io
import os
from flask import current_app
from app.extensions import db
from app.models import Attachment, TimesheetStatus


class TestAttachments:
    """Tests for timesheet attachments."""

    def test_upload_attachment_unauthenticated(self, client, sample_timesheet):
        """Test that unauthenticated users cannot upload attachments."""
        data = {
            'file': (io.BytesIO(b"%PDF-1.4 test"), 'test.pdf')
        }
        response = client.post(
            f"/api/timesheets/{sample_timesheet['id']}/attachments",
            data=data,
            content_type='multipart/form-data'
        )
        assert response.status_code == 401

    def test_upload_pdf(self, auth_client, sample_timesheet):
        """Test uploading a valid PDF."""
        data = {
            'file': (io.BytesIO(b"%PDF-1.4 test"), 'test.pdf')
        }
        response = auth_client.post(
            f"/api/timesheets/{sample_timesheet['id']}/attachments",
            data=data,
            content_type='multipart/form-data'
        )
        assert response.status_code == 201

        res_data = response.get_json()
        assert res_data['filename'] == 'test.pdf'
        assert res_data['mime_type'] == 'application/pdf'
        assert 'id' in res_data

    def test_upload_png(self, auth_client, sample_timesheet):
        """Test uploading a valid PNG."""
        data = {
            'file': (io.BytesIO(b"\x89PNG\r\n\x1a\n test"), 'test.png')
        }
        response = auth_client.post(
            f"/api/timesheets/{sample_timesheet['id']}/attachments",
            data=data,
            content_type='multipart/form-data'
        )
        assert response.status_code == 201

        res_data = response.get_json()
        assert res_data['filename'] == 'test.png'

    def test_upload_invalid_extension(self, auth_client, sample_timesheet):
        """Test uploading a file with an invalid extension."""
        data = {
            'file': (io.BytesIO(b"test content"), 'test.exe')
        }
        response = auth_client.post(
            f"/api/timesheets/{sample_timesheet['id']}/attachments",
            data=data,
            content_type='multipart/form-data'
        )
        assert response.status_code == 400
        assert "not allowed" in response.get_json()['error']

    def test_upload_invalid_magic_number(self, auth_client, sample_timesheet):
        """Test uploading a PDF with invalid content (magic number mismatch)."""
        data = {
            'file': (io.BytesIO(b"Not a PDF"), 'test.pdf')
        }
        response = auth_client.post(
            f"/api/timesheets/{sample_timesheet['id']}/attachments",
            data=data,
            content_type='multipart/form-data'
        )
        assert response.status_code == 400
        assert "content does not match extension" in response.get_json()['error']

    def test_list_attachments(self, auth_client, sample_timesheet):
        """Test listing attachments for a timesheet."""
        # 1. Upload a file first
        data = {
            'file': (io.BytesIO(b"%PDF-1.4 test"), 'test.pdf')
        }
        auth_client.post(
            f"/api/timesheets/{sample_timesheet['id']}/attachments",
            data=data,
            content_type='multipart/form-data'
        )

        # 2. Get timesheet which includes attachments
        response = auth_client.get(f"/api/timesheets/{sample_timesheet['id']}")
        assert response.status_code == 200
        res_data = response.get_json()
        assert 'attachments' in res_data
        assert len(res_data['attachments']) == 1
        assert res_data['attachments'][0]['filename'] == 'test.pdf'

    def test_delete_attachment(self, auth_client, sample_timesheet, app):
        """Test deleting an attachment."""
        # 1. Upload first
        data = {
            'file': (io.BytesIO(b"%PDF-1.4 test"), 'test.pdf')
        }
        upload_res = auth_client.post(
            f"/api/timesheets/{sample_timesheet['id']}/attachments",
            data=data,
            content_type='multipart/form-data'
        )
        res_data = upload_res.get_json()
        attachment_id = res_data['id']

        # Get the stored filename from DB
        with app.app_context():
            attachment = Attachment.query.get(attachment_id)
            stored_filename = attachment.filename
            filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], stored_filename)
            assert os.path.exists(filepath)

        # 2. Delete
        response = auth_client.delete(
            f"/api/timesheets/{sample_timesheet['id']}/attachments/{attachment_id}"
        )
        assert response.status_code == 200

        # 3. Verify gone from DB and disk
        with app.app_context():
            assert Attachment.query.get(attachment_id) is None
            assert not os.path.exists(filepath)

    def test_delete_submitted_timesheet_attachment(self, auth_client, submitted_timesheet, app):
        """Test that attachments on submitted timesheets cannot be deleted."""
        # Add an attachment directly to DB for a submitted timesheet
        with app.app_context():
            attachment = Attachment(
                timesheet_id=submitted_timesheet['id'],
                filename="test.pdf",
                original_filename="test.pdf",
                mime_type="application/pdf",
                file_size=100
            )
            db.session.add(attachment)
            db.session.commit()
            attachment_id = attachment.id

        response = auth_client.delete(
            f"/api/timesheets/{submitted_timesheet['id']}/attachments/{attachment_id}"
        )
        assert response.status_code == 400
        assert "Only draft" in response.get_json()['error']

    def test_reimbursement_type_tagging(self, auth_client, sample_timesheet):
        """Test uploading an attachment with a reimbursement type."""
        data = {
            'file': (io.BytesIO(b"%PDF-1.4 test"), 'receipt.pdf'),
            'reimbursement_type': 'Car'
        }
        response = auth_client.post(
            f"/api/timesheets/{sample_timesheet['id']}/attachments",
            data=data,
            content_type='multipart/form-data'
        )
        assert response.status_code == 201
        assert response.get_json()['reimbursement_type'] == 'Car'

    def test_admin_download_attachment(self, admin_client, sample_user, app):
        """Test that admins can download attachments using the admin route."""
        # Create timesheet and attachment as the user
        with app.app_context():
            from datetime import date, timedelta
            from app.models import Timesheet, TimesheetStatus

            today = date.today()
            days_since_sunday = (today.weekday() + 1) % 7
            week_start = today - timedelta(days=days_since_sunday)

            timesheet = Timesheet(
                user_id=sample_user['id'],
                week_start=week_start,
                status=TimesheetStatus.SUBMITTED
            )
            db.session.add(timesheet)
            db.session.flush()

            # Create file on disk
            stored_filename = 'test-attachment.pdf'
            filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], stored_filename)
            with open(filepath, 'wb') as f:
                f.write(b"%PDF-1.4 test")

            attachment = Attachment(
                timesheet_id=timesheet.id,
                filename=stored_filename,
                original_filename="test.pdf",
                mime_type="application/pdf",
                file_size=15
            )
            db.session.add(attachment)
            db.session.commit()

            timesheet_id = timesheet.id
            attachment_id = attachment.id

        # Admin downloads via admin API
        response = admin_client.get(
            f"/api/admin/timesheets/{timesheet_id}/attachments/{attachment_id}"
        )
        assert response.status_code == 200
        assert response.data == b"%PDF-1.4 test"